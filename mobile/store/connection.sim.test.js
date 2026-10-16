/**
 * La conexión entrenador ↔ cliente, de punta a punta y con varios móviles.
 *
 * Cada `phone()` es una instalación de la app: el store REAL, importado de
 * nuevo, con su propio almacenamiento y sus sesiones. Todos hablan con el mismo
 * servidor: el SQL REAL de `supabase/schema.sql` en un Postgres de verdad
 * (ver `test/supabaseSim.js`). Así se prueba lo que antes solo se podía probar
 * con dos móviles en la mano: cambiar de forma de entrar, reinstalar, cortes de
 * red a mitad, ser entrenador y cliente en el mismo móvil…
 *
 * Lo que NO prueba: las pantallas, ni Google/Apple de verdad (aquí un id_token
 * es `'google:<sub>'`), ni la Edge Function desplegada (aquí es su lógica).
 * Eso queda en las casillas «Probar C09-…» de la spec.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createServer, createDevice, wipeDevice, createSimClient } from '../../test/supabaseSim.js';


let server;
beforeEach(async () => { server = await createServer(); });

/** El Supabase de un móvil: dos sesiones (entrenador y cliente) y clientes temporales. */
function simConfig(device) {
  return {
    trainerSupabase:    createSimClient(device, { storageKey: 'sb-trainer' }),
    clientSupabase:     createSimClient(device, { storageKey: 'sb-client' }),
    createTempSupabase: () => createSimClient(device, { persistSession: false }),
    migrateLegacySession: async () => {},
    sessionsReady:        async () => {},
  };
}

// ─── Móviles ──────────────────────────────────────────────────────────────────

const plain = (state) => Object.fromEntries(Object.entries(state).filter(([, v]) => typeof v !== 'function'));

/** Instala la app en un móvil (nuevo, o uno que ya existe: reinstalar = `wipe`). */
async function phone(name, { device, from, wipe = false } = {}) {
  const dev = device ?? createDevice(server, name);
  if (wipe) wipeDevice(dev);
  vi.resetModules();
  vi.doMock('../src/config/supabase', () => simConfig(dev));
  const { useStore } = await import('./useStore.js');
  // Con PRO: el plan gratis tiene su propia batería de tests.
  useStore.setState((s) => ({ profile: { ...s.profile, isPro: true }, _hasHydrated: true }));
  // Cerrar y abrir la app: lo persistido vuelve, las sesiones siguen en el almacenamiento.
  if (from) useStore.setState(plain(from.store.getState()));
  return { name, device: dev, store: useStore, get s() { return useStore.getState(); } };
}

/** Cerrar la app y volverla a abrir (no borra nada). */
const restart = (p) => phone(p.name, { device: p.device, from: p });

/** Borrar datos / reinstalar: el mismo móvil, sin nada guardado. */
const reinstall = (p) => phone(p.name, { device: p.device, wipe: true });

const google = (sub) => ({ provider: 'google', idToken: `google:${sub}` });
const apple  = (sub) => ({ provider: 'apple', idToken: `apple:${sub}` });

// ─── Piezas de los recorridos ─────────────────────────────────────────────────

/** El entrenador crea un cliente con app y un programa para él; devuelve el id local. */
async function newClientWithProgram(t, name = 'Ana', programName = 'Fuerza') {
  const clientId = await t.s.createClient(name, { withApp: true });
  const programId = t.s.createProgramForClient(clientId, 2, programName, null, { openEditor: false });
  await t.s.uploadProgramToClient(clientId, programId);
  return { clientId, programId };
}

const codeOf = (t, clientId) => t.s.clients[clientId].syncCode;

/** El cliente mete el código y entra. */
async function join(c, code) {
  await c.s.validateClientCode(code);
  await c.s.linkToTrainer(code);
}

/** El cliente entrena: una sesión del programa de su entrenador, y la sube. */
async function trainOnce(c, id = `e${Math.random()}`) {
  const programId = c.s.clientSync.trainerProgramIds[0];
  const sessionTemplateId = c.s.programs[programId].stages[0].days[0].sessionTemplateId;
  c.store.setState((s) => ({
    workoutLog: [...s.workoutLog, { id, programId, sessionTemplateId, timestamp: Date.now(), date: new Date().toISOString().slice(0, 10), exercises: [] }],
  }));
  await c.s.uploadHistoryToTrainer();
}

