import { describe, it, expect } from 'vitest';
import { sessionToText, SEP, parseSessionText, readAnswer, parseRx, exerciseIndex } from './sessionText';
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
    // Una sin nombre propio se llama «Sesión A»: no sale dos veces.
    expect(sessionToText({ label: 'A', name: 'Sesión A', exercises: [] }, LIB, t, { language: 'es' })
      .split('\n')[0]).toBe('Sesión A');
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

describe('readAnswer (§6.2)', () => {
  const rx = { sets: 4, reps: 6 };
  const w  = (list) => list?.map((s) => [s.weight, s.reps, s.time, s.rpe]);

  it('vacío es que no lo hizo; «ok» es la receta con el peso del texto', () => {
    expect(readAnswer('', rx, 100)).toBeNull();
    expect(readAnswer('  ', rx, 100)).toBeNull();
    expect(w(readAnswer('ok', rx, 102.5))).toEqual(Array(4).fill([102.5, 6, '', '']));
    // Con un rango, «ok» es el de abajo: lo seguro (QA 28-sep, «¿12 o 15?»).
    expect(w(readAnswer('OK', parseRx('3x12-15'), 4))).toEqual(Array(3).fill([4, 12, '', '']));
    // «ok» sin receta (texto a mano) no dice nada.
    expect(readAnswer('ok', null)).toBeNull();
  });

  it('un número: ese peso en todas las series, con las reps de la receta', () => {
    expect(w(readAnswer('105', rx, 100))).toEqual(Array(4).fill([105, 6, '', '']));
    expect(w(readAnswer('105kg', rx))).toEqual(Array(4).fill([105, 6, '', '']));
  });

  it('una lista: una serie por elemento, AxB es peso × reps', () => {
    expect(w(readAnswer('100x6 100x6 95x5', rx))).toEqual([[100, 6, '', ''], [100, 6, '', ''], [95, 5, '', '']]);
    expect(w(readAnswer('100 x 6, 100 x 6', rx))).toEqual([[100, 6, '', ''], [100, 6, '', '']]);
    expect(w(readAnswer('100 100 95', rx))).toEqual([[100, 6, '', ''], [100, 6, '', ''], [95, 6, '', '']]);
    expect(w(readAnswer('100 100 95, la última me costó', rx)).length).toBe(3);
  });

  it('NxR suelto son series × reps; NxRxW y NxR W llevan peso', () => {
    expect(w(readAnswer('3x10', null))).toEqual(Array(3).fill(['', 10, '', '']));
    expect(w(readAnswer('4x6 100', null))).toEqual(Array(4).fill([100, 6, '', '']));
    expect(w(readAnswer('4x6x100', null))).toEqual(Array(4).fill([100, 6, '', '']));
    expect(w(readAnswer('4x6 @100kg', null))).toEqual(Array(4).fill([100, 6, '', '']));
    // Con más de 10 delante ya es un peso, en todas las series de la receta.
    expect(w(readAnswer('100x6', rx))).toEqual(Array(4).fill([100, 6, '', '']));
  });

  it('la coma solo separa con espacio: 102,5 es decimal', () => {
    expect(w(readAnswer('102,5', rx))).toEqual(Array(4).fill([102.5, 6, '', '']));
    expect(w(readAnswer('100, 95', rx))).toEqual([[100, 6, '', ''], [95, 6, '', '']]);
  });

  it('RPE: pegado a una serie es de esa serie; al final de la línea, de todas', () => {
    expect(w(readAnswer('100x6@8 100x6 @8 95x5@9', rx)).map((s) => s[3])).toEqual(['8', '8', '9']);
    expect(w(readAnswer('4x6 100 @8', null))).toEqual(Array(4).fill([100, 6, '', '8']));
    expect(w(readAnswer('100 100 @7.5', rx)).map((s) => s[3])).toEqual(['7.5', '7.5']);
  });

  it('tiempo: con receta de tiempo los números son segundos', () => {
    const rxT = { sets: 3, time: 40 };
    expect(w(readAnswer('ok', rxT))).toEqual(Array(3).fill(['', '', 40, '']));
    expect(w(readAnswer('40 35 30', rxT))).toEqual([['', '', 40, ''], ['', '', 35, ''], ['', '', 30, '']]);
    expect(w(readAnswer("1' 45s", rxT))).toEqual([['', '', 60, ''], ['', '', 45, '']]);
  });
});

describe('parseRx', () => {
  it('lee las recetas que escribe sessionToText', () => {
    expect(parseRx('4x6')).toEqual({ sets: 4, reps: 6 });
    expect(parseRx('3x8-12')).toEqual({ sets: 3, reps: 8 });
    expect(parseRx('3x10 c/p')).toEqual({ sets: 3, reps: 10 });
    expect(parseRx('3x40s')).toEqual({ sets: 3, time: 40 });
    expect(parseRx('3x20-40s')).toEqual({ sets: 3, time: 20 });
    expect(parseRx('3 series')).toEqual({ sets: 3 });
    expect(parseRx('102.5kg')).toBeNull();
  });
});

