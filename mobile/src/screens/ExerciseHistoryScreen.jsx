/**
 * ExerciseHistoryScreen — historial completo de un ejercicio.
 *
 * Recibe { exerciseId } como param de navegación.
 * Muestra: filtros de período, nº sesiones + PR (filtrado), gráfica, tabla completa.
 * Las filas donde se alcanzó el PR all-time quedan marcadas.
 */
import { useState, useRef, useMemo, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Animated,
} from 'react-native';
import Svg, { G, Circle, Line, Rect, Text as SvgText } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../store/useStore';
import { useWeightUnit } from '../hooks/useWeightUnit';
import { colors, spacing, typography, radius, borders, withOpacity } from '../theme';
import { formatDate } from '../../../src/utils/formatters';
import { summarizeSets } from '../../../src/utils/progression';

// ── Chart constants ────────────────────────────────────────────────────────────

const CHART_H      = 128;
const PAD_TOP      = 12;
const PAD_BOT      = 24;
const Y_AXIS_W     = 32;
const C_PAD_L      = 6;
const C_PAD_R      = 12;
const MIN_SCROLL   = 6;
const STEP_PX      = 52;
const Y_ANIM_COUNT = 80;

const AnimatedLine   = Animated.createAnimatedComponent(Line);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const PERIOD_OPTIONS = [
  { id: '1m',  label: '1M'  },
  { id: '3m',  label: '3M'  },
  { id: 'all', label: 'Todo' },
];

// ── Pure helpers ───────────────────────────────────────────────────────────────

function computeValue(sets, metricId) {
  const done = sets?.filter((s) => s.done || s.weight || s.reps || s.time) ?? [];
  if (!done.length) return null;
  if (metricId === 'time') {
    const ts = done.map((s) => parseFloat(s.time) || 0).filter(Boolean);
    return ts.length ? Math.max(...ts) : null;
  }
  if (metricId === 'kg') {
    const v = Math.max(...done.map((s) => parseFloat(s.weight) || 0));
    return v > 0 ? v : null;
  }
  if (metricId === 'reps') {
    const v = done.reduce((a, s) => a + (parseInt(s.reps) || 0), 0);
    return v > 0 ? v : null;
  }
  if (metricId === 'vol') {
    const v = done.reduce(
      (a, s) => a + (parseFloat(s.weight) || 0) * (parseInt(s.reps) || 0), 0
    );
    return v > 0 ? Math.round(v) : null;
  }
  return null;
}

function getMetrics(def, allLogs, weightLabel) {
  const model = def?.progressionModel;
  if (model === 'time_progression') return [{ id: 'time', label: 'Seg' }];
  if (model === 'submax')           return [{ id: 'reps', label: 'Reps' }];
  const hasWeight = allLogs.some(({ exercise }) =>
    exercise?.sets?.some((s) => parseFloat(s.weight) > 0)
  );
  const m = [{ id: 'reps', label: 'Reps' }];
  if (hasWeight) {
    m.unshift({ id: 'kg', label: weightLabel?.toUpperCase() ?? 'KG' });
    m.push({ id: 'vol', label: 'Vol' });
  }
  return m;
}

function fmtAxisVal(v) {
  if (v >= 1000) return `${Math.round(v / 100) / 10}k`;
  if (v >= 100)  return String(Math.round(v));
  return v % 1 === 0 ? String(v) : String(Math.round(v * 10) / 10);
}

// ── MiniLineChart ──────────────────────────────────────────────────────────────

