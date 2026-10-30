/**
 * Lo que comparten las pantallas del camino «por mi cuenta» (O03-12, O04-05): el
 * tiempo de sesión, las respuestas del recorrido y las plantillas que proponen,
 * ya con las respuestas que entiende el motor. (Hasta O04-05 había aquí también
 * «Tu programa» y sus preguntas de ajuste; se quitaron.)
 */
import { useMemo } from 'react';

import { useStore, normalizeOnboardingAnswers } from '../../../../store/useStore';
import { rankArchetypes } from '../../../data/archetypes';
import { IDENTITY_OPTIONS, DEFAULT_ANSWERS } from '../../../components/onboarding/proposalData';

export const TIMES = [30, 45, 60, 90];

// Constante y no `{}` en el selector: zustand 5 vuelve a pintar sin fin si devuelve un objeto nuevo cada vez.
const NONE = {};
export const answersOf = (s) => s.onboardingFlow?.answers ?? NONE;

/**
 * El nivel: el contestado en este recorrido o, si «Nuevo programa» arranca en
 * `s_days` (O03-11), el que ya estaba guardado en el perfil.
 */
export const levelOf = (s) => answersOf(s).level ?? s.profile.onboardingAnswers?.level ?? null;

/**
 * Las plantillas que encajan (`ranked`, de mejor a peor) y las respuestas del
 * motor: las del recorrido sobre `DEFAULT_ANSWERS` (material y limitaciones por
 * defecto). `submitAnswers` es lo que se pasa a `generateAndActivateProgram`.
 * `ready` apaga el cálculo mientras «preparando».
 */
export function useProgramModel(ready = true) {
  const level   = useStore(levelOf);
  const goal    = useStore((s) => answersOf(s).goal);
  const days    = useStore((s) => answersOf(s).days);
  const minutes = useStore((s) => answersOf(s).sessionMinutes ?? null);

  const identity = IDENTITY_OPTIONS.find((o) => o.id === goal);
  const answers = useMemo(() => ({
    ...DEFAULT_ANSWERS, ...(minutes ? { sessionMinutes: minutes } : null),
    level, discipline: identity?.discipline ?? null, goal: identity?.goal ?? null, daysPerWeek: days,
  }), [minutes, level, identity, days]);
  const submitAnswers = useMemo(() => normalizeOnboardingAnswers(answers), [answers]);

  // SIN material a propósito (O01 §9): aún no se ha preguntado, y `equipment`
  // ausente le dice a `rankArchetypes` que no lo puntúe.
  const ranked = useMemo(() => (ready ? rankArchetypes({
    level, discipline: answers.discipline, goal: answers.goal, daysPerWeek: days,
  }) : []), [ready, level, answers.discipline, answers.goal, days]);
  return { days, ranked, answers, submitAnswers };
}
