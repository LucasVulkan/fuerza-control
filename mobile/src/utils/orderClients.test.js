import { describe, it, expect } from 'vitest';
import { orderClients } from './orderClients';

const C = [
  { id: 'a', name: 'Carla',  createdAt: '2026-01-01' },
  { id: 'b', name: 'Ana',    createdAt: '2026-02-01' },
  { id: 'c', name: 'Bruno',  createdAt: '2026-03-01' },
  { id: 'd', name: 'Diego',  createdAt: '2026-04-01' },
];
const last   = { a: 10, b: 40, c: 30, d: 20 };
const rank   = { a: 99, b: 99, c: 0, d: 50 };   // c tiene aviso, d sin revisar
const metric = { a: 80, b: null, c: 40, d: 95 };
const opts = (o) => ({
  lastTsOf: (x) => last[x.id], rankOf: (x) => rank[x.id], metricOf: (x) => metric[x.id], ...o,
});
const ids = (list) => list.map((x) => x.id).join('');

describe('orderClients', () => {
  it('actividad: el más reciente primero', () => {
    expect(ids(orderClients(C, opts({ needsFirst: false })))).toBe('bcda');
  });

  it('nombre', () => {
    expect(ids(orderClients(C, opts({ by: 'name', needsFirst: false })))).toBe('bcad');
  });

  it('lo pendiente arriba: avisos, luego sin revisar, luego el criterio', () => {
    expect(ids(orderClients(C, opts({ by: 'name' })))).toBe('cdba');
  });

  it('a mano: su posición; los que no están, al final por alta', () => {
    expect(ids(orderClients(C, opts({ by: 'manual', needsFirst: false, manual: ['d', 'b'] })))).toBe('dbac');
  });

  it('una lente ordena por su cifra, de peor a mejor y sin dato al final', () => {
    expect(ids(orderClients(C, opts({ lens: 'adh' })))).toBe('cadb');
  });

  it('con orden a mano la lente no mueve a nadie', () => {
    const manual = ['a', 'b', 'c', 'd'];
    expect(ids(orderClients(C, opts({ by: 'manual', needsFirst: false, manual, lens: 'adh' })))).toBe('abcd');
  });

  it('no muta la lista', () => {
    const copy = [...C];
    orderClients(C, opts({ by: 'name' }));
    expect(C).toEqual(copy);
  });
});
