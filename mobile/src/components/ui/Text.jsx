/**
 * Text / TextInput de la app: una sola fuente en iOS y Android, y cuerpo que no
 * lo mueve el ajuste de tamaño de fuente del sistema.
 *
 * Sin `fontFamily`, RN pinta con la fuente del sistema — SF Pro en iOS, Roboto
 * en Android —, y de ahí venía la divergencia: sólo las pantallas rediseñadas
 * declaraban Inter. Aquí se le inyecta a cada estilo la familia Inter que le
 * corresponde por peso (ver `interFamily` en theme.js). Un estilo que ya trae
 * `fontFamily` manda y no se toca.
 *
 * `maxFontSizeMultiplier` va antes del spread a propósito: es el valor por
 * defecto y una llamada concreta puede subirlo o quitarlo. El texto sigue el
 * ajuste del sistema, pero con techo (ver MAX_FONT_SCALE en theme.js).
 */
import { Text as RNText, TextInput as RNTextInput, StyleSheet } from 'react-native';
import { textStyleFor, MAX_FONT_SCALE } from '../../theme';

// ponytail: las cursivas quedan fuera del mapa — de Inter sólo cargamos la
// itálica del 900, así que un `fontStyle: 'italic'` sin familia sale en Inter
// recta. Si hace falta cursiva de verdad, cargar Inter_400Regular_Italic en
// App.js y ramificar por fontStyle en `interFamily`.
export function Text({ style, ...props }) {
  return <RNText maxFontSizeMultiplier={MAX_FONT_SCALE} {...props} style={textStyleFor(StyleSheet.flatten(style))} />;
}

export function TextInput({ style, ...props }) {
  return <RNTextInput maxFontSizeMultiplier={MAX_FONT_SCALE} {...props} style={textStyleFor(StyleSheet.flatten(style))} />;
}

// Re-exportado para los pocos `Animated.Text` que no pasan por el wrapper.
export { MAX_FONT_SCALE };

export default Text;
