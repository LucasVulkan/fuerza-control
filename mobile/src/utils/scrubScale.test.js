import { describe, test, expect } from 'vitest';
import {
  scrubRuler, scrubXOf, scrubValueAt, scrubTicks, SCRUB_PAD, MIN_NUMBER_GAP,
  scrubIsStrong, scrubDiffText, scrubEdge, scrubPanDir, scrubPanMs, scrubPan,
  SCRUB_EDGE_FAR, SCRUB_EDGE_NEAR, SCRUB_PAN_SLOW_MS, SCRUB_PAN_FAST_MS,
} from './scrubScale';

// Fila de 312 dp → 280 dp de regla: 8.75 dp por paso en kg (32), 5.09 en lb (55),
// 23.33 en reps (12), 31.11 en RPE (9).
const W = 312;
const MID = W / 2;

describe('scrubRuler · peso (anclada al dedo)', () => {
  test('el valor de partida cae bajo el dedo y arranca sin cambiar', () => {
    const r = scrubRuler('weight', 60, 120, W);
    expect(r.start).toBe(60);
    expect(r.originX).toBe(120);
    expect(r.px).toBe(8.75);
    expect(scrubXOf(r, 60)).toBe(120);
    expect(scrubValueAt(r, 120)).toBe(60);
  });

  test('lo que cabe a cada lado depende de dónde esté el dedo', () => {
    // dedo a 120: 104/8.75 = 11,9 pasos a la izquierda, 176/8.75 = 20,1 a la derecha
    const r = scrubRuler('weight', 60, 120, W);
    expect(r.min).toBe(54.5);
    expect(r.max).toBe(70);
  });

  test('derecha es más, un paso por px', () => {
    const r = scrubRuler('weight', 60, MID, W);
    expect(scrubValueAt(r, MID + 8.75)).toBe(60.5);
    expect(scrubValueAt(r, MID - 17.5)).toBe(59);
    expect(scrubValueAt(r, MID + 4.3)).toBe(60);
    expect(scrubValueAt(r, MID + 4.5)).toBe(60.5);
  });

  test('suelo 0 justo en el margen: sigue anclada, el 0 cae en PAD', () => {
    const r = scrubRuler('weight', 8, MID, W);   // 16 pasos a la izquierda del dedo = 8 kg
    expect(r).toMatchObject({ originX: MID, min: 0, start: 8 });
    expect(scrubXOf(r, 0)).toBeCloseTo(SCRUB_PAD);
  });

  test('recorte en los extremos de la regla', () => {
    const r = scrubRuler('weight', 100, MID, W);
    expect(scrubValueAt(r, 99999)).toBe(r.max);
    expect(scrubValueAt(r, -99999)).toBe(r.min);
    expect(scrubXOf(r, r.min)).toBeGreaterThanOrEqual(SCRUB_PAD - 1e-9);
    expect(scrubXOf(r, r.max)).toBeLessThanOrEqual(W - SCRUB_PAD + 1e-9);
  });

  test('dedo fuera de la regla: la partida se coloca en el extremo', () => {
    expect(scrubRuler('weight', 100, 0, W).originX).toBe(SCRUB_PAD);
    expect(scrubRuler('weight', 100, 9999, W).originX).toBe(W - SCRUB_PAD);
    expect(scrubRuler('weight', 100, 0, W).min).toBe(100);
  });

  test('rejilla absoluta: con 55,9 la regla va por 55,5 · 56 · 56,5, no por 56,4', () => {
    const r = scrubRuler('weight', 55.9, MID, W);
    expect(r.start).toBe(55.9);
    // sin mover el dedo (menos de medio paso) no cambia
    expect(scrubValueAt(r, MID)).toBe(55.9);
    expect(scrubValueAt(r, MID + r.px * 0.4)).toBe(55.9);
    // en cuanto se mueve, al múltiplo de 0,5 más cercano bajo el dedo
    expect(scrubValueAt(r, MID + r.px)).toBe(56.5);
    expect(scrubValueAt(r, MID + 2 * r.px)).toBe(57);
    expect(scrubValueAt(r, MID - r.px)).toBe(55.5);
    expect(r.min % 0.5).toBe(0);
    expect(r.max % 0.5).toBe(0);
  });

  test('kg: marcas grandes cada 2, medianas cada 1, 16 kg a lo ancho con dos y con tres cifras', () => {
    const r = scrubRuler('weight', 60, MID, W);
    expect(r).toMatchObject({ step: 0.5, tickEvery: 1, labelEvery: 2 });
    expect(r.max - r.min).toBe(16);
    expect(scrubRuler('weight', 100, MID, W).px).toBe(8.75);
    expect(scrubRuler('weight', 100, MID, W).max - scrubRuler('weight', 100, MID, W).min).toBe(16);
  });

  test('NaN o negativo cuentan como 0', () => {
    expect(scrubRuler('weight', NaN, MID, W).min).toBe(0);
    expect(scrubRuler('weight', -5, MID, W).min).toBe(0);
  });
});

