/**
 * C10-02 — El servidor de «los clientes son de la cuenta»: hueco sin código,
 * ficha privada del entrenador e ids que no se pierden. En crudo (`rpc` y `from`
 * con la sesión de cada uno), contra el `schema.sql` real en un Postgres de verdad.
 *
 * La compatibilidad con la app de hoy (esquema de antes + el nuevo encima) está
 * en `server.compat.sim.test.js`.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createServer, createDevice, createSimClient } from '../../test/supabaseSim.js';

const SCHEMA_SQL = readFileSync(fileURLToPath(new URL('../../supabase/schema.sql', import.meta.url)), 'utf8');
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

async function ok(db, name, args = {}) {
  const { data, error } = await db.rpc(name, args);
  expect(error, `${name}: ${error?.message}`).toBeNull();
  return data;
}

async function bad(db, name, args = {}) {
  const { data, error } = await db.rpc(name, args);
  expect(error, `${name} debía fallar y devolvió ${JSON.stringify(data)}`).toBeTruthy();
  return error.message;
}

/** Un hueco; devuelve { S, K }. `withCode: false` = sin app. */
async function slot(who, name = 'Ana', localId = null, withCode = true) {
  const args = { p_client_name: name, p_local_id: localId };
  if (!withCode) args.p_with_code = false;
  const [row] = await ok(who.db, 'trainer_create_slot', args);
  return { S: row.slot_id, K: row.code };
}

const save = (who, S, card = { name: 'Ana' }, programs = { programs: {} }) =>
  ok(who.db, 'trainer_save_client', { p_slot_id: S, p_card: card, p_programs: programs });

const slotOf = async (id) => (await server.slots()).find((r) => r.id === id);
const privates = () => server.admin('select * from public.trainer_client_private order by saved_at');
const audit = () => server.admin(AUDIT);
const reloadSchema = () => server.db.exec(SCHEMA_SQL);

// ═════════════════════════════════════════════════════════════════════════════

describe('la ficha privada (N-17, R-A1, R-A2)', () => {
  it('la lee su entrenador; el cliente sentado en el hueco, otro entrenador y un anónimo no', async () => {
    const t = await account('t', 'ABCD-EFGH-JKLM');
    const b = await account('b', 'BCDE-FGHJ-KLMN');
    const { S, K } = await slot(t);
    const c = await anon('c');
    await ok(c.db, 'link_client_to_slot', { p_code: K });
    expect((await slotOf(S)).client_id).toBe(c.id);
    await save(t, S, { name: 'Ana', notes: 'rodilla' });

    const mine = await t.db.from('trainer_client_private').select('*');
    expect(mine.data).toHaveLength(1);
    expect(mine.data[0].card_json.notes).toBe('rodilla');

    // El cliente ve SU fila del hueco (eso no cambia) pero no la privada.
    expect((await c.db.from('trainer_clients').select('id').eq('client_id', c.id)).data).toHaveLength(1);
    const asClient = await c.db.from('trainer_client_private').select('*');
    expect(asClient.error).toBeNull();
    expect(asClient.data).toEqual([]);
    expect((await c.db.from('trainer_client_private').select('*').eq('slot_id', S)).data).toEqual([]);

    const other = await b.db.from('trainer_client_private').select('*');
    expect(other.error).toBeNull();
    expect(other.data).toEqual([]);

    const nobody = await noSession().from('trainer_client_private').select('*');
    expect(nobody.error).toBeTruthy();
    expect(nobody.data).toBeNull();
  });

  it('nadie la escribe directamente (insert, update ni delete), ni anon ni authenticated', async () => {
    const t = await account('t', 'ABCD-EFGH-JKLM');
    const { S } = await slot(t);
    await save(t, S, { name: 'Ana' });
    const before = await privates();
    expect(before).toHaveLength(1);

    const { S: S2 } = await slot(t, 'Beto');
    const c = await anon('c');
    for (const who of [t, c, { db: noSession() }]) {
      const ins = await who.db.from('trainer_client_private').insert({ slot_id: S2, card_json: { name: 'x' } });
      const upd = await who.db.from('trainer_client_private').update({ card_json: { name: 'x' } }).eq('slot_id', S);
      const del = await who.db.from('trainer_client_private').delete().eq('slot_id', S);
      expect(ins.error, 'insert').toBeTruthy();
      expect(upd.error, 'update').toBeTruthy();
      expect(del.error, 'delete').toBeTruthy();
    }
    expect(await privates()).toEqual(before);
  });

  it('el entrenador lee las de una lista de huecos (select … in), y solo las que tienen ficha', async () => {
    const t = await account('t', 'ABCD-EFGH-JKLM');
    const a = await slot(t, 'Ana');
    const b = await slot(t, 'Beto');
    const sinFicha = await slot(t, 'Cris');
    await save(t, a.S, { name: 'Ana' });
    await save(t, b.S, { name: 'Beto' });
    const { data, error } = await t.db.from('trainer_client_private')
      .select('slot_id, card_json, programs_json, saved_at').in('slot_id', [a.S, sinFicha.S]);
    expect(error).toBeNull();
    expect(data.map((r) => r.slot_id)).toEqual([a.S]);
    expect(Object.keys(data[0]).sort()).toEqual(['card_json', 'programs_json', 'saved_at', 'slot_id']);
  });
});

