/**
 * Buscador tolerante: el nombre escrito sin acentos, en minúsculas o con una
 * letra de menos tiene que encontrar el ejercicio igual.
 *
 * Dos pasadas: primero subcadena normalizada (sin acentos ni mayúsculas), que
 * es lo que acierta el 95% de las veces; sólo si eso no devuelve nada se
 * relaja a subsecuencia —las letras en orden, aunque falte alguna—, para que
 * "sentdilla" o "prss banca" sigan encontrando. La subsecuencia como primera
 * pasada metería basura ("press" encontraría "prensa de piernas"), de ahí que
 * sea sólo el plan B.
 */

const norm = (s) => String(s ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')   // marcas diacríticas combinantes
  .toLowerCase();

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

  const rows = items.map((item) => [item, norm(getText(item))]);
  const hits = rows.filter(([, text]) => text.includes(q));
  if (hits.length || q.length < 4) return hits.map(([item]) => item);

  const letters = q.replace(/\s+/g, '');
  return rows
    .filter(([, text]) => subsequence(letters, text.replace(/\s+/g, '')))
    .map(([item]) => item);
}
