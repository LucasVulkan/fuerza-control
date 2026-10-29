/**
 * C10-08 · El recorrido entero de un entrenador (docs/specs/C10-clientes-de-la-cuenta.md §10.8).
 *
 * Un solo `it`, con un móvil de cliente: empieza sin cuenta con tres clientes, crea la cuenta, invita a
 * uno, pasa a Google, hace una copia, «pierde el móvil», recupera en otro, restaura la copia, borra y
 * deshace, y el cliente conectado sigue entrenando. En cada paso:
 *  - `assertFacts` sobre TODAS las fichas de TODOS los móviles del entrenador (el estado nunca se
 *    contradice), y
 *  - «no se ha perdido nada»: los ids que tienen que estar, y la ficha, los programas y el historial
 *    iguales a lo que se apuntó la última vez que el usuario los tocó (`expected`).
 *
 * Postgres de verdad (PGlite) y el store real, como el resto de `*.sim.test.js`.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { linkOf, assertFacts } from '../src/utils/clientLink';
import { buildBackupPayload } from '../src/utils/backupPayload';
import { buildClientCard, buildClientPrograms, saveSig } from '../src/utils/clientSave';
import { createServer, createDevice, createSimClient } from '../../test/supabaseSim.js';

let server;
beforeEach(async () => { server = await createServer(); });
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

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
const slots = () => server.slots();
const slotOf = async (slotId) => (await slots()).find((r) => r.id === slotId);
const historyIds = (slot) => (slot?.history_json?.entries ?? []).map((e) => e.id).sort();
const linkNow = (t, id) => linkOf(t.s.clients[id], t.s.trainerSync.userId);
const logIds = (p, id) => (p.s.clientLogs[id] ?? []).map((e) => e.id).sort();
const entry = (id) => ({ id, sessionTemplateId: 'x', timestamp: Date.now(), date: '2026-10-29', exercises: [] });
const addLog = (p, clientId, id) => p.store.setState((s) => ({
  clientLogs: { ...s.clientLogs, [clientId]: [...(s.clientLogs[clientId] ?? []), entry(id)] },
}));
/** Sin `updatedAt`: el refresco copia la hora del servidor en `progress` y no es un cambio del usuario. */
const snapshot = (p) => JSON.stringify([p.s.clients, p.s.programs, p.s.sessionTemplates, p.s.clientLogs, p.s.profile.freeClientIds],
  (k, v) => (k === 'updatedAt' ? undefined : v));
const settle = async () => { for (let i = 0; i < 300; i++) await new Promise((r) => globalThis.setImmediate(r)); };
const until = async (cond) => { for (let i = 0; i < 5000 && !(await cond()); i++) await new Promise((r) => globalThis.setImmediate(r)); };

