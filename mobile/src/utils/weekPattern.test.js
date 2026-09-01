import { describe, it, expect } from 'vitest';
import { weekPattern } from './weekPattern';

describe('weekPattern', () => {
  it('entrena exactamente daysPerWeek días', () => {
    for (let d = 1; d <= 7; d++) {
      const trained = weekPattern(d, 3, 0).filter((x) => x !== null);
      expect(trained.length).toBe(d);
    }
  });

  it('las sesiones salen en orden y sin saltos dentro de la semana', () => {
    const week = weekPattern(4, 3, 0).filter((x) => x !== null);
    expect(week).toEqual([0, 1, 2, 0]);
  });

  it('4 días / 3 sesiones: la semana 2 empieza por la sesión 1, no por la 0', () => {
    const week2 = weekPattern(4, 3, 1).filter((x) => x !== null);
    expect(week2[0]).toBe(1);
  });

  it('3 días / 3 sesiones: la semana 2 es idéntica a la 1', () => {
    expect(weekPattern(3, 3, 1)).toEqual(weekPattern(3, 3, 0));
  });

  it('sessionCount: 0 no revienta', () => {
    expect(weekPattern(4, 0, 0)).toEqual(Array(7).fill(null));
  });

  it('recorta daysPerWeek fuera de 1-7', () => {
    expect(weekPattern(0, 3, 0).filter((x) => x !== null).length).toBe(1);
    expect(weekPattern(9, 3, 0).filter((x) => x !== null).length).toBe(7);
  });
});
