import { describe, it, expect } from 'vitest';
import { adaptArchetype } from './archetypeAdapter';
import { ARCHETYPES } from '../data/archetypes';

// Spec onboarding-simple.md §5.1: `levelCuts` es lo que `reduceForBeginner`
// tuvo que quitar/añadir para bajar una plantilla de otro nivel a beginner.
const byId = (id) => ARCHETYPES.find((a) => a.id === id);

const BEGINNER_ANSWERS = {
  level: 'beginner', discipline: 'standard', goal: 'hypertrophy', daysPerWeek: 3,
  equipment: ['machines', 'dumbbells', 'barbell', 'pullup_bar', 'kettlebell', 'resistance_band'],
  limitations: ['none'], sessionMinutes: 60,
};

describe('adaptArchetype — levelCuts', () => {
  it('un principiante con una plantilla de intermedio devuelve levelCuts con ids reales', () => {
    const { levelCuts } = adaptArchetype(byId('fullbody_hypertrophy_intermediate'), BEGINNER_ANSWERS);

    expect(levelCuts.length).toBeGreaterThan(0);
    for (const cut of levelCuts) {
      expect(typeof cut.label).toBe('string');
      expect(Array.isArray(cut.removedIds)).toBe(true);
      // Cada entrada quita algo o añade algo — nunca las dos cosas vacías.
      expect(cut.removedIds.length > 0 || cut.addedId != null).toBe(true);
    }
  });

  it('el mismo principiante con una plantilla ya beginner no recorta nada', () => {
    const { levelCuts } = adaptArchetype(byId('fullbody_hypertrophy_beginner'), BEGINNER_ANSWERS);
    expect(levelCuts).toEqual([]);
  });
});

// exercise-variants.md §3.2: los jalones se juntaron en uno con su agarre.
describe('arquetipos y variantes', () => {
  it('ningún día repite ejercicio (una sesión no admite el mismo dos veces)', () => {
    for (const a of ARCHETYPES) {
      for (const day of a.days) {
        const ids = day.exercises.map((e) => e.exerciseId);
        expect(new Set(ids).size, `${a.id} · ${day.label}`).toBe(ids.length);
      }
    }
  });

  it('la variante del arquetipo llega a la sesión generada', () => {
    const arch = ARCHETYPES.find((a) => a.days.some((d) => d.exercises.some((e) => e.exerciseId === 'pulldown' && e.variant)));
    const { sessionTemplates } = adaptArchetype(arch, {
      ...BEGINNER_ANSWERS, level: arch.level, equipment: [...BEGINNER_ANSWERS.equipment, 'cables'],
    });
    const pulldowns = Object.values(sessionTemplates).flatMap((t) => t.exercises).filter((e) => e.exerciseId === 'pulldown');
    expect(pulldowns.length).toBeGreaterThan(0);
    expect(pulldowns.every((e) => e.variant?.grip)).toBe(true);
  });
});
