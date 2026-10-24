/**
 * I02-04 — auditoría del plan gratis por reglas (R-E1…R-E4) + usuario honrado/tramposo.
 *
 * Cada `it` fija lo que pasa HOY:
 *   «Pn hoy: …»      hallazgo: el comportamiento actual viola una regla (el test PASA hoy;
 *                    cuando se arregle, la última aserción pasará a ser la de la regla).
 *   «R-Ex cumple: …» la regla se cumple.
 *   «NO funciona: …» intento de saltarse el plan que el store ya frena.
 * En los «hoy», el comentario `regla:` marca el valor que exigiría la regla.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { buildBackupPayload } from '../src/utils/backupPayload';
import { needsClientChoice, templateCounts, clientLimitReason, freeGates } from '../src/utils/freePlan';
import { copySources } from '../src/utils/programOwnership';

const syncMock = {
  getTrainerSlots: vi.fn(async () => []),
  createClientSlot: vi.fn(), uploadProgram: vi.fn(), uploadTrainerLog: vi.fn(async () => {}), downloadHistory: vi.fn(),
  downloadSlotProgram: vi.fn(async () => null), uploadOverrides: vi.fn(), deleteClientSlot: vi.fn(async () => true),
  updateTrainerNameForSlots: vi.fn(async () => 0), reissueClientCode: vi.fn(), transferMySlotsTo: vi.fn(async () => 0),
  getSlotByClientCode: vi.fn(), linkClientToSlot: vi.fn(), seatOf: vi.fn(), uploadHistory: vi.fn(),
  releaseClientSlot: vi.fn(async () => 0), transferMySeatTo: vi.fn(),
};
vi.mock('../src/services/supabaseSync', () => syncMock);

const authMock = {
  trainerCandidateFromIdToken: vi.fn(), trainerCandidateFromCode: vi.fn(), trainerCandidateNewCode: vi.fn(),
  adoptTrainer: vi.fn(async () => {}),
  trainerSessionUserId: vi.fn(async () => useStore.getState().trainerSync.userId),
  signInTrainerWithCode: vi.fn(), signOutTrainer: vi.fn(async () => {}),
  ensureClientSession: vi.fn(async () => 'anon_1'), clientSessionUserId: vi.fn(async () => 'anon_1'), clientProvider: vi.fn(async () => null),
  clientCandidateFromIdToken: vi.fn(), adoptClient: vi.fn(), signOutClient: vi.fn(async () => {}),
  deleteTrainerUser: vi.fn(), deleteClientUser: vi.fn(),
};
vi.mock('../src/services/supabaseAuth', () => authMock);
vi.mock('../src/config/supabase', () => ({ migrateLegacySession: async () => {} }));

const { useStore } = await import('./useStore.js');
const S = () => useStore.getState();

// Secciones fijas que manda DriveBackupScreen.jsx.
const DRIVE_SECTIONS = { program: true, log: true, templates: true, customExercises: true, clients: true };

const mk = (id, extra = {}) => ({ id, name: id, status: 'active', syncSlotId: null, activeProgramId: null, ...extra });
const mkClients = (ids, over = {}) => Object.fromEntries(ids.map((id) => [id, mk(id, over[id])]));
const prog = (id, kind = 'template', owner = 'me') => ({
  id, name: id, owner, kind, status: 'active',
  stages: [{ id: `${id}_st`, name: 'E1', days: [], durationWeeks: null }],
});
const sesTpl = (id) => ({ id, name: id, owner: 'me', programId: null, kind: 'template', exercises: [], blocks: [] });
const slot = (n, extra = {}) => ({ id: `slot_${n}`, client_name: n, client_code: n, sessions_count: 0, client_id: `u${n}`, ...extra });
/** Cuenta de entrenador sin Pro y vacía. */
const free = (extra = {}) => useStore.setState((s) => ({
  clients: {}, programs: {}, sessionTemplates: {}, clientLogs: {}, workoutLog: [], activeSession: null, _refreshingSlots: null,
  profile: { ...s.profile, isPro: false, freeClientIds: [] },
  ui: { ...s.ui, paywallReason: null },
  trainerSync: { ...s.trainerSync, userId: 'trainer_1', mode: 'code', code: 'X', deletedSlotIds: [], lastSeenSessionsCount: {} },
  ...extra,
}));
/** a,b,c elegidos (activos) y d, e congelados. */
const frozenD = (extraD = {}) => {
  free({ clients: mkClients(['a', 'b', 'c', 'd', 'e'], { d: extraD }) });
  S().setFreeClientIds(['a', 'b', 'c']);
  expect(S().isClientFrozen('d')).toBe(true);   // montaje
};
let slotN = 0;
const newSlot = async () => { slotN += 1; return { slotId: `S${slotN}`, clientCode: `C${slotN}` }; };

