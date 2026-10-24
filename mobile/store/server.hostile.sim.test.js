/**
 * I02-02 — El servidor contra un cliente hostil, en crudo: `rpc` y `from` con
 * el pase (JWT) de un atacante, sin el store de la app de por medio.
 *
 * Un `describe` por hallazgo de la auditoría (H1…H16) y uno para lo descartado
 * (T-A*, T-B*, T-C*). Cómo leerlos:
 *  - «Hx hoy: …»   afirma el comportamiento ACTUAL, el que viola la regla que
 *                  se cita. Verde = el fallo existe tal cual. Al arreglarlo se
 *                  pone rojo y se invierte la aserción.
 *  - «Hx regla …» / «T-… regla …»  afirma la regla firmada (I02 §3) y pasa.
 * Cada montaje se comprueba con `expect` antes de la aserción final, para que
 * un montaje roto no «confirme» nada.
 *
 * Lo que necesita el store real está en `connection.audit.sim.test.js`.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createServer, createDevice, createSimClient } from '../../test/supabaseSim.js';

const AUDIT = readFileSync(fileURLToPath(new URL('../../supabase/audit.sql', import.meta.url)), 'utf8');

let server;
beforeEach(async () => { server = await createServer(); });

// ─── Quién llama ──────────────────────────────────────────────────────────────

const noSession = (name = 'nadie') => createSimClient(createDevice(server, name));

async function anon(name) {
  const db = noSession(name);
  const { data, error } = await db.auth.signInAnonymously();
  expect(error).toBeNull();
  return { db, id: data.user.id };
}

/** Cuenta de entrenador con código, como la crea la app. */
async function account(name, code) {
  const db = noSession(name);
  const made = await db.functions.invoke('create-trainer-account', { body: { code } });
  expect(made.data?.userId).toBeTruthy();
  const email = `trainer-${code.toLowerCase().replace(/-/g, '')}@noreply.fuerzacontrol.com`;
  const { data, error } = await db.auth.signInWithPassword({ email, password: code });
  expect(error).toBeNull();
  return { db, id: data.user.id };
}

async function gugl(name, sub) {
  const db = noSession(name);
  const { data, error } = await db.auth.signInWithIdToken({ provider: 'google', token: `google:${sub}` });
  expect(error).toBeNull();
  return { db, id: data.user.id };
}

// ─── Piezas ───────────────────────────────────────────────────────────────────

/** rpc que tiene que ir bien: devuelve `data`. */
async function ok(db, name, args = {}) {
  const { data, error } = await db.rpc(name, args);
  expect(error, `${name}: ${error?.message}`).toBeNull();
  return data;
}

/** rpc que tiene que fallar: devuelve el error. */
async function bad(db, name, args = {}) {
  const { data, error } = await db.rpc(name, args);
  expect(error, `${name} debía fallar y devolvió ${JSON.stringify(data)}`).toBeTruthy();
  return error;
}

/** Un hueco con programa: S = su id, K = su código. */
async function slotWithProgram(trainer, name = 'Ana') {
  const [row] = await ok(trainer.db, 'trainer_create_slot', { p_client_name: name });
  expect(row?.slot_id).toBeTruthy();
  await ok(trainer.db, 'trainer_upload_program', { p_slot_id: row.slot_id, p_program: { program: { name: 'Fuerza' } }, p_trainer_name: 'Entrenador' });
  return { S: row.slot_id, K: row.code };
}

async function link(who, K, expectedSlot) {
  const slot = await ok(who.db, 'link_client_to_slot', { p_code: K });
  if (expectedSlot) expect(slot).toBe(expectedSlot);
  return slot;
}

async function upload(who, ids) {
  return ok(who.db, 'client_upload_history', { p_history: { entries: ids.map((id) => ({ id })) }, p_sessions: ids.length });
}

const slotOf = async (id) => (await server.slots()).find((r) => r.id === id);
const historyIds = (row) => row?.history_json?.entries?.map((e) => e.id) ?? null;
const audit = () => server.admin(AUDIT);

// ═════════════════════════════════════════════════════════════════════════════

