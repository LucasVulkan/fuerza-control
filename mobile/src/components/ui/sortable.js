/**
 * Ajustes comunes de las listas reordenables (react-native-sortables). Las tres
 * del editor — sesiones del programa, huecos de la sesión y movimientos del
 * bloque — se arrastran igual, así que los valores viven aquí y no repetidos en
 * cada pantalla.
 *
 * Se usa `Sortable.Grid` con `columns={1}`, no `Sortable.Flex`: el grid vertical
 * es el único que CONTROLA el ancho de las celdas (ancho del contenedor entre
 * columnas), que es lo que necesitan estas tarjetas a ancho completo; el flex
 * deja a cada hijo su ancho natural y las tarjetas saldrían encogidas. El alto
 * lo sigue midiendo por celda, así que una superserie puede ocupar el doble.
 *
 * Por qué estos valores y no los de fábrica:
 * - `customHandle`: el gesto vive SOLO en `Sortable.Handle`. Las filas llevan
 *   encima su propio swipe horizontal (PanResponder) y el cuerpo es pulsable;
 *   con el gesto en toda la tarjeta se pelearían.
 * - `dragActivationDelay: 0`: con asa no hace falta la pulsación larga que
 *   distingue "arrastrar" de "hacer scroll" — tocar el asa ya es intención.
 * - `enableActiveItemSnap: false`: por defecto la tarjeta se centra bajo el
 *   dedo al agarrarla, y con un asa lateral eso es un salto de media pantalla.
 * - `activeItemScale: 1.02`: el 1.1 de fábrica es mucho en tarjetas a ancho
 *   completo; basta con que despegue.
 * - `inactiveItemOpacity: 1`: el 0.5 de fábrica apaga el resto de la lista, que
 *   no es lo que dibuja Figma.
 * - `overDrag: 'vertical'`: listas verticales, no hay nada que hacer sacando la
 *   tarjeta por un lado.
 */
export const SORTABLE_PROPS = {
  columns:              1,
  customHandle:         true,
  dragActivationDelay:  0,
  enableActiveItemSnap: false,
  activeItemScale:      1.02,
  inactiveItemOpacity:  1,
  overDrag:             'vertical',
  hapticsEnabled:       true,
};
