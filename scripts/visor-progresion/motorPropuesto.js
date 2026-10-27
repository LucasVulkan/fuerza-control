// Prototipo del motor de progresión PROPUESTO (replanteo del 27-oct-2026).
// Vive aquí, fuera de la app, solo para compararlo en el visor con el de hoy.
// Lo acordado con el usuario:
//   Peso (Doble): fallo leve → mantener; fallo grande o segundo fallo seguido
//     → −10 % redondeado al escalón (mínimo un escalón). «Parcial N de M» con
//     rango: N arriba y el resto dentro del rango. «RPE máx.» solo frena.
//   Reps y Tiempo: meta = total + 1 por serie (en Tiempo, + el salto en
//     segundos), fija hasta alcanzarla; mejorar sin llegar no es fallo; fallar =
//     menos que la sesión anterior; 2.º fallo seguido → total de ese día + 1/serie.
//   Por esfuerzo: sin cambios (el motor de hoy).
import { resolveProgressionConfig, getProgression, progressionHistory } from '../../mobile/src/utils/progression';

// Fallo grande: faltan más de este tanto de las reps del mínimo (sumando series).
export const FALLO_GRANDE = 0.15;

const redondear = (kg, step) => Math.round(Math.round(kg / step) * step * 100) / 100;
const repartir = (total, n) => Array.from({ length: n }, (_, i) => Math.floor(total / n) + (i < total % n ? 1 : 0));

export function crearMotorPropuesto(cfg, def, t) {
  const prog = resolveProgressionConfig(cfg, def);
  const n = cfg.sets;
  let fallosPeso = 0;
  const vol = { meta: null, anterior: null, fallos: 0 }; // Reps y Tiempo

  function doble(sets) {
    const reps = sets.map((s) => Number(s.reps));
    const w = Math.max(0, ...sets.map((s) => Number(s.weight) || 0));
    const { minReps: min, maxReps: max } = cfg;
    const conRango = max > min;
    const arriba = reps.filter((r) => r >= max).length;
    const rpes = sets.map((s) => s.rpe).filter((v) => v !== '' && v != null).map(Number);
    const rpeMedio = rpes.length ? rpes.reduce((a, b) => a + b, 0) / rpes.length : null;
    const ev = prog.evaluation;
    const sube = ev.mode === 'part'
      ? arriba >= ev.need && (!conRango || reps.every((r) => r >= min))
      : arriba === n && !(ev.mode === 'rpe' && rpeMedio != null && rpeMedio > ev.maxRpe);
    const faltan = reps.reduce((a, r) => a + Math.max(0, min - r), 0) / (min * n);
    const asist = prog.direction === 'decrease';
    const inc = prog.increment.type === 'pct'
      ? Math.max(prog.step, redondear(w * prog.increment.pct / 100, prog.step)) : prog.increment.value;

    if (sube) {
      fallosPeso = 0;
      const peso = asist ? Math.max(0, w - inc) : w + inc;
      return { tipo: 'up', peso, reps: Array(n).fill(max), why: 'Llegaste arriba del rango' };
    }
    if (faltan > 0) {
      fallosPeso += 1;
      const grande = faltan > FALLO_GRANDE;
      if ((grande || fallosPeso >= 2) && prog.down !== 'never' && w > 0) {
        fallosPeso = 0;
        const peso = asist ? Math.max(redondear(w * 1.1, prog.step), w + prog.step)
          : Math.max(0, Math.min(redondear(w * 0.9, prog.step), w - prog.step));
        const motivo = grande ? `Fallo grande: faltó un ${Math.round(faltan * 100)} % de las reps` : 'Segundo fallo seguido';
        return { tipo: 'down', peso, reps: Array(n).fill(max), why: `${motivo} → −10 %` };
      }
      return { tipo: 'hold', peso: w, reps, why: `Fallo leve (faltó un ${Math.round(faltan * 100)} %): mantener` };
    }
    fallosPeso = 0;
    const freno = ev.mode === 'rpe' && arriba === n ? `RPE medio por encima de ${ev.maxRpe}: no sube` : 'Dentro del rango: mantener';
    return { tipo: 'hold', peso: w, reps, why: freno };
  }

  function volumen(sets, campo, porSerie, u) {
    const total = sets.reduce((a, s) => a + Number(s[campo]), 0);
    const antes = vol.meta;
    let why;
    if (vol.meta == null) {
      vol.meta = total + n * porSerie; why = `Primera vez: ${total}${u} → meta ${vol.meta}${u}`;
    } else if (total >= vol.meta) {
      vol.meta = total + n * porSerie; vol.fallos = 0; why = `Llegaste a la meta (${total}${u}): nueva meta ${vol.meta}${u}`;
    } else if (total >= vol.anterior) {
      vol.fallos = 0; why = `Mejoras (${total}${u} de ${vol.meta}${u}): sigue la meta`;
    } else if (++vol.fallos >= 2) {
      vol.meta = total + n * porSerie; vol.fallos = 0; why = `Segundo fallo seguido (${total}${u}): meta ${vol.meta}${u}`;
    } else {
      why = `Fallo (${total}${u}, menos que la vez anterior): sigue la meta`;
    }
    vol.anterior = total;
    const tipo = antes == null || vol.meta > antes ? 'up' : vol.meta < antes ? 'down' : 'hold';
    return { tipo, peso: null, reps: repartir(vol.meta, n), why, total: vol.meta };
  }

  return function siguiente(recientes) {
    const sets = recientes[0].sets;
    if (prog.type === 'effort') {
      const c = getProgression(cfg, def, sets, t, progressionHistory(recientes));
      return c && { tipo: c.type, peso: c.suggestedWeight, reps: Array(n).fill(cfg.minReps), why: c.why, e1rm: c.e1rm };
    }
    if (prog.type === 'reps') return volumen(sets, 'reps', 1, '');
    if (prog.type === 'time') return volumen(sets, 'time', prog.increment.value, ' s');
    return doble(sets);
  };
}
