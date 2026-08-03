/**
 * stageRx — la regla de etapa (`rx`): la transformación que convierte los
 * ejercicios de una etapa en los de la siguiente.
 *
 * Spec: `mobile/docs/specs/stage-planner.md` §4.3.
 *
 * ── La decisión de diseño que hay que entender antes de tocar esto ──────────
 *
 * La regla se MATERIALIZA, no se resuelve en runtime. `applyRx` devuelve
 * `exConfig` normal y corriente, indistinguible de lo que escribiría el
 * entrenador a mano. Por eso ninguno de los ~10 consumidores de `exConfig`
 * (WorkoutScreen, sessionStats, trainingLoad, sessionRecap, editor, preview,
 * snapshot del log) tiene que enterarse de que existe una regla — y por eso la
 * etapa generada se puede seguir editando a mano, ejercicio a ejercicio.
 *
 * El precio, asumido: cambiar la regla después NO retro-aplica. Si te
 * equivocaste, borras la etapa y la vuelves a crear.
 *
 * ── Y la que hay que respetar al usarlo ─────────────────────────────────────
 *
 * Los peldaños de una escalera derivan de la etapa BASE, no del anterior: los
 * deltas son absolutos contra la base ("+1 serie", "+2 series"), nunca
 * acumulativos. Así, editar el peldaño 2 no descoloca el 3, y un
 * `incrementScale: 0.5` de descarga no deja el incremento a la mitad para
 * siempre.
 */

import { resolveProgressionConfig } from './progression';

/** Regla identidad: "igual que la etapa anterior", el comportamiento de siempre. */
export const DEFAULT_RX = {
  scope:           'all',   // 'all' | 'keys' | 'accessories'
  setsDelta:        0,      // −2..+2 series por ejercicio
  repsShift:        0,      // −4..+4, desplaza min Y max juntos
  restPct:          0,      // −50..+100 %
  incrementScale:   1,      // 1 | 0.5 — escala el incremento de la progresión
  progressionHold:  null,   // null | 'deload'
};

/**
 * Escaleras predefinidas: los peldaños que se añaden DETRÁS de la etapa base.
 * Todos derivan de la base, nunca del anterior (ver cabecera).
 *
 * Por qué dos de las tres llevan `scope`: sin alcance, un peldaño de
 * intensificación empujaría los curls a 5-9 repeticiones, y eso contradice una
 * regla que el propio generador ya aplica — "uniarticulares siempre con
 * parámetros de hipertrofia" (`programGenerator.js`). El rango corto es de los
 * básicos; los accesorios viven en 8-15 haga el bloque lo que haga. Y al revés
 * en volumen: las series extra van a los accesorios, no a la sentadilla pesada.
 *
 * La descarga y la acumulación lineal sí van a `all`: bajar el volumen o añadir
 * una serie a todo es exactamente lo que se quiere ahí.
 *
 * `nameKey` se traduce en la pantalla; aquí no entra i18n.
 */
export const LADDERS = [
  {
    id: 'linear',
    rungs: [
      { nameKey: 'accumulation2', durationWeeks: 4, rx: { setsDelta: 1 } },
      { nameKey: 'accumulation3', durationWeeks: 3, rx: { setsDelta: 2 } },
      { nameKey: 'deload',        durationWeeks: 1, rx: { setsDelta: -1, progressionHold: 'deload' } },
    ],
  },
  {
    id: 'intensification',
    rungs: [
      { nameKey: 'intensify1', durationWeeks: 4, rx: { scope: 'keys', repsShift: -3, restPct: 25 } },
      { nameKey: 'intensify2', durationWeeks: 3, rx: { scope: 'keys', repsShift: -5, restPct: 50, incrementScale: 0.5 } },
      { nameKey: 'deload',     durationWeeks: 1, rx: { setsDelta: -1, progressionHold: 'deload' } },
    ],
  },
  {
    id: 'volume',
    rungs: [
      { nameKey: 'volume2', durationWeeks: 4, rx: { scope: 'accessories', setsDelta: 1 } },
      { nameKey: 'volume3', durationWeeks: 4, rx: { scope: 'accessories', setsDelta: 2 } },
      { nameKey: 'deload',  durationWeeks: 1, rx: { setsDelta: -1, progressionHold: 'deload' } },
    ],
  },
];

/**
 * Resumen legible de una regla, para la fila de procedencia ("+1 serie ·
 * −3 reps"). Devuelve [] si la regla no cambia nada.
 *
 * `t` es la función de i18next; las cadenas viven en `planner.rxParts.*`.
 */
