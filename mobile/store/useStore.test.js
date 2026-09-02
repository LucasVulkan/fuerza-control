/**
 * Regression cover for the two critical findings of `docs/specs/auditoria-tecnica.md`.
 *
 * Importing the store here only works because `vite.config.js` aliases the
 * React Native / Expo surface to `test/native-stub.js`.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

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

const { useStore } = await import('./useStore.js');

/** The callback zustand invokes once the persisted state has been read. */
const rehydrateCallback = () => useStore.persist.getOptions().onRehydrateStorage();

describe('onRehydrateStorage — fallo 1', () => {
  beforeEach(() => {
    useStore.setState({ _hasHydrated: false, _initialRoute: 'Main' });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('marca _hasHydrated cuando la lectura de storage falla', () => {
    // Zustand llama (undefined, error) por este camino — middleware.js:439.
    rehydrateCallback()(undefined, new Error('storage ilegible'));

    expect(useStore.getState()._hasHydrated).toBe(true);
  });

  it('marca _hasHydrated aunque una migración lance', () => {
    const explosivo = { get profile() { throw new Error('estado con forma inesperada'); } };

    expect(() => rehydrateCallback()(explosivo, undefined)).not.toThrow();
    expect(useStore.getState()._hasHydrated).toBe(true);
  });

  it('sin estado que rehidratar arranca en Setup, no en Main', () => {
    // El store se queda con el estado inicial: mismo caso que una instalación
    // nueva, así que la ruta tiene que ser la del primer arranque.
    useStore.setState({
      profile: { ...useStore.getState().profile, setupComplete: false, onboardingCompleted: false, activeProgramId: null },
    });

    rehydrateCallback()(undefined, new Error('boom'));

    expect(useStore.getState()._initialRoute).toBe('Setup');
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

/**
 * Modelo de programas — `owner` + `kind` (`docs/specs/program-model.md` §3).
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
      currentStageIndex: 1, cycleCompletedIds: ['tpl_x'], stageWeeksCompleted: 3,
      totalWeeksCompleted: 9, stageActivatedAt: '2026-08-01',
    };
    const incoming = (stageActivatedAt) => ({
      version: '3', exportType: 'program',
      program: {
        id: 'prog_x', name: 'Mío v2', owner: 'me', kind: 'program', status: 'active', stages,
        currentStageIndex: 0, cycleCompletedIds: [], stageWeeksCompleted: 0,
        totalWeeksCompleted: 0, stageActivatedAt,
      },
      sessionTemplates: {}, userPrograms: {},
    });

    it('el programa se actualiza y el ciclo se queda donde estaba', () => {
      useStore.setState({ programs: { prog_x: local } });

      useStore.getState().importData(incoming('2026-08-01'), { program: true }, { silent: true });

      const p = useStore.getState().programs.prog_x;
      expect(p.name).toBe('Mío v2');
      expect(p.currentStageIndex).toBe(1);
      expect(p.stageWeeksCompleted).toBe(3);
      expect(p.cycleCompletedIds).toEqual(['tpl_x']);
      expect(p.totalWeeksCompleted).toBe(9);
    });

    it('salvo que el entrenador active otra etapa: entonces manda él y empieza de cero', () => {
      useStore.setState({ programs: { prog_x: local } });

      useStore.getState().importData(incoming('2026-09-02'), { program: true }, { silent: true });

      const p = useStore.getState().programs.prog_x;
      expect(p.currentStageIndex).toBe(0);
      expect(p.stageWeeksCompleted).toBe(0);
      expect(p.cycleCompletedIds).toEqual([]);
      expect(p.totalWeeksCompleted).toBe(9);   // acumulado de por vida, nunca se reinicia
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
 * Un solo diccionario de sesiones (`docs/specs/program-model.md` §4).
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