describe('hueco sin código', () => {
  it('trainer_create_slot: con dos argumentos (la app de hoy) nace con código; con false, sin él; mismo local_id, mismo hueco (E35)', async () => {
    const t = await account('t', 'ABCD-EFGH-JKLM');
    expect((await server.admin(`select count(*)::int as n from pg_proc where proname = 'trainer_create_slot'`))[0].n).toBe(1);

    const hoy = await slot(t, 'Ana', 'client_1');
    expect(hoy.K).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    const sinApp = await slot(t, 'Beto', 'client_2', false);
    expect(sinApp.K).toBeNull();
    expect((await slotOf(sinApp.S)).client_code).toBeNull();

    expect((await slot(t, 'Ana', 'client_1')).S).toBe(hoy.S);
    const again = await slot(t, 'Beto', 'client_2', false);
    expect(again).toEqual(sinApp);
    // solo con el nombre, como la versión más vieja
    const [solo] = await ok(t.db, 'trainer_create_slot', { p_client_name: 'Cris' });
    expect(solo.code).toBeTruthy();
    expect(await server.slots()).toHaveLength(3);
  });

  it('no se canjea con ningún código: CODE_NOT_FOUND, y el hueco sigue vacío', async () => {
    const t = await account('t', 'ABCD-EFGH-JKLM');
    const { S } = await slot(t, 'Beto', 'client_2', false);
    const c = await anon('c');
    for (const code of ['ABCD-EFGH', '', null, 'null', '(null)']) {
      expect(await bad(c.db, 'link_client_to_slot', { p_code: code })).toBe('CODE_NOT_FOUND');
    }
    expect(await ok(c.db, 'get_slot_by_code', { p_code: null })).toEqual([]);
    expect((await slotOf(S)).client_id).toBeNull();
  });

  it('varios huecos sin código a la vez caben (el índice único admite null)', async () => {
    const t = await account('t', 'ABCD-EFGH-JKLM');
    await slot(t, 'A', 'a', false);
    await slot(t, 'B', 'b', false);
    await slot(t, 'C', 'c', false);
    expect((await server.slots()).filter((r) => r.client_code === null)).toHaveLength(3);
  });

  it('el apuntado de un entrenador a un hueco sin app (trainer_upload_log) sigue valiendo', async () => {
    const t = await account('t', 'ABCD-EFGH-JKLM');
    const { S } = await slot(t, 'Beto', 'b', false);
    await ok(t.db, 'trainer_upload_log', { p_slot_id: S, p_history: { entries: [{ id: 'e1' }] }, p_sessions: 1 });
    expect((await slotOf(S)).history_json.entries).toHaveLength(1);
  });
});

