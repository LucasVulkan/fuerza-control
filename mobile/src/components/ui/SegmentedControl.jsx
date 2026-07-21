/**
 * SegmentedControl — control de selección tipo "pill group", 1 línea.
 *
 * Variante "Group together" de Figma (FormaFit). No implementa la variante
 * de 2 líneas ("Etapas") — no hace falta para los usos actuales.
 */
import { useRef, useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
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
  const [translateX] = useState(() => new Animated.Value(0));
  const hasMeasured   = useRef(false);

  const n = options.length;
  const segmentWidth = n > 0 ? (containerWidth - PAD * 2 - GAP * (n - 1)) / n : 0;
  const activeIndex  = Math.max(0, options.findIndex((o) => o.id === value));

  useEffect(() => {
    if (containerWidth === 0) return;
    const toValue = PAD + activeIndex * (segmentWidth + GAP);
    if (!hasMeasured.current) {
      // First measurement — snap into place instead of sliding in from x=0.
      hasMeasured.current = true;
      translateX.setValue(toValue);
      return;
    }
    // Spring en vez de timing: da un pequeño rebote natural al asentarse en vez
    // de un frenado lineal/eased seco — más "satisfactorio" sin código extra.
    Animated.spring(translateX, {
      toValue,
      tension:         260,
      friction:        22,
      useNativeDriver: true,
    }).start();
  }, [activeIndex, containerWidth, segmentWidth, translateX]);

  return (
    <View
      style={styles.container}
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
    >
      {containerWidth > 0 && (
        <Animated.View
          style={[
            styles.highlight,
            {
              width:            segmentWidth,
              backgroundColor:  th.colors.accent,
              transform:        [{ translateX }],
            },
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
