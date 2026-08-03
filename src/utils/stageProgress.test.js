import { describe, it, expect } from 'vitest';
import {
  advanceCycle, progressBlob, progressFromBlob, mergeProgressOnImport, clientStageIndex,
  withStages, ensureStages, closeOpenStage,
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


// ── Modelo unificado (docs/specs/stage-planner.md §3) ────────────────────────

describe('withStages', () => {
  const stageA = { id: 'st_a', name: 'A', days: [{ sessionTemplateId: 'tpl_a' }] };
  const stageB = { id: 'st_b', name: 'B', days: [{ sessionTemplateId: 'tpl_b' }] };

  it('mirrors `days` onto the active stage', () => {
    const p = withStages({ id: 'p1' }, [stageA, stageB], 1);
    expect(p.stages).toHaveLength(2);
    expect(p.currentStageIndex).toBe(1);
    expect(p.days).toEqual(stageB.days);
  });

  it('keeps the index the program already had when none is given', () => {
    const p = withStages({ id: 'p1', currentStageIndex: 1 }, [stageA, stageB]);
    expect(p.currentStageIndex).toBe(1);
    expect(p.days).toEqual(stageB.days);
  });

  it('clamps an index past the end — the trainer may have deleted stages', () => {
    const p = withStages({ id: 'p1', currentStageIndex: 5 }, [stageA]);
    expect(p.currentStageIndex).toBe(0);
    expect(p.days).toEqual(stageA.days);
  });

  it('never leaves `days` stale after a write to a non-active stage', () => {
    const edited = { ...stageB, days: [{ sessionTemplateId: 'tpl_new' }] };
    const p = withStages({ id: 'p1', currentStageIndex: 0, days: stageA.days }, [stageA, edited]);
    expect(p.days).toEqual(stageA.days);      // sigue espejando la activa
  });
});

describe('ensureStages', () => {
  it('wraps a legacy program into a single stage', () => {
    const legacy = { id: 'p1', days: [{ sessionTemplateId: 'tpl_a' }] };
    const p = ensureStages(legacy);
    expect(p.stages).toHaveLength(1);
    expect(p.stages[0].days).toEqual(legacy.days);
    expect(p.days).toEqual(legacy.days);
    expect(p.currentStageIndex).toBe(0);
  });

  it('migrates with NO cycle limit, so a running program does not grow an ending', () => {
    const p = ensureStages({ id: 'p1', days: [], stageWeeksCompleted: 15 });
    expect(p.stages[0].durationWeeks).toBeNull();
  });

  it('is idempotent — a staged program comes back untouched', () => {
    const staged = withStages({ id: 'p1' }, [{ id: 'st_a', days: [] }], 0);
    expect(ensureStages(staged)).toBe(staged);
  });

  it('tolerates a program with no days at all', () => {
    expect(ensureStages({ id: 'p1' }).stages[0].days).toEqual([]);
  });
});

describe('durationWeeks: null — sin límite de ciclos', () => {
  it('never flags the stage as finished, however many cycles close', () => {
    const p = replay(
      ['tpl_a', 'tpl_b', 'tpl_c', 'tpl_a', 'tpl_b', 'tpl_c'],
      { durationWeeks: null, isLastStage: false },
    );
    expect(p.stageWeeksCompleted).toBe(2);
    expect(p.stageAdvancePending).toBe(false);
  });

  it('behaves exactly like a stage-less program (durationWeeks omitted)', () => {
    const withNull    = replay(['tpl_a', 'tpl_b', 'tpl_c'], { durationWeeks: null, isLastStage: false });
    const withoutStage = replay(['tpl_a', 'tpl_b', 'tpl_c'], {});
    expect(withNull.stageAdvancePending).toBe(withoutStage.stageAdvancePending);
    expect(withNull.stageWeeksCompleted).toBe(withoutStage.stageWeeksCompleted);
  });

  it('mergeProgressOnImport does not mark an unlimited stage as pending', () => {
    const program = {
      id: 'p1',
      stages: [{ id: 'st_a', durationWeeks: null, days: [] }, { id: 'st_b', durationWeeks: 4, days: [] }],
      currentStageIndex: 0,
    };
    const blob = { programId: 'p1', currentStageIndex: 0, cycleCompletedIds: [], stageWeeksCompleted: 20, totalWeeksCompleted: 20 };
    const merged = mergeProgressOnImport({ blob, program });
    expect(merged.stageAdvancePending).toBe(false);
  });
});

describe('closeOpenStage', () => {
  const open    = { id: 'st_a', durationWeeks: null, days: [] };
  const limited = { id: 'st_b', durationWeeks: 4,    days: [] };

  it('closes the stage at the cycles actually completed', () => {
    const { stages } = closeOpenStage([open], 0, 2);
    expect(stages[0].durationWeeks).toBe(2);
  });

  it('flags the advance so the athlete does not owe an extra rotation', () => {
    // 2 ciclos hechos + etapa cerrada en 2 = terminada YA. Sin esta bandera el
    // umbral solo se reevalúa al guardar la siguiente sesión, y hacían falta
    // 3 ciclos para pasar a una etapa que duraba 2.
    expect(closeOpenStage([open], 0, 2).advancePending).toBe(true);
  });

  it('does not flag it on a program with no closed cycle yet', () => {
    const { stages, advancePending } = closeOpenStage([open], 0, 0);
    expect(stages[0].durationWeeks).toBe(1);   // nunca 0: sería una etapa vacía
    expect(advancePending).toBe(false);
  });

  it('leaves a stage that already has a limit alone', () => {
    const input = [limited];
    const { stages, advancePending } = closeOpenStage(input, 0, 9);
    expect(stages).toBe(input);
    expect(advancePending).toBe(false);
  });

  it('only touches the stage the athlete is in', () => {
    const { stages } = closeOpenStage([open, { ...open, id: 'st_c' }], 1, 3);
    expect(stages[0].durationWeeks).toBeNull();
    expect(stages[1].durationWeeks).toBe(3);
  });

  it('is a no-op for an out-of-range index', () => {
    const input = [open];
    expect(closeOpenStage(input, 7, 3).stages).toBe(input);
  });

  it('the closed stage then reads as finished for advanceCycle', () => {
    const { stages } = closeOpenStage([open, limited], 0, 2);
    const p = advanceCycle(
      { stageWeeksCompleted: 2, cycleCompletedIds: ['tpl_a', 'tpl_b'] },
      'tpl_c', CYCLE,
      { durationWeeks: stages[0].durationWeeks, isLastStage: false },
    );
    expect(p.stageAdvancePending).toBe(true);
  });
});
