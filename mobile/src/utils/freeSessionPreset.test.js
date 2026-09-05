import { describe, it, expect } from 'vitest';
import { presetFromEntry, freeSessionFromPreset } from './freeSessionPreset';

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

describe('freeSessionFromPreset', () => {
  it('monta series vacías y bloques con id nuevo', () => {
    let n = 0;
    const session = freeSessionFromPreset(presetFromEntry(ENTRY), () => `blk_new_${++n}`);
    expect(session.freeSessionName).toBe('Corta de reserva');
    expect(session.adHocExercises[0].setsState).toHaveLength(2);
    expect(session.adHocExercises[0].setsState[0]).toEqual({ weight: '', reps: '', time: '', done: false });
    expect(session.adHocExercises[0].config).toBeUndefined();
    expect(session.adHocExercises[1].config).toEqual({ minReps: 6, maxReps: 8, restSec: 120 });
    expect(session.freeBlocks[0].id).toBe('blk_new_1');
    expect(session.freeBlocks[0].format).toBe('amrap');
  });

  it('cada serie es un objeto propio — rellenar una no rellena las demás', () => {
    const session = freeSessionFromPreset({ exercises: [{ exerciseId: 'bench', sets: 3 }] }, () => 'x');
    session.adHocExercises[0].setsState[0].reps = '10';
    expect(session.adHocExercises[0].setsState[1].reps).toBe('');
  });
});
