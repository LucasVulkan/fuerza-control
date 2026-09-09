/**
 * Longitud de los nombres que el usuario escribe: programas y sesiones.
 *
 * El número sale de la pantalla más apretada, no de la más ancha. La cabecera
 * aguanta ~32 caracteres (`docs/specs/cabeceras.md` §6) pero el nombre de la
 * sesión de hoy en la Home va a 24px Black **sin `numberOfLines`**: a partir de
 * ~20 la tarjeta crece una línea y el bloque de debajo salta. 20 es lo que cabe
 * en una línea en todas partes.
 *
 * El límite se aplica al teclear (`NameField`, la cabecera) y a los nombres que
 * genera la app (`src/data/archetypes.js`, las copias). Lo que ya esté guardado
 * más largo —programas creados antes, importados o del entrenador— se muestra
 * entero y sólo se puede acortar: ver `NameField`.
 */
export const NAME_MAX = 20;

const COPY_SUFFIX = '(copia)';

/**
 * Nombre de una copia dentro del límite. Cuando `Nombre (copia)` no cabe, lo
 * que se recorta es la base y nunca el sufijo: sin él, dos filas seguidas con
 * el mismo nombre no se distinguen, que es justo lo que la copia necesita
 * decir. El recorte se come también el separador que quede colgando, para no
 * dejar "Full Body · (copia)".
 */
export function copyName(name) {
  const base = String(name ?? '').trim();
  const full = `${base} ${COPY_SUFFIX}`.trim();
  if (full.length <= NAME_MAX) return full;
  const room = NAME_MAX - COPY_SUFFIX.length - 1;
  return `${base.slice(0, room).replace(/[\s·,.\-–—/]+$/, '')} ${COPY_SUFFIX}`.trim();
}
