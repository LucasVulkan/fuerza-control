/**
 * CardKit — las piezas de las páginas de tarjetas (Mi cuenta, Entrenador):
 * la misma gramática en las dos (maqueta docs/mockups/account.html):
 *
 *   · `Btn`     lo que puedo hacer: caja con verbo en `button`
 *   · `Explain` la explicación: `body` gris con barra a la izquierda, una por bloque
 *   · `Press`   pulsable con `scale` al tocar (§6.8 de M03)
 *
 * Salieron de AccountScreen para que Entrenador use exactamente las mismas.
 */

import { Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import Reanimated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';

import { Text } from './Text';
import { spacing, textStyles, lh, withOpacity } from '../../theme';
import { useTheme, useThemedStyles } from '../../useTheme';

const APressable = Reanimated.createAnimatedComponent(Pressable);

/** Pulsable con `scale` al tocar. */
export function Press({ style, onPress, disabled, children }) {
  const scale = useSharedValue(1);
  const anim  = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  return (
    <APressable
      onPress={onPress}
      disabled={disabled}
      onPressIn={() => scale.set(withTiming(0.97, { duration: 120 }))}
      onPressOut={() => scale.set(withTiming(1, { duration: 120 }))}
      style={[style, anim]}
    >
      {children}
    </APressable>
  );
}

/** El botón de caja (`.btn`). `tone`: acc · dark · ghost · danger; sin él, `surface2`. */
export function Btn({ tone, label, loading, disabled, grow, onPress }) {
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  const ink = {
    acc:    th.colors.onAccent,
    dark:   th.colors.accent,
    ghost:  th.colors.mutedLight,
    danger: th.colors.redText,
  }[tone] ?? th.colors.text;
  return (
    <Press style={[styles.btn, grow && styles.btnGrow, styles[`btn_${tone}`], (disabled || loading) && styles.btnOff]} onPress={onPress} disabled={disabled || loading}>
      {loading
        ? <ActivityIndicator color={ink} />
        : <Text style={[styles.btnText, { color: ink }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{label}</Text>}
    </Press>
  );
}

/** Texto de explicación: gris, con barra a la izquierda. `tone`: onAccent · warn. */
export function Explain({ children, tone }) {
  const styles = useThemedStyles(makeStyles);
  return <Text style={[styles.why, tone === 'onAccent' && styles.whyOnAccent, tone === 'warn' && styles.whyWarn]}>{children}</Text>;
}

const makeStyles = (th) => StyleSheet.create({
  why: {
    ...textStyles.body,
    lineHeight:      lh(textStyles.body.fontSize),
    color:           th.colors.mutedLight,
    borderLeftWidth: 2,
    borderLeftColor: th.colors.surface3,
    paddingLeft:     spacing.sm2,
    marginTop:       spacing.md,
  },
  whyOnAccent: { color: th.colors.onAccent, borderLeftColor: withOpacity(th.colors.onAccent, 0.25) },
  // Lo que pasa y hay que arreglar: texto normal, barra naranja.
  whyWarn:     { color: th.colors.text, borderLeftColor: th.colors.orange },

  btn: {
    borderRadius: th.radius.md, paddingVertical: spacing.lg, paddingHorizontal: spacing.sm2,
    backgroundColor: th.colors.surface2, alignItems: 'center', justifyContent: 'center',
  },
  btnGrow:    { flex: 1 },
  btn_acc:    { backgroundColor: th.colors.accent },
  btn_dark:   { backgroundColor: th.colors.onAccent },
  btn_ghost:  { backgroundColor: 'transparent' },
  btn_danger: { backgroundColor: th.colors.surface2 },
  btnOff:     { opacity: 0.5 },
  btnText:    { ...textStyles.button, textTransform: 'uppercase' },
});
