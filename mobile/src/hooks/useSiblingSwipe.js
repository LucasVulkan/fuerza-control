/**
 * useSiblingSwipe — ir al anterior / siguiente de una lista deslizando el
 * contenido, con la misma mecánica que Progreso › ejercicio (`ExerciseDetail`) y
 * que el editor de ejercicio y de bloque (P16-04).
 *
 * Devuelve:
 *  - `panHandlers`  al `View` que envuelve el contenido (no al ScrollView).
 *  - `slideStyle`   al `Reanimated.View` que hay dentro: lo desplaza y lo atenúa.
 *  - `go(dir, id?)` cambia al vecino (`dir` ±1) o, con `id`, a cualquiera —la
 *                   dirección solo decide hacia dónde se desliza.
 *  - `lockRef`      un `ref` a true mientras se toca algo que no debe arrastrar
 *                   la página: la gráfica lo pone a mano; el resto de controles
 *                   (`StepField`, `SegmentedControl`) lo ponen solos si cuelgan de
 *                   un `SwipeLockContext.Provider value={lockRef}`.
 *
 * `onChange(id)` se llama a mitad de camino, con el contenido ya fuera de
 * pantalla: ahí se cambia el id (y se remonta lo que haga falta) y el nuevo
 * contenido entra desde el lado contrario.
 *
 * Con `awaitLayout`, el nuevo no entra hasta que la pantalla llama a
 * `onContentLayout` (el `onLayout` de lo que se remonta) y pasan dos fotogramas:
 * los editores de ejercicio y de bloque tardan en montarse y en calcular sus
 * textos, y entrar a la vez daba trompicones al final. Mientras, espera fuera.
 */
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { PanResponder, useWindowDimensions } from 'react-native';
import { useSharedValue, useAnimatedStyle, withTiming, withSequence, interpolate } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

export const SwipeLockContext = createContext(null);

/** Props táctiles para el `View` raíz de un control que no debe arrastrar la página. */
export function useSwipeLock() {
  const lockRef = useContext(SwipeLockContext);
  if (!lockRef) return null;
  const release = () => { lockRef.current = false; };
  return { onTouchStart: () => { lockRef.current = true; }, onTouchEnd: release, onTouchCancel: release };
}

// Si el `onLayout` no llega (no se remontó nada), entra igual pasado este tiempo.
const LAYOUT_TIMEOUT = 500;

export function useSiblingSwipe({ prevId, nextId, onChange, awaitLayout = false }) {
  const { width: winW } = useWindowDimensions();
  const tx      = useSharedValue(0);
  const lockRef = useRef(false);
  const live    = useRef({});
  const pending = useRef(null);   // { dir, timer } mientras el nuevo espera fuera
  useEffect(() => () => clearTimeout(pending.current?.timer), []);
  useEffect(() => { live.current = { prevId, nextId, onChange, winW }; });

  // Los gestos leen `live` al tocar, no al pintar: el lint no lo distingue.
  /* eslint-disable react-hooks/refs */
  const enter = (dir) => {
    const w = live.current.winW;
    tx.set(withSequence(withTiming(dir * w * 0.4, { duration: 0 }), withTiming(0, { duration: 220 })));
  };
  // Lo nuevo ya está maquetado; dos fotogramas más para los textos que se
  // recalculan en sus efectos, y entra.
  const onContentLayout = () => {
    const p = pending.current;
    if (!p) return;
    pending.current = null;
    clearTimeout(p.timer);
    requestAnimationFrame(() => requestAnimationFrame(() => enter(p.dir)));
  };
  const go = (dir, id) => {
    const target = id ?? (dir > 0 ? live.current.nextId : live.current.prevId);
    if (!target) { tx.set(withTiming(0, { duration: 200 })); return; }
    const w = live.current.winW;
    Haptics.selectionAsync().catch(() => {});
    tx.set(withTiming(-dir * w, { duration: 160 }));
    setTimeout(() => {
      if (!awaitLayout) {
        live.current.onChange?.(target);
        enter(dir);
        return;
      }
      clearTimeout(pending.current?.timer);
      tx.set(dir * w); // fuera, al otro lado, mientras se monta
      pending.current = { dir, timer: setTimeout(onContentLayout, LAYOUT_TIMEOUT) };
      live.current.onChange?.(target);
    }, 160);
  };
  const [swipe] = useState(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gs) =>
      !lockRef.current && Math.abs(gs.dx) > 16 && Math.abs(gs.dx) > Math.abs(gs.dy) * 1.5,
    onPanResponderMove: (_, gs) => {
      // En el primero y el último, el contenido se resiste: no hay a dónde ir.
      const edge = (gs.dx > 0 && !live.current.prevId) || (gs.dx < 0 && !live.current.nextId);
      tx.set(edge ? gs.dx / 4 : gs.dx);
    },
    onPanResponderTerminationRequest: () => false,
    onPanResponderRelease: (_, gs) => {
      if (gs.dx < -70 || (gs.dx < -30 && gs.vx < -0.5)) go(1);
      else if (gs.dx > 70 || (gs.dx > 30 && gs.vx > 0.5)) go(-1);
      else tx.set(withTiming(0, { duration: 200 }));
    },
    onPanResponderTerminate: () => tx.set(withTiming(0, { duration: 200 })),
  }));
  const panHandlers = swipe.panHandlers;
  /* eslint-enable react-hooks/refs */
  const slideStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.get() }],
    opacity: interpolate(Math.abs(tx.get()), [0, winW], [1, 0.3]),
  }));

  return { go, panHandlers, slideStyle, lockRef, onContentLayout };
}
