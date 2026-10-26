/**
 * I02-03 · App: conexión y sincronización — hallazgos y reglas que cumple.
 *
 * Mismo banco que `connection.sim.test.js` (store real, SQL real en PGlite).
 * `S#` afirma lo que la app hace HOY y es un fallo respecto a la regla citada:
 * si se arregla, el test se pone rojo y se invierte. `R-xx cumple` fija lo que
 * ya está bien. Reglas: docs/specs/I02-conexion-pagos-pro.md §3.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createServer, createDevice, wipeDevice, createSimClient } from '../../test/supabaseSim.js';

let server;
beforeEach(async () => { server = await createServer(); });

/** `wrap(cfg, device)` deja envolver el Supabase de un móvil (parches de un test concreto). */
function simConfig(device, wrap) {
  const cfg = {
    trainerSupabase:    createSimClient(device, { storageKey: 'sb-trainer' }),
    clientSupabase:     createSimClient(device, { storageKey: 'sb-client' }),
    createTempSupabase: () => createSimClient(device, { persistSession: false }),
    migrateLegacySession: async () => {},
    sessionsReady:        async () => {},
  };
  return wrap ? wrap(cfg, device) : cfg;
}

const plain = (state) => Object.fromEntries(Object.entries(state).filter(([, v]) => typeof v !== 'function'));

async function phone(name, { device, from, wipe = false, state, wrap } = {}) {
  const dev = device ?? createDevice(server, name);
  if (wipe) wipeDevice(dev);
  vi.resetModules();
  vi.doMock('../src/config/supabase', () => simConfig(dev, wrap));
  const { useStore } = await import('./useStore.js');
  useStore.setState((s) => ({ profile: { ...s.profile, isPro: true }, _hasHydrated: true }));
  if (from) useStore.setState(plain(from.store.getState()));
  if (state) useStore.setState(state);
  return { name, device: dev, store: useStore, wrap, get s() { return useStore.getState(); } };
}
const restart = (p, state) => phone(p.name, { device: p.device, from: p, state, wrap: p.wrap });
const reinstall = (p) => phone(p.name, { device: p.device, wipe: true, wrap: p.wrap });
const google = (sub) => ({ provider: 'google', idToken: `google:${sub}` });
const apple  = (sub) => ({ provider: 'apple', idToken: `apple:${sub}` });

async function newClientWithProgram(t, name = 'Ana', programName = 'Fuerza') {
  const clientId = await t.s.createClient(name, { withApp: true });
  const programId = t.s.createProgramForClient(clientId, 2, programName, null, { openEditor: false });
  await t.s.uploadProgramToClient(clientId, programId);
  return { clientId, programId };
}
const codeOf = (t, clientId) => t.s.clients[clientId].syncCode;
async function join(c, code, opts) { await c.s.validateClientCode(code); await c.s.linkToTrainer(code, opts); }
function entry(c, id) {
  const programId = c.s.clientSync.trainerProgramIds[0];
  const sessionTemplateId = c.s.programs[programId].stages[0].days[0].sessionTemplateId;
  return { id, programId, sessionTemplateId, timestamp: Date.now(), date: new Date().toISOString().slice(0, 10), exercises: [] };
}
const logSession = (c, id) => c.store.setState((s) => ({ workoutLog: [...s.workoutLog, entry(c, id)] }));
async function trainOnce(c, id = `e${Math.random()}`) { logSession(c, id); await c.s.uploadHistoryToTrainer(); }
async function programReaches(t, c, clientId, programName) {
  const programId = t.s.createProgramForClient(clientId, 1, programName, null, { openEditor: false });
  await t.s.uploadProgramToClient(clientId, programId);
  await c.s.checkAndPullProgramUpdates();
  return c.s.clientSync.pendingProgramUpdate?.programJson?.program?.name === programName;
}
const slotOf = async (slotId) => (await server.slots()).find((r) => r.id === slotId);
const historyIds = (row) => row?.history_json?.entries?.map((e) => e.id) ?? null;
const trainerSees = async (t, clientId) => {
  await t.s.downloadClientHistory(clientId);
  return (t.s.clientLogs[clientId] ?? []).map((e) => e.id).sort();
};
async function trainerAndClient() {
  const t = await phone('entrenador');
  const c = await phone('cliente');
  await t.s.createTrainerCodeAccount();
  const { clientId, programId } = await newClientWithProgram(t);
  await join(c, codeOf(t, clientId));
  return { t, c, clientId, programId };
}
/** Falla la n-ésima llamada (1 = la próxima) que case con `key`. */
function failNth(key, n) {
  const orig = server._shouldFail.bind(server);
  let seen = 0;
  server._shouldFail = (k, dev) => {
    if (k === key && ++seen === n) { server._shouldFail = orig; return true; }
    return orig(k, dev);
  };
}
/** Retiene la próxima llamada rpc `name` del cliente hasta `dev.release()` (red lenta). */
const gateRpc = (name) => (cfg, dev) => {
  const db = cfg.clientSupabase;
  const real = db.rpc.bind(db);
  db.rpc = async (n, args) => {
    if (n === name && dev.hold) { dev.hold = false; await new Promise((res) => { dev.release = res; }); }
    return real(n, args);
  };
  return cfg;
};

