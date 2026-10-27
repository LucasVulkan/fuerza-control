/**
 * warmup — pure helpers for the warmup-set ramp (see docs/specs/T05-warmup-sets.md §1-2).
 */
import { doneSets } from './sessionRecap';

const AUTO_RAMPS = {
  1: [{ pct: 60, reps: 5 }],
  2: [{ pct: 45, reps: 8 }, { pct: 70, reps: 4 }],
  3: [{ pct: 40, reps: 10 }, { pct: 60, reps: 6 }, { pct: 80, reps: 3 }],
  4: [{ pct: 40, reps: 10 }, { pct: 55, reps: 8 }, { pct: 70, reps: 5 }, { pct: 85, reps: 2 }],
};

const ROUND_KG = 2.5;
const ROUND_LB = 5;
const KG_TO_LB = 2.2046; // el mismo factor que useWeightUnit

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
export function computeWarmupWeights(steps, workWeightKg, { lb = false, assist = false } = {}) {
  return steps.map(({ pct, reps }) => {
    if (workWeightKg == null) return { weightKg: null, reps };
    // Asistidas (I01 §13.3): el número es la ayuda; la rampa va de más ayuda a la de trabajo.
    const p = assist ? 200 - pct : pct;
    // lb (I01 §13.2): se redondea a 5 lb y se devuelve en kg sin redondear más, para que
    // `toDisplay` (que redondea a 0,5 lb) dé el múltiplo de 5 exacto.
    if (lb) return { weightKg: Math.round((p * workWeightKg * KG_TO_LB / 100) / ROUND_LB) * ROUND_LB / KG_TO_LB, reps };
    const raw = Math.round((p * workWeightKg / 100) / ROUND_KG) * ROUND_KG;
    return { weightKg: Math.round(raw * 100) / 100, reps };
  });
}

/**
 * Reference work weight for the day, resolved in cascade (spec §2):
 * 1. Trainer's one-off prescription (`pendingOverrides`) for this exercise.
 * 2. The weight of today's plan (`chip.suggestedWeight`, P56 §6.2): the
 *    warmup ramps toward what the progression asks for, not last week's.
 *    En asistidas (`chip.assist`) ese número es la ayuda propuesta y también
 *    vale como base (I01 §13.3).
 * 3. Top set weight from the last logged session — same `lastExercise`
 *    reference the workout screen already resolves (linkGroup-aware), and
 *    the same "counts as logged" notion as `doneSets` (excludes warmup sets).
 * 4. Whatever the athlete has already typed for their first work set.
 * Returns null when none of the four is available.
 * Excepción (I01 §13.1): con peso escrito en la 1.ª serie y ninguna serie del
 * calentamiento marcada (`warmupStarted` false), manda lo escrito sobre el plan
 * y la última vez (el override del entrenador sigue mandando).
 */
export function resolveWorkWeight(overrideEx, lastExercise, typedFirstWorkWeight, chip = null, { warmupStarted } = {}) {
  if (overrideEx?.weight != null) return overrideEx.weight;
  if (warmupStarted === false && typedFirstWorkWeight > 0) return typedFirstWorkWeight;
  if (chip && chip.suggestedWeight > 0) return chip.suggestedWeight;
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
