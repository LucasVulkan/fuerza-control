/**
 * I04-03 · La cola solo reintenta lo que se envió y falló, por un solo camino (N-06).
 *
 * Mismo banco que `patchClient.sim.test.js` (store real, SQL real en PGlite).
 * Cubre E72, E73, E80 (A3), E83 y E84 (A10): del entrenador al cliente sale solo
 * lo que el entrenador envió; «Cambios sin enviar» es un aviso y no sale solo;
 * «En cola» (`sendPending`) es lo que se mandó y falló por red, y sale solo.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createServer, createDevice, createSimClient } from '../../test/supabaseSim.js';
import { buildBackupJson, buildBackupPayload } from '../src/utils/backupPayload';

let server;
beforeEach(async () => { server = await createServer(); });
afterEach(() => { vi.useRealTimers(); });

const tick = () => new Promise((r) => setTimeout(r, 0));
const UPLOAD_PROGRAM   = 'rpc:trainer_upload_program';
const UPLOAD_OVERRIDES = 'rpc:trainer_upload_overrides';
const uploads = (key, since = 0) => server.calls.slice(since).filter((c) => c.key === key).length;
const slotOf = async (slotId) => (await server.slots()).find((r) => r.id === slotId);
const programOnServer = async (t, clientId) => (await slotOf(t.s.clients[clientId].slotId)).program_json.program;

/** `wrap(cfg, dev)` deja envolver el Supabase del entrenador (red lenta, contadores). */
async function trainerPhone(wrap) {
  const dev = createDevice(server, 'entrenador');
  vi.resetModules();
  vi.doMock('../src/config/supabase', () => {
    const cfg = {
      trainerSupabase:    createSimClient(dev, { storageKey: 'sb-trainer' }),
      clientSupabase:     createSimClient(dev, { storageKey: 'sb-client' }),
      createTempSupabase: () => createSimClient(dev, { persistSession: false }),
      migrateLegacySession: async () => {},
      sessionsReady:        async () => {},
    };
    return wrap ? wrap(cfg, dev) : cfg;
  });
  const { useStore } = await import('./useStore.js');
  useStore.setState((s) => ({ profile: { ...s.profile, isPro: true }, _hasHydrated: true }));
  const t = { device: dev, store: useStore, get s() { return useStore.getState(); } };
  await t.s.createTrainerCodeAccount();
  return t;
}

/** Un cliente CONECTADO (con app y programa ya enviado). */
async function linkedClient(t, name = 'Ana') {
  const clientId = await t.s.createClient(name, { withApp: true });
  const programId = t.s.createProgramForClient(clientId, 2, 'Fuerza', null, { openEditor: false });
  t.s.setClientActiveProgram(clientId, programId);
  await t.s.uploadProgramToClient(clientId, programId);
  t.store.setState((s) => ({ clients: { ...s.clients, [clientId]: { ...s.clients[clientId], seated: true } } }));
  return { clientId, programId };
}

const setOnline = (t, online) => t.store.setState((s) => ({ ui: { ...s.ui, online } }));
const rename = (t, programId, name) => {
  t.store.setState((s) => ({ programs: { ...s.programs, [programId]: { ...s.programs[programId], name } } }));
  t.s.markProgramDirtyForClients(programId);
};

describe('E72 · abrir una etapa sin red', () => {
  it('queda en cola (la ficha lo dice) y llega al cliente al volver la red', async () => {
    const t = await trainerPhone();
    const { clientId, programId } = await linkedClient(t);
    t.s.updateStage(programId, 0, { locked: true });
    await t.s.uploadProgramToClient(clientId, programId);
    expect((await programOnServer(t, clientId)).stages[0].locked).toBe(true);

    // Lo que hace `unlockClientStage`: updateStage + uploadProgramToClient, sin red.
    setOnline(t, false);
    t.s.updateStage(programId, 0, { locked: false });
    await expect(t.s.uploadProgramToClient(clientId, programId)).rejects.toMatchObject({ code: 'NETWORK' });
    expect(t.s.clients[clientId].sendPending).toEqual({ program: true });

    setOnline(t, true);
    expect(await t.s.retrySendQueue()).toEqual({ ok: 1, fail: 0 });
    expect((await programOnServer(t, clientId)).stages[0].locked).toBe(false);
    expect(t.s.clients[clientId].sendPending).toBeUndefined();
  });
});