// ═════════════════════════════════════════════════════════════════════════════
// HALLAZGOS
// ═════════════════════════════════════════════════════════════════════════════

describe('S1 de Google a código', () => {
  it('S1 arreglado (E49): con cuenta de Google crear un código rechaza y no mueve los huecos (regla R-D1: solo se cambia hacia una forma mejor)', async () => {
    const t = await phone('entrenador');
    const c = await phone('cliente');
    await t.s.enterTrainerAccount(google('g1'));
    const { clientId } = await newClientWithProgram(t);
    await join(c, codeOf(t, clientId));
    const slotId = t.s.clients[clientId].syncSlotId;
    const userId = t.s.trainerSync.userId;
    await expect(t.s.createTrainerCodeAccount()).rejects.toMatchObject({ code: 'ACCOUNT_EXISTS' });
    expect(t.s.trainerSync.mode).toBe('google');
    expect(t.s.trainerSync.userId).toBe(userId);
    expect((await slotOf(slotId)).trainer_id).toBe(userId);
  });
});

describe('S2 borrar la cuenta muere entre las dos llamadas', () => {
  it.each([['code'], ['google']])(
    'S2 hoy (%s): el usuario entrenador ya se borró en el servidor y pulsar otra vez da «Sesión no válida»; el asiento de su cliente sigue ocupado (regla R-D4: borrar la cuenta borra sus huecos y su usuario, y sus clientes ven que los desconectaron)',
    async (way) => {
      const x = await phone('mixto');
      const coach = await phone('coach');
      if (way === 'code') await x.s.createTrainerCodeAccount(); else await x.s.enterTrainerAccount(google('x'));
      await coach.s.createTrainerCodeAccount();
      const me = await newClientWithProgram(coach, 'X');
      await join(x, codeOf(coach, me.clientId));
      const seat = coach.s.clients[me.clientId].syncSlotId;
      expect((await slotOf(seat)).client_id).not.toBeNull();
      // La primera llamada llegó (borró al entrenador) y la app murió.
      const raw = createSimClient(x.device, { storageKey: 'sb-trainer' });
      expect((await raw.functions.invoke('delete-account')).data).toEqual({ ok: true });
      const x2 = await restart(x);
      const res = await x2.s.deleteAccount().then((r) => r, (e) => ({ err: e.code ?? e.message }));
      expect(res.err).toBeTruthy();
      expect((await slotOf(seat)).client_id).not.toBeNull();
    },
  );
});

describe('S3 el móvil del cliente conserva un slotId que el servidor ya liberó', () => {
  it('S3 hoy: cambiar A → B falla al bajar el asiento (tras ocuparlo); el móvil sigue «con A», el siguiente pull ofrece el programa de B y las sesiones de A se suben a B (regla R-B1/R-C7: un asiento, y un corte se arregla solo)', async () => {
    const a = await phone('A');
    const b = await phone('B');
    const c = await phone('cliente');
    await a.s.createTrainerCodeAccount();
    await b.s.createTrainerCodeAccount();
    const ca = await newClientWithProgram(a, 'Ana', 'De A');
    const cb = await newClientWithProgram(b, 'Ana', 'De B');
    await join(c, codeOf(a, ca.clientId));
    await trainOnce(c, 'de-A');
    failNth('from:trainer_clients', 1);
    await expect(c.s.linkToTrainer(codeOf(b, cb.clientId))).rejects.toBeTruthy();
    expect(c.s.clientSync.slotId).toBe(a.s.clients[ca.clientId].syncSlotId);    // cree seguir en A
    expect((await slotOf(c.s.clientSync.slotId)).client_id).toBeNull();          // pero A ya está libre
    await c.s.checkAndPullProgramUpdates();
    expect(c.s.clientSync.lostAt).toBeFalsy();
    expect(c.s.clientSync.pendingProgramUpdate?.programJson?.program?.name).toBe('De B');
    c.s.applyPendingProgramUpdate();
    await c.s.uploadHistoryToTrainer();
    expect(historyIds(await slotOf(b.s.clients[cb.clientId].syncSlotId))).toContain('de-A');   // fuga a B
  });
  it('S3 hoy: con el mismo Google en dos móviles, uno cambia de entrenador; el otro sigue en el asiento viejo (sin «perdido») y sube sus sesiones al entrenador nuevo (regla R-B1: un cliente, un asiento)', async () => {
    const a = await phone('A');
    const b = await phone('B');
    await a.s.createTrainerCodeAccount();
    await b.s.createTrainerCodeAccount();
    const ca = await newClientWithProgram(a, 'Ana', 'Prog A');
    const cb = await newClientWithProgram(b, 'Ana', 'Prog B');
    const c1 = await phone('movil1');
    await join(c1, codeOf(a, ca.clientId));
    await c1.s.linkGoogleForClient(google('gC'));
    const c2 = await phone('movil2');
    const found = await c2.s.validateGoogleClient(google('gC'));
    await c2.s.confirmGoogleReconnect({ googleUserId: found.userId, provider: 'google', mergeHistory: true });
    await join(c1, codeOf(b, cb.clientId));                       // móvil 1 pasa a B
    await c2.s.checkAndPullProgramUpdates();
    expect(c2.s.clientSync.slotId).toBe(a.s.clients[ca.clientId].syncSlotId);   // móvil 2 sigue «en A»
    await trainOnce(c2, 'a-session');
    expect(historyIds(await slotOf(b.s.clients[cb.clientId].syncSlotId))).toEqual(['a-session']);
  });
});

