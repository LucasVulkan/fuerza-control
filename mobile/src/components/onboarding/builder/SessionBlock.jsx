/**
 * SessionBlock — la tarjeta de una sesión (A, B, C…) en los pasos del constructor
 * guiado (O03 §10.1): la letra, «Sesión A», a la derecha lo que lleva («1 ej.» /
 * «después» / «vacía») y debajo lo que se quiera meter (`children`). `dim`: las
 * que aún no se tocan, apagadas.
 */
import { View, StyleSheet } from 'react-native';

import { Text } from '../../ui/Text';
import { spacing, textStyles } from '../../../theme';
import { useThemedStyles } from '../../../useTheme';

const BADGE = 34;

export default function SessionBlock({ letter, title, note, dim = false, children }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={[styles.block, dim && styles.dim]}>
      <View style={styles.head}>
        <View style={styles.badge}><Text style={styles.letter}>{letter}</Text></View>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        {!!note && <Text style={styles.note}>{note}</Text>}
      </View>
      {children}
    </View>
  );
}

const makeStyles = (th) => StyleSheet.create({
  block: {
    backgroundColor: th.colors.surface,
    borderRadius:    th.radius.lg,
    padding:         spacing.lg - 1,
    marginBottom:    spacing.sm2,
  },
  dim:   { opacity: 0.5, paddingVertical: spacing.md + 2 },
  head:  { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  badge: {
    width: BADGE, height: BADGE, borderRadius: th.radius.md - 2,
    backgroundColor: th.colors.surface2, alignItems: 'center', justifyContent: 'center',
  },
  letter: { ...textStyles.heroName, color: th.colors.accent, lineHeight: BADGE, includeFontPadding: false },
  title:  { ...textStyles.bodyStrong, color: th.colors.text, flex: 1 },
  note:   { ...textStyles.label, color: th.colors.mutedLight },
});
