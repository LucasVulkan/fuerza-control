/**
 * trainingLoad — carga interna y externa de entrenamiento, puro.
 *
 * Spec completa (fórmulas, decisiones y por qué): `mobile/docs/specs/training-load.md`.
 *
 * Dos magnitudes, deliberadamente separadas:
 *   - interna  = sRPE × minutos (Foster). Lo que la sesión te costó.
 *   - externa  = Σ reps × (peso efectivo / 1RM de referencia). El trabajo hecho.
 *
 * La externa NO es tonelaje: normaliza por la capacidad actual en cada
 * ejercicio, así una serie de curl y una de sentadilla a la misma intensidad
 * relativa pesan lo mismo, y — clave — el factor de un ejercicio de peso
 * corporal se cancela entre el numerador y la referencia, así que no hace falta
 * una tabla de factores por ejercicio (dominada 1.0, flexión 0.64…).
 *
 * Todo en kg (unidad de almacenamiento). Nada aquí toca el store.
 */
import { epley1RM } from './oneRm';
import { blockEstimatedSec } from './conditioningBlocks';
import { doneSets } from './sessionRecap';

// ── Constantes ────────────────────────────────────────────────────────────────

// Modelo de duración. Mismos números que `mobile/src/utils/sessionStats.js`,
// duplicados a propósito: allí se modela el PLAN desde una plantilla, aquí lo
// HECHO desde una entrada de log (mismo precedente que LIMITATION_GROUPS).
const WORK_SEC             = 35;   // trabajo de una serie basada en reps
const DEFAULT_REST_SEC     = 90;   // descanso cuando el log no lo trae (ad-hoc)
const EXERCISE_OVERHEAD_SEC = 120; // transición: buscar máquina, montar peso
const SESSION_OVERHEAD_SEC  = 480; // calentamiento general, una vez por sesión

/** Ventana de la referencia de 1RM, en semanas. */
export const REF_WEEKS = 6;

// Umbrales de interpretación. Viven aquí y no en la pantalla porque son
// conocimiento de dominio —los de monotonía son los de Foster, el rango de
// series es la horquilla habitual de hipertrofia— y porque la ficha de cada
// métrica interpola estos valores en su explicación: tecleados a mano en el
// JSON de i18n quedarían obsoletos a la primera calibración.
export const MONOTONY_MODERATE = 1.5;
export const MONOTONY_HIGH     = 2.0;
/** Mínimo de sesiones semanales para que monotonía y strain signifiquen algo. */
export const MIN_SESSIONS_FOR_MONOTONY = 3;
export const SETS_TARGET_MIN = 10;
export const SETS_TARGET_MAX = 20;

// ponytail: un solo factor para TODOS los bloques de acondicionamiento,
// calibrado a ojo (un AMRAP de 12' ≈ un ejercicio de 4×10 al 70% ≈ 28 reps
// relativas → 28/720 ≈ 0.04). Es la parte menos defendible del modelo: los
// bloques no tienen intensidad relativa que medir. Si algún día importa:
// factor por formato, o un sRPE propio del bloque.
export const BLOCK_LOAD_PER_SEC = 0.04;

// Equipo que aporta carga EXTERNA. Todo lo demás (barra de dominadas,
// paralelas, anillas, rueda…) es aparato de sujeción: la carga es tu cuerpo.
// Verificado contra la librería completa (182 ejercicios): 68 quedan como peso
// corporal, y los 4 con progressionDirection 'decrease' (asistidos) caen todos
// dentro, ninguno fuera.
const LOAD_BEARING_EQUIPMENT = new Set([
  'barbell', 'dumbbells', 'cables', 'machines', 'kettlebell',
]);

// ── Duración ──────────────────────────────────────────────────────────────────

/** Segundos activos de un bloque: for-time usa su tiempo real, el resto su formato. */
export function blockActiveSec(block) {
  if (!block) return 0;
  if (block.format === 'for_time' && block.result?.timeSec != null) {
    return block.result.timeSec;
  }
  return blockEstimatedSec(block);
}

