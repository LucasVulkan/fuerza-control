import { describe, it, expect } from 'vitest';
import { stageDiff, isEmptyDiff } from './programDiff';

const ex = (exerciseId, sets, minReps = null) => ({ exerciseId, sets, minReps });

describe('stageDiff', () => {
  it('empareja por derivedFrom aunque haya una etapa intermedia', () => {
    const base = { id: 'a1', exercises: [ex('squat', 3), ex('bench', 3)] };
    const mid  = { id: 'a2', derivedFrom: 'a1', exercises: [ex('squat', 4), ex('bench', 4)] };
    const last = { id: 'a3', derivedFrom: 'a2', exercises: [ex('squat', 5), ex('bench', 5)] };
    const all  = { a1: base, a2: mid, a3: last };

    expect(stageDiff([base], [last], all).setsDelta).toBe(4);
  });

  it('sin derivedFrom empareja por índice', () => {
    const from = [{ id: 'x', exercises: [ex('squat', 3)] }];
    const to   = [{ id: 'y', exercises: [ex('squat', 5)] }];
    const d = stageDiff(from, to, {});
    expect(d.setsDelta).toBe(2);
    expect(d.added).toBe(0);
    expect(d.removed).toBe(0);
  });

  it('entrar uno y salir otro en la misma sesión es UNA sustitución', () => {
    const from = [{ id: 'x', exercises: [ex('squat', 3), ex('bench', 3)] }];
    const to   = [{ id: 'y', exercises: [ex('squat', 3), ex('press', 3)] }];
    const d = stageDiff(from, to, {});
    expect(d).toMatchObject({ replaced: 1, added: 0, removed: 0, setsDelta: 0 });
  });

  it('cuenta bloques y el desplazamiento de reps más repetido', () => {
    const from = [{ id: 'x', exercises: [ex('squat', 3, 10), ex('bench', 3, 10), ex('row', 3, 12)] }];
    const to   = [{
      id: 'y',
      exercises: [ex('squat', 3, 6), ex('bench', 3, 6), ex('row', 3, 10)],
      blocks: [{ format: 'amrap' }],
    }];
    const d = stageDiff(from, to, {});
    expect(d.blocksDelta).toBe(1);
    expect(d.reps).toEqual({ delta: -4, count: 2 });
  });

  it('dos etapas idénticas no tienen nada que contar', () => {
    const tpl = { id: 'x', exercises: [ex('squat', 3, 8)] };
    expect(isEmptyDiff(stageDiff([tpl], [{ ...tpl, id: 'y' }], {}))).toBe(true);
  });
});
