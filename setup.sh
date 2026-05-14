#!/bin/bash
# ─────────────────────────────────────────────────────────────────
# Fuerza & Control — Script de setup inicial
# Ejecuta desde la RAÍZ de tu proyecto Vite:
#   bash setup.sh
# ─────────────────────────────────────────────────────────────────

set -e
echo "🏋️  Fuerza & Control — creando estructura de archivos..."

# Crear carpetas
mkdir -p src/store
mkdir -p src/data
mkdir -p src/utils
mkdir -p src/hooks
mkdir -p src/components/ui
mkdir -p src/components/home
mkdir -p src/components/workout
mkdir -p src/components/history
mkdir -p src/components/stats

echo "📁 Carpetas creadas"

# ─── src/data/exerciseLibrary.js ─────────────────────────────────
cat > src/data/exerciseLibrary.js << 'EOF'
/**
 * Librería de ejercicios con metadatos completos.
 * Cada ejercicio tiene etiquetas de patrón, músculo, equipo y nivel
 * para que el generador de planes pueda filtrar sin tocar esta lógica.
 */

export const EXERCISE_LIBRARY = {
  // ─── TRACCIÓN VERTICAL ───────────────────────────────────────────
  pull_up_weighted: {
    id: 'pull_up_weighted',
    name: 'Dominadas lastradas',
    pattern: 'vertical_pull',
    muscles: ['latissimus_dorsi', 'biceps', 'rear_deltoid'],
    equipment: ['pullup_bar', 'weight_belt'],
    level: 'intermediate',
    isKeyCandidate: true,
    progressionModel: 'double_progression',
    progressionDirection: 'increase',
    minReps: 4,
    maxReps: 6,
    weightStep: 2.5,
    restSec: 150,
    assistedVariantId: 'pull_up_assisted',
    warmup: [
      '10 retracciones escapulares en barra',
      '10 rotaciones de hombro con banda',
      '2 series de dominadas con banda al 50%',
    ],
  },

  pull_up_assisted: {
    id: 'pull_up_assisted',
    name: 'Dominadas asistidas',
    pattern: 'vertical_pull',
    muscles: ['latissimus_dorsi', 'biceps'],
    equipment: ['pullup_bar', 'resistance_band'],
    level: 'beginner',
    isKeyCandidate: true,
    progressionModel: 'double_progression',
    progressionDirection: 'decrease',
    minReps: 5,
    maxReps: 8,
    weightStep: 2.5,
    restSec: 120,
    assistedVariantId: null,
    warmup: [
      '10 retracciones escapulares en barra',
      'Dead hang pasivo 20s',
    ],
  },

  pull_up_neutral: {
    id: 'pull_up_neutral',
    name: 'Dominadas agarre neutro',
    pattern: 'vertical_pull',
    muscles: ['latissimus_dorsi', 'biceps', 'brachialis'],
    equipment: ['pullup_bar'],
    level: 'intermediate',
    isKeyCandidate: false,
    progressionModel: 'double_progression',
    progressionDirection: 'increase',
    minReps: 6,
    maxReps: 8,
    weightStep: 2.5,
    restSec: 120,
    assistedVariantId: null,
    warmup: [],
  },

  cable_row: {
    id: 'cable_row',
    name: 'Remo en polea baja',
    pattern: 'horizontal_pull',
    muscles: ['rhomboids', 'mid_trapezius', 'biceps'],
    equipment: ['cables'],
    level: 'beginner',
    isKeyCandidate: false,
    progressionModel: 'double_progression',
    progressionDirection: 'increase',
    minReps: 8,
    maxReps: 10,
    weightStep: 2.5,
    restSec: 90,
    assistedVariantId: null,
    warmup: [],
  },

  seated_row_neutral: {
    id: 'seated_row_neutral',
    name: 'Remo polea sentada agarre neutro',
    pattern: 'horizontal_pull',
    muscles: ['rhomboids', 'mid_trapezius', 'biceps'],
    equipment: ['cables'],
    level: 'beginner',
    isKeyCandidate: false,
    progressionModel: 'double_progression',
    progressionDirection: 'increase',
    minReps: 10,
    maxReps: 12,
    weightStep: 2.5,
    restSec: 90,
    assistedVariantId: null,
    warmup: [],
  },

  dip: {
    id: 'dip',
    name: 'Fondos en paralelas',
    pattern: 'vertical_push',
    muscles: ['pectoralis', 'triceps', 'anterior_deltoid'],
    equipment: ['parallettes', 'dip_bar'],
    level: 'intermediate',
    isKeyCandidate: true,
    progressionModel: 'double_progression',
    progressionDirection: 'increase',
    minReps: 5,
    maxReps: 8,
    weightStep: 2.5,
    restSec: 150,
    assistedVariantId: 'dip_assisted',
    warmup: [
      '10 fondos de hombros en paralelas',
      '10 rotaciones de hombro',
      '5 dips con peso corporal sin bajar del todo',
    ],
  },

  dip_assisted: {
    id: 'dip_assisted',
    name: 'Fondos asistidos (banda)',
    pattern: 'vertical_push',
    muscles: ['pectoralis', 'triceps', 'anterior_deltoid'],
    equipment: ['parallettes', 'dip_bar', 'resistance_band'],
    level: 'beginner',
    isKeyCandidate: true,
    progressionModel: 'double_progression',
    progressionDirection: 'decrease',
    minReps: 5,
    maxReps: 8,
    weightStep: 2.5,
    restSec: 150,
    assistedVariantId: null,
    warmup: [
      '10 fondos de hombros en paralelas',
      '10 rotaciones de hombro',
    ],
  },

  shoulder_press_db: {
    id: 'shoulder_press_db',
    name: 'Press de hombro mancuernas',
    pattern: 'vertical_push',
    muscles: ['deltoid', 'triceps', 'upper_trapezius'],
    equipment: ['dumbbells'],
    level: 'beginner',
    isKeyCandidate: false,
    progressionModel: 'double_progression',
    progressionDirection: 'increase',
    minReps: 8,
    maxReps: 10,
    weightStep: 2.5,
    restSec: 90,
    assistedVariantId: null,
    warmup: [],
  },

  push_up: {
    id: 'push_up',
    name: 'Flexiones (progresiva)',
    pattern: 'horizontal_push',
    muscles: ['pectoralis', 'triceps', 'anterior_deltoid'],
    equipment: [],
    level: 'beginner',
    isKeyCandidate: false,
    progressionModel: 'submax',
    progressionDirection: 'increase',
    minReps: null,
    maxReps: null,
    weightStep: 0,
    restSec: 90,
    assistedVariantId: null,
    warmup: [],
  },

  chest_press_machine: {
    id: 'chest_press_machine',
    name: 'Press pecho en máquina',
    pattern: 'horizontal_push',
    muscles: ['pectoralis', 'triceps', 'anterior_deltoid'],
    equipment: ['machines'],
    level: 'beginner',
    isKeyCandidate: false,
    progressionModel: 'double_progression',
    progressionDirection: 'increase',
    minReps: 10,
    maxReps: 12,
    weightStep: 2.5,
    restSec: 90,
    assistedVariantId: null,
    warmup: [],
  },

  romanian_deadlift: {
    id: 'romanian_deadlift',
    name: 'Peso muerto rumano',
    pattern: 'hip_hinge',
    muscles: ['hamstrings', 'glutes', 'erector_spinae'],
    equipment: ['barbell', 'dumbbells'],
    level: 'intermediate',
    isKeyCandidate: false,
    progressionModel: 'double_progression',
    progressionDirection: 'increase',
    minReps: 8,
    maxReps: 10,
    weightStep: 2.5,
    restSec: 120,
    assistedVariantId: null,
    warmup: [
      '10 buenos días sin peso',
      '5 reps técnicas con barra vacía',
    ],
  },

  romanian_deadlift_db: {
    id: 'romanian_deadlift_db',
    name: 'Peso muerto rumano con mancuernas',
    pattern: 'hip_hinge',
    muscles: ['hamstrings', 'glutes', 'erector_spinae'],
    equipment: ['dumbbells'],
    level: 'beginner',
    isKeyCandidate: false,
    progressionModel: 'double_progression',
    progressionDirection: 'increase',
    minReps: 10,
    maxReps: 12,
    weightStep: 2.5,
    restSec: 120,
    assistedVariantId: null,
    warmup: [],
  },

  kettlebell_swing: {
    id: 'kettlebell_swing',
    name: 'Swing con kettlebell',
    pattern: 'hip_hinge',
    muscles: ['hamstrings', 'glutes', 'erector_spinae'],
    equipment: ['kettlebell'],
    level: 'intermediate',
    isKeyCandidate: false,
    progressionModel: 'double_progression',
    progressionDirection: 'increase',
    minReps: 12,
    maxReps: 15,
    weightStep: 4,
    restSec: 90,
    assistedVariantId: null,
    warmup: [],
  },

  bulgarian_split_squat: {
    id: 'bulgarian_split_squat',
    name: 'Sentadilla búlgara',
    pattern: 'squat',
    muscles: ['quadriceps', 'glutes', 'hamstrings'],
    equipment: ['dumbbells'],
    level: 'intermediate',
    isKeyCandidate: false,
    progressionModel: 'double_progression',
    progressionDirection: 'increase',
    minReps: 8,
    maxReps: 8,
    weightStep: 2.5,
    restSec: 120,
    isUnilateral: true,
    assistedVariantId: 'split_squat_static',
    warmup: [],
  },

  split_squat_static: {
    id: 'split_squat_static',
    name: 'Zancada estática (split squat)',
    pattern: 'squat',
    muscles: ['quadriceps', 'glutes'],
    equipment: ['dumbbells'],
    level: 'beginner',
    isKeyCandidate: false,
    progressionModel: 'double_progression',
    progressionDirection: 'increase',
    minReps: 8,
    maxReps: 10,
    weightStep: 2.5,
    restSec: 90,
    isUnilateral: true,
    assistedVariantId: null,
    warmup: [],
  },

  walking_lunge: {
    id: 'walking_lunge',
    name: 'Zancada caminando',
    pattern: 'squat',
    muscles: ['quadriceps', 'glutes', 'hamstrings'],
    equipment: ['dumbbells'],
    level: 'intermediate',
    isKeyCandidate: false,
    progressionModel: 'double_progression',
    progressionDirection: 'increase',
    minReps: 10,
    maxReps: 10,
    weightStep: 2.5,
    restSec: 90,
    isUnilateral: true,
    assistedVariantId: 'split_squat_static',
    warmup: [],
  },

  leg_press_high: {
    id: 'leg_press_high',
    name: 'Prensa (pies altos)',
    pattern: 'squat',
    muscles: ['glutes', 'hamstrings', 'quadriceps'],
    equipment: ['machines'],
    level: 'beginner',
    isKeyCandidate: false,
    progressionModel: 'double_progression',
    progressionDirection: 'increase',
    minReps: 10,
    maxReps: 12,
    weightStep: 5,
    restSec: 90,
    assistedVariantId: null,
    warmup: [],
  },

  hip_thrust: {
    id: 'hip_thrust',
    name: 'Hip thrust',
    pattern: 'hip_hinge',
    muscles: ['glutes', 'hamstrings'],
    equipment: ['barbell', 'machines'],
    level: 'beginner',
    isKeyCandidate: false,
    progressionModel: 'double_progression',
    progressionDirection: 'increase',
    minReps: 10,
    maxReps: 12,
    weightStep: 5,
    restSec: 90,
    assistedVariantId: null,
    warmup: [],
  },

  hip_abduction_machine: {
    id: 'hip_abduction_machine',
    name: 'Abducción en máquina',
    pattern: 'abduction',
    muscles: ['glutes', 'hip_abductors'],
    equipment: ['machines'],
    level: 'beginner',
    isKeyCandidate: false,
    progressionModel: 'double_progression',
    progressionDirection: 'increase',
    minReps: 12,
    maxReps: 15,
    weightStep: 2.5,
    restSec: 60,
    assistedVariantId: null,
    warmup: [],
  },

  leg_curl_lying: {
    id: 'leg_curl_lying',
    name: 'Curl isquios tumbada',
    pattern: 'knee_flexion',
    muscles: ['hamstrings'],
    equipment: ['machines'],
    level: 'beginner',
    isKeyCandidate: false,
    progressionModel: 'double_progression',
    progressionDirection: 'increase',
    minReps: 10,
    maxReps: 12,
    weightStep: 2.5,
    restSec: 60,
    assistedVariantId: null,
    warmup: [],
  },

  leg_extension: {
    id: 'leg_extension',
    name: 'Extensión cuádriceps',
    pattern: 'knee_extension',
    muscles: ['quadriceps'],
    equipment: ['machines'],
    level: 'beginner',
    isKeyCandidate: false,
    progressionModel: 'double_progression',
    progressionDirection: 'increase',
    minReps: 12,
    maxReps: 15,
    weightStep: 2.5,
    restSec: 60,
    assistedVariantId: null,
    warmup: [],
  },

  goblet_squat: {
    id: 'goblet_squat',
    name: 'Sentadilla goblet',
    pattern: 'squat',
    muscles: ['quadriceps', 'glutes'],
    equipment: ['dumbbells', 'kettlebell'],
    level: 'beginner',
    isKeyCandidate: false,
    progressionModel: 'double_progression',
    progressionDirection: 'increase',
    minReps: 10,
    maxReps: 12,
    weightStep: 4,
    restSec: 90,
    assistedVariantId: null,
    warmup: [],
  },

  bicep_curl_supination: {
    id: 'bicep_curl_supination',
    name: 'Curl bíceps supinación',
    pattern: 'elbow_flexion',
    muscles: ['biceps', 'brachialis'],
    equipment: ['dumbbells'],
    level: 'beginner',
    isKeyCandidate: false,
    progressionModel: 'double_progression',
    progressionDirection: 'increase',
    minReps: 10,
    maxReps: 12,
    weightStep: 1.25,
    restSec: 60,
    assistedVariantId: null,
    warmup: [],
  },

  pulldown_neutral: {
    id: 'pulldown_neutral',
    name: 'Pull-down agarre neutro',
    pattern: 'vertical_pull',
    muscles: ['latissimus_dorsi', 'biceps'],
    equipment: ['cables'],
    level: 'beginner',
    isKeyCandidate: false,
    progressionModel: 'double_progression',
    progressionDirection: 'increase',
    minReps: 10,
    maxReps: 12,
    weightStep: 2.5,
    restSec: 90,
    assistedVariantId: null,
    warmup: [],
  },

  hollow_body_hold: {
    id: 'hollow_body_hold',
    name: 'Hollow body hold',
    pattern: 'core_static',
    muscles: ['rectus_abdominis', 'hip_flexors'],
    equipment: [],
    level: 'beginner',
    isKeyCandidate: false,
    progressionModel: 'time_progression',
    progressionDirection: 'increase',
    minTime: 20,
    maxTime: 40,
    timeStep: 5,
    weightStep: 0,
    restSec: 60,
    assistedVariantId: null,
    warmup: [],
  },

  l_sit: {
    id: 'l_sit',
    name: 'L-sit en paralelas',
    pattern: 'core_compression',
    muscles: ['hip_flexors', 'rectus_abdominis', 'triceps'],
    equipment: ['parallettes'],
    level: 'intermediate',
    isKeyCandidate: false,
    progressionModel: 'time_progression',
    progressionDirection: 'increase',
    minTime: 10,
    maxTime: 25,
    timeStep: 5,
    weightStep: 0,
    restSec: 90,
    assistedVariantId: null,
    warmup: [],
  },

  dead_hang: {
    id: 'dead_hang',
    name: 'Dead hang activo',
    pattern: 'grip_scapular',
    muscles: ['latissimus_dorsi', 'serratus', 'forearms'],
    equipment: ['pullup_bar'],
    level: 'beginner',
    isKeyCandidate: false,
    progressionModel: 'time_progression',
    progressionDirection: 'increase',
    minTime: 30,
    maxTime: 45,
    timeStep: 5,
    weightStep: 0,
    restSec: 60,
    assistedVariantId: null,
    warmup: [],
  },

  ab_wheel_rollout: {
    id: 'ab_wheel_rollout',
    name: 'Ab wheel rollout',
    pattern: 'core_dynamic',
    muscles: ['rectus_abdominis', 'hip_flexors', 'latissimus_dorsi'],
    equipment: ['ab_wheel'],
    level: 'intermediate',
    isKeyCandidate: false,
    progressionModel: 'double_progression',
    progressionDirection: 'increase',
    minReps: 6,
    maxReps: 10,
    weightStep: 0,
    restSec: 60,
    assistedVariantId: null,
    warmup: [],
  },

  dead_bug: {
    id: 'dead_bug',
    name: 'Dead bug',
    pattern: 'core_dynamic',
    muscles: ['rectus_abdominis', 'hip_flexors'],
    equipment: [],
    level: 'beginner',
    isKeyCandidate: false,
    progressionModel: 'double_progression',
    progressionDirection: 'increase',
    minReps: 8,
    maxReps: 12,
    weightStep: 0,
    restSec: 60,
    assistedVariantId: null,
    warmup: [],
  },

  plank: {
    id: 'plank',
    name: 'Plancha frontal',
    pattern: 'core_static',
    muscles: ['rectus_abdominis', 'transverse_abdominis', 'shoulders'],
    equipment: [],
    level: 'beginner',
    isKeyCandidate: false,
    progressionModel: 'time_progression',
    progressionDirection: 'increase',
    minTime: 30,
    maxTime: 60,
    timeStep: 10,
    weightStep: 0,
    restSec: 60,
    assistedVariantId: null,
    warmup: [],
  },

  leg_raise_lying: {
    id: 'leg_raise_lying',
    name: 'Elevación de piernas tumbada',
    pattern: 'core_dynamic',
    muscles: ['rectus_abdominis', 'hip_flexors'],
    equipment: [],
    level: 'beginner',
    isKeyCandidate: false,
    progressionModel: 'double_progression',
    progressionDirection: 'increase',
    minReps: 10,
    maxReps: 15,
    weightStep: 0,
    restSec: 60,
    assistedVariantId: null,
    warmup: [],
  },

  glute_bridge_unilateral: {
    id: 'glute_bridge_unilateral',
    name: 'Puente glúteo unilateral',
    pattern: 'hip_hinge',
    muscles: ['glutes', 'hamstrings'],
    equipment: [],
    level: 'beginner',
    isKeyCandidate: false,
    progressionModel: 'double_progression',
    progressionDirection: 'increase',
    minReps: 10,
    maxReps: 12,
    weightStep: 0,
    restSec: 60,
    isUnilateral: true,
    assistedVariantId: null,
    warmup: [],
  },
};
EOF
echo "✅ exerciseLibrary.js"

