/**
 * TabBar — pestañas de navegación: una píldora que se desliza sobre su track.
 *
 * Antes eran pestañas "clásicas" (la activa tomaba el fondo de la página y se
 * fundía con el contenido), y eso obligaba a que lo de arriba fuera una banda
 * de otro color. La pantalla pasaba de header negro → banda gris → contenido
 * negro, y una banda gris no existe en ningún otro sitio de la app. Ahora la
 * pantalla entera va sobre `bg` y la banda desaparece
 * (docs/specs/home-sessions.md §4.6).
 *
 * Sigue sin ser `SegmentedControl` con otra piel, pero la diferencia ya no sale
 * del fondo sobre el que flotan sino del color del highlight:
 *
 *   > El `SegmentedControl` de filtro lleva el highlight en `accent`; las
 *   > pestañas de navegación lo llevan NEUTRO. En una pantalla con los dos, la
 *   > píldora lima es siempre el filtro.
 *
 * Encaja con la regla del acento: marca acción, no en qué pestaña estás. Los
 * dos siguen sin parecerse — track `surface2` y `radius.full` allí, `surface` y
 * `radius.md` aquí.
 *
 * Va sin padding propio: lo coloca quien lo usa.
 */
import { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';

import { textStyles } from '../../theme';
import { useThemedStyles } from '../../useTheme';

const PAD = 3;
const GAP = 3;

function offsetFor(index, width, n) {
  const tabWidth = (width - PAD * 2 - GAP * (n - 1)) / n;
  return PAD + index * (tabWidth + GAP);
}

export default function TabBar({ options, value, onChange }) {
  const styles = useThemedStyles(makeStyles);
  const [trackWidth, setTrackWidth] = useState(0);

  const n           = options.length;
  const tabWidth    = n > 0 ? (trackWidth - PAD * 2 - GAP * (n - 1)) / n : 0;
  const activeIndex = Math.max(0, options.findIndex((o) => o.id === value));

  const translateX = useSharedValue(0);
  const opacity    = useSharedValue(0);   // oculta hasta la primera medida (sin fotograma viejo)
  const positioned = useRef(false);

  // Primera medida → colocar sin animar; cada cambio posterior → deslizar.
  useEffect(() => {
    if (trackWidth === 0) return;
    const target = offsetFor(activeIndex, trackWidth, n);
    if (!positioned.current) {
      positioned.current = true;
      translateX.value   = target;
      opacity.value      = 1;
    } else {
      translateX.value = withTiming(target, { duration: 200, easing: Easing.inOut(Easing.ease) });
    }
  }, [activeIndex, trackWidth, n, translateX, opacity]);

  const pillStyle = useAnimatedStyle(() => ({
    opacity:   opacity.value,
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <View style={styles.track} onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}>
      {trackWidth > 0 && (
        <Animated.View style={[styles.pill, { width: tabWidth }, pillStyle]} />
      )}
      {options.map(({ id, label }) => {
        const active = value === id;
        return (
          <TouchableOpacity
            key={id}
            style={styles.tab}
            onPress={() => onChange(id)}
            activeOpacity={0.75}
            // La caja mide ~33 px de alto: el hitSlop la lleva a zona de pulgar
            // sin engordar el track.
            hitSlop={{ top: 6, bottom: 6 }}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.label, active && styles.labelActive]} numberOfLines={1}>
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const makeStyles = (th) => StyleSheet.create({
  track: {
    flexDirection:   'row',
    backgroundColor: th.colors.surface,
    borderRadius:    th.radius.md,
    padding:         PAD,
    gap:             GAP,
    position:        'relative',
  },
  pill: {
    position:        'absolute',
    top:             PAD,
    bottom:          PAD,
    borderRadius:    th.radius.sm,
    backgroundColor: th.colors.surface2,
  },
  tab: {
    flex:              1,
    paddingVertical:   9,
    paddingHorizontal: 2,
    alignItems:        'center',
  },
  label:       { ...textStyles.cardType, color: th.colors.mutedLight },
  labelActive: { color: th.colors.text },
});
