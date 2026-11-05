import { describe, it, expect } from 'vitest';
import { placeBubble } from './placeBubble';

const base = { winH: 800, bubbleH: 200, safeTop: 40, safeBottom: 20 };

describe('placeBubble (U17-01)', () => {
  it('debajo del elemento si cabe', () => {
    expect(placeBubble({ ...base, rect: { y: 100, h: 100 } })).toEqual({ top: 212, side: 'below' });
  });
  it('encima si debajo no cabe', () => {
    // el elemento acaba en 700: debajo ya no cabe, encima sí (400 - 12 - 200 = 188)
    expect(placeBubble({ ...base, rect: { y: 400, h: 300 } })).toEqual({ top: 188, side: 'above' });
  });
  it('si no cabe ni arriba ni abajo, pegado al borde con más sitio', () => {
    const { top, side } = placeBubble({ ...base, rect: { y: 120, h: 560 } });
    expect(side).toBeNull();
    expect(top).toBeGreaterThanOrEqual(52);
    expect(top + 200).toBeLessThanOrEqual(800 - 20 - 12);
  });
  it('sin elemento, centrado', () => {
    expect(placeBubble({ ...base, rect: null })).toEqual({ top: 300, side: null });
  });
});
