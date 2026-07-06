import { describe, it, expect } from 'vitest';
import { recapStats, detectPRs, compareToLast } from './sessionRecap';

const set = (weight, reps, extra = {}) => ({ weight: String(weight), reps: String(reps), time: '', done: true, ...extra });
const bw  = (reps) => ({ weight: '', reps: String(reps), time: '', done: true });

function entry({ id = 'log_now', tpl = 'tpl_a', ts = 1000, exercises = [] } = {}) {
  return { id, sessionTemplateId: tpl, timestamp: ts, exercises };
}

describe('recapStats', () => {
  it('sums volume and counts done vs planned sets', () => {
    const e = entry({
      exercises: [
        { exerciseId: 'bench', totalSets: 3, sets: [set(80, 10), set(80, 10), { weight: '', reps: '', time: '', done: false }] },
        { exerciseId: 'dips',  totalSets: 2, sets: [bw(12), bw(10)] },
      ],
    });
    const s = recapStats(e);
    expect(s.volume).toBe(1600);       // 80×10 ×2 (bodyweight adds nothing)
    expect(s.setsDone).toBe(4);
    expect(s.setsPlanned).toBe(5);
  });

  it('planned never drops below done (extra sets added mid-workout)', () => {
    const e = entry({ exercises: [{ exerciseId: 'bench', totalSets: 2, sets: [set(80, 8), set(80, 8), set(80, 8)] }] });
    expect(recapStats(e).setsPlanned).toBe(3);
  });

  it('plannedSets from the entry wins — counts skipped exercises', () => {
    // 2 exercises × 3 sets planned, only the first was trained: the skipped
    // one is absent from `exercises`, but plannedSets keeps the real plan.
    const e = entry({ exercises: [{ exerciseId: 'bench', totalSets: 3, sets: [set(80, 10), set(80, 10), set(80, 9)] }] });
    e.plannedSets = 6;
    const s = recapStats(e);
    expect(s.setsDone).toBe(3);
    expect(s.setsPlanned).toBe(6);
  });

  it('dropset: adds drop volume, but drops count as neither sets done nor planned', () => {
    const dropSet = set(80, 8, { drops: [{ weight: '60', reps: '10', done: true }, { weight: '45', reps: '8', done: true }] });
    const e = entry({ exercises: [{ exerciseId: 'squat', totalSets: 1, sets: [dropSet] }] });
    const s = recapStats(e);
    // 80×8 (640) + 60×10 (600) + 45×8 (360) = 1600
    expect(s.volume).toBe(1600);
    expect(s.setsDone).toBe(1);
    expect(s.setsPlanned).toBe(1);
  });

  it('dropset: undone drops with no data are ignored', () => {
    const dropSet = set(80, 8, { drops: [{ weight: '', reps: '', done: false }] });
    const e = entry({ exercises: [{ exerciseId: 'squat', totalSets: 1, sets: [dropSet] }] });
    expect(recapStats(e).volume).toBe(640);
  });
});

