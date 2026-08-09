/**
 * Regression cover for the two critical findings of `docs/specs/auditoria-tecnica.md`.
 *
 * Importing the store here only works because `vite.config.js` aliases the
 * React Native / Expo surface to `test/native-stub.js`.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useStore } from './useStore.js';

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

    expect(useStore.getState().programs[managedId].mode).toBe('managed');
    expect(useStore.getState().programs[managedId].clientId).toBe(clientId);
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
      tpl_mia_1: { id: 'tpl_mia_1', name: 'Mía 1', mode: 'template', days: [] },
      tpl_mia_2: { id: 'tpl_mia_2', name: 'Mía 2', mode: 'template', days: [] },
      tpl_mia_3: { id: 'tpl_mia_3', name: 'Mía 3', mode: 'template', days: [] },
      prog_mio:  { id: 'prog_mio',  name: 'Mi programa', mode: 'personal', days: [] },
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

  const plantillas = () => Object.values(useStore.getState().programs).filter((p) => p.mode === 'template');

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
