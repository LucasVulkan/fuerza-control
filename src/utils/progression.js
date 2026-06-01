/**
 * Progression logic v2.
 *
 * ── Data model ──────────────────────────────────────────────────────────────
 * Lives in exConfig.progression (template-level, per-exercise config):
 *
 * {
 *   type:      'double' | 'weight' | 'reps' | 'time' | 'none'
 *     double  → classic double progression: stay in rep range, hit max → add weight
 *     weight  → fixed reps, session complete → add weight
 *     reps    → fixed weight, session complete → add reps to target
 *     time    → fixed weight, hit max time → increase time target
 *     none    → no automatic chip (user decides)
 *
 *   direction: 'increase' | 'decrease'
 *     increase → normal (more weight = progress)
 *     decrease → assisted/banded (less assistance = progress)
 *
 *   evaluation: {
 *     mode:         'all_complete' | 'pct' | 'rpe' | 'custom'
 *     pctThreshold: 0.8     // mode 'pct': fraction of sets that must be done
 *     maxRpe:       8       // mode 'rpe': session succeeds if avg RPE ≤ maxRpe
 *     minRir:       2       // mode 'rpe': session succeeds if avg RIR ≥ minRir
 *   }
 *
 *   increment: {
 *     type:  'fixed' | 'pct' | 'stepped'
 *     value: 2.5            // type 'fixed': add this amount (kg, reps, or seconds)
 *     pct:   5              // type 'pct':   add this % of the current value
 *     steps: [              // type 'stepped': time-varying increments
 *       { untilSession: 4, value: 5 },   // first 4 sessions: +5
 *       { value: 2.5 }                   // thereafter: +2.5
 *     ]
 *   }
 *
 *   seed: {                  // Trainer-set baseline shown when no history exists
 *     weight: null | number  // kg
 *     reps:   null | number
 *     time:   null | number
 *   }
 * }
 *
 * ── Backward compatibility ───────────────────────────────────────────────────
 * If exConfig.progression is absent, resolveProgressionConfig() maps the old
 * exConfig.progressionModel / def.progressionModel values automatically.
 */

// ── Public constants ──────────────────────────────────────────────────────────

export const PROGRESSION_TYPES  = ['double', 'weight', 'reps', 'time', 'none'];
export const EVALUATION_MODES   = ['all_complete', 'pct', 'rpe', 'custom'];
export const INCREMENT_TYPES    = ['fixed', 'pct', 'stepped'];

/** Maps new type names ↔ legacy progressionModel strings (for backward compat). */
export const LEGACY_TYPE_MAP = {
  double: 'double_progression',
  weight: 'double_progression',
  reps:   'double_progression',
  time:   'time_progression',
  none:   'submax',
};

const LEGACY_REVERSE_MAP = {
  double_progression: 'double',
  time_progression:   'time',
  submax:             'none',
};

// ── resolveProgressionConfig ──────────────────────────────────────────────────

/**
 * Returns a fully normalized progression config.
 * Priority: exConfig.progression > legacy exConfig fields > def fields > defaults.
 *
 * Exported so the exercise editor can initialize its state from existing data.
 *
 * @param {object} exConfig  Template exercise config
 * @param {object} def       Library / custom exercise definition (fallback defaults)
 * @returns {object}         Fully populated progression config
 */
