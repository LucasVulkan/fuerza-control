/**
 * Qué día de la semana entrena cada sesión del ciclo, dibujado como una fila de
 * 7. Puro — mobile/docs/specs/onboarding-simple.md §7.1.
 */

// Qué días se entrena, por número de días. Es una TABLA, no un algoritmo: el
// reparto de 4 días en una semana es una decisión de producto, no un cálculo,
// y una tabla se puede discutir mirándola.
const PATTERNS = {
  1: [0], 2: [0, 3], 3: [0, 2, 4], 4: [0, 1, 3, 4],
  5: [0, 1, 2, 4, 5], 6: [0, 1, 2, 3, 4, 5], 7: [0, 1, 2, 3, 4, 5, 6],
};

/**
 * `daysPerWeek` (se recorta a 1-7) y `sessionCount` (sesiones distintas del
 * ciclo) → array de 7: `null` = descanso, o el índice (0-based) de la sesión
 * del ciclo que toca ese día.
 *
 * El ciclo avanza de forma continua entre semanas: el día que hace `i` dentro
 * de la semana `weekIndex` lleva la sesión `(weekIndex * daysPerWeek + i) %
 * sessionCount`. Por eso con 4 días y un ciclo de 3 sesiones la semana 2
 * (weekIndex=1) empieza por la sesión B (índice 1), no por la A.
 */
export function weekPattern(daysPerWeek, sessionCount, weekIndex = 0) {
  if (!sessionCount || sessionCount <= 0) return Array(7).fill(null);

  const dpw = Math.min(7, Math.max(1, daysPerWeek));
  const trainDays = PATTERNS[dpw];

  return Array.from({ length: 7 }, (_, day) => {
    const i = trainDays.indexOf(day);
    if (i === -1) return null;
    return (weekIndex * dpw + i) % sessionCount;
  });
}
