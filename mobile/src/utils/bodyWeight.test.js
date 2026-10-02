import { describe, it, expect } from 'vitest';
import { parseBodyWeight } from './bodyWeight';

const kgIn = (v) => parseFloat(v);                       // toKg de `useWeightUnit` en KG
const lbIn = (v) => Math.round((parseFloat(v) / 2.2046) * 4) / 4;   // y en LB

describe('parseBodyWeight (P62)', () => {
  it('acepta decimales y la coma como punto', () => {
    expect(parseBodyWeight('55.1', kgIn)).toBe(55.1);
    expect(parseBodyWeight('55,1', kgIn)).toBe(55.1);
    expect(parseBodyWeight(' 80 ', kgIn)).toBe(80);
  });

  it('guarda un decimal', () => {
    expect(parseBodyWeight('55.14', kgIn)).toBe(55.1);
  });

  it('vacío, texto o fuera de 20-500 kg: null', () => {
    for (const bad of ['', '  ', 'abc', '55abc', '0', '19.9', '500.1', '900', null, undefined]) {
      expect(parseBodyWeight(bad, kgIn)).toBeNull();
    }
    expect(parseBodyWeight('20', kgIn)).toBe(20);
    expect(parseBodyWeight('500', kgIn)).toBe(500);
  });

  it('el rango es en kg: en LB se convierte antes de comprobarlo', () => {
    expect(parseBodyWeight('136.5', lbIn)).toBe(62);
    expect(parseBodyWeight('40', lbIn)).toBeNull();      // ≈18 kg
  });
});
