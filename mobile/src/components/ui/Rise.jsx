/**
 * Las piezas de la entrada por partes (ver `hooks/useEnterClock.js`).
 *
 * `Rise`: un bloque que sube y aparece en su turno (`index`). Sin reloj en el
 * contexto (la misma pieza dentro de una pantalla que no anima, como la ficha de
 * cliente) pinta lo de dentro tal cual. `layout`: la transición de Reanimated
 * que llevaba el bloque envuelto (las sesiones de Inicio al plegarse); sin
 * pasársela, el envoltorio se movería de golpe y la de dentro ya no la vería.
 *
 * `Unfold`: lo que despliega la tarjeta del programa, de alto 0 a su alto.
 */
import { useContext } from 'react';
import { View, StyleSheet } from 'react-native';
import Reanimated, { useSharedValue, useAnimatedStyle } from 'react-native-reanimated';

import { EnterClock, ENTER } from '../../hooks/useEnterClock';

const easeOut = (x) => { 'worklet'; return 1 - (1 - x) ** 3; };

function RiseOn({ clock, index, style, layout, children }) {
  const anim = useAnimatedStyle(() => {
    const x = (clock.get() - ENTER.DELAY - ENTER.STEP * Math.min(index, ENTER.MAX)) / ENTER.MS;
    const e = easeOut(Math.min(1, Math.max(0, x)));
    return { opacity: e, transform: [{ translateY: (1 - e) * ENTER.Y }] };
  });
  return <Reanimated.View layout={layout} style={[style, anim]}>{children}</Reanimated.View>;
}

export function Rise({ index = 0, style, layout, children }) {
  const clock = useContext(EnterClock);
  if (clock) return <RiseOn clock={clock} index={index} style={style} layout={layout}>{children}</RiseOn>;
  if (layout) return <Reanimated.View layout={layout} style={style}>{children}</Reanimated.View>;
  return style ? <View style={style}>{children}</View> : children;
}

function UnfoldOn({ clock, children }) {
  const h = useSharedValue(0);
  const anim = useAnimatedStyle(() => {
    const p = easeOut(Math.min(1, clock.get() / ENTER.UNFOLD_MS));
    return { height: h.get() * p, opacity: p };
  });
  // El contenido se mide fuera del flujo, así que el alto animado no lo aplasta
  // (mismo truco que `AnimatedHeight`).
  return (
    <Reanimated.View style={[styles.clip, anim]}>
      <View style={styles.float} onLayout={(e) => h.set(e.nativeEvent.layout.height)}>
        {children}
      </View>
    </Reanimated.View>
  );
}

export function Unfold({ children }) {
  const clock = useContext(EnterClock);
  return clock ? <UnfoldOn clock={clock}>{children}</UnfoldOn> : children;
}

const styles = StyleSheet.create({
  clip:  { overflow: 'hidden' },
  float: { position: 'absolute', top: 0, left: 0, right: 0 },
});
