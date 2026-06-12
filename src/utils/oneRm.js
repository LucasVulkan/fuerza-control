/**
 * Estimated 1RM (one-rep max) helpers — Epley formula.
 *
 * e1RM = weight × (1 + reps / 30)
 *
 * Reliable up to ~10-12 reps; sets above 12 reps are ignored (the formula
 * increasingly overestimates as reps climb). All values in kg (storage unit) —
 * callers convert for display via useWeightUnit.
 */

const MAX_RELIABLE_REPS = 12;

/**
 * e1RM for a single set, or null when not computable.
 * When RPE is provided (5–10), effective reps = reps + reps-in-reserve:
 * 100×5 @RPE8 means 2 more reps were possible → estimate as a 7-rep max.
 */
export function epley1RM(weight, reps, rpe = null) {
  const w = parseFloat(weight);
  let   r = parseInt(reps, 10);
  if (!w || w <= 0 || !r || r < 1) return null;
  const rpeNum = parseFloat(rpe);
  if (rpeNum >= 5 && rpeNum <= 10) {
    r = r + (10 - rpeNum); // add reps in reserve
  }
  if (r > MAX_RELIABLE_REPS) return null;
  if (r === 1) return w;
  return w * (1 + r / 30);
}

/** Best e1RM across the sets of one logged exercise, or null. */
export function bestSetE1RM(sets) {
  let best = null;
  for (const s of sets ?? []) {
    if (!(s.done || s.weight || s.reps)) continue;
    const v = epley1RM(s.weight, s.reps, s.rpe);
    if (v !== null && (best === null || v > best)) best = v;
  }
  return best;
}

/**
 * Current-ability estimate: best e1RM over the last `weeks` weeks.
 * Using a window (not just the last session) so a light/deload day doesn't
 * sink the number, and not all-time so it reflects what you can do NOW.
 *
 * @param {Array<{timestamp: number, exercise: object}>} logs
 * @returns {{ value: number, timestamp: number } | null}
 */
export function recentE1RM(logs, weeks = 6) {
  const cutoff = Date.now() - weeks * 7 * 24 * 60 * 60 * 1000;
  let best = null;
  let ts   = null;
  for (const { timestamp, exercise } of logs ?? []) {
    if (timestamp < cutoff) continue;
    const v = bestSetE1RM(exercise?.sets);
    if (v !== null && (best === null || v >= best)) {
      best = v;
      ts   = timestamp;
    }
  }
  return best !== null ? { value: best, timestamp: ts } : null;
}
