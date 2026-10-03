/**
 * scrubScale — la regla que se despliega al arrastrar una casilla de KG, reps o
 * RPE (U10-01, docs/specs/U10-todo-pesa.md §2.3 y §2.4). Todo puro: `ScrubRuler`
 * y el gesto de `SetRow` solo pintan y reenvían.
 *
 * Dos clases de regla, las dos descritas por el mismo origen
 * `{ originX, originValue }` (x de la fila donde cae un valor conocido):
 *  · peso y reps — ANCLADA al dedo: el valor de partida cae justo bajo el dedo
 *    al activarse (el gesto empieza sin cambiarlo) y lo que cabe a cada lado
 *    depende de dónde esté el dedo. Suelo 0: por debajo no hay regla, y si el 0
 *    cayera dentro de la fila la regla se vuelve absoluta (0 en el margen).
 *  · RPE — FIJA y absoluta: 1..10 a lo ancho, el valor es el número bajo el dedo.
 *
 * ── LOS MANDOS ───────────────────────────────────────────────────────────────
 * Pasos a lo ancho, marcas y separación mínima de los números se afinan AQUÍ y
 * en ningún otro sitio (D1). `SCRUB_PAD` es el margen de la regla a cada lado.
 */

export const SCRUB_PAD = 16;

// tickEvery = marca mediana · labelEvery = marca grande (los números salen de
// las grandes, ver numberEvery); los pasos que no caen en marca llevan un punto
// (los 0,5 kg: | . : . | ). steps = pasos a lo ancho de la regla (ancho − 2·PAD):
// el peso son 16 kg (32 de 0,5) o 55 lb (55 de 1). `steps3` = la escala cuando
// la regla llega a 100 (números de tres cifras): menos números y más separados.
// En kg es la misma: es una herramienta de ajuste fino, con un dedo, entrenando.
// strongEvery = cada cuánto vibra «redondo» (impacto Light) en vez del tic fino
// (selection): 1 kg, 5 lb. Reps y RPE: ninguno, cada paso ya es una unidad (U10-10 §2.6.1).
const WEIGHT = {
  kg: { step: 0.5, tickEvery: 1, labelEvery: 2, steps: 32, steps3: 32, strongEvery: 1 },
  lb: { step: 1,   tickEvery: 1, labelEvery: 5, steps: 55, steps3: 36, strongEvery: 5 },
};
// Reps y segundos: anclados al dedo como el peso, todos los números a la vista
// (numberEvery fijo). Segundos de 5 en 5, 50 s a lo ancho: ~28 dp por paso, y
// «120» cabe (los números alternan blanco y gris, 30 blanco · 35 gris).
const FIELDS = {
  reps: { step: 1, tickEvery: 1, labelEvery: 1, numberEvery: 1, strongEvery: 0, steps: 12 },
  time: { step: 5, tickEvery: 5, labelEvery: 5, numberEvery: 5, strongEvery: 0, steps: 10 },
};
const RPE_STEPS  = 9;
const RPE = { min: 1, max: 10 };

// ── Bordes que desplazan la regla y cancelar (U10-10 §2.6.4-5) ───────────────
// Distancia del dedo al borde de la FILA: el indicador lima va de 0 a 1 entre
// FAR y NEAR; a menos de NEAR la regla avanza sola un paso cada SLOW_MS al
// entrar, que baja hasta FAST_MS pegado al borde.
export const SCRUB_EDGE_FAR    = 56;
export const SCRUB_EDGE_NEAR   = 24;
export const SCRUB_PAN_SLOW_MS = 180;
export const SCRUB_PAN_FAST_MS = 60;
// Dedo más de CANCEL_DY dp por encima de donde empezó (gs.dy < −CANCEL_DY) → cancelar.
export const SCRUB_CANCEL_DY   = 48;
// Vibrar solo al ir despacio: por encima de esta velocidad del dedo (gs.vx, en
// px/ms; 0,15 = 150 dp/s, unos 17 medios kilos por segundo) los pasos no vibran.
// Al recorrer la regla deprisa sobra; al afinar es cuando ayuda.
export const SCRUB_HAPTIC_MAX_VX = 0.15;
// Separación mínima en dp entre dos números en labelStrong: «60» ocupa ~16 dp y
// «100» ~23. Con tres cifras la escala ya se abre (steps3) para que quepan.
export const MIN_NUMBER_GAP = { two: 20, three: 32 };

const round2 = (n) => Math.round(n * 100) / 100;
const clamp  = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const num    = (n) => (Number.isFinite(n) ? n : 0);
const EPS    = 1e-9;

