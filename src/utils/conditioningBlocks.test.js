import { describe, it, expect } from 'vitest';
import {
  amrapRemaining, amrapFinished, emomPosition, emomTotalIntervals, forTimeElapsed, currentMovement,
  buildBlockResult, formatBlockScore, compareBlockResults, blockEstimatedSec,
} from './conditioningBlocks';

const T0 = 1_000_000_000; // arbitrary epoch ms, startedAt

describe('amrapRemaining / amrapFinished', () => {
  const block = { format: 'amrap', capSec: 600 };

  it('counts down and clamps at 0', () => {
    expect(amrapRemaining(block, T0, T0)).toBe(600);
    expect(amrapRemaining(block, T0, T0 + 300_000)).toBe(300);
    expect(amrapRemaining(block, T0, T0 + 600_000)).toBe(0);
    expect(amrapRemaining(block, T0, T0 + 999_000)).toBe(0); // past the cap
  });

  it('finished flips once remaining hits 0', () => {
    expect(amrapFinished(block, T0, T0 + 599_000)).toBe(false);
    expect(amrapFinished(block, T0, T0 + 600_000)).toBe(true);
  });
});

describe('emomPosition', () => {
  const block = { format: 'emom', intervalSec: 60, rounds: 10 };

  it('t=0 → interval 0, full remaining', () => {
    expect(emomPosition(block, T0, T0)).toEqual({ interval: 0, intervalRemaining: 60, finished: false });
  });

  it('t=59.9s → still interval 0, 1s left', () => {
    const pos = emomPosition(block, T0, T0 + 59_900);
    expect(pos.interval).toBe(0);
    expect(pos.intervalRemaining).toBe(1);
    expect(pos.finished).toBe(false);
  });

  it('t=60s → rolls into interval 1', () => {
    const pos = emomPosition(block, T0, T0 + 60_000);
    expect(pos.interval).toBe(1);
    expect(pos.intervalRemaining).toBe(60);
  });

  it('last interval (idx 9 of 10)', () => {
    const pos = emomPosition(block, T0, T0 + 540_000); // 9×60s
    expect(pos.interval).toBe(9);
    expect(pos.finished).toBe(false);
  });

  it('finished once rounds×interval has fully elapsed', () => {
    const pos = emomPosition(block, T0, T0 + 600_000); // 10×60s
    expect(pos.finished).toBe(true);
    expect(pos.interval).toBe(9); // clamped to rounds-1
    expect(pos.intervalRemaining).toBe(0);
  });

  it('kill-recovery: now far past the whole block → still finished, clamped', () => {
    const pos = emomPosition(block, T0, T0 + 10_000_000);
    expect(pos.finished).toBe(true);
    expect(pos.interval).toBe(9);
  });

  it('a "round" is a full cycle: rotate mode spans movements.length intervals', () => {
    // 5 rounds × 3 movements = 15 intervals; every movement done 5 times.
    const rot = { format: 'emom', intervalSec: 60, rounds: 5, emomMode: 'rotate', movements: [{}, {}, {}] };
    expect(emomTotalIntervals(rot)).toBe(15);
    // interval 14 is the last, still live at 14×60s
    expect(emomPosition(rot, T0, T0 + 14 * 60_000).interval).toBe(14);
    expect(emomPosition(rot, T0, T0 + 14 * 60_000).finished).toBe(false);
    // finished only after all 15 intervals
    expect(emomPosition(rot, T0, T0 + 15 * 60_000).finished).toBe(true);
  });

  it("'all' mode: a round is a single interval (every movement each minute)", () => {
    const all = { format: 'emom', intervalSec: 60, rounds: 5, emomMode: 'all', movements: [{}, {}, {}] };
    expect(emomTotalIntervals(all)).toBe(5);
    expect(emomPosition(all, T0, T0 + 5 * 60_000).finished).toBe(true);
  });

  it('single-movement EMOM: rounds == intervals either way', () => {
    const one = { format: 'emom', intervalSec: 60, rounds: 8, emomMode: 'rotate', movements: [{}] };
    expect(emomTotalIntervals(one)).toBe(8);
  });
});

