import { describe, it, expect } from 'vitest';
import { resolveSlot } from './slotResolver';
import { adaptArchetype } from './archetypeAdapter';
import { ARCHETYPES } from '../data/archetypes';
import { EXERCISE_LIBRARY } from '../data/exerciseLibrary';

const byId = (id) => ARCHETYPES.find((a) => a.id === id);

describe('resolveSlot — cascada', () => {
  it('escalón 1: patrón + grupo + equipo + nivel', () => {
    const r = resolveSlot({
      pattern: 'horizontal_push', primaryGroup: 'chest', tier: 1,
      userLevel: 'advanced', userEquipment: ['barbell', 'dumbbells'],
    });
    expect(r.step).toBe(1);
    expect(r.exercise.pattern).toBe('horizontal_push');
    expect(r.exercise.primaryGroup).toBe('chest');
  });

  it('sin el material de la preferencia, resuelve al mismo patrón y grupo con otro material', () => {
    const r = resolveSlot({
      pattern: 'horizontal_push', primaryGroup: 'chest', tier: 1,
      userLevel: 'intermediate', userEquipment: ['dumbbells'],
    });
    expect(r.exercise.pattern).toBe('horizontal_push');
    expect(r.exercise.primaryGroup).toBe('chest');
    expect(r.exercise.equipment).toContain('dumbbells');
  });

  it('un tier 1 nunca se resuelve a un aislamiento si hay compuesto disponible', () => {
    const r = resolveSlot({
      pattern: 'horizontal_push', primaryGroup: 'chest', tier: 1,
      userLevel: 'intermediate', userEquipment: ['dumbbells', 'machines', 'cables'],
    });
    expect(r.exercise.isCompound).toBe(true);
  });

  it('el objetivo decide entre candidatos del mismo hueco', () => {
    const forStrength = resolveSlot({
      pattern: 'squat', primaryGroup: 'quads', tier: 1, goal: 'strength',
      userLevel: 'advanced', userEquipment: ['barbell', 'dumbbells', 'machines', 'cables'],
    });
    expect(forStrength.exercise.priority?.strength).toBe('high');
  });

  it('con `excludeIds` no repite lo que ya está en la sesión', () => {
    const first = resolveSlot({
      pattern: 'vertical_pull', primaryGroup: 'back', tier: 1,
      userLevel: 'intermediate', userEquipment: ['machines', 'cables', 'pullup_bar'],
    });
    const second = resolveSlot({
      pattern: 'vertical_pull', primaryGroup: 'back', tier: 1,
      userLevel: 'intermediate', userEquipment: ['machines', 'cables', 'pullup_bar'],
      excludeIds: [first.exercise.id],
    });
    expect(second.exercise.id).not.toBe(first.exercise.id);
  });

  it('es determinista: las mismas entradas dan siempre el mismo ejercicio', () => {
    const args = {
      pattern: 'hip_hinge', primaryGroup: 'glutes_hamstrings', tier: 1,
      goal: 'hypertrophy', userLevel: 'intermediate', userEquipment: ['dumbbells', 'barbell'],
    };
    expect(resolveSlot(args).exercise.id).toBe(resolveSlot(args).exercise.id);
  });

  it('respeta el nivel mientras haya candidatos, y sólo entonces lo relaja', () => {
    const strict = resolveSlot({
      pattern: 'squat', primaryGroup: 'quads', tier: 1,
      userLevel: 'beginner', userEquipment: ['dumbbells'],
    });
    expect(strict.step).toBeLessThanOrEqual(2);
    if (strict.step === 1) expect(strict.exercise.level).toBe('beginner');
  });

  it('devuelve null cuando la biblioteca no tiene nada, en vez de un ejercicio inventado', () => {
    const r = resolveSlot({
      pattern: 'patron_inexistente', primaryGroup: 'grupo_inexistente', tier: 3,
      userLevel: 'beginner', userEquipment: [],
    });
    expect(r).toBeNull();
  });

  it('el escalón 5 (compuesto del grupo, cualquier patrón) es sólo para tier 1', () => {
    const slot = {
      pattern: 'patron_inexistente', primaryGroup: 'back',
      userLevel: 'advanced', userEquipment: ['barbell', 'dumbbells', 'machines', 'cables'],
    };
    expect(resolveSlot({ ...slot, tier: 1 })?.step).toBe(5);
    expect(resolveSlot({ ...slot, tier: 3 })).toBeNull();
  });
});