describe('scrubRuler · el 0 nunca queda dentro de la fila', () => {
  test('0 kg con el dedo a mitad de fila: regla absoluta, el valor es el de bajo el dedo', () => {
    const r = scrubRuler('weight', 0, MID, W);
    expect(r).toMatchObject({ originX: SCRUB_PAD, originValue: 0, min: 0, max: 16 });
    expect(r.start).toBe(8);                          // (156−16)/8.75 = 16 pasos
    expect(scrubXOf(r, 0)).toBe(SCRUB_PAD);
    expect(scrubValueAt(r, W)).toBe(16);
  });

  test('con el dedo en la casilla KG, a la izquierda, salta a unos 2-3 kg', () => {
    expect(scrubRuler('weight', 0, 60, W).start).toBe(2.5);
  });

  test('peso bajo (5 kg) con hueco a la izquierda: absoluta; sin hueco: anclada', () => {
    expect(scrubRuler('weight', 5, MID, W)).toMatchObject({ originX: SCRUB_PAD, min: 0 });
    expect(scrubRuler('weight', 5, 40, W)).toMatchObject({ originX: 40, start: 5 });
  });

  test('reps 3 con el dedo a mitad de fila: 0 en el margen, 12 en el otro, start = bajo el dedo', () => {
    const r = scrubRuler('reps', 3, MID, W);
    expect(r).toMatchObject({ originX: SCRUB_PAD, originValue: 0, min: 0, max: 12, start: 6 });
    expect(scrubValueAt(r, -9999)).toBe(0);
    expect(scrubValueAt(r, 9999)).toBe(12);
  });

  test('libras: 55 lb a lo ancho', () => {
    expect(scrubRuler('weight', 0, MID, W, { unit: 'lb' })).toMatchObject({ originX: SCRUB_PAD, min: 0, max: 55 });
  });

  test('el caso normal (kLeft limitado por el dedo) no cambia el valor', () => {
    expect(scrubRuler('weight', 100, MID, W).start).toBe(100);
    expect(scrubRuler('reps', 10, MID, W).start).toBe(10);
  });
});

describe('scrubRuler · libras', () => {
  test('paso 1, marcas grandes cada 5 y medianas cada 1; 55 pasos, 36 con tres cifras', () => {
    expect(scrubRuler('weight', 60, MID, W, { unit: 'lb' }).px).toBeCloseTo(280 / 55);
    const r = scrubRuler('weight', 225, MID, W, { unit: 'lb' });
    expect(r).toMatchObject({ step: 1, tickEvery: 1, labelEvery: 5 });
    expect(r.px).toBeCloseTo(280 / 36);
    expect(r.max - r.min).toBeGreaterThanOrEqual(35);
    expect(r.max - r.min).toBeLessThanOrEqual(36);
    expect(scrubValueAt(r, MID + r.px)).toBe(226);
  });
});

describe('scrubRuler · reps (anclada al dedo)', () => {
  test('start redondeado al entero, 12 pasos a lo ancho, todas las marcas grandes', () => {
    const r = scrubRuler('reps', 8.6, MID, W);
    expect(r.start).toBe(9);
    expect(r.px).toBeCloseTo(280 / 12);
    expect(scrubValueAt(r, MID)).toBe(9);
    expect(scrubTicks(r).every((t) => t.major && t.numbered)).toBe(true);
  });

  test('con el dedo a la izquierda y reps altas, lo de la izquierda no cabe', () => {
    const r = scrubRuler('reps', 10, SCRUB_PAD + 1, W);
    expect(r.min).toBe(10);
    expect(r.max).toBe(10 + Math.floor((W - 2 * SCRUB_PAD - 1) / r.px));
  });
});

