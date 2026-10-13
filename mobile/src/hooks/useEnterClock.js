/**
 * La entrada por partes de las pantallas de las pestañas
 * (docs/specs/U14-pantalla-programa.md §4.3): al llegar a la pestaña, cada
 * bloque sube y aparece en su turno, como en el onboarding.
 *
 * Lo mueve UN reloj por pantalla (un valor compartido, en ms) que arranca al
 * ganar el foco DESDE OTRA PESTAÑA (o al abrirla la primera vez). Volver de una
 * pantalla que se apiló encima (el entreno, el editor) no lo repite, y repintar
 * tampoco. Cada bloque (`Rise`, en `components/ui/Rise.jsx`) calcula su tramo
 * del reloj, que le llega por contexto: `<EnterClock.Provider value={clock}>`.
 */
import { createContext, useCallback, useRef } from 'react';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { useSharedValue, withTiming, Easing, useReducedMotion } from 'react-native-reanimated';

export const ENTER = {
  UNFOLD_MS: 360,   // lo que despliega la tarjeta del programa
  DELAY:     120,   // el primer bloque arranca con el despliegue ya empezado
  STEP:      45,    // entre bloque y bloque, como el onboarding (O03 §3.1.6)
  MS:        420,
  Y:         12,    // lo que sube cada bloque
  MAX:       10,    // a partir del undécimo, entran todos a la vez
};
/**
 * El ritmo de las pantallas con muchos bloques (Sesión, Progresión, Clientes):
 * a 1× se sentían lentas (U14 §4.4).
 */
export const ENTER_FAST = 1.5;

/** Hasta dónde corre el reloj: lo que tarda el último bloque. */
export const ENTER_MS = ENTER.DELAY + ENTER.STEP * ENTER.MAX + ENTER.MS;

export const EnterClock = createContext(null);

/**
 * El reloj de la pantalla. Llamarlo desde la pantalla de la pestaña.
 * `speed`: el ritmo de esa pantalla. Acelera el reloj entero —esperas, turnos y
 * subidas a la vez—, así que los bloques guardan su cadencia, solo que antes.
 */
export function useEnterClock({ speed = 1 } = {}) {
  const navigation    = useNavigation();
  const route         = useRoute();
  const reducedMotion = useReducedMotion();
  const clock         = useSharedValue(reducedMotion ? ENTER_MS : 0);
  const fromOtherTab  = useRef(true);

  useFocusEffect(useCallback(() => {
    if (fromOtherTab.current) {
      clock.set(reducedMotion ? ENTER_MS : 0);
      if (!reducedMotion) clock.set(withTiming(ENTER_MS, { duration: ENTER_MS / speed, easing: Easing.linear }));
    }
    fromOtherTab.current = false;
    return () => {
      // Al perder el foco: ¿se fue a otra pestaña, o algo se apiló encima?
      const st = navigation.getState();
      fromOtherTab.current = st.routes[st.index]?.name !== route.name;
      // Recogida mientras no se ve: al volver no asoma montada un fotograma.
      if (fromOtherTab.current && !reducedMotion) clock.set(0);
    };
  }, [clock, reducedMotion, speed, navigation, route.name]));

  return clock;
}
