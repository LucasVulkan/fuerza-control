/**
 * Cycle / stage progress — the single rule for "how far into the program is the
 * athlete", shared by the athlete's device and (from phase 2 of the stage-locks
 * spec) the trainer's mirror of it.
 *
 * ONE definition of a week: **a week is one full rotation through the DISTINCT
 * sessions of the cycle**. Repeating a session does not close the cycle and
 * therefore does not advance the stage — a cycle of A/B/C only closes once all
 * three have been logged, in any order.
 *
 * That used to be inconsistent: `cycleCompletedIds` counted distinct templates
 * (correct) while the end-of-stage threshold counted raw saves, so repeating A
 * twelve times finished a 4-week × 3-session stage without ever doing B or C.
 * The raw counter (`stageSessionsCompleted`) is gone; `stageWeeksCompleted`
 * replaces it and only ever moves when a rotation closes.
 *
 * Progress is a COUNTER, never a read of the workout log: deleting entries must
 * not roll the athlete back, and a reinstall restores the counters rather than
 * recomputing them. See `mobile/docs/specs/stage-locks.md` §3.
 *
 * A cycle can never contain the same template twice — every way of adding a day
 * to a program mints a fresh `tpl_*` id — so `size` comparisons are exact.
 */

import { generateId } from './formatters';

/**
 * EVERY program owns at least one stage (`docs/specs/stage-planner.md` §3).
 *
 * Asigna las etapas y clampa el índice activo. Hasta sep-2026 mantenía además
 * `program.days`, un espejo desnormalizado de los días de la etapa activa que
 * media app leía directamente — y que seis escrituras se saltaban. El espejo
 * murió (`docs/specs/program-model.md` §5): quien quiera esos días los pide con
 * `stageDays`, que los lee de donde están.
 *
 * @param {object}  program
 * @param {array}   stages              the new stage list
 * @param {number} [currentStageIndex]  defaults to the program's own, clamped
 */
export function withStages(program, stages, currentStageIndex) {
  const raw = currentStageIndex ?? program?.currentStageIndex ?? 0;
  const idx = Math.max(0, Math.min(raw, stages.length - 1));
  return { ...program, stages, currentStageIndex: idx };
}

/** Los días de UNA etapa concreta. */
export const stageDaysAt = (program, idx) => program?.stages?.[idx]?.days ?? [];

/**
 * Los días de la etapa activa del programa — el ciclo que toca ahora.
 *
 * OJO en el móvil del entrenador: `currentStageIndex` es la etapa que ÉL activó,
 * no donde está el cliente. Para eso va `stageDaysAt(program, clientStageIndex(...))`.
 */
export const stageDays = (program) => stageDaysAt(program, program?.currentStageIndex ?? 0);

/** Todos los días de todas las etapas: el alcance del programa entero. */
export const allProgramDays = (program) =>
  (program?.stages ?? []).flatMap((st) => st.days ?? []);

/**
 * Wraps a program created before the model was unified (no `stages`) into the
 * one-stage shape. Idempotent: a program that already has stages comes back
 * untouched.
 *
 * Es el ÚNICO sitio que sigue leyendo `program.days`, y a propósito: es la
 * puerta por la que entra un programa antiguo —del estado persistido o de un
 * `.fitdata` v1/v2— y de ahí saca los días para armar su primera etapa. Borrar
 * esta lectura dejaría esos programas sin sesiones.
 *
 * `durationWeeks: null` — "no limit" — is deliberate, and it is what makes the
 * migration behaviour-preserving: a program without stages never had an
 * end-of-stage threshold, because `advanceCycle` only sets one when it is given
 * a duration. Handing the migrated stage a number would invent an ending nobody
 * asked for, and start showing "week 4 of 4" on a program that had been running
 * for fifteen cycles.
 */
/**
 * Closes an open-ended stage (`durationWeeks: null`) at the number of cycles
 * already completed, which is what "the stage lasted as long as it lasted"
 * means. Called when a stage is appended after it.
 *
 * It has to happen: an unlimited stage NEVER ends, so leaving one in front of
 * another locks the athlete inside it forever — `advanceCycle` cannot reach a
 * threshold that does not exist, and the "move on" banner never appears.
 *
 * `advancePending` is returned rather than assumed: closing a stage at the
 * cycles done makes it finished *right now*, and nothing else recomputes that
 * flag until the next saved session — which would cost the athlete a whole
 * extra rotation before being allowed to move on. It stays false when no cycle
 * has closed yet (a brand-new program), because then the stage really is still
 * ahead of them.
 *
 * @param {array}  stages
 * @param {number} stageIndex   the stage the ATHLETE is in (not the trainer's)
 * @param {number} cyclesDone   their `stageWeeksCompleted`
 * @returns {{ stages: array, advancePending: boolean }}
 */