describe('S4 vincular Google del cliente cortado en setSession', () => {
  it('S4 hoy: la app mira el asiento (arranque/primer plano) antes del reintento y marca «perdido» aunque su Google está sentado; vincular otra vez no lo quita y no sube (regla R-C7: se sale solo al reintentar; R-B3)', async () => {
    const t = await phone('entrenador');
    let c = await phone('cliente');
    await t.s.createTrainerCodeAccount();
    const { clientId } = await newClientWithProgram(t);
    await join(c, codeOf(t, clientId));
    failNth('auth:setSession', 1);
    await expect(c.s.linkGoogleForClient(google('cli'))).rejects.toBeTruthy();
    c = await restart(c);
    await c.s.checkAndPullProgramUpdates();
    expect(c.s.clientSync.lostAt).toBeTruthy();
    // El código ya no le vale (asiento bloqueado por su Google)
    await expect(c.s.linkToTrainer(c.s.clientSync.clientCode)).rejects.toMatchObject({ code: 'SEAT_LOCKED' });
    await c.s.linkGoogleForClient(google('cli'));                 // reintento: la pantalla lo oculta en «perdido»
    expect(c.s.clientSync.googleLinked).toBe(true);
    expect(c.s.clientSync.lostAt).toBeTruthy();
    await trainOnce(c, 's1');
    expect(c.s.clientSync.lastSyncedAt).toBeNull();               // no sube
    // Salida real: entrar con Google desde la hoja
    const found = await c.s.validateGoogleClient(google('cli'));
    await c.s.confirmGoogleReconnect({ googleUserId: found.userId, provider: 'google' });
    expect(c.s.clientSync.lostAt).toBeNull();
  });
});

describe('S5 desconectarse sin red', () => {
  it('S5 hoy: sin red la app se desconecta aquí, el asiento sigue ocupado en el servidor, el entrenador lo ve dentro y nada lo reintenta (regla R-B6: desconectarse deja el hueco libre y el entrenador lo ve libre; R-C1)', async () => {
    const { t, c, clientId } = await trainerAndClient();
    const slotId = c.s.clientSync.slotId;
    c.device.offline = true;
    await c.s.unlinkFromTrainer();
    c.device.offline = false;
    expect(c.s.clientSync.slotId).toBeNull();
    await c.s.checkAndPullProgramUpdates();
    await t.s.refreshTrainerSlots();
    expect((await slotOf(slotId)).client_id).not.toBeNull();
    expect(t.s.clients[clientId].syncLinked).toBe(true);
  });
});

