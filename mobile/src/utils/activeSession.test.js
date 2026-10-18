import { describe, it, expect } from 'vitest';
import { activeSessionSummary, activeSessionLine, activeSessionProgress } from './activeSession';

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

describe('activeSessionProgress', () => {
  it('sin sesión a medias, null', () => {
    expect(activeSessionProgress({ activeSession: { templateId: null } })).toBeNull();
  });

  it('cuenta series, ejercicios, volumen y lo que queda', () => {
    const p = activeSessionProgress({
      activeSession: {
        templateId: 'a',
        setsState: {
          x: [{ done: true, weight: '100', reps: '5' }, { done: true, weight: '100', reps: '5' }],
          y: [{ done: true, weight: '', reps: '10' }, { done: false }, { done: false }],
        },
        adHocExercises: [{ exerciseId: 'z', setsState: [{ done: false }] }],
      },
      sessionTemplates: { a: { exercises: [{ exerciseId: 'x' }, { exerciseId: 'y' }] } },
    });
    expect([p.setsDone, p.setsTotal]).toEqual([3, 6]);
    expect([p.exercisesDone, p.exercisesTotal]).toEqual([1, 3]);
    expect(p.volumeKg).toBe(1000);
    expect(p.pending).toEqual([
      { kind: 'ex', id: 'y', done: 1, total: 3 },
      { kind: 'ex', id: 'z', done: 0, total: 1 },
    ]);
    expect(p.allDone).toBe(false);
  });

  it('el dropset sin sus drops no está hecho aunque las series sí', () => {
    const p = activeSessionProgress({
      activeSession:    { templateId: 'a', setsState: { x: [{ done: true, drops: [{ done: false }] }] } },
      sessionTemplates: { a: { exercises: [{ exerciseId: 'x', dropset: true }] } },
    });
    expect(p.setsDone).toBe(p.setsTotal);
    expect(p.allDone).toBe(false);
  });

  it('los bloques cuentan aparte, también los de la sesión libre', () => {
    const p = activeSessionProgress({
      activeSession: {
        templateId: '__free__',
        freeBlocks: [{ id: 'b1' }, { id: 'b2' }],
        blockState: { b1: { finishedAt: 1 } },
      },
    });
    expect([p.blocksDone, p.blocksTotal, p.setsTotal]).toEqual([1, 2, 0]);
    expect(p.pending).toEqual([{ kind: 'block', id: 'b2' }]);
  });

  it('todo hecho', () => {
    const p = activeSessionProgress({
      activeSession:    { templateId: 'a', setsState: { x: [{ done: true }] }, blockState: { b: { finishedAt: 2 } } },
      sessionTemplates: { a: { exercises: [{ exerciseId: 'x' }], blocks: [{ id: 'b' }] } },
    });
    expect(p.allDone).toBe(true);
  });
});
