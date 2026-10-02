/**
 * AnimatedHeight — un contenedor cuya altura sigue a la de su contenido CON
 * animación. Para las hojas que crecen o encogen al cambiar lo que llevan
 * dentro (un texto que pasa de una línea a tres): la hoja va anclada abajo, así
 * que sin esto su borde de arriba salta a cada toque.
 *
 * Cómo: el contenido se mide a su alto natural (`onLayout`) y el contenedor
 * anima su `height` hasta él. La primera medida se aplica de golpe —la hoja
 * entra ya con su alto— y hasta entonces el contenido va en el flujo normal,
 * así que el primer frame no sale vacío. Después el contenido pasa a
 * `absolute` (se mide sin que el alto animado lo aplaste) y el contenedor
 * recorta lo que sobra mientras encoge.
 */
import { useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import Reanimated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';

const TIMING = { duration: 220, easing: Easing.out(Easing.cubic) };

export default function AnimatedHeight({ children, style }) {
  const height   = useSharedValue(0);
  const target   = useRef(null);
  const [measured, setMeasured] = useState(false);

  const onLayout = (e) => {
    const next = Math.round(e.nativeEvent.layout.height);
    if (target.current === null) {
      target.current = next;
      height.value   = next;
      setMeasured(true);
      return;
    }
    if (next === target.current) return;
    target.current = next;
    height.value   = withTiming(next, TIMING);
  };

  const animated = useAnimatedStyle(() => ({ height: height.value }));

  return (
    <Reanimated.View style={[style, measured && [styles.clip, animated]]}>
      <View style={measured ? styles.float : null} onLayout={onLayout}>
        {children}
      </View>
    </Reanimated.View>
  );
}

const styles = StyleSheet.create({
  clip:  { overflow: 'hidden' },
  float: { position: 'absolute', top: 0, left: 0, right: 0 },
});
