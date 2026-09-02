/**
 * El validador de un `.fitdata`, en un solo sitio.
 *
 * Estaba duplicado **literalmente** en `AppHeader`, `ClientsScreen` y
 * `OnboardingScreen`, las tres con la lista de versiones escrita a mano. Subir
 * el formato a v3 obligaba a cambiar las tres a la vez, así que se extrajo aquí.
 *
 * Devuelve claves de i18n, no frases: las tres copias llevaban los mensajes en
 * español a pelo.
 */

/**
 * Versiones de fichero que la app sabe leer. v3 = modelo `owner`/`kind`;
 * v4 = las sesiones en una sola clave (`sessionTemplates`), sin `userPrograms`.
 */
export const SUPPORTED_FILE_VERSIONS = ['1', '2', '3', '4'];

/**
 * @param {string} jsonString contenido crudo del fichero
 * @returns {{ok: true, data: object} | {ok: false, errorKey: string, errorParams?: object}}
 */
export function parseImportFile(jsonString) {
  try {
    const parsed = JSON.parse(jsonString);
    if (!parsed.version) return { ok: false, errorKey: 'errors.importNoVersion' };
    if (!SUPPORTED_FILE_VERSIONS.includes(String(parsed.version))) {
      return { ok: false, errorKey: 'errors.importBadVersion', errorParams: { version: parsed.version } };
    }
    return { ok: true, data: parsed };
  } catch {
    return { ok: false, errorKey: 'errors.importBadJson' };
  }
}
