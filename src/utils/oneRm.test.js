import { describe, test, expect } from 'vitest';
import { epley1RM, bestSetE1RM, recentE1RM } from './oneRm';

describe('epley1RM', () => {
  test('1 rep = the weight itself', () => {
    expect(epley1RM(100, 1)).toBe(100);
  });

  test('Epley formula: 100kg × 5 ≈ 116.7', () => {
    expect(epley1RM(100, 5)).toBeCloseTo(116.7, 1);
  });

  test('ignores sets above 12 reps (formula unreliable)', () => {
    expect(epley1RM(100, 15)).toBeNull();
  });

  test('null when weight or reps missing/invalid', () => {
    expect(epley1RM(0, 5)).toBeNull();
    expect(epley1RM(100, '')).toBeNull();
    expect(epley1RM(100, 0)).toBeNull();
  });

  describe('RIR adjustment from RPE', () => {
    test('RPE 8 on 5 reps → estimated as a 7-rep max (higher e1RM)', () => {
      // 100×5 @8 means 2 reps in reserve → 7 effective reps
      expect(epley1RM(100, 5, '8')).toBeCloseTo(123.3, 1);
    });

    test('RPE 10 = 0 RIR → same as raw reps', () => {
      expect(epley1RM(100, 5, '10')).toBeCloseTo(116.7, 1);
    });

    test('effective reps over 12 → null', () => {
      // 10 reps @7 = 13 effective reps
      expect(epley1RM(100, 10, '7')).toBeNull();
    });

    test('out-of-range RPE is ignored', () => {
      expect(epley1RM(100, 5, '3')).toBeCloseTo(116.7, 1);
    });
  });
});

describe('bestSetE1RM', () => {
  test('returns the highest e1RM across sets, skipping invalid ones', () => {
    const sets = [
      { weight: '80',  reps: '8', done: true },   // ~101.3
      { weight: '90',  reps: '3', done: true },   // ~99
      { weight: '100', reps: '',  done: true },   // no reps → skipped
    ];
    expect(bestSetE1RM(sets)).toBeCloseTo(101.3, 1);
  });

  test('null on empty / undefined', () => {
    expect(bestSetE1RM([])).toBeNull();
    expect(bestSetE1RM(undefined)).toBeNull();
  });
});

describe('recentE1RM', () => {
  const day = 24 * 60 * 60 * 1000;

  test('best e1RM within the 6-week window, ignoring older sessions', () => {
    const now = Date.now();
    const logs = [
      { timestamp: now - 100 * day, exercise: { sets: [{ weight: 120, reps: 3, done: true }] } }, // out of window
      { timestamp: now - 10  * day, exercise: { sets: [{ weight: 100, reps: 5, done: true }] } }, // 116.7
      { timestamp: now - 2   * day, exercise: { sets: [{ weight: 90,  reps: 8, done: true }] } }, // 114
    ];
    const r = recentE1RM(logs);
    expect(r.value).toBeCloseTo(116.7, 1);
  });

  test('null when no sessions in window', () => {
    expect(recentE1RM([])).toBeNull();
  });
});
