import { blockEstimatedSec } from '../../../src/utils/conditioningBlocks';

// Transición/montaje por ejercicio o bloque: buscar máquina, montar peso, ajustar.
const EXERCISE_OVERHEAD_SEC = 180;
// Calentamiento general, una vez por sesión (si la sesión no está vacía).
// Revisar cuando exista la feature warmup-sets (mobile/docs/specs/warmup-sets.md)
// para no contar el calentamiento dos veces.
const SESSION_OVERHEAD_SEC = 480;

/**
 * sessionStats — aggregate volume metrics for a session template.
 *
 * Duration is an estimate: por ejercicio, sets × (work + rest) + overhead de
 * transición; por bloque de acondicionamiento, blockEstimatedSec + overhead de
 * transición; más un calentamiento general único por sesión. work es ~35 s
 * para sets basados en reps y el punto medio del rango de tiempo para sets
 * de tiempo. Rounded to the nearest 5 minutes. Conditioning blocks add their
 * own estimate but never touch sets/patternSets — they're a separate layer.
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
    seconds += n * (work + rest) + EXERCISE_OVERHEAD_SEC;

    const pattern = allExercises?.[ex.exerciseId]?.pattern;
    if (pattern) patternSets[pattern] = (patternSets[pattern] ?? 0) + n;
  }

  const blocks = template?.blocks ?? [];
  for (const block of blocks) {
    seconds += blockEstimatedSec(block) + EXERCISE_OVERHEAD_SEC;
  }

  if (exercises.length > 0 || blocks.length > 0) seconds += SESSION_OVERHEAD_SEC;

  const minutes = (sets > 0 || seconds > 0) ? Math.max(5, Math.round(seconds / 60 / 5) * 5) : 0;
  return { exercises: exercises.length, sets, minutes, patternSets };
}
