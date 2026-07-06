import { describe, it, expect } from 'vitest';
import {
  programTemplateIds, linkGroupTemplateIds, lastLinkedExercise,
  exerciseLinkGroups, exerciseInstanceCount, pickLinkedConfig,
} from './exerciseLinks';

const TPLS = {
  tplA: { label: 'A', exercises: [{ exerciseId: 'squat', linkGroup: 'g1' }, { exerciseId: 'bench' }] },
  tplB: { label: 'B', exercises: [{ exerciseId: 'squat', linkGroup: 'g1' }] },
  tplC: { label: 'C', exercises: [{ exerciseId: 'squat', linkGroup: 'g2' }] },
  tplD: { label: 'D', exercises: [{ exerciseId: 'squat' }] }, // heavy day, unlinked
};
const getTpl = (id) => TPLS[id];

const flatProgram   = { days: [{ sessionTemplateId: 'tplA' }, { sessionTemplateId: 'tplB' }] };
const stagedProgram = {
  stages: [
    { days: [{ sessionTemplateId: 'tplA' }, { sessionTemplateId: 'tplB' }] },
    { days: [{ sessionTemplateId: 'tplC' }, { sessionTemplateId: 'tplD' }] },
  ],
};

describe('programTemplateIds', () => {
  it('reads flat and staged programs', () => {
    expect(programTemplateIds(flatProgram)).toEqual(['tplA', 'tplB']);
    expect(programTemplateIds(stagedProgram)).toEqual(['tplA', 'tplB', 'tplC', 'tplD']);
    expect(programTemplateIds(null)).toEqual([]);
  });
});

describe('linkGroupTemplateIds', () => {
  it('returns only members of the same group', () => {
    expect(linkGroupTemplateIds(stagedProgram, 'squat', 'g1', getTpl)).toEqual(['tplA', 'tplB']);
    expect(linkGroupTemplateIds(stagedProgram, 'squat', 'g2', getTpl)).toEqual(['tplC']);
  });
  it('no group → empty', () => {
    expect(linkGroupTemplateIds(stagedProgram, 'squat', null, getTpl)).toEqual([]);
  });
});

describe('lastLinkedExercise', () => {
  const log = [
    { sessionTemplateId: 'tplA', timestamp: 100, exercises: [{ exerciseId: 'squat', sets: [{ weight: '100' }] }] },
    { sessionTemplateId: 'tplD', timestamp: 200, exercises: [{ exerciseId: 'squat', sets: [{ weight: '140' }] }] },
    { sessionTemplateId: 'tplB', timestamp: 150, exercises: [{ exerciseId: 'squat', sets: [{ weight: '105' }] }] },
  ];

  it('returns the most recent performance within the group only', () => {
    const ex = lastLinkedExercise(log, ['tplA', 'tplB'], 'squat');
    expect(ex.sets[0].weight).toBe('105'); // tplD (140, newer) is outside the group
  });

  it('skips entries where the exercise is missing', () => {
    const log2 = [
      ...log,
      { sessionTemplateId: 'tplB', timestamp: 300, exercises: [{ exerciseId: 'bench', sets: [{ weight: '80' }] }] },
    ];
    expect(lastLinkedExercise(log2, ['tplA', 'tplB'], 'squat').sets[0].weight).toBe('105');
  });

  it('no entries → null', () => {
    expect(lastLinkedExercise(log, ['tplC'], 'squat')).toBeNull();
  });
});

describe('exerciseLinkGroups', () => {
  it('collects groups with session labels', () => {
    const groups = exerciseLinkGroups(stagedProgram, 'squat', getTpl);
    expect(groups).toHaveLength(2);
    expect(groups.find((g) => g.id === 'g1').sessions).toEqual(['A', 'B']);
    expect(groups.find((g) => g.id === 'g2').sessions).toEqual(['C']);
  });
});

describe('exerciseInstanceCount', () => {
  it('counts sessions containing the exercise', () => {
    expect(exerciseInstanceCount(stagedProgram, 'squat', getTpl)).toBe(4);
    expect(exerciseInstanceCount(stagedProgram, 'bench', getTpl)).toBe(1);
  });
});

describe('pickLinkedConfig', () => {
  it('copies only shared-config fields', () => {
    const cfg = pickLinkedConfig({
      exerciseId: 'squat', order: 2, linkGroup: 'g1',
      sets: 3, restSec: 90, minReps: 8, maxReps: 12, trackRpe: true,
      progression: { type: 'double' },
    });
    expect(cfg).toEqual({
      sets: 3, restSec: 90, minReps: 8, maxReps: 12, trackRpe: true,
      progression: { type: 'double' },
    });
    expect(cfg.exerciseId).toBeUndefined();
    expect(cfg.linkGroup).toBeUndefined();
  });
});
