/**
 * exerciseStatus — misma regla que dispara el auto-colapso de ExerciseCard:
 * todas las series de trabajo hechas Y (si hay dropset) todos los drops de la
 * última serie hechos. Compartida entre ExerciseCard (por-card) y WorkoutScreen
 * (agregada por grupo de superserie) para no duplicar la lógica.
 */

export function isExerciseDone(exConfig, setsState) {
  const workDone  = setsState.length > 0 && setsState.every((s) => s.done);
  const lastDrops = exConfig.dropset ? (setsState[setsState.length - 1]?.drops ?? []) : [];
  const dropsDone = !exConfig.dropset || (lastDrops.length > 0 && lastDrops.every((d) => d.done));
  return workDone && dropsDone;
}
