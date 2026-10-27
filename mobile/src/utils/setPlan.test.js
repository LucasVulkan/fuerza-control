import { describe, it, expect } from 'vitest';
import { planSet } from './setPlan';

const last3 = (weight, reps) => reps.map((r) => ({ weight, reps: String(r), done: true }));

// P18 §8, caso 18: en cualquier estilo, el gris es lo de la última vez; el
// objetivo del entrenador gana y va en azul (P18 §5).
describe('planSet — el gris es la última vez (P18 §5)', () => {
  const base = { lastSets: last3('60', [12, 11, 10]), index: 0 };

  it('sin entrenador, la última vez: 60 × 12', () => {
    const p = planSet(base);
    expect(p.weight).toEqual({ value: '60', source: 'last' });
    expect(p.reps).toEqual({ value: '12', source: 'last' });
  });
  it('cada serie, la suya: 12 · 11 · 10', () => {
    expect([0, 1, 2].map((index) => planSet({ ...base, index }).reps.value)).toEqual(['12', '11', '10']);
  });
  it('el entrenador gana a la última vez', () => {
    const p = planSet({ ...base, overrideEx: { weight: 70, reps: 5 } });
    expect(p.weight).toEqual({ value: '70', source: 'coach' });
    expect(p.reps).toEqual({ value: '5', source: 'coach' });
  });
  it('cada campo sale de su propia fuente', () => {
    const p = planSet({ overrideEx: { weight: 70 }, lastSets: [{ weight: '60', reps: '12', time: '40' }], index: 0 });
    expect([p.weight.source, p.reps.source, p.time.source]).toEqual(['coach', 'last', 'last']);
    expect(p.time.value).toBe('40');
  });
  it('Tiempo: los segundos de la última vez', () => {
    expect(planSet({ lastSets: [{ time: '45' }, { time: '40' }], index: 1 }).time).toEqual({ value: '40', source: 'last' });
  });
  it('el RPE solo tiene entrenador', () => {
    expect(planSet({ ...base, lastSets: [{ rpe: '8' }] }).rpe).toEqual({ value: '', source: 'none' });
    expect(planSet({ ...base, overrideEx: { rpe: 8 } }).rpe).toEqual({ value: '8', source: 'coach' });
  });
  it('sin historial ni entrenador, vacío; una serie de más, vacía', () => {
    const p = planSet({ lastSets: undefined, index: 0 });
    for (const f of ['weight', 'reps', 'time', 'rpe']) expect(p[f], f).toEqual({ value: '', source: 'none' });
    expect(planSet({ ...base, index: 5 }).weight.source).toBe('none');
  });
  // Un null o un texto vacío del entrenador no es valor.
  it('un objetivo del entrenador null o vacío no cuenta: gana la última vez', () => {
    expect(planSet({ ...base, overrideEx: { weight: null } }).weight).toEqual({ value: '60', source: 'last' });
    expect(planSet({ ...base, overrideEx: { weight: '' } }).weight).toEqual({ value: '60', source: 'last' });
  });
});
