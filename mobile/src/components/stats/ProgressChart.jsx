/**
 * ProgressChart — la gráfica de la progresión de un ejercicio.
 *
 *   points    [{ t, value }]   ordenados por fecha, ya en la unidad que se pinta
 *   selected  índice del punto que se está leyendo, o null
 *   onScrub   (i | null) — arrastrar el dedo recorre los puntos; al soltar, null
 *   lockRef   ref que se pone a true mientras el dedo está sobre la gráfica:
 *             quien la contiene no debe tomar el gesto (deslizar entre ejercicios)
 *
 * La cifra del punto no se pinta aquí: la pone la pantalla en grande encima. La
 * gráfica solo marca el punto con una guía vertical.
 *
 * Horizontal por FECHA, no por orden: dos semanas sin entrenar se ven como un
 * hueco. Como mucho cuatro fechas en el eje, nunca una por punto. Eje vertical
 * en enteros (`niceTicks`), con una columna que mide lo que su etiqueta más
 * larga: caben cuatro cifras sin recortar.
 */
import { useRef, useState, useEffect } from 'react';
import { View, PanResponder, StyleSheet } from 'react-native';
import Reanimated, { FadeIn } from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Stop, Path, Line, Circle, Text as SvgText } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { Text } from '../ui/Text';
import { spacing, textStyles } from '../../theme';
import { useTheme, useThemedStyles } from '../../useTheme';
import { niceTicks, tickLabel } from '../../utils/chartTicks';

const H        = 180;
const PAD_TOP  = 8;
const PAD_BOT  = 22;   // fechas
const PAD_R    = 6;    // el punto final (r 5) no se corta
const CHAR_W   = 7;    // ancho de una cifra a 11px, para medir la columna del eje
const MAX_DOTS = 16;   // con más, solo la línea

// Dónde cae cada cosa para un ancho dado; null si no hay serie que pintar.
function geometry(points, w) {
  if (points.length < 2) return null;
  const vals  = points.map((p) => p.value);
  const ticks = niceTicks(Math.min(...vals), Math.max(...vals));
  const lo = ticks[0];
  const hi = ticks[ticks.length - 1];
  const left  = Math.max(...ticks.map((v) => tickLabel(v).length)) * CHAR_W + spacing.sm2;
  const right = Math.max(left + 1, w - PAD_R);
  const bot   = H - PAD_BOT;
  const t0 = points[0].t;
  const t1 = points[points.length - 1].t;
  const x = (t) => (t1 === t0 ? (left + right) / 2 : left + ((t - t0) / (t1 - t0)) * (right - left));
  const y = (v) => bot - ((v - lo) / (hi - lo || 1)) * (bot - PAD_TOP);
  const pts = points.map((p) => ({ x: x(p.t), y: y(p.value) }));
  return { ticks, lo, left, right, bot, t0, t1, x, y, pts };
}