describe('detectPRs', () => {
  const prevLog = entry({
    id: 'log_old', ts: 500,
    exercises: [
      { exerciseId: 'bench', sets: [set(100, 5)] },     // e1RM ≈ 116.7
      { exerciseId: 'dips',  sets: [bw(12)] },
    ],
  });

  it('flags an e1RM PR against the best historical set', () => {
    const now = entry({ exercises: [{ exerciseId: 'bench', sets: [set(105, 5)] }] });
    const prs = detectPRs(now, [prevLog, now]);
    expect(prs).toHaveLength(1);
    expect(prs[0].kind).toBe('e1rm');
    expect(prs[0].value).toBeGreaterThan(prs[0].prev);
  });

  it('flags a bodyweight rep PR', () => {
    const now = entry({ exercises: [{ exerciseId: 'dips', sets: [bw(14)] }] });
    const prs = detectPRs(now, [prevLog, now]);
    expect(prs).toEqual([{ exerciseId: 'dips', kind: 'reps', value: 14, prev: 12 }]);
  });

  it('no history → no PR (first time is a baseline)', () => {
    const now = entry({ exercises: [{ exerciseId: 'squat', sets: [set(140, 3)] }] });
    expect(detectPRs(now, [prevLog, now])).toEqual([]);
  });

  it('matching the record is not a PR', () => {
    const now = entry({ exercises: [{ exerciseId: 'bench', sets: [set(100, 5)] }] });
    expect(detectPRs(now, [prevLog, now])).toEqual([]);
  });

  it('dropset reps/weight never count toward a PR (fatigue reps, not comparable)', () => {
    // Mother set matches the record; a huge drop (fatigue reps at lower weight)
    // must not fabricate a PR — drops live outside doneSets().
    const dropSet = set(100, 5, { drops: [{ weight: '999', reps: '999', done: true }] });
    const now = entry({ exercises: [{ exerciseId: 'bench', sets: [dropSet] }] });
    expect(detectPRs(now, [prevLog, now])).toEqual([]);
  });

  it('heavy single above best weight → weight PR even if e1RM is lower', () => {
    // prev best: 100×5 (e1RM ≈ 116.7). Now 105×1: e1RM 105 < 116.7, but the
    // bar was heavier than ever → top-weight PR.
    const now = entry({ exercises: [{ exerciseId: 'bench', sets: [set(105, 1)] }] });
    const prs = detectPRs(now, [prevLog, now]);
    expect(prs).toEqual([{ exerciseId: 'bench', kind: 'weight', value: 105, prev: 100 }]);
  });

  it('high-rep sets (e1RM not computable) still get weight PRs', () => {
    const oldHigh = entry({
      id: 'log_hr', ts: 400,
      exercises: [{ exerciseId: 'legpress', sets: [set(200, 15)] }],
    });
    const now = entry({ exercises: [{ exerciseId: 'legpress', sets: [set(210, 15)] }] });
    const prs = detectPRs(now, [oldHigh, now]);
    expect(prs).toEqual([{ exerciseId: 'legpress', kind: 'weight', value: 210, prev: 200 }]);
  });
});

describe('compareToLast', () => {
  const last = entry({
    id: 'log_old', ts: 500,
    exercises: [
      { exerciseId: 'bench', sets: [set(80, 10), set(80, 9)] },
      { exerciseId: 'dips',  sets: [bw(10)] },
      { exerciseId: 'curl',  sets: [set(20, 10), set(20, 10)] },
    ],
  });

  it('weight delta wins over everything else', () => {
    const now = entry({ exercises: [{ exerciseId: 'bench', sets: [set(82.5, 8)] }] });
    const d = compareToLast(now, [last, now]);
    expect(d[0].delta).toEqual({ kind: 'weight', diff: 2.5 });
  });

  it('same top weight → reps delta at that weight', () => {
    const now = entry({ exercises: [{ exerciseId: 'bench', sets: [set(80, 11)] }] });
    const d = compareToLast(now, [last, now]);
    expect(d[0].delta).toEqual({ kind: 'reps', diff: 1 });
  });

  it('bodyweight exercise compares reps', () => {
    const now = entry({ exercises: [{ exerciseId: 'dips', sets: [bw(12)] }] });
    const d = compareToLast(now, [last, now]);
    expect(d[0].delta).toEqual({ kind: 'reps', diff: 2 });
  });

  it('fewer sets at equal load → negative sets delta', () => {
    const now = entry({ exercises: [{ exerciseId: 'curl', sets: [set(20, 10)] }] });
    const d = compareToLast(now, [last, now]);
    expect(d[0].delta).toEqual({ kind: 'sets', diff: -1 });
  });

  it('identical performance → equal', () => {
    const now = entry({ exercises: [{ exerciseId: 'bench', sets: [set(80, 10), set(80, 9)] }] });
    const d = compareToLast(now, [last, now]);
    expect(d[0].delta).toEqual({ kind: 'equal', diff: 0 });
  });

  it('new exercise in the session → delta null', () => {
    const now = entry({ exercises: [{ exerciseId: 'flyes', sets: [set(14, 12)] }] });
    const d = compareToLast(now, [last, now]);
    expect(d[0].delta).toBeNull();
  });

  it('free sessions and first-time templates → null', () => {
    const free = entry({ tpl: '__free__', exercises: [] });
    expect(compareToLast(free, [last, free])).toBeNull();
    const first = entry({ tpl: 'tpl_never_done', exercises: [] });
    expect(compareToLast(first, [last, first])).toBeNull();
  });
});

// ─── Data-type edge cases ─────────────────────────────────────────────────────

const timeSet = (time) => ({ weight: '', reps: '', time: String(time), done: true });

