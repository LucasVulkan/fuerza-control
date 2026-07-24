/**
 * Cycle progress (trainer side) — figures out which distinct session templates
 * a client has actually completed in the CURRENT (not-yet-finished) rotation
 * through a program's cycle, by replaying their session history.
 *
 * Mirrors the set-based logic the athlete's own device keeps live in
 * `program.cycleCompletedIds` (see mobile/store/useStore.js `saveSession`):
 * completion is tracked by WHICH templates were done, not by a position/count,
 * so a session finished out of rotation order still marks the right slot.
 * Needed here specifically because a synced client's program object never
 * carries that live field — only their raw session history reaches the
 * trainer, so "next session" / "done this cycle" has to be derived from it.
 */

/**
 * @param {{sessionTemplateId: string, timestamp: number}[]} history
 * @param {string[]} cycleTemplateIds every distinct templateId in one cycle
 * @returns {string[]} templateIds completed so far in the current (open) cycle
 */
export function computeCycleDoneIds(history, cycleTemplateIds) {
  const cycleIdSet = new Set(cycleTemplateIds);
  const relevant = history
    .filter((e) => cycleIdSet.has(e.sessionTemplateId))
    .sort((a, b) => a.timestamp - b.timestamp);

  let done = new Set();
  for (const entry of relevant) {
    done.add(entry.sessionTemplateId);
    if (done.size >= cycleIdSet.size) done = new Set(); // rotation closed, start fresh
  }
  return [...done];
}