function MiniLineChart({ data, metricLabel }) {
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
      <View style={chart.empty}>
        <Text style={chart.emptyText}>
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

  const valueText = selected ? `${fmtAxisVal(selected.value)}${metricLabel ? ` ${metricLabel}` : ''}` : '';
  const dateText  = selected ? selected.date : '';
  const TW        = Math.max(56, Math.ceil(Math.max(dateText.length * 4.5, valueText.length * 6.5) + 20));
  const TH        = 36;
  const tooltipX  = selected
    ? (needsScroll
        ? selected.x
        : Math.min(Math.max(selected.x, TW / 2 + 2), chartW - TW / 2 - 2))
    : 0;
  const tooltipY     = selected ? (selected.y - TH - 14 >= PAD_TOP ? selected.y - TH - 14 : selected.y + 14) : 0;
  const dateStartX   = tooltipX - (dateText.length  * 4.5)  / 2;
  const valueStartX  = tooltipX - (valueText.length * 6.5) / 2;

  useEffect(() => { // eslint-disable-line react-hooks/exhaustive-deps
    if (!chartW || !pts.length) return;
    const sameCount = pts.length === prevLenRef.current;
    prevLenRef.current = pts.length;
    if (!initRef.current) {
      pts.forEach((p, i) => yAnims[i].setValue(p.y));
      initRef.current = true;
    } else if (sameCount) {
      Animated.parallel(
        pts.map((p, i) =>
          Animated.timing(yAnims[i], { toValue: p.y, duration: 500, useNativeDriver: false })
        )
      ).start();
    } else {
      pts.forEach((p, i) => yAnims[i].setValue(p.y));
      const startW = needsScroll ? svgW - chartW : 0;
      clipWidthAnim.setValue(startW);
      Animated.timing(clipWidthAnim, { toValue: svgW, duration: 700, useNativeDriver: false }).start();
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
    <View style={chart.row}>
      <View style={[chart.yAxis, { height: CHART_H }]}>
        {yTicks.map(({ v, y }, i) => (
          <Text key={i} style={[chart.yLabel, { top: y - 4 }]}>
            {fmtAxisVal(v)}
          </Text>
        ))}
      </View>
      <View
        style={chart.area}
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

// ── Screen ─────────────────────────────────────────────────────────────────────

export default function ExerciseHistoryScreen() {
  const insets     = useSafeAreaInsets();
  const navigation = useNavigation();
  const { params } = useRoute();
  const { i18n }   = useTranslation();
  const { label: weightLabel, toDisplay: wDisplay, fmt: fmtWeight } = useWeightUnit();

  const exerciseId   = params?.exerciseId;
  const workoutLog   = useStore((s) => s.workoutLog);
  const exerciseLib  = useStore((s) => s.exerciseLibrary);
  const customEx     = useStore((s) => s.customExercises);
  const allExercises = { ...exerciseLib, ...customEx };
  const def          = allExercises[exerciseId];

  const [period,      setPeriod]      = useState('all');
  const [chartMetric, setChartMetric] = useState(null);

  const name = def
    ? (i18n.language === 'en' ? (def.nameEn ?? def.name) : def.name)
    : (exerciseId ?? '—');

  // All sessions — oldest first (for chart), newest first (for table)
  const allLogsFwd = useMemo(() => (
    workoutLog
      .filter((log) =>
        log.exercises.some(
          (e) => e.exerciseId === exerciseId &&
                 e.sets.some((s) => s.done || s.weight || s.reps || s.time)
        )
      )
      .sort((a, b) => a.timestamp - b.timestamp)  // oldest first
      .map((log) => ({
        timestamp: log.timestamp,
        exercise:  log.exercises.find((e) => e.exerciseId === exerciseId),
      }))
  ), [workoutLog, exerciseId]);

  // Period-filtered (oldest first — used for chart)
  const periodLogsFwd = useMemo(() => {
    if (period === 'all') return allLogsFwd;
    const days   = period === '1m' ? 30 : 90;
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    return allLogsFwd.filter(({ timestamp }) => timestamp >= cutoff);
  }, [allLogsFwd, period]);

  // Newest-first for the table
  const periodLogsRev = useMemo(() => [...periodLogsFwd].reverse(), [periodLogsFwd]);

  // Metric selector
  const metrics      = useMemo(() => getMetrics(def, allLogsFwd, weightLabel), [def, allLogsFwd, weightLabel]);
  const activeMetric = chartMetric ?? metrics[0]?.id;
  const metricLabel  = metrics.find((m) => m.id === activeMetric)?.label ?? '';

  // Chart data (oldest first, display-unit converted)
  const chartData = useMemo(() => {
    const needsConv = activeMetric === 'kg' || activeMetric === 'vol';
    return periodLogsFwd
      .map(({ timestamp, exercise }) => {
        const raw   = computeValue(exercise?.sets, activeMetric);
        const value = raw !== null && needsConv
          ? (activeMetric === 'kg'
              ? wDisplay(raw)
              : Math.round(wDisplay(1) * raw * 10) / 10)
          : raw;
        return {
          date:  new Date(timestamp).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }),
          value,
        };
      })
      .filter((d) => d.value !== null);
  }, [periodLogsFwd, activeMetric, wDisplay]);

  // PR — all-time, for marking rows
  const model    = def?.progressionModel;
  const prMetric = model === 'time_progression' ? 'time' : model === 'submax' ? 'reps' : 'kg';
  const allTimePrValue = useMemo(() => {
    const vals = allLogsFwd.map(({ exercise }) => computeValue(exercise?.sets, prMetric) ?? 0);
    return vals.length ? Math.max(...vals) : 0;
  }, [allLogsFwd, prMetric]);

  // Period-filtered PR label + count
  const periodPr = useMemo(() => {
    const max = Math.max(
      0,
      ...periodLogsFwd.map(({ exercise }) => computeValue(exercise?.sets, prMetric) ?? 0)
    );
    if (max <= 0) return null;
    if (prMetric === 'time') return `PR ${max}s`;
    return `PR ${fmtWeight(max)}`;
  }, [periodLogsFwd, prMetric, fmtWeight]);

  const sessionCount = periodLogsFwd.length;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12} style={styles.backBtn}>
          <Text style={styles.backIcon}>{'‹'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{name}</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: spacing.xxl + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Period filter ── */}
        <View style={styles.periodRow}>
          {PERIOD_OPTIONS.map(({ id, label }) => (
            <TouchableOpacity
              key={id}
              style={[styles.periodBtn, period === id && styles.periodBtnActive]}
              onPress={() => setPeriod(id)}
            >
              <Text style={[styles.periodBtnText, period === id && styles.periodBtnTextActive]}>
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Meta (period-filtered) ── */}
        <View style={styles.meta}>
          <Text style={styles.metaText}>
            {`${sessionCount} ${sessionCount === 1 ? 'sesión' : 'sesiones'}${periodPr ? `  ·  ${periodPr}` : ''}`}
          </Text>
        </View>

        {/* ── Chart ── */}
        <View style={styles.chartCard}>
          {/* Metric selector */}
          {metrics.length > 1 && (
            <View style={styles.metricRow}>
              {metrics.map(({ id, label }) => (
                <TouchableOpacity
                  key={id}
                  style={[styles.metricBtn, activeMetric === id && styles.metricBtnActive]}
                  onPress={() => setChartMetric(id)}
                >
                  <Text style={[styles.metricBtnText, activeMetric === id && styles.metricBtnTextActive]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          <MiniLineChart data={chartData} metricLabel={metricLabel} />
        </View>

        {/* ── Session table ── */}
        <View style={styles.table}>
          {periodLogsRev.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>{'No hay datos en este período.'}</Text>
            </View>
          ) : (
            periodLogsRev.map(({ timestamp, exercise }) => {
              const done = exercise?.sets?.filter(
                (s) => s.done || s.weight || s.reps || s.time
              ) ?? [];
              if (!done.length) return null;

              const sessionVal = computeValue(done, prMetric) ?? 0;
              const isPR = allTimePrValue > 0 && sessionVal >= allTimePrValue;

              return (
                <View key={timestamp} style={styles.row}>
                  <View style={styles.rowLeft}>
                    <Text style={styles.rowDate}>{formatDate(timestamp)}</Text>
                    {isPR && (
                      <View style={styles.prBadge}>
                        <Text style={styles.prBadgeText}>{'PR'}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.rowSets}>{summarizeSets(def, done, fmtWeight)}</Text>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex:            1,
    backgroundColor: colors.bg,
  },

  // Header
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.sm,
    borderBottomWidth: borders.thin,
    borderBottomColor: colors.border,
  },
  backBtn:     { width: 36, alignItems: 'center' },
  backIcon:    { fontSize: 28, color: colors.muted, lineHeight: 32 },
  headerTitle: {
    flex:       1,
    textAlign:  'center',
    fontSize:   typography.base,
    fontWeight: typography.heavy,
    color:      colors.text,
  },
  headerRight: { width: 36 },

  scroll: {
    paddingTop: spacing.md,
    gap:        spacing.md,
  },

  // Period filter
  periodRow: {
    flexDirection:     'row',
    gap:               spacing.xs,
    paddingHorizontal: spacing.xl,
  },
  periodBtn: {
    paddingVertical:   4,
    paddingHorizontal: spacing.sm,
    borderRadius:      5,
    borderWidth:       borders.thin,
    borderColor:       colors.border,
    backgroundColor:   colors.surface2,
  },
  periodBtnActive: {
    backgroundColor: withOpacity(colors.accent, 0.08),
    borderColor:     withOpacity(colors.accent, 0.3),
  },
  periodBtnText:       { fontSize: typography.xs, color: colors.muted, fontWeight: typography.medium },
  periodBtnTextActive: { color: colors.accent },

  // Meta (count + PR)
  meta: { paddingHorizontal: spacing.xl },
  metaText: { fontSize: typography.sm, color: colors.muted },

  // Chart card
  chartCard: {
    marginHorizontal: spacing.xl,
    backgroundColor:  colors.surface,
    borderWidth:      borders.thin,
    borderColor:      colors.borderCard,
    borderRadius:     radius.md,
    overflow:         'hidden',
    paddingTop:       spacing.sm,
  },
  metricRow: {
    flexDirection:     'row',
    gap:               spacing.xs,
    paddingHorizontal: spacing.md,
    paddingBottom:     spacing.xs,
  },
  metricBtn: {
    paddingVertical:   4,
    paddingHorizontal: spacing.sm,
    borderRadius:      5,
    borderWidth:       borders.thin,
    borderColor:       colors.border,
    backgroundColor:   colors.surface2,
  },
  metricBtnActive: {
    backgroundColor: withOpacity(colors.accent, 0.08),
    borderColor:     withOpacity(colors.accent, 0.3),
  },
  metricBtnText:       { fontSize: typography.xs, color: colors.muted, fontWeight: typography.medium },
  metricBtnTextActive: { color: colors.accent },

  // Table
  table: {
    marginHorizontal: spacing.xl,
    backgroundColor:  colors.surface,
    borderWidth:      borders.thin,
    borderColor:      colors.borderCard,
    borderRadius:     radius.md,
    overflow:         'hidden',
  },
  row: {
    flexDirection:     'row',
    justifyContent:    'space-between',
    alignItems:        'center',
    paddingVertical:   spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: borders.thin,
    borderBottomColor: colors.border,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.xs,
  },
  rowDate: { fontSize: typography.sm, color: colors.muted },
  prBadge: {
    backgroundColor: withOpacity(colors.accent, 0.12),
    borderWidth:     borders.thin,
    borderColor:     withOpacity(colors.accent, 0.4),
    borderRadius:    3,
    paddingHorizontal: 5,
    paddingVertical:   1,
  },
  prBadgeText: {
    fontSize:      8,
    fontWeight:    typography.bold,
    color:         colors.accent,
    letterSpacing: 0.5,
  },
  rowSets: {
    fontSize:   typography.sm,
    fontWeight: typography.medium,
    color:      colors.text,
    textAlign:  'right',
    flexShrink: 1,
    marginLeft: spacing.sm,
  },

  // Empty state
  empty:     { padding: spacing.xl, alignItems: 'center' },
  emptyText: { fontSize: typography.sm, color: colors.muted, textAlign: 'center' },
});

// ── Chart styles ───────────────────────────────────────────────────────────────

const chart = StyleSheet.create({
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
