/**
 * Lo puro del constructor guiado del recorrido de entrada (O03 §10, tarea O03-02):
 * la profundidad, los sugeridos del buscador corto, dónde resaltar lo buscado y el
 * formato del ejercicio propio. Sin React ni store; el test está al lado.
 */
import { LEGACY_TYPE_MAP, DEFAULT_TARGET } from './progression';
import { initProgForm, buildProgression } from './progressionForm';

/** Las sesiones que se pueden elegir (las mismas letras A-F que `createEmptyProgram`). */
export const SESSION_CHOICES = [1, 2, 3, 4, 5, 6];

/**
 * La profundidad (§10.3): completa para el avanzado, el entrenador y «lo copio a
 * mano»; sencilla para el resto (`self` principiante o intermedio).
 */
export const isDeep = (ctx, level) => ctx === 'trainer' || ctx === 'copy' || level === 'advanced';

/** Los cinco sugeridos del buscador sin escribir, por profundidad (§10.3). Ids de `exerciseLibrary`. */
export const SUGGESTED = {
  simple: ['goblet_squat', 'bench_press_db', 'cable_row', 'leg_press_standard', 'pulldown'],
  deep:   ['squat_barbell', 'bench_press_barbell', 'deadlift_conventional', 'pull_up', 'overhead_press_barbell'],
};

/** Cuántos resultados enseña el buscador corto antes del «sigue escribiendo». */
export const SHOWN = 6;

// Un carácter, un carácter: sin tildes ni mayúsculas y con el guion como espacio (como `filterBySearch`).
const plainChar = (ch) => (ch === '-' ? ' ' : (ch.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()[0] ?? ch));
const plain = (s) => Array.from({ length: s.length }, (_, i) => plainChar(s[i])).join('');

/**
 * Parte `name` en trozos para pintar lo buscado en lima: `[{ text, hit }]`. Cada
 * palabra de `query` se busca sin tildes ni mayúsculas, así «jalon» marca «Jalón».
 * Si la búsqueda solo encontró el ejercicio por parecido, no hay nada que marcar.
 */
export function splitHit(name, query) {
  const words = [...new Set(plain(String(query ?? '')).split(/\s+/).filter(Boolean))];
  const flat  = plain(name);
  const mark  = new Array(name.length).fill(false);
  for (const w of words) {
    const at = flat.indexOf(w);
    if (at >= 0) mark.fill(true, at, at + w.length);
  }
  const parts = [];
  for (let i = 0; i < name.length; i++) {
    const last = parts[parts.length - 1];
    if (last && last.hit === mark[i]) last.text += name[i];
    else parts.push({ text: name[i], hit: mark[i] });
  }
  return parts;
}

/** Id de un ejercicio propio, el mismo formato que `CustomExerciseScreen`. */
export const newCustomId = () => `custom_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

/**
 * El ejercicio propio con lo que `CustomExerciseScreen` deja por defecto (3 series,
 * 8-12 reps, 90 s, intermedio, compuesto, progresión doble), sin pedir nada más:
 * en el buscador corto solo se escribe el nombre. Se añade con `addCustomExercise`.
 */
export function buildCustomExercise(name, id = newCustomId()) {
  const draft = {
    progressionDirection: 'increase', weightStep: 2.5, isCustom: true,
    equipment: [], level: 'intermediate', isCompound: true, isUnilateral: false, inputType: 'weight_reps',
  };
  const sets = 3;
  const ctx  = { def: draft, sets, metric: 'reps', range: true };
  const { progression, weightStep } = buildProgression(initProgForm({}, draft, ctx), ctx);
  return {
    id,
    name:                 name.trim(),
    pattern:              '',
    primaryGroup:         'custom',
    muscles:              [],
    equipment:            [],
    level:                'intermediate',
    isCompound:           true,
    isKeyCandidate:       true,
    isUnilateral:         false,
    progressionModel:     LEGACY_TYPE_MAP[progression.type] ?? 'double_progression',
    progression,
    progressionDirection: 'increase',
    sets,
    minReps:              DEFAULT_TARGET.minReps,
    maxReps:              DEFAULT_TARGET.maxReps,
    weightStep:           weightStep ?? 2.5,
    restSec:              90,
    tips:                 [],
    isCustom:             true,
    inputType:            'weight_reps',
    tempo:                null,
  };
}

/** Las tres opciones del volumen sencillo (§10.3): nombre y repeticiones fijas. */
/** Los topes de los campos de volumen: los mismos que `ExerciseEditorInline`. */
export const VOLUME_LIMITS = { sets: [1, 8], rest: [30, 300], reps: [1, 50] };

/**
 * Cambia el mínimo o el máximo de reps sin dejar el rango del revés (min <= max):
 * `{ minReps, maxReps }` listo para `updateExerciseParams`.
 */
export function withReps(minReps, maxReps, change) {
  const min = change.minReps ?? minReps;
  const max = change.maxReps ?? maxReps;
  return change.minReps != null
    ? { minReps: min, maxReps: Math.max(min, max) }
    : { minReps: Math.min(min, max), maxReps: max };
}

/** El texto de la ficha de volumen de la barra: «3×8-12», «3×10», «3×30s». */
export function volumeLabel({ sets, minReps, maxReps, time = false }) {
  if (time) return `${sets}×${minReps}s`;
  return `${sets}×${minReps === maxReps ? minReps : `${minReps}-${maxReps}`}`;
}
