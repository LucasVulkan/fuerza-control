/**
 * Taxonomía compartida de la librería de ejercicios — patrón de movimiento,
 * grupo muscular y equipo. Única fuente de verdad para el buscador
 * (`ExerciseSelectorScreen`) y el alta de ejercicios (`CustomExerciseScreen`),
 * para que ambos filtren/clasifiquen exactamente igual.
 */

// Los 10 `pattern` de la librería (valor exacto que se guarda en el ejercicio).
// 'conditioning' (T07): lo que se usa sobre todo en bloques —cardio, comba,
// trineo, wall ball…—; ninguna plantilla lo pide, así que el generador no lo
// elige nunca.
export const PATTERNS = [
  'vertical_pull', 'horizontal_pull', 'vertical_push', 'horizontal_push',
  'squat', 'hip_hinge', 'core', 'carry_grip', 'calf_raise', 'conditioning',
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
  { id: 'conditioning', patterns: ['conditioning'] },
];
export const GROUP_OF_PATTERN = Object.fromEntries(
  PATTERN_GROUPS.flatMap((g) => g.patterns.map((p) => [p, g.id]))
);

// Los 10 `primaryGroup` reales de la librería. 'full_body' solo lo llevan los
// de acondicionamiento: ningún hueco de plantilla lo pide (T07).
export const MUSCLE_GROUPS = [
  'chest', 'back', 'shoulders', 'arms',
  'quads', 'glutes_hamstrings', 'legs_lower', 'core', 'grip', 'full_body',
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
  'sled', 'cardio_machine', 'medicine_ball', 'jump_rope', 'battle_rope',
];
export function equipmentOf(ex) {
  const eq = ex.equipment?.length ? ex.equipment : ['bodyweight'];
  return [...new Set(eq.map((e) => (e === 'dip_bar' ? 'parallettes' : e)))];
}
