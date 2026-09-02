/**
 * Fases de una plantilla → etapas del programa
 * (`docs/specs/program-templates.md` §6).
 *
 * Vive junto al store porque el mecanismo es suyo: `adaptArchetype` sólo produce
 * la etapa base, y las fases 2..N las materializa `generateAndActivateProgram`
 * llamando a `addStageToProgram`, que ya sabe clonar, aplicar el `rx` y encadenar
 * `derivedFrom`. Importar el store aquí sólo funciona por el alias de
 * `vite.config.js` a `test/native-stub.js`.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from './useStore.js';
import { ARCHETYPES, DEFAULT_PHASES } from '../../src/data/archetypes.js';

const ANSWERS = {
  level: 'intermediate',
  discipline: 'standard',
  distribution: 'full_body',
  daysPerWeek: 3,
  goal: 'hypertrophy',
  equipment: ['dumbbells', 'machines', 'cables', 'barbell', 'pullup_bar'],
  limitations: ['none'],
  sessionMinutes: 90,
};

const generate = (answers = ANSWERS) => useStore.getState().generateAndActivateProgram(answers);

describe('fases de plantilla → etapas', () => {
  beforeEach(() => {
    useStore.setState({ programs: {}, sessionTemplates: {} });
  });

  it('una plantilla de 3 fases produce 3 etapas con sus duraciones', async () => {
    const { program } = await generate();

    expect(program.stages).toHaveLength(3);
    expect(program.stages.map((s) => s.durationWeeks)).toEqual([4, 3, 1]);
    expect(program.stages.map((s) => s.name)).toEqual(['Acumulación', 'Intensificación', 'Descarga']);
    expect(program.currentStageIndex).toBe(0);
  });

  it('el programa dura lo que suman sus fases', async () => {
    const { program } = await generate();
    const total = program.stages.reduce((n, s) => n + s.durationWeeks, 0);
    expect(total).toBe(8);
  });

  // Era "`days` sigue espejando la etapa activa". El espejo murió: los días
  // viven en su etapa y en ningún otro sitio (program-model.md §5).
  it('el programa no guarda una copia de los días de la etapa', async () => {
    const { program } = await generate();
    expect(program.days).toBeUndefined();
    expect(program.stages[0].days.length).toBeGreaterThan(0);
  });

  it('cada etapa tiene sus propias plantillas de sesión, encadenadas a la base', async () => {
    const { program } = await generate();
    const { sessionTemplates } = useStore.getState();

    const base = program.stages[0].days.map((d) => d.sessionTemplateId);
    program.stages.slice(1).forEach((stage) => {
      const ids = stage.days.map((d) => d.sessionTemplateId);
      expect(ids.some((id) => base.includes(id))).toBe(false); // ids frescos
      ids.forEach((id, i) => {
        // Sin la cadena, la primera sesión de cada fase deja al cliente sin chip
        // de progresión y sin pesos de referencia (stage-planner.md §4.1).
        expect(sessionTemplates[id].derivedFrom).toBe(base[i]);
      });
    });
  });

  it('la intensificación acorta las repeticiones de los principales, no de los accesorios', async () => {
    const { program } = await generate();
    const { sessionTemplates } = useStore.getState();

    const base = sessionTemplates[program.stages[0].days[0].sessionTemplateId];
    const hard = sessionTemplates[program.stages[1].days[0].sessionTemplateId];

    base.exercises.forEach((ex, i) => {
      const after = hard.exercises[i];
      expect(after.exerciseId).toBe(ex.exerciseId);
      if (ex.isKey && ex.minReps != null) {
        expect(after.minReps).toBe(Math.max(1, ex.minReps - 3));
        expect(after.restSec).toBeGreaterThan(ex.restSec);
      } else if (!ex.isKey) {
        expect(after.minReps).toBe(ex.minReps);
      }
    });
  });

  it('la descarga baja series y marca el hold de progresión', async () => {
    const { program } = await generate();
    const { sessionTemplates } = useStore.getState();

    const base = sessionTemplates[program.stages[0].days[0].sessionTemplateId];
    const deload = sessionTemplates[program.stages[2].days[0].sessionTemplateId];

    deload.exercises.forEach((ex, i) => {
      expect(ex.sets).toBe(Math.max(1, base.exercises[i].sets - 1));
      expect(ex.progression?.hold ?? ex.progressionHold).toBeTruthy();
    });
  });

  it('los deltas son absolutos contra la base, no acumulativos', async () => {
    const { program } = await generate();
    const { sessionTemplates } = useStore.getState();

    const base = sessionTemplates[program.stages[0].days[0].sessionTemplateId];
    const deload = sessionTemplates[program.stages[2].days[0].sessionTemplateId];

    // La descarga deriva de la BASE: si acumulase sobre la intensificación,
    // arrastraría también su repsShift.
    deload.exercises.forEach((ex, i) => {
      expect(ex.minReps).toBe(base.exercises[i].minReps);
    });
  });

  it('sin fases declaradas, una sola etapa sin límite — el comportamiento de siempre', async () => {
    const bare = { ...ARCHETYPES[0] };
    delete bare.phases;
    const { adaptArchetype } = await import('../../src/utils/archetypeAdapter.js');
    const { program, phases } = adaptArchetype(bare, ANSWERS);

    expect(phases).toBeNull();
    expect(program.stages).toHaveLength(1);
    expect(program.stages[0].durationWeeks).toBeNull();
  });

  it('el camino procedural no inventa fases', async () => {
    // Una combinación sin plantilla: 5 días de upper/lower no existe en el catálogo.
    const { program } = await generate({ ...ANSWERS, distribution: 'upper_lower', daysPerWeek: 5 });
    expect(program.stages.length).toBeGreaterThanOrEqual(1);
    if (program.stages.length === 1) expect(program.stages[0].durationWeeks).toBeNull();
  });

  it('cada esquema de fases empieza por la base y acaba en descarga', () => {
    Object.values(DEFAULT_PHASES).forEach((phases) => {
      expect(phases[0].rx).toBeNull();
      expect(phases[phases.length - 1].rx.progressionHold).toBe('deload');
      phases.forEach((p) => expect(p.durationWeeks).toBeGreaterThan(0));
    });
  });

  it('los grupos de vinculación no cruzan de fase', async () => {
    // Sin remapear, un ejercicio vinculado en la etapa base seguiria en el mismo
    // grupo en la fase 2: editar la intensificación editaría la acumulación, que
    // es justo lo que las fases existen para separar. `duplicateStageInProgram`
    // ya lo hacía; `addStageToProgram`, que es quien materializa las fases, no.
    const { program } = await generate();
    const { sessionTemplates } = useStore.getState();

    const groupsOf = (stage) => new Set(
      stage.days
        .flatMap((d) => sessionTemplates[d.sessionTemplateId].exercises)
        .map((e) => e.linkGroup)
        .filter(Boolean),
    );

    const perStage = program.stages.map(groupsOf);
    expect(perStage[0].size).toBeGreaterThan(0); // hay algo que vincular

    perStage.forEach((groups, i) => {
      perStage.slice(i + 1).forEach((later) => {
        [...groups].forEach((g) => expect(later.has(g)).toBe(false));
      });
    });
  });

  it('dentro de una fase, lo repetido sigue vinculado entre sí', async () => {
    const { program } = await generate();
    const { sessionTemplates } = useStore.getState();

    program.stages.forEach((stage) => {
      const exercises = stage.days.flatMap((d) => sessionTemplates[d.sessionTemplateId].exercises);
      const byGroup = new Map();
      exercises.filter((e) => e.linkGroup)
        .forEach((e) => byGroup.set(e.linkGroup, [...(byGroup.get(e.linkGroup) ?? []), e]));
      byGroup.forEach((members) => expect(members.length).toBeGreaterThanOrEqual(2));
    });
  });

  it('todas las plantillas del catálogo declaran fases', () => {
    ARCHETYPES.forEach((a) => {
      expect(a.phases, a.id).toBeTruthy();
      expect(a.phases[0].rx, a.id).toBeNull();
    });
  });
});