describe('trainer_clear_code — cancelar la invitación', () => {
  it('con alguien dentro: SLOT_OCCUPIED y no cambia nada', async () => {
    const t = await account('t', 'ABCD-EFGH-JKLM');
    const { S, K } = await slot(t);
    await ok(t.db, 'trainer_upload_program', { p_slot_id: S, p_program: { program: { name: 'Fuerza' } }, p_trainer_name: 'Ent' });
    await ok(t.db, 'trainer_upload_overrides', { p_slot_id: S, p_overrides: { a: 1 } });
    const c = await anon('c');
    await ok(c.db, 'link_client_to_slot', { p_code: K });
    const before = await slotOf(S);

    expect(await bad(t.db, 'trainer_clear_code', { p_slot_id: S })).toBe('SLOT_OCCUPIED');
    expect(await slotOf(S)).toEqual(before);
    expect(before.client_code).toBe(K);
  });

  it('sin nadie: quita el código y lo enviado; el historial, el nombre y la ficha privada se quedan', async () => {
    const t = await account('t', 'ABCD-EFGH-JKLM');
    const { S, K } = await slot(t, 'Ana', 'client_1');
    await ok(t.db, 'trainer_upload_program', { p_slot_id: S, p_program: { program: { name: 'Fuerza' } }, p_trainer_name: 'Ent' });
    await ok(t.db, 'trainer_upload_overrides', { p_slot_id: S, p_overrides: { a: 1 } });
    await save(t, S, { name: 'Ana' });
    const c = await anon('c');
    await ok(c.db, 'link_client_to_slot', { p_code: K });
    await ok(c.db, 'client_upload_history', { p_history: { entries: [{ id: 's1' }] }, p_sessions: 1, p_slot_id: S });
    await ok(c.db, 'release_client_slot', { p_slot_id: S });          // «se fue»
    const gone = await slotOf(S);
    expect(gone.disconnected_at).toBeTruthy();
    const priv = await privates();

    await ok(t.db, 'trainer_clear_code', { p_slot_id: S });
    const after = await slotOf(S);
    expect(after).toMatchObject({
      client_code: null, disconnected_at: null, client_id: null,
      program_json: null, program_updated_at: null, overrides_json: null, overrides_updated_at: null,
      client_name: 'Ana', local_id: 'client_1',
    });
    expect(after.history_json).toEqual(gone.history_json);
    expect(after.sessions_count).toBe(1);
    expect(await privates()).toEqual(priv);

    // Y el mismo código ya no entra a nadie.
    expect(await bad((await anon('z')).db, 'link_client_to_slot', { p_code: K })).toBe('CODE_NOT_FOUND');
    // Repetirlo no es un error.
    await ok(t.db, 'trainer_clear_code', { p_slot_id: S });
  });

  it('invitar un hueco sin código es reemitirlo: código nuevo y se canjea', async () => {
    const t = await account('t', 'ABCD-EFGH-JKLM');
    const { S } = await slot(t, 'Beto', 'b', false);
    const fresh = await ok(t.db, 'trainer_reissue_client_code', { p_slot_id: S });
    expect(fresh).toBeTruthy();
    const c = await anon('c');
    expect(await ok(c.db, 'link_client_to_slot', { p_code: fresh })).toBe(S);
  });

  it('de otro entrenador o inexistente: SLOT_GONE', async () => {
    const t = await account('t', 'ABCD-EFGH-JKLM');
    const b = await account('b', 'BCDE-FGHJ-KLMN');
    const { S, K } = await slot(t);
    expect(await bad(b.db, 'trainer_clear_code', { p_slot_id: S })).toBe('SLOT_GONE');
    expect(await bad(b.db, 'trainer_clear_code', { p_slot_id: '00000000-0000-0000-0000-000000000000' })).toBe('SLOT_GONE');
    expect((await slotOf(S)).client_code).toBe(K);
    // un anónimo no es entrenador
    expect(await bad((await anon('a')).db, 'trainer_clear_code', { p_slot_id: S })).toBe('NOT_A_TRAINER');
  });
});

