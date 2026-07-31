/**
 * SegmentedControl — control de selección tipo "pill group", 1 línea.
 *
 * Variante "Group together" de Figma (FormaFit). No implementa la variante
 * de 2 líneas ("Etapas") — no hace falta para los usos actuales.
 */
import { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';
import { textStyles, spacing } from '../../theme';
import { useThemedStyles, useTheme } from '../../useTheme';

// Contenedor: space/xs2=4 (padding), space/sm=6 (gap) — ambos confirmados en
// mobile/docs/figma-extraction/components/segmented-control.md.
const PAD = spacing.xs2;
const GAP = spacing.sm;

function offsetFor(index, width, n) {
  const segmentWidth = (width - PAD * 2 - GAP * (n - 1)) / n;
  return PAD + index * (segmentWidth + GAP);
}

export default function SegmentedControl({ options, value, onChange }) {
  const styles = useThemedStyles(makeStyles);
  const th     = useTheme();
  const [containerWidth, setContainerWidth] = useState(0);

  const n = options.length;
  const segmentWidth = n > 0 ? (containerWidth - PAD * 2 - GAP * (n - 1)) / n : 0;
  const activeIndex  = Math.max(0, options.findIndex((o) => o.id === value));

  const translateX  = useSharedValue(0);
  const opacity     = useSharedValue(0);      // hidden until first positioned (no stale-frame flash)
  const positioned  = useRef(false);

  // First measurement → snap into place (no animation, no first-open slide).
  // Every later option change → ease-in-out slide to the new position.
  useEffect(() => {
    if (containerWidth === 0) return;
    const target = offsetFor(activeIndex, containerWidth, n);
    if (!positioned.current) {
      positioned.current = true;
      translateX.value   = target;
      opacity.value      = 1;
    } else {
      translateX.value = withTiming(target, { duration: 200, easing: Easing.inOut(Easing.ease) });
    }
  }, [activeIndex, containerWidth, n, translateX, opacity]);

  const highlightStyle = useAnimatedStyle(() => ({
    opacity:   opacity.value,
    transform: [{ translateX: translateX.value }],
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
            {/* Un label largo (p. ej. "Pendiente · 12" en Facturación) partiría
                el pill en dos líneas y desalinearía el highlight animado. */}
            <Text style={[styles.optionText, active && styles.optionTextActive]} numberOfLines={1}>
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
    borderRadius:    th.radius.full,
    padding:         PAD,
    gap:             GAP,
    position:        'relative',
  },
  highlight: {
    position:     'absolute',
    top:          PAD,
    bottom:       PAD,
    borderRadius: th.radius.full,
  },
  option: {
    flex:            1,
    borderRadius:    th.radius.sm,
    paddingVertical: spacing.sm2, // space/sm2=8 (Group together, botón seleccionado)
    alignItems:      'center',
  },
  optionText: {
    ...textStyles.cardType,
    color: th.colors.text,
  },
  optionTextActive: {
    color: th.colors.onAccent,
  },
});
