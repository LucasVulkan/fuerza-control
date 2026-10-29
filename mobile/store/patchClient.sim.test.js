/**
 * I04-04 — Escribir en una ficha solo si sigue existiendo (E74 y A1).
 *
 * Mismo banco que `sync.audit.sim.test.js` (store real, SQL real en PGlite). Cada
 * test retiene la respuesta de UNA llamada al servidor (`supabaseSync`), borra al
 * cliente mientras tanto y la suelta: la escritura que viene detrás no puede
 * dejar una ficha fantasma (sin nombre, que cuenta como cliente del plan gratis).
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createServer, createDevice, createSimClient } from '../../test/supabaseSim.js';

let server;
beforeEach(async () => { server = await createServer(); });

const tick = () => new Promise((r) => setTimeout(r, 0));

/**
 * Entrenador con la llamada `fn` de `supabaseSync` retenida: cuando `gate.armed`,
 * la primera vez que se llama espera (tras recibir la respuesta, o tras fallar
 * con `error` si se pide uno forzado) hasta `gate.release()`.
 */
async function trainerPhone(fn, { error } = {}) {
  const dev = createDevice(server, 'entrenador');
  const gate = { armed: false, held: false, release: null };
  vi.resetModules();
  vi.doMock('../src/config/supabase', () => ({
    trainerSupabase:    createSimClient(dev, { storageKey: 'sb-trainer' }),
    clientSupabase:     createSimClient(dev, { storageKey: 'sb-client' }),
    createTempSupabase: () => createSimClient(dev, { persistSession: false }),
    migrateLegacySession: async () => {},
    sessionsReady:        async () => {},
  }));
  vi.doMock('../src/services/supabaseSync', async (importOriginal) => {
    const actual = await importOriginal();
    return {
      ...actual,
      [fn]: async (...args) => {
        let out, err = error;
        if (!err) { try { out = await actual[fn](...args); } catch (e) { err = e; } }
        if (gate.armed) {
          gate.armed = false;
          await new Promise((ok) => { gate.release = ok; gate.held = true; });
        }
        if (err) throw err;
        return out;
      },
    };
  });
  const { useStore } = await import('./useStore.js');
  useStore.setState((s) => ({ profile: { ...s.profile, isPro: true }, _hasHydrated: true }));
  const t = { gate, store: useStore, get s() { return useStore.getState(); } };
  await t.s.createTrainerCodeAccount();
  return t;
}

/** Un cliente con app (hueco) y su programa activo ya subido. */
async function clientWithProgram(t, { withApp = true } = {}) {
  const clientId = await t.s.createClient('Ana', { withApp });
  const programId = t.s.createProgramForClient(clientId, 2, 'Fuerza', null, { openEditor: false });
  t.s.setClientActiveProgram(clientId, programId);
  if (withApp) await t.s.uploadProgramToClient(clientId, programId);
  return { clientId, programId };
}

/** Arranca `run`, espera a que la llamada esté retenida, borra al cliente y la suelta. */
async function deletedMidFlight(t, clientId, run) {
  t.gate.armed = true;
  const p = run();
  for (let i = 0; i < 300 && !t.gate.held; i++) await tick();
  expect(t.gate.held).toBe(true);
  await t.s.deleteClient(clientId);
  expect(t.s.clients[clientId]).toBeUndefined();
  t.gate.release();
  await p.catch(() => {});   // algunos lanzan a propósito
  await tick();
}

const noGhosts = (t) => expect(Object.keys(t.s.clients)).toEqual([]);

