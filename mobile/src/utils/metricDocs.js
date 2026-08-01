/**
 * metricDocs — registro de las métricas que la app enseña.
 *
 * Spec: `mobile/docs/specs/metric-transparency.md`.
 *
 * Aquí NO vive el texto: vive en `metrics.*` de `src/locales/{es,en}.json`, con
 * cuatro campos por métrica (`name`, `what`, `formula`, `caveat`). Este módulo
 * aporta las dos cosas que el JSON no puede tener:
 *
 *  1. **El orden y la agrupación** de presentación.
 *  2. **Las constantes reales**, interpoladas desde el código. Tecleadas a mano
 *     en el JSON quedarían obsoletas a la primera calibración, y una ficha que
 *     miente sobre la fórmula es peor que no tener ficha.
 *
 * El campo `caveat` es OBLIGATORIO en todas: enseñar solo la fórmula vende una
 * precisión que la métrica no tiene. Si una métrica no parece tener límite que
 * declarar, casi siempre es que no se ha buscado.
 */
import { MAX_RELIABLE_REPS } from '../../../src/utils/oneRm';
import {
  REF_WEEKS, BLOCK_LOAD_PER_SEC,
  MONOTONY_MODERATE, MONOTONY_HIGH, MIN_SESSIONS_FOR_MONOTONY,
  SETS_TARGET_MIN, SETS_TARGET_MAX,
} from '../../../src/utils/trainingLoad';

/** Grupos y orden de presentación en Documentación. */
export const METRIC_GROUPS = [
  { id: 'performance', ids: ['e1rm', 'pr', 'performanceIndex', 'loadTrend', 'lastSessionDelta'] },
  { id: 'volume',      ids: ['volume', 'setsDonePlanned', 'volumeTrend', 'muscleGroupSets'] },
  { id: 'load',        ids: ['sessionLoad', 'sessionMinutes', 'externalLoad', 'movingAverage',
                             'loadState', 'monotony', 'strain', 'indexed100', 'loadHeatmap'] },
  { id: 'session',     ids: ['progressionChip', 'estimatedDuration', 'warmupWeight',
                             'blockDelta', 'stageProgress'] },
  { id: 'trainer',     ids: ['adherence'] },
];

export const METRIC_IDS = METRIC_GROUPS.flatMap((g) => g.ids);

/**
 * id → valores a interpolar en `what` / `formula` / `caveat`.
 * Solo las métricas cuyo texto cita una constante calibrable.
 */
export const METRIC_VARS = {
  e1rm:            { maxReps: MAX_RELIABLE_REPS },
  externalLoad:    { weeks: REF_WEEKS, maxReps: MAX_RELIABLE_REPS },
  sessionLoad:     { blockFactor: BLOCK_LOAD_PER_SEC },
  monotony:        { moderate: MONOTONY_MODERATE, high: MONOTONY_HIGH, minSessions: MIN_SESSIONS_FOR_MONOTONY },
  strain:          { minSessions: MIN_SESSIONS_FOR_MONOTONY },
  muscleGroupSets: { min: SETS_TARGET_MIN, max: SETS_TARGET_MAX },
  performanceIndex:{ maxReps: MAX_RELIABLE_REPS },
};