beforeEach(() => {
  Object.values(syncMock).forEach((f) => f.mockReset());
  syncMock.getTrainerSlots.mockResolvedValue([]);
  syncMock.downloadSlotProgram.mockResolvedValue(null);
  syncMock.uploadTrainerLog.mockResolvedValue(undefined);
  syncMock.deleteClientSlot.mockResolvedValue(true);
  syncMock.updateTrainerNameForSlots.mockResolvedValue(0);
  syncMock.transferMySlotsTo.mockResolvedValue(0);
  syncMock.releaseClientSlot.mockResolvedValue(0);
  syncMock.createClientSlot.mockImplementation(newSlot);
  free();
});

describe('R-E1 — todos los caminos que crean pasan por la puerta (importar y restaurar)', () => {
  it('P1 aceptado (24-oct, decisión 1): importData con plan gratis mete 5 plantillas de programa y 5 de sesión (regla R-E1: ≤1 o paywall)', () => {
    const programs = {}; const sessionTemplates = {};
    for (let i = 0; i < 5; i++) { programs[`pt${i}`] = prog(`pt${i}`); sessionTemplates[`st${i}`] = sesTpl(`st${i}`); }
    S().importData({ version: '4', exportType: 'full_backup', programs, sessionTemplates }, { templates: true, templatesMode: 'merge' }, { silent: true });
    expect(Object.keys(S().programs)).toHaveLength(5);   // montaje: el import entró
    const c = templateCounts(S());
    expect(c.programTemplates).toBe(5);                  // regla: ≤ 1
    expect(c.sessionTemplates).toBe(5);                  // regla: ≤ 1
    expect(S().ui.paywallReason).toBe(null);             // regla: 'templates'
    expect(S().createEmptyProgram(2, 'X', 'template')).toBe(null);   // y crear una más sí se frena
  });

  it('P2 aceptado (24-oct, decisión 1): restaurar de Drive (secciones fijas, sin `templates`) mete 3 plantillas de sesión (regla R-E1: ≤1)', () => {
    const backup = buildBackupPayload({
      profile: {}, clients: {},
      programs: { t1: prog('t1'), t2: prog('t2') },
      sessionTemplates: { s1: sesTpl('s1'), s2: sesTpl('s2'), s3: sesTpl('s3') },
    });
    S().importData(backup, DRIVE_SECTIONS, { silent: true });
    expect(Object.keys(S().sessionTemplates)).toHaveLength(3);   // montaje
    expect(templateCounts(S()).sessionTemplates).toBe(3);        // regla: ≤ 1
    expect(S().ui.paywallReason).toBe(null);
  });

  it('P3 arreglado (E38): restaurar de Drive devuelve las plantillas de programa del backup', () => {
    const backup = { version: '4', exportType: 'full_backup', programs: { pt: prog('pt') } };
    S().importData(backup, DRIVE_SECTIONS, { silent: true });
    expect(S().ui.paywallReason).toBe(null);
    expect(S().programs.pt).toBeTruthy();
  });

  it('P4 aceptado (24-oct, decisión 1): importForClient de un fichero con plantillas de sesión las mete todas (mergeFileSessions) (regla R-E1: ≤1)', () => {
    free({ clients: { a: mk('a') } });
    const file = { version: '4', program: prog('p_a', 'program'), sessionTemplates: { s1: sesTpl('s1'), s2: sesTpl('s2') } };
    S().importForClient('a', file, 'replace');
    expect(S().programs.p_a?.owner).toBe('a');                   // montaje
    expect(templateCounts(S()).sessionTemplates).toBe(2);        // regla: ≤ 1
  });

  it('P5 aceptado (24-oct, decisión 1): importData (clients) mete 5 clientes sin paywall con plan gratis (regla R-E1: ≤3)', () => {
    S().importData({ version: '4', clients: mkClients(['a', 'b', 'c', 'd', 'e']) }, { clients: true }, { silent: true });
    expect(Object.keys(S().clients)).toHaveLength(5);   // regla: ≤ 3
    expect(S().ui.paywallReason).toBe(null);
  });

  it('P6 aceptado (24-oct, restaurar, no crear): refreshTrainerSlots crea 3 fichas CON APP sin puerta; no caben y quedan todas congeladas (regla R-E1: ≤1 con app)', async () => {
    syncMock.getTrainerSlots.mockResolvedValueOnce(['1', '2', '3'].map((n) => slot(n)));
    await S().refreshTrainerSlots();
    expect(Object.keys(S().clients)).toHaveLength(3);   // regla: ≤ 1 con app
    expect(S().ui.paywallReason).toBe(null);
    expect(needsClientChoice({ isPro: false, clients: S().clients, freeClientIds: [] })).toBe(true);
  });

  it('P22 arreglado (E40, R-E4): importar 2 clientes con 3 activos congela solo a los 2 nuevos; no se puede rotar la elección', () => {
    free({ clients: mkClients(['a', 'b', 'c']) });
    expect(['a', 'b', 'c'].some((id) => S().isClientFrozen(id))).toBe(false);   // montaje: caben
    S().importData({ version: '4', exportType: 'full_backup', clients: mkClients(['d', 'e']) }, { clients: true }, { silent: true });
    expect(['a', 'b', 'c'].some((id) => S().isClientFrozen(id))).toBe(false);   // los suyos siguen
    expect(['d', 'e'].every((id) => S().isClientFrozen(id))).toBe(true);        // solo se congela lo nuevo
    S().setFreeClientIds(['c', 'd', 'e']);
    expect(S().isClientFrozen('d')).toBe(true);    // lo elegido queda fijo
    expect(S().isClientFrozen('a')).toBe(false);
    S().deleteClient('c');
    expect(S().isClientFrozen('d')).toBe(true);    // el hueco liberado no se ocupa solo
    S().setFreeClientIds(['d']);
    expect(S().isClientFrozen('d')).toBe(false);   // pero se puede ocupar
  });

  it('P23 aceptado (24-oct, decisión 1: asignar lo que tienes): la biblioteca de programas propios archivados es una bolsa de plantillas sin límite (regla R-E1: ≤1 plantilla)', () => {
    free({ clients: { cx: mk('cx') } });
    for (let i = 0; i < 5; i++) expect(S().createEmptyProgram(2, `Lib${i}`, 'program')).toBeTruthy();   // montaje
    const mine = copySources(S().programs, S().clients, 'cx', S().profile.activeProgramId).find((g) => g.owner === 'me');
    expect(mine.items.length).toBeGreaterThanOrEqual(4);   // regla: ≤ 1
    expect(S().cloneProgramFromTemplate(mine.items[0].program.id, { owner: 'cx', name: 'copia' })).toBeTruthy();
  });

  it('R-E1 cumple: createClient y connectClientToCloud se paran en el store con 1 con app', async () => {
    free({ clients: { a: mk('a', { syncSlotId: 's_a' }), b: mk('b') } });
    expect(await S().connectClientToCloud('b')).toBe(false);
    expect(S().ui.paywallReason).toBe('connected');
    expect(await S().createClient('x', { withApp: true })).toBe(null);
  });

  it('NO funciona: crear plantillas de programa/sesión por createEmptyProgram, clone, createFreeTemplate o copyFreeTemplate (límite 1)', () => {
    expect(S().createEmptyProgram(2, 'T1', 'template')).toBeTruthy();
    expect(S().createEmptyProgram(2, 'T2', 'template')).toBe(null);
    const src = Object.keys(S().programs)[0];
    expect(S().cloneProgramFromTemplate(src, { kind: 'template' })).toBe(null);
    expect(S().createFreeTemplate(null, 'me', { asTemplate: true })).toBeTruthy();
    expect(S().createFreeTemplate(null, 'me', { asTemplate: true })).toBe(null);
    const tid = Object.keys(S().sessionTemplates).find((id) => S().sessionTemplates[id].kind === 'template');
    expect(S().copyFreeTemplate(tid, { asTemplate: true })).toBe(null);
  });
});

