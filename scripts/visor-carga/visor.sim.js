// Visor de carga: pasa cada persona de casos.js, semana a semana, por las
// funciones REALES de trainingLoad.js y escribe el resultado en JSON:
//   hoy        — lo que enseñaría hoy LoadTab.jsx al acabar la semana (domingo 23:00)
//   propuesto  — la tarjeta «Resumen de la semana» en frases y los avisos del entrenador
//   npx vitest run -c scripts/visor-carga/vitest.config.mjs
// Salida: scripts/visor-carga/visor-carga.json (o VISOR_OUT). Corre bajo vitest
// para reutilizar los alias de vite.config.js y para fijar la hora con setSystemTime.
import { it, vi, afterAll } from 'vitest';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  sessionLoads, dailySeries, rollingMean, monotony, strain, loadState, setsByMuscleGroup,
  weeklySeries, indexTo100, effortTrend, performanceWeekly, plannedSetsByGroup,
  MONOTONY_MODERATE, MONOTONY_HIGH, MIN_SESSIONS_FOR_MONOTONY,
} from '../../mobile/src/utils/trainingLoad';
import { EXERCISE_LIBRARY as EX } from '../../mobile/src/data/exerciseLibrary';
import es from '../../mobile/src/locales/es.json';
import { PERSONAS, SEMANAS } from './casos';

const DAY = 86400000;
// Lunes 00:00, domingo 23:00 y tramo de la semana w (1..SEMANAS), en hora local.
const lunes = (w) => new Date(2026, 7, 31 + 7 * (w - 1), 0, 0, 0, 0).getTime();
const domingo = (w) => new Date(2026, 7, 31 + 7 * (w - 1) + 6, 23, 0, 0, 0).getTime();
const semanaDe = (ts) => { let w = 1; while (w < SEMANAS && lunes(w + 1) <= ts) w++; return w; };

// ── Fabricar el log ───────────────────────────────────────────────────────────
// Duración realista: series × (35 s + descanso) + 180 s por ejercicio + 480 s,
// ±10 % con una tabla fija.
const FACTOR = [0.93, 1.04, 0.98, 1.08, 0.91, 1.02, 0.96, 1.06, 1.0, 0.95];

function fabricar(p) {
  const log = [];
  for (let w = 1; w <= SEMANAS; w++) {
    p.sesiones(w).forEach((s, i) => {
      const seg = s.ejercicios.reduce((a, e) => a + e.sets.length * (35 + e.rest) + 180, 480);
      log.push({
        id: `${p.id}-${w}-${i}`,
        timestamp: new Date(2026, 7, 31 + 7 * (w - 1) + s.dia, 18, 0, 0, 0).getTime(),
        duration: Math.round(seg * FACTOR[(w * 3 + i * 7 + s.dia) % 10] * 1000),
        ...(s.rpe != null ? { sessionRpe: s.rpe } : {}),
        bodyWeight: p.bodyWeight,
        exercises: s.ejercicios.map((e) => ({
          exerciseId: e.id, restSec: e.rest,
          sets: e.sets.map(([peso, reps]) => ({ weight: String(peso), reps: String(reps), done: true })),
        })),
      });
    });
  }
  return log;
}

// ── Textos ────────────────────────────────────────────────────────────────────
const nombreGrupo = (g) => (g === 'other' ? 'otros' : es.exerciseSelector.groups[g] ?? g);
const grupoMin = (g) => nombreGrupo(g).toLowerCase();
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
const media = (v) => v.reduce((a, b) => a + b, 0) / v.length;
const sumaONull = (v) => { const x = v.filter((n) => n != null); return x.length ? x.reduce((a, b) => a + b, 0) : null; };
const bodyWeightDe = (log) =>
  [...log].filter((e) => e.bodyWeight != null).sort((a, b) => b.timestamp - a.timestamp)[0]?.bodyWeight ?? null;

