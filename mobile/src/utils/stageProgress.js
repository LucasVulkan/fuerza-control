/**
 * Progreso por etapas — la ÚNICA regla de «por dónde va el atleta», igual en su
 * móvil y en el espejo que ve su entrenador. Spec: `docs/specs/weeks-model.md`.
 *
 * Una etapa dura SEMANAS de calendario, contadas desde el lunes de la semana 1
 * (`weekOne`), que la fija la primera sesión guardada en ella. Al acabar se
 * comprueba lo entrenado contra lo esperado (semanas × entrenos por semana).
 * Hasta sep-2026 se contaban «ciclos» —vueltas completas a las sesiones
 * distintas—, que eran imposibles de explicar y mentían en cuanto los días de
 * entreno no coincidían con las sesiones del programa.
 *
 * Qué se GUARDA (§3.1), y nada más:
 *  - En la etapa (lo escribe el autor del programa): `durationWeeks` y `locked`.
 *    Sus SESIONES son los entrenos que se esperan cada semana (`weeklySessions`).
 *  - En el programa del atleta (lo escribe SOLO él, y viaja al entrenador en el
 *    blob `progress` del historial): `currentStageIndex`, `stageStartedOn`,
 *    `stageSessionsDone`, `stageExtraWeeks`, `programStartedOn`.
 * Todo lo demás —semana de la etapa, si terminó, cuánto falta— se DERIVA con
 * `stageStatus`, en los dos móviles con la misma función.
 *
 * El progreso sigue siendo un CONTADOR, no una lectura del historial (stage-locks
 * §0.7-§0.9): borrar sesiones no hace retroceder, y reinstalar devuelve al
 * atleta donde estaba porque las fechas y el contador viajan en el blob.
 */

import { generateId } from './formatters';

// ── Etapas ────────────────────────────────────────────────────────────────────

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
 * Los días de la etapa activa del programa.
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
 * migration behaviour-preserving: a program without stages never had an end.
 * Handing the migrated stage a number would invent an ending nobody asked for.
 */
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
 * Entrenos que se esperan cada semana en una etapa: SUS SESIONES, y punto. Una
 * etapa de 4 sesiones son 4 entrenos por semana; si la siguiente tiene 2, son 2.
 * No hay un dato aparte que configurar (weeks-model.md §0.4).
 */
export const weeklySessions = (stage) => Math.max(1, stage?.days?.length ?? 0);

/**
 * Lo que dura y lo que pide un programa entero, sumando etapa a etapa: semanas,
 * y sesiones = sesiones de la etapa × semanas. Una etapa sin límite deja el
 * total indeterminado: se suman las demás y `open` avisa para pintar un «+».
 */
export function programTotals(program) {
  const stages = program?.stages ?? [];
  return {
    weeks:    stages.reduce((a, s) => a + (s.durationWeeks ?? 0), 0),
    sessions: stages.reduce((a, s) => a + weeklySessions(s) * (s.durationWeeks ?? 0), 0),
    open:     stages.some((s) => s.durationWeeks == null),
  };
}

// ── Días de calendario ───────────────────────────────────────────────────────
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

// ── El progreso del atleta ───────────────────────────────────────────────────

/** Los campos de progreso que se guardan y viajan (§3.1). */
const PROGRESS_KEYS = [
  'currentStageIndex', 'stageStartedOn', 'stageSessionsDone', 'stageExtraWeeks', 'programStartedOn',
];
/** Los del modelo de ciclos. Solo se leen para migrarlos (`fromLegacyProgress`). */
const LEGACY_KEYS = ['cycleCompletedIds', 'stageWeeksCompleted', 'totalWeeksCompleted', 'stageAdvancePending'];
const withoutLegacy = (o) => Object.fromEntries(Object.entries(o).filter(([k]) => !LEGACY_KEYS.includes(k)));

/**
 * El progreso del ATLETA en un programa, esté en su móvil (los campos del
 * propio programa) o espejado en el del entrenador (`client.progress`, el blob
 * que sube el cliente). Es la ÚNICA puerta para leer el progreso (§3.7): en el
 * móvil del entrenador, los campos del programa son de SU copia y no se mueven,
 * y leerlos ahí es el fallo que más veces ha vuelto (stage-locks §9).
 *
 * Un blob de otro programa no se adopta: se cae a los campos del programa.
 *
 * Convierte al vuelo un progreso contado en ciclos (`fromLegacyProgress`): por
 * aquí pasan el blob que el entrenador guardó antes de actualizar, el que se
 * restaura al reinstalar y el de un `.fitdata` viejo, sin que ninguno de esos
 * caminos tenga que acordarse.
 *
 * @returns {{ currentStageIndex, stageStartedOn, stageSessionsDone, stageExtraWeeks, programStartedOn }}
 */
