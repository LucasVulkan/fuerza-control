import { describe, it, expect } from 'vitest';
import { warmupSteps, computeWarmupWeights, resolveWorkWeight } from './warmup';

describe('warmupSteps', () => {
  it('auto ramp for 1 set', () => {
    expect(warmupSteps({ mode: 'auto', sets: 1 })).toEqual([{ pct: 60, reps: 5 }]);
  });

  it('auto ramp for 2 sets', () => {
    expect(warmupSteps({ mode: 'auto', sets: 2 })).toEqual([
      { pct: 45, reps: 8 },
      { pct: 70, reps: 4 },
    ]);
  });

  it('auto ramp for 3 sets', () => {
    expect(warmupSteps({ mode: 'auto', sets: 3 })).toEqual([
      { pct: 40, reps: 10 },
      { pct: 60, reps: 6 },
      { pct: 80, reps: 3 },
    ]);
  });

  it('auto ramp for 4 sets', () => {
    expect(warmupSteps({ mode: 'auto', sets: 4 })).toEqual([
      { pct: 40, reps: 10 },
      { pct: 55, reps: 8 },
      { pct: 70, reps: 5 },
      { pct: 85, reps: 2 },
    ]);
  });

  it('custom mode returns its own steps untransformed', () => {
    const steps = [{ pct: 33, reps: 7 }, { pct: 91, reps: 1 }];
    expect(warmupSteps({ mode: 'custom', steps })).toBe(steps);
  });

  it('null config → no steps', () => {
    expect(warmupSteps(null)).toEqual([]);
  });
});

describe('computeWarmupWeights', () => {
  it('rounds to the nearest 2.5 kg (spec example: 40% of 83 → 32.5)', () => {
    const out = computeWarmupWeights([{ pct: 40, reps: 10 }], 83);
    expect(out).toEqual([{ weightKg: 32.5, reps: 10 }]);
  });

  it('rounds down when closer to the lower multiple', () => {
    // 60% of 100 = 60 → already a multiple, stays 60
    expect(computeWarmupWeights([{ pct: 60, reps: 5 }], 100)).toEqual([{ weightKg: 60, reps: 5 }]);
  });

  it('rounds up when closer to the higher multiple', () => {
    // 85% of 120 = 102 → nearest 2.5 is 102.5
    expect(computeWarmupWeights([{ pct: 85, reps: 2 }], 120)).toEqual([{ weightKg: 102.5, reps: 2 }]);
  });

  it('null work weight → every weightKg is null, reps untouched', () => {
    const steps = [{ pct: 45, reps: 8 }, { pct: 70, reps: 4 }];
    expect(computeWarmupWeights(steps, null)).toEqual([
      { weightKg: null, reps: 8 },
      { weightKg: null, reps: 4 },
    ]);
  });
});

describe('resolveWorkWeight', () => {
  it('trainer override wins over everything', () => {
    const overrideEx = { weight: 90 };
    const lastExercise = { sets: [{ weight: '80', reps: '5', time: '', done: true }] };
    expect(resolveWorkWeight(overrideEx, lastExercise, 70)).toBe(90);
  });

  it('no override → falls back to the top set of the last session', () => {
    const lastExercise = {
      sets: [
        { weight: '70', reps: '8', time: '', done: true },
        { weight: '80', reps: '5', time: '', done: true },
        { weight: '75', reps: '5', time: '', done: true },
      ],
    };
    expect(resolveWorkWeight(null, lastExercise, 60)).toBe(80);
  });

  it('top set excludes warmup sets', () => {
    const lastExercise = {
      sets: [
        { weight: '200', reps: '5', time: '', done: true, isWarmup: true },
        { weight: '80', reps: '5', time: '', done: true },
      ],
    };
    expect(resolveWorkWeight(null, lastExercise, null)).toBe(80);
  });

  it('no override, no last exercise → falls back to the typed first work weight', () => {
    expect(resolveWorkWeight(null, null, 65)).toBe(65);
    expect(resolveWorkWeight(undefined, { sets: [] }, 65)).toBe(65);
  });

  it('nothing available → null', () => {
    expect(resolveWorkWeight(null, null, null)).toBeNull();
    expect(resolveWorkWeight(undefined, undefined, undefined)).toBeNull();
  });
});
