/**
 * sessionSlots — orden único de ejercicios y bloques dentro de una sesión.
 *
 * Un "hueco" (slot) es la unidad que se ve y se arrastra: un ejercicio suelto,
 * una superserie entera (varios ejercicios encadenados por `supersetWithNext`),
 * o un bloque de acondicionamiento.
 *
 * Fuentes de verdad:
 * - Los ejercicios se ordenan por el ARRAY `template.exercises` (`reorderExercise`
 *   reescribe el array entero, así que el array y el campo `order` siempre
 *   coinciden; el array es lo que lee todo lo demás).
 * - Los bloques llevan un campo `order` **opcional** con su posición entre los
 *   huecos. Se indexa contra huecos y no contra ejercicios a propósito: así un
 *   bloque nunca puede acabar insertado en mitad de una superserie y partirla.
 *   Los bloques sin `order` (datos anteriores a poder mezclarlos) van al final,
 *   que es como se comportaba la app antes.
 *
 * Lo usan el editor de sesión y la pantalla de entreno, para que el orden que se
 * ve al editar sea el mismo que se entrena.
 */
export function sessionSlots(template) {
  const slots = [];
  for (const ex of template?.exercises ?? []) {
    const prev = slots[slots.length - 1];
    if (prev?.kind === 'ex' && prev.members[prev.members.length - 1].supersetWithNext) {
      prev.members.push(ex);
    } else {
      slots.push({ kind: 'ex', id: ex.exerciseId, members: [ex] });
    }
  }

  const positioned = (template?.blocks ?? []).map((block, i) => ({
    block,
    at: Number.isFinite(block.order) ? block.order : slots.length + i,
  }));
  // De menor a mayor: insertando en orden creciente, los índices ya colocados
  // siguen siendo válidos para los siguientes.
  positioned.sort((a, b) => a.at - b.at);
  for (const { block, at } of positioned) {
    const i = Math.min(Math.max(at, 0), slots.length);
    slots.splice(i, 0, { kind: 'block', id: block.id, block });
  }
  return slots;
}

/**
 * Reparte un orden nuevo de huecos en lo que espera el store: el array completo
 * de ejercicios (con `order` renumerado) y el de bloques (con `order` = índice
 * del hueco). Devuelve `null` en la parte que no haya cambiado nada que escribir.
 */
export function slotsToArrays(slots) {
  const exercises = slots
    .filter((s) => s.kind === 'ex')
    .flatMap((s) => s.members)
    .map((ex, i) => ({ ...ex, order: i + 1 }));
  const blocks = slots
    .map((s, i) => (s.kind === 'block' ? { ...s.block, order: i } : null))
    .filter(Boolean);
  return { exercises, blocks };
}
