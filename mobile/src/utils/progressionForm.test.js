import { describe, it, expect } from 'vitest';
import {
  upOptions, showHow, needsRpe, minFails, normalizeProgForm, patchProgForm, initProgForm, buildProgression, defaultFails,
} from './progressionForm';
import { resolveProgressionConfig } from './progression';
import { EXERCISE_LIBRARY as LIB } from '../data/exerciseLibrary';

const BB = { equipment: ['barbell'] };
const ctx = (over = {}) => ({ def: BB, sets: 3, metric: 'reps', range: true, ...over });
const init = (exConfig = {}, c = ctx()) => initProgForm({ sets: c.sets, ...exConfig }, c.def, c);

describe('P55 — qué se ofrece en Qué sube (§5.3)', () => {
  it('con carga: Peso · Reps · Nada; en tiempo: Tiempo · Peso · Nada (P61)', () => {
    expect(upOptions(ctx())).toEqual(['weight', 'reps', 'none']);
    expect(upOptions(ctx({ metric: 'time' }))).toEqual(['time', 'weight', 'none']);
  });
  it('todo se puede lastrar: Peso también en dominadas supinas (QA P55.5)', () => {
    expect(upOptions(ctx({ def: LIB.pull_up_supine }))).toEqual(['weight', 'reps', 'none']);
    expect(upOptions(ctx({ def: LIB.pull_up }))).toContain('weight');
    expect(upOptions(ctx({ def: LIB.pull_up_assisted }))).toContain('weight');
  });
  it('Cómo solo con Peso, medida Reps, carga externa y sin asistir', () => {
    const f = { up: 'weight' };
    expect(showHow(f, ctx())).toBe(true);
    expect(showHow(f, ctx({ def: LIB.pull_up }))).toBe(false);
    expect(showHow(f, ctx({ def: LIB.pull_up_assisted }))).toBe(false);
    expect(showHow(f, ctx({ metric: 'time' }))).toBe(false);
    expect(showHow({ up: 'reps' }, ctx())).toBe(false);
  });
});

describe('P55 — coherencia (normalize)', () => {
  it('Por esfuerzo con Rango vuelve a Por reglas; con Reps fijas se queda', () => {
    const f = { ...init(), how: 'effort' };
    expect(normalizeProgForm(f, ctx({ range: true })).how).toBe('rules');
    expect(normalizeProgForm(f, ctx({ range: false })).how).toBe('effort');
  });
  it('Parcial 2 de 3: bajar no baja de 2; con Parcial 1 de 3, no de 3', () => {
    expect(minFails({ when: 'part', need: 2 }, { sets: 3 })).toBe(2);
    expect(minFails({ when: 'part', need: 1 }, { sets: 3 })).toBe(3);
    expect(minFails({ when: 'all_complete', need: 2 }, { sets: 3 })).toBe(1);
    const f = normalizeProgForm({ ...init(), when: 'part', need: 1, fails: 1 }, ctx());
    expect(f.fails).toBe(3);
  });
  it('need y fails se recortan al cambiar las series', () => {
    const f = normalizeProgForm({ ...init(), when: 'part', need: 4, fails: 5 }, ctx({ sets: 3 }));
    expect(f.need).toBe(2);
    expect(f.fails).toBe(3);
  });
  it('Parcial no existe con una sola serie', () => {
    expect(normalizeProgForm({ ...init(), when: 'part' }, ctx({ sets: 1 })).when).toBe('all_complete');
  });
  it('lo que sube deja de valer → el primero válido, con su salto por defecto', () => {
    const f = patchProgForm({ ...init(), up: 'reps' }, {}, ctx({ metric: 'time' }));
    expect(f).toMatchObject({ up: 'time', incType: 'fixed', incValue: 5 });
    const g = patchProgForm({ ...init(), up: 'weight' }, { up: 'reps' }, ctx());
    expect(g).toMatchObject({ up: 'reps', incValue: 1 });
  });
  it('un salto sin tocar Qué sube se conserva', () => {
    expect(patchProgForm({ ...init(), incValue: 5 }, { when: 'rpe' }, ctx()).incValue).toBe(5);
  });
});

describe('P55 — Registrar RPE bloqueado (§5.4)', () => {
  it('lo pide Por esfuerzo y Cuándo sube = RPE máx.', () => {
    expect(needsRpe({ ...init(), how: 'effort' }, ctx({ range: false }))).toBe(true);
    expect(needsRpe({ ...init(), when: 'rpe' }, ctx())).toBe(true);
    expect(needsRpe({ ...init(), when: 'all_complete' }, ctx())).toBe(false);
  });
  it('Nada no lo pide aunque quede un RPE máx. guardado', () => {
    expect(needsRpe({ ...init(), up: 'none', when: 'rpe' }, ctx())).toBe(false);
  });
});