// Textos reales (§6.1): cada uno que salió mal entra aquí tal cual.
describe('textos reales', () => {
  it('QA 28-sep: «16kgx11», segundos con rango, vacío y «ok» con rango', () => {
    const { header, lines } = parseSessionText([
      'Sesión A · Sesión A',
      'Aperturas con mancuernas · 3x12-15 · 7kg:15x12 16kgx11 16x11',
      'Back lever · 3x3-15s: 12 13',
      'Burpee · 3 series · 4.5kg:',
      'Abducción en máquina · 3x12-15 · 4kg: ok',
      '',
      es.sessionText.howTo,
    ].join('\n'));
    expect(header).toEqual(['Sesión A', 'Sesión A']);
    const read = lines.filter((l) => !l.ignored).map((l) => readAnswer(l.answer, l.rx, l.hint)
      ?.map((s) => [s.weight, s.reps, s.time]) ?? null);
    expect(read).toEqual([
      // «16kgx11» era una serie perdida: `\b` no separa «kg» de «x».
      [[15, 12, ''], [16, 11, ''], [16, 11, '']],
      // Un ejercicio de segundos con rango: son segundos, no pesos.
      [['', '', 12], ['', '', 13]],
      null,
      Array(3).fill([4, 12, '']),
    ]);
  });
});

describe('parseSessionText', () => {
  it('cabecera, líneas nuestras, a mano, notas e instrucciones', () => {
    const { header, lines } = parseSessionText([
      '*Ana García · Sesión C · Pierna fuerza*',
      'Sentadilla con barra · 4x6 · 102.5kg: 105',
      'Sentadilla búlgara · 3x10 c/p:',
      "AMRAP 12' · 10 Burpee: 5+3",
      'press banca 80 80 75',
      'me costó mucho hoy',
      '',
      es.sessionText.howTo,
    ].join('\n'));
    expect(header).toEqual(['Ana García', 'Sesión C', 'Pierna fuerza']);
    expect(lines.map((l) => (l.ignored ? null : [l.name, l.answer]))).toEqual([
      ['Sentadilla con barra', '105'],
      ['Sentadilla búlgara', ''],
      ["AMRAP 12'", '5+3'],
      ['press banca', '80 80 75'],
      null,
      null,
    ]);
    expect(lines[0]).toMatchObject({ rx: { sets: 4, reps: 6 }, hint: 102.5, block: false });
    expect(lines[2].block).toBe(true);
  });

  it('un for time se contesta con «12:30»: parte por el primer «:»', () => {
    const { lines } = parseSessionText('For time 3 rondas · 10 Burpee: 12:30');
    expect(lines[0]).toMatchObject({ block: true, answer: '12:30' });
  });

  it('sin cabecera: la primera línea con números ya es un ejercicio', () => {
    const { header, lines } = parseSessionText('sentadilla 100 100 95\nbanca 60x8, 60x8');
    expect(header).toBeNull();
    expect(lines.map((l) => l.name)).toEqual(['sentadilla', 'banca']);
  });
});

describe('ida y vuelta completa', () => {
  it('lo que sale de sessionToText, con «ok» detrás, se lee entero y cada línea da su ejercicio', () => {
    const template = {
      label: 'C', name: 'Pierna fuerza',
      exercises: [
        { exerciseId: 'squat_barbell', sets: 4, minReps: 6, maxReps: 6 },
        { exerciseId: 'bulgarian_split_squat', sets: 3, minReps: 10, maxReps: 10 },
        { exerciseId: 'plank', sets: 3, inputType: 'time', minTime: 40, maxTime: 40, progressionModel: 'time_progression' },
      ],
    };
    const last = { squat_barbell: { sets: sets(100, 6, 4) } };
    const text = sessionToText(template, LIB, t, {
      language: 'es', clientName: 'Ana García', lastExercise: (ex) => last[ex.exerciseId] ?? null,
    }).split('\n').map((l) => (l.endsWith(':') ? `${l} ok` : l)).join('\n');

    const { header, lines } = parseSessionText(text);
    expect(header).toEqual(['Ana García', 'Sesión C', 'Pierna fuerza']);
    const find = exerciseIndex(LIB, {}, template.exercises.map((e) => e.exerciseId));
    const read = lines.filter((l) => !l.ignored);
    expect(read.map((l) => find(l.name))).toEqual(['squat_barbell', 'bulgarian_split_squat', 'plank']);
    expect(read.map((l) => readAnswer(l.answer, l.rx, l.hint).length)).toEqual([4, 3, 3]);
    expect(readAnswer(read[0].answer, read[0].rx, read[0].hint)[0]).toMatchObject({ reps: 6 });
    expect(read[0].hint).toBeGreaterThan(100);
    expect(lines.filter((l) => l.ignored)).toHaveLength(1); // las instrucciones
  });

  it('los alias del entrenador resuelven lo escrito a mano', () => {
    const find = exerciseIndex(LIB, { banca: 'squat_barbell', fantasma: 'no_existe' });
    expect(find('Banca')).toBe('squat_barbell');
    expect(find('fantasma')).toBeNull();
    expect(find('SENTADILLA CON BARRA')).toBe('squat_barbell');
  });
});
