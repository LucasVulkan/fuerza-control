import { describe, test, expect } from 'vitest';
import { programsOf, templatesOf, assignActiveProgram, deassignProgram } from './programOwnership';

const programs = {
  p_ana_1: { id: 'p_ana_1', name: 'B', owner: 'cli_ana', kind: 'program',  createdAt: '2026-01-01' },
  p_ana_2: { id: 'p_ana_2', name: 'A', owner: 'cli_ana', kind: 'program',  createdAt: '2026-03-01' },
  p_luis:  { id: 'p_luis',  name: 'C', owner: 'cli_luis', kind: 'program', createdAt: '2026-02-01' },
  p_mio:   { id: 'p_mio',   name: 'D', owner: 'me',      kind: 'program',  createdAt: '2026-02-01' },
  t_mia:   { id: 't_mia',   name: 'Z', owner: 'me',      kind: 'template', createdAt: '2026-04-01' },
};

describe('programsOf', () => {
  test('los de ese dueño, los más nuevos primero', () => {
    expect(programsOf(programs, 'cli_ana').map((p) => p.id)).toEqual(['p_ana_2', 'p_ana_1']);
  });

  test('las plantillas no son programas de nadie', () => {
    expect(programsOf(programs, 'me').map((p) => p.id)).toEqual(['p_mio']);
  });

  test('un dueño sin programas da una lista vacía, no un error', () => {
    expect(programsOf(programs, 'cli_fantasma')).toEqual([]);
    expect(programsOf(undefined, 'me')).toEqual([]);
  });

  // La razón de ser del cambio: la lista no puede contener ids muertos porque
  // no contiene ids. Antes era `client.programIds[]`, y cada lector tenía que
  // defenderse con un `.filter(Boolean)`.
  test('no puede devolver un hueco', () => {
    expect(programsOf(programs, 'cli_ana').every(Boolean)).toBe(true);
  });
});

describe('templatesOf', () => {
  test('sólo plantillas, por nombre', () => {
    expect(templatesOf(programs).map((p) => p.id)).toEqual(['t_mia']);
    expect(templatesOf({})).toEqual([]);
  });
});

describe('assignActiveProgram / deassignProgram', () => {
  test('asignar activa y marca sucio; no toca ninguna lista', () => {
    const c = assignActiveProgram({ id: 'cli_1' }, 'p1');
    expect(c).toEqual({ id: 'cli_1', activeProgramId: 'p1', programDirty: true });
  });

  test('reasignar deja al anterior como "anterior", no lo borra', () => {
    const c = assignActiveProgram(assignActiveProgram({ id: 'cli_1' }, 'p1'), 'p2');
    expect(c.activeProgramId).toBe('p2');
    // `p1` sigue siendo del cliente por su `owner`: nada que mantener aquí.
    expect(Object.keys(c)).toEqual(['id', 'activeProgramId', 'programDirty']);
  });

  test('desasignar limpia activo y sucio', () => {
    const c = deassignProgram({ id: 'cli_1', activeProgramId: 'p1', programDirty: true });
    expect(c.activeProgramId).toBeNull();
    expect(c.programDirty).toBe(false);
  });
});
