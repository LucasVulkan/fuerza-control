/**
 * Los clientes son de la cuenta (docs/specs/C10-clientes-de-la-cuenta.md), con
 * varios móviles contra el SQL real de `supabase/schema.sql` (PGlite).
 *
 * C10-03: el id de la ficha vive en el hueco (`local_id`); recuperar la cuenta
 * lo usa, y el primer refresco fija los que faltan o no cuadran (N-20, N-08).
 *
 * C10-04: cada cliente con su hueco: nace `local`, la subida le crea el hueco sin
 * código, invitar le da código y cancelar se lo quita; mejorar la cuenta traspasa
 * y entrar en otra no.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { linkOf, assertFacts, NO_SLOT } from '../src/utils/clientLink';
import { buildBackupJson } from '../src/utils/backupPayload';
import { forPlan, clientLimitReason } from '../src/utils/freePlan';
import { createServer, createDevice, createSimClient } from '../../test/supabaseSim.js';

let server;
beforeEach(async () => { server = await createServer(); });

function simConfig(device) {
  return {
    trainerSupabase:    createSimClient(device, { storageKey: 'sb-trainer' }),
    clientSupabase:     createSimClient(device, { storageKey: 'sb-client' }),
    createTempSupabase: () => createSimClient(device, { persistSession: false }),
    migrateLegacySession: async () => {},
    sessionsReady:        async () => {},
  };
}

/** Instala la app en un móvil nuevo. */
async function phone(name) {
  const dev = createDevice(server, name);
  vi.resetModules();
  vi.doMock('../src/config/supabase', () => simConfig(dev));
  const { useStore } = await import('./useStore.js');
  useStore.setState((s) => ({ profile: { ...s.profile, isPro: true }, _hasHydrated: true }));
  return { name, device: dev, store: useStore, get s() { return useStore.getState(); } };
}

const google = (sub) => ({ provider: 'google', idToken: `google:${sub}` });

/** Cliente con app y programa enviado; devuelve el id de la ficha. */
async function newClient(t, name = 'Ana') {
  const clientId = await t.s.createClient(name, { withApp: true });
  const programId = t.s.createProgramForClient(clientId, 2, `Fuerza ${name}`, null, { openEditor: false });
  await t.s.uploadProgramToClient(clientId, programId);
  return clientId;
}

/** El cliente mete el código y entra. */
async function join(c, code) {
  await c.s.validateClientCode(code);
  await c.s.linkToTrainer(code);
}

const slots = () => server.slots();
const apple = (sub) => ({ provider: 'apple', idToken: `apple:${sub}` });
/** Falla la n-ésima llamada (1 = la próxima) que case con `key`. */
function failNth(key, n) {
  const orig = server._shouldFail.bind(server);
  let seen = 0;
  server._shouldFail = (k, dev) => {
    if (k === key && ++seen === n) { server._shouldFail = orig; return true; }
    return orig(k, dev);
  };
}
/** Lo apuntado a un cliente: una sesión suya, sin cliente conectado. */
const addLog = (t, clientId, id = 'apuntado-1') => t.store.setState((s) => ({
  clientLogs: { ...s.clientLogs, [clientId]: [...(s.clientLogs[clientId] ?? []), { id, sessionTemplateId: 'x', timestamp: Date.now(), date: '2026-10-29', exercises: [] }] },
}));
const historyIds = (slot) => (slot.history_json?.entries ?? []).map((e) => e.id);
const linkNow = (t, id) => linkOf(t.s.clients[id], t.s.trainerSync.userId);
/** Un móvil de antes de C10 cancelaba la invitación BORRANDO el hueco (`kind = 'cancelled'`). */
const oldCancel = async (t, clientId) => {
  const { error } = await createSimClient(t.device, { storageKey: 'sb-trainer' })
    .rpc('trainer_delete_slot', { p_slot_id: t.s.clients[clientId].slotId, p_kind: 'cancelled' });
  expect(error).toBeNull();
};
const slotOf = async (slotId) => (await slots()).find((r) => r.id === slotId);
const idsOf = (p) => Object.keys(p.s.clients).sort();
const setLocalId = (slotId, localId) => server.admin('update public.trainer_clients set local_id = $2 where id = $1', [slotId, localId]);