// ── «Hoy en la app»: LoadTab.jsx, línea por línea ─────────────────────────────
// Se llama con Date.now() ya fijado al domingo 23:00 de la semana.
function hoyEnLaApp(log, w) {
  const now = Date.now();
  const bodyWeight = bodyWeightDe(log);
  const loads = sessionLoads(log, EX, { fallbackBodyWeight: bodyWeight });
  const days = dailySeries(loads);
  const internal = days.map((d) => d.internal);
  const mean7 = rollingMean(internal, 7);
  const mean28 = rollingMean(internal, 28);

  const week = internal.slice(-7);
  const weekSessions = days.slice(-7).reduce((a, d) => a + d.sessions, 0);
  const weekLoad = week.reduce((a, v) => a + (v ?? 0), 0);
  const m7 = mean7[mean7.length - 1];
  const m28 = mean28[mean28.length - 1];
  const enough = weekSessions >= MIN_SESSIONS_FOR_MONOTONY;
  const mono = enough ? monotony(week) : null;
  const strn = enough ? strain(week) : null;

  const prevStrains = [];
  for (let k = 1; k <= 4; k++) {
    const from = internal.length - 7 * (k + 1);
    if (from < 0) break;
    const s = strain(internal.slice(from, from + 7));
    if (s != null) prevStrains.push(s);
  }
  const prevWeekSessions = [];
  for (let k = 1; k <= 4; k++) {
    const from = days.length - 7 * (k + 1);
    if (from < 0) break;
    prevWeekSessions.push(days.slice(from, from + 7).reduce((a, d) => a + d.sessions, 0));
  }
  const avgSessions = prevWeekSessions.length ? media(prevWeekSessions) : null;
  const strainBase = prevStrains.length ? media(prevStrains) : null;
  const vs28 = m28 > 0 && m7 != null ? Math.round((m7 / m28 - 1) * 100) : null;
  const strainPct = strn != null && strainBase > 0 ? Math.round((strn / strainBase - 1) * 100) : null;
  const state = loadState(m7, m28);

  // Series por grupo: ventana móvil de 7 días (y 28 para los grupos a cero).
  const wk = setsByMuscleGroup(log, EX, { from: now - 7 * DAY, to: now });
  const mes = setsByMuscleGroup(log, EX, { from: now - 28 * DAY, to: now });
  const byGroup = new Map(wk.map((g) => [g.group, g.sets]));
  for (const { group } of mes) if (!byGroup.has(group)) byGroup.set(group, 0);
  const grupos = [...byGroup.entries()].map(([group, sets]) => ({ group, nombre: nombreGrupo(group), sets }))
    .sort((a, b) => b.sets - a.sets);

  // Esfuerzo vs carga (lectura sobre la serie completa).
  const allWeeks = weeklySeries(days);
  const tendencia = allWeeks.length < 2 ? null : effortTrend(
    indexTo100(allWeeks.map((x) => x.external)),
    indexTo100(allWeeks.map((x) => x.internal)),
  );

  // Rendimiento con el selector por defecto (3M = 13 semanas).
  const all = performanceWeekly(log, EX, { fallbackBodyWeight: bodyWeight });
  let rend = null;
  if (all.length >= 2) {
    const visible = all.slice(-13);
    const values = indexTo100(visible.map((x) => x.index));
    const last = [...values].reverse().find((v) => v != null);
    rend = {
      pct: last != null ? Math.round(last - 100) : null,
      semanas: visible.length,
      // ¿el último punto es de ESTA semana? Si no, el panel enseña un dato viejo sin avisar.
      actual: visible[visible.length - 1].weekStart === lunes(w),
    };
  }

  const hasSessions = loads.length > 0;
  const hasRpe = loads.some((l) => l.internal != null);
  const monoEtiqueta = mono == null ? 'pocas sesiones'
    : mono >= MONOTONY_HIGH ? 'repetitiva' : mono >= MONOTONY_MODERATE ? 'normal' : 'variada';
  return {
    vacia: !hasSessions ? 'sin sesiones' : !hasRpe ? 'sin sRPE' : null,
    carga: vs28 != null ? `${vs28 > 0 ? '+' : ''}${vs28}%` : String(Math.round(weekLoad)),
    cargaEs: vs28 != null ? 'vs media 28d' : 'esta semana',
    estado: state,
    sesiones7d: weekSessions,
    mediaSesiones: avgSessions,
    mono, monoEtiqueta, strainPct, tendencia, rend, grupos,
  };
}