describe('I04-04 · borrar un cliente con una llamada en vuelo no deja ficha fantasma', () => {
  it('A1 · uploadProgramToClient (la cola sube el programa)', async () => {
    const t = await trainerPhone('uploadProgram');
    const { clientId, programId } = await clientWithProgram(t);
    await deletedMidFlight(t, clientId, () => t.s.uploadProgramToClient(clientId, programId));
    noGhosts(t);
  });

  it('A1 · sendOverrides (la cola envía «Próxima sesión»)', async () => {
    const t = await trainerPhone('uploadOverrides');
    const { clientId } = await clientWithProgram(t);
    t.store.setState((s) => ({
      clients: { ...s.clients, [clientId]: { ...s.clients[clientId], nextOverrides: { tpl: { templateId: 'tpl', createdAt: 'x', exercises: {} } }, overridesDirty: true } },
    }));
    await deletedMidFlight(t, clientId, () => t.s.sendOverrides(clientId));
    noGhosts(t);
  });

  it('A1 · reissueClientCode', async () => {
    const t = await trainerPhone('reissueClientCode');
    const { clientId } = await clientWithProgram(t);
    await deletedMidFlight(t, clientId, () => t.s.reissueClientCode(clientId));
    noGhosts(t);
  });

  it('A1 · cancelClientInvitation', async () => {
    const t = await trainerPhone('clearClientCode');
    const { clientId } = await clientWithProgram(t);
    await deletedMidFlight(t, clientId, () => t.s.cancelClientInvitation(clientId));
    noGhosts(t);
  });

  /** Una ficha `local` con un entreno apuntado: lo que sube `uploadLocalClients`. */
  const localWithLog = async (t) => {
    const { clientId } = await clientWithProgram(t, { withApp: false });
    t.store.setState((s) => ({ clientLogs: { ...s.clientLogs, [clientId]: [{ id: 'l1', sessionTemplateId: 'x', timestamp: 1, exercises: [] }] } }));
    return clientId;
  };

  it('A1 · uploadLocalClients, lo apuntado sube bien: ni ficha ni «ya visto» del borrado', async () => {
    const t = await trainerPhone('uploadTrainerLog');
    const clientId = await localWithLog(t);
    await deletedMidFlight(t, clientId, () => t.s.uploadLocalClients());
    noGhosts(t);
    expect(t.s.trainerSync.lastSeenSessionsCount?.[clientId]).toBeUndefined();
  });

  it('A1 · uploadLocalClients, asiento ocupado (SLOT_OCCUPIED)', async () => {
    const t = await trainerPhone('uploadTrainerLog', { error: Object.assign(new Error('ocupado'), { code: 'SLOT_OCCUPIED' }) });
    const clientId = await localWithLog(t);
    await deletedMidFlight(t, clientId, () => t.s.uploadLocalClients());
    noGhosts(t);
  });

  it('A1 · uploadLocalClients, el hueco recién creado de una ficha borrada no se queda huérfano', async () => {
    const t = await trainerPhone('createClientSlot');
    const { clientId } = await clientWithProgram(t, { withApp: false });
    await deletedMidFlight(t, clientId, () => t.s.uploadLocalClients());
    noGhosts(t);
    expect(await server.slots()).toEqual([]);
  });

  it('E74 · downloadClientHistory, bajada correcta: ni ficha ni historial del borrado', async () => {
    const t = await trainerPhone('downloadHistory');
    const { clientId } = await clientWithProgram(t);
    await deletedMidFlight(t, clientId, () => t.s.downloadClientHistory(clientId));
    noGhosts(t);
    expect(t.s.clientLogs[clientId]).toBeUndefined();
  });

  it('E74 · downloadClientHistory, bajada fallida (marca de error)', async () => {
    const t = await trainerPhone('downloadHistory', { error: new Error('Network request failed') });
    const { clientId } = await clientWithProgram(t);
    await deletedMidFlight(t, clientId, () => t.s.downloadClientHistory(clientId));
    noGhosts(t);
  });

  it('E74 · connectClientToCloud («Pasar a la app» de un cliente sin hueco)', async () => {
    const t = await trainerPhone('createClientSlot');
    const { clientId } = await clientWithProgram(t, { withApp: false });
    await deletedMidFlight(t, clientId, () => t.s.connectClientToCloud(clientId));
    noGhosts(t);
  });

  it('E74 · createClient con app (el hueco llega después del borrado)', async () => {
    const t = await trainerPhone('createClientSlot');
    t.gate.armed = true;
    const creating = t.s.createClient('Ana', { withApp: true });
    for (let i = 0; i < 300 && !t.gate.held; i++) await tick();
    const [clientId] = Object.keys(t.s.clients);
    await t.s.deleteClient(clientId);
    t.gate.release();
    await creating;
    noGhosts(t);
  });

  it('E74 · _recoverSlotProgram (la bajada del programa de un hueco recuperado)', async () => {
    const t = await trainerPhone('downloadSlotProgram');
    const { clientId } = await clientWithProgram(t);
    await deletedMidFlight(t, clientId, () => t.s._recoverSlotProgram(clientId));
    noGhosts(t);
  });
});

describe('I04-04 · las escrituras directas sobre una ficha que no existe no la crean', () => {
  it('ninguna acción de ficha inventa un cliente', async () => {
    const t = await trainerPhone('uploadProgram');
    const before = { clients: t.s.clients, trainerSync: t.s.trainerSync };
    t.s.updateClientInfo('fantasma', { phone: '1' });
    t.s.renameClient('fantasma', 'X');
    t.s.addClientBilling('fantasma', { amount: 1 });
    t.s.updateClientBillingStatus('fantasma', 'b', 'paid');
    t.s.removeClientBilling('fantasma', 'b');
    t.s.addClientBodyWeight('fantasma', '2026-10-29', '80');
    t.s.removeClientBodyWeight('fantasma', '2026-10-29');
    t.s.setClientActiveProgram('fantasma', null);
    t.s.markHistoryViewed('fantasma');
    expect(t.s.clients).toEqual(before.clients);
    expect(t.s.trainerSync).toEqual(before.trainerSync);
  });

  // Una sola forma de escribir una ficha: patchClient. Esparcir `...s.clients[x]`
  // fuera de ella vuelve a abrir la puerta a la ficha fantasma.
  it('useStore.js no esparce una ficha ajena (`...s.clients[x]`)', () => {
    const src = readFileSync(fileURLToPath(new URL('./useStore.js', import.meta.url)), 'utf8');
    expect(src.match(/\.\.\.\s*[\w.]+(\(\))?\.clients\[/g) ?? []).toEqual([]);
  });
});
