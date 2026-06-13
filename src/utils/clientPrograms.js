/**
 * Pure helpers for the one-active-program model (trainer side).
 *
 * A client holds a list of programs (`programIds`) and exactly one active one
 * (`activeProgramId`). Assigning a program makes it the active one; the program
 * that was active stays in the list and is therefore "archived" — shown under
 * Anteriores. Nothing is ever silently dropped: archiving is just losing the
 * active status, so the history of past programs is always recoverable.
 *
 * Extracted from the Zustand store so the invariant can be unit-tested and the
 * trainer↔client simulation can exercise the real logic, not a copy.
 */

/**
 * Assigns `programId` as the client's active program. Adds it to the list if it
 * isn't there yet (newest first) and marks the client dirty so the trainer
 * pushes the change. The previously-active program stays in the list (archived).
 */
export function assignActiveProgram(client, programId) {
  const ids = client.programIds ?? [];
  return {
    ...client,
    programIds:      ids.includes(programId) ? ids : [programId, ...ids],
    activeProgramId: programId,
    programDirty:    true,
  };
}

/** Clears the active program (deassign). Nothing is removed from the list. */
export function deassignProgram(client) {
  return { ...client, activeProgramId: null, programDirty: false };
}

/** The client's non-active programs — everything in the list except the active. */
export function archivedProgramIds(client) {
  return (client.programIds ?? []).filter((id) => id !== client.activeProgramId);
}
