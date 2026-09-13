import { describe, it, expect } from 'vitest';
import { sessionPlan } from './sessionPlan';

const t = (key, vars) => (vars ? `${key}:${JSON.stringify(vars)}` : key);
const DAYS = [
  { templateId: 'a', label: 'A' },
  { templateId: 'b', label: 'B' },
  { templateId: 'c', label: 'C' },
];

describe('sessionPlan', () => {
  it('el hero es la primera sin hacer, y se queda en la lista, en su sitio', () => {
    const plan = sessionPlan({ days: DAYS, cycleCompletedIds: ['a'], t });
    expect(plan.heroTemplateId).toBe('b');
    expect(plan.heroLabel).toBe('home.sessionNext');
    expect(plan.rows.map((r) => r.templateId)).toEqual(['a', 'b', 'c']);
    expect(plan.rows.map((r) => r.isHero)).toEqual([false, true, false]);
    expect(plan.rows[0].isDone).toBe(true);
    expect(plan.rows[0].marker).toBe('A');
  });

  it('la sesión a medias manda sobre el orden', () => {
    const plan = sessionPlan({ days: DAYS, cycleCompletedIds: ['a'], activeTemplateId: 'c', t });
    expect(plan.heroTemplateId).toBe('c');
    expect(plan.heroLabel).toBe('home.sessionActive');
    expect(plan.rows.map((r) => r.templateId)).toEqual(['a', 'b', 'c']);
    expect(plan.rows.map((r) => r.isHero)).toEqual([false, false, true]);
  });

  it('con todo hecho no hay hero — pero el ciclo se vacía al cerrarse, así que no pasa', () => {
    const plan = sessionPlan({ days: DAYS, cycleCompletedIds: ['a', 'b', 'c'], t });
    expect(plan.heroTemplateId).toBeNull();
    expect(plan.heroLabel).toBeNull();
    expect(plan.rows).toHaveLength(3);
    expect(plan.rows.some((r) => r.isHero)).toBe(false);
  });

  it('el contador cuenta plantillas hechas, no posiciones', () => {
    const plan = sessionPlan({ days: DAYS, cycleCompletedIds: ['c'], t });
    expect(plan.subtitle).toBe('home.cycleCount:{"done":1,"total":3}');
  });

  it('sin sesiones no hay contador que pintar', () => {
    expect(sessionPlan({ days: [], t }).subtitle).toBeNull();
  });
});
