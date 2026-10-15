/**
 * RoundCheck — el check de toda selección múltiple: aro gris vacío sin marcar,
 * círculo lima con el ✓ negro al marcarlo (con un rebote corto), y `done`
 * para lo que ya está y no se puede elegir (relleno apagado, ✓ gris).
 *
 * Solo pinta: la fila que lo lleva es la que se pulsa y la que vibra.
 */
import { useEffect, useRef } from 'react';
import Reanimated, { useSharedValue, useAnimatedStyle, withSequence, withTiming, withSpring } from 'react-native-reanimated';
import { useTheme } from '../../useTheme';
import { CheckIcon } from './EditorIcons';

export default function RoundCheck({ on = false, done = false, size = 24 }) {
  const th    = useTheme();
  const scale = useSharedValue(1);
  const mounted = useRef(false);

  // Solo al pasar a marcado, y no al montar: una lista que se pinta con cinco
  // ya marcados no tiene que saltar entera.
  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return; }
    if (on) scale.set(withSequence(withTiming(0.8, { duration: 60 }), withSpring(1, { damping: 7, stiffness: 320 })));
  }, [on, scale]);
  const pop = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  const filled = on || done;
  return (
    <Reanimated.View
      style={[
        { width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
        filled
          ? { backgroundColor: on ? th.colors.accent : (th.colors.surface3 ?? th.colors.border) }
          : { borderWidth: 2, borderColor: th.colors.muted },
        pop,
      ]}
    >
      {filled && <CheckIcon size={Math.round(size * 0.58)} color={on ? th.colors.onAccent : th.colors.mutedLight} />}
    </Reanimated.View>
  );
}
