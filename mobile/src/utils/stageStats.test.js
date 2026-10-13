import { describe, it, expect } from 'vitest';
import {
  stageWeekRanges, stageRangeLabel, stageVolume, stageKeyReps, stageMinutes, stageSetsByGroup, stageBaseIdx,
} from './stageStats';
import { sessionStats } from './sessionStats';

const tpls = {
  a: { exercises: [
    { exerciseId: 'squat', sets: 4, isKey: true, minReps: 5, maxReps: 8 },
    { exerciseId: 'curl',  sets: 3, minReps: 10, maxReps: 12 },
  ] },
  b: { exercises: [
    { exerciseId: 'bench', sets: 3, isKey: true, minReps: 6, maxReps: 10 },
    { exerciseId: 'plank', sets: 2, isKey: true, minReps: null, minTime: 30, maxTime: 60 },
  ] },
};
const lib = {
  squat: { primaryGroup: 'quads' },
  curl:  { primaryGroup: 'biceps' },
  bench: { primaryGroup: 'chest' },
  plank: { primaryGroup: 'custom' },
};
const stage = { days: [{ sessionTemplateId: 'a' }, { sessionTemplateId: 'b' }] };

describe('stageWeekRanges', () => {
  it('encadena las semanas previstas', () => {
    expect(stageWeekRanges([{ durationWeeks: 4 }, { durationWeeks: 4 }, { durationWeeks: 3 }, { durationWeeks: 1 }]))
      .toEqual([{ from: 1, to: 4 }, { from: 5, to: 8 }, { from: 9, to: 11 }, { from: 12, to: 12 }]);
  });

  it('una sin límite abre el tramo y las de después no tienen calendario', () => {
    expect(stageWeekRanges([{ durationWeeks: 12 }, { durationWeeks: null }, { durationWeeks: 4 }]))
      .toEqual([{ from: 1, to: 12 }, { from: 13, to: null }, null]);
  });

  it('sin etapas, lista vacía', () => {
    expect(stageWeekRanges(undefined)).toEqual([]);
  });
});

describe('stageVolume', () => {
  it('suma sesiones, ejercicios y series', () => {
    expect(stageVolume(stage, tpls, lib)).toEqual({ sessions: 2, exercises: 4, sets: 12 });
  });

  it('etapa vacía', () => {
    expect(stageVolume({ days: [] }, tpls, lib)).toEqual({ sessions: 0, exercises: 0, sets: 0 });
  });
});

describe('stageKeyReps', () => {
  it('media de los principales, sin los de tiempo', () => {
    // squat 5-8 y bench 6-10 → 5,5→6 y 9
    expect(stageKeyReps(stage, tpls)).toEqual({ lo: 6, hi: 9 });
  });

  it('null sin principales', () => {
    expect(stageKeyReps({ days: [] }, tpls)).toBeNull();
  });
});

describe('stageMinutes', () => {
  it('media de los minutos de sus sesiones', () => {
    const expected = Math.round((sessionStats(tpls.a, lib).minutes + sessionStats(tpls.b, lib).minutes) / 2);
    expect(stageMinutes(stage, tpls, lib)).toBe(expected);
  });

  it('0 sin sesiones', () => {
    expect(stageMinutes({ days: [] }, tpls, lib)).toBe(0);
  });
});

describe('stageSetsByGroup', () => {
  it('series previstas por grupo, de más a menos; custom va a other', () => {
    expect(stageSetsByGroup(stage, tpls, lib)).toEqual([
      { group: 'quads', sets: 4 },
      { group: 'biceps', sets: 3 },
      { group: 'chest', sets: 3 },
      { group: 'other', sets: 2 },
    ]);
  });

  it('una plantilla que falta no rompe', () => {
    expect(stageSetsByGroup({ days: [{ sessionTemplateId: 'zz' }] }, tpls, lib)).toEqual([]);
  });
});

describe('stageBaseIdx', () => {
  const stages = [{ id: 's1' }, { id: 's2', derivedFromStageId: 's1' }, { id: 's3' }, { id: 's4', derivedFromStageId: 'gone' }];
  it('la etapa de la que salió', () => expect(stageBaseIdx(stages, 1)).toBe(0));
  it('null si es a mano', () => expect(stageBaseIdx(stages, 2)).toBeNull());
  it('null si su base ya no existe', () => expect(stageBaseIdx(stages, 3)).toBeNull());
});

describe('stageRangeLabel', () => {
  // `t` de mentira: devuelve la clave con sus valores, basta para ver qué rama sale.
  const t = (k, v) => `${k.split('.').pop()} ${Object.values(v ?? {}).join('-')}`.trim();
  const stages = [{ durationWeeks: 4 }, { durationWeeks: 1 }, { durationWeeks: null }, { durationWeeks: 3 }, { durationWeeks: null }];
  const ranges = stageWeekRanges(stages);
  const label = (i) => stageRangeLabel(stages[i], ranges[i], t);
  it('tramo', () => expect(label(0)).toBe('stageRange 1-4'));
  it('una semana', () => expect(label(1)).toBe('stageRangeOne 5'));
  it('sin límite', () => expect(label(2)).toBe('stageRangeOpen 6'));
  it('tras una sin límite, su duración', () => expect(label(3)).toBe('stageRangeWeeks 3'));
  it('sin límite tras otra sin límite', () => expect(label(4)).toBe('weeksOpen'));
});