/** ¿El programa que el entrenador manda ahora le llega al cliente? */
async function programReaches(t, c, clientId, programName) {
  const programId = t.s.createProgramForClient(clientId, 1, programName, null, { openEditor: false });
  await t.s.uploadProgramToClient(clientId, programId);
  await c.s.checkAndPullProgramUpdates();
  return c.s.clientSync.pendingProgramUpdate?.programJson?.program?.name === programName;
}

const slotOf = async (slotId) => (await server.slots()).find((r) => r.id === slotId);

// ═════════════════════════════════════════════════════════════════════════════

describe('entrenador: el recorrido básico', () => {
  it('código → cliente con app → el cliente entra, recibe el programa y el entrenador ve sus sesiones', async () => {
    const t = await phone('entrenador');
    const c = await phone('cliente');
    await t.s.createTrainerCodeAccount();
    const { clientId } = await newClientWithProgram(t);

    await join(c, codeOf(t, clientId));
    expect(c.s.programs[c.s.clientSync.trainerProgramIds[0]].name).toBe('Fuerza');

    await trainOnce(c);
    await t.s.refreshTrainerSlots();
    expect(t.s.clients[clientId]).toMatchObject({ syncLinked: true, remoteSessionsCount: 1 });
    expect(await programReaches(t, c, clientId, 'Fuerza 2')).toBe(true);
  });
});

describe('entrenador: cambiar de forma de entrar se lleva a los clientes', () => {
  const ways = {
    code:   (t) => t.s.createTrainerCodeAccount(),
    google: (t) => t.s.enterTrainerAccount(google('g1')),
    apple:  (t) => t.s.enterTrainerAccount(apple('a1')),
  };
  const pairs = [['code', 'google'], ['code', 'apple'], ['google', 'apple'], ['apple', 'google'], ['google', 'code'], ['apple', 'code']];

  for (const [from, to] of pairs) {
    it(`${from} → ${to}`, async () => {
      const t = await phone('entrenador');
      const c = await phone('cliente');
      await ways[from](t);
      const before = t.s.trainerSync.userId;
      const { clientId } = await newClientWithProgram(t);
      await join(c, codeOf(t, clientId));

      await ways[to](t);
      expect(t.s.trainerSync.userId).not.toBe(before);
      expect((await slotOf(t.s.clients[clientId].syncSlotId)).trainer_id).toBe(t.s.trainerSync.userId);
      expect(await programReaches(t, c, clientId, `tras ${to}`)).toBe(true);
    });
  }

  it('ida y vuelta (Google → código → Google): nada se pierde', async () => {
    const t = await phone('entrenador');
    const c = await phone('cliente');
    await t.s.enterTrainerAccount(google('g1'));
    const { clientId } = await newClientWithProgram(t);
    await join(c, codeOf(t, clientId));
    await t.s.createTrainerCodeAccount();
    await t.s.enterTrainerAccount(google('g1'));
    expect(await programReaches(t, c, clientId, 'vuelta')).toBe(true);
  });

  it('un corte de red a mitad del traspaso no cambia nada, y reintentar funciona', async () => {
    const t = await phone('entrenador');
    const c = await phone('cliente');
    await t.s.createTrainerCodeAccount();
    const code = t.s.trainerSync.code;
    const { clientId } = await newClientWithProgram(t);
    await join(c, codeOf(t, clientId));

    server.failOnce('rpc:transfer_my_slots_to');
    await expect(t.s.enterTrainerAccount(google('g1'))).rejects.toThrow();
    // Sigue exactamente donde estaba: misma cuenta, mismo código, envía igual.
    expect(t.s.trainerSync).toMatchObject({ mode: 'code', code });
    expect(await programReaches(t, c, clientId, 'sin cambiar')).toBe(true);

    await t.s.enterTrainerAccount(google('g1'));
    expect(t.s.trainerSync.mode).toBe('google');
    expect(await programReaches(t, c, clientId, 'cambiado')).toBe(true);
  });

  it('si la app muere entre el traspaso y guardar la cuenta nueva, entrar otra vez lo arregla', async () => {
    const t = await phone('entrenador');
    const c = await phone('cliente');
    await t.s.enterTrainerAccount(google('g1'));
    const { clientId } = await newClientWithProgram(t);
    await join(c, codeOf(t, clientId));

    // El traspaso llega al servidor, pero el móvil no se entera (muere).
    server.failOnce('auth:setSession');
    await expect(t.s.enterTrainerAccount(apple('a1'))).rejects.toThrow();
    const t2 = await restart(t);
    // En la cuenta vieja ya no hay clientes: se marcan, no se borran.
    await t2.s.refreshTrainerSlots();
    expect(t2.s.clients[clientId].syncSlotId).toBeTruthy();

    await t2.s.enterTrainerAccount(apple('a1'));
    expect(await programReaches(t2, c, clientId, 'recuperado')).toBe(true);
  });
});

