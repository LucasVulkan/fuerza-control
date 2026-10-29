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
 *
 * C10-05: la ficha, los programas y lo apuntado se guardan en la cuenta (continuo, por firma) y se
 * recuperan con ella en un móvil nuevo; el cliente no lee lo privado y guardar no es enviar (N-06).
 *
 * C10-06: restaurar una copia trae contenido, nunca estado; con cuenta solo añade lo que la cuenta no conoció.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { linkOf, assertFacts, NO_SLOT } from '../src/utils/clientLink';
import { buildBackupPayload } from '../src/utils/backupPayload';
import { programTemplateIds } from '../src/utils/clientLogs';
import { buildBackupJson } from '../src/utils/backupPayload';
import { forPlan, clientLimitReason } from '../src/utils/freePlan';
import { buildClientCard, buildClientPrograms, saveSig } from '../src/utils/clientSave';
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
  t.s.setClientActiveProgram(clientId, programId);   // crear no asigna: lo hace el entrenador (la ficha guardada lo recuerda, C10-05)
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
/**
 * Crea clientes con la cuenta puesta pero sin red: `createClient` lanza una subida en silencio (§5) y estos
 * tests quieren decidir ellos cuándo vuelve la red. Al volver, siguen `local`.
 */
async function createOffline(t, ...names) {
  t.device.offline = true;
  const ids = [];
  for (const n of names) ids.push(await t.s.createClient(n));
  await t.s.uploadLocalClients();          // si la de `createClient` sigue en vuelo, devuelve la misma
  t.device.offline = false;
  return ids;
}
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
    await n.s.restoreBackup(backup, { program: true, log: true, templates: true, customExercises: true, clients: true });   // la cuenta ya los conoce: no entra ninguno (C10-06)

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
    const ids = await createOffline(t, 'Ana', 'Berta', 'Carla');
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
    const ids = await createOffline(t, 'Ana', 'Berta');
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

  it('crear un cliente con cuenta y con red lo sube solo, sin esperar a ningún refresco: acaba `none` (§5)', async () => {
    const t = await phone('entrenador');
    await t.s.createTrainerCodeAccount();
    const ana = await t.s.createClient('Ana');
    await vi.waitFor(() => expect(linkNow(t, ana)).toBe('none'));
    expect(await slots()).toHaveLength(1);
    expect(t.s.localClientCount()).toBe(0);
    assertFacts(t.s.clients[ana]);
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
    const [a, b, c3] = await createOffline(t, 'A', 'B', 'C');
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


// ═════════════════════════════════════════════════════════════════════════════

describe('C10-05 · guardar en la cuenta y recuperar con la ficha', () => {
  const privates = () => server.admin('select * from public.trainer_client_private order by saved_at');
  const privateOf = async (slotId) => (await privates()).find((r) => r.slot_id === slotId);
  const saveCalls = (name) => server.calls.filter((c) => c.device === name && c.key === 'rpc:trainer_save_client').length;
  const timers = () => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  /** Cambia una nota y deja pasar el rato que espera el guardado. */
  const noteAndWait = async (t, id, notes) => {
    t.s.updateClientInfo(id, { notes });
    await vi.advanceTimersByTimeAsync(5000);
    await t.s.saveClients();   // si el temporizador ya lo lanzó, es el mismo recorrido
  };

  /** Espera (con los temporizadores falsos) a que algo asíncrono del servidor simulado acabe. */
  const settle = async (cond) => { for (let i = 0; i < 500 && !cond(); i++) await new Promise((r) => globalThis.setImmediate(r)); expect(cond()).toBe(true); };

  /** Un cliente sin app con ficha completa y un programa de dos etapas. */
  async function fullSinApp(t, name, tagId) {
    const id = await t.s.createClient(name);
    t.s.updateClientInfo(id, {
      notes: `Notas de ${name}`, phone: '600123123', email: `${name.toLowerCase()}@x.es`,
      billing: [{ id: `b_${name}`, date: '2026-10-01', amount: 40, paid: true }],
      bodyWeight: [{ date: '2026-10-01', kg: 71.5 }], tags: [tagId],
    });
    const pid = t.s.createProgramForClient(id, 2, `Programa ${name}`, null, { openEditor: false });
    t.s.addStageToProgram(pid);
    t.s.setClientActiveProgram(id, pid);
    addLog(t, id, `log-${name}-1`);
    addLog(t, id, `log-${name}-2`);
    return id;
  }

  it('el escenario de N-17: cinco clientes en un móvil nuevo, con el mismo id, ficha, programas e historial', async () => {
    const t = await phone('viejo');
    const c = await phone('cliente');
    await t.s.createTrainerCodeAccount();
    const tag = t.s.createTag('Rehabilitación');
    const sara = await fullSinApp(t, 'Sara', tag);
    const tomas = await fullSinApp(t, 'Tomás', tag);
    const ana = await newClient(t, 'Ana');                                   // invitada
    const berta = await newClient(t, 'Berta');                               // conectada, con historial
    await join(c, t.s.clients[berta].code);
    const programId = c.s.clientSync.trainerProgramIds[0];
    const sessionTemplateId = c.s.programs[programId].stages[0].days[0].sessionTemplateId;
    c.store.setState((s) => ({ workoutLog: [...s.workoutLog, { id: 'berta-1', programId, sessionTemplateId, timestamp: Date.now(), date: '2026-10-28', exercises: [] }] }));
    await c.s.uploadHistoryToTrainer();
    const dani = await t.s.createClient('Dani');                             // con un programa archivado
    const viejo = t.s.createProgramForClient(dani, 1, 'Viejo', null, { openEditor: false });
    t.s.setClientActiveProgram(dani, viejo);
    const nuevo = t.s.createProgramForClient(dani, 2, 'Nuevo', null, { openEditor: false });
    t.s.setClientActiveProgram(dani, nuevo);
    t.s.updateClientInfo(dani, { notes: 'lesión de hombro' });
    t.store.setState((s) => ({ programs: { ...s.programs, [viejo]: { ...s.programs[viejo], status: 'archived' } } }));
    await t.s.refreshTrainerSlots();
    await t.s.downloadClientHistory(berta);
    await t.s.saveClients();
    const ids = [sara, tomas, ana, berta, dani];
    expect(t.s.pendingSaveCount()).toBe(0);
    expect(await privates()).toHaveLength(5);
    // Lo apuntado de los sin app está en su hueco (R-C6).
    expect(historyIds(await slotOf(t.s.clients[sara].slotId)).sort()).toEqual(['log-Sara-1', 'log-Sara-2']);

    const n = await phone('nuevo');
    await n.s.recoverTrainerAccount(t.s.trainerSync.code);

    expect(idsOf(n)).toEqual([...ids].sort());
    for (const id of ids) {
      expect(buildClientCard(n.s, id)).toEqual(buildClientCard(t.s, id));
      expect(buildClientPrograms(n.s, id)).toEqual(buildClientPrograms(t.s, id));
      expect((n.s.clientLogs[id] ?? []).map((e) => e.id).sort()).toEqual((t.s.clientLogs[id] ?? []).map((e) => e.id).sort());
      expect(n.s.clients[id].savedSig).toBe(saveSig(n.s, id));
      expect(n.s.clients[id].programMissing).toBeUndefined();
    }
    expect(buildClientCard(n.s, sara).tags).toEqual([{ id: tag, name: 'Rehabilitación' }]);
    expect(n.s.tagRegistry).toEqual([{ id: tag, name: 'Rehabilitación' }]);
    expect(Object.keys(buildClientPrograms(n.s, dani).programs)).toHaveLength(2);
    expect(n.s.programs[viejo].status).toBe('archived');
    expect(n.s.programs[n.s.clients[sara].activeProgramId].stages).toHaveLength(2);
    expect(n.s.clientLogs[berta].map((e) => e.id)).toEqual(['berta-1']);
    Object.values(n.s.clients).forEach(assertFacts);
    // Recuperar no vuelve a subir nada (la firma coincide).
    expect(n.s.pendingSaveCount()).toBe(0);
    await n.s.saveClients();
    expect(saveCalls('nuevo')).toBe(0);
  });

  it('el cliente conectado no lee notas ni cobros, y su programa en el hueco no cambia porque el entrenador edite y se guarde: solo al enviar (N-06)', async () => {
    const { t, c, berta } = await trainerWithClients();
    t.s.updateClientInfo(berta, { notes: 'secreto', billing: [{ id: 'b1', amount: 50 }] });
    const programId = t.s.clients[berta].activeProgramId;
    await t.s.saveClients();
    const slotId = t.s.clients[berta].slotId;
    expect((await privateOf(slotId)).card_json.notes).toBe('secreto');

    const asClient = createSimClient(c.device, { storageKey: 'sb-client' });
    expect((await asClient.from('trainer_client_private').select('*')).data).toEqual([]);
    expect((await asClient.from('trainer_client_private').select('*').eq('slot_id', slotId)).data).toEqual([]);

    const sent = await slotOf(slotId);
    t.store.setState((s) => ({ programs: { ...s.programs, [programId]: { ...s.programs[programId], name: 'Editado sin enviar' } } }));
    t.s.updateClientInfo(berta, { notes: 'secreto 2' });
    await t.s.saveClients();
    const after = await slotOf(slotId);
    expect((await privateOf(slotId)).programs_json.programs[programId].name).toBe('Editado sin enviar');
    expect(after.program_json).toEqual(sent.program_json);
    expect(after.overrides_json).toEqual(sent.overrides_json);
    expect(after.program_updated_at).toEqual(sent.program_updated_at);

    await t.s.uploadProgramToClient(berta, programId);
    expect((await slotOf(slotId)).program_json.program.name).toBe('Editado sin enviar');
  });

  it('cambiar una nota y esperar: la fila privada la tiene; cambiarla mientras viaja deja la firma distinta y se vuelve a guardar (E55)', async () => {
    const t = await phone('viejo');
    await t.s.createTrainerCodeAccount();
    const id = await t.s.createClient('Ana');
    await t.s.refreshTrainerSlots();
    timers();
    try {
      await noteAndWait(t, id, 'a');
      expect((await privateOf(t.s.clients[id].slotId)).card_json.notes).toBe('a');
      expect(t.s.pendingSaveCount()).toBe(0);

      // Antes del rato no hay nada nuevo en el servidor: el guardado espera a que se deje de tocar.
      t.s.updateClientInfo(id, { notes: 'b' });
      await vi.advanceTimersByTimeAsync(4000);
      expect((await privateOf(t.s.clients[id].slotId)).card_json.notes).toBe('a');
      await vi.advanceTimersByTimeAsync(1000);
      await t.s.saveClients();
      expect((await privateOf(t.s.clients[id].slotId)).card_json.notes).toBe('b');

      // Mientras viaja un guardado, el entrenador cambia la nota otra vez.
      const orig = server._shouldFail.bind(server);
      let once = true;
      server._shouldFail = (k, dev) => {
        if (k === 'rpc:trainer_save_client' && once) { once = false; t.s.updateClientInfo(id, { notes: 'd' }); }
        return orig(k, dev);
      };
      const savedB = t.s.clients[id].savedSig;
      t.s.updateClientInfo(id, { notes: 'c' });
      await vi.advanceTimersByTimeAsync(5000);
      await settle(() => t.s.clients[id].savedSig !== savedB);             // termina el guardado de 'c'
      expect((await privateOf(t.s.clients[id].slotId)).card_json.notes).toBe('c');
      expect(t.s.pendingSaveCount()).toBe(1);                              // la firma de 'c' no es la de 'd'
      expect(t.s.clients[id].savedSig).not.toBe(saveSig(t.s, id));
      await vi.advanceTimersByTimeAsync(5000);
      await settle(() => t.s.pendingSaveCount() === 0);
      expect((await privateOf(t.s.clients[id].slotId)).card_json.notes).toBe('d');
    } finally { vi.useRealTimers(); }
  });

  it('sin red, cambiar dos fichas: nada se guarda; al volver la red (y la espera de la cola), las dos', async () => {
    const t = await phone('viejo');
    await t.s.createTrainerCodeAccount();
    const a = await t.s.createClient('Ana');
    const b = await t.s.createClient('Berta');
    await t.s.refreshTrainerSlots();
    await t.s.refreshTrainerSlots();                                         // la subida de Berta empezó con la de Ana en vuelo
    expect(t.s.localClientCount()).toBe(0);
    const antes = await privates();
    timers();
    try {
      t.device.offline = true;
      t.s.updateClientInfo(a, { notes: 'nota a' });
      t.s.updateClientInfo(b, { notes: 'nota b' });
      await vi.advanceTimersByTimeAsync(5000);
      await t.s.saveClients();
      expect(await privates()).toEqual(antes);
      expect(t.s.pendingSaveCount()).toBe(2);
      expect(t.s.ui.saveFailed).toBe(true);

      t.device.offline = false;                                            // la red vuelve sin que nadie avise: manda la escala de la cola (30 s)
      await vi.advanceTimersByTimeAsync(30_000);
      await t.s.saveClients();
      expect((await privateOf(t.s.clients[a].slotId)).card_json.notes).toBe('nota a');
      expect((await privateOf(t.s.clients[b].slotId)).card_json.notes).toBe('nota b');
      expect(t.s.pendingSaveCount()).toBe(0);
      expect(t.s.ui.saveFailed).toBe(false);
    } finally { vi.useRealTimers(); }
  });

  it('salir de la cuenta con cambios sin guardar y volver: se guardan al volver (de otra cuenta no se guarda mientras tanto)', async () => {
    const t = await phone('viejo');
    await t.s.createTrainerCodeAccount();
    const id = await t.s.createClient('Ana');
    await t.s.refreshTrainerSlots();
    const slotId = t.s.clients[id].slotId;
    const code = t.s.trainerSync.code;
    timers();
    try {
      t.s.updateClientInfo(id, { notes: 'sin guardar' });
      await t.s.leaveTrainerAccount();                                     // antes de que pase la espera
      await vi.advanceTimersByTimeAsync(5000);
      await t.s.saveClients();
      expect(linkNow(t, id)).toBe('otherAccount');
      t.s.updateClientInfo(id, { notes: 'no debe entrar' });               // solo lectura (N-19)
      expect(t.s.clients[id].notes).toBe('sin guardar');
      expect((await privateOf(slotId)).card_json.notes).toBe('');
      expect(t.s.pendingSaveCount()).toBe(0);                              // de otra cuenta no cuenta

      await t.s.recoverTrainerAccount(code);
      expect(t.s.clients[id].notes).toBe('sin guardar');
      expect((await privateOf(slotId)).card_json.notes).toBe('sin guardar');
      expect(t.s.pendingSaveCount()).toBe(0);
    } finally { vi.useRealTimers(); }
  });

  it('un congelado no se guarda ni se envía (R-E2, N-12)', async () => {
    const t = await phone('viejo');
    await t.s.createTrainerCodeAccount();
    const libres = [await t.s.createClient('A'), await t.s.createClient('B'), await t.s.createClient('C')];
    const frozen = await newClient(t, 'Ana');                              // invitada y con programa enviado
    await t.s.refreshTrainerSlots();
    const slotId = t.s.clients[frozen].slotId;
    const programId = t.s.clients[frozen].activeProgramId;
    const sent = await slotOf(slotId);
    // Caduca el PRO y se quedan los otros tres: Ana queda congelada.
    t.store.setState((s) => ({ profile: { ...s.profile, isPro: false, freeClientIds: libres } }));
    expect(t.s.isClientFrozen(frozen)).toBe(true);

    t.store.setState((s) => ({ clients: { ...s.clients, [frozen]: { ...s.clients[frozen], notes: 'cambiada' } }, programs: { ...s.programs, [programId]: { ...s.programs[programId], name: 'Cambiado' } } }));
    expect(t.s.pendingSaveCount()).toBe(0);
    await t.s.saveClients();
    expect((await privateOf(slotId)).card_json.notes).toBe('');
    await expect(t.s.uploadProgramToClient(frozen, programId)).rejects.toMatchObject({ code: 'FROZEN' });
    expect((await slotOf(slotId)).program_json).toEqual(sent.program_json);
    // Los demás siguen guardándose.
    t.s.updateClientInfo(libres[0], { notes: 'libre' });
    await t.s.saveClients();
    expect((await privateOf(t.s.clients[libres[0]].slotId)).card_json.notes).toBe('libre');
  });

  it('una ficha recuperada a medias (la bajada falla) no se guarda por encima de la buena, y el siguiente refresco la completa', async () => {
    const t = await phone('viejo');
    await t.s.createTrainerCodeAccount();
    const id = await t.s.createClient('Ana');
    await t.s.refreshTrainerSlots();
    t.s.updateClientInfo(id, { notes: 'lo importante' });
    await t.s.saveClients();
    const slotId = t.s.clients[id].slotId;

    const n = await phone('nuevo');
    failNth('from:trainer_client_private', 1);
    await n.s.recoverTrainerAccount(t.s.trainerSync.code);
    expect(n.s.clients[id].programMissing).toBe(true);
    expect(n.s.pendingSaveCount()).toBe(0);
    expect((await privateOf(slotId)).card_json.notes).toBe('lo importante');

    await n.s.refreshTrainerSlots();
    expect(n.s.clients[id].programMissing).toBeUndefined();
    expect(n.s.clients[id].notes).toBe('lo importante');
    expect((await privateOf(slotId)).card_json.notes).toBe('lo importante');
  });

  it('un hueco que nunca se guardó se recupera como antes (con el programa del hueco) y el primer guardado lo sube', async () => {
    const { ana, code } = await trainerWithClients();
    await server.admin('delete from public.trainer_client_private');          // como un hueco de antes de C10-05
    const n = await phone('nuevo');
    await n.s.recoverTrainerAccount(code);
    expect(n.s.programs[n.s.clients[ana].activeProgramId]?.name).toBe('Fuerza Ana');
    expect(n.s.clients[ana].programMissing).toBeUndefined();
    expect(await privates()).toHaveLength(2);                                // el refresco, al acabar, los guardó
    expect(n.s.pendingSaveCount()).toBe(0);
  });

  it('restaurar una copia descarta el `savedSig` que traiga: lo que entra se ve pendiente y se guarda', async () => {
    const t = await phone('viejo');
    await t.s.createTrainerCodeAccount();
    const id = await t.s.createClient('Ana');
    await t.s.refreshTrainerSlots();
    const backup = JSON.parse(buildBackupJson(t.s));
    expect(backup.clients[id].savedSig).toBeUndefined();                    // la copia no lo lleva
    // Una copia manipulada o de otro móvil, con un cliente que la cuenta nunca conoció.
    backup.clients.nuevo = { ...backup.clients[id], id: 'nuevo', name: 'Berta', notes: 'de la copia', savedSig: 'viejo-de-otro-movil' };
    await t.s.restoreBackup(backup, { clients: true });

    expect(t.s.clients.nuevo.savedSig).not.toBe('viejo-de-otro-movil');
    await t.s.saveClients();                                                 // el refresco de restaurar ya lo subió; esto no cambia nada
    expect((await privateOf(t.s.clients.nuevo.slotId)).card_json.notes).toBe('de la copia');
  });

  it('un solo recorrido a la vez, y el `savedSig` propio no rearma el guardado (sin bucle)', async () => {
    const t = await phone('viejo');
    await t.s.createTrainerCodeAccount();
    const id = await t.s.createClient('Ana');
    await t.s.refreshTrainerSlots();
    timers();
    try {
      t.s.updateClientInfo(id, { notes: 'x' });
      const [r1, r2] = [t.s.saveClients(), t.s.saveClients()];
      expect(r1).toBe(r2);
      await r1;
      const calls = saveCalls('viejo');
      expect(calls).toBeGreaterThan(0);
      await vi.advanceTimersByTimeAsync(60_000);                            // ni el suscriptor ni la escala vuelven a subir lo mismo
      await t.s.saveClients();
      expect(saveCalls('viejo')).toBe(calls);
    } finally { vi.useRealTimers(); }
  });
});

describe('C10-05 · «Cambios sin enviar» sobrevive a perder el móvil (N-06)', () => {
  it('lo editado sin enviar sale como pendiente en el móvil nuevo; lo enviado, no', async () => {
    const t = await phone('viejo');
    const c1 = await phone('cliente1');
    const c2 = await phone('cliente2');
    await t.s.createTrainerCodeAccount();
    const ana = await newClient(t, 'Ana');
    const berta = await newClient(t, 'Berta');
    await join(c1, t.s.clients[ana].code);
    await join(c2, t.s.clients[berta].code);
    await t.s.refreshTrainerSlots();
    // A Ana se le edita el programa y no se le envía.
    const pid = t.s.clients[ana].activeProgramId;
    t.store.setState((s) => ({ programs: { ...s.programs, [pid]: { ...s.programs[pid], name: 'Fuerza v2' } } }));
    t.s.markProgramDirtyForClients(pid);
    expect(t.s.clients[ana].programDirty).toBe(true);
    await t.s.saveClients();
    expect(t.s.pendingSaveCount()).toBe(0);

    const n = await phone('nuevo');
    await n.s.recoverTrainerAccount(t.s.trainerSync.code);
    expect(n.s.programs[n.s.clients[ana].activeProgramId].name).toBe('Fuerza v2');
    expect(n.s.clients[ana].programDirty).toBe(true);
    expect(n.s.clients[berta].programDirty).toBe(false);
  });
});


// ═════════════════════════════════════════════════════════════════════════════

describe('C10-06 · restaurar una copia (§8.1)', () => {
  const ALL = { program: true, log: true, templates: true, customExercises: true, clients: true };
  const UPLOAD_PROGRAM = 'rpc:trainer_upload_program';
  const mark = () => server.calls.length;
  const sentSince = (since) => server.calls.slice(since).filter((c) => c.key === UPLOAD_PROGRAM).length;
  const copyOf = (p) => JSON.parse(JSON.stringify(buildBackupPayload(p.s)));
  // Sin `updatedAt`: el refresco de después de restaurar vuelve a copiar la hora del servidor en `progress`.
  const snapshot = (p) => JSON.stringify([p.s.clients, p.s.programs, p.s.sessionTemplates, p.s.clientLogs, p.s.profile.freeClientIds], (k, v) => (k === 'updatedAt' ? undefined : v));
  const ownedPrograms = (p, id) => Object.values(p.s.programs).filter((x) => x.owner === id);

  /** Un cliente sin app con programa, sesiones y entrenos apuntados (sin cuenta o con ella). */
  async function withContent(p, name) {
    const id = await p.s.createClient(name);
    const pid = p.s.createProgramForClient(id, 2, `Programa ${name}`, null, { openEditor: false });
    p.s.setClientActiveProgram(id, pid);
    addLog(p, id, `log-${name}`);
    return { id, pid };
  }

  it('la copia no lleva ningún campo de estado ni `freeClientIds` (§8.1)', () => {
    const everything = {
      slotId: 'sl', slotOwner: 'u', code: 'AAAA', seated: true, leftAt: null, savedSig: 'x', programDirty: true, overridesDirty: true,
      programUploadedSig: 's', programUploadedAt: 1, remoteSessionsCount: 3, sendPending: { program: true },
      syncSlotId: 'sl', syncCode: 'AAAA', syncLinked: true, syncOrphan: false, syncLeftAt: null, syncPending: false,
    };
    const payload = buildBackupPayload({ clients: { a: { id: 'a', name: 'Ana', notes: 'n', ...everything } }, profile: { isPro: false, freeClientIds: ['a'], language: 'es' } });
    expect(payload.clients.a).toEqual({ id: 'a', name: 'Ana', notes: 'n' });
    expect(payload.profile).toEqual({ isPro: false, language: 'es' });
  });

  it('E73: una copia de la versión anterior (banderas `sync*` y `programDirty`) no envía nada ni deja ninguna ficha con hueco', async () => {
    const { t, ana } = await trainerWithClients();
    const old = copyOf(t);
    old.clients[ana] = { ...old.clients[ana], syncSlotId: 'hueco-viejo', syncCode: 'AAAA-AAAA-AAAA', syncLinked: true, programDirty: true, overridesDirty: true, sendPending: { program: true } };

    // Sin cuenta (móvil nuevo): entra todo `local`, sin una sola bandera.
    const n = await phone('nuevo');
    const before = mark();
    await n.s.restoreBackup(old, ALL);
    await n.s.retrySendQueue();
    expect(idsOf(n)).toEqual(idsOf(t));
    for (const c of Object.values(n.s.clients)) {
      assertFacts(c);
      expect(linkOf(c, n.s.trainerSync.userId)).toBe('local');
      expect(c).not.toHaveProperty('syncSlotId');
      expect(c.programDirty).toBeUndefined();
      expect(c.sendPending).toBeUndefined();
    }
    expect(sentSince(before)).toBe(0);

    // Con cuenta (la recuperada): ya los conoce, no se toca ninguno y nada sale.
    const r = await phone('recuperado');
    await r.s.recoverTrainerAccount(t.s.trainerSync.code);
    const sentBefore = mark();
    await r.s.restoreBackup(old, ALL);
    await r.s.retrySendQueue();
    expect(r.s.clients[ana].programDirty).toBeFalsy();
    expect(r.s.clients[ana].sendPending).toBeUndefined();
    expect(sentSince(sentBefore)).toBe(0);
  });

  it('E78: recuperar la cuenta y restaurar la copia del móvil viejo deja una sola ficha por hueco', async () => {
    const { t, ana, berta } = await trainerWithClients();
    const backup = copyOf(t);
    const n = await phone('movil-nuevo');
    await n.s.recoverTrainerAccount(t.s.trainerSync.code);
    const res = await n.s.restoreBackup(backup, ALL);

    expect(res).toMatchObject({ added: 0, kept: 2, account: true });
    expect(idsOf(n)).toEqual([ana, berta].sort());
    for (const slot of await slots()) expect(Object.values(n.s.clients).filter((c) => c.slotId === slot.id)).toHaveLength(1);
  });

  it('E79 / A2: con cuenta, un cliente borrado después de la copia no vuelve, ni su historial (N-04, N-13)', async () => {
    const t = await phone('entrenador');
    await t.s.createTrainerCodeAccount();
    const ana = await withContent(t, 'Ana');
    const berta = await withContent(t, 'Berta');
    await t.s.refreshTrainerSlots();
    const backup = copyOf(t);

    await t.s.deleteClient(ana.id);                                   // sin querer
    expect(t.s.clients[ana.id]).toBeUndefined();
    const res = await t.s.restoreBackup(backup, ALL);

    expect(t.s.clients[ana.id]).toBeUndefined();
    expect(t.s.clientLogs[ana.id]).toBeUndefined();
    expect(ownedPrograms(t, ana.id)).toHaveLength(0);
    expect(res).toMatchObject({ added: 0, kept: 2 });                  // los dos estaban en la cuenta (uno, borrado)
    await t.s.refreshTrainerSlots();                                   // abrir Clientes
    expect(t.s.clients[ana.id]).toBeUndefined();
    expect(t.s.clients[berta.id].name).toBe('Berta');
  });

  it('con cuenta, un cliente que la cuenta nunca conoció entra `local` con su programa y su historial, y el refresco lo sube', async () => {
    const t = await phone('entrenador');
    await t.s.createTrainerCodeAccount();
    await withContent(t, 'Ana');
    const o = await phone('otro-movil-sin-cuenta');
    const carla = await withContent(o, 'Carla');
    const res = await t.s.restoreBackup(copyOf(o), ALL);

    expect(res).toMatchObject({ added: 1, kept: 0, account: true });
    const c = t.s.clients[carla.id];
    expect(c.name).toBe('Carla');
    expect(ownedPrograms(t, carla.id)).toHaveLength(1);
    expect(t.s.clientLogs[carla.id].map((e) => e.id)).toEqual(['log-Carla']);
    // restoreBackup acaba con el refresco, que sube lo añadido (§5)
    expect(linkNow(t, carla.id)).toBe('none');
    const slot = await slotOf(c.slotId);
    expect(slot.local_id).toBe(carla.id);
    expect(historyIds(slot)).toEqual(['log-Carla']);
  });

  it('con cuenta, una copia cuyos clientes están todos en la cuenta no cambia nada de ninguno, aunque traiga otra nota', async () => {
    const t = await phone('entrenador');
    await t.s.createTrainerCodeAccount();
    const ana = await withContent(t, 'Ana');
    await t.s.refreshTrainerSlots();
    const backup = copyOf(t);
    backup.clients[ana.id] = { ...backup.clients[ana.id], notes: 'nota de la copia', name: 'Ana (copia)' };
    backup.clientLogs[ana.id] = [...backup.clientLogs[ana.id], { id: 'log-de-la-copia', sessionTemplateId: 'x', timestamp: 1, date: '2026-01-01', exercises: [] }];
    t.s.updateClientInfo(ana.id, { notes: 'nota de ahora' });
    await t.s.saveClients();                          // lo de ahora, ya guardado: lo que cambie después no será del guardado
    const before = snapshot(t);

    const res = await t.s.restoreBackup(backup, ALL);
    expect(res).toMatchObject({ added: 0, kept: 1 });
    expect(snapshot(t)).toBe(before);
    expect(t.s.clients[ana.id].notes).toBe('nota de ahora');
  });

  it('sin cuenta, la parte de clientes reemplaza a los del móvil, con sus programas, sesiones e historial', async () => {
    const p = await phone('sin-cuenta');
    const x = await withContent(p, 'Xenia');
    p.store.setState((st) => ({ profile: { ...st.profile, freeClientIds: [x.id] } }));
    const q = await phone('de-la-copia');
    const y = await withContent(q, 'Yago');
    const sessionsOfX = [...programTemplateIds(p.s.programs[x.pid])];
    expect(sessionsOfX.length).toBeGreaterThan(0);

    const res = await p.s.restoreBackup(copyOf(q), { clients: true });

    expect(res).toMatchObject({ added: 1, kept: 0, replaced: 1, account: false });
    expect(idsOf(p)).toEqual([y.id]);
    expect(linkNow(p, y.id)).toBe('local');
    expect(ownedPrograms(p, x.id)).toHaveLength(0);
    expect(ownedPrograms(p, y.id)).toHaveLength(1);
    expect(p.s.clientLogs[x.id]).toBeUndefined();
    expect(p.s.clientLogs[y.id].map((e) => e.id)).toEqual(['log-Yago']);
    sessionsOfX.forEach((id) => expect(p.s.sessionTemplates[id]).toBeUndefined());
    expect(p.s.profile.freeClientIds).toEqual([]);
  });

  it('restaurar dos veces la misma copia no cambia nada (sin cuenta y con cuenta)', async () => {
    const q = await phone('de-la-copia');
    await withContent(q, 'Yago');
    await withContent(q, 'Zoe');
    const backup = copyOf(q);

    const p = await phone('sin-cuenta');
    await p.s.restoreBackup(backup, ALL);
    const once = snapshot(p);
    await p.s.restoreBackup(backup, ALL);
    expect(snapshot(p)).toBe(once);

    const t = await phone('entrenador');
    await t.s.createTrainerCodeAccount();
    const first = await t.s.restoreBackup(backup, ALL);
    expect(first).toMatchObject({ added: 2, kept: 0 });
    const twice = snapshot(t);
    const second = await t.s.restoreBackup(backup, ALL);
    expect(second).toMatchObject({ added: 0, kept: 2 });
    expect(snapshot(t)).toBe(twice);
  });

  it('N-05: el cliente conectado que restaura una copia vieja vuelve a tener el programa de su hueco', async () => {
    const { t, c, berta } = await trainerWithClients();
    const progId = t.s.clients[berta].activeProgramId;
    await c.s.checkAndPullProgramUpdates();                       // el programa de Berta, tal y como lo mandó
    c.s.applyPendingProgramUpdate();
    expect(c.s.programs[progId].name).toBe('Fuerza Berta');
    const old = copyOf(c);                                        // copia de entonces

    t.s.renameProgram(progId, 'Fuerza Berta v2');
    await t.s.uploadProgramToClient(berta, progId);
    await c.s.checkAndPullProgramUpdates();
    c.s.applyPendingProgramUpdate();
    expect(c.s.programs[progId].name).toBe('Fuerza Berta v2');
    // Con la copia vieja encima (como entra por la hoja), el programa local parece el de antes.
    await c.s.restoreBackup(old, { program: true, log: true });
    expect(c.s.programs[progId].name).toBe('Fuerza Berta v2');    // no el de la copia
  });

  it('con cuenta y sin red: CLIENTS_NEED_NETWORK y no se restaura nada; sin la parte de clientes sí se restaura', async () => {
    const t = await phone('entrenador');
    await t.s.createTrainerCodeAccount();
    const ana = await withContent(t, 'Ana');
    await t.s.refreshTrainerSlots();
    const backup = copyOf(t);
    t.s.updateClientInfo(ana.id, { notes: 'nota de ahora' });
    backup.clients.nuevo = { id: 'nuevo', name: 'Berta' };
    backup.workoutLog = [{ id: 'w1', sessionTemplateId: 'x', timestamp: 1, date: '2026-01-01', exercises: [] }];
    const before = snapshot(t);

    t.device.offline = true;
    await expect(t.s.restoreBackup(backup, ALL)).rejects.toMatchObject({ code: 'CLIENTS_NEED_NETWORK', message: 'Necesitas conexión para restaurar clientes' });
    expect(snapshot(t)).toBe(before);
    expect(t.s.workoutLog).toHaveLength(0);

    // El resto de partes se restaura igual (la casilla de clientes está apagada en la hoja).
    await t.s.restoreBackup(backup, { log: true });
    expect(t.s.workoutLog.map((e) => e.id)).toContain('w1');
    expect(snapshot(t)).toBe(before);
    t.device.offline = false;
  });
});
