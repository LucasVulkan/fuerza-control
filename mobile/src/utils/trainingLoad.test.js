import { describe, it, expect } from 'vitest';
import {
  blockActiveSec, modelSec, sessionMinutes, internalLoad,
  isBodyweight, effectiveWeight, sessionLoads, dailySeries,
  rollingMean, monotony, strain, loadState, setsByMuscleGroup, plannedSetsByGroup,
  weeklySeries, indexTo100, effortTrend, performanceWeekly, weeklyStrain,
  loadSummary, strengthChange, strengthByExercise, meanPct, groupSetsVsPlan, effortBlocks, monotonyStrain,
  effortVsLoad, rpeByExercise, ratedSessions, TREND_FLAT_PCT,
  REF_WEEKS, BLOCK_LOAD_PER_SEC, volumeChange, calendarLoads, weekBlocks,
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
    // 2 × (35 + 90) + 120 (transición) + 480 (calentamiento) = 850
    expect(modelSec(e)).toBe(850);
  });

  it('usa el tiempo REAL de las series de tiempo, no los 35 s por defecto', () => {
    const e = entry({ sets: [{ time: '60', done: true }] });
    expect(modelSec(e)).toBe(60 + 90 + 120 + 480);
  });

  it('cae a 90 s de descanso cuando el log no lo trae (ad-hoc)', () => {
    const e = { id: 'l', timestamp: T0, duration: 0, exercises: [{ exerciseId: 'x', isAdHoc: true, sets: [set(20, 10)] }] };
    expect(modelSec(e)).toBe(35 + 90 + 120 + 480);
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
    expect(modelSec(e)).toBe(600 + 120 + 480);
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
  const sets = [set(100, 5), set(100, 5)];          // modelo = 850 s ≈ 14.17 min
  const model = 850 / 60;

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
    expect(isBodyweight(EXERCISE_LIBRARY.pull_up)).toBe(true);  // ['pullup_bar']
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
    expect(effectiveWeight(set(10, 5), EXERCISE_LIBRARY.pull_up, 80)).toBe(90);
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

  it('un timestamp corrupto no dispara la serie (fallo 21)', () => {
    // Una entrada con `timestamp: 0` colada por un backup generaba un punto por
    // día desde 1970 —unos veinte mil— y todo lo encadenado después
    // (rollingMean, monotony, weeklySeries) recorría esa serie: la pantalla de
    // Carga se congelaba.
    const loads = sessionLoads([mk('corrupta', 0, 7), mk('buena', T0, 8)], LIB);

    const series = dailySeries(loads, { now: T0 });

    expect(series.length).toBeLessThanOrEqual(731);
    // Y sigue llegando hasta hoy, que es lo que la gráfica necesita.
    expect(series.at(-1).day).toBe(new Date(T0).setHours(0, 0, 0, 0));
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

describe('plannedSetsByGroup', () => {
  it('suma las series prescritas de todas las sesiones de la etapa, por grupo', () => {
    const templates = [
      { exercises: [{ exerciseId: 'squat_barbell', sets: 4 }, { exerciseId: 'pull_up', sets: 3 }] },
      { exercises: [{ exerciseId: 'squat_barbell', sets: 2 }] },
    ];
    expect(plannedSetsByGroup(templates, EXERCISE_LIBRARY)).toEqual([
      { group: 'quads', sets: 6 },
      { group: 'back',  sets: 3 },
    ]);
  });

  it('los bloques no suman y el ejercicio sin grupo cae en "other"', () => {
    const templates = [{
      exercises: [{ exerciseId: 'propio', sets: 3 }],
      blocks: [{ format: 'amrap', movements: [{ exerciseId: 'squat_barbell', amount: 10 }] }],
    }];
    expect(plannedSetsByGroup(templates, { propio: { primaryGroup: 'custom' } }))
      .toEqual([{ group: 'other', sets: 3 }]);
  });

  it('sin series efectivas no inventa filas', () => {
    expect(plannedSetsByGroup([{ exercises: [{ exerciseId: 'squat_barbell', sets: 0 }] }], EXERCISE_LIBRARY)).toEqual([]);
    expect(plannedSetsByGroup([], EXERCISE_LIBRARY)).toEqual([]);
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

// ── T11-01: cifra de carga única y fuerza a 4 semanas ───────────────────────────
describe('loadSummary', () => {
  // viernes 9 ene 2026, por la mañana; lunes 5 y miércoles 7 entrenados
  const FRI = new Date(2026, 0, 9, 8, 0, 0).getTime();
  const s = (ts, extra = {}) => entry({ id: `l${ts}`, ts, sets: [set(100, 5)], ...extra });

  it('sin sesión hoy, la serie acaba ayer', () => {
    const r = loadSummary([s(T0, { sessionRpe: 7, duration: 3600 }), s(T0 + 2 * DAY, { sessionRpe: 7, duration: 3600 })], EXERCISE_LIBRARY, { now: FRI });
    expect(r.days[r.days.length - 1].day).toBe(new Date(2026, 0, 8).getTime());
    expect(r.source).toBe('internal');
  });
  it('con sesión hoy, la serie acaba hoy', () => {
    const r = loadSummary([s(T0), s(FRI - 3600000)], EXERCISE_LIBRARY, { now: FRI });
    expect(r.days[r.days.length - 1].day).toBe(new Date(2026, 0, 9).getTime());
  });
  it('sin sRPE usa la externa', () => {
    const r = loadSummary([s(T0), s(T0 + 2 * DAY)], EXERCISE_LIBRARY, { now: FRI });
    expect(r.source).toBe('external');
    expect(Number.isFinite(r.vs28)).toBe(true);
  });
  it('sin log no hay nada', () => {
    const r = loadSummary([], EXERCISE_LIBRARY, { now: FRI });
    expect(r.days).toEqual([]);
    expect(r.vs28).toBeNull();
  });
});

describe('strengthChange', () => {
  const END = new Date(2026, 1, 20).getTime();
  const at = (days, kg, exerciseId) => entry({ id: `e${days}${exerciseId}`, ts: END - days * DAY + 12 * 3600000, exerciseId, sets: [set(kg, 5)] });
  it('media de los cambios por ejercicio con dato en las dos ventanas', () => {
    const log = [at(40, 100, 'squat_barbell'), at(5, 110, 'squat_barbell')];
    expect(strengthChange(log, EXERCISE_LIBRARY, { endDay: END })).toBe(10);
  });
  it('un ejercicio estrenado hace 2 semanas no hunde la cifra', () => {
    const log = [at(40, 100, 'squat_barbell'), at(5, 110, 'squat_barbell'), at(14, 20, 'bench_press_barbell')];
    expect(strengthChange(log, EXERCISE_LIBRARY, { endDay: END })).toBe(10);
  });
  it('sin ventana anterior, null', () => {
    expect(strengthChange([at(5, 110, 'squat_barbell')], EXERCISE_LIBRARY, { endDay: END })).toBeNull();
  });
});

describe('effortBlocks', () => {
  it('media del sRPE del último bloque de 7 días', () => {
    const d = new Date(2026, 0, 9).getTime();
    const days = Array.from({ length: 14 }, (_, i) => ({ day: new Date(2026, 0, 9 - 13 + i).getTime(), value: 0 }));
    const log = [{ timestamp: d - DAY + 3600000, sessionRpe: 8 }, { timestamp: d - 2 * DAY + 3600000, sessionRpe: 7 }];
    const r = effortBlocks(log, days);
    expect(r[r.length - 1]).toBe(7.5);
    expect(r[0]).toBeNull();
  });
});

describe('monotonyStrain', () => {
  // Cada número es la carga de un día (0 = descanso); el último es el último día de la serie.
  const mk = (...vals) => vals.flat().map((v, i) => ({ day: i, value: v, sessions: v > 0 ? 1 : 0 }));
  const P = [0, 100, 0, 100, 0, 100, 0];     // 3 sesiones
  const Q = [0, 1000, 0, 0, 0, 1000, 0];     // 2 sesiones

  it('con 2 sesiones en 7 días no hay monotonía ni strain', () => {
    expect(monotonyStrain(mk(Q))).toEqual({ monotony: null, strain: null, strainPct: null, sessions: 2 });
  });

  it('con 3 sesiones hay monotonía (descansos como 0); sin base no hay %', () => {
    const r = monotonyStrain(mk(P));
    expect(r.sessions).toBe(3);
    expect(r.monotony).toBeCloseTo(0.866, 2);
    expect(r.strain).toBeCloseTo(300 * 0.866, 0);
    expect(r.strainPct).toBeNull();
  });

  it('la base deja fuera el bloque de 2 sesiones', () => {
    // P, Q, P, P, P: si Q entrara en la base, el % no sería 0.
    expect(monotonyStrain(mk(P, Q, P, P, P)).strainPct).toBe(0);
  });

  it('el % compara con la media de la base', () => {
    const P2 = P.map((v) => v * 2);   // misma monotonía, el doble de carga: strain ×2
    expect(monotonyStrain(mk(P, P, P, P, P2)).strainPct).toBe(100);
  });

  it('un hueco (sesión sin sRPE) no cuenta como descanso', () => {
    // 3 sesiones, una sin sRPE: se excluye; con 0 saldría otra monotonía.
    const days = mk(P).map((d, i) => (i === 3 ? { ...d, value: null } : d));
    expect(monotonyStrain(days).monotony).toBeCloseTo(0.707, 2);
  });

  it('sin NaN ni Infinity con ceros', () => {
    expect(monotonyStrain(mk(new Array(35).fill(0)))).toEqual({ monotony: null, strain: null, strainPct: null, sessions: 0 });
    // Base con sesiones pero carga 0: sin desviación, sin base.
    const zeros = Array.from({ length: 7 }, (_, i) => ({ day: i, value: 0, sessions: i % 2 ? 0 : 1 }));
    const days = [...zeros, ...mk(P).map((d, i) => ({ ...d, day: 7 + i }))];
    const r = monotonyStrain(days);
    expect(r.strainPct).toBeNull();
    expect(Number.isFinite(r.strain)).toBe(true);
    expect(monotonyStrain([])).toEqual({ monotony: null, strain: null, strainPct: null, sessions: 0 });
  });
});

// ── T11-04 / T11-05 ───────────────────────────────────────────────────────────

/** Bloques de 7 días: cada uno [externa, interna] (null = sesión sin sRPE; 0 = descanso). */
function daysFrom(blocks) {
  const out = [];
  blocks.forEach(([ext, int], b) => {
    for (let i = 0; i < 7; i++) {
      const train = i === 0 && ext !== 0;
      out.push({
        day: new Date(2026, 0, 1 + b * 7 + i).getTime(),
        sessions: train ? 1 : 0,
        external: train ? ext : 0,
        internal: train ? int : 0,
      });
    }
  });
  return out;
}

describe('effortVsLoad', () => {
  const eight = (a, b) => [...Array(4).fill(a), ...Array(4).fill(b)];

  it('etiqueta los cinco casos', () => {
    expect(effortVsLoad(daysFrom(eight([100, 100], [120, 100]))).chip.label).toBe('adaptation');
    expect(effortVsLoad(daysFrom(eight([100, 100], [100, 120]))).chip.label).toBe('fatigue');
    expect(effortVsLoad(daysFrom(eight([100, 100], [120, 120]))).chip.label).toBe('hard');
    expect(effortVsLoad(daysFrom(eight([100, 100], [80, 80]))).chip.label).toBe('deload');
    expect(effortVsLoad(daysFrom(eight([100, 100], [80, 100]))).chip.label).toBe('mixed');
  });

  it('el chip trae los dos cambios en % y el umbral manda', () => {
    const { chip } = effortVsLoad(daysFrom(eight([100, 100], [108, 102])));
    expect(Math.round(chip.loadPct)).toBe(8);
    expect(Math.round(chip.effortPct)).toBe(2);
    expect(chip.label).toBe('adaptation');
    expect(TREND_FLAT_PCT).toBe(5);
  });

  it('compara 4 contra 4 aunque se pinten pocos bloques (1M)', () => {
    const r = effortVsLoad(daysFrom(eight([100, 100], [120, 100])), { n: 5 });
    expect(r.external).toHaveLength(5);
    expect(r.chip.label).toBe('adaptation');
  });

  it('sin 8 bloques completos no hay chip', () => {
    expect(effortVsLoad(daysFrom(Array(7).fill([100, 100]))).chip).toBeNull();
  });

  it('% desde el primer bloque con datos; descanso = -100 %; sin NaN', () => {
    const r = effortVsLoad(daysFrom([[100, 50], [150, 75], [0, 0]]), { n: 3 });
    expect(r.external).toEqual([0, 50, -100]);
    expect(r.internal).toEqual([0, 50, -100]);
  });

  it('una sesión sin sRPE es desconocida, no cero', () => {
    const r = effortVsLoad(daysFrom([[100, null], [100, 40], [100, 60]]), { n: 3 });
    expect(r.internal).toEqual([null, 0, 50]);
    expect(r.external.every(Number.isFinite)).toBe(true);
  });
});

describe('ratedSessions', () => {
  it('solo con sRPE y dentro de la ventana que acaba en endDay', () => {
    const endDay = new Date(2026, 0, 10).getTime();
    const log = [
      { timestamp: new Date(2026, 0, 10, 9).getTime(), sessionRpe: 8 },
      { timestamp: new Date(2026, 0, 9, 9).getTime() },
      { timestamp: new Date(2026, 0, 1, 9).getTime(), sessionRpe: 6 },
      { timestamp: new Date(2026, 0, 11, 9).getTime(), sessionRpe: 5 },
    ];
    expect(ratedSessions(log, endDay, 7).map((s) => s.rpe)).toEqual([8]);
    expect(ratedSessions(log, endDay, 10).map((s) => s.rpe)).toEqual([6, 8]);
  });
});

describe('rpeByExercise', () => {
  const endDay = new Date(2026, 1, 28).getTime();
  const from = new Date(2026, 0, 1).getTime();
  const at = (m, d) => new Date(2026, m, d, 10).getTime();
  const log = [
    { id: 'a', timestamp: at(0, 5), exercises: [
      { exerciseId: 'easy', sets: [set(50, 10, { rpe: 6 })] },
      { exerciseId: 'hard', sets: [set(100, 5, { rpe: 8 }), set(90, 5, { rpe: 9, drops: [set(60, 8, { rpe: 10 })] })] },
    ] },
    { id: 'b', timestamp: at(1, 26), exercises: [
      { exerciseId: 'easy', sets: [set(50, 10, { rpe: 7 })] },
      { exerciseId: 'hard', sets: [set(100, 5, { rpe: 9 })] },
      { exerciseId: 'norpe', sets: [set(20, 10)] },
    ] },
  ];

  it('medias, series, orden de más duro a más suave y sin los que no tienen RPE', () => {
    const r = rpeByExercise(log, { from, endDay });
    expect(r.map((x) => x.exerciseId)).toEqual(['hard', 'easy']);
    expect(r[0].sets).toBe(3);                       // la sub-serie del dropset no cuenta
    expect(r[0].rpePeriod).toBeCloseTo((8 + 9 + 9) / 3);
    expect(r[0].rpe4w).toBe(9);                      // solo la del 26-feb entra en 28 días
    expect(r[1].rpe4w).toBe(7);
  });

  it('sin RPE en el periodo no sale nada', () => {
    expect(rpeByExercise(log, { from: at(2, 1), endDay: at(2, 20) })).toEqual([]);
  });
});

describe('strengthByExercise', () => {
  const END = new Date(2026, 1, 20).getTime();
  const FROM = END - 89 * DAY;                      // periodo de 90 días
  const at = (days, kg, exerciseId) => entry({ id: `e${days}${exerciseId}`, ts: END - days * DAY + 12 * 3600000, exerciseId, sets: [set(kg, 5)] });
  const log = [
    at(85, 90, 'squat_barbell'), at(40, 100, 'squat_barbell'), at(5, 110, 'squat_barbell'),
    at(10, 60, 'bench_press_barbell'), at(40, 50, 'bench_press_barbell'),
    at(5, 20, 'barbell_row'),                       // solo en la ventana actual
  ];
  const rows = strengthByExercise(log, EXERCISE_LIBRARY, { endDay: END, fromDay: FROM });

  it('pct4w contra los 28 días anteriores y pctPeriod contra los primeros 28 del periodo', () => {
    const squat = rows.find((r) => r.exerciseId === 'squat_barbell');
    expect(squat.pct4w).toBeCloseTo(10, 5);
    expect(squat.pctPeriod).toBeCloseTo((110 / 90 - 1) * 100, 5);
    const bench = rows.find((r) => r.exerciseId === 'bench_press_barbell');
    expect(bench.pct4w).toBeCloseTo(20, 5);
    expect(bench.pctPeriod).toBeNull();             // sin dato en los primeros 28 días
  });
  it('un ejercicio con dato en una sola ventana no sale', () => {
    expect(rows.find((r) => r.exerciseId === 'barbell_row')).toBeUndefined();
  });
  it('va de más a menos por pct4w y el primero es el mejor (1M)', () => {
    expect(rows.map((r) => r.exerciseId)).toEqual(['bench_press_barbell', 'squat_barbell']);
    const m1 = strengthByExercise(log, EXERCISE_LIBRARY, { endDay: END, fromDay: END - 29 * DAY });
    expect(m1[0].exerciseId).toBe('bench_press_barbell');
    expect(m1.every((r) => r.pctPeriod === null)).toBe(true);   // ventanas solapadas
  });
  it('strengthChange es la media redondeada de pct4w', () => {
    const mean = (10 + 20) / 2;
    expect(meanPct(rows, 'pct4w')).toBeCloseTo(mean, 5);
    expect(strengthChange(log, EXERCISE_LIBRARY, { endDay: END })).toBe(15);
    expect(meanPct(rows, 'pctPeriod')).toBeCloseTo((110 / 90 - 1) * 100, 5);
  });
  it('sin endDay, vacío', () => {
    expect(strengthByExercise(log, EXERCISE_LIBRARY, {})).toEqual([]);
  });
});

describe('groupSetsVsPlan', () => {
  const NOW = new Date(2026, 0, 7, 18).getTime();                  // miércoles 7 ene 2026
  const ex = (exerciseId, n) => ({ exerciseId, sets: Array.from({ length: n }, () => set(100, 8)) });
  const ses = (id, ts, exercises) => ({ id, timestamp: ts, duration: 0, exercises });
  const log = [
    ses('prev', T0 - DAY, [ex('squat_barbell', 5)]),                // domingo anterior: fuera
    ses('a', T0, [ex('squat_barbell', 3), ex('bench_press_barbell', 2)]),
    ses('b', T0 + 2 * DAY, [ex('barbell_row', 4)]),
  ];
  const planned = [{ group: 'quads', sets: 9 }, { group: 'chest', sets: 6 }, { group: 'shoulders', sets: 4 }];

  it('hechas de previstas por grupo, los no previstos al final y sin plan los totales', () => {
    const r = groupSetsVsPlan(log, EXERCISE_LIBRARY, planned, { now: NOW });
    expect(r.rows).toEqual([
      { group: 'quads', done: 3, planned: 9 },
      { group: 'chest', done: 2, planned: 6 },
      { group: 'shoulders', done: 0, planned: 4 },
      { group: 'back', done: 4, planned: null },
    ]);
    expect(r.done).toBe(9);
    expect(r.planned).toBe(19);
  });
  it('sin programa, solo las hechas', () => {
    const r = groupSetsVsPlan(log, EXERCISE_LIBRARY, null, { now: NOW });
    expect(r.planned).toBeNull();
    expect(r.rows.map((x) => x.group)).toEqual(['back', 'quads', 'chest']);
    expect(r.rows.every((x) => x.planned === null)).toBe(true);
  });
});

describe('volumeChange (T11-09)', () => {
  const NOW = new Date(2026, 1, 20, 18).getTime();                  // viernes 20 feb 2026
  const at = (daysAgo, h = 12) => { const d = new Date(NOW); d.setDate(d.getDate() - daysAgo); d.setHours(h, 0, 0, 0); return d.getTime(); };
  const ses = (id, ts, kg) => ({ id, timestamp: ts, duration: 0, exercises: [{ exerciseId: 'squat_barbell', sets: [set(kg, 10)] }] });
  // alternando pierna (pesada) y torso (ligera) cada 3 días durante 8 semanas
  const alt = (kgLeg, kgUp, from = 1, to = 56) => {
    const out = [];
    for (let i = from, k = 0; i <= to; i += 3, k++) out.push(ses(`s${i}`, at(i), k % 2 ? kgUp : kgLeg));
    return out;
  };

  it('alternar pierna y torso da un % razonable', () => {
    expect(Math.abs(volumeChange(alt(200, 60), { now: NOW }))).toBeLessThanOrEqual(25);
  });
  it('mismo trabajo en las dos ventanas → 0', () => {
    expect(volumeChange([ses('a', at(3), 100), ses('b', at(40), 100)], { now: NOW })).toBe(0);
  });
  it('una semana de descanso cuenta 0 en la media', () => {
    // actual: 1 sesión de 1000 en 4 bloques; anterior: 2 de 1000 → -50 %
    expect(volumeChange([ses('a', at(3), 100), ses('b', at(35), 100), ses('c', at(45), 100)], { now: NOW })).toBe(-50);
  });
  it('sin sesiones en una de las ventanas → null', () => {
    expect(volumeChange([ses('a', at(3), 100)], { now: NOW })).toBeNull();
    expect(volumeChange([ses('b', at(40), 100)], { now: NOW })).toBeNull();
    expect(volumeChange([], { now: NOW })).toBeNull();
  });
  it('sin sesión hoy las ventanas acaban ayer; con sesión hoy, hoy', () => {
    const log = [ses('a', at(5), 100), ses('b', at(28), 100), ses('c', at(29), 100)];
    expect(volumeChange(log, { now: NOW })).toBe(100);              // acaba ayer: b (hace 28) está en la actual, 2 vs 1
    expect(volumeChange([...log, ses('t', at(0, 9), 100)], { now: NOW })).toBe(0);  // acaba hoy: b pasa a la anterior, 2 vs 2
  });
});

describe('calendarLoads (T11-08)', () => {
  const ses = (id, ts, extra = {}) => ({ id, timestamp: ts, duration: 3600, exercises: [{ exerciseId: 'squat_barbell', sets: [set(100, 5)] }], ...extra });
  it('con sRPE tiñe por carga interna', () => {
    const r = calendarLoads([ses('a', T0, { sessionRpe: 7 }), ses('b', T0 + DAY)], EXERCISE_LIBRARY, { now: T0 + 2 * DAY });
    expect(r.source).toBe('internal');
    expect(r.byDay.size).toBe(2);
    expect([...r.byDay.values()].filter((v) => v.load == null)).toHaveLength(1);
  });
  it('sin ningún sRPE tiñe por la externa: ningún día entrenado queda sin carga', () => {
    const r = calendarLoads([ses('a', T0), ses('b', T0 + DAY)], EXERCISE_LIBRARY, { now: T0 + 2 * DAY });
    expect(r.source).toBe('external');
    expect(r.byDay.size).toBe(2);
    expect([...r.byDay.values()].every((v) => v.load > 0)).toBe(true);
  });
});

// ── T11-10: situaciones del visor de carga, con literales ──────────────────────
// Las personas de scripts/visor-carga/casos.js, reducidas a lo que enseña el panel:
// el lunes 31 ago 2026 es el día 1 de la semana 1. Cada fila es [semana, día (0 = lunes),
// sRPE o null, [[ejercicio, kg, series, reps], ...]]. `duration: 0`: manda el modelo.
const dayAt = (week, d, h = 18) => new Date(2026, 7, 31 + 7 * (week - 1) + d, h).getTime();
const lifts = (n) => [['squat_barbell', 100, n, 5], ['bench_press_barbell', 70, n, 5], ['barbell_row', 60, n, 6]];
const MACH = [['chest_press_machine', 30, 3, 10], ['leg_press_standard', 60, 3, 10], ['shoulder_press_machine', 20, 3, 10]];
const FOUR = [0, 1, 3, 4];                       // lunes, martes, jueves, viernes
const plan = (from, to, days, rpe, exs) => {
  const out = [];
  for (let w = from; w <= to; w++) for (const d of days) out.push([w, d, rpe, exs]);
  return out;
};
const logOf = (rows) => rows.map(([w, d, rpe, exs], i) => ({
  id: `t${i}`, timestamp: dayAt(w, d), duration: 0, bodyWeight: 80,
  ...(rpe != null ? { sessionRpe: rpe } : {}),
  exercises: exs.map(([exerciseId, kg, n, reps]) => ({ exerciseId, restSec: 90, sets: Array.from({ length: n }, () => set(kg, reps)) })),
}));

/** Lo que pinta el panel de Carga para ese log a esa hora. */
const panel = (rows, now) => {
  const log = logOf(rows);
  const s = loadSummary(log, LIB, { now });
  return {
    s,
    ms: monotonyStrain(s.days),
    chip: effortVsLoad(s.days).chip,
    strength: strengthChange(log, LIB, { endDay: s.endDay }),
    volume: volumeChange(log, { now }),
  };
};

describe('situaciones del visor (T11-10)', () => {
  it('Ana: sin sRPE, la carga es la externa y el panel no se vacía', () => {
    const r = panel(plan(1, 10, [0, 3], null, MACH), dayAt(11, 0, 9));
    expect(r.s.source).toBe('external');
    expect(r.s.vs28).toBe(0);                          // mismo trabajo cada semana
    expect(r.ms).toEqual({ monotony: null, strain: null, strainPct: null, sessions: 2 });   // 2 sesiones: sin monotonía
    expect(r.chip).toBeNull();                         // sin sRPE no hay esfuerzo vs carga
    expect(r.strength).toBe(0);
    expect(r.volume).toBe(0);
  });

  it('viernes antes de entrenar: las ventanas acaban ayer y la semana no cae en falso', () => {
    const rows = [...plan(1, 3, FOUR, 7, lifts(4)), ...plan(4, 4, [0, 1, 3], 7, lifts(4))];   // el viernes de la semana 4 aún no
    const vie = panel(rows, dayAt(4, 4, 9));
    expect(vie.s.endDay).toBe(new Date(2026, 8, 24).getTime());   // jueves
    expect(vie.s.vs28).toBe(-5);
    expect(vie.ms.sessions).toBe(4);
    expect(vie.ms.strainPct).toBe(0);
    // El sábado el viernes ya cuenta como descanso: la ventana pierde una sesión.
    const sab = panel(rows, dayAt(4, 5, 9));
    expect(sab.s.endDay).toBe(new Date(2026, 8, 25).getTime());
    expect(sab.s.vs28).toBe(-26);
    expect(sab.ms.sessions).toBe(3);
  });

  it('falta un día entero: la carga baja de verdad y con 2 sesiones no hay monotonía', () => {
    const rows = [...plan(1, 3, FOUR, 7, lifts(4)), ...plan(4, 4, [0, 3], 7, lifts(4))];
    const r = panel(rows, dayAt(5, 0, 9));
    expect(r.ms.sessions).toBe(2);
    expect(r.ms.monotony).toBeNull();
    expect(r.s.vs28).toBeLessThan(-20);
  });

  it('descarga de una semana: -33 % contra 28 días y el strain cae un 40 %', () => {
    const rows = [...plan(1, 3, FOUR, 7, lifts(4)), ...plan(4, 4, FOUR, 5, lifts(3))];
    const r = panel(rows, dayAt(5, 0, 9));
    expect(r.s.vs28).toBe(-33);
    expect(loadState(r.s.mean7.at(-1), r.s.mean28.at(-1))).toBe('unloading');
    expect(r.ms.monotony).toBeCloseTo(1.155, 2);
    expect(r.ms.strainPct).toBe(-40);
  });

  it('descarga de cuatro semanas: carga -25 %, esfuerzo -40 %, «deload»', () => {
    const rows = [...plan(1, 4, FOUR, 7, lifts(4)), ...plan(5, 8, FOUR, 5, lifts(3))];
    const r = panel(rows, dayAt(9, 0, 9));
    expect(r.chip.label).toBe('deload');
    expect(r.chip.loadPct).toBeCloseTo(-25, 5);
    expect(r.chip.effortPct).toBeCloseTo(-40, 0);
    expect(r.volume).toBe(-25);
    expect(r.strength).toBe(0);                        // bajar el trabajo no baja la fuerza
  });

  it('estancado: mismos pesos y sRPE, fuerza 0, volumen 0 y «sin patrón claro»', () => {
    const r = panel(plan(1, 8, [0, 2, 4], 7, lifts(5)), dayAt(9, 0, 9));
    expect(r.s.vs28).toBe(0);
    expect(r.chip).toEqual({ loadPct: 0, effortPct: 0, label: 'mixed' });
    expect(r.strength).toBe(0);
    expect(r.volume).toBe(0);
    expect(r.ms.strainPct).toBe(0);
  });

  it('bloque duro: +50 % de series y sRPE 8 → carga y esfuerzo suben, «hard»', () => {
    const rows = [...plan(1, 4, FOUR, 7, lifts(4)), ...plan(5, 8, FOUR, 8, lifts(6))];
    const r = panel(rows, dayAt(9, 0, 9));
    expect(r.chip.label).toBe('hard');
    expect(r.chip.loadPct).toBeCloseTo(50, 5);
    expect(r.chip.effortPct).toBeGreaterThan(50);
    expect(r.volume).toBe(50);
    expect(r.ms.strainPct).toBe(9);
  });

  // Los casos de Marta y Javi que fijaron el umbral (spec §13): cifras exactas del visor.
  const eight = (a, b) => daysFrom([...Array(4).fill(a), ...Array(4).fill(b)]);
  it('Marta (semana 9): carga +7 %, esfuerzo +4 % → adaptación, no «bloque duro»', () => {
    expect(effortVsLoad(eight([100, 100], [107.1, 104.2])).chip.label).toBe('adaptation');
  });
  it('Javi (semana 9): carga plana y esfuerzo +9 % → fatiga', () => {
    expect(effortVsLoad(eight([100, 100], [98.6, 109.2])).chip.label).toBe('fatigue');
  });
  it('Javi (semana 10): carga -13 %, esfuerzo -6 % → descarga', () => {
    expect(effortVsLoad(eight([100, 100], [87.4, 94])).chip.label).toBe('deload');
  });
  it('el umbral: dentro de ±5 % es plano, fuera sube o baja', () => {
    expect(TREND_FLAT_PCT).toBe(5);
    expect(effortVsLoad(eight([100, 100], [104.9, 104.9])).chip.label).toBe('mixed');
    expect(effortVsLoad(eight([100, 100], [105.1, 100])).chip.label).toBe('adaptation');
    expect(effortVsLoad(eight([100, 100], [95.1, 95.1])).chip.label).toBe('mixed');
    expect(effortVsLoad(eight([100, 100], [94.9, 94.9])).chip.label).toBe('deload');
  });
});

// ── T11-10: bordes de la tabla del oráculo (módulo 6) y decisiones de §13 ──────────

describe('bordes de la carga (T11-10)', () => {
  const sets2 = [set(100, 5), set(100, 5)];       // modelo = 850 s
  const model = 850 / 60;

  it('duración 0, ausente o corrupta: manda el modelo, no el suelo del clamp (TL-05)', () => {
    for (const duration of [0, undefined, NaN, -5000]) {
      expect(sessionMinutes(entry({ sets: sets2, duration }))).toBeCloseTo(model, 6);
    }
    expect(internalLoad(entry({ sets: sets2, duration: 0, sessionRpe: 7 }))).toBeCloseTo(7 * model, 6);
  });

  it('sesión sin series ni bloques: 0 minutos, sin carga (hueco) y sin NaN (TL-06)', () => {
    const vacia = { id: 'v', timestamp: T0, duration: 3600000, sessionRpe: 7, exercises: [{ exerciseId: 'squat_barbell', sets: [] }] };
    expect(sessionMinutes(vacia)).toBe(0);
    expect(internalLoad(vacia)).toBeNull();
    const [l] = sessionLoads([vacia], LIB);
    expect(l.internal).toBeNull();
    expect(l.external).toBeNull();
    const [d] = dailySeries([l], { now: T0 });
    expect(d).toEqual({ day: new Date(2026, 0, 5).getTime(), internal: null, external: null, sessions: 1 });
  });

  it('un sRPE corrupto o negativo es un hueco, nunca NaN', () => {
    for (const sessionRpe of ['abc', NaN, -3]) {
      expect(internalLoad(entry({ sets: sets2, duration: 900000, sessionRpe }))).toBeNull();
    }
    expect(internalLoad(entry({ sets: sets2, duration: 900000, sessionRpe: '7' }))).toBeCloseTo(105, 6);
    const log = [{ ...entry({ sets: sets2, sessionRpe: 'abc' }), timestamp: T0 }];
    expect(effortBlocks(log, [{ day: new Date(2026, 0, 5).getTime() }])).toEqual([null]);
  });

  it('semana con sesiones pero sin sRPE: hueco en la línea de esfuerzo, no un -100 %', () => {
    // La tercera semana se entrenó (externa 100) pero sin apuntar el esfuerzo.
    const r = effortVsLoad(daysFrom([[100, 50], [100, 50], [100, null], [100, 60], [0, 0]]), { n: 5 });
    expect(r.external).toEqual([0, 0, 0, 0, -100]);
    expect(r.internal.map((v) => v && Math.round(v))).toEqual([0, 0, null, 20, -100]);
  });

  it('el chip se calcula con las semanas que sí tienen sRPE', () => {
    const blocks = [[100, 100], [100, 100], [100, null], [100, 100], [130, 100], [130, 100], [130, null], [130, 100]];
    expect(effortVsLoad(daysFrom(blocks)).chip.label).toBe('adaptation');
    // Si en una de las dos mitades no hay ni un sRPE, no hay chip.
    const sin = blocks.map(([e, i], k) => [e, k >= 4 ? null : i]);
    expect(effortVsLoad(daysFrom(sin)).chip).toBeNull();
  });

  it('la referencia de 1RM mira 6 semanas atrás (inclusive) y la ventana de rendimiento, 4', () => {
    expect(REF_WEEKS).toBe(6);
    const mk = (id, ts, w) => entry({ id, ts, exerciseId: 'squat_barbell', sets: [set(w, 5)] });
    const alone = sessionLoads([mk('x', T0, 100)], LIB)[0].external;
    // 6 semanas justas: la referencia (200) todavía vale; un milisegundo más y ya no.
    const dentro = sessionLoads([mk('a', T0, 200), mk('b', T0 + 6 * WEEK, 100)], LIB)[1].external;
    const fuera = sessionLoads([mk('a', T0, 200), mk('b', T0 + 6 * WEEK + 1, 100)], LIB)[1].external;
    expect(dentro).toBeCloseTo(alone / 2, 6);
    expect(fuera).toBeCloseTo(alone, 6);
    // Rendimiento: el 100 de la semana 0 sale de la ventana de 4 semanas en la semana 4.
    const sem = (k, kg) => mk(`w${k}`, T0 + k * WEEK, kg);
    const perf = performanceWeekly([sem(0, 100), sem(1, 90), sem(2, 90), sem(3, 90), sem(4, 90)], LIB);
    expect(perf[3].index).toBeCloseTo(100, 6);          // semana 3: ventana semanas 0-3, incluye el 100
    expect(perf[4].index).toBeCloseTo(90, 6);           // semana 4: ya no
  });

  it('límite de 7 días: una sesión de hace 7 días ya no entra en la media de 7', () => {
    const ses = (daysAgo, id) => entry({ id, ts: new Date(2026, 0, 20 - daysAgo, 18).getTime(), sets: sets2, duration: 900000, sessionRpe: 10 });
    const now = new Date(2026, 0, 20, 20).getTime();
    // hoy y hace 7 días: m7 = 150/7 y m28 = 300/8 (ventana expansiva de 8 días)
    expect(loadSummary([ses(7, 'a'), ses(0, 'b')], LIB, { now }).vs28).toBe(-43);
    // hoy y hace 6 días: las dos entran en los 7 y en los 28 → 0
    expect(loadSummary([ses(6, 'a'), ses(0, 'b')], LIB, { now }).vs28).toBe(0);
  });

  it('límite de 28 días: la sesión de hace 28 días sale de la media de 28, la de hace 27 no', () => {
    const ses = (daysAgo, id) => entry({ id, ts: new Date(2026, 0, 28 - daysAgo, 18).getTime(), sets: sets2, duration: 900000, sessionRpe: 10 });
    const now = new Date(2026, 0, 28, 20).getTime();
    expect(loadSummary([ses(28, 'a'), ses(0, 'b')], LIB, { now }).vs28).toBe(300);   // m28 = 150/28
    expect(loadSummary([ses(27, 'a'), ses(0, 'b')], LIB, { now }).vs28).toBe(100);   // m28 = 300/28
  });

  it('la ventana de fuerza de 4 semanas son 28 días: el día 27 es «actual» y el 28 es «anterior»', () => {
    const END = new Date(2026, 1, 20).getTime();
    const at = (d, kg) => entry({ id: `f${d}`, ts: END - d * DAY + 12 * 3600000, sets: [set(kg, 5)] });
    expect(strengthChange([at(27, 110), at(28, 100)], LIB, { endDay: END })).toBe(10);
    expect(strengthChange([at(28, 110), at(56, 100)], LIB, { endDay: END })).toBeNull();   // el 56 queda fuera
  });
});

describe('weekBlocks', () => {
  const days = (n) => Array.from({ length: n }, (_, i) => ({ day: i }));
  it('bloques de 7 días hacia atrás desde el último; el primero puede quedar corto', () => {
    const b = weekBlocks(days(17), 8);
    expect(b.map((x) => x.length)).toEqual([3, 7, 7]);
    expect(b[2][6].day).toBe(16);
  });
  it('limita a n bloques y con serie vacía no da ninguno', () => {
    expect(weekBlocks(days(70), 3)).toHaveLength(3);
    expect(weekBlocks([], 8)).toEqual([]);
  });
});

// ── T11-10: ningún NaN, Infinity ni negativo imposible llega a la pantalla ─────────

describe('guardas de la pestaña Carga (T11-10)', () => {
  const malos = (x, path = '') => {
    if (typeof x === 'number') return Number.isFinite(x) ? [] : [path];
    if (x instanceof Map) return malos([...x.values()], path);
    if (x && typeof x === 'object') return Object.entries(x).flatMap(([k, v]) => malos(v, `${path}.${k}`));
    return [];
  };
  const todo = (log, now) => {
    const s = loadSummary(log, LIB, { now });
    const from = s.endDay == null ? 0 : s.endDay - 90 * DAY;
    return {
      s, ms: monotonyStrain(s.days), vs: effortVsLoad(s.days), eb: effortBlocks(log, s.days),
      rated: ratedSessions(log, s.endDay, 28), rpe: rpeByExercise(log, { from, endDay: s.endDay }),
      str: strengthByExercise(log, LIB, { endDay: s.endDay, fromDay: from }), chg: strengthChange(log, LIB, { endDay: s.endDay }),
      vol: volumeChange(log, { now }), cal: calendarLoads(log, LIB, { now }), perf: performanceWeekly(log, LIB),
      grp: groupSetsVsPlan(log, LIB, [{ group: 'quads', sets: 0 }], { now }),
    };
  };

  it('vacío, una sola sesión o semanas enteras sin entrenar', () => {
    const una = logOf(plan(1, 1, [0], 7, lifts(4)));
    const hueco = logOf([...plan(1, 1, [0], 7, lifts(4)), ...plan(9, 9, [0], 7, lifts(4))]);
    for (const [log, now] of [[[], dayAt(3, 0)], [una, dayAt(1, 0, 20)], [una, dayAt(20, 0)], [hueco, dayAt(9, 0, 20)]]) {
      expect(malos(todo(log, now))).toEqual([]);
    }
  });

  it('cada día de cada situación, también con sRPE roto y duraciones raras', () => {
    const rows = [...plan(1, 4, FOUR, 7, lifts(4)), ...plan(5, 8, FOUR, 5, lifts(3))];
    const log = logOf(rows).map((e, i) => (i % 5 === 0 ? { ...e, sessionRpe: 'x', duration: NaN } : i % 7 === 0 ? { ...e, sessionRpe: undefined } : e));
    for (let w = 1; w <= 9; w++) for (let d = 0; d < 7; d++) {
      const now = dayAt(w, d, 23);
      expect(malos(todo(log.filter((e) => e.timestamp <= now), now))).toEqual([]);
    }
  });

  it('con base 0 el % es null, no Infinity: carga, volumen y fuerza', () => {
    const cero = logOf(plan(1, 8, [0], null, [['squat_barbell', 0, 3, 5]]));      // pesos a 0
    const now = dayAt(9, 0, 9);
    const s = loadSummary(cero, LIB, { now });
    expect(s.vs28 === null || Number.isFinite(s.vs28)).toBe(true);
    expect(volumeChange(cero, { now })).toBeNull();
    expect(strengthChange(cero, LIB, { endDay: s.endDay })).toBeNull();
    const e = effortVsLoad(daysFrom(Array(8).fill([0, 0])));
    expect(e.chip).toBeNull();
    expect(e.external.every((v) => v == null)).toBe(true);
  });

  it('un plan con 0 series por grupo no deja filas ni totales raros', () => {
    expect(groupSetsVsPlan([], LIB, [{ group: 'quads', sets: 0 }], { now: dayAt(2, 0) })).toEqual({ rows: [], done: 0, planned: null });
  });
});
