/**
 * MiniLineChart — animated line chart for exercise history.
 *
 * Props:
 *   data:        { date: string, value: number }[]   oldest → newest
 *   metricLabel: string                              unit shown in tooltip (e.g. "KG", "Reps")
 */
import { useState, useRef, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, Animated } from 'react-native';
import Svg, { G, Circle, Line, Rect, Text as SvgText } from 'react-native-svg';

import { colors, spacing, typography } from '../../theme';

// ── Constants ─────────────────────────────────────────────────────────────────

const CHART_H      = 128;
const Y_AXIS_W     = 32;
const PAD_TOP      = 12;
const PAD_BOT      = 24;
const C_PAD_L      = 6;
const C_PAD_R      = 12;
const MIN_SCROLL   = 6;
const STEP_PX      = 52;
const Y_ANIM_COUNT = 80;

const AnimatedLine   = Animated.createAnimatedComponent(Line);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtAxisVal(v) {
  if (v >= 1000) return `${Math.round(v / 100) / 10}k`;
  if (v >= 100)  return String(Math.round(v));
  return v % 1 === 0 ? String(v) : String(Math.round(v * 10) / 10);
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function MiniLineChart({ data, metricLabel }) {
  const [chartW,   setChartW]   = useState(0);
  const [selected, setSelected] = useState(null);

  const scrollRef     = useRef(null);
  const clipWidthAnim = useRef(new Animated.Value(0)).current;
  const yAnims = useRef(
    Array.from({ length: Y_ANIM_COUNT }, () => new Animated.Value(0))
  ).current;
  const prevLenRef = useRef(0);
  const initRef    = useRef(false);

  useEffect(() => { setSelected(null); }, [data]);

  if (data.length < 2) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>
          {'Necesitas al menos 2 sesiones en este período.'}
        </Text>
      </View>
    );
  }

  const needsScroll = data.length > MIN_SCROLL;
  const plotH       = CHART_H - PAD_TOP - PAD_BOT;
  const plotW       = needsScroll
    ? (data.length - 1) * STEP_PX
    : Math.max(1, chartW - C_PAD_L - C_PAD_R);
  const svgW        = C_PAD_L + plotW + C_PAD_R;

  const values = data.map((d) => d.value);
  const minV   = Math.min(...values);
  const maxV   = Math.max(...values);
  const range  = maxV - minV || 1;

  const toX = (i) => C_PAD_L + (i / Math.max(1, data.length - 1)) * plotW;
  const toY = (v) => PAD_TOP  + plotH - ((v - minV) / range) * plotH;

  const pts = data.map((d, i) => ({
    i, x: toX(i), y: toY(d.value), date: d.date, value: d.value,
  }));

  const yTicks = range === 0
    ? [{ v: minV, y: toY(minV) }]
    : [0, 1, 2, 3].map((k) => {
        const v = minV + (range / 3) * k;
        return { v: Math.round(v * 10) / 10, y: toY(v) };
      });

  const valueText  = selected ? `${fmtAxisVal(selected.value)}${metricLabel ? ` ${metricLabel}` : ''}` : '';
  const dateText   = selected ? selected.date : '';
  const TW         = Math.max(56, Math.ceil(Math.max(dateText.length * 4.5, valueText.length * 6.5) + 20));
  const TH         = 36;
  const tooltipX   = selected
    ? (needsScroll
        ? selected.x
        : Math.min(Math.max(selected.x, TW / 2 + 2), chartW - TW / 2 - 2))
    : 0;
  const tooltipY    = selected ? (selected.y - TH - 14 >= PAD_TOP ? selected.y - TH - 14 : selected.y + 14) : 0;
  const dateStartX  = tooltipX - (dateText.length  * 4.5)  / 2;
  const valueStartX = tooltipX - (valueText.length * 6.5) / 2;

  const prevRangeRef = useRef(null);

  useEffect(() => { // eslint-disable-line react-hooks/exhaustive-deps
    if (!chartW || !pts.length) return;

    const sameCount   = pts.length === prevLenRef.current;
    const prevRange   = prevRangeRef.current;
    // Scale changed: switching metric (Kg→Reps etc.) — animate positions would
    // look jarring because the coordinate systems are completely different.
    // Instead snap positions instantly and play a clip-reveal.
    const scaleChange = prevRange !== null && range > 0 && prevRange > 0
      && Math.abs(range - prevRange) / Math.max(range, prevRange) > 0.4;

    prevLenRef.current  = pts.length;
    prevRangeRef.current = range;

    if (!initRef.current) {
      // First render — set positions silently, clip-reveal will play via chartW effect
      pts.forEach((p, i) => yAnims[i].setValue(p.y));
      initRef.current = true;
    } else if (sameCount && !scaleChange) {
      // Same metric, new session added — animate Y positions (same scale, looks good)
      Animated.parallel(
        pts.map((p, i) =>
          Animated.timing(yAnims[i], { toValue: p.y, duration: 500, useNativeDriver: false })
        )
      ).start();
    } else {
      // Metric changed (or count changed) — snap positions, do clip-reveal
      pts.forEach((p, i) => yAnims[i].setValue(p.y));
      const startW = needsScroll ? svgW - chartW : 0;
      clipWidthAnim.setValue(startW);
      Animated.timing(clipWidthAnim, { toValue: svgW, duration: 600, useNativeDriver: false }).start();
    }
  }, [data, chartW]); // eslint-disable-line

  useEffect(() => { // eslint-disable-line react-hooks/exhaustive-deps
    if (!chartW) return;
    const startW = needsScroll ? svgW - chartW : 0;
    clipWidthAnim.setValue(startW);
    Animated.timing(clipWidthAnim, { toValue: svgW, duration: 900, useNativeDriver: false }).start();
  }, [chartW]); // eslint-disable-line

  const handlePress = (e) => {
    const { locationX, locationY } = e.nativeEvent;
    const hit = pts.find((p) => Math.hypot(p.x - locationX, p.y - locationY) < 22);
    setSelected(hit && hit.i !== selected?.i ? hit : null);
  };

  return (
    <View style={styles.row}>
      <View style={[styles.yAxis, { height: CHART_H }]}>
        {yTicks.map(({ v, y }, i) => (
          <Text key={i} style={[styles.yLabel, { top: y - 4 }]}>
            {fmtAxisVal(v)}
          </Text>
        ))}
      </View>
      <View
        style={styles.area}
        onLayout={(e) => setChartW(e.nativeEvent.layout.width)}
      >
        {chartW > 0 && (
          <ScrollView
            ref={scrollRef}
            horizontal
            scrollEnabled={needsScroll}
            showsHorizontalScrollIndicator={false}
            nestedScrollEnabled
            contentOffset={needsScroll ? { x: Math.max(0, svgW - chartW), y: 0 } : undefined}
          >
            <View style={{ width: svgW, height: CHART_H }}>
              <Animated.View
                pointerEvents="none"
                style={{ position: 'absolute', top: 0, left: 0, height: CHART_H, width: clipWidthAnim, overflow: 'hidden' }}
              >
                <Svg width={svgW} height={CHART_H}>
                  {pts.slice(1).map((_, segI) => (
                    <AnimatedLine
                      key={segI}
                      x1={pts[segI].x}     y1={yAnims[segI]}
                      x2={pts[segI + 1].x} y2={yAnims[segI + 1]}
                      stroke={colors.accent}
                      strokeWidth={1.5}
                    />
                  ))}
                  {pts.map((p, i) => {
                    const isSel = selected?.i === i;
                    return (
                      <AnimatedCircle
                        key={i}
                        cx={p.x} cy={yAnims[i]}
                        r={isSel ? 6 : 4}
                        fill={colors.accent}
                        stroke={isSel ? colors.bg : 'none'}
                        strokeWidth={isSel ? 2 : 0}
                      />
                    );
                  })}
                </Svg>
              </Animated.View>
              <Svg
                style={StyleSheet.absoluteFill}
                width={svgW}
                height={CHART_H}
                onPress={handlePress}
              >
                {pts.map((p) => {
                  const anchor = p.i === 0 ? 'start' : p.i === pts.length - 1 ? 'end' : 'middle';
                  return (
                    <SvgText key={p.i} x={p.x} y={CHART_H - 4} fontSize={8} fill={colors.muted} textAnchor={anchor}>
                      {p.date}
                    </SvgText>
                  );
                })}
                {selected && (
                  <G>
                    <Rect
                      x={tooltipX - TW / 2} y={tooltipY}
                      width={TW} height={TH}
                      fill={colors.surface2} stroke={colors.border} strokeWidth={1} rx={4}
                    />
                    <SvgText x={dateStartX} y={tooltipY + 13} fontSize={8} fill={colors.muted} textAnchor="start">
                      {selected.date}
                    </SvgText>
                    <SvgText x={valueStartX} y={tooltipY + 28} fontSize={11} fill={colors.accent} textAnchor="start">
                      {`${fmtAxisVal(selected.value)}${metricLabel ? ` ${metricLabel}` : ''}`}
                    </SvgText>
                  </G>
                )}
              </Svg>
            </View>
          </ScrollView>
        )}
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  row:  { flexDirection: 'row', alignItems: 'flex-start', paddingBottom: spacing.sm },
  yAxis: { width: Y_AXIS_W },
  yLabel: {
    position:   'absolute',
    right:      4,
    fontSize:   8,
    color:      colors.muted,
    textAlign:  'right',
    width:      Y_AXIS_W - 4,
    lineHeight: 10,
  },
  area: {
    flex:      1,
    minHeight: CHART_H,
    overflow:  'hidden',
  },
  empty: {
    paddingVertical: spacing.lg,
    alignItems:      'center',
    paddingLeft:     Y_AXIS_W,
  },
  emptyText: { fontSize: typography.xs, color: colors.muted, textAlign: 'center' },
});
