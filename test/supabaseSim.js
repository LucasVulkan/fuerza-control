/**
 * supabaseSim — un Supabase de mentira con un Postgres de verdad debajo.
 *
 * Para probar la conexión entrenador ↔ cliente de punta a punta sin móviles:
 * el store REAL de la app, varias veces (un «móvil» por import), contra el SQL
 * REAL de `supabase/schema.sql` cargado en PGlite (Postgres compilado a WASM).
 *
 * Lo que es de verdad: las tablas, las funciones, la RLS (cada petición corre
 * como `authenticated` o `anon` con `auth.uid()` puesto), los errores de
 * Postgres y que un `update` filtrado por RLS dé 0 filas sin error.
 *
 * Lo que es imitación, y fiel solo en lo que la app usa:
 *  - El constructor de consultas de supabase-js (`from().select().eq()…`, `rpc`).
 *  - GoTrue: usuarios en `auth.users`, sesiones guardadas por móvil y por
 *    `storageKey` (como AsyncStorage), anónimos, contraseña e id_token. Un
 *    id_token de prueba es `'google:<sub>'` o `'apple:<sub>'`: mismo sub, mismo
 *    usuario, como en el proveedor de verdad.
 *  - Las dos Edge Functions (`create-trainer-account`, `delete-account`), con la
 *    misma lógica que `supabase/functions/*`.
 *
 * Fallos: `server.offline = true` corta la red a todos; `device.offline` a un
 * móvil; `server.failOnce('rpc:accept_transfer')` hace fallar una vez la
 * próxima llamada que case (rpc:<nombre>, from:<tabla>, auth:<método>, fn:<nombre>).
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';

const SCHEMA = fileURLToPath(new URL('../supabase/schema.sql', import.meta.url));

// Lo que Supabase trae de serie y schema.sql da por hecho.
const PRELUDE = `
  create schema if not exists auth;
  create table auth.users (
    id uuid primary key,
    email text unique,
    is_anonymous boolean not null default false
  );
  create table auth.identities (user_id uuid references auth.users on delete cascade, provider text);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create role anon nologin;
  create role authenticated nologin;
  grant usage on schema public, auth to anon, authenticated;
`;

const NETWORK_ERROR = () => Object.assign(new Error('Failed to fetch'), { name: 'AuthRetryableFetchError', status: 0 });

// ─── Servidor ─────────────────────────────────────────────────────────────────

export async function createServer({ schema = SCHEMA } = {}) {
  const db = new PGlite();
  await db.exec(PRELUDE);
  await db.exec(readFileSync(schema, 'utf8'));

  let lock = Promise.resolve();
  const failures = [];

  const server = {
    db,
    offline: false,
    users:  new Map(),   // id → { id, email, password, anonymous, identities: Set }
    tokens: new Map(),   // access/refresh token → user id
    calls:  [],          // registro de llamadas, para los tests

    /** La próxima llamada que case con `key` falla como un corte de red. */
    failOnce(key) { failures.push(key); },

    _shouldFail(key, device) {
      if (server.offline || device?.offline) return true;
      const i = failures.indexOf(key);
      if (i >= 0) { failures.splice(i, 1); return true; }
      return false;
    },

    /** Una petición: transacción propia, rol y `auth.uid()` como PostgREST. */
    async as(uid, fn) {
      const run = lock.then(async () => {
        await db.exec('begin');
        try {
          await db.query(`select set_config('role', $1, true), set_config('request.jwt.claim.sub', $2, true)`,
            [uid ? 'authenticated' : 'anon', uid ?? '']);
          const out = await fn(db);
          await db.exec('commit');
          return out;
        } catch (err) {
          await db.exec('rollback');
          throw err;
        }
      });
      lock = run.catch(() => {});
      return run;
    },

    /** Como service role: sin RLS. Para las Edge Functions y los tests. */
    async admin(sql, params = []) {
      const run = lock.then(() => db.query(sql, params));
      lock = run.catch(() => {});
      return (await run).rows.map(normalizeRow);
    },

    createUser({ email = null, password = null, anonymous = false, identity = null }) {
      const id = randomUUID();
      const user = { id, email, password, anonymous, identities: new Set(identity ? [identity] : []) };
      server.users.set(id, user);
      return server.admin('insert into auth.users (id, email, is_anonymous) values ($1, $2, $3)', [id, email, anonymous])
        .then(() => identity && server.admin('insert into auth.identities (user_id, provider) values ($1, $2)', [id, identity.split(':')[0]]))
        .then(() => user);
    },

    async deleteUser(id) {
      server.users.delete(id);
      await server.admin('delete from auth.users where id = $1', [id]);
    },

    issueSession(user) {
      const access = `at-${randomUUID()}`;
      const refresh = `rt-${randomUUID()}`;
      server.tokens.set(access, user.id);
      server.tokens.set(refresh, user.id);
      return { access_token: access, refresh_token: refresh, user: publicUser(user) };
    },

    /** Las filas de la tabla, sin RLS. */
    slots() { return server.admin('select * from public.trainer_clients order by created_at'); },
  };
  return server;
}

