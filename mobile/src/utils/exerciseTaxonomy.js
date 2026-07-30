/**
 * Taxonomía compartida de la librería de ejercicios — patrón de movimiento,
 * grupo muscular y equipo. Única fuente de verdad para el buscador
 * (`ExerciseSelectorScreen`) y el alta de ejercicios (`CustomExerciseScreen`),
 * para que ambos filtren/clasifiquen exactamente igual.
 */

// Los 9 `pattern` de la librería (valor exacto que se guarda en el ejercicio).
export const PATTERNS = [
  'vertical_pull', 'horizontal_pull', 'vertical_push', 'horizontal_push',
  'squat', 'hip_hinge', 'core', 'carry_grip', 'calf_raise',
];

// Colapso a 7 grupos gruesos para la fila de pills del buscador (vertical y
// horizontal funden en un solo Empuje/Tracción — decisión del usuario).
export const PATTERN_GROUPS = [
  { id: 'push',  patterns: ['vertical_push', 'horizontal_push'] },
  { id: 'pull',  patterns: ['vertical_pull', 'horizontal_pull'] },
  { id: 'squat', patterns: ['squat'] },
  { id: 'hinge', patterns: ['hip_hinge'] },
  { id: 'core',  patterns: ['core'] },
  { id: 'grip',  patterns: ['carry_grip'] },
  { id: 'calf',  patterns: ['calf_raise'] },
];
export const GROUP_OF_PATTERN = Object.fromEntries(
  PATTERN_GROUPS.flatMap((g) => g.patterns.map((p) => [p, g.id]))
);

// Los 9 `primaryGroup` reales de la librería.
export const MUSCLE_GROUPS = [
  'chest', 'back', 'shoulders', 'arms',
  'quads', 'glutes_hamstrings', 'legs_lower', 'core', 'grip',
];

// `arms` se abre en Bíceps/Tríceps para el filtro del buscador, a partir de
// `muscles[]` (la ficha del ejercicio no tiene un grupo separado para cada uno).
export function muscleGroupIdsOf(ex) {
  if (ex.primaryGroup !== 'arms') return [ex.primaryGroup];
  const ids = [];
  if (ex.muscles?.includes('triceps')) ids.push('triceps');
  if (ex.muscles?.some((m) => m === 'biceps' || m === 'brachialis')) ids.push('biceps');
  return ids;
}

// 'bodyweight' no existe en la librería: es el `equipment: []` de los ejercicios
// de peso corporal. 'dip_bar' tampoco es equipo real de filtro: en los datos solo
// aparece junto a 'parallettes' (los 2 ejercicios de fondos en paralelas), nunca
// solo — el material es "paralelas", "fondos" es el nombre del ejercicio.
export const EQUIPMENT = [
  'bodyweight', 'barbell', 'dumbbells', 'cables', 'machines', 'kettlebell',
  'resistance_band', 'pullup_bar', 'parallettes', 'rings',
  'ab_wheel', 'rope', 'weight_belt',
];
export function equipmentOf(ex) {
  const eq = ex.equipment?.length ? ex.equipment : ['bodyweight'];
  return [...new Set(eq.map((e) => (e === 'dip_bar' ? 'parallettes' : e)))];
}
