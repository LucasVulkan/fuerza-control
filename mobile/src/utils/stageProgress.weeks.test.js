// El modelo de semanas (docs/specs/weeks-model.md). Vive aparte de
// stageProgress.test.js para que la P37, al borrar los ciclos, no toque esto.
import { describe, it, expect } from 'vitest';
import {
  localDay, addDays, daysBetween, weekOne, stageDaysPerWeek, athleteProgress, recordSession,
  stageReset, stageStatus, fromLegacyProgress,
} from './stageProgress';

describe('fechas locales', () => {
  it('localDay da el día del calendario local', () => {
    expect(localDay(new Date(2026, 9, 25, 0, 30).getTime())).toBe('2026-10-25');
    expect(localDay(new Date(2026, 11, 31, 23, 59).getTime())).toBe('2026-12-31');
  });

  it('addDays y daysBetween no se enteran del cambio de hora', () => {
    // 25-oct-2026 y 28-mar-2027: cambios de hora en España.
    expect(addDays('2026-10-24', 1)).toBe('2026-10-25');
    expect(daysBetween('2026-10-19', '2026-10-26')).toBe(7);
    expect(daysBetween('2027-03-22', '2027-03-29')).toBe(7);
    expect(addDays('2026-12-28', 7)).toBe('2027-01-04');
    expect(addDays('2026-09-07', -14)).toBe('2026-08-24');
  });
});

describe('weekOne — la semana 1 empieza en el lunes más cercano', () => {
  it.each([
    ['2026-09-21', '2026-09-21'],   // lunes
    ['2026-09-22', '2026-09-21'],   // martes
    ['2026-09-23', '2026-09-21'],   // miércoles: aún cuenta esta semana
    ['2026-09-24', '2026-09-28'],   // jueves: ya la siguiente
    ['2026-09-25', '2026-09-28'],
    ['2026-09-26', '2026-09-28'],
    ['2026-09-27', '2026-09-28'],   // domingo
  ])('%s → %s', (day, monday) => {
    expect(weekOne(day)).toBe(monday);
  });

  it('cruza fin de mes y fin de año', () => {
    expect(weekOne('2026-09-30')).toBe('2026-09-28');
    expect(weekOne('2026-10-01')).toBe('2026-10-05');
    expect(weekOne('2026-12-30')).toBe('2026-12-28');
    expect(weekOne('2027-01-01')).toBe('2027-01-04');
  });

  it('sin fecha no hay semana', () => {
    expect(weekOne(null)).toBeNull();
  });
});

describe('stageDaysPerWeek', () => {
  it('el valor fijado manda', () => {
    expect(stageDaysPerWeek({ daysPerWeek: 2, days: [{}, {}, {}] })).toBe(2);
  });

  it('sin fijar, tantos como sesiones — y sigue a las sesiones si cambian', () => {
    expect(stageDaysPerWeek({ days: [{}, {}, {}] })).toBe(3);
    expect(stageDaysPerWeek({ days: [{}, {}, {}, {}] })).toBe(4);
  });

  it('siempre entre 1 y 7', () => {
    expect(stageDaysPerWeek({ days: [] })).toBe(1);
    expect(stageDaysPerWeek(null)).toBe(1);
    expect(stageDaysPerWeek({ days: Array(9).fill({}) })).toBe(7);
  });
});

