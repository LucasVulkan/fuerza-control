import { describe, it, expect } from 'vitest';
import { planSet } from './setPlan';
import { getProgression } from './progression';

const tk = (k) => k;
const last3 = (weight, reps) => reps.map((r) => ({ weight, reps: String(r), done: true }));

describe('planSet — el orden de §4.5', () => {
  const chipUp = { type: 'up', suggestedWeight: 62.5 };
  const base = { exConfig: { minReps: 8, maxReps: 12 }, def: null, chip: chipUp, lastSets: last3('60', [12, 11, 10]), index: 0 };

  it('el entrenador gana al plan y a la última vez', () => {
    const p = planSet({ ...base, overrideEx: { weight: 70, reps: 5 } });
    expect(p.weight).toEqual({ value: '70', source: 'coach' });
    expect(p.reps).toEqual({ value: '5', source: 'coach' });
  });
  it('sin entrenador, el plan gana a la última vez', () => {
    const p = planSet(base);
    expect(p.weight).toEqual({ value: '62.5', source: 'plan' });
    expect(p.reps).toEqual({ value: '12', source: 'plan' });
  });
  it('sin plan, la última vez', () => {
    const p = planSet({ ...base, chip: { type: 'hold', suggestedWeight: 60 } });
    expect(p.weight).toEqual({ value: '60', source: 'last' });
    expect(p.reps).toEqual({ value: '12', source: 'last' });
  });
  it('sin nada, vacío', () => {
    const p = planSet({ ...base, chip: null, lastSets: undefined });
    for (const f of ['weight', 'reps', 'time', 'rpe']) expect(p[f], f).toEqual({ value: '', source: 'none' });
  });
  it('cada campo sale de su propia fuente', () => {
    // peso del entrenador, reps del plan, tiempo de la última vez
    const p = planSet({
      ...base, overrideEx: { weight: 70 },
      lastSets: [{ weight: '60', reps: '12', time: '40' }],
    });
    expect([p.weight.source, p.reps.source, p.time.source]).toEqual(['coach', 'plan', 'last']);
    expect(p.time.value).toBe('40');
  });
  it('el RPE solo tiene entrenador', () => {
    expect(planSet({ ...base, lastSets: [{ rpe: '8' }] }).rpe).toEqual({ value: '', source: 'none' });
    expect(planSet({ ...base, overrideEx: { rpe: 8 } }).rpe).toEqual({ value: '8', source: 'coach' });
  });
  it('una serie sin historial usa su índice', () => {
    const p = planSet({ ...base, chip: null, index: 2 });
    expect(p.weight.value).toBe('60');
    expect(p.reps.value).toBe('10');
    expect(planSet({ ...base, chip: null, index: 5 }).weight.source).toBe('none');
  });
});

describe('planSet — la meta de las reps', () => {
  const chip = { type: 'up', suggestedWeight: 62.5 };
  it('con rango, el máximo', () => {
    expect(planSet({ exConfig: { minReps: 8, maxReps: 12 }, chip, index: 0 }).reps.value).toBe('12');
  });
  it('con reps fijas, esas reps', () => {
    expect(planSet({ exConfig: { minReps: 5, maxReps: 5 }, chip, index: 0 }).reps.value).toBe('5');
  });
  it('sin rango en la plantilla, el de la librería o el de siempre', () => {
    expect(planSet({ exConfig: {}, def: { minReps: 6, maxReps: 10 }, chip, index: 0 }).reps.value).toBe('10');
    expect(planSet({ exConfig: {}, chip, index: 0 }).reps.value).toBe('12');
  });
  it('al bajar, también el peso del plan', () => {
    const p = planSet({ exConfig: { minReps: 8, maxReps: 12 }, chip: { type: 'down', suggestedWeight: 57.5 }, index: 0 });
    expect(p.weight).toEqual({ value: '57.5', source: 'plan' });
  });
});

describe('planSet — Por esfuerzo', () => {
  it('peso del chip y reps = minReps, sea cual sea la dirección', () => {
    for (const type of ['up', 'down', 'hold']) {
      const p = planSet({ exConfig: { minReps: 5, maxReps: 5 }, chip: { effort: true, type, suggestedWeight: 80 }, lastSets: last3('77.5', [5, 5, 5]), index: 0 });
      expect(p.weight, type).toEqual({ value: '80', source: 'plan' });
      expect(p.reps, type).toEqual({ value: '5', source: 'plan' });
    }
  });
  it('sin peso calculado, el peso cae a la última vez', () => {
    const p = planSet({ exConfig: { minReps: 5, maxReps: 5 }, chip: { effort: true, type: 'hold', suggestedWeight: null }, lastSets: last3('77.5', [5, 5, 5]), index: 0 });
    expect(p.weight).toEqual({ value: '77.5', source: 'last' });
  });
});

describe('planSet — Reps y Tiempo', () => {
  it('Reps que suben: el gris es la meta', () => {
    const p = planSet({ exConfig: { minReps: 6 }, chip: { type: 'up', suggestedReps: 9 }, lastSets: [{ reps: '8' }], index: 0 });
    expect(p.reps).toEqual({ value: '9', source: 'plan' });
  });
  it('Reps que mantienen: el gris es lo que hiciste, no el inicio', () => {
    const p = planSet({ exConfig: { minReps: 6 }, chip: { type: 'hold', suggestedReps: 6 }, lastSets: [{ reps: '5' }], index: 0 });
    expect(p.reps).toEqual({ value: '5', source: 'last' });
  });
  it('Tiempo: igual, solo con up', () => {
    expect(planSet({ exConfig: {}, chip: { type: 'up', suggestedTime: 45 }, lastSets: [{ time: '40' }], index: 0 }).time).toEqual({ value: '45', source: 'plan' });
    expect(planSet({ exConfig: {}, chip: { type: 'hold', suggestedTime: 30 }, lastSets: [{ time: '25' }], index: 0 }).time).toEqual({ value: '25', source: 'last' });
  });
});

describe('planSet — con el motor de verdad', () => {
  const cfg = { sets: 3, minReps: 8, maxReps: 12, progression: { type: 'double' } };
  const plan = (rows, index = 0) => planSet({ exConfig: cfg, def: {}, chip: getProgression(cfg, {}, rows, tk), lastSets: rows, index });

  it('12/12/12 con 60 → 62.5 × 12 en las tres series', () => {
    for (let i = 0; i < 3; i++) {
      const p = plan(last3('60', [12, 12, 12]), i);
      expect([p.weight.value, p.reps.value]).toEqual(['62.5', '12']);
    }
  });
  it('12/10/9 → el gris repite lo hecho: 60 × 12 · 10 · 9', () => {
    const rows = last3('60', [12, 10, 9]);
    expect([0, 1, 2].map((i) => plan(rows, i).reps.value)).toEqual(['12', '10', '9']);
    expect(plan(rows, 1).weight).toEqual({ value: '60', source: 'last' });
  });
  it('en descarga el gris es lo hecho', () => {
    const dl = { ...cfg, progression: { type: 'double', hold: 'deload' } };
    const rows = last3('60', [12, 12, 12]);
    const p = planSet({ exConfig: dl, def: {}, chip: getProgression(dl, {}, rows, tk), lastSets: rows, index: 0 });
    expect(p.weight).toEqual({ value: '60', source: 'last' });
  });
});
