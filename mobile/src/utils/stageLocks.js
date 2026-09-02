/**
 * Stage locks — a trainer can close a stage so the athlete cannot enter it until
 * they open it. See `mobile/docs/specs/stage-locks.md`.
 *
 * The padlock (`stage.locked`) lives inside the program, which is exclusive to
 * one client: every way of assigning a program clones it with fresh ids, so a
 * flag in there is already per-client state. Nothing extra travels — it rides
 * along in the program the trainer already uploads.
 *
 * This is a UX guardrail, not enforcement: a determined client can edit the
 * program on their own device. It is not blindada, on purpose.
 */

/**
 * @param {object} program
 * @param {number} idx         index into program.stages
 * @param {object} clientSync  the athlete's trainer-link state
 */
export function isStageLocked(program, idx, clientSync) {
  // Only ever locks an athlete linked to a trainer, and only that trainer's
  // programs — never anything the user built for themselves, and never on the
  // trainer's own device (they have no slot).
  if (!clientSync?.slotId) return false;
  if (!clientSync.trainerProgramIds?.includes(program?.id)) return false;
  // The current stage and everything behind it stay open: reaching a stage means
  // it was open at the time, so going back needs no unlock history.
  if (idx <= (program?.currentStageIndex ?? 0)) return false;
  return !!program?.stages?.[idx]?.locked;
}
