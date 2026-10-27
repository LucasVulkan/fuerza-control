/**
 * El estado de la hoja de Progresión del editor de ejercicio
 * (docs/specs/P12-progresion-clara.md §5.3): lo que se ofrece en cada paso según lo
 * elegido antes, y cómo se guarda. Todo puro; la hoja solo pinta. P18 §7: «La
 * mayoría» sin elegir N, y cuándo baja sin número de fallos (P18 §3.3).
 *
 * Forma del estado (`f`), con los nombres internos del motor donde existen:
 *
 *   up        'weight' | 'reps' | 'time' | 'none'    Qué sube
 *   how       'rules' | 'effort'                     Cómo (solo Peso)
 *   when      'all_complete' | 'part' | 'rpe'        Todas · La mayoría · Todas con freno de RPE
 *   maxRpe    RPE máximo                             ('rpe')
 *   incType   'fixed' | 'pct', incValue, incPct      Cuánto sube
 *   down      'never' | 'fail'                       Cuándo baja
 *   targetRpe, effWhen 'beat' | 'reach'              Por esfuerzo
 *   step      escalón propio del ejercicio, o null (= el de la librería)
 *   exact     Por esfuerzo con el peso calculado sin redondear al escalón
 *
 * `ctx` = { def, sets, metric: 'reps' | 'time', range: boolean } — lo que viene
 * de Volumen: `range` es «Rango» frente a «Reps fijas».
 */
import { resolveProgressionConfig, defaultIncrement } from './progression';
import { isBodyweight } from './trainingLoad';

const isAssist = (def) => def?.progressionDirection === 'decrease';

/** El escalón que se resuelve sin el del ejercicio: el de la librería (en Por esfuerzo, con tope 2,5). */
export const libraryStep = (def, effort) =>
  resolveProgressionConfig({ progression: { type: effort ? 'effort' : 'double' } }, def).step;

// ── Qué se ofrece ─────────────────────────────────────────────────────────────

/**
 * Qué sube, en el orden de la hoja. Peso siempre con medida Reps: todo ejercicio
 * se puede lastrar, también los de peso corporal (QA P55.5); en un asistido es
 * «Asistencia ↓». Con medida Tiempo, Peso es una doble progresión en segundos
 * (P61).
 */
export function upOptions({ metric }) {
  if (metric === 'time') return ['time', 'weight', 'none'];
  return ['weight', 'reps', 'none'];
}

/** Cómo (Por reglas · Por esfuerzo): Peso en reps, con carga externa y sin asistir. */
export const showHow = (f, { def, metric }) =>
  metric === 'reps' && f.up === 'weight' && !isBodyweight(def) && !isAssist(def);

/** Por esfuerzo necesita reps fijas: con Rango sale apagado y se explica. */
export const effortBlocked = (ctx) => ctx.range;

export const isEffort = (f, ctx) => showHow(f, ctx) && f.how === 'effort';

/** Registrar RPE lo pide la progresión: Por esfuerzo, o Cuándo sube = RPE máx. */
export const needsRpe = (f, ctx) =>
  f.up !== 'none' && (isEffort(f, ctx) || f.when === 'rpe');

// ── Coherencia ────────────────────────────────────────────────────────────────

/** Si lo elegido deja de valer, vuelve al primero válido. */
export function normalizeProgForm(f, ctx) {
  const n = { ...f };
  const ups = upOptions(ctx);
  if (!ups.includes(n.up)) n.up = ups[0];
  if (n.how === 'effort' && !(showHow(n, ctx) && !effortBlocked(ctx))) n.how = 'rules';
  if (n.up !== 'weight') n.incType = 'fixed';
  // La mayoría de una sola serie es todas.
  if (n.when === 'part' && ctx.sets < 2) n.when = 'all_complete';
  return n;
}

/**
 * Aplica un cambio y vuelve a normalizar. Cada cosa que sube tiene su salto: al
 * cambiar Qué sube, el salto vuelve a su valor por defecto (P52).
 */
export function patchProgForm(prev, patch, ctx) {
  const next = normalizeProgForm({ ...prev, ...patch }, ctx);
  if (next.up !== prev.up) {
    next.incType  = 'fixed';
    next.incValue = defaultIncrement(next.up === 'weight' ? 'double' : next.up, ctx.def,
      next.step ?? libraryStep(ctx.def, false));
  }
  return next;
}

// ── Leer y guardar ────────────────────────────────────────────────────────────

/** El estado de la hoja a partir de lo guardado, ya normalizado. */
export function initProgForm(exConfig, def, ctx) {
  const p = resolveProgressionConfig(exConfig, def);
  const raw = {
    up:       p.type === 'none' ? 'none' : (p.type === 'reps' || p.type === 'time') ? p.type : 'weight',
    how:      p.type === 'effort' ? 'effort' : 'rules',
    when:     p.evaluation.mode,
    maxRpe:   p.evaluation.maxRpe,
    incType:  p.increment.type,
    incValue: p.increment.value,
    incPct:   p.increment.pct,
    down:     p.down === 'never' ? 'never' : 'fail',
    targetRpe: p.targetRpe,
    effWhen:  p.effortWhen,
    step:     exConfig?.weightStep > 0 ? exConfig.weightStep : null,
    exact:    p.exact,
  };
  return patchProgForm(raw, {}, ctx);
}

/**
 * Lo que el editor escribe en el ejercicio (§5.5): `progression`, `weightStep`
 * (solo si difiere del que se resuelve sin él) y `progressionModel`.
 */
export function buildProgression(f, ctx) {
  const effort = isEffort(f, ctx);
  const type = f.up === 'weight' ? (effort ? 'effort' : 'double') : f.up;
  const progression = {
    type,
    // Sin `need`: «La mayoría» la calcula el motor con las series de cada momento.
    evaluation: { mode: f.when, maxRpe: f.maxRpe },
    increment:  { type: f.incType, value: f.incValue, pct: f.incPct },
  };
  if (type === 'double' && f.down === 'never') progression.down = 'never';
  if (effort) {
    progression.targetRpe  = f.targetRpe;
    // Sin escalón (Exacto) no hay «Al llegar» que valga.
    progression.effortWhen = f.exact ? 'beat' : f.effWhen;
  }

  let weightStep = null;
  if (effort && f.exact) weightStep = 'exact';
  else if (f.step != null && f.step !== libraryStep(ctx.def, effort)) weightStep = f.step;

  return {
    progression,
    weightStep,
    // 'none' sigue en double_progression: así el rango objetivo se pinta en el
    // Workout; lo que la hace fija es progression.type.
    progressionModel: type === 'time' ? 'time_progression' : 'double_progression',
  };
}