describe('recapStats — data types', () => {
  it('time-only sets count as done but add no volume', () => {
    const e = entry({ exercises: [{ exerciseId: 'plank', totalSets: 3, sets: [timeSet(40), timeSet(45), timeSet(50)] }] });
    const s = recapStats(e);
    expect(s.setsDone).toBe(3);
    expect(s.volume).toBe(0);
  });

  it('decimal weights and comma-free strings sum correctly', () => {
    const e = entry({ exercises: [{ exerciseId: 'curl', totalSets: 2, sets: [set(12.5, 10), set(12.5, 8)] }] });
    expect(recapStats(e).volume).toBe(Math.round(12.5 * 10 + 12.5 * 8));
  });

  it('a set marked done with no data still counts as a done set', () => {
    const e = entry({ exercises: [{ exerciseId: 'dips', totalSets: 2, sets: [{ weight: '', reps: '', time: '', done: true }, bw(10)] }] });
    expect(recapStats(e).setsDone).toBe(2);
  });

  it('empty session → zeros', () => {
    expect(recapStats(entry({ exercises: [] }))).toEqual({ volume: 0, setsDone: 0, setsPlanned: 0 });
  });
});

describe('detectPRs — data types', () => {
  it('RPE adjusts effective reps: same weight×reps at lower RPE is an e1RM PR', () => {
    // 100×5 @RPE9 → effective 6 reps (e1RM 120). Later 100×5 @RPE7 → effective 8 (e1RM ≈ 126.7).
    const old = entry({ id: 'log_rpe', ts: 400, exercises: [{ exerciseId: 'squat', sets: [set(100, 5, { rpe: '9' })] }] });
    const now = entry({ exercises: [{ exerciseId: 'squat', sets: [set(100, 5, { rpe: '7' })] }] });
    const prs = detectPRs(now, [old, now]);
    expect(prs).toHaveLength(1);
    expect(prs[0].kind).toBe('e1rm');
  });

  it('history from a DIFFERENT session template counts (PRs are per exercise)', () => {
    const otherSession = entry({ id: 'log_b', tpl: 'tpl_b', ts: 400, exercises: [{ exerciseId: 'bench', sets: [set(90, 5)] }] });
    const now = entry({ exercises: [{ exerciseId: 'bench', sets: [set(95, 5)] }] });
    const prs = detectPRs(now, [otherSession, now]);
    expect(prs).toHaveLength(1);
    expect(prs[0].kind).toBe('e1rm');
  });

  it('undone sets (no data, done:false) are ignored on both sides', () => {
    const old = entry({ id: 'log_u', ts: 400, exercises: [{ exerciseId: 'row', sets: [set(70, 10)] }] });
    const now = entry({
      exercises: [{ exerciseId: 'row', sets: [
        { weight: '', reps: '', time: '', done: false },
        set(70, 10),
      ] }],
    });
    expect(detectPRs(now, [old, now])).toEqual([]); // identical performance
  });
});

describe('compareToLast — data types', () => {
  it('time-based exercise → seconds delta', () => {
    const old = entry({ id: 'log_t', ts: 400, exercises: [{ exerciseId: 'plank', sets: [timeSet(40)] }] });
    const now = entry({ exercises: [{ exerciseId: 'plank', sets: [timeSet(50)] }] });
    const d = compareToLast(now, [old, now]);
    expect(d[0].delta).toEqual({ kind: 'time', diff: 10 });
  });

  it('weight went DOWN → negative weight delta', () => {
    const old = entry({ id: 'log_w', ts: 400, exercises: [{ exerciseId: 'bench', sets: [set(80, 10)] }] });
    const now = entry({ exercises: [{ exerciseId: 'bench', sets: [set(77.5, 10)] }] });
    const d = compareToLast(now, [old, now]);
    expect(d[0].delta).toEqual({ kind: 'weight', diff: -2.5 });
  });

  it('compares against the LATEST previous entry, not older ones', () => {
    const oldest = entry({ id: 'log_1', ts: 100, exercises: [{ exerciseId: 'bench', sets: [set(70, 10)] }] });
    const latest = entry({ id: 'log_2', ts: 500, exercises: [{ exerciseId: 'bench', sets: [set(80, 10)] }] });
    const now = entry({ exercises: [{ exerciseId: 'bench', sets: [set(80, 10)] }] });
    const d = compareToLast(now, [oldest, latest, now]);
    expect(d[0].delta).toEqual({ kind: 'equal', diff: 0 }); // vs 80, not vs 70
  });
});