describe('athleteProgress — la única puerta para leer el progreso', () => {
  const program = {
    id: 'p1', stages: [{}, {}, {}],
    currentStageIndex: 0, stageStartedOn: '2026-09-01', stageSessionsDone: 3,
  };

  it('en el móvil del atleta, los campos del programa', () => {
    expect(athleteProgress(program)).toEqual({
      currentStageIndex: 0, stageStartedOn: '2026-09-01', stageSessionsDone: 3,
      stageExtraWeeks: 0, programStartedOn: null,
    });
  });

  it('en el del entrenador, el blob del cliente — no su copia del programa', () => {
    const client = { progress: {
      programId: 'p1', currentStageIndex: 2, stageStartedOn: '2026-09-21',
      stageSessionsDone: 5, stageExtraWeeks: 1, programStartedOn: '2026-07-06',
    } };
    expect(athleteProgress(program, client)).toEqual({
      currentStageIndex: 2, stageStartedOn: '2026-09-21', stageSessionsDone: 5,
      stageExtraWeeks: 1, programStartedOn: '2026-07-06',
    });
  });

  it('un blob de otro programa no se adopta', () => {
    const client = { progress: { programId: 'p_otro', currentStageIndex: 2, stageSessionsDone: 9 } };
    expect(athleteProgress(program, client).stageSessionsDone).toBe(3);
  });

  it('recorta la etapa si el programa encogió', () => {
    const client = { progress: { programId: 'p1', currentStageIndex: 7 } };
    expect(athleteProgress(program, client).currentStageIndex).toBe(2);
  });

  it('un programa sin entrenar sale a cero y sin fechas', () => {
    expect(athleteProgress({ id: 'p2' })).toEqual({
      currentStageIndex: 0, stageStartedOn: null, stageSessionsDone: 0,
      stageExtraWeeks: 0, programStartedOn: null,
    });
  });
});

describe('recordSession y stageReset — lo que se escribe', () => {
  it('la primera sesión fija el inicio de la etapa y el del programa', () => {
    expect(recordSession({}, { inCurrentStage: true, today: '2026-09-24' })).toEqual({
      stageSessionsDone: 1, stageStartedOn: '2026-09-24', programStartedOn: '2026-09-24',
    });
  });

  it('las siguientes solo suman; las fechas no se mueven', () => {
    const p = { stageSessionsDone: 4, stageStartedOn: '2026-09-01', programStartedOn: '2026-06-01' };
    expect(recordSession(p, { inCurrentStage: true, today: '2026-09-24' })).toEqual({
      stageSessionsDone: 5, stageStartedOn: '2026-09-01', programStartedOn: '2026-06-01',
    });
  });

  it('repetir una sesión también cuenta: la fecha es la que manda', () => {
    let p = {};
    for (let i = 0; i < 3; i++) p = { ...p, ...recordSession(p, { inCurrentStage: true, today: '2026-09-24' }) };
    expect(p.stageSessionsDone).toBe(3);
  });

  it('una sesión fuera de la etapa en curso no toca nada', () => {
    expect(recordSession({ stageSessionsDone: 4 }, { inCurrentStage: false, today: '2026-09-24' })).toEqual({});
  });

  it('cambiar de etapa la deja sin empezar y no toca el inicio del programa', () => {
    expect(stageReset(2)).toEqual({
      currentStageIndex: 2, stageStartedOn: null, stageSessionsDone: 0, stageExtraWeeks: 0,
    });
    expect(stageReset(2)).not.toHaveProperty('programStartedOn');
  });
});

