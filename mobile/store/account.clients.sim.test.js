/**
 * Los clientes son de la cuenta (docs/specs/C10-clientes-de-la-cuenta.md), con
 * varios móviles contra el SQL real de `supabase/schema.sql` (PGlite).
 *
 * C10-03: el id de la ficha vive en el hueco (`local_id`); recuperar la cuenta
 * lo usa, y el primer refresco fija los que faltan o no cuadran (N-20, N-08).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { linkOf, assertFacts, NO_SLOT } from '../src/utils/clientLink';
import { buildBackupJson } from '../src/utils/backupPayload';
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
    await t.s.enterTrainerAccount(google('g1'));
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