describe('S6 una subida pendiente no se tira al dejar el asiento', () => {
  it('S6 arreglado (E51): desconectarse con una sesión sin subir la sube antes de soltar el asiento (regla R-C4: el entrenador recibe todas las sesiones subidas; R-C1)', async () => {
    const { t, c, clientId } = await trainerAndClient();
    await trainOnce(c, 's1');
    c.device.offline = true;
    await trainOnce(c, 's2');
    expect(c.s.clientSync.pendingUpload).toBe(true);
    c.device.offline = false;
    await expect(c.s.unlinkFromTrainer()).resolves.toEqual({ unsent: 0 });
    expect(c.s.clientSync.slotId).toBeNull();
    expect(historyIds(await slotOf(t.s.clients[clientId].syncSlotId)).sort()).toEqual(['s1', 's2']);
  });
  it('S6 arreglado (E51): si no puede subir, no desconecta y dice cuántos entrenos no llegan; «igualmente» suelta el asiento', async () => {
    const { t, c, clientId } = await trainerAndClient();
    await trainOnce(c, 's1');
    c.device.offline = true;
    await trainOnce(c, 's2');
    c.device.offline = false;
    failNth('rpc:client_upload_history', 1);
    await expect(c.s.unlinkFromTrainer()).resolves.toEqual({ unsent: 1 });
    expect(c.s.clientSync.slotId).not.toBeNull();
    await expect(c.s.unlinkFromTrainer({ force: true })).resolves.toEqual({ unsent: 0 });
    expect(c.s.clientSync.slotId).toBeNull();
    expect(c.s.workoutLog.map((e) => e.id)).toContain('s2');                   // sigue en el log local
    expect(historyIds(await slotOf(t.s.clients[clientId].syncSlotId))).toEqual(['s1']);
  });
  it('S6 arreglado (E51): cambiar de entrenador con una sesión sin subir la sube antes al asiento actual; B no recibe nada de A (regla R-C4)', async () => {
    const a = await phone('A');
    const b = await phone('B');
    const c = await phone('cliente');
    await a.s.createTrainerCodeAccount();
    await b.s.createTrainerCodeAccount();
    const ca = await newClientWithProgram(a);
    const cb = await newClientWithProgram(b);
    await join(c, codeOf(a, ca.clientId));
    c.device.offline = true;
    await trainOnce(c, 'pend');
    c.device.offline = false;
    expect(c.s.clientSync.pendingUpload).toBe(true);
    await join(c, codeOf(b, cb.clientId));
    expect(c.s.clientSync.pendingUpload).toBe(false);
    expect(historyIds(await slotOf(a.s.clients[ca.clientId].syncSlotId))).toEqual(['pend']);
    expect(historyIds(await slotOf(b.s.clients[cb.clientId].syncSlotId))).toBeNull();
  });
  it('S6 arreglado (E51): si la subida a A falla, cambiar a B no se bloquea y lo entrenado sigue en el log local', async () => {
    const a = await phone('A');
    const b = await phone('B');
    const c = await phone('cliente');
    await a.s.createTrainerCodeAccount();
    await b.s.createTrainerCodeAccount();
    const ca = await newClientWithProgram(a);
    const cb = await newClientWithProgram(b);
    await join(c, codeOf(a, ca.clientId));
    c.device.offline = true;
    await trainOnce(c, 'pend');
    c.device.offline = false;
    failNth('rpc:client_upload_history', 1);
    await join(c, codeOf(b, cb.clientId));
    expect(c.s.clientSync.slotId).toBe(b.s.clients[cb.clientId].syncSlotId);
    expect(c.s.workoutLog.map((e) => e.id)).toContain('pend');
    expect(historyIds(await slotOf(b.s.clients[cb.clientId].syncSlotId))).toBeNull();
  });
  it('S6 arreglado (E51): volver a entrar con el código del mismo entrenador sube lo pendiente (regla R-C4)', async () => {
    const { t, c, clientId } = await trainerAndClient();
    c.device.offline = true;
    await trainOnce(c, 's2');
    c.device.offline = false;
    expect(c.s.clientSync.pendingUpload).toBe(true);
    await c.s.linkToTrainer(codeOf(t, clientId));
    expect(c.s.clientSync.pendingUpload).toBe(false);
    expect(historyIds(await slotOf(t.s.clients[clientId].syncSlotId))).toEqual(['s2']);
  });
  it('S6 arreglado (E51): si la subida previa falla, al reentrar en el mismo asiento se sube tras adoptarlo', async () => {
    const { t, c, clientId } = await trainerAndClient();
    c.device.offline = true;
    await trainOnce(c, 's2');
    c.device.offline = false;
    failNth('rpc:client_upload_history', 1);
    await c.s.linkToTrainer(codeOf(t, clientId));
    expect(c.s.clientSync.pendingUpload).toBe(false);
    expect(historyIds(await slotOf(t.s.clients[clientId].syncSlotId))).toEqual(['s2']);
  });
});

describe('S7 la app muere en la espera de 2 s antes de subir', () => {
  it('S7 arreglado (E51): el entreno marca la subida como debida al guardarse; al abrir, el reintento de siempre lo sube (regla R-C2: una sesión entrenada llega al entrenador)', async () => {
    const { t, c, clientId } = await trainerAndClient();
    logSession(c, 'muerta');
    expect(c.s.clientSync.uploadDue).toBe(true);
    expect(c.s.clientSync.pendingUpload).toBe(false);          // el aviso de error no se enciende
    const c2 = await phone('cliente', { device: c.device, state: plain(c.store.getState()) });
    await c2.s.checkAndPullProgramUpdates();
    await vi.waitFor(async () => expect(await trainerSees(t, clientId)).toContain('muerta'));
    expect(c2.s.clientSync.uploadDue).toBe(false);
  });
});

describe('S8-S9 «enviado» sin que el servidor lo confirme (carreras)', () => {
  it('S8 hoy: una prescripción cambiada mientras se envían las anteriores se pierde en local y queda «enviado» (regla R-C1: nada se da por enviado sin confirmar)', async () => {
    const { t, clientId, programId } = await trainerAndClient();
    const tpl = t.s.programs[programId].stages[0].days[0].sessionTemplateId;
    t.s.setOverrideTarget(clientId, tpl, 'ex1', { weight: 50 });
    const sending = t.s.sendOverrides(clientId);
    t.s.setOverrideTarget(clientId, tpl, 'ex2', { weight: 80 });
    expect(t.s.clients[clientId].nextOverrides[tpl].exercises.ex2).toBeDefined();   // montaje: la segunda edición entró
    await sending;
    expect(t.s.clients[clientId].nextOverrides[tpl].exercises.ex2).toBeUndefined();
    expect(t.s.clients[clientId].overridesDirty).toBe(false);
  });
  it('S9 hoy: un cambio del programa hecho mientras viaja la subida queda como enviado sin haberlo enviado (regla R-C1)', async () => {
    const t = await phone('entrenador');
    await t.s.createTrainerCodeAccount();
    const { clientId, programId } = await newClientWithProgram(t);
    t.store.setState((s) => ({ clients: { ...s.clients, [clientId]: { ...s.clients[clientId], activeProgramId: programId } } }));
    // El cambio entra justo cuando la petición sale (carga ya construida).
    const orig = server._shouldFail.bind(server);
    server._shouldFail = (k, dev) => {
      if (k === 'rpc:trainer_upload_program') {
        server._shouldFail = orig;
        t.store.setState((s) => ({ programs: { ...s.programs, [programId]: { ...s.programs[programId], name: 'Cambiado' } } }));
        t.s.markProgramDirtyForClients(programId);
      }
      return orig(k, dev);
    };
    await t.s.uploadProgramToClient(clientId, programId);
    expect(t.s.programs[programId].name).toBe('Cambiado');          // montaje: el cambio local existe
    expect((await slotOf(t.s.clients[clientId].syncSlotId)).program_json.program.name).not.toBe('Cambiado');
    expect(t.s.clients[clientId].programDirty).toBe(false);
  });
});

