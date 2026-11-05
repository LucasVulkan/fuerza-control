/**
 * Dónde cae el globo del recorrido (U17-01 §3.2): debajo del elemento, o encima
 * si debajo no cabe; sin elemento, centrado. Lógica pura, para poder probarla.
 *
 * @param {{y:number,h:number}|null} rect  el hueco (ya con su margen), en ventana
 * @param {number} winH     alto de la ventana
 * @param {number} bubbleH  alto del globo
 * @param {number} safeTop / safeBottom  las zonas del sistema que no se pisan
 * @returns {{top:number, side:'below'|'above'|null}} el `top` del globo y de qué lado del
 *          elemento cae; `null` si va centrado o no cabe en ninguno (sin piquito)
 */
export function placeBubble({ rect, winH, bubbleH, safeTop = 0, safeBottom = 0, gap = 12, margin = 12 }) {
  const min = safeTop + margin;
  const max = Math.max(min, winH - safeBottom - margin - bubbleH);
  if (!rect) return { top: Math.min(max, Math.max(min, (winH - bubbleH) / 2)), side: null };
  const below = rect.y + rect.h + gap;
  if (below <= max) return { top: below, side: 'below' };
  const above = rect.y - gap - bubbleH;
  if (above >= min) return { top: above, side: 'above' };
  // No cabe en ninguno: del lado con más sitio, pegado al borde (tapa algo del elemento).
  return { top: rect.y - min > winH - safeBottom - margin - (rect.y + rect.h) ? min : max, side: null };
}
