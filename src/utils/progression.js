/**
 * Lógica de recomendación de progresión automática.
 * Analiza la última sesión completada y genera un chip de recomendación.
 * Recibe `t` de i18next para generar mensajes en el idioma activo.
 */

export function getProgression(exerciseDef, lastSets, totalSets, t) {
  if (!lastSets || !lastSets.length) return null;

  const doneSets = lastSets.filter((s) =>
    s.done || s.weight || s.reps || s.time
  );
  if (!doneSets.length) return null;

  const model = exerciseDef.progressionModel;
  const sets = totalSets ?? exerciseDef.sets ?? doneSets.length;

  // ─── Tiempo ──────────────────────────────────────────────────────────────
  if (model === 'time_progression') {
    const times = doneSets.map((s) => parseFloat(s.time) || 0).filter((t) => t > 0);
    if (!times.length) return null;

    const { minTime, maxTime } = exerciseDef;
    const timeStep = exerciseDef.timeStep ?? 5;
    const allHitMax = doneSets.length >= sets && times.every((t) => t >= maxTime);
    const allOk = times.every((t) => t >= minTime);

    if (allHitMax) {
      return {
        type: 'up', icon: '⬆',
        msg: t('progression.time_allHitMax', { next: maxTime + timeStep }),
        suggestedWeight: null, suggestedTime: maxTime + timeStep,
      };
    }
    if (allOk) {
      return {
        type: 'hold', icon: '→',
        msg: t('progression.time_allOk', { min: minTime, max: maxTime }),
        suggestedWeight: null, suggestedTime: maxTime,
      };
    }
    return {
      type: 'hold', icon: '→',
      msg: t('progression.time_keep', { min: minTime, max: maxTime }),
      suggestedWeight: null, suggestedTime: null,
    };
  }

  // ─── Submáx ──────────────────────────────────────────────────────────────
  if (model === 'submax') {
    const total = doneSets.reduce((acc, s) => acc + (parseInt(s.reps) || 0), 0);
    if (!total) return null;
    const maxW = Math.max(...doneSets.map((s) => parseFloat(s.weight) || 0));
    const msg = maxW > 0
      ? t('progression.submax_weight', { total, sets: doneSets.length, weight: maxW })
      : t('progression.submax_noweight', { total, sets: doneSets.length });
    return { type: 'info', icon: '📊', msg, suggestedWeight: null, suggestedTime: null };
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
      const assistStr = assistance > 0
        ? t('progression.withAssist', { kg: assistance })
        : t('progression.noAssist');

      if (allHitMax && assistance > 0) {
        const next = Math.max(0, assistance - weightStep);
        const msg = next === 0
          ? t('progression.decrease_lastAssist', { assist: assistance })
          : t('progression.decrease_allHit', { next });
        return { type: 'up', icon: '⬆', msg, suggestedWeight: next, suggestedTime: null };
      }
      if (allHitMax && assistance === 0) {
        return { type: 'up', icon: '⬆', msg: t('progression.decrease_free'), suggestedWeight: 0, suggestedTime: null };
      }
      if (mostHitMin) {
        return { type: 'hold', icon: '→', msg: t('progression.decrease_mostHit', { assistStr }), suggestedWeight: assistance || null, suggestedTime: null };
      }
      if (struggling && assistance < 999) {
        const next = assistance + weightStep;
        return { type: 'down', icon: '⬇', msg: t('progression.decrease_struggling', { next }), suggestedWeight: next, suggestedTime: null };
      }
      return { type: 'hold', icon: '→', msg: t('progression.decrease_hold', { assistStr }), suggestedWeight: assistance || null, suggestedTime: null };
    }

    // Progresión normal
    const weightStr = maxW > 0
      ? t('progression.withWeight', { kg: maxW })
      : t('progression.sameWeight');

    if (allHitMax) {
      const next = maxW + weightStep;
      return { type: 'up', icon: '⬆', msg: t('progression.normal_allHit', { next }), suggestedWeight: next, suggestedTime: null };
    }
    if (mostHitMin) {
      return { type: 'hold', icon: '→', msg: t('progression.normal_mostHit', { weightStr }), suggestedWeight: maxW || null, suggestedTime: null };
    }
    if (struggling && maxW > 0 && weightStep > 0) {
      const next = Math.max(0, maxW - weightStep);
      return { type: 'down', icon: '⬇', msg: t('progression.normal_struggling', { next }), suggestedWeight: next, suggestedTime: null };
    }
    return { type: 'hold', icon: '→', msg: t('progression.normal_hold', { weightStr }), suggestedWeight: maxW || null, suggestedTime: null };
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
