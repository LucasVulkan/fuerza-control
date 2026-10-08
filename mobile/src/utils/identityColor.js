/**
 * Color de identidad de un cliente (C08-clientes-dashboard.md §3).
 *
 * `client.color` es un índice en la paleta `IDENTITY_COLORS` de `theme.js`
 * (el mismo índice vale para el juego oscuro y el claro). Se guarda en el
 * cliente: si se calculase por posición, borrar uno le cambiaría el color a los
 * demás.
 */

export const IDENTITY_COUNT = 6;

/** El índice menos usado entre `clients` (empate → el más bajo). */
export function nextIdentityColor(clients) {
  const used = Array(IDENTITY_COUNT).fill(0);
  for (const c of clients) {
    if (Number.isInteger(c?.color) && c.color >= 0 && c.color < IDENTITY_COUNT) used[c.color] += 1;
  }
  return used.indexOf(Math.min(...used));
}

/**
 * El índice de un cliente. Sin `color` guardado (un `.fitdata` importado antes
 * de la migración), un respaldo determinista por id que no se escribe en el
 * estado.
 */
export function identityColorOf(client) {
  const c = client?.color;
  if (Number.isInteger(c) && c >= 0 && c < IDENTITY_COUNT) return c;
  const id = String(client?.id ?? '');
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % IDENTITY_COUNT;
}

/**
 * Da color a los clientes que no lo tienen, en orden de alta (`createdAt` y, si
 * empatan, id), cada uno con el menos usado en ese momento. Devuelve el mismo
 * objeto si no falta ninguno.
 */
export function withIdentityColors(clients) {
  const all = Object.values(clients ?? {});
  const missing = all
    .filter((c) => !Number.isInteger(c?.color))
    .sort((a, b) => String(a.createdAt ?? '').localeCompare(String(b.createdAt ?? ''))
      || String(a.id).localeCompare(String(b.id)));
  if (!missing.length) return clients;
  const next = { ...clients };
  for (const c of missing) {
    next[c.id] = { ...c, color: nextIdentityColor(Object.values(next)) };
  }
  return next;
}

/** Dos letras: la primera de cada una de las dos primeras palabras. */
export function initialsOf(name) {
  return String(name ?? '').trim().split(/\s+/).filter(Boolean).slice(0, 2)
    .map((w) => w[0].toUpperCase()).join('');
}