describe('trainer_save_client', () => {
  it('inserta, pisa y pone client_name (lo que ve el cliente al confirmar el código)', async () => {
    const t = await account('t', 'ABCD-EFGH-JKLM');
    const { S, K } = await slot(t, 'Ana');
    await save(t, S, { name: 'Ana López', phone: '600' }, { programs: { p1: { name: 'Fuerza' } } });
    let rows = await privates();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ slot_id: S, card_json: { name: 'Ana López', phone: '600' }, programs_json: { programs: { p1: { name: 'Fuerza' } } } });
    expect((await slotOf(S)).client_name).toBe('Ana López');
    const first = rows[0].saved_at;

    await save(t, S, { name: 'Ana L.' }, null);
    rows = await privates();
    expect(rows).toHaveLength(1);
    expect(rows[0].card_json).toEqual({ name: 'Ana L.' });
    expect(rows[0].programs_json).toBeNull();
    expect(new Date(rows[0].saved_at) >= new Date(first)).toBe(true);
    expect((await slotOf(S)).client_name).toBe('Ana L.');

    const z = await anon('z');
    expect((await ok(z.db, 'get_slot_by_code', { p_code: K }))[0].client_name).toBe('Ana L.');
  });

  it('hueco ajeno o inexistente: SLOT_GONE y no escribe nada', async () => {
    const t = await account('t', 'ABCD-EFGH-JKLM');
    const b = await account('b', 'BCDE-FGHJ-KLMN');
    const { S } = await slot(t, 'Ana');
    const args = { p_slot_id: S, p_card: { name: 'Robada' }, p_programs: null };
    expect(await bad(b.db, 'trainer_save_client', args)).toBe('SLOT_GONE');
    expect(await bad(b.db, 'trainer_save_client', { ...args, p_slot_id: '00000000-0000-0000-0000-000000000000' })).toBe('SLOT_GONE');
    expect(await privates()).toEqual([]);
    expect((await slotOf(S)).client_name).toBe('Ana');
    expect(await bad((await anon('a')).db, 'trainer_save_client', args)).toBe('NOT_A_TRAINER');
  });

  it('con el hueco sentado también guarda (el cliente no lo nota más que en el nombre)', async () => {
    const t = await account('t', 'ABCD-EFGH-JKLM');
    const { S, K } = await slot(t, 'Ana');
    const c = await anon('c');
    await ok(c.db, 'link_client_to_slot', { p_code: K });
    await save(t, S, { name: 'Ana', notes: 'privado' });
    expect((await privates())[0].card_json.notes).toBe('privado');
  });

  it('borrar el hueco o la cuenta se lleva la fila privada (cascada)', async () => {
    const t = await account('t', 'ABCD-EFGH-JKLM');
    const a = await slot(t, 'Ana');
    const b = await slot(t, 'Beto');
    await save(t, a.S);
    await save(t, b.S);
    await ok(t.db, 'trainer_delete_slot', { p_slot_id: a.S, p_kind: 'deleted' });
    expect((await privates()).map((r) => r.slot_id)).toEqual([b.S]);
    await server.deleteUser(t.id);
    expect(await privates()).toEqual([]);
  });
});

