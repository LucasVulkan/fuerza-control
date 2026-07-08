/**
 * warmup — pure helpers for the warmup-set ramp (see docs/specs/warmup-sets.md §1-2).
 */
import { doneSets } from './sessionRecap';

const AUTO_RAMPS = {
  1: [{ pct: 60, reps: 5 }],
  2: [{ pct: 45, reps: 8 }, { pct: 70, reps: 4 }],
  3: [{ pct: 40, reps: 10 }, { pct: 60, reps: 6 }, { pct: 80, reps: 3 }],
  4: [{ pct: 40, reps: 10 }, { pct: 55, reps: 8 }, { pct: 70, reps: 5 }, { pct: 85, reps: 2 }],
};

const ROUND_KG = 2.5;

/**
 * Effective warmup steps for a given config.
 * null → no warmup. 'auto' → fixed ramp for the chosen size. 'custom' → its own steps.
 */
export function warmupSteps(warmupConfig) {
  if (!warmupConfig) return [];
  if (warmupConfig.mode === 'custom') return warmupConfig.steps ?? [];
  return AUTO_RAMPS[warmupConfig.sets] ?? [];
}

/**
 * Resolves each step's weight against the day's work weight, rounded to the
 * nearest 2.5 kg. `workWeightKg == null` (no reference yet) → weights stay null.
 */
export function computeWarmupWeights(steps, workWeightKg) {
  return steps.map(({ pct, reps }) => {
    if (workWeightKg == null) return { weightKg: null, reps };
    const raw = Math.round((pct * workWeightKg / 100) / ROUND_KG) * ROUND_KG;
    return { weightKg: Math.round(raw * 100) / 100, reps };
  });
}

/**
 * Reference work weight for the day, resolved in cascade (spec §2):
 * 1. Trainer's one-off prescription (`pendingOverrides`) for this exercise.
 * 2. Top set weight from the last logged session — same `lastExercise`
 *    reference the workout screen already resolves (linkGroup-aware), and
 *    the same "counts as logged" notion as `doneSets` (excludes warmup sets).
 * 3. Whatever the athlete has already typed for their first work set.
 * Returns null when none of the three is available.
 */
export function resolveWorkWeight(overrideEx, lastExercise, typedFirstWorkWeight) {
  if (overrideEx?.weight != null) return overrideEx.weight;
  const top = topSetWeight(lastExercise);
  if (top != null) return top;
  return typedFirstWorkWeight ?? null;
}

function topSetWeight(lastExercise) {
  if (!lastExercise) return null;
  let best = null;
  for (const s of doneSets(lastExercise)) {
    const w = parseFloat(s.weight);
    if (!isNaN(w) && w > 0 && (best == null || w > best)) best = w;
  }
  return best;
}