describe('S10-S13 el historial del hueco y el del móvil se pisan', () => {
  it('S10 hoy: dos móviles con el mismo Google; el 1 edita el RPE de s1 y el 2 sube su copia vieja → el servidor vuelve a la vieja (regla R-C3: mezclar solo añade; R-C2)', async () => {
    const { c: c1 } = await trainerAndClient();
    await c1.s.linkGoogleForClient(google('cli'));
    await trainOnce(c1, 's1');
    const c2 = await phone('cliente 2');
    const found = await c2.s.validateGoogleClient(google('cli'));
    await c2.s.confirmGoogleReconnect({ googleUserId: found.userId, provider: 'google', mergeHistory: true });
    expect(c2.s.workoutLog.map((e) => e.id)).toContain('s1');
    c1.store.setState((s) => ({ workoutLog: s.workoutLog.map((e) => (e.id === 's1' ? { ...e, rpe: 9 } : e)) }));
    await c1.s.uploadHistoryToTrainer();
    const slotId = c1.s.clientSync.slotId;
    expect((await slotOf(slotId)).history_json.entries[0].rpe).toBe(9);
    await trainOnce(c2, 's2');
    expect((await slotOf(slotId)).history_json.entries.find((e) => e.id === 's1').rpe).toBeUndefined();
  });
  it('S11 hoy: dos subidas del mismo móvil llegan en orden inverso; la vieja pisa a la nueva y se pierde el RPE (regla R-C3: conmutativa e idempotente; R-C2)', async () => {
    const { c: c0 } = await trainerAndClient();
    const c = await phone('cliente', { device: c0.device, from: c0, wrap: gateRpc('client_upload_history') });
    await trainOnce(c, 's1');
    c.device.hold = true;
    const old = c.s.uploadHistoryToTrainer();                       // v1 (sin RPE) retenida
    await new Promise((r) => setTimeout(r, 50));
    c.store.setState((s) => ({ workoutLog: s.workoutLog.map((e) => (e.id === 's1' ? { ...e, rpe: 9 } : e)) }));
    await c.s.uploadHistoryToTrainer();                             // v2 llega
    expect((await slotOf(c.s.clientSync.slotId)).history_json.entries[0].rpe).toBe(9);
    c.device.release(); await old;                                  // v1 llega después
    expect((await slotOf(c.s.clientSync.slotId)).history_json.entries[0].rpe).toBeUndefined();
  });
  it('S12 hoy: lo que el entrenador borra de un cliente con app vuelve en la siguiente descarga (regla R-C3: mezclar solo añade; R-C4)', async () => {
    const { t, c, clientId } = await trainerAndClient();
    await trainOnce(c, 's1');
    expect(await trainerSees(t, clientId)).toEqual(['s1']);
    t.s.deleteClientLogEntry(clientId, 's1');
    expect(t.s.clientLogs[clientId]).toHaveLength(0);
    c.store.setState({ workoutLog: [] });                           // y el cliente también lo borró
    await c.s.uploadHistoryToTrainer();
    expect(await trainerSees(t, clientId)).toEqual(['s1']);
  });
  it('S13 hoy: el cliente borra s1, reinstala y fusiona → s1 vuelve a su historial (regla R-C3: mezclar solo añade)', async () => {
    const { t, clientId, c: c0 } = await trainerAndClient();
    let c = c0;
    await trainOnce(c, 's1');
    await trainOnce(c, 's2');
    c.store.setState((s) => ({ workoutLog: s.workoutLog.filter((e) => e.id !== 's1') }));
    await c.s.uploadHistoryToTrainer();
    expect(c.s.workoutLog.map((e) => e.id)).toEqual(['s2']);
    c = await reinstall(c);
    await c.s.linkToTrainer(codeOf(t, clientId), { mergeHistory: true });
    expect(c.s.workoutLog.map((e) => e.id).sort()).toEqual(['s1', 's2']);
  });
});

describe('S14 abrir sin cobertura con el token caducado', () => {
  // Parche: supabase-js real, con el token caducado y sin red, devuelve
  // getSession → {session:null, error:AuthRetryableFetchError}; el sim devuelve
  // la sesión guardada. Lo imitamos en el cliente del móvil mientras
  // `device.offline && device.tokenExpired`.
  const expiredWhenOffline = (cfg, dev) => {
    const real = cfg.clientSupabase.auth.getSession;
    cfg.clientSupabase.auth.getSession = async () => {
      if (dev.offline && dev.tokenExpired) {
        return { data: { session: null }, error: Object.assign(new Error('Failed to fetch'), { name: 'AuthRetryableFetchError', status: 0 }) };
      }
      return real();
    };
    return cfg;
  };
  it('S14 arreglado (E50): abrir sin red tras >1 h no marca lostAt, y con red vuelve a subir (regla R-C1: un fallo de red no cambia el estado de la conexión; R-B3)', async () => {
    const t = await phone('entrenador');
    let c = await phone('cliente', { wrap: expiredWhenOffline });
    await t.s.createTrainerCodeAccount();
    const { clientId } = await newClientWithProgram(t);
    await join(c, codeOf(t, clientId));
    await trainOnce(c, 's1');
    expect(c.s.clientSync.lostAt).toBeFalsy();
    c.device.offline = true; c.device.tokenExpired = true;
    logSession(c, 's2');
    c = await restart(c);
    await c.s.checkAndPullProgramUpdates();
    expect(c.s.clientSync.lostAt).toBeFalsy();
    c.device.offline = false; c.device.tokenExpired = false;
    await c.s.checkAndPullProgramUpdates();
    await c.s.uploadHistoryToTrainer();
    expect(c.s.clientSync.lostAt).toBeFalsy();
    expect(historyIds(await slotOf(c.s.clientSync.slotId))).toContain('s2');
  });
});