export function closeOpenStage(stages, stageIndex, cyclesDone = 0) {
  const stage = stages?.[stageIndex];
  if (!stage || stage.durationWeeks != null) return { stages, advancePending: false };
  const durationWeeks = Math.max(1, cyclesDone);
  return {
    stages: stages.map((s, i) => (i === stageIndex ? { ...s, durationWeeks } : s)),
    advancePending: cyclesDone >= durationWeeks,
  };
}

export function ensureStages(program, stageName = 'Etapa 1') {
  if (!program) return program;

  // Una etapa SIEMPRE tiene `days`, aunque sea vacío. Es la invariante que
  // permite que los lectores hagan `st.days.forEach(...)` sin guard: hay cinco
  // repartidos por pantallas y store, y la lista crece cada vez que se escribe
  // código nuevo. Guardar en cada lector es una carrera que se pierde; se
  // garantiza aquí, que es por donde pasa todo programa antes de tocarse.
  if (program.stages?.length > 0) {
    // Solo se reconstruye si de verdad falta alguna: la migración de
    // rehidratación compara identidad (`staged !== p`) para no reescribir el
    // estado en cada arranque.
    if (program.stages.every((st) => Array.isArray(st?.days))) return program;
    return { ...program, stages: program.stages.map((st) => ({ ...st, days: st?.days ?? [] })) };
  }

  const days = program.days ?? [];
  return withStages(
    program,
    [{ id: generateId('stage'), name: stageName, durationWeeks: null, days }],
    0,
  );
}

/**
 * The client's progress, as it travels to the trainer alongside their history
 * and comes back on a reinstall. `programId` lets the receiver reject a blob
 * that belongs to a program the client is no longer on.
 *
 * `stageAdvancePending` is deliberately absent: it is a dismissable UI state,
 * and the trainer can tell a finished stage from `stageWeeksCompleted` against
 * the stage's own `durationWeeks`.
 *
 * @returns {object|null} null when the program has no id (nothing to sync)
 */
export function progressBlob(program, appliedActivation = null) {
  if (!program?.id) return null;
  return {
    programId:           program.id,
    currentStageIndex:   program.currentStageIndex   ?? 0,
    cycleCompletedIds:   program.cycleCompletedIds   ?? [],
    stageWeeksCompleted: program.stageWeeksCompleted ?? 0,
    totalWeeksCompleted: program.totalWeeksCompleted ?? 0,
    // The activation stamp this position was computed under. On a reconnect the
    // restore compares it against the incoming program's stamp: a newer stamp
    // there means the trainer moved the client while this blob sat in the slot,
    // and the move must win over the blob — same rule as a live update. Without
    // this, a reinstall silently swallowed a pending activation.
    appliedActivation,
    updatedAt:           new Date().toISOString(),
  };
}

/**
 * The counters from a blob, ready to spread onto a program — but only if the
 * blob describes that same program. Anything else returns null so the caller
 * keeps what it has instead of adopting a stale stage index.
 */
export function progressFromBlob(blob, programId) {
  if (!blob || blob.programId !== programId) return null;
  return {
    currentStageIndex:   blob.currentStageIndex   ?? 0,
    cycleCompletedIds:   blob.cycleCompletedIds   ?? [],
    stageWeeksCompleted: blob.stageWeeksCompleted ?? 0,
    totalWeeksCompleted: blob.totalWeeksCompleted ?? 0,
  };
}

/**
 * Where the athlete actually is in a program, seen from the TRAINER's device.
 *
 * `program.currentStageIndex` on that device means something different: it is
 * the stage the trainer has activated for them, and it only moves when the
 * trainer moves it. Reading it as "where the client is" is wrong the moment the
 * client advances on their own — which is what made "prepare next session" load
 * the wrong stage's sessions.
 *
 * Falls back to the program's own index for clients who have never synced.
 */
