/**
 * Sesiones libres — docs/specs/free-sessions.md.
 *
 * Una sesión libre guardada es un `sessionTemplate` normal con `programId: null`
 * y un `owner` (§4.1): el editor, el Workout, el recap y la progresión la tratan
 * como a cualquier otra. Lo que vive aquí es lo que hay que acertar y se puede
 * probar sin el store: qué se congela de una sesión hecha, cómo se convierte en
 * plantilla y cómo se reconoce una entrada libre en el historial.
 */

// Lo que un ejercicio ad-hoc puede tener configurado. `sets` no está: es
// `setsState.length`, y se cuenta aparte.
const TARGET_KEYS = ['minReps', 'maxReps', 'minTime', 'maxTime', 'restSec'];

const pickTarget = (o) => Object.fromEntries(
  TARGET_KEYS.filter((k) => o?.[k] != null).map((k) => [k, o[k]]),
);

/**
 * ¿Es una sesión libre esta entrada del historial? Las dos clases —sobre la
 * marcha y desde una plantilla libre— llevan `free: true` (§4.2); la segunda
 * condición cubre las entradas sobre la marcha de antes de la spec.
 *
 * Hace falta el campo y no basta con mirar la plantilla: en el móvil del
 * entrenador la plantilla no existe.
 */
export const isFreeEntry = (e) => e?.free === true || e?.sessionTemplateId === '__free__';

/**
 * ¿Como qué sesión del programa cuenta esta entrada? (§8). La suya si es del
 * programa; la sustituida si es libre y se marcó «Cuenta como»; ninguna si es
 * libre sin marcar. Todo lo que mira el programa —sesión que toca, «N de M esta
 * semana», adherencia, filtro «programa actual»— pasa por aquí. La carga, la
 * tira de la semana y el progreso de cada ejercicio NO: esas cuentan siempre.
 */
export const programTemplateOf = (e) => (isFreeEntry(e) ? e.countsAs ?? null : e?.sessionTemplateId ?? null);

/** Entradas que cuentan para la adherencia: todas salvo las libres sin marcar. */
export const countsForProgram = (e) => programTemplateOf(e) != null;

/**
 * Congela el PLAN de una entrada de sesión libre del historial.
 *
 * Lo que se guarda: qué ejercicios, cuántas series cada uno, el objetivo que se
 * les puso a mano (reps/tiempo y descanso), los bloques con su configuración y
 * el nombre. Lo que NO: los pesos, las reps HECHAS y los resultados — eso es el
 * log. La plantilla es el plan, no lo que hiciste.
 *
 * ponytail: un bloque planificado pero nunca arrancado no está en la entrada
 * (`blocksLogFrom` solo registra los que tienen `startedAt`), así que tampoco
 * entra en la plantilla. Se guarda lo que se hizo, que es lo que se quiere
 * repetir.
 */
export function presetFromEntry(entry) {
  return {
    name: entry?.sessionName?.trim() || null,
    exercises: (entry?.exercises ?? []).map((ex) => ({
      exerciseId: ex.exerciseId,
      sets:       Math.max(1, ex.sets?.length ?? 1),
      // Solo lo que se tocó a mano: lo demás sale de la biblioteca al
      // convertirlo en plantilla (`freeTemplateFromPreset`).
      ...pickTarget(ex),
    })),
    // `blockId` y `result` son de aquella sesión; el resto (formato, cap,
    // intervalo, rondas, movimientos, nombre) es el bloque.
    blocks: (entry?.blocks ?? []).map((block) => {
      const plan = { ...block };
      delete plan.blockId;
      delete plan.result;
      return plan;
    }),
  };
}

/**
 * El plan (la forma de `presetFromEntry`, que es también la de las viejas
 * `freeSessionPresets`) convertido en una sesión libre (§4.1).
 *
 * Cada ejercicio nace con los mismos valores por defecto que `addExercise` en
 * el store, pisados por lo que el plan traiga. `newBlockId` y `lib` los inyecta
 * quien llama para que esto siga siendo puro.
 */
export function freeTemplateFromPreset(preset, { id, owner = 'me', newBlockId, lib = {} }) {
  return {
    id,
    programId: null,
    owner,
    label:     null,
    name:      preset?.name ?? '',
    onHome:    true,
    emphasis:  '',
    color:     null,
    exercises: (preset?.exercises ?? []).map((ex, i) => {
      const def = lib[ex.exerciseId] ?? {};
      return {
        exerciseId: ex.exerciseId,
        isKey:      false,
        sets:       Math.max(1, ex.sets ?? def.sets ?? 3),
        restSec:    def.restSec ?? 90,
        minReps:    def.minReps ?? null,
        maxReps:    def.maxReps ?? null,
        progressionOverride: null,
        limitationNote:      null,
        order:      i + 1,
        ...pickTarget(ex),
      };
    }),
    blocks: (preset?.blocks ?? []).map((block) => ({ ...block, id: newBlockId() })),
  };
}
