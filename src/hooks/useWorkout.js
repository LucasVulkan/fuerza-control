/**
 * Hook de sesión activa.
 * Usa getEffectiveTemplate para reflejar ediciones del usuario en tiempo real.
 */

import { useStore, selectActiveSession } from '../store/useStore';
import { EXERCISE_LIBRARY } from '../data/exerciseLibrary';
import { getProgression, summarizeSets } from '../utils/progression';

export function useWorkout() {
  const activeSession = useStore(selectActiveSession);
  const updateSetField = useStore((s) => s.updateSetField);
  const toggleSetDone = useStore((s) => s.toggleSetDone);
  const saveSession = useStore((s) => s.saveSession);
  const discardSession = useStore((s) => s.discardSession);
  const getLastSession = useStore((s) => s.getLastSession);
  const getEffectiveTemplate = useStore((s) => s.getEffectiveTemplate);
  const customExercises = useStore((s) => s.customExercises);

  const allExercises = { ...EXERCISE_LIBRARY, ...customExercises };

  const { templateId, setsState } = activeSession;
  const template = templateId ? getEffectiveTemplate(templateId) : null;

  if (!template) {
    return { template: null, exercises: [], saveSession, discardSession };
  }

  const lastSession = getLastSession(templateId);

  const exercises = template.exercises.map((exConfig) => {
    const { exerciseId, isKey, sets, restSec } = exConfig;
    const def = allExercises[exerciseId];
    const currentSets = setsState[exerciseId] ?? [];
    const lastExercise = lastSession?.exercises.find((e) => e.exerciseId === exerciseId);
    const lastSets = lastExercise?.sets ?? [];
    // Cuenta cualquier set con datos, no solo los marcados con check
    const lastSetsWithData = lastSets.filter((s) => s.done || s.weight || s.reps || s.time);

    return {
      exerciseId,
      def,
      isKey,
      sets,
      restSec,
      exConfig,  // ← incluimos el exConfig completo para que ExerciseCard acceda a los overrides
      currentSets,
      lastSets,
      prevSummary: summarizeSets(def, lastSetsWithData),
      progression: getProgression(def, lastSets),
    };
  });

  return { template, exercises, updateSetField, toggleSetDone, saveSession, discardSession };
}
