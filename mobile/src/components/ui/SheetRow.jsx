/**
 * SheetRow — una opción dentro de un `DragSheet`.
 *
 * Es `MenuRow` (icono · texto · subtítulo · dato · galón, la fila del menú ≡ y
 * de Inicio) con una sola diferencia: **cierra la hoja ella sola**, con la
 * animación de `DragSheet` (contexto `SheetContext`). Por eso es una capa y no
 * una prop de `MenuRow`: en el menú ≡ hay filas que NO deben cerrar (los
 * interruptores, exportar mientras exporta), y en una hoja de opciones todas
 * cierran. La acción corre a la vez que empieza el cierre, no después.
 *
 * Hasta U09-pulido-ui.md §3 (U30) era otra anatomía —fila suelta `surface2` sin
 * icono— y convivía con `MenuRow` en las mismas pantallas; ahora las hojas con
 * lista hablan todas igual. Van agrupadas: envolverlas en `Section` (sin
 * título) para que la primera y la última lleven sus radios.
 *
 * `icon` es el trazo, de `ROW_ICON` (`ui/rowIcons`). `danger` pinta icono y
 * texto en `tint/red50`, el rojo de «Borrar cuenta» del menú ≡.
 */
import { useContext, useState } from 'react';
import { Animated, useWindowDimensions } from 'react-native';
import { MenuRow, RowIcon } from './MenuList';
import { useTheme } from '../../useTheme';
import { SheetContext } from './sheetContext';

// Las filas entran de derecha a izquierda pegadas a la altura de la hoja: con
// la hoja arriba del todo están todas en su sitio, y al arrastrarla para
// cerrar van saliendo una tras otra, la de arriba primero. Cada fila hace su
// recorrido en `ROW_SPAN` px de hoja, y la siguiente empieza `ROW_STEP` px
// después, y se funde a la vez que se desplaza.
const ROW_STEP = 40;
const ROW_SPAN = 300;
const ROW_FADE = 0.5;

export default function SheetRow({ icon, danger = false, iconColor, onPress, ...rest }) {
  const th    = useTheme();
  const sheet = useContext(SheetContext);
  const color = danger ? th.tint.red50 : iconColor;
  const { width } = useWindowDimensions();
  const [index]   = useState(() => sheet?.nextIndex?.() ?? 0);
  // El fundido va en el mismo tramo que el desplazamiento pero acaba antes
  // (`ROW_FADE` de él): la fila ya es transparente antes de salir del todo, y
  // se ve que desaparece por el fundido y no por el borde.
  const start = index * ROW_STEP;
  const slide = sheet?.y && {
    opacity: sheet.y.interpolate({
      inputRange: [start, start + ROW_SPAN * ROW_FADE], outputRange: [1, 0], extrapolate: 'clamp',
    }),
    transform: [{
      translateX: sheet.y.interpolate({
        inputRange: [start, start + ROW_SPAN], outputRange: [0, width], extrapolate: 'clamp',
      }),
    }],
  };
  return (
    <Animated.View style={slide}>
    <MenuRow
      {...rest}
      icon={icon != null ? <RowIcon color={color}>{icon}</RowIcon> : undefined}
      labelColor={danger ? th.tint.red50 : rest.labelColor}
      onPress={onPress ? () => { sheet?.dismiss(); onPress(); } : undefined}
    />
    </Animated.View>
  );
}
