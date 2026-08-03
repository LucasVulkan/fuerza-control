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
