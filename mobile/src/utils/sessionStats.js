import { blockEstimatedSec } from '../../../src/utils/conditioningBlocks';

/**
 * sessionStats — aggregate volume metrics for a session template.
 *
 * Duration is an estimate: sets × (work + rest), where work is ~35 s for
 * rep-based sets and the mid-point of the time range for timed sets.
 * Rounded to the nearest 5 minutes. Conditioning blocks add their own
 * estimate but never touch sets/patternSets — they're a separate layer.
 */
export function sessionStats(template, allExercises) {
  const exercises = template?.exercises ?? [];
  let sets = 0;
  let seconds = 0;
  const patternSets = {};

  for (const ex of exercises) {
    const n = ex.sets ?? 0;
    sets += n;
    const isTimed = ex.inputType === 'time' || ex.inputType === 'weight_time';
    const work = isTimed ? ((ex.minTime ?? 20) + (ex.maxTime ?? 40)) / 2 : 35;
    // Superset: chained (non-last) members share the rest of the group's last
    // member — count 0 here so it isn't double-counted.
    const rest = ex.supersetWithNext ? 0 : (ex.restSec ?? 90);
    seconds += n * (work + rest);

    const pattern = allExercises?.[ex.exerciseId]?.pattern;
    if (pattern) patternSets[pattern] = (patternSets[pattern] ?? 0) + n;
  }

  for (const block of template?.blocks ?? []) {
    seconds += blockEstimatedSec(block);
  }

  const minutes = (sets > 0 || seconds > 0) ? Math.max(5, Math.round(seconds / 60 / 5) * 5) : 0;
  return { exercises: exercises.length, sets, minutes, patternSets };
}
