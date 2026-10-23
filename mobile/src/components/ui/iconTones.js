/** Tonos y trazo de los iconos a dos colores (`TwoTone.jsx`). */

export const ICON_STROKE = 1.7;
export const ICON_GAP = 1.5;
// El lima de los iconos va mezclado al 65 % con su gris, para que no grite
// dentro del propio icono.
export const ICON_ACCENT_MIX = 0.65;

// ponytail: a 1.7 en la caja de 24 un icono de 13 px queda en ~0.9 px; por
// debajo de 18 px se engorda para no bajar de ~1.3 px reales.
export const strokeFor = (size) => Math.max(ICON_STROKE, (1.3 * 24) / size);

function mix(hexA, hexB, p) {
  const ch = (h, i) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16);
  return '#' + [0, 1, 2]
    .map((i) => Math.round(ch(hexB, i) + (ch(hexA, i) - ch(hexB, i)) * p).toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Los dos tonos de un icono según el color que pide quien lo pinta: un gris
 * (o el texto) → gris + lima apagado; cualquier otro (rojo de borrar, lima de
 * algo activo) → el icono entero en ese color.
 */
export function iconTones(th, color) {
  const c = color ?? th.colors.mutedLight;
  const neutral = [th.colors.mutedLight, th.colors.muted, th.colors.text].includes(c);
  return neutral
    ? { gray: c, accent: mix(th.colors.accent, th.colors.mutedLight, ICON_ACCENT_MIX) }
    : { gray: c, accent: c };
}
