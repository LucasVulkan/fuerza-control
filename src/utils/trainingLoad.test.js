import { describe, it, expect } from 'vitest';
import {
  blockActiveSec, modelSec, sessionMinutes, internalLoad,
  isBodyweight, effectiveWeight, sessionLoads, dailySeries,
  rollingMean, monotony, strain, loadState, setsByMuscleGroup,
  weeklySeries, indexTo100, effortTrend, performanceWeekly, weeklyStrain,
  REF_WEEKS, BLOCK_LOAD_PER_SEC,
} from './trainingLoad';
import { EXERCISE_LIBRARY } from '../data/exerciseLibrary';

const DAY  = 86400000;
const WEEK = 7 * DAY;
// Mediodía local, para que sumar/restar días nunca cruce una medianoche por
// accidente en los tests de serie diaria.
const T0 = new Date(2026, 0, 5, 12, 0, 0).getTime(); // lunes 5 ene 2026

const set = (weight, reps, extra = {}) => ({ weight: String(weight), reps: String(reps), done: true, ...extra });

/** Sesión mínima: un ejercicio, series dadas. */
function entry({ id = 'log_1', ts = T0, exerciseId = 'squat_barbell', sets = [], ...rest }) {
  return {
    id,
    timestamp: ts,
    duration:  0,
    exercises: [{ exerciseId, sets, restSec: 90 }],
    ...rest,
  };
}

// ── Duración ──────────────────────────────────────────────────────────────────

describe('modelSec', () => {
  it('suma trabajo + descanso por serie, transición por ejercicio y calentamiento de sesión', () => {
    const e = entry({ sets: [set(100, 5), set(100, 5)] });
    // 2 × (35 + 90) + 180 (transición) + 480 (calentamiento) = 910
    expect(modelSec(e)).toBe(910);
  });

  it('usa el tiempo REAL de las series de tiempo, no los 35 s por defecto', () => {
    const e = entry({ sets: [{ time: '60', done: true }] });
    expect(modelSec(e)).toBe(60 + 90 + 180 + 480);
  });

  it('cae a 90 s de descanso cuando el log no lo trae (ad-hoc)', () => {
    const e = { id: 'l', timestamp: T0, duration: 0, exercises: [{ exerciseId: 'x', isAdHoc: true, sets: [set(20, 10)] }] };
    expect(modelSec(e)).toBe(35 + 90 + 180 + 480);
  });

  it('ignora ejercicios sin series y devuelve 0 en una sesión vacía', () => {
    expect(modelSec({ exercises: [{ exerciseId: 'x', sets: [] }] })).toBe(0);
    expect(modelSec({})).toBe(0);
  });

  it('suma los bloques con su transición', () => {
    const e = {
      timestamp: T0,
      exercises: [],
      blocks: [{ format: 'amrap', capSec: 600, result: { rounds: 5 } }],
    };
    expect(modelSec(e)).toBe(600 + 180 + 480);
  });
});

describe('blockActiveSec', () => {
  it('for-time usa el tiempo real conseguido, no el cap', () => {
    expect(blockActiveSec({ format: 'for_time', capSec: 900, result: { timeSec: 412 } })).toBe(412);
  });
  it('amrap usa su cap y emom su duración total', () => {
    expect(blockActiveSec({ format: 'amrap', capSec: 600 })).toBe(600);
    expect(blockActiveSec({ format: 'emom', intervalSec: 60, rounds: 10, emomMode: 'all' })).toBe(600);
  });
});

describe('sessionMinutes — reloj de pared acotado por el modelo', () => {
  const sets = [set(100, 5), set(100, 5)];          // modelo = 910 s ≈ 15.17 min
  const model = 910 / 60;

  it('respeta el reloj cuando es plausible', () => {
    const e = entry({ sets, duration: 18 * 60000 });
    expect(sessionMinutes(e)).toBe(18);
  });

  it('recorta un reloj disparado (sesión olvidada abierta 3 h)', () => {
    const e = entry({ sets, duration: 180 * 60000 });
    expect(sessionMinutes(e)).toBeCloseTo(model * 2, 6);
  });

  it('levanta un reloj imposiblemente corto', () => {
    const e = entry({ sets, duration: 60000 });
    expect(sessionMinutes(e)).toBeCloseTo(model * 0.5, 6);
  });

  it('con duration 0 (sesión sin startedAt) no da 0 ni NaN', () => {
    const m = sessionMinutes(entry({ sets, duration: 0 }));
    expect(m).toBeGreaterThan(0);
    expect(Number.isNaN(m)).toBe(false);
  });

  it('sesión vacía → 0', () => {
    expect(sessionMinutes({ exercises: [], duration: 5000 })).toBe(0);
  });
});

