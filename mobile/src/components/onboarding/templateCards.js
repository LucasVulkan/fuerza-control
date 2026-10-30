/**
 * Lo que enseña la tarjeta de una plantilla en las propuestas (O04-04, spec §5):
 * se calcula del programa ya ajustado a las respuestas (`adaptArchetype`), no de
 * la plantilla en bruto. Puro y sin React.
 */
import { weeklySetsByGroup } from '../../utils/weeklyVolume';
import { estimateSessionSec, includesWarmup } from '../../utils/sessionCompression';
import { uniqueSessionTemplates, totalSetsOf, totalWeeksOf } from './proposalData';

const MAX_GROUPS = 5;

// Qué días de la semana (0 = lunes) entrena quien hace N sesiones: lo más repartido posible.
const WEEK = { 1: [0], 2: [0, 3], 3: [0, 2, 4], 4: [0, 1, 3, 4], 5: [0, 1, 2, 4, 5], 6: [0, 1, 2, 3, 4, 5], 7: [0, 1, 2, 3, 4, 5, 6] };

export const suggestedWeek = (n) => WEEK[Math.min(7, Math.max(1, n || 1))];

/**
 * `tuned`: el resultado de `adaptArchetype`. `days`: los días por semana elegidos;
 * `minutes`: el tiempo de sesión elegido (decide si cuenta el calentamiento).
 * Devuelve las sesiones distintas, los minutos y las series de una sesión media,
 * las series por semana de los grupos que más trabaja (de mayor a menor) y los
 * días de la semana sugerida y las semanas que dura el programa (suma de
 * `durationWeeks` de sus fases; 0 si la plantilla no declara fases).
 */
export function cardModel(tuned, { allEx, days, minutes }) {
  const sessions = uniqueSessionTemplates(tuned.program, tuned.sessionTemplates);
  const warmup   = includesWarmup(minutes);
  const mins     = sessions.map((s) => estimateSessionSec(s.exercises ?? [], allEx, { includeWarmup: warmup }) / 60);
  const n        = sessions.length || 1;
  const perWeek  = days || sessions.length;

  const weekly = weeklySetsByGroup(sessions.map((s) => s.exercises ?? []), perWeek, allEx);
  const groups = Object.entries(weekly)
    .filter(([g, sets]) => g !== 'full_body' && sets >= 0.5)
    .map(([g, sets]) => [g, Math.round(sets)])
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_GROUPS);

  return {
    sessions,
    minutes: Math.round(mins.reduce((a, b) => a + b, 0) / n),
    sets:    Math.round(totalSetsOf(sessions.map((s) => s.exercises)) / n),
    groups,
    week:    suggestedWeek(perWeek),
    weeks:   totalWeeksOf(tuned.phases),
  };
}
