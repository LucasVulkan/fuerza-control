/**
 * NavScrim — velo del color del fondo en el borde de algo que se desplaza: el
 * contenido no se corta en seco contra un borde, se funde.
 *
 * Nació en el Workout (la lista pasa por debajo de los botones de Android a
 * propósito) y lo usa también `DragSheet`, arriba y abajo. No captura toques.
 *
 * - `edge`: 'bottom' (por defecto) o 'top'. Arriba el velo es opaco en el borde
 *   y se abre hacia abajo.
 * - `inset`: el margen de la barra del sistema (abajo). El velo mide
 *   `inset + fade` px. Por defecto el fundido recorre todo ese alto, y bajo los
 *   botones el contenido aún se intuye (el Workout, donde no molesta). Con
 *   `opaqueInset` la barra va tapada del todo y el fundido empieza justo encima
 *   de los botones: lo que quieren las hojas.
 *
 * Va dentro de una caja `absolute` de lado a lado y el SVG la llena: con el
 * `width="100%"` en el propio SVG se medía contra el contenido del padre, sin
 * su padding, y en las hojas no llegaba a los bordes.
 */
import { useId } from 'react';
import { View } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { useTheme } from '../../useTheme';

// Curva de entrada suave (t²) en vez de rampa lineal: con un color casi negro,
// un tramo empinado en pocos píxeles se ve a franjas.
const STOPS = [0, 0.2, 0.4, 0.6, 0.8, 1].map((t) => [t, Math.round(t * t * 100) / 100]);

export default function NavScrim({ edge = 'bottom', inset = 0, fade = 28, opaqueInset = false }) {
  const th     = useTheme();
  // Un id por velo: una hoja abierta sobre el Workout pinta varios a la vez.
  const id     = `scrim${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const top    = edge === 'top';
  const height = inset + fade;
  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', left: 0, right: 0, height, ...(top ? { top: 0 } : { bottom: 0 }) }}
    >
      <Svg width="100%" height="100%">
        <Defs>
          {/* Arriba se invierte: el opaco queda en el borde de arriba. */}
          <LinearGradient id={id} x1="0" y1={top ? '1' : '0'} x2="0" y2={top ? '0' : '1'}>
            {/* Con `opaqueInset`, la curva se comprime en los `fade` px del
                interior y el último tope (opaco) llega al borde. */}
            {STOPS.map(([offset, opacity]) => (
              <Stop
                key={offset}
                offset={opaqueInset ? (offset * fade) / height : offset}
                stopColor={th.colors.bg}
                stopOpacity={opacity}
              />
            ))}
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}