# ─── src/data/programs.js ────────────────────────────────────────
cat > src/data/programs.js << 'EOF'
export const PROGRAMS = {
  prog_001: {
    id: 'prog_001',
    name: 'Fuerza & Control — Full Body',
    type: 'primary',
    status: 'active',
    createdAt: '2026-04-01',
    currentWeek: 6,
    onboardingSnapshot: {
      trainingType: 'full_body',
      daysPerWeek: 3,
      equipment: ['barbell', 'dumbbells', 'cables', 'kettlebell', 'pullup_bar', 'parallettes'],
      level: 'intermediate',
      goal: 'functional_aerial',
    },
    days: [
      { sessionTemplateId: 'tpl_A', label: 'A', emphasis: 'pull' },
      { sessionTemplateId: 'tpl_B', label: 'B', emphasis: 'push' },
      { sessionTemplateId: 'tpl_C', label: 'C', emphasis: 'legs' },
    ],
  },
  prog_002: {
    id: 'prog_002',
    name: 'Full Body Hipertrofia — Máquinas',
    type: 'secondary',
    status: 'active',
    createdAt: '2026-05-01',
    currentWeek: 1,
    onboardingSnapshot: {
      trainingType: 'full_body',
      daysPerWeek: 3,
      equipment: ['machines', 'dumbbells', 'cables'],
      level: 'beginner',
      goal: 'hypertrophy',
    },
    days: [
      { sessionTemplateId: 'tpl_D', label: 'A', emphasis: 'glutes_push' },
      { sessionTemplateId: 'tpl_E', label: 'B', emphasis: 'legs_pull' },
      { sessionTemplateId: 'tpl_F', label: 'C', emphasis: 'full' },
    ],
  },
};

