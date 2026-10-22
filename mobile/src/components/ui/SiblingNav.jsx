/**
 * SiblingNav — la fila «‹ anterior · siguiente ›» bajo la cabecera: dice que hay
 * más de lo que ves y se pulsa. La usan Progreso › ejercicio y los editores de
 * ejercicio y de bloque (P16-04); el swipe que la acompaña es `useSiblingSwipe`.
 *
 * `prev` / `next`: el nombre del vecino, o nada si no lo hay (su lado queda
 * vacío). Cada uno se queda en su mitad y se recorta.
 */
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Text } from './Text';
import { ArrowIcon } from './EditorIcons';
import { spacing, textStyles } from '../../theme';
import { useTheme, useThemedStyles } from '../../useTheme';

export default function SiblingNav({ prev, next, onPrev, onNext, style }) {
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  if (!prev && !next) return null;
  return (
    <View style={[styles.nbr, style]}>
      {/* El chevron va fuera del texto: un nombre largo se recorta, pero la
          flecha que dice «se pulsa» sigue ahí. */}
      {prev ? (
        <TouchableOpacity style={styles.nbrBtn} onPress={onPrev} hitSlop={8} activeOpacity={0.6}>
          <ArrowIcon size={10} color={th.colors.mutedLight} back />
          <Text style={styles.nbrText} numberOfLines={1}>{prev}</Text>
        </TouchableOpacity>
      ) : <View />}
      {next ? (
        <TouchableOpacity style={styles.nbrBtn} onPress={onNext} hitSlop={8} activeOpacity={0.6}>
          <Text style={styles.nbrText} numberOfLines={1}>{next}</Text>
          <ArrowIcon size={10} color={th.colors.mutedLight} />
        </TouchableOpacity>
      ) : <View />}
    </View>
  );
}

const makeStyles = (th) => StyleSheet.create({
  // Vecinos: gris y pequeños, bajo la cabecera.
  nbr: {
    flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md,
    paddingHorizontal: spacing.lg, paddingTop: spacing.sm2,
  },
  // Cada uno se queda en su mitad, con aire antes del centro.
  nbrBtn:  { maxWidth: '42%', flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs2 },
  nbrText: { ...textStyles.labelStrong, color: th.colors.mutedLight, flexShrink: 1 },
});
