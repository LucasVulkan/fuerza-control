/**
 * Marcas del eje vertical de las gráficas de progreso: paso «redondo» (1, 2, 5
 * × 10ⁿ), nunca por debajo de 1 —el eje va en enteros: ½ kg en una marca no
 * dice nada— y de tres a cinco marcas que envuelven los datos.
 */
export function niceTicks(min, max) {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [];
  const raw  = Math.max(max - min, 1) / 3;
  const mag  = 10 ** Math.floor(Math.log10(raw));
  const step = Math.max(1, Math.round([1, 2, 5, 10].map((k) => k * mag).find((s) => s >= raw)));
  const lo = Math.floor(min / step) * step;
  const hi = Math.max(Math.ceil(max / step) * step, lo + step);
  const ticks = [];
  for (let v = lo; v <= hi; v += step) ticks.push(v);
  return ticks;
}

/** Etiqueta de una marca: entera, y en miles a partir de 10 000 (12k). */
export const tickLabel = (v) => (Math.abs(v) >= 10000 ? `${Math.round(v / 1000)}k` : String(v));