export const SESSION_TEMPLATES = {
  tpl_A: {
    id: 'tpl_A', programId: 'prog_001', label: 'A',
    name: 'Tracción prioritaria', emphasis: 'pull', color: '#e8ff47',
    generatedWarmup: [
      '10 retracciones escapulares en barra',
      '10 rotaciones de hombro con banda',
      '2 series de dominadas con banda al 50%',
    ],
    exercises: [
      { exerciseId: 'pull_up_weighted', order: 1, isKey: true,  sets: 4, restSec: 150, progressionOverride: null },
      { exerciseId: 'romanian_deadlift', order: 2, isKey: false, sets: 3, restSec: 120, progressionOverride: null },
      { exerciseId: 'cable_row',         order: 3, isKey: false, sets: 3, restSec: 90,  progressionOverride: null },
      { exerciseId: 'push_up',           order: 4, isKey: false, sets: 3, restSec: 90,  progressionOverride: null },
      { exerciseId: 'hollow_body_hold',  order: 5, isKey: false, sets: 3, restSec: 60,  progressionOverride: null },
    ],
  },
  tpl_B: {
    id: 'tpl_B', programId: 'prog_001', label: 'B',
    name: 'Empuje prioritario', emphasis: 'push', color: '#ff6b35',
    generatedWarmup: [
      '10 fondos de hombros en paralelas',
      '10 rotaciones de hombro',
      '5 dips con peso corporal sin bajar del todo',
    ],
    exercises: [
      { exerciseId: 'dip',                   order: 1, isKey: true,  sets: 4, restSec: 150, progressionOverride: null },
      { exerciseId: 'bulgarian_split_squat', order: 2, isKey: false, sets: 3, restSec: 120, progressionOverride: null },
      { exerciseId: 'pull_up_neutral',       order: 3, isKey: false, sets: 3, restSec: 120, progressionOverride: null },
      { exerciseId: 'l_sit',                 order: 4, isKey: false, sets: 4, restSec: 90,  progressionOverride: null },
      { exerciseId: 'bicep_curl_supination', order: 5, isKey: false, sets: 3, restSec: 60,  progressionOverride: null },
    ],
  },
  tpl_C: {
    id: 'tpl_C', programId: 'prog_001', label: 'C',
    name: 'Pierna prioritaria', emphasis: 'legs', color: '#7eb8ff',
    generatedWarmup: [
      '5 min caminata ligera',
      '10 círculos de cadera cada lado',
      '10 sentadillas de activación sin peso',
    ],
    exercises: [
      { exerciseId: 'kettlebell_swing',  order: 1, isKey: false, sets: 4, restSec: 90,  progressionOverride: null },
      { exerciseId: 'walking_lunge',     order: 2, isKey: false, sets: 3, restSec: 90,  progressionOverride: null },
      { exerciseId: 'shoulder_press_db', order: 3, isKey: false, sets: 3, restSec: 90,  progressionOverride: null },
      { exerciseId: 'dead_hang',         order: 4, isKey: false, sets: 3, restSec: 60,  progressionOverride: null },
      { exerciseId: 'ab_wheel_rollout',  order: 5, isKey: false, sets: 3, restSec: 60,  progressionOverride: null },
    ],
  },
  tpl_D: {
    id: 'tpl_D', programId: 'prog_002', label: 'A',
    name: 'Glúteo y empuje', emphasis: 'glutes_push', color: '#e8ff47',
    generatedWarmup: ['5 min bicicleta estática suave', '10 puentes de glúteo sin peso', '10 círculos de rodilla'],
    exercises: [
      { exerciseId: 'hip_thrust',            order: 1, isKey: true,  sets: 3, restSec: 90, progressionOverride: null },
      { exerciseId: 'leg_press_high',        order: 2, isKey: false, sets: 3, restSec: 90, progressionOverride: null },
      { exerciseId: 'hip_abduction_machine', order: 3, isKey: false, sets: 3, restSec: 60, progressionOverride: null },
      { exerciseId: 'pulldown_neutral',      order: 4, isKey: false, sets: 3, restSec: 90, progressionOverride: null },
      { exerciseId: 'dead_bug',              order: 5, isKey: false, sets: 3, restSec: 60, progressionOverride: null },
    ],
  },
  tpl_E: {
    id: 'tpl_E', programId: 'prog_002', label: 'B',
    name: 'Pierna y tracción', emphasis: 'legs_pull', color: '#ff6b35',
    generatedWarmup: ['5 min caminata ligera', '10 buenos días sin peso', '10 extensiones de rodilla sin peso'],
    exercises: [
      { exerciseId: 'romanian_deadlift_db', order: 1, isKey: true,  sets: 3, restSec: 120, progressionOverride: null },
      { exerciseId: 'leg_curl_lying',       order: 2, isKey: false, sets: 3, restSec: 60,  progressionOverride: null },
      { exerciseId: 'split_squat_static',   order: 3, isKey: false, sets: 3, restSec: 90,  progressionOverride: null },
      { exerciseId: 'chest_press_machine',  order: 4, isKey: false, sets: 3, restSec: 90,  progressionOverride: null },
      { exerciseId: 'plank',                order: 5, isKey: false, sets: 3, restSec: 60,  progressionOverride: null },
    ],
  },
  tpl_F: {
    id: 'tpl_F', programId: 'prog_002', label: 'C',
    name: 'Full body', emphasis: 'full', color: '#7eb8ff',
    generatedWarmup: ['5 min bicicleta estática', '10 círculos de cadera', '10 sentadillas activación'],
    exercises: [
      { exerciseId: 'goblet_squat',           order: 1, isKey: true,  sets: 3, restSec: 90, progressionOverride: null },
      { exerciseId: 'glute_bridge_unilateral',order: 2, isKey: false, sets: 3, restSec: 60, progressionOverride: null },
      { exerciseId: 'leg_extension',          order: 3, isKey: false, sets: 3, restSec: 60, progressionOverride: null },
      { exerciseId: 'seated_row_neutral',     order: 4, isKey: false, sets: 3, restSec: 90, progressionOverride: null },
      { exerciseId: 'leg_raise_lying',        order: 5, isKey: false, sets: 3, restSec: 60, progressionOverride: null },
    ],
  },
};
EOF
echo "✅ programs.js"

