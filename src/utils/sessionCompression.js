/**
 * Compresión de sesión por presupuesto de tiempo — spec
 * `mobile/docs/specs/program-templates.md` §5.3 y §5.6.
 *
 * Lo que sustituye: `trimToTimeBudget` saltaba de "el ejercicio está" a "el
 * ejercicio no está" sin pasar por "el ejercicio está con dos series". Aquí la
 * escalera baja series antes de borrar nada, y el orden de los peldaños lo
 * decide la disciplina: hipertrofia reparte el recorte para conservar volumen,
 * fuerza tira los accesorios enteros antes de tocar una serie de los básicos.
 *
 * **Tier 1 nunca se elimina.** Si se agotan los peldaños y sigue sin caber, se
 * para y se devuelve `overTime: true`: el preview enseña la duración real.
 * Mentir sobre el tiempo es peor que pasarse de él.
 *
 * El `tier` se lee del exConfig si está (lo pone `adaptArchetype`, y no sale de
 * ahí: al `sessionTemplate` va sin él) y si no se deriva de `isKey` — el camino
 * procedural no tiene tier 2.
 *
 * Este módulo unifica a propósito la estimación de tiempo que `programGenerator`
 * y `archetypeAdapter` duplicaban de forma deliberada. La duplicación se
 * mantenía porque la fórmula era de tres líneas; con una escalera de seis
 * peldaños y una tabla por disciplina, dos copias divergen seguro.
 */

import { EXERCISE_LIBRARY } from '../data/exerciseLibrary';

// Transición/montaje por ejercicio: buscar máquina, montar peso, ajustar.
const EXERCISE_OVERHEAD_SEC = 180;
// Calentamiento general, una vez por sesión (si la sesión no está vacía).
// Revisar cuando exista la feature warmup-sets (mobile/docs/specs/warmup-sets.md)
// para no contar el calentamiento dos veces.
const SESSION_OVERHEAD_SEC = 480;

/**
 * Segundos estimados de una sesión. Fórmula espejo de `sessionStats`
 * (`mobile/src/utils/sessionStats.js`): sets × (35s trabajo + descanso); en
 * ejercicios de tiempo el "trabajo" es el punto medio de minTime–maxTime.
 * No se importa la de mobile: rompería la frontera src↔mobile.
 */
export function estimateSessionSec(exercises, allExercises = EXERCISE_LIBRARY) {
  let seconds = 0;
  for (const ex of exercises) {
    const def = allExercises[ex.exerciseId];
    const n = ex.sets ?? 0;
    const isTimed = def?.progressionModel === 'time_progression' || def?.progressionModel === 'submax';
    const work = isTimed ? ((def?.minTime ?? 20) + (def?.maxTime ?? 40)) / 2 : 35;
    seconds += n * (work + (ex.restSec ?? 90)) + EXERCISE_OVERHEAD_SEC;
  }
  if (exercises.length > 0) seconds += SESSION_OVERHEAD_SEC;
  return seconds;
}

/**
 * Carácter de cada disciplina: en qué orden se sacrifica, y cuánto volumen
 * tolera respecto a la banda del nivel.
 *
 * `compression` es una permutación de los mismos peldaños — por eso hay una
 * tabla y no tres motores. `t1Sets` ausente = las series de los principales no
 * se recortan por tiempo en esa disciplina.
 *
 * `volumeBandScale` lo consume el normalizador de volumen (fase 3): vive aquí
 * porque es la misma decisión de carácter y partirla en dos tablas invita a que
 * se contradigan.
 */
export const DISCIPLINE_RULES = {
  // Hipertrofia: el volumen semanal ES el estímulo. Antes de borrar un
  // ejercicio se le quitan series a todo lo que se pueda.
  standard:     { compression: ['t3Redundant', 't3Sets', 't3Remove', 't2Sets', 't2Remove', 't1Sets'], volumeBandScale: 1.0 },
  glutes_legs:  { compression: ['t3Redundant', 't3Sets', 't3Remove', 't2Sets', 't2Remove', 't1Sets'], volumeBandScale: 1.0 },

  // Fuerza: manda la especificidad. Los accesorios se van enteros antes de
  // tocar una serie de los levantamientos, y `t1Sets` no está: no se recortan.
  strength:     { compression: ['t3Redundant', 't3Remove', 't2Remove', 't3Sets', 't2Sets'],           volumeBandScale: 0.8 },

  // Calistenia: la skill es tier 1 y por tanto intocable. Con 30 minutos el
  // muscle-up sigue estando; lo que desaparece es el trabajo complementario.
  calisthenics: { compression: ['t3Redundant', 't3Sets', 't3Remove', 't2Sets', 't2Remove'],           volumeBandScale: 0.9 },
};