describe('scrubRuler · RPE (fija y absoluta)', () => {
  const r = scrubRuler('rpe', 8, MID, W);

  test('1..10 a lo ancho, origen en el margen', () => {
    expect(r).toMatchObject({ min: 1, max: 10, step: 1, originX: SCRUB_PAD, originValue: 1 });
    expect(r.px).toBeCloseTo(280 / 9);
    expect(scrubXOf(r, 10)).toBeCloseTo(W - SCRUB_PAD);
  });

  test('el valor es el de la x del dedo: izquierda del todo → 1, derecha → 10', () => {
    expect(scrubValueAt(r, 0)).toBe(1);
    expect(scrubValueAt(r, W)).toBe(10);
    expect(scrubValueAt(r, MID)).toBe(6);        // (156−16)/31.1 = 4.5 → 5 pasos → 6
  });

  test('arranca con el valor bajo el dedo, sea cual sea el de la casilla', () => {
    expect(scrubRuler('rpe', 0, SCRUB_PAD, W).start).toBe(1);
    expect(scrubRuler('rpe', 8, W - SCRUB_PAD, W).start).toBe(10);
    expect(scrubRuler('rpe', 8, MID, W).start).toBe(6);
  });
});

describe('numberEvery', () => {
  test(`el menor múltiplo de las marcas grandes con ≥ ${MIN_NUMBER_GAP.two} dp (${MIN_NUMBER_GAP.three} con tres cifras) entre números`, () => {
    // 5.9 dp por paso: cada 2 kg = 23.6 dp cabe
    expect(scrubRuler('weight', 100, MID, 2 * SCRUB_PAD + 50 * 5.9).numberEvery).toBe(2);
    expect(scrubRuler('weight', 100, MID, W).numberEvery).toBe(2);
    // más estrecha (3.4 dp por paso): cada 2 kg = 13.6 no cabe, cada 4 kg sí
    expect(scrubRuler('weight', 100, MID, 2 * SCRUB_PAD + 50 * 3.4).numberEvery).toBe(4);
  });

  test('libras: cada 5 lb = 25.5 dp caben', () => {
    expect(scrubRuler('weight', 225, MID, W, { unit: 'lb' }).numberEvery).toBe(5);
  });

  test('reps y RPE: todos los números', () => {
    expect(scrubRuler('reps', 8, MID, W).numberEvery).toBe(1);
    expect(scrubRuler('rpe', 8, MID, W).numberEvery).toBe(1);
  });
});

