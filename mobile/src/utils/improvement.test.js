import { describe, it, expect } from 'vitest';
import {
  seriesMetric, metricValue, linearRegressionPct, computeOverallImprovement,
  computeExPR, computeExSessionDeltas, lastSessionDelta, computeLastLoadDelta,
} from './improvement';

const BODYWEIGHT = { equipment: ['bench'] };            // puente de glúteo
const BARBELL    = { equipment: ['barbell'] };

const set  = (weight, reps) => ({ weight: String(weight), reps: String(reps), time: '', done: true });
const log  = (ts, sets) => ({ timestamp: ts, exercise: { exerciseId: 'ex', sets } });

// El caso del informe: 0 kg × 15/15/15 y luego 7,5 kg × 10.
const REPORT = [
  log(1, [set(0, 15), set(0, 15), set(0, 15)]),
  log(2, [set(7.5, 10)]),
];

describe('improvement — una métrica por serie (qa-sep-pantallas U25)', () => {
  it('peso corporal: 0 kg es "sin lastre" y el delta es +7,5 kg, no −37,5', () => {
    expect(seriesMetric(REPORT, BODYWEIGHT)).toBe('kg');
    const deltas = computeExSessionDeltas(REPORT, BODYWEIGHT);
    expect(deltas.map((d) => d.val)).toEqual([0, 7.5]);
    expect(deltas[1].delta).toBe(7.5);
    expect(lastSessionDelta(REPORT, BODYWEIGHT)).toBe(7.5);
  });

  it('con barra, la sesión sin peso es un hueco y no hay delta', () => {
    const deltas = computeExSessionDeltas(REPORT, BARBELL);
    expect(deltas[0].val).toBeNull();
    expect(deltas[1].delta).toBeNull();
    expect(lastSessionDelta(REPORT, BARBELL)).toBeNull();
  });

  it('sin ninguna serie con peso, la serie va en repeticiones', () => {
    const logs = [log(1, [set(0, 10)]), log(2, [set(0, 12)])];
    expect(seriesMetric(logs, BODYWEIGHT)).toBe('reps');
    expect(computeExSessionDeltas(logs, BODYWEIGHT)[1].delta).toBe(2);
  });

  it('el récord nunca es de repeticiones en una serie de kg', () => {
    expect(computeExPR(REPORT, BARBELL)).toMatchObject({ value: 7.5, metric: 'kg' });
    expect(computeExPR(REPORT, BODYWEIGHT)).toMatchObject({ value: 7.5, metric: 'kg' });
  });

  it('tendencia: base 0 → null; de 100 a 110 kg → +10 %', () => {
    expect(linearRegressionPct(REPORT, BODYWEIGHT)).toBeNull();
    expect(linearRegressionPct([log(1, [set(100, 5)]), log(2, [set(110, 5)])], BARBELL)).toBe(10);
  });

  it('Mejora global ignora los ejercicios sin tendencia', () => {
    const session = (ts, exercises) => ({ timestamp: ts, exercises });
    const workoutLog = [
      session(1, [{ exerciseId: 'bw', sets: [set(0, 15)] }, { exerciseId: 'sq', sets: [set(100, 5)] }]),
      session(2, [{ exerciseId: 'bw', sets: [set(7.5, 10)] }, { exerciseId: 'sq', sets: [set(110, 5)] }]),
    ];
    const all = { bw: BODYWEIGHT, sq: BARBELL };
    expect(computeOverallImprovement(workoutLog, all)).toBe(10);
    // Última frente a penúltima: el de base 0 tampoco cuenta.
    expect(computeLastLoadDelta(workoutLog, all)).toBe(10);
  });

  it('metricValue en kg respeta el tipo de ejercicio', () => {
    expect(metricValue([set(0, 15)], 'kg', BODYWEIGHT)).toBe(0);
    expect(metricValue([set(0, 15)], 'kg', BARBELL)).toBeNull();
  });
});
