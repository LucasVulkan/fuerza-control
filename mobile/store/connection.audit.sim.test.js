/**
 * I02-02 — Los hallazgos de la auditoría que solo se ven con el store REAL de
 * la app encima del servidor (ver `connection.sim.test.js` para el banco y
 * `server.hostile.sim.test.js` para lo que se prueba en crudo).
 *
 * «Hx hoy: …» afirma el comportamiento ACTUAL, el que viola la regla citada:
 * verde = el fallo existe tal cual. Al arreglarlo, se invierte la aserción.
 * Cada montaje se comprueba antes de la aserción final.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createServer, createDevice, wipeDevice, createSimClient } from '../../test/supabaseSim.js';

let server;
beforeEach(async () => { server = await createServer(); });

// ─── Lo mismo que connection.sim.test.js (los vi.mock no se comparten) ────────

function simConfig(device) {
  return {
    trainerSupabase:    createSimClient(device, { storageKey: 'sb-trainer' }),
    clientSupabase:     createSimClient(device, { storageKey: 'sb-client' }),
    createTempSupabase: () => createSimClient(device, { persistSession: false }),
    migrateLegacySession: async () => {},
    sessionsReady:        async () => {},
  };
}

async function phone(name, { device, wipe = false } = {}) {
  const dev = device ?? createDevice(server, name);
  if (wipe) wipeDevice(dev);
  vi.resetModules();
  vi.doMock('../src/config/supabase', () => simConfig(dev));
  const { useStore } = await import('./useStore.js');
  useStore.setState((s) => ({ profile: { ...s.profile, isPro: true }, _hasHydrated: true }));
  return { name, device: dev, store: useStore, get s() { return useStore.getState(); } };
}

const reinstall = (p) => phone(p.name, { device: p.device, wipe: true });
const google = (sub) => ({ provider: 'google', idToken: `google:${sub}` });

async function newClientWithProgram(t, name = 'Ana', programName = 'Fuerza') {
  const clientId = await t.s.createClient(name, { withApp: true });
  const programId = t.s.createProgramForClient(clientId, 2, programName, null, { openEditor: false });
  await t.s.uploadProgramToClient(clientId, programId);
  return { clientId, programId };
}

const codeOf = (t, clientId) => t.s.clients[clientId].syncCode;
const slotIdOf = (t, clientId) => t.s.clients[clientId].syncSlotId;

async function join(c, code) {
  await c.s.validateClientCode(code);
  await c.s.linkToTrainer(code);
}

async function trainOnce(c, id = `e${Math.random()}`) {
  const programId = c.s.clientSync.trainerProgramIds[0];
  const sessionTemplateId = c.s.programs[programId].stages[0].days[0].sessionTemplateId;
  c.store.setState((s) => ({
    workoutLog: [...s.workoutLog, { id, programId, sessionTemplateId, timestamp: Date.now(), date: new Date().toISOString().slice(0, 10), exercises: [] }],
  }));
  await c.s.uploadHistoryToTrainer();
}

const slotOf = async (slotId) => (await server.slots()).find((r) => r.id === slotId);
const historyIds = (row) => row?.history_json?.entries?.map((e) => e.id) ?? null;
const trainerSees = async (t, clientId) => {
  await t.s.downloadClientHistory(clientId);
  return (t.s.clientLogs[clientId] ?? []).map((e) => e.id).sort();
};

/** Un entrenador con un cliente con app y el cliente dentro. */
async function trainerAndClient() {
  const t = await phone('entrenador');
  const c = await phone('cliente');
  await t.s.createTrainerCodeAccount();
  const { clientId } = await newClientWithProgram(t);
  await join(c, codeOf(t, clientId));
  expect((await slotOf(slotIdOf(t, clientId))).client_id).toBe(c.s.clientSync.supabaseUserId);
  return { t, c, clientId };
}

// ═════════════════════════════════════════════════════════════════════════════

