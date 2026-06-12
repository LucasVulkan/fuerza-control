import { describe, test, expect } from 'vitest';
import { getProgression } from './progression';

// getProgression builds an i18n message via t(); we only assert chip.type,
// which is independent of the translated text, so a no-op stub is enough.
const t = () => '';

const def = { progressionModel: 'double_progression', minReps: 4, maxReps: 6, weightStep: 2.5 };

function rpeConfig(maxRpe) {
  return {
    exerciseId: 'test', sets: 3, minReps: 4, maxReps: 6, inputType: 'weight_reps',
    progression: {
      type: 'double', direction: 'increase',
      evaluation: { mode: 'rpe', maxRpe },
      increment: { type: 'fixed', value: 2.5 },
    },
  };
}

const sets = (rpe, reps = '6') => [
  { weight: '100', reps, rpe, done: true },
  { weight: '100', reps, rpe, done: true },
  { weight: '100', reps, rpe, done: true },
];

describe('getProgression — RPE evaluation', () => {
  test('all sets at top reps, avg RPE below target → advance (up)', () => {
    expect(getProgression(rpeConfig(8), def, sets('7.5'), t)?.type).toBe('up');
  });

  test('grinding at RPE 10 → back off (down)', () => {
    expect(getProgression(rpeConfig(8), def, sets('10'), t)?.type).toBe('down');
  });

  test('completed but above RPE target → hold', () => {
    expect(getProgression(rpeConfig(8), def, sets('8.5'), t)?.type).toBe('hold');
  });

  test('top reps but RPE missing → previous behaviour (advance)', () => {
    expect(getProgression(rpeConfig(8), def, sets(''), t)?.type).toBe('up');
  });

  test('low RPE but reps below max → hold (not at top of range yet)', () => {
    expect(getProgression(rpeConfig(8), def, sets('7', '4'), t)?.type).toBe('hold');
  });
});

describe('getProgression — RPE does not leak into other modes', () => {
  test('all_complete ignores RPE data entirely', () => {
    const cfg = rpeConfig(8);
    cfg.progression.evaluation.mode = 'all_complete';
    // RPE 10 would force a retreat under rpe mode, but all_complete looks only at reps
    expect(getProgression(cfg, def, sets('10'), t)?.type).toBe('up');
  });
});

describe('getProgression — guards', () => {
  test('returns null with no sets', () => {
    expect(getProgression(rpeConfig(8), def, [], t)).toBeNull();
  });
});
