import { describe, it, expect } from 'vitest';
import { niceTicks, tickLabel } from './chartTicks';

describe('niceTicks', () => {
  it('enteros con paso redondo que envuelven los datos', () => {
    expect(niceTicks(14, 20)).toEqual([14, 16, 18, 20]);
    expect(niceTicks(87.5, 91.5)).toEqual([86, 88, 90, 92]);
    expect(niceTicks(1520, 3180)).toEqual([1000, 2000, 3000, 4000]);
  });

  it('una serie plana sigue teniendo dos marcas', () => {
    expect(niceTicks(80, 80)).toEqual([80, 81]);
  });

  it('miles abreviados solo desde 10 000', () => {
    expect(tickLabel(9500)).toBe('9500');
    expect(tickLabel(12000)).toBe('12k');
  });
});
