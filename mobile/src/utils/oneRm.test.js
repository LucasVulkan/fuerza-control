import { describe, test, expect } from 'vitest';
import { epley1RM, bestSetE1RM, recentE1RM, weightForReps, e1rmAtLeast } from './oneRm';

describe('epley1RM', () => {
  test('1 rep = the weight itself', () => {
    expect(epley1RM(100, 1)).toBe(100);
  });

  test('Epley formula: 100kg × 5 ≈ 116.7', () => {
    expect(epley1RM(100, 5)).toBeCloseTo(116.7, 1);
  });

  test('ignores sets above 12 reps (formula unreliable)', () => {
    expect(epley1RM(100, 15)).toBeNull();
  });

  test('null when weight or reps missing/invalid', () => {
    expect(epley1RM(0, 5)).toBeNull();
    expect(epley1RM(100, '')).toBeNull();
    expect(epley1RM(100, 0)).toBeNull();
  });

  describe('RIR adjustment from RPE', () => {
    test('RPE 8 on 5 reps → estimated as a 7-rep max (higher e1RM)', () => {
      // 100×5 @8 means 2 reps in reserve → 7 effective reps
      expect(epley1RM(100, 5, '8')).toBeCloseTo(123.3, 1);
    });

    test('RPE 10 = 0 RIR → same as raw reps', () => {
      expect(epley1RM(100, 5, '10')).toBeCloseTo(116.7, 1);
    });

    test('effective reps over 12 → null', () => {
      // 10 reps @7 = 13 effective reps
      expect(epley1RM(100, 10, '7')).toBeNull();
    });

    test('out-of-range RPE is ignored', () => {
      expect(epley1RM(100, 5, '3')).toBeCloseTo(116.7, 1);
    });
  });
});

describe('bestSetE1RM', () => {
  test('returns the highest e1RM across sets, skipping invalid ones', () => {
    const sets = [
      { weight: '80',  reps: '8', done: true },   // ~101.3
      { weight: '90',  reps: '3', done: true },   // ~99
      { weight: '100', reps: '',  done: true },   // no reps → skipped
    ];
    expect(bestSetE1RM(sets)).toBeCloseTo(101.3, 1);
  });

  test('null on empty / undefined', () => {
    expect(bestSetE1RM([])).toBeNull();
    expect(bestSetE1RM(undefined)).toBeNull();
  });
});

describe('recentE1RM', () => {
  const day = 24 * 60 * 60 * 1000;

  test('best e1RM within the 6-week window, ignoring older sessions', () => {
    const now = Date.now();
    const logs = [
      { timestamp: now - 100 * day, exercise: { sets: [{ weight: 120, reps: 3, done: true }] } }, // out of window
      { timestamp: now - 10  * day, exercise: { sets: [{ weight: 100, reps: 5, done: true }] } }, // 116.7
      { timestamp: now - 2   * day, exercise: { sets: [{ weight: 90,  reps: 8, done: true }] } }, // 114
    ];
    const r = recentE1RM(logs);
    expect(r.value).toBeCloseTo(116.7, 1);
  });

  test('null when no sessions in window', () => {
    expect(recentE1RM([])).toBeNull();
  });
});

describe('weightForReps (inversa de epley1RM)', () => {
  test('ida y vuelta: 80 × 5 @8 → e1RM → 5 @8 da 80', () => {
    const e = epley1RM(80, 5, 8);
    expect(weightForReps(e, 5, 8)).toBeCloseTo(80, 6);
  });
  test('una rep al fallo es el propio 1RM', () => {
    expect(weightForReps(100, 1, 10)).toBe(100);
  });
  test('reps equivalentes > 12 → null; 12 todavía vale', () => {
    expect(weightForReps(100, 10, 7)).toBeNull();
    expect(weightForReps(100, 10, 8)).toBeCloseTo(100 / 1.4, 6);
  });
  test('sin 1RM → null', () => {
    expect(weightForReps(0, 5, 8)).toBeNull();
    expect(weightForReps(null, 5, 8)).toBeNull();
  });
});

describe('e1rmAtLeast (cota baja para Por esfuerzo)', () => {
  test('en rango, igual que epley1RM', () => {
    expect(e1rmAtLeast('80', '5', '8')).toBeCloseTo(epley1RM(80, 5, 8), 6);
  });
  test('RPE por debajo de 5 cuenta como 5', () => {
    expect(e1rmAtLeast(70, 5, 3)).toBeCloseTo(e1rmAtLeast(70, 5, 5), 6);
  });
  test('más de 12 reps equivalentes cuentan como 12', () => {
    expect(e1rmAtLeast(50, 10, 5)).toBeCloseTo(50 * 1.4, 6);
  });
  test('sin peso, reps o RPE → null', () => {
    expect(e1rmAtLeast('', 5, 8)).toBeNull();
    expect(e1rmAtLeast(50, '', 8)).toBeNull();
    expect(e1rmAtLeast(50, 5, '')).toBeNull();
  });
});