describe('trainer_set_local_id', () => {
  it('fija el id; repetirlo en el mismo hueco no es un error', async () => {
    const t = await account('t', 'ABCD-EFGH-JKLM');
    const { S } = await slot(t, 'Ana');                     // hueco viejo: sin local_id
    expect((await slotOf(S)).local_id).toBeNull();
    await ok(t.db, 'trainer_set_local_id', { p_slot_id: S, p_local_id: 'client_1' });
    expect((await slotOf(S)).local_id).toBe('client_1');
    await ok(t.db, 'trainer_set_local_id', { p_slot_id: S, p_local_id: 'client_1' });
    await ok(t.db, 'trainer_set_local_id', { p_slot_id: S, p_local_id: 'client_9' });   // corregir uno que no cuadra
    expect((await slotOf(S)).local_id).toBe('client_9');
  });

  it('con el id ya en otro hueco de la cuenta: DUPLICATE_CLIENT y no cambia nada; en otra cuenta sí vale', async () => {
    const t = await account('t', 'ABCD-EFGH-JKLM');
    const b = await account('b', 'BCDE-FGHJ-KLMN');
    const a1 = await slot(t, 'Ana', 'client_1');
    const a2 = await slot(t, 'Ana bis');
    expect(await bad(t.db, 'trainer_set_local_id', { p_slot_id: a2.S, p_local_id: 'client_1' })).toBe('DUPLICATE_CLIENT');
    expect((await slotOf(a2.S)).local_id).toBeNull();
    expect((await slotOf(a1.S)).local_id).toBe('client_1');

    const other = await slot(b, 'Otra');
    await ok(b.db, 'trainer_set_local_id', { p_slot_id: other.S, p_local_id: 'client_1' });
  });

  it('hueco ajeno o inexistente: SLOT_GONE', async () => {
    const t = await account('t', 'ABCD-EFGH-JKLM');
    const b = await account('b', 'BCDE-FGHJ-KLMN');
    const { S } = await slot(t, 'Ana');
    expect(await bad(b.db, 'trainer_set_local_id', { p_slot_id: S, p_local_id: 'x' })).toBe('SLOT_GONE');
    expect(await bad(t.db, 'trainer_set_local_id', { p_slot_id: '00000000-0000-0000-0000-000000000000', p_local_id: 'x' })).toBe('SLOT_GONE');
    expect((await slotOf(S)).local_id).toBeNull();
  });
});

describe('trainer_known_clients y el borrado con local_id', () => {
  const sorted = (rows) => rows.map((r) => `${r.local_id}:${r.alive}`).sort();

  it('vivos y borrados con local_id de la cuenta, nunca de otra ni los que no lo tienen', async () => {
    const t = await account('t', 'ABCD-EFGH-JKLM');
    const b = await account('b', 'BCDE-FGHJ-KLMN');
    await slot(t, 'Viva', 'v1');
    await slot(t, 'Sin app', 'v2', false);
    await slot(t, 'Vieja');                                   // sin local_id: no sale
    const d = await slot(t, 'Borrada', 'd1');
    const cancelada = await slot(t, 'Cancelada', 'd2');
    const vieja = await slot(t, 'Borrada vieja');             // borrada sin local_id: no sale
    await slot(b, 'De otra', 'o1');
    const e = await slot(b, 'De otra borrada', 'o2');

    expect(await ok(t.db, 'trainer_delete_slot', { p_slot_id: d.S, p_kind: 'deleted' })).toBe(true);
    expect(await ok(t.db, 'trainer_delete_slot', { p_slot_id: cancelada.S, p_kind: 'cancelled' })).toBe(true);
    expect(await ok(t.db, 'trainer_delete_slot', { p_slot_id: vieja.S, p_kind: 'deleted' })).toBe(true);
    await ok(b.db, 'trainer_delete_slot', { p_slot_id: e.S, p_kind: 'deleted' });

    expect(sorted(await ok(t.db, 'trainer_known_clients'))).toEqual(['d1:false', 'd2:false', 'v1:true', 'v2:true']);
    expect(sorted(await ok(b.db, 'trainer_known_clients'))).toEqual(['o1:true', 'o2:false']);
    expect((await server.admin('select local_id from public.deleted_slots where slot_id = $1', [d.S]))[0].local_id).toBe('d1');
    expect((await server.admin('select local_id from public.deleted_slots where slot_id = $1', [vieja.S]))[0].local_id).toBeNull();
  });

  it('un anónimo no es entrenador; sin sesión, tampoco', async () => {
    expect(await bad((await anon('a')).db, 'trainer_known_clients')).toBe('NOT_A_TRAINER');
    expect(await bad(noSession(), 'trainer_known_clients')).toBe('permission denied for function trainer_known_clients');
  });

  it('con la cuenta borrada y el JWT aún válido no contesta vacío: NOT_AUTHENTICATED', async () => {
    const t = await account('t', 'ABCD-EFGH-JKLM');
    await slot(t, 'Ana', 'a');
    await server.admin('delete from auth.users where id = $1', [t.id]);
    expect(await bad(t.db, 'trainer_known_clients')).toBe('NOT_AUTHENTICATED');
  });
});

