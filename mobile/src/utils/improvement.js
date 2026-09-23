/**
 * Métricas de progreso de un ejercicio — "¿mejora, y cuánto?".
 *
 * Salieron de `components/stats/ProgressTab.jsx` porque allí elegían la métrica
 * SESIÓN A SESIÓN (`kg ?? reps`): una sesión a 0 kg valía la suma de
 * repeticiones y la siguiente, a 7,5 kg, valía kilos — y el detalle decía
 * "−37,5 kg" de un ejercicio que había subido (docs/specs/qa-sep-pantallas.md §4).
 *
 * La regla (§4.2):
 *   1. La métrica se decide UNA vez por serie de sesiones (`seriesMetric`) y
 *      todos los puntos se calculan en ella. Nunca se cae a otra en un punto.
 *   2. En `kg`, 0 es un valor válido en un ejercicio de peso corporal ("sin
 *      lastre"). En uno con carga, una sesión sin peso es `null`: hueco.
 *   3. Los deltas solo entre dos valores no nulos.
 *   4. Porcentaje sobre base 0 → `null`.
 *      ponytail: base 0 → sin %. Si se quiere que cuente, porcentaje sobre peso
 *      efectivo (peso corporal + lastre, `effectiveWeight` de trainingLoad.js),
 *      que necesita el peso corporal aquí.
 *
 * `logs` es siempre `[{ timestamp, sessionTemplateId, exercise }]` en orden
 * cronológico, la forma que devuelve `getExerciseLogsFrom`.
 */
import { bestSetE1RM } from './oneRm';
import { isBodyweight } from './trainingLoad';

const isLogged = (s) => s.done || s.weight || s.reps || s.time;

/** Las sesiones de `sourceLog` con datos de un ejercicio, en orden cronológico. */
export function getExerciseLogsFrom(exerciseId, sourceLog) {
  return sourceLog
    .filter((log) =>
      log.exercises.some((e) => e.exerciseId === exerciseId && e.sets.some(isLogged)))
    .sort((a, b) => a.timestamp - b.timestamp)
    .map((log) => ({
      timestamp:         log.timestamp,
      sessionTemplateId: log.sessionTemplateId,
      exercise:          log.exercises.find((e) => e.exerciseId === exerciseId),
    }));
}

/** La métrica de toda una serie: `time`, `reps` o `kg` (§4.2 regla 1). */
export function seriesMetric(logs, def) {
  const model = def?.progressionModel;
  if (model === 'time_progression') return 'time';
  if (model === 'submax')           return 'reps';
  const hasWeight = (logs ?? []).some(({ exercise }) =>
    exercise?.sets?.some((s) => parseFloat(s.weight) > 0));
  return hasWeight ? 'kg' : 'reps';
}

/** Valor de una sesión en una métrica dada; `null` = hueco. */
export function metricValue(sets, metric, def) {
  const done = sets?.filter(isLogged) ?? [];
  if (!done.length) return null;
  if (metric === 'time') {
    const ts = done.map((s) => parseFloat(s.time) || 0).filter(Boolean);
    return ts.length ? Math.max(...ts) : null;
  }
  if (metric === 'kg') {
    const v = Math.max(...done.map((s) => parseFloat(s.weight) || 0));
    return v > 0 || isBodyweight(def) ? v : null;
  }
  if (metric === 'reps') {
    const v = done.reduce((a, s) => a + (parseInt(s.reps) || 0), 0);
    return v > 0 ? v : null;
  }
  if (metric === 'vol') {
    const v = done.reduce((a, s) => a + (parseFloat(s.weight) || 0) * (parseInt(s.reps) || 0), 0);
    return v > 0 ? Math.round(v) : null;
  }
  if (metric === 'e1rm') {
    const v = bestSetE1RM(done);
    return v !== null ? Math.round(v * 10) / 10 : null;
  }
  return null;
}