function publicUser(u) {
  const provider = u.anonymous ? 'anonymous' : [...u.identities][0]?.split(':')[0] ?? 'email';
  return { id: u.id, email: u.email, is_anonymous: u.anonymous, user_metadata: {}, app_metadata: { provider } };
}

function normalizeRow(row) {
  const out = {};
  for (const [k, v] of Object.entries(row)) out[k] = v instanceof Date ? v.toISOString() : v;
  return out;
}

function pgError(err) {
  return { message: err.message, code: err.code ?? null, details: err.detail ?? null };
}

// ─── Móvil ────────────────────────────────────────────────────────────────────

/** Un móvil: su almacenamiento (lo que sobrevive a cerrar la app) y su red. */
export function createDevice(server, name) {
  return { server, name, storage: new Map(), offline: false };
}

/** Borrar los datos de la app: se va todo lo guardado, sesiones incluidas. */
export function wipeDevice(device) {
  device.storage.clear();
}

// ─── El cliente de supabase-js ────────────────────────────────────────────────

/**
 * `createClient` para un móvil. `storageKey` como en supabase-js; con
 * `persistSession: false` la sesión vive solo en memoria (cliente temporal).
 */
export function createSimClient(device, { storageKey = 'sb-default', persistSession = true } = {}) {
  const { server } = device;
  let memory = null;
  const listeners = new Set();

  const store = {
    get: () => (persistSession ? device.storage.get(storageKey) ?? null : memory),
    set: (s) => {
      if (persistSession) { if (s) device.storage.set(storageKey, s); else device.storage.delete(storageKey); }
      else memory = s;
      listeners.forEach((fn) => fn(s ? 'SIGNED_IN' : 'SIGNED_OUT', s));
    },
  };

  const uid = () => {
    const s = store.get();
    return s ? server.tokens.get(s.access_token) ?? null : null;
  };

  const net = (key) => {
    server.calls.push({ device: device.name, storageKey, key, uid: uid() });
    if (server._shouldFail(key, device)) throw NETWORK_ERROR();
  };

  const authResult = async (key, fn) => {
    try {
      net(`auth:${key}`);
      return await fn();
    } catch (error) {
      return { data: { user: null, session: null }, error };
    }
  };

  const signedIn = (user) => {
    const session = server.issueSession(user);
    store.set(session);
    return { data: { user: session.user, session }, error: null };
  };

  const auth = {
    signInAnonymously: () => authResult('signInAnonymously', async () =>
      signedIn(await server.createUser({ anonymous: true }))),

    signInWithPassword: ({ email, password }) => authResult('signInWithPassword', async () => {
      const user = [...server.users.values()].find((u) => u.email === email && u.password === password);
      if (!user) return { data: { user: null, session: null }, error: new Error('Invalid login credentials') };
      return signedIn(user);
    }),

    signInWithIdToken: ({ provider, token }) => authResult('signInWithIdToken', async () => {
      const [p, sub] = String(token).split(':');
      if (p !== provider || !sub) return { data: { user: null, session: null }, error: new Error('Bad ID token') };
      const identity = `${provider}:${sub}`;
      const user = [...server.users.values()].find((u) => u.identities.has(identity))
        ?? await server.createUser({ email: `${sub}@${provider}.test`, identity });
      return signedIn(user);
    }),

    setSession: ({ access_token, refresh_token }) => authResult('setSession', async () => {
      const id = server.tokens.get(access_token);
      const user = id && server.users.get(id);
      if (!user || server.tokens.get(refresh_token) !== id) {
        return { data: { user: null, session: null }, error: new Error('Invalid Refresh Token') };
      }
      const session = { access_token, refresh_token, user: publicUser(user) };
      store.set(session);
      return { data: { user: session.user, session }, error: null };
    }),

    // Lee el almacenamiento, sin red: como supabase-js mientras el token no caduca.
    getSession: async () => ({ data: { session: store.get() }, error: null }),

    getUser: () => authResult('getUser', async () => {
      const id = uid();
      const user = id && server.users.get(id);
      if (!user) return { data: { user: null }, error: new Error('User not found') };
      return { data: { user: publicUser(user) }, error: null };
    }),

    // scope 'local' (lo que hace la app): solo este almacenamiento.
    signOut: async () => { store.set(null); return { error: null }; },

    onAuthStateChange: (fn) => {
      listeners.add(fn);
      return { data: { subscription: { unsubscribe: () => listeners.delete(fn) } } };
    },
  };

  const rpc = async (name, args = {}) => {
    try {
      net(`rpc:${name}`);
      const keys = Object.keys(args);
      const sql = `select * from public.${name}(${keys.map((k, i) => `${k} => $${i + 1}`).join(', ')})`;
      const [info] = await server.admin(
        `select p.proretset as set, t.typtype as typ, t.typname as name
           from pg_proc p join pg_type t on t.oid = p.prorettype where p.proname = $1`, [name]);
      const rows = await server.as(uid(), (db) => db.query(sql, keys.map((k) => toParam(args[k]))));
      const data = rows.rows.map(normalizeRow);
      if (info?.set || info?.typ === 'c') return { data, error: null };
      if (info?.name === 'void') return { data: null, error: null };
      return { data: data[0] ? Object.values(data[0])[0] : null, error: null };
    } catch (err) {
      return { data: null, error: err.name === 'AuthRetryableFetchError' ? { message: err.message } : pgError(err) };
    }
  };

  const functions = {
    invoke: async (name, { body } = {}) => {
      try {
        net(`fn:${name}`);
        const handler = EDGE_FUNCTIONS[name];
        if (!handler) return { data: null, error: new Error(`Function ${name} not found`) };
        return { data: await handler(server, { body, uid: uid() }), error: null };
      } catch (err) {
        return { data: null, error: err };
      }
    },
  };

  return { auth, rpc, functions, from: (table) => new Query({ server, uid, net }, table) };
}

