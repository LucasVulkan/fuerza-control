// Visor de progresión: pasa cada caso de casos.js sesión a sesión por dos
// motores y escribe el resultado en JSON:
//   hoy        — el REAL de la app (getProgression + planSet)
//   propuesto  — el prototipo de motorPropuesto.js (lo acordado, aún no en la app)
// En cada uno el atleta sigue lo que le propone ESE motor; las reps de casos.js
// son las mismas.
//   npx vitest run -c scripts/visor-progresion/vitest.config.mjs
// Corre bajo vitest para reutilizar los alias de vite.config.js.
import { it, expect } from 'vitest';
import { writeFileSync } from 'node:fs';
import process from 'node:process';
import { getProgression, progressionHistory } from '../../mobile/src/utils/progression';
import { planSet } from '../../mobile/src/utils/setPlan';
import { EXERCISE_LIBRARY } from '../../mobile/src/data/exerciseLibrary';
import es from '../../mobile/src/locales/es.json';
import { CASOS } from './casos';
import { crearMotorPropuesto } from './motorPropuesto';

// i18next mínimo: clave con puntos, plural _one/_other y {{x}}.
function t(key, opts = {}) {
  const get = (k) => k.split('.').reduce((o, p) => o?.[p], es);
  let s = (opts.count != null && get(`${key}_${opts.count === 1 ? 'one' : 'other'}`)) || get(key);
  if (typeof s !== 'string') return key;
  return s.replace(/\{\{(\w+)\}\}/g, (_, k) => {
    const v = opts[k];
    return typeof v === 'number' ? String(v).replace('.', ',') : (v ?? '');
  });
}

const num = (v) => (v === '' || v == null ? null : Number(v));

// Motor de hoy: { chip, plan[] } con plan[i] = { peso, reps, fuente }.
function motorHoy(cfg, def, caso) {
  return (recientes) => {
    const last = recientes[0];
    const chip = getProgression(cfg, def, last.sets, t, progressionHistory(recientes));
    const plan = Array.from({ length: cfg.sets }, (_, index) => {
      const p = planSet({ exConfig: cfg, def, chip, lastSets: last.sets, index });
      return { peso: p.weight.value, reps: caso.tiempo ? p.time.value : p.reps.value };
    });
    // Lo que hace el atleta en las sesiones 'gris': la meta del chip, como en el
    // propuesto (peso del chip; reps al máximo si cambia el peso, si no las suyas).
    const objetivo = chip && last.sets.map((s, i) => ({
      peso: chip.suggestedWeight ?? s.weight,
      reps: chip.perSet?.[i] ?? (chip.type === 'hold' || chip.effort ? (caso.tiempo ? s.time : s.reps) : cfg.maxReps),
    }));
    return {
      chip: chip && {
        tipo: chip.type, why: chip.why, peso: chip.suggestedWeight ?? null, reps: chip.suggestedReps ?? null,
        tiempo: chip.suggestedTime ?? null, e1rm: chip.e1rm ?? null, assist: !!chip.assist, total: chip.goal?.total ?? null,
      },
      goal: chip?.goal,
      plan,
      objetivo,
    };
  };
}

function motorNuevo(cfg, def, caso) {
  const siguiente = crearMotorPropuesto(cfg, def, t);
  const assist = def.progressionDirection === 'decrease';
  return (recientes) => {
    const p = siguiente(recientes);
    if (!p) return { chip: null, plan: null };
    const total = p.total != null ? p.total : null;
    // El gris es SIEMPRE lo que hizo la última vez; la meta va en el mensaje.
    // `objetivo` es lo que hace el atleta en las sesiones marcadas 'gris'.
    const last = recientes[0].sets;
    return {
      chip: { tipo: p.tipo, titulo: p.titulo, why: p.why, peso: p.peso, e1rm: p.e1rm ?? null, assist, total },
      plan: last.map((s) => ({ peso: s.weight, reps: caso.tiempo ? s.time : s.reps })),
      objetivo: p.reps.map((r) => ({ peso: p.peso ?? last[0].weight, reps: r })),
    };
  };
}

function correr(caso, crear) {
  const def = EXERCISE_LIBRARY[caso.ejercicio];
  const cfg = caso.config;
  const proponer = crear(cfg, def, caso);
  const recientes = [];
  let dia = 0;
  let prop = { chip: null, plan: null };
  const filas = [];
  for (const s of caso.sesiones) {
    dia += s.dias ?? 3;
    const sets = Array.from({ length: cfg.sets }, (_, i) => {
      const gris = (prop.objetivo ?? prop.plan)?.[i];
      const weight = s.peso ?? num(gris?.peso) ?? caso.pesoInicial ?? 0;
      const reps = caso.tiempo ? '' : String(s.reps === 'gris' ? gris?.reps : s.reps[i]);
      const time = caso.tiempo ? String(s.tiempos === 'gris' ? gris?.reps : s.tiempos[i]) : '';
      return { weight: String(weight), reps, time, rpe: String(s.rpe?.[i] ?? ''), done: true };
    });
    filas.push({ dia, ...prop, hizo: sets, nota: s.nota ?? '' });
    recientes.unshift({ sets, ...(prop.goal ? { goal: prop.goal } : {}) });
    prop = proponer(recientes);
  }
  filas.push({ dia: null, ...prop, hizo: null, nota: 'Lo que pediría en la siguiente sesión' });
  return filas;
}

// El motor real tiene que decir lo mismo que el prototipo acordado (P18):
// mismo tipo y misma cifra (peso, o el total en Reps y Tiempo) en cada fila.
// `VISOR_TIPOS`: los tipos ya implementados que se comparan.
export function diferencias(caso) {
  const hoy = correr(caso, motorHoy);
  const nuevo = correr(caso, motorNuevo);
  return hoy.flatMap((f, i) => {
    const a = f.chip; const b = nuevo[i].chip;
    if (!a && !b) return [];
    const ok = a && b && a.tipo === b.tipo && (b.total != null ? a.total === b.total : a.peso === b.peso);
    return ok ? [] : [`${caso.id} fila ${i + 1}: real ${JSON.stringify(a && [a.tipo, a.total ?? a.peso])} · prototipo ${JSON.stringify(b && [b.tipo, b.total ?? b.peso])}`];
  });
}

it('el motor real dice lo mismo que el prototipo', () => {
  const tipos = (process.env.VISOR_TIPOS ?? 'double,reps,time').split(',');
  const difs = CASOS.filter((c) => tipos.includes(c.config.progression.type)).flatMap(diferencias);
  expect(difs).toEqual([]);
});

it('visor de progresión', () => {
  const out = process.env.VISOR_OUT ?? 'visor-progresion.json';
  const res = CASOS.map((caso) => ({
    ...caso,
    nombreEjercicio: EXERCISE_LIBRARY[caso.ejercicio].name,
    hoy: correr(caso, motorHoy),
    propuesto: correr(caso, motorNuevo),
  }));
  writeFileSync(out, JSON.stringify(res, null, 1));
});
