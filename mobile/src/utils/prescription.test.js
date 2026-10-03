import { describe, it, expect } from 'vitest';
import { targetLabel, firstTimeRx } from './prescription';

// El `t` de verdad devuelve la traducción; aquí basta con el fallback, que es
// el segundo argumento.
const t = (key, fallback) => fallback ?? key;
// Un ejercicio con carga: `{}` cuenta como peso corporal y su Doble se lee como Reps (§5.3-bis), que pinta «8+».
const BB = { equipment: ['barbell'] };

describe('targetLabel', () => {
  it('Fija, y lo guardado como submáx, se lee con su rango (P10-effort-progression.md §3)', () => {
    const burpee = { progressionModel: 'fixed', minReps: null, maxReps: null };
    expect(targetLabel(burpee, { sets: 3 }, t)).toBe('3 × 8–12 reps');
    expect(targetLabel({ progressionModel: 'double_progression', minReps: 5, maxReps: 8 },
      { sets: 3, progressionModel: 'submax' }, t)).toBe('3 × 5–8 reps');
  });

  it('sin objetivo en sesión ni librería, el mismo por defecto que el editor', () => {
    // Paseo del granjero: doble progresión y sin rango en la librería.
    const farmer = { ...BB, progressionModel: 'double_progression', minReps: null, maxReps: null };
    expect(targetLabel(farmer, { sets: 3 }, t)).toBe('3 × 8–12 reps');
    expect(targetLabel({}, { sets: 2, inputType: 'time' }, t)).toBe('2 × 20–40 s');
    // Pasado a doble en la sesión sin tocar el rango: tampoco pinta null.
    const pushUp = { ...BB, progressionModel: 'fixed', minReps: null, maxReps: null };
    expect(targetLabel(pushUp, { sets: 3, progressionModel: 'double_progression' }, t)).toBe('3 × 8–12 reps');
  });

  it('sin definición de ejercicio no hay frase', () => {
    expect(targetLabel(null, { sets: 3 }, t)).toBe('');
  });

  it('rango de reps', () => {
    const s = { sets: 4, minReps: 6, maxReps: 8 };
    expect(targetLabel(BB, s, t)).toBe('4 × 6–8 reps');
    expect(targetLabel(BB, s, t, { compact: true })).toBe('4×6–8');
  });

  it('reps fijas: un solo número, no un rango de uno', () => {
    const s = { sets: 5, minReps: 5, maxReps: 5 };
    expect(targetLabel(BB, s, t)).toBe('5 × 5 reps');
    expect(targetLabel(BB, s, t, { compact: true })).toBe('5×5');
  });

  it('tiempo', () => {
    const s = { sets: 3, inputType: 'time', minTime: 20, maxTime: 40 };
    expect(targetLabel(BB, s, t)).toBe('3 × 20–40 s');
    expect(targetLabel(BB, s, t, { compact: true })).toBe('3×20–40 s');
  });

  it('unilateral se dice entero y se calla en compacto', () => {
    // A una mano lo dice el ejercicio, no la sesión (P09-exercise-variants.md §6.4).
    const s = { sets: 3, minReps: 10, maxReps: 10 };
    expect(targetLabel({ ...BB, isUnilateral: true }, s, t)).toBe('3 × 10 reps por lado');
    expect(targetLabel({ ...BB, isUnilateral: true }, s, t, { compact: true })).toBe('3×10');
    expect(targetLabel(BB, { ...s, isUnilateral: true }, t)).toBe('3 × 10 reps');
  });

  it('la sesión no fija reps: caen las del ejercicio de la librería', () => {
    expect(targetLabel({ ...BB, minReps: 8, maxReps: 12 }, { sets: 3 }, t)).toBe('3 × 8–12 reps');
  });

  it('el modelo de progresión por tiempo decide el inputType si la sesión no lo dice', () => {
    const def = { progressionModel: 'time_progression', minTime: 30, maxTime: 45 };
    // Con Tiempo, Qué pides es solo el inicio: «30+ s» (P56 §6.3).
    expect(targetLabel(def, { sets: 3 }, t)).toBe('3 × 30+ s');
  });
});