/**
 * Duración modelada de lo que se registró, en segundos.
 *
 * A diferencia de `sessionStats`, usa el tiempo REAL de las series de tiempo
 * (el log lo guarda) en vez del punto medio del rango prescrito, y las series
 * hechas en vez de las planificadas.
 *
 * Limitación conocida: el log no guarda `supersetWithNext`, así que los
 * miembros de una superserie cuentan su descanso completo y el modelo
 * sobreestima algo. Solo afecta al techo/suelo del clamp de `sessionMinutes`.
 */
export function modelSec(entry) {
  let sec = 0;
  let didSomething = false;
  for (const ex of entry?.exercises ?? []) {
    const sets = ex.sets ?? [];
    if (!sets.length) continue;
    const rest = ex.restSec ?? DEFAULT_REST_SEC;
    for (const s of sets) {
      const timed = parseFloat(s.time);
      sec += (timed > 0 ? timed : WORK_SEC) + rest;
    }
    sec += EXERCISE_OVERHEAD_SEC;
    didSomething = true;
  }
  for (const b of entry?.blocks ?? []) {
    sec += blockActiveSec(b) + EXERCISE_OVERHEAD_SEC;
    didSomething = true;
  }
  // El calentamiento general solo cuenta si de verdad se entrenó algo: un
  // ejercicio presente pero con 0 series registradas no es una sesión.
  return didSomething ? sec + SESSION_OVERHEAD_SEC : 0;
}

/**
 * Minutos de sesión para el sRPE-TL.
 *
 * `entry.duration` es reloj de pared (incluye descansos, pausas y el móvil en
 * el bolsillo) y las series no llevan timestamp, así que no existe tiempo
 * activo real. Se usa el reloj cuando es plausible y se acota con el modelo
 * cuando no: un olvido de 3 h no puede multiplicar la carga por cinco.
 */
export function sessionMinutes(entry) {
  const modelMin = modelSec(entry) / 60;
  if (modelMin <= 0) return 0;
  const wallMin = (entry?.duration ?? 0) / 60000;
  return Math.min(Math.max(wallMin, modelMin * 0.5), modelMin * 2);
}

// ── Carga interna ─────────────────────────────────────────────────────────────

/** sRPE × minutos. `null` (hueco, NUNCA 0) si la sesión no tiene sRPE. */
export function internalLoad(entry) {
  const rpe = entry?.sessionRpe;
  if (rpe == null) return null;
  const min = sessionMinutes(entry);
  return min > 0 ? rpe * min : null;
}

// ── Peso efectivo ─────────────────────────────────────────────────────────────

/**
 * ¿La carga de este ejercicio es el propio cuerpo?
 * Un `def` desconocido (ejercicio borrado) se trata como NO peso corporal: es
 * el default seguro — usa el peso registrado tal cual en vez de sumarle el
 * peso corporal a algo que quizá sea una barra.
 */
export function isBodyweight(def) {
  if (!def) return false;
  return !(def.equipment ?? []).some((e) => LOAD_BEARING_EQUIPMENT.has(e));
}

/**
 * Peso que realmente movió una serie, en kg. `null` = no computable.
 *
 * Tres casos:
 *   1. Equipo con carga  → el peso registrado.
 *   2. Peso corporal     → peso corporal + lastre.
 *   3. Asistido          → peso corporal − asistencia. En los ejercicios con
 *      `progressionDirection: 'decrease'` el campo `weight` es la AYUDA (goma),
 *      no la carga: sumarla invertiría el signo del progreso.
 */
export function effectiveWeight(set, def, bodyWeight) {
  const raw   = parseFloat(set?.weight);
  const added = isNaN(raw) ? 0 : raw;
  if (!isBodyweight(def)) return added > 0 ? added : null;
  if (bodyWeight == null || bodyWeight <= 0) return null;
  if (def?.progressionDirection === 'decrease') return Math.max(0, bodyWeight - added);
  return bodyWeight + added;
}