// ── «Propuesto»: el resumen de la semana en frases ────────────────────────────
// Datos de cada semana a partir del log y de loads (ya inmutables: la referencia
// de 1RM de una sesión solo mira hacia atrás, así que loads vale para todas).
function datosSemana(p, w, log, loads) {
  const dela = log.filter((e) => semanaDe(e.timestamp) === w);
  const ls = loads.filter((l) => semanaDe(l.timestamp) === w);
  const ext = sumaONull(ls.map((l) => l.external));
  const int = sumaONull(ls.map((l) => l.internal));
  const rpes = dela.map((e) => e.sessionRpe).filter((x) => x != null);
  const hecho = setsByMuscleGroup(log, EX, { from: lunes(w), to: domingo(w) });
  const prev = plannedSetsByGroup(p.plan(w), EX);
  return {
    sesiones: dela.length,
    series: dela.reduce((a, e) => a + e.exercises.reduce((b, x) => b + x.sets.length, 0), 0),
    rpeMedio: rpes.length ? media(rpes) : null,
    previstas: p.previstas,
    ext, int, ratio: ext > 0 && int != null ? int / ext : null,
    hecho, prev,
    tieneRpe: rpes.length > 0,
  };
}

// Media de una magnitud en las 4 semanas anteriores que tuvieron sesión.
function mediaPrevia(datos, w, clave) {
  const v = [];
  for (let k = 1; k <= 4; k++) {
    const d = datos[w - k];
    if (d && d.sesiones > 0 && d[clave] != null) v.push(d[clave]);
  }
  return { n: v.length, media: v.length ? media(v) : null };
}

function frases(d, w, datos, fuerzaPct) {
  const out = {};
  const res = { sesiones: `${plural(d.sesiones, 'sesión', 'sesiones')} de ${plural(d.previstas, 'prevista', 'previstas')}.` };

  // Trabajo
  const mt = mediaPrevia(datos, w, 'ext');
  let trabajoPct = null;
  if (d.sesiones === 0) res.trabajo = 'Semana sin entrenar.';
  else if (mt.n < 2) res.trabajo = 'Primeras semanas: aún no hay una media con la que comparar.';
  else {
    trabajoPct = (d.ext / mt.media - 1) * 100;
    const x = Math.round(Math.abs(trabajoPct));
    res.trabajo = Math.abs(trabajoPct) <= 10 ? 'Lo normal para ti.'
      : trabajoPct > 0 ? `Un ${x} % más de trabajo que tu media.` : `Un ${x} % menos de trabajo que tu media.`;
  }
  out.trabajoPct = trabajoPct;

  // Coste (solo con sRPE; necesita media con ≥2 semanas, como el trabajo)
  let coste = null;
  if (d.tieneRpe && d.ratio != null) {
    const mc = mediaPrevia(datos, w, 'ratio');
    if (mc.n >= 2) {
      const r = d.ratio / mc.media - 1;
      coste = r > 0.15 ? 'mas' : r < -0.15 ? 'menos' : 'normal';
      res.coste = { mas: 'Te costó más de lo normal para ese trabajo.', menos: 'Te costó menos de lo normal.', normal: 'Te costó lo normal.' }[coste];
      out.costePct = r * 100;
    }
  }
  out.coste = coste;

  // Grupos (semana natural)
  const hecho = new Map(d.hecho.map((g) => [g.group, g.sets]));
  const faltan = d.prev.filter((g) => (hecho.get(g.group) ?? 0) < g.sets - 1);
  res.grupos = faltan.length
    ? `Te faltan: ${faltan.map((g) => `${grupoMin(g.group)} (${hecho.get(g.group) ?? 0} de ${g.sets})`).join(', ')}.`
    : 'Has completado el volumen previsto.';
  out.bajos = d.prev.filter((g) => g.sets > 0 && (hecho.get(g.group) ?? 0) < g.sets * 0.5).map((g) => g.group);

  // Fuerza
  let fuerza = null;
  if (fuerzaPct != null) {
    fuerza = fuerzaPct > 2 ? 'sube' : fuerzaPct < -2 ? 'baja' : 'mantiene';
    const x = Math.round(Math.abs(fuerzaPct));
    res.fuerza = fuerza === 'sube' ? `Tu fuerza sube (+${x} % en 4 semanas).`
      : fuerza === 'baja' ? `Tu fuerza baja (−${x} % en 4 semanas).` : 'Tu fuerza se mantiene.';
  }
  out.fuerza = fuerza;
  out.fuerzaPct = fuerzaPct;
  out.frases = res;
  return out;
}

