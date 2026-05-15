/**
 * Lógica de recomendación de progresión automática.
 * Analiza la última sesión completada y genera un chip de recomendación.
 */

export function getProgression(exerciseDef, lastSets, totalSets) {
  if (!lastSets || !lastSets.length) return null;

  const doneSets = lastSets.filter((s) =>
    s.done || s.weight || s.reps || s.time
  );
  if (!doneSets.length) return null;

  const model = exerciseDef.progressionModel;
  // totalSets viene del exConfig (template), no del def (librería)
  const sets = totalSets ?? exerciseDef.sets ?? doneSets.length;

  // ─── Tiempo ──────────────────────────────────────────────────────────────
  if (model === 'time_progression') {
    const times = doneSets.map((s) => parseFloat(s.time) || 0).filter((t) => t > 0);
    if (!times.length) return null;

    const { minTime, maxTime } = exerciseDef;
    const timeStep = exerciseDef.timeStep ?? 5; // default 5s
    const allHitMax = doneSets.length >= sets && times.every((t) => t >= maxTime);
    const allOk = times.every((t) => t >= minTime);

    if (allHitMax) {
      return {
        type: 'up', icon: '⬆',
        msg: `Objetivo superado. Progresa a ${maxTime + timeStep}s por serie la próxima vez.`,
        suggestedWeight: null, suggestedTime: maxTime + timeStep,
      };
    }
    if (allOk) {
      return {
        type: 'hold', icon: '→',
        msg: `Bien. Consolida el rango ${minTime}–${maxTime}s antes de subir.`,
        suggestedWeight: null, suggestedTime: maxTime,
      };
    }
    return {
      type: 'hold', icon: '→',
      msg: `Sigue trabajando en el rango ${minTime}–${maxTime}s. Sin prisa.`,
      suggestedWeight: null, suggestedTime: null,
    };
  }

  // ─── Submáx ──────────────────────────────────────────────────────────────
  if (model === 'submax') {
    const total = doneSets.reduce((acc, s) => acc + (parseInt(s.reps) || 0), 0);
    if (!total) return null;
    const maxW = Math.max(...doneSets.map((s) => parseFloat(s.weight) || 0));
    const weightInfo = maxW > 0 ? ` · ${maxW}kg` : '';
    return {
      type: 'info', icon: '📊',
      msg: `Sesión anterior: ${total} reps en ${doneSets.length} series${weightInfo}. Supera esa marca hoy.`,
      suggestedWeight: null, suggestedTime: null,
    };
  }

  // ─── Doble progresión ─────────────────────────────────────────────────────
  if (model === 'double_progression') {
    const { minReps, maxReps, weightStep, progressionDirection = 'increase' } = exerciseDef;

    const weights = doneSets.map((s) => parseFloat(s.weight) || 0);
    const reps    = doneSets.map((s) => parseInt(s.reps) || 0);
    const maxW    = Math.max(...weights);
    const completionRate = doneSets.length / sets;
    const validReps = reps.filter((r) => r > 0);
    const avgReps   = validReps.length
      ? validReps.reduce((a, b) => a + b, 0) / validReps.length : 0;

    const allHitMax  = completionRate >= 1 && reps.every((r) => r >= maxReps);
    const mostHitMin = completionRate >= 0.8 && avgReps >= minReps;
    const struggling = completionRate < 0.6;

    // Progresión inversa (asistidos)
    if (progressionDirection === 'decrease') {
      const assistance = maxW;
      if (allHitMax && assistance > 0) {
        const next = Math.max(0, assistance - weightStep);
        const msg = next === 0
          ? `¡Excelente! Todas las series al máximo con ${assistance}kg de asistencia. La próxima vez intenta sin asistencia.`
          : `Todas las series al máximo. Reduce la asistencia a ${next}kg la próxima vez.`;
        return { type: 'up', icon: '⬆', msg, suggestedWeight: next, suggestedTime: null };
      }
      if (allHitMax && assistance === 0) {
        return { type: 'up', icon: '⬆', msg: '¡Todas las series sin asistencia! Es hora de pasar a la versión lastrada.', suggestedWeight: 0, suggestedTime: null };
      }
      if (mostHitMin) {
        return { type: 'hold', icon: '→', msg: `Bien. Consolida con ${assistance > 0 ? assistance + 'kg de asistencia' : 'sin asistencia'} y busca más reps.`, suggestedWeight: assistance || null, suggestedTime: null };
      }
      if (struggling && assistance < 999) {
        const next = assistance + weightStep;
        return { type: 'down', icon: '⬇', msg: `No llegaste al mínimo. Aumenta la asistencia a ${next}kg.`, suggestedWeight: next, suggestedTime: null };
      }
      return { type: 'hold', icon: '→', msg: `Sigue con ${assistance > 0 ? assistance + 'kg de asistencia' : 'sin asistencia'} y foco en la técnica.`, suggestedWeight: assistance || null, suggestedTime: null };
    }

    // Progresión normal
    if (allHitMax) {
      const next = maxW + weightStep;
      return { type: 'up', icon: '⬆', msg: `Todas las series al máximo. Sube a ${next}kg la próxima vez.`, suggestedWeight: next, suggestedTime: null };
    }
    if (mostHitMin) {
      return { type: 'hold', icon: '→', msg: `Bien ejecutado. Mantén ${maxW > 0 ? maxW + 'kg' : 'el peso'} y busca más reps dentro del rango.`, suggestedWeight: maxW || null, suggestedTime: null };
    }
    if (struggling && maxW > 0 && weightStep > 0) {
      const next = Math.max(0, maxW - weightStep);
      return { type: 'down', icon: '⬇', msg: `No llegaste al mínimo de reps. Prueba con ${next}kg para consolidar técnica.`, suggestedWeight: next, suggestedTime: null };
    }
    return { type: 'hold', icon: '→', msg: `Sigue con ${maxW > 0 ? maxW + 'kg' : 'el mismo peso'} y foco en la técnica.`, suggestedWeight: maxW || null, suggestedTime: null };
  }

  return null;
}

export function summarizeSets(exerciseDef, doneSets) {
  if (!doneSets || !doneSets.length) return '—';

  const model = exerciseDef?.progressionModel;

  if (model === 'time_progression') {
    const times = doneSets.map((s) => s.time).filter(Boolean);
    return times.length ? times.join('/') + 's' : '—';
  }

  if (model === 'submax') {
    const total = doneSets.reduce((acc, s) => acc + (parseInt(s.reps) || 0), 0);
    const maxW = Math.max(...doneSets.map((s) => parseFloat(s.weight) || 0));
    if (!total) return '—';
    return maxW > 0 ? `${total} reps · ${maxW}kg` : `${total} reps tot.`;
  }

  // double_progression y cualquier otro modelo con peso
  const maxW = Math.max(...doneSets.map((s) => parseFloat(s.weight) || 0));
  const repsList = doneSets.map((s) => s.reps).filter(Boolean).join('/');
  if (maxW > 0) return `${maxW}kg · ${repsList}`;
  if (repsList) return `${repsList} reps`;
  return '—';
}
