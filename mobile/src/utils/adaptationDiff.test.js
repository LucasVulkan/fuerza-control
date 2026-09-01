import { describe, it, expect } from 'vitest';
import { diffAdaptations } from './adaptationDiff';

// Sesiones fabricadas a mano — sin motor, spec onboarding-simple.md §5.2.
const tpl = (label, exercises) => ({ label, exercises });
const result = (templates) => ({
  sessionTemplates: Object.fromEntries(templates.map((t, i) => [`t${i}`, t])),
});

describe('diffAdaptations', () => {
  it('sin diferencias devuelve []', () => {
    const free     = result([tpl('A', [{ exerciseId: 'squat', sets: 4 }])]);
    const budgeted = result([tpl('A', [{ exerciseId: 'squat', sets: 4 }])]);
    expect(diffAdaptations(free, budgeted)).toEqual([]);
  });

  it('un ejercicio que falta aparece en removedIds con su setsDelta', () => {
    const free = result([tpl('A', [
      { exerciseId: 'squat', sets: 4 },
      { exerciseId: 'lateral_raise', sets: 3 },
    ])]);
    const budgeted = result([tpl('A', [{ exerciseId: 'squat', sets: 4 }])]);

    expect(diffAdaptations(free, budgeted)).toEqual([
      { label: 'A', removedIds: ['lateral_raise'], setsDelta: 3 },
    ]);
  });

  it('una sesión que sólo pierde series aparece con removedIds: [] y setsDelta > 0', () => {
    const free     = result([tpl('B', [{ exerciseId: 'row', sets: 4 }])]);
    const budgeted = result([tpl('B', [{ exerciseId: 'row', sets: 3 }])]);

    expect(diffAdaptations(free, budgeted)).toEqual([
      { label: 'B', removedIds: [], setsDelta: 1 },
    ]);
  });

  it('sólo devuelve las sesiones con recorte, no las que quedan igual', () => {
    const free = result([
      tpl('A', [{ exerciseId: 'squat', sets: 4 }]),
      tpl('B', [{ exerciseId: 'row', sets: 4 }, { exerciseId: 'curl', sets: 3 }]),
    ]);
    const budgeted = result([
      tpl('A', [{ exerciseId: 'squat', sets: 4 }]),
      tpl('B', [{ exerciseId: 'row', sets: 4 }]),
    ]);

    expect(diffAdaptations(free, budgeted)).toEqual([
      { label: 'B', removedIds: ['curl'], setsDelta: 3 },
    ]);
  });
});
