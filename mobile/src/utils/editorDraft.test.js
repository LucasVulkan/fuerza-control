import { describe, it, expect } from 'vitest';
import { makeEditorDraft, restoreEditorDraft, selectEditorDirty } from './editorDraft';

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
