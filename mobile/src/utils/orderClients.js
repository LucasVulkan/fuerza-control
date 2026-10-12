/**
 * Orden de la lista de Clientes (C08-clientes-dashboard.md §6.2). Puro: la
 * pantalla le pasa cómo leer cada dato de un cliente.
 *
 * Reglas, en este orden:
 *   1. Con una lente (adherencia / mejora) y criterio distinto de «a mano»: por
 *      la cifra de la lente, de peor a mejor; los que no la tienen, al final.
 *   2. Con `needsFirst`: primero por `rankOf` (los avisos por prioridad, luego
 *      los que tienen sin revisar, luego el resto) y dentro de cada grupo el
 *      criterio.
 *   3. El criterio: actividad (el más reciente primero), nombre, o a mano (por
 *      posición en `manual`; los que no están, al final por fecha de alta).
 */

export const DEFAULT_CLIENTS_ORDER = { by: 'activity', needsFirst: true, manual: [] };

const nullLast = (a, b) => (a == null ? (b == null ? 0 : 1) : b == null ? -1 : a - b);

export function orderClients(list, {
  by = 'activity', needsFirst = true, manual = [], lens = null,
  metricOf = () => null, rankOf = null, lastTsOf = () => 0,
} = {}) {
  const pos  = new Map(manual.map((id, i) => [id, i]));
  const base =
      by === 'name'   ? (a, b) => String(a.name ?? '').localeCompare(String(b.name ?? ''))
    : by === 'manual' ? (a, b) => (pos.get(a.id) ?? manual.length) - (pos.get(b.id) ?? manual.length)
        || String(a.createdAt ?? '').localeCompare(String(b.createdAt ?? ''))
        || String(a.id).localeCompare(String(b.id))
    :                   (a, b) => (lastTsOf(b) ?? 0) - (lastTsOf(a) ?? 0);

  if (lens && by !== 'manual') return [...list].sort((a, b) => nullLast(metricOf(a), metricOf(b)));
  if (!needsFirst || !rankOf)  return [...list].sort(base);
  return [...list].sort((a, b) => rankOf(a) - rankOf(b) || base(a, b));
}