describe('stageStatus — dónde va la etapa', () => {
  const sessions = (n) => Array.from({ length: n }, (_, i) => ({ sessionTemplateId: `t${i}` }));
  const program = { id: 'p1', stages: [
    { durationWeeks: 4, days: sessions(3) },                  // 3 días (por defecto)
    { durationWeeks: 3, daysPerWeek: 2, days: sessions(3) },  // 3 sesiones, 2 días
    { durationWeeks: null, days: sessions(3) },               // sin límite
  ] };
  // Etapa 1 empezada el lunes 21-sep: termina el lunes 19-oct.
  const at = (extra = {}) => ({
    currentStageIndex: 0, stageStartedOn: '2026-09-21', stageSessionsDone: 0,
    stageExtraWeeks: 0, programStartedOn: '2026-09-21', ...extra,
  });

  it('sin empezar: semana 1, sin fin ni aviso', () => {
    const s = stageStatus(program, { currentStageIndex: 0, stageSessionsDone: 0 }, '2026-10-30');
    expect(s).toMatchObject({ started: false, weekInStage: 1, ended: false, earlyReady: false, endsOn: null, expected: 12 });
  });

  it('cuenta las semanas desde el lunes de la semana 1', () => {
    expect(stageStatus(program, at(), '2026-09-21').weekInStage).toBe(1);
    expect(stageStatus(program, at(), '2026-09-27').weekInStage).toBe(1);
    expect(stageStatus(program, at(), '2026-09-28').weekInStage).toBe(2);
    expect(stageStatus(program, at(), '2026-10-14').weekInStage).toBe(4);
  });

  it('empezada en jueves, la semana 1 es la siguiente', () => {
    const p = at({ stageStartedOn: '2026-09-24' });
    expect(stageStatus(program, p, '2026-09-26').weekInStage).toBe(1);
    expect(stageStatus(program, p, '2026-10-05').weekInStage).toBe(2);
    expect(stageStatus(program, p, '2026-10-05').endsOn).toBe('2026-10-26');
  });

  it('termina el lunes siguiente a su última semana', () => {
    expect(stageStatus(program, at(), '2026-10-18').ended).toBe(false);
    const s = stageStatus(program, at(), '2026-10-19');
    expect(s.ended).toBe(true);
    expect(s.endsOn).toBe('2026-10-19');
  });

  it.each([
    [12, 0], [11, 0],   // una sesión de menos no pide nada: tolerancia del redondeo
    [10, 1], [9, 1], [6, 2], [0, 4],
  ])('con %i de 12 sesiones propone alargar %i semanas', (done, weeks) => {
    expect(stageStatus(program, at({ stageSessionsDone: done }), '2026-10-19').missingWeeks).toBe(weeks);
  });

  it('las semanas añadidas alargan la etapa pero no suben lo esperado', () => {
    const alargada = at({ stageSessionsDone: 10, stageExtraWeeks: 1 });
    const s = stageStatus(program, alargada, '2026-10-19');
    expect(s).toMatchObject({ lengthWeeks: 5, expected: 12, ended: false, endsOn: '2026-10-26' });
    // Entrena la semana añadida entera: al acabarla, sin déficit.
    const recuperada = stageStatus(program, { ...alargada, stageSessionsDone: 13 }, '2026-10-26');
    expect(recuperada.ended).toBe(true);
    expect(recuperada.missingWeeks).toBe(0);
  });

  it('avance anticipado: última semana y todas las esperadas hechas', () => {
    expect(stageStatus(program, at({ stageSessionsDone: 12 }), '2026-10-14').earlyReady).toBe(true);
    expect(stageStatus(program, at({ stageSessionsDone: 11 }), '2026-10-14').earlyReady).toBe(false);
    // Hacerlas todas antes de la última semana no adelanta nada.
    expect(stageStatus(program, at({ stageSessionsDone: 12 }), '2026-10-07').earlyReady).toBe(false);
    // Terminada ya no es anticipada.
    expect(stageStatus(program, at({ stageSessionsDone: 12 }), '2026-10-19').earlyReady).toBe(false);
  });

  it('tras alargar para recuperar, el anticipado vuelve a valer en la nueva última semana', () => {
    const p = at({ stageSessionsDone: 12, stageExtraWeeks: 1 });
    expect(stageStatus(program, p, '2026-10-20').earlyReady).toBe(true);
  });

  it('lo esperado usa los entrenos por semana de la etapa, no sus sesiones', () => {
    const s = stageStatus(program, at({ currentStageIndex: 1, stageSessionsDone: 5 }), '2026-10-12');
    expect(s).toMatchObject({ daysPerWeek: 2, expected: 6, ended: true, missingWeeks: 1 });
  });

  it('sin límite: la semana sube y nunca termina', () => {
    const s = stageStatus(program, at({ currentStageIndex: 2, stageSessionsDone: 40 }), '2027-01-04');
    expect(s).toMatchObject({
      weekInStage: 16, lengthWeeks: null, expected: null, ended: false, earlyReady: false, endsOn: null, isLast: true,
    });
  });

  it('una etapa terminada y sin avanzar sigue contando semanas', () => {
    expect(stageStatus(program, at(), '2026-11-02').weekInStage).toBe(7);
  });

  it('isLast solo en la última etapa', () => {
    expect(stageStatus(program, at(), '2026-09-21').isLast).toBe(false);
    expect(stageStatus(program, at({ currentStageIndex: 2 }), '2026-09-21').isLast).toBe(true);
  });

  it('semana del programa desde su primera sesión', () => {
    const p = at({ programStartedOn: '2026-09-01' });   // martes → semana 1 = lunes 31-ago
    expect(stageStatus(program, p, '2026-09-24').programWeek).toBe(4);
    expect(stageStatus(program, at({ programStartedOn: null }), '2026-09-24').programWeek).toBeNull();
  });

  it('recorta un índice fuera de rango', () => {
    expect(stageStatus(program, at({ currentStageIndex: 9 }), '2026-09-21').stageIdx).toBe(2);
  });

  it('entrenador y cliente calculan lo mismo con el mismo progreso', () => {
    // El entrenador tiene su copia en otra etapa y sin contadores; lee el blob.
    const blob   = { programId: 'p1', ...at({ stageSessionsDone: 7 }) };
    const mirror = athleteProgress({ ...program, currentStageIndex: 2 }, { progress: blob });
    const own    = athleteProgress({ ...program, ...at({ stageSessionsDone: 7 }) });
    expect(stageStatus(program, mirror, '2026-10-05')).toEqual(stageStatus(program, own, '2026-10-05'));
  });
});

