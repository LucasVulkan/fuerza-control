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
  it('con carga: Peso · Reps · Nada; en tiempo: Tiempo · Nada', () => {
    expect(upOptions(ctx())).toEqual(['weight', 'reps', 'none']);
    expect(upOptions(ctx({ metric: 'time' }))).toEqual(['time', 'none']);
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
    const f = patchProgForm({ ...init(), up: 'weight' }, {}, ctx({ metric: 'time' }));
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
  it('plancha guardada como Doble se abre como Tiempo, con su salto', () => {
    const c = ctx({ metric: 'time' });
    expect(init({ minTime: 30, maxTime: 60, progression: { type: 'double' } }, c)).toMatchObject({ up: 'time', incValue: 5 });
  });
});