export function athleteProgress(program, client = null, today = localDay()) {
  const blob = client?.progress;
  const raw  = blob && blob.programId === program?.id ? blob : (program ?? {});
  const src  = fromLegacyProgress(raw, stageDaysAt(program, raw.currentStageIndex ?? 0).length, today);
  const idx  = Math.max(0, src.currentStageIndex ?? 0);
  const n    = program?.stages?.length ?? 0;
  return {
    // Recortado: el entrenador puede haber borrado etapas por debajo de donde
    // está el cliente, y un índice fuera de rango pinta una etapa vacía.
    currentStageIndex: n ? Math.min(idx, n - 1) : idx,
    stageStartedOn:    src.stageStartedOn    ?? null,
    stageSessionsDone: src.stageSessionsDone ?? 0,
    stageExtraWeeks:   src.stageExtraWeeks   ?? 0,
    programStartedOn:  src.programStartedOn  ?? null,
  };
}

/**
 * Escribe un parche de progreso en un programa, quitando de paso los campos de
 * ciclos que pudiera arrastrar: que no quede un `stageWeeksCompleted` fantasma
 * que alguien lea.
 */
export const applyProgress = (program, patch) => ({ ...withoutLegacy(program), ...patch });

/** Un programa con su progreso en la forma de semanas. Lo usan la rehidratación y la entrada de programas. */
export const normalizeProgress = (program, today = localDay()) =>
  (program ? applyProgress(program, athleteProgress(program, null, today)) : program);

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
 * «Cuenta como Sesión X» de una sesión libre (free-sessions.md §7.3): el patch
 * del contador al marcar, desmarcar o cambiar la sesión sustituida.
 *
 * - De no contar a contar: lo mismo que guardar una sesión de la etapa.
 * - De contar a no contar: una menos, sin bajar de cero.
 * - De A a C, o de nada a nada: el contador no se mueve.
 *
 * ponytail: quitarla no deshace `stageStartedOn` si fue la primera sesión de la
 * etapa — la etapa arrancó ese día igualmente. Y quien llama deduce
 * `wasCounted` de la etapa ACTUAL, cosa que solo vale mientras esto se use en
 * el recap recién guardado. Si se edita desde el historial, guardar en la
 * entrada en qué etapa contó.
 */