describe('P55 — leer y guardar (§5.5)', () => {
  const press = { sets: 3, minReps: 8, maxReps: 12, progression: { type: 'double', increment: { type: 'fixed', value: 2.5 } } };

  it('lo que se guarda se lee igual', () => {
    const c = ctx();
    const f = { ...init(press, c), when: 'part', need: 2, down: 'fail', fails: 2, incValue: 5 };
    const { progression, weightStep } = buildProgression(f, c);
    expect(weightStep).toBeNull();
    const back = initProgForm({ sets: 3, progression }, c.def, c);
    expect(back).toMatchObject({ up: 'weight', how: 'rules', when: 'part', need: 2, down: 'fail', fails: 2, incValue: 5 });
    expect(resolveProgressionConfig({ sets: 3, progression }, c.def).evaluation).toMatchObject({ mode: 'part', need: 2 });
  });
  it('Peso por reglas guarda double con down explícito; Nunca → never', () => {
    const c = ctx();
    expect(buildProgression({ ...init(press, c), down: 'never' }, c).progression).toMatchObject({ type: 'double', down: 'never' });
    expect(buildProgression({ ...init(press, c), fails: 2 }, c).progression.down).toEqual({ fails: 2 });
  });
  it('el defecto de fails es lo de hoy: 2 de 3, 2 de 4, 3 de 5', () => {
    expect([3, 4, 5].map(defaultFails)).toEqual([2, 2, 3]);
    expect(init(press).fails).toBe(2);
  });
  it('Reps y Tiempo no guardan down; Nada guarda none', () => {
    const c = ctx();
    expect(buildProgression({ ...init(press, c), up: 'reps' }, c).progression).not.toHaveProperty('down');
    expect(buildProgression({ ...init(press, c), up: 'none' }, c).progression.type).toBe('none');
    expect(buildProgression({ ...init(press, c), up: 'time' }, ctx({ metric: 'time' })).progressionModel).toBe('time_progression');
  });
  it('Por esfuerzo guarda targetRpe y effortWhen; Exacto fuerza beat y weightStep exact', () => {
    const c = ctx({ range: false });
    const f = { ...init(press, c), how: 'effort', targetRpe: 8, effWhen: 'reach' };
    expect(buildProgression(f, c).progression).toMatchObject({ type: 'effort', targetRpe: 8, effortWhen: 'reach' });
    const ex = buildProgression({ ...f, exact: true }, c);
    expect(ex.weightStep).toBe('exact');
    expect(ex.progression.effortWhen).toBe('beat');
    expect(initProgForm({ sets: 3, weightStep: 'exact', progression: ex.progression }, c.def, c).exact).toBe(true);
  });
  it('weightStep solo si difiere del que se resuelve sin él', () => {
    const c = ctx({ def: { ...BB, weightStep: 5 } });
    expect(buildProgression({ ...init(press, c), step: 5 }, c).weightStep).toBeNull();
    expect(buildProgression({ ...init(press, c), step: 1.25 }, c).weightStep).toBe(1.25);
    // en Por esfuerzo el escalón de la librería tiene tope 2,5
    const e = ctx({ def: { ...BB, weightStep: 5 }, range: false });
    const f = { ...init(press, e), how: 'effort' };
    expect(buildProgression({ ...f, step: 2.5 }, e).weightStep).toBeNull();
    expect(buildProgression({ ...f, step: 5 }, e).weightStep).toBe(5);
  });
  it('un escalón guardado se lee de vuelta', () => {
    expect(init({ ...press, weightStep: 1.25 }).step).toBe(1.25);
    expect(init(press).step).toBeNull();
  });
  it('Tiempo + Peso (P61): una plancha guardada como Doble se abre como Peso, sin Cómo, y se guarda como double', () => {
    const c = ctx({ metric: 'time' });
    const f = init({ minTime: 30, maxTime: 60, progression: { type: 'double' } }, c);
    expect(f).toMatchObject({ up: 'weight', how: 'rules', incValue: 2.5 });
    expect(showHow(f, c)).toBe(false);
    expect(buildProgression(f, c)).toMatchObject({ progression: { type: 'double', down: { fails: 2 } }, progressionModel: 'double_progression' });
  });
  it('plancha de la librería (modelo de tiempo) se abre como Tiempo, con su salto', () => {
    const c = ctx({ metric: 'time', def: LIB.plank });
    expect(init({ minTime: 30, maxTime: 60 }, c)).toMatchObject({ up: 'time', incValue: 5 });
  });
});