describe('adaptArchetype — diagnóstico de la adaptación', () => {
  const answers = {
    level: 'intermediate', discipline: 'standard', distribution: 'upper_lower',
    daysPerWeek: 4, goal: 'hypertrophy', equipment: ['dumbbells'],
    limitations: ['none'], sessionMinutes: 90,
  };

  it('registra las sustituciones con su motivo en vez de hacerlas en silencio', () => {
    const { substitutions } = adaptArchetype(byId('upperlower_hypertrophy_advanced'), answers);
    expect(substitutions.length).toBeGreaterThan(0);
    substitutions.forEach((s) => {
      expect(['equipment', 'level', 'limitation', 'duplicate']).toContain(s.reason);
      expect(EXERCISE_LIBRARY[s.resolvedExerciseId]).toBeTruthy();
      expect(s.resolvedExerciseId).not.toBe(s.slotExerciseId);
    });
  });

  it('sólo lo que hacía falta: con el material de la plantilla no sustituye nada', () => {
    const { substitutions } = adaptArchetype(byId('upperlower_hypertrophy_intermediate'), {
      ...answers, equipment: ['dumbbells', 'machines', 'cables', 'barbell', 'pullup_bar'],
    });
    expect(substitutions).toEqual([]);
  });

  it('ningún ejercicio resuelto queda fuera del material del usuario', () => {
    const { sessionTemplates } = adaptArchetype(byId('upperlower_hypertrophy_advanced'), answers);
    Object.values(sessionTemplates).forEach((tpl) => {
      tpl.exercises.forEach((ex) => {
        const def = EXERCISE_LIBRARY[ex.exerciseId];
        if (def.equipment?.length) {
          expect(def.equipment.some((e) => answers.equipment.includes(e))).toBe(true);
        }
      });
    });
  });

  it('un hueco irrellenable se declara en `unresolved`, y ningún tier 1 se pierde con material normal', () => {
    const { unresolved } = adaptArchetype(byId('upperlower_hypertrophy_advanced'), answers);
    expect(unresolved.filter((u) => u.tier === 1)).toEqual([]);
  });

  it('una limitación sustituye el principal por una variante suave, no lo borra', () => {
    const { sessionTemplates } = adaptArchetype(byId('fullbody_hypertrophy_intermediate'), {
      ...answers, distribution: 'full_body', daysPerWeek: 3,
      equipment: ['dumbbells', 'machines', 'cables', 'pullup_bar'],
      limitations: ['shoulder'],
    });
    Object.values(sessionTemplates).forEach((tpl) => {
      expect(tpl.exercises.filter((ex) => ex.isKey).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('dos slots que apuntan al mismo ejercicio no pierden el segundo', () => {
    const archetype = {
      ...byId('fullbody_hypertrophy_intermediate'),
      days: [{
        label: 'A', name: 'Test', color: 'var(--day1)', emphasis: 'pull',
        exercises: [
          { exerciseId: 'cable_row', role: 'key',       sets: 4, minReps: 8,  maxReps: 10, restSec: 120, pattern: 'horizontal_pull', primaryGroup: 'back' },
          { exerciseId: 'cable_row', role: 'accessory', sets: 3, minReps: 10, maxReps: 12, restSec: 90,  pattern: 'horizontal_pull', primaryGroup: 'back' },
        ],
      }],
    };
    const { sessionTemplates } = adaptArchetype(archetype, {
      ...answers, equipment: ['machines', 'cables'], sessionMinutes: 90,
    });
    const tpl = Object.values(sessionTemplates)[0];
    expect(tpl.exercises).toHaveLength(2);
    expect(tpl.exercises[0].exerciseId).not.toBe(tpl.exercises[1].exerciseId);
  });
});
