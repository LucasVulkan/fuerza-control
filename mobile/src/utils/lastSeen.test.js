import { describe, it, expect } from 'vitest';
import { lastSeenLabel } from './lastSeen';

const t = (key, vars) => ({
  'clients.lastNever': 'Nunca', 'dayCard.today': 'Hoy', 'dayCard.yesterday': 'Ayer',
}[key] ?? `${key}:${vars?.count}`);
// Jueves 8-oct-2026 a las 9:00, hora local.
const NOW = new Date(2026, 9, 8, 9).getTime();
const at  = (d, h = 18) => new Date(2026, 9, d, h).getTime();
const label = (ts) => lastSeenLabel(ts, { t, lang: 'es', now: NOW });

describe('lastSeenLabel', () => {
  it('hoy, ayer y nunca', () => {
    expect(label(at(8, 7))).toEqual({ text: 'hoy', today: true });
    expect(label(at(7, 23)).text).toBe('ayer');   // anoche, aunque no hayan pasado 24 h
    expect(label(null).text).toBe('nunca');
  });

  it('día de la semana entre 2 y 6 días', () => {
    expect(label(at(5)).text).toBe('lun');
    expect(label(at(2)).text).not.toMatch(/\./);
  });

  it('desde 7 días, «hace N d»', () => {
    expect(label(at(1)).text).toBe('clients.lastSeenDays:7');
    expect(label(new Date(2026, 8, 26, 10).getTime()).text).toBe('clients.lastSeenDays:12');
  });
});
