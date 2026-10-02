/**
 * Progression logic v3 (docs/specs/progresion-clara.md §4).
 *
 * ── Data model ──────────────────────────────────────────────────────────────
 * Lives in exConfig.progression (template-level, per-exercise config). Tres
 * preguntas: qué sube (`type`), cuándo (`evaluation`) y cuánto (`increment`):
 *
 * {
 *   type:      'double' | 'reps' | 'time' | 'effort' | 'none'
 *     double  → «Peso · por reglas» (el nombre interno se mantiene): todas las
 *               series llegan a la meta (el máximo del rango, o las reps fijas)
 *               → sube el peso; si fallan las suficientes bajo el mínimo → baja
 *     reps    → la meta es la serie más floja de la última sesión + el salto
 *     time    → ídem en segundos
 *     effort  → reps objetivo @ targetRpe; el peso sale del e1RM de la última
 *               sesión con su RPE (effort-progression.md)
 *     none    → sin chip (lo decide el usuario)
 *
 *   evaluation: {
 *     mode:   'all_complete' | 'part' | 'rpe'    // UI: Todas · Parcial · RPE máx.
 *     need:   2      // 'part': series que tienen que llegar a la meta
 *     maxRpe: 8      // 'rpe': sube solo si el RPE medio es ≤ maxRpe
 *   }
 *
 *   increment: { type: 'fixed' | 'pct', value: 2.5, pct: 5 }
 *
 *   down: 'never' | { fails: 2 }
 *     Solo 'double'. Ausente → `{ fails: floor(n·0,4)+1 }` (§4.3), que se
 *     calcula en el chip con las series de la sesión, no aquí.
 *
 *   targetRpe: 8                      // 'effort'
 *   effortWhen: 'beat' | 'reach'      // 'effort'; ausente → 'beat'
 *
 *   hold: null | 'deload'
 *     Suspende la progresión durante una etapa de descarga. NO oculta el chip:
 *     lo sustituye por uno que dice explícitamente que hay que mantener el
 *     peso. Sin chip, el cliente lee "esto no tiene progresión" y sube el peso
 *     igual — y la descarga no ocurre. Lo escribe `applyRx` al materializar una
 *     etapa (`stageRx.js`); no hay UI por ejercicio.
 * }
 *
 * Fuera de `progression`: `exConfig.weightStep`, el escalón de peso del
 * ejercicio (ausente → el de la librería, o 2,5), o 'exact' en Por esfuerzo
 * (el peso calculado sin redondear al escalón, §5.4-bis).
 *
 * ── Lectura de lo antiguo (sin migrar datos) ────────────────────────────────
 * `type: 'weight'` → 'double' con meta = minReps · `mode: 'pct'` +
 * `pctThreshold` → 'part' con `need = ceil(pct · series)` · `stepped` →
 * 'fixed' con su primer escalón · `minIncrement`, `seed`, `minRir` y `custom`
 * se ignoran. Sin `exConfig.progression`, `resolveProgressionConfig()` mapea el
 * `progressionModel` antiguo de la plantilla o de la librería.
 */

import { e1rmAtLeast, weightForReps } from './oneRm';
import { isBodyweight } from './trainingLoad';

// ── Public constants ──────────────────────────────────────────────────────────

export const PROGRESSION_TYPES  = ['double', 'reps', 'time', 'effort', 'none'];
export const EVALUATION_MODES   = ['all_complete', 'part', 'rpe'];
export const INCREMENT_TYPES    = ['fixed', 'pct'];

/**
 * El objetivo cuando ni la sesión ni la librería lo fijan (hay ejercicios de
 * doble progresión sin rango en la librería: paseo del granjero, paseo con
 * maleta, empuje de trineo). UNA sola fuente: el editor lo enseña, el motor
 * progresa con él y la prescripción lo pinta. Cuando cada uno tenía el suyo,
 * el editor decía «8–12, automática» y Inicio «submáx».
 */
