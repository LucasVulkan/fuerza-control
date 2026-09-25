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
  setsDelta:        0,      // −3..+3 series por ejercicio
  repsShift:        0,      // −6..+6, desplaza min Y max juntos
  restPct:          0,      // −50..+100 %
  incrementScale:   1,      // 1 | 0.5 — escala el incremento de la progresión
  progressionHold:  null,   // null | 'deload'
};

/**
 * Escaleras: tipos de bloque que el planificador sabe montar.
 *
 * NO son plantillas: `buildRungs` solo rellena la lista de la hoja, y a partir
 * de ahí se añaden, quitan y editan etapas una a una. Una escalera cerrada solo
 * sirve si tu bloque coincide con ella.
 *
 * Por qué dos de las tres llevan `scope`: sin alcance, un peldaño de
 * intensificación empujaría los curls a 5-9 repeticiones, y eso contradice una
 * regla que la adaptación de plantillas ya respeta: el objetivo se aplica sólo
 * a los keys, los accesorios se quedan con el rango de la plantilla
 * (`archetypeAdapter.js`, `buildExConfig`). El rango corto es de los
 * básicos; los accesorios viven en 8-15 haga el bloque lo que haga. Y al revés
 * en volumen: las series extra van a los accesorios, no a la sentadilla pesada.
 *
 * La descarga sí va a `all`: bajar el volumen de todo es lo que se quiere ahí.
 */
export const LADDER_IDS = ['linear', 'intensification', 'volume'];

/**
 * Campos editables de una etapa, en orden de aparición. `key` es el campo de
 * `rx`; el planificador pinta un stepper por cada uno y traduce la etiqueta con
 * `planner.fields.<key>`.
 *
 * UNA sola lista para todas las etapas, sea cual sea el preset del que salieron
 * (spec §14.2.4). Antes había una por escalera (`LADDER_FIELDS`) y otra para la
 * descarga, y de ahí salía toda la rigidez: el tipo decía a la vez de qué
 * valores parte la etapa Y qué se puede tocar después. Ahora el preset solo
 * rellena.
 */
export const RX_FIELDS = [
  { key: 'setsDelta', min: -3,  max: 3,   step: 1, scoped: true },
  { key: 'repsShift', min: -6,  max: 6,   step: 1, scoped: true },
  // El descanso no tiene variante por alcance: "Descanso en básicos" no es una
  // etiqueta que exista, y pedirla daba `planner.fields.restPct_keys`, que no
  // está en los locales.
  { key: 'restPct',   min: -50, max: 100, step: 5 },
];

/** Alcances, en el orden en que los pinta el segmentado. */
export const SCOPES = ['all', 'keys', 'accessories'];

/**
 * Clave i18n de la etiqueta de un campo. Solo los campos marcados `scoped`
 * tienen variante por alcance ("Series en accesorios"); el resto usan la suya
 * a secas.
 */
export function fieldLabelKey(field, scope) {
  const suffix = field.scoped && scope && scope !== 'all' ? `_${scope}` : '';
  return `planner.fields.${field.key}${suffix}`;
}

const DELOAD_RUNG = { kind: 'deload', durationWeeks: 1, rx: { setsDelta: -1, progressionHold: 'deload' } };

/** Cuántas etapas de trabajo trae un preset recién pulsado. */
const PRESET_WORK = 2;

/**
 * La lista por defecto de un preset: dos etapas de trabajo y una descarga.
 *
 * Es un PUNTO DE PARTIDA, no una plantilla: el planificador deja añadir, quitar
 * y editar cada etapa después. Por eso ya no recibe `count` ni `withDeload` —
 * eso lo decide la lista, no el preset.
 *
 * @returns [{ kind, durationWeeks, rx }] — `kind` distingue trabajo de descarga
 *          y decide cómo se nombra la etapa.
 */
export function buildRungs(ladderId) {
  const work = Array.from({ length: PRESET_WORK }, (_, i) => {
    if (ladderId === 'intensification') {
      return {
        kind: 'work', durationWeeks: i === 0 ? 4 : 3,
        rx: {
          scope: 'keys',
          repsShift: -3 - 2 * i,
          restPct:   25 + 25 * i,
          // A partir del segundo peldaño el margen se estrecha: subir a saltos
          // enteros deja de tener sentido.
          ...(i > 0 ? { incrementScale: 0.5 } : {}),
        },
      };
    }
    if (ladderId === 'volume') {
      return { kind: 'work', durationWeeks: 4, rx: { scope: 'accessories', setsDelta: i + 1 } };
    }
    return { kind: 'work', durationWeeks: 4, rx: { setsDelta: i + 1 } };
  });
  return [...work, newRung('deload')];
}

/**
 * Una etapa suelta para los botones `+ trabajo` / `+ descarga` de la hoja.
 *
 * La de trabajo nace con la regla vacía: es una copia literal de la base hasta
 * que se le toque algo, que es exactamente lo que hacía el viejo "Etapa nueva".
 */
export function newRung(kind) {
  return kind === 'deload'
    ? { ...DELOAD_RUNG, rx: { ...DELOAD_RUNG.rx } }
    : { kind: 'work', durationWeeks: 4, rx: {} };
}

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
 * `warmup`, `trainerNote`, `limitationNote` ni ningún id: el historial, la
 * vinculación y la progresión los usan de clave.
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
