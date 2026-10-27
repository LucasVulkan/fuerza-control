// P18-04: la línea del porqué de cada chip, con los textos de verdad (es/en),
// contra la tabla de formatos aprobados de P18 §6 (con la unidad tras cada
// cifra, pedido del usuario el 27-oct). La fila 1 (verbo + cifra)
// la compone la tarjeta; aquí se comprueba la fila 2.
import { describe, it, expect } from 'vitest';
import { getProgression } from './progression';
import es from '../locales/es.json';
import en from '../locales/en.json';

// Un `t` de verdad en miniatura: claves con punto, plural `_one/_other` e
// interpolación (como en sessionText.test.js).
const makeT = (dict) => (key, opts = {}) => {
  const get = (k) => k.split('.').reduce((o, p) => o?.[p], dict);
  const plural = opts.count != null ? get(`${key}_${opts.count === 1 ? 'one' : 'other'}`) : null;
  const raw = plural ?? get(key) ?? key;
  return String(raw).replace(/\{\{(\w+)\}\}/g, (_, v) => opts[v] ?? '');
};
const t = makeT(es);

const BB = { equipment: ['barbell'], weightStep: 2.5 };
const ASSISTED = { progressionDirection: 'decrease', weightStep: 2.5 };
const ses = (w, reps, rpe = []) => reps.map((r, i) => ({ weight: String(w), reps: String(r), rpe: String(rpe[i] ?? ''), done: true }));
const vol = (key, vals) => vals.map((v) => ({ weight: '', reps: key === 'reps' ? String(v) : '', time: key === 'time' ? String(v) : '', done: true }));
const dbl = (sets, min, max, p = {}) => ({ sets, minReps: min, maxReps: max, progression: { type: 'double', ...p } });
const why = (cfg, def, sets, opts, tt = t) => getProgression(cfg, def, sets, tt, opts).why;

describe('P18 §6 — la línea del porqué (es)', () => {
  it('Sube', () => {
    expect(why(dbl(3, 10, 12), BB, ses(30, [12, 12, 12]))).toBe('Llega a 12 reps en las 3 series para volver a subir');
  });
  it('Mantener, dentro del rango', () => {
    expect(why(dbl(3, 10, 12), BB, ses(32.5, [12, 11, 10]))).toBe('Llega a 12 reps en las 3 series para subir');
  });
  // P18 §8, caso 1
  it('Mantener, fallo leve', () => {
    expect(why(dbl(3, 10, 12), BB, ses(32.5, [10, 9, 9]), { earlier: [ses(30, [12, 12, 12])] }))
      .toBe('Te faltaron 2 reps para el mínimo (10)');
  });
  it('plural: 1 rep', () => {
    expect(why(dbl(3, 10, 12), BB, ses(32.5, [10, 10, 9]))).toBe('Te faltó 1 rep para el mínimo (10)');
  });
  // P18 §8, caso 3
  it('Mantener, mejora', () => {
    expect(why(dbl(5, 5, 5), BB, ses(95, [5, 5, 5, 5, 4]), { earlier: [ses(95, [5, 5, 5, 4, 4])] }))
      .toBe('Vas mejorando (24 reps); llega a 5 reps en las 5 series para subir');
  });
  // P18 §8, caso 8 (el decimal sale con punto, como el resto de cifras de la app)
  it('Mantener, freno de RPE', () => {
    expect(why(dbl(3, 8, 12, { evaluation: { mode: 'rpe', maxRpe: 8 } }), BB, ses(62.5, [12, 12, 12], [8, 9, 9.5])))
      .toBe('Llegaste arriba, pero con RPE medio 8.8 (máx. 8)');
  });
  // P18 §8, caso 5
  it('Bajar, fallo grande', () => {
    expect(why(dbl(5, 5, 5), BB, ses(95, [5, 4, 4, 3, 3]))).toBe('Te faltaron 6 reps para el mínimo (5)');
  });
  // P18 §8, caso 4
  it('Bajar, segundo fallo', () => {
    expect(why(dbl(5, 5, 5), BB, ses(95, [5, 5, 4, 4, 4]), { earlier: [ses(95, [5, 5, 5, 4, 4])] }))
      .toBe('Segundo día seguido sin llegar al mínimo');
  });
  // P18 §8, caso 6
  it('La mayoría con rango', () => {
    expect(why(dbl(3, 12, 15, { evaluation: { mode: 'part', need: 2 } }), BB, ses(8, [15, 15, 11])))
      .toBe('Te faltó 1 rep para el mínimo (12)');
    expect(why(dbl(3, 12, 15, { evaluation: { mode: 'part', need: 2 } }), BB, ses(8, [15, 14, 13])))
      .toBe('Llega a 15 reps en 2 de 3 series (y el resto a 12 reps o más) para subir');
  });
  it('Asistida: para quitar ayuda', () => {
    expect(why(dbl(3, 5, 8), ASSISTED, ses(30, [8, 7, 6]))).toBe('Llega a 8 reps en las 3 series para quitar ayuda');
  });
  // P18 §8, caso 12
  it('Reps', () => {
    expect(why({ sets: 3, minReps: 6, maxReps: 6, progression: { type: 'reps' } }, {}, vol('reps', [12, 12, 7])))
      .toBe('La última vez hiciste 31');
  });
  // P18 §8, casos 13 y 14
  it('Reps, mejora / fallo', () => {
    const c = { sets: 3, minReps: 6, maxReps: 6, progression: { type: 'reps' } };
    expect(why(c, {}, vol('reps', [12, 12, 11]), { earlier: [vol('reps', [12, 11, 11])], lastGoal: { total: 37, misses: 0 } }))
      .toBe('Vas mejorando: la última vez hiciste 35');
    expect(why(c, {}, vol('reps', [10, 9, 8]), { earlier: [vol('reps', [12, 11, 11])], lastGoal: { total: 37, misses: 0 } }))
      .toBe('La última vez hiciste 27, menos que el día anterior');
  });
  // P18 §8, caso 16
  it('Tiempo', () => {
    expect(why({ sets: 3, minTime: 30, maxTime: 30, inputType: 'time', progression: { type: 'time' } }, {}, vol('time', [45, 40, 30])))
      .toBe('La última vez hiciste 115 s');
  });
});

describe('P18 §6 — en inglés', () => {
  const tEn = makeT(en);
  it('fallo leve y meta', () => {
    expect(why(dbl(3, 10, 12), BB, ses(32.5, [10, 9, 9]), {}, tEn)).toBe('You were 2 reps short of the minimum (10)');
    expect(why(dbl(3, 10, 12), BB, ses(32.5, [12, 11, 10]), {}, tEn)).toBe('Hit 12 reps on all 3 sets to go up');
  });
});