describe('R-E1 — carreras al crear/conectar con app', () => {
  const slow = () => syncMock.createClientSlot.mockImplementation(() => new Promise((r) => setTimeout(() => { slotN += 1; r({ slotId: `S${slotN}`, clientCode: `C${slotN}` }); }, 20)));

  it('P16 arreglado (E42): dos createClient «con app» solapados (red lenta, doble toque) → solo el primero entra; el segundo abre el paywall', async () => {
    slow();
    const [x, y] = await Promise.all([S().createClient('A', { withApp: true }), S().createClient('B', { withApp: true })]);
    expect(x).toBeTruthy();
    expect(y).toBe(null);
    expect(S().ui.paywallReason).toBe('connected');
    expect(Object.values(S().clients)).toHaveLength(1);
    expect(Object.values(S().clients).filter((c) => c.syncSlotId)).toHaveLength(1);
    expect(Object.values(S().clients).some((c) => c.syncPending)).toBe(false);   // la marca se quita al terminar
    expect(clientLimitReason(Object.values(S().clients))).toBe(null);
  });

  it('P17 arreglado (E42): dos connectClientToCloud solapados sobre clientes distintos → [true, false]', async () => {
    free({ clients: mkClients(['a', 'b']) });
    slow();
    const r = await Promise.all([S().connectClientToCloud('a'), S().connectClientToCloud('b')]);
    expect(r).toEqual([true, false]);
    expect(S().ui.paywallReason).toBe('connected');
    expect(Object.values(S().clients).filter((c) => c.syncSlotId)).toHaveLength(1);
    expect(Object.values(S().clients).some((c) => c.syncPending)).toBe(false);
    expect(clientLimitReason(Object.values(S().clients))).toBe(null);
  });

  it('E42: si el servidor falla, la marca se quita y la plaza queda libre; pulsar dos veces el mismo cliente no abre dos altas', async () => {
    free({ clients: mkClients(['a']) });
    syncMock.createClientSlot.mockRejectedValueOnce(new Error('red'));
    await expect(S().connectClientToCloud('a')).rejects.toThrow();
    expect(S().clients.a.syncPending).toBeUndefined();
    slow();
    const r = await Promise.all([S().connectClientToCloud('a'), S().connectClientToCloud('a')]);
    expect(r).toEqual([true, false]);
    expect(syncMock.createClientSlot).toHaveBeenCalledTimes(2);   // el que falló + el único bueno
  });

  it('P18 arreglado (E42): un refresco que cruza con createClient(withApp) no recrea el hueco; un hueco = una ficha', async () => {
    let resolveSlot;
    syncMock.createClientSlot.mockReturnValueOnce(new Promise((r) => { resolveSlot = r; }));
    const p = S().createClient('Ana', { withApp: true });
    syncMock.getTrainerSlots.mockResolvedValueOnce([{ id: 'S1', client_name: 'Ana', client_code: 'CODE1', sessions_count: 0 }]);
    await S().refreshTrainerSlots();
    expect(Object.values(S().clients)).toHaveLength(1);   // el refresco no creó la ficha «recuperada»
    resolveSlot({ slotId: 'S1', clientCode: 'CODE1' });
    await p;
    const list = Object.values(S().clients);
    expect(list).toHaveLength(1);
    expect(list.filter((c) => c.syncSlotId === 'S1')).toHaveLength(1);
    expect(needsClientChoice({ isPro: false, clients: S().clients, freeClientIds: [] })).toBe(false);
  });
});

