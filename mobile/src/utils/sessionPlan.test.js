import { describe, it, expect } from 'vitest';
import { sessionPlan } from './sessionPlan';

const t = (key, vars) => (vars ? `${key}:${JSON.stringify(vars)}` : key);
const DAYS = [
  { templateId: 'a', label: 'A' },
  { templateId: 'b', label: 'B' },
  { templateId: 'c', label: 'C' },
];
// Jueves 24-sep-2026 a mediodía, hora local; la semana empieza el lunes 21.
const NOW = new Date(2026, 8, 24, 12).getTime();
const at  = (y, m, d, h = 18) => new Date(y, m - 1, d, h).getTime();
const log = (...pairs) => pairs.map(([tid, ts]) => ({ sessionTemplateId: tid, timestamp: ts }));

describe('sessionPlan — toca la que más tiempo llevas sin hacer', () => {
  it('sin historial, la primera en el orden del programa', () => {
    const plan = sessionPlan({ days: DAYS, now: NOW, t });
    expect(plan.heroTemplateId).toBe('a');
    expect(plan.heroLabel).toBe('home.sessionNext');
    expect(plan.rows.map((r) => r.isDone)).toEqual([false, false, false]);
  });

  it('las nunca hechas van antes que cualquier hecha', () => {
    const plan = sessionPlan({ days: DAYS, log: log(['a', at(2026, 9, 1)]), now: NOW, t });
    expect(plan.heroTemplateId).toBe('b');
  });

  it('A B C A B → C: la de última vez más antigua', () => {
    const plan = sessionPlan({
      days: DAYS,
      log: log(['a', at(2026, 9, 14)], ['b', at(2026, 9, 16)], ['c', at(2026, 9, 18)],
        ['a', at(2026, 9, 21)], ['b', at(2026, 9, 23)]),
      now: NOW, t,
    });
    expect(plan.heroTemplateId).toBe('c');
  });

  it('saltarse la C y repetir la A no la entierra: sigue tocando C', () => {
    const plan = sessionPlan({
      days: DAYS,
      log: log(['a', at(2026, 9, 21)], ['b', at(2026, 9, 22)], ['a', at(2026, 9, 23)]),
      now: NOW, t,
    });
    expect(plan.heroTemplateId).toBe('c');
  });

  it('el orden del historial no importa', () => {
    const plan = sessionPlan({
      days: DAYS,
      log: log(['c', at(2026, 9, 23)], ['a', at(2026, 9, 21)], ['b', at(2026, 9, 22)]),
      now: NOW, t,
    });
    expect(plan.heroTemplateId).toBe('a');
  });

  it('la sesión a medias no mueve el hero (U52)', () => {
    const plan = sessionPlan({ days: DAYS, log: log(['a', at(2026, 9, 21)]), activeTemplateId: 'a', now: NOW, t });
    expect(plan.heroTemplateId).not.toBe('a');
    expect(plan.heroLabel).toBe('home.sessionNext');
  });

  it('el hero se queda en la lista, en su sitio', () => {
    const plan = sessionPlan({ days: DAYS, log: log(['a', at(2026, 9, 21)]), now: NOW, t });
    expect(plan.rows.map((r) => r.templateId)).toEqual(['a', 'b', 'c']);
    expect(plan.rows.map((r) => r.isHero)).toEqual([false, true, false]);
    expect(plan.rows[0].marker).toBe('A');
  });

  it('entrenando lo que toca sale la rotación continua, también cruzando el lunes', () => {
    // Del jueves 3 al jueves 10 de septiembre: la rotación no se reinicia el
    // lunes 7.
    const entries = [];
    const picks   = [];
    for (let i = 0; i < 8; i++) {
      const ts   = at(2026, 8, 3 + i);
      const hero = sessionPlan({ days: DAYS, log: entries, now: ts, t }).heroTemplateId;
      picks.push(hero);
      entries.push({ sessionTemplateId: hero, timestamp: ts });
    }
    expect(picks.join('')).toBe('abcabcab');
  });

  it('una sesión de otra etapa no cuenta', () => {
    const plan = sessionPlan({ days: DAYS, log: log(['x', at(2026, 9, 22)]), now: NOW, t });
    expect(plan.heroTemplateId).toBe('a');
    expect(plan.subtitle).toBe('home.weekCount:{"done":0,"total":3}');
  });

  it('sin sesiones no hay hero ni contador', () => {
    const plan = sessionPlan({ days: [], log: log(['a', at(2026, 9, 22)]), now: NOW, t });
    expect(plan.heroTemplateId).toBeNull();
    expect(plan.heroLabel).toBeNull();
    expect(plan.subtitle).toBeNull();
  });
});