describe('entrenador: reinstalar y «Ya tengo cuenta»', () => {
  for (const [way, enter, recover] of [
    ['código', (t) => t.s.createTrainerCodeAccount(), (t, code) => t.s.recoverTrainerAccount(code)],
    ['Google', (t) => t.s.enterTrainerAccount(google('g1')), (t) => t.s.enterTrainerAccount({ ...google('g1'), mustExist: true })],
    ['Apple',  (t) => t.s.enterTrainerAccount(apple('a1')),  (t) => t.s.enterTrainerAccount({ ...apple('a1'), mustExist: true })],
  ]) {
    it(`con ${way}: vuelven todos los clientes, con su programa, y siguen conectados`, async () => {
      let t = await phone('entrenador');
      const c = await phone('cliente');
      await enter(t);
      const code = t.s.trainerSync.code;
      const { clientId } = await newClientWithProgram(t, 'Ana', 'Fuerza');
      await join(c, codeOf(t, clientId));
      await newClientWithProgram(t, 'Invitado', 'Base');       // aún no ha entrado
      const reissued = await t.s.createClient('Reemitido', { withApp: true });
      await t.s.reissueClientCode(reissued);                     // código nuevo sin canjear

      t = await reinstall(t);
      await recover(t, code);
      const byName = Object.fromEntries(Object.values(t.s.clients).map((x) => [x.name, x]));
      expect(Object.keys(byName).sort()).toEqual(['Ana', 'Invitado', 'Reemitido']);
      expect(t.s.programs[byName.Ana.activeProgramId]?.name).toBe('Fuerza');
      expect(byName.Ana.syncLinked).toBe(true);
      expect(await programReaches(t, c, byName.Ana.id, 'tras reinstalar')).toBe(true);
    });
  }

  it('«Ya tengo cuenta» con un Google sin cuenta no toca ninguna sesión, y «Crear una nueva» la crea', async () => {
    const x = await phone('mixto');
    const trainer = await phone('su entrenador');
    await trainer.s.createTrainerCodeAccount();
    const { clientId } = await newClientWithProgram(trainer);
    await join(x, codeOf(trainer, clientId));                   // x es cliente de alguien

    const err = await x.s.enterTrainerAccount({ ...google('nuevo'), mustExist: true }).catch((e) => e);
    expect(err?.notFound).toBe(true);
    expect(x.s.trainerSync.userId).toBeNull();
    await trainOnce(x);                                          // su lado cliente sigue vivo
    expect(x.s.clientSync.pendingUpload).toBe(false);

    await err.createInstead();
    expect(x.s.trainerSync).toMatchObject({ mode: 'google' });
  });
});