describe('H5 — el motivo de perder el asiento, en la app', () => {
  it('H5a arreglado (E34): echado de A, entra en B, B lo borra → la app dice «gone» (R-B3)', async () => {
    const a = await phone('entrenador A');
    const b = await phone('entrenador B');
    const c = await phone('cliente');
    const otro = await phone('otro');
    await a.s.createTrainerCodeAccount();
    await b.s.enterTrainerAccount(google('b'));
    const ca = await newClientWithProgram(a);
    const cb = await newClientWithProgram(b);
    await join(c, codeOf(a, ca.clientId));
    await join(otro, codeOf(a, ca.clientId));
    await join(c, codeOf(b, cb.clientId));
    expect((await slotOf(slotIdOf(b, cb.clientId))).client_id).toBe(c.s.clientSync.supabaseUserId);

    await b.s.deleteClient(cb.clientId);
    expect(await slotOf(slotIdOf(a, ca.clientId))).toBeTruthy();
    await c.s.checkAndPullProgramUpdates();
    expect(c.s.clientSync.lostAt).toBeTruthy();
    expect(c.s.clientSync.lostReason).toBe('gone');
  });

  it('H5b arreglado (E34): c echado por y, y echado por z → la app de c dice «taken» (R-B3)', async () => {
    const { t, c, clientId } = await trainerAndClient();
    const y = await phone('y');
    const z = await phone('z');
    await join(y, codeOf(t, clientId));
    await join(z, codeOf(t, clientId));
    expect((await slotOf(slotIdOf(t, clientId))).client_id).toBe(z.s.clientSync.supabaseUserId);

    await c.s.checkAndPullProgramUpdates();
    expect(c.s.clientSync.lostAt).toBeTruthy();
    expect(c.s.clientSync.lostReason).toBe('taken');
  });
});

describe('H6 — desconectarse / borrar la cuenta pierde lo no descargado', () => {
  it('H6 regla R-B6 (E27): el cliente entrena s1 y se desconecta; el entrenador descarga y recibe s1', async () => {
    const { t, c, clientId } = await trainerAndClient();
    await trainOnce(c, 's1');
    expect(historyIds(await slotOf(slotIdOf(t, clientId)))).toEqual(['s1']);

    await c.s.unlinkFromTrainer();
    expect((await slotOf(slotIdOf(t, clientId))).client_id).toBeNull();
    expect(await trainerSees(t, clientId)).toEqual(['s1']);
  });

  it('H6 regla R-C4 (decidido 23-oct): el cliente entrena s1 y borra su cuenta; el entrenador no recibe nada', async () => {
    const { t, c, clientId } = await trainerAndClient();
    await trainOnce(c, 's1');
    expect(historyIds(await slotOf(slotIdOf(t, clientId)))).toEqual(['s1']);

    expect(await c.s.deleteAccount()).toEqual({ ok: true });
    expect(await trainerSees(t, clientId)).toEqual([]);
  });
});

describe('H7 — vincular Google sin asiento se da por hecho', () => {
  it('H7 regla R-C1 (E29/E32): echado por otro, «Vincular Google» falla con NO_SEAT, sigue anónimo y luego dice «taken»', async () => {
    const { t, c, clientId } = await trainerAndClient();
    const intruso = await phone('intruso');
    await join(intruso, codeOf(t, clientId));
    const slotId = slotIdOf(t, clientId);
    expect((await slotOf(slotId)).client_id).toBe(intruso.s.clientSync.supabaseUserId);

    const anonId = c.s.clientSync.supabaseUserId;
    await expect(c.s.linkGoogleForClient(google('cli'))).rejects.toMatchObject({ code: 'NO_SEAT' });
    expect(c.s.clientSync.googleLinked).toBeFalsy();
    expect(c.s.clientSync.supabaseUserId).toBe(anonId);
    expect((await slotOf(slotId)).client_id).toBe(intruso.s.clientSync.supabaseUserId);

    await c.s.checkAndPullProgramUpdates();
    expect(c.s.clientSync).toMatchObject({ lostAt: expect.any(String), lostReason: 'taken' });
  });
});

describe('H8 — la subida reemplaza: se pisan sesiones no descargadas', () => {
  it('H8a regla R-C2 (E28): dos móviles con el mismo Google entrenan a1 y b1; el entrenador recibe las dos', async () => {
    const { t, c: c1, clientId } = await trainerAndClient();
    await c1.s.linkGoogleForClient(google('cli'));
    const c2 = await phone('cliente 2');
    const found = await c2.s.validateGoogleClient(google('cli'));
    expect(found.found).toBe(true);
    await c2.s.confirmGoogleReconnect({ googleUserId: found.userId, provider: 'google', mergeHistory: true });
    expect(c2.s.clientSync.supabaseUserId).toBe(c1.s.clientSync.supabaseUserId);

    await trainOnce(c1, 'a1');
    expect(historyIds(await slotOf(slotIdOf(t, clientId)))).toEqual(['a1']);   // a1 llegó
    await trainOnce(c2, 'b1');
    expect(await trainerSees(t, clientId)).toEqual(['a1', 'b1']);
  });

  it('H8b regla R-C2 (E28): entrena s1, reinstala, entra sin fusionar y entrena s2; el entrenador recibe s1 y s2', async () => {
    let { t, c, clientId } = await trainerAndClient();
    await trainOnce(c, 's1');
    expect(historyIds(await slotOf(slotIdOf(t, clientId)))).toEqual(['s1']);

    c = await reinstall(c);
    await c.s.linkToTrainer(codeOf(t, clientId), { mergeHistory: false });
    await trainOnce(c, 's2');
    expect(await trainerSees(t, clientId)).toEqual(['s1', 's2']);
  });
});

