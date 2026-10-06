import { describe, test, expect } from 'vitest';
import { fitsFree, clientLimitReason, templateCounts, activeClientIds, needsClientChoice, isClientFrozen, lockedClientIds, canChooseMore, freeGates } from './freePlan';

const manual = (id) => ({ id, syncSlotId: null });
const conn   = (id) => ({ id, syncSlotId: `slot_${id}` });
const byId   = (...cs) => Object.fromEntries(cs.map((c) => [c.id, c]));

describe('fitsFree — 3 clientes, como mucho 1 con app', () => {
  test('3 manuales caben: son dos comprobaciones, no dos bolsas', () => {
    expect(fitsFree([manual('a'), manual('b'), manual('c')])).toBe(true);
  });
  test('1 con app + 2 manuales caben', () => {
    expect(fitsFree([conn('a'), manual('b'), manual('c')])).toBe(true);
  });
  test('un cuarto no cabe', () => {
    expect(clientLimitReason([manual('a'), manual('b'), manual('c'), manual('d')])).toBe('clients');
  });
  test('un segundo con app no cabe, aunque sobre sitio', () => {
    expect(clientLimitReason([conn('a'), conn('b')])).toBe('connected');
  });
});

describe('templateCounts', () => {
  test('cuenta plantillas de programa y de sesión por separado; las libres de Inicio no', () => {
    const programs = { t1: { kind: 'template' }, p1: { kind: 'program' } };
    const sessionTemplates = {
      s1: { kind: 'template', programId: null },
      s2: { programId: null, onHome: true },       // sesión libre de Inicio
      s3: { kind: 'template', programId: 'p1' },   // sesión de un programa
    };
    expect(templateCounts({ programs, sessionTemplates })).toEqual({ programTemplates: 1, sessionTemplates: 1 });
  });
});

describe('congelado al caducar', () => {
  const clients = byId(conn('a'), conn('b'), manual('c'), manual('d'));

  test('si todos caben no hay nada congelado ni que elegir', () => {
    const few = byId(conn('a'), manual('c'));
    expect(activeClientIds(few, [])).toBe(null);
    expect(isClientFrozen({ isPro: false, clients: few, freeClientIds: [] }, 'a')).toBe(false);
    expect(needsClientChoice({ isPro: false, clients: few, freeClientIds: [] })).toBe(false);
  });

  test('sin elegir, todo congelado y se pide la hoja', () => {
    const st = { isPro: false, clients, freeClientIds: [] };
    expect(needsClientChoice(st)).toBe(true);
    expect(['a', 'b', 'c', 'd'].every((id) => isClientFrozen(st, id))).toBe(true);
  });

  test('con una elección válida, solo los elegidos siguen', () => {
    const st = { isPro: false, clients, freeClientIds: ['a', 'c', 'd'] };
    expect(needsClientChoice(st)).toBe(false);
    expect(isClientFrozen(st, 'a')).toBe(false);
    expect(isClientFrozen(st, 'b')).toBe(true);
  });

  test('una elección que no cabe (2 con app) no vale', () => {
    expect(needsClientChoice({ isPro: false, clients, freeClientIds: ['a', 'b'] })).toBe(true);
  });

  test('ids de clientes borrados no cuentan', () => {
    expect(needsClientChoice({ isPro: false, clients, freeClientIds: ['zombi'] })).toBe(true);
  });

  test('con Pro nada está congelado', () => {
    expect(isClientFrozen({ isPro: true, clients, freeClientIds: [] }, 'b')).toBe(false);
    expect(needsClientChoice({ isPro: true, clients, freeClientIds: [] })).toBe(false);
  });
});

describe('la elección no se rota', () => {
  const clients = byId(conn('a'), conn('b'), manual('c'), manual('d'), manual('e'));

  test('lo elegido queda fijo y, con el cupo lleno, no hay más que elegir', () => {
    expect([...lockedClientIds(clients, ['a', 'c', 'd'])].sort()).toEqual(['a', 'c', 'd']);
    expect(canChooseMore(clients, ['a', 'c', 'd'])).toBe(false);
  });

  test('si se borra a un elegido, el hueco se puede volver a ocupar', () => {
    const { d: _gone, ...rest } = clients;
    expect(canChooseMore(rest, ['a', 'c', 'd'])).toBe(true);
  });

  test('el hueco de «con app» no lo ocupa un manual de más', () => {
    // a (app) + c: cabe un tercero manual (e) pero no otro con app (b)
    expect(canChooseMore(byId(conn('a'), conn('b'), manual('c')), ['a', 'c'])).toBe(false);
  });
});

describe('freeGates — lo que las pantallas marcan con PRO', () => {
  test('con el cupo lleno, crear y conectar dicen por qué', () => {
    const g = freeGates({ isPro: false, clients: byId(conn('a'), manual('b'), manual('c')), freeClientIds: [], programs: {}, sessionTemplates: {} });
    expect(g.newClient).toBe('clients');
    expect(g.connect('b')).toBe('connected');
    expect(g.newProgramTemplate).toBe(null);
  });
  test('con Pro, todo abierto', () => {
    const g = freeGates({ isPro: true });
    expect(g.client('x')).toBe(null);
    expect(g.newClient).toBe(null);
  });
});