# ─── src/utils/progression.js ────────────────────────────────────
cat > src/utils/progression.js << 'EOF'
export function getProgression(exerciseDef, lastSets) {
  if (!lastSets || !lastSets.length) return null;
  const doneSets = lastSets.filter((s) => s.done);
  if (!doneSets.length) return null;
  const model = exerciseDef.progressionModel;

  if (model === 'time_progression') {
    const times = doneSets.map((s) => parseFloat(s.time) || 0).filter((t) => t > 0);
    if (!times.length) return null;
    const { minTime, maxTime, timeStep } = exerciseDef;
    const allHitMax = doneSets.length >= exerciseDef.sets && times.every((t) => t >= maxTime);
    const allOk = times.every((t) => t >= minTime);
    if (allHitMax) return { type: 'up', icon: '⬆', msg: `Objetivo superado. Progresa a ${maxTime + timeStep}s por serie la próxima vez.`, suggestedWeight: null, suggestedTime: maxTime + timeStep };
    if (allOk) return { type: 'hold', icon: '→', msg: `Bien. Consolida el rango ${minTime}–${maxTime}s antes de subir.`, suggestedWeight: null, suggestedTime: maxTime };
    return { type: 'hold', icon: '→', msg: `Sigue trabajando en el rango ${minTime}–${maxTime}s. Sin prisa.`, suggestedWeight: null, suggestedTime: null };
  }

  if (model === 'submax') {
    const total = doneSets.reduce((acc, s) => acc + (parseInt(s.reps) || 0), 0);
    if (!total) return null;
    return { type: 'info', icon: '📊', msg: `Sesión anterior: ${total} reps en ${doneSets.length} series. Supera esa marca hoy.`, suggestedWeight: null, suggestedTime: null };
  }

  if (model === 'double_progression') {
    const { minReps, maxReps, weightStep, sets, progressionDirection = 'increase' } = exerciseDef;
    const weights = doneSets.map((s) => parseFloat(s.weight) || 0);
    const reps = doneSets.map((s) => parseInt(s.reps) || 0);
    const maxW = Math.max(...weights);
    const completionRate = doneSets.length / sets;
    const validReps = reps.filter((r) => r > 0);
    const avgReps = validReps.length ? validReps.reduce((a, b) => a + b, 0) / validReps.length : 0;
    const allHitMax = completionRate >= 1 && reps.every((r) => r >= maxReps);
    const mostHitMin = completionRate >= 0.8 && avgReps >= minReps;
    const struggling = completionRate < 0.6;

    if (progressionDirection === 'decrease') {
      const assistance = maxW;
      if (allHitMax && assistance > 0) {
        const next = Math.max(0, assistance - weightStep);
        return { type: 'up', icon: '⬆', msg: next === 0 ? `¡Excelente! Intenta sin asistencia la próxima vez.` : `Todas las series al máximo. Reduce la asistencia a ${next}kg.`, suggestedWeight: next, suggestedTime: null };
      }
      if (allHitMax && assistance === 0) return { type: 'up', icon: '⬆', msg: '¡Todas las series sin asistencia! Pasa a la versión lastrada.', suggestedWeight: 0, suggestedTime: null };
      if (mostHitMin) return { type: 'hold', icon: '→', msg: `Consolida con ${assistance > 0 ? assistance + 'kg de asistencia' : 'sin asistencia'} y busca más reps.`, suggestedWeight: assistance || null, suggestedTime: null };
      if (struggling) return { type: 'down', icon: '⬇', msg: `No llegaste al mínimo. Aumenta la asistencia a ${assistance + weightStep}kg.`, suggestedWeight: assistance + weightStep, suggestedTime: null };
      return { type: 'hold', icon: '→', msg: `Sigue con ${assistance > 0 ? assistance + 'kg de asistencia' : 'sin asistencia'} y foco en la técnica.`, suggestedWeight: assistance || null, suggestedTime: null };
    }

    if (allHitMax) return { type: 'up', icon: '⬆', msg: `Todas las series al máximo. Sube a ${maxW + weightStep}kg la próxima vez.`, suggestedWeight: maxW + weightStep, suggestedTime: null };
    if (mostHitMin) return { type: 'hold', icon: '→', msg: `Bien ejecutado. Mantén ${maxW > 0 ? maxW + 'kg' : 'el peso'} y busca más reps.`, suggestedWeight: maxW || null, suggestedTime: null };
    if (struggling && maxW > 0 && weightStep > 0) return { type: 'down', icon: '⬇', msg: `No llegaste al mínimo. Prueba con ${Math.max(0, maxW - weightStep)}kg.`, suggestedWeight: Math.max(0, maxW - weightStep), suggestedTime: null };
    return { type: 'hold', icon: '→', msg: `Sigue con ${maxW > 0 ? maxW + 'kg' : 'el mismo peso'} y foco en la técnica.`, suggestedWeight: maxW || null, suggestedTime: null };
  }

  return null;
}

