/**
 * ProgressChart — la gráfica de la progresión de un ejercicio (va dentro de la
 * tarjeta del detalle, que pone la cifra y la sesión leída).
 *
 *   points    [{ t, value }]   ordenados por fecha, ya en la unidad que se pinta
 *   selected  índice del punto que se está leyendo, o null (el último)
 *   onSelect  (i | null) — tocar un punto lo lee; tocar el mismo, lo suelta
 *   lockRef   ref a true mientras el dedo está sobre la gráfica: quien la
 *             contiene no debe tomar el gesto (deslizar entre ejercicios)
 *
 * Puntos EQUIDISTANTES, uno por sesión: la posición no depende de la fecha ni
 * de la hora, y las fechas del eje son las de los puntos que caen debajo. A
 * partir de `VISIBLE` sesiones la gráfica se desplaza en horizontal (arranca en
 * la última) con el eje vertical fijo a la izquierda. Eje vertical en enteros
 * (`niceTicks`), con una columna que mide lo que su etiqueta más larga.
 */
import { useRef, useState } from 'react';
import { View, ScrollView, Pressable, StyleSheet } from 'react-native';
import Reanimated, { FadeIn } from 'react-native-reanimated';
import Svg, { Path, Line, Circle, Text as SvgText } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { Text } from '../ui/Text';
import { spacing, textStyles } from '../../theme';
import { useTheme, useThemedStyles } from '../../useTheme';
import { niceTicks, tickLabel } from '../../utils/chartTicks';

const H        = 150;
const PAD_TOP  = 8;
const PAD_BOT  = 22;   // fechas
const EDGE     = 22;   // aire a los lados: la fecha del primer y el último punto va centrada en él
const VISIBLE  = 10;   // con más sesiones, scroll horizontal
const LABEL_GAP = 56;  // separación mínima entre fechas
const CHAR_W   = 7;    // ancho de una cifra a 11px, para medir la columna del eje

export default function ProgressChart({ points, selected = null, onSelect, lockRef, emptyText }) {
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { i18n } = useTranslation();
  const [w, setW] = useState(0);
  const scrollRef = useRef(null);

  if (points.length < 2) {
    return <Text style={styles.empty}>{emptyText}</Text>;
  }

  const n     = points.length;
  const vals  = points.map((p) => p.value);
  const ticks = niceTicks(Math.min(...vals), Math.max(...vals));
  const lo = ticks[0];
  const hi = ticks[ticks.length - 1];
  const axisW  = Math.max(...ticks.map((v) => tickLabel(v).length)) * CHAR_W + spacing.sm;
  const viewW  = Math.max(0, w - axisW);
  const scroll = n > VISIBLE;
  const step   = (viewW - 2 * EDGE) / ((scroll ? VISIBLE : n) - 1);
  const plotW  = scroll ? 2 * EDGE + step * (n - 1) : viewW;
  const bot    = H - PAD_BOT;
  const x = (i) => EDGE + i * step;
  const y = (v) => bot - ((v - lo) / (hi - lo || 1)) * (bot - PAD_TOP);
  const pts = points.map((p, i) => ({ x: x(i), y: y(p.value) }));
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join('');

  // Una fecha cada `every` puntos, contando desde el último (que siempre la lleva).
  const every = Math.max(1, Math.ceil(LABEL_GAP / step));
  const fmtDay = (t) => new Date(t)
    .toLocaleDateString(i18n.language === 'en' ? 'en-GB' : 'es-ES', { day: 'numeric', month: 'short' })
    .replace('.', '');

  const mark = selected ?? n - 1;
  const font = { fontFamily: textStyles.micro.fontFamily, fontSize: textStyles.micro.fontSize };

  const plot = (
    <View style={{ width: plotW, height: H }}>
      <Svg width={plotW} height={H}>
        {ticks.map((v) => (
          <Line key={v} x1={0} x2={plotW} y1={y(v)} y2={y(v)} stroke={th.colors.surface2} strokeWidth={1} />
        ))}
        {selected != null && (
          <Line x1={pts[mark].x} x2={pts[mark].x} y1={PAD_TOP} y2={bot} stroke={th.colors.muted} strokeWidth={1} />
        )}
        <Path d={line} fill="none" stroke={th.colors.accent} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {pts.map((p, i) => (i === mark ? null : (
          <Circle key={i} cx={p.x} cy={p.y} r={3} fill={th.colors.surface} stroke={th.colors.accent} strokeWidth={1.5} />
        )))}
        <Circle cx={pts[mark].x} cy={pts[mark].y} r={5} fill={th.colors.accent} stroke={th.colors.surface} strokeWidth={2} />
        {points.map((p, i) => ((n - 1 - i) % every === 0 ? (
          <SvgText
            key={`d${i}`} x={pts[i].x} y={H - 4} textAnchor="middle"
            fill={i === mark ? th.colors.text : th.colors.mutedLight} {...font}
          >
            {fmtDay(p.t)}
          </SvgText>
        ) : null))}
      </Svg>
      {/* Tocar lee el punto más cercano; un arrastre no lo dispara (es el scroll). */}
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={(e) => {
          const i = Math.max(0, Math.min(n - 1, Math.round((e.nativeEvent.locationX - EDGE) / step)));
          onSelect?.(i === selected ? null : i);
        }}
      />
    </View>
  );

  return (
    <View
      style={styles.row}
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      onTouchStart={() => { if (lockRef) lockRef.current = true; }}
      onTouchEnd={() => { if (lockRef) lockRef.current = false; }}
      onTouchCancel={() => { if (lockRef) lockRef.current = false; }}
    >
      {w > 0 && (
        <>
          <Svg width={axisW} height={H}>
            {ticks.map((v) => (
              <SvgText key={v} x={axisW - spacing.sm} y={y(v) + 4} textAnchor="end" fill={th.colors.mutedLight} {...font}>
                {tickLabel(v)}
              </SvgText>
            ))}
          </Svg>
          <Reanimated.View entering={FadeIn.duration(220)} style={{ width: viewW }}>
            {scroll ? (
              <ScrollView
                ref={scrollRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                nestedScrollEnabled
                onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
              >
                {plot}
              </ScrollView>
            ) : plot}
          </Reanimated.View>
        </>
      )}
    </View>
  );
}

const makeStyles = (th) => StyleSheet.create({
  row:   { flexDirection: 'row', height: H },
  empty: { ...textStyles.label, color: th.colors.mutedLight, textAlign: 'center', paddingVertical: spacing.xl },
});
