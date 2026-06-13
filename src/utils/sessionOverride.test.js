import { describe, test, expect } from 'vitest';
import {
  isEmptyOverride,
  resolveExerciseReference,
  resolveRef,
  overrideStatus,
  consumeOverride,
} from './sessionOverride';

const DAY = 86400000;
const T0  = Date.parse('2026-02-01T10:00:00Z');

describe('isEmptyOverride', () => {
  test('no exercises → empty', () => {
    expect(isEmptyOverride({ exercises: {} })).toBe(true);
    expect(isEmptyOverride(null)).toBe(true);
  });
  test('a weight target makes it non-empty', () => {
    expect(isEmptyOverride({ exercises: { dom: { weight: 22.5 } } })).toBe(false);
  });
  test('a note alone makes it non-empty', () => {
    expect(isEmptyOverride({ exercises: { dom: { note: 'suave hoy' } } })).toBe(false);
  });
  test('a time or rpe target makes it non-empty', () => {
    expect(isEmptyOverride({ exercises: { plank: { time: 45 } } })).toBe(false);
    expect(isEmptyOverride({ exercises: { sq: { rpe: 8 } } })).toBe(false);
  });
  test('blank note only → still empty', () => {
    expect(isEmptyOverride({ exercises: { dom: { note: '   ' } } })).toBe(true);
  });
});

describe('resolveExerciseReference', () => {
  test('coach target wins over last-session reference', () => {
    const r = resolveExerciseReference({ weight: 82.5, reps: 8 }, 80, 10);
    expect(r.weight).toEqual({ value: '82.5', source: 'coach' });
    expect(r.reps).toEqual({ value: '8', source: 'coach' });
  });
  test('falls back to last session when no target for that field', () => {
    const r = resolveExerciseReference({ weight: 82.5 }, 80, 10); // reps not prescribed
    expect(r.weight.source).toBe('coach');
    expect(r.reps).toEqual({ value: '10', source: 'last' });
  });
  test('no target and no history → nothing to suggest', () => {
    const r = resolveExerciseReference(undefined, '', '');
    expect(r.weight).toEqual({ value: '', source: 'none' });
    expect(r.reps).toEqual({ value: '', source: 'none' });
  });
});

describe('resolveRef', () => {
  test('coach target wins, else last, else none', () => {
    expect(resolveRef(45, 30)).toEqual({ value: '45', source: 'coach' });
    expect(resolveRef(undefined, 30)).toEqual({ value: '30', source: 'last' });
    expect(resolveRef('', '')).toEqual({ value: '', source: 'none' });
  });
});

describe('overrideStatus', () => {
  const ov = { templateId: 'push', createdAt: new Date(T0).toISOString(), exercises: {} };

  test('no matching session yet → pending', () => {
    const sessions = [{ sessionTemplateId: 'pull', timestamp: T0 + DAY }];
    expect(overrideStatus(ov, sessions)).toBe('pending');
  });
  test('session of this template after creation → consumed', () => {
    const sessions = [{ sessionTemplateId: 'push', timestamp: T0 + DAY }];
    expect(overrideStatus(ov, sessions)).toBe('consumed');
  });
  test('an earlier session of this template does not consume it', () => {
    const sessions = [{ sessionTemplateId: 'push', timestamp: T0 - DAY }];
    expect(overrideStatus(ov, sessions)).toBe('pending');
  });
  test('null override → none', () => {
    expect(overrideStatus(null, [])).toBe('none');
  });
});

describe('consumeOverride', () => {
  test('removes the template entry and does not mutate the input', () => {
    const overrides = { push: { templateId: 'push' }, pull: { templateId: 'pull' } };
    const next = consumeOverride(overrides, 'push');
    expect(next).toEqual({ pull: { templateId: 'pull' } });
    expect(overrides.push).toBeDefined(); // original untouched
  });
  test('missing template is a no-op', () => {
    const overrides = { pull: { templateId: 'pull' } };
    expect(consumeOverride(overrides, 'push')).toEqual(overrides);
  });
  test('undefined map → empty object', () => {
    expect(consumeOverride(undefined, 'push')).toEqual({});
  });
});