function toParam(v) {
  return v !== null && typeof v === 'object' ? JSON.stringify(v) : v;
}

// ─── Las Edge Functions, con la lógica de supabase/functions/* ────────────────

const CODE_RE = /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/;

const EDGE_FUNCTIONS = {
  'create-trainer-account': async (server, { body }) => {
    const code = body?.code;
    if (typeof code !== 'string' || !CODE_RE.test(code)) return { error: 'Código inválido' };
    const email = `trainer-${code.toLowerCase().replace(/-/g, '')}@noreply.fuerzacontrol.com`;
    if ([...server.users.values()].some((u) => u.email === email)) return { exists: true };
    const user = await server.createUser({ email, password: code });
    return { userId: user.id };
  },

  'delete-account': async (server, { uid }) => {
    // El 401 real llega como FunctionsHttpError con la respuesta en `context`.
    if (!uid || !server.users.has(uid)) throw Object.assign(new Error('Edge Function returned a non-2xx status code'), { name: 'FunctionsHttpError', context: { status: 401 } });
    await server.admin('delete from public.trainer_clients where trainer_id = $1', [uid]);
    await server.admin(`update public.trainer_clients
                           set client_id = null, disconnected_at = now(), history_json = null,
                               history_updated_at = null, sessions_count = 0
                         where client_id = $1`, [uid]);
    await server.admin('delete from public.profiles where id = $1', [uid]);
    await server.deleteUser(uid);
    return { ok: true };
  },
};

