/**
 * Autoformato de los códigos de la app. Vive aquí, separado del componente, por
 * lo de siempre: la lógica pura se testea, el .jsx no.
 *
 * Dos formatos, mismo patrón de 4 en 4:
 *   • código de cliente    → 8 caracteres,  `XXXX-XXXX`      (`groups = 2`)
 *   • código de entrenador → 12 caracteres, `XXXX-XXXX-XXXX` (`groups = 3`)
 *
 * NO filtra las letras que el generador evita (I, O, 0, 1): es mejor que la
 * validación falle con un mensaje claro que borrar en silencio lo que el usuario
 * acaba de teclear.
 */
export function formatCode(raw, groups = 2) {
  const clean = (raw ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, groups * 4);
  return clean.match(/.{1,4}/g)?.join('-') ?? '';
}
