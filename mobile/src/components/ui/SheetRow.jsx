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
 * Hasta pulido-ui.md §3 (U30) era otra anatomía —fila suelta `surface2` sin
 * icono— y convivía con `MenuRow` en las mismas pantallas; ahora las hojas con
 * lista hablan todas igual. Van agrupadas: envolverlas en `Section` (sin
 * título) para que la primera y la última lleven sus radios.
 *
 * `icon` es el trazo, de `ROW_ICON` (`ui/rowIcons`). `danger` pinta icono y
 * texto en `tint/red50`, el rojo de «Borrar cuenta» del menú ≡.
 */
import { useContext } from 'react';
import { MenuRow, RowIcon } from './MenuList';
import { useTheme } from '../../useTheme';
import { SheetContext } from './sheetContext';

export default function SheetRow({ icon, danger = false, iconColor, onPress, ...rest }) {
  const th    = useTheme();
  const sheet = useContext(SheetContext);
  const color = danger ? th.tint.red50 : iconColor;
  return (
    <MenuRow
      {...rest}
      icon={icon != null ? <RowIcon color={color}>{icon}</RowIcon> : undefined}
      labelColor={danger ? th.tint.red50 : rest.labelColor}
      onPress={onPress ? () => { sheet?.dismiss(); onPress(); } : undefined}
    />
  );
}
