/**
 * Regression cover for the two critical findings of `docs/specs/auditoria-tecnica.md`.
 *
 * Importing the store here only works because `vite.config.js` aliases the
 * React Native / Expo surface to `test/native-stub.js`.
 */

import { EXERCISE_LIBRARY } from '../src/data/exerciseLibrary';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { programTemplateIds, scopeFilterForUpload } from '../src/utils/clientLogs';
import { BACKUP_STORAGE_KEY } from '../src/utils/backupPayload';
import { localDay, addDays } from '../src/utils/stageProgress';
import { templateChainIds } from '../src/utils/exerciseLinks';
import { RC_PRO_ENTITLEMENT } from '../src/config/revenuecat';

// El store importa todo el servicio de sincronización de golpe, así que el
// doble tiene que ofrecer todos los nombres o el import falla.
const syncMock = {
  getTrainerSlots: vi.fn(async () => []),
  createClientSlot: vi.fn(), uploadProgram: vi.fn(), downloadHistory: vi.fn(),
  downloadProgram: vi.fn(), getSlotByClientCode: vi.fn(), linkClientToSlot: vi.fn(),
  uploadHistory: vi.fn(), uploadOverrides: vi.fn(), deleteClientSlot: vi.fn(),
  getClientSlotByUserId: vi.fn(), transferClientSlot: vi.fn(),
  updateTrainerNameForSlots: vi.fn(), releaseClientSlot: vi.fn(),
  reissueClientCode: vi.fn(), transferMySlotsTo: vi.fn(),
};
vi.mock('../src/services/supabaseSync', () => syncMock);

// Idem para la autenticación: el store la importa entera de forma estática.
const authMock = {
  signInAnonymously: vi.fn(async () => ({ userId: 'anon_1' })),
  recoverWithTrainerCode: vi.fn(), loginClientWithIdToken: vi.fn(),
  deleteAccount: vi.fn(), signOut: vi.fn(),
};
vi.mock('../src/services/supabaseAuth', () => authMock);

// `_ensureTrainerSession` pide el cliente de Supabase antes de cualquier
// llamada. Sin doble, el cliente real intenta leer la sesión del storage y
// revienta con un `storage.getItem is not a function` que no dice nada.
vi.mock('../src/config/supabase', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: null } }) } },
}));

const { useStore, SESSION_STORAGE_KEY } = await import('./useStore.js');
const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;

/** The callback zustand invokes once the persisted state has been read. */
const rehydrateCallback = () => useStore.persist.getOptions().onRehydrateStorage();