describe('entrenador: la sesión de Google/Apple se pierde', () => {
  async function setup() {
    const t = await phone('entrenador');
    const c = await phone('cliente');
    await t.s.enterTrainerAccount(google('g1'));
    const { clientId } = await newClientWithProgram(t);
    await join(c, codeOf(t, clientId));
    t.device.storage.delete('sb-trainer');                       // p. ej., token revocado
    return { t, c, clientId };
  }

  it('Mi cuenta lo sabe, y volver a entrar con la misma cuenta lo arregla todo', async () => {
    const { t, c, clientId } = await setup();
    expect(await t.s.trainerSessionState()).toBe('login');
    expect(t.s.trainerLoginNeeded).toBe(true);                   // Clientes y Mi cuenta lo avisan
    const programId = t.s.createProgramForClient(clientId, 1, 'x', null, { openEditor: false });
    await expect(t.s.uploadProgramToClient(clientId, programId)).rejects.toMatchObject({ code: 'TRAINER_LOGIN_NEEDED' });

    await t.s.enterTrainerAccount({ ...google('g1'), mustExist: true });
    expect(await t.s.trainerSessionState()).toBe('ok');
    expect(t.s.trainerLoginNeeded).toBe(false);
    expect(await programReaches(t, c, clientId, 'de nuevo')).toBe(true);
  });

  it('cambiar a Apple sin poder ceder no se hace (perdería los clientes): primero hay que volver a entrar', async () => {
    const { t, c, clientId } = await setup();
    await expect(t.s.enterTrainerAccount(apple('a1'))).rejects.toMatchObject({ code: 'TRAINER_LOGIN_NEEDED' });
    expect(t.s.trainerSync.mode).toBe('google');

    await t.s.enterTrainerAccount({ ...google('g1'), mustExist: true });
    await t.s.enterTrainerAccount(apple('a1'));
    expect(await programReaches(t, c, clientId, 'en Apple')).toBe(true);
  });
});

describe('entrenador: desconectar y volver', () => {
  it('desconectar y volver con la misma cuenta: todo sigue', async () => {
    const t = await phone('entrenador');
    const c = await phone('cliente');
    await t.s.enterTrainerAccount(google('g1'));
    const { clientId } = await newClientWithProgram(t);
    await join(c, codeOf(t, clientId));
    await t.s.leaveTrainerAccount();
    await t.s.enterTrainerAccount({ ...google('g1'), mustExist: true });
    expect(await programReaches(t, c, clientId, 'de vuelta')).toBe(true);
  });

  it('desconectar y entrar con OTRA cuenta: los clientes se marcan como de otra cuenta, no se mandan en falso', async () => {
    const t = await phone('entrenador');
    const c = await phone('cliente');
    await t.s.enterTrainerAccount(google('g1'));
    const { clientId } = await newClientWithProgram(t);
    await join(c, codeOf(t, clientId));
    await t.s.leaveTrainerAccount();
    await t.s.enterTrainerAccount(google('otra'));

    expect(t.s.clients[clientId].syncOrphan).toBe(true);
    const programId = t.s.createProgramForClient(clientId, 1, 'no llega', null, { openEditor: false });
    await expect(t.s.uploadProgramToClient(clientId, programId)).rejects.toThrow();

    // Volviendo a la cuenta buena se recuperan solos.
    await t.s.leaveTrainerAccount();
    await t.s.enterTrainerAccount(google('g1'));
    expect(t.s.clients[clientId].syncOrphan).toBeFalsy();
    expect(await programReaches(t, c, clientId, 'recuperado')).toBe(true);
  });

  it('uno «de otra cuenta» se puede pasar a la app en esta: hueco nuevo, código nuevo', async () => {
    const t = await phone('entrenador');
    const c = await phone('cliente');
    await t.s.enterTrainerAccount(google('g1'));
    const { clientId, programId } = await newClientWithProgram(t);
    await t.s.leaveTrainerAccount();
    await t.s.enterTrainerAccount(google('otra'));
    expect(t.s.clients[clientId].syncOrphan).toBe(true);

    await t.s.moveClientToApp(clientId);
    expect(t.s.clients[clientId].syncOrphan).toBe(false);
    await t.s.uploadProgramToClient(clientId, programId);
    await join(c, codeOf(t, clientId));
    expect(await programReaches(t, c, clientId, 'en la nueva')).toBe(true);
  });
});