describe('traspaso de cuenta (R-D1)', () => {
  async function transfer(from, to) {
    await ok(from.db, 'offer_transfer', { p_kind: 'slots', p_to: to.id });
    return ok(to.db, 'accept_transfer', { p_kind: 'slots', p_from: from.id });
  }

  it('código → Google: los local_id, la ficha privada y los borrados viajan', async () => {
    const t = await account('t', 'ABCD-EFGH-JKLM');
    const g = await gugl('g', 'sub1');
    const x = await slot(t, 'X', 'client_x');
    const y = await slot(t, 'Y', 'client_y', false);
    const z = await slot(t, 'Z', 'client_z');
    await save(t, x.S, { name: 'X' });
    await ok(t.db, 'trainer_delete_slot', { p_slot_id: z.S, p_kind: 'deleted' });

    expect(await transfer(t, g)).toBe(2);
    const rows = await server.slots();
    expect(rows.map((r) => [r.local_id, r.trainer_id]).sort()).toEqual([['client_x', g.id], ['client_y', g.id]]);
    expect(rows.find((r) => r.id === y.S).client_code).toBeNull();
    expect((await g.db.from('trainer_client_private').select('slot_id')).data).toEqual([{ slot_id: x.S }]);
    expect((await t.db.from('trainer_client_private').select('slot_id')).data).toEqual([]);
    expect((await ok(g.db, 'trainer_known_clients')).map((r) => `${r.local_id}:${r.alive}`).sort())
      .toEqual(['client_x:true', 'client_y:true', 'client_z:false']);
    expect(await ok(t.db, 'trainer_known_clients')).toEqual([]);
    expect(await ok(g.db, 'trainer_deleted_slots', { p_ids: [z.S] })).toEqual([{ slot_id: z.S, kind: 'deleted' }]);
  });

  it('con un local_id repetido en la cuenta destino, el que llega se queda sin él y el resto viaja', async () => {
    const t = await account('t', 'ABCD-EFGH-JKLM');
    const g = await gugl('g', 'sub1');
    const mine = await slot(g, 'Ya estaba', 'client_x');
    const x = await slot(t, 'X de antes', 'client_x');
    const y = await slot(t, 'Y', 'client_y');
    const w = await slot(t, 'W');

    expect(await transfer(t, g)).toBe(3);
    expect((await slotOf(mine.S)).local_id).toBe('client_x');
    expect((await slotOf(x.S)).local_id).toBeNull();
    expect((await slotOf(y.S)).local_id).toBe('client_y');
    expect((await slotOf(w.S)).local_id).toBeNull();
    expect((await server.slots()).every((r) => r.trainer_id === g.id)).toBe(true);
    // la app lo vuelve a fijar (§4.2): a un id libre sí, al repetido no
    await ok(g.db, 'trainer_set_local_id', { p_slot_id: x.S, p_local_id: 'client_x2' });
    expect(await bad(g.db, 'trainer_set_local_id', { p_slot_id: w.S, p_local_id: 'client_x' })).toBe('DUPLICATE_CLIENT');
    expect(await audit()).toEqual([]);
  });
});

describe('desplegar encima (el SQL se ejecuta entero las veces que haga falta)', () => {
  it('volver a ejecutar schema.sql no da código a los huecos sin él ni toca lo privado', async () => {
    const t = await account('t', 'ABCD-EFGH-JKLM');
    const sin = await slot(t, 'Sin app', 'b', false);
    const con = await slot(t, 'Con app', 'a');
    await save(t, sin.S, { name: 'Sin app' });
    await reloadSchema();
    await reloadSchema();
    expect((await slotOf(sin.S)).client_code).toBeNull();
    expect((await slotOf(con.S)).client_code).toBe(con.K);
    expect(await privates()).toHaveLength(1);
    expect(await audit()).toEqual([]);
    // sigue habiendo una sola trainer_create_slot y la política no se duplicó
    expect((await server.admin(`select count(*)::int as n from pg_proc where proname = 'trainer_create_slot'`))[0].n).toBe(1);
    expect((await server.admin(`select count(*)::int as n from pg_policies where tablename = 'trainer_client_private'`))[0].n).toBe(1);
    expect((await t.db.from('trainer_client_private').select('slot_id')).data).toHaveLength(1);
  });
});

