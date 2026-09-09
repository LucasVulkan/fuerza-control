/**
 * Plegado de un desplegable — salida que **encoge además de desvanecerse**.
 *
 * `FadeOut` a secas no vale. Reanimated saca la vista del flujo y la pinta fuera
 * del recorte de su tarjeta, así que no la clipa nadie: el contenido se
 * desvanecía entero en su sitio en vez de plegarse. Colaba mientras el
 * desplegable era el último hijo y la tarjeta encogía justo por encima; en
 * cuanto hay algo debajo (un botón, otra sección) se ve a la primera.
 *
 * La opacidad va más rápida que el alto para que el contenido no siga ahí
 * cuando la caja ya casi no existe.
 *
 * Salió de las sesiones de la Home y lo comparte la ficha de cliente: el
 * `FOLD_MS` es el mismo a propósito, para que dos plegados en pantallas
 * distintas se muevan igual.
 */
import { withTiming } from 'react-native-reanimated';

export const FOLD_MS = 240;

export function collapseOut(values) {
  'worklet';
  return {
    initialValues: {
      opacity: 1,
      height:  values.currentHeight,
      width:   values.currentWidth,
      originX: values.currentOriginX,
      originY: values.currentOriginY,
    },
    animations: {
      height:  withTiming(0, { duration: FOLD_MS }),
      opacity: withTiming(0, { duration: FOLD_MS * 0.6 }),
    },
  };
}
