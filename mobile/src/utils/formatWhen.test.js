import { describe, it, expect } from 'vitest';
import { formatWhen } from './formatWhen';

const NOW = new Date(2026, 6, 30, 12, 0); // 30 jul 2026, 12:00

describe('formatWhen', () => {
  it('usa hoy/ayer en minúscula y hora 24h en español', () => {
    expect(formatWhen(new Date(2026, 6, 30, 9, 41), 'es', 'Hoy', 'Ayer', NOW)).toBe('hoy 9:41');
    expect(formatWhen(new Date(2026, 6, 29, 21, 3), 'es', 'Hoy', 'Ayer', NOW)).toBe('ayer 21:03');
  });

  it('cae a día + mes a partir de anteayer, con año solo si es otro', () => {
    expect(formatWhen(new Date(2026, 6, 14, 9, 41), 'es', 'Hoy', 'Ayer', NOW)).toBe('14 jul 9:41');
    expect(formatWhen(new Date(2025, 6, 14, 9, 41), 'es', 'Hoy', 'Ayer', NOW)).toBe('14 jul 2025 9:41');
  });

  it('en inglés invierte día/mes y usa 12h', () => {
    expect(formatWhen(new Date(2026, 6, 14, 21, 3), 'en', 'Today', 'Yesterday', NOW)).toBe('Jul 14 9:03 PM');
    expect(formatWhen(new Date(2026, 6, 14, 0, 5), 'en', 'Today', 'Yesterday', NOW)).toBe('Jul 14 12:05 AM');
  });

  it('devuelve null sin valor o con fecha inválida', () => {
    expect(formatWhen(null, 'es', 'Hoy', 'Ayer', NOW)).toBeNull();
    expect(formatWhen('no-es-una-fecha', 'es', 'Hoy', 'Ayer', NOW)).toBeNull();
  });
});