describe('audit.sql con lo nuevo', () => {
  async function withData() {
    const t = await account('t', 'ABCD-EFGH-JKLM');
    const sin = await slot(t, 'Sin app', 'b', false);
    const con = await slot(t, 'Con app', 'a');
    await save(t, sin.S);
    const c = await anon('c');
    await ok(c.db, 'link_client_to_slot', { p_code: con.K });
    await ok(t.db, 'trainer_clear_code', { p_slot_id: (await slot(t, 'Cancelada', 'k')).S });
    return { t, sin, con };
  }

  it('montaje: con huecos sin código, ficha privada y borrados, sale vacío', async () => {
    const { t } = await withData();
    const d = await slot(t, 'Borrada', 'd');
    await ok(t.db, 'trainer_delete_slot', { p_slot_id: d.S, p_kind: 'deleted' });
    expect(await audit()).toEqual([]);
  });

  const drifts = [
    ['dos huecos de la cuenta con el mismo local_id (sin el índice)',
      async ({ con }) => {
        await server.admin('drop index public.trainer_clients_local_id');
        await server.admin(`insert into public.trainer_clients (trainer_id, client_code, local_id)
                            select trainer_id, 'ZZZZ-ZZZZ', local_id from public.trainer_clients where id = $1`, [con.S]);
      }, 'huecos de una cuenta con el mismo local_id'],
    ['una ficha privada sin su hueco (sin la clave ajena)',
      async ({ sin }) => {
        await server.admin('alter table public.trainer_client_private drop constraint trainer_client_private_slot_id_fkey');
        await server.admin('delete from public.trainer_clients where id = $1', [sin.S]);
      }, 'ficha privada sin hueco ni entrenador'],
    ['un código repetido',
      async ({ con }) => {
        await server.admin('drop index public.trainer_clients_code_key');
        await server.admin(`insert into public.trainer_clients (trainer_id, client_code)
                            select trainer_id, client_code from public.trainer_clients where id = $1`, [con.S]);
      }, 'código repetido'],
    ['INSERT en trainer_client_private a authenticated',
      () => server.admin('grant insert on public.trainer_client_private to authenticated'), 'permiso de escritura directo'],
    ['UPDATE por columna en trainer_client_private',
      () => server.admin('grant update (card_json) on public.trainer_client_private to authenticated'), 'permiso de escritura por columna'],
    ['SELECT en trainer_client_private a anon',
      () => server.admin('grant select on public.trainer_client_private to anon'), 'permiso de escritura directo'],
    ['RLS desactivada en trainer_client_private',
      () => server.admin('alter table public.trainer_client_private disable row level security'), 'RLS desactivada'],
    ['una política de escritura en trainer_client_private',
      () => server.admin(`create policy p on public.trainer_client_private for update to authenticated using (true)`), 'política de escritura'],
    ['una política de lectura abierta en trainer_client_private',
      () => server.admin(`create policy p on public.trainer_client_private for select to authenticated using (true)`), 'política de lectura abierta'],
    ['sin la tabla trainer_client_private',
      () => server.admin('drop table public.trainer_client_private'), 'falta la tabla'],
    ['trainer_clear_code sin security definer',
      () => server.admin('alter function public.trainer_clear_code(uuid) security invoker'), 'función sin security definer'],
    ['sin trainer_known_clients',
      () => server.admin('drop function public.trainer_known_clients()'), 'falta la función'],
    ['trainer_save_client con otro cuerpo',
      () => server.admin(`create or replace function public.trainer_save_client(p_slot_id uuid, p_card jsonb, p_programs jsonb)
                          returns void language plpgsql security definer set search_path = public as $$ begin null; end; $$`),
      'función distinta de schema.sql'],
    ['la firma vieja de trainer_create_slot sigue viva',
      () => server.admin(`create function public.trainer_create_slot(p_client_name text, p_local_id text) returns table (slot_id uuid, code text)
                          language sql as $$ select null::uuid, null::text $$`), 'función que no es de schema.sql'],
    ['EXECUTE a anon en trainer_set_local_id',
      () => server.admin('grant execute on function public.trainer_set_local_id(uuid, text) to anon'), 'función ejecutable por anon'],
  ];

  for (const [what, provoke, problema] of drifts) {
    it(`«${what}»: sale «${problema}»`, async () => {
      const data = await withData();
      expect(await audit()).toEqual([]);
      await provoke(data);
      expect((await audit()).map((r) => r.problema)).toContain(problema);
    });
  }
});

