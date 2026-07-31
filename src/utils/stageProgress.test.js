import { describe, it, expect } from 'vitest';
import {
  advanceCycle, progressBlob, progressFromBlob, mergeProgressOnImport, clientStageIndex,
} from './stageProgress';

const CYCLE = ['tpl_a', 'tpl_b', 'tpl_c'];
const STAGE = { durationWeeks: 2, isLastStage: false };

/** Replays a list of completed templates through advanceCycle. */
function replay(templateIds, opts = STAGE, program = {}) {
  let p = program;
  for (const id of templateIds) p = { ...p, ...advanceCycle(p, id, CYCLE, opts) };
  return p;
}

describe('advanceCycle', () => {
  it('tracks the open rotation by distinct template', () => {
    const p = replay(['tpl_a', 'tpl_b']);
    expect(p.cycleCompletedIds.sort()).toEqual(['tpl_a', 'tpl_b']);
    expect(p.stageWeeksCompleted).toBe(0);
  });

  it('closes the cycle only when every distinct session is done', () => {
    const p = replay(['tpl_a', 'tpl_b', 'tpl_c']);
    expect(p.cycleCompletedIds).toEqual([]);   // rotation reset
    expect(p.stageWeeksCompleted).toBe(1);
    expect(p.totalWeeksCompleted).toBe(1);
  });

  it('closes it regardless of order', () => {
    expect(replay(['tpl_c', 'tpl_a', 'tpl_b']).stageWeeksCompleted).toBe(1);
  });

  it('does NOT advance on repeats — the bug this replaces', () => {
    const p = replay(Array(12).fill('tpl_a'));
    expect(p.stageWeeksCompleted).toBe(0);
    expect(p.stageAdvancePending).toBe(false);
    expect(p.cycleCompletedIds).toEqual(['tpl_a']);
  });

  it('flags the stage as finished after durationWeeks full rotations', () => {
    const oneWeek = replay(CYCLE);
    expect(oneWeek.stageAdvancePending).toBe(false);   // 1 of 2 weeks
    const twoWeeks = replay(CYCLE, STAGE, oneWeek);
    expect(twoWeeks.stageWeeksCompleted).toBe(2);
    expect(twoWeeks.stageAdvancePending).toBe(true);
  });

  it('never flags an advance on the last stage', () => {
    const opts = { durationWeeks: 1, isLastStage: true };
    expect(replay(CYCLE, opts).stageAdvancePending).toBe(false);
  });

  it('keeps the flag raised across later sessions until it is consumed', () => {
    const done = replay([...CYCLE, ...CYCLE], STAGE);
    expect(done.stageAdvancePending).toBe(true);
    expect(replay(['tpl_a'], STAGE, done).stageAdvancePending).toBe(true);
  });

  it('counts rotations without a stage threshold (non-staged programs)', () => {
    const p = replay(CYCLE, {});
    expect(p.totalWeeksCompleted).toBe(1);
    expect(p.stageAdvancePending).toBe(false);
  });
});

describe('progressBlob / progressFromBlob', () => {
  const program = {
    id: 'prog_1', currentStageIndex: 2, cycleCompletedIds: ['tpl_a'],
    stageWeeksCompleted: 3, totalWeeksCompleted: 11,
  };

  it('survives a round trip', () => {
    expect(progressFromBlob(progressBlob(program), 'prog_1')).toEqual({
      currentStageIndex: 2, cycleCompletedIds: ['tpl_a'],
      stageWeeksCompleted: 3, totalWeeksCompleted: 11,
    });
  });

  it('rejects a blob from another program instead of adopting its stage', () => {
    expect(progressFromBlob(progressBlob(program), 'prog_2')).toBeNull();
    expect(progressFromBlob(null, 'prog_1')).toBeNull();
  });

  it('fills defaults for a program that has never been trained', () => {
    expect(progressFromBlob(progressBlob({ id: 'prog_1' }), 'prog_1')).toEqual({
      currentStageIndex: 0, cycleCompletedIds: [],
      stageWeeksCompleted: 0, totalWeeksCompleted: 0,
    });
  });

  it('has nothing to send for a program without an id', () => {
    expect(progressBlob(undefined)).toBeNull();
    expect(progressBlob({})).toBeNull();
  });

  it('lleva el sello de activación bajo el que se calculó la posición', () => {
    expect(progressBlob(program, 'T1').appliedActivation).toBe('T1');
    expect(progressBlob(program).appliedActivation).toBeNull();
  });
});

