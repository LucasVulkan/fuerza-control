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
 * Lo pinta `DialogHost`, montado una vez en la raíz (RootNavigator).
 */
let listener = null;

export function setDialogListener(fn) { listener = fn; }

export function showDialog(title, message, buttons) {
  listener?.({ title, message, buttons });
}