describe('H1 — entrar con el código hereda el historial del hueco', () => {
  it('H1 regla R-B4: quien entra con el código ve el historial que hay en el hueco', async () => {
    const t = await account('t', 'ABCD-EFGH-JKLM');
    const { S, K } = await slotWithProgram(t);
    const c = await anon('c');
    await link(c, K, S);
    expect(await upload(c, ['s1'])).toBe(S);

    const y = await anon('y');
    await link(y, K, S);
    const { data, error } = await y.db.from('trainer_clients').select('history_json').eq('client_id', y.id);
    expect(error).toBeNull();
    expect(historyIds(data[0])).toEqual(['s1']);
  });

  it('H1b regla R-B4 (aceptado 23-oct, «un hueco = una persona»): tras reemitir, otra persona con el código NUEVO ve el historial del anterior', async () => {
    const t = await account('t', 'ABCD-EFGH-JKLM');
    const { S, K } = await slotWithProgram(t);
    const c = await anon('c');
    await link(c, K, S);
    await upload(c, ['de-c']);

    const fresh = await ok(t.db, 'trainer_reissue_client_code', { p_slot_id: S });
    expect(fresh).not.toBe(K);
    expect((await slotOf(S)).client_id).toBeNull();
    const z = await anon('z');
    await link(z, fresh, S);
    const { data } = await z.db.from('trainer_clients').select('history_json').eq('client_id', z.id);
    expect(historyIds(data[0])).toEqual(['de-c']);
  });
});

describe('H2 — get_slot_by_code devuelve de más', () => {
  it('H2 hoy: get_slot_by_code devuelve 9 campos, con id y la hora de la última subida (regla R-A5: solo 3 nombres)', async () => {
    const t = await account('t', 'ABCD-EFGH-JKLM');
    const { S, K } = await slotWithProgram(t);
    const c = await anon('c');
    await link(c, K, S);
    await upload(c, ['s1']);
    const uploadedAt = (await slotOf(S)).history_updated_at;
    expect(uploadedAt).toBeTruthy();

    const z = await anon('z');                                   // no entra: solo teclea el código
    const rows = await ok(z.db, 'get_slot_by_code', { p_code: K });
    expect(rows).toHaveLength(1);
    expect(Object.keys(rows[0]).sort()).toEqual([
      'client_name', 'history_updated_at', 'id', 'is_linked', 'is_mine', 'locked_by',
      'program_name', 'program_updated_at', 'trainer_name',
    ]);
    expect(rows[0]).toMatchObject({ id: S, is_linked: true, is_mine: false, history_updated_at: uploadedAt });
    expect((await slotOf(S)).client_id).toBe(c.id);              // z no ha entrado
  });
});

describe('H3 — audit.sql no ve derivas graves', () => {
  it('H3 montaje: con el schema.sql limpio, audit.sql sale vacío', async () => {
    expect(await audit()).toEqual([]);
  });

  const drifts = [
    ['RLS desactivada en trainer_clients',
      'alter table public.trainer_clients disable row level security',
      `select not relrowsecurity as ok from pg_class where oid = 'public.trainer_clients'::regclass`],
    ['política SELECT using(true)',
      'create policy p on public.trainer_clients for select to authenticated using (true)',
      `select count(*) = 1 as ok from pg_policies where tablename = 'trainer_clients' and policyname = 'p'`],
    ['EXECUTE a anon en get_slot_by_code',
      'grant execute on function public.get_slot_by_code(text) to anon',
      `select has_function_privilege('anon', 'public.get_slot_by_code(text)', 'execute') as ok`],
    ['EXECUTE a PUBLIC en link_client_to_slot',
      'grant execute on function public.link_client_to_slot(text) to public',
      `select has_function_privilege('anon', 'public.link_client_to_slot(text)', 'execute') as ok`],
    ['sin el índice de un asiento por cliente',
      'drop index public.trainer_clients_one_seat',
      `select to_regclass('public.trainer_clients_one_seat') is null as ok`],
    ['sin la FK del cliente',
      'alter table public.trainer_clients drop constraint trainer_clients_client_fk',
      `select not exists (select 1 from pg_constraint where conname = 'trainer_clients_client_fk') as ok`],
    ['UPDATE a PUBLIC sobre la tabla',
      'grant update on public.trainer_clients to public',
      `select has_table_privilege('anon', 'public.trainer_clients', 'update') as ok`],
    ['UPDATE por columna (trainer_id) a authenticated',
      'grant update (trainer_id) on public.trainer_clients to authenticated',
      `select has_column_privilege('authenticated', 'public.trainer_clients', 'trainer_id', 'update') as ok`],
    ['link_client_to_slot con un cuerpo viejo (sin SEAT_LOCKED)',
      `create or replace function public.link_client_to_slot(p_code text) returns uuid
         language plpgsql security definer set search_path = public as $$
         declare v uuid; begin
           update public.trainer_clients set client_id = auth.uid() where client_code = upper(trim(p_code)) returning id into v;
           return v; end; $$`,
      `select prosrc not like '%SEAT_LOCKED%' as ok from pg_proc where proname = 'link_client_to_slot'`],
    ['RLS desactivada en profiles',
      'alter table public.profiles disable row level security',
      `select not relrowsecurity as ok from pg_class where oid = 'public.profiles'::regclass`],
  ];

  for (const [what, drift, applied] of drifts) {
    it(`H3 hoy: «${what}» y audit.sql sale vacío (regla R-A9: ≥1 fila)`, async () => {
      await server.admin(drift);
      expect((await server.admin(applied))[0].ok).toBe(true);
      expect(await audit()).toEqual([]);
    });
  }
});