/** Entrenador con un cliente invitado (Ana), uno conectado (Berta) y su cuenta por código. */
async function trainerWithClients() {
  const t = await phone('entrenador');
  const c = await phone('cliente');
  await t.s.createTrainerCodeAccount();
  const ana = await newClient(t, 'Ana');
  const berta = await newClient(t, 'Berta');
  await join(c, t.s.clients[berta].code);
  await t.s.refreshTrainerSlots();
  return { t, c, ana, berta, code: t.s.trainerSync.code };
}

// ═════════════════════════════════════════════════════════════════════════════

describe('C10-03 · recuperar la cuenta usa el id de la ficha', () => {
  it('en un móvil nuevo, cada ficha (invitada y conectada) tiene el mismo id que en el viejo', async () => {
    const { t, ana, berta, code } = await trainerWithClients();
    const n = await phone('nuevo');
    await n.s.recoverTrainerAccount(code);

    expect(idsOf(n)).toEqual(idsOf(t));
    expect(n.s.clients[ana]).toMatchObject({ name: 'Ana', seated: false });
    expect(n.s.clients[berta]).toMatchObject({ name: 'Berta', seated: true });
    expect(n.s.programs[n.s.clients[ana].activeProgramId]?.name).toBe('Fuerza Ana');
    Object.values(n.s.clients).forEach(assertFacts);
  });

  it('un hueco sin local_id (datos viejos) estrena id, y el primer refresco lo fija en el servidor', async () => {
    const { t, ana, code } = await trainerWithClients();
    await setLocalId(t.s.clients[ana].slotId, null);
    const n = await phone('nuevo');
    await n.s.recoverTrainerAccount(code);

    const fresh = Object.values(n.s.clients).find((c) => c.name === 'Ana');
    expect(fresh.id).not.toBe(ana);
    expect((await slotOf(fresh.slotId)).local_id).toBe(fresh.id);
  });

  for (const [caso, serverId] of [['null (el hueco lo perdió en un traspaso)', null], ['otro (la ficha se recuperó con un id nuevo)', 'id-de-la-version-vieja']]) {
    it(`ficha cuyo hueco tiene local_id ${caso}: gana el id de la ficha, y un tercer móvil lo recupera`, async () => {
      const { t, ana, code } = await trainerWithClients();
      const n = await phone('segundo');
      await n.s.recoverTrainerAccount(code);
      const slotId = n.s.clients[ana].slotId;

      // Como lo deja la versión de antes: el hueco no cuadra con la ficha.
      await setLocalId(slotId, serverId);
      await n.s.refreshTrainerSlots();
      expect((await slotOf(slotId)).local_id).toBe(ana);

      const third = await phone('tercero');
      await third.s.recoverTrainerAccount(code);
      expect(idsOf(third)).toEqual(idsOf(t));
    });
  }

  it('estado de la versión de antes: una ficha con id propio y su hueco sin id → el hueco toma el de la ficha', async () => {
    const { t, ana, code } = await trainerWithClients();
    const slotId = t.s.clients[ana].slotId;
    await setLocalId(slotId, null);
    const n = await phone('segundo');
    await n.s.recoverTrainerAccount(code);     // la recupera con un id nuevo (el hueco no tenía)
    const viejo = Object.values(n.s.clients).find((c) => c.slotId === slotId).id;
    expect(viejo).not.toBe(ana);

    await n.s.refreshTrainerSlots();           // ya fijado: nada que hacer
    const third = await phone('tercero');
    await third.s.recoverTrainerAccount(code);
    expect(third.s.clients[viejo]).toBeTruthy();
    expect(Object.values(third.s.clients).filter((c) => c.slotId === slotId)).toHaveLength(1);
  });

  it('pasar de código a Google y recuperar en otro móvil: mismos ids', async () => {
    const t = await phone('entrenador');
    await t.s.createTrainerCodeAccount();
    const ana = await newClient(t, 'Ana');
    const berta = await newClient(t, 'Berta');
    await t.s.enterTrainerAccount({ ...google('g1'), upgrade: true });
    expect(idsOf(t)).toEqual([ana, berta].sort());

    const n = await phone('nuevo');
    await n.s.enterTrainerAccount({ ...google('g1'), mustExist: true });
    expect(idsOf(n)).toEqual([ana, berta].sort());
  });

  it('E78: recuperar la cuenta y restaurar la copia de Drive del móvil viejo no duplica a ningún cliente con app', async () => {
    const { t, ana, berta, code } = await trainerWithClients();
    const backup = JSON.parse(buildBackupJson(t.s));
    const n = await phone('movil-nuevo');
    await n.s.recoverTrainerAccount(code);
    n.s.importData(backup, { program: true, log: true, templates: true, customExercises: true, clients: true }, { silent: true });

    expect(idsOf(n)).toEqual([ana, berta].sort());
    for (const slot of await slots()) {
      expect(Object.values(n.s.clients).filter((c) => c.slotId === slot.id)).toHaveLength(1);
    }
  });

  it('DUPLICATE_CLIENT al fijar: el refresco no se rompe y la ficha se queda como estaba', async () => {
    const t = await phone('entrenador');
    await t.s.createTrainerCodeAccount();
    const x = await newClient(t, 'X');
    const z = await newClient(t, 'Z');
    const slotX = t.s.clients[x].slotId;
    const slotZ = t.s.clients[z].slotId;
    // Datos de antes de E35: la ficha Z apunta al hueco de X (y no conoce el suyo).
    t.store.setState((s) => {
      const rest = { ...s.clients, [z]: { ...s.clients[z], slotId: slotX } };
      delete rest[x];
      return { clients: rest };
    });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(t.s.refreshTrainerSlots()).resolves.not.toThrow();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('DUPLICATE_CLIENT'), expect.any(String));
    warn.mockRestore();
    expect(idsOf(t)).toEqual([z]);                          // sin ficha de más para el hueco de Z
    expect(t.s.clients[z].slotId).toBe(slotX);
    expect((await slotOf(slotX)).local_id).toBe(x);
    expect((await slotOf(slotZ)).local_id).toBe(z);
  });

  it('un fallo de red al fijar no rompe el refresco, y el siguiente lo fija', async () => {
    const { t, ana, code } = await trainerWithClients();
    const slotId = t.s.clients[ana].slotId;
    const n = await phone('segundo');
    await n.s.recoverTrainerAccount(code);
    await setLocalId(slotId, null);
    server.failOnce('rpc:trainer_set_local_id');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(n.s.refreshTrainerSlots()).resolves.not.toThrow();
    warn.mockRestore();
    expect((await slotOf(slotId)).local_id).toBeNull();

    await n.s.refreshTrainerSlots();
    expect((await slotOf(slotId)).local_id).toBe(ana);
  });

  describe('N-08: la ficha que el hueco nombra se queda con él, sin crear una segunda', () => {
    const noSlot = (id) => ({
      id, name: 'Ana', createdAt: '2026-10-01', activeProgramId: null, fullName: '', phone: '', email: '', notes: '',
      bodyWeight: [], billing: [], status: 'active', color: '#fff', ...NO_SLOT,
    });

    for (const [caso, facts] of [
      ['local (sin hueco)', {}],
      ['de otra cuenta', { slotId: 'hueco-ajeno', slotOwner: 'otro-usuario', code: 'ABC123' }],
    ]) {
      it(`ficha ${caso}`, async () => {
        const { t, ana, code } = await trainerWithClients();
        const slotId = t.s.clients[ana].slotId;
        const n = await phone('nuevo');
        n.store.setState({ clients: { [ana]: { ...noSlot(ana), ...facts } } });
        expect(linkOf(n.s.clients[ana], 'x')).toBe(facts.slotId ? 'otherAccount' : 'local');

        await n.s.recoverTrainerAccount(code);
        expect(idsOf(n)).toEqual(idsOf(t));
        expect(Object.values(n.s.clients).filter((c) => c.slotId === slotId)).toEqual([expect.objectContaining({ id: ana, name: 'Ana' })]);
        expect(linkOf(n.s.clients[ana], n.s.trainerSync.userId)).toBe('invited');
        Object.values(n.s.clients).forEach(assertFacts);
      });
    }
  });
});


