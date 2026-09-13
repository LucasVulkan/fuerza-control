import { describe, it, expect } from 'vitest';
import { targetLabel } from './prescription';

// El `t` de verdad devuelve la traducción; aquí basta con el fallback, que es
// el segundo argumento.
const t = (key, fallback) => fallback ?? key;

describe('targetLabel', () => {
  it('sin definición de ejercicio no hay frase', () => {
    expect(targetLabel(null, { sets: 3 }, t)).toBe('');
  });

  it('rango de reps', () => {
    const s = { sets: 4, minReps: 6, maxReps: 8 };
    expect(targetLabel({}, s, t)).toBe('4 × 6–8 reps');
    expect(targetLabel({}, s, t, { compact: true })).toBe('4×6–8');
  });

  it('reps fijas: un solo número, no un rango de uno', () => {
    const s = { sets: 5, minReps: 5, maxReps: 5 };
    expect(targetLabel({}, s, t)).toBe('5 × 5 reps');
    expect(targetLabel({}, s, t, { compact: true })).toBe('5×5');
  });

  it('tiempo', () => {
    const s = { sets: 3, inputType: 'time', minTime: 20, maxTime: 40 };
    expect(targetLabel({}, s, t)).toBe('3 × 20–40 s');
    expect(targetLabel({}, s, t, { compact: true })).toBe('3×20–40 s');
  });

  it('submáximo manda sobre el resto', () => {
    const s = { sets: 3, minReps: 8, maxReps: 12 };
    expect(targetLabel({ progressionModel: 'submax' }, s, t)).toBe('3 × submáx');
    expect(targetLabel({ progressionModel: 'submax' }, s, t, { compact: true })).toBe('3×submáx');
  });

  it('unilateral se dice entero y se calla en compacto', () => {
    const s = { sets: 3, minReps: 10, maxReps: 10, isUnilateral: true };
    expect(targetLabel({}, s, t)).toBe('3 × 10 reps por lado');
    expect(targetLabel({}, s, t, { compact: true })).toBe('3×10');
  });

  it('la sesión no fija reps: caen las del ejercicio de la librería', () => {
    expect(targetLabel({ minReps: 8, maxReps: 12 }, { sets: 3 }, t)).toBe('3 × 8–12 reps');
  });

  it('el modelo de progresión por tiempo decide el inputType si la sesión no lo dice', () => {
    const def = { progressionModel: 'time_progression', minTime: 30, maxTime: 45 };
    expect(targetLabel(def, { sets: 3 }, t)).toBe('3 × 30–45 s');
  });
});