describe('supabaseSync.js: las llamadas nuevas (sin usar aún desde el store)', () => {
  async function sync() {
    const dev = createDevice(server, 'movil');
    const trainerSupabase = createSimClient(dev, { storageKey: 'sb-trainer' });
    const clientSupabase = createSimClient(dev, { storageKey: 'sb-client' });
    vi.resetModules();
    vi.doMock('../src/config/supabase', () => ({ trainerSupabase, clientSupabase, sessionsReady: async () => {} }));
    const made = await trainerSupabase.functions.invoke('create-trainer-account', { body: { code: 'ABCD-EFGH-JKLM' } });
    expect(made.data?.userId).toBeTruthy();
    await trainerSupabase.auth.signInWithPassword({ email: 'trainer-abcdefghjklm@noreply.fuerzacontrol.com', password: 'ABCD-EFGH-JKLM' });
    return import('../src/services/supabaseSync.js');
  }

  it('createClientSlot: con código por omisión; sin él con el tercer argumento; mismo local_id, mismo hueco', async () => {
    const api = await sync();
    const con = await api.createClientSlot('Ana', 'client_1');
    expect(con.clientCode).toBeTruthy();
    const sin = await api.createClientSlot('Beto', 'client_2', false);
    expect(sin).toEqual({ slotId: expect.any(String), clientCode: null });
    expect(await api.createClientSlot('Beto', 'client_2', false)).toEqual(sin);
    expect((await api.createClientSlot('Ana', 'client_1')).slotId).toBe(con.slotId);
  });

  it('clearClientCode, saveClientPrivate, setSlotLocalId, knownClients y getClientPrivates; los errores salen en err.code', async () => {
    const api = await sync();
    const a = await api.createClientSlot('Ana', 'client_1');
    const b = await api.createClientSlot('Beto');
    await api.saveClientPrivate(a.slotId, { name: 'Ana López' }, { programs: {} });
    expect(await api.getClientPrivates([])).toEqual([]);
    const rows = await api.getClientPrivates([a.slotId, b.slotId]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ slot_id: a.slotId, card_json: { name: 'Ana López' }, programs_json: { programs: {} } });

    await expect(api.setSlotLocalId(b.slotId, 'client_1')).rejects.toMatchObject({ code: 'DUPLICATE_CLIENT' });
    await api.setSlotLocalId(b.slotId, 'client_2');
    await api.clearClientCode(a.slotId);
    expect((await slotOf(a.slotId)).client_code).toBeNull();
    await api.deleteClientSlot(b.slotId);
    expect((await api.knownClients()).map((r) => `${r.local_id}:${r.alive}`).sort()).toEqual(['client_1:true', 'client_2:false']);

    const c = await anon('c');
    const d = await api.createClientSlot('Cris');
    await ok(c.db, 'link_client_to_slot', { p_code: d.clientCode });
    await expect(api.clearClientCode(d.slotId)).rejects.toMatchObject({ code: 'SLOT_OCCUPIED' });
    await api.deleteClientSlot(d.slotId);
    await expect(api.saveClientPrivate(d.slotId, { name: 'x' })).rejects.toMatchObject({ code: 'SLOT_GONE' });
  });
});
