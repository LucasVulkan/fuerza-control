/**
 * targetLabel — la prescripción de un ejercicio en una línea: «4 × 5 reps».
 *
 * Vivía dentro de `workout/ExerciseCard.jsx` como `buildTarget`, que era el
 * único sitio que la pintaba. La Home la necesita ahora para la lista de
 * ejercicios de la sesión desplegada (docs/specs/home-sesiones-plegables.md
 * §4.3), así que sale aquí entera — con todas sus ramas, que no son pocas:
 * reps, tiempo, rango min–max y unilateral, más el fallback a los
 * valores del ejercicio de la librería cuando la sesión no los fija.
 *
 * `compact` es lo único nuevo: la misma frase sin las palabras que en una lista
 * apretada se dan por supuestas («reps», «por lado») y sin los espacios del
 * `×`. Es texto para leer de un vistazo, no una ficha.
 *
 *   targetLabel(def, ex, t)                    → "4 × 5 reps"
 *   targetLabel(def, ex, t, { compact: true }) → "4×5"
 *
 * Con progresión Reps o Tiempo Qué pides guarda solo el inicio (progresion-clara
 * §4.4), no un rango: sin `today` se pinta con un «+» («3 × 8+ reps», «3 × 30+ s»,
 * «sube desde ahí»). `today` es la meta de hoy cuando hay historial a mano
 * (`{ reps }` o `{ time }`, la del chip): «3 × 9 reps». Los demás tipos no
 * cambian.
 */
import { DEFAULT_TARGET, resolveProgressionConfig } from './progression';
import { isBodyweight } from './trainingLoad';

/**
 * «RPE 8 (2 en recámara)»: el RPE es lo que el cliente apunta en su columna y
 * la recámara lo que se entiende; juntos le enseñan la equivalencia
 * (effort-progression.md §5.1).
 */
export function effortLabel(rpe, t) {
  const rir = 10 - rpe;
  return rir === 0 ? t('workout.effortFailure') : t('workout.effortTarget', { rpe, count: rir });
}

export function targetLabel(def, exConfig, t, { compact = false, today = null } = {}) {
  if (!def) return '';
  const inputType  = exConfig.inputType ?? def.inputType ?? (def.progressionModel === 'time_progression' ? 'time' : 'weight_reps');
  const sets       = exConfig.sets ?? 0;
  // Lo que falta sale del mismo sitio que en el editor y el motor: si no, el
  // editor enseña «8–12» y aquí no hay nada que pintar.
  const minReps    = exConfig.minReps ?? def.minReps ?? DEFAULT_TARGET.minReps;
  const maxReps    = exConfig.maxReps ?? def.maxReps ?? DEFAULT_TARGET.maxReps;
  const minTime    = exConfig.minTime ?? def.minTime ?? DEFAULT_TARGET.minTime;
  const maxTime    = exConfig.maxTime ?? def.maxTime ?? DEFAULT_TARGET.maxTime;
  // En compacto el «por lado» se cae: la fila no da para el matiz, y el nombre
  // del ejercicio ya suele decirlo.
  const unilateral = (!compact && def.isUnilateral)
    ? ` ${t('workout.perSide', 'por lado')}`
    : '';
  const x = compact ? '×' : ' × ';

  const prog = resolveProgressionConfig(exConfig, def);

  if (inputType === 'time' || inputType === 'weight_time') {
    if (prog.type === 'time') return `${sets}${x}${today?.time ?? `${minTime}+`} s${unilateral}`;
    return `${sets}${x}${minTime}–${maxTime} s${unilateral}`;
  }

  // Por esfuerzo: reps objetivo (min = max) y el RPE.
  if (prog.type === 'effort') {
    return compact
      ? `${sets}${x}${minReps} @RPE${prog.targetRpe}`
      : `${sets}${x}${minReps} reps${unilateral} · ${effortLabel(prog.targetRpe, t)}`;
  }

  // reps y weight_reps (por defecto)
  if (prog.type === 'reps') {
    const v = today?.reps ?? `${minReps}+`;
    return compact ? `${sets}${x}${v}` : `${sets}${x}${v} reps${unilateral}`;
  }
  const r = minReps === maxReps ? `${minReps}` : `${minReps}–${maxReps}`;
  return compact ? `${sets}${x}${r}` : `${sets}${x}${r} reps${unilateral}`;
}

/**
 * La fila «Primera vez» del Workout (P56 §6.3): sin historial no hay chip, así
 * que se lee la progresión de la config. Devuelve qué buscar y la prescripción
 * sin las series, como en la cabecera, o `null` si la progresión es Fija.
 *
 *   kind  'effort' (5 @ RPE 8) · 'time' (30–60 s, 30+ s) · 'bodyweight' (6–12,
 *         «haz las que puedas», sin carga sea cual sea Qué sube) · 'weight' (8–12 reps)
 */
export function firstTimeRx(def, exConfig) {
  const prog = resolveProgressionConfig(exConfig, def);
  if (prog.type === 'none') return null;
  const inputType = exConfig.inputType ?? def?.inputType ?? (def?.progressionModel === 'time_progression' ? 'time' : 'weight_reps');
  const minReps = exConfig.minReps ?? def?.minReps ?? DEFAULT_TARGET.minReps;
  const maxReps = exConfig.maxReps ?? def?.maxReps ?? DEFAULT_TARGET.maxReps;
  const minTime = exConfig.minTime ?? def?.minTime ?? DEFAULT_TARGET.minTime;
  const maxTime = exConfig.maxTime ?? def?.maxTime ?? DEFAULT_TARGET.maxTime;

  if (inputType === 'time' || inputType === 'weight_time') {
    const v = prog.type === 'time' ? `${minTime}+` : minTime === maxTime ? `${minTime}` : `${minTime}–${maxTime}`;
    return { kind: 'time', value: `${v} s` };
  }
  if (prog.type === 'effort') return { kind: 'effort', value: `${minReps} @ RPE ${prog.targetRpe}` };
  const range = prog.type === 'reps' ? `${minReps}+` : minReps === maxReps ? `${minReps}` : `${minReps}–${maxReps}`;
  return isBodyweight(def)
    ? { kind: 'bodyweight', value: range }
    : { kind: 'weight', value: `${range} reps` };
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