describe('entrenador: nada se da por hecho sin que el servidor lo confirme', () => {
  it('mandar un programa a un hueco que ya no existe falla, no dice «enviado»', async () => {
    const t = await phone('entrenador');
    await t.s.createTrainerCodeAccount();
    const { clientId, programId } = await newClientWithProgram(t);
    await server.admin('delete from public.trainer_clients');
    await expect(t.s.uploadProgramToClient(clientId, programId)).rejects.toThrow();
  });

  it('borrar un cliente sin red: se va aquí, el hueco se borra al volver la red y no resucita', async () => {
    const t = await phone('entrenador');
    const c = await phone('cliente');
    await t.s.createTrainerCodeAccount();
    const { clientId } = await newClientWithProgram(t);
    const slotId = t.s.clients[clientId].syncSlotId;
    await join(c, codeOf(t, clientId));

    t.device.offline = true;
    await t.s.deleteClient(clientId);
    expect(t.s.clients[clientId]).toBeUndefined();
    expect(await slotOf(slotId)).toBeTruthy();                   // aún no ha podido

    t.device.offline = false;
    await t.s.refreshTrainerSlots();
    expect(await slotOf(slotId)).toBeUndefined();
    expect(Object.keys(t.s.clients)).toHaveLength(0);            // no resucita
    expect(t.s.trainerSync.deletedSlotIds).toEqual([]);
    await c.s.checkAndPullProgramUpdates();
    expect(c.s.clientSync.lostAt).toBeTruthy();
  });
});

describe('el cliente se entera cuando lo desconectan', () => {
  for (const [what, act] of [
    ['el entrenador lo borra',            (t, id) => t.s.deleteClient(id)],
    ['el entrenador reemite su código',   (t, id) => t.s.reissueClientCode(id)],
    ['el entrenador borra su cuenta',     (t) => t.s.deleteAccount()],
  ]) {
    it(what, async () => {
      const t = await phone('entrenador');
      const c = await phone('cliente');
      await t.s.createTrainerCodeAccount();
      const { clientId } = await newClientWithProgram(t);
      await join(c, codeOf(t, clientId));
      await act(t, clientId);

      await c.s.checkAndPullProgramUpdates();
      expect(c.s.clientSync).toMatchObject({ lostAt: expect.any(String), lostReason: 'gone' });
      await trainOnce(c);
      expect(c.s.clientSync.lastSyncedAt).toBeNull();          // no se da por subido
    });
  }

  it('un corte de red NO cuenta como desconectado', async () => {
    const t = await phone('entrenador');
    const c = await phone('cliente');
    await t.s.createTrainerCodeAccount();
    const { clientId } = await newClientWithProgram(t);
    await join(c, codeOf(t, clientId));
    c.device.offline = true;
    await c.s.checkAndPullProgramUpdates();
    await trainOnce(c);
    expect(c.s.clientSync.lostAt).toBeFalsy();
    expect(c.s.clientSync.pendingUpload).toBe(true);
  });

  it('reinstala sin Google: con el MISMO código vuelve a entrar y su historial sigue ahí', async () => {
    const t = await phone('entrenador');
    let c = await phone('cliente');
    await t.s.createTrainerCodeAccount();
    const { clientId } = await newClientWithProgram(t);
    await join(c, codeOf(t, clientId));
    await trainOnce(c, 'sesion-1');

    c = await reinstall(c);                                      // anónimo: identidad perdida
    const info = await c.s.validateClientCode(codeOf(t, clientId));
    expect(info.alreadyLinked).toBe(true);                       // la hoja avisa: otro móvil lo usa
    await c.s.linkToTrainer(codeOf(t, clientId), { mergeHistory: true });
    expect(c.s.workoutLog.map((e) => e.id)).toContain('sesion-1');
    expect(await programReaches(t, c, clientId, 'tras reinstalar')).toBe(true);
  });

  it('el móvil pierde su sesión pero conserva los datos: lo dice, y su código lo arregla', async () => {
    const t = await phone('entrenador');
    const c = await phone('cliente');
    await t.s.createTrainerCodeAccount();
    const { clientId } = await newClientWithProgram(t);
    await join(c, codeOf(t, clientId));
    c.device.storage.delete('sb-client');                       // como lo de la migración

    await c.s.checkAndPullProgramUpdates();
    expect(c.s.clientSync).toMatchObject({ lostAt: expect.any(String), lostReason: 'identity' });
    await c.s.linkToTrainer(c.s.clientSync.clientCode);
    expect(c.s.clientSync.lostAt).toBeNull();
    expect(await programReaches(t, c, clientId, 'de vuelta')).toBe(true);
  });

  it('con Google vinculado, el código no le echa: solo se vuelve a entrar con esa cuenta', async () => {
    const t = await phone('entrenador');
    let c = await phone('cliente');
    await t.s.createTrainerCodeAccount();
    const { clientId } = await newClientWithProgram(t);
    const code = codeOf(t, clientId);
    await join(c, code);
    await c.s.linkGoogleForClient(google('cli'));

    // Otro móvil con el código: ni valida ni entra, y la cliente sigue dentro.
    const intruso = await phone('intruso');
    await expect(intruso.s.validateClientCode(code)).rejects.toMatchObject({ code: 'SEAT_LOCKED' });
    await expect(intruso.s.linkToTrainer(code)).rejects.toMatchObject({ code: 'SEAT_LOCKED' });
    await trainOnce(c);
    expect(c.s.clientSync.lastSyncedAt).toBeTruthy();

    // Ella misma en un móvil nuevo: con el código tampoco; con su Google, sí.
    c = await reinstall(c);
    await expect(c.s.validateClientCode(code)).rejects.toMatchObject({ code: 'SEAT_LOCKED' });
    const found = await c.s.validateGoogleClient(google('cli'));
    await c.s.confirmGoogleReconnect({ slotId: found.slotId, googleUserId: found.userId, provider: 'google' });
    expect(await programReaches(t, c, clientId, 'con su Google')).toBe(true);

    // Si pierde el acceso a su Google, reemitir libera el asiento para el código nuevo.
    const fresh = await t.s.reissueClientCode(clientId);
    await join(intruso, fresh);
    expect(await programReaches(t, intruso, clientId, 'tras reemitir')).toBe(true);
  });

  it('el código reemitido sigue siendo la forma de revocar: el viejo ya no entra', async () => {
    const t = await phone('entrenador');
    const c = await phone('cliente');
    await t.s.createTrainerCodeAccount();
    const { clientId } = await newClientWithProgram(t);
    const old = codeOf(t, clientId);
    await join(c, old);
    const fresh = await t.s.reissueClientCode(clientId);
    const intruso = await phone('intruso');
    await expect(intruso.s.linkToTrainer(old)).rejects.toMatchObject({ code: 'CODE_NOT_FOUND' });
    await join(c, fresh);
    expect(await programReaches(t, c, clientId, 'con el nuevo')).toBe(true);
  });
});

