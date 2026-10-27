// Prototipo del motor de progresión PROPUESTO (replanteo del 27-oct-2026).
// Vive aquí, fuera de la app, solo para compararlo en el visor con el de hoy.
// Lo acordado con el usuario:
//   Peso (Doble): fallo leve → mantener; fallo grande o segundo fallo seguido
//     → −10 % redondeado al escalón (mínimo un escalón). Un fallo leve que mejora
//     (más reps en total que la sesión anterior con el mismo peso) no cuenta. «Parcial N de M» con
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
  let previa = null; // { w, total } de la sesión anterior
  const vol = { meta: null, anterior: null, fallos: 0 }; // Reps y Tiempo

  const kg = (v) => `${String(v).replace('.', ',')} kg`;
  const series = (k) => (k === n ? `las ${n} series` : `${k} de ${n} series`);
  const repsTxt = (k) => `${k} ${k === 1 ? 'rep' : 'reps'}`;
  const may = (txt) => txt.charAt(0).toUpperCase() + txt.slice(1);

  function doble(sets) {
    const reps = sets.map((s) => Number(s.reps));
    const w = Math.max(0, ...sets.map((s) => Number(s.weight) || 0));
    const { minReps: min, maxReps: max } = cfg;
    const conRango = max > min;
    const arriba = reps.filter((r) => r >= max).length;
    const rpes = sets.map((s) => s.rpe).filter((v) => v !== '' && v != null).map(Number);
    const rpeMedio = rpes.length ? rpes.reduce((a, b) => a + b, 0) / rpes.length : null;
    const ev = prog.evaluation;
    const frena = ev.mode === 'rpe' && rpeMedio != null && rpeMedio > ev.maxRpe;
    const sube = ev.mode === 'part'
      ? arriba >= ev.need && (!conRango || reps.every((r) => r >= min))
      : arriba === n && !frena;
    const faltanReps = reps.reduce((a, r) => a + Math.max(0, min - r), 0);
    const faltan = faltanReps / (min * n);
    const asist = prog.direction === 'decrease';
    const inc = prog.increment.type === 'pct'
      ? Math.max(prog.step, redondear(w * prog.increment.pct / 100, prog.step)) : prog.increment.value;
    // Lo que hay que hacer para subir, dicho igual en todos los mensajes.
    const meta = ev.mode === 'part' && conRango
      ? `llega a ${max} en ${series(ev.need)} (y el resto a ${min} o más) ${asist ? 'para quitar ayuda' : 'para subir'}`
      : `llega a ${max} en ${series(ev.mode === 'part' ? ev.need : n)}${ev.mode === 'rpe' ? ` con RPE medio de ${ev.maxRpe} o menos` : ''} ${asist ? 'para quitar ayuda' : 'para subir'}`;
    const titulo = (tipo, peso) => (asist
      ? { up: `Quita ayuda: ${kg(peso)}`, hold: `Mantén ${kg(peso)} de ayuda`, down: `Añade ayuda: ${kg(peso)}` }
      : { up: `Sube a ${kg(peso)}`, hold: `Mantén ${kg(peso)}`, down: `Baja a ${kg(peso)}` })[tipo];

    const total = reps.reduce((a, r) => a + r, 0);
    const mejora = previa && previa.w === w && total > previa.total;
    previa = { w, total };
    if (sube) {
      fallosPeso = 0;
      const peso = asist ? Math.max(0, w - inc) : w + inc;
      return { tipo: 'up', peso, reps: Array(n).fill(max), titulo: titulo('up', peso), why: may(meta.replace('para subir', 'para volver a subir')) };
    }
    if (faltan > 0) {
      const grande = faltan > FALLO_GRANDE;
      if (mejora && !grande) {
        fallosPeso = 0;
        return { tipo: 'hold', peso: w, reps, titulo: titulo('hold', w), why: `Vas mejorando (${total} reps); ${meta}` };
      }
      fallosPeso += 1;
      if ((grande || fallosPeso >= 2) && prog.down !== 'never' && w > 0) {
        fallosPeso = 0;
        const peso = asist ? Math.max(redondear(w * 1.1, prog.step), w + prog.step)
          : Math.max(0, Math.min(redondear(w * 0.9, prog.step), w - prog.step));
        const motivo = grande ? `Te faltaron ${repsTxt(faltanReps)} para el mínimo (${min})` : 'Segundo día seguido sin llegar al mínimo';
        return { tipo: 'down', peso, reps: Array(n).fill(max), titulo: titulo('down', peso), why: motivo };
      }
      return { tipo: 'hold', peso: w, reps, titulo: titulo('hold', w), why: `Te faltaron ${repsTxt(faltanReps)} para el mínimo (${min})` };
    }
    fallosPeso = 0;
    const why = frena && arriba === n
      ? `Llegaste arriba, pero con RPE medio ${String(Math.round(rpeMedio * 10) / 10).replace('.', ',')} (máx. ${ev.maxRpe})`
      : may(meta);
    return { tipo: 'hold', peso: w, reps, titulo: titulo('hold', w), why };
  }

  function volumen(sets, campo, porSerie, u) {
    const total = sets.reduce((a, s) => a + Number(s[campo]), 0);
    const antes = vol.meta;
    let why;
    if (vol.meta == null) {
      vol.meta = total + n * porSerie; why = `La última vez hiciste ${total}${u}`;
    } else if (total >= vol.meta) {
      vol.meta = total + n * porSerie; vol.fallos = 0; why = `Llegaste a la meta: la última vez hiciste ${total}${u}`;
    } else if (total >= vol.anterior) {
      vol.fallos = 0; why = `${total > vol.anterior ? 'Vas mejorando' : 'Igual que el día anterior'}: la última vez hiciste ${total}${u}`;
    } else if (++vol.fallos >= 2) {
      vol.meta = total + n * porSerie; vol.fallos = 0; why = `Dos días por debajo: la última vez hiciste ${total}${u}`;
    } else {
      why = `La última vez hiciste ${total}${u}, menos que el día anterior`;
    }
    vol.anterior = total;
    const tipo = antes == null || vol.meta > antes ? 'up' : vol.meta < antes ? 'down' : 'hold';
    const titulo = `${vol.meta}${u || ' reps'} en total`;
    return { tipo, peso: null, reps: repartir(vol.meta, n), titulo, why, total: vol.meta };
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