function avisos(est, w) {
  const chips = [];
  const e = est[w], a = est[w - 1], a2 = est[w - 2];
  if ((e.trabajoPct > 30 && a?.trabajoPct > 30) || (e.coste === 'mas' && e.trabajoPct > 10)) chips.push('Se está pasando');
  if (e.fuerza && ['mantiene', 'baja'].includes(e.fuerza) && a && a2
    && [a, a2].every((x) => ['mantiene', 'baja'].includes(x.fuerza))
    && [e, a, a2].every((x) => !(x.trabajoPct < -30))) chips.push('Plano');
  const bajo = (x) => x.sesiones < x.previstas * 0.5;
  if (e.sesiones === 0 || (bajo(e) && a && bajo(a))) chips.push('No viene');
  if (a) for (const g of e.bajos) if (a.bajos.includes(g)) chips.push(`Le falta ${grupoMin(g)}`);
  return chips;
}

// ── Pasada ────────────────────────────────────────────────────────────────────
const resultado = [];

it('visor de carga', () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  for (const p of PERSONAS) {
    const full = fabricar(p);
    const loads = sessionLoads(full, EX, { fallbackBodyWeight: bodyWeightDe(full) });
    const datos = {}, est = {}, semanas = [];
    for (let w = 1; w <= SEMANAS; w++) {
      vi.setSystemTime(domingo(w));
      const log = full.filter((e) => e.timestamp <= domingo(w));
      datos[w] = datosSemana(p, w, log, loads);

      // Fuerza: índice de performanceWeekly de esta semana contra el de hace 4.
      const perf = performanceWeekly(log, EX, { fallbackBodyWeight: bodyWeightDe(log) });
      const ahora = perf.find((x) => x.weekStart === lunes(w))?.index;
      const antes = w > 4 ? perf.find((x) => x.weekStart === lunes(w - 4))?.index : null;
      const fuerzaPct = ahora != null && antes != null ? (ahora / antes - 1) * 100 : null;

      est[w] = { ...datos[w], ...frases(datos[w], w, datos, fuerzaPct) };
      const chips = avisos(est, w);
      const d = datos[w];
      semanas.push({
        n: w, nota: p.notas[w - 1],
        hizo: { sesiones: d.sesiones, series: d.series, rpe: d.rpeMedio, ext: d.ext, int: d.int },
        hoy: hoyEnLaApp(log, w),
        propuesto: { frases: est[w].frases, chips, trabajoPct: est[w].trabajoPct, costePct: est[w].costePct ?? null, fuerzaPct },
      });
    }
    resultado.push({ id: p.id, nombre: p.nombre, perfil: p.perfil, conRpe: p.conRpe, previstas: p.previstas, semanas });
  }
  vi.useRealTimers();
});

afterAll(() => {
  const out = process.env.VISOR_OUT ?? fileURLToPath(new URL('./visor-carga.json', import.meta.url));
  writeFileSync(out, JSON.stringify(resultado, null, 1));
});