describe('cliente: cambiar de entrenador, desconectarse, vincular Google', () => {
  it('meter un código y cancelar no rompe la conexión que ya tenía', async () => {
    const t = await phone('entrenador');
    const c = await phone('cliente');
    await t.s.createTrainerCodeAccount();
    const { clientId } = await newClientWithProgram(t);
    await join(c, codeOf(t, clientId));
    const other = await newClientWithProgram(t, 'Otro');
    await c.s.validateClientCode(codeOf(t, other.clientId));   // y cancela
    await trainOnce(c);
    expect(c.s.clientSync.lastSyncedAt).toBeTruthy();
    expect((await slotOf(c.s.clientSync.slotId)).sessions_count).toBe(1);
  });

  it('cambiar de entrenador suelta el hueco del anterior (y borra lo suyo de allí)', async () => {
    const a = await phone('entrenador A');
    const b = await phone('entrenador B');
    const c = await phone('cliente');
    await a.s.createTrainerCodeAccount();
    await b.s.enterTrainerAccount(google('b'));
    const ca = await newClientWithProgram(a);
    const cb = await newClientWithProgram(b);
    await join(c, codeOf(a, ca.clientId));
    await trainOnce(c);
    await join(c, codeOf(b, cb.clientId));

    const old = await slotOf(a.s.clients[ca.clientId].syncSlotId);
    expect(old).toMatchObject({ client_id: null, history_json: null });
    await a.s.refreshTrainerSlots();
    expect(a.s.clients[ca.clientId]).toMatchObject({ syncLinked: false, syncLeftAt: expect.any(String) });
    expect(await programReaches(b, c, cb.clientId, 'de B')).toBe(true);
  });

  it('con Google, desconectarse y meter el código de otro entrenador: sigue entrando con su Google', async () => {
    const a = await phone('entrenador A');
    const b = await phone('entrenador B');
    let c = await phone('cliente');
    await a.s.createTrainerCodeAccount();
    await b.s.createTrainerCodeAccount();
    const ca = await newClientWithProgram(a);
    const cb = await newClientWithProgram(b);
    await join(c, codeOf(a, ca.clientId));
    await c.s.linkGoogleForClient(google('cli'));
    await c.s.unlinkFromTrainer();
    expect(c.s.clientSync.googleLinked).toBe(false);

    await join(c, codeOf(b, cb.clientId));
    expect(c.s.clientSync).toMatchObject({ googleLinked: true, linkedProvider: 'google' });
    c = await reinstall(c);                                      // y su Google lo recupera
    const found = await c.s.validateGoogleClient(google('cli'));
    expect(found.slotId).toBe(b.s.clients[cb.clientId].syncSlotId);
  });

  it('desconectarse: el entrenador lo ve y el mismo código sirve para volver', async () => {
    const t = await phone('entrenador');
    const c = await phone('cliente');
    await t.s.createTrainerCodeAccount();
    const { clientId } = await newClientWithProgram(t);
    await join(c, codeOf(t, clientId));
    await c.s.unlinkFromTrainer();
    await t.s.refreshTrainerSlots();
    expect(t.s.clients[clientId]).toMatchObject({ syncLinked: false, syncLeftAt: expect.any(String) });
    await join(c, codeOf(t, clientId));
    expect(await programReaches(t, c, clientId, 'otra vez')).toBe(true);
  });

  it('vincula Google, reinstala y entra con Google: vuelve a SU entrenador', async () => {
    const a = await phone('entrenador A');
    const b = await phone('entrenador B');
    let c = await phone('cliente');
    await a.s.createTrainerCodeAccount();
    await b.s.createTrainerCodeAccount();
    const ca = await newClientWithProgram(a);
    const cb = await newClientWithProgram(b);
    await join(c, codeOf(a, ca.clientId));
    await c.s.linkGoogleForClient(google('cli'));
    await join(c, codeOf(b, cb.clientId));                       // cambia a B

    c = await reinstall(c);
    const found = await c.s.validateGoogleClient(google('cli'));
    expect(found.slotId).toBe(b.s.clients[cb.clientId].syncSlotId);
    await c.s.confirmGoogleReconnect({ slotId: found.slotId, googleUserId: found.userId, provider: 'google' });
    expect(await programReaches(b, c, cb.clientId, 'de B tras reinstalar')).toBe(true);
  });

  it('entrar con un Google que no tiene hueco no deja ninguna sesión cambiada', async () => {
    const t = await phone('entrenador');
    const c = await phone('cliente');
    await t.s.createTrainerCodeAccount();
    const { clientId } = await newClientWithProgram(t);
    await join(c, codeOf(t, clientId));
    expect(await c.s.validateGoogleClient(google('sin-hueco'))).toEqual({ found: false });
    await trainOnce(c);
    expect(c.s.clientSync.lastSyncedAt).toBeTruthy();
  });
});

