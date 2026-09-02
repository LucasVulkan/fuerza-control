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
