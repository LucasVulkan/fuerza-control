/**
 * targetLabel — la prescripción de un ejercicio en una línea: «4 × 5 reps».
 *
 * Vivía dentro de `workout/ExerciseCard.jsx` como `buildTarget`, que era el
 * único sitio que la pintaba. La Home la necesita ahora para la lista de
 * ejercicios de la sesión desplegada (docs/specs/home-sesiones-plegables.md
 * §4.3), así que sale aquí entera — con todas sus ramas, que no son pocas:
 * submáximo, reps, tiempo, rango min–max y unilateral, más el fallback a los
 * valores del ejercicio de la librería cuando la sesión no los fija.
 *
 * `compact` es lo único nuevo: la misma frase sin las palabras que en una lista
 * apretada se dan por supuestas («reps», «por lado») y sin los espacios del
 * `×`. Es texto para leer de un vistazo, no una ficha.
 *
 *   targetLabel(def, ex, t)                    → "4 × 5 reps"
 *   targetLabel(def, ex, t, { compact: true }) → "4×5"
 */
export function targetLabel(def, exConfig, t, { compact = false } = {}) {
  if (!def) return '';
  const inputType  = exConfig.inputType ?? (def.progressionModel === 'time_progression' ? 'time' : 'weight_reps');
  // La sesión manda sobre la librería: un ejercicio que en la librería es
  // submáx (flexiones, burpees…) y en la sesión se pasó a doble progresión se
  // tiene que leer como doble. Leer solo `def` lo dejaba en «submáx» siempre.
  const model      = exConfig.progressionModel ?? def.progressionModel;
  const sets       = exConfig.sets ?? 0;
  const minReps    = exConfig.minReps ?? def.minReps;
  const maxReps    = exConfig.maxReps ?? def.maxReps;
  const minTime    = exConfig.minTime ?? def.minTime;
  const maxTime    = exConfig.maxTime ?? def.maxTime;
  // En compacto el «por lado» se cae: la fila no da para el matiz, y el nombre
  // del ejercicio ya suele decirlo.
  const unilateral = (!compact && (exConfig.isUnilateral ?? def.isUnilateral))
    ? ` ${t('workout.perSide', 'por lado')}`
    : '';
  const x = compact ? '×' : ' × ';

  const submax = `${sets}${x}${t('workout.submax', 'submáx')}`;
  if (model === 'submax') return submax;

  // Sin objetivo en la sesión ni en la librería no hay rango que pintar: sin
  // esto salía «3 × null–null». Es lo que significa submáx — series sin meta.
  if (inputType === 'time' || inputType === 'weight_time') {
    if (minTime == null && maxTime == null) return submax;
    return `${sets}${x}${minTime ?? maxTime}–${maxTime ?? minTime} s${unilateral}`;
  }

  // reps y weight_reps (por defecto)
  if (minReps == null && maxReps == null) return submax;
  const lo = minReps ?? maxReps;
  const hi = maxReps ?? minReps;
  const r = lo === hi ? `${lo}` : `${lo}–${hi}`;
  return compact ? `${sets}${x}${r}` : `${sets}${x}${r} reps${unilateral}`;
}

/**
 * El nombre del ejercicio en el idioma de la app, cayendo al id cuando el
 * ejercicio ya no está en la librería (un backup viejo, un personalizado
 * borrado).
 *
 * El idioma va por parámetro y no por hook para que esto siga siendo una
 * función pura: la llama tanto una pantalla como un `map` dentro de un `useMemo`.
 */
export function exerciseName(def, language, fallbackId) {
  if (!def) return fallbackId;
  return language?.startsWith('en') ? (def.nameEn ?? def.name) : def.name;
}