describe('R-E2 — el congelado no se toca ni sincroniza (solo el contador)', () => {
  const setup = () => {
    free({
      clients: mkClients(['a', 'b', 'c', 'd'], { d: { activeProgramId: 'p_d', syncSlotId: 's_d', syncLinked: true, progress: { currentStageIndex: 0 } } }),
      programs: { p_d: prog('p_d', 'program', 'd') },
      sessionTemplates: { free_d: { id: 'free_d', name: 'L', owner: 'd', programId: null, exercises: [], blocks: [] } },
    });
    S().setFreeClientIds(['a', 'b', 'c']);
    expect(S().isClientFrozen('d')).toBe(true);   // montaje
  };

  it('P7 hoy: las acciones de escritura del store sobre el programa/sesión de un congelado no tienen guard (la protección es solo de pantalla) (regla R-E2)', () => {
    setup();
    S().setOverrideTarget('d', 'tpl_x', 'squat', { minReps: 5 });
    S().updateStage('p_d', 0, { name: 'Cambiada' });
    S().addStageToProgram('p_d', { name: 'E2' });
    S().renameProgram('p_d', 'Editado');
    S().addExercise('free_d', Object.keys(S().exerciseLibrary)[0]);
    expect(S().isClientFrozen('d')).toBe(true);   // sigue congelado tras editar
    expect(S().clients.d.overridesDirty).toBe(true);             // regla: sin cambios
    expect(S().programs.p_d.stages[0].name).toBe('Cambiada');
    expect(S().programs.p_d.stages).toHaveLength(2);
    expect(S().programs.p_d.name).toBe('Editado');
    expect(S().sessionTemplates.free_d.exercises).toHaveLength(1);
    expect(S().ui.paywallReason).toBe(null);                     // regla: 'frozen'
  });

  it('P8 hoy: los setters de ficha (info, nombre, cobros, peso) no tienen guard para el congelado (regla R-E2)', () => {
    frozenD();
    S().updateClientInfo('d', { notes: 'x', status: 'inactive' });
    S().renameClient('d', 'Renombrado');
    S().addClientBilling('d', { amount: 10 });
    S().addClientBodyWeight('d', '2026-10-01', 70);
    S().setOverrideTarget('d', 'tplX', 'ex1', { sets: 5 });
    expect(S().isClientFrozen('d')).toBe(true);
    expect(S().clients.d.name).toBe('Renombrado');         // regla: 'd'
    expect(S().clients.d.billing).toHaveLength(1);         // regla: 0
    expect(S().clients.d.overridesDirty).toBe(true);
    expect(S().ui.paywallReason).toBe(null);               // regla: 'frozen'
  });

  it('P9 hoy: refreshTrainerSlots trae del servidor la etapa (`progress`) del congelado, no solo el contador (regla R-E2: solo contador)', async () => {
    setup();
    syncMock.getTrainerSlots.mockResolvedValueOnce([{ id: 's_d', client_name: 'd', client_code: 'C', sessions_count: 7, client_id: 'u', progress: { currentStageIndex: 3 } }]);
    await S().refreshTrainerSlots();
    expect(S().clients.d.remoteSessionsCount).toBe(7);           // el contador: permitido
    expect(S().clients.d.progress.currentStageIndex).toBe(3);    // regla: 0
  });

  it('P10 hoy: importData (backup) reescribe ficha, programa y log de un congelado (regla R-E2)', () => {
    free({
      clients: mkClients(['a', 'b', 'c', 'd', 'e']),
      programs: { pd: prog('pd', 'program', 'd') },
    });
    useStore.setState((s) => ({ clients: { ...s.clients, d: { ...s.clients.d, activeProgramId: 'pd' } } }));
    S().setFreeClientIds(['a', 'b', 'c']);
    expect(S().isClientFrozen('d')).toBe(true);   // montaje
    expect(S().importForClient('d', { version: '4', program: prog('px', 'program') }, 'replace')).toBe(null);   // importForClient sí lo rechaza
    S().importData({
      version: '4', exportType: 'full_backup',
      clients: { d: { id: 'd', name: 'D-EDITADO', notes: 'inyectado', activeProgramId: 'pd2', status: 'active' } },
      programs: { pd2: prog('pd2', 'program', 'd') },
      clientLogs: { d: [{ id: 'l1', timestamp: 1, sessionTemplateId: 't', exercises: [] }] },
    }, { clients: true }, { silent: true });
    expect(S().isClientFrozen('d')).toBe(true);
    expect(S().clients.d.name).toBe('D-EDITADO');            // regla: 'd'
    expect(S().clients.d.activeProgramId).toBe('pd2');       // regla: 'pd'
    expect(S().clientLogs.d).toHaveLength(1);                // regla: 0
  });

  it('P11 hoy: un entreno en curso de un cliente que luego se congela se guarda en su log (regla R-E2)', () => {
    free({ clients: mkClients(['d']), sessionTemplates: { t1: { id: 't1', name: 'S', programId: null, owner: 'd', exercises: [{ exerciseId: 'ex1', sets: 1, minReps: 5, maxReps: 5 }] } } });
    S().startSession('t1', { forClient: 'd' });
    useStore.setState((s) => ({ activeSession: { ...s.activeSession, setsState: { ex1: [{ weight: '50', reps: '5', time: '', done: true }] } } }));
    expect(S().activeSession.forClient).toBe('d');
    useStore.setState((s) => ({
      clients: { ...s.clients, ...mkClients(['e', 'f', 'g']) },
      profile: { ...s.profile, freeClientIds: ['e', 'f', 'g'] },   // R-E4: lo elegido sigue, así que se elige a los otros tres
    }));
    expect(S().isClientFrozen('d')).toBe(true);   // montaje: se congeló con el entreno abierto
    S().saveSession();
    expect((S().clientLogs.d ?? []).length).toBe(1);   // regla: 0
  });

  it('R-E2 cumple: las cuatro de red lanzan y no llaman al servidor', async () => {
    setup();
    await expect(S().uploadProgramToClient('d', 'p_d')).rejects.toThrow();
    await expect(S().sendOverrides('d')).rejects.toThrow();
    await expect(S().downloadClientHistory('d')).rejects.toThrow();
    await expect(S().reissueClientCode('d')).rejects.toThrow();
    expect(syncMock.uploadProgram).not.toHaveBeenCalled();
    expect(syncMock.uploadOverrides).not.toHaveBeenCalled();
    expect(syncMock.downloadHistory).not.toHaveBeenCalled();
    expect(syncMock.reissueClientCode).not.toHaveBeenCalled();
  });

  it('NO funciona: createFreeTemplate / createProgramForClient hacia un congelado (paywall «frozen»)', () => {
    frozenD();
    expect(S().createFreeTemplate(null, 'd')).toBe(null);
    expect(S().createProgramForClient('d', 2, 'x')).toBe(null);
    expect(S().ui.paywallReason).toBe('frozen');
  });
});