describe('S15 vincular Google estando desplazado', () => {
  it('S15 hoy: vincular falla con NO_SEAT pero ya soltó el asiento real que su Google tenía en otro entrenador (regla R-B1: un asiento en todo momento; R-C7)', async () => {
    const x = await phone('X');
    const y = await phone('Y');
    await x.s.createTrainerCodeAccount();
    await y.s.createTrainerCodeAccount();
    const cx = await newClientWithProgram(x);
    const cy = await newClientWithProgram(y);
    const c1 = await phone('movil1');
    await join(c1, codeOf(y, cy.clientId));
    await c1.s.linkGoogleForClient(google('gC'));                  // gC en el entrenador Y
    const ySlot = y.s.clients[cy.clientId].syncSlotId;
    expect((await slotOf(ySlot)).client_id).toBe(c1.s.clientSync.supabaseUserId);
    const c2 = await phone('movil2');
    await join(c2, codeOf(x, cx.clientId));                        // anónimo en X
    const intruso = await phone('intruso');
    await join(intruso, codeOf(x, cx.clientId));                   // le quitan el asiento (aún no lo sabe)
    await expect(c2.s.linkGoogleForClient(google('gC'))).rejects.toMatchObject({ code: 'NO_SEAT' });
    expect((await slotOf(ySlot)).client_id).toBeNull();
  });
});

describe('S16 el progreso del espejo sigue al programa personal', () => {
  it('S16 hoy: con un programa propio activo, el progreso que se sube al entrenador pasa a ser el de ese programa (regla R-B7: cada papel con lo suyo)', async () => {
    const { c } = await trainerAndClient();
    await trainOnce(c, 's1');
    const trainerProg = c.s.clientSync.trainerProgramIds[0];
    expect((await slotOf(c.s.clientSync.slotId)).history_json.progress?.programId).toBe(trainerProg);
    c.store.setState((s) => ({
      programs: { ...s.programs, mine: { ...s.programs[trainerProg], id: 'mine', name: 'Mi plan', owner: 'me' } },
      profile: { ...s.profile, activeProgramId: 'mine' },
    }));
    await c.s.uploadHistoryToTrainer();
    expect((await slotOf(c.s.clientSync.slotId)).history_json.progress.programId).toBe('mine');
  });
});

describe('S17 dos móviles del mismo entrenador', () => {
  it('S17 hoy: borrar un cliente en un móvil deja al otro un cliente «de otra cuenta» (syncOrphan) en vez de quitarlo (regla R-B6: borrar un cliente lo borra entero)', async () => {
    const t1 = await phone('t1');
    await t1.s.createTrainerCodeAccount();
    const code = t1.s.trainerSync.code;
    const { clientId } = await newClientWithProgram(t1);
    const t2 = await phone('t2');
    await t2.s.recoverTrainerAccount(code);
    expect(Object.keys(t2.s.clients)).toHaveLength(1);
    await t1.s.deleteClient(clientId);
    await t2.s.refreshTrainerSlots();
    expect(Object.values(t2.s.clients)[0].syncOrphan).toBe(true);
  });
});

