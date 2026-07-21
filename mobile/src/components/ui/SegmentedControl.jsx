/**
 * SegmentedControl — control de selección tipo "pill group", 1 línea.
 *
 * Variante "Group together" de Figma (FormaFit). No implementa la variante
 * de 2 líneas ("Etapas") — no hace falta para los usos actuales.
 */
import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { textStyles, spacing } from '../../theme';
import { useThemedStyles, useTheme } from '../../useTheme';

// Contenedor: space/xs2=4 (padding), space/sm=6 (gap) — ambos confirmados en
// mobile/docs/figma-extraction/components/segmented-control.md.
const PAD = spacing.xs2;
const GAP = spacing.sm;

export default function SegmentedControl({ options, value, onChange }) {
  const styles = useThemedStyles(makeStyles);
  const th     = useTheme();
  const [containerWidth, setContainerWidth] = useState(0);

  const n = options.length;
  const segmentWidth = n > 0 ? (containerWidth - PAD * 2 - GAP * (n - 1)) / n : 0;
  const activeIndex  = Math.max(0, options.findIndex((o) => o.id === value));

  // Target computed inline inside the worklet (not via a useEffect that sets a
  // shared value after paint) — Reanimated only animates changes to the style,
  // so the very first render lands directly on the correct position with no
  // stale-frame flash, and every subsequent change springs naturally.
  // damping:30 sits just under critical for stiffness:300 — snappy slide with
  // no visible overshoot (18/220 read as too bouncy).
  const highlightStyle = useAnimatedStyle(() => ({
    transform: [{
      translateX: withSpring(PAD + activeIndex * (segmentWidth + GAP), { damping: 30, stiffness: 300 }),
    }],
  }));

  return (
    <View
      style={styles.container}
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
    >
      {containerWidth > 0 && (
        <Animated.View
          style={[
            styles.highlight,
            { width: segmentWidth, backgroundColor: th.colors.accent },
            highlightStyle,
          ]}
        />
      )}
      {options.map(({ id, label }) => {
        const active = value === id;
        return (
          <TouchableOpacity
            key={id}
            style={styles.option}
            onPress={() => onChange(id)}
            activeOpacity={0.75}
          >
            <Text style={[styles.optionText, active && styles.optionTextActive]}>
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const makeStyles = (th) => StyleSheet.create({
  container: {
    flexDirection:   'row',
    backgroundColor: th.colors.surface2,
    borderRadius:    th.radius.md,
    padding:         PAD,
    gap:             GAP,
    position:        'relative',
  },
  highlight: {
    position:     'absolute',
    top:          PAD,
    bottom:       PAD,
    borderRadius: th.radius.sm,
  },
  option: {
    flex:            1,
    borderRadius:    th.radius.sm,
    paddingVertical: spacing.sm2, // space/sm2=8 (Group together, botón seleccionado)
    alignItems:      'center',
  },
  optionText: {
    ...textStyles.cardType,
    color: th.colors.mutedLight,
  },
  optionTextActive: {
    color: th.colors.onAccent,
  },
});