describe('H4 — el candado salta con cualquier cuenta no anónima', () => {
  it('H4 regla R-B2 (ajustada 23-oct): una cuenta que no es solo el código, también la de código, bloquea el asiento', async () => {
    const t = await account('t', 'ABCD-EFGH-JKLM');
    const { S, K } = await slotWithProgram(t);
    const e = await account('e', 'BCDE-FGHJ-KLMN');
    await link(e, K, S);

    const y = await anon('y');
    expect((await ok(y.db, 'get_slot_by_code', { p_code: K }))[0].locked_by).toBe('account');
    expect((await bad(y.db, 'link_client_to_slot', { p_code: K })).message).toBe('SEAT_LOCKED');
    expect((await slotOf(S)).client_id).toBe(e.id);
  });
});

describe('H5 — client_lost_reason da el motivo equivocado', () => {
  it('H5a hoy: echado una vez, entra en otro hueco y ese entrenador lo borra → «taken» (regla R-B3: «gone»)', async () => {
    const a = await account('a', 'ABCD-EFGH-JKLM');
    const b = await account('b', 'BCDE-FGHJ-KLMN');
    const A = await slotWithProgram(a);
    const B = await slotWithProgram(b);
    const c = await anon('c');
    const otro = await anon('otro');
    await link(c, A.K, A.S);
    await link(otro, A.K, A.S);                                  // c sale de A: displaced_client_id = c
    await link(c, B.K, B.S);
    expect((await slotOf(B.S)).client_id).toBe(c.id);
    expect(await ok(b.db, 'trainer_delete_slot', { p_slot_id: B.S })).toBe(true);
    const { data } = await c.db.from('trainer_clients').select('id');
    expect(data).toEqual([]);                                    // c ya no tiene asiento

    expect(await ok(c.db, 'client_lost_reason')).toBe('taken');
  });

  it('H5b hoy: c echado por y, y echado por z → c recibe «gone» (regla R-B3: «taken»)', async () => {
    const t = await account('t', 'ABCD-EFGH-JKLM');
    const { S, K } = await slotWithProgram(t);
    const [c, y, z] = [await anon('c'), await anon('y'), await anon('z')];
    await link(c, K, S);
    await link(y, K, S);
    await link(z, K, S);
    expect(await slotOf(S)).toMatchObject({ client_id: z.id, displaced_client_id: y.id });

    expect(await ok(c.db, 'client_lost_reason')).toBe('gone');
  });
});