describe('onRehydrateStorage — fallo 1', () => {
  beforeEach(() => {
    useStore.setState({ _hasHydrated: false, _initialRoute: 'Main' });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  // Desde que la sesión en curso vive en su propia clave (`U01-rediseno.md` §3), el
  // flag baja DENTRO de la promesa que la lee: hay que ceder el turno antes de
  // comprobarlo. Lo que se sigue exigiendo es lo mismo — que acabe en `true`
  // pase lo que pase.

  it('marca _hasHydrated cuando la lectura de storage falla', async () => {
    // Zustand llama (undefined, error) por este camino — middleware.js:439.
    rehydrateCallback()(undefined, new Error('storage ilegible'));

    await vi.waitFor(() => expect(useStore.getState()._hasHydrated).toBe(true));
  });

  it('marca _hasHydrated aunque una migración lance', async () => {
    const explosivo = { get profile() { throw new Error('estado con forma inesperada'); } };

    expect(() => rehydrateCallback()(explosivo, undefined)).not.toThrow();
    await vi.waitFor(() => expect(useStore.getState()._hasHydrated).toBe(true));
  });

  it('sin estado que rehidratar arranca en Setup, no en Main', async () => {
    // El store se queda con el estado inicial: mismo caso que una instalación
    // nueva, así que la ruta tiene que ser la del primer arranque.
    useStore.setState({
      profile: { ...useStore.getState().profile, setupComplete: false, onboardingCompleted: false, activeProgramId: null },
    });

    rehydrateCallback()(undefined, new Error('boom'));

    await vi.waitFor(() => expect(useStore.getState()._initialRoute).toBe('Setup'));
  });
});

describe('sesión en curso fuera del blob — rediseno §3', () => {
  const SESION = {
    templateId: 'tpl_1', startedAt: Date.now(), setsState: {}, notes: '',
    exerciseNotes: {}, adHocExercises: [], freeSessionName: '', freeBlocks: [], blockState: {},
  };

  beforeEach(() => {
    useStore.setState({
      _hasHydrated: false, _initialRoute: 'Main',
      activeSession: { templateId: null },
      profile: { ...useStore.getState().profile, setupComplete: true, onboardingCompleted: true },
    });
    vi.restoreAllMocks();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('una sesión guardada en su clave abre en Workout', async () => {
    vi.spyOn(AsyncStorage, 'getItem').mockResolvedValue(JSON.stringify(SESION));

    rehydrateCallback()({}, undefined);

    await vi.waitFor(() => expect(useStore.getState()._hasHydrated).toBe(true));
    expect(AsyncStorage.getItem).toHaveBeenCalledWith(SESSION_STORAGE_KEY);
    expect(useStore.getState().activeSession.templateId).toBe('tpl_1');
    expect(useStore.getState()._initialRoute).toBe('Workout');
  });

  it('una sesión de hace más de 12 h se descarta y no abre en Workout', async () => {
    const vieja = { ...SESION, startedAt: Date.now() - 13 * 60 * 60 * 1000 };
    vi.spyOn(AsyncStorage, 'getItem').mockResolvedValue(JSON.stringify(vieja));
    const removeItem = vi.spyOn(AsyncStorage, 'removeItem').mockResolvedValue(undefined);

    rehydrateCallback()({}, undefined);

    await vi.waitFor(() => expect(useStore.getState()._hasHydrated).toBe(true));
    expect(useStore.getState().activeSession.templateId).toBe(null);
    expect(useStore.getState()._initialRoute).toBe('Main');
    expect(removeItem).toHaveBeenCalledWith(SESSION_STORAGE_KEY);
  });

  it('la caducidad alcanza también a la sesión que venía dentro del blob viejo', async () => {
    // Instalación anterior a este cambio: `activeSession` sigue dentro del blob
    // principal y el merge de zustand la deja puesta. No hay clave nueva que leer.
    vi.spyOn(AsyncStorage, 'getItem').mockResolvedValue(null);
    vi.spyOn(AsyncStorage, 'removeItem').mockResolvedValue(undefined);
    useStore.setState({ activeSession: { ...SESION, startedAt: Date.now() - 13 * 60 * 60 * 1000 } });

    rehydrateCallback()({}, undefined);

    await vi.waitFor(() => expect(useStore.getState()._hasHydrated).toBe(true));
    expect(useStore.getState().activeSession.templateId).toBe(null);
  });

  it('la sesión no viaja en el blob persistido', () => {
    const persistido = useStore.persist.getOptions().partialize(useStore.getState());

    expect(persistido).not.toHaveProperty('activeSession');
  });

  // Es la mitad que de verdad ahorra el trabajo: sacar `activeSession` del
  // `partialize` no basta, porque zustand escribe en cada `set()` sin comparar.
  it('teclear en la sesión no reescribe el blob principal', async () => {
    const setItem = vi.spyOn(AsyncStorage, 'setItem').mockResolvedValue(undefined);

    // Una escritura de verdad primero, para sembrar la referencia con la que se
    // compara. Sin esto la siguiente escribiría igual, y el test pasaría por el
    // motivo equivocado.
    useStore.setState({ theme: 'unTemaQueNoEstaba' });
    await vi.waitFor(() =>
      expect(setItem.mock.calls.some(([k]) => k === BACKUP_STORAGE_KEY)).toBe(true));
    setItem.mockClear();

    // Dos cambios seguidos de la sesión, como dos teclas en el campo de peso.
    useStore.setState({ activeSession: { ...SESION, notes: 'a' } });
    useStore.setState({ activeSession: { ...SESION, notes: 'ab' } });
    await vi.waitFor(() => expect(setItem).toHaveBeenCalledTimes(2));

    expect(setItem.mock.calls.map(([k]) => k))
      .toEqual([SESSION_STORAGE_KEY, SESSION_STORAGE_KEY]);
  });
});

describe('importData — fallo 2', () => {
  const clientId = 'cli_1';
  const managedId = 'prog_managed';

  /** Un backup completo con la forma exacta que escribe `exportFullBackup`. */
  const fullBackup = () => ({
    version: '2',
    exportType: 'full',
    profile: { activeProgramId: null },
    workoutLog: [],
    clientLogs: {},
    userPrograms: {},
    sessionTemplates: {},
    customExercises: {},
    programs: {
      [managedId]: { id: managedId, name: 'Fuerza 3d', mode: 'managed', clientId, days: [] },
      prog_personal: { id: 'prog_personal', name: 'Mío', mode: 'personal', days: [] },
    },
    clients: {
      [clientId]: { id: clientId, name: 'Ana', programIds: [managedId], activeProgramId: managedId },
    },
  });

  const allSections = { program: true, log: true, customExercises: true, clients: true, templates: true };

  beforeEach(() => {
    useStore.setState({ programs: {}, clients: {}, clientLogs: {}, workoutLog: [] });
  });

  it('restaura el programa del cliente junto con el cliente', () => {
    useStore.getState().importData(fullBackup(), allSections, { silent: true });

    const { programs, clients } = useStore.getState();
    expect(programs[clients[clientId].activeProgramId]).toBeDefined();
  });

  it('no convierte el programa del cliente en programa personal del entrenador', () => {
    useStore.getState().importData(fullBackup(), allSections, { silent: true });

    expect(useStore.getState().programs[managedId].owner).toBe(clientId);
    expect(useStore.getState().programs[managedId].kind).toBe('program');
  });

  it('sin la sección de clientes no arrastra sus programas', () => {
    useStore.getState().importData(fullBackup(), { ...allSections, clients: false }, { silent: true });

    expect(useStore.getState().programs[managedId]).toBeUndefined();
    expect(useStore.getState().programs.prog_personal).toBeDefined();
  });
});

describe('importData — fallo 25, etiquetas y presets de bloque', () => {
  beforeEach(() => {
    useStore.setState({
      tagRegistry:  [{ id: 'tag_local', name: 'Local' }],
      blockPresets: [{ presetId: 'pre_local', format: 'amrap' }],
      clients: {}, customExercises: {},
    });
  });

  const backup = () => ({
    clients:      { cli_1: { id: 'cli_1', name: 'Ana', tags: ['tag_1'] } },
    tagRegistry:  [{ id: 'tag_local', name: 'Pisado?' }, { id: 'tag_1', name: 'Lesionado' }],
    blockPresets: [{ presetId: 'pre_local', format: 'x' }, { presetId: 'pre_1', format: 'emom' }],
  });

  it('las etiquetas entran con los clientes, sin duplicar ni pisar las locales', () => {
    useStore.getState().importData(backup(), { clients: true }, { silent: true });

    expect(useStore.getState().tagRegistry).toEqual([
      { id: 'tag_local', name: 'Local' },
      { id: 'tag_1', name: 'Lesionado' },
    ]);
  });

  it('los presets entran con la biblioteca personal', () => {
    useStore.getState().importData(backup(), { customExercises: true }, { silent: true });

    expect(useStore.getState().blockPresets).toEqual([
      { presetId: 'pre_local', format: 'amrap' },
      { presetId: 'pre_1', format: 'emom' },
    ]);
  });

  it('sin su sección no entra ninguno de los dos', () => {
    useStore.getState().importData(backup(), { program: true }, { silent: true });

    expect(useStore.getState().tagRegistry).toHaveLength(1);
    expect(useStore.getState().blockPresets).toHaveLength(1);
  });
});

describe('importData — el programa trae los nombres de sus ejercicios propios', () => {
  /** Lo que escribe `_buildProgramJson`: el programa + SOLO las fichas que usa. */
  const programFile = () => ({
    exportType: 'program',
    program: { id: 'prog_1', name: 'Fuerza', owner: 'me', kind: 'program', days: [] },
    sessionTemplates: {},
    customExercises: { custom_a1: { id: 'custom_a1', name: 'Remo con toalla' } },
    workoutLog: [],
  });

  beforeEach(() => {
    useStore.setState({ programs: {}, customExercises: {}, blockPresets: [], workoutLog: [] });
  });

  it('las fichas propias entran con el programa aunque nadie pida su casilla', () => {
    // Es la llamada literal del canal del entrenador y del fichero de WhatsApp.
    useStore.getState().importData(programFile(), { program: true, log: false }, { silent: true });

    expect(useStore.getState().customExercises.custom_a1?.name).toBe('Remo con toalla');
  });

  it('una casilla apagada a mano sigue mandando', () => {
    useStore.getState().importData(
      programFile(), { program: true, customExercises: false }, { silent: true },
    );

    expect(useStore.getState().customExercises.custom_a1).toBeUndefined();
  });
});

describe('addExercise / replaceExercise — fallo 15', () => {
  beforeEach(() => {
    useStore.setState({
      sessionTemplates: {
        t1: { id: 't1', name: 'A', exercises: [{ exerciseId: 'ex_a', sets: 3, order: 1 }] },
      },
      exerciseLibrary: { ex_a: { id: 'ex_a' }, ex_b: { id: 'ex_b' } },
      customExercises: {},
    });
  });

  it('añadir el mismo ejercicio dos veces no lo duplica', () => {
    useStore.getState().addExercise('t1', 'ex_a');

    expect(useStore.getState().sessionTemplates.t1.exercises).toHaveLength(1);
  });

  it('sustituir por uno que ya está en la sesión tampoco', () => {
    useStore.getState().addExercise('t1', 'ex_b');
    useStore.getState().replaceExercise('t1', 'ex_b', 'ex_a');

    const ids = useStore.getState().sessionTemplates.t1.exercises.map((ex) => ex.exerciseId);
    expect(ids).toEqual(['ex_a', 'ex_b']);
  });
});

describe('beginEditSession / importData — fallo 12', () => {
  beforeEach(() => {
    useStore.setState({
      _editSnapshot: null,
      programs: {
        prog_a: { id: 'prog_a', name: 'A', owner: 'me', kind: 'program', stages: [] },
        prog_b: { id: 'prog_b', name: 'B', owner: 'me', kind: 'program', stages: [] },
      },
      sessionTemplates: {},
    });
  });

  it('la foto se acota al programa que se edita', () => {
    useStore.getState().beginEditSession('prog_a');

    const snap = useStore.getState()._editSnapshot;
    expect(snap.programId).toBe('prog_a');
    expect(snap.program.name).toBe('A');
    expect(snap.programs).toBeUndefined();   // ya no se clonan todos
  });

  it('sin programa no deja una foto a medias', () => {
    useStore.getState().beginEditSession('prog_inexistente');

    expect(useStore.getState()._editSnapshot).toBeNull();
  });

  it('importar mientras el editor está abierto invalida la foto', () => {
    // El cliente acepta la actualización del entrenador con el editor abierto.
    // Si la foto sobrevive, cancelar devuelve el programa a la versión vieja
    // mientras `lastProgramImportedAt` ya avanzó: la actualización se pierde.
    useStore.getState().beginEditSession('prog_a');
    useStore.getState().importData(
      { program: { id: 'prog_a', name: 'A v2', owner: 'me', kind: 'program', stages: [] } },
      { program: true },
      { silent: true },
    );

    expect(useStore.getState()._editSnapshot).toBeNull();
    expect(useStore.getState().programs.prog_a.name).toBe('A v2');
  });
});

describe('importData — fallo 10, reemplazar plantillas', () => {
  /** Tres plantillas propias, más un programa personal que no debe moverse. */
  const estadoLocal = () => ({
    programs: {
      tpl_mia_1: { id: 'tpl_mia_1', name: 'Mía 1', owner: 'me', kind: 'template', days: [] },
      tpl_mia_2: { id: 'tpl_mia_2', name: 'Mía 2', owner: 'me', kind: 'template', days: [] },
      tpl_mia_3: { id: 'tpl_mia_3', name: 'Mía 3', owner: 'me', kind: 'template', days: [] },
      prog_mio:  { id: 'prog_mio',  name: 'Mi programa', owner: 'me', kind: 'program', days: [] },
    },
    clients: {}, clientLogs: {}, workoutLog: [],
  });

  /** Backup con 1 plantilla y 1 programa personal — el caso que rompía. */
  const backup = () => ({
    version: '2', exportType: 'full',
    profile: { activeProgramId: null },
    workoutLog: [], clientLogs: {}, userPrograms: {}, sessionTemplates: {}, customExercises: {},
    clients: {},
    programs: {
      tpl_archivo: { id: 'tpl_archivo', name: 'Del archivo', mode: 'template', days: [] },
      prog_archivo: { id: 'prog_archivo', name: 'Personal del archivo', mode: 'personal', days: [] },
    },
  });

  const plantillas = () => Object.values(useStore.getState().programs).filter((p) => p.kind === 'template');

  beforeEach(() => { useStore.setState(estadoLocal()); });

  it('reemplaza de verdad con la sección de programas también marcada', () => {
    // Marcadas las dos: es el estado por defecto de ImportModal en cuanto el
    // archivo trae cualquier programa, y era el que degradaba a "combinar".
    useStore.getState().importData(
      backup(),
      { program: true, templates: true, templatesMode: 'replace' },
      { silent: true },
    );

    expect(plantillas().map((p) => p.id)).toEqual(['tpl_archivo']);
  });

  it('reemplazar no toca los programas que no son plantilla', () => {
    useStore.getState().importData(
      backup(),
      { program: true, templates: true, templatesMode: 'replace' },
      { silent: true },
    );

    const { programs } = useStore.getState();
    expect(programs.prog_mio).toBeDefined();
    expect(programs.prog_archivo).toBeDefined();
  });

  it('combinar sigue sumando', () => {
    useStore.getState().importData(
      backup(),
      { program: true, templates: true, templatesMode: 'merge' },
      { silent: true },
    );

    expect(plantillas()).toHaveLength(4);
  });
});

describe('refreshTrainerSlots — fallo 5', () => {
  const slot = { id: 'slot_1', client_name: 'Ana', client_code: 'ABCD-1234', sessions_count: 3, client_id: 'u1', disconnected_at: null };

  beforeEach(() => {
    syncMock.getTrainerSlots.mockReset();
    useStore.setState({
      clients: {},
      _refreshingSlots: false,
      trainerSync: { ...useStore.getState().trainerSync, userId: 'trainer_1', mode: null, code: null },
    });
  });

  it('dos llamadas solapadas no duplican la ficha del mismo hueco', async () => {
    // La ventana real: `getTrainerSlots` tarda, y mientras tanto entra la
    // segunda llamada (montaje + pull-to-refresh) viendo `clients` aún vacío.
    let resolver;
    syncMock.getTrainerSlots.mockReturnValue(new Promise((r) => { resolver = r; }));

    const a = useStore.getState().refreshTrainerSlots();
    const b = useStore.getState().refreshTrainerSlots();
    resolver([slot]);
    await Promise.all([a, b]);

    const fichas = Object.values(useStore.getState().clients);
    expect(fichas).toHaveLength(1);
    expect(fichas[0].syncSlotId).toBe('slot_1');
  });

  it('la segunda llamada ni siquiera va al servidor', async () => {
    let resolver;
    syncMock.getTrainerSlots.mockReturnValue(new Promise((r) => { resolver = r; }));

    const a = useStore.getState().refreshTrainerSlots();
    const b = useStore.getState().refreshTrainerSlots();
    resolver([slot]);
    await Promise.all([a, b]);

    expect(syncMock.getTrainerSlots).toHaveBeenCalledTimes(1);
  });

  it('el guard se suelta aunque el refresco falle', async () => {
    syncMock.getTrainerSlots.mockRejectedValueOnce(new Error('sin red'));

    await expect(useStore.getState().refreshTrainerSlots()).rejects.toThrow('sin red');
    expect(useStore.getState()._refreshingSlots).toBe(false);

    // Y el siguiente refresco vuelve a entrar.
    syncMock.getTrainerSlots.mockResolvedValueOnce([slot]);
    await useStore.getState().refreshTrainerSlots();
    expect(Object.values(useStore.getState().clients)).toHaveLength(1);
  });

  it('un refresco posterior actualiza la ficha existente, no crea otra', async () => {
    syncMock.getTrainerSlots.mockResolvedValue([slot]);
    await useStore.getState().refreshTrainerSlots();
    await useStore.getState().refreshTrainerSlots();

    const fichas = Object.values(useStore.getState().clients);
    expect(fichas).toHaveLength(1);
    expect(fichas[0].remoteSessionsCount).toBe(3);
    expect(fichas[0].syncLinked).toBe(true);
  });
});

describe('linkToTrainer — modelo de conexión', () => {
  const slot = {
    id: 'slot_1', client_name: 'Ana', program_name: 'Fuerza 3d',
    is_linked: false, history_updated_at: null, trainer_name: 'Lucas',
  };
  const programJson = {
    program: { id: 'prog_1', name: 'Fuerza 3d', days: [], stageActivatedAt: null },
    sessionTemplates: {}, userPrograms: {}, customExercises: {},
  };

  beforeEach(() => {
    Object.values(syncMock).forEach((fn) => fn.mockReset?.());
    authMock.signInAnonymously.mockResolvedValue({ userId: 'anon_1' });
    syncMock.getSlotByClientCode.mockResolvedValue(slot);
    syncMock.linkClientToSlot.mockResolvedValue('slot_1');
    syncMock.downloadProgram.mockResolvedValue({ programJson, updatedAt: null, trainerName: 'Lucas', overrides: {} });
    syncMock.downloadHistory.mockResolvedValue({ history: [], customExercises: {}, progress: null, updatedAt: null });
    useStore.setState({ programs: {}, clientSync: { ...useStore.getState().clientSync, slotId: null } });
  });

  it('descarga el programa DESPUÉS de ocupar el asiento, no de la consulta por código', async () => {
    await useStore.getState().linkToTrainer('ABCD-1234');

    // El orden es la garantía: si se descargara antes, `get_slot_by_code`
    // tendría que seguir publicando el programa a cualquiera con el código.
    const linkOrder     = syncMock.linkClientToSlot.mock.invocationCallOrder[0];
    const downloadOrder = syncMock.downloadProgram.mock.invocationCallOrder[0];
    expect(linkOrder).toBeLessThan(downloadOrder);
  });

  it('deja el clientSync apuntando al programa descargado', async () => {
    await useStore.getState().linkToTrainer('ABCD-1234');

    const { clientSync } = useStore.getState();
    expect(clientSync.slotId).toBe('slot_1');
    expect(clientSync.trainerProgramIds).toEqual(['prog_1']);
  });

  it('propaga SLOT_OCCUPIED sin importar nada', async () => {
    const err = new Error('SLOT_OCCUPIED');
    err.code = 'SLOT_OCCUPIED';
    syncMock.linkClientToSlot.mockRejectedValue(err);

    await expect(useStore.getState().linkToTrainer('ABCD-1234')).rejects.toMatchObject({ code: 'SLOT_OCCUPIED' });
    expect(syncMock.downloadProgram).not.toHaveBeenCalled();
    expect(useStore.getState().clientSync.slotId).toBeNull();
  });
});

describe('validateClientCode — sin programa ni client_id publicados', () => {
  beforeEach(() => {
    Object.values(syncMock).forEach((fn) => fn.mockReset?.());
    authMock.signInAnonymously.mockResolvedValue({ userId: 'anon_1' });
  });

  it('lee is_linked y program_name, que es todo lo que el servidor publica', async () => {
    syncMock.getSlotByClientCode.mockResolvedValue({
      id: 'slot_1', program_name: 'Fuerza 3d', is_linked: true,
      history_updated_at: '2026-08-01', trainer_name: 'Lucas',
    });

    const info = await useStore.getState().validateClientCode('ABCD-1234');

    expect(info).toMatchObject({ slotId: 'slot_1', programName: 'Fuerza 3d', alreadyLinked: true });
  });

  it('sin programa subido no deja seguir', async () => {
    syncMock.getSlotByClientCode.mockResolvedValue({ id: 'slot_1', program_name: null, is_linked: false });

    await expect(useStore.getState().validateClientCode('ABCD-1234')).rejects.toThrow('no ha subido');
  });
});

describe('reissueClientCode — la salida de la reconexión', () => {
  beforeEach(() => {
    Object.values(syncMock).forEach((fn) => fn.mockReset?.());
    useStore.setState({
      clients: { cli_1: { id: 'cli_1', name: 'Ana', syncSlotId: 'slot_1', syncCode: 'VIEJO-CODE', syncLinked: true } },
      trainerSync: { ...useStore.getState().trainerSync, userId: 'trainer_1', mode: null, code: null },
    });
  });

  it('guarda el código nuevo y deja el asiento como libre', async () => {
    syncMock.reissueClientCode.mockResolvedValue('NUEV-CODE');

    const code = await useStore.getState().reissueClientCode('cli_1');

    expect(code).toBe('NUEV-CODE');
    const client = useStore.getState().clients.cli_1;
    expect(client.syncCode).toBe('NUEV-CODE');
    expect(client.syncLinked).toBe(false);
  });

  it('un cliente sin hueco en el servidor no se puede reemitir', async () => {
    useStore.setState({ clients: { cli_2: { id: 'cli_2', name: 'Sin hueco' } } });

    await expect(useStore.getState().reissueClientCode('cli_2')).rejects.toThrow('no tiene hueco');
  });
});

describe('isPro — fallo 9', () => {
  it('un perfil nuevo NO es Pro', () => {
    // El default de INITIAL_PROFILE es lo único que decide qué pasa cuando la
    // comprobación con RevenueCat no llega a ocurrir: sin módulo nativo, con la
    // clave de iOS sin rellenar, o en Expo Go.
    expect(useStore.getState().profile.isPro).toBe(false);
  });

  it('si la comprobación no puede ejecutarse, no concede ni revoca', async () => {
    // `checkProStatus` conserva el valor a propósito: revocar por un fallo de
    // red dejaría sin funciones a un cliente de pago que está sin cobertura.
    // Con el default en false, conservar ya no significa regalar.
    useStore.setState((s) => ({ profile: { ...s.profile, isPro: true } }));
    expect(await useStore.getState().checkProStatus()).toBe(true);

    useStore.setState((s) => ({ profile: { ...s.profile, isPro: false } }));
    expect(await useStore.getState().checkProStatus()).toBe(false);
  });
});

describe('plan gratis — M01-02, la puerta va en la acción', () => {
  beforeEach(() => {
    useStore.setState((s) => ({
      clients: {}, programs: {}, sessionTemplates: {},
      profile: { ...s.profile, isPro: false, freeClientIds: [] },
      ui: { ...s.ui, paywallReason: null },
    }));
  });

  it('el cuarto cliente no se crea y abre el paywall', async () => {
    for (const n of ['A', 'B', 'C']) expect(await useStore.getState().createClient(n)).toBeTruthy();
    expect(await useStore.getState().createClient('D')).toBe(null);
    expect(Object.keys(useStore.getState().clients)).toHaveLength(3);
    expect(useStore.getState().ui.paywallReason).toBe('clients');
  });

  it('la segunda plantilla de programa no se crea; con Pro, sí', () => {
    expect(useStore.getState().createEmptyProgram(3, 'T1', 'template')).toBeTruthy();
    expect(useStore.getState().createEmptyProgram(3, 'T2', 'template')).toBe(null);
    expect(useStore.getState().ui.paywallReason).toBe('programTemplates');
    useStore.setState((s) => ({ profile: { ...s.profile, isPro: true } }));
    expect(useStore.getState().createEmptyProgram(3, 'T2', 'template')).toBeTruthy();
  });

  it('caducado con 2 plantillas: se quedan y se asignan; solo crear otra choca', () => {
    useStore.setState((s) => ({ profile: { ...s.profile, isPro: true } }));
    const t1 = useStore.getState().createEmptyProgram(3, 'T1', 'template');
    useStore.getState().createEmptyProgram(3, 'T2', 'template');
    useStore.setState((s) => ({ profile: { ...s.profile, isPro: false } }));
    expect(useStore.getState().cloneProgramFromTemplate(t1, { name: 'Mío' })).toBeTruthy();
    expect(useStore.getState().cloneProgramFromTemplate(t1, { kind: 'template', name: 'Copia' })).toBe(null);
  });

  it('caducado sin elegir: el cliente congelado no sincroniza ni se le apunta nada', async () => {
    const clients = Object.fromEntries(['a', 'b', 'c', 'd'].map((id) => [id, { id, name: id, syncSlotId: `s_${id}` }]));
    useStore.setState({ clients });
    await expect(useStore.getState().downloadClientHistory('a')).rejects.toThrow();
    expect(useStore.getState().startSession('tpl', { forClient: 'a' })).toBe(null);
    expect(useStore.getState().ui.paywallReason).toBe('frozen');
    useStore.getState().setFreeClientIds(['a']);
    expect(useStore.getState().isClientFrozen('a')).toBe(false);
    expect(useStore.getState().isClientFrozen('b')).toBe(true);
  });

  it('lo elegido no se suelta, y volver a Pro lo olvida', () => {
    const clients = Object.fromEntries(['a', 'b', 'c', 'd', 'e'].map((id) => [id, { id, name: id, syncSlotId: null }]));
    useStore.setState({ clients });
    useStore.getState().setFreeClientIds(['a', 'b', 'c']);
    useStore.getState().setFreeClientIds(['d', 'e']);           // intento de rotar
    expect(useStore.getState().isClientFrozen('a')).toBe(false);
    expect(useStore.getState().isClientFrozen('d')).toBe(true);
    useStore.setState((s) => ({ profile: { ...s.profile, isPro: true } }));
    expect(useStore.getState().profile.freeClientIds).toEqual([]);
  });
});

describe('syncPurchaserId — M01-01, el Pro sigue a la cuenta', () => {
  const info = (pro) => ({ entitlements: { active: pro ? { [RC_PRO_ENTITLEMENT]: {} } : {} } });
  let RC, getRC;
  beforeEach(() => {
    RC = {
      isConfigured:     vi.fn(async () => true),
      logIn:            vi.fn(async () => ({ customerInfo: info(false) })),
      restorePurchases: vi.fn(async () => info(true)),
    };
    getRC = useStore.getState()._getRC;
    useStore.setState({ _getRC: () => RC });
    useStore.setState((s) => ({ profile: { ...s.profile, isPro: true } }));
  });
  afterEach(() => useStore.setState({ _getRC: getRC }));

  it('cambio de cuenta con Pro que no viaja solo → restaura y lo mueve', async () => {
    await useStore.getState().syncPurchaserId('uuid-B', { switched: true });
    expect(RC.logIn).toHaveBeenCalledWith('uuid-B');
    expect(RC.restorePurchases).toHaveBeenCalled();
    expect(useStore.getState().profile.isPro).toBe(true);
  });

  it('al arrancar no restaura: «tenía Pro y ya no» es una suscripción caducada', async () => {
    await useStore.getState().syncPurchaserId('uuid-A');
    expect(RC.restorePurchases).not.toHaveBeenCalled();
    expect(useStore.getState().profile.isPro).toBe(false);
  });

  it('sin RevenueCat configurado no toca nada', async () => {
    RC.isConfigured = vi.fn(async () => false);
    await useStore.getState().syncPurchaserId('uuid-B', { switched: true });
    expect(RC.logIn).not.toHaveBeenCalled();
    expect(useStore.getState().profile.isPro).toBe(true);
  });
});

/**
 * Modelo de programas — `owner` + `kind` (`docs/specs/P03-program-model.md` §3).
 *
 * Cubre lo que el modelo viejo no podía enunciar: un solo dueño, la lista del
 * cliente derivada, un solo camino de borrado, y la identidad al importar.
 */
describe('program-model — owner/kind', () => {
  beforeEach(() => {
    useStore.setState({
      programs: {}, sessionTemplates: {},
      clients: {}, clientLogs: {}, workoutLog: [],
      profile: { ...useStore.getState().profile, activeProgramId: null },
    });
  });

  // §3.1 bis: el filtro pasa de negativo (`mode !== 'template'`) a positivo
  // (`owner === 'me'`), así que un programa sin dueño no aparece en ninguna
  // pantalla — sin error y sin aviso.
  it('todo camino de creación deja un dueño', () => {
    const st    = useStore.getState();
    const mio   = st.createEmptyProgram(2, 'Mío');
    const tpl   = st.createEmptyProgram(2, 'Plantilla', 'template');
    const ajeno = st.createProgramForClient('cli_1', 2, 'Del cliente');
    const clon  = st.cloneProgramFromTemplate(tpl, { owner: 'cli_1' });

    const { programs } = useStore.getState();
    [mio, tpl, ajeno, clon].forEach((id) => expect(programs[id].owner).toBeDefined());
    expect(programs[mio].owner).toBe('me');
    expect(programs[tpl].kind).toBe('template');
    expect(programs[ajeno].owner).toBe('cli_1');
    expect(programs[clon].owner).toBe('cli_1');
    expect(programs[clon].kind).toBe('program');   // una plantilla clonada a un cliente es un programa
  });

  it('la plantilla no se convierte en mi programa activo; el programa sí', () => {
    const tpl = useStore.getState().createEmptyProgram(2, 'Plantilla', 'template');
    expect(useStore.getState().profile.activeProgramId).toBeNull();

    const mio = useStore.getState().createEmptyProgram(2, 'Mío');
    expect(useStore.getState().profile.activeProgramId).toBe(mio);
    expect(mio).not.toBe(tpl);
  });

  // La fuga del §1.4: `deleteProgram` borraba el programa y dejaba sus `tpl_*`
  // dentro para siempre, en el estado persistido y en cada `.fitdata`.
  it('borrar un programa de cliente no deja sesiones huérfanas ni el activo colgando', () => {
    useStore.setState({ clients: { cli_1: { id: 'cli_1', name: 'Ana' } } });
    const pid = useStore.getState().createProgramForClient('cli_1', 3, 'Fuerza');
    useStore.getState().setClientActiveProgram('cli_1', pid);
    expect(Object.keys(useStore.getState().sessionTemplates)).toHaveLength(3);

    useStore.getState().deleteProgram(pid);

    const s = useStore.getState();
    expect(s.programs[pid]).toBeUndefined();
    expect(Object.keys(s.sessionTemplates)).toEqual([]);
    expect(s.clients.cli_1.activeProgramId).toBeNull();   // invariante 4
  });

  // Y las purgas componen: dos programas, dos purgas encadenadas.
  it('borrar un cliente se lleva sus programas y todas sus sesiones', () => {
    useStore.setState({ clients: { cli_1: { id: 'cli_1', name: 'Ana' } } });
    const p1 = useStore.getState().createProgramForClient('cli_1', 2, 'A');
    const p2 = useStore.getState().createProgramForClient('cli_1', 2, 'B');
    expect(Object.keys(useStore.getState().sessionTemplates)).toHaveLength(4);

    useStore.getState().deleteClient('cli_1');

    const s = useStore.getState();
    expect(s.programs[p1]).toBeUndefined();
    expect(s.programs[p2]).toBeUndefined();
    expect(Object.keys(s.sessionTemplates)).toEqual([]);
    expect(s.clients.cli_1).toBeUndefined();
  });

  // §3.4 bis, regla 1.
  it('importar como propio el programa de un cliente hace una COPIA; el cliente conserva el suyo', () => {
    useStore.setState({ clients: { cli_1: { id: 'cli_1', name: 'Ana' } } });
    const pid = useStore.getState().createProgramForClient('cli_1', 2, 'Fuerza');
    useStore.getState().setClientActiveProgram('cli_1', pid);

    const file = JSON.parse(useStore.getState()._buildProgramJson(pid, false).json);
    expect(file.version).toBe('4');
    expect(file.program.owner).toBe('me');          // el fichero no delata al cliente
    expect(file.program.clientId).toBeUndefined();

    useStore.getState().importData(file, { program: true }, { silent: true });

    const s = useStore.getState();
    expect(s.programs[pid].owner).toBe('cli_1');           // intacto
    expect(s.clients.cli_1.activeProgramId).toBe(pid);     // su activo, en pie
    expect(Object.keys(s.programs)).toHaveLength(2);       // y ahora hay una copia
    expect(s.profile.activeProgramId).not.toBe(pid);
  });

  // §3.4 bis, regla 1, la otra mitad: sin nada con que chocar no hay re-ID, y
  // ése es el caso del móvil nuevo.
  it('restaurar en un store vacío conserva los ids y el historial enganchado', () => {
    const file = {
      version: '3', exportType: 'program_with_log',
      program: {
        id: 'prog_x', name: 'Mío', owner: 'me', kind: 'program', status: 'active',
        currentStageIndex: 0,
        stages: [{ id: 'st_1', name: 'Base', days: [{ sessionTemplateId: 'tpl_x', label: 'A' }] }],
      },
      sessionTemplates: { tpl_x: { id: 'tpl_x', programId: 'prog_x', exercises: [] } },
      userPrograms: {}, customExercises: {},
      workoutLog: [{ id: 'e1', sessionTemplateId: 'tpl_x', timestamp: 1 }],
    };

    useStore.getState().importData(file, { program: true, log: true }, { silent: true });

    const s = useStore.getState();
    expect(s.programs.prog_x).toBeDefined();
    expect(s.sessionTemplates.tpl_x).toBeDefined();
    expect(s.workoutLog.map((e) => e.sessionTemplateId)).toEqual(['tpl_x']);
  });

  // §3.4 bis, regla 2. El caso del cliente que recibe su programa por WhatsApp:
  // sobrescribir en el sitio le traía los contadores del entrenador, a cero.
  describe('la posición es del atleta, no del emisor', () => {
    const stages = [
      { id: 'st_1', name: 'Base', days: [{ sessionTemplateId: 'tpl_x', label: 'A' }] },
      { id: 'st_2', name: 'Pico', days: [{ sessionTemplateId: 'tpl_x', label: 'A' }] },
    ];
    const local = {
      id: 'prog_x', name: 'Mío', owner: 'me', kind: 'program', status: 'active', stages,
      currentStageIndex: 1, stageStartedOn: '2026-09-07', stageSessionsDone: 5,
      stageExtraWeeks: 1, programStartedOn: '2026-07-06', stageActivatedAt: '2026-08-01',
    };
    // Llega con la copia del emisor, que nunca cuenta — y con los campos de
    // ciclos de un emisor viejo, que no deben sobrevivir al import.
    const incoming = (stageActivatedAt) => ({
      version: '3', exportType: 'program',
      program: {
        id: 'prog_x', name: 'Mío v2', owner: 'me', kind: 'program', status: 'active', stages,
        currentStageIndex: 0, stageStartedOn: null, stageSessionsDone: 0, stageExtraWeeks: 0,
        programStartedOn: null, stageWeeksCompleted: 0, cycleCompletedIds: [], stageActivatedAt,
      },
      sessionTemplates: {}, userPrograms: {},
    });

    it('el programa se actualiza y el progreso se queda donde estaba', () => {
      useStore.setState({ programs: { prog_x: local } });

      useStore.getState().importData(incoming('2026-08-01'), { program: true }, { silent: true });

      const p = useStore.getState().programs.prog_x;
      expect(p.name).toBe('Mío v2');
      expect(p).toMatchObject({
        currentStageIndex: 1, stageStartedOn: '2026-09-07', stageSessionsDone: 5,
        stageExtraWeeks: 1, programStartedOn: '2026-07-06',
      });
      expect(p).not.toHaveProperty('stageWeeksCompleted');
      expect(p).not.toHaveProperty('cycleCompletedIds');
    });

    it('salvo que el entrenador active otra etapa: entonces manda él y queda sin empezar', () => {
      useStore.setState({ programs: { prog_x: local } });

      useStore.getState().importData(incoming('2026-09-02'), { program: true }, { silent: true });

      const p = useStore.getState().programs.prog_x;
      expect(p).toMatchObject({
        currentStageIndex: 0, stageStartedOn: null, stageSessionsDone: 0, stageExtraWeeks: 0,
        programStartedOn: '2026-07-06',   // el inicio del programa no se reinicia
      });
    });
  });

  // El historial de un programa vive en el cajón de su dueño. `_buildProgramJson`
  // miraba sólo `workoutLog`, así que salía siempre vacío para un cliente.
  it('exportar el programa de un cliente con historial trae SU historial', () => {
    useStore.setState({ clients: { cli_1: { id: 'cli_1', name: 'Ana' } } });
    const pid = useStore.getState().createProgramForClient('cli_1', 1, 'Fuerza');
    const [tplId] = Object.keys(useStore.getState().sessionTemplates);
    useStore.setState({
      clientLogs: { cli_1: [{ id: 'c1', sessionTemplateId: tplId, timestamp: 1 }] },
      workoutLog: [{ id: 'mia', sessionTemplateId: tplId, timestamp: 2 }],
    });

    const file = JSON.parse(useStore.getState()._buildProgramJson(pid, true).json);

    expect(file.workoutLog.map((e) => e.id)).toEqual(['c1']);
  });

  // La migración del estado persistido (§3.1), con `programIds` como autoridad
  // de reserva para los `managed` sin `clientId` que llegó a haber.
  it('la migración atribuye por clientId, por programIds y, si no, a mí', () => {
    const state = {
      profile:  { activeProgramId: null, secondaryProgramIds: ['x'] },
      programs: {
        con_id:    { id: 'con_id',    mode: 'managed', clientId: 'cli_1' },
        sin_id:    { id: 'sin_id',    mode: 'managed' },
        plantilla: { id: 'plantilla', mode: 'template' },
        mio:       { id: 'mio',       mode: 'personal' },
      },
      clients:    { cli_1: { id: 'cli_1', programIds: ['con_id', 'sin_id'] } },
      workoutLog: [],
    };

    rehydrateCallback()(state, undefined);

    expect(state.programs.con_id.owner).toBe('cli_1');
    expect(state.programs.sin_id.owner).toBe('cli_1');     // por la lista de su cliente
    expect(state.programs.plantilla.owner).toBe('me');
    expect(state.programs.plantilla.kind).toBe('template');
    expect(state.programs.mio.owner).toBe('me');
    expect(state.programs.mio.kind).toBe('program');
    expect(state.programs.mio.mode).toBeUndefined();
    expect(state.clients.cli_1.programIds).toBeUndefined();
    expect(state.profile.secondaryProgramIds).toBeUndefined();
  });

  it('la migración es idempotente', () => {
    const state = {
      profile:    { activeProgramId: null },
      programs:   { p: { id: 'p', owner: 'cli_1', kind: 'program' } },
      clients:    { cli_1: { id: 'cli_1' } },
      workoutLog: [],
    };

    rehydrateCallback()(state, undefined);
    rehydrateCallback()(state, undefined);

    expect(state.programs.p.owner).toBe('cli_1');
  });
});

/**
 * Compatibilidad con los ficheros que YA existen (v1/v2).
 *
 * El exportador viejo escribía `mode: 'personal'` en cada programa suelto pero
 * se dejaba el `clientId` dentro. Leer el dueño del `clientId` haría que el
 * `.fitdata` que un entrenador ya mandó a su cliente entrase como programa de
 * un cliente que en ese móvil no existe: invisible, y sin un error.
 */
/**
 * Ciclos → semanas (`docs/specs/P08-weeks-model.md` §5): lo que escriben las
 * acciones de etapa y la migración al rehidratar.
 */
describe('weeks-model — acciones de etapa', () => {
  beforeEach(() => {
    useStore.setState({
      programs: {}, sessionTemplates: {}, stageBannerSnooze: {},
      clients: {}, clientLogs: {}, workoutLog: [],
      activeSession: { templateId: null, setsState: {}, startedAt: null },
      profile: { ...useStore.getState().profile, activeProgramId: null },
    });
  });

  function programa(n = 2, durationWeeks = 4) {
    const pid = useStore.getState().createEmptyProgram(n, 'Mío', 'program', durationWeeks);
    useStore.setState((s) => ({
      sessionTemplates: Object.fromEntries(Object.entries(s.sessionTemplates).map(([id, tpl]) =>
        [id, { ...tpl, exercises: [{ exerciseId: 'squat', sets: 1 }] }])),
    }));
    return pid;
  }
  const prog = (pid) => useStore.getState().programs[pid];
  function entrenar(templateId) {
    useStore.getState().startSession(templateId);
    useStore.setState((s) => ({
      activeSession: { ...s.activeSession, setsState: { squat: [{ weight: '100', reps: '5', time: '', done: true }] } },
    }));
    return useStore.getState().saveSession();
  }

  it('una sesion de otra etapa no cuenta', () => {
    const pid = programa();
    useStore.getState().addStageToProgram(pid, { durationWeeks: 2 });
    useStore.setState((s) => ({
      sessionTemplates: Object.fromEntries(Object.entries(s.sessionTemplates).map(([id, tpl]) =>
        [id, { ...tpl, exercises: [{ exerciseId: 'squat', sets: 1 }] }])),
    }));

    expect(entrenar(prog(pid).stages[1].days[0].sessionTemplateId).ok).toBe(true);
    expect(prog(pid).stageSessionsDone ?? 0).toBe(0);
    expect(prog(pid).stageStartedOn ?? null).toBeNull();
  });

  it('avanzar deja la etapa sin empezar, conserva el inicio del programa y olvida el aviso aplazado', () => {
    const pid = programa();
    entrenar(prog(pid).stages[0].days[0].sessionTemplateId);
    useStore.getState().addStageToProgram(pid, { durationWeeks: 2 });
    useStore.getState().extendStage(pid, 1);
    useStore.getState().snoozeStageBanner(pid, '2099-01-01');

    useStore.getState().advanceStage(pid);

    expect(prog(pid)).toMatchObject({
      currentStageIndex: 1, stageStartedOn: null, stageSessionsDone: 0, stageExtraWeeks: 0,
      programStartedOn: localDay(),
    });
    expect(useStore.getState().stageBannerSnooze[pid]).toBeUndefined();
  });

  it('elegir etapa hace lo mismo', () => {
    const pid = programa();
    entrenar(prog(pid).stages[0].days[0].sessionTemplateId);
    useStore.getState().addStageToProgram(pid, { durationWeeks: 2 });

    useStore.getState().setCurrentStage(pid, 1);

    expect(prog(pid)).toMatchObject({ currentStageIndex: 1, stageStartedOn: null, stageSessionsDone: 0 });
  });

  it('alargar suma semanas al progreso del atleta, no a la etapa', () => {
    const pid = programa();
    useStore.getState().extendStage(pid);
    useStore.getState().extendStage(pid, 2);

    expect(prog(pid).stageExtraWeeks).toBe(3);
    expect(prog(pid).stages[0].durationWeeks).toBe(4);
  });

  it('alargar no toca el programa de un cliente en el movil del entrenador', () => {
    const pid = useStore.getState().createProgramForClient('cli_x', 2, 'De cliente', 4);
    useStore.getState().extendStage(pid);
    expect(prog(pid).stageExtraWeeks ?? 0).toBe(0);
  });

  it('una copia de un programa entrenado empieza sin empezar', () => {
    const pid = programa();
    entrenar(prog(pid).stages[0].days[0].sessionTemplateId);
    useStore.getState().extendStage(pid);

    const copia = useStore.getState().cloneProgramFromTemplate(pid, { owner: 'me' });

    expect(prog(copia)).toMatchObject({
      currentStageIndex: 0, stageStartedOn: null, stageSessionsDone: 0, stageExtraWeeks: 0, programStartedOn: null,
    });
  });

  it('guardar el programa de un cliente como plantilla no toca activos ni editor', () => {
    const st = useStore.getState();
    const pid = st.createProgramForClient('cli_1', 2, 'X');
    st.setClientActiveProgram('cli_1', pid);
    useStore.setState((s) => ({ ui: { ...s.ui, _editingProgramId: null } }));
    const antes = { ...useStore.getState() };

    const tpl = useStore.getState().cloneProgramFromTemplate(pid, { kind: 'template', name: 'X' });

    const ahora = useStore.getState();
    expect(ahora.programs[tpl]).toMatchObject({ kind: 'template', owner: 'me', name: 'X' });
    expect(ahora.programs[tpl].stages[0].days).toHaveLength(2);
    expect(ahora.clients.cli_1.activeProgramId).toBe(pid);
    expect(ahora.profile.activeProgramId).toBe(antes.profile.activeProgramId);
    expect(ahora.ui._editingProgramId).toBeNull();
  });

  it('la copia de un programa de dos etapas encadena sus etapas, no las del original', () => {
    const pid = programa();
    useStore.getState().addStageToProgram(pid, { durationWeeks: 2 });
    const idsDe = (p) => prog(p).stages.flatMap((st) => st.days.map((d) => d.sessionTemplateId));
    const originales = idsDe(pid);

    const copia = useStore.getState().cloneProgramFromTemplate(pid, { owner: 'cli_1' });

    const [e1, e2] = prog(copia).stages.map((st) => st.days[0].sessionTemplateId);
    const cadena = templateChainIds(e2, (id) => useStore.getState().sessionTemplates[id]);
    expect(cadena).toContain(e1);
    idsDe(copia).forEach((id) => {
      expect(originales).not.toContain(useStore.getState().sessionTemplates[id].derivedFrom);
    });
  });

  it('aplazar el aviso lo guarda en el estado que se persiste', () => {
    const pid = programa();
    useStore.getState().snoozeStageBanner(pid, '2026-10-05');
    const persisted = useStore.persist.getOptions().partialize(useStore.getState());
    expect(persisted.stageBannerSnooze).toEqual({ [pid]: '2026-10-05' });
  });

  it('añadir una etapa detrás cierra la abierta en las semanas completas', () => {
    const pid = programa(3, null);
    entrenar(prog(pid).stages[0].days[0].sessionTemplateId);

    useStore.getState().addStageToProgram(pid, { durationWeeks: 2 });

    expect(prog(pid).stages[0].durationWeeks).toBe(1);   // empezada esta semana: 0 completas → 1
  });

  it('en el movil del entrenador, la etapa abierta se cierra por donde va el CLIENTE', () => {
    // Su copia del programa no se mueve (está a cero): cerraría en 1 semana.
    const pid = useStore.getState().createProgramForClient('cli_1', 2, 'De cliente', null);
    useStore.setState((s) => ({
      clients: { ...s.clients, cli_1: {
        ...s.clients.cli_1, id: 'cli_1',
        progress: { programId: pid, currentStageIndex: 0, stageStartedOn: addDays(localDay(), -28), stageSessionsDone: 8 },
      } },
    }));

    useStore.getState().addStageToProgram(pid, { durationWeeks: 2 });

    expect(prog(pid).stages[0].durationWeeks).toBeGreaterThanOrEqual(3);
  });

  it('al rehidratar, los ciclos pasan a sesiones y fechas, y los campos viejos desaparecen', () => {
    const state = {
      profile:    { activeProgramId: 'p' },
      programs:   { p: {
        id: 'p', owner: 'me', kind: 'program', currentStageIndex: 0,
        stages: [{ id: 's', durationWeeks: 4, days: [{ sessionTemplateId: 'a' }, { sessionTemplateId: 'b' }] }],
        cycleCompletedIds: ['a'], stageWeeksCompleted: 1, totalWeeksCompleted: 1, stageAdvancePending: false,
      } },
      clients:    {},
      workoutLog: [],
    };

    rehydrateCallback()(state, undefined);
    const migrado = state.programs.p;
    rehydrateCallback()(state, undefined);   // idempotente

    expect(state.programs.p).toEqual(migrado);
    expect(migrado.stageSessionsDone).toBe(3);
    expect(migrado.stageStartedOn).not.toBeNull();
    ['cycleCompletedIds', 'stageWeeksCompleted', 'totalWeeksCompleted', 'stageAdvancePending']
      .forEach((k) => expect(migrado).not.toHaveProperty(k));
  });
});

describe('program-model — ficheros v1/v2', () => {
  beforeEach(() => {
    useStore.setState({
      programs: {}, sessionTemplates: {},
      clients: {}, clientLogs: {}, workoutLog: [],
      profile: { ...useStore.getState().profile, activeProgramId: null },
    });
  });

  const v2File = (extra = {}) => ({
    version: '2', exportType: 'program',
    program: {
      id: 'prog_v2', name: 'Del entrenador', mode: 'personal', clientId: 'cli_del_entrenador',
      days: [{ sessionTemplateId: 'tpl_v2', label: 'A' }],
      ...extra,
    },
    sessionTemplates: { tpl_v2: { id: 'tpl_v2', programId: 'prog_v2', exercises: [] } },
    userPrograms: {},
  });

  it('el programa que un entrenador mandó con la app vieja entra como mío', () => {
    useStore.getState().importData(v2File(), { program: true }, { silent: true });

    const p = useStore.getState().programs.prog_v2;
    expect(p).toBeDefined();
    expect(p.owner).toBe('me');
    expect(p.kind).toBe('program');
    expect(p.clientId).toBeUndefined();
    expect(p.stages).toHaveLength(1);            // `ensureStages` por el camino
    expect(useStore.getState().profile.activeProgramId).toBe('prog_v2');
  });

  it('en un backup v2, el programa de un cliente sigue siendo suyo', () => {
    const backup = {
      version: '2', exportType: 'full',
      profile: { activeProgramId: null },
      workoutLog: [], clientLogs: {}, userPrograms: {}, sessionTemplates: {}, customExercises: {},
      clients: { cli_1: { id: 'cli_1', name: 'Ana', programIds: ['prog_c'], activeProgramId: 'prog_c' } },
      programs: {
        prog_c: { id: 'prog_c', name: 'Suyo', mode: 'managed', clientId: 'cli_1', days: [] },
        tpl_x:  { id: 'tpl_x',  name: 'Plantilla', mode: 'template', days: [] },
      },
    };

    useStore.getState().importData(
      backup, { program: true, clients: true, templates: true }, { silent: true },
    );

    const s = useStore.getState();
    expect(s.programs.prog_c.owner).toBe('cli_1');
    expect(s.programs.tpl_x.kind).toBe('template');
    expect(s.programs.tpl_x.owner).toBe('me');
    expect(s.clients.cli_1.programIds).toBeUndefined();   // la lista ya no significa nada
    expect(s.clients.cli_1.activeProgramId).toBe('prog_c');
  });

  // La otra puerta de entrada: el entrenador importando el fichero de su cliente.
  it('importar el fichero de un cliente le pone dueño y etapas', () => {
    useStore.setState({ clients: { cli_1: { id: 'cli_1', name: 'Ana' } } });

    useStore.getState().importForClient('cli_1', v2File(), 'replace');

    const p = useStore.getState().programs.prog_v2;
    expect(p.owner).toBe('cli_1');
    expect(p.kind).toBe('program');
    expect(p.stages).toHaveLength(1);
    expect(useStore.getState().clients.cli_1.activeProgramId).toBe('prog_v2');
  });

  it('y si ese id ya es de OTRO cliente, se re-IDifica en vez de compartirse', () => {
    useStore.setState({
      clients: { cli_1: { id: 'cli_1', name: 'Ana' }, cli_2: { id: 'cli_2', name: 'Luis' } },
      programs: { prog_v2: { id: 'prog_v2', name: 'De Ana', owner: 'cli_1', kind: 'program', stages: [] } },
    });

    useStore.getState().importForClient('cli_2', v2File(), 'replace');

    const s = useStore.getState();
    expect(s.programs.prog_v2.owner).toBe('cli_1');                    // el de Ana, intacto
    expect(s.clients.cli_2.activeProgramId).not.toBe('prog_v2');       // Luis tiene el suyo
    expect(s.programs[s.clients.cli_2.activeProgramId].owner).toBe('cli_2');
  });
});

/**
 * Un solo programa activo, también al importar.
 *
 * `importData` sólo cambiaba `profile.activeProgramId`: el anterior se quedaba
 * con `status: 'active'` sin ser el activo, o sea **invisible** — fuera de Home
 * y fuera del modal de archivados, que filtra por `status`. Es la misma regla
 * que `restoreProgram` ya aplicaba por su lado.
 */
describe('program-model — sustituir el activo lo archiva', () => {
  const mio = (id, extra = {}) => ({
    id, name: id, owner: 'me', kind: 'program', status: 'active',
    stages: [{ id: 'st_' + id, name: 'Base', days: [] }], currentStageIndex: 0, ...extra,
  });
  const fileWith = (program) => ({
    version: '3', exportType: 'program',
    program, sessionTemplates: {}, userPrograms: {},
  });

  beforeEach(() => {
    useStore.setState({
      programs: {}, sessionTemplates: {},
      clients: {}, clientLogs: {}, workoutLog: [],
      profile: { ...useStore.getState().profile, activeProgramId: null },
    });
  });

  it('otro id: el anterior se archiva y queda a la vista en "archivados"', () => {
    useStore.setState({
      programs: { prog_viejo: mio('prog_viejo') },
      profile: { ...useStore.getState().profile, activeProgramId: 'prog_viejo' },
    });

    useStore.getState().importData(fileWith(mio('prog_nuevo')), { program: true }, { silent: true });

    const s = useStore.getState();
    expect(s.profile.activeProgramId).toBe('prog_nuevo');
    expect(s.programs.prog_viejo.status).toBe('archived');
    expect(s.programs.prog_viejo.archivedAt).toBeTruthy();
    expect(s.programs.prog_nuevo.status).toBe('active');
  });

  it('mismo id: no archiva nada, es una actualización en el sitio', () => {
    useStore.setState({
      programs: { prog_x: mio('prog_x') },
      profile: { ...useStore.getState().profile, activeProgramId: 'prog_x' },
    });

    useStore.getState().importData(
      fileWith({ ...mio('prog_x'), name: 'v2' }), { program: true }, { silent: true },
    );

    const s = useStore.getState();
    expect(s.profile.activeProgramId).toBe('prog_x');
    expect(s.programs.prog_x.status).toBe('active');
    expect(s.programs.prog_x.name).toBe('v2');
    expect(Object.keys(s.programs)).toHaveLength(1);
  });

  it('sin programa activo previo no hay nada que archivar', () => {
    useStore.getState().importData(fileWith(mio('prog_nuevo')), { program: true }, { silent: true });

    const s = useStore.getState();
    expect(s.profile.activeProgramId).toBe('prog_nuevo');
    expect(Object.keys(s.programs)).toEqual(['prog_nuevo']);
  });

  // El importado es una copia (otro id), así que el anterior se archiva; el del
  // cliente ni se entera, que es lo que protege la regla 1.
  it('importar el programa de un cliente como propio archiva el mío, no el suyo', () => {
    useStore.setState({ clients: { cli_1: { id: 'cli_1', name: 'Ana' } } });
    const pid = useStore.getState().createProgramForClient('cli_1', 1, 'De Ana');
    useStore.getState().setClientActiveProgram('cli_1', pid);
    const mine = useStore.getState().createEmptyProgram(1, 'Mío');

    const file = JSON.parse(useStore.getState()._buildProgramJson(pid, false).json);
    useStore.getState().importData(file, { program: true }, { silent: true });

    const s = useStore.getState();
    expect(s.programs[mine].status).toBe('archived');       // el mío, archivado
    expect(s.programs[pid].status).toBe('active');          // el de Ana, intacto
    expect(s.programs[pid].owner).toBe('cli_1');
    expect(s.clients.cli_1.activeProgramId).toBe(pid);
  });
});

/**
 * Un solo diccionario de sesiones (`docs/specs/P03-program-model.md` §4).
 *
 * `userPrograms` era la capa de ediciones sobre los originales de semilla.
 * Desde que todo lo que crea el usuario nace ya en `sessionTemplates`, la capa
 * no significaba nada: "Restaurar sesión original" devolvía la sesión al estado
 * vacío en que nació, no a ningún original.
 */
describe('program-model — un solo diccionario de sesiones', () => {
  beforeEach(() => {
    useStore.setState({
      programs: {}, sessionTemplates: {},
      clients: {}, clientLogs: {}, workoutLog: [],
      profile: { ...useStore.getState().profile, activeProgramId: null },
    });
  });

  it('la migración fusiona las dos capas y gana la de ediciones', () => {
    const state = {
      profile: { activeProgramId: null },
      programs: {}, clients: {}, workoutLog: [],
      sessionTemplates: {
        tpl_a: { id: 'tpl_a', name: 'Original A' },
        tpl_b: { id: 'tpl_b', name: 'Sólo base' },
      },
      userPrograms: {
        tpl_a: { id: 'tpl_a', name: 'A editada' },
        tpl_c: { id: 'tpl_c', name: 'Sólo edición' },
      },
    };

    rehydrateCallback()(state, undefined);

    expect(state.sessionTemplates.tpl_a.name).toBe('A editada');   // gana la capa de arriba
    expect(state.sessionTemplates.tpl_b.name).toBe('Sólo base');
    expect(state.sessionTemplates.tpl_c.name).toBe('Sólo edición');
    expect(state.userPrograms).toBeUndefined();
  });

  it('la migración es idempotente y no revive la capa', () => {
    const state = {
      profile: { activeProgramId: null },
      programs: {}, clients: {}, workoutLog: [],
      sessionTemplates: { tpl_a: { id: 'tpl_a', name: 'A' } },
    };

    rehydrateCallback()(state, undefined);
    rehydrateCallback()(state, undefined);

    expect(state.sessionTemplates.tpl_a.name).toBe('A');
    expect(state.userPrograms).toBeUndefined();
  });

  // La costura: `getEffectiveTemplate` conserva nombre y contrato, así que
  // ninguno de sus ~50 llamantes se enteró del cambio.
  it('getEffectiveTemplate sigue devolviendo la sesión', () => {
    useStore.setState({ sessionTemplates: { tpl_a: { id: 'tpl_a', name: 'A' } } });

    expect(useStore.getState().getEffectiveTemplate('tpl_a').name).toBe('A');
    expect(useStore.getState().getEffectiveTemplate('no_existe')).toBeUndefined();
  });

  it('el fichero sale en v4 y sin la clave muerta', () => {
    const pid = useStore.getState().createEmptyProgram(2, 'Mío');

    const file = JSON.parse(useStore.getState()._buildProgramJson(pid, false).json);

    expect(file.version).toBe('4');
    expect(Object.keys(file.sessionTemplates)).toHaveLength(2);
    expect(file).not.toHaveProperty('userPrograms');
  });

  // Un fichero v1/v2/v3 traía las sesiones repartidas en dos claves. Al leerlo
  // gana `userPrograms`, que era lo que su dueño veía en pantalla.
  it('al importar un fichero viejo, las dos claves se fusionan y gana la de ediciones', () => {
    const viejo = {
      version: '3', exportType: 'program',
      program: {
        id: 'prog_v3', name: 'Del entrenador', owner: 'me', kind: 'program', status: 'active',
        currentStageIndex: 0,
        stages: [{ id: 'st_1', name: 'Base', days: [{ sessionTemplateId: 'tpl_a', label: 'A' }] }],
      },
      sessionTemplates: { tpl_a: { id: 'tpl_a', name: 'Original', exercises: [] } },
      userPrograms:     { tpl_a: { id: 'tpl_a', name: 'Editada por el entrenador', exercises: [] } },
    };

    useStore.getState().importData(viejo, { program: true }, { silent: true });

    expect(useStore.getState().sessionTemplates.tpl_a.name).toBe('Editada por el entrenador');
    expect(useStore.getState().userPrograms).toBeUndefined();
  });

  it('lo mismo por la otra puerta: el fichero viejo de un cliente', () => {
    useStore.setState({ clients: { cli_1: { id: 'cli_1', name: 'Ana' } } });

    useStore.getState().importForClient('cli_1', {
      version: '2', exportType: 'program',
      program: { id: 'prog_v2', name: 'Suyo', mode: 'personal', days: [{ sessionTemplateId: 'tpl_a', label: 'A' }] },
      sessionTemplates: { tpl_a: { id: 'tpl_a', name: 'Original' } },
      userPrograms:     { tpl_a: { id: 'tpl_a', name: 'Editada' } },
    }, 'replace');

    expect(useStore.getState().sessionTemplates.tpl_a.name).toBe('Editada');
  });

  // La purga de la fase 1 tenía que limpiar los dos mapas; ahora sólo uno, y
  // eso es exactamente lo que no puede volver a quedarse a medias.
  it('borrar un programa sigue sin dejar sesiones huérfanas', () => {
    const pid = useStore.getState().createEmptyProgram(3, 'Mío');
    expect(Object.keys(useStore.getState().sessionTemplates)).toHaveLength(3);

    useStore.getState().deleteProgram(pid);

    expect(Object.keys(useStore.getState().sessionTemplates)).toEqual([]);
    expect(useStore.getState().profile.activeProgramId).toBeNull();
  });

  it('editar una sesión escribe en el único diccionario', () => {
    const pid = useStore.getState().createEmptyProgram(1, 'Mío');
    const [tplId] = Object.keys(useStore.getState().sessionTemplates);

    useStore.getState().renameSession(tplId, 'Empuje');

    expect(useStore.getState().sessionTemplates[tplId].name).toBe('Empuje');
    expect(useStore.getState().userPrograms).toBeUndefined();
    expect(useStore.getState().programs[pid]).toBeDefined();
  });
});

/**
 * Muere el espejo `program.days` (`docs/specs/P03-program-model.md` §5).
 *
 * Lo que estos tests protegen no es el borrado: es que NADA de lo que colgaba
 * del espejo se caiga con el. El espejo alimentaba tres cosas que importan —el
 * contador de progreso, el alcance del historial que el cliente sube a su
 * entrenador, y el que se borra al purgar— y las tres tienen que seguir en pie
 * leyendo los dias de su etapa.
 */
describe('program-model — sin espejo `days`', () => {
  beforeEach(() => {
    useStore.setState({
      programs: {}, sessionTemplates: {},
      clients: {}, clientLogs: {}, workoutLog: [],
      activeSession: { templateId: null, setsState: {}, startedAt: null },
      profile: { ...useStore.getState().profile, activeProgramId: null },
    });
  });

  /** Un programa de 2 sesiones con un ejercicio cada una, listo para entrenar. */
  function programaDeDos() {
    const pid = useStore.getState().createEmptyProgram(2, 'Mío');
    const ids = Object.keys(useStore.getState().sessionTemplates);
    useStore.setState((s) => ({
      sessionTemplates: Object.fromEntries(
        ids.map((id) => [id, { ...s.sessionTemplates[id], exercises: [{ exerciseId: 'squat', sets: 1 }] }]),
      ),
    }));
    return { pid, ids };
  }

  /** Entrena y guarda una sesion completa. */
  function entrenar(templateId) {
    useStore.getState().startSession(templateId);
    useStore.setState((s) => ({
      activeSession: {
        ...s.activeSession,
        setsState: { squat: [{ weight: '100', reps: '5', time: '', done: true }] },
      },
    }));
    return useStore.getState().saveSession();
  }

  it('ningun camino de creacion deja una copia de los dias', () => {
    const { pid } = programaDeDos();
    const tplId = useStore.getState().createEmptyProgram(2, 'Plantilla', 'template');
    const cli = useStore.getState().createProgramForClient('cli_1', 2, 'De cliente');
    const clon = useStore.getState().cloneProgramFromTemplate(tplId, { owner: 'cli_1' });

    const { programs } = useStore.getState();
    [pid, tplId, cli, clon].forEach((id) => {
      expect(programs[id]).not.toHaveProperty('days');
      expect(programs[id].stages[0].days.length).toBeGreaterThan(0);
    });
  });

  // EL test de esta fase: el contador leia `stage.days`, pero la rama de al
  // lado leia el espejo. Si dejara de contar, el cliente no empezaria nunca la
  // etapa y se quedaria clavado en la semana 1.
  it('guardar una sesion de la etapa cuenta, y la primera la empieza', () => {
    const { pid, ids } = programaDeDos();

    expect(entrenar(ids[0]).ok).toBe(true);
    let p = useStore.getState().programs[pid];
    expect(p).toMatchObject({ stageSessionsDone: 1, stageStartedOn: localDay(), programStartedOn: localDay() });

    entrenar(ids[0]);   // repetir tambien cuenta: la fecha es la que manda
    p = useStore.getState().programs[pid];
    expect(p.stageSessionsDone).toBe(2);
  });

  // El alcance: que sube el cliente a su entrenador, que cuenta como "del
  // programa" en Carga y en Historial, y que se borra al purgar.
  it('el alcance del programa sale de las etapas, no del espejo', () => {
    const { pid, ids } = programaDeDos();
    const program = useStore.getState().programs[pid];

    expect(program.days).toBeUndefined();
    expect([...programTemplateIds(program)].sort()).toEqual([...ids].sort());

    const { entries } = scopeFilterForUpload({
      workoutLog: [
        { id: 'a', sessionTemplateId: ids[0], timestamp: 10 },
        { id: 'b', sessionTemplateId: 'ajena', timestamp: 20 },
      ],
      programs: { [pid]: program },
      trainerProgramIds: [pid],
    });
    expect(entries.map((e) => e.id)).toEqual(['a']);
  });

  it('borrar el programa sigue llevandose sus sesiones', () => {
    const { pid } = programaDeDos();

    useStore.getState().deleteProgram(pid);

    expect(Object.keys(useStore.getState().sessionTemplates)).toEqual([]);
  });

  it('el fichero que viaja al cliente no lleva el espejo, y lleva sus sesiones', () => {
    const { pid, ids } = programaDeDos();

    const file = JSON.parse(useStore.getState()._buildProgramJson(pid, false).json);

    expect(file.program).not.toHaveProperty('days');
    expect(file.program.stages[0].days).toHaveLength(2);
    expect(Object.keys(file.sessionTemplates).sort()).toEqual([...ids].sort());
  });

  // La migracion, en el orden que importa: `ensureStages` LEE `days` para armar
  // la etapa, asi que el borrado va despues. Al reves, el programa antiguo se
  // quedaria sin sesiones.
  it('un programa antiguo conserva sus dias al migrar, y pierde el espejo', () => {
    const state = {
      profile: { activeProgramId: null },
      clients: {}, workoutLog: [],
      programs: {
        viejo: {
          id: 'viejo', owner: 'me', kind: 'program',
          days: [{ sessionTemplateId: 'tpl_a', label: 'A' }, { sessionTemplateId: 'tpl_b', label: 'B' }],
        },
      },
    };

    rehydrateCallback()(state, undefined);

    const p = state.programs.viejo;
    expect(p.days).toBeUndefined();
    expect(p.stages).toHaveLength(1);
    expect(p.stages[0].days.map((d) => d.sessionTemplateId)).toEqual(['tpl_a', 'tpl_b']);
    // Y el alcance sigue siendo el mismo, que es lo que sube al entrenador.
    expect([...programTemplateIds(p)].sort()).toEqual(['tpl_a', 'tpl_b']);
  });

  // La otra mitad: un `.fitdata` v1/v2 trae `days` y ninguna etapa. Esa lectura
  // NO se borra con el espejo — es la puerta por la que entran.
  it('un fichero v1/v2 sin etapas sigue entrando con sus sesiones', () => {
    useStore.getState().importData({
      version: '2', exportType: 'program',
      program: {
        id: 'prog_v2', name: 'Viejo', mode: 'personal',
        days: [{ sessionTemplateId: 'tpl_a', label: 'A' }],
      },
      sessionTemplates: { tpl_a: { id: 'tpl_a', programId: 'prog_v2', exercises: [] } },
    }, { program: true }, { silent: true });

    const p = useStore.getState().programs.prog_v2;
    expect(p.stages).toHaveLength(1);
    expect(p.stages[0].days.map((d) => d.sessionTemplateId)).toEqual(['tpl_a']);
    expect([...programTemplateIds(p)]).toEqual(['tpl_a']);
  });
});

describe('sesiones de una etapa — duplicar y eliminar reetiquetan (editor-vinculacion P49)', () => {
  beforeEach(() => {
    useStore.setState({ programs: {}, sessionTemplates: {}, clients: {}, clientLogs: {}, workoutLog: [] });
  });

  /** Programa de 3 sesiones A, B, C (en ese orden). */
  function abc() {
    const pid = useStore.getState().createEmptyProgram(3, 'Mío');
    const ids = useStore.getState().programs[pid].stages[0].days.map((d) => d.sessionTemplateId);
    return { pid, ids };
  }
  const dias = (pid) => useStore.getState().programs[pid].stages[0].days;
  const tpl = (id) => useStore.getState().sessionTemplates[id];

  it('duplicar B de A, B, C deja la copia en 3.ª posición y la antigua C pasa a D', () => {
    const { pid, ids: [a, b, c] } = abc();

    const copia = useStore.getState().duplicateSessionInProgram(pid, b);

    expect(dias(pid).map((d) => d.sessionTemplateId)).toEqual([a, b, copia, c]);
    expect(dias(pid).map((d) => d.label)).toEqual(['A', 'B', 'C', 'D']);
    expect([a, b, copia, c].map((id) => tpl(id).label)).toEqual(['A', 'B', 'C', 'D']);
  });

  it('eliminar B de A, B, C deja A, B con la antigua C como B', () => {
    const { pid, ids: [a, b, c] } = abc();

    useStore.getState().removeSessionFromProgram(pid, b);

    expect(dias(pid).map((d) => d.sessionTemplateId)).toEqual([a, c]);
    expect(dias(pid).map((d) => d.label)).toEqual(['A', 'B']);
    expect(tpl(c).label).toBe('B');
    expect(tpl(b)).toBeUndefined();
  });
});

describe('clearWorkoutLog — fallo 18', () => {
  const log = [{ id: 'a', sessionTemplateId: 't1' }, { id: 'b', sessionTemplateId: 't2' }];

  beforeEach(() => {
    useStore.setState({ workoutLog: [...log], programs: {}, profile: { ...useStore.getState().profile, activeProgramId: null } });
  });

  it('un scope desconocido no borra nada', () => {
    // El default de `keep` era [], así que un typo, un `undefined` o un ámbito
    // nuevo se llevaban el historial entero. Sin deshacer.
    for (const scope of [undefined, null, '', 'todo', 'off-program', 'ALL']) {
      expect(useStore.getState().clearWorkoutLog(scope)).toBe(0);
      expect(useStore.getState().workoutLog).toHaveLength(2);
    }
  });

  it("'all' sí borra", () => {
    expect(useStore.getState().clearWorkoutLog('all')).toBe(2);
    expect(useStore.getState().workoutLog).toHaveLength(0);
  });

  it("'off_program' conserva las libres que sustituyen a una sesión (free-sessions §8)", () => {
    useStore.setState({
      programs: { p1: { id: 'p1', owner: 'me', stages: [{ days: [{ sessionTemplateId: 't1' }] }] } },
      profile:  { ...useStore.getState().profile, activeProgramId: 'p1' },
      workoutLog: [
        { id: 'a', sessionTemplateId: 't1' },
        { id: 'b', sessionTemplateId: '__free__', free: true },
        { id: 'c', sessionTemplateId: '__free__', free: true, countsAs: 't1' },
      ],
    });
    expect(useStore.getState().clearWorkoutLog('off_program')).toBe(1);
    expect(useStore.getState().workoutLog.map((e) => e.id)).toEqual(['a', 'c']);
  });

  it("'off_program' sin programa activo no borra", () => {
    // Sin programa no hay nada "del programa": borrarlo todo sería un borrado
    // total por sorpresa.
    expect(useStore.getState().clearWorkoutLog('off_program')).toBe(0);
    expect(useStore.getState().workoutLog).toHaveLength(2);
  });
});

describe('setAdHocSets — bajar el contador no borra lo registrado', () => {
  const setAdHoc = (setsState) => useStore.setState({
    activeSession: {
      ...useStore.getState().activeSession,
      templateId: '__free__',
      adHocExercises: [{ exerciseId: 'bench', setsState }],
    },
  });
  const sets = () => useStore.getState().activeSession.adHocExercises[0].setsState;
  const empty = () => ({ weight: '', reps: '', time: '', done: false });

  it('sube añadiendo series vacías', () => {
    setAdHoc([empty()]);
    useStore.getState().setAdHocSets('bench', 4);
    expect(sets()).toHaveLength(4);
    expect(sets()[3]).toEqual(empty());
  });

  it('baja recortando por el final mientras no haya datos', () => {
    setAdHoc([empty(), empty(), empty(), empty()]);
    useStore.getState().setAdHocSets('bench', 2);
    expect(sets()).toHaveLength(2);
  });

  it('nunca por debajo de la última serie con algo dentro', () => {
    // 3 series, la tercera hecha: bajar a 1 dejaría el trabajo fuera del log.
    setAdHoc([{ ...empty(), reps: '10' }, empty(), { ...empty(), done: true }]);
    useStore.getState().setAdHocSets('bench', 1);
    expect(sets()).toHaveLength(3);
  });

  it('el mínimo es 1 aunque no haya nada registrado', () => {
    setAdHoc([empty(), empty()]);
    useStore.getState().setAdHocSets('bench', 0);
    expect(sets()).toHaveLength(1);
  });
});

describe('sesiones libres — T06-free-sessions.md T19', () => {
  const ENTRY = {
    id: 'log_f1', sessionTemplateId: '__free__', sessionName: 'Agarre', free: true, timestamp: 1000,
    exercises: [{ exerciseId: 'squat', isAdHoc: true, sets: [{ weight: '100', reps: '5', time: '', done: true }] }],
  };

  beforeEach(() => {
    useStore.setState({
      programs: {}, sessionTemplates: {}, clients: {}, clientLogs: {}, workoutLog: [ENTRY],
      activeSession: { templateId: null, setsState: {}, startedAt: null },
      profile: { ...useStore.getState().profile, activeProgramId: null },
    });
  });

  const tpl = (id) => useStore.getState().sessionTemplates[id];

  it('crear: sesión sin programa, mía, visible en Inicio', () => {
    const id = useStore.getState().createFreeTemplate();
    expect(tpl(id)).toMatchObject({ programId: null, owner: 'me', onHome: true, exercises: [], blocks: [] });
  });

  it('guardar una sobre la marcha reapunta la entrada a la sesión nueva', () => {
    const id = useStore.getState().saveEntryAsFreeTemplate('log_f1');
    expect(tpl(id).name).toBe('Agarre');
    expect(tpl(id).exercises.map((e) => e.exerciseId)).toEqual(['squat']);
    expect(useStore.getState().workoutLog[0]).toMatchObject({ sessionTemplateId: id, free: true });
  });

  it('entrenarla la guarda como libre y sin tocar ningún programa', () => {
    const id = useStore.getState().saveEntryAsFreeTemplate('log_f1');
    useStore.getState().startSession(id);
    useStore.setState((s) => ({
      activeSession: { ...s.activeSession, setsState: { squat: [{ weight: '105', reps: '5', time: '', done: true }] } },
    }));
    const res = useStore.getState().saveSession();
    expect(res.ok).toBe(true);
    const saved = useStore.getState().workoutLog.find((e) => e.id === res.entryId);
    expect(saved).toMatchObject({ sessionTemplateId: id, sessionName: 'Agarre', free: true });
  });

  it('una sin nombre se guarda con sessionName null, no cadena vacía', () => {
    const id = useStore.getState().createFreeTemplate({ exercises: [{ exerciseId: 'squat', sets: 1 }] });
    useStore.getState().startSession(id);
    useStore.setState((s) => ({
      activeSession: { ...s.activeSession, setsState: { squat: [{ weight: '60', reps: '5', time: '', done: true }] } },
    }));
    const res = useStore.getState().saveSession();
    expect(useStore.getState().workoutLog.find((e) => e.id === res.entryId).sessionName).toBeNull();
  });

  it('la sobre la marcha también lleva free: true', () => {
    useStore.getState().startFreeSession();
    useStore.getState().addAdHocExercise('squat');
    useStore.getState().updateAdHocSet('squat', 0, 'reps', '5');
    const res = useStore.getState().saveSession();
    const saved = useStore.getState().workoutLog.find((e) => e.id === res.entryId);
    expect(saved).toMatchObject({ sessionTemplateId: '__free__', free: true });
  });

  it('borrar: nunca la sesión en curso; el historial se queda', () => {
    const id = useStore.getState().saveEntryAsFreeTemplate('log_f1');
    useStore.getState().startSession(id);
    expect(useStore.getState().deleteFreeTemplate(id)).toBe(false);
    expect(tpl(id)).toBeDefined();

    useStore.setState({ activeSession: { templateId: null, setsState: {}, startedAt: null } });
    expect(useStore.getState().deleteFreeTemplate(id)).toBe(true);
    expect(tpl(id)).toBeUndefined();
    expect(useStore.getState().workoutLog).toHaveLength(1);
  });

  it('borrar no toca sesiones de un programa', () => {
    useStore.setState({ sessionTemplates: { tpl_p: { id: 'tpl_p', programId: 'prog_1', exercises: [] } } });
    expect(useStore.getState().deleteFreeTemplate('tpl_p')).toBe(false);
    expect(tpl('tpl_p')).toBeDefined();
  });

  it('un backup viejo trae sus plantillas como sesiones libres, sin duplicar al reimportar', () => {
    const backup = { freeSessionPresets: [{ presetId: 'fpre_1', name: 'Corta', exercises: [{ exerciseId: 'squat', sets: 2 }], blocks: [] }] };
    useStore.getState().importData(backup, { customExercises: true }, { silent: true });
    useStore.getState().importData(backup, { customExercises: true }, { silent: true });
    const libres = Object.values(useStore.getState().sessionTemplates).filter((t) => !t.programId);
    expect(libres).toHaveLength(1);
    expect(libres[0]).toMatchObject({ name: 'Corta', owner: 'me', onHome: true });
    expect(libres[0].exercises[0]).toMatchObject({ exerciseId: 'squat', sets: 2 });
    expect(useStore.getState().freeSessionPresets).toBeUndefined();
  });

  it('al arrancar, las plantillas viejas se migran y la clave desaparece', () => {
    const state = {
      ...useStore.getState(),
      freeSessionPresets: [{ presetId: 'fpre_9', name: 'Movilidad', exercises: [{ exerciseId: 'squat', sets: 1 }], blocks: [] }],
    };
    rehydrateCallback()(state, undefined);
    expect(state.freeSessionPresets).toBeUndefined();
    expect(state.sessionTemplates.tpl_fpre_9).toMatchObject({ programId: null, owner: 'me', name: 'Movilidad' });
  });
});

describe('sesiones libres en el recap — T06-free-sessions.md T22', () => {
  beforeEach(() => {
    useStore.setState({
      exerciseLibrary: { squat: { id: 'squat' }, bench_press_barbell: { id: 'bench_press_barbell' } },
      programs: {}, sessionTemplates: {}, clients: {}, clientLogs: {}, workoutLog: [],
      activeSession: { templateId: null, setsState: {}, startedAt: null },
      profile: { ...useStore.getState().profile, activeProgramId: null },
    });
  });

  const progreso = (pid) => athleteProgressOf(useStore.getState().programs[pid]);
  const athleteProgressOf = (p) => ({ done: p.stageSessionsDone ?? 0, started: p.stageStartedOn ?? null });

  function conPrograma() {
    const pid  = useStore.getState().createEmptyProgram(3, 'Mío', 'program', 4);
    const days = useStore.getState().programs[pid].stages[0].days.map((d) => d.sessionTemplateId);
    useStore.setState({ workoutLog: [
      { id: 'log_l', sessionTemplateId: '__free__', free: true, timestamp: Date.parse('2026-09-20T10:00:00'), exercises: [] },
    ] });
    return { pid, days };
  }
  const entrada = () => useStore.getState().workoutLog[0];

  it('marcar «Cuenta como C» suma una a la etapa y lo apunta en la entrada', () => {
    const { pid, days } = conPrograma();
    useStore.getState().setEntryCountsAs('log_l', days[2]);
    expect(entrada().countsAs).toBe(days[2]);
    expect(progreso(pid)).toEqual({ done: 1, started: '2026-09-20' });
  });

  it('cambiar de C a A no mueve el contador; quitarla lo devuelve', () => {
    const { pid, days } = conPrograma();
    useStore.getState().setEntryCountsAs('log_l', days[2]);
    useStore.getState().setEntryCountsAs('log_l', days[0]);
    expect(progreso(pid).done).toBe(1);
    expect(entrada().countsAs).toBe(days[0]);
    useStore.getState().setEntryCountsAs('log_l', null);
    expect(progreso(pid).done).toBe(0);
    expect('countsAs' in entrada()).toBe(false);
  });

  it('una sesión del programa no se puede marcar como sustituta', () => {
    const { days } = conPrograma();
    useStore.setState({ workoutLog: [{ id: 'log_p', sessionTemplateId: days[0], timestamp: 1, exercises: [] }] });
    useStore.getState().setEntryCountsAs('log_p', days[1]);
    expect(useStore.getState().workoutLog[0].countsAs).toBeUndefined();
  });

  it('los ejercicios añadidos en el entreno pasan a la sesión libre, sin tocar los que ya tenía', () => {
    const id = useStore.getState().createFreeTemplate({ exercises: [{ exerciseId: 'squat', sets: 3 }] });
    useStore.getState().updateExerciseParams(id, 'squat', { progressionModel: 'fixed' });
    useStore.setState({ workoutLog: [{
      id: 'log_t', sessionTemplateId: id, free: true, timestamp: 1,
      exercises: [
        { exerciseId: 'squat', sets: [{ reps: '5', done: true }] },
        { exerciseId: 'bench_press_barbell', isAdHoc: true, minReps: 6, maxReps: 8,
          sets: [{ reps: '8', done: true }, { reps: '7', done: true }] },
      ],
    }] });
    expect(useStore.getState().addEntryExercisesToTemplate('log_t')).toBe(1);
    const exs = useStore.getState().sessionTemplates[id].exercises;
    expect(exs.map((e) => e.exerciseId)).toEqual(['squat', 'bench_press_barbell']);
    expect(exs[0]).toMatchObject({ sets: 3, progressionModel: 'fixed' });
    expect(exs[1]).toMatchObject({ sets: 2, minReps: 6, maxReps: 8 });
    // Repetirlo no los duplica.
    expect(useStore.getState().addEntryExercisesToTemplate('log_t')).toBe(0);
  });
});

describe('subida al entrenador cuando algo cambia — qa-sep-conexion C15', () => {
  const stages = [
    { id: 'st_1', name: 'Base', days: [{ sessionTemplateId: 'tpl_c', label: 'A' }] },
    { id: 'st_2', name: 'Pico', days: [{ sessionTemplateId: 'tpl_c', label: 'A' }] },
  ];
  const prog = {
    id: 'prog_c', name: 'Del entrenador', owner: 'me', kind: 'program', status: 'active', stages,
    currentStageIndex: 0, stageStartedOn: null, stageSessionsDone: 0, stageExtraWeeks: 0, programStartedOn: null,
  };
  const entry = { id: 'log_c1', sessionTemplateId: 'tpl_c', timestamp: Date.parse('2026-09-20'), exercises: [] };

  beforeEach(() => {
    vi.useFakeTimers();
    syncMock.uploadHistory.mockReset();
    syncMock.uploadHistory.mockResolvedValue(undefined);
    useStore.setState((s) => ({
      _hasHydrated: true,
      programs:   { prog_c: prog },
      profile:    { ...s.profile, activeProgramId: 'prog_c' },
      workoutLog: [entry],
      ui:         { ...s.ui, restTimer: { ...s.ui.restTimer, active: false } },
      clientSync: {
        ...s.clientSync, slotId: 'slot_c', trainerProgramIds: ['prog_c'],
        linkedAt: '2026-09-01T00:00:00Z', pendingUpload: false,
      },
    }));
    // Lo que haya dejado programado el propio montaje no cuenta.
    vi.advanceTimersByTime(5000);
    syncMock.uploadHistory.mockClear();
  });

  afterEach(() => vi.useRealTimers());

  it('el RPE del recap sube una sola vez aunque se toque tres veces seguidas', () => {
    const { setSessionFeedback } = useStore.getState();
    setSessionFeedback('log_c1', { sessionRpe: 6 });
    setSessionFeedback('log_c1', { sessionRpe: 7 });
    setSessionFeedback('log_c1', { sessionRpe: 8 });

    vi.advanceTimersByTime(1999);
    expect(syncMock.uploadHistory).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(syncMock.uploadHistory).toHaveBeenCalledTimes(1);
    expect(syncMock.uploadHistory.mock.calls[0][1][0].sessionRpe).toBe(8);
  });

  it('avanzar de etapa sube el blob nuevo sin esperar a entrenar', () => {
    useStore.getState().advanceStage('prog_c');
    vi.advanceTimersByTime(2000);

    expect(syncMock.uploadHistory).toHaveBeenCalledTimes(1);
    expect(syncMock.uploadHistory.mock.calls[0][3]).toMatchObject({ programId: 'prog_c', currentStageIndex: 1 });
  });

  it('una sesión libre se sube y para el temporizador de descanso', () => {
    useStore.setState((s) => ({
      ui: { ...s.ui, restTimer: { ...s.ui.restTimer, active: true, remaining: 60, total: 90 } },
      activeSession: {
        ...s.activeSession, templateId: '__free__', startedAt: Date.now() - 60000,
        adHocExercises: [{ exerciseId: 'ex_1', setsState: [{ weight: '50', reps: '5', time: '', done: true }] }],
      },
    }));

    const res = useStore.getState().saveSession();
    expect(res.ok).toBe(true);
    expect(useStore.getState().ui.restTimer.active).toBe(false);

    vi.advanceTimersByTime(2000);
    expect(syncMock.uploadHistory).toHaveBeenCalledTimes(1);
    expect(syncMock.uploadHistory.mock.calls[0][1].map((e) => e.id)).toContain(res.entryId);
  });

  it('sin entrenador no se sube nunca', () => {
    useStore.setState((s) => ({ clientSync: { ...s.clientSync, slotId: null } }));
    useStore.getState().setSessionFeedback('log_c1', { sessionRpe: 9 });
    useStore.getState().advanceStage('prog_c');
    vi.advanceTimersByTime(5000);

    expect(syncMock.uploadHistory).not.toHaveBeenCalled();
  });

  it('vincularse no dispara una subida por sí solo', () => {
    useStore.setState((s) => ({ clientSync: { ...s.clientSync, slotId: null } }));
    useStore.setState((s) => ({ clientSync: { ...s.clientSync, slotId: 'slot_c', lastAppliedStageActivation: '2026-09-22' } }));
    vi.advanceTimersByTime(5000);

    expect(syncMock.uploadHistory).not.toHaveBeenCalled();
  });
});

describe('"sin revisar" se apaga al mirar — qa-sep-conexion C16', () => {
  it('descargar refresca el recuento, y marcar visto guarda el fresco', async () => {
    syncMock.downloadHistory.mockReset();
    syncMock.downloadHistory.mockResolvedValue({
      history: [1, 2, 3, 4, 5].map((n) => ({ id: `log_${n}`, timestamp: n, exercises: [] })),
      customExercises: {}, progress: null, updatedAt: null,
    });
    useStore.setState((s) => ({
      clients:    { cli_c16: { id: 'cli_c16', name: 'Ana', syncSlotId: 'slot_c16', remoteSessionsCount: 3 } },
      clientLogs: {},
      trainerSync: { ...s.trainerSync, lastSeenSessionsCount: { cli_c16: 3 } },
    }));

    await useStore.getState().downloadClientHistory('cli_c16');
    useStore.getState().markHistoryViewed('cli_c16');

    expect(useStore.getState().clients.cli_c16.remoteSessionsCount).toBe(5);
    expect(useStore.getState().trainerSync.lastSeenSessionsCount.cli_c16).toBe(5);
  });
});

describe('"subir cambios" solo cuando hay cambios — qa-sep-conexion C17', () => {
  it('sin cambios queda limpio, un cambio lo ensucia y deshacerlo lo limpia', async () => {
    syncMock.uploadProgram.mockReset();
    syncMock.uploadProgram.mockResolvedValue(undefined);
    const stages = [{ id: 'st_1', name: 'Base', days: [{ sessionTemplateId: 'tpl_c17', label: 'A' }] }];
    useStore.setState({
      programs: { prog_c17: { id: 'prog_c17', name: 'De Ana', owner: 'cli_c17', kind: 'program', status: 'active', stages, currentStageIndex: 0 } },
      sessionTemplates: {
        tpl_c17: { id: 'tpl_c17', programId: 'prog_c17', name: 'A', exercises: [{ exerciseId: 'squat', sets: 3, minReps: 5, maxReps: 5 }] },
      },
      clients: { cli_c17: { id: 'cli_c17', name: 'Ana', activeProgramId: 'prog_c17', syncSlotId: 'slot_c17', programDirty: true } },
    });
    const st = () => useStore.getState();

    await st().uploadProgramToClient('cli_c17', 'prog_c17');
    expect(st().clients.cli_c17.programDirty).toBe(false);

    st().markProgramDirtyForClients('prog_c17');
    expect(st().clients.cli_c17.programDirty).toBe(false);

    st().updateExerciseParams('tpl_c17', 'squat', { sets: 4 });
    st().markProgramDirtyForClients('prog_c17');
    expect(st().clients.cli_c17.programDirty).toBe(true);

    st().updateExerciseParams('tpl_c17', 'squat', { sets: 3 });
    st().markProgramDirtyForClients('prog_c17');
    expect(st().clients.cli_c17.programDirty).toBe(false);
  });
});

describe('el entrenador apunta por el cliente — C05-trainer-logging.md C19', () => {
  beforeEach(() => {
    useStore.setState({
      programs: {}, sessionTemplates: {}, clientLogs: {}, workoutLog: [],
      clients: { cli_1: { id: 'cli_1', name: 'Carmen' } },
      activeSession: { templateId: null, setsState: {}, startedAt: null },
      profile: { ...useStore.getState().profile, activeProgramId: null, bodyWeight: 80 },
    });
  });

  function programaDeCliente() {
    const pid = useStore.getState().createProgramForClient('cli_1', 2, 'Fuerza 50+', 4);
    useStore.setState((s) => ({
      sessionTemplates: Object.fromEntries(Object.entries(s.sessionTemplates).map(([id, tpl]) =>
        [id, { ...tpl, exercises: [{ exerciseId: 'squat', sets: 1 }] }])),
    }));
    return pid;
  }
  const prog = (pid) => useStore.getState().programs[pid];
  function entrenar(templateId, opts) {
    useStore.getState().startSession(templateId, opts);
    useStore.setState((s) => ({
      activeSession: { ...s.activeSession, setsState: { squat: [{ weight: '60', reps: '8', time: '', done: true }] } },
    }));
    return useStore.getState().saveSession();
  }

  it('la sesión va al historial del cliente y no al mío, y mueve SU etapa', () => {
    const pid = programaDeCliente();
    const res = entrenar(prog(pid).stages[0].days[0].sessionTemplateId, { forClient: 'cli_1' });

    expect(res.ok).toBe(true);
    expect(useStore.getState().workoutLog).toHaveLength(0);
    expect(useStore.getState().clientLogs.cli_1.map((e) => e.id)).toEqual([res.entryId]);
    expect(prog(pid)).toMatchObject({ stageSessionsDone: 1, stageStartedOn: localDay() });
    expect(useStore.getState().activeSession.forClient).toBeNull();
  });

  it('apuntar una pasada: su fecha, arranca la etapa ese día, duración estimada y sin descansos', () => {
    const pid = programaDeCliente();
    const tid = prog(pid).stages[0].days[0].sessionTemplateId;
    const hace3 = Date.now() - 3 * 86400000;

    useStore.getState().startSession(tid, { forClient: 'cli_1', loggedAt: hace3, logOnly: true });
    useStore.getState().startRestTimer(90, 'Sentadilla');
    expect(useStore.getState().ui.restTimer.active).toBe(false);

    useStore.setState((s) => ({
      activeSession: { ...s.activeSession, setsState: { squat: [{ weight: '60', reps: '8', time: '', done: true }] } },
    }));
    const res = useStore.getState().saveSession();
    const entry = useStore.getState().clientLogs.cli_1[0];

    expect(res.ok).toBe(true);
    expect(entry.timestamp).toBe(hace3);
    expect(entry.duration).toBeGreaterThan(0);
    expect(entry.duration % 60000).toBe(0);           // minutos enteros de la estimación
    expect(prog(pid).stageStartedOn).toBe(localDay(hace3));
  });

  it('una sesión apuntada tarde queda ordenada por fecha en su historial', () => {
    const pid = programaDeCliente();
    const [a, b] = prog(pid).stages[0].days.map((d) => d.sessionTemplateId);
    entrenar(a, { forClient: 'cli_1' });
    entrenar(b, { forClient: 'cli_1', loggedAt: Date.now() - 2 * 86400000, logOnly: true });

    expect(useStore.getState().clientLogs.cli_1.map((e) => e.sessionTemplateId)).toEqual([b, a]);
  });

  it('el RPE y el peso del recap van a la entrada del cliente y no tocan mi peso', () => {
    const pid = programaDeCliente();
    const res = entrenar(prog(pid).stages[0].days[0].sessionTemplateId, { forClient: 'cli_1' });

    useStore.getState().setSessionFeedback(res.entryId, { sessionRpe: 7, bodyWeight: 62 }, 'cli_1');

    expect(useStore.getState().clientLogs.cli_1[0]).toMatchObject({ sessionRpe: 7, bodyWeight: 62 });
    expect(useStore.getState().profile.bodyWeight).toBe(80);
  });

  it('el peso se sella al guardar (P62): el del perfil, y cambiarlo después no la altera', () => {
    const pid = programaDeCliente();
    const tid = prog(pid).stages[0].days[0].sessionTemplateId;
    useStore.setState((s) => ({ profile: { ...s.profile, bodyWeight: 62 } }));
    const { entryId } = entrenar(tid);
    useStore.setState((s) => ({ profile: { ...s.profile, bodyWeight: 70 } }));

    expect(useStore.getState().workoutLog.find((e) => e.id === entryId).bodyWeight).toBe(62);
  });

  it('el entreno de un cliente sella el último peso de SU log, no el mío', () => {
    const pid = programaDeCliente();
    const [a, b] = prog(pid).stages[0].days.map((d) => d.sessionTemplateId);
    const primera = entrenar(a, { forClient: 'cli_1' });
    expect(useStore.getState().clientLogs.cli_1[0].bodyWeight).toBeNull();   // sin peso conocido

    useStore.getState().setSessionFeedback(primera.entryId, { bodyWeight: 58.5 }, 'cli_1');
    entrenar(b, { forClient: 'cli_1' });

    expect(useStore.getState().clientLogs.cli_1[1].bodyWeight).toBe(58.5);
    expect(useStore.getState().profile.bodyWeight).toBe(80);
  });

  it('sin peso en el perfil la sesión queda con null', () => {
    const pid = programaDeCliente();
    useStore.setState((s) => ({ profile: { ...s.profile, bodyWeight: null } }));
    const { entryId } = entrenar(prog(pid).stages[0].days[0].sessionTemplateId);

    expect(useStore.getState().workoutLog.find((e) => e.id === entryId).bodyWeight).toBeNull();
  });

  it('la nota corregida en el recap va a la entrada del cliente', () => {
    const pid = programaDeCliente();
    const res = entrenar(prog(pid).stages[0].days[0].sessionTemplateId, { forClient: 'cli_1' });

    useStore.getState().setSessionFeedback(res.entryId, { notes: 'Hombro cargado' }, 'cli_1');

    expect(useStore.getState().clientLogs.cli_1[0].notes).toBe('Hombro cargado');
  });

  it('un entreno mío sigue igual: mi historial, con reloj y descansos', () => {
    const pid = useStore.getState().createEmptyProgram(1, 'Mío', 'program', 4);
    useStore.setState((s) => ({
      sessionTemplates: Object.fromEntries(Object.entries(s.sessionTemplates).map(([id, tpl]) =>
        [id, { ...tpl, exercises: [{ exerciseId: 'squat', sets: 1 }] }])),
    }));
    useStore.getState().startSession(prog(pid).stages[0].days[0].sessionTemplateId);
    useStore.getState().startRestTimer(90, 'Sentadilla');
    expect(useStore.getState().ui.restTimer.active).toBe(true);
    useStore.getState().stopRestTimer();
  });

  it('un texto pegado (C22): las series a su sitio, ajustadas a la sesión, y lo demás como añadido', () => {
    const pid = programaDeCliente();
    const tid = prog(pid).stages[0].days[0].sessionTemplateId;
    useStore.setState((s) => ({
      sessionTemplates: { ...s.sessionTemplates, [tid]: { ...s.sessionTemplates[tid], exercises: [{ exerciseId: 'squat', sets: 2 }] } },
    }));
    const set = (weight) => ({ weight, reps: '6', time: '', done: true });
    useStore.getState().startSession(tid, {
      forClient: 'cli_1', logOnly: true, loggedAt: 1,
      prefill: {
        setsState: { squat: [set('100'), set('100'), set('95')] },
        adHoc: [{ exerciseId: 'squat', setsState: [set('1')] }, { exerciseId: 'plank', setsState: [set('')] }],
      },
    });
    const a = useStore.getState().activeSession;
    expect(a.setsState.squat.map((x) => x.weight)).toEqual(['100', '100']);
    // Uno que ya está en la sesión no se duplica como añadido (fallo 15).
    expect(a.adHocExercises.map((x) => x.exerciseId)).toEqual(['plank']);
    expect(a).toMatchObject({ forClient: 'cli_1', logOnly: true });
  });

  it('los alias se guardan normalizados', () => {
    useStore.setState({ exerciseAliases: {} });
    useStore.getState().setExerciseAlias('  Bánca ', 'bench_press_barbell');
    expect(useStore.getState().exerciseAliases).toEqual({ banca: 'bench_press_barbell' });
  });
});

describe('sesiones libres de un cliente — C06-group-classes.md C24/C27', () => {
  beforeEach(() => {
    useStore.setState({
      programs: {}, sessionTemplates: {}, clientLogs: {}, workoutLog: [],
      clients: { cli_1: { id: 'cli_1', name: 'Marta' } },
      activeSession: { templateId: null, setsState: {}, startedAt: null },
      profile: { ...useStore.getState().profile, activeProgramId: null },
    });
  });

  function plantilla() {
    const id = useStore.getState().createFreeTemplate({
      name: 'Movilidad', exercises: [{ exerciseId: 'squat', sets: 2 }], blocks: [],
    });
    useStore.setState((s) => ({
      sessionTemplates: { ...s.sessionTemplates, [id]: {
        ...s.sessionTemplates[id], blocks: [{ id: 'blk_a', format: 'amrap', movements: [] }],
      } },
    }));
    return id;
  }
  const tpl = (id) => useStore.getState().sessionTemplates[id];

  it('asignar copia: id nuevo, del cliente, fuera de Inicio, bloques con id propio, y la plantilla intacta', () => {
    const src  = plantilla();
    const copy = useStore.getState().copyFreeTemplate(src, { owner: 'cli_1' });

    expect(copy).not.toBe(src);
    expect(tpl(copy)).toMatchObject({ owner: 'cli_1', programId: null, onHome: false, name: tpl(src).name });
    expect(tpl(copy).blocks[0].id).not.toBe('blk_a');
    expect(tpl(src).owner).toBe('me');
    expect(tpl(src).blocks[0].id).toBe('blk_a');
  });

  it('borrar el cliente se lleva sus sesiones libres y deja las mías', () => {
    const src  = plantilla();
    const copy = useStore.getState().copyFreeTemplate(src, { owner: 'cli_1' });

    useStore.getState().deleteClient('cli_1');

    expect(tpl(copy)).toBeUndefined();
    expect(tpl(src)).toBeDefined();
  });

  it('viajan con su programa, y sin ninguna la firma no cambia', () => {
    const pid = useStore.getState().createProgramForClient('cli_1', 1, 'Base', 4);
    const payload = () => JSON.parse(useStore.getState()._buildProgramJson(pid).json);
    const sigAntes = useStore.getState()._programSig(pid);
    expect(payload().freeSessions).toBeUndefined();

    const copy = useStore.getState().copyFreeTemplate(plantilla(), { owner: 'cli_1' });

    expect(Object.keys(payload().freeSessions)).toEqual([copy]);
    expect(useStore.getState()._programSig(pid)).not.toBe(sigAntes);
  });

  it('crear, asignar o borrar una suya lo deja pendiente de enviar', () => {
    const pid = useStore.getState().createProgramForClient('cli_1', 1, 'Base', 4);
    useStore.setState((s) => ({
      clients: { cli_1: { ...s.clients.cli_1, activeProgramId: pid, syncSlotId: 'slot_1', programUploadedSig: s._programSig(pid) } },
    }));
    useStore.getState().markClientDirty('cli_1');
    expect(useStore.getState().clients.cli_1.programDirty ?? false).toBe(false);

    const copy = useStore.getState().copyFreeTemplate(plantilla(), { owner: 'cli_1' });
    expect(useStore.getState().clients.cli_1.programDirty).toBe(true);

    useStore.getState().deleteFreeTemplate(copy);
    expect(useStore.getState().clients.cli_1.programDirty).toBe(false);
  });

  it('en el móvil del cliente: llegan como del entrenador, se sustituyen enteras y otro programa no las toca', () => {
    const programa = { id: 'prog_t', owner: 'me', kind: 'program', name: 'Del entrenador',
      stages: [{ id: 's', durationWeeks: 4, days: [] }] };
    const libre = { id: 'tpl_x', owner: 'cli_9', programId: null, name: 'Core', exercises: [], blocks: [], trainerName: 'Lucas' };
    const importar = (data) => useStore.getState().importData(
      { sessionTemplates: {}, customExercises: {}, workoutLog: [], ...data }, { program: true, log: false }, { silent: true },
    );

    importar({ program: programa, freeSessions: { tpl_x: libre } });
    expect(tpl('tpl_x')).toMatchObject({ owner: 'me', fromTrainer: true, onHome: true, trainerName: 'Lucas' });

    importar({ program: { ...programa, id: 'prog_amigo' } });
    expect(tpl('tpl_x')).toBeDefined();

    importar({ program: programa });
    expect(tpl('tpl_x')).toBeUndefined();
  });
});

describe('con app o sin app — C05-trainer-logging.md C28 y C20', () => {
  const cloud = { ...useStore.getState().trainerSync, userId: 'trainer_1', mode: 'code', code: null };

  beforeEach(() => {
    Object.values(syncMock).forEach((fn) => fn.mockReset?.());
    syncMock.createClientSlot.mockResolvedValue({ slotId: 'slot_1', clientCode: 'K7QM-4XPA' });
    syncMock.getTrainerSlots.mockResolvedValue([{ id: 'slot_1', client_id: null }]);
    useStore.setState({
      programs: {}, sessionTemplates: {}, clientLogs: {}, workoutLog: [], clients: {},
      trainerSync: cloud, _hasHydrated: true,
    });
  });
  afterEach(() => vi.useRealTimers());

  const cli = (id) => useStore.getState().clients[id];

  it('crear un cliente sin elegir la app no crea código; con la app, sí', async () => {
    const sinApp = await useStore.getState().createClient('Carmen');
    expect(syncMock.createClientSlot).not.toHaveBeenCalled();
    expect(cli(sinApp).syncSlotId).toBeNull();

    const conApp = await useStore.getState().createClient('Marta', { withApp: true });
    expect(cli(conApp)).toMatchObject({ syncSlotId: 'slot_1', syncCode: 'K7QM-4XPA' });
  });

  it('pasar a la app: código, lo apuntado arriba (sin contar como «sin revisar») y su programa', async () => {
    const id = await useStore.getState().createClient('Carmen');
    const pid = useStore.getState().createProgramForClient(id, 1, 'Base', 4);
    useStore.setState((s) => ({
      clients: { ...s.clients, [id]: { ...s.clients[id], activeProgramId: pid } },
      clientLogs: { [id]: [{ id: 'log_1', sessionTemplateId: 'x', timestamp: 1, exercises: [] }] },
    }));

    await useStore.getState().moveClientToApp(id);

    expect(cli(id).syncSlotId).toBe('slot_1');
    const [slotId, entries, , progress] = syncMock.uploadHistory.mock.calls[0];
    expect(slotId).toBe('slot_1');
    expect(entries.map((e) => e.id)).toEqual(['log_1']);
    expect(progress.programId).toBe(pid);
    expect(useStore.getState().trainerSync.lastSeenSessionsCount[id]).toBe(1);
    expect(syncMock.uploadProgram).toHaveBeenCalledWith('slot_1', expect.anything(), null);
  });

  it('no pisa al cliente: si ya canjeó el código, no sube lo apuntado', async () => {
    const id = await useStore.getState().createClient('Marta', { withApp: true });
    syncMock.getTrainerSlots.mockResolvedValue([{ id: 'slot_1', client_id: 'u_marta' }]);

    expect(await useStore.getState().pushTrainerLogToSlot(id)).toBe(false);
    expect(syncMock.uploadHistory).not.toHaveBeenCalled();
    expect(cli(id).syncLinked).toBe(true);
  });

  it('cancelar la invitación borra el código y lo devuelve a sin app', async () => {
    const id = await useStore.getState().createClient('Marta', { withApp: true });

    await useStore.getState().cancelClientInvitation(id);

    expect(syncMock.deleteClientSlot).toHaveBeenCalledWith('slot_1');
    expect(cli(id)).toMatchObject({ syncSlotId: null, syncCode: null, syncLinked: false });
  });

  it('al invitado se le sube solo lo que quede pendiente', async () => {
    vi.useFakeTimers();
    const id = await useStore.getState().createClient('Marta', { withApp: true });
    const pid = useStore.getState().createProgramForClient(id, 1, 'Base', 4);

    useStore.getState().setClientActiveProgram(id, pid);
    await vi.advanceTimersByTimeAsync(2000);

    expect(syncMock.uploadProgram).toHaveBeenCalledTimes(1);
    expect(cli(id).programDirty).toBe(false);
  });

  it('al que tiene app, no: ahí el aviso decide', async () => {
    vi.useFakeTimers();
    const id = await useStore.getState().createClient('Pablo', { withApp: true });
    useStore.setState((s) => ({ clients: { ...s.clients, [id]: { ...s.clients[id], syncLinked: true } } }));
    const pid = useStore.getState().createProgramForClient(id, 1, 'Base', 4);

    useStore.getState().setClientActiveProgram(id, pid);
    await vi.advanceTimersByTimeAsync(2000);

    expect(syncMock.uploadProgram).not.toHaveBeenCalled();
    expect(cli(id).programDirty).toBe(true);
  });
});

describe('plantillas de sesión aparte de mis sesiones — C06-group-classes.md §4.6', () => {
  beforeEach(() => {
    useStore.setState({ sessionTemplates: {}, clients: {}, programs: {} });
  });
  const tpl = (id) => useStore.getState().sessionTemplates[id];

  it('una plantilla no es una sesión mía: no sale en Inicio', () => {
    const id = useStore.getState().createFreeTemplate(null, 'me', { asTemplate: true });
    expect(tpl(id)).toMatchObject({ kind: 'template', onHome: false, owner: 'me' });
  });

  it('asignármela me da una copia mía en Inicio y la plantilla no cambia', () => {
    const src  = useStore.getState().createFreeTemplate({ name: 'Movilidad', exercises: [], blocks: [] }, 'me', { asTemplate: true });
    const mine = useStore.getState().copyFreeTemplate(src, { owner: 'me' });

    expect(tpl(mine).kind).toBeUndefined();
    expect(tpl(mine)).toMatchObject({ owner: 'me', onHome: true, name: 'Movilidad' });
    expect(tpl(src).kind).toBe('template');
  });

  it('duplicarla en Plantillas da otra plantilla', () => {
    const src = useStore.getState().createFreeTemplate(null, 'me', { asTemplate: true });
    const dup = useStore.getState().copyFreeTemplate(src, { name: 'Copia', asTemplate: true });
    expect(tpl(dup)).toMatchObject({ kind: 'template', onHome: false, name: 'Copia' });
  });
});

describe('ejercicios juntados al rehidratar — P09-exercise-variants.md P41', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(AsyncStorage, 'getItem').mockResolvedValue(null);
  });

  it('plantillas e historial pasan al id nuevo con su variante', async () => {
    const state = {
      sessionTemplates: { t1: { id: 't1', exercises: [{ exerciseId: 'pulldown_supinated', sets: 3 }] } },
      workoutLog: [{ id: 'l1', sessionTemplateId: 't1', timestamp: 1, exercises: [{ exerciseId: 'pulldown_supinated', sets: [] }] }],
      clientLogs: {},
    };
    rehydrateCallback()(state, undefined);
    expect(state.sessionTemplates.t1.exercises[0]).toMatchObject({ exerciseId: 'pulldown', variant: { grip: 'supinated' } });
    expect(state.workoutLog[0].exercises[0]).toMatchObject({ exerciseId: 'pulldown', variant: { grip: 'supinated' } });
    await vi.waitFor(() => expect(useStore.getState()._hasHydrated).toBe(true));
  });

  it('la sesión en curso sigue al ejercicio juntado', async () => {
    const abierta = {
      templateId: 't1', startedAt: Date.now(), setsState: { seated_row_neutral: [{ weight: '40', reps: '', time: '', done: false }] },
      exerciseNotes: {}, adHocExercises: [],
    };
    AsyncStorage.getItem.mockResolvedValue(JSON.stringify(abierta));
    rehydrateCallback()({}, undefined);
    await vi.waitFor(() => expect(useStore.getState().activeSession.templateId).toBe('t1'));
    expect(useStore.getState().activeSession.setsState).toEqual({ cable_row: [{ weight: '40', reps: '', time: '', done: false }] });
  });
});

describe('la variante en la sesión — P09-exercise-variants.md P42', () => {
  beforeEach(() => { useStore.setState({ exerciseLibrary: EXERCISE_LIBRARY }); });

  function sesionConJalon(variant) {
    const pid = useStore.getState().createEmptyProgram(1, 'Var');
    const tid = Object.keys(useStore.getState().sessionTemplates).find(
      (id) => useStore.getState().sessionTemplates[id].programId === pid,
    );
    useStore.setState((s) => ({
      sessionTemplates: {
        ...s.sessionTemplates,
        [tid]: { ...s.sessionTemplates[tid], exercises: [{ exerciseId: 'pulldown', sets: 1, ...(variant ? { variant } : {}) }] },
      },
    }));
    return tid;
  }

  it('guardar apunta la variante del programa en el registro', () => {
    const tid = sesionConJalon({ grip: 'neutral', width: 'narrow' });
    useStore.getState().startSession(tid);
    useStore.setState((s) => ({
      activeSession: { ...s.activeSession, setsState: { pulldown: [{ weight: '50', reps: '10', time: '', done: true }] } },
    }));
    const { entryId } = useStore.getState().saveSession();
    const entry = useStore.getState().workoutLog.find((e) => e.id === entryId);
    expect(entry.exercises[0].variant).toEqual({ grip: 'neutral', width: 'narrow' });
  });

  it('sin variante no se escribe la clave', () => {
    const tid = sesionConJalon(null);
    useStore.getState().startSession(tid);
    useStore.setState((s) => ({
      activeSession: { ...s.activeSession, setsState: { pulldown: [{ weight: '50', reps: '10', time: '', done: true }] } },
    }));
    const { entryId } = useStore.getState().saveSession();
    const entry = useStore.getState().workoutLog.find((e) => e.id === entryId);
    expect('variant' in entry.exercises[0]).toBe(false);
  });

  it('sustituir conserva solo lo que el ejercicio nuevo declara', () => {
    const tid = sesionConJalon({ grip: 'supinated', width: 'wide' });
    useStore.getState().replaceExercise(tid, 'pulldown', 'barbell_row');   // prono/supino · ancho/medio
    expect(useStore.getState().sessionTemplates[tid].exercises[0].variant).toEqual({ grip: 'supinated', width: 'wide' });
    useStore.getState().replaceExercise(tid, 'barbell_row', 'squat_barbell');  // sin variante
    expect('variant' in useStore.getState().sessionTemplates[tid].exercises[0]).toBe(false);
  });
});

describe('la variante de hoy — P09-exercise-variants.md P43', () => {
  beforeEach(() => { useStore.setState({ exerciseLibrary: EXERCISE_LIBRARY }); });

  function entrenarJalon(setToday) {
    const pid = useStore.getState().createEmptyProgram(1, 'Hoy');
    const tid = Object.keys(useStore.getState().sessionTemplates).find(
      (id) => useStore.getState().sessionTemplates[id].programId === pid,
    );
    useStore.setState((s) => ({
      sessionTemplates: {
        ...s.sessionTemplates,
        [tid]: { ...s.sessionTemplates[tid], exercises: [{ exerciseId: 'pulldown', sets: 1, variant: { grip: 'neutral' } }] },
      },
    }));
    useStore.getState().startSession(tid);
    setToday?.();
    useStore.setState((s) => ({
      activeSession: { ...s.activeSession, setsState: { pulldown: [{ weight: '50', reps: '10', time: '', done: true }] } },
    }));
    const { entryId } = useStore.getState().saveSession();
    return { tid, entry: useStore.getState().workoutLog.find((e) => e.id === entryId) };
  }

  it('lo cambiado hoy va al registro y el programa no cambia', () => {
    const { tid, entry } = entrenarJalon(() => useStore.getState().setSessionVariant('pulldown', { grip: 'pronated' }));
    expect(entry.exercises[0].variant).toEqual({ grip: 'pronated' });
    expect(useStore.getState().sessionTemplates[tid].exercises[0].variant).toEqual({ grip: 'neutral' });
  });

  it('volver a la del programa borra el cambio de hoy', () => {
    const { entry } = entrenarJalon(() => {
      useStore.getState().setSessionVariant('pulldown', { grip: 'pronated' });
      useStore.getState().setSessionVariant('pulldown', undefined);
    });
    expect(entry.exercises[0].variant).toEqual({ grip: 'neutral' });
  });

  it('hoy sin especificar no escribe variante', () => {
    const { entry } = entrenarJalon(() => useStore.getState().setSessionVariant('pulldown', {}));
    expect('variant' in entry.exercises[0]).toBe(false);
  });
});

describe('unilateral y ejercicio aparte — P09-exercise-variants.md P44', () => {
  beforeEach(() => { useStore.setState({ exerciseLibrary: EXERCISE_LIBRARY, customExercises: {} }); });

  /** Un programa de dos sesiones; `ejercicios[i]` son los de la sesión i. */
  function programa(...ejercicios) {
    const pid = useStore.getState().createEmptyProgram(ejercicios.length, 'Id');
    const tids = Object.keys(useStore.getState().sessionTemplates).filter(
      (id) => useStore.getState().sessionTemplates[id].programId === pid,
    );
    useStore.setState((s) => ({
      sessionTemplates: {
        ...s.sessionTemplates,
        ...Object.fromEntries(tids.map((tid, i) => [tid, { ...s.sessionTemplates[tid], exercises: ejercicios[i] }])),
      },
    }));
    return tids;
  }
  const exs = (tid) => useStore.getState().sessionTemplates[tid].exercises;

  it('unilateral con gemelo: pasa al de la librería y conserva la configuración', () => {
    const [t] = programa([{ exerciseId: 'cable_row', sets: 4, restSec: 75, variant: { grip: 'neutral', width: 'wide' } }]);
    const res = useStore.getState().changeExerciseIdentity(t, 'cable_row', { root: 'cable_row', uni: true, variant: null });
    expect(res).toEqual({ id: 'single_arm_cable_row' });
    // Una mano no tiene anchura; el agarre se queda.
    expect(exs(t)[0]).toMatchObject({ exerciseId: 'single_arm_cable_row', sets: 4, restSec: 75, variant: { grip: 'neutral' } });
    expect(useStore.getState().customExercises).toEqual({});
  });

  it('unilateral sin gemelo: se crea el derivado como ejercicio propio', () => {
    const [t] = programa([{ exerciseId: 'pulldown', sets: 3 }]);
    useStore.getState().changeExerciseIdentity(t, 'pulldown', { root: 'pulldown', uni: true, variant: null });
    expect(exs(t)[0].exerciseId).toBe('pulldown__uni');
    expect(useStore.getState().customExercises.pulldown__uni).toMatchObject({ name: 'Jalón al pecho unilateral', isCustom: false });
  });

  it('aparte: la variante queda fija en la sesión y apagarlo la devuelve como variante normal', () => {
    const v = { grip: 'pronated', width: 'wide' };
    const [t] = programa([{ exerciseId: 'pulldown', sets: 3, variant: v }]);
    useStore.getState().changeExerciseIdentity(t, 'pulldown', { root: 'pulldown', uni: false, variant: v });
    expect(exs(t)[0]).toMatchObject({ exerciseId: 'pulldown__pronated_wide', variant: v });
    useStore.getState().changeExerciseIdentity(t, 'pulldown__pronated_wide', { root: 'pulldown', uni: false, variant: null });
    expect(exs(t)[0]).toMatchObject({ exerciseId: 'pulldown', variant: v });
  });

  it('bloqueo: no deja el mismo ejercicio dos veces en la sesión', () => {
    const v = { grip: 'pronated' };
    const [t] = programa([
      { exerciseId: 'pulldown__pronated', sets: 3, variant: v },
      { exerciseId: 'pulldown', sets: 3 },
    ]);
    useStore.setState({
      customExercises: { pulldown__pronated: { ...EXERCISE_LIBRARY.pulldown, id: 'pulldown__pronated', variants: {}, derived: { root: 'pulldown', unilateral: false, variant: v } } },
    });
    const target = { root: 'pulldown', uni: false, variant: null };
    expect(useStore.getState().identityCheck(t, 'pulldown__pronated', target)).toMatchObject({ blocked: true, linked: false, name: 'Jalón al pecho' });
    expect(useStore.getState().changeExerciseIdentity(t, 'pulldown__pronated', target)).toMatchObject({ blocked: true });
    expect(exs(t).map((e) => e.exerciseId)).toEqual(['pulldown__pronated', 'pulldown']);
  });

  it('vinculado: cambia en todo el grupo, y se bloquea si choca en otra sesión del grupo', () => {
    const [a, b] = programa(
      [{ exerciseId: 'pulldown', sets: 3, linkGroup: 'g1' }],
      [{ exerciseId: 'pulldown', sets: 3, linkGroup: 'g1' }, { exerciseId: 'pulldown__uni', sets: 2 }],
    );
    useStore.setState({ customExercises: { pulldown__uni: { ...EXERCISE_LIBRARY.pulldown, id: 'pulldown__uni', isUnilateral: true, derived: { root: 'pulldown', unilateral: true, variant: null } } } });
    const uni = { root: 'pulldown', uni: true, variant: null };
    expect(useStore.getState().identityCheck(a, 'pulldown', uni)).toMatchObject({ blocked: true, linked: true });

    useStore.setState((s) => ({ sessionTemplates: { ...s.sessionTemplates, [b]: { ...s.sessionTemplates[b], exercises: exs(b).slice(0, 1) } } }));
    expect(useStore.getState().changeExerciseIdentity(a, 'pulldown', uni)).toEqual({ id: 'pulldown__uni' });
    expect(exs(a)[0].exerciseId).toBe('pulldown__uni');
    expect(exs(b)[0].exerciseId).toBe('pulldown__uni');
  });
});

describe('saveSession — lo que se ve en gris se da por hecho (QA P48)', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  const S = () => useStore.getState();
  const f = (i, k, v) => S().updateSetField('squat_barbell', i, k, v);
  // Sin progresión: el gris es lo de la última vez (con ella es el plan, P56 §6.1,
  // y el 90×8 de abajo subiría a 95×6).
  const free = (extra = {}) => {
    const id = S().createFreeTemplate({ exercises: [{ exerciseId: 'squat_barbell', sets: 2 }] });
    useStore.setState((st) => ({ sessionTemplates: { ...st.sessionTemplates, [id]: {
      ...st.sessionTemplates[id],
      exercises: st.sessionTemplates[id].exercises.map((e) => ({ ...e, progression: { type: 'none' }, ...extra })),
    } } }));
    return id;
  };
  const train = (id, fill, at) => {
    vi.setSystemTime(at);
    S().startSession(id);
    [0, 1].forEach(fill);
    const { entryId } = S().saveSession();
    return S().workoutLog.find((e) => e.id === entryId).exercises[0].sets;
  };

  it('peso y RPE escritos con las reps en gris: guarda las reps de referencia', () => {
    const id = free();
    train(id, (i) => { f(i, 'weight', '90'); f(i, 'reps', '8'); }, 1_700_000_000_000);
    const sets = train(id, (i) => { f(i, 'weight', '100'); f(i, 'rpe', '8'); }, 1_700_100_000_000);
    expect(sets).toEqual([0, 1].map(() => expect.objectContaining({ weight: '100', reps: '8', rpe: '8', done: true })));
  });

  it('solo el RPE escrito, peso y reps en gris, sin ✓: la serie se da por buena', () => {
    const id = free();
    train(id, (i) => { f(i, 'weight', '90'); f(i, 'reps', '8'); }, 1_700_000_000_000);
    const sets = train(id, (i) => { f(i, 'rpe', '8'); }, 1_700_100_000_000);
    expect(sets).toEqual([0, 1].map(() => expect.objectContaining({ weight: '90', reps: '8', rpe: '8', done: true })));
  });

  it('una serie sin tocar no se guarda, aunque tenga gris', () => {
    const id = free();
    train(id, (i) => { f(i, 'weight', '90'); f(i, 'reps', '8'); }, 1_700_000_000_000);
    const sets = train(id, (i) => { if (i === 0) f(i, 'reps', '9'); }, 1_700_100_000_000);
    expect(sets).toEqual([expect.objectContaining({ weight: '90', reps: '9', done: true })]);
  });

  it('✓ sin peso ni reps propios: los de referencia, sin perder el RPE', () => {
    const id = free();
    train(id, (i) => { f(i, 'weight', '90'); f(i, 'reps', '8'); }, 1_700_000_000_000);
    const sets = train(id, (i) => { f(i, 'rpe', '7'); f(i, 'done', true); }, 1_700_100_000_000);
    expect(sets).toEqual([0, 1].map(() => expect.objectContaining({ weight: '90', reps: '8', rpe: '7', done: true })));
  });

  // ── P56 §6.1: el gris es el plan ─────────────────────────────────────────────
  const withProgression = (progression, extra = {}) => free({ progression, minReps: 8, maxReps: 12, weightStep: 2.5, ...extra });
  const DOUBLE = { type: 'double', increment: { type: 'fixed', value: 2.5 } };

  it('P56: ✓ sin escribir guarda el peso del plan (62.5), no el de la última vez (60)', () => {
    const id = withProgression(DOUBLE);
    train(id, (i) => { f(i, 'weight', '60'); f(i, 'reps', '12'); }, 1_700_000_000_000);
    const sets = train(id, (i) => { f(i, 'done', true); }, 1_700_100_000_000);
    expect(sets).toEqual([0, 1].map(() => expect.objectContaining({ weight: '62.5', reps: '12', done: true })));
  });

  it('P56: si no se cumplió, el gris es lo que hiciste (mantener)', () => {
    const id = withProgression(DOUBLE);
    vi.setSystemTime(1_700_000_000_000);
    S().startSession(id);
    f(0, 'weight', '60'); f(0, 'reps', '12'); f(1, 'weight', '60'); f(1, 'reps', '9');
    S().saveSession();
    vi.setSystemTime(1_700_100_000_000);
    S().startSession(id);
    [0, 1].forEach((i) => f(i, 'done', true));
    const { entryId } = S().saveSession();
    const sets = S().workoutLog.find((e) => e.id === entryId).exercises[0].sets;
    expect(sets.map((x) => [x.weight, x.reps])).toEqual([['60', '12'], ['60', '9']]);
  });

  it('P56: lo escrito a mano gana al plan, y el objetivo del entrenador al plan', () => {
    const id = withProgression(DOUBLE);
    train(id, (i) => { f(i, 'weight', '60'); f(i, 'reps', '12'); }, 1_700_000_000_000);
    const sets = train(id, (i) => { f(i, 'weight', '70'); }, 1_700_100_000_000);
    expect(sets).toEqual([0, 1].map(() => expect.objectContaining({ weight: '70', reps: '12' })));
  });

  it('P56: Por esfuerzo guarda el peso del plan calculado con las tres últimas sesiones', () => {
    // 5 reps @8 = 7RM: 57 / 60 / 63 kg → 1RM 70.3 / 74 / 77.7 (media 74). A 5 @8
    // el peso del plan es 60 con la media y 63 solo con la última.
    const id = withProgression({ type: 'effort', targetRpe: 8 }, { minReps: 5, maxReps: 5 });
    const eff = (w) => (i) => { f(i, 'weight', w); f(i, 'reps', '5'); f(i, 'rpe', '8'); };
    train(id, eff('57'), 1_700_000_000_000);
    train(id, eff('60'), 1_700_100_000_000);
    train(id, eff('63'), 1_700_200_000_000);
    const sets = train(id, (i) => { f(i, 'done', true); }, 1_700_300_000_000);
    expect(sets).toEqual([0, 1].map(() => expect.objectContaining({ weight: '60', reps: '5' })));
  });

  it('P56 §6.5: el log de una etapa de descarga lleva deload: true; el de una normal, no', () => {
    const normal = withProgression(DOUBLE);
    const a = train(normal, (i) => { f(i, 'weight', '60'); f(i, 'reps', '12'); }, 1_700_000_000_000);
    expect(a).toHaveLength(2);
    expect(S().workoutLog.at(-1).exercises[0]).not.toHaveProperty('deload');
    const dl = withProgression({ ...DOUBLE, hold: 'deload' });
    train(dl, (i) => { f(i, 'weight', '60'); f(i, 'reps', '8'); }, 1_700_100_000_000);
    expect(S().workoutLog.at(-1).exercises[0].deload).toBe(true);
  });
});