describe('entrenador que además es cliente de otro (mismo móvil)', () => {
  for (const [way, enter] of [
    ['código', (x) => x.s.createTrainerCodeAccount()],
    ['Google', (x) => x.s.enterTrainerAccount(google('x'))],
  ]) {
    it(`con ${way}: un papel nunca rompe al otro`, async () => {
      let x = await phone('mixto');
      const coach = await phone('su entrenador');
      const c = await phone('cliente de x');
      await enter(x);
      const mine = await newClientWithProgram(x, 'Cliente de X');
      await join(c, codeOf(x, mine.clientId));

      await coach.s.createTrainerCodeAccount();
      const me = await newClientWithProgram(coach, 'X');
      await join(x, codeOf(coach, me.clientId));                // x se conecta como cliente

      // Entrenar como cliente y mandar como entrenador, intercalado.
      await trainOnce(x);
      expect(await programReaches(x, c, mine.clientId, 'de X')).toBe(true);
      await trainOnce(x);
      expect((await slotOf(x.s.clientSync.slotId)).sessions_count).toBe(2);
      expect(await programReaches(coach, x, me.clientId, 'para X')).toBe(true);

      // Reiniciar la app no mezcla nada.
      x = await restart(x);
      await trainOnce(x);
      expect((await slotOf(x.s.clientSync.slotId)).sessions_count).toBe(3);
      expect(await programReaches(x, c, mine.clientId, 'tras reiniciar')).toBe(true);
    });
  }

  it('desconectar la cuenta de entrenador no le desconecta de su entrenador, ni al revés', async () => {
    const x = await phone('mixto');
    const coach = await phone('su entrenador');
    const c = await phone('cliente de x');
    await x.s.enterTrainerAccount(google('x'));
    const mine = await newClientWithProgram(x);
    await join(c, codeOf(x, mine.clientId));
    await coach.s.createTrainerCodeAccount();
    const me = await newClientWithProgram(coach, 'X');
    await join(x, codeOf(coach, me.clientId));

    await x.s.leaveTrainerAccount();
    await trainOnce(x);
    expect(x.s.clientSync.lastSyncedAt).toBeTruthy();

    await x.s.enterTrainerAccount({ ...google('x'), mustExist: true });
    await x.s.unlinkFromTrainer();
    expect(await programReaches(x, c, mine.clientId, 'sigue')).toBe(true);
  });

  it('cambiar la cuenta de entrenador de código a Google no toca su lado cliente', async () => {
    const x = await phone('mixto');
    const coach = await phone('su entrenador');
    await x.s.createTrainerCodeAccount();
    await coach.s.createTrainerCodeAccount();
    const me = await newClientWithProgram(coach, 'X');
    await join(x, codeOf(coach, me.clientId));
    await x.s.enterTrainerAccount(google('x'));
    await trainOnce(x);
    expect((await slotOf(x.s.clientSync.slotId)).sessions_count).toBe(1);
  });

  it('borrar la cuenta borra las dos identidades y deja los clientes en el móvil', async () => {
    const x = await phone('mixto');
    const coach = await phone('su entrenador');
    await x.s.enterTrainerAccount(google('x'));
    const mine = await newClientWithProgram(x);
    const local = await x.s.createClient('Sin app');
    await coach.s.createTrainerCodeAccount();
    const me = await newClientWithProgram(coach, 'X');
    await join(x, codeOf(coach, me.clientId));
    const seat = x.s.clientSync.slotId;
    const trainerId = x.s.trainerSync.userId;

    await x.s.deleteAccount();
    const rows = await server.slots();
    expect(rows.filter((r) => r.trainer_id === trainerId)).toHaveLength(0);   // sus huecos, fuera
    expect(rows.find((r) => r.id === seat)).toMatchObject({ client_id: null, history_json: null });
    const users = await server.admin('select count(*)::int as n from auth.users where not is_anonymous and email like $1', ['x@%']);
    expect(users[0].n).toBe(0);
    // Lo del móvil se queda: los dos clientes, ya sin app.
    expect(x.s.clients[mine.clientId]).toMatchObject({ syncSlotId: null });
    expect(x.s.clients[local]).toBeTruthy();
  });
});

