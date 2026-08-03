/**
 * conditioningBlocks — pure helpers for AMRAP/EMOM/for-time blocks.
 *
 * Wall-clock only: every time-derived value takes `now` as an explicit
 * argument instead of accumulating internally, so the caller can re-derive
 * the real state after the app was killed/minimized (see spec §4).
 */
import { generateId } from './formatters';

/** Bloque en blanco — el que crea "añadir bloque" antes de abrir su editor. */
export function defaultBlock() {
  return {
    id: generateId('blk'),
    format: 'amrap',
    capSec: 600,
    intervalSec: null,
    rounds: null,
    emomMode: 'rotate',
    movements: [],
    name: null,
    notes: null,
  };
}

/** Seconds left in an AMRAP's time cap, clamped to 0. */
export function amrapRemaining(block, startedAt, now) {
  const capSec = block.capSec ?? 0;
  if (startedAt == null) return capSec;
  const elapsed = Math.floor((now - startedAt) / 1000);
  return Math.max(0, capSec - elapsed);
}

export function amrapFinished(block, startedAt, now) {
  return amrapRemaining(block, startedAt, now) === 0;
}

/**
 * Total EMOM intervals. A "round" is one full cycle through the movements:
 * in rotate mode a round spans movements.length intervals (so every movement
 * is done the same number of times); in 'all' mode each interval already
 * covers every movement, so a round IS an interval. A single-movement (or
 * empty) EMOM has one interval per round either way.
 */
export function emomTotalIntervals(block) {
  const rounds = block.rounds ?? 1;
  const moves  = block.movements?.length ?? 0;
  if (block.emomMode === 'all' || moves <= 1) return rounds;
  return rounds * moves;
}

/**
 * Which EMOM interval is live right now.
 * `interval` is 0-based and clamps to the last interval once the whole block
 * has elapsed (kill-recovery: an arbitrarily large `now` still resolves).
 */
export function emomPosition(block, startedAt, now) {
  const intervalSec = block.intervalSec ?? 60;
  const total = emomTotalIntervals(block);
  if (startedAt == null) {
    return { interval: 0, intervalRemaining: intervalSec, finished: false };
  }
  const elapsed = Math.floor((now - startedAt) / 1000);
  const totalSec = intervalSec * total;
  if (elapsed >= totalSec) {
    return { interval: total - 1, intervalRemaining: 0, finished: true };
  }
  const interval = Math.floor(elapsed / intervalSec);
  const intervalRemaining = intervalSec - (elapsed % intervalSec);
  return { interval, intervalRemaining, finished: false };
}

/** Elapsed seconds for a for-time block; clamps + flags `capped` at capSec. */
export function forTimeElapsed(block, startedAt, now) {
  if (startedAt == null) return { elapsedSec: 0, capped: false };
  const elapsed = Math.floor((now - startedAt) / 1000);
  if (block.capSec != null && elapsed >= block.capSec) {
    return { elapsedSec: block.capSec, capped: true };
  }
  return { elapsedSec: elapsed, capped: false };
}

/** EMOM 'rotate' mode: which movement is due this interval. */
export function currentMovement(block, intervalIdx) {
  const movements = block.movements ?? [];
  if (!movements.length) return null;
  return movements[intervalIdx % movements.length];
}

/**
 * The `entry.blocks[].result` shape for a block, from its live state.
 * amrap/for_time scores are whatever the athlete entered; emom's `completed`
 * is time-derived (unmarked intervals count as done — the optimistic default
 * from spec §7.1) minus whatever was explicitly marked failed.
 */