// ── Carga interna ─────────────────────────────────────────────────────────────

describe('internalLoad', () => {
  it('es sRPE × minutos', () => {
    const e = entry({ sets: [set(100, 5), set(100, 5)], duration: 20 * 60000, sessionRpe: 7 });
    expect(internalLoad(e)).toBeCloseTo(7 * 20, 6);
  });

  it('es null (hueco) sin sRPE, nunca 0', () => {
    expect(internalLoad(entry({ sets: [set(100, 5)], duration: 20 * 60000 }))).toBeNull();
  });

  it('sRPE 0 es un valor, no una ausencia', () => {
    const e = entry({ sets: [set(100, 5)], duration: 20 * 60000, sessionRpe: 0 });
    expect(internalLoad(e)).toBe(0);
  });
});

// ── Peso efectivo ─────────────────────────────────────────────────────────────

describe('isBodyweight — contra la librería real', () => {
  it('clasifica bien los casos que importan', () => {
    expect(isBodyweight(EXERCISE_LIBRARY.push_up)).toBe(true);          // equipment []
    expect(isBodyweight(EXERCISE_LIBRARY.pull_up_neutral)).toBe(true);  // ['pullup_bar']
    expect(isBodyweight(EXERCISE_LIBRARY.pull_up_weighted)).toBe(true); // + weight_belt
    expect(isBodyweight(EXERCISE_LIBRARY.pull_up_assisted)).toBe(true); // + goma
    expect(isBodyweight(EXERCISE_LIBRARY.squat_barbell)).toBe(false);
    expect(isBodyweight(EXERCISE_LIBRARY.bench_press_barbell)).toBe(false);
  });

  it('un ejercicio desconocido NO es peso corporal (default seguro)', () => {
    expect(isBodyweight(undefined)).toBe(false);
    expect(effectiveWeight(set(100, 5), undefined, 80)).toBe(100);
  });
});

describe('effectiveWeight', () => {
  it('equipo con carga: el peso registrado', () => {
    expect(effectiveWeight(set(100, 5), EXERCISE_LIBRARY.squat_barbell, 80)).toBe(100);
  });

  it('peso corporal: el cuerpo, más el lastre si lo hay', () => {
    expect(effectiveWeight({ reps: '10' }, EXERCISE_LIBRARY.push_up, 80)).toBe(80);
    expect(effectiveWeight(set(10, 5), EXERCISE_LIBRARY.pull_up_weighted, 80)).toBe(90);
  });

  it('asistido: el peso registrado es AYUDA, se resta', () => {
    expect(effectiveWeight(set(20, 8), EXERCISE_LIBRARY.pull_up_assisted, 80)).toBe(60);
  });

  it('asistencia mayor que el peso corporal no da negativo', () => {
    expect(effectiveWeight(set(200, 8), EXERCISE_LIBRARY.pull_up_assisted, 80)).toBe(0);
  });

  it('sin peso corporal, el ejercicio de peso corporal no computa', () => {
    expect(effectiveWeight({ reps: '10' }, EXERCISE_LIBRARY.push_up, null)).toBeNull();
  });

  it('serie sin peso en un ejercicio con carga: no computa', () => {
    expect(effectiveWeight({ reps: '10' }, EXERCISE_LIBRARY.squat_barbell, 80)).toBeNull();
  });
});

// ── Carga externa ─────────────────────────────────────────────────────────────

const LIB = EXERCISE_LIBRARY;

