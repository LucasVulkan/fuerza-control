/**
 * SessionFold — la fila plegable de una sesión en «tu programa» (O03-13, spec §29.1):
 * la letra sin fondo (como en Entreno), el nombre con la meta debajo y, a la
 * derecha, un chevron de desplegar que gira al abrir. `children`: lo que se ve abierta.
 * Aparte de `SessionBlock`, que sigue siendo la tarjeta del constructor.
 */
import { useEffect } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Reanimated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';

import { Text } from '../../ui/Text';
import { spacing, textStyles } from '../../../theme';
import { useTheme, useThemedStyles } from '../../../useTheme';

export default function SessionFold({ letter, title, meta, open, onToggle, children }) {
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  const turn   = useSharedValue(open ? 1 : 0);
  useEffect(() => { turn.set(withTiming(open ? 1 : 0, { duration: 180 })); }, [open, turn]);
  const spin = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.get() * 180}deg` }] }));

  return (
    <View style={styles.card}>
      <Pressable
        style={styles.head}
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityLabel={`${title}, ${meta}`}
        accessibilityState={{ expanded: open }}
      >
        <Text style={styles.letter}>{letter}</Text>
        <View style={styles.main}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          <Text style={styles.meta}>{meta}</Text>
        </View>
        <Reanimated.View style={spin}>
          <Svg width={16} height={16} viewBox="0 0 12 12" fill="none">
            <Path d="M2.5 4.5L6 8l3.5-3.5" stroke={th.colors.muted} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Reanimated.View>
      </Pressable>
      {open && <View style={styles.body}>{children}</View>}
    </View>
  );
}

const makeStyles = (th) => StyleSheet.create({
  card: {
    backgroundColor: th.colors.surface,
    borderRadius:    th.radius.md,
    marginBottom:    spacing.sm2,
    overflow:        'hidden',
  },
  head: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing.md,
    minHeight:         64,
    paddingVertical:   spacing.md,
    paddingHorizontal: spacing.lg - 2,
  },
  // Igual que `sesGlyph` de Entreno: sin fondo, cifras tabulares y la caja justa.
  letter: {
    ...textStyles.title,
    lineHeight:         22,
    includeFontPadding: false,
    minWidth:           24,
    fontVariant:        ['tabular-nums'],
    color:              th.colors.accent,
  },
  main:  { flex: 1, minWidth: 0 },
  title: { ...textStyles.itemTitle, color: th.colors.text },
  meta:  { ...textStyles.label, color: th.colors.mutedLight, marginTop: 2 },
  body:  { paddingHorizontal: spacing.lg - 2, paddingBottom: spacing.lg - 2 },
});