// ── Referencia de 1RM por ejercicio ───────────────────────────────────────────

const bodyWeightOf = (entry, fallback) => entry?.bodyWeight ?? fallback ?? null;

/**
 * Índice exerciseId → [{ id, ts, e1rm, maxW }] ordenado por fecha.
 *
 * Se construye una vez por pasada en vez de rescanear el log por ejercicio y
 * sesión (eso era O(sesiones² × ejercicios)).
 *
 * No reutiliza `recentE1RM`/`bestSetE1RM` de `oneRm.js` a propósito: aquellas
 * leen `set.weight` en crudo, y aquí la referencia tiene que salir del peso
 * EFECTIVO o los ejercicios de peso corporal no tendrían ninguna. Sí se
 * reutiliza `epley1RM`, que es la fórmula y el límite de 12 reps.
 */
function buildIndex(sortedLog, allExercises, fallbackBodyWeight) {
  const idx = new Map();
  for (const entry of sortedLog) {
    const bw = bodyWeightOf(entry, fallbackBodyWeight);
    for (const ex of entry.exercises ?? []) {
      const def = allExercises?.[ex.exerciseId];
      let e1rm = null;
      let maxW = null;
      for (const s of ex.sets ?? []) {
        const w = effectiveWeight(s, def, bw);
        if (w == null || w <= 0) continue;
        if (maxW == null || w > maxW) maxW = w;
        const v = epley1RM(w, s.reps, s.rpe);
        if (v != null && (e1rm == null || v > e1rm)) e1rm = v;
      }
      if (e1rm == null && maxW == null) continue;
      if (!idx.has(ex.exerciseId)) idx.set(ex.exerciseId, []);
      idx.get(ex.exerciseId).push({ id: entry.id, ts: entry.timestamp, e1rm, maxW });
    }
  }
  return idx;
}

/**
 * Resolutor de referencia con fecha de corte. Cascada:
 *   1. Mejor e1RM del ejercicio en las `weeks` semanas ANTERIORES a la sesión.
 *   2. Mejor e1RM de la propia sesión (ejercicio estrenado hoy).
 *   3. Peso efectivo máximo visto (previo o de hoy) — salva los ejercicios que
 *      SIEMPRE se hacen por encima de 12 reps, donde Epley nunca da referencia.
 *   4. `null` → las series de ese ejercicio no computan y la sesión sale parcial.
 *
 * El corte por sesión (y no "hasta hoy") es lo que hace el histórico inmutable:
 * un PR de esta semana no puede reescribir la carga de hace tres meses.
 */
function makeRefResolver(idx, weeks) {
  const windowMs = weeks * 7 * 86400000;
  return function refFor(exerciseId, entry) {
    const records = idx.get(exerciseId);
    if (!records) return null;
    const from = entry.timestamp - windowMs;
    let windowE1rm = null;
    let ownE1rm    = null;
    let maxW       = null;
    for (const r of records) {
      const isOwn  = r.id === entry.id;
      const isPast = r.ts < entry.timestamp && !isOwn;
      if (!isOwn && !isPast) continue;               // sesiones posteriores: invisibles
      if (r.maxW != null && (maxW == null || r.maxW > maxW)) maxW = r.maxW;
      if (r.e1rm == null) continue;
      if (isOwn) {
        if (ownE1rm == null || r.e1rm > ownE1rm) ownE1rm = r.e1rm;
      } else if (r.ts >= from && (windowE1rm == null || r.e1rm > windowE1rm)) {
        windowE1rm = r.e1rm;
      }
    }
    return windowE1rm ?? ownE1rm ?? maxW ?? null;
  };
}

// ── Carga externa ─────────────────────────────────────────────────────────────

