/**
 * Cycle / stage progress — the single rule for "how far into the program is the
 * athlete", shared by the athlete's device and (from phase 2 of the stage-locks
 * spec) the trainer's mirror of it.
 *
 * ONE definition of a week: **a week is one full rotation through the DISTINCT
 * sessions of the cycle**. Repeating a session does not close the cycle and
 * therefore does not advance the stage — a cycle of A/B/C only closes once all
 * three have been logged, in any order.
 *
 * That used to be inconsistent: `cycleCompletedIds` counted distinct templates
 * (correct) while the end-of-stage threshold counted raw saves, so repeating A
 * twelve times finished a 4-week × 3-session stage without ever doing B or C.
 * The raw counter (`stageSessionsCompleted`) is gone; `stageWeeksCompleted`
 * replaces it and only ever moves when a rotation closes.
 *
 * Progress is a COUNTER, never a read of the workout log: deleting entries must
 * not roll the athlete back, and a reinstall restores the counters rather than
 * recomputing them. See `mobile/docs/specs/stage-locks.md` §3.
 *
 * A cycle can never contain the same template twice — every way of adding a day
 * to a program mints a fresh `tpl_*` id — so `size` comparisons are exact.
 */

/**
 * Applies one saved session to a program's cycle counters.
 *
 * @param {object}   program        the program that owns the session's template
 * @param {string}   templateId     template just completed
 * @param {string[]} cycleTplIds    every distinct templateId in the current cycle
 * @param {object}  [opts]
 * @param {number}  [opts.durationWeeks]  stage length; omit for non-staged programs
 * @param {boolean} [opts.isLastStage]    no advance is ever pending on the last stage
 * @returns {{cycleCompletedIds: string[], stageWeeksCompleted: number,
 *            totalWeeksCompleted: number, stageAdvancePending: boolean}}
 */
export function advanceCycle(program, templateId, cycleTplIds, { durationWeeks, isLastStage = false } = {}) {
  const cycleIds = new Set(program.cycleCompletedIds ?? []);
  cycleIds.add(templateId);
  const cycleClosed = cycleIds.size >= new Set(cycleTplIds).size;

  const stageWeeksCompleted = (program.stageWeeksCompleted ?? 0) + (cycleClosed ? 1 : 0);
  // Once pending, it stays pending until the athlete advances or dismisses it.
  const reachedEnd = durationWeeks != null && stageWeeksCompleted >= durationWeeks;

  return {
    cycleCompletedIds:   cycleClosed ? [] : [...cycleIds],
    stageWeeksCompleted,
    totalWeeksCompleted: (program.totalWeeksCompleted ?? 0) + (cycleClosed ? 1 : 0),
    stageAdvancePending: (reachedEnd && !isLastStage) || (program.stageAdvancePending ?? false),
  };
}
