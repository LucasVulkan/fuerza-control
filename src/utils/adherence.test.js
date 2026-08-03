import { describe, test, expect } from 'vitest';
import { computeAdherence, requiresAttention, adherencePct, STATUS } from './adherence';

const DAY = 86400000;
// Wednesday 14 Jan 2026, midday local — gives room inside the week.
const NOW = new Date(2026, 0, 14, 12, 0, 0).getTime();
// Offsets in whole days land on: 0→Wed, 1→Tue, 2→Mon (this week),
// 7/8/9 → Wed/Tue/Mon (last week), and so on — one block per week.
const s = (daysAgo) => ({ timestamp: NOW - daysAgo * DAY });

describe('computeAdherence — risk status scales with frequency', () => {
  test('trained yesterday on a 4×/week plan → on track', () => {
    const r = computeAdherence({ sessions: [s(1)], sessionsPerCycle: 4, now: NOW });
    expect(r.status).toBe(STATUS.ON_TRACK);
  });

  test('5 days idle on a 4×/week plan → slipping', () => {
    const r = computeAdherence({ sessions: [s(5)], sessionsPerCycle: 4, now: NOW });
    expect(r.status).toBe(STATUS.SLIPPING);
  });

  test('12 days idle on a 4×/week plan → at risk', () => {
    const r = computeAdherence({ sessions: [s(12)], sessionsPerCycle: 4, now: NOW });
    expect(r.status).toBe(STATUS.AT_RISK);
  });

  test('same 6-day gap is on track for a 2×/week plan but worse for 4×', () => {
    expect(computeAdherence({ sessions: [s(6)], sessionsPerCycle: 2, now: NOW }).status)
      .toBe(STATUS.ON_TRACK);
    expect(computeAdherence({ sessions: [s(6)], sessionsPerCycle: 4, now: NOW }).status)
      .not.toBe(STATUS.ON_TRACK);
  });
});

describe('computeAdherence — manual status overrides', () => {
  test('paused is muted even after a long absence', () => {
    const r = computeAdherence({ sessions: [s(30)], sessionsPerCycle: 4, manualStatus: 'paused', now: NOW });
    expect(r.status).toBe(STATUS.MUTED);
  });

  test('inactive is muted', () => {
    const r = computeAdherence({ sessions: [s(30)], sessionsPerCycle: 4, manualStatus: 'inactive', now: NOW });
    expect(r.status).toBe(STATUS.MUTED);
  });
});

describe('computeAdherence — no data', () => {
  test('no sessions → no_data and null daysSince', () => {
    const r = computeAdherence({ sessions: [], sessionsPerCycle: 4, now: NOW });
    expect(r.status).toBe(STATUS.NO_DATA);
    expect(r.daysSince).toBeNull();
  });

  test('missing sessionsPerCycle still yields a target of at least 1', () => {
    const r = computeAdherence({ sessions: [s(1)], sessionsPerCycle: 0, now: NOW });
    expect(r.weekTarget).toBe(1);
  });
});

describe('computeAdherence — weekly figures', () => {
  test('weekDone counts only this calendar week', () => {
    // days 0,1,2 are this week (Wed/Tue/Mon); day 3 is last Sunday.
    const r = computeAdherence({ sessions: [s(0), s(1), s(2), s(3)], sessionsPerCycle: 3, now: NOW });
    expect(r.weekDone).toBe(3);
    expect(r.daysSince).toBe(0);
  });

  test('streak counts consecutive weeks that hit the target', () => {
    const sessions = [s(1), s(2), s(8), s(9), s(15), s(16)]; // 2 per week, 3 weeks
    const r = computeAdherence({ sessions, sessionsPerCycle: 2, now: NOW });
    expect(r.streak).toBe(3);
  });

  test('streak breaks on a week below target', () => {
    const sessions = [s(1), s(2), s(8)]; // this week 2 (ok), last week 1 (miss)
    const r = computeAdherence({ sessions, sessionsPerCycle: 2, now: NOW });
    expect(r.streak).toBe(1);
  });
});

describe('computeAdherence — recentPerWeek (real pace)', () => {
  test('averages the last completed weeks, ignoring the in-progress one', () => {
    // 2 per completed week across 4 weeks; this week's sessions are ignored.
    const sessions = [
      s(0), s(1),         // this week (excluded from the average)
      s(7), s(8),         // last completed week
      s(14), s(15),       // 2 weeks ago
      s(21), s(22),       // 3 weeks ago
      s(28), s(29),       // 4 weeks ago
    ];
    const r = computeAdherence({ sessions, sessionsPerCycle: 2, now: NOW });
    expect(r.recentPerWeek).toBe(2);
  });

  test('a slowing client shows a pace below target', () => {
    // One session per completed week across 4 weeks → avg 1 on a 2×/week plan.
    const sessions = [s(8), s(15), s(22), s(29)];
    const r = computeAdherence({ sessions, sessionsPerCycle: 2, now: NOW });
    expect(r.recentPerWeek).toBe(1);
  });

  test('brand-new client (only this week) falls back to the current week', () => {
    const r = computeAdherence({ sessions: [s(0), s(1)], sessionsPerCycle: 2, now: NOW });
    expect(r.recentPerWeek).toBe(2);
  });

  test('no history → zero pace', () => {
    const r = computeAdherence({ sessions: [], sessionsPerCycle: 2, now: NOW });
    expect(r.recentPerWeek).toBe(0);
  });
});

describe('adherencePct', () => {
  // La ventana son 28 días; con 3/sem se esperan 12. `n` sesiones repartidas
  // por toda la ventana (la más vieja a 27 días) para que el span sea completo.
  const spread = (n) => Array.from({ length: n }, (_, i) => s(Math.round(28 - (i * 28) / (n - 1))));

  test('cumple justo el objetivo → 100%', () => {
    expect(adherencePct({ sessions: spread(12), sessionsPerCycle: 3, now: NOW })).toBe(100);
  });

  test('la mitad de lo esperado → ~50%', () => {
    expect(adherencePct({ sessions: spread(6), sessionsPerCycle: 3, now: NOW })).toBe(50);
  });

  test('entrenar de más se capa al 100%', () => {
    expect(adherencePct({ sessions: spread(20), sessionsPerCycle: 3, now: NOW })).toBe(100);
  });

  test('sesiones fuera de la ventana no cuentan', () => {
    expect(adherencePct({ sessions: [s(1), s(40), s(60)], sessionsPerCycle: 3, now: NOW })).toBe(8);
  });

  test('cliente nuevo se mide contra lo que lleva, no contra 4 semanas', () => {
    // Una sola semana de historia, 3/sem: 3 hechas de 3 esperadas.
    const r = adherencePct({ sessions: [s(6), s(4), s(2)], sessionsPerCycle: 3, now: NOW });
    expect(r).toBe(100);
  });

  test('sin sesiones → null (no es un 0%)', () => {
    expect(adherencePct({ sessions: [], sessionsPerCycle: 3, now: NOW })).toBe(null);
  });
});

describe('requiresAttention', () => {
  test('at risk and slipping require attention; the rest do not', () => {
    expect(requiresAttention(STATUS.AT_RISK)).toBe(true);
    expect(requiresAttention(STATUS.SLIPPING)).toBe(true);
    expect(requiresAttention(STATUS.ON_TRACK)).toBe(false);
    expect(requiresAttention(STATUS.NO_DATA)).toBe(false);
    expect(requiresAttention(STATUS.MUTED)).toBe(false);
  });
});
