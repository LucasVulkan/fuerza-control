import { describe, it, expect } from 'vitest';
import {
  progressBlob, progressChanged, mergeProgressOnImport, clientStageIndex,
  withStages, ensureStages, closeOpenStage, stageDays, stageDaysAt, allProgramDays,
  applyProgress, normalizeProgress, stageBannerDue, athleteProgress, stageStatus,
} from './stageProgress';

// El modelo de semanas en sí (fechas, stageStatus, recordSession…) se prueba en
// stageProgress.weeks.test.js. Aquí, lo que lo mueve entre móviles y la forma
// de las etapas.

const MINE = {
  currentStageIndex: 1, stageStartedOn: '2026-09-07', stageSessionsDone: 7,
  stageExtraWeeks: 1, programStartedOn: '2026-08-03',
};

describe('progressBlob — lo que sube el cliente, leído por el entrenador', () => {
  const program = { id: 'prog_1', stages: [{}, {}, {}], ...MINE };
  // La copia del entrenador: mismo programa, progreso a cero.
  const copia   = { id: 'prog_1', stages: [{}, {}, {}] };

  it('survives a round trip', () => {
    expect(athleteProgress(copia, { progress: progressBlob(program) })).toEqual(MINE);
  });

  it('rejects a blob from another program instead of adopting its stage', () => {
    expect(athleteProgress({ ...copia, id: 'prog_2' }, { progress: progressBlob(program) }).stageSessionsDone).toBe(0);
  });

  it('fills defaults for a program that has never been trained', () => {
    expect(athleteProgress(copia, { progress: progressBlob({ id: 'prog_1' }) })).toEqual({
      currentStageIndex: 0, stageStartedOn: null, stageSessionsDone: 0, stageExtraWeeks: 0, programStartedOn: null,
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

  it('no lleva ni un campo de ciclos aunque el programa aún los arrastre', () => {
    const viejo = { id: 'prog_1', stages: [{ days: [{}, {}, {}] }], stageWeeksCompleted: 2, cycleCompletedIds: ['a'] };
    const blob  = progressBlob(viejo);
    expect(blob).not.toHaveProperty('stageWeeksCompleted');
    expect(blob).not.toHaveProperty('cycleCompletedIds');
    expect(blob.stageSessionsDone).toBe(7);   // 2 ciclos × 3 + 1
  });
});

describe('progressChanged', () => {
  const prog = { id: 'p1', ...MINE };

  it('mismo progreso → false, aunque el programa sea otro objeto', () => {
    expect(progressChanged(prog, { ...prog, name: 'renombrado' })).toBe(false);
  });

  it.each([
    ['currentStageIndex', 2], ['stageStartedOn', '2026-09-14'], ['stageSessionsDone', 8],
    ['stageExtraWeeks', 2], ['programStartedOn', null],
  ])('cambia %s → true', (key, value) => {
    expect(progressChanged(prog, { ...prog, [key]: value })).toBe(true);
  });

  it('programa que aparece o desaparece → true', () => {
    expect(progressChanged(undefined, prog)).toBe(true);
    expect(progressChanged(prog, undefined)).toBe(true);
    expect(progressChanged(undefined, undefined)).toBe(false);
  });
});

describe('mergeProgressOnImport — quién manda al llegar un programa del entrenador', () => {
  // 3 etapas de 2 semanas; el cliente va por la 2ª.
  const stages = [1, 2, 3].map((n) => ({ id: `st${n}`, durationWeeks: 2, days: [] }));
  // Un programa del entrenador: su etapa marcada y, si activó alguna, el sello.
  // Trae SU copia del progreso (a cero, o lo que él tocara): nunca cuenta.
  const arrives = (currentStageIndex, stageActivatedAt) => ({
    id: 'prog_1', currentStageIndex, stages, stageSessionsDone: 0, stageStartedOn: null,
    ...(stageActivatedAt ? { stageActivatedAt } : {}),
  });
  const mine = { programId: 'prog_1', ...MINE };
  const T1 = '2026-07-01T10:00:00.000Z';
  const T2 = '2026-07-20T10:00:00.000Z';

  it('una edición sin activar etapa deja al cliente donde estaba', () => {
    // El entrenador editó ejercicios; su copia sigue diciendo etapa 0.
    expect(mergeProgressOnImport({ blob: mine, program: arrives(0, T1), lastActivation: T1 })).toEqual(MINE);
  });

  it('activar otra etapa sí mueve al cliente, y esa etapa queda sin empezar', () => {
    const r = mergeProgressOnImport({ blob: mine, program: arrives(2, T2), lastActivation: T1 });
    expect(r).toEqual({
      currentStageIndex: 2, stageStartedOn: null, stageSessionsDone: 0, stageExtraWeeks: 0,
      programStartedOn: '2026-08-03',   // moverle de etapa no le reinicia el programa
    });
  });

  it('devuelve al cliente a una etapa anterior aunque el índice no cambie', () => {
    // El caso que rompía la comparación de índices: el cliente avanzó solo a la
    // 1, la copia del entrenador seguía en la 0, y al reactivar la 0 no cambiaba
    // ningún número. El sello nuevo sí lo delata.
    const r = mergeProgressOnImport({ blob: mine, program: arrives(0, T2), lastActivation: T1 });
    expect(r.currentStageIndex).toBe(0);
    expect(r.stageSessionsDone).toBe(0);
  });

  it('un programa sin sello nunca mueve a nadie', () => {
    expect(mergeProgressOnImport({ blob: mine, program: arrives(2), lastActivation: null }).currentStageIndex).toBe(1);
  });

  it('el mismo sello no vuelve a aplicarse en cada actualización', () => {
    expect(mergeProgressOnImport({ blob: mine, program: arrives(2, T1), lastActivation: T1 }).currentStageIndex).toBe(1);
  });

  it('un programa distinto empieza limpio, también la semana del programa', () => {
    const r = mergeProgressOnImport({ blob: mine, program: { ...arrives(0), id: 'prog_2' }, lastActivation: null });
    expect(r).toEqual({
      currentStageIndex: 0, stageStartedOn: null, stageSessionsDone: 0, stageExtraWeeks: 0, programStartedOn: null,
    });
  });

  it('sin blob (nunca sincronizó) toma la etapa del programa, sin empezar', () => {
    expect(mergeProgressOnImport({ blob: null, program: arrives(1), lastActivation: null })).toMatchObject({
      currentStageIndex: 1, stageSessionsDone: 0, programStartedOn: null,
    });
  });

  it('recorta una etapa que ya no existe en el programa nuevo', () => {
    const masCorto = { id: 'prog_1', currentStageIndex: 2, stageActivatedAt: T2, stages: stages.slice(0, 1) };
    expect(mergeProgressOnImport({ blob: mine, program: masCorto, lastActivation: T1 }).currentStageIndex).toBe(0);
    // …y sin salto también.
    expect(mergeProgressOnImport({ blob: mine, program: { ...masCorto, stageActivatedAt: T1 }, lastActivation: T1 }).currentStageIndex).toBe(0);
  });

  it('un blob contado en ciclos (reinstalar con el blob viejo en el hueco) se convierte', () => {
    const viejo = { programId: 'prog_1', currentStageIndex: 1, cycleCompletedIds: ['a'], stageWeeksCompleted: 1, totalWeeksCompleted: 3 };
    const conDias = { ...arrives(0, T1), stages: stages.map((st) => ({ ...st, days: [{}, {}, {}] })) };
    const r = mergeProgressOnImport({ blob: viejo, program: conDias, lastActivation: T1, today: '2026-09-25' });
    expect(r).toEqual({
      currentStageIndex: 1, stageStartedOn: '2026-09-14', stageSessionsDone: 4, stageExtraWeeks: 0, programStartedOn: '2026-08-31',
    });
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

describe('applyProgress / normalizeProgress', () => {
  it('escribe el parche y se lleva por delante los campos de ciclos', () => {
    const p = applyProgress({ id: 'p1', name: 'X', stageWeeksCompleted: 3, stageAdvancePending: true }, { stageSessionsDone: 5 });
    expect(p).toEqual({ id: 'p1', name: 'X', stageSessionsDone: 5 });
  });

  it('normalizeProgress deja un programa viejo en la forma de semanas', () => {
    const p = normalizeProgress(
      { id: 'p1', stages: [{ days: [{}, {}] }], cycleCompletedIds: ['a'], stageWeeksCompleted: 0, totalWeeksCompleted: 0 },
      '2026-09-25',
    );
    expect(p).toEqual({
      id: 'p1', stages: [{ days: [{}, {}] }],
      currentStageIndex: 0, stageStartedOn: '2026-09-21', stageSessionsDone: 1, stageExtraWeeks: 0, programStartedOn: '2026-09-21',
    });
  });

  it('normalizeProgress no cambia nada en uno ya migrado', () => {
    const p = { id: 'p1', stages: [{ days: [] }], ...MINE, currentStageIndex: 0 };
    expect(normalizeProgress(p, '2026-09-25')).toEqual(p);
  });
});

describe('stageBannerDue — el aviso de fin de etapa y el punto del tab', () => {
  const program = { id: 'p1', stages: [{ durationWeeks: 2, days: [{}, {}, {}] }, { durationWeeks: 2, days: [{}] }] };
  const progress = { currentStageIndex: 0, stageStartedOn: '2026-09-21', stageSessionsDone: 6 };

  it('sale al terminar la etapa, aunque falten sesiones', () => {
    const faltan = { ...progress, stageSessionsDone: 5 };
    expect(stageBannerDue(program, faltan, null, '2026-10-04')).toBe(false);
    expect(stageBannerDue(program, faltan, null, '2026-10-05')).toBe(true);
  });

  it('sale antes si en la última semana ya está todo hecho', () => {
    expect(stageBannerDue(program, progress, null, '2026-09-29')).toBe(true);
    expect(stageBannerDue(program, { ...progress, stageSessionsDone: 5 }, null, '2026-09-29')).toBe(false);
  });

  it('aplazado, no sale hasta el día fijado', () => {
    expect(stageBannerDue(program, progress, '2026-10-05', '2026-09-29')).toBe(false);
    expect(stageBannerDue(program, progress, '2026-10-05', '2026-10-05')).toBe(true);
  });

  it('nunca en la última etapa: no hay a dónde pasar', () => {
    expect(stageBannerDue(program, { ...progress, currentStageIndex: 1 }, null, '2027-01-01')).toBe(false);
  });

  it('nunca sin empezar', () => {
    expect(stageBannerDue(program, { currentStageIndex: 0, stageSessionsDone: 0 }, null, '2027-01-01')).toBe(false);
  });
});

describe('closeOpenStage — una etapa sin límite se cierra al añadir otra detrás', () => {
  const open    = { id: 'st_a', durationWeeks: null, days: [{}, {}, {}] };
  const limited = { id: 'st_b', durationWeeks: 4,    days: [] };
  // Empezada el lunes 7-sep: el 25 va por la semana 3, con 2 completas.
  const progress = { currentStageIndex: 0, stageStartedOn: '2026-09-07', stageSessionsDone: 7 };

  it('se cierra en las semanas COMPLETAS que lleva el atleta', () => {
    expect(closeOpenStage([open, limited], 0, progress, '2026-09-25')[0].durationWeeks).toBe(2);
  });

  it('y con eso ya está terminada: el aviso sale sin encender nada', () => {
    const stages = closeOpenStage([open, limited], 0, progress, '2026-09-25');
    expect(stageStatus({ stages }, progress, '2026-09-25').ended).toBe(true);
  });

  it('sin empezar o en la primera semana, 1 semana (nunca 0: sería una etapa vacía)', () => {
    expect(closeOpenStage([open], 0, { stageSessionsDone: 0 }, '2026-09-25')[0].durationWeeks).toBe(1);
    expect(closeOpenStage([open], 0, { stageStartedOn: '2026-09-21' }, '2026-09-25')[0].durationWeeks).toBe(1);
  });

  it('deja en paz una etapa que ya tiene límite', () => {
    const input = [limited];
    expect(closeOpenStage(input, 0, progress, '2026-09-25')).toBe(input);
  });

  it('solo toca la etapa en la que está el atleta', () => {
    const stages = closeOpenStage([open, { ...open, id: 'st_c' }], 1, progress, '2026-09-25');
    expect(stages[0].durationWeeks).toBeNull();
    expect(stages[1].durationWeeks).toBe(2);
  });

  it('un índice fuera de rango no hace nada', () => {
    const input = [open];
    expect(closeOpenStage(input, 7, progress, '2026-09-25')).toBe(input);
  });

  it('en el móvil del entrenador cierra por donde va el CLIENTE, no por su copia', () => {
    const program = { id: 'p1', stages: [open, limited], currentStageIndex: 0 };   // copia a cero
    const client  = { progress: { programId: 'p1', ...progress } };
    const mirror  = athleteProgress(program, client, '2026-09-25');
    expect(closeOpenStage(program.stages, mirror.currentStageIndex, mirror, '2026-09-25')[0].durationWeeks).toBe(2);
  });
});


// ── Modelo unificado (docs/specs/stage-planner.md §3) ────────────────────────

describe('withStages', () => {
  const stageA = { id: 'st_a', name: 'A', days: [{ sessionTemplateId: 'tpl_a' }] };
  const stageB = { id: 'st_b', name: 'B', days: [{ sessionTemplateId: 'tpl_b' }] };

  it('asigna las etapas y el índice activo', () => {
    const p = withStages({ id: 'p1' }, [stageA, stageB], 1);
    expect(p.stages).toHaveLength(2);
    expect(p.currentStageIndex).toBe(1);
  });

  it('keeps the index the program already had when none is given', () => {
    const p = withStages({ id: 'p1', currentStageIndex: 1 }, [stageA, stageB]);
    expect(p.currentStageIndex).toBe(1);
  });

  it('clamps an index past the end — the trainer may have deleted stages', () => {
    const p = withStages({ id: 'p1', currentStageIndex: 5 }, [stageA]);
    expect(p.currentStageIndex).toBe(0);
  });

  // El espejo murió (program-model.md §5): `withStages` ya no escribe `days`, y
  // por eso no puede derivar. Lo que había aquí era un test de que el espejo NO
  // se quedaba viejo tras escribir en una etapa que no era la activa.
  it('no escribe ninguna copia de los días', () => {
    const p = withStages({ id: 'p1' }, [stageA, stageB], 1);
    expect(p).not.toHaveProperty('days');
  });
});

describe('stageDays / stageDaysAt / allProgramDays', () => {
  const stageA = { id: 'st_a', name: 'A', days: [{ sessionTemplateId: 'tpl_a' }] };
  const stageB = { id: 'st_b', name: 'B', days: [{ sessionTemplateId: 'tpl_b' }] };
  const program = { id: 'p1', stages: [stageA, stageB], currentStageIndex: 1 };

  it('stageDays lee la etapa ACTIVA', () => {
    expect(stageDays(program)).toEqual(stageB.days);
  });

  it('sin índice, la primera', () => {
    expect(stageDays({ stages: [stageA, stageB] })).toEqual(stageA.days);
  });

  // En el móvil del entrenador, `currentStageIndex` es la etapa que ÉL activó,
  // no donde está el cliente: por eso hace falta la forma con índice explícito.
  it('stageDaysAt lee la que se le pida', () => {
    expect(stageDaysAt(program, 0)).toEqual(stageA.days);
    expect(stageDaysAt(program, 9)).toEqual([]);   // etapa borrada: lista vacía, no un throw
  });

  it('allProgramDays recorre TODAS las etapas — el alcance del programa', () => {
    expect(allProgramDays(program)).toEqual([...stageA.days, ...stageB.days]);
  });

  it('nada de esto revienta con un programa a medias', () => {
    expect(stageDays(undefined)).toEqual([]);
    expect(stageDays({})).toEqual([]);
    expect(allProgramDays(undefined)).toEqual([]);
    expect(allProgramDays({ stages: [{ id: 'x' }] })).toEqual([]);
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

  it('migrates with NO limit, so a running program does not grow an ending', () => {
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

describe('ensureStages — la invariante de `days` (fallo 16)', () => {
  it('rellena `days` en las etapas que no la traen', () => {
    // Es lo que permite que los cinco `st.days.forEach(...)` repartidos por
    // pantallas y store no necesiten guard. Llega así desde `updateStage` con
    // un patch arbitrario o desde un program_json de otra versión.
    const roto = { id: 'p1', stages: [{ id: 's1', name: 'Etapa 1' }, { id: 's2', days: [{ sessionTemplateId: 't' }] }] };

    const out = ensureStages(roto);

    expect(out.stages.map((st) => Array.isArray(st.days))).toEqual([true, true]);
    expect(out.stages[1].days).toHaveLength(1);
  });

  it('no reconstruye si ya están todas bien', () => {
    // La migración de rehidratación compara identidad para no reescribir el
    // estado en cada arranque: `ensureStages` tiene que devolver el MISMO
    // objeto cuando no hay nada que arreglar.
    const sano = { id: 'p1', stages: [{ id: 's1', days: [] }] };

    expect(ensureStages(sano)).toBe(sano);
  });
});
