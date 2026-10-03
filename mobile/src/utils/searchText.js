/**
 * Buscador tolerante: el nombre escrito sin acentos, en minúsculas o con una
 * letra de menos tiene que encontrar el ejercicio igual.
 *
 * Tres pasadas, de más estricta a más laxa, y cada una solo si la anterior no
 * devuelve nada (P09-exercise-variants.md §3.4):
 *   1. todas las palabras de la búsqueda, en cualquier orden y como parte de
 *      palabra ("remo polea" → "Remo en polea", "chin up" → "Chin-ups");
 *   2. la búsqueda sin espacios dentro del texto sin espacios ("chinup");
 *   3. subsecuencia —las letras en orden, aunque falte alguna—, para que
 *      "sentdilla" o "prss banca" sigan encontrando.
 * La subsecuencia como primera pasada metería basura ("press" encontraría
 * "prensa de piernas"), de ahí que sea el último recurso. Sin acentos ni
 * mayúsculas, y los guiones cuentan como espacio.
 */

const norm = (s) => String(s ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')   // marcas diacríticas combinantes
  .toLowerCase()
  .replace(/-/g, ' ');

/**
 * ¿Están todas las letras de `q` dentro de `text`, en orden? Con un salto
 * permitido, que cubre la letra cambiada ("sentadolla") y la de más.
 *
 * ponytail: subsecuencia con 1 salto, no distancia de edición. No cubre dos
 * erratas en la misma palabra ni letras en orden cambiado ("bnaca"); si eso
 * llega a hacer falta, entonces sí toca un fuzzy de verdad (Fuse.js o
 * Levenshtein acotada).
 */
function subsequence(q, text, skips = 1) {
  let i = 0;
  for (let j = 0; j < text.length && i < q.length; j++) {
    if (text[j] === q[i]) i++;
  }
  if (i === q.length) return true;
  // se atascó en q[i]: reintenta saltándose esa letra
  return skips > 0 && subsequence(q.slice(0, i) + q.slice(i + 1), text, skips - 1);
}

/**
 * Filtra `items` por `query`. `getText` devuelve el texto buscable de cada
 * item (varios nombres: únelos con un espacio).
 */
export function filterBySearch(items, query, getText) {
  const q = norm(query).trim();
  if (!q) return items;

  const rows  = items.map((item) => [item, norm(getText(item))]);
  const words = q.split(/\s+/);
  const hits  = rows.filter(([, text]) => words.every((w) => text.includes(w)));
  if (hits.length || q.length < 4) return hits.map(([item]) => item);

  const letters = q.replace(/\s+/g, '');
  const glued   = rows.filter(([, text]) => text.replace(/\s+/g, '').includes(letters));
  if (glued.length) return glued.map(([item]) => item);

  return rows
    .filter(([, text]) => subsequence(letters, text.replace(/\s+/g, '')))
    .map(([item]) => item);
}