// ═════════════════════════════════════════════════════════════════════════════

describe('C10-04 · subir los clientes a la cuenta (§5)', () => {
  it('sin cuenta con 3 clientes (uno con historial apuntado), crear la cuenta los deja `none`, sin código, y lo apuntado en su hueco', async () => {
    const t = await phone('entrenador');
    const ana = await t.s.createClient('Ana');
    const berta = await t.s.createClient('Berta');
    const carla = await t.s.createClient('Carla');
    addLog(t, berta);
    expect([ana, berta, carla].map((id) => linkNow(t, id))).toEqual(['local', 'local', 'local']);

    const progress = [];
    t.store.subscribe((st) => { const u = st.ui.uploadingClients; if (u && progress.at(-1)?.done !== u.done) progress.push({ ...u }); });
    await t.s.createTrainerCodeAccount();

    expect([ana, berta, carla].map((id) => linkNow(t, id))).toEqual(['none', 'none', 'none']);
    Object.values(t.s.clients).forEach(assertFacts);
    const rows = await slots();
    expect(rows.map((r) => r.local_id).sort()).toEqual([ana, berta, carla].sort());
    expect(rows.every((r) => r.client_code === null)).toBe(true);
    expect(historyIds(await slotOf(t.s.clients[berta].slotId))).toEqual(['apuntado-1']);
    expect(historyIds(await slotOf(t.s.clients[ana].slotId))).toEqual([]);
    expect(progress).toEqual([{ done: 0, total: 3 }, { done: 1, total: 3 }, { done: 2, total: 3 }, { done: 3, total: 3 }]);
    expect(t.s.ui.uploadingClients).toBeNull();
    expect(t.s.localClientCount()).toBe(0);
  });

  it('un corte de red a mitad: los subidos quedan, los otros `local`; al volver la red el refresco termina sin duplicar (R-C7)', async () => {
    const t = await phone('entrenador');
    await t.s.createTrainerCodeAccount();
    const ids = [await t.s.createClient('Ana'), await t.s.createClient('Berta'), await t.s.createClient('Carla')];
    expect(t.s.localClientCount()).toBe(3);

    failNth('rpc:trainer_create_slot', 2);
    expect(await t.s.uploadLocalClients()).toEqual({ uploaded: 1, left: 2 });
    expect(ids.map((id) => linkNow(t, id))).toEqual(['none', 'local', 'local']);
    expect(t.s.localClientCount()).toBe(2);
    expect(t.s.ui.uploadingClients).toBeNull();

    await t.s.refreshTrainerSlots();
    expect(ids.map((id) => linkNow(t, id))).toEqual(['none', 'none', 'none']);
    const rows = await slots();
    expect(rows).toHaveLength(3);
    expect(new Set(rows.map((r) => r.local_id)).size).toBe(3);
    expect(Object.keys(t.s.clients)).toHaveLength(3);
  });

  it('una subida repetida (o dos a la vez) no duplica nada: el hueco es el mismo por `local_id`', async () => {
    const t = await phone('entrenador');
    await t.s.createTrainerCodeAccount();
    const ana = await t.s.createClient('Ana');
    addLog(t, ana);
    const [a, b] = await Promise.all([t.s.uploadLocalClients(), t.s.uploadLocalClients()]);
    expect(b).toBe(a);                                         // la segunda recibe el recorrido en vuelo
    await t.s.uploadLocalClients();
    expect(await slots()).toHaveLength(1);
    expect(historyIds(await slotOf(t.s.clients[ana].slotId))).toEqual(['apuntado-1']);
  });

  it('un fallo que no es de red salta esa ficha y sigue con las demás; se reintenta en el siguiente recorrido', async () => {
    const t = await phone('entrenador');
    await t.s.createTrainerCodeAccount();
    const ids = [await t.s.createClient('Ana'), await t.s.createClient('Berta')];
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const real = t.s._uploadClient;
    let first = true;
    t.store.setState({ _uploadClient: async (id, opts) => {                // un error del servidor, no un corte de red
      if (first) { first = false; throw Object.assign(new Error('boom'), { code: 'NOT_A_TRAINER' }); }
      return real(id, opts);
    } });

    expect(await t.s.uploadLocalClients()).toEqual({ uploaded: 1, left: 1 });
    expect(ids.map((id) => linkNow(t, id))).toEqual(['local', 'none']);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('no subido (NOT_A_TRAINER)'), 'boom');

    t.store.setState({ _uploadClient: real });
    expect(await t.s.uploadLocalClients()).toEqual({ uploaded: 1, left: 0 });
    warn.mockRestore();
  });

  it('crear un cliente con cuenta y sin red queda `local`; con red y refresco, `none`', async () => {
    const t = await phone('entrenador');
    await t.s.createTrainerCodeAccount();
    t.device.offline = true;
    const ana = await t.s.createClient('Ana');
    const beto = await t.s.createClient('Beto', { withApp: true });     // invitar también necesita red
    expect(linkNow(t, ana)).toBe('local');
    expect(linkNow(t, beto)).toBe('local');
    expect(t.s.ui.linking).toEqual({});
    expect(t.s.localClientCount()).toBe(2);
    expect(await slots()).toEqual([]);

    t.device.offline = false;
    await t.s.refreshTrainerSlots();
    expect(linkNow(t, ana)).toBe('none');
    expect(linkNow(t, beto)).toBe('none');
    expect(t.s.localClientCount()).toBe(0);
  });

  it('con red, crear un cliente con app lo deja invitado en la misma llamada (hueco sin código, luego código)', async () => {
    const t = await phone('entrenador');
    await t.s.createTrainerCodeAccount();
    const id = await t.s.createClient('Ana', { withApp: true });
    expect(linkNow(t, id)).toBe('invited');
    expect(await slotOf(t.s.clients[id].slotId)).toMatchObject({ local_id: id, client_code: t.s.clients[id].code });
    expect(t.s.ui.linking).toEqual({});
    assertFacts(t.s.clients[id]);
  });
});