export function disciplineRules(discipline) {
  return DISCIPLINE_RULES[discipline] ?? DISCIPLINE_RULES.standard;
}

// Suelos duros. Ninguna combinación de peldaños puede bajar de aquí.
const MIN_ACCESSORIES = 2;   // 1 principal + 2 accesorios es el mínimo de sesión
const MIN_SETS_ACCESSORY = 2;
const MIN_SETS_TIER1 = 3;

export function tierOfExercise(ex) {
  return ex.tier ?? (ex.isKey ? 1 : 3);
}

const isAccessory = (ex) => tierOfExercise(ex) !== 1;

/** Último ejercicio (de atrás hacia delante) que cumpla el predicado. */
function findLastIndex(exercises, fn) {
  for (let i = exercises.length - 1; i >= 0; i--) if (fn(exercises[i], i)) return i;
  return -1;
}

function removeAt(exercises, i) {
  return exercises.filter((_, idx) => idx !== i);
}

/** Quitar sólo si quedan accesorios suficientes. Tier 1 jamás. */
function canRemove(exercises, i) {
  return tierOfExercise(exercises[i]) !== 1
    && exercises.filter(isAccessory).length > MIN_ACCESSORIES;
}

/** −1 serie al ejercicio del tier dado con más series, si supera su suelo. */
function reduceSets(exercises, tier, floor) {
  let best = -1;
  exercises.forEach((ex, i) => {
    if (tierOfExercise(ex) !== tier) return;
    if ((ex.sets ?? 0) <= floor) return;
    if (best === -1 || ex.sets > exercises[best].sets) best = i;
  });
  if (best === -1) return null;
  return exercises.map((ex, i) => (i === best ? { ...ex, sets: ex.sets - 1 } : ex));
}

/** El último del tier dado cuyo grupo ya cubre otro ejercicio de la sesión. */
function removeRedundant(exercises, tier, allExercises) {
  const groupOf = (ex) => allExercises[ex.exerciseId]?.primaryGroup;
  const counts = {};
  exercises.forEach((ex) => {
    const g = groupOf(ex);
    if (g) counts[g] = (counts[g] ?? 0) + 1;
  });
  const i = findLastIndex(exercises, (ex, idx) => {
    const g = groupOf(ex);
    return tierOfExercise(ex) === tier && g && counts[g] > 1 && canRemove(exercises, idx);
  });
  return i === -1 ? null : removeAt(exercises, i);
}

function removeLastOfTier(exercises, tier) {
  const i = findLastIndex(exercises, (ex, idx) => tierOfExercise(ex) === tier && canRemove(exercises, idx));
  return i === -1 ? null : removeAt(exercises, i);
}

/** Un tier 2 cuyo patrón ya trabaja un tier 1 de la misma sesión es prescindible. */
function removeCoveredByTier1(exercises, allExercises) {
  const patternOf = (ex) => allExercises[ex.exerciseId]?.pattern;
  const tier1Patterns = new Set(
    exercises.filter((ex) => tierOfExercise(ex) === 1).map(patternOf).filter(Boolean),
  );
  const i = findLastIndex(exercises, (ex, idx) =>
    tierOfExercise(ex) === 2 && tier1Patterns.has(patternOf(ex)) && canRemove(exercises, idx));
  return i === -1 ? null : removeAt(exercises, i);
}

const STEPS = {
  t3Redundant: (ex, all) => removeRedundant(ex, 3, all),
  t3Sets:      (ex)      => reduceSets(ex, 3, MIN_SETS_ACCESSORY),
  t3Remove:    (ex)      => removeLastOfTier(ex, 3),
  t2Sets:      (ex)      => reduceSets(ex, 2, MIN_SETS_ACCESSORY),
  t2Remove:    (ex, all) => removeCoveredByTier1(ex, all),
  t1Sets:      (ex)      => reduceSets(ex, 1, MIN_SETS_TIER1),
};

/**
 * Comprime una sesión hasta que quepa en el presupuesto.
 *
 * @returns {{ exercises: object[], overTime: boolean }} `overTime` = se agotaron
 *          los peldaños y la sesión sigue pasándose. No se fuerza: se enseña.
 */
export function compressSession(exercises, { sessionMinutes, discipline = 'standard', allExercises = EXERCISE_LIBRARY } = {}) {
  if (!sessionMinutes) return { exercises, overTime: false };

  const budgetSec = sessionMinutes * 60;
  const order = disciplineRules(discipline).compression;
  let result = exercises;

  while (estimateSessionSec(result, allExercises) > budgetSec) {
    let next = null;
    for (const stepName of order) {
      next = STEPS[stepName](result, allExercises);
      if (next) break;
    }
    if (!next) return { exercises: result, overTime: true };
    result = next;
  }

  return { exercises: result, overTime: false };
}
