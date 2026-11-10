/**
 * Peso efectivo de una serie — puro. Salió de trainingLoad.js para que
 * sessionRecap.js pueda usarlo sin un ciclo de imports (T12 §5.3).
 */

// Equipo que aporta carga EXTERNA. Todo lo demás (barra de dominadas,
// paralelas, anillas, rueda, comba, máquinas de cardio…) es aparato de
// sujeción o no lleva peso: la carga es tu cuerpo. Los 4 con
// progressionDirection 'decrease' (asistidos) caen todos dentro.
// El trineo y el balón medicinal sí: lo que se apunta es su peso (T07).
const LOAD_BEARING_EQUIPMENT = new Set([
  'barbell', 'dumbbells', 'cables', 'machines', 'kettlebell', 'sled', 'medicine_ball',
]);

/**
 * ¿La carga de este ejercicio es el propio cuerpo?
 * Un `def` desconocido (ejercicio borrado) se trata como NO peso corporal: es
 * el default seguro — usa el peso registrado tal cual en vez de sumarle el
 * peso corporal a algo que quizá sea una barra.
 */
export function isBodyweight(def) {
  if (!def) return false;
  return !(def.equipment ?? []).some((e) => LOAD_BEARING_EQUIPMENT.has(e));
}

/**
 * Peso que realmente movió una serie, en kg. `null` = no computable.
 *
 * Tres casos:
 *   1. Equipo con carga  → el peso registrado.
 *   2. Peso corporal     → peso corporal + lastre.
 *   3. Asistido          → peso corporal − asistencia. En los ejercicios con
 *      `progressionDirection: 'decrease'` el campo `weight` es la AYUDA (goma),
 *      no la carga: sumarla invertiría el signo del progreso.
 */
export function effectiveWeight(set, def, bodyWeight) {
  const raw   = parseFloat(set?.weight);
  const added = isNaN(raw) ? 0 : raw;
  if (!isBodyweight(def)) return added > 0 ? added : null;
  if (bodyWeight == null || bodyWeight <= 0) return null;
  if (def?.progressionDirection === 'decrease') return Math.max(0, bodyWeight - added);
  return bodyWeight + added;
}