describe('C10-04 · invitar y cancelar (§3.3)', () => {
  it('invitar a uno `none` con historial apuntado: el cliente canjea y lo ve (R-C6), y el plan gratis cuenta 1 con app', async () => {
    const t = await phone('entrenador');
    const c = await phone('cliente');
    await t.s.createTrainerCodeAccount();
    const ana = await t.s.createClient('Ana');
    addLog(t, ana);
    await t.s.refreshTrainerSlots();
    expect(linkNow(t, ana)).toBe('none');
    const pid = t.s.createProgramForClient(ana, 2, 'Fuerza', null, { openEditor: false });
    t.s.setClientActiveProgram(ana, pid);
    addLog(t, ana, 'apuntado-2');                                       // apuntado DESPUÉS de subir la ficha: también llega

    expect(await t.s.connectClientToCloud(ana)).toBe(true);
    expect(linkNow(t, ana)).toBe('invited');
    const code = t.s.clients[ana].code;
    expect(code).toBeTruthy();
    expect(t.s.clients[ana].programDirty).toBe(false);                   // el programa de entrada ya salió (N-06)

    await c.s.validateClientCode(code);
    await c.s.linkToTrainer(code, { mergeHistory: true });
    expect(c.s.workoutLog.map((e) => e.id).sort()).toEqual(['apuntado-1', 'apuntado-2']);
    expect(c.s.programs[c.s.clientSync.trainerProgramIds[0]].name).toBe('Fuerza');

    const plan = Object.values(forPlan(t.s.clients, t.s.trainerSync.userId, t.s.ui.linking));
    expect(plan.filter((x) => x.code)).toHaveLength(1);
  });

  it('invitar a uno `local` lo sube (solo esa ficha), le da código y le envía el programa', async () => {
    const t = await phone('entrenador');
    await t.s.createTrainerCodeAccount();
    const ana = await t.s.createClient('Ana');
    const berta = await t.s.createClient('Berta');
    const pid = t.s.createProgramForClient(ana, 2, 'Fuerza', null, { openEditor: false });
    t.s.setClientActiveProgram(ana, pid);

    expect(await t.s.moveClientToApp(ana)).toBe(true);
    expect(linkNow(t, ana)).toBe('invited');
    expect(linkNow(t, berta)).toBe('local');                              // la otra, sin tocar
    expect((await slotOf(t.s.clients[ana].slotId)).program_json?.program?.name).toBe('Fuerza');
    await expect(t.s.connectClientToCloud(ana)).rejects.toThrow('ya está conectado');
  });

  it('cancelar la invitación: vuelve `none`, el código viejo ya no entra, y lo apuntado sigue en el hueco', async () => {
    const t = await phone('entrenador');
    const c = await phone('cliente');
    await t.s.createTrainerCodeAccount();
    const ana = await t.s.createClient('Ana');
    addLog(t, ana);
    const pid = t.s.createProgramForClient(ana, 2, 'Fuerza', null, { openEditor: false });
    t.s.setClientActiveProgram(ana, pid);
    await t.s.connectClientToCloud(ana);
    const { slotId, code } = t.s.clients[ana];

    await t.s.cancelClientInvitation(ana);

    expect(linkNow(t, ana)).toBe('none');
    expect(t.s.clients[ana]).toMatchObject({ slotId, code: null, seated: false, programDirty: false });
    assertFacts(t.s.clients[ana]);
    const row = await slotOf(slotId);
    expect(row).toMatchObject({ client_code: null, program_json: null });  // el hueco se queda; lo enviado se va
    expect(historyIds(row)).toEqual(['apuntado-1']);
    await expect(c.s.validateClientCode(code)).rejects.toMatchObject({ code: 'CODE_NOT_FOUND' });
    expect(t.s.trainerSync.deletedSlotIds ?? []).toEqual([]);              // y no se borró nada
  });

  it('cancelar con el cliente ya dentro: no cambia nada y el refresco lo deja `linked`', async () => {
    const { t, c, ana } = await trainerWithClients();
    await join(c, t.s.clients[ana].code);                                  // lo canjea otro móvil y el entrenador aún no lo sabe
    expect(linkNow(t, ana)).toBe('invited');

    await t.s.cancelClientInvitation(ana);

    expect(linkNow(t, ana)).toBe('linked');
    expect((await slotOf(t.s.clients[ana].slotId)).client_code).toBe(t.s.clients[ana].code);
  });

  it('el límite del plan gratis cuenta por código: 3 `none` no ocupan la plaza con app, invitar a uno sí y a un segundo, hoja de límite (R-E1)', async () => {
    const t = await phone('entrenador');
    t.store.setState((st) => ({ profile: { ...st.profile, isPro: false } }));
    await t.s.createTrainerCodeAccount();
    const [a, b, c3] = [await t.s.createClient('A'), await t.s.createClient('B'), await t.s.createClient('C')];
    await t.s.refreshTrainerSlots();
    expect([a, b, c3].map((id) => linkNow(t, id))).toEqual(['none', 'none', 'none']);
    const plan = () => Object.values(forPlan(t.s.clients, t.s.trainerSync.userId, t.s.ui.linking));
    expect(clientLimitReason(plan())).toBeNull();
    expect(t.s.isClientFrozen(a)).toBe(false);

    expect(await t.s.connectClientToCloud(a)).toBe(true);
    expect(clientLimitReason(plan())).toBeNull();                          // 1 con app: cabe
    expect(await t.s.connectClientToCloud(b)).toBe(false);
    expect(t.s.ui.limitReason).toBe('connected');
    expect(linkNow(t, b)).toBe('none');
    expect(await t.s.createClient('D')).toBe(null);                        // y crear sigue contando a todos
  });

  it('un móvil con la versión de antes cancela la invitación (borra el hueco): el de ahora la ve `local` y la vuelve a subir', async () => {
    const t1 = await phone('t1');
    await t1.s.createTrainerCodeAccount();
    const code = t1.s.trainerSync.code;
    const ana = await newClient(t1, 'Ana');
    const t2 = await phone('t2');
    await t2.s.recoverTrainerAccount(code);
    const slotId = t2.s.clients[ana].slotId;
    expect(linkNow(t2, ana)).toBe('invited');

    await oldCancel(t1, ana);
    await t2.s.refreshTrainerSlots();
    expect(linkNow(t2, ana)).toBe('local');
    expect(t2.s.clients[ana]).toMatchObject({ slotId: null, code: null });
    expect(t2.s.trainerSync.deletedSlotIds).toEqual([]);

    expect(await t2.s.uploadLocalClients()).toEqual({ uploaded: 1, left: 0 });
    expect(linkNow(t2, ana)).toBe('none');
    expect(t2.s.clients[ana].slotId).not.toBe(slotId);
    expect((await slotOf(t2.s.clients[ana].slotId)).local_id).toBe(ana);
    expect(await slots()).toHaveLength(1);
  });

  it('un hueco sin código se lee `none` al refrescar (otro móvil del mismo entrenador)', async () => {
    const t1 = await phone('t1');
    await t1.s.createTrainerCodeAccount();
    const ana = await t1.s.createClient('Ana');
    await t1.s.refreshTrainerSlots();
    const t2 = await phone('t2');
    await t2.s.recoverTrainerAccount(t1.s.trainerSync.code);
    expect(linkNow(t2, ana)).toBe('none');
    assertFacts(t2.s.clients[ana]);
  });
});