describe('E80 / A3 · lo que nadie envió no sale solo', () => {
  it('con cambios sin enviar, ni primer plano, ni volver la red, ni arrancar envían nada', async () => {
    const t = await trainerPhone();
    const { clientId, programId } = await linkedClient(t);
    rename(t, programId, 'Fuerza a medias');
    t.s.setOverrideTarget(clientId, t.s.programs[programId].stages[0].days[0].sessionTemplateId, 'ex1', { weight: 50 });
    expect(t.s.clients[clientId]).toMatchObject({ programDirty: true, overridesDirty: true });

    const before = server.calls.length;
    await t.s.retrySendQueue();                       // primer plano / arranque
    setOnline(t, false); setOnline(t, true);
    await t.s.retrySendQueue();                       // vuelve la red
    expect(uploads(UPLOAD_PROGRAM, before) + uploads(UPLOAD_OVERRIDES, before)).toBe(0);
    expect((await programOnServer(t, clientId)).name).toBe('Fuerza');
    expect(t.s.clients[clientId].programDirty).toBe(true);
    expect(t.s.clients[clientId].sendPending).toBeUndefined();
  });

  it('«Enviar todo» sin red deja en cola todo lo que tenía cambios y al volver la red sale', async () => {
    const t = await trainerPhone();
    const a = await linkedClient(t, 'Ana');
    const b = await linkedClient(t, 'Beto');
    rename(t, a.programId, 'Ana v2');
    t.s.setOverrideTarget(b.clientId, t.s.programs[b.programId].stages[0].days[0].sessionTemplateId, 'ex1', { weight: 50 });

    setOnline(t, false);
    const before = server.calls.length;
    expect(await t.s.sendAll()).toEqual({ ok: 0, fail: 2 });
    expect(uploads(UPLOAD_PROGRAM, before) + uploads(UPLOAD_OVERRIDES, before)).toBe(0);   // sin red no sale
    expect(t.s.clients[a.clientId].sendPending).toEqual({ program: true });
    expect(t.s.clients[b.clientId].sendPending).toEqual({ overrides: true });

    setOnline(t, true);
    expect(await t.s.retrySendQueue()).toEqual({ ok: 2, fail: 0 });
    expect((await programOnServer(t, a.clientId)).name).toBe('Ana v2');
    expect(uploads(UPLOAD_OVERRIDES, before)).toBe(1);
    expect(t.s.clients[a.clientId].sendPending).toBeUndefined();
    expect(t.s.clients[b.clientId].sendPending).toBeUndefined();
  });

  it('«Enviar todo» con red envía lo marcado y no deja nada en cola', async () => {
    const t = await trainerPhone();
    const { clientId, programId } = await linkedClient(t);
    rename(t, programId, 'Fuerza v2');
    expect(await t.s.sendAll()).toEqual({ ok: 1, fail: 0 });
    expect((await programOnServer(t, clientId)).name).toBe('Fuerza v2');
    expect(t.s.clients[clientId].sendPending).toBeUndefined();
  });

  it('el reintento manda el programa de ahora, no el de cuando falló', async () => {
    const t = await trainerPhone();
    const { clientId, programId } = await linkedClient(t);
    setOnline(t, false);
    rename(t, programId, 'Versión que falló');
    await expect(t.s.uploadProgramToClient(clientId, programId)).rejects.toMatchObject({ code: 'NETWORK' });
    rename(t, programId, 'Versión de ahora');         // se sigue editando sin pulsar Enviar
    setOnline(t, true);
    await t.s.retrySendQueue();
    expect((await programOnServer(t, clientId)).name).toBe('Versión de ahora');
  });

  it('un fallo que no es de red quita la marca y no se reintenta', async () => {
    const t = await trainerPhone();
    const { clientId, programId } = await linkedClient(t);
    setOnline(t, false);
    await expect(t.s.uploadProgramToClient(clientId, programId)).rejects.toMatchObject({ code: 'NETWORK' });
    expect(t.s.clients[clientId].sendPending).toEqual({ program: true });
    setOnline(t, true);
    t.store.setState((s) => ({ clients: { ...s.clients, [clientId]: { ...s.clients[clientId], slotOwner: null } } }));
    await expect(t.s.uploadProgramToClient(clientId, programId)).rejects.toMatchObject({ code: 'SLOT_GONE' });
    expect(t.s.clients[clientId].sendPending).toBeUndefined();
  });
});