describe('I01-01 — huecos de mutación', () => {
  const press = { sets: 3, minReps: 8, maxReps: 12, progression: { type: 'double', increment: { type: 'fixed', value: 2.5 } } };

  // P12 §5.5 y casilla P12-04 «Guardar, salir y volver a entrar: la hoja recupera todo lo elegido»
  // mata progressionForm.js:103:15, 103:26, 103:35, 103:45, 103:56 (up de Nada y de Reps)
  it('una progresión guardada como Nada o como Reps se abre igual', () => {
    expect(init({ progression: { type: 'none' } }).up).toBe('none');
    expect(init({ progression: { type: 'reps' } }).up).toBe('reps');
  });

  // P12 §5.5 y casilla P12-04: la hoja recupera Por esfuerzo
  // mata progressionForm.js:104:15, 104:26, 104:37 (how de Por esfuerzo)
  it('una progresión guardada como Por esfuerzo se abre como Peso · Por esfuerzo', () => {
    const f = init({ progression: { type: 'effort' } }, ctx({ range: false }));
    expect(f.up).toBe('weight');
    expect(f.how).toBe('effort');
    // y una Doble guardada con Reps fijas sigue abriéndose Por reglas
    expect(init({ progression: { type: 'double' } }, ctx({ range: false })).how).toBe('rules');
  });

  // P12 §5.5 y casilla P12-04: la hoja recupera «Nunca» en Cuándo baja
  // mata progressionForm.js:111:15, 111:26, 111:36 (down de Nunca)
  it('una progresión guardada con down never se abre como Nunca', () => {
    expect(init({ progression: { type: 'double', down: 'never' } }).down).toBe('never');
  });

  // P12 §5.3 «Cuánto sube»: en Peso, Fijo o Porcentaje (se conserva el %)
  // mata progressionForm.js:75:7, 75:16, 75:38 (`n.up !== 'weight'` en el guardado a 'fixed')
  it('el Porcentaje guardado en Peso se conserva al abrir', () => {
    expect(init({ progression: { type: 'double', increment: { type: 'pct', pct: 5 } } }).incType).toBe('pct');
  });

  // P12 §5.3 «Cuánto sube»: Reps: entero; Tiempo: entero en pasos de 5 s (no hay porcentaje)
  // mata progressionForm.js:75:7, 75:16, 75:38 (`n.up !== 'weight'` en el guardado a 'fixed')
  it('en Reps el salto no puede ser un porcentaje: vuelve a Fijo', () => {
    expect(normalizeProgForm({ ...init(), up: 'reps', incType: 'pct' }, ctx()).incType).toBe('fixed');
  });

  // P12 §4.1 («salto por defecto de Peso = escalón resuelto») y §3.1.12 («el escalón es por ejercicio»)
  // mata progressionForm.js:92:7 (`next.step ?? libraryStep(...)` → `&&`)
  it('al pasar a Peso el salto por defecto es el escalón propio del ejercicio', () => {
    const f = patchProgForm({ ...init(), up: 'reps', step: 1.25 }, { up: 'weight' }, ctx());
    expect(f.incValue).toBe(1.25);
  });

  // P12 §4.4: el tope de 2,5 del escalón de la librería es solo de Por esfuerzo
  // mata progressionForm.js:92:41 (`libraryStep(ctx.def, false)` → `true`)
  it('al pasar a Peso sin escalón propio el salto es el escalón de la librería, sin tope', () => {
    const c = ctx({ def: { ...BB, weightStep: 5 } });
    const f = patchProgForm({ ...init({}, c), up: 'reps', step: null }, { up: 'weight' }, c);
    expect(f.incValue).toBe(5);
  });

  // P12 §5.3, tabla: «Cómo… carga externa, no asistido» (una asistida con máquina tampoco)
  // mata progressionForm.js:29:18, 29:27 y 29:57 (`isAssist`)
  it('Cómo no se ofrece a una asistida aunque tenga carga externa', () => {
    const asistida = { equipment: ['machines'], progressionDirection: 'decrease' };
    expect(showHow({ up: 'weight' }, { def: asistida, metric: 'reps' })).toBe(false);
  });

  // P12 §5.3: «Parcial: de 1 a M−1» (solo Parcial necesita al menos 2 series)
  // mata progressionForm.js:77:7 (`n.when === 'part'` → true)
  it('con una sola serie, Cuándo sube = RPE máx. se queda como está', () => {
    expect(normalizeProgForm({ ...init(), when: 'rpe' }, ctx({ sets: 1 })).when).toBe('rpe');
  });

  // P12 §5.3: «Parcial: de 1 a M−1» (con M = 2, 1 de 2 es válido)
  // mata progressionForm.js:77:28 (`ctx.sets < 2` → `<= 2`)
  it('Parcial con 2 series se queda en Parcial 1 de 2', () => {
    const f = normalizeProgForm({ ...init(), when: 'part' }, ctx({ sets: 2 }));
    expect(f.when).toBe('part');
    expect(f.need).toBe(1);
  });

  // P12 §5.5: «`targetRpe` + `effortWhen` en Por esfuerzo» (solo ahí)
  // mata progressionForm.js:134:7 (`if (effort)` → true)
  it('Peso por reglas no guarda targetRpe ni effortWhen', () => {
    const { progression } = buildProgression(init(press), ctx());
    expect(progression).not.toHaveProperty('targetRpe');
    expect(progression).not.toHaveProperty('effortWhen');
  });
});
