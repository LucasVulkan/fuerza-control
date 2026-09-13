/**
 * SheetRow — una opción dentro de un `DragSheet`: etiqueta a la izquierda,
 * chevron a la derecha, toda la fila pulsable.
 *
 * Estaba copiada cuatro veces (editor de sesión, clientes, historial y
 * plantillas) y ya había divergido: tres pintaban el chevron con `ArrowIcon` y
 * la de clientes con un glifo `›` de texto. Esta es la única copia.
 *
 * **Cierra la hoja ella sola**, y con la animación de `DragSheet` (contexto
 * `SheetContext`). Antes cada llamante ponía el `visible` a false a mano, así
 * que la hoja desaparecía de golpe al elegir una opción y en cambio se
 * deslizaba al tocar el fondo. La acción corre a la vez que empieza el cierre,
 * no después: lo que hay debajo ya se está moviendo mientras la hoja se va, en
 * vez de esperar a que termine para empezar.
 */
import { useContext } from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { Text } from './Text';
import { spacing, textStyles, sheetRowBase } from '../../theme';
import { useTheme, useThemedStyles } from '../../useTheme';
import { ArrowIcon } from './EditorIcons';
import { SheetContext } from './sheetContext';

export default function SheetRow({ label, onPress, danger = false }) {
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  const sheet  = useContext(SheetContext);

  return (
    <TouchableOpacity
      style={styles.row}
      activeOpacity={0.7}
      onPress={() => { sheet?.dismiss(); onPress?.(); }}
    >
      <Text style={[styles.text, danger && { color: th.colors.red }]}>{label}</Text>
      <ArrowIcon size={14} color={danger ? th.colors.red : th.colors.mutedLight} />
    </TouchableOpacity>
  );
}

const makeStyles = (th) => StyleSheet.create({
  row: { ...sheetRowBase(th), justifyContent: 'space-between', gap: spacing.xl },
  // Misma voz que las filas de `MenuRow` (la hoja del "⋯" del visualizador):
  // una opción de hoja es una opción de hoja, mida lo que mida la pantalla que
  // la abre. A `labelStrong` (12) se leían por debajo del contenido.
  text: {
    ...textStyles.bodyStrong,
    fontFamily: 'Inter_800ExtraBold',
    flex:       1,
    color:      th.colors.text,
  },
});