describe('sessionPlan — esta semana', () => {
  it('el check es "hecha esta semana", no "alguna vez"', () => {
    const plan = sessionPlan({
      days: DAYS,
      log: log(['a', at(2026, 9, 20)], ['b', at(2026, 9, 21, 7)]),   // domingo pasado · lunes
      now: NOW, t,
    });
    expect(plan.rows.map((r) => r.isDone)).toEqual([false, true, false]);
  });

  it('el contador cuenta entrenos de la semana contra las sesiones de la etapa', () => {
    const plan = sessionPlan({
      days: DAYS,
      log: log(['a', at(2026, 9, 18)], ['a', at(2026, 9, 21)], ['a', at(2026, 9, 23)]),
      now: NOW, t,
    });
    // Repetir la A cuenta como un entreno más; lo de la semana pasada, no.
    expect(plan.subtitle).toBe('home.weekCount:{"done":2,"total":3}');
    expect(plan.weekDone).toBe(2);
  });

});

describe('sessionPlan — sesiones libres (T06-free-sessions.md §8)', () => {
  const libre = (ts, extra = {}) => ({ sessionTemplateId: 'tpl_libre', free: true, timestamp: ts, ...extra });

  it('una libre sin marcar no cuenta: ni marca, ni mueve el hero, ni suma a la semana', () => {
    const plan = sessionPlan({ days: DAYS, log: [libre(at(2026, 9, 22))], now: NOW, t });
    expect(plan.heroTemplateId).toBe('a');
    expect(plan.rows.map((r) => r.isDone)).toEqual([false, false, false]);
    expect(plan.weekDone).toBe(0);
  });

  it('«Cuenta como C» la marca hecha, mueve el hero y suma a la semana', () => {
    const plan = sessionPlan({
      days: DAYS,
      log: [...log(['a', at(2026, 9, 21)], ['b', at(2026, 9, 22)]), libre(at(2026, 9, 23), { countsAs: 'c' })],
      now: NOW, t,
    });
    expect(plan.rows.map((r) => r.isDone)).toEqual([true, true, true]);
    expect(plan.heroTemplateId).toBe('a');
    expect(plan.weekDone).toBe(3);
  });
});

describe('sessionPlan — la semana empieza por la A (weekly, U13 §8)', () => {
  const SIX = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => ({ templateId: id, label: id.toUpperCase() }));
  const history = log(['b', at(2026, 9, 15)], ['a', at(2026, 9, 21)], ['c', at(2026, 9, 22)]);

  it('A y C esta semana, B la pasada, D nunca: toca la B', () => {
    expect(sessionPlan({ days: SIX, log: history, now: NOW, t, weekly: true }).heroTemplateId).toBe('b');
  });

  it('sin la opción, la de siempre: la nunca hecha (D)', () => {
    expect(sessionPlan({ days: SIX, log: history, now: NOW, t }).heroTemplateId).toBe('d');
  });

  it('con todas hechas esta semana, la de última vez más antigua', () => {
    const plan = sessionPlan({
      days: DAYS,
      log: log(['c', at(2026, 9, 23)], ['a', at(2026, 9, 21)], ['b', at(2026, 9, 22)]),
      now: NOW, t, weekly: true,
    });
    expect(plan.heroTemplateId).toBe('a');
  });

  it('el lunes vuelve a la A', () => {
    // Del lunes 3 al lunes 10 de agosto: hecho todo el miércoles, sigue la
    // rotación; el lunes 10 empieza otra semana, y por la A.
    const entries = [];
    const picks   = [];
    for (let i = 0; i < 8; i++) {
      const ts   = at(2026, 8, 3 + i);
      const hero = sessionPlan({ days: DAYS, log: entries, now: ts, t, weekly: true }).heroTemplateId;
      picks.push(hero);
      entries.push({ sessionTemplateId: hero, timestamp: ts });
    }
    expect(picks.join('')).toBe('abcabcaa');
  });
});
