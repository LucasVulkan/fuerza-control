/**
 * El programa del constructor guiado (O03-02): crear al «Siguiente», ajustar sin
 * recrear, las líneas de «Listo» y el envío al cliente.
 *
 * El store importa el servicio de sincronización y la autenticación enteros, así
 * que los dobles son los de `store/useStore.test.js`.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../services/supabaseSync', () => ({
  getTrainerSlots: vi.fn(async () => []),
  createClientSlot: vi.fn(), uploadProgram: vi.fn(), downloadHistory: vi.fn(),
  downloadProgram: vi.fn(), getSlotByClientCode: vi.fn(), linkClientToSlot: vi.fn(),
  uploadHistory: vi.fn(), uploadOverrides: vi.fn(), deleteClientSlot: vi.fn(),
  getClientSlotByUserId: vi.fn(), transferClientSlot: vi.fn(),
  updateTrainerNameForSlots: vi.fn(), releaseClientSlot: vi.fn(),
  reissueClientCode: vi.fn(), transferMySlotsTo: vi.fn(),
}));
vi.mock('../../services/supabaseAuth', () => ({
  signInAnonymously: vi.fn(async () => ({ userId: 'anon_1' })),
  recoverWithTrainerCode: vi.fn(), loginClientWithIdToken: vi.fn(),
  deleteAccount: vi.fn(), signOut: vi.fn(),
}));
vi.mock('../../config/supabase', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: null } }) } },
}));

const { useStore } = await import('../../../store/useStore.js');
const { ensureBuilderProgram, syncBuilderDone, sendBuilderProgram, leaveBuilder, builderState } = await import('./builderProgram.js');

// `t` de mentira: los nombres por defecto de verdad y, del resto, la clave y los datos, para ver qué pide cada línea.
const t = (key, o = {}) => {
  const k = key.replace('onboardingFlow.builder.', '');
  if (k === 'defaultName') return 'Mi programa';
  if (k === 'defaultNameClient') return `Programa de ${o.name}`;
  return `${k}|${o.name ?? ''}|${o.letters ?? ''}|${o.count ?? ''}`;
};

const flow = () => useStore.getState().onboardingFlow;
const program = () => builderState().program;
const doneOf = (key) => flow().done.find((d) => d.key === key);

beforeEach(() => {
  useStore.setState({
    programs: {}, sessionTemplates: {}, clients: {},
    profile: { ...useStore.getState().profile, activeProgramId: null },
  });
  useStore.getState().startOnboardingFlow();
});

describe('constructor guiado — por mi cuenta (self/copy)', () => {
  beforeEach(() => useStore.getState().flowAnswer({ builderCtx: 'self' }));

  it('crea el programa activo con las sesiones elegidas y guarda su id', () => {
    const id = ensureBuilderProgram(4, t);
    const s = useStore.getState();
    expect(s.programs[id].owner).toBe('me');
    expect(builderState().templates.map((x) => x.label)).toEqual(['A', 'B', 'C', 'D']);
    expect(s.profile.activeProgramId).toBe(id);
    expect(flow().answers).toMatchObject({ programId: id, programSource: 'builder' });
  });

  it('volver y cambiar el número añade o quita sesiones del final, sin recrear', () => {
    const id = ensureBuilderProgram(4, t);
    expect(ensureBuilderProgram(2, t)).toBe(id);
    expect(builderState().templates.map((x) => x.label)).toEqual(['A', 'B']);
    expect(Object.keys(useStore.getState().sessionTemplates)).toHaveLength(2);   // sin huérfanas
    expect(Object.keys(useStore.getState().programs)).toHaveLength(1);

    ensureBuilderProgram(3, t);
    expect(builderState().templates.map((x) => x.label)).toEqual(['A', 'B', 'C']);
  });

  it('«Listo»: el programa creado y el pendiente de las sesiones vacías', () => {
    ensureBuilderProgram(3, t);
    expect(doneOf('program')).toMatchObject({ ok: true, label: 'doneCreated|Mi programa||' });
    expect(doneOf('fill')).toMatchObject({ ok: false, label: 'fillSelf||A, B, C|3' });

    // con un ejercicio en A, solo faltan B y C
    useStore.getState().addExercise(builderState().templates[0].id, 'goblet_squat');
    syncBuilderDone(t);
    expect(doneOf('fill').label).toBe('fillSelf||B, C|2');
  });

  it('con una sola sesión y un ejercicio ya no queda nada pendiente', () => {
    ensureBuilderProgram(1, t);
    expect(doneOf('fill')).toBeDefined();
    useStore.getState().addExercise(builderState().templates[0].id, 'goblet_squat');
    syncBuilderDone(t);
    expect(doneOf('fill')).toBeUndefined();
  });

  it('«Lo termino después» con 3 elegidas deja 3 sesiones vacías y sale por builderExit', async () => {
    const goTo = vi.fn();
    await leaveBuilder(goTo, t, 3);
    expect(builderState().templates).toHaveLength(3);
    expect(goTo).toHaveBeenCalledWith('a_home');
  });

  it('«Lo termino después» sin elegir nada no crea programa', async () => {
    const goTo = vi.fn();
    await leaveBuilder(goTo, t, 0);
    expect(program()).toBeNull();
    expect(goTo).toHaveBeenCalledWith('a_home');
  });
});

describe('constructor guiado — el programa del cliente (trainer)', () => {
  beforeEach(() => {
    useStore.setState({ clients: { cli_1: { id: 'cli_1', name: 'Ana', syncSlotId: 'slot_1' } } });
    useStore.getState().flowAnswer({ builderCtx: 'trainer', clientId: 'cli_1', clientMode: 'app' });
  });

  it('es del cliente y su activo, sin abrir el editor ni gastar plantilla ni tocar mi programa', () => {
    useStore.setState({ ui: { ...useStore.getState().ui, _editingProgramId: null } });
    const id = ensureBuilderProgram(3, t);
    const s = useStore.getState();
    expect(s.programs[id]).toMatchObject({ owner: 'cli_1', kind: 'program' });
    expect(s.clients.cli_1.activeProgramId).toBe(id);
    expect(s.ui._editingProgramId).toBeNull();
    expect(s.profile.activeProgramId).toBeNull();
    expect(doneOf('program').label).toBe('doneCreated|Programa de Ana||');
    expect(doneOf('fill').label).toBe('fillClient||A, B, C|3');
  });

  it('sin ningún ejercicio no se envía; con uno, se sube y se marca sent', async () => {
    const upload = vi.fn(async () => {});
    useStore.setState({ uploadProgramToClient: upload });
    ensureBuilderProgram(2, t);

    expect(await sendBuilderProgram()).toBe(false);
    expect(upload).not.toHaveBeenCalled();
    expect(flow().answers.sent).toBe(false);

    useStore.getState().addExercise(builderState().templates[0].id, 'goblet_squat');
    expect(await sendBuilderProgram()).toBe(true);
    expect(upload).toHaveBeenCalledWith('cli_1', builderState().program.id);
    expect(flow().answers.sent).toBe(true);

    syncBuilderDone(t);
    expect(doneOf('program').label).toBe('doneSent|Programa de Ana||');
  });

  it('un cliente sin hueco en la nube (le apuntas tú) no se envía', async () => {
    useStore.setState({ clients: { cli_1: { id: 'cli_1', name: 'Ana' } }, uploadProgramToClient: vi.fn() });
    ensureBuilderProgram(2, t);
    useStore.getState().addExercise(builderState().templates[0].id, 'goblet_squat');
    expect(await sendBuilderProgram()).toBe(false);
  });

  it('«Lo termino después» con un ejercicio envía y sigue a invitar; sin ninguno, a «¿entrenas tú?»', async () => {
    useStore.setState({ uploadProgramToClient: vi.fn(async () => {}) });
    const vacio = vi.fn();
    await leaveBuilder(vacio, t, 2);
    expect(vacio).toHaveBeenCalledWith('t_self');   // programa vacío: sin enviar, sin invitación

    useStore.getState().addExercise(builderState().templates[0].id, 'goblet_squat');
    const conEjercicio = vi.fn();
    await leaveBuilder(conEjercicio, t);
    expect(conEjercicio).toHaveBeenCalledWith('t_invite');
  });

  it('si la subida falla, «Lo termino después» sale igual y el programa queda sin enviar', async () => {
    useStore.setState({ uploadProgramToClient: vi.fn(async () => { throw new Error('sin red'); }) });
    ensureBuilderProgram(2, t);
    useStore.getState().addExercise(builderState().templates[0].id, 'goblet_squat');
    const goTo = vi.fn();
    await leaveBuilder(goTo, t);
    expect(flow().answers.sent).toBe(false);
    expect(goTo).toHaveBeenCalledWith('t_self');
  });
});