/** % de cambio entre el primer y el último punto de la recta de regresión. */
export function linearRegressionPct(logs, def, metric = seriesMetric(logs, def)) {
  if (!logs || logs.length < 2) return null;
  const pts = [];
  logs.forEach(({ exercise }, i) => {
    const v = metricValue(exercise?.sets, metric, def);
    if (v !== null) pts.push({ x: i, y: v });
  });
  if (pts.length < 2) return null;
  const N     = pts.length;
  const sumX  = pts.reduce((s, p) => s + p.x, 0);
  const sumY  = pts.reduce((s, p) => s + p.y, 0);
  const sumXY = pts.reduce((s, p) => s + p.x * p.y, 0);
  const sumX2 = pts.reduce((s, p) => s + p.x * p.x, 0);
  const denom = N * sumX2 - sumX * sumX;
  if (denom === 0) return 0;
  const slope     = (N * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / N;
  const firstEst  = intercept;
  const lastEst   = intercept + slope * pts[pts.length - 1].x;
  if (!firstEst || firstEst <= 0) return null;
  const pct = ((lastEst - firstEst) / firstEst) * 100;
  return Math.round(Math.max(-100, Math.min(200, pct)));
}

/** "Mejora global": media de la tendencia de cada ejercicio que tiene una. */
export function computeOverallImprovement(workoutLog, allExercises) {
  const ids = [...new Set(workoutLog.flatMap((l) =>
    l.exercises.filter((e) => e.sets.some(isLogged)).map((e) => e.exerciseId)))];
  const improvements = [];
  for (const id of ids) {
    const pct = linearRegressionPct(getExerciseLogsFrom(id, workoutLog), allExercises[id]);
    if (pct !== null) improvements.push(pct);
  }
  if (!improvements.length) return null;
  return Math.round(improvements.reduce((a, b) => a + b, 0) / improvements.length);
}

/** % medio de la última sesión frente a la anterior, ejercicio a ejercicio. */
export function computeLastLoadDelta(workoutLog, allExercises) {
  if (workoutLog.length < 2) return null;
  const sorted = [...workoutLog].sort((a, b) => a.timestamp - b.timestamp);
  const last   = sorted[sorted.length - 1];
  const prev   = sorted[sorted.length - 2];
  const improvements = [];
  for (const lastEx of last.exercises) {
    const prevEx = prev.exercises.find((e) => e.exerciseId === lastEx.exerciseId);
    if (!prevEx) continue;
    const def     = allExercises[lastEx.exerciseId];
    const metric  = seriesMetric([{ exercise: prevEx }, { exercise: lastEx }], def);
    const lastVal = metricValue(lastEx.sets, metric, def);
    const prevVal = metricValue(prevEx.sets, metric, def);
    if (lastVal === null || !prevVal) continue;
    improvements.push((lastVal - prevVal) / prevVal * 100);
  }
  if (!improvements.length) return null;
  return Math.round(improvements.reduce((a, b) => a + b, 0) / improvements.length);
}

/** Mejor sesión de la serie, en su métrica. */
export function computeExPR(logs, def) {
  const metric = seriesMetric(logs, def);
  let best = null;
  for (const { timestamp, exercise } of logs) {
    const v = metricValue(exercise?.sets, metric, def);
    if (v !== null && (best === null || v >= best.value)) best = { value: v, timestamp, metric };
  }
  return best;
}

/** Valor, delta con la sesión anterior y récord, sesión a sesión. */
export function computeExSessionDeltas(logs, def, metricOverride = null) {
  const metric = metricOverride ?? seriesMetric(logs, def);
  let bestSoFar = null;
  let prev = null;
  return logs.map(({ timestamp, exercise, sessionTemplateId }) => {
    const val   = metricValue(exercise?.sets, metric, def);
    const delta = prev !== null && val !== null ? val - prev : null;
    const isPR  = val !== null && bestSoFar !== null && val > bestSoFar;
    if (val !== null) bestSoFar = bestSoFar === null ? val : Math.max(bestSoFar, val);
    prev = val;
    return { timestamp, val, delta, isPR, metricId: metric, exercise, sessionTemplateId };
  });
}

/** Diferencia absoluta de la última sesión con la anterior, en la métrica de la serie. */
export function lastSessionDelta(logs, def, metric = seriesMetric(logs, def)) {
  if (!logs || logs.length < 2) return null;
  const last = metricValue(logs[logs.length - 1].exercise?.sets, metric, def);
  const prev = metricValue(logs[logs.length - 2].exercise?.sets, metric, def);
  return last !== null && prev !== null ? last - prev : null;
}
