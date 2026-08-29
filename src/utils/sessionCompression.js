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
const EXERCISE_OVERHEAD_SEC = 120;
// Calentamiento general, una vez por sesión (si la sesión no está vacía).
// Revisar cuando exista la feature warmup-sets (mobile/docs/specs/warmup-sets.md)
// para no contar el calentamiento dos veces.
const SESSION_OVERHEAD_SEC = 480;

/**
 * Por debajo de esta duración pedida, la sesión se estima **sin calentamiento
 * general**: en 30 o 45 minutos no se calienta ocho minutos, se entra a
 * trabajar. Las transiciones entre ejercicios sí se cuentan siempre — cambiar
 * las mancuernas cuesta lo que cuesta, lo hagas en casa o en el gimnasio.
 *
 * Por qué no se quitan también las transiciones por debajo del umbral, que era
 * la propuesta original: invierte el orden de los presupuestos. Sin ellas, 45
 * min darían 45 de trabajo y 60 min darían 60 − 8 − 2n ≈ 42 con cinco
 * ejercicios — pedir más tiempo entregaría menos entrenamiento. Quitando sólo el
 * calentamiento, 45 → 45 − 2n y 60 → 52 − 2n: siempre creciente, sea cual sea n.
 */
export const NO_WARMUP_BELOW_MIN = 60;

/**
 * Margen sobre el presupuesto antes de empezar a recortar.
 *
 * El presupuesto es una **estimación** construida sobre overheads inventados
 * (2 min de transición por ejercicio, 8 de calentamiento), no un cronómetro.
 * Tratarlo como límite exacto hacía que una sesión de 60 min y 20 segundos
 * perdiera un ejercicio, mientras que una de 59:59 pasaba entera. Eso no es
 * precisión: es ruido con consecuencias.
 *
 * El 15% da +9 min sobre un presupuesto de 60 —lo que un usuario entiende por
 * "una hora"— y escala bien en los extremos: 34 min para quien pidió 30, 103
 * para quien pidió 90. Un porcentaje y no minutos fijos porque +10 sobre 30 es
 * un tercio más de sesión, y ahí sí importa.
 *
 * Por debajo del presupuesto no hay nada que hacer: si la sesión sale corta, se
 * enseña corta. La tolerancia sólo actúa por arriba.
 */
export const TIME_TOLERANCE = 0.15;

/** Segundos a partir de los cuales una sesión se considera que no cabe. */
export function budgetSecFor(sessionMinutes) {
  return sessionMinutes * 60 * (1 + TIME_TOLERANCE);
}

/**
 * Segundos estimados de una sesión. Fórmula espejo de `sessionStats`
 * (`mobile/src/utils/sessionStats.js`): sets × (35s trabajo + descanso); en
 * ejercicios de tiempo el "trabajo" es el punto medio de minTime–maxTime.
 * No se importa la de mobile: rompería la frontera src↔mobile.
 */
export function estimateSessionSec(exercises, allExercises = EXERCISE_LIBRARY, { includeWarmup = true } = {}) {
  let seconds = 0;
  for (const ex of exercises) {
    const def = allExercises[ex.exerciseId];
    const n = ex.sets ?? 0;
    const isTimed = def?.progressionModel === 'time_progression' || def?.progressionModel === 'submax';
    const work = isTimed ? ((def?.minTime ?? 20) + (def?.maxTime ?? 40)) / 2 : 35;
    // Superserie: los eslabones no finales comparten el descanso del último, así
    // que no cuentan el suyo (misma regla que `sessionStats`). Nada genera
    // superseries todavía, pero una plantilla puede declararlas y el editor las
    // crea a mano: sin esto el presupuesto no vería el ahorro.
    const rest = ex.supersetWithNext ? 0 : (ex.restSec ?? 90);
    seconds += n * (work + rest) + EXERCISE_OVERHEAD_SEC;
  }
  if (includeWarmup && exercises.length > 0) seconds += SESSION_OVERHEAD_SEC;
  return seconds;
}