export const DEFAULT_TARGET = { minReps: 8, maxReps: 12, minTime: 20, maxTime: 40 };

/** Maps new type names ↔ legacy progressionModel strings (for backward compat). */
export const LEGACY_TYPE_MAP = {
  double: 'double_progression',
  weight: 'double_progression',
  reps:   'double_progression',
  time:   'time_progression',
  effort: 'double_progression',
  none:   'fixed',
};

// `fixed` es el valor de librería para «Fija» (effort-progression.md §3.1).
// `submax` ya no se escribe: queda para leer como Fija lo guardado antes.
const LEGACY_REVERSE_MAP = {
  double_progression: 'double',
  time_progression:   'time',
  fixed:              'none',
  submax:             'none',
};

/**
 * El salto por defecto según lo que sube: 1 rep, 5 s o el escalón de peso
 * (`step`, o el `weightStep` de la librería si no se da). Antes era siempre el
 * `weightStep`, así que «Reps» subía de 3 en 3 (2,5 redondeado) y «Tiempo» de
 * 2,5 s (P52).
 */
export function defaultIncrement(type, def, step) {
  if (type === 'reps') return 1;
  if (type === 'time') return 5;
  return step ?? (def?.weightStep > 0 ? def.weightStep : 2.5);
}

/**
 * ¿Tiene sentido subirle peso a este ejercicio? Los de peso corporal solo si se
 * pueden lastrar (dominadas, fondos y flexiones: son los que traen `weightStep`
 * en la librería). Un `def` desconocido cuenta como con carga (§5.3-bis).
 */
export function canAddWeight(def) {
  return !isBodyweight(def) || def.weightStep > 0;
}

// ── resolveProgressionConfig ──────────────────────────────────────────────────

/**
 * El escalón de peso del ejercicio: el suyo, el de la librería o 2,5 (§4.1).
 * En Por esfuerzo el de la librería es como mucho 2,5: ahí es la resolución de
 * la carga, no el salto de la automática, y a 5 kg un punto de RPE (+2,8 %) no
 * movía el peso por debajo de ~90 kg (QA P48, otra vez en QA P54.3).
 */
function resolveStep(ec, d, type) {
  if (ec.weightStep > 0) return ec.weightStep;
  const lib = d.weightStep > 0 ? d.weightStep : 2.5;
  return type === 'effort' ? Math.min(lib, 2.5) : lib;
}

/**
 * Returns a fully normalized progression config (§4.1).
 * Priority: exConfig.progression > legacy exConfig fields > def fields > defaults.
 *
 * Exported so the exercise editor can initialize its state from existing data.
 *
 * `step` y `direction` son del ejercicio, no se guardan en la plantilla:
 * `applyRx` no los escribe. Tampoco `down` si no venía guardado: ausente es
 * `null` y el chip pone el valor por defecto con las series de la sesión.
 *
 * @param {object} exConfig  Template exercise config
 * @param {object} def       Library / custom exercise definition (fallback defaults)
 * @returns {object}         Fully populated progression config
 */
