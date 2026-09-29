import { describe, it, expect } from 'vitest';
import { EXERCISE_LIBRARY } from '../data/exerciseLibrary';
import { migrateExerciseRefs, LEGACY_IDS } from './exerciseIdMigration';

const ex = (exerciseId, extra = {}) => ({ exerciseId, sets: 3, ...extra });

describe('migrateExerciseRefs', () => {
  it('los ids nuevos existen en la librería y los viejos no', () => {
    for (const [old, { id }] of Object.entries(LEGACY_IDS)) {
      expect(EXERCISE_LIBRARY[old]).toBeUndefined();
      expect(EXERCISE_LIBRARY[id]).toBeDefined();
    }
  });

  it('plantillas, historial y alias pasan al id nuevo con la variante del nombre', () => {
    const data = {
      sessionTemplates: { tA: { id: 'tA', exercises: [ex('pulldown_pronated'), ex('squat_barbell')] } },
      workoutLog: [{ id: 'l1', sessionTemplateId: 'tA', exercises: [ex('pulldown_pronated', { sets: [] })] }],
      clientLogs: { c1: [{ id: 'l2', sessionTemplateId: 'x', exercises: [ex('seated_row_neutral', { sets: [] })] }] },
      exerciseAliases: { 'jalon prono': 'pulldown_pronated' },
    };
    expect(migrateExerciseRefs(data, EXERCISE_LIBRARY)).toBe(true);
    expect(data.sessionTemplates.tA.exercises[0]).toMatchObject({ exerciseId: 'pulldown', variant: { grip: 'pronated' } });
    expect(data.sessionTemplates.tA.exercises[1]).toEqual(ex('squat_barbell'));
    expect(data.workoutLog[0].exercises[0]).toMatchObject({ exerciseId: 'pulldown', variant: { grip: 'pronated' } });
    expect(data.clientLogs.c1[0].exercises[0]).toMatchObject({ exerciseId: 'cable_row', variant: { grip: 'neutral' } });
    expect(data.exerciseAliases['jalon prono']).toBe('pulldown');
  });

  it('una variante que ya había no se pisa', () => {
    const data = { sessionTemplates: { t: { id: 't', exercises: [ex('pulldown_pronated', { variant: { width: 'wide' } })] } } };
    migrateExerciseRefs(data, EXERCISE_LIBRARY);
    expect(data.sessionTemplates.t.exercises[0].variant).toEqual({ width: 'wide' });
  });

  it('choque en una plantilla: el segundo pasa a ejercicio aparte, también en su historial', () => {
    const data = {
      sessionTemplates: { tB: { id: 'tB', exercises: [ex('pulldown_pronated'), ex('pulldown_neutral')] } },
      workoutLog: [
        { id: 'l1', sessionTemplateId: 'tB', exercises: [ex('pulldown_pronated', { sets: [] }), ex('pulldown_neutral', { sets: [] })] },
        { id: 'l2', sessionTemplateId: 'tB', exercises: [ex('pulldown_neutral', { sets: [] })] },
      ],
    };
    migrateExerciseRefs(data, EXERCISE_LIBRARY);
    const ids = data.sessionTemplates.tB.exercises.map((e) => e.exerciseId);
    expect(ids).toEqual(['pulldown', 'pulldown__neutral']);
    expect(data.customExercises.pulldown__neutral.name).toBe('Jalón al pecho · Neutro');
    expect(data.workoutLog[0].exercises.map((e) => e.exerciseId)).toEqual(['pulldown', 'pulldown__neutral']);
    // Aunque ese día solo hiciera el neutro, sigue siendo el aparte.
    expect(data.workoutLog[1].exercises[0].exerciseId).toBe('pulldown__neutral');
  });

  it('en un choque se queda el id el que no lleva variante', () => {
    const data = { sessionTemplates: { t: { id: 't', exercises: [ex('pull_up_neutral'), ex('pull_up_weighted_barbell')] } } };
    migrateExerciseRefs(data, EXERCISE_LIBRARY);
    expect(data.sessionTemplates.t.exercises.map((e) => e.exerciseId)).toEqual(['pull_up__neutral', 'pull_up']);
  });

  it('lastradas y sin lastre en la misma sesión: sin variante con la que separarse, la segunda conserva su id', () => {
    const data = {
      sessionTemplates: { t: { id: 't', exercises: [ex('pull_up_weighted'), ex('pull_up_weighted_barbell')] } },
      workoutLog: [{ id: 'l', sessionTemplateId: 't', exercises: [ex('pull_up_weighted_barbell', { sets: [] })] }],
    };
    migrateExerciseRefs(data, EXERCISE_LIBRARY);
    expect(data.sessionTemplates.t.exercises.map((e) => e.exerciseId)).toEqual(['pull_up', 'pull_up_weighted_barbell']);
    expect(data.customExercises.pull_up_weighted_barbell).toMatchObject({ name: 'Dominadas sin lastre', isCustom: false });
    expect(data.workoutLog[0].exercises[0].exerciseId).toBe('pull_up_weighted_barbell');
    expect(migrateExerciseRefs(data, EXERCISE_LIBRARY)).toBe(false);
  });

  it('bloques, prescripciones y sesión en curso', () => {
    const data = {
      sessionTemplates: { t: { id: 't', exercises: [ex('pulldown_supinated')], blocks: [{ movements: [{ exerciseId: 'pull_up_neutral' }] }] } },
      clientSync: { pendingOverrides: { t: { exercises: { pulldown_supinated: { sets: 4 } } } } },
      activeSession: {
        templateId: 't',
        setsState: { pulldown_supinated: [{ weight: '50' }] },
        exerciseNotes: { pulldown_supinated: 'bien' },
        adHocExercises: [{ exerciseId: 'seated_row_neutral', setsState: [] }],
      },
    };
    migrateExerciseRefs(data, EXERCISE_LIBRARY);
    expect(data.sessionTemplates.t.blocks[0].movements[0].exerciseId).toBe('pull_up');
    expect(data.clientSync.pendingOverrides.t.exercises).toEqual({ pulldown: { sets: 4 } });
    expect(data.activeSession.setsState).toEqual({ pulldown: [{ weight: '50' }] });
    expect(data.activeSession.exerciseNotes).toEqual({ pulldown: 'bien' });
    expect(data.activeSession.adHocExercises[0].exerciseId).toBe('cable_row');
  });

  it('es idempotente', () => {
    const data = { sessionTemplates: { t: { id: 't', exercises: [ex('pulldown_pronated'), ex('pulldown_neutral')] } } };
    migrateExerciseRefs(data, EXERCISE_LIBRARY);
    const snapshot = JSON.stringify(data);
    expect(migrateExerciseRefs(data, EXERCISE_LIBRARY)).toBe(false);
    expect(JSON.stringify(data)).toBe(snapshot);
  });
});