describe('la cola cuando la ficha cambia mientras espera', () => {
  async function queued(t, { clientId, programId }) {
    setOnline(t, false);
    rename(t, programId, 'En cola');
    await expect(t.s.uploadProgramToClient(clientId, programId)).rejects.toMatchObject({ code: 'NETWORK' });
    setOnline(t, true);
  }

  it('congelado: se quita la marca y no se sube', async () => {
    const t = await trainerPhone();
    const a = await linkedClient(t, 'Ana');
    await linkedClient(t, 'Beto');
    await queued(t, a);
    // Plan gratis con una sola plaza con app, y no es la de Ana.
    const betoId = Object.keys(t.s.clients).find((id) => id !== a.clientId);
    t.store.setState((s) => ({ profile: { ...s.profile, isPro: false, freeClientIds: [betoId] } }));
    expect(t.s.isClientFrozen(a.clientId)).toBe(true);
    const before = server.calls.length;
    await t.s.retrySendQueue();
    expect(uploads(UPLOAD_PROGRAM, before)).toBe(0);
    expect(t.s.clients[a.clientId].sendPending).toBeUndefined();
  });

  it('borrado: no queda ficha ni sube nada', async () => {
    const t = await trainerPhone();
    const a = await linkedClient(t);
    await queued(t, a);
    await t.s.deleteClient(a.clientId);
    const before = server.calls.length;
    expect(await t.s.retrySendQueue()).toEqual({ ok: 0, fail: 0 });
    expect(uploads(UPLOAD_PROGRAM, before)).toBe(0);
    expect(t.s.clients[a.clientId]).toBeUndefined();
  });

  it('sin programa activo: se quita la marca', async () => {
    const t = await trainerPhone();
    const a = await linkedClient(t);
    await queued(t, a);
    t.s.setClientActiveProgram(a.clientId, null);
    await t.s.retrySendQueue();
    expect(t.s.clients[a.clientId].sendPending).toBeUndefined();
  });
});

describe('N-09 · salir de la cuenta vacía la cola', () => {
  it('salir de la cuenta quita sendPending de todas las fichas', async () => {
    const t = await trainerPhone();
    const a = await linkedClient(t);
    setOnline(t, false);
    rename(t, a.programId, 'En cola');
    await expect(t.s.uploadProgramToClient(a.clientId, a.programId)).rejects.toMatchObject({ code: 'NETWORK' });
    expect(t.s.clients[a.clientId].sendPending).toBeTruthy();
    await t.s.leaveTrainerAccount();
    expect(t.s.clients[a.clientId].sendPending).toBeUndefined();
  });

  it('salir y entrar en otra cuenta no trae la cola de la vieja', async () => {
    const t = await trainerPhone();
    const a = await linkedClient(t);
    setOnline(t, false);
    rename(t, a.programId, 'En cola');
    await expect(t.s.uploadProgramToClient(a.clientId, a.programId)).rejects.toMatchObject({ code: 'NETWORK' });
    setOnline(t, true);
    await t.s.leaveTrainerAccount();
    await t.s.enterTrainerAccount({ provider: 'google', idToken: 'google:otra' });
    expect(t.s.clients[a.clientId].sendPending).toBeUndefined();
  });

  it('pasar de código a Google se lleva los huecos, y la cola con ellos (R-D1)', async () => {
    const t = await trainerPhone();
    const a = await linkedClient(t);
    setOnline(t, false);
    rename(t, a.programId, 'En cola');
    await expect(t.s.uploadProgramToClient(a.clientId, a.programId)).rejects.toMatchObject({ code: 'NETWORK' });
    setOnline(t, true);
    await t.s.enterTrainerAccount({ provider: 'google', idToken: 'google:otra' });
    expect(t.s.clients[a.clientId].sendPending).toEqual({ program: true });
    await t.s.retrySendQueue();
    expect(t.s.clients[a.clientId].sendPending).toBeUndefined();
    expect(t.s.clients[a.clientId].programDirty).toBe(false);
  });
});

