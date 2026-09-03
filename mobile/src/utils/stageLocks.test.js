import { describe, it, expect } from 'vitest';
import { isStageLocked, isTrainerProgram } from './stageLocks';

const program = {
  id: 'prog_1',
  currentStageIndex: 1,
  stages: [
    { id: 'st1' },
    { id: 'st2' },
    { id: 'st3', locked: true },
    { id: 'st4', locked: true },
  ],
};
const linked = { slotId: 'slot_1', trainerProgramIds: ['prog_1'] };

describe('isTrainerProgram', () => {
  it('es cierto solo para los programas que llegaron del entrenador', () => {
    expect(isTrainerProgram(program, linked)).toBe(true);
    expect(isTrainerProgram({ id: 'prog_mio' }, linked)).toBe(false);
  });

  it('en el movil del entrenador nunca es cierto: no tiene slot', () => {
    expect(isTrainerProgram(program, { trainerProgramIds: ['prog_1'] })).toBe(false);
    expect(isTrainerProgram(program, null)).toBe(false);
  });

  it('un enlace antiguo sin la lista no bloquea nada', () => {
    // `trainerProgramIds` no existio siempre. Sin lista no se puede afirmar de
    // quien es el programa, y la eleccion es no restringir — igual que hace
    // `isStageLocked` desde el principio.
    expect(isTrainerProgram(program, { slotId: 'slot_1' })).toBe(false);
  });
});

describe('isStageLocked', () => {
  it('locks a closed stage ahead of the athlete', () => {
    expect(isStageLocked(program, 2, linked)).toBe(true);
    expect(isStageLocked(program, 3, linked)).toBe(true);
  });

  it('leaves open stages open', () => {
    const open = { ...program, stages: program.stages.map((s) => ({ ...s, locked: false })) };
    expect(isStageLocked(open, 2, linked)).toBe(false);
  });

  it('never locks the current stage or the ones already passed', () => {
    // Even if the trainer marks them locked after the fact.
    const all = { ...program, currentStageIndex: 2, stages: program.stages.map((s) => ({ ...s, locked: true })) };
    expect(isStageLocked(all, 0, linked)).toBe(false);
    expect(isStageLocked(all, 1, linked)).toBe(false);
    expect(isStageLocked(all, 2, linked)).toBe(false);
    expect(isStageLocked(all, 3, linked)).toBe(true);
  });

  it('never locks anyone who is not linked to a trainer', () => {
    expect(isStageLocked(program, 2, { slotId: null, trainerProgramIds: ['prog_1'] })).toBe(false);
    expect(isStageLocked(program, 2, undefined)).toBe(false);
  });

  it("never locks the athlete's own programs", () => {
    expect(isStageLocked(program, 2, { slotId: 'slot_1', trainerProgramIds: ['prog_otro'] })).toBe(false);
    expect(isStageLocked(program, 2, { slotId: 'slot_1' })).toBe(false);
  });

  it('tolerates missing stages and programs', () => {
    expect(isStageLocked(program, 99, linked)).toBe(false);
    expect(isStageLocked({ id: 'prog_1' }, 1, linked)).toBe(false);
    expect(isStageLocked(undefined, 1, linked)).toBe(false);
  });
});
