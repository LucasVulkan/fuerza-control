/**
 * EmptyState — la pantalla (o el trozo de pantalla) vacía: icono de línea,
 * título, texto y, si hay algo que ofrecer, un botón y una salida secundaria.
 *
 * Nueve sitios decían «aquí no hay nada» cada uno a su manera (emoji a 32 o a
 * 40 px, tres botones lima distintos, el título a `title` o a `bodyStrong`);
 * son una sola pieza (U09-pulido-ui.md §10). Todo es opcional salvo el texto.
 *
 * Quien la usa decide el hueco con `style`: `flex: 1` para ocupar la pantalla
 * centrada, o un `paddingVertical` dentro de una lista.
 *
 * `icon` es un trazo de `ROW_ICON`, el mismo que usan las filas y las hojas;
 * `action` / `secondary` son `{ label, onPress }`.
 */
import { View, TouchableOpacity, StyleSheet } from 'react-native';

import { Text } from './Text';
import { RowIcon } from './MenuList';
import { spacing, textStyles, lh } from '../../theme';
import { useTheme, useThemedStyles } from '../../useTheme';

// 32 con trazo 1.8: a 2.4, que es el de `RowIcon` a 18, el trazo engordaría
// al escalar.
const ICON_SIZE   = 32;
const ICON_STROKE = 1.8;

export default function EmptyState({ icon, title, text, action, secondary, style }) {
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={[styles.wrap, style]}>
      {icon != null && (
        <RowIcon size={ICON_SIZE} strokeWidth={ICON_STROKE} color={th.colors.mutedLight}>{icon}</RowIcon>
      )}
      {!!title && <Text style={styles.title}>{title}</Text>}
      <Text style={styles.text}>{text}</Text>
      {action && (
        <TouchableOpacity style={styles.cta} onPress={action.onPress} activeOpacity={0.85} accessibilityRole="button">
          <Text style={styles.ctaText}>{action.label}</Text>
        </TouchableOpacity>
      )}
      {secondary && (
        <TouchableOpacity style={styles.secondary} onPress={secondary.onPress} activeOpacity={0.7} accessibilityRole="button">
          <Text style={styles.secondaryText}>{secondary.label}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const makeStyles = (th) => StyleSheet.create({
  wrap: {
    alignItems:        'center',
    justifyContent:    'center',
    gap:               spacing.md,
    paddingHorizontal: spacing.xxl,
  },
  title: { ...textStyles.bodyStrong, color: th.colors.text, textAlign: 'center' },
  text: {
    ...textStyles.body,
    color:      th.colors.mutedLight,
    textAlign:  'center',
    lineHeight: lh(textStyles.body.fontSize),
  },
  // El botón lima de `ProgramScreen`: alto 44, `radius.md`.
  cta: {
    height:            44,
    borderRadius:      th.radius.md,
    backgroundColor:   th.colors.accent,
    alignItems:        'center',
    justifyContent:    'center',
    paddingHorizontal: spacing.xl,
  },
  ctaText:       { ...textStyles.labelStrong, color: th.colors.onAccent },
  secondary:     { paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  secondaryText: { ...textStyles.labelStrong, color: th.colors.mutedLight },
});
