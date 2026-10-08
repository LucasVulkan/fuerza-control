/**
 * La web pública (spec M02, repo formafit-pro.github.io). Un solo sitio para
 * la dirección: el día del dominio propio (M02-04) se cambia aquí.
 */
export const WEB_URL = 'https://formafit-pro.github.io';

/** Enlace de invitación de un cliente (M01-04): la página /join abre la app. */
export const inviteUrl = (code) => `${WEB_URL}/join/?c=${encodeURIComponent(code)}`;

/**
 * `forma://join/<código>` → el código en el formato de la app (`XXXX-XXXX`).
 * `undefined` si la URL no es una invitación; `null` si lo es pero el código
 * no tiene 8 caracteres (se ignora, sin abrir nada).
 */
export function parseInviteUrl(url) {
  const m = /^forma:\/\/join\/([^/?#]*)/i.exec(url ?? '');
  if (!m) return undefined;
  const raw = m[1].toUpperCase().replace(/[^A-Z0-9]/g, '');
  return raw.length === 8 ? `${raw.slice(0, 4)}-${raw.slice(4)}` : null;
}