describe('targetLabel — Reps y Tiempo: el inicio con «+» y la meta de hoy (P56 §6.3)', () => {
  const reps = { sets: 3, minReps: 8, maxReps: 8, progression: { type: 'reps' } };
  const time = { sets: 3, inputType: 'time', minTime: 30, maxTime: 30, progression: { type: 'time' } };

  it('sin historial a mano, el inicio con «+»', () => {
    expect(targetLabel(BB, reps, t)).toBe('3 × 8+ reps');
    expect(targetLabel(BB, reps, t, { compact: true })).toBe('3×8+');
    expect(targetLabel(BB, time, t)).toBe('3 × 30+ s');
    expect(targetLabel(BB, time, t, { compact: true })).toBe('3×30+ s');
  });

  it('con `today`, la meta de hoy', () => {
    expect(targetLabel(BB, reps, t, { today: { reps: 9 } })).toBe('3 × 9 reps');
    expect(targetLabel(BB, reps, t, { today: { reps: 9 }, compact: true })).toBe('3×9');
    expect(targetLabel(BB, time, t, { today: { time: 45 } })).toBe('3 × 45 s');
  });

  it('el resto de tipos no cambia, tenga o no `today`', () => {
    const dbl = { sets: 3, minReps: 8, maxReps: 12, progression: { type: 'double' } };
    expect(targetLabel(BB, dbl, t)).toBe('3 × 8–12 reps');
    expect(targetLabel(BB, dbl, t, { today: { reps: 9 } })).toBe('3 × 8–12 reps');
    expect(targetLabel(BB, { ...dbl, progression: { type: 'none' } }, t)).toBe('3 × 8–12 reps');
  });
});

describe('targetLabel — Por esfuerzo (P10-effort-progression.md §5.1)', () => {
  const tt = (key, o) => (typeof o === 'object' ? `${key}:${o.rpe ?? ''}/${o.count ?? ''}` : (o ?? key));
  const ex = (rpe) => ({ sets: 3, minReps: 5, maxReps: 5, progression: { type: 'effort', targetRpe: rpe } });

  it('normal: reps, RPE y recámara', () => {
    expect(targetLabel({}, ex(8), tt)).toBe('3 × 5 reps · workout.effortTarget:8/2');
    expect(targetLabel({ isUnilateral: true }, ex(8), tt)).toBe('3 × 5 reps por lado · workout.effortTarget:8/2');
  });
  it('RPE 10 es al fallo', () => {
    expect(targetLabel({}, ex(10), tt)).toBe('3 × 5 reps · workout.effortFailure');
  });
  it('compacto: 3×5 @RPE8', () => {
    expect(targetLabel({}, ex(8), tt, { compact: true })).toBe('3×5 @RPE8');
  });
});

describe('firstTimeRx — la fila «Primera vez» (P56 §6.3)', () => {
  const dbl = { sets: 3, minReps: 8, maxReps: 12, progression: { type: 'double' } };

  it('con carga: rango de reps', () => {
    expect(firstTimeRx(BB, dbl)).toEqual({ kind: 'weight', value: '8–12 reps' });
    expect(firstTimeRx(BB, { ...dbl, minReps: 5, maxReps: 5 })).toEqual({ kind: 'weight', value: '5 reps' });
  });
  it('sin carga, sea cual sea Qué sube: «haz las que puedas», sin la palabra reps', () => {
    const pullUp = { equipment: ['pull_up_bar'] };
    expect(firstTimeRx(pullUp, { ...dbl, minReps: 6, maxReps: 12 })).toEqual({ kind: 'bodyweight', value: '6–12' });
    expect(firstTimeRx(pullUp, { ...dbl, progression: { type: 'reps' }, minReps: 6, maxReps: 6 })).toEqual({ kind: 'bodyweight', value: '6+' });
  });
  it('tiempo: el rango, o el inicio con «+»', () => {
    const tm = { sets: 3, inputType: 'time', minTime: 30, maxTime: 60 };
    expect(firstTimeRx(BB, { ...tm, progression: { type: 'none', hold: null } })).toBeNull();
    expect(firstTimeRx(BB, { ...tm, progression: { type: 'double' } })).toEqual({ kind: 'time', value: '30–60 s' });
    expect(firstTimeRx(BB, { ...tm, maxTime: 30, progression: { type: 'time' } })).toEqual({ kind: 'time', value: '30+ s' });
  });
  it('por esfuerzo: reps @ RPE', () => {
    expect(firstTimeRx(BB, { sets: 3, minReps: 5, maxReps: 5, progression: { type: 'effort', targetRpe: 8 } }))
      .toEqual({ kind: 'effort', value: '5 @ RPE 8' });
  });
  it('Fija: no hay fila', () => {
    expect(firstTimeRx(BB, { ...dbl, progression: { type: 'none' } })).toBeNull();
  });
});
