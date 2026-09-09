/**
 * Longitud de los nombres que el usuario escribe: programas y sesiones.
 *
 * El techo lo pone la cabecera, que aguanta ~32 caracteres a 16px
 * (`docs/specs/cabeceras.md` §6). El suelo lo pone la Home: el nombre de la
 * sesión de hoy va a 24px Black **sin `numberOfLines`**, y ahí sólo caben ~20
 * en una línea. 25 se queda entre las dos: un nombre largo puede partir la
 * tarjeta de hoy en dos líneas, que es el precio aceptado por tener sitio para
 * escribir algo que se entienda.
 *
 * El límite se aplica al teclear (`NameField`, la cabecera) y a los nombres que
 * genera la app (`src/data/archetypes.js`, las copias). Lo que ya esté guardado
 * más largo —programas creados antes, importados o del entrenador— se muestra
 * entero y sólo se puede acortar: ver `NameField`.
 */
export const NAME_MAX = 25;

const COPY_SUFFIX = '(copia)';

/**
 * Nombre de una copia dentro del límite. Cuando `Nombre (copia)` no cabe, lo
 * que se recorta es la base y nunca el sufijo: sin él, dos filas seguidas con
 * el mismo nombre no se distinguen, que es justo lo que la copia necesita
 * decir. El corte se come la palabra que parta por la mitad y el separador que
 * quede colgando —"Upper/Lower · Bar (copia)" no dice nada que no diga
 * "Upper/Lower (copia)"—, salvo que la primera palabra ya no quepa: ahí se
 * corta seca, porque quedarse sin base es peor.
 */
export function copyName(name) {
  const base = String(name ?? '').trim();
  const full = `${base} ${COPY_SUFFIX}`.trim();
  if (full.length <= NAME_MAX) return full;
  const room = NAME_MAX - COPY_SUFFIX.length - 1;
  return `${base.slice(0, room).replace(/[\s·,.\-–—/]+\S*$/, '') || base.slice(0, room)} ${COPY_SUFFIX}`.trim();
}
