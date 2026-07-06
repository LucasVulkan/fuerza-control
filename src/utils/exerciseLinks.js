/**
 * exerciseLinks — exercises linked across sessions of a program.
 *
 * Instances with the same exerciseId AND the same exConfig.linkGroup share
 * their configuration (editing one edits all) and their training history
 * (progression / last-time references read the group's latest log entry,
 * whichever session it came from). linkGroup absent/null = independent.
 */

/** Config fields that travel with a link group (identity/order excluded). */
export const LINKED_CONFIG_KEYS = [
  'sets', 'restSec', 'inputType',
  'minReps', 'maxReps', 'minTime', 'maxTime',
  'isUnilateral', 'tempo', 'trainerNote', 'trackRpe',
  'progressionModel', 'progression',
];

export function pickLinkedConfig(exConfig) {
  const out = {};
  for (const k of LINKED_CONFIG_KEYS) {
    if (k in (exConfig ?? {})) out[k] = exConfig[k];
  }
  return out;
}

/** All template ids of a program (stages included). */
export function programTemplateIds(program) {
  if (!program) return [];
  const days = program.stages?.length
    ? program.stages.flatMap((st) => st.days ?? [])
    : (program.days ?? []);
  return days.map((d) => d.sessionTemplateId);
}

/** Template ids whose effective template holds `exerciseId` in `linkGroup`. */
export function linkGroupTemplateIds(program, exerciseId, linkGroup, getTemplate) {
  if (!linkGroup) return [];
  return programTemplateIds(program).filter((tid) => {
    const tpl = getTemplate(tid);
    return tpl?.exercises?.some(
      (e) => e.exerciseId === exerciseId && e.linkGroup === linkGroup
    );
  });
}

/**
 * Latest logged performance of `exerciseId` among the given templates.
 * Returns the log's exercise object ({ exerciseId, sets, ... }) or null.
 */
export function lastLinkedExercise(workoutLog, templateIds, exerciseId) {
  const ids = new Set(templateIds);
  const entries = (workoutLog ?? [])
    .filter((e) => ids.has(e.sessionTemplateId))
    .sort((a, b) => b.timestamp - a.timestamp);
  for (const e of entries) {
    const ex = (e.exercises ?? []).find((x) => x.exerciseId === exerciseId);
    if (ex?.sets?.length) return ex;
  }
  return null;
}

/**
 * Existing link groups of an exercise in a program:
 * [{ id, templateIds, sessions: [session labels] }]
 */
export function exerciseLinkGroups(program, exerciseId, getTemplate) {
  const groups = new Map();
  for (const tid of programTemplateIds(program)) {
    const tpl = getTemplate(tid);
    const ex = tpl?.exercises?.find((e) => e.exerciseId === exerciseId);
    if (!ex?.linkGroup) continue;
    const g = groups.get(ex.linkGroup) ?? { id: ex.linkGroup, templateIds: [], sessions: [] };
    g.templateIds.push(tid);
    g.sessions.push(tpl.label ?? tpl.name ?? '?');
    groups.set(ex.linkGroup, g);
  }
  return [...groups.values()];
}

/** How many sessions of the program contain this exercise. */
export function exerciseInstanceCount(program, exerciseId, getTemplate) {
  return programTemplateIds(program).filter((tid) =>
    getTemplate(tid)?.exercises?.some((e) => e.exerciseId === exerciseId)
  ).length;
}
