import { describe, it, expect } from 'vitest';
import { activeSessionSummary, activeSessionLine } from './activeSession';

const t = (k, p) => (p ? `${k}:${JSON.stringify(p)}` : k);
const done = [{ done: true }], open = [{ done: false }];

describe('activeSessionSummary', () => {
  it('sin sesión a medias, null', () => {
    expect(activeSessionSummary({ activeSession: { templateId: null } }, t)).toBeNull();
  });

  it('del programa: letra y nombre, y cuenta los ejercicios hechos', () => {
    const s = activeSessionSummary({
      activeSession:    { templateId: 'c', setsState: { x: done, y: open } },
      sessionTemplates: { c: { programId: 'p', label: 'C', name: 'Empuje', exercises: [{ exerciseId: 'x' }, { exerciseId: 'y' }] } },
    }, t);
    expect(s).toEqual({ name: 'C · Empuje', done: 1, total: 2, client: null });
  });

  it('sobre la marcha: su nombre o «Sesión libre», y cuenta los sueltos', () => {
    const s = activeSessionSummary({
      activeSession: { templateId: '__free__', freeSessionName: ' ', adHocExercises: [{ setsState: done }] },
    }, t);
    expect(s.name).toBe('freeSession.templateUnnamed');
    expect([s.done, s.total]).toEqual([1, 1]);
  });

  it('libre guardada: su número en la lista de su dueño', () => {
    const s = activeSessionSummary({
      activeSession:    { templateId: 'f2' },
      sessionTemplates: {
        f1: { name: 'Uno' }, tp: { name: 'Plantilla', kind: 'template' },
        x: { name: 'De Ana', owner: 'ana' }, f2: { name: 'Piernas' },
      },
    }, t);
    expect(s.name).toBe('02 · Piernas');
  });

  it('de un cliente: dice de quién, y numera entre las suyas', () => {
    const s = activeSessionSummary({
      activeSession: { templateId: 'f', forClient: 'ana' },
      sessionTemplates: { m: { name: 'Mía' }, f: { name: 'Libre', owner: 'ana' } },
      clients: { ana: { name: 'Ana' } },
    }, t);
    expect([s.name, s.client]).toEqual(['01 · Libre', 'Ana']);
  });

  it('la línea omite la cuenta sin ejercicios', () => {
    expect(activeSessionLine({ name: 'X', done: 0, total: 0 }, t)).toBe('X');
  });
});