describe('scrubTicks', () => {
  test('múltiplos absolutos aunque el valor de partida no lo sea; | . : . | y números en todas las grandes', () => {
    const r = scrubRuler('weight', 87.3, MID, W);     // 75 … 99.5
    const t = scrubTicks(r);
    expect(t.every((x) => Math.abs(x.value * 2 - Math.round(x.value * 2)) < 1e-9)).toBe(true);
    expect(t.find((x) => x.value === 84)).toEqual({ value: 84, major: true, dot: false, numbered: true, bright: true });
    expect(t.find((x) => x.value === 84.5)).toEqual({ value: 84.5, major: false, dot: true, numbered: false, bright: false });
    expect(t.find((x) => x.value === 85)).toEqual({ value: 85, major: false, dot: false, numbered: false, bright: false });
    expect(t.find((x) => x.value === 86)).toEqual({ value: 86, major: true, dot: false, numbered: true, bright: false });
    expect(t.every((x) => x.value >= r.min && x.value <= r.max)).toBe(true);
  });

  test('libras: grandes cada 5, medianas cada 1 (sin puntos), números en todas las grandes', () => {
    const t = scrubTicks(scrubRuler('weight', 225, MID, W, { unit: 'lb' }));
    expect(t.some((x) => x.dot)).toBe(false);
    expect(t.find((x) => x.value === 222)).toEqual({ value: 222, major: false, dot: false, numbered: false, bright: false });
    expect(t.find((x) => x.value === 225)).toEqual({ value: 225, major: true, dot: false, numbered: true, bright: false });
    expect(t.find((x) => x.value === 230)).toEqual({ value: 230, major: true, dot: false, numbered: true, bright: true });
  });

  test('RPE: 1..10, todas con número', () => {
    expect(scrubTicks(scrubRuler('rpe', 5, MID, W)).map((x) => x.value)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  test('suelo 0: la primera marca es el 0 y no hay nada por debajo', () => {
    expect(scrubTicks(scrubRuler('weight', 3, MID, W))[0].value).toBe(0);
  });
});

// ── U10-10 ───────────────────────────────────────────────────────────────────

describe('scrubIsStrong · vibración por escalones', () => {
  test('kg: cada kilo entero es redondo, los medios kilos son finos', () => {
    const r = scrubRuler('weight', 60, MID, W);
    expect(r.strongEvery).toBe(1);
    expect(scrubIsStrong(r, 60)).toBe(true);
    expect(scrubIsStrong(r, 60.5)).toBe(false);
    expect(scrubIsStrong(r, 61)).toBe(true);
    expect(scrubIsStrong(r, 55.9)).toBe(false);
  });

  test('lb: redondo cada 5 lb', () => {
    const r = scrubRuler('weight', 225, MID, W, { unit: 'lb' });
    expect(r.strongEvery).toBe(5);
    expect(scrubIsStrong(r, 225)).toBe(true);
    expect(scrubIsStrong(r, 226)).toBe(false);
    expect(scrubIsStrong(r, 230)).toBe(true);
  });

  test('reps y RPE: todos finos', () => {
    for (const r of [scrubRuler('reps', 8, MID, W), scrubRuler('rpe', 8, MID, W)]) {
      expect(scrubIsStrong(r, 5)).toBe(false);
      expect(scrubIsStrong(r, 10)).toBe(false);
    }
  });
});

describe('scrubDiffText', () => {
  test('signo explícito, menos tipográfico, 2 decimales sin ruido', () => {
    expect(scrubDiffText(62.5, 60)).toBe('+2.5');
    expect(scrubDiffText(59, 60)).toBe('−1');
    expect(scrubDiffText(0.3, 0.1)).toBe('+0.2');
    expect(scrubDiffText(0.1 + 0.2, 0)).toBe('+0.3');
    expect(scrubDiffText(56.5, 55.9)).toBe('+0.6');
  });

  test('con diferencia 0 la línea va vacía', () => {
    expect(scrubDiffText(60, 60)).toBe('');
    expect(scrubDiffText(0.1 + 0.2, 0.3)).toBe('');
  });
});

describe('bordes: indicador y zona de avance', () => {
  test('la intensidad va de 0 a 1 entre 56 y 24 dp del borde de la fila, con signo por lado', () => {
    expect(SCRUB_EDGE_FAR).toBe(56);
    expect(SCRUB_EDGE_NEAR).toBe(24);
    expect(scrubEdge(MID, W)).toBe(0);
    expect(scrubEdge(56, W)).toBe(0);
    expect(scrubEdge(40, W)).toBe(-0.5);
    expect(scrubEdge(24, W)).toBe(-1);
    expect(scrubEdge(0, W)).toBe(-1);
    expect(scrubEdge(W - 40, W)).toBe(0.5);
    expect(scrubEdge(W - 10, W)).toBe(1);
  });

  test('cuantizada a décimas', () => {
    for (let x = 0; x <= W; x += 3) expect(Math.abs(scrubEdge(x, W) * 10 - Math.round(scrubEdge(x, W) * 10))).toBeLessThan(1e-9);
  });

  test('avanza a menos de 24 dp: izquierda −1, derecha 1, el resto 0', () => {
    expect(scrubPanDir(24, W)).toBe(-1);
    expect(scrubPanDir(25, W)).toBe(0);
    expect(scrubPanDir(MID, W)).toBe(0);
    expect(scrubPanDir(W - 24, W)).toBe(1);
    expect(scrubPanDir(W - 30, W)).toBe(0);
  });

  test('~180 ms al entrar en la zona, ~60 ms pegado al borde', () => {
    expect(scrubPanMs(24, W)).toBe(SCRUB_PAN_SLOW_MS);
    expect(scrubPanMs(0, W)).toBe(SCRUB_PAN_FAST_MS);
    expect(scrubPanMs(W, W)).toBe(SCRUB_PAN_FAST_MS);
    expect(scrubPanMs(12, W)).toBe(120);
  });
});

describe('scrubPan', () => {
  test('sube: min, max y originValue + step; originX no cambia', () => {
    const r = scrubRuler('weight', 60, MID, W);
    const p = scrubPan(r, 1);
    expect(p).toMatchObject({ min: r.min + 0.5, max: r.max + 0.5, originValue: 60.5, originX: r.originX });
    expect(scrubValueAt(p, MID)).toBe(60.5);                 // un paso más bajo el dedo
  });

  test('baja y se para cuando min llega a 0', () => {
    let r = scrubRuler('weight', 9, MID, W);                 // min = 1
    r = scrubPan(r, -1);
    expect(r.min).toBe(0.5);
    r = scrubPan(r, -1);
    expect(r.min).toBe(0);
    const stuck = scrubPan(r, -1);
    expect(stuck).toBe(r);                                   // misma regla: no pasa de 0
    expect(scrubPan(r, 1).min).toBe(0.5);
  });

  test('reps: un paso de 1', () => {
    const r = scrubRuler('reps', 10, MID, W);
    expect(scrubPan(r, 1)).toMatchObject({ originValue: 11, min: r.min + 1, max: r.max + 1 });
    expect(scrubPan(scrubRuler('reps', 1, W - SCRUB_PAD, W), -1).min).toBeGreaterThanOrEqual(0);
  });

  test('origen fuera de rejilla (55,9) cae en la rejilla al desplazar y ya no hay zona muerta fuera de ella', () => {
    const r = scrubRuler('weight', 55.9, MID, W);
    expect(scrubPan(r, 1).originValue).toBe(56);
    expect(scrubPan(r, -1).originValue).toBe(55.5);
    for (const dir of [1, -1]) {
      const p = scrubPan(r, dir);
      expect(scrubValueAt(p, p.originX)).toBe(p.originValue);      // zona muerta: el valor del origen…
      expect(p.originValue % 0.5).toBe(0);                          // …que ahora está en rejilla
      expect(p.min % 0.5).toBe(0);
      expect(p.max % 0.5).toBe(0);
      expect(scrubValueAt(p, p.originX + p.px)).toBe(p.originValue + 0.5);
    }
  });

  test('desplazar varias veces conserva la rejilla y los pasos', () => {
    let r = scrubRuler('weight', 55.9, MID, W);
    for (let i = 0; i < 5; i++) r = scrubPan(r, 1);
    expect(r.originValue).toBe(58);   // 55,9 → 56 → 56,5 → 57 → 57,5 → 58
    expect(r.step).toBe(0.5);
    expect(scrubTicks(r).every((t) => t.value >= r.min && t.value <= r.max)).toBe(true);
  });
});

describe('scrubRuler · segundos (U10-12)', () => {
  test('de 5 en 5, 50 s a lo ancho, anclada al dedo, todos los números', () => {
    const r = scrubRuler('time', 60, MID, W);
    expect(r).toMatchObject({ step: 5, tickEvery: 5, numberEvery: 5, start: 60, originX: MID });
    expect(r.px).toBe(28);
    expect(scrubValueAt(r, MID + 28)).toBe(65);
    expect(scrubValueAt(r, MID - 56)).toBe(50);
    expect(scrubTicks(r).every((x) => x.numbered)).toBe(true);
  });

  test('blancos los múltiplos de 10, grises los de 5', () => {
    const t = scrubTicks(scrubRuler('time', 60, MID, W));
    expect(t.find((x) => x.value === 60).bright).toBe(true);
    expect(t.find((x) => x.value === 65).bright).toBe(false);
  });

  test('un valor fuera de la rejilla (47) se queda hasta mover el dedo y luego va de 5 en 5', () => {
    const r = scrubRuler('time', 47, MID, W);
    expect(scrubValueAt(r, MID)).toBe(47);
    expect(scrubValueAt(r, MID + 28)).toBe(50);
  });
});