describe('sessionLoads — carga externa relativa', () => {
  it('una serie vale reps × (peso / referencia)', () => {
    // Sesión 1 establece la referencia: 100×5 → e1RM 100×(1+5/30) = 116.67
    const s1 = entry({ id: 'a', ts: T0, sets: [set(100, 5)] });
    // Sesión 2, una semana después, mismo peso y reps.
    const s2 = entry({ id: 'b', ts: T0 + WEEK, sets: [set(100, 5)] });
    const [, second] = sessionLoads([s1, s2], LIB);
    const ref = 100 * (1 + 5 / 30);
    expect(second.external).toBeCloseTo(5 * (100 / ref), 6);
    expect(second.partial).toBe(false);
  });

  it('las sub-series de un dropset cuentan', () => {
    const withDrop = entry({
      id: 'a', ts: T0,
      sets: [set(100, 5, { drops: [{ weight: '80', reps: '5', done: true }] })],
    });
    const plain = entry({ id: 'b', ts: T0, sets: [set(100, 5)] });
    const [a] = sessionLoads([withDrop], LIB);
    const [b] = sessionLoads([plain], LIB);
    expect(a.external).toBeGreaterThan(b.external);
  });

  it('los ejercicios de peso corporal computan gracias al peso del día', () => {
    const e = { ...entry({ id: 'a', ts: T0, exerciseId: 'push_up', sets: [set('', 20)] }), bodyWeight: 80 };
    const [l] = sessionLoads([e], LIB);
    expect(l.external).toBeGreaterThan(0);
    expect(l.partial).toBe(false);
  });

  it('sin peso corporal, esos mismos ejercicios dejan la sesión parcial', () => {
    const e = entry({ id: 'a', ts: T0, exerciseId: 'push_up', sets: [set('', 20)] });
    const [l] = sessionLoads([e], LIB);
    expect(l.external).toBeNull();
    expect(l.partial).toBe(true);
  });

  it('fallbackBodyWeight rescata el histórico previo a la captura de peso', () => {
    const e = entry({ id: 'a', ts: T0, exerciseId: 'push_up', sets: [set('', 20)] });
    const [l] = sessionLoads([e], LIB, { fallbackBodyWeight: 80 });
    expect(l.external).toBeGreaterThan(0);
    expect(l.partial).toBe(false);
  });

  it('las series de tiempo no computan, pero tampoco marcan la sesión parcial', () => {
    const e = entry({ id: 'a', ts: T0, exerciseId: 'plank', sets: [{ time: '60', done: true }], });
    const [l] = sessionLoads([e], LIB);
    expect(l.external).toBeNull();
    expect(l.partial).toBe(false);
  });

  it('un accesorio de más de 12 reps SÍ cuenta: no crea referencia, pero la usa', () => {
    // La sesión 1 fija la referencia con una serie de 8; la 2 son 15 reps.
    const s1 = entry({ id: 'a', ts: T0, exerciseId: 'squat_barbell', sets: [set(100, 8)] });
    const s2 = entry({ id: 'b', ts: T0 + WEEK, exerciseId: 'squat_barbell', sets: [set(60, 15)] });
    const [, second] = sessionLoads([s1, s2], LIB);
    const ref = 100 * (1 + 8 / 30);
    expect(second.external).toBeCloseTo(15 * (60 / ref), 6);
  });

  it('un ejercicio SIEMPRE por encima de 12 reps cae al peso máximo visto', () => {
    // Epley nunca da e1RM aquí, así que la referencia es el propio peso máximo.
    const e = entry({ id: 'a', ts: T0, exerciseId: 'squat_barbell', sets: [set(50, 20)] });
    const [l] = sessionLoads([e], LIB);
    expect(l.external).toBeCloseTo(20 * (50 / 50), 6);
    expect(l.partial).toBe(false);
  });

  it('los bloques aportan carga por su duración activa', () => {
    const e = { id: 'a', timestamp: T0, duration: 0, exercises: [], blocks: [{ format: 'amrap', capSec: 600, result: { rounds: 5 } }] };
    const [l] = sessionLoads([e], LIB);
    expect(l.external).toBeCloseTo(600 * BLOCK_LOAD_PER_SEC, 6);
  });
});

