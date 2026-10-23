import { describe, it, expect } from 'vitest';
import { sessionSlots, slotsToArrays, slotNumber } from './sessionSlots';

const ex = (id, extra = {}) => ({ exerciseId: id, ...extra });

describe('sessionSlots', () => {
  it('agrupa los ejercicios encadenados por supersetWithNext en un solo hueco', () => {
    const slots = sessionSlots({
      exercises: [ex('a', { supersetWithNext: true }), ex('b'), ex('c')],
    });
    expect(slots.map((s) => s.members.map((m) => m.exerciseId))).toEqual([['a', 'b'], ['c']]);
  });

  it('deja al final los bloques sin `order` (datos anteriores a poder mezclarlos)', () => {
    const slots = sessionSlots({
      exercises: [ex('a'), ex('b')],
      blocks:    [{ id: 'blk1' }, { id: 'blk2' }],
    });
    expect(slots.map((s) => s.id)).toEqual(['a', 'b', 'blk1', 'blk2']);
  });

  it('coloca cada bloque en su posición entre huecos', () => {
    const slots = sessionSlots({
      exercises: [ex('a'), ex('b'), ex('c')],
      blocks:    [{ id: 'blk', order: 1 }],
    });
    expect(slots.map((s) => s.id)).toEqual(['a', 'blk', 'b', 'c']);
  });

  it('indexa contra huecos, así que un bloque no puede partir una superserie', () => {
    // La superserie a+b es el hueco 0; el bloque en la posición 1 cae DETRÁS de
    // ella entera, no entre sus dos miembros.
    const slots = sessionSlots({
      exercises: [ex('a', { supersetWithNext: true }), ex('b'), ex('c')],
      blocks:    [{ id: 'blk', order: 1 }],
    });
    expect(slots.map((s) => s.id)).toEqual(['a', 'blk', 'c']);
    expect(slots[0].members).toHaveLength(2);
  });

  it('sobrevive a un `order` fuera de rango', () => {
    const slots = sessionSlots({
      exercises: [ex('a')],
      blocks:    [{ id: 'lejos', order: 99 }, { id: 'negativo', order: -3 }],
    });
    expect(slots.map((s) => s.id)).toEqual(['negativo', 'a', 'lejos']);
  });
});

describe('slotsToArrays', () => {
  it('renumera los ejercicios y da a cada bloque su índice de hueco', () => {
    const slots = sessionSlots({
      exercises: [ex('a', { supersetWithNext: true }), ex('b'), ex('c')],
      blocks:    [{ id: 'blk', order: 1 }],
    });
    const { exercises, blocks } = slotsToArrays(slots);
    expect(exercises.map((e) => [e.exerciseId, e.order])).toEqual([['a', 1], ['b', 2], ['c', 3]]);
    expect(blocks).toEqual([{ id: 'blk', order: 1 }]);
  });

  it('da la vuelta completa: lo que escribe se vuelve a leer igual', () => {
    const before = sessionSlots({
      exercises: [ex('a'), ex('b'), ex('c')],
      blocks:    [{ id: 'blk', order: 2 }],
    });
    const after = sessionSlots(slotsToArrays(before));
    expect(after.map((s) => s.id)).toEqual(before.map((s) => s.id));
  });
});

describe('slotNumber', () => {
  const tpl = {
    exercises: [ex('a'), ex('b', { supersetWithNext: true }), ex('c')],
    blocks:    [{ id: 'blk', order: 1 }],
  };
  it('numera como el editor de sesión: huecos, superseries con letra y bloques mezclados', () => {
    expect(slotNumber(tpl, { exerciseId: 'a' })).toBe('01');
    expect(slotNumber(tpl, { blockId: 'blk' })).toBe('02');
    expect(slotNumber(tpl, { exerciseId: 'b' })).toBe('03A');
    expect(slotNumber(tpl, { exerciseId: 'c' })).toBe('03B');
    expect(slotNumber(tpl, { exerciseId: 'zzz' })).toBeNull();
  });
});
