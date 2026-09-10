/**
 * NameField — el input de "cómo se llama esto" (programa o sesión), con el
 * contador dentro de la caja, a la derecha.
 *
 * No trae caja propia a propósito: cada hoja ya tiene la suya (`sheetInput` en
 * las hojas, `textInput` en el onboarding, que no son el mismo token) y
 * unificarlas era otro cambio. Aquí sólo se envuelve el input que ya había, se
 * le reserva sitio a la derecha y se cuelga el contador encima.
 *
 * `maxLength` es `max(NAME_MAX, longitud actual)` y no `NAME_MAX` a secas: en
 * Android un `value` más largo que `maxLength` se recorta al editar, y hay
 * nombres de antes del límite —importados, del entrenador, de arquetipos
 * viejos— que no son del usuario para perderlos sin avisar. Con el máximo
 * abierto a lo que ya hay, esos nombres se pueden acortar pero no alargar, y en
 * cuanto bajan del límite vuelve a mandar él.
 */

import { View, StyleSheet } from 'react-native';
import { Text, TextInput } from './Text';

import { spacing, textStyles } from '../../theme';
import { useTheme, useThemedStyles } from '../../useTheme';
import { NAME_MAX } from '../../utils/names';

// Hueco que se le quita al input para que el texto no pase por debajo del
// contador: el propio contador ("25/25" en `caps`) más su margen.
const COUNT_ROOM = 44;

export default function NameField({ style, value, ...rest }) {
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  const len    = (value ?? '').length;
  const over   = len > NAME_MAX;

  return (
    <View>
      <TextInput
        style={[style, styles.pad]}
        value={value}
        maxLength={Math.max(NAME_MAX, len)}
        placeholderTextColor={th.colors.mutedLight}
        returnKeyType="done"
        {...rest}
      />
      <View pointerEvents="none" style={styles.countBox}>
        <Text style={[styles.count, over && styles.countOver]}>{len}/{NAME_MAX}</Text>
      </View>
    </View>
  );
}

const makeStyles = (th) => StyleSheet.create({
  pad:      { paddingRight: COUNT_ROOM },
  countBox: { position: 'absolute', right: spacing.md, top: 0, bottom: 0, justifyContent: 'center' },
  count: {
    ...textStyles.caps,
    color:       th.colors.mutedLight,
    fontVariant: ['tabular-nums'],
  },
  countOver: { color: th.colors.red },
});