describe('E84 / A10 · un solo camino de envío', () => {
  it('dos envíos al mismo cliente nunca van a la vez', async () => {
    let inflight = 0, max = 0;
    const t = await trainerPhone((cfg) => {
      const db = cfg.trainerSupabase;
      const real = db.rpc.bind(db);
      db.rpc = async (n, args) => {
        if (n !== 'trainer_upload_program') return real(n, args);
        max = Math.max(max, ++inflight);
        try { await tick(); await tick(); return await real(n, args); } finally { inflight -= 1; }
      };
      return cfg;
    });
    const { clientId, programId } = await linkedClient(t);
    max = 0;
    rename(t, programId, 'Fuerza v2');
    await Promise.all([
      t.s.uploadProgramToClient(clientId, programId),
      t.s.uploadProgramToClient(clientId, programId),
      t.s.retrySendQueue(),
    ]);
    expect(max).toBe(1);
  });

  it('dos retrySendQueue a la vez suben una sola vez', async () => {
    const t = await trainerPhone();
    const { clientId, programId } = await linkedClient(t);
    setOnline(t, false);
    rename(t, programId, 'En cola');
    await expect(t.s.uploadProgramToClient(clientId, programId)).rejects.toMatchObject({ code: 'NETWORK' });
    setOnline(t, true);
    const before = server.calls.length;
    await Promise.all([t.s.retrySendQueue(), t.s.retrySendQueue()]);
    expect(uploads(UPLOAD_PROGRAM, before)).toBe(1);
  });

  it('el programa de entrada del invitado sube solo y, sin red, queda en cola como cualquier envío', async () => {
    const t = await trainerPhone();
    const clientId = await t.s.createClient('Ana', { withApp: true });     // invitado: nadie ha canjeado el código
    const programId = t.s.createProgramForClient(clientId, 2, 'Fuerza', null, { openEditor: false });
    setOnline(t, false);
    t.s.setClientActiveProgram(clientId, programId);
    await vi.waitFor(() => expect(t.s.clients[clientId].sendPending).toEqual({ program: true }), { timeout: 4000 });
    expect(t.s.clients[clientId].programDirty).toBe(true);

    setOnline(t, true);
    await t.s.retrySendQueue();
    expect(t.s.clients[clientId].programDirty).toBe(false);
    expect(t.s.clients[clientId].sendPending).toBeUndefined();
    expect((await programOnServer(t, clientId)).name).toBe('Fuerza');
  });
});

