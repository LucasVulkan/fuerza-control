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
 * The client's progress, as it travels to the trainer alongside their history
 * and comes back on a reinstall. `programId` lets the receiver reject a blob
 * that belongs to a program the client is no longer on.
 *
 * `stageAdvancePending` is deliberately absent: it is a dismissable UI state,
 * and the trainer can tell a finished stage from `stageWeeksCompleted` against
 * the stage's own `durationWeeks`.
 *
 * @returns {object|null} null when the program has no id (nothing to sync)
 */
export function progressBlob(program) {
  if (!program?.id) return null;
  return {
    programId:           program.id,
    currentStageIndex:   program.currentStageIndex   ?? 0,
    cycleCompletedIds:   program.cycleCompletedIds   ?? [],
    stageWeeksCompleted: program.stageWeeksCompleted ?? 0,
    totalWeeksCompleted: program.totalWeeksCompleted ?? 0,
    updatedAt:           new Date().toISOString(),
  };
}

/**
 * The counters from a blob, ready to spread onto a program — but only if the
 * blob describes that same program. Anything else returns null so the caller
 * keeps what it has instead of adopting a stale stage index.
 */
export function progressFromBlob(blob, programId) {
  if (!blob || blob.programId !== programId) return null;
  return {
    currentStageIndex:   blob.currentStageIndex   ?? 0,
    cycleCompletedIds:   blob.cycleCompletedIds   ?? [],
    stageWeeksCompleted: blob.stageWeeksCompleted ?? 0,
    totalWeeksCompleted: blob.totalWeeksCompleted ?? 0,
  };
}

/**
 * Which counters the client keeps when an updated program lands from their
 * trainer. Progress belongs to the client, so whatever the incoming copy
 * carries is discarded — with ONE exception: if the trainer activated a
 * different stage since the last import, they meant it, and the client jumps
 * there with that stage starting from zero.
 *
 * That exception is why editing a program no longer sends anyone back to
 * stage 1: an edit leaves `currentStageIndex` untouched, so nothing moves.
 *
 * @param {object}      blob               the client's own progress
 * @param {object}      program            the freshly imported program
 * @param {number}      lastImportedStage   `currentStageIndex` of the previous import
 */
export function mergeProgressOnImport({ blob, program, lastImportedStage = 0 }) {
  const kept          = progressFromBlob(blob, program?.id);
  const incomingStage = program?.currentStageIndex ?? 0;
  // No blob for THIS program means a different program arrived, not an update.
  const jump          = !kept || incomingStage !== lastImportedStage;

  const stages     = program?.stages ?? [];
  const stageCount = Math.max(1, stages.length);
  const stage      = Math.max(0, Math.min(jump ? incomingStage : kept.currentStageIndex, stageCount - 1));
  const weeks      = jump ? 0 : kept.stageWeeksCompleted;
  const duration   = stages[stage]?.durationWeeks;

  return {
    currentStageIndex:   stage,
    cycleCompletedIds:   jump ? [] : kept.cycleCompletedIds,
    stageWeeksCompleted: weeks,
    totalWeeksCompleted: kept?.totalWeeksCompleted ?? 0,   // lifetime, never reset
    // Recomputed rather than carried: the incoming copy's flag is the trainer's,
    // and the client's was just overwritten by the import.
    stageAdvancePending: duration != null && weeks >= duration && stage < stages.length - 1,
  };
}

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