describe('referencia de 1RM — corte por sesión', () => {
  const mk = (id, ts, w, r) => entry({ id, ts, exerciseId: 'squat_barbell', sets: [set(w, r)] });

  it('el histórico es inmutable: un PR posterior no reescribe la carga anterior', () => {
    const past = [mk('a', T0, 100, 5), mk('b', T0 + WEEK, 100, 5)];
    const withPR = [...past, mk('c', T0 + 2 * WEEK, 150, 5)];
    const before = sessionLoads(past, LIB);
    const after  = sessionLoads(withPR, LIB);
    expect(after[0].external).toBeCloseTo(before[0].external, 9);
    expect(after[1].external).toBeCloseTo(before[1].external, 9);
  });

  it('una referencia más vieja que la ventana ya no cuenta', () => {
    const old   = mk('a', T0, 200, 5);                             // referencia alta
    const recent = mk('b', T0 + (REF_WEEKS + 1) * WEEK, 100, 5);   // fuera de ventana
    const [, second] = sessionLoads([old, recent], LIB);
    // Cae a la e1RM de la propia sesión → ratio idéntico al de una sesión suelta.
    const [alone] = sessionLoads([mk('b', T0, 100, 5)], LIB);
    expect(second.external).toBeCloseTo(alone.external, 9);
  });

  it('la ventana toma el MEJOR e1RM, no el último', () => {
    const strong = mk('a', T0, 150, 5);
    const light  = mk('b', T0 + WEEK, 80, 5);
    const today  = mk('c', T0 + 2 * WEEK, 100, 5);
    const [, , third] = sessionLoads([strong, light, today], LIB);
    const ref = 150 * (1 + 5 / 30);
    expect(third.external).toBeCloseTo(5 * (100 / ref), 6);
  });
});

// ── Serie diaria ──────────────────────────────────────────────────────────────

describe('dailySeries', () => {
  const mk = (id, ts, rpe) => entry({
    id, ts, sets: [set(100, 5)], duration: 20 * 60000, ...(rpe != null ? { sessionRpe: rpe } : {}),
  });

  it('rellena los días de descanso con 0 y no deja huecos de calendario', () => {
    const loads = sessionLoads([mk('a', T0, 7), mk('b', T0 + 3 * DAY, 8)], LIB);
    const series = dailySeries(loads, { now: T0 + 3 * DAY });
    expect(series).toHaveLength(4);
    expect(series.map((d) => d.sessions)).toEqual([1, 0, 0, 1]);
    expect(series[1].internal).toBe(0);
    expect(series[1].external).toBe(0);
  });

  it('un día CON sesión pero sin sRPE deja hueco (null), no 0', () => {
    const loads = sessionLoads([mk('a', T0)], LIB);
    const [day] = dailySeries(loads, { now: T0 });
    expect(day.sessions).toBe(1);
    expect(day.internal).toBeNull();
    expect(day.external).toBeGreaterThan(0);
  });

  it('suma dos sesiones del mismo día', () => {
    const loads = sessionLoads([mk('a', T0, 7), mk('b', T0 + 3600000, 5)], LIB);
    const [day] = dailySeries(loads, { now: T0 });
    expect(day.sessions).toBe(2);
    expect(day.internal).toBeCloseTo(7 * 20 + 5 * 20, 6);
  });

  it('llega hasta hoy aunque la última sesión sea antigua', () => {
    const loads = sessionLoads([mk('a', T0, 7)], LIB);
    expect(dailySeries(loads, { now: T0 + 10 * DAY })).toHaveLength(11);
  });

  it('cuenta bien los días cruzando un cambio de hora', () => {
    // Cambio de hora en España: 29 mar 2026. 20 días alrededor.
    const start = new Date(2026, 2, 20, 12, 0, 0).getTime();
    const end   = new Date(2026, 3, 8, 12, 0, 0).getTime();
    const loads = sessionLoads([mk('a', start, 7)], LIB);
    const series = dailySeries(loads, { now: end });
    expect(series).toHaveLength(20);
    // Todos los puntos siguen siendo medianoche local exacta.
    expect(series.every((d) => new Date(d.day).getHours() === 0)).toBe(true);
  });

  it('log vacío → serie vacía', () => {
    expect(dailySeries([], { now: T0 })).toEqual([]);
  });
});

// ── Agregados ─────────────────────────────────────────────────────────────────

describe('rollingMean', () => {
  it('usa ventana expansiva antes de tener n puntos', () => {
    expect(rollingMean([2, 4, 6], 7)).toEqual([2, 3, 4]);
  });

  it('promedia solo los n últimos una vez hay historial', () => {
    expect(rollingMean([10, 0, 0, 0], 2)).toEqual([10, 5, 0, 0]);
  });

  it('excluye los null en vez de contarlos como 0', () => {
    expect(rollingMean([10, null, 20], 3)).toEqual([10, 10, 15]);
  });

  it('devuelve null mientras no haya ningún valor', () => {
    expect(rollingMean([null, null], 7)).toEqual([null, null]);
  });
});