/** Menor múltiplo de `labelEvery` cuya separación en pantalla llega a `gap`. */
function numberEveryFor(labelEvery, step, px, gap) {
  if (!(px > 0)) return labelEvery;
  let m = 1;
  while ((m * labelEvery / step) * px < gap - EPS && m < 1000) m++;
  return round2(m * labelEvery);
}

/** x (en el sistema de la fila) de un valor. */
export const scrubXOf = (r, v) => r.originX + ((v - r.originValue) / r.step) * r.px;

/**
 * Valor en una x: el múltiplo de `step` más cercano (rejilla ABSOLUTA: con 55,9
 * en la casilla la regla va por 55,5 · 56 · 56,5, no por 55,4 · 56,4), dentro de
 * [min, max]. A menos de medio paso del origen se queda el valor de partida, que
 * puede no estar en la rejilla: sin mover el dedo, el valor no cambia.
 */
export function scrubValueAt(r, x) {
  if (!(r.px > 0) || Math.abs(x - r.originX) < r.px / 2 - EPS) return r.originValue;
  const v = r.originValue + ((x - r.originX) / r.px) * r.step;
  return clamp(round2(Math.round(v / r.step) * r.step), r.min, r.max);
}

/**
 * La regla de un campo.
 * @param {'weight'|'reps'|'rpe'} field
 * @param {number} start      valor de la casilla (escrito o fantasma); RPE lo ignora
 * @param {number} fingerX    x del dedo en la fila al activarse el gesto
 * @param {number} rowWidth   ancho de la fila
 * @param {{ unit?: 'kg'|'lb' }} [opts]
 * @returns {{ min, max, step, px, originX, originValue, tickEvery, labelEvery, numberEvery, strongEvery, start }}
 *   `start` = valor con el que arranca el gesto: el de partida, o el de bajo el dedo
 *   en las reglas absolutas (RPE, y peso/reps cuando el 0 caería dentro de la fila).
 */
export function scrubRuler(field, start, fingerX, rowWidth, { unit = 'kg' } = {}) {
  const wt = WEIGHT[unit === 'lb' ? 'lb' : 'kg'];
  if (field !== 'weight') return rulerFor(field, start, fingerX, rowWidth, field === 'rpe' ? RPE_STEPS : FIELDS[field].steps, wt);
  const r = rulerFor(field, start, fingerX, rowWidth, wt.steps, wt);
  return r.max >= 100 ? rulerFor(field, start, fingerX, rowWidth, wt.steps3, wt, true) : r;
}

function rulerFor(field, start, fingerX, rowWidth, steps, wt, threeDigits = false) {
  const px = Math.max(0, rowWidth - 2 * SCRUB_PAD) / steps;

  if (field === 'rpe') {
    const r = {
      min: RPE.min, max: RPE.max, step: 1, px, originX: SCRUB_PAD, originValue: RPE.min,
      tickEvery: 1, labelEvery: 1, numberEvery: 1, strongEvery: 0,
    };
    return { ...r, start: scrubValueAt(r, fingerX) };
  }

  const f = FIELDS[field] ?? wt;
  const { step, tickEvery, labelEvery, strongEvery } = f;
  const numberEvery = f.numberEvery
    ?? numberEveryFor(labelEvery, step, px, threeDigits ? MIN_NUMBER_GAP.three : MIN_NUMBER_GAP.two);
  const s   = field === 'reps' ? Math.max(0, Math.round(num(start))) : Math.max(0, round2(num(start)));
  const fx0 = clamp(fingerX, SCRUB_PAD, Math.max(SCRUB_PAD, rowWidth - SCRUB_PAD));
  // El 0 nunca queda dentro de la fila: si anclar el valor bajo el dedo dejaría
  // hueco a la izquierda (el suelo limita antes que el dedo), la regla pasa a ser
  // absoluta como la del RPE: 0 en el margen, y el valor es el de bajo el dedo.
  if (px > 0 && s / step + EPS < (fx0 - SCRUB_PAD) / px) {
    const r = {
      min: 0, max: round2(steps * step), step, px, originX: SCRUB_PAD, originValue: 0,
      tickEvery, labelEvery, numberEvery, strongEvery,
    };
    return { ...r, start: scrubValueAt(r, fingerX) };
  }
  // Extremos en la rejilla absoluta de `step` (ver scrubValueAt).
  const lo = px > 0 ? s - ((fx0 - SCRUB_PAD) / px) * step : s;
  const hi = px > 0 ? s + ((rowWidth - SCRUB_PAD - fx0) / px) * step : s;
  return {
    min: Math.max(0, round2(Math.ceil(lo / step - EPS) * step)),
    max: round2(Math.floor(hi / step + EPS) * step), step, px,
    originX: fx0, originValue: s,
    tickEvery, labelEvery, numberEvery, strongEvery,
    start: s,
  };
}