describe('S18 programa nuevo del entrenador con un programa propio activo', () => {
  async function updateTrainerProgram(personalActive) {
    const { t, c, clientId } = await trainerAndClient();
    const tp = c.s.clientSync.trainerProgramIds[0];
    c.s._writeProgress(tp, { currentStageIndex: 0, stageStartedOn: '2026-10-01', stageSessionsDone: 5, stageExtraWeeks: 0, programStartedOn: '2026-10-01' });
    if (personalActive) {
      c.store.setState((s) => ({
        programs: { ...s.programs, mine: { ...s.programs[tp], id: 'mine', name: 'Mi plan', owner: 'me' } },
        profile: { ...s.profile, activeProgramId: 'mine' },
      }));
    }
    const pid = Object.values(t.s.programs).find((p) => p.owner === clientId).id;
    t.store.setState((s) => ({ programs: { ...s.programs, [pid]: { ...s.programs[pid], name: 'Fuerza v2' } } }));
    await t.s.uploadProgramToClient(clientId, pid);
    await c.s.checkAndPullProgramUpdates();
    expect(c.s.clientSync.pendingProgramUpdate).toBeTruthy();
    c.s.applyPendingProgramUpdate();
    const p = c.s.programs[tp];
    return { name: p.name, done: p.stageSessionsDone, started: p.stageStartedOn };
  }
  it('R-C5 cumple: con el programa del entrenador activo, aplicar el nuevo conserva el progreso de etapa', async () => {
    expect(await updateTrainerProgram(false)).toEqual({ name: 'Fuerza v2', done: 5, started: '2026-10-01' });
  });
  it('S18 hoy: con un programa propio activo, aplicar el programa nuevo del entrenador borra el progreso del programa del entrenador (regla R-C5: llega sin pisar lo que el cliente ha entrenado)', async () => {
    expect(await updateTrainerProgram(true)).toEqual({ name: 'Fuerza v2', done: 0, started: null });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// LO QUE CUMPLE
// ═════════════════════════════════════════════════════════════════════════════

describe('R-C7 / R-D1 cumple: matriz de cortes en los traspasos', () => {
  const cuts = [
    ['auth:signInWithIdToken', 1], ['from:profiles', 1], ['rpc:offer_transfer', 1],
    ['rpc:accept_transfer', 1], ['from:profiles', 2], ['auth:setSession', 1],
  ];
  it.each(cuts.flatMap(([key, n]) => [[key, n, ''], [key, n, ' + muere']]))(
    'R-D1 cumple: entrenador google → apple, falla %s#%i%s: reintentar deja todos los clientes en la cuenta nueva',
    async (key, n, die) => {
      let t = await phone('entrenador');
      const c = await phone('cliente');
      await t.s.enterTrainerAccount(google('g1'));
      const { clientId } = await newClientWithProgram(t);
      await join(c, codeOf(t, clientId));
      failNth(key, n);
      await expect(t.s.enterTrainerAccount(apple('a1'))).rejects.toBeTruthy();
      expect(t.s.trainerSync.mode).toBe('google');
      if (die) { t = await restart(t); await t.s.refreshTrainerSlots().catch(() => {}); }
      await t.s.enterTrainerAccount(apple('a1'));
      expect(t.s.trainerSync.mode).toBe('apple');
      expect((await slotOf(t.s.clients[clientId].syncSlotId)).trainer_id).toBe(t.s.trainerSync.userId);
      expect(await programReaches(t, c, clientId, 'ok')).toBe(true);
    },
  );

  it.each([['auth:signInWithIdToken'], ['from:trainer_clients'], ['rpc:offer_transfer'], ['rpc:accept_transfer'], ['auth:setSession']])(
    'R-C7 cumple: vincular Google del cliente, falla %s: reintentar vincula y sube',
    async (key) => {
      const { t, c, clientId } = await trainerAndClient();
      failNth(key, 1);
      await expect(c.s.linkGoogleForClient(google('cli'))).rejects.toBeTruthy();
      expect(c.s.clientSync.googleLinked).toBeFalsy();
      await c.s.linkGoogleForClient(google('cli'));
      expect((await slotOf(t.s.clients[clientId].syncSlotId)).client_id).toBe(c.s.clientSync.supabaseUserId);
      await trainOnce(c);
      expect(c.s.clientSync.lastSyncedAt).toBeTruthy();
    },
  );

  it.each([['rpc:get_slot_by_code'], ['rpc:link_client_to_slot'], ['auth:signInAnonymously']])(
    'R-C7 cumple: entrar con código, falla %s: nada cambia y reintentar entra',
    async (key) => {
      const t = await phone('entrenador');
      const c = await phone('cliente');
      await t.s.createTrainerCodeAccount();
      const { clientId } = await newClientWithProgram(t);
      failNth(key, 1);
      await expect(c.s.linkToTrainer(codeOf(t, clientId))).rejects.toBeTruthy();
      expect(c.s.clientSync.slotId).toBeNull();
      await join(c, codeOf(t, clientId));
      expect(await programReaches(t, c, clientId, 'x')).toBe(true);
    },
  );

  it.each([['auth:setSession'], ['from:trainer_clients']])(
    'R-C7 cumple: reconectar con Google en otro móvil, falla %s: reintentar entra',
    async (key) => {
      const { t, c: c0, clientId } = await trainerAndClient();
      await c0.s.linkGoogleForClient(google('cli'));
      const c = await reinstall(c0);
      let found = await c.s.validateGoogleClient(google('cli'));
      failNth(key, 1);
      await expect(c.s.confirmGoogleReconnect({ googleUserId: found.userId, provider: 'google' })).rejects.toBeTruthy();
      found = await c.s.validateGoogleClient(google('cli'));
      await c.s.confirmGoogleReconnect({ googleUserId: found.userId, provider: 'google' });
      expect(await programReaches(t, c, clientId, 'g')).toBe(true);
    },
  );

  it('R-C7 cumple: cambiar de entrenador A → B con fallo al bajar el asiento; reintentar el código de B lo arregla', async () => {
    const a = await phone('A');
    const b = await phone('B');
    const c = await phone('cliente');
    await a.s.createTrainerCodeAccount();
    await b.s.createTrainerCodeAccount();
    const ca = await newClientWithProgram(a);
    const cb = await newClientWithProgram(b, 'Ana', 'De B');
    await join(c, codeOf(a, ca.clientId));
    failNth('from:trainer_clients', 1);
    await expect(c.s.linkToTrainer(codeOf(b, cb.clientId))).rejects.toBeTruthy();
    await join(c, codeOf(b, cb.clientId));
    expect(c.s.clientSync.slotId).toBe(b.s.clients[cb.clientId].syncSlotId);
    expect(await programReaches(b, c, cb.clientId, 'B2')).toBe(true);
  });
});

describe('R-D4 cumple: borrar la cuenta con la segunda llamada caída', () => {
  it('R-D4 cumple: un fallo de red en la segunda llamada deja reintentar; el cliente queda libre', async () => {
    const x = await phone('mixto');
    const coach = await phone('coach');
    await x.s.createTrainerCodeAccount();
    await coach.s.createTrainerCodeAccount();
    const me = await newClientWithProgram(coach, 'X');
    await join(x, codeOf(coach, me.clientId));
    failNth('fn:delete-account', 2);
    await expect(x.s.deleteAccount()).rejects.toBeTruthy();
    expect(x.s.trainerSync.userId).toBeNull();
    expect(await x.s.deleteAccount()).toEqual({ ok: true });
    expect((await slotOf(coach.s.clients[me.clientId].syncSlotId)).client_id).toBeNull();
  });
});

describe('R-C1 / R-C2 cumple: enviar y subir', () => {
  it.each([
    ['programa', 'rpc:trainer_upload_program', 'programDirty'],
    ['ajustes', 'rpc:trainer_upload_overrides', 'overridesDirty'],
  ])('R-C1 cumple: enviar %s sin red lanza y queda sucio', async (what, key, dirty) => {
    const { t, clientId, programId } = await trainerAndClient();
    const tpl = t.s.programs[programId].stages[0].days[0].sessionTemplateId;
    t.s.setOverrideTarget(clientId, tpl, 'ex1', { weight: 50 });
    t.store.setState((s) => ({ clients: { ...s.clients, [clientId]: { ...s.clients[clientId], activeProgramId: programId } } }));
    t.store.setState((s) => ({ programs: { ...s.programs, [programId]: { ...s.programs[programId], name: 'Z' } } }));
    t.s.markProgramDirtyForClients(programId);
    failNth(key, 1);
    await expect(what === 'programa' ? t.s.uploadProgramToClient(clientId, programId) : t.s.sendOverrides(clientId)).rejects.toBeTruthy();
    expect(t.s.clients[clientId][dirty]).toBe(true);
  });

  it('R-C1 cumple: descargar sin red lanza, marca error y no toca el historial', async () => {
    const { t, c, clientId } = await trainerAndClient();
    await trainOnce(c, 's1');
    await trainerSees(t, clientId);
    failNth('from:trainer_clients', 1);
    await expect(t.s.downloadClientHistory(clientId)).rejects.toBeTruthy();
    expect(t.s.clients[clientId].syncErrorAt).toBeTruthy();
    expect(t.s.clientLogs[clientId].map((e) => e.id)).toEqual(['s1']);
  });

  it('R-C1 cumple: subir historial con fallo queda pendiente y visible; el pull lo reintenta', async () => {
    const { t, c, clientId } = await trainerAndClient();
    failNth('rpc:client_upload_history', 1);
    await trainOnce(c, 's1');
    expect(c.s.clientSync).toMatchObject({ pendingUpload: true, syncErrorAt: expect.any(String) });
    await c.s.checkAndPullProgramUpdates();
    await new Promise((r) => setTimeout(r, 50));
    expect(c.s.clientSync.pendingUpload).toBe(false);
    expect(await trainerSees(t, clientId)).toEqual(['s1']);
  });

  it('R-C2 cumple: la misma sesión subida dos veces llega una vez', async () => {
    const { t, c, clientId } = await trainerAndClient();
    await trainOnce(c, 's1');
    await c.s.uploadHistoryToTrainer();
    await trainerSees(t, clientId);
    await c.s.uploadHistoryToTrainer();
    expect(await trainerSees(t, clientId)).toEqual(['s1']);
    expect((await slotOf(t.s.clients[clientId].syncSlotId)).sessions_count).toBe(1);
  });
});

describe('R-C5 cumple: programa nuevo del entrenador', () => {
  it('R-C5 cumple: con entrenos hechos queda pendiente con aviso; aplicarlo no toca el historial ni el progreso', async () => {
    const { t, c, clientId, programId } = await trainerAndClient();
    await trainOnce(c, 's1');
    const before = c.s.programs[c.s.clientSync.trainerProgramIds[0]];
    t.store.setState((s) => ({ programs: { ...s.programs, [programId]: { ...s.programs[programId], name: 'Fuerza v2' } } }));
    await t.s.uploadProgramToClient(clientId, programId);
    await c.s.checkAndPullProgramUpdates();
    expect(c.s.clientSync.pendingProgramUpdate).toBeTruthy();
    expect(c.s.programs[before.id].name).toBe('Fuerza');            // no se aplica solo
    c.s.applyPendingProgramUpdate();
    expect(c.s.programs[before.id].name).toBe('Fuerza v2');
    expect(c.s.workoutLog.map((e) => e.id)).toEqual(['s1']);
    expect(c.s.programs[before.id].currentStageIndex ?? 0).toBe(before.currentStageIndex ?? 0);
  });
});
