import Svg, { Path } from 'react-native-svg';

// Path exacto del asset "Subtract" de Figma (Input Field Current/Empty, ~4.3×7.1).
// Lo usan la casilla activa (SetRow) y los indicadores de borde de la regla (ScrubRuler).
const CHEVRON_W = 4.28102;
const CHEVRON_H = 7.13504;

export default function Chevron({ direction = 'right', size = 8, color }) {
  return (
    <Svg
      width={size * (CHEVRON_W / CHEVRON_H)}
      height={size}
      viewBox={`0 0 ${CHEVRON_W} ${CHEVRON_H}`}
      style={direction === 'left' ? { transform: [{ scaleX: -1 }] } : undefined}
    >
      <Path d="M3.5 3.56752L0.5 6.06752V5.2218L2.48499 3.56752L0.5 1.91259V1.06752L3.5 3.56752Z" fill={color} />
    </Svg>
  );
}