export function buildBlockResult(block, blockState, now) {
  const { startedAt, rounds, extraReps, failed, timeSec } = blockState;

  if (block.format === 'amrap') {
    return { rounds: rounds ?? 0, extraReps: extraReps ?? 0 };
  }

  if (block.format === 'emom') {
    const total = emomTotalIntervals(block);
    const pos = emomPosition(block, startedAt, now);
    const transpired = pos.finished ? total : pos.interval;
    const completed = Math.max(0, transpired - (failed?.length ?? 0));
    return { completed, total, failed: failed ?? [] };
  }

  // for_time
  if (timeSec != null) {
    // Already finished — capped is a property of the frozen score, not of
    // whatever `now` happens to be when this is (re)computed later.
    const capped = block.capSec != null && timeSec >= block.capSec;
    return { timeSec, capped };
  }
  // Saved mid-session, never finished: snapshot the live elapsed time.
  // Per spec, this case is always capped:false (an auto-finish on cap would
  // already have set timeSec).
  const { elapsedSec } = forTimeElapsed(block, startedAt, now);
  return { timeSec: elapsedSec, capped: false };
}

/**
 * `entry.blocks` de una sesión guardada: config + resultado de cada bloque que
 * se llegó a EMPEZAR (los que no, no dejan rastro — spec §2.4). La config se
 * copia, no se referencia, para que el log siga siendo fiel a lo que se hizo
 * aunque el bloque se edite después.
 */
export function blocksLogFrom(blocks, blockState, now) {
  return (blocks ?? [])
    .filter((block) => blockState[block.id]?.startedAt)
    .map((block) => ({
      blockId:     block.id,
      format:      block.format,
      name:        block.name,
      capSec:      block.capSec,
      intervalSec: block.intervalSec,
      rounds:      block.rounds,
      emomMode:    block.emomMode,
      movements:   block.movements,
      result:      buildBlockResult(block, blockState[block.id], now),
    }));
}

/** UI score string — no i18n, just universal numbers/separators. */
export function formatBlockScore(result, format) {
  if (format === 'amrap') {
    return result.extraReps > 0 ? `${result.rounds} + ${result.extraReps}` : `${result.rounds}`;
  }
  if (format === 'emom') {
    return `${result.completed}/${result.total}`;
  }
  // for_time
  const mm = Math.floor(result.timeSec / 60);
  const ss = Math.floor(result.timeSec % 60);
  return `${mm}:${String(ss).padStart(2, '0')}`;
}

/**
 * Delta vs the previous entry with the same blockId, for the recap chip.
 * Structured (not a pre-formatted string) so the UI can i18n it — mirrors
 * the `{ kind, diff }` shape of sessionRecap's compareToLast.
 * `kind: null` means "no previous entry" (recap shows no chip at all);
 * `kind: 'equal'` means there IS a previous entry and it tied.
 */
export function compareBlockResults(format, now, prev) {
  if (!prev) return { better: null, kind: null, diff: 0 };

  if (format === 'amrap') {
    if (now.rounds !== prev.rounds) {
      return { better: now.rounds > prev.rounds, kind: 'rounds', diff: now.rounds - prev.rounds };
    }
    if (now.extraReps !== prev.extraReps) {
      return { better: now.extraReps > prev.extraReps, kind: 'reps', diff: now.extraReps - prev.extraReps };
    }
    return { better: null, kind: 'equal', diff: 0 };
  }

  if (format === 'emom') {
    if (now.completed === prev.completed) return { better: null, kind: 'equal', diff: 0 };
    return { better: now.completed > prev.completed, kind: 'completed', diff: now.completed - prev.completed };
  }

  // for_time — LESS time is better (inverted vs the other two formats)
  if (now.timeSec === prev.timeSec) return { better: null, kind: 'equal', diff: 0 };
  return { better: now.timeSec < prev.timeSec, kind: 'time', diff: now.timeSec - prev.timeSec };
}

/** Rough duration estimate for sessionStats — same role as a set's work+rest. */
export function blockEstimatedSec(block) {
  if (block.format === 'amrap') return block.capSec ?? 600;
  if (block.format === 'emom') return (block.intervalSec ?? 60) * emomTotalIntervals(block);
  return block.capSec ?? 600; // for_time
}
