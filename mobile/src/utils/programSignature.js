/**
 * Firma corta de un programa tal como se sube a un cliente: dos subidas con la
 * misma firma mandan lo mismo. Con ella "cambios sin subir" significa "lo que
 * enviaría ahora ≠ lo último que envié", y deshacer una edición deja el
 * programa limpio (docs/specs/qa-sep-conexion.md §5).
 *
 * `exportDate` no cuenta: es la fecha del día, no un cambio del programa.
 * ponytail: djb2 de 32 bits sobre el JSON. Una colisión solo escondería un
 * "subir cambios"; si algún día importa, SHA-1 de expo-crypto.
 */
export function programSignature(payload) {
  const { exportDate, ...rest } = payload ?? {}; // eslint-disable-line no-unused-vars
  const str = JSON.stringify(rest);
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}
