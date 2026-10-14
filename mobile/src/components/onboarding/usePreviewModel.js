/**
 * El motor de «tu programa» en vivo (O01): la plantilla elegida adaptada a las
 * respuestas, lo que se llevó el recorte de tiempo y la lista de ajustes. Se
 * recalcula con cada toque de la hoja de ajustes. Lo comparten `OnboardingScreen`
 * y el camino «por mi cuenta» del recorrido nuevo (O03-04); lo pinta
 * `ProgramPreviewItems`.
 */
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { useStore, normalizeOnboardingAnswers } from '../../../store/useStore';
import { adaptArchetype } from '../../utils/archetypeAdapter';
import { diffAdaptations, computeAdjustments } from '../../utils/adaptationDiff';
import { useTheme } from '../../useTheme';
import { resolveColor } from '../../themes';
import { dedupSubstitutions } from './proposalData';

/** `entry`: la propuesta elegida (de `rankArchetypes`) o `null`. `answers`: las del motor, con la hoja de ajustes. */
export default function usePreviewModel(entry, answers) {
  const th = useTheme();
  const { t } = useTranslation();
  const exerciseLibrary = useStore((s) => s.exerciseLibrary);
  const customExercises = useStore((s) => s.customExercises);
  const language        = useStore((s) => s.profile?.language ?? 'es');

  // Las respuestas tal y como las consume el motor. La misma normalización que
  // aplica el store, para que la plantilla que se previsualiza sea la que se
  // guarda.
  const submitAnswers = useMemo(() => normalizeOnboardingAnswers(answers), [answers]);
  const allEx = useMemo(
    () => ({ ...exerciseLibrary, ...customExercises }),
    [exerciseLibrary, customExercises],
  );

  // El motor, en vivo. Se recalcula con cada toque de la hoja de ajustes: es
  // lo que convierte "material" y "tiempo" en algo que se ve pasar en vez de
  // en dos preguntas más.
  const tuned = useMemo(
    () => (entry ? adaptArchetype(entry.archetype, submitAnswers) : null),
    [entry, submitAnswers],
  );

  // §5.2: la MISMA plantilla y las MISMAS respuestas, sin presupuesto de
  // tiempo — sólo para restar y saber qué se llevó el recorte. Un
  // `adaptArchetype` de más por render del preview; es puro y son milisegundos.
  const freeTuned = useMemo(
    () => (entry ? adaptArchetype(entry.archetype, { ...submitAnswers, sessionMinutes: null }) : null),
    [entry, submitAnswers],
  );
  const timeCuts = useMemo(
    () => (tuned && freeTuned ? diffAdaptations(freeTuned, tuned) : []),
    [tuned, freeTuned],
  );
  const dedupedSubs = useMemo(() => dedupSubstitutions(tuned?.substitutions), [tuned]);
  const dayColorOf = useMemo(() => {
    const byLabel = {};
    for (const tpl of Object.values(tuned?.sessionTemplates ?? {})) {
      byLabel[tpl.label] = resolveColor(th, tpl.color ?? 'var(--day1)');
    }
    return (label) => byLabel[label] ?? th.colors.accent;
  }, [tuned, th]);
  const adjustments = useMemo(() => computeAdjustments({
    subs:           dedupedSubs,
    unresolved:     tuned?.unresolved,
    levelCuts:      tuned?.levelCuts,
    timeCuts,
    overBudget:     tuned?.overBudget,
    limitations:    answers.limitations,
    sessionMinutes: answers.sessionMinutes,
    allEx, language, dayColorOf, t,
  }), [dedupedSubs, tuned, timeCuts, answers.limitations, answers.sessionMinutes, allEx, language, dayColorOf, t]);

  return { submitAnswers, allEx, language, tuned, timeCuts, dedupedSubs, adjustments };
}