describe('R-E3 — al volver a pagar se recupera todo', () => {
  it('P12 arreglado (E39): reinstalar sin Pro con 3 huecos con app → los 3 recuperan su programa aunque nazcan congelados (R-E3)', async () => {
    syncMock.getTrainerSlots.mockResolvedValue(['1', '2', '3'].map((n) => slot(n)));
    syncMock.downloadSlotProgram.mockResolvedValue({ program: prog('p_srv', 'program') });
    await S().refreshTrainerSlots();
    expect(Object.keys(S().clients)).toHaveLength(3);
    expect(syncMock.downloadSlotProgram).toHaveBeenCalledTimes(3);
    expect(Object.values(S().clients).every((c) => !!c.activeProgramId && !c.programMissing)).toBe(true);
    const first = Object.keys(S().clients)[0];
    S().setFreeClientIds([first]);
    expect(S().isClientFrozen(first)).toBe(false);
    useStore.setState((s) => ({ profile: { ...s.profile, isPro: true } }));
    await S().refreshTrainerSlots();
    expect(syncMock.downloadSlotProgram).toHaveBeenCalledTimes(3);   // ya no hay nada que reintentar
  });

  it('E39: una bajada que falla se reintenta en el siguiente refresco; sin la marca no se reintenta (programa quitado a propósito)', async () => {
    syncMock.getTrainerSlots.mockResolvedValue([slot('1')]);
    syncMock.downloadSlotProgram.mockRejectedValueOnce(new Error('red'));
    await S().refreshTrainerSlots();
    const id = Object.keys(S().clients)[0];
    expect(S().clients[id].programMissing).toBe(true);
    expect(S().clients[id].activeProgramId).toBe(null);
    syncMock.downloadSlotProgram.mockResolvedValue({ program: prog('p_srv', 'program') });
    await S().refreshTrainerSlots();
    expect(S().clients[id].activeProgramId).toBeTruthy();
    expect(S().clients[id].programMissing).toBeUndefined();
    // el entrenador le quita el programa: sin marca, el refresco no lo vuelve a bajar
    useStore.setState((st) => ({ clients: { ...st.clients, [id]: { ...st.clients[id], activeProgramId: null } } }));
    syncMock.downloadSlotProgram.mockClear();
    await S().refreshTrainerSlots();
    expect(syncMock.downloadSlotProgram).not.toHaveBeenCalled();
  });
});