describe('E83 · reintento con espera cuando NetInfo no ve el corte', () => {
  it('falla por red con ui.online true: reintenta solo a los 30 s · 2 min · 10 min y se para con la cola vacía', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const t = await trainerPhone();
    const { clientId, programId } = await linkedClient(t);
    rename(t, programId, 'Fuerza v2');

    t.device.offline = true;
    await expect(t.s.uploadProgramToClient(clientId, programId)).rejects.toBeTruthy();
    const attempts = () => server.calls.filter((c) => c.key === UPLOAD_PROGRAM).length;
    const base = attempts();

    await vi.advanceTimersByTimeAsync(29_000);
    expect(attempts()).toBe(base);                    // aún no
    await vi.advanceTimersByTimeAsync(1_500);
    expect(attempts()).toBe(base + 1);                // a los 30 s, falla otra vez
    await vi.advanceTimersByTimeAsync(110_000);
    expect(attempts()).toBe(base + 1);                // la siguiente espera es de 2 min
    await vi.advanceTimersByTimeAsync(11_000);
    expect(attempts()).toBe(base + 2);
    await vi.advanceTimersByTimeAsync(590_000);
    expect(attempts()).toBe(base + 2);                // y luego, cada 10 min
    await vi.advanceTimersByTimeAsync(11_000);
    expect(attempts()).toBe(base + 3);

    t.device.offline = false;
    await vi.advanceTimersByTimeAsync(601_000);       // sale y la cola queda vacía
    expect((await programOnServer(t, clientId)).name).toBe('Fuerza v2');
    expect(t.s.clients[clientId].sendPending).toBeUndefined();
    const done = attempts();
    await vi.advanceTimersByTimeAsync(3_600_000);
    expect(attempts()).toBe(done);                    // vacía: el temporizador está parado
  });

  it('con ui.online false el temporizador sigue pero no intenta', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const t = await trainerPhone();
    const { clientId, programId } = await linkedClient(t);
    setOnline(t, false);
    rename(t, programId, 'En cola');
    await expect(t.s.uploadProgramToClient(clientId, programId)).rejects.toMatchObject({ code: 'NETWORK' });
    const before = server.calls.length;
    await vi.advanceTimersByTimeAsync(31_000);
    expect(uploads(UPLOAD_PROGRAM, before)).toBe(0);
    setOnline(t, true);
    await vi.advanceTimersByTimeAsync(121_000);       // la espera siguiente
    expect(uploads(UPLOAD_PROGRAM, before)).toBe(1);
    expect(t.s.clients[clientId].sendPending).toBeUndefined();
  });
});

describe('E73 · las copias no traen estado de envío', () => {
  it('restaurar una copia con «cambios sin enviar» no hace que la cola pise lo que el cliente ya tiene', async () => {
    const t = await trainerPhone();
    const { clientId, programId } = await linkedClient(t);
    setOnline(t, false);
    rename(t, programId, 'Fuerza (copia de entonces)');
    const oldBackup = JSON.parse(buildBackupJson(t.s));
    setOnline(t, true);
    rename(t, programId, 'Fuerza v2');
    await t.s.uploadProgramToClient(clientId, programId);
    expect((await programOnServer(t, clientId)).name).toBe('Fuerza v2');

    t.s.importData(oldBackup, { clients: true, program: true, templates: true }, { silent: true });
    await t.s.retrySendQueue();                       // primer plano
    expect((await programOnServer(t, clientId)).name).toBe('Fuerza v2');
  });

  it('la copia no guarda sendPending y, si una vieja lo trae, no se restaura', async () => {
    const t = await trainerPhone();
    const { clientId, programId } = await linkedClient(t);
    setOnline(t, false);
    rename(t, programId, 'En cola');
    await expect(t.s.uploadProgramToClient(clientId, programId)).rejects.toMatchObject({ code: 'NETWORK' });
    expect(t.s.clients[clientId].sendPending).toBeTruthy();

    const payload = buildBackupPayload(t.s);
    expect(payload.clients[clientId]).not.toHaveProperty('sendPending');
    expect(t.s.clients[clientId].sendPending).toBeTruthy();   // y la ficha viva no se toca

    // Una copia vieja que lo traiga, restaurada en otro móvil: se descarta.
    const n = await trainerPhone();
    const dirty = JSON.parse(JSON.stringify(payload));
    dirty.clients[clientId].sendPending = { program: true };
    n.s.importData(dirty, { clients: true, program: true, templates: true }, { silent: true });
    expect(n.s.clients[clientId]).toBeDefined();
    expect(n.s.clients[clientId].sendPending).toBeUndefined();
  });
});
