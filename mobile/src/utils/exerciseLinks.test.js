import { describe, it, expect } from 'vitest';
import {
  programTemplateIds, linkGroupTemplateIds, lastLinkedExercise,
  exerciseLinkGroups, exerciseInstanceCount, pickLinkedConfig,
  templateChainIds, lastExerciseRef, LINKED_CONFIG_KEYS,
} from './exerciseLinks';

const TPLS = {
  tplA: { label: 'A', exercises: [{ exerciseId: 'squat', linkGroup: 'g1' }, { exerciseId: 'bench' }] },
  tplB: { label: 'B', exercises: [{ exerciseId: 'squat', linkGroup: 'g1' }] },
  tplC: { label: 'C', exercises: [{ exerciseId: 'squat', linkGroup: 'g2' }] },
  tplD: { label: 'D', exercises: [{ exerciseId: 'squat' }] }, // heavy day, unlinked
};
const getTpl = (id) => TPLS[id];

const flatProgram   = { days: [{ sessionTemplateId: 'tplA' }, { sessionTemplateId: 'tplB' }] };
const stagedProgram = {
  stages: [
    { days: [{ sessionTemplateId: 'tplA' }, { sessionTemplateId: 'tplB' }] },
    { days: [{ sessionTemplateId: 'tplC' }, { sessionTemplateId: 'tplD' }] },
  ],
};

describe('programTemplateIds', () => {
  it('reads flat and staged programs', () => {
    expect(programTemplateIds(flatProgram)).toEqual(['tplA', 'tplB']);
    expect(programTemplateIds(stagedProgram)).toEqual(['tplA', 'tplB', 'tplC', 'tplD']);
    expect(programTemplateIds(null)).toEqual([]);
  });
});

describe('linkGroupTemplateIds', () => {
  it('returns only members of the same group', () => {
    expect(linkGroupTemplateIds(stagedProgram, 'squat', 'g1', getTpl)).toEqual(['tplA', 'tplB']);
    expect(linkGroupTemplateIds(stagedProgram, 'squat', 'g2', getTpl)).toEqual(['tplC']);
  });
  it('no group → empty', () => {
    expect(linkGroupTemplateIds(stagedProgram, 'squat', null, getTpl)).toEqual([]);
  });
});

describe('lastLinkedExercise', () => {
  const log = [
    { sessionTemplateId: 'tplA', timestamp: 100, exercises: [{ exerciseId: 'squat', sets: [{ weight: '100' }] }] },
    { sessionTemplateId: 'tplD', timestamp: 200, exercises: [{ exerciseId: 'squat', sets: [{ weight: '140' }] }] },
    { sessionTemplateId: 'tplB', timestamp: 150, exercises: [{ exerciseId: 'squat', sets: [{ weight: '105' }] }] },
  ];

  it('returns the most recent performance within the group only', () => {
    const ex = lastLinkedExercise(log, ['tplA', 'tplB'], 'squat');
    expect(ex.sets[0].weight).toBe('105'); // tplD (140, newer) is outside the group
  });

  it('skips entries where the exercise is missing', () => {
    const log2 = [
      ...log,
      { sessionTemplateId: 'tplB', timestamp: 300, exercises: [{ exerciseId: 'bench', sets: [{ weight: '80' }] }] },
    ];
    expect(lastLinkedExercise(log2, ['tplA', 'tplB'], 'squat').sets[0].weight).toBe('105');
  });

  it('no entries → null', () => {
    expect(lastLinkedExercise(log, ['tplC'], 'squat')).toBeNull();
  });
});

describe('exerciseLinkGroups', () => {
  it('collects groups with session labels', () => {
    const groups = exerciseLinkGroups(stagedProgram, 'squat', getTpl);
    expect(groups).toHaveLength(2);
    expect(groups.find((g) => g.id === 'g1').sessions).toEqual(['A', 'B']);
    expect(groups.find((g) => g.id === 'g2').sessions).toEqual(['C']);
  });
});

describe('exerciseInstanceCount', () => {
  it('counts sessions containing the exercise', () => {
    expect(exerciseInstanceCount(stagedProgram, 'squat', getTpl)).toBe(4);
    expect(exerciseInstanceCount(stagedProgram, 'bench', getTpl)).toBe(1);
  });
});

