/**
 * setDisplay — shared helpers for rendering a session's logged sets as
 * "weight-group + rep/RPE pills", used by both HistoryScreen (session detail)
 * and ProgressTab's ExerciseDetailModal (per-exercise session log).
 *
 * Extracted from HistoryScreen.jsx so the two screens don't drift.
 */

// ── buildSetLabel ──────────────────────────────────────────────────────────────
// omitWeight: true when the weight is already shown by the group's own weight
// pill (see groupSetsByWeight) — the reps/time pill then shows only reps/@RPE.

// omitWeight=true (the only case actually used, by the set pills) returns
// { main, rpeNum } instead of a string — Figma renders the "@" glyph in a
// dimmer tint than the RPE number and the main value, so the pill needs the
// pieces split for per-span coloring. No space before "@" (Figma: "12@8").
export function buildSetLabel(s, i, fmtWeight, omitWeight = false) {
  const hasW = s.weight && Number(s.weight) > 0;
  const hasR = s.reps   && Number(s.reps)   > 0;
  const hasT = s.time   && Number(s.time)   > 0;
  const rpeNum = s.rpe && Number(s.rpe) > 0 ? String(s.rpe) : '';
  if (omitWeight) {
    if (hasR) return { main: `${s.reps}`, rpeNum };
    if (hasT) return { main: `${s.time}s`, rpeNum };
    return { main: `S${i + 1}`, rpeNum: '' };
  }
  const rpe = rpeNum ? ` @${rpeNum}` : '';
  if (hasW && hasR) return `${fmtWeight(s.weight)}×${s.reps}${rpe}`;
  if (hasW && hasT) return `${fmtWeight(s.weight)}×${s.time}s${rpe}`;
  if (hasR)         return `${s.reps} reps${rpe}`;
  if (hasT)         return `${s.time}s${rpe}`;
  if (hasW)         return `${fmtWeight(s.weight)}${rpe}`;
  return `S${i + 1}`;
}

// ── groupSetsByWeight ────────────────────────────────────────────────────────
// Groups consecutive sets sharing the same weight into runs, so the UI can
// render one weightless weight-pill followed by its reps/RPE pills.

export function groupSetsByWeight(sets) {
  const groups = [];
  for (const s of sets) {
    const w = s.weight || null;
    const last = groups[groups.length - 1];
    if (last && last.weight === w) last.sets.push(s);
    else groups.push({ weight: w, sets: [s] });
  }
  return groups;
}

// ── getPillVariant ─────────────────────────────────────────────────────────────
// 'done' = verde/accent, 'partial' = naranja, 'empty' = gris

export function getPillVariant(s, exConfig) {
  const hasData = (s.weight && Number(s.weight) > 0)
               || (s.reps   && Number(s.reps)   > 0)
               || (s.time   && Number(s.time)   > 0);
  if (!hasData)       return 'empty';
  if (s.done === false) return 'partial'; // explicitly not done (new entries only)

  // Compare to target range when available
  if (exConfig) {
    const inputType   = exConfig.inputType ?? 'weight_reps';
    const isTimeBased = inputType === 'time' || inputType === 'weight_time';
    if (isTimeBased && exConfig.minTime && Number(s.time) < Number(exConfig.minTime)) return 'partial';
    if (!isTimeBased && exConfig.minReps && Number(s.reps) < Number(exConfig.minReps)) return 'partial';
  }

  return 'done';
}
