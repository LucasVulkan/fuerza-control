/**
 * El relleno lima del recorrido de entrada (O03 §3.1.3): elegir se nota.
 *
 * Una opción o una baldosa se llena de lima desde su punto de selección (450 ms,
 * out cubic; se recoge si se cambia), igual que `PlanTicket` del paywall y las
 * pestañas de Inicio (U13-02). Con respuesta única avanza sola al terminar el
 * relleno (`PICK_MS`). Lo comparten `FlowOption` y `FlowTile`.
 *
 * El círculo es una vista que escala dentro de un contenedor con `overflow:
 * hidden` y esquinas redondas (el paywall lo dibuja en SVG porque su entrada
 * tiene muescas; aquí no hacen falta).
 */
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Reanimated, { useAnimatedStyle } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { useTheme } from '../../../useTheme';
import { useFill, PICK_MS } from './useFill';

function FillCircle({ p, size, cx }) {
  const th = useTheme();
  const grow = useAnimatedStyle(() => ({ transform: [{ scale: Math.max(p.get(), 0.001) }] }));
  if (!size) return null;
  const R = Math.hypot(Math.max(cx, size.w - cx), size.h / 2);
  return (
    <Reanimated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute', left: cx - R, top: size.h / 2 - R, width: 2 * R, height: 2 * R,
          borderRadius: R, backgroundColor: th.colors.accent,
        },
        grow,
      ]}
    />
  );
}

/**
 * El contenedor pulsable con relleno. `children` es una función de `p` (el avance
 * del relleno) para que el contenido pueda cambiar de color a su paso.
 *
 *   selected  la respuesta ya elegida: va rellena (sin animar si ya lo estaba al montar)
 *   onPress   al tocar, ya
 *   onPick    ~520 ms después, cuando el relleno acabó: lo que lleva a otra pantalla
 *   fx        desde dónde sale el relleno, en px desde la izquierda (por defecto, el centro)
 */
export function FillPressable({
  selected = false, onPress, onPick, fx, style, children, disabled,
  accessibilityRole = 'button', accessibilityLabel,
}) {
  const th = useTheme();
  const [size, setSize] = useState(null);
  const [pressed, setPressed] = useState(false);
  const timer = useRef(null);
  const p = useFill(selected || pressed);

  useEffect(() => () => clearTimeout(timer.current), []);

  function press() {
    if (disabled || timer.current) return;   // el segundo toque, mientras se llena, no cuenta
    Haptics.selectionAsync().catch(() => {});
    onPress?.();
    if (!onPick) return;
    setPressed(true);
    timer.current = setTimeout(() => {
      timer.current = null;
      setPressed(false);
      onPick();
    }, PICK_MS);
  }

  return (
    <Pressable
      onPress={press}
      onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      accessibilityRole={accessibilityRole}
      accessibilityState={{ checked: selected, disabled: !!disabled }}
      accessibilityLabel={accessibilityLabel}
      style={({ pressed: down }) => [
        { overflow: 'hidden', backgroundColor: th.colors.surface },
        style,
        down && styles.down,
      ]}
    >
      <FillCircle p={p} size={size} cx={fx ?? (size ? size.w / 2 : 0)} />
      {children(p)}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  down: { transform: [{ scale: 0.98 }] },
});
