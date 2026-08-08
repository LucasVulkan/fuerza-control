/**
 * Arquetipos de programas de entrenamiento.
 * Cada arquetipo define una estructura real y bien pensada.
 * El sistema de sustitución adapta los ejercicios al equipo y nivel del usuario.
 *
 * role: 'key' | 'accessory'
 * Los keys son compuestos principales. Los accesorios son aislados o complementarios.
 * El sistema de nivel elimina/añade ejercicios respetando que cada patrón principal
 * esté representado al menos una vez por día.
 */

import { EXERCISE_LIBRARY } from './exerciseLibrary';

/**
 * Fases por defecto según el objetivo de la plantilla — spec
 * `mobile/docs/specs/program-templates.md` §6.
 *
 * La primera fase ES la etapa base, por eso su `rx` es `null`. Las demás se
 * materializan clonando la base y aplicando su regla, así que los deltas son
 * absolutos contra la primera, no acumulativos.
 *
 * El vocabulario es el de `stageRx.js` y no admite nada más: si una fase
 * necesitara cambiar ejercicios, no sería una fase — sería otra plantilla.
 *
 * Una plantilla puede declarar las suyas; esto es sólo el punto de partida
 * razonable para cada objetivo.
 */
const DELOAD = { name: 'Descarga', durationWeeks: 1, rx: { setsDelta: -1, progressionHold: 'deload' } };

export const DEFAULT_PHASES = {
  // 8 semanas. Acumular volumen y después apretar las repeticiones de los
  // básicos: el clásico para hipertrofia.
  hypertrophy: [
    { name: 'Acumulación',     durationWeeks: 4, rx: null },
    { name: 'Intensificación', durationWeeks: 3, rx: { scope: 'keys', repsShift: -3, restPct: 25 } },
    DELOAD,
  ],

  // 9 semanas. El desplazamiento de repeticiones es menor porque un programa de
  // fuerza ya vive en rangos cortos: −3 sobre un 5×5 lo dejaría en dobles.
  strength: [
    { name: 'Acumulación',     durationWeeks: 4, rx: null },
    { name: 'Intensificación', durationWeeks: 4, rx: { scope: 'keys', repsShift: -2, restPct: 25 } },
    DELOAD,
  ],

  // 8 semanas. En calistenia la progresión va por repeticiones y dificultad del
  // movimiento, no por acortar el rango: se sube volumen de accesorios.
  endurance: [
    { name: 'Acumulación', durationWeeks: 4, rx: null },
    { name: 'Volumen',     durationWeeks: 3, rx: { scope: 'accessories', setsDelta: 1 } },
    DELOAD,
  ],
};

