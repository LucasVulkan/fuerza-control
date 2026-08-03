/**
 * StageSegBar — barra de progreso de etapa: un segmento por ciclo, todos del
 * mismo ancho, con el skew -18deg que es la firma diagonal del sistema.
 *
 * Va en SVG y no con `transform: skewX` porque en Android RN aplica los
 * transforms descomponiendo la matriz en propiedades de View (rotation, scale,
 * translation) y el skew, que ninguna de ellas puede representar, se pierde por
 * el camino — se veía recto. En iOS sí funcionaba: distinto render, mismo
 * código. Aquí los paralelogramos son geometría explícita, igual en ambos.
 *
 * La usan el banner de Home (sobre lima: track/fill en onAccent) y la tarjeta
 * de programa asignado de la ficha de cliente (sobre oscuro: track surface2,
 * fill accent) — de ahí que los colores sean props y no tokens fijos.
 */
import { useState } from 'react';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { spacing } from '../../theme';

const SEG_H    = spacing.sm2;
const SEG_GAP  = spacing.xs2;
const SEG_SKEW = 0.3249; // tan(18°)

export default function StageSegBar({ ratios, trackColor, fillColor }) {
  const [width, setWidth] = useState(0);
  const segW = (width - SEG_GAP * (ratios.length - 1)) / ratios.length;
  const d    = (SEG_SKEW * SEG_H) / 2; // desplazamiento del borde superior/inferior
  const para = (x, w) => `M${x + d},0 L${x + w + d},0 L${x + w - d},${SEG_H} L${x - d},${SEG_H} Z`;
  const segX = (i) => i * (segW + SEG_GAP);

  return (
    <View style={{ height: SEG_H }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {segW > 0 && (
        <Svg width={width} height={SEG_H}>
          {ratios.map((_, i) => (
            <Path key={`t${i}`} d={para(segX(i), segW)} fill={trackColor} />
          ))}
          {ratios.map((r, i) => (r > 0
            ? <Path key={`f${i}`} d={para(segX(i), segW * Math.min(1, r))} fill={fillColor} />
            : null))}
        </Svg>
      )}
    </View>
  );
}
