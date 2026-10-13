/**
 * Spot — lo resaltado de las tarjetas de «Aprende» (O03 §11.1): el elemento late
 * con un aro (lima; azul si es del entrenador) y, si se pide, un círculo encima
 * que «toca». Todo en Reanimated y sin gestos: es dibujo, no un botón.
 *
 *   tone    'accent' (lo del usuario) | 'blue' (lo del entrenador)
 *   color   fuerza el color del aro (sobre fondo lima el aro lima no se vería)
 *   radius  el radio del elemento resaltado
 *   finger  { top?, right?, bottom?, left? } — dónde cae el círculo, respecto al elemento
 */
import { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Reanimated, {
  useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming, Easing, useReducedMotion,
} from 'react-native-reanimated';

import { withOpacity } from '../../../theme';
import { useTheme } from '../../../useTheme';

const PULSE_MS = 800;
const TAP_MS   = 520;
const FINGER   = 26;
const GROW     = 3;   // lo que el aro sobresale del elemento

export default function Spot({ tone = 'accent', color, radius = 10, finger, style, children }) {
  const th      = useTheme();
  const reduced = useReducedMotion();
  const ink     = color ?? (tone === 'blue' ? th.colors.blue : th.colors.accent);

  const pulse = useSharedValue(1);
  const tap   = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    pulse.set(withRepeat(withTiming(0, { duration: PULSE_MS, easing: Easing.inOut(Easing.quad) }), -1, true));
    tap.set(withRepeat(withSequence(
      withTiming(1, { duration: TAP_MS, easing: Easing.out(Easing.cubic) }),
      withTiming(0, { duration: TAP_MS, easing: Easing.in(Easing.cubic) }),
    ), -1));
  }, [pulse, tap, reduced]);

  const ring = useAnimatedStyle(() => ({
    opacity:   0.4 + 0.6 * pulse.get(),
    transform: [{ scale: 1 + 0.025 * (1 - pulse.get()) }],
  }));
  const dot = useAnimatedStyle(() => ({
    opacity:   1 - 0.25 * tap.get(),
    transform: [{ scale: 1 - 0.22 * tap.get() }],
  }));

  return (
    <View style={style}>
      {children}
      <Reanimated.View
        pointerEvents="none"
        style={[
          styles.ring,
          { borderColor: ink, borderRadius: radius + GROW },
          ring,
        ]}
      />
      {finger && (
        <Reanimated.View
          pointerEvents="none"
          style={[
            styles.finger,
            { backgroundColor: withOpacity(th.colors.text, 0.3), borderColor: th.colors.text },
            finger,
            dot,
          ]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  ring:   { position: 'absolute', top: -GROW, left: -GROW, right: -GROW, bottom: -GROW, borderWidth: 2 },
  finger: { position: 'absolute', width: FINGER, height: FINGER, borderRadius: FINGER / 2, borderWidth: 2, zIndex: 2 },
});