export function clientStageIndex(client, program) {
  const idx = progressFromBlob(client?.progress, program?.id)?.currentStageIndex
    ?? program?.currentStageIndex
    ?? 0;
  // Clamped: the trainer may have deleted stages below where the blob says the
  // client is, and an out-of-range index renders an empty stage everywhere.
  const last = (program?.stages?.length ?? 0) - 1;
  return last >= 0 ? Math.max(0, Math.min(idx, last)) : Math.max(0, idx);
}

/**
 * Which counters the client keeps when an updated program lands from their
 * trainer. Progress belongs to the client, so whatever the incoming copy
 * carries is discarded — with ONE exception: if the trainer deliberately
 * activated a stage since the last import, the client jumps there and that
 * stage starts from zero.
 *
 * That exception is why editing a program does not send anyone back to stage 1:
 * an edit leaves `stageActivatedAt` untouched, so nothing moves.
 *
 * Intent is read from the STAMP, not from comparing stage indices. The trainer's
 * copy falls behind as soon as the client advances on their own, so a trainer
 * sending someone back to a stage their own copy already pointed at changes no
 * number at all — and an index comparison would call that "no move".
 *
 * @param {object} blob              the client's own progress
 * @param {object} program           the freshly imported program
 * @param {string} lastActivation    `stageActivatedAt` already applied, if any
 */
export function mergeProgressOnImport({ blob, program, lastActivation = null }) {
  const kept          = progressFromBlob(blob, program?.id);
  const incomingStage = program?.currentStageIndex ?? 0;
  const activation    = program?.stageActivatedAt ?? null;
  // No blob for THIS program means a different program arrived, not an update.
  const jump          = !kept || (!!activation && activation !== lastActivation);

  const stages     = program?.stages ?? [];
  const stageCount = Math.max(1, stages.length);
  const stage      = Math.max(0, Math.min(jump ? incomingStage : kept.currentStageIndex, stageCount - 1));
  const weeks      = jump ? 0 : kept.stageWeeksCompleted;
  const duration   = stages[stage]?.durationWeeks;

  return {
    currentStageIndex:   stage,
    cycleCompletedIds:   jump ? [] : kept.cycleCompletedIds,
    stageWeeksCompleted: weeks,
    totalWeeksCompleted: kept?.totalWeeksCompleted ?? 0,   // lifetime, never reset
    // Recomputed rather than carried: the incoming copy's flag is the trainer's,
    // and the client's was just overwritten by the import.
    stageAdvancePending: duration != null && weeks >= duration && stage < stages.length - 1,
  };
}

/**
 * Applies one saved session to a program's cycle counters.
 *
 * @param {object}   program        the program that owns the session's template
 * @param {string}   templateId     template just completed
 * @param {string[]} cycleTplIds    every distinct templateId in the current cycle
 * @param {object}  [opts]
 * @param {number}  [opts.durationWeeks]  stage length; omit for non-staged programs
 * @param {boolean} [opts.isLastStage]    no advance is ever pending on the last stage
 * @returns {{cycleCompletedIds: string[], stageWeeksCompleted: number,
 *            totalWeeksCompleted: number, stageAdvancePending: boolean}}
 */
export function advanceCycle(program, templateId, cycleTplIds, { durationWeeks, isLastStage = false } = {}) {
  const valid = new Set(cycleTplIds);
  // Filtrado, no confiado: `cycleCompletedIds` sobrevive a los reajustes de etapa
  // del entrenador (`mergeProgressOnImport` lo conserva si no hay salto), y un id
  // que ya no pertenece al ciclo no puede contar para cerrarlo. Los consumidores
  // de la lista preguntan por pertenencia y no les molestaba; aquí se cuenta.
  const cycleIds = new Set((program.cycleCompletedIds ?? []).filter((id) => valid.has(id)));
  cycleIds.add(templateId);
  const cycleClosed = cycleIds.size >= valid.size;

  const stageWeeksCompleted = (program.stageWeeksCompleted ?? 0) + (cycleClosed ? 1 : 0);
  // Once pending, it stays pending until the athlete advances or dismisses it.
  const reachedEnd = durationWeeks != null && stageWeeksCompleted >= durationWeeks;

  return {
    cycleCompletedIds:   cycleClosed ? [] : [...cycleIds],
    stageWeeksCompleted,
    totalWeeksCompleted: (program.totalWeeksCompleted ?? 0) + (cycleClosed ? 1 : 0),
    stageAdvancePending: (reachedEnd && !isLastStage) || (program.stageAdvancePending ?? false),
  };
}