function externalLoadOf(entry, refFor, allExercises, bodyWeight) {
  let total   = 0;
  let counted = false;
  let partial = false;

  for (const ex of entry.exercises ?? []) {
    const def = allExercises?.[ex.exerciseId];
    const ref = refFor(ex.exerciseId, entry);
    for (const s of ex.sets ?? []) {
      // Las sub-series de un dropset son trabajo real: cuentan igual.
      for (const piece of [s, ...(s.drops ?? [])]) {
        const reps = parseInt(piece.reps, 10);
        // Sin reps no hay volumen relativo que medir: isométricos y series de
        // tiempo quedan fuera de la carga externa por definición, no por fallo.
        if (!(reps > 0)) continue;
        const w = effectiveWeight(piece, def, bodyWeight);
        if (w == null || w <= 0 || !ref) { partial = true; continue; }
        total  += reps * (w / ref);
        counted = true;
      }
    }
  }

  for (const b of entry.blocks ?? []) {
    total  += blockActiveSec(b) * BLOCK_LOAD_PER_SEC;
    counted = true;
  }

  return { external: counted ? total : null, partial };
}

/**
 * Carga interna y externa de cada sesión del log, ordenadas por fecha.
 *
 * @param {Array}  log            Entradas de workoutLog.
 * @param {object} allExercises   Librería + ejercicios propios, por id.
 * @param {object} [opts]
 * @param {number} [opts.fallbackBodyWeight] Peso a usar en las entradas sin
 *   `bodyWeight` propio (el último conocido del perfil). Sin esto, todo el
 *   histórico anterior a la captura de peso quedaría sin carga en los
 *   ejercicios de peso corporal. Hace el histórico aproximado, no falso: se
 *   marca en la ficha de la métrica.
 * @returns {Array<{id, timestamp, internal, external, partial}>}
 */
export function sessionLoads(log, allExercises, opts = {}) {
  const { fallbackBodyWeight = null, weeks = REF_WEEKS } = opts;
  const sorted = [...(log ?? [])].sort((a, b) => a.timestamp - b.timestamp);
  const refFor = makeRefResolver(buildIndex(sorted, allExercises, fallbackBodyWeight), weeks);

  return sorted.map((entry) => {
    const bw = bodyWeightOf(entry, fallbackBodyWeight);
    const { external, partial } = externalLoadOf(entry, refFor, allExercises, bw);
    return {
      id:        entry.id,
      timestamp: entry.timestamp,
      internal:  internalLoad(entry),
      external,
      partial,
    };
  });
}

// ── Serie diaria y agregados ──────────────────────────────────────────────────

