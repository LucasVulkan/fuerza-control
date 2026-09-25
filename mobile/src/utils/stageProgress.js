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
 * Whether any counter `progressBlob` ships differs between two versions of a
 * program — the client uploads when this flips (qa-sep-conexion.md §3.2 a).
 * The array by reference: every writer replaces it, none mutates it.
 */
export function progressChanged(a, b) {
  return a?.id !== b?.id
    || a?.currentStageIndex   !== b?.currentStageIndex
    || a?.cycleCompletedIds   !== b?.cycleCompletedIds
    || a?.stageWeeksCompleted !== b?.stageWeeksCompleted
    || a?.totalWeeksCompleted !== b?.totalWeeksCompleted;
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

// ── Semanas (docs/specs/weeks-model.md) ──────────────────────────────────────
//
// El modelo que sustituye a los ciclos. Lo de arriba que habla de ciclos
// (`advanceCycle`, el blob, `mergeProgressOnImport`, `closeOpenStage`) sigue
// vivo hasta que la P37 cambie el store que lo llama: quitarlo antes dejaría la
// app y sus tests a medias.
//
// Las fechas del progreso son DÍAS LOCALES en texto ('YYYY-MM-DD'), no
// instantes: la semana 1 la fija el calendario del atleta y el entrenador la lee
// tal cual (§3.2). La aritmética se hace en UTC sobre esos días, así que el
// cambio de hora no desplaza nada.

const DAY_MS = 86400000;
const pad2 = (n) => String(n).padStart(2, '0');
const dayToUTC = (day) => {
  const [y, m, d] = day.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};
/** Día de la semana, 0 = lunes … 6 = domingo. */
const dowOf = (day) => (new Date(dayToUTC(day)).getUTCDay() + 6) % 7;
const utcToDay = (ms) => {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
};

/** El día local de un instante, como 'YYYY-MM-DD'. */
export function localDay(ts = Date.now()) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export const addDays     = (day, n) => utcToDay(dayToUTC(day) + n * DAY_MS);
export const daysBetween = (from, to) => Math.round((dayToUTC(to) - dayToUTC(from)) / DAY_MS);

/**
 * El lunes de la semana 1 a partir del día en que se empezó (§0.3): de lunes a
 * miércoles cuenta esa misma semana; de jueves a domingo, la siguiente — ya no
 * da tiempo a entrenar una semana entera, y las sesiones de esos días suman
 * igual.
 */
export function weekOne(startedOn) {
  if (!startedOn) return null;
  const dow = dowOf(startedOn);
  return addDays(startedOn, dow <= 2 ? -dow : 7 - dow);
}

/** Semana 1, 2, 3… contada desde `weekOne(startedOn)`. Nunca menos de 1. */
function weekNumber(startedOn, today) {
  return Math.max(1, Math.floor(daysBetween(weekOne(startedOn), today) / 7) + 1);
}

/**
 * Entrenos por semana de una etapa. Sin fijar, son tantos como sesiones tiene:
 * el valor por defecto NO se guarda, para que una etapa a la que se le añade una
 * sesión pase a esperar una más sin que nadie lo tenga que tocar. Solo lo fija
 * quien lo elige (editor de etapa, generador).
 */
export function stageDaysPerWeek(stage) {
  const n = stage?.daysPerWeek ?? stage?.days?.length ?? 1;
  return Math.max(1, Math.min(7, n));
}

/**
 * El progreso del ATLETA en un programa, esté en su móvil (los campos del
 * propio programa) o espejado en el del entrenador (`client.progress`, el blob
 * que sube el cliente). Es la única puerta para leer el progreso (§3.7): en el
 * móvil del entrenador, los campos del programa son de SU copia y no se mueven.
 *
 * Un blob de otro programa no se adopta: se cae a los campos del programa.
 */
export function athleteProgress(program, client = null) {
  const blob = client?.progress;
  const src  = blob && blob.programId === program?.id ? blob : (program ?? {});
  const last = Math.max(0, (program?.stages?.length ?? 1) - 1);
  return {
    currentStageIndex: Math.max(0, Math.min(src.currentStageIndex ?? 0, last)),
    stageStartedOn:    src.stageStartedOn    ?? null,
    stageSessionsDone: src.stageSessionsDone ?? 0,
    stageExtraWeeks:   src.stageExtraWeeks   ?? 0,
    programStartedOn:  src.programStartedOn  ?? null,
  };
}

/**
 * Lo que escribe guardar una sesión, como parche para esparcir sobre el
 * programa. Solo cuenta una sesión de la etapa en la que se está; la primera
 * fija el día de inicio de la etapa y, si es la primera del programa, el suyo.
 * `saveSession` es el ÚNICO escritor de esas fechas (§3.2).
 */
export function recordSession(progress, { inCurrentStage, today }) {
  if (!inCurrentStage) return {};
  return {
    stageSessionsDone: (progress?.stageSessionsDone ?? 0) + 1,
    stageStartedOn:    progress?.stageStartedOn   ?? today,
    programStartedOn:  progress?.programStartedOn ?? today,
  };
}

/**
 * Lo que escriben avanzar, cambiar de etapa y el import con salto. La etapa
 * queda "sin empezar" hasta su primera sesión. `programStartedOn` no se toca.
 */
export function stageReset(stageIndex) {
  return { currentStageIndex: stageIndex, stageStartedOn: null, stageSessionsDone: 0, stageExtraWeeks: 0 };
}

/**
 * Todo lo que una pantalla necesita saber de la etapa en curso (§3.4), igual en
 * el móvil del atleta y en el del entrenador — por eso es una función pura del
 * programa, el progreso y el día.
 *
 * - `expected` NO cuenta las semanas añadidas: se alarga para recuperar lo que
 *   falta, no para deber una semana más. Si las contara, alargar 1 semana y
 *   entrenarla entera dejaría el mismo déficit.
 * - `missingWeeks` redondea: es la tolerancia (1 sesión de 12 no pide nada).
 *   Solo tiene sentido con `ended`.
 * - Sin límite (`durationWeeks: null`) no hay fin: `lengthWeeks`, `expected` y
 *   `endsOn` son null.
 *
 * @param {object} program
 * @param {object} progress  de `athleteProgress`
 * @param {string} today     'YYYY-MM-DD' local
 */
export function stageStatus(program, progress, today = localDay()) {
  const stages   = program?.stages ?? [];
  const last     = Math.max(0, stages.length - 1);
  const stageIdx = Math.max(0, Math.min(progress?.currentStageIndex ?? 0, last));
  const stage    = stages[stageIdx] ?? null;
  const perWeek  = stageDaysPerWeek(stage);

  const startedOn   = progress?.stageStartedOn ?? null;
  const started     = !!startedOn;
  const weekInStage = started ? weekNumber(startedOn, today) : 1;

  const duration    = stage?.durationWeeks ?? null;
  const lengthWeeks = duration == null ? null : duration + (progress?.stageExtraWeeks ?? 0);
  const expected    = duration == null ? null : duration * perWeek;
  const done        = progress?.stageSessionsDone ?? 0;
  const missing     = expected == null ? 0 : Math.max(0, expected - done);

  const endsOn = started && lengthWeeks != null ? addDays(weekOne(startedOn), 7 * lengthWeeks) : null;
  const ended  = endsOn != null && today >= endsOn;   // 'YYYY-MM-DD' ordena como fecha

  return {
    stageIdx,
    stage,
    daysPerWeek:  perWeek,
    started,
    weekInStage,
    lengthWeeks,
    expected,
    done,
    missingWeeks: Math.round(missing / perWeek),
    ended,
    earlyReady:   !ended && started && lengthWeeks != null
                  && weekInStage === lengthWeeks && done >= expected,
    endsOn,
    isLast:       stageIdx >= last,
    programWeek:  progress?.programStartedOn ? weekNumber(progress.programStartedOn, today) : null,
  };
}

/**
 * Pasa un progreso contado en ciclos al modelo de semanas (§5.4): el estado
 * persistido de antes de la migración y un blob viejo restaurado al reinstalar.
 * Idempotente — lo ya migrado vuelve tal cual.
 *
 * Las fechas se reconstruyen hacia atrás desde hoy, una semana por ciclo
 * cerrado: es lo más cerca que se puede estar sin fechas guardadas.
 *
 * @param {object} p               programa o blob con los contadores viejos
 * @param {number} stageDaysCount  sesiones de la etapa en curso (un ciclo)
 * @param {string} today           'YYYY-MM-DD'
 */
export function fromLegacyProgress(p, stageDaysCount, today) {
  if (!p || p.stageSessionsDone !== undefined) return p;
  // eslint-disable-next-line no-unused-vars
  const { cycleCompletedIds, stageWeeksCompleted, totalWeeksCompleted, stageAdvancePending, ...rest } = p;
  const weeks = stageWeeksCompleted ?? 0;
  const total = totalWeeksCompleted ?? 0;
  const done  = weeks * stageDaysCount + (cycleCompletedIds?.length ?? 0);
  // Desde el LUNES de esta semana y no desde hoy: un viernes menos dos semanas
  // es otro viernes, que `weekOne` manda al lunes siguiente — y el atleta
  // perdería una semana en la migración.
  const monday = addDays(today, -dowOf(today));
  return {
    ...rest,
    stageSessionsDone: done,
    stageStartedOn:    done > 0 ? addDays(monday, -7 * weeks) : null,
    stageExtraWeeks:   0,
    programStartedOn:  done > 0 || total > 0 ? addDays(monday, -7 * total) : null,
  };
}
