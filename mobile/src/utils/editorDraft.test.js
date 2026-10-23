import { describe, it, expect } from 'vitest';
import { makeEditorDraft, restoreEditorDraft, selectEditorDirty, templateEdited, rowEdited } from './editorDraft';

const tpl = (id, programId, extra = {}) => ({ id, programId, name: id, exercises: [{ exerciseId: 'sq', sets: 3 }], ...extra });

function base() {
  return {
    programs: { p1: { id: 'p1', name: 'Fuerza' }, p2: { id: 'p2', name: 'Otro' } },
    sessionTemplates: { a: tpl('a', 'p1'), b: tpl('b', 'p1'), z: tpl('z', 'p2'), free: tpl('free', null) },
    ui: {},
  };
}
const withDraft = (s, kind, id) => ({ ...s, ui: { _editorDraft: makeEditorDraft(s, kind, id) } });

describe('borrador del editor (P16-01)', () => {
  it('sin tocar nada no hay cambios', () => {
    expect(selectEditorDirty(withDraft(base(), 'program', 'p1'))).toBe(false);
    expect(selectEditorDirty(base())).toBe(false); // sin copia
  });

  it('descartar devuelve programa y sesiones: lo creado se va y lo borrado vuelve', () => {
    const s0 = withDraft(base(), 'program', 'p1');
    const rest = { ...s0.sessionTemplates };
    delete rest.b;
    const s1 = {
      ...s0,
      programs: { ...s0.programs, p1: { ...s0.programs.p1, name: 'Cambiado' } },
      sessionTemplates: { ...rest, a: { ...rest.a, exercises: [] }, c: tpl('c', 'p1') },
    };
    expect(selectEditorDirty(s1)).toBe(true);
    const back = { ...s1, ...restoreEditorDraft(s1, s1.ui._editorDraft) };
    expect(back.programs.p1.name).toBe('Fuerza');
    expect(Object.keys(back.sessionTemplates).sort()).toEqual(['a', 'b', 'free', 'z']);
    expect(back.sessionTemplates.a.exercises).toHaveLength(1);
    expect(back.programs.p2).toBe(s1.programs.p2); // otros programas, intactos
    expect(selectEditorDirty({ ...back, ui: s1.ui })).toBe(false);
  });

  it('una plantilla suelta solo toca esa plantilla', () => {
    const s0 = withDraft(base(), 'template', 'free');
    const s1 = { ...s0, sessionTemplates: { ...s0.sessionTemplates, free: { ...s0.sessionTemplates.free, name: 'x' }, a: tpl('a', 'p1', { name: 'ajena' }) } };
    const back = { ...s1, ...restoreEditorDraft(s1, s1.ui._editorDraft) };
    expect(back.sessionTemplates.free.name).toBe('free');
    expect(back.sessionTemplates.a.name).toBe('ajena');
    expect(back.programs).toBe(s1.programs);
  });
});

describe('marcas «editada» (P16-05)', () => {
  const d = makeEditorDraft(base(), 'program', 'p1');
  const a = d.snapshot.templates.a;

  it('sin borrador no hay marcas', () => {
    expect(templateEdited(null, 'a', a)).toBe(false);
    expect(rowEdited(null, 'a', a.exercises[0])).toBe(false);
  });

  it('igual que la copia no marca; tocado o nuevo, sí', () => {
    expect(templateEdited(d, 'a', a)).toBe(false);
    expect(templateEdited(d, 'a', { ...a, name: 'x' })).toBe(true);
    expect(templateEdited(d, 'nueva', tpl('nueva', 'p1'))).toBe(true);
    expect(rowEdited(d, 'a', a.exercises[0])).toBe(false);
    expect(rowEdited(d, 'a', { ...a.exercises[0], sets: 4 })).toBe(true);
    expect(rowEdited(d, 'a', { exerciseId: 'dl', sets: 3 })).toBe(true);
    expect(rowEdited(d, 'a', { id: 'blk', format: 'amrap' })).toBe(true);
  });

  it('mover una fila (order) no la marca', () => {
    expect(rowEdited(d, 'a', { ...a.exercises[0], order: 5 })).toBe(false);
  });
});

describe('borrar con Deshacer (P16-07)', () => {
  it('deshacer un borrado deja el estado y el borrador como antes', () => {
    const s0 = withDraft(base(), 'program', 'p1');
    const undo = makeEditorDraft(s0, 'program', 'p1'); // la copia que toma deleteWithUndo
    const rest = { ...s0.sessionTemplates };
    delete rest.b;
    const s1 = { ...s0, sessionTemplates: rest };
    expect(selectEditorDirty(s1)).toBe(true);
    const back = { ...s1, ...restoreEditorDraft(s1, undo) };
    expect(back.sessionTemplates).toEqual(s0.sessionTemplates);
    expect(selectEditorDirty(back)).toBe(false);
  });

  it('un ejercicio quitado vuelve en su sitio con su configuración', () => {
    const s0 = base();
    s0.sessionTemplates.a.exercises = [{ exerciseId: 'sq', sets: 3 }, { exerciseId: 'bp', sets: 5 }];
    const undo = makeEditorDraft(s0, 'template', 'a');
    const s1 = { ...s0, sessionTemplates: { ...s0.sessionTemplates, a: { ...s0.sessionTemplates.a, exercises: [{ exerciseId: 'bp', sets: 5 }] } } };
    const back = { ...s1, ...restoreEditorDraft(s1, undo) };
    expect(back.sessionTemplates.a.exercises).toEqual(s0.sessionTemplates.a.exercises);
    expect(back.sessionTemplates.b).toBe(s1.sessionTemplates.b);
  });
});
