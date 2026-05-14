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
