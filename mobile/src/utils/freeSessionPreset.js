/**
 * Plantillas de sesión libre — congelar una sesión hecha y volver a montarla.
 *
 * docs/specs/home-sessions.md §7. Mismo patrón que los presets de bloque
 * (`blockPresets` en el store): copias congeladas, device-global, fuera del
 * canal del entrenador y dentro del backup. Insertar una plantilla COPIA, no
 * referencia.
 *
 * Las dos funciones son puras y viven aquí, fuera del store, porque lo que hay
 * que acertar es exactamente esto: qué se guarda y qué se descarta.
 */

/**
 * Congela el PLAN de una entrada de sesión libre del historial.
 *
 * Lo que se guarda: qué ejercicios, cuántas series cada uno, los bloques con su
 * configuración y el nombre. Lo que NO: los pesos, las reps y los resultados —
 * eso es el log. La plantilla es el plan, no lo que hiciste.
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
    })),
    // `blockId` y `result` son de aquella sesión; el resto (formato, cap,
    // intervalo, rondas, movimientos, nombre) es el bloque.
    blocks: (entry?.blocks ?? []).map(({ blockId: _blockId, result: _result, ...block }) => block),
  };
}

/**
 * Monta la sesión en curso a partir de una plantilla: series vacías, bloques
 * con id nuevo y ningún resultado.
 *
 * `newId` lo inyecta el store (`generateId`) para que esto siga siendo puro y
 * testable sin tocarlo.
 */
export function freeSessionFromPreset(preset, newId) {
  const emptySet = () => ({ weight: '', reps: '', time: '', done: false });
  return {
    freeSessionName: preset?.name ?? '',
    adHocExercises: (preset?.exercises ?? []).map(({ exerciseId, sets }) => ({
      exerciseId,
      setsState: Array.from({ length: Math.max(1, sets ?? 1) }, emptySet),
    })),
    freeBlocks: (preset?.blocks ?? []).map((block) => ({ ...block, id: newId() })),
  };
}
