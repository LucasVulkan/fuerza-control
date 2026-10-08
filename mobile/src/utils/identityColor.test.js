import { describe, it, expect } from 'vitest';
import { nextIdentityColor, identityColorOf, withIdentityColors, initialsOf, IDENTITY_COUNT } from './identityColor';

describe('identityColor', () => {
  it('da el menos usado, el más bajo si empatan', () => {
    expect(nextIdentityColor([])).toBe(0);
    expect(nextIdentityColor([{ color: 0 }, { color: 1 }])).toBe(2);
    expect(nextIdentityColor([{ color: 0 }, { color: 2 }])).toBe(1);
    const full = Array.from({ length: IDENTITY_COUNT }, (_, i) => ({ color: i }));
    expect(nextIdentityColor([...full, { color: 0 }])).toBe(1);
  });

  it('migra en orden de alta y no toca a quien ya lo tiene', () => {
    const out = withIdentityColors({
      b: { id: 'b', createdAt: '2026-02-01' },
      a: { id: 'a', createdAt: '2026-01-01' },
      c: { id: 'c', createdAt: '2026-01-15', color: 0 },
    });
    expect(out.c.color).toBe(0);
    expect(out.a.color).toBe(1);
    expect(out.b.color).toBe(2);
  });

  it('devuelve el mismo objeto si no falta ninguno', () => {
    const clients = { a: { id: 'a', color: 3 } };
    expect(withIdentityColors(clients)).toBe(clients);
  });

  it('sin color guardado, un respaldo estable por id', () => {
    const c = { id: 'client_123' };
    expect(identityColorOf(c)).toBe(identityColorOf({ id: 'client_123' }));
    expect(identityColorOf({ id: 'x', color: 4 })).toBe(4);
  });

  it('iniciales de las dos primeras palabras', () => {
    expect(initialsOf('Ana López')).toBe('AL');
    expect(initialsOf('  diego  romero díaz ')).toBe('DR');
    expect(initialsOf('Marcos')).toBe('M');
    expect(initialsOf('')).toBe('');
  });
});
