import { describe, test, expect } from 'vitest';
import { computeCycleDoneIds } from './cycleProgress';

const e = (sessionTemplateId, timestamp) => ({ sessionTemplateId, timestamp });

describe('computeCycleDoneIds — tracks by template, not by position', () => {
  test('A then C, out of rotation order → done = [A, C], not [A, B]', () => {
    const history = [e('A', 1), e('C', 2)];
    const done = computeCycleDoneIds(history, ['A', 'B', 'C']);
    expect(done.sort()).toEqual(['A', 'C']);
  });

  test('finishing every template closes the cycle and starts a fresh one', () => {
    const history = [e('A', 1), e('B', 2), e('C', 3), e('A', 4)];
    const done = computeCycleDoneIds(history, ['A', 'B', 'C']);
    expect(done).toEqual(['A']);
  });

  test('unrelated templates from another program/stage are ignored', () => {
    const history = [e('A', 1), e('X', 2), e('C', 3)];
    const done = computeCycleDoneIds(history, ['A', 'B', 'C']);
    expect(done.sort()).toEqual(['A', 'C']);
  });

  test('no history → nothing done', () => {
    expect(computeCycleDoneIds([], ['A', 'B', 'C'])).toEqual([]);
  });
});