export function resolveProgressionConfig(exConfig, def) {
  const ec = exConfig ?? {};
  const d  = def     ?? {};

  // ── New format ─────────────────────────────────────────────────────────────
  if (ec.progression?.type) {
    const p = ec.progression;
    return {
      type:      p.type      ?? 'double',
      direction: p.direction ?? d.progressionDirection ?? 'increase',
      evaluation: {
        mode:         p.evaluation?.mode         ?? 'all_complete',
        pctThreshold: p.evaluation?.pctThreshold ?? 0.8,
        maxRpe:       p.evaluation?.maxRpe       ?? 8,
        minRir:       p.evaluation?.minRir       ?? 2,
      },
      increment: {
        type:         p.increment?.type         ?? 'fixed',
        value:        p.increment?.value        ?? d.weightStep ?? 2.5,
        pct:          p.increment?.pct          ?? 5,
        steps:        p.increment?.steps        ?? [],
        minIncrement: p.increment?.minIncrement ?? null,
      },
      seed: {
        weight: p.seed?.weight ?? null,
        reps:   p.seed?.reps   ?? null,
        time:   p.seed?.time   ?? null,
      },
    };
  }

  // ── Legacy format ──────────────────────────────────────────────────────────
  const legacyModel = ec.progressionModel ?? d.progressionModel ?? 'double_progression';
  return {
    type:      LEGACY_REVERSE_MAP[legacyModel] ?? 'double',
    direction: d.progressionDirection ?? 'increase',
    evaluation: {
      mode:         'all_complete',
      pctThreshold: 0.8,
      maxRpe:       8,
      minRir:       2,
    },
    increment: {
      type:         'fixed',
      value:        d.weightStep ?? 2.5,
      pct:          5,
      steps:        [],
      minIncrement: null,
    },
    seed: { weight: null, reps: null, time: null },
  };
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Floors `raw` to the nearest multiple of `minIncrement`.
 * E.g. raw=3.2, minIncrement=2.5 → 2.5
 *      raw=6.1, minIncrement=2.5 → 5.0
 *      raw=2.1, minIncrement=2.5 → 2.5 (never goes below minIncrement itself)
 *
 * @param {number} raw
 * @param {number|null} minIncrement  null or 0 = disabled (no rounding applied)
 * @returns {number}
 */
function applyMinIncrement(raw, minIncrement) {
  if (!minIncrement || minIncrement <= 0) return raw;
  return Math.max(minIncrement, Math.floor(raw / minIncrement) * minIncrement);
}

/**
 * Computes the increment amount for the next step.
 *
 * @param {number} currentValue   Current weight / reps / time
 * @param {object} incrConfig     increment sub-object from the progression config
 * @param {number} [sessionCount] Times this exercise has been done (for 'stepped')
 * @returns {number}
 */
function computeIncrement(currentValue, incrConfig, sessionCount = 0) {
  const min = incrConfig.minIncrement ?? null;

  switch (incrConfig.type) {
    case 'pct': {
      const raw = Math.max(0, currentValue) * (incrConfig.pct / 100);
      // Apply minIncrement if set; otherwise fall back to nearest 0.25
      return min
        ? applyMinIncrement(raw, min)
        : Math.max(0.25, Math.round(raw / 0.25) * 0.25);
    }
    case 'stepped': {
      const step =
        incrConfig.steps?.find((s) => s.untilSession == null || sessionCount < s.untilSession)
        ?? incrConfig.steps?.[incrConfig.steps.length - 1];
      const raw = step?.value ?? incrConfig.value ?? 2.5;
      return min ? applyMinIncrement(raw, min) : raw;
    }
    case 'fixed':
    default: {
      const raw = incrConfig.value ?? 2.5;
      return min ? applyMinIncrement(raw, min) : raw;
    }
  }
}

/**
 * Evaluates whether the session warrants progression advancement.
 *
 * @param {array}  doneSets   Sets that have any logged data
 * @param {number} totalSets  Target number of sets for this exercise
 * @param {object} evaluation evaluation sub-object from the progression config
 * @param {object} targets    { minReps, maxReps } — used only by 'all_complete'
 * @returns {'advance'|'hold'|'retreat'}
 */
function evaluateCompletion(doneSets, totalSets, evaluation, targets = {}) {
  const { minReps = 0, maxReps = 0 } = targets;
  const completionRate = doneSets.length / Math.max(1, totalSets);

  switch (evaluation.mode) {
    case 'pct':
      if (completionRate >= evaluation.pctThreshold) return 'advance';
      if (completionRate >= 0.5)                     return 'hold';
      return 'retreat';

    case 'rpe':
      // Requires set-level RPE data — not yet collected.
      // Falls through to all_complete as a safe default until implemented.

    case 'all_complete':
    default: {
      const allDone    = completionRate >= 1;
      const mostDone   = completionRate >= 0.8;
      const struggling = completionRate < 0.6;

      if (allDone && (!maxReps || _avgReps(doneSets) >= maxReps)) return 'advance';
      if (allDone && maxReps && _avgReps(doneSets) >= minReps)    return 'hold';
      if (mostDone && _avgReps(doneSets) >= minReps)              return 'hold';
      if (struggling)                                             return 'retreat';
      return 'hold';
    }
  }
}

function _avgReps(sets) {
  const vals = sets.map((s) => parseInt(s.reps) || 0).filter((v) => v > 0);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
}

// ── Chip builders (one per progression type) ──────────────────────────────────

function chipTime(prog, doneSets, totalSets, minTime, maxTime, t) {
  const times = doneSets.map((s) => parseFloat(s.time) || 0).filter((v) => v > 0);
  if (!times.length) return null;

  const allHitMax = doneSets.length >= totalSets && times.every((v) => v >= maxTime);
  const allOk     = times.every((v) => v >= minTime);

  if (allHitMax) {
    const inc  = computeIncrement(maxTime, prog.increment);
    const next = maxTime + inc;
    return { type: 'up', icon: '⬆', msg: t('progression.time_allHitMax', { next }), suggestedWeight: null, suggestedTime: next };
  }
  if (allOk) {
    return { type: 'hold', icon: '→', msg: t('progression.time_allOk', { min: minTime, max: maxTime }), suggestedWeight: null, suggestedTime: maxTime };
  }
  return { type: 'hold', icon: '→', msg: t('progression.time_keep', { min: minTime, max: maxTime }), suggestedWeight: null, suggestedTime: null };
}

function chipReps(prog, doneSets, totalSets, maxReps, t) {
  const result = evaluateCompletion(doneSets, totalSets, prog.evaluation);
  if (result === 'advance') {
    const inc      = Math.max(1, Math.round(computeIncrement(maxReps, prog.increment)));
    const nextReps = maxReps + inc;
    return { type: 'up', icon: '⬆', msg: t('progression.reps_advance', { next: nextReps }), suggestedWeight: null, suggestedTime: null };
  }
  return { type: 'hold', icon: '→', msg: t('progression.reps_hold'), suggestedWeight: null, suggestedTime: null };
}

function chipWeight(prog, doneSets, totalSets, maxW, t) {
  const result = evaluateCompletion(doneSets, totalSets, prog.evaluation);
  const weightStr = maxW > 0 ? t('progression.withWeight', { kg: maxW }) : t('progression.sameWeight');

  if (result === 'advance') {
    const inc  = computeIncrement(maxW, prog.increment);
    const next = maxW + inc;
    return { type: 'up', icon: '⬆', msg: t('progression.normal_allHit', { next }), suggestedWeight: next, suggestedTime: null };
  }
  if (result === 'retreat' && maxW > 0) {
    const inc  = computeIncrement(maxW, prog.increment);
    const next = Math.max(0, maxW - inc);
    return { type: 'down', icon: '⬇', msg: t('progression.normal_struggling', { next }), suggestedWeight: next, suggestedTime: null };
  }
  return { type: 'hold', icon: '→', msg: t('progression.normal_hold', { weightStr }), suggestedWeight: maxW || null, suggestedTime: null };
}

function chipDouble(prog, doneSets, totalSets, maxW, reps, minReps, maxReps, t) {
  const rate       = doneSets.length / Math.max(1, totalSets);
  const avgReps    = _avgReps(doneSets);
  const allHitMax  = rate >= 1 && reps.every((r) => r >= maxReps);
  const mostHitMin = rate >= 0.8 && avgReps >= minReps;
  const struggling = rate < 0.6;
  const weightStr  = maxW > 0 ? t('progression.withWeight', { kg: maxW }) : t('progression.sameWeight');

  if (allHitMax) {
    const inc  = computeIncrement(maxW, prog.increment);
    const next = maxW + inc;
    return { type: 'up', icon: '⬆', msg: t('progression.normal_allHit', { next }), suggestedWeight: next, suggestedTime: null };
  }
  if (mostHitMin) {
    return { type: 'hold', icon: '→', msg: t('progression.normal_mostHit', { weightStr }), suggestedWeight: maxW || null, suggestedTime: null };
  }
  if (struggling && maxW > 0) {
    const inc  = computeIncrement(maxW, prog.increment);
    const next = Math.max(0, maxW - inc);
    return { type: 'down', icon: '⬇', msg: t('progression.normal_struggling', { next }), suggestedWeight: next, suggestedTime: null };
  }
  return { type: 'hold', icon: '→', msg: t('progression.normal_hold', { weightStr }), suggestedWeight: maxW || null, suggestedTime: null };
}

function chipDoubleDecrease(prog, doneSets, totalSets, assistance, reps, minReps, maxReps, t) {
  const rate       = doneSets.length / Math.max(1, totalSets);
  const avgReps    = _avgReps(doneSets);
  const allHitMax  = rate >= 1 && reps.every((r) => r >= maxReps);
  const mostHitMin = rate >= 0.8 && avgReps >= minReps;
  const struggling = rate < 0.6;
  const assistStr  = assistance > 0 ? t('progression.withAssist', { kg: assistance }) : t('progression.noAssist');

  if (allHitMax && assistance > 0) {
    const inc  = computeIncrement(assistance, prog.increment);
    const next = Math.max(0, assistance - inc);
    const msg  = next === 0
      ? t('progression.decrease_lastAssist', { assist: assistance })
      : t('progression.decrease_allHit', { next });
    return { type: 'up', icon: '⬆', msg, suggestedWeight: next, suggestedTime: null };
  }
  if (allHitMax && assistance === 0) {
    return { type: 'up', icon: '⬆', msg: t('progression.decrease_free'), suggestedWeight: 0, suggestedTime: null };
  }
  if (mostHitMin) {
    return { type: 'hold', icon: '→', msg: t('progression.decrease_mostHit', { assistStr }), suggestedWeight: assistance || null, suggestedTime: null };
  }
  if (struggling && assistance < 999) {
    const inc  = computeIncrement(assistance, prog.increment);
    const next = assistance + inc;
    return { type: 'down', icon: '⬇', msg: t('progression.decrease_struggling', { next }), suggestedWeight: next, suggestedTime: null };
  }
  return { type: 'hold', icon: '→', msg: t('progression.decrease_hold', { assistStr }), suggestedWeight: assistance || null, suggestedTime: null };
}

// ── Main entry point ──────────────────────────────────────────────────────────

/**
 * Generates a progression chip for ExerciseCard.
 *
 * @param {object}   exConfig   Template exercise config (sets, minReps, progression, …)
 * @param {object}   def        Library / custom exercise definition (fallback defaults)
 * @param {array}    lastSets   Sets logged in the last session for this exercise
 * @param {function} t          i18next translate function
 * @returns chip object | null
 */
export function getProgression(exConfig, def, lastSets, t) {
  if (!lastSets?.length) return null;

  const doneSets = lastSets.filter((s) => s.done || s.weight || s.reps || s.time);
  if (!doneSets.length) return null;

  const prog = resolveProgressionConfig(exConfig, def);
  if (prog.type === 'none') return null;

  // Effective params: exConfig values override def defaults
  const minReps   = exConfig?.minReps  ?? def?.minReps  ?? 8;
  const maxReps   = exConfig?.maxReps  ?? def?.maxReps  ?? 12;
  const minTime   = exConfig?.minTime  ?? def?.minTime  ?? 20;
  const maxTime   = exConfig?.maxTime  ?? def?.maxTime  ?? 40;
  const totalSets = exConfig?.sets     ?? def?.sets     ?? doneSets.length;

  if (prog.type === 'time') {
    return chipTime(prog, doneSets, totalSets, minTime, maxTime, t);
  }

  if (prog.type === 'reps') {
    return chipReps(prog, doneSets, totalSets, maxReps, t);
  }

  // weight + double — both work with weighted sets
  const weights = doneSets.map((s) => parseFloat(s.weight) || 0);
  const reps    = doneSets.map((s) => parseInt(s.reps) || 0);
  const maxW    = Math.max(0, ...weights);

  if (prog.direction === 'decrease') {
    return chipDoubleDecrease(prog, doneSets, totalSets, maxW, reps, minReps, maxReps, t);
  }
  if (prog.type === 'weight') {
    return chipWeight(prog, doneSets, totalSets, maxW, t);
  }
  // double (default)
  return chipDouble(prog, doneSets, totalSets, maxW, reps, minReps, maxReps, t);
}

// ── summarizeSets ─────────────────────────────────────────────────────────────

/**
 * Summarizes a completed exercise into a short display string.
 * Supports both legacy call signature (exerciseDef, doneSets, weightFmt)
 * and new signature (exConfig, def, doneSets, weightFmt).
 */
export function summarizeSets(exConfigOrDef, defOrDoneSets, doneSetsOrFmt, weightFmtArg) {
  const isLegacy = Array.isArray(defOrDoneSets);
  const exConfig = isLegacy ? exConfigOrDef : exConfigOrDef;
  const def      = isLegacy ? null          : defOrDoneSets;
  const doneSets = isLegacy ? defOrDoneSets : doneSetsOrFmt;
  const weightFmt = (isLegacy ? doneSetsOrFmt : weightFmtArg) ?? ((kg) => `${kg}kg`);

  if (!doneSets?.length) return '—';

  const prog = resolveProgressionConfig(exConfig, def);

  if (prog.type === 'time') {
    const times = doneSets.map((s) => s.time).filter(Boolean);
    return times.length ? times.join('/') + 's' : '—';
  }
  if (prog.type === 'none') {
    const total = doneSets.reduce((acc, s) => acc + (parseInt(s.reps) || 0), 0);
    const maxW  = Math.max(0, ...doneSets.map((s) => parseFloat(s.weight) || 0));
    if (!total) return '—';
    return maxW > 0 ? `${total} reps · ${weightFmt(maxW)}` : `${total} reps tot.`;
  }
  // double, weight, reps
  const maxW     = Math.max(0, ...doneSets.map((s) => parseFloat(s.weight) || 0));
  const repsList = doneSets.map((s) => s.reps).filter(Boolean).join('/');
  if (maxW > 0) return `${weightFmt(maxW)} · ${repsList}`;
  if (repsList) return `${repsList} reps`;
  return '—';
}