describe('monotony / strain', () => {
  it('carga plana = monotonía altísima', () => {
    const flat = monotony([100, 100, 100, 100, 100, 100, 90]);
    const varied = monotony([200, 0, 150, 0, 180, 0, 100]);
    expect(flat).toBeGreaterThan(varied);
  });

  it('null si la desviación es 0 (semana entera de descanso o idéntica)', () => {
    expect(monotony([0, 0, 0, 0, 0, 0, 0])).toBeNull();
    expect(monotony([50, 50, 50])).toBeNull();
  });

  it('null con menos de 2 días con dato', () => {
    expect(monotony([100])).toBeNull();
    expect(monotony([null, null, 100])).toBeNull();
  });

  it('strain es la carga total por la monotonía', () => {
    const week = [200, 0, 150, 0, 180, 0, 100];
    expect(strain(week)).toBeCloseTo(630 * monotony(week), 6);
  });

  it('strain hereda el null de la monotonía', () => {
    expect(strain([0, 0, 0])).toBeNull();
  });
});

describe('weeklySeries', () => {
  // T0 = lunes 5 ene 2026 12:00
  const day = (i, internal, external, sessions = 1) => ({
    day: new Date(2026, 0, 5 + i).getTime(), internal, external, sessions,
  });

  it('agrupa por semanas naturales de lunes a domingo', () => {
    const out = weeklySeries([
      day(0, 100, 10), day(3, 200, 20),       // semana 1 (lun 5, jue 8)
      day(7, 300, 30),                        // semana 2 (lun 12)
    ]);
    expect(out).toHaveLength(2);
    expect(out[0].internal).toBe(300);
    expect(out[0].external).toBe(30);
    expect(out[0].sessions).toBe(2);
    expect(out[1].internal).toBe(300);
  });

  it('una semana con sesiones pero sin sRPE deja internal null, no 0', () => {
    const out = weeklySeries([day(0, null, 12, 1), day(1, null, 8, 1)]);
    expect(out[0].internal).toBeNull();
    expect(out[0].external).toBe(20);
    expect(out[0].sessions).toBe(2);
  });

  it('una semana entera de descanso sí vale 0', () => {
    const out = weeklySeries([day(0, 0, 0, 0), day(1, 0, 0, 0)]);
    expect(out[0].internal).toBe(0);
    expect(out[0].sessions).toBe(0);
  });

  it('serie vacía → []', () => {
    expect(weeklySeries([])).toEqual([]);
  });
});

describe('weeklyStrain', () => {
  // T0 = lunes 5 ene 2026. `sessions` decide si la semana computa.
  const day = (i, internal, sessions) => ({
    day: new Date(2026, 0, 5 + i).getTime(), internal, external: 0, sessions,
  });
  const week = (offset, loads) => loads.map((v, i) =>
    day(offset + i, v, v > 0 ? 1 : 0));

  it('calcula un strain por semana natural', () => {
    const out = weeklyStrain([
      ...week(0, [200, 0, 150, 0, 180, 0, 0]),   // 3 sesiones
      ...week(7, [300, 0, 250, 0, 280, 0, 0]),   // 3 sesiones
    ]);
    expect(out).toHaveLength(2);
    expect(out[0].sessions).toBe(3);
    expect(out[1].strain).toBeGreaterThan(out[0].strain);
  });

  it('una semana por debajo del mínimo de sesiones deja hueco, no un cero', () => {
    const out = weeklyStrain(week(0, [200, 0, 0, 0, 0, 0, 0]));
    expect(out[0].sessions).toBe(1);
    expect(out[0].strain).toBeNull();
  });

  it('devuelve las semanas ordenadas de más antigua a más reciente', () => {
    const out = weeklyStrain([
      ...week(7, [300, 0, 250, 0, 280, 0, 0]),
      ...week(0, [200, 0, 150, 0, 180, 0, 0]),
    ]);
    expect(out[0].weekStart).toBeLessThan(out[1].weekStart);
  });

  it('serie vacía → []', () => {
    expect(weeklyStrain([])).toEqual([]);
  });
});

