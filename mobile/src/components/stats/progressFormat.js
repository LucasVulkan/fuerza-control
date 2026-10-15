// Lo que comparten Progreso y el detalle de un ejercicio.

// Los tres primeros son abreviaturas de unidad, iguales en los dos idiomas; el
// último es una palabra, así que la pantalla lo memoiza sobre `t`.
export const periodOptions = (t) => [
  { id: '7d',  label: '7D' },
  { id: '1m',  label: '1M' },
  { id: '3m',  label: '3M' },
  { id: 'all', label: t('stats.periodAll') },
];

export function fmtVol(raw, toDisplay) {
  const v = Math.round(toDisplay(raw));
  return v >= 1000 ? `${Math.round(v / 100) / 10}k` : String(v);
}
