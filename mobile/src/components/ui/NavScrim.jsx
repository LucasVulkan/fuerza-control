/**
 * NavScrim — velo del color del fondo al pie de algo que pasa por debajo de los
 * botones de Android (o del indicador de inicio de iOS). El contenido no se
 * corta en seco contra un borde: se funde y deja los botones despegados de él.
 *
 * Nació en el Workout (la lista pasa por debajo de los botones a propósito) y
 * lo usa también `DragSheet`, cuyo contenido desplazable llega hasta el borde.
 * Se coloca `absolute` al pie de su contenedor y no captura toques.
 *
 * Mide `inset` (el margen de abajo, la barra del sistema) + `fade` px por
 * encima, y el fundido recorre todo ese alto: donde están los botones el velo
 * ya es casi opaco, y la altura extra es lo que le da píxeles al fundido.
 */
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { useTheme } from '../../useTheme';

// Curva de entrada suave (t²) en vez de rampa lineal: con un color casi negro,
// un tramo empinado en pocos píxeles se ve a franjas.
const STOPS = [0, 0.2, 0.4, 0.6, 0.8, 1].map((t) => [t, Math.round(t * t * 100) / 100]);

export default function NavScrim({ inset, fade = 28 }) {
  const th     = useTheme();
  const height = inset + fade;
  return (
    <Svg
      pointerEvents="none"
      style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height }}
      width="100%"
      height={height}
    >
      <Defs>
        <LinearGradient id="navScrim" x1="0" y1="0" x2="0" y2="1">
          {STOPS.map(([offset, opacity]) => (
            <Stop key={offset} offset={offset} stopColor={th.colors.bg} stopOpacity={opacity} />
          ))}
        </LinearGradient>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#navScrim)" />
    </Svg>
  );
}
