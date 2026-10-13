/**
 * Los hooks del relleno lima del recorrido de entrada (ver `FlowFill.jsx`).
 */
import { useEffect } from 'react';
import { useSharedValue, useAnimatedStyle, withTiming, Easing, interpolateColor } from 'react-native-reanimated';

export const FILL_MS = 450;   // como el relleno de Inicio por pestañas (U13-02)
export const PICK_MS = 520;   // lo que tarda en avanzar sola: el relleno acabado
const MIN_MS = 120;

/** Avance 0→1 del relleno. Cada pieza lleva el suyo: ir y volver deprisa sigue desde donde iba. */
export function useFill(on) {
  const p = useSharedValue(on ? 1 : 0);
  useEffect(() => {
    const to = on ? 1 : 0;
    p.set(withTiming(to, {
      duration: Math.max(MIN_MS, FILL_MS * Math.abs(to - p.get())),
      easing:   Easing.out(Easing.cubic),
    }));
  }, [on, p]);
  return p;
}

/** Color que pasa de `a` (sin elegir) a `b` (elegida) al mismo paso que el relleno. */
export function useInk(p, a, b, prop = 'color') {
  return useAnimatedStyle(() => ({ [prop]: interpolateColor(p.get(), [0, 1], [a, b]) }));
}