export function summarizeSets(exerciseDef, doneSets) {
  if (!doneSets || !doneSets.length) return '—';
  const model = exerciseDef?.progressionModel;
  if (model === 'time_progression') {
    const times = doneSets.map((s) => s.time).filter(Boolean);
    return times.length ? times.join('/') + 's' : '—';
  }
  if (model === 'submax') {
    const total = doneSets.reduce((acc, s) => acc + (parseInt(s.reps) || 0), 0);
    return total ? `${total} reps tot.` : '—';
  }
  const maxW = Math.max(...doneSets.map((s) => parseFloat(s.weight) || 0));
  const repsList = doneSets.map((s) => s.reps).filter(Boolean).join('/');
  if (maxW > 0) return `${maxW}kg · ${repsList}`;
  if (repsList) return `${repsList} reps`;
  return '—';
}
EOF
echo "✅ progression.js"

# ─── src/utils/storage.js ────────────────────────────────────────
cat > src/utils/storage.js << 'EOF'
const EXPORT_VERSION = '1';

export function exportToJSON(storeState) {
  return JSON.stringify({
    version: EXPORT_VERSION,
    exportDate: new Date().toISOString().split('T')[0],
    appName: 'Fuerza & Control',
    profile: storeState.profile,
    workoutLog: storeState.workoutLog,
  }, null, 2);
}

