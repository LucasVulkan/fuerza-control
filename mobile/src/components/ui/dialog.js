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

export function setDialogListener(fn) { listener = fn; }

export function showDialog(title, message, buttons, options) {
  listener?.({ title, message, buttons, items: options?.items, subtitle: options?.subtitle });
}