describe('C10-04 · salir y entrar en otra cuenta no traspasa; mejorar sí (§3.2)', () => {
  it('salir y entrar en otra cuenta: los `none` también pasan a `otherAccount`, nada se traspasa y no se pueden invitar', async () => {
    const t = await phone('entrenador');
    await t.s.createTrainerCodeAccount();
    const invitada = await newClient(t, 'Ana');
    const sinApp = await t.s.createClient('Berta');
    await t.s.refreshTrainerSlots();
    const antes = await slots();
    const vieja = t.s.trainerSync.userId;
    expect(linkNow(t, sinApp)).toBe('none');

    await t.s.leaveTrainerAccount();
    expect([invitada, sinApp].map((id) => linkNow(t, id))).toEqual(['otherAccount', 'otherAccount']);
    const suelta = await t.s.createClient('Carla');                         // sin cuenta: `local`
    await t.s.createTrainerCodeAccount();

    expect(t.s.trainerSync.userId).not.toBe(vieja);
    expect([invitada, sinApp].map((id) => linkNow(t, id))).toEqual(['otherAccount', 'otherAccount']);
    expect(linkNow(t, suelta)).toBe('none');                               // la que no tenía hueco sube a la nueva
    expect((await slots()).filter((r) => r.trainer_id === vieja)).toEqual(antes);   // nada se movió
    await expect(t.s.connectClientToCloud(sinApp)).rejects.toMatchObject({ code: 'OTHER_ACCOUNT' });
    await expect(t.s.connectClientToCloud(invitada)).rejects.toMatchObject({ code: 'OTHER_ACCOUNT' });
    expect((await slots()).filter((r) => r.trainer_id === vieja)).toEqual(antes);
    Object.values(t.s.clients).forEach(assertFacts);
  });

  it('mejorar de código a Google (cuenta nueva): los clientes van con ella, con los mismos ids', async () => {
    const { t, ana, berta } = await trainerWithClients();
    const sinApp = await t.s.createClient('Carla');
    await t.s.refreshTrainerSlots();
    const vieja = t.s.trainerSync.userId;

    await t.s.enterTrainerAccount({ ...google('g1'), upgrade: true });

    const nueva = t.s.trainerSync.userId;
    expect(nueva).not.toBe(vieja);
    expect(idsOf(t)).toEqual([ana, berta, sinApp].sort());
    expect([ana, berta, sinApp].map((id) => linkNow(t, id))).toEqual(['invited', 'linked', 'none']);
    for (const slot of await slots()) expect(slot.trainer_id).toBe(nueva);
    Object.values(t.s.clients).forEach(assertFacts);
  });

  it('mejorar a una cuenta de Google que ya existe y tiene un hueco: UPGRADE_TARGET_HAS_CLIENTS, nada se mueve y sigue en la de código', async () => {
    const { t, ana, berta } = await trainerWithClients();
    const g = await phone('google');
    await g.s.enterTrainerAccount(google('g1'));
    const ajeno = await g.s.createClient('Ajeno');
    await g.s.refreshTrainerSlots();
    const antes = await slots();
    const sync = { ...t.s.trainerSync };

    await expect(t.s.enterTrainerAccount({ ...google('g1'), upgrade: true }))
      .rejects.toMatchObject({ code: 'UPGRADE_TARGET_HAS_CLIENTS', message: expect.stringContaining('Google') });

    expect(t.s.trainerSync).toEqual(sync);
    expect(await slots()).toEqual(antes);
    expect([ana, berta].map((id) => linkNow(t, id))).toEqual(['invited', 'linked']);
    expect(idsOf(g)).toEqual([ajeno]);
    // La salida que dice el mensaje: salir y entrar en ella; sus clientes se quedan en la suya.
    await t.s.leaveTrainerAccount();
    await t.s.enterTrainerAccount({ ...google('g1'), mustExist: true });
    expect([ana, berta].map((id) => linkNow(t, id))).toEqual(['otherAccount', 'otherAccount']);
    expect(Object.values(t.s.clients).find((x) => x.name === 'Ajeno')).toBeTruthy();
  });

  it('mejorar a una cuenta de Google que existe pero está vacía: se mejora', async () => {
    const { t, ana, berta } = await trainerWithClients();
    const g = await phone('google');
    await g.s.enterTrainerAccount(google('g1'));                             // existe, sin clientes
    const vieja = t.s.trainerSync.userId;

    await t.s.enterTrainerAccount({ ...google('g1'), upgrade: true });

    expect(t.s.trainerSync).toMatchObject({ mode: 'google', userId: g.s.trainerSync.userId });
    expect(t.s.trainerSync.userId).not.toBe(vieja);
    expect([ana, berta].map((id) => linkNow(t, id))).toEqual(['invited', 'linked']);
    for (const slot of await slots()) expect(slot.trainer_id).toBe(g.s.trainerSync.userId);
  });

  it('mejorar de Google a Apple: los clientes van con ella', async () => {
    const t = await phone('entrenador');
    await t.s.enterTrainerAccount(google('g1'));
    const ana = await newClient(t, 'Ana');
    const sinApp = await t.s.createClient('Berta');
    await t.s.refreshTrainerSlots();
    const vieja = t.s.trainerSync.userId;

    await t.s.enterTrainerAccount({ ...apple('a1'), upgrade: true });

    expect(t.s.trainerSync).toMatchObject({ mode: 'apple' });
    expect(t.s.trainerSync.userId).not.toBe(vieja);
    expect([ana, sinApp].map((id) => linkNow(t, id))).toEqual(['invited', 'none']);
    for (const slot of await slots()) expect(slot.trainer_id).toBe(t.s.trainerSync.userId);
  });

  it('sin `upgrade`, entrar en Google desde una cuenta de código no traspasa: los clientes se quedan en la de código', async () => {
    const { t, ana, berta } = await trainerWithClients();
    const vieja = t.s.trainerSync.userId;
    await t.s.enterTrainerAccount(google('g1'));
    expect([ana, berta].map((id) => linkNow(t, id))).toEqual(['otherAccount', 'otherAccount']);
    for (const slot of await slots()) expect(slot.trainer_id).toBe(vieja);
  });
});
