import { describe, test, expect } from 'vitest';
import { assignActiveProgram, deassignProgram, archivedProgramIds } from './clientPrograms';

describe('assignActiveProgram — one active, the rest archived', () => {
  test('a fresh client (no programs) gets the program added and active', () => {
    const c = assignActiveProgram({ programIds: [] }, 'p1');
    expect(c.programIds).toEqual(['p1']);
    expect(c.activeProgramId).toBe('p1');
    expect(c.programDirty).toBe(true);
  });

  test('assigning a new program archives the previous active one', () => {
    let c = assignActiveProgram({ programIds: [] }, 'p1');
    c = assignActiveProgram(c, 'p2');
    expect(c.activeProgramId).toBe('p2');
    expect(c.programIds).toEqual(['p2', 'p1']); // newest first, p1 retained
    expect(archivedProgramIds(c)).toEqual(['p1']);
  });

  test('reactivating an already-listed program reorders nothing, just flips active', () => {
    const c0 = { programIds: ['p2', 'p1'], activeProgramId: 'p2' };
    const c1 = assignActiveProgram(c0, 'p1');
    expect(c1.activeProgramId).toBe('p1');
    expect(c1.programIds).toEqual(['p2', 'p1']); // no duplicate, order untouched
    expect(archivedProgramIds(c1)).toEqual(['p2']);
  });

  test('never drops history: every previously-active program stays in the list', () => {
    let c = { programIds: [] };
    c = assignActiveProgram(c, 'a');
    c = assignActiveProgram(c, 'b');
    c = assignActiveProgram(c, 'c');
    expect(c.activeProgramId).toBe('c');
    expect(new Set(c.programIds)).toEqual(new Set(['a', 'b', 'c']));
    expect(new Set(archivedProgramIds(c))).toEqual(new Set(['a', 'b']));
  });

  test('does not mutate the input client', () => {
    const input = { programIds: ['p1'], activeProgramId: 'p1' };
    const snapshot = JSON.stringify(input);
    assignActiveProgram(input, 'p2');
    expect(JSON.stringify(input)).toBe(snapshot);
  });
});

describe('deassignProgram', () => {
  test('clears the active program but keeps the list intact', () => {
    const c = deassignProgram({ programIds: ['p2', 'p1'], activeProgramId: 'p2', programDirty: true });
    expect(c.activeProgramId).toBeNull();
    expect(c.programDirty).toBe(false);
    expect(c.programIds).toEqual(['p2', 'p1']);
    // With no active program, all of them count as archived.
    expect(archivedProgramIds(c)).toEqual(['p2', 'p1']);
  });
});

describe('archivedProgramIds', () => {
  test('is empty when the only program is the active one', () => {
    expect(archivedProgramIds({ programIds: ['p1'], activeProgramId: 'p1' })).toEqual([]);
  });
  test('handles a client with no programs', () => {
    expect(archivedProgramIds({})).toEqual([]);
  });
});