describe('H6 — desconectarse / cambiar de entrenador / borrar cuenta vacían el hueco', () => {
  it('H6 regla R-B6 (E27): release_client_slot solo suelta el asiento; historial, sesiones y prescripciones se quedan', async () => {
    const t = await account('t', 'ABCD-EFGH-JKLM');
    const { S, K } = await slotWithProgram(t);
    await ok(t.db, 'trainer_upload_overrides', { p_slot_id: S, p_overrides: { tpl: { reps: 5 } } });
    const x = await anon('x');
    await link(x, K, S);
    await upload(x, ['s1']);
    expect(await slotOf(S)).toMatchObject({ sessions_count: 1, overrides_json: { tpl: { reps: 5 } } });
    expect(historyIds(await slotOf(S))).toEqual(['s1']);

    expect(await ok(x.db, 'release_client_slot')).toBe(1);
    const row = await slotOf(S);
    expect(row.disconnected_at).toBeTruthy();
    expect(row).toMatchObject({ client_id: null, sessions_count: 1, overrides_json: { tpl: { reps: 5 } } });
    expect(historyIds(row)).toEqual(['s1']);
    expect(row.history_updated_at).toBeTruthy();
    expect(row.program_json).toEqual({ program: { name: 'Fuerza' } });   // el programa sí se queda
  });

  it('H6 regla R-B6 (E27): entrar en otro hueco suelta el anterior sin vaciarle el historial', async () => {
    const a = await account('a', 'ABCD-EFGH-JKLM');
    const b = await account('b', 'BCDE-FGHJ-KLMN');
    const A = await slotWithProgram(a);
    const B = await slotWithProgram(b);
    const x = await anon('x');
    await link(x, A.K, A.S);
    await upload(x, ['de-A']);
    expect(historyIds(await slotOf(A.S))).toEqual(['de-A']);

    await link(x, B.K, B.S);
    expect(await slotOf(A.S)).toMatchObject({ client_id: null, sessions_count: 1 });
    expect(historyIds(await slotOf(A.S))).toEqual(['de-A']);
  });

  it('H6 regla R-C4 (decidido 23-oct): borrar la cuenta vacía el historial del hueco que ocupa ahora', async () => {
    const t = await account('t', 'ABCD-EFGH-JKLM');
    const { S, K } = await slotWithProgram(t);
    await ok(t.db, 'trainer_upload_overrides', { p_slot_id: S, p_overrides: { tpl: { reps: 5 } } });
    const x = await anon('x');
    await link(x, K, S);
    await upload(x, ['s1']);
    expect(historyIds(await slotOf(S))).toEqual(['s1']);

    const { data, error } = await x.db.functions.invoke('delete-account');
    expect(error).toBeNull();
    expect(data).toEqual({ ok: true });
    // El historial es del cliente y se va con su cuenta; las prescripciones son del entrenador.
    expect(await slotOf(S)).toMatchObject({ client_id: null, history_json: null, sessions_count: 0, overrides_json: { tpl: { reps: 5 } } });
  });
});

describe('H7 — transfer_my_seat_to sin asiento no falla', () => {
  it('H7 hoy: sin asiento, transfer_my_seat_to devuelve 0 sin error (regla R-C1: debe fallar NO_SEAT)', async () => {
    const x = await anon('x');                                    // sin asiento
    const g = await gugl('g', 'cli');
    const { data } = await x.db.from('trainer_clients').select('id');
    expect(data).toEqual([]);

    expect(await x.db.rpc('transfer_my_seat_to', { p_new_client_id: g.id })).toEqual({ data: 0, error: null });
  });
});

describe('H8 — client_upload_history reemplaza el historial entero', () => {
  it('H8 hoy: dos subidas con listas distintas → queda solo la última (regla R-C2: llegan las dos)', async () => {
    const t = await account('t', 'ABCD-EFGH-JKLM');
    const { S, K } = await slotWithProgram(t);
    const x = await anon('x');
    await link(x, K, S);
    await upload(x, ['a1']);
    expect(historyIds(await slotOf(S))).toEqual(['a1']);
    await upload(x, ['b1']);
    expect(historyIds(await slotOf(S))).toEqual(['b1']);
  });
});

describe('H10 — transfer_my_slots_to mete huecos en la cuenta de otro', () => {
  it('H10 hoy: un entrenador regala su hueco «SPAM» a la víctima, cuyo id lee un cliente suyo (regla: solo se cede a una cuenta propia)', async () => {
    const v = await account('v', 'ABCD-EFGH-JKLM');
    const own = await slotWithProgram(v, 'Cliente de V');
    const c = await anon('c');
    await link(c, own.K, own.S);
    const { data: seen, error } = await c.db.from('trainer_clients').select('trainer_id');
    expect(error).toBeNull();
    expect(seen).toEqual([{ trainer_id: v.id }]);                // el cliente lee el uuid del entrenador

    const atk = await account('atk', 'WXYZ-WXYZ-WXYZ');
    const spam = await slotWithProgram(atk, 'SPAM');
    expect(await ok(atk.db, 'transfer_my_slots_to', { p_new_trainer_id: seen[0].trainer_id })).toBe(1);

    expect((await slotOf(spam.S)).trainer_id).toBe(v.id);
    const { data: victimSees } = await v.db.from('trainer_clients').select('client_name');
    expect(victimSees.map((r) => r.client_name).sort()).toEqual(['Cliente de V', 'SPAM']);
  });
});