describe('forTimeElapsed', () => {
  it('no cap: elapsed grows, never capped', () => {
    const block = { format: 'for_time', capSec: null };
    expect(forTimeElapsed(block, T0, T0 + 522_000)).toEqual({ elapsedSec: 522, capped: false });
  });

  it('with cap: clamps and flags capped once reached', () => {
    const block = { format: 'for_time', capSec: 480 };
    expect(forTimeElapsed(block, T0, T0 + 300_000)).toEqual({ elapsedSec: 300, capped: false });
    expect(forTimeElapsed(block, T0, T0 + 480_000)).toEqual({ elapsedSec: 480, capped: true });
    expect(forTimeElapsed(block, T0, T0 + 900_000)).toEqual({ elapsedSec: 480, capped: true });
  });
});

describe('currentMovement', () => {
  const block = { movements: [{ exerciseId: 'burpee' }, { exerciseId: 'row' }, { exerciseId: 'squat' }] };

  it('rotates through movements and wraps', () => {
    expect(currentMovement(block, 0).exerciseId).toBe('burpee');
    expect(currentMovement(block, 1).exerciseId).toBe('row');
    expect(currentMovement(block, 2).exerciseId).toBe('squat');
    expect(currentMovement(block, 3).exerciseId).toBe('burpee'); // wraps
  });

  it('no movements → null', () => {
    expect(currentMovement({ movements: [] }, 0)).toBeNull();
  });
});

describe('buildBlockResult', () => {
  it('amrap: rounds + extraReps straight from state', () => {
    const block = { format: 'amrap', capSec: 600 };
    const state = { startedAt: T0, rounds: 7, extraReps: 12, failed: [], timeSec: null };
    expect(buildBlockResult(block, state, T0 + 600_000)).toEqual({ rounds: 7, extraReps: 12 });
  });

  it('emom: completed counts elapsed intervals minus failed, mid-block', () => {
    const block = { format: 'emom', intervalSec: 60, rounds: 10 };
    // 3 full intervals elapsed (idx 0,1,2 done; idx 3 in progress) → transpired = 3
    const state = { startedAt: T0, rounds: 0, extraReps: 0, failed: [1], timeSec: null };
    const result = buildBlockResult(block, state, T0 + 190_000);
    expect(result).toEqual({ completed: 2, total: 10, failed: [1] });
  });

  it('emom: finished → all rounds transpired minus failed', () => {
    const block = { format: 'emom', intervalSec: 60, rounds: 10 };
    const state = { startedAt: T0, failed: [3, 7], timeSec: null };
    expect(buildBlockResult(block, state, T0 + 600_000)).toEqual({ completed: 8, total: 10, failed: [3, 7] });
  });

  it('emom rotate: score total is the full interval count, not the round count', () => {
    // 5 rounds × 3 movements = 15 intervals; finished, one failed → 14/15.
    const block = { format: 'emom', intervalSec: 60, rounds: 5, emomMode: 'rotate', movements: [{}, {}, {}] };
    const state = { startedAt: T0, failed: [2], timeSec: null };
    expect(buildBlockResult(block, state, T0 + 15 * 60_000)).toEqual({ completed: 14, total: 15, failed: [2] });
  });

  it('for_time: finished (timeSec set) → capped derived from the frozen score', () => {
    const block = { format: 'for_time', capSec: 480 };
    const finishedUnderCap = { startedAt: T0, timeSec: 300 };
    expect(buildBlockResult(block, finishedUnderCap, T0 + 999_000)).toEqual({ timeSec: 300, capped: false });
    const finishedAtCap = { startedAt: T0, timeSec: 480 };
    expect(buildBlockResult(block, finishedAtCap, T0 + 999_000)).toEqual({ timeSec: 480, capped: true });
  });

  it('for_time: mid-session (never finished) → live elapsed, never capped', () => {
    const block = { format: 'for_time', capSec: 480 };
    const state = { startedAt: T0, timeSec: null };
    expect(buildBlockResult(block, state, T0 + 900_000)).toEqual({ timeSec: 480, capped: false });
  });
});