export const ARCHETYPES = [

  // ─────────────────────────────────────────────────────────────────────────
  // FULL BODY · HIPERTROFIA · INTERMEDIO (base para la mayoría de sustituciones)
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'fullbody_hypertrophy_intermediate',
    name: 'Full Body · Hipertrofia',
    tags: ['full_body', 'hypertrophy', 'intermediate'],
    discipline: 'standard',
    distribution: 'full_body',
    goal: 'hypertrophy',
    phases: DEFAULT_PHASES.hypertrophy,
    level: 'intermediate',
    days: [
      {
        label: 'A',
        name: 'Tracción, empuje horizontal y cadera',
        color: 'var(--day1)',
        emphasis: 'pull',
        exercises: [
          { exerciseId: 'pull_up_weighted_barbell', role: 'key',      sets: 4, minReps: 6,  maxReps: 8,  restSec: 120, pattern: 'vertical_pull',   primaryGroup: 'back' },
          { exerciseId: 'bench_press_db',           role: 'key',      sets: 4, minReps: 8,  maxReps: 10, restSec: 120, pattern: 'horizontal_push',  primaryGroup: 'chest' },
          { exerciseId: 'romanian_deadlift_db',     role: 'key',      sets: 4, minReps: 8,  maxReps: 10, restSec: 120, pattern: 'hip_hinge',        primaryGroup: 'glutes_hamstrings' },
          { exerciseId: 'db_row_unilateral',        role: 'accessory',sets: 3, minReps: 10, maxReps: 12, restSec: 90,  pattern: 'horizontal_pull',  primaryGroup: 'back' },
          { exerciseId: 'chest_fly_machine',        role: 'accessory',sets: 3, minReps: 12, maxReps: 15, restSec: 60,  pattern: 'horizontal_push',  primaryGroup: 'chest' },
          { exerciseId: 'bicep_curl_supination',    role: 'accessory',sets: 3, minReps: 10, maxReps: 12, restSec: 60,  pattern: 'vertical_pull',    primaryGroup: 'arms' },
        ],
      },
      {
        label: 'B',
        name: 'Empuje vertical, tracción y pierna anterior',
        color: 'var(--day2)',
        emphasis: 'push',
        exercises: [
          { exerciseId: 'shoulder_press_db',     role: 'key',      sets: 4, minReps: 8,  maxReps: 10, restSec: 120, pattern: 'vertical_push',   primaryGroup: 'shoulders' },
          { exerciseId: 'cable_row',             role: 'key',      sets: 4, minReps: 10, maxReps: 12, restSec: 120, pattern: 'horizontal_pull',  primaryGroup: 'back' },
          { exerciseId: 'hack_squat',            role: 'key',      sets: 4, minReps: 8,  maxReps: 10, restSec: 120, pattern: 'squat',            primaryGroup: 'quads' },
          { exerciseId: 'lateral_raise_db',      role: 'accessory',sets: 3, minReps: 15, maxReps: 20, restSec: 60,  pattern: 'vertical_push',   primaryGroup: 'shoulders' },
          { exerciseId: 'leg_extension',         role: 'accessory',sets: 3, minReps: 12, maxReps: 15, restSec: 60,  pattern: 'squat',   primaryGroup: 'quads' },
          { exerciseId: 'tricep_pushdown',       role: 'accessory',sets: 3, minReps: 12, maxReps: 15, restSec: 60,  pattern: 'vertical_push',  primaryGroup: 'arms' },
        ],
      },
      {
        label: 'C',
        name: 'Tracción, empuje inclinado y cadera',
        color: 'var(--day3)',
        emphasis: 'pull',
        exercises: [
          { exerciseId: 'pulldown_pronated',     role: 'key',      sets: 4, minReps: 10, maxReps: 12, restSec: 120, pattern: 'vertical_pull',   primaryGroup: 'back' },
          { exerciseId: 'incline_press_db',      role: 'key',      sets: 4, minReps: 10, maxReps: 12, restSec: 90,  pattern: 'horizontal_push',  primaryGroup: 'chest' },
          { exerciseId: 'romanian_deadlift_db',  role: 'key',      sets: 4, minReps: 8,  maxReps: 10, restSec: 120, pattern: 'hip_hinge',        primaryGroup: 'glutes_hamstrings' },
          { exerciseId: 'cable_row',             role: 'accessory',sets: 3, minReps: 10, maxReps: 12, restSec: 90,  pattern: 'horizontal_pull',  primaryGroup: 'back' },
          { exerciseId: 'bulgarian_split_squat', role: 'accessory',sets: 3, minReps: 8,  maxReps: 8,  restSec: 90,  pattern: 'squat',            primaryGroup: 'quads' },
          { exerciseId: 'hammer_curl',           role: 'accessory',sets: 3, minReps: 10, maxReps: 12, restSec: 60,  pattern: 'vertical_pull',    primaryGroup: 'arms' },
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // FULL BODY · HIPERTROFIA · AVANZADO (barra libre)
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'fullbody_hypertrophy_advanced',
    name: 'Full Body · Hipertrofia · Barra libre',
    tags: ['full_body', 'hypertrophy', 'advanced'],
    discipline: 'standard', distribution: 'full_body',
    goal: 'hypertrophy',
    phases: DEFAULT_PHASES.hypertrophy,
    level: 'advanced',
    days: [
      {
        label: 'A',
        name: 'Tracción, empuje horizontal y cadera',
        color: 'var(--day1)',
        emphasis: 'pull',
        exercises: [
          { exerciseId: 'pull_up_weighted',      role: 'key',      sets: 4, minReps: 5,  maxReps: 8,  restSec: 150, pattern: 'vertical_pull',   primaryGroup: 'back' },
          { exerciseId: 'bench_press_barbell',   role: 'key',      sets: 4, minReps: 6,  maxReps: 8,  restSec: 120, pattern: 'horizontal_push',  primaryGroup: 'chest' },
          { exerciseId: 'romanian_deadlift',     role: 'key',      sets: 4, minReps: 6,  maxReps: 8,  restSec: 120, pattern: 'hip_hinge',        primaryGroup: 'glutes_hamstrings' },
          { exerciseId: 'db_row_unilateral',     role: 'accessory',sets: 3, minReps: 10, maxReps: 12, restSec: 90,  pattern: 'horizontal_pull',  primaryGroup: 'back' },
          { exerciseId: 'chest_fly_db',          role: 'accessory',sets: 3, minReps: 12, maxReps: 15, restSec: 60,  pattern: 'horizontal_push',  primaryGroup: 'chest' },
          { exerciseId: 'bicep_curl_barbell',    role: 'accessory',sets: 3, minReps: 10, maxReps: 12, restSec: 60,  pattern: 'vertical_pull',    primaryGroup: 'arms' },
          { exerciseId: 'hanging_leg_raise',     role: 'accessory',sets: 3, minReps: 8,  maxReps: 12, restSec: 60,  pattern: 'core',     primaryGroup: 'core' },
        ],
      },
      {
        label: 'B',
        name: 'Empuje vertical, tracción y pierna anterior',
        color: 'var(--day2)',
        emphasis: 'push',
        exercises: [
          { exerciseId: 'overhead_press_barbell',role: 'key',      sets: 4, minReps: 5,  maxReps: 8,  restSec: 150, pattern: 'vertical_push',   primaryGroup: 'shoulders' },
          { exerciseId: 'barbell_row',           role: 'key',      sets: 4, minReps: 6,  maxReps: 8,  restSec: 120, pattern: 'horizontal_pull',  primaryGroup: 'back' },
          { exerciseId: 'squat_barbell',         role: 'key',      sets: 4, minReps: 5,  maxReps: 6,  restSec: 180, pattern: 'squat',            primaryGroup: 'quads' },
          { exerciseId: 'lateral_raise_db',      role: 'accessory',sets: 3, minReps: 15, maxReps: 20, restSec: 60,  pattern: 'vertical_push',   primaryGroup: 'shoulders' },
          { exerciseId: 'leg_extension',         role: 'accessory',sets: 3, minReps: 12, maxReps: 15, restSec: 60,  pattern: 'squat',   primaryGroup: 'quads' },
          { exerciseId: 'tricep_pushdown',       role: 'accessory',sets: 3, minReps: 12, maxReps: 15, restSec: 60,  pattern: 'vertical_push',  primaryGroup: 'arms' },
          { exerciseId: 'cable_crunch',          role: 'accessory',sets: 3, minReps: 15, maxReps: 20, restSec: 45,  pattern: 'core',     primaryGroup: 'core' },
        ],
      },
      {
        label: 'C',
        name: 'Tracción, empuje inclinado y cadera',
        color: 'var(--day3)',
        emphasis: 'pull',
        exercises: [
          { exerciseId: 'pull_up_neutral',       role: 'key',      sets: 4, minReps: 6,  maxReps: 8,  restSec: 120, pattern: 'vertical_pull',   primaryGroup: 'back' },
          { exerciseId: 'incline_press_db',      role: 'key',      sets: 4, minReps: 8,  maxReps: 10, restSec: 90,  pattern: 'horizontal_push',  primaryGroup: 'chest' },
          { exerciseId: 'deadlift_conventional', role: 'key',      sets: 4, minReps: 4,  maxReps: 6,  restSec: 180, pattern: 'hip_hinge',        primaryGroup: 'glutes_hamstrings' },
          { exerciseId: 'seated_row_neutral',    role: 'accessory',sets: 3, minReps: 10, maxReps: 12, restSec: 90,  pattern: 'horizontal_pull',  primaryGroup: 'back' },
          { exerciseId: 'bulgarian_split_squat', role: 'accessory',sets: 3, minReps: 8,  maxReps: 8,  restSec: 90,  pattern: 'squat',            primaryGroup: 'quads' },
          { exerciseId: 'skull_crusher',         role: 'accessory',sets: 3, minReps: 10, maxReps: 12, restSec: 60,  pattern: 'vertical_push',  primaryGroup: 'arms' },
          { exerciseId: 'ab_wheel_rollout',      role: 'accessory',sets: 3, minReps: 6,  maxReps: 10, restSec: 60,  pattern: 'core',     primaryGroup: 'core' },
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // FULL BODY · HIPERTROFIA · PRINCIPIANTE (máquinas/mancuernas, 3 sets,
  // repetición parcial de patrones entre días para asentar técnica)
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'fullbody_hypertrophy_beginner',
    name: 'Full Body · Hipertrofia · Iniciación',
    tags: ['full_body', 'hypertrophy', 'beginner'],
    discipline: 'standard',
    distribution: 'full_body',
    goal: 'hypertrophy',
    phases: DEFAULT_PHASES.hypertrophy,
    level: 'beginner',
    days: [
      {
        label: 'A',
        name: 'Tracción vertical, empuje y pierna',
        color: 'var(--day1)',
        emphasis: 'pull',
        exercises: [
          { exerciseId: 'pulldown_neutral',       role: 'key',      sets: 3, minReps: 10, maxReps: 12, restSec: 90, pattern: 'vertical_pull',   primaryGroup: 'back' },
          { exerciseId: 'chest_press_machine',    role: 'key',      sets: 3, minReps: 10, maxReps: 12, restSec: 90, pattern: 'horizontal_push', primaryGroup: 'chest' },
          { exerciseId: 'leg_press_standard',     role: 'key',      sets: 3, minReps: 10, maxReps: 12, restSec: 90, pattern: 'squat',           primaryGroup: 'quads' },
          { exerciseId: 'db_row_unilateral',      role: 'accessory',sets: 3, minReps: 10, maxReps: 12, restSec: 60, pattern: 'horizontal_pull', primaryGroup: 'back' },
          { exerciseId: 'lateral_raise_db',       role: 'accessory',sets: 2, minReps: 12, maxReps: 15, restSec: 60, pattern: 'vertical_push',   primaryGroup: 'shoulders' },
          { exerciseId: 'plank',                  role: 'accessory',sets: 3, minReps: null, maxReps: null, restSec: 45, pattern: 'core',        primaryGroup: 'core' },
        ],
      },
      {
        label: 'B',
        name: 'Cadera, empuje vertical y tracción horizontal',
        color: 'var(--day2)',
        emphasis: 'push',
        exercises: [
          { exerciseId: 'hip_thrust',             role: 'key',      sets: 3, minReps: 10, maxReps: 12, restSec: 90, pattern: 'hip_hinge',       primaryGroup: 'glutes_hamstrings' },
          { exerciseId: 'shoulder_press_machine', role: 'key',      sets: 3, minReps: 10, maxReps: 12, restSec: 90, pattern: 'vertical_push',   primaryGroup: 'shoulders' },
          { exerciseId: 'cable_row',              role: 'key',      sets: 3, minReps: 10, maxReps: 12, restSec: 90, pattern: 'horizontal_pull', primaryGroup: 'back' },
          { exerciseId: 'leg_curl_lying',         role: 'accessory',sets: 2, minReps: 12, maxReps: 15, restSec: 60, pattern: 'hip_hinge',       primaryGroup: 'glutes_hamstrings' },
          { exerciseId: 'chest_fly_machine',      role: 'accessory',sets: 2, minReps: 12, maxReps: 15, restSec: 60, pattern: 'horizontal_push', primaryGroup: 'chest' },
          { exerciseId: 'crunch',                 role: 'accessory',sets: 3, minReps: 15, maxReps: 20, restSec: 45, pattern: 'core',            primaryGroup: 'core' },
        ],
      },
      {
        label: 'C',
        name: 'Tracción, empuje inclinado y sentadilla',
        color: 'var(--day3)',
        emphasis: 'pull',
        exercises: [
          { exerciseId: 'pulldown_pronated',      role: 'key',      sets: 3, minReps: 10, maxReps: 12, restSec: 90, pattern: 'vertical_pull',   primaryGroup: 'back' },
          { exerciseId: 'machine_incline_press',  role: 'key',      sets: 3, minReps: 10, maxReps: 12, restSec: 90, pattern: 'horizontal_push', primaryGroup: 'chest' },
          { exerciseId: 'goblet_squat',           role: 'key',      sets: 3, minReps: 10, maxReps: 12, restSec: 90, pattern: 'squat',           primaryGroup: 'quads' },
          { exerciseId: 'bicep_curl_supination',  role: 'accessory',sets: 2, minReps: 10, maxReps: 12, restSec: 60, pattern: 'vertical_pull',   primaryGroup: 'arms' },
          { exerciseId: 'tricep_pushdown',        role: 'accessory',sets: 2, minReps: 12, maxReps: 15, restSec: 60, pattern: 'vertical_push',   primaryGroup: 'arms' },
          { exerciseId: 'leg_raise_lying',        role: 'accessory',sets: 3, minReps: 12, maxReps: 15, restSec: 45, pattern: 'core',            primaryGroup: 'core' },
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // UPPER/LOWER · HIPERTROFIA · INTERMEDIO (ejercicios repetidos a propósito
  // entre A/B — ancla la progresión doble en vez de dispersar variedad)
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'upperlower_hypertrophy_intermediate',
    name: 'Upper/Lower · Hipertrofia',
    tags: ['upper_lower', 'hypertrophy', 'intermediate'],
    discipline: 'standard',
    distribution: 'upper_lower',
    goal: 'hypertrophy',
    phases: DEFAULT_PHASES.hypertrophy,
    level: 'intermediate',
    days: [
      {
        label: 'A',
        name: 'Tren superior A',
        color: 'var(--day1)',
        emphasis: 'upper',
        exercises: [
          { exerciseId: 'pulldown_pronated',    role: 'key',      sets: 3, minReps: 10, maxReps: 12, restSec: 90,  pattern: 'vertical_pull',   primaryGroup: 'back' },
          { exerciseId: 'bench_press_db',       role: 'key',      sets: 4, minReps: 8,  maxReps: 10, restSec: 120, pattern: 'horizontal_push', primaryGroup: 'chest' },
          { exerciseId: 'seated_row_neutral',   role: 'accessory',sets: 3, minReps: 10, maxReps: 12, restSec: 60,  pattern: 'horizontal_pull', primaryGroup: 'back' },
          { exerciseId: 'chest_fly_db',         role: 'accessory',sets: 2, minReps: 12, maxReps: 15, restSec: 60,  pattern: 'horizontal_push', primaryGroup: 'chest' },
          { exerciseId: 'lateral_raise_db',     role: 'accessory',sets: 3, minReps: 12, maxReps: 15, restSec: 60,  pattern: 'vertical_push',   primaryGroup: 'shoulders' },
          { exerciseId: 'bicep_curl_supination',role: 'accessory',sets: 3, minReps: 10, maxReps: 12, restSec: 60,  pattern: 'vertical_pull',   primaryGroup: 'arms' },
        ],
      },
      {
        label: 'B',
        name: 'Tren inferior A',
        color: 'var(--day2)',
        emphasis: 'lower',
        exercises: [
          { exerciseId: 'hack_squat',            role: 'key',      sets: 4, minReps: 8,  maxReps: 10, restSec: 120, pattern: 'squat',     primaryGroup: 'quads' },
          { exerciseId: 'romanian_deadlift_db',  role: 'key',      sets: 4, minReps: 8,  maxReps: 10, restSec: 120, pattern: 'hip_hinge', primaryGroup: 'glutes_hamstrings' },
          { exerciseId: 'leg_curl_lying',        role: 'accessory',sets: 3, minReps: 12, maxReps: 15, restSec: 60,  pattern: 'hip_hinge', primaryGroup: 'glutes_hamstrings' },
          { exerciseId: 'bulgarian_split_squat', role: 'accessory',sets: 3, minReps: 8,  maxReps: 10, restSec: 90,  pattern: 'squat',     primaryGroup: 'quads' },
          { exerciseId: 'cable_crunch',          role: 'accessory',sets: 3, minReps: 15, maxReps: 20, restSec: 45,  pattern: 'core',      primaryGroup: 'core' },
        ],
      },
      {
        label: 'C',
        name: 'Tren superior B',
        color: 'var(--day3)',
        emphasis: 'upper',
        exercises: [
          { exerciseId: 'pulldown_pronated',  role: 'key',      sets: 3, minReps: 10, maxReps: 12, restSec: 90,  pattern: 'vertical_pull',   primaryGroup: 'back' },
          { exerciseId: 'bench_press_db',     role: 'key',      sets: 4, minReps: 8,  maxReps: 10, restSec: 120, pattern: 'horizontal_push', primaryGroup: 'chest' },
          { exerciseId: 'seated_row_neutral', role: 'accessory',sets: 3, minReps: 10, maxReps: 12, restSec: 60,  pattern: 'horizontal_pull', primaryGroup: 'back' },
          { exerciseId: 'chest_fly_db',       role: 'accessory',sets: 2, minReps: 12, maxReps: 15, restSec: 60,  pattern: 'horizontal_push', primaryGroup: 'chest' },
          { exerciseId: 'shoulder_press_db',  role: 'key',      sets: 3, minReps: 10, maxReps: 12, restSec: 90,  pattern: 'vertical_push',   primaryGroup: 'shoulders' },
          { exerciseId: 'tricep_pushdown',    role: 'accessory',sets: 3, minReps: 12, maxReps: 15, restSec: 60,  pattern: 'vertical_push',   primaryGroup: 'arms' },
        ],
      },
      {
        label: 'D',
        name: 'Tren inferior B',
        color: 'var(--day4)',
        emphasis: 'lower',
        exercises: [
          { exerciseId: 'hack_squat',           role: 'key',      sets: 4, minReps: 8,  maxReps: 10, restSec: 120, pattern: 'squat',     primaryGroup: 'quads' },
          { exerciseId: 'romanian_deadlift_db', role: 'key',      sets: 4, minReps: 8,  maxReps: 10, restSec: 120, pattern: 'hip_hinge', primaryGroup: 'glutes_hamstrings' },
          { exerciseId: 'leg_extension',        role: 'accessory',sets: 3, minReps: 12, maxReps: 15, restSec: 60,  pattern: 'squat',     primaryGroup: 'quads' },
          { exerciseId: 'calf_raise_machine',   role: 'accessory',sets: 3, minReps: 12, maxReps: 15, restSec: 60,  pattern: 'calf_raise',primaryGroup: 'legs_lower' },
          { exerciseId: 'cable_crunch',         role: 'accessory',sets: 3, minReps: 15, maxReps: 20, restSec: 45,  pattern: 'core',      primaryGroup: 'core' },
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // UPPER/LOWER · HIPERTROFIA · AVANZADO (barra libre en press/remo/OHP/RDL;
  // hack squat deliberado en vez de sentadilla libre — friendliness articular
  // pese al nivel avanzado del resto del programa)
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'upperlower_hypertrophy_advanced',
    name: 'Upper/Lower · Hipertrofia · Barra libre',
    tags: ['upper_lower', 'hypertrophy', 'advanced'],
    discipline: 'standard',
    distribution: 'upper_lower',
    goal: 'hypertrophy',
    phases: DEFAULT_PHASES.hypertrophy,
    level: 'advanced',
    days: [
      {
        label: 'A',
        name: 'Tren superior A',
        color: 'var(--day1)',
        emphasis: 'upper',
        exercises: [
          { exerciseId: 'bench_press_barbell', role: 'key',      sets: 4, minReps: 6,  maxReps: 8,  restSec: 120, pattern: 'horizontal_push', primaryGroup: 'chest' },
          { exerciseId: 'barbell_row',         role: 'key',      sets: 4, minReps: 6,  maxReps: 8,  restSec: 120, pattern: 'horizontal_pull', primaryGroup: 'back' },
          { exerciseId: 'incline_press_db',    role: 'accessory',sets: 3, minReps: 8,  maxReps: 10, restSec: 90,  pattern: 'horizontal_push', primaryGroup: 'chest' },
          { exerciseId: 'pulldown_pronated',   role: 'accessory',sets: 3, minReps: 8,  maxReps: 10, restSec: 90,  pattern: 'vertical_pull',   primaryGroup: 'back' },
          { exerciseId: 'lateral_raise_db',    role: 'accessory',sets: 3, minReps: 12, maxReps: 15, restSec: 60,  pattern: 'vertical_push',   primaryGroup: 'shoulders' },
          { exerciseId: 'ez_bar_curl',         role: 'accessory',sets: 3, minReps: 10, maxReps: 12, restSec: 60,  pattern: 'vertical_pull',   primaryGroup: 'arms' },
          { exerciseId: 'tricep_pushdown',     role: 'accessory',sets: 3, minReps: 10, maxReps: 12, restSec: 60,  pattern: 'vertical_push',   primaryGroup: 'arms' },
          { exerciseId: 'plank',               role: 'accessory',sets: 3, minReps: null, maxReps: null, restSec: 45, pattern: 'core',          primaryGroup: 'core' },
        ],
      },
      {
        label: 'B',
        name: 'Tren inferior A',
        color: 'var(--day2)',
        emphasis: 'lower',
        exercises: [
          { exerciseId: 'hack_squat',          role: 'key',      sets: 4, minReps: 6,  maxReps: 8,  restSec: 120, pattern: 'squat',     primaryGroup: 'quads' },
          { exerciseId: 'romanian_deadlift',   role: 'key',      sets: 4, minReps: 8,  maxReps: 10, restSec: 120, pattern: 'hip_hinge', primaryGroup: 'glutes_hamstrings' },
          { exerciseId: 'leg_press_standard',  role: 'accessory',sets: 3, minReps: 10, maxReps: 12, restSec: 90,  pattern: 'squat',     primaryGroup: 'quads' },
          { exerciseId: 'leg_curl_lying',      role: 'accessory',sets: 3, minReps: 10, maxReps: 12, restSec: 60,  pattern: 'hip_hinge', primaryGroup: 'glutes_hamstrings' },
          { exerciseId: 'calf_raise_standing', role: 'accessory',sets: 4, minReps: 10, maxReps: 15, restSec: 60,  pattern: 'calf_raise',primaryGroup: 'legs_lower' },
          { exerciseId: 'cable_crunch',        role: 'accessory',sets: 3, minReps: 12, maxReps: 15, restSec: 45,  pattern: 'core',      primaryGroup: 'core' },
        ],
      },
      {
        label: 'C',
        name: 'Tren superior B',
        color: 'var(--day3)',
        emphasis: 'upper',
        exercises: [
          { exerciseId: 'bench_press_barbell',      role: 'key',      sets: 4, minReps: 6,  maxReps: 8,  restSec: 120, pattern: 'horizontal_push', primaryGroup: 'chest' },
          { exerciseId: 'barbell_row',              role: 'key',      sets: 4, minReps: 6,  maxReps: 8,  restSec: 120, pattern: 'horizontal_pull', primaryGroup: 'back' },
          { exerciseId: 'overhead_press_barbell',   role: 'accessory',sets: 3, minReps: 8,  maxReps: 10, restSec: 90,  pattern: 'vertical_push',   primaryGroup: 'shoulders' },
          { exerciseId: 'pulldown_supinated',       role: 'accessory',sets: 3, minReps: 8,  maxReps: 10, restSec: 90,  pattern: 'vertical_pull',   primaryGroup: 'back' },
          { exerciseId: 'rear_delt_fly_db',         role: 'accessory',sets: 3, minReps: 12, maxReps: 15, restSec: 60,  pattern: 'horizontal_pull', primaryGroup: 'shoulders' },
          { exerciseId: 'incline_curl_db',          role: 'accessory',sets: 3, minReps: 10, maxReps: 12, restSec: 60,  pattern: 'vertical_pull',   primaryGroup: 'arms' },
          { exerciseId: 'overhead_triceps_ext_db',  role: 'accessory',sets: 3, minReps: 10, maxReps: 12, restSec: 60,  pattern: 'vertical_push',   primaryGroup: 'arms' },
          { exerciseId: 'russian_twist',            role: 'accessory',sets: 3, minReps: 15, maxReps: 20, restSec: 45,  pattern: 'core',            primaryGroup: 'core' },
        ],
      },
      {
        label: 'D',
        name: 'Tren inferior B',
        color: 'var(--day4)',
        emphasis: 'lower',
        exercises: [
          { exerciseId: 'hack_squat',         role: 'key',      sets: 4, minReps: 6,  maxReps: 8,  restSec: 120, pattern: 'squat',     primaryGroup: 'quads' },
          { exerciseId: 'romanian_deadlift',  role: 'key',      sets: 4, minReps: 8,  maxReps: 10, restSec: 120, pattern: 'hip_hinge', primaryGroup: 'glutes_hamstrings' },
          { exerciseId: 'hip_thrust',         role: 'accessory',sets: 3, minReps: 8,  maxReps: 10, restSec: 90,  pattern: 'hip_hinge', primaryGroup: 'glutes_hamstrings' },
          { exerciseId: 'leg_extension',      role: 'accessory',sets: 3, minReps: 10, maxReps: 12, restSec: 60,  pattern: 'squat',     primaryGroup: 'quads' },
          { exerciseId: 'seated_calf_raise',  role: 'accessory',sets: 4, minReps: 10, maxReps: 15, restSec: 60,  pattern: 'calf_raise',primaryGroup: 'legs_lower' },
          { exerciseId: 'hanging_leg_raise',  role: 'accessory',sets: 3, minReps: 10, maxReps: 15, restSec: 45,  pattern: 'core',      primaryGroup: 'core' },
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // FULL BODY · FUERZA · AVANZADO (5x5 clásico — squat/bench/row A y C,
  // deadlift/OHP/squat pausada B; primer arquetipo de discipline='strength')
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'fullbody_strength_advanced',
    name: 'Full Body · Fuerza',
    tags: ['full_body', 'strength', 'advanced'],
    discipline: 'strength',
    distribution: 'full_body',
    goal: 'strength',
    phases: DEFAULT_PHASES.strength,
    level: 'advanced',
    days: [
      {
        label: 'A',
        name: 'Sentadilla, banca y remo',
        color: 'var(--day1)',
        emphasis: 'squat_bench_row',
        exercises: [
          { exerciseId: 'squat_barbell',       role: 'key',      sets: 4, minReps: 5,  maxReps: 5,  restSec: 180, pattern: 'squat',           primaryGroup: 'quads' },
          { exerciseId: 'bench_press_barbell', role: 'key',      sets: 4, minReps: 5,  maxReps: 5,  restSec: 120, pattern: 'horizontal_push', primaryGroup: 'chest' },
          { exerciseId: 'barbell_row',         role: 'key',      sets: 4, minReps: 5,  maxReps: 5,  restSec: 120, pattern: 'horizontal_pull', primaryGroup: 'back' },
          { exerciseId: 'pull_up_neutral',     role: 'accessory',sets: 3, minReps: 6,  maxReps: 8,  restSec: 90,  pattern: 'vertical_pull',   primaryGroup: 'back' },
          { exerciseId: 'lateral_raise_db',    role: 'accessory',sets: 3, minReps: 12, maxReps: 15, restSec: 60,  pattern: 'vertical_push',   primaryGroup: 'shoulders' },
          { exerciseId: 'plank',               role: 'accessory',sets: 3, minReps: null, maxReps: null, restSec: 60, pattern: 'core',          primaryGroup: 'core' },
        ],
      },
      {
        label: 'B',
        name: 'Peso muerto, press militar y sentadilla pausada',
        color: 'var(--day2)',
        emphasis: 'deadlift_ohp',
        exercises: [
          { exerciseId: 'deadlift_conventional', role: 'key',      sets: 3, minReps: 5,  maxReps: 5,  restSec: 180, pattern: 'hip_hinge',       primaryGroup: 'glutes_hamstrings' },
          { exerciseId: 'overhead_press_barbell',role: 'key',      sets: 4, minReps: 5,  maxReps: 5,  restSec: 150, pattern: 'vertical_push',   primaryGroup: 'shoulders' },
          { exerciseId: 'box_squat_barbell',     role: 'key',      sets: 3, minReps: 5,  maxReps: 5,  restSec: 150, pattern: 'squat',           primaryGroup: 'quads' },
          { exerciseId: 'pull_up_supine',        role: 'accessory',sets: 3, minReps: 6,  maxReps: 8,  restSec: 90,  pattern: 'vertical_pull',   primaryGroup: 'back' },
          { exerciseId: 'ez_bar_curl',           role: 'accessory',sets: 3, minReps: 8,  maxReps: 10, restSec: 60,  pattern: 'vertical_pull',   primaryGroup: 'arms' },
          { exerciseId: 'dip',                   role: 'accessory',sets: 3, minReps: 8,  maxReps: 10, restSec: 90,  pattern: 'vertical_push',   primaryGroup: 'chest' },
        ],
      },
      {
        label: 'C',
        name: 'Sentadilla, banca y remo',
        color: 'var(--day3)',
        emphasis: 'squat_bench_row',
        exercises: [
          { exerciseId: 'squat_barbell',       role: 'key',      sets: 4, minReps: 5,  maxReps: 5,  restSec: 180, pattern: 'squat',           primaryGroup: 'quads' },
          { exerciseId: 'bench_press_barbell', role: 'key',      sets: 4, minReps: 5,  maxReps: 5,  restSec: 120, pattern: 'horizontal_push', primaryGroup: 'chest' },
          { exerciseId: 'barbell_row',         role: 'key',      sets: 4, minReps: 5,  maxReps: 5,  restSec: 120, pattern: 'horizontal_pull', primaryGroup: 'back' },
          { exerciseId: 'romanian_deadlift',   role: 'accessory',sets: 3, minReps: 6,  maxReps: 8,  restSec: 120, pattern: 'hip_hinge',       primaryGroup: 'glutes_hamstrings' },
          { exerciseId: 'face_pull',           role: 'accessory',sets: 3, minReps: 12, maxReps: 15, restSec: 60,  pattern: 'horizontal_pull', primaryGroup: 'shoulders' },
          { exerciseId: 'ab_wheel_rollout',     role: 'accessory',sets: 3, minReps: 10, maxReps: 15, restSec: 60,  pattern: 'core',            primaryGroup: 'core' },
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // GLÚTEO PRIORITARIO · HIPERTROFIA · INTERMEDIO
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'glutes_hypertrophy_intermediate',
    name: 'Glúteo Prioritario · Hipertrofia',
    tags: ['glutes_focus', 'hypertrophy', 'intermediate'],
    discipline: 'glutes_legs', distribution: 'full_body',
    goal: 'hypertrophy',
    phases: DEFAULT_PHASES.hypertrophy,
    level: 'intermediate',
    // Sus 21 series de glúteo por ciclo son el programa, no un exceso: sin esto
    // el normalizador las recorta al techo de intermedio (20) y la plantilla
    // deja de ser una plantilla de glúteo. Protege también del recorte por
    // redundancia (program-templates.md §5.3).
    volumeEmphasis: ['glutes_hamstrings'],
    days: [
      {
        label: 'A',
        name: 'Glúteo e isquios prioritario',
        color: 'var(--day1)',
        emphasis: 'glutes',
        exercises: [
          { exerciseId: 'hip_thrust',            role: 'key',      sets: 4, minReps: 10, maxReps: 12, restSec: 90,  pattern: 'hip_hinge',       primaryGroup: 'glutes_hamstrings' },
          { exerciseId: 'romanian_deadlift_db',  role: 'key',      sets: 4, minReps: 8,  maxReps: 10, restSec: 120, pattern: 'hip_hinge',       primaryGroup: 'glutes_hamstrings' },
          { exerciseId: 'pulldown_neutral',      role: 'key',      sets: 3, minReps: 10, maxReps: 12, restSec: 90,  pattern: 'vertical_pull',   primaryGroup: 'back' },
          { exerciseId: 'leg_curl_lying',        role: 'accessory',sets: 3, minReps: 12, maxReps: 15, restSec: 60,  pattern: 'hip_hinge',    primaryGroup: 'glutes_hamstrings' },
          { exerciseId: 'hip_abduction_machine', role: 'accessory',sets: 3, minReps: 15, maxReps: 20, restSec: 60,  pattern: 'hip_hinge',       primaryGroup: 'glutes_hamstrings' },
          { exerciseId: 'crunch',                role: 'accessory',sets: 3, minReps: 15, maxReps: 20, restSec: 45,  pattern: 'core',    primaryGroup: 'core' },
        ],
      },
      {
        label: 'B',
        name: 'Pierna anterior y empuje',
        color: 'var(--day2)',
        emphasis: 'legs_push',
        exercises: [
          { exerciseId: 'leg_press_standard',    role: 'key',      sets: 4, minReps: 10, maxReps: 12, restSec: 90,  pattern: 'squat',           primaryGroup: 'quads' },
          { exerciseId: 'bench_press_db',        role: 'key',      sets: 4, minReps: 8,  maxReps: 10, restSec: 90,  pattern: 'horizontal_push', primaryGroup: 'chest' },
          { exerciseId: 'cable_row',             role: 'key',      sets: 3, minReps: 10, maxReps: 12, restSec: 90,  pattern: 'horizontal_pull', primaryGroup: 'back' },
          { exerciseId: 'bulgarian_split_squat', role: 'accessory',sets: 3, minReps: 8,  maxReps: 8,  restSec: 90,  pattern: 'squat',           primaryGroup: 'quads' },
          { exerciseId: 'chest_fly_machine',     role: 'accessory',sets: 3, minReps: 12, maxReps: 15, restSec: 60,  pattern: 'horizontal_push', primaryGroup: 'chest' },
          { exerciseId: 'leg_raise_lying',       role: 'accessory',sets: 3, minReps: 12, maxReps: 15, restSec: 60,  pattern: 'core',    primaryGroup: 'core' },
        ],
      },
      {
        label: 'C',
        name: 'Glúteo, isquios y hombro',
        color: 'var(--day3)',
        emphasis: 'glutes_shoulders',
        exercises: [
          { exerciseId: 'hip_thrust',            role: 'key',      sets: 4, minReps: 10, maxReps: 12, restSec: 90,  pattern: 'hip_hinge',       primaryGroup: 'glutes_hamstrings' },
          { exerciseId: 'shoulder_press_db',     role: 'key',      sets: 4, minReps: 8,  maxReps: 10, restSec: 90,  pattern: 'vertical_push',   primaryGroup: 'shoulders' },
          { exerciseId: 'pulldown_pronated',     role: 'key',      sets: 3, minReps: 10, maxReps: 12, restSec: 90,  pattern: 'vertical_pull',   primaryGroup: 'back' },
          { exerciseId: 'leg_curl_lying',        role: 'accessory',sets: 3, minReps: 12, maxReps: 15, restSec: 60,  pattern: 'hip_hinge',    primaryGroup: 'glutes_hamstrings' },
          { exerciseId: 'lateral_raise_db',      role: 'accessory',sets: 3, minReps: 15, maxReps: 20, restSec: 60,  pattern: 'vertical_push',   primaryGroup: 'shoulders' },
          { exerciseId: 'crunch',                role: 'accessory',sets: 3, minReps: 15, maxReps: 20, restSec: 45,  pattern: 'core',    primaryGroup: 'core' },
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // CALISTENIA · FUNCIONAL · INTERMEDIO
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'calisthenics_functional_intermediate',
    name: 'Calistenia · Funcional',
    tags: ['functional', 'endurance', 'intermediate'],
    discipline: 'calisthenics', distribution: 'full_body',
    goal: 'endurance',
    phases: DEFAULT_PHASES.endurance,
    level: 'intermediate',
    days: [
      {
        label: 'A',
        name: 'Tracción y core',
        color: 'var(--day1)',
        emphasis: 'pull',
        exercises: [
          { exerciseId: 'pull_up_weighted_barbell',role: 'key',      sets: 4, minReps: 5,  maxReps: 8,  restSec: 120, pattern: 'vertical_pull',     primaryGroup: 'back' },
          { exerciseId: 'push_up',                 role: 'key',      sets: 3, minReps: null,maxReps: null,restSec: 90, pattern: 'horizontal_push',    primaryGroup: 'chest' },
          { exerciseId: 'romanian_deadlift_db',    role: 'key',      sets: 3, minReps: 8,  maxReps: 10, restSec: 90,  pattern: 'hip_hinge',           primaryGroup: 'glutes_hamstrings' },
          { exerciseId: 'australian_row',          role: 'accessory',sets: 3, minReps: 8,  maxReps: 12, restSec: 90,  pattern: 'horizontal_pull',     primaryGroup: 'back' },
          { exerciseId: 'hollow_body_hold',        role: 'accessory',sets: 3, minReps: null,maxReps: null,restSec: 60, pattern: 'core',        primaryGroup: 'core' },
          { exerciseId: 'dead_hang',               role: 'accessory',sets: 3, minReps: null,maxReps: null,restSec: 60, pattern: 'carry_grip',      primaryGroup: 'grip' },
        ],
      },
      {
        label: 'B',
        name: 'Empuje y pierna',
        color: 'var(--day2)',
        emphasis: 'push',
        exercises: [
          { exerciseId: 'dip',                   role: 'key',      sets: 4, minReps: 5,  maxReps: 8,  restSec: 120, pattern: 'vertical_push',     primaryGroup: 'chest' },
          { exerciseId: 'pull_up_neutral',        role: 'key',      sets: 4, minReps: 5,  maxReps: 8,  restSec: 120, pattern: 'vertical_pull',     primaryGroup: 'back' },
          { exerciseId: 'bulgarian_split_squat',  role: 'key',      sets: 3, minReps: 8,  maxReps: 8,  restSec: 90,  pattern: 'squat',             primaryGroup: 'quads' },
          { exerciseId: 'push_up',                role: 'accessory',sets: 3, minReps: null,maxReps: null,restSec: 60, pattern: 'horizontal_push',   primaryGroup: 'chest' },
          { exerciseId: 'l_sit',                  role: 'accessory',sets: 4, minReps: null,maxReps: null,restSec: 90, pattern: 'core',  primaryGroup: 'core' },
          { exerciseId: 'dead_hang',              role: 'accessory',sets: 3, minReps: null,maxReps: null,restSec: 60, pattern: 'carry_grip',     primaryGroup: 'grip' },
        ],
      },
      {
        label: 'C',
        name: 'Full body funcional',
        color: 'var(--day3)',
        emphasis: 'full',
        exercises: [
          { exerciseId: 'pull_up_weighted_barbell',role: 'key',      sets: 4, minReps: 5,  maxReps: 8,  restSec: 120, pattern: 'vertical_pull',    primaryGroup: 'back' },
          { exerciseId: 'dip',                     role: 'key',      sets: 3, minReps: 5,  maxReps: 8,  restSec: 90,  pattern: 'vertical_push',    primaryGroup: 'chest' },
          { exerciseId: 'walking_lunge',           role: 'key',      sets: 3, minReps: 10, maxReps: 10, restSec: 90,  pattern: 'squat',            primaryGroup: 'quads' },
          { exerciseId: 'australian_row',          role: 'accessory',sets: 3, minReps: 8,  maxReps: 12, restSec: 90,  pattern: 'horizontal_pull',  primaryGroup: 'back' },
          { exerciseId: 'hollow_body_hold',        role: 'accessory',sets: 3, minReps: null,maxReps: null,restSec: 60, pattern: 'core',     primaryGroup: 'core' },
          { exerciseId: 'dead_hang',               role: 'accessory',sets: 3, minReps: null,maxReps: null,restSec: 60, pattern: 'carry_grip',   primaryGroup: 'grip' },
        ],
      },
    ],
  },
];

/**
 * Ranking de plantillas — spec `mobile/docs/specs/program-templates.md` §7.
 *
 * Sustituye al `findBestArchetype` de coincidencia exacta, que exigía el mismo
 * `daysPerWeek` en sus tres tiers: como todas las plantillas son de 3 o 4
 * sesiones, quien pedía 1, 2, 5, 6 o 7 días caía SIEMPRE al generador
 * procedural. Y comparaba dos magnitudes distintas: `answers.daysPerWeek` es la
 * frecuencia semanal del usuario; el campo del arquetipo era el nº de sesiones
 * del ciclo.
 *
 * **Nunca devuelve vacío.** El primero es la recomendación; los siguientes son
 * las alternativas que verá el usuario en la pantalla de propuestas, con su
 * coste de adaptación declarado.
 */

/** Ciclos por semana. El modelo es rotativo: el ciclo no dura una semana. */
const cycleSpeedOf = (daysPerWeek, sessionsPerCycle) =>
  (daysPerWeek > 0 && sessionsPerCycle > 0 ? daysPerWeek / sessionsPerCycle : 1);

/**
 * Por debajo de esto el ciclo avanza tan despacio que los patrones pierden
 * frecuencia semanal. En fuerza importa mucho más: un ciclo de 4 sesiones a 2
 * días/semana deja la sentadilla en 0,5 exposiciones semanales, y eso no es
 * practicar un levantamiento.
 */
const MIN_CYCLE_SPEED = { strength: 0.9 };
const MIN_CYCLE_SPEED_DEFAULT = 0.6;

const LEVEL_ORDER = { beginner: 0, intermediate: 1, advanced: 2 };
const LEVEL_SCORE = [20, 8, 0];

function equipmentGap(archetype, equipment = []) {
  let missing = 0;
  for (const day of archetype.days) {
    for (const ex of day.exercises) {
      const def = EXERCISE_LIBRARY[ex.exerciseId];
      const needed = def?.equipment ?? [];
      if (needed.length && !needed.some((e) => equipment.includes(e))) missing++;
    }
  }
  return missing;
}

export function rankArchetypes(answers = {}) {
  const {
    discipline, goal, level = 'intermediate', daysPerWeek = 3, equipment = [],
  } = answers;

  return ARCHETYPES.map((archetype) => {
    const sessionsPerCycle = archetype.days.length;
    const cycleSpeed = cycleSpeedOf(daysPerWeek, sessionsPerCycle);
    const adaptationCost = equipmentGap(archetype, equipment);
    const levelGap = Math.abs(LEVEL_ORDER[archetype.level] - LEVEL_ORDER[level]);

    let score = 0;
    if (archetype.discipline === discipline) score += 40;
    if (archetype.goal === goal) score += 15;
    score += LEVEL_SCORE[levelGap] ?? 0;

    // Cuanto más se aleje el ciclo de durar una semana, peor encaja.
    score -= 20 * Math.abs(cycleSpeed - 1);

    const minSpeed = MIN_CYCLE_SPEED[archetype.discipline] ?? MIN_CYCLE_SPEED_DEFAULT;
    if (cycleSpeed < minSpeed) score -= 60;

    // Un principiante no lleva más de 3 sesiones distintas: si pide 6 días,
    // rota una de 3 con el volumen recortado a su banda (spec §2.6).
    if (level === 'beginner' && sessionsPerCycle > 3) score -= 100;

    score -= 3 * adaptationCost;

    const notes = [];
    if (adaptationCost > 0) notes.push('needsBarbell');
    if (cycleSpeed > 1.25) notes.push('rotates');
    if (cycleSpeed < minSpeed) notes.push('slowCycle');
    if (levelGap > 0) notes.push('levelStretch');

    return { archetype, score, sessionsPerCycle, cycleSpeed, adaptationCost, notes };
  }).sort((a, b) => b.score - a.score
    // Desempate estable por orden en el array: mismas respuestas, mismo programa.
    || ARCHETYPES.indexOf(a.archetype) - ARCHETYPES.indexOf(b.archetype));
}

/**
 * @deprecated Envoltorio para el store web (`src/store/useStore.js`), que queda
 * fuera del alcance de esta spec. El camino móvil usa `rankArchetypes`.
 */
export function findBestArchetype(answers) {
  return rankArchetypes(answers)[0]?.archetype ?? null;
}