describe('fromLegacyProgress — de ciclos a semanas', () => {
  // Viernes 25-sep-2026: el lunes de esta semana es el 21.
  const TODAY = '2026-09-25';

  it('convierte ciclos en sesiones y en fechas hacia atrás desde el lunes', () => {
    const legacy = {
      id: 'p1', currentStageIndex: 1, cycleCompletedIds: ['a'],
      stageWeeksCompleted: 2, totalWeeksCompleted: 5, stageAdvancePending: false,
    };
    const p = fromLegacyProgress(legacy, 3, TODAY);
    expect(p).toEqual({
      id: 'p1', currentStageIndex: 1,
      stageSessionsDone: 7, stageStartedOn: '2026-09-07', stageExtraWeeks: 0, programStartedOn: '2026-08-17',
    });
    // Dos ciclos cerrados = va por la semana 3, también un viernes.
    const program = { stages: [{}, { durationWeeks: 4, days: [{}, {}, {}] }] };
    expect(stageStatus(program, p, TODAY).weekInStage).toBe(3);
    expect(stageStatus(program, p, TODAY).programWeek).toBe(6);
  });

  it('conserva lo que no es progreso (el blob sigue siendo un blob)', () => {
    const blob = { programId: 'p1', appliedActivation: 'T1', updatedAt: 'x', stageWeeksCompleted: 0, cycleCompletedIds: [] };
    expect(fromLegacyProgress(blob, 3, TODAY)).toMatchObject({ programId: 'p1', appliedActivation: 'T1', updatedAt: 'x' });
  });

  it('sin nada entrenado, sin fechas', () => {
    expect(fromLegacyProgress({ id: 'p1' }, 3, TODAY)).toEqual({
      id: 'p1', stageSessionsDone: 0, stageStartedOn: null, stageExtraWeeks: 0, programStartedOn: null,
    });
  });

  it('una rotación abierta en la primera semana ya cuenta como empezada', () => {
    const p = fromLegacyProgress({ cycleCompletedIds: ['a', 'b'], stageWeeksCompleted: 0, totalWeeksCompleted: 0 }, 3, TODAY);
    expect(p).toMatchObject({ stageSessionsDone: 2, stageStartedOn: '2026-09-21', programStartedOn: '2026-09-21' });
  });

  it('es idempotente: lo ya migrado vuelve tal cual', () => {
    const migrado = { id: 'p1', stageSessionsDone: 4, stageStartedOn: '2026-09-01' };
    expect(fromLegacyProgress(migrado, 3, TODAY)).toBe(migrado);
    expect(fromLegacyProgress(null, 3, TODAY)).toBeNull();
  });
});
