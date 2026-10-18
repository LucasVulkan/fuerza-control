/**
 * showDialog — confirmaciones y avisos propios, en vez del `Alert` nativo
 * (U33, maqueta en docs/mockups/confirm.html). En Android el Alert no se
 * puede estilar: salía blanco, con los botones en versales y sin nada de la app.
 *
 * Misma firma que el `alert` de RN, (title, message, buttons), para que cambiar una
 * llamada sea cambiar el nombre: botones `{ text, style, onPress }` con
 * `style` 'cancel' (gris), 'destructive' (rojo) o nada (la acción principal,
 * en lima). Sin botones es un aviso con «Entendido».
 *
 * `options.items`: una lista de líneas bajo la frase, con scroll si es larga
 * (lo que trae una actualización del programa, U34).
 * `options.subtitle`: una línea entre el título y la frase — de qué cosa se
 * habla (la sesión que se descarta, U53).
 *
 * Lo pinta `DialogHost`, montado una vez en la raíz (RootNavigator).
 */
let listener = null;
// Hasta cuándo hay una hoja (`DragSheet`) yéndose. En iOS un Modal no se
// presenta mientras otro se va: el aviso que sale de una `SheetRow` (que cierra
// la hoja y lanza la acción a la vez) no aparecía y su velo invisible dejaba la
// pantalla sin responder. Así esperan todos los avisos, no cada llamador.
let sheetGoneAt = 0;

export function setDialogListener(fn) { listener = fn; }

export function noteSheetClosing() { sheetGoneAt = Date.now() + 350; }

export function showDialog(title, message, buttons, options) {
  const dialog = { title, message, buttons, items: options?.items, subtitle: options?.subtitle };
  const wait   = sheetGoneAt - Date.now();
  if (wait > 0) setTimeout(() => listener?.(dialog), wait);
  else listener?.(dialog);
}
