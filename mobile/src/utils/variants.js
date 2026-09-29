/**
 * La variante de un ejercicio: cómo se hace (agarre, anchura) sin que cambie
 * qué ejercicio es. Solo informa: no toca la progresión ni los récords, se
 * apunta en cada entreno y se puede filtrar en Progreso
 * (docs/specs/exercise-variants.md §2.1).
 *
 * Una variante es `{ grip?, width? }` con valores del catálogo; `{}` o ausente
 * es «sin especificar».
 */

export const VARIANT_DIMS = {
  grip:  ['pronated', 'supinated', 'neutral'],
  width: ['wide', 'medium', 'narrow'],
};

/** Orden de pintado y de sufijo de id. */
export const DIM_ORDER = ['grip', 'width'];

/** Las dimensiones con valor, en `DIM_ORDER`: `[['grip', 'pronated'], …]`. */
function entries(variant) {
  return DIM_ORDER.filter((d) => variant?.[d]).map((d) => [d, variant[d]]);
}

/** Las dimensiones que el ejercicio declara (`def.variants`), en orden. */
export function variantDims(def) {
  return DIM_ORDER.filter((d) => def?.variants?.[d]?.length);
}

export function isEmptyVariant(variant) {
  return entries(variant).length === 0;
}

/** Mismas dimensiones con el mismo valor; `undefined`/`null` no cuentan. */
export function sameVariant(a, b) {
  return DIM_ORDER.every((d) => (a?.[d] || null) === (b?.[d] || null));
}

/** `{ grip: 'pronated', width: 'wide' }` → `'pronated_wide'` (sufijo de id). */
export function variantKey(variant) {
  return entries(variant).map(([, v]) => v).join('_');
}

/** Las etiquetas de la variante: `['Prono', 'Ancho']`. */
export function variantParts(variant, t) {
  return entries(variant).map(([d, v]) => t(`variants.options.${d}.${v}`));
}

/** `'Prono · Ancho'`, o `''` si no hay variante. */
export function variantLabel(variant, t) {
  return variantParts(variant, t).join(' · ');
}

/**
 * Quita lo que el ejercicio no declara (`def.variants`). Devuelve `undefined`
 * si no queda nada, para poder omitir la clave.
 */
export function cleanVariant(variant, def) {
  const out = {};
  for (const [d, v] of entries(variant)) {
    if (def?.variants?.[d]?.includes(v)) out[d] = v;
  }
  return isEmptyVariant(out) ? undefined : out;
}