const startOfDay = (ts) => {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

/**
 * Un punto por día de calendario local, desde la primera sesión hasta `now`.
 *
 * Los días sin entrenar valen **0**, no `null`: son datos, y sin ellos las
 * medias móviles y la monotonía no significan nada (Foster define la monotonía
 * sobre los 7 días de la semana, no sobre los días entrenados).
 *
 * Un día CON sesión pero sin sRPE deja `internal: null` — hueco, no cero: un
 * cero se leería como "descansé", que es falso.
 */
const MAX_SERIES_DAYS = 730;   // 2 años

export function dailySeries(loads, { now = Date.now() } = {}) {
  if (!loads?.length) return [];

  const byDay = new Map();
  for (const l of loads) {
    const key = startOfDay(l.timestamp);
    const cur = byDay.get(key) ?? { internal: null, external: null, sessions: 0 };
    if (l.internal != null) cur.internal = (cur.internal ?? 0) + l.internal;
    if (l.external != null) cur.external = (cur.external ?? 0) + l.external;
    cur.sessions += 1;
    byDay.set(key, cur);
  }

  const last = startOfDay(now);
  const out  = [];
  // Avanza con setDate, no sumando 86400000: cruzar un cambio de hora
  // desplazaría la medianoche local y descuadraría todos los días siguientes.
  // Cota inferior: un timestamp corrupto (0, o una fecha imposible colada por
  // un backup) generaba un punto por día desde 1970 —veinte mil— y todo lo
  // encadenado después recorre esa serie: la pantalla de Carga se congelaba.
  // Dos años es más historial del que la gráfica sabe decir nada.
  const first = Math.max(
    startOfDay(loads[0].timestamp),
    startOfDay(now - MAX_SERIES_DAYS * 86400000),
  );
  const cursor = new Date(first);
  while (cursor.getTime() <= last) {
    const key = cursor.getTime();
    const hit = byDay.get(key);
    out.push({
      day:      key,
      internal: hit ? hit.internal : 0,
      external: hit ? hit.external : 0,
      sessions: hit ? hit.sessions : 0,
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

/**
 * Media móvil de `n` puntos con ventana EXPANSIVA: mientras no hay `n` días de
 * historial promedia lo que hay, en vez de dejar la línea sin empezar (si no,
 * la media de 28 días no existiría hasta el día 28 y el gráfico saldría vacío).
 *
 * Los `null` (sesión sin sRPE) se excluyen del promedio en vez de contar como
 * 0: desconocido no es cero.
 */
export function rollingMean(values, n) {
  return (values ?? []).map((_, i) => {
    const win = values.slice(Math.max(0, i - n + 1), i + 1).filter((v) => v != null);
    if (!win.length) return null;
    return win.reduce((a, b) => a + b, 0) / win.length;
  });
}

/**
 * Monotonía de Foster: media / desviación típica de la carga diaria.
 * Alta = mucha carga repetida sin variación.
 *
 * `null` cuando no se puede calcular (menos de 2 días con dato, o desviación 0
 * — p. ej. una semana entera de descanso). La UI la oculta además si la semana
 * tiene menos de 3 sesiones: con 1-2 la dominan los ceros y el número miente.
 */
export function monotony(values) {
  const v = (values ?? []).filter((x) => x != null);
  if (v.length < 2) return null;
  const mean = v.reduce((a, b) => a + b, 0) / v.length;
  const sd   = Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / v.length);
  if (sd === 0) return null;
  return mean / sd;
}

/** Strain de Foster: carga total de la ventana × monotonía. */
export function strain(values) {
  const m = monotony(values);
  if (m == null) return null;
  const sum = (values ?? []).filter((x) => x != null).reduce((a, b) => a + b, 0);
  return sum * m;
}

// ── Serie semanal e indexado ──────────────────────────────────────────────────

/** Lunes 00:00 local de la semana que contiene `ts`. */
function startOfWeek(ts) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
}

/**
 * Agrupa la serie diaria en semanas naturales (lunes a domingo).
 *
 * La semana es la unidad natural del entrenamiento y, sobre todo, la que hace
 * legible el gráfico de esfuerzo vs carga: a resolución diaria las dos líneas
 * son ruido con ceros de por medio.
 *
 * `internal` es `null` —no 0— cuando la semana tuvo sesiones pero ninguna con
 * sRPE: desconocido no es cero. Una semana entera de descanso sí vale 0.
 */
export function weeklySeries(days) {
  if (!days?.length) return [];
  const byWeek = new Map();
  for (const d of days) {
    const key = startOfWeek(d.day);
    const cur = byWeek.get(key) ?? { weekStart: key, internal: null, external: null, sessions: 0 };
    if (d.internal != null) cur.internal = (cur.internal ?? 0) + d.internal;
    if (d.external != null) cur.external = (cur.external ?? 0) + d.external;
    cur.sessions += d.sessions;
    byWeek.set(key, cur);
  }
  return [...byWeek.values()].sort((a, b) => a.weekStart - b.weekStart);
}

/**
 * Reescala una serie a base 100 sobre su PRIMER valor no nulo.
 *
 * Sin esto, carga externa (reps a intensidad relativa) y esfuerzo (sRPE ×
 * minutos) no se pueden pintar juntas: van en unidades distintas y una aplasta
 * a la otra. Indexadas, lo que se lee es la forma y la divergencia, que es de
 * lo que trata el gráfico.
 *
 * Limitación conocida: si la primera semana de la ventana fue atípica (una
 * descarga), desplaza toda la serie. Es el precio de un "base 100" legible
 * frente a normalizar por la media, que nadie sabe interpretar.
 */
export function indexTo100(values) {
  const base = (values ?? []).find((v) => v != null && v > 0);
  if (base == null) return (values ?? []).map(() => null);
  return values.map((v) => (v == null ? null : (v / base) * 100));
}

/**
 * Lectura conjunta de carga externa y esfuerzo, ambos ya indexados.
 *
 * Compara el último punto contra el de hace `lookback` semanas — "dónde estoy
 * respecto a hace un mes", no respecto al principio del histórico, que con seis
 * meses de ventana no diría nada accionable.
 *
 * `flat` es la banda (en puntos de índice) dentro de la cual un cambio se
 * considera "igual"; sin ella cualquier ruido del 1% se leería como tendencia.
 *
 * @returns {'adaptation'|'fatigue'|'hard'|'deload'|'mixed'|null}
 */
export function effortTrend(external, internal, { block = 4, flat = 8 } = {}) {
  const n = Math.min(external?.length ?? 0, internal?.length ?? 0);
  if (n < 2) return null;

  // Se comparan MEDIAS de bloque, no dos puntos sueltos. Con un mesociclo 3:1,
  // comparar la última semana contra la de hace cuatro enfrenta descarga con
  // descarga y siempre sale "sin cambios"; y un punto suelto es rehén de una
  // semana rara. Bloque contra bloque responde a lo que importa: ¿este mes va
  // más duro o más productivo que el anterior?
  const size = Math.max(1, Math.min(block, Math.floor(n / 2)));
  const mean = (arr, from, to) => {
    const v = arr.slice(from, to).filter((x) => x != null);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  };
  const e0 = mean(external, n - size * 2, n - size), e1 = mean(external, n - size, n);
  const i0 = mean(internal, n - size * 2, n - size), i1 = mean(internal, n - size, n);
  if (e0 == null || e1 == null || i0 == null || i1 == null) return null;

  const dir = (a, b) => (b - a > flat ? 1 : b - a < -flat ? -1 : 0);
  const de = dir(e0, e1);
  const di = dir(i0, i1);

  // Más trabajo al mismo coste = te estás adaptando. Mismo trabajo costando más
  // = fatiga. Las dos arriba = bloque duro (ni bueno ni malo). Las dos abajo =
  // descarga.
  if (de > 0 && di <= 0) return 'adaptation';
  if (de <= 0 && di > 0) return 'fatigue';
  if (de > 0 && di > 0)  return 'hard';
  if (de < 0 && di < 0)  return 'deload';
  return 'mixed';
}

/**
 * Strain de cada semana natural, para poder ver su evolución.
 *
 * El valor absoluto del strain no significa nada —lo dice su propia ficha—, así
 * que un número suelto es casi inútil: lo que comunica es la SERIE, ver que
 * llevas tres semanas subiendo. Por eso existe esta función además del dato de
 * la semana en curso.
 *
 * Aplica el mismo mínimo de sesiones que el indicador: una semana con una o dos
 * sesiones devuelve `null` en vez de un número que mentiría, y la tira dibuja un
 * hueco.
 *
 * @returns {Array<{ weekStart: number, strain: number|null, sessions: number }>}
 */
export function weeklyStrain(days) {
  if (!days?.length) return [];
  const byWeek = new Map();
  for (const d of days) {
    const key = startOfWeek(d.day);
    if (!byWeek.has(key)) byWeek.set(key, { weekStart: key, values: [], sessions: 0 });
    const w = byWeek.get(key);
    w.values.push(d.internal);
    w.sessions += d.sessions;
  }
  return [...byWeek.values()]
    .sort((a, b) => a.weekStart - b.weekStart)
    .map(({ weekStart, values, sessions }) => ({
      weekStart,
      sessions,
      strain: sessions >= MIN_SESSIONS_FOR_MONOTONY ? strain(values) : null,
    }));
}

// ── Rendimiento ───────────────────────────────────────────────────────────────

/**
 * Índice semanal de rendimiento: cuánto ha cambiado tu e1RM, en media, respecto
 * al principio de la ventana. 100 = tu nivel de partida.
 *
 * Los e1RM de ejercicios distintos no son comparables entre sí (150 kg de
 * sentadilla y 40 de curl no promedian), así que **cada ejercicio se indexa
 * contra su propia línea base** y luego se promedian los índices, no los kilos.
 *
 * Un ejercicio solo entra cuando tiene línea base y al menos una observación
 * posterior: con un único dato no hay progreso que medir, solo un 100 que
 * diluiría la media.
 *
 * Cada semana toma el **mejor e1RM de las últimas `windowWeeks` semanas**, no el
 * de esa semana suelta. Nadie pierde fuerza por hacer una descarga, y con el
 * dato semanal a pelo el índice caía un 10% cada cuatro semanas dibujando una
 * sierra que no describe nada. Es el mismo criterio que ya usa `recentE1RM` en
 * `oneRm.js` ("what you can do NOW", ventana en vez de última sesión); cuatro
 * semanas cubren un mesociclo entero con su descarga sin llegar a ocultar una
 * pérdida de fuerza real.
 *
 * Es la SALIDA del sistema (¿me estoy adaptando?), frente a la carga, que es la
 * entrada. Ver §1 de la spec.
 */
export function performanceWeekly(log, allExercises, opts = {}) {
  const { fallbackBodyWeight = null, windowWeeks = 4 } = opts;
  const sorted = [...(log ?? [])].sort((a, b) => a.timestamp - b.timestamp);
  const idx = buildIndex(sorted, allExercises, fallbackBodyWeight);

  // exerciseId → Map<semana, mejor e1RM de esa semana>
  const perExercise = new Map();
  for (const [exerciseId, records] of idx) {
    const weeks = new Map();
    for (const r of records) {
      if (r.e1rm == null) continue;
      const w = startOfWeek(r.ts);
      if (!weeks.has(w) || r.e1rm > weeks.get(w)) weeks.set(w, r.e1rm);
    }
    if (weeks.size >= 2) perExercise.set(exerciseId, weeks);
  }
  if (!perExercise.size) return [];

  const allWeeks = [...new Set([...perExercise.values()].flatMap((w) => [...w.keys()]))].sort();
  const baselines = new Map(
    [...perExercise].map(([id, weeks]) => {
      const first = [...weeks.keys()].sort()[0];
      return [id, weeks.get(first)];
    }),
  );

  const WEEK_MS = 7 * 86400000;
  return allWeeks.map((week) => {
    const from = week - (windowWeeks - 1) * WEEK_MS;
    const ratios = [];
    for (const [id, weeks] of perExercise) {
      // Mejor marca de la ventana, no la de esta semana suelta.
      let best = null;
      for (const [w, v] of weeks) {
        if (w < from || w > week) continue;
        if (best == null || v > best) best = v;
      }
      const base = baselines.get(id);
      if (best != null && base > 0) ratios.push((best / base) * 100);
    }
    return {
      weekStart: week,
      index: ratios.length ? ratios.reduce((a, b) => a + b, 0) / ratios.length : null,
      exercises: ratios.length,
    };
  });
}

// ── Volumen por grupo muscular ────────────────────────────────────────────────

/**
 * Series por grupo muscular en una ventana temporal.
 *
 * Se cuentan SERIES, no kilos: el estándar del sector (y la única referencia
 * que se le puede enseñar al usuario, ~10-20 series/semana por grupo) está en
 * series. En kilos no hay ninguna cifra orientativa que mostrar.
 *
 * Decisiones, todas conservadoras a propósito:
 * - **Atribución por `primaryGroup`**, el único campo que existe siempre en la
 *   librería. Es volumen DIRECTO: un press de banca suma a pecho y no reparte
 *   nada a tríceps u hombro. Contar volumen indirecto exigiría un reparto por
 *   ejercicio que la librería no tiene.
 * - **Un dropset cuenta como UNA serie.** `doneSets` devuelve solo las series
 *   padre; las sub-series son intensificación de esa misma serie, no series
 *   nuevas. Contarlas dispararía el volumen de quien use dropsets.
 * - Ejercicios propios sin grupo (`primaryGroup: 'custom'`) y ejercicios
 *   borrados caen en `'other'`, visible en vez de silenciosamente perdido.
 * - Los bloques de acondicionamiento no entran: no tienen series ni grupo.
 *
 * @returns {Array<{ group: string, sets: number }>} de más a menos series.
 */
export function muscleGroupOf(def) {
  const raw = def?.primaryGroup;
  return raw && raw !== 'custom' ? raw : 'other';
}

export function setsByMuscleGroup(log, allExercises, { from = null, to = Date.now() } = {}) {
  const counts = new Map();
  for (const entry of log ?? []) {
    if (from != null && entry.timestamp < from) continue;
    if (entry.timestamp > to) continue;
    for (const ex of entry.exercises ?? []) {
      const n = doneSets(ex).length;
      if (!n) continue;
      const group = muscleGroupOf(allExercises?.[ex.exerciseId]);
      counts.set(group, (counts.get(group) ?? 0) + n);
    }
  }
  return [...counts.entries()]
    .map(([group, sets]) => ({ group, sets }))
    .sort((a, b) => b.sets - a.sets);
}

/**
 * Series PRESCRITAS por grupo muscular en un ciclo (= una vuelta a las sesiones
 * que se le pasen). La gemela de `setsByMuscleGroup`: una cuenta lo planificado
 * y otra lo hecho, y viven pegadas a propósito — si las reglas de atribución
 * divergen, comparar el programa con lo entrenado deja de significar nada.
 *
 * Mismas reglas, ya justificadas arriba: atribución por `primaryGroup` (volumen
 * directo), `custom`/borrado → `'other'`, el dropset no suma serie (es
 * intensificación de la última, no una serie nueva), el calentamiento no cuenta
 * y los bloques de acondicionamiento tampoco (no tienen ni series ni grupo).
 *
 * Entran plantillas ya resueltas (`getEffectiveTemplate`), no `days`: la
 * pantalla las resuelve igualmente para pintarlas, y así esto se testea sin store.
 *
 * @returns {Array<{ group: string, sets: number }>} de más a menos series.
 */
export function plannedSets(exConfig, def) {
  return exConfig?.sets ?? def?.sets ?? 3;
}

export function plannedSetsByGroup(templates, allExercises) {
  const counts = new Map();
  for (const tpl of templates ?? []) {
    for (const ex of tpl?.exercises ?? []) {
      const n = plannedSets(ex, allExercises?.[ex.exerciseId]);
      if (!n) continue;
      const group = muscleGroupOf(allExercises?.[ex.exerciseId]);
      counts.set(group, (counts.get(group) ?? 0) + n);
    }
  }
  return [...counts.entries()]
    .map(([group, sets]) => ({ group, sets }))
    .sort((a, b) => b.sets - a.sets);
}

/**
 * Estado de carga a partir de la relación media 7d / media 28d.
 *
 * Es el ACWR, pero deliberadamente NO se expone como número con zona de riesgo:
 * el ratio acoplado arrastra artefactos conocidos y su "sweet spot" no replica.
 * Como estado cualitativo sí es honesto y es lo mismo que ya se ve en el gráfico.
 */
export function loadState(mean7, mean28) {
  if (mean7 == null || mean28 == null || mean28 <= 0) return null;
  const ratio = mean7 / mean28;
  if (ratio < 0.8) return 'unloading';
  if (ratio <= 1.3) return 'steady';
  return 'loading';
}