describe('I01-01 — huecos de mutación', () => {
  // P10 §2.2: «las que den `null` no cuentan» (sin peso válido no hay e1RM)
  // mata oneRm.js:23 (`w <= 0` → false)
  test('epley1RM: peso negativo → null', () => {
    expect(epley1RM(-100, 5)).toBeNull();
  });

  // P10 §2.2: «las que den `null` no cuentan» (sin reps válidas no hay e1RM)
  // mata oneRm.js:23:29 (`!r` → false)
  test('epley1RM: reps vacías → null', () => {
    expect(epley1RM(100, '')).toBeNull();
  });

  // P10 §2.2: suma la recámara con RPE 5-10 (RPE 5 = 5 en recámara → 10RM)
  // mata oneRm.js:25:7 (`rpeNum >= 5` → `> 5`)
  test('epley1RM: RPE 5 en el límite suma 5 reps de recámara', () => {
    expect(epley1RM(100, 5, 5)).toBeCloseTo(133.33, 2);
  });

  // P10 §2.2: «fuera de ahí la serie cuenta como hecha al fallo» (RPE 11 no suma recámara)
  // mata oneRm.js:25:22 (`rpeNum <= 10` → true)
  test('epley1RM: RPE 11 fuera de rango cuenta como al fallo', () => {
    expect(epley1RM(100, 5, 11)).toBeCloseTo(116.67, 2);
  });

  // P10 §2.2: devuelve `null` por encima de `MAX_RELIABLE_REPS = 12`; 12 todavía vale
  // mata oneRm.js:28 (`r > 12` → `r >= 12`)
  test('epley1RM: 12 reps todavía valen', () => {
    expect(epley1RM(100, 12)).toBeCloseTo(140, 6);
  });

  // P10 §2.2 paso 1 (series con peso, reps y RPE) + cota baja «RPE < 5 cuenta como 5»
  // mata oneRm.js:45:9 (`w > 0` → `w >= 0`)
  test('e1rmAtLeast: peso 0 → null', () => {
    expect(e1rmAtLeast(0, 5, 8)).toBeNull();
  });

  // P10 §2.2: 1 rep con RPE 8 = 1 + 2 en recámara = 3RM → 100 × (1 + 3/30)
  // mata oneRm.js:45:21 (`r >= 1` → `r > 1`)
  test('e1rmAtLeast: 1 rep con RPE 8 es una 3RM', () => {
    expect(e1rmAtLeast(100, 1, 8)).toBeCloseTo(110, 6);
  });

  // P10 §2.2 paso 1: sin RPE la serie no cuenta (RPE 0 = no apuntado)
  // mata oneRm.js:45:34 (`p > 0` → `p >= 0`)
  test('e1rmAtLeast: RPE 0 → null', () => {
    expect(e1rmAtLeast(100, 5, 0)).toBeNull();
  });

  // P10 §2.2: «r === 1 → e1rm» (una rep al fallo es el propio peso)
  // mata oneRm.js:47 (`eq === 1` → false)
  test('e1rmAtLeast: 1 rep a RPE 10 es el propio peso', () => {
    expect(e1rmAtLeast(100, 1, 10)).toBe(100);
  });

  // T02 tabla `e1rm`: «mejor e1RM» (ni la primera ni la última serie: la mejor)
  // mata oneRm.js:68:24 (`best === null || v > best` → `&&` / `false`: gana la primera)
  //  y oneRm.js:68 (→ true: gana la última)
  test('bestSetE1RM: devuelve la mejor serie, esté donde esté', () => {
    const sets = [
      { weight: '80',  reps: '5', rpe: '8', done: true },
      { weight: '100', reps: '5', rpe: '8', done: true },
      { weight: '60',  reps: '5', rpe: '8', done: true },
    ];
    expect(bestSetE1RM(sets)).toBeCloseTo(123.33, 2);
  });

  // T02: docstring «best e1RM over the last weeks» (el mejor de la ventana, no el primero ni el más reciente)
  // mata oneRm.js:88:24 (`best === null || v >= best` → `&&` / `false`: gana el primero)
  //  y oneRm.js:88 (→ true: gana el último)
  test('recentE1RM: el mejor de la ventana, con el timestamp de su sesión', () => {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    const logs = [
      { timestamp: now - 20 * day, exercise: { sets: [{ weight: '80',  reps: '5', rpe: '8', done: true }] } },
      { timestamp: now - 10 * day, exercise: { sets: [{ weight: '100', reps: '5', rpe: '8', done: true }] } },
      { timestamp: now - 2 * day,  exercise: { sets: [{ weight: '60',  reps: '5', rpe: '8', done: true }] } },
    ];
    const r = recentE1RM(logs);
    expect(r.value).toBeCloseTo(123.33, 2);
    expect(r.timestamp).toBe(now - 10 * day);
  });
});
