// Visor de progresión: pasa cada caso de casos.js por el motor REAL
// (getProgression + planSet) sesión a sesión y escribe el resultado en JSON.
//   npx vitest run -c scripts/visor-progresion/vitest.config.mjs
// Corre bajo vitest para reutilizar los alias de vite.config.js.
import { it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { getProgression, progressionHistory } from '../../mobile/src/utils/progression';
import { planSet } from '../../mobile/src/utils/setPlan';
import { EXERCISE_LIBRARY } from '../../mobile/src/data/exerciseLibrary';
import es from '../../mobile/src/locales/es.json';
import { CASOS } from './casos';

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

function correr(caso) {
  const def = EXERCISE_LIBRARY[caso.ejercicio];
  const cfg = caso.config;
  const recientes = []; // { sets } de la más reciente a la más antigua
  let dia = 0;
  const filas = [];

  const proponer = () => {
    const last = recientes[0];
    if (!last) return { chip: null, plan: null };
    const chip = getProgression(cfg, def, last.sets, t, progressionHistory(recientes));
    const plan = Array.from({ length: cfg.sets }, (_, index) =>
      planSet({ exConfig: cfg, def, chip, lastSets: last.sets, index }));
    return { chip, plan };
  };

  for (const s of caso.sesiones) {
    dia += s.dias ?? 3;
    const { chip, plan } = proponer();
    const sets = Array.from({ length: cfg.sets }, (_, i) => {
      const gris = plan?.[i];
      const weight = s.peso ?? num(gris?.weight.value) ?? caso.pesoInicial ?? 0;
      const reps = caso.tiempo ? '' : String(s.reps === 'gris' ? gris?.reps.value : s.reps[i]);
      const time = caso.tiempo ? String(s.tiempos === 'gris' ? gris?.time.value : s.tiempos[i]) : '';
      const rpe = s.rpe?.[i] ?? '';
      return { weight: String(weight), reps, time, rpe: String(rpe), done: true };
    });
    filas.push({ dia, chip: resumen(chip), plan: planTexto(plan, caso), hizo: sets, nota: s.nota ?? '' });
    recientes.unshift({ sets });
  }
  const { chip, plan } = proponer();
  filas.push({ dia: null, chip: resumen(chip), plan: planTexto(plan, caso), hizo: null, nota: 'Lo que pediría en la siguiente sesión' });
  return { ...caso, nombreEjercicio: def.name, filas };
}

const resumen = (c) => c && {
  tipo: c.type, msg: c.msg, why: c.why, peso: c.suggestedWeight ?? null,
  reps: c.suggestedReps ?? null, tiempo: c.suggestedTime ?? null, e1rm: c.e1rm ?? null, assist: !!c.assist,
};

const planTexto = (plan, caso) => plan && plan.map((p) => ({
  peso: p.weight.value, reps: caso.tiempo ? p.time.value : p.reps.value,
  fuente: caso.tiempo ? p.time.source : p.reps.source,
}));

it('visor de progresión', () => {
  const out = process.env.VISOR_OUT ?? 'visor-progresion.json';
  writeFileSync(out, JSON.stringify(CASOS.map(correr), null, 1));
});
