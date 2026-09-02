import { describe, it, expect } from 'vitest';
import { autoLinkRepeated } from './exerciseLinks';
import { adaptArchetype } from './archetypeAdapter';
import { ARCHETYPES } from '../data/archetypes';

let n = 0;
const makeId = () => `lnk_${++n}`;
const ex = (exerciseId, over = {}) => ({
  exerciseId, isKey: true, sets: 4, minReps: 6, maxReps: 8, restSec: 120, ...over,
});
const tpl = (id, exercises) => ({ id, exercises });

const groupOf = (templates, tplIdx, exId) =>
  templates[tplIdx].exercises.find((e) => e.exerciseId === exId)?.linkGroup;

describe('autoLinkRepeated', () => {
  it('vincula el mismo ejercicio en dos sesiones cuando la prescripción coincide', () => {
    const out = autoLinkRepeated([
      tpl('a', [ex('squat_barbell')]),
      tpl('b', [ex('squat_barbell')]),
    ], makeId);

    expect(groupOf(out, 0, 'squat_barbell')).toBeTruthy();
    expect(groupOf(out, 0, 'squat_barbell')).toBe(groupOf(out, 1, 'squat_barbell'));
  });

  it('no los vincula si la programación difiere — objetivos distintos', () => {
    const out = autoLinkRepeated([
      tpl('a', [ex('squat_barbell', { sets: 5, minReps: 5, maxReps: 5 })]),
      tpl('b', [ex('squat_barbell', { sets: 3, minReps: 10, maxReps: 12 })]),
    ], makeId);

    expect(groupOf(out, 0, 'squat_barbell')).toBeUndefined();
    expect(groupOf(out, 1, 'squat_barbell')).toBeUndefined();
  });

  it('principal en un día y accesorio en otro no comparten grupo', () => {
    const out = autoLinkRepeated([
      tpl('a', [ex('cable_row', { isKey: true })]),
      tpl('b', [ex('cable_row', { isKey: false })]),
    ], makeId);

    expect(groupOf(out, 0, 'cable_row')).toBeUndefined();
  });

  it('una diferencia de series por el recorte deja las instancias sueltas', () => {
    const out = autoLinkRepeated([
      tpl('a', [ex('leg_extension', { isKey: false, sets: 3 })]),
      tpl('b', [ex('leg_extension', { isKey: false, sets: 2 })]),
    ], makeId);

    expect(groupOf(out, 0, 'leg_extension')).toBeUndefined();
  });

  it('un ejercicio que sólo aparece una vez no se vincula', () => {
    const out = autoLinkRepeated([tpl('a', [ex('squat_barbell')]), tpl('b', [ex('hack_squat')])], makeId);
    expect(groupOf(out, 0, 'squat_barbell')).toBeUndefined();
  });

  it('no toca lo que ya estaba vinculado a mano', () => {
    const manual = { ...ex('squat_barbell'), linkGroup: 'lnk_manual' };
    const out = autoLinkRepeated([tpl('a', [manual]), tpl('b', [ex('squat_barbell')])], makeId);
    expect(groupOf(out, 0, 'squat_barbell')).toBe('lnk_manual');
    expect(groupOf(out, 1, 'squat_barbell')).toBeUndefined();
  });

  it('sin nada que vincular devuelve los mismos objetos', () => {
    const input = [tpl('a', [ex('squat_barbell')])];
    expect(autoLinkRepeated(input, makeId)).toBe(input);
  });

  it('cada ejercicio repetido tiene su propio grupo', () => {
    const out = autoLinkRepeated([
      tpl('a', [ex('squat_barbell'), ex('bench_press_barbell')]),
      tpl('b', [ex('squat_barbell'), ex('bench_press_barbell')]),
    ], makeId);

    expect(groupOf(out, 0, 'squat_barbell')).not.toBe(groupOf(out, 0, 'bench_press_barbell'));
  });
});

describe('integración — la plantilla de fuerza repite sus básicos', () => {
  it('sus keys repetidos entre sesiones salen vinculados', () => {
    const { sessionTemplates } = adaptArchetype(
      ARCHETYPES.find((a) => a.id === 'fullbody_strength_advanced'),
      {
        level: 'advanced', discipline: 'strength', goal: 'strength', daysPerWeek: 3,
        equipment: ['barbell', 'dumbbells', 'machines', 'cables', 'pullup_bar'],
        limitations: ['none'], sessionMinutes: 90,
      },
    );

    const all = Object.values(sessionTemplates).flatMap((t) => t.exercises);
    const linked = all.filter((e) => e.linkGroup);
    expect(linked.length).toBeGreaterThan(0);

    // Todo grupo tiene al menos dos miembros y todos son el mismo ejercicio.
    const byGroup = new Map();
    linked.forEach((e) => byGroup.set(e.linkGroup, [...(byGroup.get(e.linkGroup) ?? []), e]));
    byGroup.forEach((members) => {
      expect(members.length).toBeGreaterThanOrEqual(2);
      expect(new Set(members.map((m) => m.exerciseId)).size).toBe(1);
      expect(new Set(members.map((m) => m.sets)).size).toBe(1);
    });
  });
});
