import { describe, it, expect } from 'vitest';
import { sessionToText, SEP } from './sessionText';
import { EXERCISE_LIBRARY as LIB } from '../data/exerciseLibrary';
import es from '../locales/es.json';
import en from '../locales/en.json';

// Un `t` de verdad en miniatura: claves con punto, plural `_one/_other` e
// interpolación. Así el test lee los textos que verá el cliente.
const makeT = (dict) => (key, opts = {}) => {
  const get = (k) => k.split('.').reduce((o, p) => o?.[p], dict);
  const plural = opts.count != null ? get(`${key}_${opts.count === 1 ? 'one' : 'other'}`) : null;
  const raw = plural ?? get(key) ?? key;
  return String(raw).replace(/\{\{(\w+)\}\}/g, (_, v) => opts[v] ?? '');
};
const t = makeT(es);

const sets = (weight, reps, n) => Array.from({ length: n }, () => ({ weight, reps, done: true }));

describe('sessionToText', () => {
  const template = {
    label: 'C',
    name: 'Pierna fuerza',
    exercises: [
      { exerciseId: 'squat_barbell', sets: 4, minReps: 6, maxReps: 6 },
      { exerciseId: 'bulgarian_split_squat', sets: 3, minReps: 10, maxReps: 10 },
      { exerciseId: 'plank', sets: 3, inputType: 'time', minTime: 40, maxTime: 40, progressionModel: 'time_progression' },
      { exerciseId: 'burpee', sets: 3, progressionModel: 'submax' },
    ],
    blocks: [{
      id: 'b1', format: 'amrap', capSec: 720, name: null,
      movements: [{ exerciseId: 'burpee', amount: 10, unit: 'reps' }, { exerciseId: 'burpee', amount: 200, unit: 'm' }],
    }],
  };

  it('una línea por ejercicio: nombre · receta, y los dos puntos para contestar', () => {
    const lines = sessionToText(template, LIB, t, { language: 'es' }).split('\n');
    expect(lines[0]).toBe('Sesión C · Pierna fuerza');
    expect(lines[1]).toBe('Sentadilla con barra · 4x6:');
    expect(lines[2]).toBe('Sentadilla búlgara · 3x10 c/p:');
    expect(lines[3]).toBe(`${LIB.plank.name} · 3x40s:`);
    expect(lines[4]).toBe(`${LIB.burpee.name} · 3 series:`);
    expect(lines[5]).toBe(`AMRAP 12' · 10 ${LIB.burpee.name}, 200 m ${LIB.burpee.name}:`);
    expect(lines[6]).toBe('');
    expect(lines[7]).toBe(es.sessionText.howTo);
  });

  it('con historial, el peso de hoy: el que sugiere el motor, o el último', () => {
    // 4x6 a 100 completas en doble progresión con tope en 6 → toca subir.
    const last = { squat_barbell: { sets: sets(100, 6, 4) }, bulgarian_split_squat: { sets: sets(20, 7, 3) } };
    const text = sessionToText(template, LIB, t, {
      language: 'es', fmtWeight: (kg) => `${kg}kg`, lastExercise: (ex) => last[ex.exerciseId] ?? null,
    });
    const [, squat, bulg, plank] = text.split('\n');
    expect(squat).toMatch(/^Sentadilla con barra · 4x6 · 10\d(\.5)?kg:$/);
    expect(squat).not.toBe('Sentadilla con barra · 4x6 · 100kg:');
    // Se quedó corto (7 de 10): el motor pide bajar, y eso es lo que sale.
    expect(bulg).toMatch(/^Sentadilla búlgara · 3x10 c\/p · 1\d(\.5)?kg:$/);
    // Sin historial ni peso, la línea no cambia.
    expect(plank).toBe(`${LIB.plank.name} · 3x40s:`);
  });

  it('una sesión libre sin letra titula solo con el nombre', () => {
    const text = sessionToText({ name: 'Brazos', exercises: [] }, LIB, t, { language: 'es' });
    expect(text.split('\n')[0]).toBe('Brazos');
  });

  // Lo que hace fiable la C22: el nombre de cada línea, cortado en el primer
  // ` · `, encuentra SU ejercicio y ningún otro. Para toda la biblioteca y en
  // los dos idiomas.
  it.each([['es', 'name', es], ['en', 'nameEn', en]])('ida y vuelta de nombres (%s)', (language, field, dict) => {
    const norm  = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
    const index = new Map();
    for (const [id, def] of Object.entries(LIB)) {
      const k = norm(def[field] ?? def.name);
      index.set(k, [...(index.get(k) ?? []), id]);
    }
    const ids  = Object.keys(LIB);
    const text = sessionToText(
      { exercises: ids.map((exerciseId) => ({ exerciseId, sets: 3 })) },
      LIB, makeT(dict), { language },
    );
    const back = text.split('\n').filter((l) => l.endsWith(':')).map((l) => index.get(norm(l.split(SEP)[0])));
    expect(back).toEqual(ids.map((id) => [id]));
  });
});