describe('C10-08 · el recorrido entero, de un entrenador y un cliente', () => {
  it('sin cuenta → cuenta → invitar → Google → copia → móvil nuevo → restaurar → borrar y deshacer → el cliente sigue', async () => {
    // Solo los temporizadores: el banco necesita el resto reales. Así el guardado continuo (5 s) y la cola
    // de reintentos (30 s) solo andan cuando el test lo dice.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });

    const trainer = [];                        // los móviles del entrenador, para `assertFacts` en cada paso
    const expected = {};                       // id → lo que el usuario dejó escrito en cada cliente
    const record = (p, ...ids) => ids.forEach((id) => {
      expected[id] = { card: buildClientCard(p.s, id), programs: buildClientPrograms(p.s, id), log: logIds(p, id) };
    });
    /** Fin de cada paso: los hechos no se contradicen en ningún móvil, y nada de `ids` se ha perdido ni cambiado. */
    const check = (p, ids) => {
      trainer.forEach((x) => Object.values(x.s.clients).forEach(assertFacts));
      expect(Object.keys(p.s.clients).sort()).toEqual([...ids].sort());
      for (const id of ids) {
        expect(buildClientCard(p.s, id)).toEqual(expected[id].card);
        expect(buildClientPrograms(p.s, id)).toEqual(expected[id].programs);
        expect(logIds(p, id)).toEqual(expected[id].log);
      }
    };
    const privates = () => server.admin('select * from public.trainer_client_private');
    const privateOf = async (slotId) => (await privates()).find((r) => r.slot_id === slotId);

    // ── 1 · Sin cuenta: tres clientes ─────────────────────────────────────────────────────────────
    const a = await phone('viejo');
    const c = await phone('cliente');
    trainer.push(a);
    const tag = a.s.createTag('Rehabilitación');
    const ana = await a.s.createClient('Ana');
    const anaProgram = a.s.createProgramForClient(ana, 2, 'Fuerza Ana', null, { openEditor: false });
    a.s.setClientActiveProgram(ana, anaProgram);
    addLog(a, ana, 'ana-1');
    const berta = await a.s.createClient('Berta');
    a.s.updateClientInfo(berta, { notes: 'lesión de hombro', billing: [{ id: 'b1', date: '2026-10-01', amount: 40, paid: true }], tags: [tag] });
    const carla = await a.s.createClient('Carla');
    const ids = [ana, berta, carla];
    record(a, ...ids);
    expect(ids.map((id) => linkNow(a, id))).toEqual(['local', 'local', 'local']);
    check(a, ids);

    // ── 2 · Crea la cuenta (código): los 3 suben, sin código, con lo apuntado en el hueco ───────
    await a.s.createTrainerCodeAccount();
    await a.s.saveClients();
    expect(ids.map((id) => linkNow(a, id))).toEqual(['none', 'none', 'none']);
    expect((await slots()).map((r) => r.local_id).sort()).toEqual([...ids].sort());
    expect((await slots()).every((r) => r.client_code === null)).toBe(true);
    expect(historyIds(await slotOf(a.s.clients[ana].slotId))).toEqual(['ana-1']);
    expect(a.s.pendingSaveCount()).toBe(0);
    expect(await privates()).toHaveLength(3);
    check(a, ids);

    // ── 3 · Invita a Ana y entra con el código: ve su programa y lo apuntado ──────────────────
    expect(await a.s.connectClientToCloud(ana)).toBe(true);
    const code = a.s.clients[ana].code;
    expect(code).toBeTruthy();
    expect(linkNow(a, ana)).toBe('invited');
    await c.s.validateClientCode(code);
    await c.s.linkToTrainer(code, { mergeHistory: true });
    await a.s.refreshTrainerSlots();
    expect(ids.map((id) => linkNow(a, id))).toEqual(['linked', 'none', 'none']);
    expect(c.s.programs[c.s.clientSync.trainerProgramIds[0]].name).toBe('Fuerza Ana');
    expect(c.s.workoutLog.map((e) => e.id)).toEqual(['ana-1']);
    record(a, ana);                                                   // invitar la envió: `programDirty` pasó a false
    check(a, ids);

    // ── 4 · Pasa a Google (mejorar): mismos ids, mismos estados, cola y guardado intactos ──────
    const oldUser = a.s.trainerSync.userId;
    const clientSyncBefore = { ...c.s.clientSync };
    // Con la red cortada, dos cosas se quedan por hacer: un envío a Ana (cola) y una nota de Berta (guardado).
    a.device.offline = true;
    a.store.setState((s) => ({ programs: { ...s.programs, [anaProgram]: { ...s.programs[anaProgram], name: 'Fuerza Ana v2' } } }));
    await expect(a.s.uploadProgramToClient(ana, anaProgram)).rejects.toMatchObject({ code: 'NETWORK' });
    a.s.updateClientInfo(berta, { notes: 'lesión de hombro, mejora' });
    expect(a.s.clients[ana].sendPending).toEqual({ program: true });
    expect(a.s.pendingSaveCount()).toBe(2);                           // Ana (programa nuevo) y Berta (nota)
    a.device.offline = false;
    const sigs = Object.fromEntries(ids.map((id) => [id, a.s.clients[id].savedSig]));

    await a.s.enterTrainerAccount({ ...google('g1'), upgrade: true });

    expect(a.s.trainerSync).toMatchObject({ mode: 'google' });
    expect(a.s.trainerSync.userId).not.toBe(oldUser);
    expect(ids.map((id) => linkNow(a, id))).toEqual(['linked', 'none', 'none']);
    for (const slot of await slots()) expect(slot.trainer_id).toBe(a.s.trainerSync.userId);
    expect((await slots()).map((r) => r.local_id).sort()).toEqual([...ids].sort());      // mismos ids en el servidor
    expect(a.s.clients[ana].sendPending).toEqual({ program: true });                      // la cola se queda
    // Lo guardado, intacto: Carla no cambió. Lo pendiente (Ana, Berta) lo guarda el refresco de entrar, en la
    // cuenta nueva, con lo que el usuario escribió (N-18).
    expect(a.s.clients[carla].savedSig).toBe(sigs[carla]);
    expect(a.s.pendingSaveCount()).toBe(0);
    for (const id of [ana, berta]) expect(a.s.clients[id].savedSig).toBe(saveSig(a.s, id));
    expect((await privateOf(a.s.clients[berta].slotId)).card_json.notes).toBe('lesión de hombro, mejora');
    expect((await privateOf(a.s.clients[ana].slotId)).programs_json.programs[anaProgram].name).toBe('Fuerza Ana v2');
    expect(c.s.clientSync).toEqual(clientSyncBefore);                                    // el cliente no se enteró
    // Lo pendiente sale por sus caminos de siempre: la cola envía, el guardado guarda.
    expect(await a.s.retrySendQueue()).toEqual({ ok: 1, fail: 0 });
    expect(a.s.pendingSaveCount()).toBe(0);
    expect(a.s.clients[ana].sendPending).toBeUndefined();
    record(a, ana, berta);
    check(a, ids);

    // ── 5 · Edita una ficha y deja que se guarde (continuo, a los 5 s) ──────────────────────────
    a.s.updateClientInfo(carla, { notes: 'prefiere por la mañana' });
    expect(a.s.pendingSaveCount()).toBe(1);
    await vi.advanceTimersByTimeAsync(5000);
    await a.s.saveClients();                                          // si el temporizador ya lo lanzó, es el mismo recorrido
    expect(a.s.pendingSaveCount()).toBe(0);
    expect((await privateOf(a.s.clients[carla].slotId)).card_json.notes).toBe('prefiere por la mañana');
    record(a, carla);
    check(a, ids);

    // ── 6 · Hace una copia en este momento ──────────────────────────────────────────────────────
    const backup = JSON.parse(JSON.stringify(buildBackupPayload(a.s)));
    expect(Object.keys(backup.clients).sort()).toEqual([...ids].sort());
    check(a, ids);

    // ── 7 · «Pierde el móvil»: otro entra con la misma cuenta de Google y lo recupera todo ────
    const n = await phone('nuevo');
    trainer.push(n);
    await n.s.enterTrainerAccount({ ...google('g1'), mustExist: true });
    expect(ids.map((id) => linkNow(n, id))).toEqual(['linked', 'none', 'none']);
    for (const id of ids) expect(n.s.clients[id].savedSig).toBe(saveSig(n.s, id));
    expect(n.s.pendingSaveCount()).toBe(0);
    expect(n.s.tagRegistry).toEqual([{ id: tag, name: 'Rehabilitación' }]);
    check(n, ids);
    check(a, ids);                                                    // el viejo no cambia por eso

    // ── 8 · En el nuevo restaura la copia del paso 6: no cambia nada ni duplica a nadie ─────────
    const before = snapshot(n);
    const res = await n.s.restoreBackup(backup, { program: true, log: true, templates: true, customExercises: true, clients: true });
    expect(res).toMatchObject({ added: 0, kept: 3, account: true });
    expect(snapshot(n)).toBe(before);
    for (const slot of await slots()) expect(Object.values(n.s.clients).filter((x) => x.slotId === slot.id)).toHaveLength(1);
    expect(await slots()).toHaveLength(3);
    check(n, ids);

    // ── 9 · Borra a Berta (sin app) y deshace; la borra otra vez y deja pasar el aviso ────────
    const bertaSlot = n.s.clients[berta].slotId;
    const callsBefore = server.calls.length;
    n.s.deleteClient(berta, { undo: true });
    expect(n.s.clients[berta]).toBeUndefined();
    n.s.ui.toast.action.onPress();                                    // Deshacer
    check(n, ids);                                                    // vuelve igual
    vi.advanceTimersByTime(6000);
    await settle();
    expect(server.calls.slice(callsBefore).filter((x) => x.key === 'rpc:trainer_delete_slot')).toHaveLength(0);
    expect(await slotOf(bertaSlot)).toBeTruthy();                     // el servidor no se enteró

    n.s.deleteClient(berta, { undo: true });
    await vi.advanceTimersByTimeAsync(5000);                          // pasa el aviso
    await until(async () => !(await slotOf(bertaSlot)));
    expect(await slotOf(bertaSlot)).toBeUndefined();                  // el hueco desaparece del servidor
    expect(await privateOf(bertaSlot)).toBeUndefined();               // y su ficha privada con él
    expect((await server.admin('select local_id from public.deleted_slots')).map((r) => r.local_id)).toContain(berta);
    const kept = [ana, carla];
    check(n, kept);
    // El móvil viejo, al refrescar, también la borra: no vuelve a subirla ni la recupera.
    check(a, ids);                                                    // hasta que refresca, la tiene
    await a.s.refreshTrainerSlots();
    expect(a.s.clients[berta]).toBeUndefined();
    expect(a.s.clientLogs[berta]).toBeUndefined();
    expect(Object.values(a.s.programs).filter((p) => p.owner === berta)).toHaveLength(0);
    check(a, kept);
    await n.s.refreshTrainerSlots();
    check(n, kept);
    expect((await slots()).map((r) => r.local_id).sort()).toEqual([...kept].sort());

    // ── 10 · El cliente conectado sigue subiendo su historial y recibe un programa del móvil nuevo ──
    const programId = c.s.clientSync.trainerProgramIds[0];
    const templateId = c.s.programs[programId].stages[0].days[0].sessionTemplateId;
    c.store.setState((s) => ({ workoutLog: [...s.workoutLog, { id: 'ana-2', programId, sessionTemplateId: templateId, timestamp: Date.now(), date: '2026-10-30', exercises: [] }] }));
    await c.s.uploadHistoryToTrainer();
    await n.s.downloadClientHistory(ana);
    expect(logIds(n, ana)).toEqual(['ana-1', 'ana-2']);

    n.s.renameProgram(anaProgram, 'Fuerza Ana v3');
    await n.s.uploadProgramToClient(ana, anaProgram);
    await c.s.checkAndPullProgramUpdates();
    c.s.applyPendingProgramUpdate();
    expect(c.s.programs[programId].name).toBe('Fuerza Ana v3');
    expect(c.s.clientSync.lostAt ?? null).toBeNull();                 // sin enterarse de nada
    expect(c.s.clientSync.slotId).toBe(clientSyncBefore.slotId);
    expect(c.s.workoutLog.map((e) => e.id).sort()).toEqual(['ana-1', 'ana-2']);
    record(n, ana);                                                   // lo que acaba de pasar es del usuario
    check(n, kept);
    // El viejo, al refrescar y bajar, se pone al día; sigue sin contradecirse.
    await a.s.refreshTrainerSlots();
    await a.s.downloadClientHistory(ana);
    expect(logIds(a, ana)).toEqual(['ana-1', 'ana-2']);
    expect(linkNow(a, ana)).toBe('linked');
    expect(historyIds(await slotOf(a.s.clients[ana].slotId))).toEqual(['ana-1', 'ana-2']);
    trainer.forEach((x) => Object.values(x.s.clients).forEach(assertFacts));
  });
});
