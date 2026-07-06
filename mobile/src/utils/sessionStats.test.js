import { describe, it, expect } from 'vitest';
import { sessionStats } from './sessionStats';

describe('sessionStats', () => {
  it('sums sets and estimates duration from work + rest per exercise', () => {
    const template = { exercises: [{ exerciseId: 'bench', sets: 3, restSec: 90 }] };
    const stats = sessionStats(template, {});
    expect(stats.exercises).toBe(1);
    expect(stats.sets).toBe(3);
    // 3 × (35 work + 90 rest) = 375s → rounds to 5 min buckets, min 5
    expect(stats.minutes).toBeGreaterThan(0);
  });

  it('superset: a chained (non-last) member contributes 0 rest to the estimate', () => {
    const solo = { exercises: [
      { exerciseId: 'a', sets: 3, restSec: 90 },
      { exerciseId: 'b', sets: 3, restSec: 90 },
    ] };
    const chained = { exercises: [
      { exerciseId: 'a', sets: 3, restSec: 90, supersetWithNext: true },
      { exerciseId: 'b', sets: 3, restSec: 90 },
    ] };
    // Chained pair only pays "a"'s work (no rest) + "b"'s work+rest — cheaper
    // than two independent exercises each resting on their own.
    expect(sessionStats(chained, {}).minutes).toBeLessThan(sessionStats(solo, {}).minutes);
  });

  it('conditioning blocks add their estimated duration but never touch sets/patternSets', () => {
    const template = {
      exercises: [{ exerciseId: 'bench', sets: 3, restSec: 90 }],
      blocks: [{ format: 'amrap', capSec: 600 }],
    };
    const withBlock = sessionStats(template, {});
    const withoutBlock = sessionStats({ exercises: template.exercises }, {});
    expect(withBlock.sets).toBe(withoutBlock.sets);
    expect(withBlock.patternSets).toEqual(withoutBlock.patternSets);
    expect(withBlock.minutes).toBeGreaterThan(withoutBlock.minutes);
  });

  it('a session with only blocks (no exercises) still estimates a duration', () => {
    const template = { exercises: [], blocks: [{ format: 'emom', intervalSec: 60, rounds: 10 }] };
    expect(sessionStats(template, {}).minutes).toBeGreaterThan(0);
  });
});