describe('formatBlockScore', () => {
  it('amrap with and without partial reps', () => {
    expect(formatBlockScore({ rounds: 7, extraReps: 12 }, 'amrap')).toBe('7 + 12');
    expect(formatBlockScore({ rounds: 7, extraReps: 0 }, 'amrap')).toBe('7');
  });
  it('emom', () => {
    expect(formatBlockScore({ completed: 9, total: 10 }, 'emom')).toBe('9/10');
  });
  it('for_time', () => {
    expect(formatBlockScore({ timeSec: 522 }, 'for_time')).toBe('8:42');
  });
});

describe('compareBlockResults', () => {
  it('no previous entry → kind null (recap shows no chip)', () => {
    expect(compareBlockResults('amrap', { rounds: 7, extraReps: 0 }, null)).toEqual({ better: null, kind: null, diff: 0 });
  });

  it('amrap: more rounds wins; same rounds compares extraReps; tie is equal', () => {
    expect(compareBlockResults('amrap', { rounds: 8, extraReps: 0 }, { rounds: 7, extraReps: 5 }))
      .toEqual({ better: true, kind: 'rounds', diff: 1 });
    expect(compareBlockResults('amrap', { rounds: 7, extraReps: 20 }, { rounds: 7, extraReps: 12 }))
      .toEqual({ better: true, kind: 'reps', diff: 8 });
    expect(compareBlockResults('amrap', { rounds: 6, extraReps: 0 }, { rounds: 7, extraReps: 0 }))
      .toEqual({ better: false, kind: 'rounds', diff: -1 });
    expect(compareBlockResults('amrap', { rounds: 7, extraReps: 12 }, { rounds: 7, extraReps: 12 }))
      .toEqual({ better: null, kind: 'equal', diff: 0 });
  });

  it('emom: more completed wins', () => {
    expect(compareBlockResults('emom', { completed: 9, total: 10 }, { completed: 7, total: 10 }))
      .toEqual({ better: true, kind: 'completed', diff: 2 });
    expect(compareBlockResults('emom', { completed: 6, total: 10 }, { completed: 7, total: 10 }))
      .toEqual({ better: false, kind: 'completed', diff: -1 });
  });

  it('for_time: LESS time is better — the inversion', () => {
    expect(compareBlockResults('for_time', { timeSec: 500 }, { timeSec: 522 }))
      .toEqual({ better: true, kind: 'time', diff: -22 });
    expect(compareBlockResults('for_time', { timeSec: 540 }, { timeSec: 522 }))
      .toEqual({ better: false, kind: 'time', diff: 18 });
  });
});

describe('blockEstimatedSec', () => {
  it('amrap uses capSec', () => {
    expect(blockEstimatedSec({ format: 'amrap', capSec: 600 })).toBe(600);
  });
  it('emom uses intervalSec × rounds', () => {
    expect(blockEstimatedSec({ format: 'emom', intervalSec: 60, rounds: 10 })).toBe(600);
  });
  it('emom rotate: intervalSec × (rounds × movements)', () => {
    expect(blockEstimatedSec({ format: 'emom', intervalSec: 60, rounds: 5, emomMode: 'rotate', movements: [{}, {}, {}] })).toBe(900);
  });
  it('for_time falls back to 600 with no cap', () => {
    expect(blockEstimatedSec({ format: 'for_time', capSec: null })).toBe(600);
    expect(blockEstimatedSec({ format: 'for_time', capSec: 480 })).toBe(480);
  });
});