export function substitutionPatch(progress, { wasCounted, countsNow, today }) {
  if (wasCounted === countsNow) return {};
  if (countsNow) return recordSession(progress, { inCurrentStage: true, today });
  return { stageSessionsDone: Math.max(0, (progress?.stageSessionsDone ?? 0) - 1) };
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
  const perWeek  = weeklySessions(stage);

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
    perWeek,
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
 * Dónde va de la etapa, con palabras: «Semana 3 de 4», «Semana 5 de 5 (+1)» si
 * alargó, «Semana 7» si no tiene techo, «Sin empezar». La usan la tarjeta de programa, el
 * planificador y la ficha de cliente, así que dicen lo mismo. `t` entra como
 * parámetro, como en `describeRx`: este módulo no conoce i18n.
 *
 * @param {object} status  de `stageStatus`
 */
export function stageWeekLabel(status, t) {
  if (!status.started) return t('programCard.stageNotStarted');
  if (status.lengthWeeks == null) return t('programCard.stageWeekOpen', { week: status.weekInStage });
  const extra = status.lengthWeeks - (status.stage?.durationWeeks ?? status.lengthWeeks);
  return extra > 0
    ? t('programCard.stageWeekExtra', { week: status.weekInStage, total: status.lengthWeeks, extra })
    : t('programCard.stageWeek', { week: status.weekInStage, total: status.lengthWeeks });
}

/**
 * La línea de detalle de la etapa: «Semana 3 de 4 · 8 de 12 sesiones», o solo la
 * semana si la etapa no tiene techo (no hay total de sesiones que dar). La pintan
 * la tarjeta del atleta y la ficha del cliente.
 */
export function stageDetail(status, t) {
  const week = stageWeekLabel(status, t);
  return status.expected != null
    ? `${week} · ${t('programCard.stageSessions', { done: status.done, expected: status.expected })}`
    : week;
}

/**
 * ¿Toca enseñar el aviso de fin de etapa? (§6.1). Lo leen la Home y el punto del
 * tab de Programa, así que es un solo sitio. La última etapa no avisa: no hay a
 * dónde pasar. `snoozeUntil` es local del móvil (`stageBannerSnooze`).
 */
export function stageBannerDue(program, progress, snoozeUntil = null, today = localDay()) {
  const st = stageStatus(program, progress, today);
  return !st.isLast && (st.ended || st.earlyReady) && !(snoozeUntil && today < snoozeUntil);
}

/**
 * Cierra una etapa sin límite (`durationWeeks: null`) en las semanas COMPLETAS
 * que el atleta lleva en ella. Se llama al añadir una etapa detrás.
 *
 * Tiene que pasar: una etapa sin límite no termina nunca, así que dejarla
 * delante de otra encierra al atleta en ella para siempre. Ya no hace falta
 * encender nada: con el fin derivado de la fecha, si las semanas cerradas ya
 * pasaron el aviso sale solo. Sin empezar, o en su primera semana, queda en 1.
 *
 * @param {array}  stages
 * @param {number} stageIndex  la etapa en la que está el ATLETA (no la del entrenador)
 * @param {object} progress    de `athleteProgress`
 * @returns {array} las etapas (el mismo array si no había nada que cerrar)
 */
export function closeOpenStage(stages, stageIndex, progress, today = localDay()) {
  const stage = stages?.[stageIndex];
  if (!stage || stage.durationWeeks != null) return stages;
  const { started, weekInStage } = stageStatus({ stages }, { ...progress, currentStageIndex: stageIndex }, today);
  const durationWeeks = Math.max(1, started ? weekInStage - 1 : 0);
  return stages.map((s, i) => (i === stageIndex ? { ...s, durationWeeks } : s));
}

// ── Sincronización cliente → entrenador ──────────────────────────────────────

/**
 * The client's progress, as it travels to the trainer alongside their history
 * and comes back on a reinstall. `programId` lets the receiver reject a blob
 * that belongs to a program the client is no longer on.
 *
 * @returns {object|null} null when the program has no id (nothing to sync)
 */
export function progressBlob(program, appliedActivation = null) {
  if (!program?.id) return null;
  return {
    programId: program.id,
    ...athleteProgress(program),
    // The activation stamp this position was computed under. On a reconnect the
    // restore compares it against the incoming program's stamp: a newer stamp
    // there means the trainer moved the client while this blob sat in the slot,
    // and the move must win over the blob — same rule as a live update. Without
    // this, a reinstall silently swallowed a pending activation.
    appliedActivation,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Whether any field `progressBlob` ships differs between two versions of a
 * program — the client uploads when this flips (qa-sep-conexion.md §3.2 a).
 */
export function progressChanged(a, b) {
  return a?.id !== b?.id || PROGRESS_KEYS.some((k) => a?.[k] !== b?.[k]);
}

/** Where the athlete actually is in a program, seen from the TRAINER's device. */
export const clientStageIndex = (client, program) => athleteProgress(program, client).currentStageIndex;

/**
 * Which progress the client keeps when an updated program lands from their
 * trainer. Progress belongs to the client, so whatever the incoming copy
 * carries is discarded — with ONE exception: if the trainer deliberately
 * activated a stage since the last import, the client jumps there and that
 * stage starts from zero (sin empezar hasta su primera sesión).
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
 * @returns {object} los cinco campos de progreso, listos para `applyProgress`
 */
export function mergeProgressOnImport({ blob, program, lastActivation = null, today = localDay() }) {
  // No blob for THIS program means a different program arrived, not an update.
  const kept       = blob && blob.programId === program?.id ? athleteProgress(program, { progress: blob }, today) : null;
  const activation = program?.stageActivatedAt ?? null;
  const jump       = !kept || (!!activation && activation !== lastActivation);
  if (!jump) return kept;

  const n   = program?.stages?.length ?? 0;
  const idx = Math.max(0, program?.currentStageIndex ?? 0);
  return {
    ...stageReset(n ? Math.min(idx, n - 1) : idx),
    // Moverle de etapa no le reinicia el programa; cambiarle de programa, sí.
    programStartedOn: kept?.programStartedOn ?? null,
  };
}

// ── Migración ────────────────────────────────────────────────────────────────

/**
 * Pasa un progreso contado en ciclos al modelo de semanas (§5.4): el estado
 * persistido de antes de la migración y un blob viejo. Idempotente — lo ya
 * migrado vuelve tal cual.
 *
 * Las fechas se reconstruyen hacia atrás desde hoy, una semana por ciclo
 * cerrado: es lo más cerca que se puede estar sin fechas guardadas.
 *
 * @param {object} p               programa o blob con los contadores viejos
 * @param {number} stageDaysCount  sesiones de la etapa en curso (un ciclo)
 * @param {string} today           'YYYY-MM-DD'
 */
export function fromLegacyProgress(p, stageDaysCount, today) {
  // Viejo = trae campos de ciclos. NO "le falta `stageSessionsDone`": un
  // programa recién creado no tiene ninguno, y tratarlo como viejo en cada
  // lectura pisaba lo que ya se le hubiera escrito (las semanas añadidas).
  if (!p || !LEGACY_KEYS.some((k) => k in p)) return p;
  // Con los dos juegos a la vez (un emisor a medio migrar), mandan los nuevos.
  if (p.stageSessionsDone !== undefined) return withoutLegacy(p);
  const weeks = p.stageWeeksCompleted ?? 0;
  const total = p.totalWeeksCompleted ?? 0;
  const done  = weeks * stageDaysCount + (p.cycleCompletedIds?.length ?? 0);
  // Desde el LUNES de esta semana y no desde hoy: un viernes menos dos semanas
  // es otro viernes, que `weekOne` manda al lunes siguiente — y el atleta
  // perdería una semana en la migración.
  const monday = addDays(today, -dowOf(today));
  return {
    ...withoutLegacy(p),
    stageSessionsDone: done,
    stageStartedOn:    done > 0 ? addDays(monday, -7 * weeks) : null,
    stageExtraWeeks:   0,
    programStartedOn:  done > 0 || total > 0 ? addDays(monday, -7 * total) : null,
  };
}