/** ¿Esta duración pedida cuenta el calentamiento general? */
export function includesWarmup(sessionMinutes) {
  return !sessionMinutes || sessionMinutes >= NO_WARMUP_BELOW_MIN;
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
//
// Bajó de 2 a 1 en ago-2026. Con 2, una sesión que nacía con sólo dos accesorios
// —Full Body · 2 días son cuatro principales y dos accesorios— no podía soltar
// NINGÚN ejercicio por mucho que se apretara el presupuesto: se quedaba en seis
// ejercicios a 30 minutos y sólo le quedaba recortar series. Lo que protege de
// verdad la sesión es que tier 1 no se toca (`canRemove`), no el segundo
// accesorio.
const MIN_ACCESSORIES = 1;   // 1 principal + 1 accesorio es el mínimo de sesión
export const MIN_SETS_ACCESSORY = 2;
const MIN_SETS_TIER1 = 3;

/**
 * Cuántos accesorios pueden quedarse en el suelo de series antes de que
 * convenga eliminar uno.
 *
 * Media sesión a dos series es volumen repartido demasiado fino: cada ejercicio
 * cuesta su montaje y su transición igual, y a cambio deja un estímulo que casi
 * no cuenta. Al tercero sale mejor quitar uno y que los demás conserven sus
 * series.
 *
 * No puede bloquearse: si va a haber un tercero en el suelo es que hay al menos
 * tres accesorios, y el suelo de sesión (1 principal + 1 accesorio) permite
 * quitar uno de sobra.
 */
export const MAX_ACCESSORIES_AT_FLOOR = 2;

/** Accesorios de la sesión que ya están en su suelo de series. */
export function accessoriesAtFloor(exercises) {
  return exercises.filter((ex) => isAccessory(ex) && (ex.sets ?? 0) <= MIN_SETS_ACCESSORY).length;
}

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

/**
 * −1 serie al ejercicio del tier dado con más series, si supera su suelo.
 *
 * Se niega a crear un accesorio de más en el suelo cuando ya hay
 * `MAX_ACCESSORIES_AT_FLOOR`: devolver `null` hace que la escalera pase al
 * siguiente peldaño, que es el de eliminar. Es la regla "antes de dejar un
 * tercero a dos series, quita uno".
 */
function reduceSets(exercises, tier, floor) {
  let best = -1;
  exercises.forEach((ex, i) => {
    if (tierOfExercise(ex) !== tier) return;
    if ((ex.sets ?? 0) <= floor) return;
    if (best === -1 || ex.sets > exercises[best].sets) best = i;
  });
  if (best === -1) return null;

  const dejaOtroEnElSuelo = tier !== 1 && exercises[best].sets - 1 <= MIN_SETS_ACCESSORY;
  if (dejaOtroEnElSuelo && accessoriesAtFloor(exercises) >= MAX_ACCESSORIES_AT_FLOOR) return null;

  return exercises.map((ex, i) => (i === best ? { ...ex, sets: ex.sets - 1 } : ex));
}

/**
 * El último del tier dado cuyo grupo ya cubre otro ejercicio de la sesión.
 *
 * Un grupo con énfasis declarado (`volumeEmphasis`) NO es redundante por mucho
 * que se repita: en un programa de glúteo, el tercer ejercicio de glúteo es el
 * programa. El énfasis es de la plantilla, no del objetivo — `goal` describe
 * cómo se entrena (rango de reps), no qué se prioriza.
 */
function removeRedundant(exercises, tier, allExercises, emphasis) {
  const groupOf = (ex) => allExercises[ex.exerciseId]?.primaryGroup;
  const counts = {};
  exercises.forEach((ex) => {
    const g = groupOf(ex);
    if (g) counts[g] = (counts[g] ?? 0) + 1;
  });
  const i = findLastIndex(exercises, (ex, idx) => {
    const g = groupOf(ex);
    return tierOfExercise(ex) === tier && g && counts[g] > 1
      && !emphasis.includes(g) && canRemove(exercises, idx);
  });
  return i === -1 ? null : removeAt(exercises, i);
}

/** El último del tier dado; los grupos con énfasis se sacrifican los últimos. */
function removeLastOfTier(exercises, tier, allExercises, emphasis) {
  const groupOf = (ex) => allExercises[ex.exerciseId]?.primaryGroup;
  const removable = (ex, idx) => tierOfExercise(ex) === tier && canRemove(exercises, idx);

  const i = findLastIndex(exercises, (ex, idx) => removable(ex, idx) && !emphasis.includes(groupOf(ex)));
  if (i !== -1) return removeAt(exercises, i);

  const fallback = findLastIndex(exercises, removable);
  return fallback === -1 ? null : removeAt(exercises, fallback);
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

/**
 * Patrones antagonistas. Emparejar en superserie dos ejercicios del MISMO grupo
 * no es una superserie, es fatiga acumulada sobre el mismo músculo: los dos
 * salen peor. Los que no aparecen aquí (core, gemelo, agarre) no se emparejan.
 */
const OPPOSITE_PATTERNS = {
  horizontal_push: ['horizontal_pull', 'vertical_pull'],
  vertical_push:   ['vertical_pull', 'horizontal_pull'],
  horizontal_pull: ['horizontal_push', 'vertical_push'],
  vertical_pull:   ['vertical_push', 'horizontal_push'],
  squat:           ['hip_hinge'],
  hip_hinge:       ['squat'],
};

/**
 * Encadena dos accesorios contiguos y opuestos en superserie: el primero deja
 * de contar su descanso (lo comparte con el segundo), así que la sesión se
 * acorta **conservando los dos ejercicios**. Es el único peldaño que gana
 * tiempo sin quitar nada, por eso va el primero.
 *
 * Sólo pares contiguos: `supersetWithNext` significa "encadenado con el
 * siguiente", así que reordenar para emparejar cambiaría el orden que escribió
 * quien diseñó la sesión. En las plantillas reales los accesorios contiguos ya
 * suelen ser opuestos (remo + apertura, apertura + curl).
 *
 * Nunca encadena más de dos: si el anterior ya está marcado, este no se toca.
 */
function supersetOpposites(exercises, allExercises) {
  const patternOf = (ex) => allExercises[ex.exerciseId]?.pattern;

  for (let i = 0; i < exercises.length - 1; i++) {
    const a = exercises[i];
    const b = exercises[i + 1];
    if (tierOfExercise(a) !== 3 || tierOfExercise(b) !== 3) continue;
    if (a.supersetWithNext || exercises[i - 1]?.supersetWithNext) continue;
    if (!(OPPOSITE_PATTERNS[patternOf(a)] ?? []).includes(patternOf(b))) continue;

    return exercises.map((ex, idx) => (idx === i ? { ...ex, supersetWithNext: true } : ex));
  }
  return null;
}

/**
 * La misma escalera, pero borrando antes de bajar series.
 *
 * En una sesión corta el montaje domina: un ejercicio a 2 series cuesta 180 s de
 * transición para 190 s de trabajo. Quitarlo ahorra los 370 s enteros; bajarle
 * una serie ahorra 95. Cuando el presupuesto aprieta, media docena de ejercicios
 * a dos series es tiempo perdido preparando material — mejor menos ejercicios
 * con sus series completas.
 *
 * Se deriva del orden de cada disciplina en vez de escribir una segunda tabla:
 * los peldaños que quitan van delante, los que recortan detrás, y cada grupo
 * conserva su orden relativo. Para `strength`, que ya borra primero, no cambia
 * nada.
 */
function removalFirst(order) {
  const isRemoval = (step) => step.endsWith('Redundant') || step.endsWith('Remove');
  return [...order.filter(isRemoval), ...order.filter((s) => !isRemoval(s))];
}

const STEPS = {
  superset:    (ex, all)      => supersetOpposites(ex, all),
  t3Redundant: (ex, all, emph) => removeRedundant(ex, 3, all, emph),
  t3Sets:      (ex)            => reduceSets(ex, 3, MIN_SETS_ACCESSORY),
  t3Remove:    (ex, all, emph) => removeLastOfTier(ex, 3, all, emph),
  t2Sets:      (ex)            => reduceSets(ex, 2, MIN_SETS_ACCESSORY),
  t2Remove:    (ex, all)       => removeCoveredByTier1(ex, all),
  t1Sets:      (ex)            => reduceSets(ex, 1, MIN_SETS_TIER1),
};

/**
 * Comprime una sesión hasta que quepa en el presupuesto.
 *
 * @returns {{ exercises: object[], overTime: boolean }} `overTime` = se agotaron
 *          los peldaños y la sesión sigue pasándose. No se fuerza: se enseña.
 */
export function compressSession(exercises, {
  sessionMinutes,
  discipline = 'standard',
  volumeEmphasis = [],
  allExercises = EXERCISE_LIBRARY,
} = {}) {
  if (!sessionMinutes) return { exercises, overTime: false };

  const budgetSec = budgetSecFor(sessionMinutes);
  const includeWarmup = includesWarmup(sessionMinutes);
  // La superserie sólo entra en sesiones cortas: con 90 minutos por delante no
  // hay razón para comprometer el descanso de nada. Y va la primera porque es el
  // único peldaño que gana tiempo sin quitar ejercicios.
  const order = includeWarmup
    ? disciplineRules(discipline).compression
    : ['superset', ...removalFirst(disciplineRules(discipline).compression)];
  let result = exercises;

  while (estimateSessionSec(result, allExercises, { includeWarmup }) > budgetSec) {
    let next = null;
    for (const stepName of order) {
      next = STEPS[stepName](result, allExercises, volumeEmphasis);
      if (next) break;
    }
    if (!next) return { exercises: result, overTime: true };
    result = next;
  }

  return { exercises: result, overTime: false };
}