describe('H11 — transfer_my_seat_to planta un asiento en una cuenta ajena', () => {
  it('H11 hoy: un anónimo sentado pasa su asiento a un Google ajeno sin su consentimiento', async () => {
    const t = await account('t', 'ABCD-EFGH-JKLM');
    const { S, K } = await slotWithProgram(t);
    const x = await anon('x');
    await link(x, K, S);
    const victim = await gugl('g', 'victima');

    expect(await ok(x.db, 'transfer_my_seat_to', { p_new_client_id: victim.id })).toBe(1);
    expect((await slotOf(S)).client_id).toBe(victim.id);
    const { data } = await victim.db.from('trainer_clients').select('id');
    expect(data).toEqual([{ id: S }]);                           // la víctima ya «es» cliente de t
  });

  it('H11 hoy (oráculo): las respuestas dicen si un uuid existe, es anónimo o está sentado', async () => {
    const t = await account('t', 'ABCD-EFGH-JKLM');
    const { S, K } = await slotWithProgram(t);
    const seated = await gugl('g1', 'sentado');
    await link(seated, K, S);
    const free = await gugl('g2', 'libre');
    const someAnon = await anon('a');
    const probe = await anon('probe');                           // sin asiento: no cede nada

    const ask = (id) => probe.db.rpc('transfer_my_seat_to', { p_new_client_id: id });
    expect((await ask('00000000-0000-4000-8000-000000000000')).error.message).toBe('BAD_TARGET');   // no existe
    expect((await ask(someAnon.id)).error.message).toBe('BAD_TARGET');                               // anónimo
    expect((await ask(seated.id)).error.message).toBe('SEAT_TAKEN');                                 // sentado
    expect(await ask(free.id)).toEqual({ data: 0, error: null });                                    // cuenta libre
  });
});

describe('H14 — subida en vuelo durante un cambio de entrenador', () => {
  it('H14 hoy (SQL): la subida que llega después de entrar con el código de B cae en el hueco de B', async () => {
    const a = await account('a', 'ABCD-EFGH-JKLM');
    const b = await account('b', 'BCDE-FGHJ-KLMN');
    const A = await slotWithProgram(a);
    const B = await slotWithProgram(b);
    const x = await anon('x');
    await link(x, A.K, A.S);
    await link(x, B.K, B.S);

    expect(await upload(x, ['de-A'])).toBe(B.S);
    expect(historyIds(await slotOf(B.S))).toEqual(['de-A']);
    expect((await slotOf(A.S)).history_json).toBeNull();
  });
});

describe('H15 — borrar un usuario cliente fuera de delete-account', () => {
  it('H15 hoy: la FK suelta el asiento pero deja disconnected_at null: el entrenador lo ve invitado (regla R-B6: «se fue»)', async () => {
    const t = await account('t', 'ABCD-EFGH-JKLM');
    const { S, K } = await slotWithProgram(t);
    const c = await anon('c');
    await link(c, K, S);
    expect((await slotOf(S)).client_id).toBe(c.id);

    await server.deleteUser(c.id);
    expect(await slotOf(S)).toMatchObject({ client_id: null, disconnected_at: null });
  });
});

describe('H16 — profiles sin FK a auth.users', () => {
  it('H16 hoy: borrar el usuario deja su fila de profiles huérfana, y audit.sql no lo ve', async () => {
    const u = await server.createUser({ email: 'u@test' });
    await server.admin(`insert into public.profiles (id, role) values ($1, 'trainer')`, [u.id]);
    await server.deleteUser(u.id);
    expect(await server.admin('select id from auth.users where id = $1', [u.id])).toEqual([]);

    expect(await server.admin('select id, role from public.profiles where id = $1', [u.id])).toEqual([{ id: u.id, role: 'trainer' }]);
    expect(await audit()).toEqual([]);
  });
});

// ═════════════════════════════════════════════════════════════════════════════