describe('reglas del servidor (sin app de por medio)', () => {
  it('nadie escribe la tabla directamente', async () => {
    const t = await phone('entrenador');
    await t.s.createTrainerCodeAccount();
    const { createSimClient } = await import('../../test/supabaseSim.js');
    const raw = createSimClient(t.device, { storageKey: 'sb-trainer' });
    const { error } = await raw.from('trainer_clients').update({ trainer_name: 'x' }).eq('trainer_id', t.s.trainerSync.userId);
    expect(error?.code).toBe('42501');
  });

  it('el código siempre entra: el que estaba dentro sale y se le dice que alguien usó su código', async () => {
    const t = await phone('entrenador');
    await t.s.createTrainerCodeAccount();
    const { clientId } = await newClientWithProgram(t);
    const [c1, c2] = [await phone('c1'), await phone('c2')];
    await join(c1, codeOf(t, clientId));
    await join(c2, codeOf(t, clientId));

    expect((await slotOf(t.s.clients[clientId].syncSlotId)).client_id).toBe(c2.s.clientSync.supabaseUserId);
    await c1.s.checkAndPullProgramUpdates();
    expect(c1.s.clientSync).toMatchObject({ lostAt: expect.any(String), lostReason: 'taken' });
    expect(await programReaches(t, c2, clientId, 'para el que entró')).toBe(true);
  });
});