export function downloadJSON(jsonString) {
  const date = new Date().toISOString().split('T')[0];
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `fc-tracker-backup-${date}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function importFromJSON(jsonString) {
  try {
    const parsed = JSON.parse(jsonString);
    if (!parsed.version) return { ok: false, error: 'El archivo no tiene campo "version". No es un backup válido.' };
    if (parsed.version !== EXPORT_VERSION) return { ok: false, error: `Versión del backup (${parsed.version}) no compatible.` };
    if (!Array.isArray(parsed.workoutLog)) return { ok: false, error: 'El backup no contiene un historial válido.' };
    return { ok: true, data: parsed };
  } catch {
    return { ok: false, error: 'El archivo no es un JSON válido.' };
  }
}

export function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
    reader.readAsText(file);
  });
}
EOF
echo "✅ storage.js"

# ─── src/utils/formatters.js ─────────────────────────────────────
cat > src/utils/formatters.js << 'EOF'
export function formatDate(ts) {
  return new Date(ts).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
}

export function formatDateTime(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) + ' · ' + d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

export function generateId(prefix = 'id') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export function formatSeconds(secs) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `${s}s`;
}
EOF
echo "✅ formatters.js"

# ─── src/store/useStore.js ───────────────────────────────────────
cat > src/store/useStore.js << 'EOF'
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { EXERCISE_LIBRARY } from '../data/exerciseLibrary';
import { SESSION_TEMPLATES, PROGRAMS } from '../data/programs';
import { getProgression } from '../utils/progression';
import { generateId } from '../utils/formatters';
import { exportToJSON, downloadJSON, importFromJSON, readFileAsText } from '../utils/storage';

const INITIAL_PROFILE = { name: 'Usuario', activeProgramId: 'prog_001', secondaryProgramIds: [], onboardingAnswers: {}, goals: [], bodyWeight: null };
const INITIAL_ACTIVE_SESSION = { templateId: null, setsState: {}, startedAt: null };
const INITIAL_UI = { view: 'home', toast: null, restTimer: { active: false, remaining: 0, total: 0, exerciseName: '' } };

export const useStore = create(
  persist(
    (set, get) => ({
      profile: INITIAL_PROFILE,
      workoutLog: [],
      activeSession: INITIAL_ACTIVE_SESSION,
      ui: INITIAL_UI,
      exerciseLibrary: EXERCISE_LIBRARY,
      sessionTemplates: SESSION_TEMPLATES,
      programs: PROGRAMS,

      setProfile: (updates) => set((s) => ({ profile: { ...s.profile, ...updates } })),
      setActiveProgram: (programId) => set((s) => ({ profile: { ...s.profile, activeProgramId: programId } })),

      startSession: (templateId) => {
        const template = SESSION_TEMPLATES[templateId];
        if (!template) return;
        const setsState = {};
        template.exercises.forEach(({ exerciseId, sets }) => {
          setsState[exerciseId] = Array.from({ length: sets }, () => ({ weight: '', reps: '', time: '', done: false }));
        });
        set({ activeSession: { templateId, setsState, startedAt: Date.now() }, ui: { ...get().ui, view: 'workout' } });
        window.scrollTo(0, 0);
      },

      updateSetField: (exerciseId, setIndex, field, value) =>
        set((s) => {
          const prev = s.activeSession.setsState[exerciseId] ?? [];
          const updated = prev.map((x, i) => i === setIndex ? { ...x, [field]: value } : x);
          return { activeSession: { ...s.activeSession, setsState: { ...s.activeSession.setsState, [exerciseId]: updated } } };
        }),

      toggleSetDone: (exerciseId, setIndex) => {
        const state = get();
        const prev = state.activeSession.setsState[exerciseId] ?? [];
        const wasDone = prev[setIndex]?.done ?? false;
        const updated = prev.map((x, i) => i === setIndex ? { ...x, done: !x.done } : x);
        set((s) => ({ activeSession: { ...s.activeSession, setsState: { ...s.activeSession.setsState, [exerciseId]: updated } } }));
        if (!wasDone) {
          const template = SESSION_TEMPLATES[state.activeSession.templateId];
          const exConfig = template?.exercises.find((e) => e.exerciseId === exerciseId);
          const exDef = EXERCISE_LIBRARY[exerciseId];
          get().startRestTimer(exConfig?.restSec ?? exDef?.restSec ?? 90, exDef?.name ?? exerciseId);
        } else {
          get().stopRestTimer();
        }
      },

      saveSession: () => {
        const { templateId, setsState, startedAt } = get().activeSession;
        if (!templateId) return { ok: false, error: 'No hay sesión activa' };
        const template = SESSION_TEMPLATES[templateId];
        const hasData = Object.values(setsState).some((sets) => sets.some((s) => s.weight || s.reps || s.time || s.done));
        if (!hasData) return { ok: false, error: 'Introduce algún dato primero' };
        const exercises = template.exercises.map(({ exerciseId, isKey }) => {
          const sets = setsState[exerciseId] ?? [];
          return { exerciseId, isKey, sets, progressionResult: getProgression(EXERCISE_LIBRARY[exerciseId], sets) };
        });
        const logEntry = { id: generateId('log'), sessionTemplateId: templateId, programId: template.programId, timestamp: Date.now(), startedAt, isBadDay: false, notes: '', bodyWeight: null, exercises };
        set((s) => ({ workoutLog: [...s.workoutLog, logEntry], activeSession: INITIAL_ACTIVE_SESSION }));
        get().stopRestTimer();
        return { ok: true };
      },

      discardSession: () => { get().stopRestTimer(); set({ activeSession: INITIAL_ACTIVE_SESSION }); get().navigate('home'); },

      deleteLogEntry: (logId) => set((s) => ({ workoutLog: s.workoutLog.filter((e) => e.id !== logId) })),

      getLastSession: (templateId) => get().workoutLog.filter((e) => e.sessionTemplateId === templateId).sort((a, b) => b.timestamp - a.timestamp)[0] ?? null,

      getExerciseLogs: (exerciseId, limit = 6) =>
        get().workoutLog
          .filter((log) => log.exercises.some((e) => e.exerciseId === exerciseId))
          .sort((a, b) => a.timestamp - b.timestamp)
          .slice(-limit)
          .map((log) => ({ timestamp: log.timestamp, exercise: log.exercises.find((e) => e.exerciseId === exerciseId) })),

      startRestTimer: (seconds, exerciseName) => {
        const { _restInterval } = get();
        if (_restInterval) clearInterval(_restInterval);
        set((s) => ({ ui: { ...s.ui, restTimer: { active: true, remaining: seconds, total: seconds, exerciseName } } }));
        const interval = setInterval(() => {
          const next = get().ui.restTimer.remaining - 1;
          if (next <= 0) {
            clearInterval(get()._restInterval);
            set((s) => ({ _restInterval: null, ui: { ...s.ui, restTimer: { ...s.ui.restTimer, active: false, remaining: 0 } } }));
            if ('vibrate' in navigator) navigator.vibrate([200, 100, 200]);
            get().showToast('¡Siguiente serie!');
            return;
          }
          set((s) => ({ ui: { ...s.ui, restTimer: { ...s.ui.restTimer, remaining: next } } }));
        }, 1000);
        set({ _restInterval: interval });
      },

      stopRestTimer: () => {
        const { _restInterval } = get();
        if (_restInterval) clearInterval(_restInterval);
        set((s) => ({ _restInterval: null, ui: { ...s.ui, restTimer: { active: false, remaining: 0, total: 0, exerciseName: '' } } }));
      },

      navigate: (view) => { set((s) => ({ ui: { ...s.ui, view } })); window.scrollTo(0, 0); },

      showToast: (msg, duration = 2200) => {
        const id = generateId('toast');
        set((s) => ({ ui: { ...s.ui, toast: { msg, id } } }));
        setTimeout(() => { if (get().ui.toast?.id === id) set((s) => ({ ui: { ...s.ui, toast: null } })); }, duration);
      },

      exportData: () => { const s = get(); downloadJSON(exportToJSON({ profile: s.profile, workoutLog: s.workoutLog })); },

      importData: async (file) => {
        try {
          const text = await readFileAsText(file);
          const result = importFromJSON(text);
          if (!result.ok) { get().showToast('⚠️ ' + result.error); return { ok: false }; }
          set({ profile: result.data.profile ?? get().profile, workoutLog: result.data.workoutLog ?? [] });
          get().showToast('✓ Datos importados correctamente');
          return { ok: true };
        } catch { get().showToast('⚠️ Error al leer el archivo'); return { ok: false }; }
      },
    }),
    {
      name: 'fc_tracker_v1',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ profile: s.profile, workoutLog: s.workoutLog }),
    }
  )
);

export const selectView = (s) => s.ui.view;
export const selectToast = (s) => s.ui.toast;
export const selectRestTimer = (s) => s.ui.restTimer;
export const selectActiveSession = (s) => s.activeSession;
export const selectExerciseSets = (exerciseId) => (s) => s.activeSession.setsState[exerciseId] ?? [];
export const selectWorkoutLog = (s) => [...s.workoutLog].sort((a, b) => b.timestamp - a.timestamp);
export const selectProfile = (s) => s.profile;
export const selectActiveProgram = (s) => s.programs[s.profile.activeProgramId];
EOF
echo "✅ useStore.js"

# ─── src/hooks/useRestTimer.js ───────────────────────────────────
cat > src/hooks/useRestTimer.js << 'EOF'
import { useStore, selectRestTimer } from '../store/useStore';

export function useRestTimer() {
  const restTimer = useStore(selectRestTimer);
  const stopRestTimer = useStore((s) => s.stopRestTimer);
  const { active, remaining, total, exerciseName } = restTimer;
  const CIRCUMFERENCE = 113.1;
  const strokeDashoffset = total > 0 ? CIRCUMFERENCE * (remaining / total) : 0;
  return { active, remaining, total, exerciseName, strokeDashoffset, CIRCUMFERENCE, skip: stopRestTimer };
}
EOF
echo "✅ useRestTimer.js"

# ─── src/hooks/useWorkout.js ─────────────────────────────────────
cat > src/hooks/useWorkout.js << 'EOF'
import { useStore, selectActiveSession } from '../store/useStore';
import { EXERCISE_LIBRARY } from '../data/exerciseLibrary';
import { SESSION_TEMPLATES } from '../data/programs';
import { getProgression, summarizeSets } from '../utils/progression';

export function useWorkout() {
  const activeSession = useStore(selectActiveSession);
  const updateSetField = useStore((s) => s.updateSetField);
  const toggleSetDone = useStore((s) => s.toggleSetDone);
  const saveSession = useStore((s) => s.saveSession);
  const discardSession = useStore((s) => s.discardSession);
  const getLastSession = useStore((s) => s.getLastSession);
  const { templateId, setsState } = activeSession;
  const template = templateId ? SESSION_TEMPLATES[templateId] : null;
  if (!template) return { template: null, exercises: [], saveSession, discardSession };
  const lastSession = getLastSession(templateId);
  const exercises = template.exercises.map(({ exerciseId, isKey, sets, restSec }) => {
    const def = EXERCISE_LIBRARY[exerciseId];
    const currentSets = setsState[exerciseId] ?? [];
    const lastExercise = lastSession?.exercises.find((e) => e.exerciseId === exerciseId);
    const lastSets = lastExercise?.sets ?? [];
    const lastDoneSets = lastSets.filter((s) => s.done);
    return { exerciseId, def, isKey, sets, restSec, currentSets, lastSets, prevSummary: summarizeSets(def, lastDoneSets), progression: getProgression(def, lastSets) };
  });
  return { template, exercises, updateSetField, toggleSetDone, saveSession, discardSession };
}
EOF
echo "✅ useWorkout.js"

# ─── src/App.jsx ─────────────────────────────────────────────────
cat > src/App.jsx << 'EOF'
import { useStore, selectView } from './store/useStore';

export default function App() {
  const view = useStore(selectView);
  return (
    <div className="min-h-screen bg-[#0d0d0d] text-[#f0f0f0] font-sans max-w-[480px] mx-auto">
      {view === 'home'    && <div className="p-8 text-center opacity-50">HomeView — pendiente</div>}
      {view === 'workout' && <div className="p-8 text-center opacity-50">WorkoutView — pendiente</div>}
      {view === 'history' && <div className="p-8 text-center opacity-50">HistoryView — pendiente</div>}
      {view === 'stats'   && <div className="p-8 text-center opacity-50">StatsView — pendiente</div>}
    </div>
  );
}
EOF
echo "✅ App.jsx"

# ─── Instalar dependencias ────────────────────────────────────────
echo ""
echo "📦 Instalando zustand..."
npm install zustand

echo ""
echo "✅ ¡Todo listo!"
echo ""
echo "Próximo paso: npm run dev"