// ─── Constructor de consultas (el subconjunto de PostgREST que usa la app) ────

const ident = (s) => `"${s.replace(/"/g, '')}"`;

/** `id, progress:history_json->progress` → SQL. */
function selectList(cols) {
  if (!cols || cols.trim() === '*') return '*';
  return cols.split(',').map((raw) => {
    const part = raw.trim();
    const [alias, expr] = part.includes(':') ? part.split(':') : [null, part];
    const path = expr.split(/(->>?)/);
    let sql = ident(path[0]);
    for (let i = 1; i < path.length; i += 2) sql += `${path[i]}'${path[i + 1]}'`;
    return `${sql} as ${ident(alias ?? path[path.length - 1])}`;
  }).join(', ');
}

class Query {
  constructor(ctx, table) {
    Object.assign(this, { ctx, table, op: 'select', cols: '*', filters: [], orderBy: null, mode: 'many', values: null, returning: false });
  }
  select(cols = '*') { if (this.op === 'select') this.cols = cols; else { this.returning = true; this.cols = cols; } return this; }
  insert(values) { this.op = 'insert'; this.values = values; return this; }
  upsert(values) { this.op = 'upsert'; this.values = values; return this; }
  update(values) { this.op = 'update'; this.values = values; return this; }
  delete() { this.op = 'delete'; return this; }
  eq(col, val) { this.filters.push([col, val]); return this; }
  order(col, { ascending = true } = {}) { this.orderBy = `${ident(col)} ${ascending ? 'asc' : 'desc'}`; return this; }
  single() { this.mode = 'single'; return this; }
  maybeSingle() { this.mode = 'maybe'; return this; }

  then(resolve, reject) { return this.run().then(resolve, reject); }

  async run() {
    const { ctx } = this;
    try {
      ctx.net(`from:${this.table}`);
      const params = [];
      const p = (v) => { params.push(toParam(v)); return `$${params.length}`; };
      const where = this.filters.length ? ` where ${this.filters.map(([c, v]) => `${ident(c)} = ${p(v)}`).join(' and ')}` : '';
      const ret = this.returning || this.op === 'select' ? selectList(this.cols) : null;
      const t = `public.${ident(this.table)}`;
      let sql;
      if (this.op === 'select') {
        sql = `select ${ret} from ${t}${where}${this.orderBy ? ` order by ${this.orderBy}` : ''}`;
      } else if (this.op === 'insert' || this.op === 'upsert') {
        const cols = Object.keys(this.values);
        sql = `insert into ${t} (${cols.map(ident).join(', ')}) values (${cols.map((c) => p(this.values[c])).join(', ')})`;
        if (this.op === 'upsert') sql += ` on conflict (id) do update set ${cols.map((c) => `${ident(c)} = excluded.${ident(c)}`).join(', ')}`;
        if (ret) sql += ` returning ${ret}`;
      } else if (this.op === 'update') {
        const sets = Object.keys(this.values).map((c) => `${ident(c)} = ${p(this.values[c])}`).join(', ');
        sql = `update ${t} set ${sets}${where}${ret ? ` returning ${ret}` : ''}`;
      } else {
        sql = `delete from ${t}${where}${ret ? ` returning ${ret}` : ''}`;
      }
      const res = await ctx.server.as(ctx.uid(), (db) => db.query(sql, params));
      const rows = res.rows.map(normalizeRow);
      if (this.op !== 'select' && !this.returning) return { data: null, error: null };
      if (this.mode === 'single') {
        if (rows.length !== 1) return { data: null, error: { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' } };
        return { data: rows[0], error: null };
      }
      if (this.mode === 'maybe') {
        if (rows.length > 1) return { data: null, error: { code: 'PGRST116', message: 'multiple rows returned' } };
        return { data: rows[0] ?? null, error: null };
      }
      return { data: rows, error: null };
    } catch (err) {
      return { data: null, error: err.name === 'AuthRetryableFetchError' ? { message: err.message } : pgError(err) };
    }
  }
}