export default function ProgressChart({ points, selected = null, onScrub, lockRef, emptyText }) {
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { i18n } = useTranslation();
  const [w, setW] = useState(0);
  const geo = geometry(points, w);

  const viewRef  = useRef(null);
  const originX  = useRef(null);
  const active   = useRef(false);
  const dragged  = useRef(false);
  const live     = useRef({});
  useEffect(() => { live.current = { onScrub, lockRef, selected, xs: geo?.pts.map((p) => p.x) ?? [] }; });

  // El gesto lee `live` al tocar, no al pintar: el lint no lo distingue (mismo
  // caso que el PanResponder de ScrubDemo).
  /* eslint-disable react-hooks/refs */
  const pick = (pageX) => {
    if (!active.current || originX.current == null) return;
    const x = pageX - originX.current;
    const xs = live.current.xs;
    if (!xs.length) return;
    let best = 0;
    xs.forEach((px, i) => { if (Math.abs(px - x) < Math.abs(xs[best] - x)) best = i; });
    if (best !== live.current.selected) {
      live.current.selected = best;
      Haptics.selectionAsync().catch(() => {});
      live.current.onScrub?.(best);
    }
  };
  const end = () => {
    active.current = false;
    originX.current = null;
    if (live.current.lockRef) live.current.lockRef.current = false;
    live.current.onScrub?.(null);
  };
  // En estado y no en ref: así sus `panHandlers` se pueden leer al pintar.
  const [pan] = useState(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderGrant: (_, gs) => {
      active.current = true;
      dragged.current = false;
      if (live.current.lockRef) live.current.lockRef.current = true;
      const x0 = gs.x0;
      viewRef.current?.measure((_x, _y, _w, _h, pageX) => {
        if (!active.current) return;   // se soltó antes de que llegara la medida
        originX.current = pageX;
        pick(x0);
      });
    },
    onPanResponderMove: (_, gs) => {
      if (Math.abs(gs.dx) > 6) dragged.current = true;
      pick(gs.moveX);
    },
    // Un arrastre vertical que empieza aquí es el scroll de la pantalla: se cede
    // mientras no se haya empezado a recorrer la gráfica.
    onPanResponderTerminationRequest: () => !dragged.current,
    onPanResponderRelease: end,
    onPanResponderTerminate: end,
  }));

  /* eslint-enable react-hooks/refs */

  if (!geo) {
    return <Text style={styles.empty}>{emptyText}</Text>;
  }

  const { ticks, lo, left, right, bot, t0, t1, x, y, pts } = geo;
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join('');
  const area = `${line}L${pts[pts.length - 1].x.toFixed(1)},${bot}L${pts[0].x.toFixed(1)},${bot}Z`;

  const fmtDay = (t) => new Date(t)
    .toLocaleDateString(i18n.language === 'en' ? 'en-GB' : 'es-ES', { day: 'numeric', month: 'short' })
    .replace('.', '');
  const nx = Math.min(4, points.length);
  const dates = Array.from({ length: nx }, (_, k) => {
    const t = t0 + (k * (t1 - t0)) / (nx - 1);
    return { t, anchor: k === 0 ? 'start' : k === nx - 1 ? 'end' : 'middle' };
  });

  const sel  = selected != null ? pts[selected] : null;
  const last = pts[pts.length - 1];
  const font = { fontFamily: textStyles.micro.fontFamily, fontSize: textStyles.micro.fontSize };

  return (
    <View ref={viewRef} style={styles.box} onLayout={(e) => setW(e.nativeEvent.layout.width)} {...pan.panHandlers}>
      {w > 0 && (
        <Reanimated.View entering={FadeIn.duration(220)}>
          <Svg width={w} height={H}>
            <Defs>
              <LinearGradient id="progressFill" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={th.colors.accent} stopOpacity={0.28} />
                <Stop offset="1" stopColor={th.colors.accent} stopOpacity={0} />
              </LinearGradient>
            </Defs>

            {ticks.map((v) => (
              <Line
                key={`g${v}`} x1={left} x2={right} y1={y(v)} y2={y(v)}
                stroke={th.colors.border} strokeWidth={1}
                strokeDasharray={v === lo ? undefined : '2 4'}
              />
            ))}
            {ticks.map((v) => (
              <SvgText key={`l${v}`} x={left - spacing.sm2} y={y(v) + 4} textAnchor="end" fill={th.colors.mutedLight} {...font}>
                {tickLabel(v)}
              </SvgText>
            ))}

            <Path d={area} fill="url(#progressFill)" />
            <Path d={line} fill="none" stroke={th.colors.accent} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />

            {pts.length <= MAX_DOTS && pts.map((p, i) => (
              <Circle key={i} cx={p.x} cy={p.y} r={2.5} fill={th.colors.bg} stroke={th.colors.accent} strokeWidth={1.5} />
            ))}

            {sel ? (
              <>
                <Line x1={sel.x} x2={sel.x} y1={PAD_TOP} y2={bot} stroke={th.colors.mutedLight} strokeWidth={1} />
                <Circle cx={sel.x} cy={sel.y} r={6} fill={th.colors.accent} stroke={th.colors.bg} strokeWidth={2.5} />
              </>
            ) : (
              <Circle cx={last.x} cy={last.y} r={5} fill={th.colors.accent} stroke={th.colors.bg} strokeWidth={2} />
            )}

            {dates.map(({ t, anchor }) => (
              <SvgText key={`d${t}`} x={x(t)} y={H - 4} textAnchor={anchor} fill={th.colors.mutedLight} {...font}>
                {fmtDay(t)}
              </SvgText>
            ))}
          </Svg>
        </Reanimated.View>
      )}
    </View>
  );
}

const makeStyles = (th) => StyleSheet.create({
  box:   { height: H },
  empty: { ...textStyles.label, color: th.colors.mutedLight, textAlign: 'center', paddingVertical: spacing.xl },
});