describe('indexTo100', () => {
  it('el primer valor no nulo pasa a ser 100', () => {
    expect(indexTo100([50, 75, 100])).toEqual([100, 150, 200]);
  });

  it('salta los nulos iniciales para elegir la base y los conserva', () => {
    expect(indexTo100([null, 40, 20])).toEqual([null, 100, 50]);
  });

  it('sin ningún valor utilizable devuelve todo null', () => {
    expect(indexTo100([null, 0])).toEqual([null, null]);
    expect(indexTo100([])).toEqual([]);
  });
});

describe('effortTrend', () => {
  // 5 puntos: el último se compara contra el de hace 4 semanas.
  const flat = [100, 100, 100, 100, 100];
  const up   = [100, 105, 110, 115, 130];
  const down = [100, 95,  90,  85,  70];

  it('más trabajo al mismo coste = adaptación', () => {
    expect(effortTrend(up, flat)).toBe('adaptation');
  });

  it('mismo trabajo costando más = fatiga', () => {
    expect(effortTrend(flat, up)).toBe('fatigue');
  });

  it('las dos arriba = bloque duro; las dos abajo = descarga', () => {
    expect(effortTrend(up, up)).toBe('hard');
    expect(effortTrend(down, down)).toBe('deload');
  });

  it('menos trabajo costando lo mismo no es ninguna de las anteriores', () => {
    expect(effortTrend(down, flat)).toBe('mixed');
  });

  it('un pico de una semana no mueve la lectura; un cambio sostenido sí', () => {
    // 8 puntos → compara la media de las 4 últimas contra las 4 anteriores.
    const flat8 = [100, 100, 100, 100, 100, 100, 100, 100];
    const spike = [100, 100, 100, 100, 100, 100, 100, 130]; // +7,5 de media
    const risen = [100, 100, 100, 100, 130, 130, 130, 130]; // +30 de media
    expect(effortTrend(spike, flat8)).toBe('mixed');
    expect(effortTrend(risen, flat8)).toBe('adaptation');
  });

  it('null sin datos suficientes o con huecos en los extremos', () => {
    expect(effortTrend([100], [100])).toBeNull();
    expect(effortTrend([null, 100], [100, 100])).toBeNull();
  });
});

describe('performanceWeekly', () => {
  const sesion = (id, ts, exerciseId, w, r) => ({
    id, timestamp: ts, duration: 0,
    exercises: [{ exerciseId, sets: [set(w, r)], restSec: 120 }],
  });

  it('indexa cada ejercicio contra su propia base y promedia los índices', () => {
    // Sentadilla 100→110 (+10%) y press 50→55 (+10%): la media debe ser 110,
    // no una mezcla de kilos donde la sentadilla mandaría.
    const log = [
      sesion('a', T0,        'squat_barbell',       100, 5),
      sesion('b', T0 + 60000, 'bench_press_barbell', 50, 5),
      sesion('c', T0 + WEEK,        'squat_barbell',       110, 5),
      sesion('d', T0 + WEEK + 60000, 'bench_press_barbell', 55, 5),
    ];
    const out = performanceWeekly(log, EXERCISE_LIBRARY);
    expect(out).toHaveLength(2);
    expect(out[0].index).toBeCloseTo(100, 6);
    expect(out[1].index).toBeCloseTo(110, 6);
    expect(out[1].exercises).toBe(2);
  });

  it('ignora los ejercicios con una sola semana de datos', () => {
    const log = [
      sesion('a', T0,        'squat_barbell', 100, 5),
      sesion('b', T0 + WEEK, 'squat_barbell', 110, 5),
      sesion('c', T0 + WEEK, 'bench_press_barbell', 50, 5), // solo aparece una vez
    ];
    const out = performanceWeekly(log, EXERCISE_LIBRARY);
    expect(out[out.length - 1].exercises).toBe(1);
    expect(out[out.length - 1].index).toBeCloseTo(110, 6);
  });

  it('toma el MEJOR e1RM de cada semana, no el último', () => {
    const log = [
      sesion('a', T0,               'squat_barbell', 100, 5),
      sesion('b', T0 + WEEK,        'squat_barbell', 120, 5),
      sesion('c', T0 + WEEK + DAY,  'squat_barbell',  80, 5), // día flojo
    ];
    const out = performanceWeekly(log, EXERCISE_LIBRARY);
    expect(out[1].index).toBeCloseTo(120, 6);
  });

  it('sin datos suficientes devuelve []', () => {
    expect(performanceWeekly([], EXERCISE_LIBRARY)).toEqual([]);
    expect(performanceWeekly([sesion('a', T0, 'squat_barbell', 100, 5)], EXERCISE_LIBRARY)).toEqual([]);
  });
});

