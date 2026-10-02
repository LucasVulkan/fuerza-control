/**
 * setPlan — el gris de cada serie: lo que el Workout sugiere en una casilla
 * vacía y lo que un ✓ sin escribir guarda.
 *
 * Spec: `docs/specs/progresion-clara.md` §4.5.
 *
 * Antes se decidía en dos sitios que se copiaban a mano (la tarjeta y el
 * guardado); si divergían, lo que se veía en gris no era lo que se guardaba.
 * Esta función pura es la única fuente. No convierte unidades: los pesos salen
 * en kg, como strings; pasarlos a lo que el usuario ve es cosa de la pantalla.
 */

import { DEFAULT_TARGET } from './progression';

const has = (v) => v != null && v !== '';

/** El primero que tenga valor: entrenador → plan → última vez → nada. */
function ref(coach, plan, last) {
  if (has(coach)) return { value: String(coach), source: 'coach' };
  if (has(plan))  return { value: String(plan),  source: 'plan' };
  if (has(last))  return { value: String(last),  source: 'last' };
  return { value: '', source: 'none' };
}

/**
 * @param {object} p
 * @param {object} p.exConfig    config del ejercicio en la plantilla
 * @param {object} p.def         ejercicio de la librería (rango por defecto)
 * @param {object|null} p.chip   `getProgression(...)` de la última sesión
 * @param {array}  p.lastSets    series de la última sesión
 * @param {object} p.overrideEx  objetivo del entrenador para este ejercicio
 * @param {number} p.index       índice de la serie
 * @returns {{ weight: Ref, reps: Ref, time: Ref, rpe: Ref }}  Ref = { value, source }
 *   source: 'coach' (azul) · 'plan' y 'last' (gris) · 'none'
 */
export function planSet({ exConfig, def, chip, lastSets, overrideEx, index }) {
  const minReps = exConfig?.minReps ?? def?.minReps ?? DEFAULT_TARGET.minReps;
  const maxReps = exConfig?.maxReps ?? def?.maxReps ?? DEFAULT_TARGET.maxReps;

  const plan = {};
  if (chip?.effort) {
    plan.weight = chip.suggestedWeight;
    plan.reps   = minReps;
  } else if (chip?.suggestedWeight != null && chip.type !== 'hold') {
    // La meta de la progresión: las reps fijas, o el máximo del rango.
    plan.weight = chip.suggestedWeight;
    plan.reps   = maxReps;
  }
  // En mantener el gris es lo que hiciste (decisión 4), no el inicio: solo
  // sube con 'up'.
  if (plan.reps == null && chip?.suggestedReps != null && chip.type === 'up') plan.reps = chip.suggestedReps;
  if (chip?.suggestedTime != null && chip.type === 'up') plan.time = chip.suggestedTime;

  const last = lastSets?.[index];
  return {
    weight: ref(overrideEx?.weight, plan.weight, last?.weight),
    reps:   ref(overrideEx?.reps,   plan.reps,   last?.reps),
    time:   ref(overrideEx?.time,   plan.time,   last?.time),
    rpe:    ref(overrideEx?.rpe),
  };
}