export function describeRx(rx, t) {
  if (isNoopRx(rx)) return [];
  const r = { ...DEFAULT_RX, ...rx };
  const scoped = (key, opts) => t(
    r.scope === 'all' ? `planner.rxParts.${key}` : `planner.rxParts.${key}_${r.scope}`,
    opts,
  );
  const parts = [];
  if (r.setsDelta !== 0)       parts.push(scoped(r.setsDelta > 0 ? 'setsUp' : 'setsDown', { n: Math.abs(r.setsDelta) }));
  if (r.repsShift !== 0)       parts.push(scoped(r.repsShift > 0 ? 'repsUp' : 'repsDown', { n: Math.abs(r.repsShift) }));
  if (r.restPct !== 0)         parts.push(t(`planner.rxParts.${r.restPct > 0 ? 'restUp' : 'restDown'}`, { n: Math.abs(r.restPct) }));
  if (r.incrementScale !== 1)  parts.push(t('planner.rxParts.incrementHalf'));
  if (r.progressionHold)       parts.push(t('planner.rxParts.deload'));
  return parts;
}

// Suelos duros. Ninguna regla puede producir una serie de 0 repeticiones ni un
// descanso de 3 segundos por mucho que se acumulen los deltas.
const MIN_SETS = 1;
const MIN_REPS = 1;
const MIN_REST = 15;

/** True si la regla no cambia nada (identidad). Evita clonar por gusto. */
export function isNoopRx(rx) {
  if (!rx) return true;
  const r = { ...DEFAULT_RX, ...rx };
  return r.setsDelta === 0 && r.repsShift === 0 && r.restPct === 0
    && r.incrementScale === 1 && r.progressionHold == null;
}

/** ¿Este ejercicio entra en el alcance de la regla? */
function inScope(exConfig, scope) {
  if (scope === 'keys')        return !!exConfig.isKey;
  if (scope === 'accessories') return !exConfig.isKey;
  return true;
}

/**
 * Escala el incremento de la progresión.
 *
 * Se aplica sobre el valor de la etapa BASE (ver cabecera), y respeta la forma
 * de cada tipo de `increment`: 'fixed' escala `value`, 'pct' escala `pct`, y
 * 'stepped' escala cada escalón. Redondeo al múltiplo de `minIncrement` si lo
 * hay, y si no a 0,25 — el mismo criterio que `computeIncrement`.
 */
function scaleIncrement(increment, factor) {
  if (factor === 1) return increment;
  const min   = increment.minIncrement ?? null;
  const round = (v) => {
    if (min) return Math.max(min, Math.round(v / min) * min);
    return Math.max(0.25, Math.round(v / 0.25) * 0.25);
  };
  return {
    ...increment,
    value: round((increment.value ?? 2.5) * factor),
    pct:   Math.max(0.5, (increment.pct ?? 5) * factor),
    steps: (increment.steps ?? []).map((s) => ({ ...s, value: round((s.value ?? 0) * factor) })),
  };
}

/**
 * Aplica una regla de etapa a los ejercicios de una sesión.
 *
 * Nunca toca `exerciseId`, `order`, `linkGroup`, `supersetWithNext`, `dropset`,
 * `warmup`, `trainerNote`, `limitationNote` ni ningún id: la aritmética de
 * cierre de ciclo depende de que los ids no cambien (`advanceCycle` cuenta
 * plantillas distintas).
 *
 * @param {array}  exercises     exConfig[] de la sesión de origen
 * @param {object} rx            regla; ausente o identidad ⇒ devuelve el array tal cual
 * @param {object} allExercises  biblioteca + custom, para resolver la progresión
 *                               de los ejercicios que no la llevan explícita
 * @returns {array} exConfig[] nuevos (el original no se muta)
 */
export function applyRx(exercises, rx, allExercises = {}) {
  if (!exercises?.length || isNoopRx(rx)) return exercises;
  const r = { ...DEFAULT_RX, ...rx };

  return exercises.map((ex) => {
    if (!inScope(ex, r.scope)) return ex;
    const next = { ...ex };

    if (r.setsDelta !== 0 && next.sets != null) {
      next.sets = Math.max(MIN_SETS, next.sets + r.setsDelta);
    }

    // Los ejercicios de tiempo (`time_progression` / `submax`) no llevan
    // minReps/maxReps — `buildExConfig` los deja fuera a propósito — así que
    // el desplazamiento de repeticiones no les aplica. El resto de la regla sí.
    if (r.repsShift !== 0 && next.minReps != null && next.maxReps != null) {
      next.minReps = Math.max(MIN_REPS, next.minReps + r.repsShift);
      next.maxReps = Math.max(next.minReps, next.maxReps + r.repsShift);
    }

    if (r.restPct !== 0 && next.restSec != null) {
      next.restSec = Math.max(MIN_REST, Math.round(next.restSec * (1 + r.restPct / 100)));
    }

    if (r.incrementScale !== 1 || r.progressionHold !== null) {
      // Materializar la progresión resuelta: un ejercicio sin `progression`
      // explícita hereda la del `def`, y si escribiéramos solo `hold` encima
      // perderíamos el resto al no existir el objeto.
      const prog = resolveProgressionConfig(ex, allExercises[ex.exerciseId]);
      next.progression = {
        ...prog,
        increment: scaleIncrement(prog.increment, r.incrementScale),
        hold: r.progressionHold,
      };
    }

    return next;
  });
}
