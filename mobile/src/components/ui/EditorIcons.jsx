/**
 * Iconos compartidos por los editores de programa y de sesión.
 *
 * Los de varias piezas (lápiz, candado, eslabón, engranaje…) van a dos colores
 * con `TwoToneIcon` — maqueta docs/mockups/iconos-dos-colores.html.
 *
 * Todos salen del componente `Icons` de Figma (`98:138`). Las coordenadas y
 * radios son los del asset real descargado, no los de la caja del icono — ver
 * la regla 4 de `docs/UI-MIGRATION.md`.
 */
import Svg, { Path, Circle, G, Rect } from 'react-native-svg';

import { TwoToneIcon } from './TwoTone';

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

// Chevron fino hacia abajo (barras de los desplegables). Se rota 180º vía un
// wrapper animado cuando el menú está abierto, para que apunte arriba.
export function ChevronDown({ size = 12, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 12 12" fill="none">
      <Path d="M2.5 4.5 L6 8 L9.5 4.5" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// Icons / "More..." (`151:1467`): 3 puntos de 3px. El componente los dibuja en
// horizontal, pero las instancias de la cabecera van rotadas -90° — o sea que en
// pantalla se ven VERTICALES. Se dibuja ya rotado.
//
// La caja va a 30 y no a los 26 de Figma: los puntos sólo ocupan 15 de los 26 y
// en pantalla el icono se leía pequeño al lado del resto del cromo. Excepción
// pedida, no un descuido. Al escalar la caja escalan los puntos con ella, así
// que basta con este número — las instancias no pasan `size`.
// `horizontal` devuelve el icono a su orientación de origen (la de Figma, sin
// rotar). No es otro icono: son los mismos tres puntos con los ejes cambiados,
// para los sitios donde el "⋯" siempre fue horizontal (pie de la tarjeta de
// programa, fila de archivados).
export function MenuIcon({ size = 30, color, horizontal = false }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 26 26" fill="none">
      {[6.5, 12.5, 18.5].map((d) => (
        <Circle
          key={d}
          cx={horizontal ? d : 13}
          cy={horizontal ? 13 : d}
          r={1.5}
          fill={color}
        />
      ))}
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
    <TwoToneIcon
      size={size} color={color}
      g={<Path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" />}
      a={<Path d="M14.5 5.5l3 3" />}
    />
  );
}

// Icono de la fila "Progresión" del editor de ejercicio (`163:1223`): 3 barras
// ascendentes con el remate superior en diagonal. En Figma son 3 rectángulos
// rotados -90° con un corte oblicuo; aquí van ya resueltos a sus coordenadas
// finales dentro de la caja de 15 (la diferencia con el asset original es de
// ~0.1px, por debajo de lo perceptible).
export function ProgressionIcon({ size = 15, color }) {
  return (
    <TwoToneIcon
      size={size} color={color}
      gf={<Path d="M5.8 8.5v12.1H2.6v-9.7zM12.9 4.5v16.1H9.7V7z" />}
      af={<Path d="M20 1.3v19.3h-3.2V3.8z" />}
    />
  );
}

// Eslabón de «vinculado con otra sesión» (tarjeta de identidad, P16-03).
export function LinkIcon({ size = 13, color }) {
  return (
    <TwoToneIcon
      size={size} color={color}
      g={<Path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />}
      a={<Path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />}
    />
  );
}

// Lista con viñetas del botón «n/N» de la esquina de la tarjeta (P16-04).
export function ListIcon({ size = 15, color }) {
  return (
    <TwoToneIcon
      size={size} color={color}
      g={<Path d="M9 6h11M9 12h11M9 18h11" />}
      gf={<G><Circle cx={4.5} cy={12} r={1.4} /><Circle cx={4.5} cy={18} r={1.4} /></G>}
      af={<Circle cx={4.5} cy={6} r={1.4} />}
    />
  );
}

export function CheckIcon({ size = 16, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M20 6L9 17l-5-5" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// Cerrar / eliminar en una fila. Tampoco sale de Figma. Trazo 2 como el resto
// de iconos dibujados a mano del proyecto.
export function CloseIcon({ size = 14, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M6 6l12 12M18 6L6 18" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

// Candado de etapa bloqueada. NO sale de Figma: el componente `Icons` (98:138)
// tiene 28 variantes y ninguna es un candado — la feature es posterior al
// diseño. Trazo 2 como el resto de iconos dibujados a mano del proyecto.
// `solid` rellena el cuerpo: en el planificador, el aro dice "abierta" y el
// candado macizo dice "bloqueada" sin necesidad de una etiqueta al lado.
export function LockIcon({ size = 14, color, solid = false }) {
  return (
    <TwoToneIcon
      size={size} color={color}
      g={<Path d="M7.5 10V7a4.5 4.5 0 0 1 9 0v3" />}
      {...(solid
        ? { af: <Rect x="4.5" y="10" width="15" height="10.5" rx="2.5" /> }
        : { a: <Rect x="5" y="10.5" width="14" height="9.5" rx="2.5" /> })}
    />
  );
}

// Información — dispara la ficha de una métrica (docs/specs/T02-metric-transparency.md).
// Tampoco sale de Figma: el diseño no contempla esta feature. Trazo 2 como el
// resto de iconos dibujados a mano, y aro sin relleno para que no compita con
// el número al que acompaña.
export function InfoIcon({ size = 12, color }) {
  return (
    <TwoToneIcon
      size={size} color={color}
      g={<Circle cx="12" cy="12" r="9" />}
      a={<Path d="M12 16.5v-5" />}
      af={<Circle cx="12" cy="7.8" r="1.2" />}
    />
  );
}

// Variantes de ejercicio (docs/specs/P09-exercise-variants.md). No salen de Figma:
// trazo fino, caja de 14/15 como el resto de iconos de fila.

// Fila VARIANTE del editor: dos deslizadores.
export function VariantIcon({ size = 15, color }) {
  return (
    <TwoToneIcon
      size={size} color={color}
      g={<Path d="M3.5 7h17M3.5 17h17" />}
      gf={<Circle cx="15.5" cy="17" r="2.6" />}
      af={<Circle cx="8.5" cy="7" r="2.6" />}
    />
  );
}

// Calentamiento: escalera de tres peldaños (maqueta link-exercises, `#i-warm`).
// Tampoco sale de Figma; mismo tamaño y trazo que VariantIcon.
export function WarmupIcon({ size = 15, color }) {
  return (
    <TwoToneIcon
      size={size} color={color}
      g={<Path d="M3.5 19h4.3v-4.3H12v-4.3h4.3V6" />}
      a={<Path d="M16.3 6h4.2" />}
    />
  );
}

// Volver a la del programa (hoja «solo hoy» del Workout): flecha en círculo.
export function ResetIcon({ size = 18, color }) {
  return (
    <TwoToneIcon
      size={size} color={color}
      g={<Path d="M4 12a8 8 0 1 0 2.35-5.65" />}
      a={<Path d="M4 3.5v5h5" />}
    />
  );
}

// Ajustes de la etapa (P14 §3.4). No sale de Figma: el engranaje de trazo de
// la maqueta `stages-editor-5.html`.
export function GearIcon({ size = 17, color }) {
  return (
    <TwoToneIcon
      size={size} color={color}
      g={<Path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />}
      a={<Circle cx={12} cy={12} r={3} />}
    />
  );
}