describe('R-E4 — la elección no se rehace', () => {
  it('P13 aceptado (24-oct, decisión 2): reinstalar + restaurar backup (o Drive) → la elección no vuelve y se puede elegir otra (regla R-E4)', () => {
    const backup = buildBackupPayload({ profile: { freeClientIds: ['a', 'b', 'c'] }, clients: mkClients(['a', 'b', 'c', 'd']), programs: {}, sessionTemplates: {} });
    S().importData(backup, DRIVE_SECTIONS, { silent: true });   // instalación nueva: perfil por defecto
    expect(Object.keys(S().clients)).toHaveLength(4);            // montaje
    expect(S().profile.freeClientIds).toEqual([]);               // regla: ['a','b','c']
    S().setFreeClientIds(['d', 'a', 'b']);
    expect(S().isClientFrozen('d')).toBe(false);                 // regla: d estaba fuera
    expect(S().isClientFrozen('c')).toBe(true);
  });

  it('P14 hoy: salir de la cuenta y crear otra → los de con app pasan a «de otra cuenta», nada congelado, y se conecta al que no se eligió (regla R-E4)', async () => {
    free({
      clients: { a: mk('a', { syncSlotId: 's_a', syncLinked: true }), b: mk('b', { syncSlotId: 's_b', syncLinked: true }), c: mk('c') },
    });
    S().setFreeClientIds(['a', 'c']);
    expect(S().isClientFrozen('b')).toBe(true);    // montaje
    await S().leaveTrainerAccount();
    authMock.trainerCandidateNewCode.mockResolvedValueOnce({ userId: 'trainer_2', code: 'NEW', existed: false });
    syncMock.getTrainerSlots.mockResolvedValueOnce([]);   // la cuenta nueva no tiene huecos
    const orig = useStore.getState().syncPurchaserId;
    S().syncPurchaserId = async () => {};                 // fuera del alcance (RevenueCat)
    try {
      await S().createTrainerCodeAccount();
      expect(S().clients.b.syncOrphan).toBe(true);
      expect(S().isClientFrozen('b')).toBe(false);          // regla: true
      expect(await S().connectClientToCloud('b')).toBe(true);
      expect(S().clients.b.syncSlotId).toMatch(/^S\d+$/);
      expect(S().isClientFrozen('b')).toBe(false);
    } finally { S().syncPurchaserId = orig; }
  });

  it('P15 arreglado (E40, R-E4): restaurar un backup viejo donde dos elegidos tenían hueco mantiene lo elegido por orden hasta el tope y congela el resto, sin reabrir la hoja', () => {
    free({ clients: mkClients(['a', 'b', 'c', 'd', 'e']) });
    S().setFreeClientIds(['a', 'b', 'c']);
    expect(S().isClientFrozen('d')).toBe(true);   // montaje
    S().importData({ version: '4', exportType: 'full_backup', clients: {
      b: { id: 'b', name: 'b', syncSlotId: 'sb', status: 'active' },
      c: { id: 'c', name: 'c', syncSlotId: 'sc', status: 'active' },
    } }, { clients: true }, { silent: true });
    expect(needsClientChoice({ isPro: false, clients: S().clients, freeClientIds: S().profile.freeClientIds })).toBe(false);
    expect(['a', 'b'].map((id) => S().isClientFrozen(id))).toEqual([false, false]);   // a y b caben (1 con app)
    expect(['c', 'd', 'e'].map((id) => S().isClientFrozen(id))).toEqual([true, true, true]);   // c sobra (2º con app)
    S().setFreeClientIds(['d', 'e', 'a']);
    expect(S().isClientFrozen('d')).toBe(true);   // no se rota
  });

  it('R-E4 cumple: setFreeClientIds no suelta lo elegido; importData no escribe freeClientIds', () => {
    free({ clients: mkClients(['a', 'b', 'c', 'd']) });
    S().setFreeClientIds(['a', 'b', 'c']);
    S().setFreeClientIds(['d']);
    expect(S().isClientFrozen('d')).toBe(true);
    S().importData(buildBackupPayload({ profile: { freeClientIds: ['d'] }, clients: mkClients(['a', 'b', 'c', 'd']), programs: {}, sessionTemplates: {} }), { clients: true }, { silent: true });
    expect(S().profile.freeClientIds).toEqual(['a', 'b', 'c']);
  });

  it('NO funciona: rotar lo elegido con setFreeClientIds sin invalidar', () => {
    free({ clients: mkClients(['a', 'b', 'c', 'd', 'e']) });
    S().setFreeClientIds(['a', 'b', 'c']);
    S().setFreeClientIds(['d', 'e']);
    S().setFreeClientIds(['d', 'e', 'a']);
    expect(S().profile.freeClientIds).toEqual(['a', 'b', 'c']);
    expect(S().isClientFrozen('d')).toBe(true);
  });

  it('NO funciona: borrar un elegido, ocupar el hueco y restaurarlo por backup no rota nada', () => {
    free({ clients: mkClients(['a', 'b', 'c', 'd', 'e']) });
    S().setFreeClientIds(['a', 'b', 'c']);
    S().deleteClient('c');
    S().setFreeClientIds(['d']);
    expect(S().profile.freeClientIds).toEqual(['a', 'b', 'd']);   // el id viejo se poda al guardar
    S().importData({ version: '4', exportType: 'full_backup', clients: { c: { id: 'c', name: 'c', status: 'active' } } }, { clients: true }, { silent: true });
    expect(S().isClientFrozen('c')).toBe(true);
    expect(S().isClientFrozen('d')).toBe(false);
  });
});