/**
 * Marcas de la regla: los múltiplos ABSOLUTOS de `step` dentro de [min,max]
 * (84, 84.5, 85… aunque el valor de partida sea 87,3). `dot` = paso sin marca
 * (no es múltiplo de `tickEvery`), se pinta como un punto; `major` = marca grande;
 * `numbered` = lleva número (múltiplo de `numberEvery`). `bright`: en el peso
 * los números alternan blanco y gris (20 blanco · 22 gris · 24 blanco), todos
 * del mismo tamaño y a la misma altura; en reps y RPE, todos blancos.
 */
export function scrubTicks(r) {
  const out = [];
  const isMult = (v, every) => { const q = v / every; return Math.abs(q - Math.round(q)) < 1e-6; };
  for (let i = Math.ceil(r.min / r.step - EPS); ; i++) {
    const value = round2(i * r.step) + 0;   // + 0: sin -0
    if (value > r.max + EPS) break;
    const numbered = isMult(value, r.numberEvery);
    out.push({
      value, major: isMult(value, r.labelEvery), dot: !isMult(value, r.tickEvery), numbered,
      bright: numbered && (r.numberEvery === 1 || isMult(value, 2 * r.numberEvery)),
    });
  }
  return out;
}

const isMultOf = (v, every) => { const q = v / every; return Math.abs(q - Math.round(q)) < 1e-6; };

/** ¿Paso «redondo» (vibra más fuerte)? Múltiplo de `strongEvery`; sin él, ninguno. */
export const scrubIsStrong = (r, v) => !!r.strongEvery && isMultOf(v, r.strongEvery);

/**
 * Diferencia con la partida para la segunda línea de la burbuja: «+2.5», «−1»
 * (signo menos tipográfico), redondeada a 2 decimales. Con 0, cadena vacía.
 */
export function scrubDiffText(value, initial) {
  const d = round2(value - initial);
  if (Math.abs(d) < 1e-9) return '';
  return (d > 0 ? '+' : '−') + String(Math.abs(d));
}

/** Distancia del dedo al borde más cercano de la fila y de qué lado cae (−1 izq, 1 der). */
const edgeOf = (x, rowWidth) => (x <= rowWidth - x ? { d: x, side: -1 } : { d: rowWidth - x, side: 1 });

/**
 * Intensidad del indicador de borde, −1..1 (negativa = borde izquierdo),
 * cuantizada a décimas para no re-renderizar en cada píxel.
 */
export function scrubEdge(x, rowWidth) {
  const { d, side } = edgeOf(x, rowWidth);
  const k = clamp((SCRUB_EDGE_FAR - d) / (SCRUB_EDGE_FAR - SCRUB_EDGE_NEAR), 0, 1);
  return side * Math.round(k * 10) / 10 + 0;
}

/** Hacia dónde avanza la regla: −1, 1, o 0 si el dedo no está a menos de NEAR del borde. */
export function scrubPanDir(x, rowWidth) {
  const { d, side } = edgeOf(x, rowWidth);
  return d <= SCRUB_EDGE_NEAR + EPS ? side : 0;
}

/** Milisegundos hasta el siguiente avance: SLOW al entrar en la zona, FAST pegado al borde. */
export function scrubPanMs(x, rowWidth) {
  const { d } = edgeOf(x, rowWidth);
  const k = clamp(d / SCRUB_EDGE_NEAR, 0, 1);
  return Math.round(SCRUB_PAN_FAST_MS + (SCRUB_PAN_SLOW_MS - SCRUB_PAN_FAST_MS) * k);
}

/**
 * Avanza la regla un paso hacia `dir` (1 = valores más altos bajo el dedo):
 * `min`, `max` y `originValue` ± step, `originX` no cambia. Si `originValue`
 * estaba fuera de la rejilla (55,9) cae en ella (56 hacia arriba, 55,5 hacia abajo),
 * así tras desplazar ya no hay zona muerta sobre un valor fuera de rejilla. Hacia
 * abajo se para cuando `min` llega a 0 (devuelve la misma regla).
 */
export function scrubPan(r, dir) {
  const d = dir > 0 ? 1 : -1;
  if (d < 0 && r.min - r.step < -EPS) return r;
  const g = r.originValue / r.step;
  const onGrid = Math.abs(g - Math.round(g)) < 1e-6;
  const next = onGrid ? Math.round(g) + d : (d > 0 ? Math.ceil(g) : Math.floor(g));
  return {
    ...r,
    min: round2(r.min + d * r.step),
    max: round2(r.max + d * r.step),
    originValue: round2(next * r.step),
  };
}
