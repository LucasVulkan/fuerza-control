import { describe, it, expect } from 'vitest';
import { EXERCISE_LIBRARY } from '../data/exerciseLibrary';
import { filterBySearch } from './searchText';
import { isDeep, SUGGESTED, splitHit, buildCustomExercise, withReps, volumeLabel } from './onboardingBuilder';

describe('constructor guiado — profundidad (O03 §10.3)', () => {
  it('sencilla solo para self principiante o intermedio; el resto, completa', () => {
    expect(isDeep('self', 'beginner')).toBe(false);
    expect(isDeep('self', 'intermediate')).toBe(false);
    expect(isDeep('self', null)).toBe(false);
    expect(isDeep('self', 'advanced')).toBe(true);
    expect(isDeep('trainer', 'beginner')).toBe(true);
    expect(isDeep('copy', null)).toBe(true);
  });

  it('los diez sugeridos existen en la biblioteca', () => {
    for (const id of [...SUGGESTED.simple, ...SUGGESTED.deep]) expect(EXERCISE_LIBRARY[id], id).toBeDefined();
    expect(SUGGESTED.simple).toHaveLength(5);
    expect(SUGGESTED.deep).toHaveLength(5);
  });
});

describe('splitHit — lo buscado en lima', () => {
  const joined = (parts) => parts.map((p) => p.text).join('');

  it('marca sin tildes ni mayúsculas y conserva el texto', () => {
    const parts = splitHit('Jalón al pecho', 'JALON');
    expect(joined(parts)).toBe('Jalón al pecho');
    expect(parts[0]).toEqual({ text: 'Jalón', hit: true });
    expect(parts[1].hit).toBe(false);
  });

  it('«press» en medio del nombre', () => {
    expect(splitHit('Press de banca', 'press')).toEqual([{ text: 'Press', hit: true }, { text: ' de banca', hit: false }]);
    expect(splitHit('Leg press', 'press')).toEqual([{ text: 'Leg ', hit: false }, { text: 'press', hit: true }]);
  });

  it('varias palabras, en cualquier orden', () => {
    const parts = splitHit('Remo en polea', 'polea remo');
    expect(parts.filter((p) => p.hit).map((p) => p.text)).toEqual(['Remo', 'polea']);
  });

  it('sin coincidencia literal (búsqueda por parecido) no marca nada', () => {
    expect(splitHit('Sentadilla goblet', 'sentdilla')).toEqual([{ text: 'Sentadilla goblet', hit: false }]);
    expect(splitHit('Sentadilla goblet', '')).toEqual([{ text: 'Sentadilla goblet', hit: false }]);
  });
});

describe('el buscador corto encuentra sin tildes (O03-02, Probar)', () => {
  const all = Object.values(EXERCISE_LIBRARY);
  const find = (q) => filterBySearch(all, q, (ex) => [ex.name, ex.nameEn].filter(Boolean).join(' ')).map((ex) => ex.name);

  it('«sentadilla» sin tilde encuentra «Sentadilla goblet»; «press» filtra; «zzz» no da nada', () => {
    expect(find('sentadilla')).toContain('Sentadilla goblet');
    expect(find('press').length).toBeGreaterThan(6);
    expect(find('zzz')).toEqual([]);
  });
});

describe('buildCustomExercise', () => {
  it('lleva el formato de ejercicio propio de CustomExerciseScreen', () => {
    const def = buildCustomExercise('  Mi curl  ', 'custom_x');
    expect(def).toMatchObject({
      id: 'custom_x', name: 'Mi curl', isCustom: true, primaryGroup: 'custom',
      sets: 3, minReps: 8, maxReps: 12, restSec: 90, inputType: 'weight_reps', progressionModel: 'double_progression',
    });
    expect(def.progression.type).toBe('double');
  });
});

describe('volumen del constructor (O03-03)', () => {
  it('withReps no deja el rango del revés', () => {
    expect(withReps(8, 12, { minReps: 6 })).toEqual({ minReps: 6, maxReps: 12 });
    expect(withReps(8, 12, { minReps: 14 })).toEqual({ minReps: 14, maxReps: 14 });
    expect(withReps(8, 12, { maxReps: 6 })).toEqual({ minReps: 6, maxReps: 6 });
    expect(withReps(8, 12, { maxReps: 10 })).toEqual({ minReps: 8, maxReps: 10 });
  });

  it('volumeLabel: rango, reps fijas y tiempo', () => {
    expect(volumeLabel({ sets: 3, minReps: 8, maxReps: 12 })).toBe('3×8-12');
    expect(volumeLabel({ sets: 4, minReps: 10, maxReps: 10 })).toBe('4×10');
    expect(volumeLabel({ sets: 3, minReps: 30, maxReps: 30, time: true })).toBe('3×30s');
  });
});
