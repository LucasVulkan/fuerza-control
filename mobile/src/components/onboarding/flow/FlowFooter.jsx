/**
 * FlowFooter — el pie fijo del recorrido de entrada (O03 §3.1.4): el botón no se
 * mueve, siempre abajo y siempre en el mismo sitio. Una sola acción lima por
 * pantalla; desactivada se ve gris (`surface2`/`muted`), no medio transparente.
 * Las secundarias van debajo, como texto.
 *
 *   primary    { label, onPress, disabled }
 *   secondary  [{ label, onPress, accent }] — `accent`: en lima en vez de apagado
 *   children   para lo que no encaja (la fila Anterior/Siguiente de las tarjetas)
 */
import { View, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '../../ui/Text';
import { spacing, textStyles } from '../../../theme';
import { useThemedStyles } from '../../../useTheme';

export default function FlowFooter({ primary, secondary = [], children }) {
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.foot, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
      {primary && (
        <Pressable
          onPress={primary.onPress}
          disabled={primary.disabled}
          accessibilityRole="button"
          accessibilityState={{ disabled: !!primary.disabled }}
          style={[styles.cta, primary.disabled && styles.ctaOff]}
        >
          <Text style={[styles.ctaTxt, primary.disabled && styles.ctaTxtOff]}>{primary.label}</Text>
        </Pressable>
      )}
      {secondary.map((s) => (
        <Pressable key={s.label} onPress={s.onPress} accessibilityRole="button" style={styles.sec}>
          <Text style={[styles.secTxt, s.accent && styles.secAccent]}>{s.label}</Text>
        </Pressable>
      ))}
      {children}
    </View>
  );
}

const makeStyles = (th) => StyleSheet.create({
  foot: {
    paddingHorizontal: spacing.lg + 1,
    paddingTop:        spacing.md,
    backgroundColor:   th.colors.bg,
  },
  cta: {
    backgroundColor: th.colors.accent,
    borderRadius:    th.radius.md,
    paddingVertical: spacing.lg + 2,
    alignItems:      'center',
  },
  ctaOff:    { backgroundColor: th.colors.surface2 },
  ctaTxt:    { ...textStyles.button, color: th.colors.onAccent, textTransform: 'uppercase' },
  ctaTxtOff: { color: th.colors.muted },
  sec:       { paddingVertical: spacing.lg, alignItems: 'center' },
  secTxt:    { ...textStyles.bodyStrong, color: th.colors.mutedLight },
  secAccent: { ...textStyles.button, color: th.colors.accent },
});