describe('setsByMuscleGroup', () => {
  const ex = (exerciseId, nSets, extra = {}) => ({
    exerciseId,
    sets: Array.from({ length: nSets }, () => ({ ...set(100, 8), ...extra })),
    restSec: 120,
  });
  const sesion = (id, ts, exercises) => ({ id, timestamp: ts, duration: 0, exercises });

  it('agrupa por primaryGroup y ordena de más a menos', () => {
    const log = [sesion('a', T0, [
      ex('squat_barbell', 4),        // quads
      ex('bench_press_barbell', 3),  // chest
      ex('barbell_row', 3),          // back
      ex('romanian_deadlift', 2),    // glutes_hamstrings
    ])];
    expect(setsByMuscleGroup(log, EXERCISE_LIBRARY)).toEqual([
      { group: 'quads', sets: 4 },
      { group: 'chest', sets: 3 },
      { group: 'back',  sets: 3 },
      { group: 'glutes_hamstrings', sets: 2 },
    ]);
  });

  it('suma el mismo grupo entre ejercicios y sesiones distintos', () => {
    const log = [
      sesion('a', T0,        [ex('bench_press_barbell', 3)]),
      sesion('b', T0 + DAY,  [ex('push_up', 2), ex('bench_press_db', 2)]),
    ];
    const chest = setsByMuscleGroup(log, EXERCISE_LIBRARY).find((g) => g.group === 'chest');
    expect(chest.sets).toBe(7);
  });

  it('un dropset cuenta como UNA serie, no como una por sub-serie', () => {
    const withDrops = [sesion('a', T0, [{
      exerciseId: 'bench_press_barbell',
      sets: [set(100, 8, { drops: [{ weight: '80', reps: '6', done: true }, { weight: '60', reps: '6', done: true }] })],
    }])];
    expect(setsByMuscleGroup(withDrops, EXERCISE_LIBRARY)).toEqual([{ group: 'chest', sets: 1 }]);
  });

  it('respeta la ventana temporal', () => {
    const log = [
      sesion('viejo',  T0,            [ex('squat_barbell', 4)]),
      sesion('dentro', T0 + 5 * DAY,  [ex('squat_barbell', 3)]),
    ];
    const out = setsByMuscleGroup(log, EXERCISE_LIBRARY, { from: T0 + DAY, to: T0 + 6 * DAY });
    expect(out).toEqual([{ group: 'quads', sets: 3 }]);
  });

  it('los ejercicios sin grupo o desconocidos caen en "other", no se pierden', () => {
    const log = [sesion('a', T0, [ex('mi_ejercicio_propio', 3), ex('otro_borrado', 2)])];
    const lib = { mi_ejercicio_propio: { primaryGroup: 'custom' } };
    expect(setsByMuscleGroup(log, lib)).toEqual([{ group: 'other', sets: 5 }]);
  });

  it('ignora ejercicios sin series registradas y devuelve [] con un log vacío', () => {
    expect(setsByMuscleGroup([sesion('a', T0, [ex('squat_barbell', 0)])], EXERCISE_LIBRARY)).toEqual([]);
    expect(setsByMuscleGroup([], EXERCISE_LIBRARY)).toEqual([]);
  });
});

describe('loadState', () => {
  it('clasifica descarga / estable / acumulación', () => {
    expect(loadState(50, 100)).toBe('unloading');
    expect(loadState(100, 100)).toBe('steady');
    expect(loadState(130, 100)).toBe('steady');   // 1.3 incluido
    expect(loadState(131, 100)).toBe('loading');
  });

  it('null sin datos suficientes', () => {
    expect(loadState(null, 100)).toBeNull();
    expect(loadState(100, 0)).toBeNull();
  });
});