describe('Usuario honrado — lo que el plan permite pero se bloquea o cuenta mal', () => {
  it('P19 arreglado (E41): tras caducar con 5 clientes (3 elegidos sin app) se puede pasar uno activo a la app (1 con app), y un congelado no', async () => {
    free({ clients: mkClients(['a', 'b', 'c', 'd', 'e']) });
    S().setFreeClientIds(['a', 'b', 'c']);
    syncMock.createClientSlot.mockResolvedValue({ slotId: 'S9', clientCode: 'C9' });
    expect(S().isClientFrozen('a')).toBe(false);   // montaje: a es elegido y activo
    const g = freeGates({ isPro: false, clients: S().clients, freeClientIds: S().profile.freeClientIds, programs: {}, sessionTemplates: {} });
    expect(g.client('a')).toBe(null);
    expect(g.connect('a')).toBe(null);
    expect(g.connect('d')).toBe('frozen');
    expect(await S().connectClientToCloud('a')).toBe(true);
    expect(S().ui.paywallReason).toBe(null);
    expect(S().clients.a.syncSlotId).toBe('S9');
    expect(await S().connectClientToCloud('b')).toBe(false);   // ya hay 1 con app entre los activos
    expect(S().ui.paywallReason).toBe('connected');
    expect(await S().connectClientToCloud('d')).toBe(false);
    expect(S().ui.paywallReason).toBe('frozen');
    expect(await S().createClient('nuevo')).toBe(null);   // crear sigue contando a todos
    expect(S().ui.paywallReason).toBe('clients');
  });

  it('P20 aceptado (24-oct, decisión 4: los inactivos cuentan): los clientes inactivos ocupan plaza: 3 inactivos y no se puede crear uno nuevo (honrado)', async () => {
    free({ clients: mkClients(['a', 'b', 'c'], { a: { status: 'inactive' }, b: { status: 'inactive' }, c: { status: 'inactive' } }) });
    expect(Object.values(S().clients).every((c) => c.status === 'inactive')).toBe(true);   // montaje
    expect(await S().createClient('Nuevo')).toBe(null);   // regla: id (si los inactivos no cuentan)
    expect(S().ui.paywallReason).toBe('clients');
  });

  it('P21 arreglado (E40, R-E4): un huérfano (otra cuenta) vuelve a contar como con app; a sigue activo y se congelan los que ya no caben', async () => {
    free({ clients: mkClients(['a', 'b', 'c'], { a: { syncSlotId: 'sa' }, b: { syncSlotId: 'sb', syncOrphan: true } }) });
    expect(S().isClientFrozen('a')).toBe(false);   // montaje: con el huérfano fuera caben
    syncMock.getTrainerSlots.mockResolvedValueOnce([
      { id: 'sa', client_name: 'a', client_code: 'A', sessions_count: 0 },
      { id: 'sb', client_name: 'b', client_code: 'B', sessions_count: 0 },
    ]);
    await S().refreshTrainerSlots();
    expect(['a', 'b', 'c'].map((id) => S().isClientFrozen(id))).toEqual([false, true, true]);   // prefijo por orden: a cabe, b ya no, y c queda tras el corte
  });
});