describe('Descartados: quedan fijados', () => {
  it('T-A1 regla R-A1: sin sesión todo da 42501; un anónimo ajeno y otro entrenador ven []; el cliente sentado ve solo su fila', async () => {
    const t = await account('t', 'ABCD-EFGH-JKLM');
    const { S, K } = await slotWithProgram(t);
    await slotWithProgram(t, 'Otro');
    const c = await anon('c');
    await link(c, K, S);

    const nobody = noSession();
    expect((await nobody.from('trainer_clients').select('*')).error?.code).toBe('42501');
    for (const [name, args] of [
      ['get_slot_by_code', { p_code: K }], ['link_client_to_slot', { p_code: K }],
      ['client_lost_reason', {}], ['release_client_slot', {}],
      ['trainer_create_slot', { p_client_name: 'x' }], ['trainer_delete_slot', { p_slot_id: S }],
    ]) {
      expect((await bad(nobody, name, args)).code, name).toBe('42501');
    }

    const z = await anon('z');
    expect((await z.db.from('trainer_clients').select('*')).data).toEqual([]);
    const other = await account('b', 'BCDE-FGHJ-KLMN');
    expect((await other.db.from('trainer_clients').select('*')).data).toEqual([]);
    const mine = (await c.db.from('trainer_clients').select('id')).data;
    expect(mine).toEqual([{ id: S }]);
    expect((await t.db.from('trainer_clients').select('id')).data).toHaveLength(2);
  });

  it('T-A2 regla R-A2: insert/upsert/update/delete directos dan 42501 para todos y la tabla no cambia', async () => {
    const t = await account('t', 'ABCD-EFGH-JKLM');
    const { S, K } = await slotWithProgram(t);
    const c = await anon('c');
    await link(c, K, S);
    const z = await anon('z');
    const before = await server.slots();

    for (const [who, db] of [['entrenador', t.db], ['cliente', c.db], ['anónimo', z.db], ['sin sesión', noSession()]]) {
      const writes = [
        db.from('trainer_clients').insert({ trainer_id: t.id, client_name: 'x', client_code: 'ZZZZ-ZZZZ' }),
        db.from('trainer_clients').upsert({ id: S, trainer_id: z.id, client_code: K }),
        db.from('trainer_clients').update({ trainer_name: 'x' }).eq('id', S),
        db.from('trainer_clients').delete().eq('id', S),
      ];
      for (const w of writes) expect((await w).error?.code, who).toBe('42501');
    }
    expect(await server.slots()).toEqual(before);
  });

  it('T-A3 regla R-A3: con el hueco de otro entrenador (o null, dos veces) todo da SLOT_GONE/false; el código se encuentra en minúsculas y con espacios', async () => {
    const t = await account('t', 'ABCD-EFGH-JKLM');
    const { S, K } = await slotWithProgram(t);
    const b = await account('b', 'BCDE-FGHJ-KLMN');
    const before = await server.slots();

    for (const id of [S, null]) {
      for (let i = 0; i < 2; i++) {
        expect((await bad(b.db, 'trainer_upload_program', { p_slot_id: id, p_program: { x: 1 }, p_trainer_name: 'b' })).message).toBe('SLOT_GONE');
        expect((await bad(b.db, 'trainer_upload_overrides', { p_slot_id: id, p_overrides: { x: 1 } })).message).toBe('SLOT_GONE');
        expect((await bad(b.db, 'trainer_upload_log', { p_slot_id: id, p_history: { entries: [] }, p_sessions: 0 })).message).toBe('SLOT_GONE');
        expect((await bad(b.db, 'trainer_reissue_client_code', { p_slot_id: id })).message).toBe('SLOT_GONE');
        expect(await ok(b.db, 'trainer_delete_slot', { p_slot_id: id })).toBe(false);
      }
    }
    expect(await server.slots()).toEqual(before);

    const messy = `  ${K.toLowerCase()} `;
    const c = await anon('c');
    expect((await ok(c.db, 'get_slot_by_code', { p_code: messy }))[0].id).toBe(S);
    expect(await ok(c.db, 'link_client_to_slot', { p_code: messy })).toBe(S);
  });

  it('T-A4 regla R-A4: un anónimo no actúa como entrenador; no se cede a un anónimo', async () => {
    const t = await account('t', 'ABCD-EFGH-JKLM');
    const { S, K } = await slotWithProgram(t);
    const x = await anon('x');
    await link(x, K, S);
    const before = await server.slots();

    expect((await bad(x.db, 'trainer_create_slot', { p_client_name: 'x' })).message).toBe('NOT_A_TRAINER');
    expect((await bad(x.db, 'transfer_my_slots_to', { p_new_trainer_id: t.id })).message).toBe('NOT_A_TRAINER');
    expect((await bad(x.db, 'trainer_upload_program', { p_slot_id: S, p_program: { x: 1 }, p_trainer_name: 'x' })).message).toBe('NOT_A_TRAINER');
    expect((await bad(x.db, 'trainer_reissue_client_code', { p_slot_id: S })).message).toBe('NOT_A_TRAINER');
    expect((await bad(t.db, 'transfer_my_slots_to', { p_new_trainer_id: x.id })).message).toBe('BAD_TARGET');
    expect(await server.slots()).toEqual(before);
  });

  it('T-A7 regla R-A7: un anónimo escribe role «trainer» en su profiles y sigue sin ser entrenador; el de otro no lo escribe', async () => {
    const x = await anon('x');
    expect((await x.db.from('profiles').insert({ id: x.id, role: 'trainer' })).error).toBeNull();
    expect(await server.admin('select role from public.profiles where id = $1', [x.id])).toEqual([{ role: 'trainer' }]);

    expect((await bad(x.db, 'trainer_create_slot', { p_client_name: 'x' })).message).toBe('NOT_A_TRAINER');
    const t = await account('t', 'ABCD-EFGH-JKLM');
    expect((await x.db.from('profiles').insert({ id: t.id, role: 'trainer' })).error?.code).toBe('42501');
  });

  it('T-A8 regla R-A8: delete-account con {userId: víctima} borra al que llama, no a la víctima (copia del banco)', async () => {
    const v = await account('v', 'ABCD-EFGH-JKLM');
    const atk = await account('atk', 'WXYZ-WXYZ-WXYZ');
    const { data, error } = await atk.db.functions.invoke('delete-account', { body: { userId: v.id } });
    expect(error).toBeNull();
    expect(data).toEqual({ ok: true });
    const ids = (await server.admin('select id from auth.users')).map((r) => r.id);
    expect(ids).toContain(v.id);
    expect(ids).not.toContain(atk.id);
  });

  it('T-B1 regla R-B1: pasar el asiento a un Google ya sentado da SEAT_TAKEN y nadie queda con dos', async () => {
    const t = await account('t', 'ABCD-EFGH-JKLM');
    const one = await slotWithProgram(t, 'Uno');
    const two = await slotWithProgram(t, 'Dos');
    const g = await gugl('g', 'sentado');
    await link(g, one.K, one.S);
    const x = await anon('x');
    await link(x, two.K, two.S);

    expect((await bad(x.db, 'transfer_my_seat_to', { p_new_client_id: g.id })).message).toBe('SEAT_TAKEN');
    expect((await slotOf(one.S)).client_id).toBe(g.id);
    expect((await slotOf(two.S)).client_id).toBe(x.id);
    const dup = await server.admin('select client_id from public.trainer_clients where client_id is not null group by client_id having count(*) > 1');
    expect(dup).toEqual([]);
  });

  it('T-C5 regla R-C5: un programa nuevo del entrenador no pisa el historial subido', async () => {
    const t = await account('t', 'ABCD-EFGH-JKLM');
    const { S, K } = await slotWithProgram(t);
    const c = await anon('c');
    await link(c, K, S);
    await upload(c, ['s1']);
    await ok(t.db, 'trainer_upload_program', { p_slot_id: S, p_program: { program: { name: 'Fuerza 2' } }, p_trainer_name: 'E' });
    const row = await slotOf(S);
    expect(row.program_json).toEqual({ program: { name: 'Fuerza 2' } });
    expect(historyIds(row)).toEqual(['s1']);
    expect(row.sessions_count).toBe(1);
  });

  it('T-C6 regla R-C6: con el cliente dentro, trainer_upload_log da SLOT_OCCUPIED y no toca el historial', async () => {
    const t = await account('t', 'ABCD-EFGH-JKLM');
    const { S, K } = await slotWithProgram(t);
    expect(await ok(t.db, 'trainer_upload_log', { p_slot_id: S, p_history: { entries: [{ id: 'antes' }] }, p_sessions: 1 })).toBeNull();
    const c = await anon('c');
    await link(c, K, S);
    await upload(c, ['s1']);

    expect((await bad(t.db, 'trainer_upload_log', { p_slot_id: S, p_history: { entries: [{ id: 'pisado' }] }, p_sessions: 1 })).message).toBe('SLOT_OCCUPIED');
    expect(historyIds(await slotOf(S))).toEqual(['s1']);
  });
});
