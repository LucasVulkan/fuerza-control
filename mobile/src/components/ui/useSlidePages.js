/**
 * useSlidePages — la animación de «cambiar de página» que comparten Asignar
 * programa, los programas archivados y el editor de sesión: la página vieja
 * sale por un lado y la nueva entra por el otro, con la curva del resalte del
 * segmentado.
 *
 * Devuelve `slide(dir)` (+1 = la página nueva está a la derecha, se avanza; -1 a
 * la izquierda, se vuelve; 0 al abrir, la primera no desliza) y los dos
 * `entering`/`exiting` para el `Reanimated.View` con `key={página}`. Quien lo
 * usa llama a `slide` ANTES de cambiar de página.
 *
 * `slide` y no el valor compartido suelto: el lint del compilador de React no
 * deja asignar `.value` a algo que viene de un hook ajeno.
 */
import { useWindowDimensions } from 'react-native';
import { useSharedValue, withTiming } from 'react-native-reanimated';

import SegmentedControl from './SegmentedControl';

// Fuera del hook: un worklet no puede capturar `SegmentedControl` entero.
const SLIDE = SegmentedControl.TIMING;

export function useSlidePages() {
  const { width: screenW } = useWindowDimensions();
  const slideDir = useSharedValue(0);
  const pageEntering = () => {
    'worklet';
    return {
      initialValues: { transform: [{ translateX: slideDir.value * screenW }] },
      animations:    { transform: [{ translateX: withTiming(0, SLIDE) }] },
    };
  };
  const pageExiting = () => {
    'worklet';
    return {
      initialValues: { transform: [{ translateX: 0 }] },
      animations:    { transform: [{ translateX: withTiming(-slideDir.value * screenW, SLIDE) }] },
    };
  };
  const slide = (dir) => { slideDir.value = dir; };
  return { slide, pageEntering, pageExiting };
}
