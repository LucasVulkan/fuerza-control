/**
 * C10-02 — Compatibilidad: el `schema.sql` NUEVO se despliega ENCIMA del de antes
 * y la app de hoy (que no conoce nada de C10) sigue funcionando.
 *
 * `test/schema-antes-c10.sql` es una copia congelada del esquema de antes de
 * C10-02 (el de `develop` en ec8417f). El servidor arranca con él, la app de hoy
 * crea huecos y asientos, se carga encima `supabase/schema.sql` y el recorrido
 * básico de `connection.sim.test.js` sigue en verde.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createServer, createDevice, createSimClient } from '../../test/supabaseSim.js';

const BEFORE = fileURLToPath(new URL('../../test/schema-antes-c10.sql', import.meta.url));
const NEW_SQL = readFileSync(fileURLToPath(new URL('../../supabase/schema.sql', import.meta.url)), 'utf8');
const AUDIT = readFileSync(fileURLToPath(new URL('../../supabase/audit.sql', import.meta.url)), 'utf8');

let server;
beforeEach(async () => { server = await createServer({ schema: BEFORE }); });

const upgrade = () => server.db.exec(NEW_SQL);

// ─── Móviles (como en connection.sim.test.js) ─────────────────────────────────

function simConfig(device) {
  return {
    trainerSupabase:    createSimClient(device, { storageKey: 'sb-trainer' }),
    clientSupabase:     createSimClient(device, { storageKey: 'sb-client' }),
    createTempSupabase: () => createSimClient(device, { persistSession: false }),
    migrateLegacySession: async () => {},
    sessionsReady:        async () => {},
  };
}

async function phone(name) {
  const dev = createDevice(server, name);
  vi.resetModules();
  vi.doMock('../src/config/supabase', () => simConfig(dev));
  const { useStore } = await import('./useStore.js');
  useStore.setState((s) => ({ profile: { ...s.profile, isPro: true }, _hasHydrated: true }));
  return { name, device: dev, store: useStore, get s() { return useStore.getState(); } };
}

async function trainOnce(c, id) {
  const programId = c.s.clientSync.trainerProgramIds[0];
  const sessionTemplateId = c.s.programs[programId].stages[0].days[0].sessionTemplateId;
  c.store.setState((s) => ({
    workoutLog: [...s.workoutLog, { id, programId, sessionTemplateId, timestamp: Date.now(), date: new Date().toISOString().slice(0, 10), exercises: [] }],
  }));
  await c.s.uploadHistoryToTrainer();
}

async function programReaches(t, c, clientId, programName) {
  const programId = t.s.createProgramForClient(clientId, 1, programName, null, { openEditor: false });
  await t.s.uploadProgramToClient(clientId, programId);
  await c.s.checkAndPullProgramUpdates();
  return c.s.clientSync.pendingProgramUpdate?.programJson?.program?.name === programName;
}

// ═════════════════════════════════════════════════════════════════════════════

describe('el esquema nuevo encima del de antes', () => {
  it('la app de hoy: un cliente con app entra con el esquema viejo, se despliega el nuevo y todo sigue (recorrido básico)', async () => {
    const t = await phone('entrenador');
    const c = await phone('cliente');
    await t.s.createTrainerCodeAccount();
    const clientId = await t.s.createClient('Ana', { withApp: true });
    const programId = t.s.createProgramForClient(clientId, 2, 'Fuerza', null, { openEditor: false });
    await t.s.uploadProgramToClient(clientId, programId);
    const code = t.s.clients[clientId].code;
    await c.s.validateClientCode(code);
    await c.s.linkToTrainer(code);
    await trainOnce(c, 'antes');
    const [before] = await server.slots();
    expect(before.client_id).toBeTruthy();

    await upgrade();                                  // ← se ejecuta schema.sql encima

    const [after] = await server.slots();
    expect(after).toMatchObject({ id: before.id, client_id: before.client_id, client_code: code, sessions_count: 1 });
    await trainOnce(c, 'despues');
    await t.s.refreshTrainerSlots();
    expect(t.s.clients[clientId]).toMatchObject({ seated: true, remoteSessionsCount: 2 });
    expect(await programReaches(t, c, clientId, 'Fuerza 2')).toBe(true);
    expect(await server.admin(AUDIT)).toEqual([]);
  });

  it('un cliente nuevo tras desplegar: la app de hoy lo da de alta con dos argumentos y le sale con código', async () => {
    const t = await phone('entrenador');
    const c = await phone('cliente');
    await t.s.createTrainerCodeAccount();
    await upgrade();
    const clientId = await t.s.createClient('Beto', { withApp: true });
    const programId = t.s.createProgramForClient(clientId, 2, 'Fuerza', null, { openEditor: false });
    await t.s.uploadProgramToClient(clientId, programId);
    const code = t.s.clients[clientId].code;
    expect(code).toBeTruthy();
    const call = server.calls.filter((x) => x.key === 'rpc:trainer_create_slot');
    expect(call.length).toBeGreaterThan(0);
    await c.s.validateClientCode(code);
    await c.s.linkToTrainer(code);
    expect((await server.slots())[0].client_id).toBeTruthy();
  });

  it('lo que había (huecos, asiento, borrados de antes, código de uno que se fue) queda tal cual y el audit sale vacío', async () => {
    const db = (name) => createSimClient(createDevice(server, name));
    const t = db('t');
    await t.functions.invoke('create-trainer-account', { body: { code: 'ABCD-EFGH-JKLM' } });
    await t.auth.signInWithPassword({ email: 'trainer-abcdefghjklm@noreply.fuerzacontrol.com', password: 'ABCD-EFGH-JKLM' });
    const mk = async (name, local) => (await t.rpc('trainer_create_slot', { p_client_name: name, p_local_id: local })).data[0];
    const a = await mk('Ana', 'client_a');
    const b = await mk('Beto', null);
    const gone = await mk('Cris', 'client_c');
    await t.rpc('trainer_delete_slot', { p_slot_id: gone.slot_id, p_kind: 'deleted' });
    const c = db('c');
    await c.auth.signInAnonymously();
    expect((await c.rpc('link_client_to_slot', { p_code: a.code })).error).toBeNull();
    const before = await server.slots();

    await upgrade();
    await upgrade();

    expect(await server.slots()).toEqual(before);
    expect((await server.admin('select local_id from public.deleted_slots'))).toEqual([{ local_id: null }]);
    // las funciones de ayer, sin cambios para quien las llama
    expect((await t.rpc('trainer_deleted_slots', { p_ids: [gone.slot_id] })).data).toEqual([{ slot_id: gone.slot_id, kind: 'deleted' }]);
    expect((await t.rpc('trainer_reissue_client_code', { p_slot_id: b.slot_id })).error).toBeNull();
    expect((await t.rpc('trainer_clear_code', { p_slot_id: a.slot_id })).error.message).toBe('SLOT_OCCUPIED');
    expect(await server.admin(AUDIT)).toEqual([]);
  });
});