describe('pickLinkedConfig', () => {
  it('copies only shared-config fields', () => {
    const cfg = pickLinkedConfig({
      exerciseId: 'squat', order: 2, linkGroup: 'g1',
      sets: 3, restSec: 90, minReps: 8, maxReps: 12, trackRpe: true,
      progression: { type: 'double' },
    });
    expect(cfg).toEqual({
      sets: 3, restSec: 90, minReps: 8, maxReps: 12, trackRpe: true,
      progression: { type: 'double' },
    });
    expect(cfg.exerciseId).toBeUndefined();
    expect(cfg.linkGroup).toBeUndefined();
  });

  it('carries isKey — estar vinculado es compartir la estructura ENTERA', () => {
    // Si una sentadilla es la principal de un día y accesoria de otro, su
    // programación ya difiere y no deberían compartir grupo. La salida es
    // desvincular, no una excepción que el usuario no puede adivinar.
    expect(pickLinkedConfig({ exerciseId: 'squat', isKey: true, sets: 4 })).toEqual({ isKey: true, sets: 4 });
    expect(LINKED_CONFIG_KEYS).toContain('isKey');
  });
});

// ── Cadena de etapas (docs/specs/stage-planner.md §4.1) ─────────────────────

describe('templateChainIds', () => {
  // Etapa 3 → etapa 2 → etapa 1, mismo día de la semana.
  const CHAIN = {
    tpl3: { id: 'tpl3', derivedFrom: 'tpl2', exercises: [] },
    tpl2: { id: 'tpl2', derivedFrom: 'tpl1', exercises: [] },
    tpl1: { id: 'tpl1', exercises: [] },
  };
  const get = (id) => CHAIN[id];

  it('walks back through every stage it descends from', () => {
    expect(templateChainIds('tpl3', get)).toEqual(['tpl3', 'tpl2', 'tpl1']);
  });

  it('always includes the template itself, chain or not', () => {
    expect(templateChainIds('tpl1', get)).toEqual(['tpl1']);
    expect(templateChainIds('nope', get)).toEqual(['nope']);
  });

  it('stops at a deleted ancestor instead of throwing', () => {
    const broken = { tplX: { id: 'tplX', derivedFrom: 'gone' } };
    expect(templateChainIds('tplX', (id) => broken[id])).toEqual(['tplX', 'gone']);
  });

  it('cannot hang on a circular derivedFrom', () => {
    const loop = { a: { derivedFrom: 'b' }, b: { derivedFrom: 'a' } };
    expect(templateChainIds('a', (id) => loop[id])).toEqual(['a', 'b']);
  });
});

describe('lastExerciseRef', () => {
  const TPLS_CHAIN = {
    tpl2: { id: 'tpl2', derivedFrom: 'tpl1', exercises: [{ exerciseId: 'squat' }] },
    tpl1: { id: 'tpl1', exercises: [{ exerciseId: 'squat' }] },
    tplLinkA: { id: 'tplLinkA', exercises: [{ exerciseId: 'squat', linkGroup: 'g1' }] },
    tplLinkB: { id: 'tplLinkB', exercises: [{ exerciseId: 'squat', linkGroup: 'g1' }] },
  };
  const get = (id) => TPLS_CHAIN[id];
  const program = {
    stages: [
      { days: [{ sessionTemplateId: 'tpl1' }, { sessionTemplateId: 'tplLinkA' }] },
      { days: [{ sessionTemplateId: 'tpl2' }, { sessionTemplateId: 'tplLinkB' }] },
    ],
  };
  const setsOf = (kg) => [{ weight: String(kg), reps: '5', done: true }];
  const log = [
    { sessionTemplateId: 'tpl1',     timestamp: 100, exercises: [{ exerciseId: 'squat', sets: setsOf(100) }] },
    { sessionTemplateId: 'tplLinkA', timestamp: 200, exercises: [{ exerciseId: 'squat', sets: setsOf(80) }] },
  ];

  it('finds the reference through the stage chain — the bug this fixes', () => {
    // tpl2 es la sesión de la etapa NUEVA: nunca se ha entrenado bajo ese id.
    // Sin la cadena esto era null → ni chip de progresión ni pesos fantasma.
    const ref = lastExerciseRef({
      workoutLog: log, program, templateId: 'tpl2',
      exConfig: { exerciseId: 'squat' }, getTemplate: get,
    });
    expect(ref?.sets[0].weight).toBe('100');
  });

  it('a link group wins over the chain — it is an explicit trainer decision', () => {
    const ref = lastExerciseRef({
      workoutLog: log, program, templateId: 'tplLinkB',
      exConfig: { exerciseId: 'squat', linkGroup: 'g1' }, getTemplate: get,
    });
    expect(ref?.sets[0].weight).toBe('80');
  });

  it('returns null when the exercise has never been logged', () => {
    expect(lastExerciseRef({
      workoutLog: log, program, templateId: 'tpl2',
      exConfig: { exerciseId: 'bench' }, getTemplate: get,
    })).toBeNull();
  });

  it('is null-safe on a missing exConfig', () => {
    expect(lastExerciseRef({ workoutLog: log, program, templateId: 'tpl2', exConfig: null, getTemplate: get })).toBeNull();
  });
});
