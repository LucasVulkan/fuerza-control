/**
 * Iconos compartidos por los editores de programa y de sesión.
 *
 * Todos salen del componente `Icons` de Figma (`98:138`). Las coordenadas y
 * radios son los del asset real descargado, no los de la caja del icono — ver
 * la regla 4 de `docs/UI-MIGRATION.md`.
 */
import Svg, { Path, Circle } from 'react-native-svg';

// Flecha sólida (asset `119:783`): apunta a la derecha; la de "volver" es la
// misma rotada 180°. La misma que usa HomeView para la sesión futura.
export function ArrowIcon({ size = 18, color, back = false }) {
  return (
    <Svg
      width={size * 0.6} height={size} viewBox="0 0 12 20" fill="none"
      style={back ? { transform: [{ rotate: '180deg' }] } : undefined}
    >
      <Path d="M0 0L5 0L12 10L5 20L0 20L7 10L0 0Z" fill={color} />
    </Svg>
  );
}

// Icons / "More..." (`151:1467`): 3 puntos de 3px. El componente los dibuja en
// horizontal, pero las instancias de la cabecera van rotadas -90° — o sea que en
// pantalla se ven VERTICALES. Se dibuja ya rotado.
export function MenuIcon({ size = 26, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 26 26" fill="none">
      <Circle cx={13} cy={6.5}  r={1.5} fill={color} />
      <Circle cx={13} cy={12.5} r={1.5} fill={color} />
      <Circle cx={13} cy={18.5} r={1.5} fill={color} />
    </Svg>
  );
}

// Icons / "Arrastre" (`184:2371`): 2×3 puntos de 3px en una caja de 26.
export function DragIcon({ size = 26, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 26 26" fill="none">
      {[10.5, 15.5].flatMap((cx) => [6.5, 12.5, 18.5].map((cy) => (
        <Circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={1.5} fill={color} />
      )))}
    </Svg>
  );
}

export function PencilIcon({ size = 15, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 20h9" stroke={color} strokeWidth={1.7} strokeLinecap="round" />
      <Path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"
            stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// Icono de la fila "Progresión" del editor de ejercicio (`163:1223`): 3 barras
// ascendentes con el remate superior en diagonal. En Figma son 3 rectángulos
// rotados -90° con un corte oblicuo; aquí van ya resueltos a sus coordenadas
// finales dentro de la caja de 15 (la diferencia con el asset original es de
// ~0.1px, por debajo de lo perceptible).
export function ProgressionIcon({ size = 15, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 15 15" fill="none">
      <Path d="M3.6 5.3L3.6 12.85L1.62 12.85L1.62 6.82Z"      fill={color} />
      <Path d="M8.05 2.82L8.05 12.84L6.07 12.84L6.07 4.37Z"    fill={color} />
      <Path d="M12.51 0.84L12.51 12.84L10.53 12.84L10.53 2.37Z" fill={color} />
    </Svg>
  );
}

export function CheckIcon({ size = 16, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M20 6L9 17l-5-5" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
