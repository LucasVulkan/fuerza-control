/**
 * Stage locks — a trainer can close a stage so the athlete cannot enter it until
 * they open it. See `mobile/docs/specs/stage-locks.md`.
 *
 * The padlock (`stage.locked`) lives inside the program, which is exclusive to
 * one client: every way of assigning a program clones it with fresh ids, so a
 * flag in there is already per-client state. Nothing extra travels — it rides
 * along in the program the trainer already uploads.
 *
 * This is a UX guardrail, not enforcement: a determined client can still import
 * a `.fitdata` over the top. It is not blindada, on purpose.
 */

/**
 * "This program came from my trainer" — the predicate behind every restriction
 * on the athlete's device. Never true for something the user built themselves,
 * and never on the trainer's own device (they have no slot).
 *
 * @param {object} program
 * @param {object} clientSync  the athlete's trainer-link state
 */
export function isTrainerProgram(program, clientSync) {
  if (!clientSync?.slotId) return false;
  return !!clientSync.trainerProgramIds?.includes(program?.id);
}

/**
 * @param {object} program
 * @param {number} idx         index into program.stages
 * @param {object} clientSync  the athlete's trainer-link state
 */
export function isStageLocked(program, idx, clientSync) {
  if (!isTrainerProgram(program, clientSync)) return false;
  // The current stage and everything behind it stay open: reaching a stage means
  // it was open at the time, so going back needs no unlock history.
  if (idx <= (program?.currentStageIndex ?? 0)) return false;
  return !!program?.stages?.[idx]?.locked;
}
