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
    level: 'intermediate',
    daysPerWeek: 3,
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
    level: 'advanced',
    daysPerWeek: 3,
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
    level: 'beginner',
    daysPerWeek: 3,
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
    level: 'intermediate',
    daysPerWeek: 4,
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
  // GLÚTEO PRIORITARIO · HIPERTROFIA · INTERMEDIO
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'glutes_hypertrophy_intermediate',
    name: 'Glúteo Prioritario · Hipertrofia',
    tags: ['glutes_focus', 'hypertrophy', 'intermediate'],
    discipline: 'glutes_legs', distribution: 'full_body',
    goal: 'hypertrophy',
    level: 'intermediate',
    daysPerWeek: 3,
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
    level: 'intermediate',
    daysPerWeek: 3,
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
 * Encuentra el arquetipo más adecuado para los parámetros del onboarding.
 * Devuelve el arquetipo o null si no hay coincidencia.
 */
export function findBestArchetype(answers) {
  const { discipline, distribution, goal, level, daysPerWeek } = answers;

  // Coincidencia exacta: disciplina + distribución + objetivo + nivel + días
  const exact = ARCHETYPES.find(
    (a) => a.discipline === discipline && a.distribution === distribution
      && a.goal === goal && a.level === level && a.daysPerWeek === daysPerWeek
  );
  if (exact) return exact;

  // Disciplina + distribución + nivel + días (ignorar objetivo)
  const byDisciplineLevel = ARCHETYPES.find(
    (a) => a.discipline === discipline && a.distribution === distribution
      && a.level === level && a.daysPerWeek === daysPerWeek
  );
  if (byDisciplineLevel) return byDisciplineLevel;

  // Disciplina + distribución + días (ignorar nivel y objetivo)
  const byDiscipline = ARCHETYPES.find(
    (a) => a.discipline === discipline && a.distribution === distribution
      && a.daysPerWeek === daysPerWeek
  );
  if (byDiscipline) return byDiscipline;

  // Sin coincidencia — el generador procedural manejará el caso
  return null;
}
