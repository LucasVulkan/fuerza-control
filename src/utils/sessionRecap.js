/**
 * sessionRecap — pure helpers for the post-session summary screen.
 *
 * All weights are in kg (the storage unit); callers convert for display.
 * PRs are computed on the fly from the workout log — no extra storage.
 */
import { epley1RM } from './oneRm';

const num = (v) => {
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
};

/** Sets that count: explicitly done or carrying any data. */
export function doneSets(ex) {
  return (ex.sets ?? []).filter(
    (s) => s.done || s.weight !== '' || s.reps !== '' || s.time !== ''
  );
}

/** Dropset sub-series that count: explicitly done or carrying any data. */
export function doneDrops(set) {
  return (set.drops ?? []).filter((d) => d.done || d.weight !== '' || d.reps !== '');
}

/**
 * Totals for the hero row: volume (kg), sets done vs planned.
 * Planned comes from entry.plannedSets (captured at save time — skipped
 * exercises are absent from `exercises`, so it can't be derived from them);
 * older entries fall back to the per-exercise totals.
 */
export function recapStats(entry) {
  let volume = 0, setsDone = 0, fallbackPlanned = 0;
  for (const ex of entry.exercises ?? []) {
    const done = doneSets(ex);
    setsDone        += done.length;
    fallbackPlanned += Math.max(ex.totalSets ?? 0, done.length);
    for (const s of done) {
      const w = num(s.weight), r = num(s.reps);
      if (w > 0 && r > 0) volume += w * r;
      for (const d of doneDrops(s)) {
        const dw = num(d.weight), dr = num(d.reps);
        if (dw > 0 && dr > 0) volume += dw * dr;
      }
    }
  }
  const setsPlanned = entry.plannedSets != null ? entry.plannedSets : fallbackPlanned;
  return { volume: Math.round(volume), setsDone, setsPlanned };
}

function bestE1RM(sets) {
  let best = null;
  for (const s of sets) {
    const v = epley1RM(s.weight, s.reps, s.rpe);
    if (v != null && (best == null || v > best)) best = v;
  }
  return best;
}

/** Best reps among bodyweight sets (no weight recorded). */
function bestReps(sets) {
  let best = null;
  for (const s of sets) {
    const w = num(s.weight), r = num(s.reps);
    if ((w == null || w <= 0) && r > 0 && (best == null || r > best)) best = r;
  }
  return best;
}

/** Heaviest weight lifted, regardless of reps. */
function topWeight(sets) {
  let best = null;
  for (const s of sets) {
    const w = num(s.weight);
    if (w > 0 && (best == null || w > best)) best = w;
  }
  return best;
}

/**
 * PRs in `entry` vs all older log entries (any session).
 * An exercise with no prior history is never a PR — a first time is a baseline.
 * Ladder per exercise (one PR max): e1RM → top weight → bodyweight reps.
 * Top weight covers what e1RM can't: heavy singles and high-rep sets
 * (>12 effective reps) where Epley is unreliable.
 * Returns [{ exerciseId, kind: 'e1rm'|'weight'|'reps', value, prev }].
 */
export function detectPRs(entry, workoutLog) {
  const prior = (workoutLog ?? []).filter(
    (e) => e.id !== entry.id && e.timestamp <= entry.timestamp
  );
  const prs = [];
  for (const ex of entry.exercises ?? []) {
    const done = doneSets(ex);
    if (!done.length) continue;
    const prevSets = prior.flatMap((e) =>
      (e.exercises ?? [])
        .filter((p) => p.exerciseId === ex.exerciseId)
        .flatMap((p) => doneSets(p))
    );
    if (!prevSets.length) continue;

    const nowE = bestE1RM(done), prevE = bestE1RM(prevSets);
    if (nowE != null && prevE != null && nowE > prevE + 1e-9) {
      prs.push({ exerciseId: ex.exerciseId, kind: 'e1rm', value: nowE, prev: prevE });
      continue;
    }
    const nowW = topWeight(done), prevW = topWeight(prevSets);
    if (nowW != null && prevW != null && nowW > prevW) {
      prs.push({ exerciseId: ex.exerciseId, kind: 'weight', value: nowW, prev: prevW });
      continue;
    }
    const nowR = bestReps(done), prevR = bestReps(prevSets);
    if (nowR != null && prevR != null && nowR > prevR) {
      prs.push({ exerciseId: ex.exerciseId, kind: 'reps', value: nowR, prev: prevR });
    }
  }
  return prs;
}

/**
 * Result of the previous entry (same template, earlier timestamp) that logged
 * a block with this `blockId` — for the recap's block delta chip (§7.2).
 * Returns null when there's no such entry (new block / first run).
 */
export function prevBlockResult(entry, workoutLog, blockId) {
  const prevEntries = (workoutLog ?? [])
    .filter((e) =>
      e.id !== entry.id &&
      e.sessionTemplateId === entry.sessionTemplateId &&
      e.timestamp <= entry.timestamp)
    .sort((a, b) => b.timestamp - a.timestamp);
  for (const e of prevEntries) {
    const block = (e.blocks ?? []).find((b) => b.blockId === blockId);
    if (block) return block.result;
  }
  return null;
}

/**
 * Per-exercise delta vs the previous entry of the same template.
 * Delta priority: top-set weight → reps at top weight → time → sets count → equal.
 * Returns null when there is nothing to compare against (free session or
 * first time); exercises new to the session get delta: null.
 */
export function compareToLast(entry, workoutLog) {
  if (!entry.sessionTemplateId || entry.sessionTemplateId === '__free__') return null;
  const last = (workoutLog ?? [])
    .filter((e) =>
      e.id !== entry.id &&
      e.sessionTemplateId === entry.sessionTemplateId &&
      e.timestamp <= entry.timestamp)
    .sort((a, b) => b.timestamp - a.timestamp)[0];
  if (!last) return null;

  const topW   = (sets) => Math.max(0, ...sets.map((s) => num(s.weight) ?? 0));
  const repsAt = (sets, w) =>
    Math.max(0, ...sets.filter((s) => (num(s.weight) ?? 0) === w).map((s) => num(s.reps) ?? 0));
  const maxT   = (sets) => Math.max(0, ...sets.map((s) => num(s.time) ?? 0));

  return (entry.exercises ?? []).map((ex) => {
    const now = doneSets(ex);
    const out = { exerciseId: ex.exerciseId, sets: now, note: ex.note ?? null, delta: null };
    const prevEx = (last.exercises ?? []).find((p) => p.exerciseId === ex.exerciseId);
    if (!prevEx) return out; // new in this session — nothing to compare
    const prev = doneSets(prevEx);
    if (!now.length || !prev.length) return out;

    const wNow = topW(now), wPrev = topW(prev);
    const rNow = bestReps(now), rPrev = bestReps(prev);
    if (wNow !== wPrev) {
      out.delta = { kind: 'weight', diff: wNow - wPrev };
    } else if (wNow > 0 && repsAt(now, wNow) !== repsAt(prev, wPrev)) {
      out.delta = { kind: 'reps', diff: repsAt(now, wNow) - repsAt(prev, wPrev) };
    } else if (wNow === 0 && rNow != null && rPrev != null && rNow !== rPrev) {
      out.delta = { kind: 'reps', diff: rNow - rPrev };
    } else if (wNow === 0 && maxT(now) !== maxT(prev)) {
      out.delta = { kind: 'time', diff: maxT(now) - maxT(prev) };
    } else if (now.length !== prev.length) {
      out.delta = { kind: 'sets', diff: now.length - prev.length };
    } else {
      out.delta = { kind: 'equal', diff: 0 };
    }
    return out;
  });
}
