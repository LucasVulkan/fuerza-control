/**
 * Adherence (trainer side) — pure scoring of how well a client keeps up with
 * their training, derived from their session history and the expected weekly
 * frequency of their active program. Extracted from the screen so it can be
 * unit-tested and reused by both the filter pills (counters) and each card.
 *
 * Two layers stay separate by design:
 *  - The trainer's MANUAL status (active/paused/inactive) defines the universe.
 *    'paused'/'inactive' mute adherence — we don't chase someone on a break.
 *  - The PROCEDURAL status below is what the data says about an active client.
 */

const DAY = 86400000;

/** Local Monday 00:00 of the week containing `ts`. */
function startOfWeek(ts) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  const dow = (d.getDay() + 6) % 7; // 0 = Monday … 6 = Sunday
  d.setDate(d.getDate() - dow);
  return d.getTime();
}

/** Sessions per local calendar week, keyed by that week's Monday timestamp. */
function countByWeek(timestamps) {
  const counts = new Map();
  timestamps.forEach((ts) => {
    const ws = startOfWeek(ts);
    counts.set(ws, (counts.get(ws) ?? 0) + 1);
  });
  return counts;
}

/**
 * Consecutive weeks (ending at the current week if already met, else the
 * previous one) where the client hit their weekly target.
 */
function weeklyStreak(timestamps, target, now) {
  const counts = countByWeek(timestamps);
  let ws = startOfWeek(now);
  // Current week still incomplete: start counting from last week so an
  // in-progress week never breaks an otherwise-clean streak.
  if ((counts.get(ws) ?? 0) < target) ws = startOfWeek(ws - DAY);
  let streak = 0;
  while ((counts.get(ws) ?? 0) >= target) {
    streak += 1;
    ws = startOfWeek(ws - DAY);
  }
  return streak;
}

/** Adherence procedural status values. */
export const STATUS = {
  ON_TRACK: 'on_track',
  SLIPPING: 'slipping',
  AT_RISK:  'at_risk',
  NO_DATA:  'no_data',
  MUTED:    'muted',
};

/** True when the status is one the trainer should act on. */
export function requiresAttention(status) {
  return status === STATUS.AT_RISK || status === STATUS.SLIPPING;
}

/**
 * Scores a client's adherence.
 *
 * The risk thresholds scale with the program's frequency, so they are fair
 * across clients: the expected gap between sessions is `7 / target` days, and
 * we measure how many of those gaps have elapsed since the last session
 * (`ratio`). ≤2 gaps is normal (a rest day or two); >4 gaps is at risk.
 *
 * @param {object}   args
 * @param {Array}    [args.sessions]         Client entries — each { timestamp }.
 * @param {number}   [args.sessionsPerCycle] Expected sessions per week (active program).
 * @param {string}   [args.manualStatus]     'active' | 'paused' | 'inactive'.
 * @param {number}   [args.now]              Injectable clock for tests.
 * @returns {{
 *   status: string, daysSince: number|null,
 *   weekDone: number, weekTarget: number, streak: number,
 * }}
 */
export function computeAdherence({
  sessions = [],
  sessionsPerCycle = 0,
  manualStatus = 'active',
  now = Date.now(),
} = {}) {
  const target = Math.max(1, sessionsPerCycle);
  const stamps = sessions
    .map((s) => s?.timestamp)
    .filter((ts) => typeof ts === 'number')
    .sort((a, b) => a - b);

  const weekDone   = stamps.filter((ts) => ts >= startOfWeek(now)).length;
  const lastTs     = stamps.length ? stamps[stamps.length - 1] : null;
  const daysSince  = lastTs != null ? Math.floor((now - lastTs) / DAY) : null;
  const base       = { daysSince, weekDone, weekTarget: target, streak: 0 };

  // Manual pause/inactive silences adherence entirely.
  if (manualStatus === 'paused' || manualStatus === 'inactive') {
    return { ...base, status: STATUS.MUTED };
  }
  // No history yet (e.g. just connected) — neutral, not a false alarm.
  if (!stamps.length) {
    return { ...base, status: STATUS.NO_DATA };
  }

  const gapDays = 7 / target;          // expected days between sessions
  const ratio   = daysSince / gapDays; // gaps elapsed since last session
  const status  = ratio <= 2 ? STATUS.ON_TRACK
                : ratio <= 4 ? STATUS.SLIPPING
                :              STATUS.AT_RISK;

  return { ...base, status, streak: weeklyStreak(stamps, target, now) };
}