export function resolveProgressionConfig(exConfig, def) {
  const ec = exConfig ?? {};
  const d  = def     ?? {};
  const p  = ec.progression?.type ? ec.progression : null;
  // La dirección es del ejercicio (asistido = baja), no un ajuste: el
  // editor guardaba siempre 'increase' y una asistida editada pedía MÁS
  // asistencia (P52). `p.direction` solo cuenta si el ejercicio ya no existe.
  const direction = d.progressionDirection ?? p?.direction ?? 'increase';
  let type = p
    ? (p.type === 'weight' ? 'double' : p.type)
    : (LEGACY_REVERSE_MAP[ec.progressionModel ?? d.progressionModel ?? 'double_progression'] ?? 'double');
  // Sin carga y sin lastre posible, «Peso» no existe: se progresa en reps
  // (§5.3-bis). Los asistidos no cambian. Se mira el `def` original: `{}` de
  // `def ?? {}` pasaría por peso corporal.
  const toReps = type === 'double' && direction === 'increase' && !canAddWeight(def);
  if (toReps) type = 'reps';
  const step = resolveStep(ec, d, type);

  const ev   = p?.evaluation ?? {};
  const mode = ev.mode === 'pct' ? 'part' : (EVALUATION_MODES.includes(ev.mode) ? ev.mode : 'all_complete');
  const sets = ec.sets ?? d.sets ?? 3;
  // `- 1e-9`: 0,7 · 10 da 7,000…01 y el techo lo subiría a 8.
  const need = ev.need ?? Math.max(1, Math.ceil((ev.pctThreshold ?? 0.8) * sets - 1e-9));

  const inc = p?.increment ?? {};
  return {
    type,
    direction,
    step,
    // 'exact' solo vale en Por esfuerzo; en Por reglas se lee como ausente. El
    // `step` de arriba sigue siendo un número (stageRx y defaultIncrement
    // hacen cuentas con él).
    exact: type === 'effort' && ec.weightStep === 'exact',
    evaluation: { mode, need, maxRpe: ev.maxRpe ?? 8 },
    increment: {
      type:  inc.type === 'pct' ? 'pct' : 'fixed',
      // El salto guardado de un «Peso» leído como Reps eran kilos: no vale.
      value: (toReps ? undefined : (inc.type === 'stepped' ? inc.steps?.[0]?.value : undefined) ?? inc.value) ?? defaultIncrement(type, d, step),
      pct:   inc.pct ?? 5,
    },
    down:       p?.down ?? null,
    targetRpe:  p?.targetRpe ?? 8,
    effortWhen: p?.effortWhen ?? 'beat',
    hold:       p?.hold ?? null,
  };
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Computes the increment amount for the next step.
 *
 * `step` solo en peso (Doble, asistidos): 'pct' redondea al múltiplo de `step`
 * más cercano, nunca por debajo de él. En Reps y Tiempo (`step` null) el
 * escalón es de kilos y no aplica: entero, mínimo 1 (§4.4).
 *
 * @param {number}      currentValue  Current weight / reps / time
 * @param {object}      incrConfig    increment sub-object from the progression config
 * @param {number|null} step          Escalón de peso; null en Reps y Tiempo
 * @returns {number}
 */
function computeIncrement(currentValue, incrConfig, step) {
  if (incrConfig.type === 'pct') {
    const raw = Math.max(0, currentValue) * (incrConfig.pct / 100);
    return step ? Math.max(step, Math.round(raw / step) * step) : Math.max(1, Math.round(raw));
  }
  return incrConfig.value ?? step ?? 1;
}

/**
 * Counts sets that actually met the minimum threshold.
 *
 * A set with logged reps < minReps (or time < minTime) counts as FAILED.
 * A set marked done without entering reps/time counts as qualifying —
 * the user confirmed completion but chose not to log the numbers.
 *
 * @param {array}  doneSets Sets with any logged data
 * @param {object} targets  { minReps, minTime }
 * @returns {number}
 */
function countQualifyingSets(doneSets, targets) {
  const { minReps = 0, minTime = 0 } = targets;
  return doneSets.filter((s) => {
    const reps = parseInt(s.reps) || 0;
    const time = parseFloat(s.time) || 0;
    if (minTime > 0 && time > 0) return time >= minTime;
    if (minReps > 0 && reps > 0) return reps >= minReps;
    // No metric data entered → only the done tick confirms completion
    return !!s.done;
  }).length;
}

function avgRpe(doneSets) {
  const rpes = doneSets.map((s) => parseFloat(s.rpe)).filter((v) => v > 0);
  return rpes.length ? rpes.reduce((a, b) => a + b, 0) / rpes.length : null;
}

/**
 * La tabla de §4.2, para todas las progresiones por reglas. `goal` es la meta
 * (llegar a ella sube) y `floor` el suelo (quedarse por debajo es fallar); en
 * Reps y Tiempo son el mismo número, el inicio.
 *
 *   sube  = Todas: n a la meta · Parcial: `need` a la meta ·
 *           RPE máx.: n a la meta y RPE medio ≤ maxRpe (sin RPE apuntado, no pesa)
 *   baja  = `down` ≠ 'never' y las series bajo el suelo ≥ `fails`
 *
 * `rpeOver`: llegó a la meta pero el RPE medio pasó el tope; mantiene.
 * No hay bajada por RPE: bajar es solo la regla explícita.
 */
function verdict(prog, doneSets, n, floor, goal, key = 'minReps') {
  const ev       = prog.evaluation;
  const hitGoal  = countQualifyingSets(doneSets, { [key]: goal });
  const hitFloor = countQualifyingSets(doneSets, { [key]: floor });
  // `need` y `fails` se recortan a las series de la sesión: una etapa puede
  // cambiar `n` sin que cambie lo guardado (§4.3).
  const need  = Math.min(Math.max(ev.need, 1), n);
  const fails = prog.down === 'never' ? Infinity
    : Math.min(Math.max(prog.down?.fails ?? Math.floor(n * 0.4) + 1, 1), n);

  const reached = ev.mode === 'part' ? hitGoal >= need : hitGoal >= n;
  const rpe     = ev.mode === 'rpe' ? avgRpe(doneSets) : null;
  const rpeOver = rpe != null && rpe > ev.maxRpe;
  return {
    up: reached && !rpeOver,
    rpeOver: reached && rpeOver,
    down: n - hitFloor >= fails,
    hitGoal, need, n,
  };
}

/** El motivo de subir dice lo que pasó de verdad: con Parcial no llegaron todas. */
function whyUp(prog, v, goal, t) {
  return prog.evaluation.mode === 'part' && v.hitGoal < v.n
    ? t('progression.why_partHit', { hit: v.hitGoal, n: v.n, goal })
    : t('progression.why_allHit');
}

/** El motivo de mantener: la meta se alcanzó pero el RPE se pasó, o no se llegó. */
function whyHold(prog, v, holdKey, holdOpts, t) {
  return v.rpeOver
    ? t('progression.why_rpeAbove', { maxRpe: prog.evaluation.maxRpe })
    : t(holdKey, holdOpts);
}

// ── Chip builders (one per progression type) ──────────────────────────────────

/*
 * Reps y Tiempo (§4.4): la meta es la serie más floja de la última sesión + el
 * salto, no el objetivo guardado. El motor no tiene memoria; la última sesión
 * sí (P52): «máximo + salto» proponía lo mismo cada semana. Qué pides guarda
 * solo el inicio, que hace de suelo: si no se cumple, la meta es el inicio. La
 * serie más floja que llegó al inicio es el punto de partida: subirla es subir
 * el ejercicio entero.
 */
function chipTime(prog, doneSets, n, start, maxTime, t) {
  const times = doneSets.map((s) => parseFloat(s.time) || 0).filter((v) => v > 0);
  if (!times.length) return null;

  const v  = verdict(prog, doneSets, n, start, start, 'minTime');
  const ok = times.filter((x) => x >= start);
  if (v.up && ok.length) {
    const base = Math.min(...ok);
    const next = Math.round(base + Math.max(1, computeIncrement(base, prog.increment, null)));
    return { type: 'up', icon: '⬆', msg: t('progression.time_allHitMax', { next }), why: t('progression.why_timeAllHit', { n: base }), suggestedWeight: null, suggestedTime: next,
      // `from`: la serie de la que parte el salto, para que el delta diga +5 y no nada (QA P52).
      from: base };
  }
  // Mantener también lleva número (el inicio): sin él la tarjeta pintaba la
  // frase larga en el hueco de la cifra (QA P52).
  return { type: 'hold', icon: '→', msg: t('progression.time_keep', { min: start, max: maxTime }), why: whyHold(prog, v, 'progression.why_timeHold', { min: start }, t),
    suggestedWeight: null, suggestedTime: start };
}

function chipReps(prog, doneSets, n, start, t) {
  const v  = verdict(prog, doneSets, n, start, start);
  const ok = doneSets.map((s) => parseInt(s.reps) || 0).filter((r) => r > 0 && r >= start);
  if (v.up && ok.length) {
    const base = Math.min(...ok);
    const next = base + Math.max(1, Math.round(computeIncrement(base, prog.increment, null)));
    return { type: 'up', icon: '⬆', msg: t('progression.reps_advance', { next }), why: t('progression.why_repsUp', { n: base }),
      suggestedWeight: null, suggestedTime: null, suggestedReps: next, from: base };
  }
  return { type: 'hold', icon: '→', msg: t('progression.reps_hold'), why: whyHold(prog, v, 'progression.why_repsHold', { min: start }, t),
    suggestedWeight: null, suggestedTime: null, suggestedReps: start };
}

/**
 * «Peso · por reglas» (§4.2): sube → baja → mantener. `goal` es la meta (el
 * máximo del rango, o las reps fijas) y `floor` el suelo (`minReps`).
 */
function chipDouble(prog, doneSets, n, maxW, floor, goal, t) {
  const v = verdict(prog, doneSets, n, floor, goal);
  const weightStr = maxW > 0 ? t('progression.withWeight', { kg: maxW }) : t('progression.sameWeight');

  if (v.up) {
    const next = maxW + computeIncrement(maxW, prog.increment, prog.step);
    return { type: 'up', icon: '⬆', msg: t('progression.normal_allHit', { next }), why: whyUp(prog, v, goal, t), suggestedWeight: next, suggestedTime: null };
  }
  if (v.down && maxW > 0) {
    const next = Math.max(0, maxW - computeIncrement(maxW, prog.increment, prog.step));
    return { type: 'down', icon: '⬇', msg: t('progression.normal_struggling', { next }), why: t('progression.why_belowMin'), suggestedWeight: next, suggestedTime: null };
  }
  return { type: 'hold', icon: '→', msg: t('progression.normal_hold', { weightStr }), why: whyHold(prog, v, 'progression.why_holdReps', {}, t), suggestedWeight: maxW || null, suggestedTime: null };
}

/**
 * Por esfuerzo (effort-progression.md §4.2): el e1RM es la media del de cada
 * serie con peso, reps y RPE; el peso siguiente, el que da `targetRpe` a las
 * reps objetivo, redondeado al escalón del ejercicio (`step`).
 *
 * `effortWhen: 'reach'` (§4.4): si el cálculo deja el peso igual y todas las
 * series llegaron a las reps objetivo, sube un escalón.
 */
function chipEffort(prog, doneSets, n, targetReps, t) {
  const maxW = Math.max(0, ...doneSets.map((s) => parseFloat(s.weight) || 0));
  const keep = (why) => ({
    effort: true, type: 'hold', icon: '→', msg: t('progression.effort_noWeight'), why: t(why),
    suggestedWeight: maxW || null, suggestedTime: null, e1rm: null, raw: null,
  });

  // Cota baja por serie (`e1rmAtLeast`): una serie fácil sube el peso, nunca
  // lo baja ni se descarta (QA P48).
  const e1rms = doneSets
    .map((s) => e1rmAtLeast(s.weight, s.reps, s.rpe))
    .filter((v) => v !== null);
  if (!e1rms.length) return keep('progression.why_effortNoRpe');

  const e1rm = e1rms.reduce((a, b) => a + b, 0) / e1rms.length;
  const raw  = weightForReps(e1rm, targetReps, prog.targetRpe);
  if (raw === null) return keep('progression.why_effortUnreliable');

  // Exacto (§5.4-bis): el cálculo tal cual, a 0,1 kg; sin escalón no hay
  // «Al llegar» que valga (el peso se mueve con cualquier cambio).
  const next = prog.exact ? Math.round(raw * 10) / 10 : Math.round(raw / prog.step) * prog.step;
  const type = next > maxW ? 'up' : next < maxW ? 'down' : 'hold';

  if (!prog.exact && type === 'hold' && prog.effortWhen === 'reach'
      && countQualifyingSets(doneSets, { minReps: targetReps }) >= n) {
    return {
      effort: true, type: 'up', icon: '⬆',
      msg: t('progression.effort_noWeight'), why: t('progression.why_effortReached'),
      suggestedWeight: maxW + prog.step, suggestedTime: null, e1rm, raw,
    };
  }

  const why = { up: 'why_effortEasier', down: 'why_effortHarder', hold: 'why_effortOnTarget' }[type];
  return {
    // `effort`: la tarjeta lo rotula «Peso objetivo» sea cual sea la dirección.
    effort: true,
    type, icon: { up: '⬆', down: '⬇', hold: '→' }[type],
    msg: t('progression.effort_noWeight'), why: t(`progression.${why}`),
    suggestedWeight: next, suggestedTime: null, e1rm, raw,
  };
}

/** El espejo de `chipDouble` para asistidos: subir es quitar ayuda, bajar es ponerla. */
function chipDoubleDecrease(prog, doneSets, n, assistance, floor, goal, t) {
  const v = verdict(prog, doneSets, n, floor, goal);
  const assistStr = assistance > 0 ? t('progression.withAssist', { kg: assistance }) : t('progression.noAssist');

  if (v.up && assistance > 0) {
    const next = Math.max(0, assistance - computeIncrement(assistance, prog.increment, prog.step));
    const msg  = next === 0
      ? t('progression.decrease_lastAssist', { assist: assistance })
      : t('progression.decrease_allHit', { next });
    return { type: 'up', icon: '⬆', msg, why: whyUp(prog, v, goal, t), suggestedWeight: next, suggestedTime: null };
  }
  if (v.up && assistance === 0) {
    return { type: 'up', icon: '⬆', msg: t('progression.decrease_free'), why: whyUp(prog, v, goal, t), suggestedWeight: 0, suggestedTime: null };
  }
  if (v.down && assistance < 999) {
    const next = assistance + computeIncrement(assistance, prog.increment, prog.step);
    return { type: 'down', icon: '⬇', msg: t('progression.decrease_struggling', { next }), why: t('progression.why_belowMin'), suggestedWeight: next, suggestedTime: null };
  }
  return { type: 'hold', icon: '→', msg: t('progression.decrease_hold', { assistStr }), why: whyHold(prog, v, 'progression.why_holdReps', {}, t), suggestedWeight: assistance || null, suggestedTime: null };
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
  const minReps   = exConfig?.minReps  ?? def?.minReps  ?? DEFAULT_TARGET.minReps;
  const maxReps   = exConfig?.maxReps  ?? def?.maxReps  ?? DEFAULT_TARGET.maxReps;
  const minTime   = exConfig?.minTime  ?? def?.minTime  ?? DEFAULT_TARGET.minTime;
  const maxTime   = exConfig?.maxTime  ?? def?.maxTime  ?? DEFAULT_TARGET.maxTime;
  const totalSets = exConfig?.sets     ?? def?.sets     ?? doneSets.length;

  // Descarga: la progresión se suspende ANTES de mirar el rendimiento. Da igual
  // lo bien que saliera la sesión — el bloque pide mantener. `reason` deja el
  // `type` intacto ('hold') para todo el que ya consuma el chip, y permite a la
  // tarjeta pintarlo distinto de un mantenimiento normal.
  if (prog.hold === 'deload') {
    const maxW = Math.max(0, ...doneSets.map((s) => parseFloat(s.weight) || 0));
    const weightStr = maxW > 0 ? t('progression.withWeight', { kg: maxW }) : t('progression.sameWeight');
    return {
      type: 'hold', reason: 'deload', icon: '→',
      msg: t('progression.deload_hold', { weightStr }), why: t('progression.why_deload'),
      suggestedWeight: maxW || null, suggestedTime: null,
    };
  }

  if (prog.type === 'effort') {
    return chipEffort(prog, doneSets, totalSets, minReps, t);
  }

  if (prog.type === 'time') {
    return chipTime(prog, doneSets, totalSets, minTime, maxTime, t);
  }

  if (prog.type === 'reps') {
    return chipReps(prog, doneSets, totalSets, minReps, t);
  }

  const maxW = Math.max(0, ...doneSets.map((s) => parseFloat(s.weight) || 0));
  // Lo guardado como `type: 'weight'` (reps fijas, sin rango en el motor) tenía
  // por meta el mínimo: leerlo con `maxReps` cambiaría cuándo sube (§4.1).
  const goal = exConfig?.progression?.type === 'weight' ? minReps : maxReps;

  if (prog.direction === 'decrease') {
    // `assist`: el número es la AYUDA; la tarjeta no puede decir «Subir a 17,5»
    // cuando lo que toca es quitar ayuda (QA P52).
    return { ...chipDoubleDecrease(prog, doneSets, totalSets, maxW, minReps, goal, t), assist: true };
  }
  return chipDouble(prog, doneSets, totalSets, maxW, minReps, goal, t);
}

// ── progressionRule ───────────────────────────────────────────────────────────

/**
 * La regla de la progresión en una frase (§5.2): la que enseña el editor bajo
 * «Progresión» y en su Resumen, y la ficha del Workout (P56). Lee la misma
 * config resuelta que el motor, así que no puede decir otra cosa.
 *
 * `unit`: la unidad de peso que se pinta (el editor pasa la del usuario).
 *
 * @param {object} exConfig  Template exercise config
 * @param {object} def       Library / custom exercise definition
 * @param {function} t       i18next translate function
 * @param {string} [unit]
 * @returns {string}
 */
export function progressionRule(exConfig, def, t, unit = 'kg') {
  const prog = resolveProgressionConfig(exConfig, def);
  if (prog.type === 'none') return t('progression.rule.none');

  const minReps = exConfig?.minReps ?? def?.minReps ?? DEFAULT_TARGET.minReps;
  const maxReps = exConfig?.maxReps ?? def?.maxReps ?? DEFAULT_TARGET.maxReps;
  const minTime = exConfig?.minTime ?? def?.minTime ?? DEFAULT_TARGET.minTime;
  const n       = exConfig?.sets ?? def?.sets ?? 3;

  if (prog.type === 'effort') {
    return t(prog.effortWhen === 'reach' && !prog.exact ? 'progression.rule.effortReach' : 'progression.rule.effortBeat',
      { reps: minReps, rpe: prog.targetRpe });
  }

  const ev   = prog.evaluation;
  const when = ev.mode === 'part'
    ? t('progression.rule.whenPart', { need: Math.min(Math.max(ev.need, 1), n), n })
    : ev.mode === 'rpe'
      ? t('progression.rule.whenRpe', { rpe: ev.maxRpe })
      : t('progression.rule.whenAll');

  const inc = prog.increment;
  if (prog.type === 'reps' || prog.type === 'time') {
    const timed = prog.type === 'time';
    const text  = inc.type === 'pct' ? `${inc.pct} %`
      : timed ? `${inc.value} s` : t('progression.rule.incReps', { count: inc.value });
    return t(timed ? 'progression.rule.timeUp' : 'progression.rule.repsUp',
      { inc: text, when, floor: timed ? minTime : minReps });
  }

  const goal = exConfig?.progression?.type === 'weight' ? minReps : maxReps;
  const text = inc.type === 'pct' ? `${inc.pct} %` : `${inc.value} ${unit}`;
  const assist = prog.direction === 'decrease';
  const head = t(assist ? 'progression.rule.assistUp' : 'progression.rule.weightUp', { inc: text, when, goal });
  if (prog.down === 'never') return head;
  const fails = Math.min(Math.max(prog.down?.fails ?? Math.floor(n * 0.4) + 1, 1), n);
  return head + t(assist ? 'progression.rule.assistDown' : 'progression.rule.weightDown', { fails, n });
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