describe('mergeProgressOnImport — quién manda al llegar un programa del entrenador', () => {
  // 3 etapas de 2 semanas; el cliente va por la 2ª, con 1 semana hecha.
  const stages = [1, 2, 3].map((n) => ({ id: `st${n}`, durationWeeks: 2, days: [] }));
  // Un programa del entrenador: su etapa marcada y, si activó alguna, el sello.
  const arrives = (currentStageIndex, stageActivatedAt) =>
    ({ id: 'prog_1', currentStageIndex, stages, ...(stageActivatedAt ? { stageActivatedAt } : {}) });
  const mine = {
    programId: 'prog_1', currentStageIndex: 1, cycleCompletedIds: ['tpl_a'],
    stageWeeksCompleted: 1, totalWeeksCompleted: 7,
  };
  const T1 = '2026-07-01T10:00:00.000Z';
  const T2 = '2026-07-20T10:00:00.000Z';

  it('una edición sin activar etapa deja al cliente donde estaba', () => {
    // El entrenador editó ejercicios; su copia sigue diciendo etapa 0.
    expect(mergeProgressOnImport({ blob: mine, program: arrives(0, T1), lastActivation: T1 }))
      .toEqual({
        currentStageIndex: 1, cycleCompletedIds: ['tpl_a'],
        stageWeeksCompleted: 1, totalWeeksCompleted: 7, stageAdvancePending: false,
      });
  });

  it('activar otra etapa sí mueve al cliente, y esa etapa empieza de cero', () => {
    const r = mergeProgressOnImport({ blob: mine, program: arrives(2, T2), lastActivation: T1 });
    expect(r.currentStageIndex).toBe(2);
    expect(r.cycleCompletedIds).toEqual([]);
    expect(r.stageWeeksCompleted).toBe(0);
    expect(r.totalWeeksCompleted).toBe(7);   // el contador de por vida no se toca
  });

  it('devuelve al cliente a una etapa anterior aunque el índice no cambie', () => {
    // El caso que rompía la comparación de índices: el cliente avanzó solo a la
    // 1, la copia del entrenador seguía en la 0, y al reactivar la 0 no cambiaba
    // ningún número. El sello nuevo sí lo delata.
    const r = mergeProgressOnImport({ blob: mine, program: arrives(0, T2), lastActivation: T1 });
    expect(r.currentStageIndex).toBe(0);
    expect(r.stageWeeksCompleted).toBe(0);
  });

  it('un programa sin sello nunca mueve a nadie', () => {
    expect(mergeProgressOnImport({ blob: mine, program: arrives(2), lastActivation: null }).currentStageIndex).toBe(1);
  });

  it('el mismo sello no vuelve a aplicarse en cada actualización', () => {
    expect(mergeProgressOnImport({ blob: mine, program: arrives(2, T1), lastActivation: T1 }).currentStageIndex).toBe(1);
  });

  it('recupera el aviso de etapa terminada en vez de heredar el del entrenador', () => {
    const acabada = { ...mine, stageWeeksCompleted: 2 };
    expect(mergeProgressOnImport({ blob: acabada, program: arrives(0, T1), lastActivation: T1 }).stageAdvancePending).toBe(true);
    // …salvo en la última etapa, donde no hay a dónde avanzar.
    const enLaUltima = { ...acabada, currentStageIndex: 2 };
    expect(mergeProgressOnImport({ blob: enLaUltima, program: arrives(0, T1), lastActivation: T1 }).stageAdvancePending).toBe(false);
  });

  it('un programa distinto empieza limpio, no hereda la etapa del anterior', () => {
    const r = mergeProgressOnImport({ blob: mine, program: { ...arrives(0), id: 'prog_2' }, lastActivation: null });
    expect(r).toEqual({
      currentStageIndex: 0, cycleCompletedIds: [],
      stageWeeksCompleted: 0, totalWeeksCompleted: 0, stageAdvancePending: false,
    });
  });

  it('recorta una etapa que ya no existe en el programa nuevo', () => {
    const masCorto = { id: 'prog_1', currentStageIndex: 2, stageActivatedAt: T2, stages: stages.slice(0, 1) };
    expect(mergeProgressOnImport({ blob: mine, program: masCorto, lastActivation: T1 }).currentStageIndex).toBe(0);
  });

  it('funciona con programas sin etapas', () => {
    const plano = { id: 'prog_1', days: [] };
    const r = mergeProgressOnImport({ blob: mine, program: plano, lastActivation: null });
    expect(r.currentStageIndex).toBe(0);
    expect(r.stageAdvancePending).toBe(false);
  });
});

describe('clientStageIndex — dónde está el cliente visto desde el entrenador', () => {
  const program = { id: 'prog_1', currentStageIndex: 0 };

  it('manda el progreso espejado, no la copia local del entrenador', () => {
    const client = { progress: { programId: 'prog_1', currentStageIndex: 2 } };
    expect(clientStageIndex(client, program)).toBe(2);
  });

  it('cae a la copia local si el cliente nunca ha sincronizado', () => {
    expect(clientStageIndex({}, { id: 'prog_1', currentStageIndex: 1 })).toBe(1);
    expect(clientStageIndex(undefined, program)).toBe(0);
  });

  it('ignora un blob de otro programa', () => {
    const client = { progress: { programId: 'prog_otro', currentStageIndex: 2 } };
    expect(clientStageIndex(client, program)).toBe(0);
  });

  it('recorta a la última etapa si el programa encogió', () => {
    const conEtapas = { id: 'prog_1', currentStageIndex: 0, stages: [{}, {}] };
    const client    = { progress: { programId: 'prog_1', currentStageIndex: 5 } };
    expect(clientStageIndex(client, conEtapas)).toBe(1);
  });
});
