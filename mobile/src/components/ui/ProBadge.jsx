/**
 * ProBadge — la etiqueta PRO de una acción que el plan gratis no deja hacer
 * (M01 §4.11). Misma pastilla que el PRO del menú ≡ (`MenuRow` › `badge`):
 * el lima informa.
 *
 * El lenguaje de una acción bloqueada es uno solo en toda la app: no se apaga
 * ni desaparece, **pierde su color de acción y gana PRO**, y al tocarla abre el
 * paywall directamente, sin pasar por la hoja que abriría. En una fila de hoja
 * es `MenuRow badge="PRO"`; en un botón, este componente junto al texto.
 */

import { View, StyleSheet } from 'react-native';
import { Text } from './Text';
import { spacing, textStyles } from '../../theme';
import { useThemedStyles } from '../../useTheme';

export default function ProBadge({ style }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={[styles.badge, style]}>
      <Text style={styles.text}>PRO</Text>
    </View>
  );
}

const makeStyles = (th) => StyleSheet.create({
  badge: {
    paddingHorizontal: spacing.sm2,
    paddingVertical:   3,
    borderRadius:      th.radius.xs,
    backgroundColor:   th.tint.accent10,
    flexShrink:        0,
  },
  text: { ...textStyles.caps, color: th.colors.accent },
});
