import { describe, it, expect } from 'vitest';
import { advanceCycle, progressBlob, progressFromBlob } from './stageProgress';

const CYCLE = ['tpl_a', 'tpl_b', 'tpl_c'];
const STAGE = { durationWeeks: 2, isLastStage: false };

/** Replays a list of completed templates through advanceCycle. */
function replay(templateIds, opts = STAGE, program = {}) {
  let p = program;
  for (const id of templateIds) p = { ...p, ...advanceCycle(p, id, CYCLE, opts) };
  return p;
}

describe('advanceCycle', () => {
  it('tracks the open rotation by distinct template', () => {
    const p = replay(['tpl_a', 'tpl_b']);
    expect(p.cycleCompletedIds.sort()).toEqual(['tpl_a', 'tpl_b']);
    expect(p.stageWeeksCompleted).toBe(0);
  });

  it('closes the cycle only when every distinct session is done', () => {
    const p = replay(['tpl_a', 'tpl_b', 'tpl_c']);
    expect(p.cycleCompletedIds).toEqual([]);   // rotation reset
    expect(p.stageWeeksCompleted).toBe(1);
    expect(p.totalWeeksCompleted).toBe(1);
  });

  it('closes it regardless of order', () => {
    expect(replay(['tpl_c', 'tpl_a', 'tpl_b']).stageWeeksCompleted).toBe(1);
  });

  it('does NOT advance on repeats — the bug this replaces', () => {
    const p = replay(Array(12).fill('tpl_a'));
    expect(p.stageWeeksCompleted).toBe(0);
    expect(p.stageAdvancePending).toBe(false);
    expect(p.cycleCompletedIds).toEqual(['tpl_a']);
  });

  it('flags the stage as finished after durationWeeks full rotations', () => {
    const oneWeek = replay(CYCLE);
    expect(oneWeek.stageAdvancePending).toBe(false);   // 1 of 2 weeks
    const twoWeeks = replay(CYCLE, STAGE, oneWeek);
    expect(twoWeeks.stageWeeksCompleted).toBe(2);
    expect(twoWeeks.stageAdvancePending).toBe(true);
  });

  it('never flags an advance on the last stage', () => {
    const opts = { durationWeeks: 1, isLastStage: true };
    expect(replay(CYCLE, opts).stageAdvancePending).toBe(false);
  });

  it('keeps the flag raised across later sessions until it is consumed', () => {
    const done = replay([...CYCLE, ...CYCLE], STAGE);
    expect(done.stageAdvancePending).toBe(true);
    expect(replay(['tpl_a'], STAGE, done).stageAdvancePending).toBe(true);
  });

  it('counts rotations without a stage threshold (non-staged programs)', () => {
    const p = replay(CYCLE, {});
    expect(p.totalWeeksCompleted).toBe(1);
    expect(p.stageAdvancePending).toBe(false);
  });
});

describe('progressBlob / progressFromBlob', () => {
  const program = {
    id: 'prog_1', currentStageIndex: 2, cycleCompletedIds: ['tpl_a'],
    stageWeeksCompleted: 3, totalWeeksCompleted: 11,
  };

  it('survives a round trip', () => {
    expect(progressFromBlob(progressBlob(program), 'prog_1')).toEqual({
      currentStageIndex: 2, cycleCompletedIds: ['tpl_a'],
      stageWeeksCompleted: 3, totalWeeksCompleted: 11,
    });
  });

  it('rejects a blob from another program instead of adopting its stage', () => {
    expect(progressFromBlob(progressBlob(program), 'prog_2')).toBeNull();
    expect(progressFromBlob(null, 'prog_1')).toBeNull();
  });

  it('fills defaults for a program that has never been trained', () => {
    expect(progressFromBlob(progressBlob({ id: 'prog_1' }), 'prog_1')).toEqual({
      currentStageIndex: 0, cycleCompletedIds: [],
      stageWeeksCompleted: 0, totalWeeksCompleted: 0,
    });
  });

  it('has nothing to send for a program without an id', () => {
    expect(progressBlob(undefined)).toBeNull();
    expect(progressBlob({})).toBeNull();
  });
});