describe('isUnilateral de la sesión — exercise-variants.md §6.4', () => {
  it('encendido sobre uno de dos manos pasa a su versión unilateral y la clave se va', () => {
    const data = {
      sessionTemplates: { t: { id: 't', exercises: [
        ex('cable_row', { isUnilateral: true, variant: { grip: 'neutral', width: 'wide' } }),
        ex('pulldown', { isUnilateral: true }),
        ex('squat_barbell', { isUnilateral: false }),
      ] } },
    };
    expect(migrateExerciseRefs(data, EXERCISE_LIBRARY)).toBe(true);
    const [row, pull, squat] = data.sessionTemplates.t.exercises;
    expect(row).toEqual(ex('single_arm_cable_row', { variant: { grip: 'neutral' } }));
    expect(pull.exerciseId).toBe('pulldown__uni');
    expect(data.customExercises.pulldown__uni.isUnilateral).toBe(true);
    expect(squat).toEqual(ex('squat_barbell'));
    expect(migrateExerciseRefs(data, EXERCISE_LIBRARY)).toBe(false);
  });

  it('si la versión unilateral ya está en la sesión, solo se borra la clave', () => {
    const data = { sessionTemplates: { t: { id: 't', exercises: [
      ex('cable_row', { isUnilateral: true }), ex('single_arm_cable_row'),
    ] } } };
    migrateExerciseRefs(data, EXERCISE_LIBRARY);
    expect(data.sessionTemplates.t.exercises.map((e) => e.exerciseId)).toEqual(['cable_row', 'single_arm_cable_row']);
    expect('isUnilateral' in data.sessionTemplates.t.exercises[0]).toBe(false);
  });
});
