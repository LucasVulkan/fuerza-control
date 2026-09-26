import { describe, it, expect } from 'vitest';
import { presetFromEntry, freeTemplateFromPreset, isFreeEntry } from './freeSessions';

const ENTRY = {
  sessionTemplateId: '__free__',
  sessionName: '  Corta de reserva  ',
  exercises: [
    { exerciseId: 'bench', isAdHoc: true, sets: [
      { weight: '60', reps: '10', time: '', done: true },
      { weight: '60', reps: '8',  time: '', done: true },
    ] },
    { exerciseId: 'row', isAdHoc: true, minReps: 6, maxReps: 8, restSec: 120,
      sets: [{ weight: '40', reps: '12', time: '', done: true }] },
  ],
  blocks: [
    { blockId: 'blk_1', format: 'amrap', name: 'Final', capSec: 600, intervalSec: null,
      rounds: null, emomMode: 'rotate', movements: [{ exerciseId: 'burpee', reps: 10 }],
      result: { rounds: 5, extraReps: 3 } },
  ],
};

describe('presetFromEntry', () => {
  it('guarda el plan: ejercicios, cuántas series y los bloques', () => {
    const preset = presetFromEntry(ENTRY);
    expect(preset.name).toBe('Corta de reserva');
    expect(preset.exercises).toEqual([
      // Sin objetivo propio: al montarla vuelve a salir de la biblioteca.
      { exerciseId: 'bench', sets: 2 },
      { exerciseId: 'row',   sets: 1, minReps: 6, maxReps: 8, restSec: 120 },
    ]);
    expect(preset.blocks[0].format).toBe('amrap');
    expect(preset.blocks[0].movements).toEqual([{ exerciseId: 'burpee', reps: 10 }]);
  });

  it('descarta lo registrado: pesos, reps y resultado del bloque', () => {
    const preset = presetFromEntry(ENTRY);
    expect(Object.keys(preset.exercises[0])).toEqual(['exerciseId', 'sets']);
    expect(preset.blocks[0].result).toBeUndefined();
    expect(preset.blocks[0].blockId).toBeUndefined();
  });

  it('una sesión sin nombre no inventa uno', () => {
    expect(presetFromEntry({ ...ENTRY, sessionName: '   ' }).name).toBeNull();
    expect(presetFromEntry({}).name).toBeNull();
    expect(presetFromEntry({}).exercises).toEqual([]);
    expect(presetFromEntry({}).blocks).toEqual([]);
  });
});

describe('freeTemplateFromPreset', () => {
  const LIB = {
    bench: { sets: 4, restSec: 150, minReps: 5, maxReps: 8 },
    row:   { sets: 3, restSec: 90,  minReps: 8, maxReps: 12 },
  };
  const build = (preset, owner) => {
    let n = 0;
    return freeTemplateFromPreset(preset, { id: 'tpl_1', owner, newBlockId: () => `blk_new_${++n}`, lib: LIB });
  };

  it('es una sesión sin programa, mía y visible en Inicio', () => {
    const tpl = build(presetFromEntry(ENTRY));
    expect(tpl).toMatchObject({
      id: 'tpl_1', programId: null, owner: 'me', label: null, name: 'Corta de reserva', onHome: true,
    });
  });

  it('respeta un dueño que no soy yo', () => {
    expect(build(presetFromEntry(ENTRY), 'cli_1').owner).toBe('cli_1');
  });

  it('mismos ejercicios y series; lo que el plan no dice sale de la biblioteca', () => {
    const [bench, row] = build(presetFromEntry(ENTRY)).exercises;
    expect(bench).toMatchObject({
      exerciseId: 'bench', sets: 2, restSec: 150, minReps: 5, maxReps: 8, isKey: false, order: 1,
    });
    // El objetivo puesto a mano pisa al de la biblioteca.
    expect(row).toMatchObject({ exerciseId: 'row', sets: 1, restSec: 120, minReps: 6, maxReps: 8, order: 2 });
  });

  it('un ejercicio que no está en la biblioteca no rompe: defaults de addExercise', () => {
    const [ex] = build({ exercises: [{ exerciseId: 'raro', sets: 2 }] }).exercises;
    expect(ex).toMatchObject({ sets: 2, restSec: 90, minReps: null, maxReps: null });
  });

  it('los bloques entran con id nuevo y sin resultado', () => {
    const [block] = build(presetFromEntry(ENTRY)).blocks;
    expect(block.id).toBe('blk_new_1');
    expect(block.format).toBe('amrap');
    expect(block.result).toBeUndefined();
  });

  it('sin nombre queda en cadena vacía (se pinta «Sesión libre»)', () => {
    expect(build(presetFromEntry({})).name).toBe('');
    expect(build(undefined).exercises).toEqual([]);
  });
});

describe('isFreeEntry', () => {
  it('reconoce las dos clases y las entradas viejas sobre la marcha', () => {
    expect(isFreeEntry({ sessionTemplateId: '__free__' })).toBe(true);
    expect(isFreeEntry({ sessionTemplateId: 'tpl_x', free: true })).toBe(true);
    expect(isFreeEntry({ sessionTemplateId: 'tpl_x' })).toBe(false);
    expect(isFreeEntry(undefined)).toBe(false);
  });
});