describe('H9 — reintentar «Vincular Google» tras un corte', () => {
  it('H9 regla R-C7 (E29/E32): el corte llega tras pasar el asiento; el reintento lo resuelve', async () => {
    const { t, c, clientId } = await trainerAndClient();
    const anonId = c.s.clientSync.supabaseUserId;

    server.failOnce('auth:setSession');
    await expect(c.s.linkGoogleForClient(google('cli'))).rejects.toThrow();
    const seatedNow = (await slotOf(slotIdOf(t, clientId))).client_id;
    expect(seatedNow).not.toBe(anonId);                           // el asiento ya es del Google
    expect(c.s.clientSync.googleLinked).toBeFalsy();

    await c.s.linkGoogleForClient(google('cli'));
    expect(c.s.clientSync.googleLinked).toBe(true);
    expect(c.s.clientSync.supabaseUserId).not.toBe(anonId);
    expect((await slotOf(slotIdOf(t, clientId))).client_id).toBe(c.s.clientSync.supabaseUserId);
  });
});

describe('H10 — huecos regalados a otro entrenador', () => {
  it('H10 regla E29: el atacante ofrece «SPAM» al id que lee un cliente de la víctima, y la víctima no lo ve como cliente suyo', async () => {
    const { t, c } = await trainerAndClient();
    const raw = createSimClient(c.device, { storageKey: 'sb-client' });
    const { data: seen } = await raw.from('trainer_clients').select('trainer_id');
    expect(seen).toEqual([{ trainer_id: t.s.trainerSync.userId }]);

    const atk = createSimClient(createDevice(server, 'atacante'));
    const code = 'WXYZ-WXYZ-WXYZ';
    expect((await atk.functions.invoke('create-trainer-account', { body: { code } })).data?.userId).toBeTruthy();
    expect((await atk.auth.signInWithPassword({ email: 'trainer-wxyzwxyzwxyz@noreply.fuerzacontrol.com', password: code })).error).toBeNull();
    const { data: [row] } = await atk.rpc('trainer_create_slot', { p_client_name: 'SPAM' });
    expect(row.slot_id).toBeTruthy();
    expect(await atk.rpc('offer_transfer', { p_kind: 'slots', p_to: seen[0].trainer_id })).toEqual({ data: null, error: null });

    await t.s.refreshTrainerSlots();
    expect(Object.values(t.s.clients).map((x) => x.name)).toEqual(['Ana']);
  });
});

describe('H12 — borrar la cuenta con el mismo Google en los dos papeles', () => {
  it('H12 arreglado (E33, R-D4): deleteAccount termina con {ok:true} y deja el móvil sin cuenta', async () => {
    const x = await phone('mixto');
    const coach = await phone('su entrenador');
    await x.s.enterTrainerAccount(google('x'));
    await coach.s.createTrainerCodeAccount();
    const me = await newClientWithProgram(coach, 'X');
    await join(x, codeOf(coach, me.clientId));
    await x.s.linkGoogleForClient(google('x'));
    expect(x.s.clientSync.supabaseUserId).toBe(x.s.trainerSync.userId);   // mismo uid en los dos papeles

    const uid = x.s.trainerSync.userId;
    const slotId = slotIdOf(coach, me.clientId);
    expect(await x.s.deleteAccount()).toEqual({ ok: true });
    expect(await server.admin('select id from auth.users where id = $1', [uid])).toEqual([]);
    expect((await slotOf(slotId)).client_id).toBeNull();
    expect(x.s.trainerSync.mode).toBe('offline');
    expect(x.s.clientSync.slotId).toBeFalsy();
  });
});

describe('H13 — crear hueco no es idempotente', () => {
  it('H13 hoy: la primera creación llega pero su respuesta se pierde; el reintento crea otra y al refrescar hay dos «Ana»', async () => {
    const t = await phone('entrenador');
    await t.s.createTrainerCodeAccount();
    const raw = createSimClient(t.device, { storageKey: 'sb-trainer' });
    const lost = await raw.rpc('trainer_create_slot', { p_client_name: 'Ana' });   // la respuesta que no llegó
    expect(lost.error).toBeNull();

    const id = await t.s.createClient('Ana', { withApp: true });
    expect(t.s.clients[id].syncSlotId).toBeTruthy();
    await t.s.refreshTrainerSlots();
    expect(Object.values(t.s.clients).filter((x) => x.name === 'Ana')).toHaveLength(2);
    expect((await server.slots()).filter((r) => r.trainer_id === t.s.trainerSync.userId)).toHaveLength(2);
  });
});
