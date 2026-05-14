/**
 * Lógica de recomendación de progresión automática.
 * Analiza la última sesión completada y genera un chip de recomendación.
 *
 * Separada del store para que sea fácil de testear y extender.
 */

/**
 * @typedef {Object} ProgressionResult
 * @property {'up'|'hold'|'down'|'info'} type
 * @property {'⬆'|'→'|'⬇'|'📊'} icon
 * @property {string} msg
 * @property {number|null} suggestedWeight
 * @property {number|null} suggestedTime
 */

/**
 * Calcula la recomendación de progresión para un ejercicio dado
 * comparando con su última sesión registrada.
 *
 * @param {object} exerciseDef  — definición del ejercicio de la librería
 * @param {object[]} lastSets   — array de sets de la última sesión para este ejercicio
 *                                [{ weight, reps, time, done }]
 * @returns {ProgressionResult|null}
 */
export function getProgression(exerciseDef, lastSets) {
  if (!lastSets || !lastSets.length) return null;

  // Un set cuenta si tiene datos, independientemente del check
  const doneSets = lastSets.filter((s) =>
    s.done || s.weight || s.reps || s.time
  );
  if (!doneSets.length) return null;

  const model = exerciseDef.progressionModel;

  // ─── Tiempo ──────────────────────────────────────────────────────────────
  if (model === 'time_progression') {
    const times = doneSets.map((s) => parseFloat(s.time) || 0).filter((t) => t > 0);
    if (!times.length) return null;

    const { minTime, maxTime, timeStep } = exerciseDef;
    const allHitMax = doneSets.length >= exerciseDef.sets && times.every((t) => t >= maxTime);
    const allOk = times.every((t) => t >= minTime);

    if (allHitMax) {
      return {
        type: 'up',
        icon: '⬆',
        msg: `Objetivo superado. Progresa a ${maxTime + timeStep}s por serie la próxima vez.`,
        suggestedWeight: null,
        suggestedTime: maxTime + timeStep,
      };
    }
    if (allOk) {
      return {
        type: 'hold',
        icon: '→',
        msg: `Bien. Consolida el rango ${minTime}–${maxTime}s antes de subir.`,
        suggestedWeight: null,
        suggestedTime: maxTime,
      };
    }
    return {
      type: 'hold',
      icon: '→',
      msg: `Sigue trabajando en el rango ${minTime}–${maxTime}s. Sin prisa.`,
      suggestedWeight: null,
      suggestedTime: null,
    };
  }

  // ─── Submáx (ej. flexiones) ──────────────────────────────────────────────
  if (model === 'submax') {
    const total = doneSets.reduce((acc, s) => acc + (parseInt(s.reps) || 0), 0);
    if (!total) return null;
    return {
      type: 'info',
      icon: '📊',
      msg: `Sesión anterior: ${total} reps en ${doneSets.length} series. Supera esa marca hoy.`,
      suggestedWeight: null,
      suggestedTime: null,
    };
  }

  // ─── Doble progresión (fuerza / hipertrofia) ─────────────────────────────
  if (model === 'double_progression') {
    const { minReps, maxReps, weightStep, sets, progressionDirection = 'increase' } = exerciseDef;

    const weights = doneSets.map((s) => parseFloat(s.weight) || 0);
    const reps = doneSets.map((s) => parseInt(s.reps) || 0);
    const maxW = Math.max(...weights);
    const completionRate = doneSets.length / sets;
    const validReps = reps.filter((r) => r > 0);
    const avgReps = validReps.length
      ? validReps.reduce((a, b) => a + b, 0) / validReps.length
      : 0;

    const allHitMax = completionRate >= 1 && reps.every((r) => r >= maxReps);
    const mostHitMin = completionRate >= 0.8 && avgReps >= minReps;
    const struggling = completionRate < 0.6;

    // ── Progresión inversa (asistidos: dominadas con banda, dips asistidos…) ──
    // El peso registrado es la ASISTENCIA. Reducirla = progresar.
    if (progressionDirection === 'decrease') {
      const assistance = maxW; // kg de banda/asistencia actuales

      if (allHitMax && assistance > 0) {
        const nextAssistance = Math.max(0, assistance - weightStep);
        const msg = nextAssistance === 0
          ? `¡Excelente! Todas las series al máximo con ${assistance}kg de asistencia. La próxima vez intenta sin asistencia.`
          : `Todas las series al máximo. Reduce la asistencia a ${nextAssistance}kg la próxima vez.`;
        return {
          type: 'up',
          icon: '⬆',
          msg,
          suggestedWeight: nextAssistance,
          suggestedTime: null,
        };
      }

      if (allHitMax && assistance === 0) {
        return {
          type: 'up',
          icon: '⬆',
          msg: '¡Todas las series sin asistencia! Es hora de pasar a la versión lastrada.',
          suggestedWeight: 0,
          suggestedTime: null,
        };
      }

      if (mostHitMin) {
        return {
          type: 'hold',
          icon: '→',
          msg: `Bien. Consolida con ${assistance > 0 ? assistance + 'kg de asistencia' : 'sin asistencia'} y busca más reps dentro del rango.`,
          suggestedWeight: assistance || null,
          suggestedTime: null,
        };
      }

      if (struggling && assistance < 999) {
        const nextAssistance = assistance + weightStep;
        return {
          type: 'down',
          icon: '⬇',
          msg: `No llegaste al mínimo de reps. Aumenta la asistencia a ${nextAssistance}kg para consolidar técnica.`,
          suggestedWeight: nextAssistance,
          suggestedTime: null,
        };
      }

      return {
        type: 'hold',
        icon: '→',
        msg: `Sigue con ${assistance > 0 ? assistance + 'kg de asistencia' : 'sin asistencia'} y foco en la técnica.`,
        suggestedWeight: assistance || null,
        suggestedTime: null,
      };
    }

    // ── Progresión normal (increase) ─────────────────────────────────────────
    if (allHitMax) {
      const nextWeight = maxW + weightStep;
      return {
        type: 'up',
        icon: '⬆',
        msg: `Todas las series al máximo. Sube a ${nextWeight}kg la próxima vez.`,
        suggestedWeight: nextWeight,
        suggestedTime: null,
      };
    }

    if (mostHitMin) {
      return {
        type: 'hold',
        icon: '→',
        msg: `Bien ejecutado. Mantén ${maxW > 0 ? maxW + 'kg' : 'el peso'} y busca más reps dentro del rango.`,
        suggestedWeight: maxW || null,
        suggestedTime: null,
      };
    }

    if (struggling && maxW > 0 && weightStep > 0) {
      const nextWeight = Math.max(0, maxW - weightStep);
      return {
        type: 'down',
        icon: '⬇',
        msg: `No llegaste al mínimo de reps. Prueba con ${nextWeight}kg para consolidar técnica.`,
        suggestedWeight: nextWeight,
        suggestedTime: null,
      };
    }

    return {
      type: 'hold',
      icon: '→',
      msg: `Sigue con ${maxW > 0 ? maxW + 'kg' : 'el mismo peso'} y foco en la técnica.`,
      suggestedWeight: maxW || null,
      suggestedTime: null,
    };
  }

  return null;
}

/**
 * Genera un resumen legible de un set completado para mostrar en historial/stats.
 * @param {object} exerciseDef
 * @param {object[]} doneSets
 * @returns {string}
 */
export function summarizeSets(exerciseDef, doneSets) {
  if (!doneSets || !doneSets.length) return '—';

  const model = exerciseDef?.progressionModel;

  if (model === 'time_progression') {
    const times = doneSets.map((s) => s.time).filter(Boolean);
    return times.length ? times.join('/') + 's' : '—';
  }

  if (model === 'submax') {
    const total = doneSets.reduce((acc, s) => acc + (parseInt(s.reps) || 0), 0);
    return total ? `${total} reps tot.` : '—';
  }

  // double_progression
  const maxW = Math.max(...doneSets.map((s) => parseFloat(s.weight) || 0));
  const repsList = doneSets.map((s) => s.reps).filter(Boolean).join('/');
  if (maxW > 0) return `${maxW}kg · ${repsList}`;
  if (repsList) return `${repsList} reps`;
  return '—';
}
