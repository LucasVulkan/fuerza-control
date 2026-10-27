/**
 * setPlan — el gris de cada serie: lo que el Workout sugiere en una casilla
 * vacía y lo que un ✓ sin escribir guarda.
 *
 * Spec: `docs/specs/P18-motor-progresion.md` §5 (deshace P12 §6.1, «el gris es
 * el plan»): el gris es SIEMPRE lo que hiciste en esa serie la última vez; la
 * meta la dice la línea de progresión. El objetivo del entrenador sigue ganando.
 *
 * Antes se decidía en dos sitios que se copiaban a mano (la tarjeta y el
 * guardado); si divergían, lo que se veía en gris no era lo que se guardaba.
 * Esta función pura es la única fuente. No convierte unidades: los pesos salen
 * en kg, como strings; pasarlos a lo que el usuario ve es cosa de la pantalla.
 */

const has = (v) => v != null && v !== '';

/** El primero que tenga valor: entrenador → última vez → nada. */
function ref(coach, last) {
  if (has(coach)) return { value: String(coach), source: 'coach' };
  if (has(last))  return { value: String(last),  source: 'last' };
  return { value: '', source: 'none' };
}

/**
 * @param {object} p
 * @param {array}  p.lastSets    series de la última sesión
 * @param {object} p.overrideEx  objetivo del entrenador para este ejercicio
 * @param {number} p.index       índice de la serie
 * @returns {{ weight: Ref, reps: Ref, time: Ref, rpe: Ref }}  Ref = { value, source }
 *   source: 'coach' (azul) · 'last' (gris) · 'none'
 */
export function planSet({ lastSets, overrideEx, index }) {
  const last = lastSets?.[index];
  return {
    weight: ref(overrideEx?.weight, last?.weight),
    reps:   ref(overrideEx?.reps,   last?.reps),
    time:   ref(overrideEx?.time,   last?.time),
    rpe:    ref(overrideEx?.rpe),
  };
}
