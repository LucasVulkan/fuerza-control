/**
 * StatsScreen — progreso por ejercicio.
 * Port fiel de StatsView + ExerciseStatCard (web).
 *
 * Arquitectura de la gráfica:
 *   [Eje Y fijo] | [ScrollView horizontal → SVG]
 *   El tap se resuelve con un único onPress en Svg + Math.hypot sobre los puntos,
 *   evitando los problemas de propagación de G/Circle dentro de un ScrollView.
 */

import { useState, useRef, useMemo, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Svg, { G, Circle, Line, Rect, Text as SvgText } from 'react-native-svg';

// Componentes SVG animados — creados una sola vez a nivel de módulo.
// Animated.View (overflow:hidden) es el clip; AnimatedLine/Circle para la transición Y.
const AnimatedLine   = Animated.createAnimatedComponent(Line);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../store/useStore';
import { useWeightUnit } from '../hooks/useWeightUnit';
import AppHeader from '../components/AppHeader';
import { colors, spacing, typography, radius, borders, withOpacity } from '../theme';
import { formatDate } from '../../../src/utils/formatters';
import { summarizeSets } from '../../../src/utils/progression';

// ── Layout constants ───────────────────────────────────────────────────────────

const CHART_H            = 128; // altura total del SVG
const PAD_TOP            = 12;  // margen superior
const PAD_BOT            = 24;  // margen inferior (para labels X)
const Y_AXIS_W           = 32;  // ancho del área del eje Y fija
const C_PAD_L            = 6;   // padding izq. del contenido SVG
const C_PAD_R            = 12;  // padding der. del contenido SVG
const MIN_SCROLL         = 6;   // puntos a partir de los cuales activar scroll horizontal
const STEP_PX            = 52;  // px por punto en modo scroll
const Y_ANIM_COUNT       = 80;  // pool de Animated.Value pre-asignados (cubre ~1 año de sesiones)
const EXERCISE_THRESHOLD = 7;   // ejercicios mínimos para mostrar el filtro

// ── Constants ──────────────────────────────────────────────────────────────────

const PERIOD_OPTIONS = [
  { id: '1m',  label: '1M'  },
  { id: '3m',  label: '3M'  },
  { id: 'all', label: 'Todo' },
];

// ── Pure helpers ───────────────────────────────────────────────────────────────

function filterLog(log, scope, period, programTemplateIds) {
  let filtered = [...log];
  if (scope === 'program' && programTemplateIds.size > 0) {
    filtered = filtered.filter((e) => programTemplateIds.has(e.sessionTemplateId));
  }
  if (period !== 'all') {
    const days   = period === '1m' ? 30 : 90;
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    filtered = filtered.filter((e) => e.timestamp >= cutoff);
  }
  return filtered;
}

function getExerciseLogsFrom(exerciseId, sourceLog) {
  return sourceLog
    .filter((log) =>
      log.exercises.some(
        (e) => e.exerciseId === exerciseId &&
               e.sets.some((s) => s.done || s.weight || s.reps || s.time)
      )
    )
    .sort((a, b) => a.timestamp - b.timestamp)
    .map((log) => ({
      timestamp: log.timestamp,
      exercise:  log.exercises.find((e) => e.exerciseId === exerciseId),
    }));
}

function getMetrics(def, allLogs, weightLabel = 'kg') {
  const model = def?.progressionModel;
  if (model === 'time_progression') return [{ id: 'time', label: 'Seg' }];
  if (model === 'submax')           return [{ id: 'reps', label: 'Reps' }];
  const hasWeight = allLogs.some(({ exercise }) =>
    exercise?.sets?.some((s) => parseFloat(s.weight) > 0)
  );
  const m = [{ id: 'reps', label: 'Reps' }];
  if (hasWeight) {
    m.unshift({ id: 'kg', label: weightLabel.toUpperCase() });
    m.push({ id: 'vol', label: 'Vol' });
  }
  return m;
}

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

function computeTotals(def, allLogs, fmtWeight) {
  const fmtW    = fmtWeight ?? ((kg) => `${kg}kg`);
  const model   = def?.progressionModel;
  const allDone = allLogs.flatMap(({ exercise }) =>
    exercise?.sets?.filter((s) => s.done || s.weight || s.reps || s.time) ?? []
  );
  if (!allDone.length) return null;
  const sessions = allLogs.length;
  if (model === 'time_progression') {
    const maxTime = Math.max(...allDone.map((s) => parseFloat(s.time) || 0));
    return maxTime > 0
      ? `PR ${maxTime}s · ${sessions} ses.`
      : `${sessions} ses.`;
  }
  const maxKg = Math.max(...allDone.map((s) => parseFloat(s.weight) || 0));
  if (maxKg > 0) return `PR ${fmtW(maxKg)} · ${sessions} ses.`;
  return `${sessions} ses.`;
}

function computeOverallImprovement(workoutLog, allExercises) {
  const ids = [...new Set(
    workoutLog.flatMap((l) =>
      l.exercises
        .filter((e) => e.sets.some((s) => s.done || s.weight || s.reps || s.time))
        .map((e) => e.exerciseId)
    )
  )];
  const improvements = [];
  for (const id of ids) {
    const logs = getExerciseLogsFrom(id, workoutLog);
    if (logs.length < 2) continue;
    const def    = allExercises[id];
    const model  = def?.progressionModel;
    const metric = model === 'time_progression' ? 'time' : 'kg';
    const firstVal =
      computeValue(logs[0].exercise?.sets, metric) ??
      computeValue(logs[0].exercise?.sets, 'reps');
    const lastVal  =
      computeValue(logs[logs.length - 1].exercise?.sets, metric) ??
      computeValue(logs[logs.length - 1].exercise?.sets, 'reps');
    if (!firstVal || !lastVal || firstVal === 0) continue;
    const pct = ((lastVal - firstVal) / firstVal) * 100;
    improvements.push(Math.max(-100, Math.min(200, pct)));
  }
  if (!improvements.length) return null;
  return Math.round(improvements.reduce((a, b) => a + b, 0) / improvements.length);
}

function computeExerciseImprovement(logs, def) {
  if (!logs || logs.length < 2) return null;
  const model  = def?.progressionModel;
  const metric = model === 'time_progression' ? 'time' : model === 'submax' ? 'reps' : 'kg';
  const firstVal = computeValue(logs[0].exercise?.sets, metric)
                ?? computeValue(logs[0].exercise?.sets, 'reps');
  const lastVal  = computeValue(logs[logs.length - 1].exercise?.sets, metric)
                ?? computeValue(logs[logs.length - 1].exercise?.sets, 'reps');
  if (!firstVal || !lastVal || firstVal === 0) return null;
  const pct = ((lastVal - firstVal) / firstVal) * 100;
  return Math.round(Math.max(-100, Math.min(200, pct)));
}

function computeWeekStreak(workoutLog) {
  if (!workoutLog.length) return 0;
  const getMondayTs = (ts) => {
    const d   = new Date(ts);
    const day = d.getDay();
    d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  };
  const trainingWeeks = new Set(workoutLog.map((l) => getMondayTs(l.timestamp)));
  const now      = Date.now();
  const thisWeek = getMondayTs(now);
  const lastWeek = thisWeek - 7 * 24 * 60 * 60 * 1000;
  if (!trainingWeeks.has(thisWeek) && !trainingWeeks.has(lastWeek)) return 0;
  let streak = 0;
  let w      = trainingWeeks.has(thisWeek) ? thisWeek : lastWeek;
  while (trainingWeeks.has(w)) { streak++; w -= 7 * 24 * 60 * 60 * 1000; }
  return streak;
}

function fmtAxisVal(v) {
  if (v >= 1000) return `${Math.round(v / 100) / 10}k`;
  if (v >= 100)  return String(Math.round(v));
  return v % 1 === 0 ? String(v) : String(Math.round(v * 10) / 10);
}

// ── SVG line chart ─────────────────────────────────────────────────────────────
//
// Clip animation: Animated.View con overflow:'hidden' crece de 0 → chartW.
// ClipPath + AnimatedRect no funciona en react-native-svg; el View nativo sí.
//
// Y animation: AnimatedLine/Circle con Animated.Value por punto (max 6).
//   · Montaje / cambio de período → clip redraw (700-900ms)
//   · Cambio de métrica (mismo nº de puntos) → Y transition (500ms)
//
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
      <View style={styles.chartEmpty}>
        <Text style={styles.chartEmptyText}>
          Necesitas al menos 2 sesiones en este período.
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

  // Y ticks
  const yTicks = range === 0
    ? [{ v: minV, y: toY(minV) }]
    : [0, 1, 2, 3].map((k) => {
        const v = minV + (range / 3) * k;
        return { v: Math.round(v * 10) / 10, y: toY(v) };
      });

  // Tooltip
  const valueText   = selected ? `${fmtAxisVal(selected.value)}${metricLabel ? ` ${metricLabel}` : ''}` : '';
  const dateText    = selected ? selected.date : '';
  const datePxW     = dateText.length  * 4.5;
  const valuePxW    = valueText.length * 6.5;
  const TW          = Math.max(56, Math.ceil(Math.max(datePxW, valuePxW) + 20));
  const TH          = 36;
  // En modo scroll no recortamos el tooltip (el punto siempre está dentro del viewport visible)
  const tooltipX    = selected
    ? (needsScroll
        ? selected.x
        : Math.min(Math.max(selected.x, TW / 2 + 2), chartW - TW / 2 - 2))
    : 0;
  const tooltipY    = selected ? (selected.y - TH - 14 >= PAD_TOP ? selected.y - TH - 14 : selected.y + 14) : 0;
  const dateStartX  = tooltipX - datePxW  / 2;
  const valueStartX = tooltipX - valuePxW / 2;

  // ── Y animation ────────────────────────────────────────────────────────────
  useEffect(() => { // eslint-disable-line react-hooks/exhaustive-deps
    if (!chartW || !pts.length) return;
    const sameCount = pts.length === prevLenRef.current;
    prevLenRef.current = pts.length;

    if (!initRef.current) {
      pts.forEach((p, i) => yAnims[i].setValue(p.y));
      initRef.current = true;
    } else if (sameCount) {
      // Cambio de métrica: animar Y suavemente
      Animated.parallel(
        pts.map((p, i) =>
          Animated.timing(yAnims[i], { toValue: p.y, duration: 500, useNativeDriver: false })
        )
      ).start();
    } else {
      // Cambio de período: saltar Y y redibujar desde el viewport visible
      pts.forEach((p, i) => yAnims[i].setValue(p.y));
      const startW = needsScroll ? svgW - chartW : 0;
      clipWidthAnim.setValue(startW);
      Animated.timing(clipWidthAnim, { toValue: svgW, duration: 700, useNativeDriver: false }).start();
    }
  }, [data, chartW]); // eslint-disable-line

  // ── Clip animation al montar — empieza desde el borde izquierdo del viewport ──
  // En modo scroll el chart auto-scrollea al final, así que el punto visible
  // empieza en (svgW - chartW). Animamos solo esa franja visible (~chartW px).
  useEffect(() => { // eslint-disable-line react-hooks/exhaustive-deps
    if (!chartW) return;
    const startW = needsScroll ? svgW - chartW : 0;
    clipWidthAnim.setValue(startW);
    Animated.timing(clipWidthAnim, { toValue: svgW, duration: 900, useNativeDriver: false }).start();
  }, [chartW]); // eslint-disable-line

  // ── Tap ────────────────────────────────────────────────────────────────────
  const handlePress = (e) => {
    const { locationX, locationY } = e.nativeEvent;
    const hit = pts.find((p) => Math.hypot(p.x - locationX, p.y - locationY) < 22);
    setSelected(hit && hit.i !== selected?.i ? hit : null);
  };

  return (
    <View style={styles.chartRow}>
      {/* Eje Y fijo */}
      <View style={[styles.yAxisArea, { height: CHART_H }]}>
        {yTicks.map(({ v, y }, i) => (
          <Text key={i} style={[styles.yAxisLabel, { top: y - 4 }]}>
            {fmtAxisVal(v)}
          </Text>
        ))}
      </View>

      {/* Área del gráfico */}
      <View
        style={styles.chartContentArea}
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

              {/* Capa animada: overflow:hidden crece left→right revelando línea + puntos */}
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
                        cx={p.x}
                        cy={yAnims[i]}
                        r={isSel ? 6 : 4}
                        fill={colors.accent}
                        stroke={isSel ? colors.bg : 'none'}
                        strokeWidth={isSel ? 2 : 0}
                      />
                    );
                  })}
                </Svg>
              </Animated.View>

              {/* Capa estática: fechas + tooltip + tap (encima, mismo tamaño) */}
              <Svg
                style={StyleSheet.absoluteFill}
                width={svgW}
                height={CHART_H}
                onPress={handlePress}
              >
                {pts.map((p) => {
                  const anchor = p.i === 0 ? 'start' : p.i === pts.length - 1 ? 'end' : 'middle';
                  return (
                    <SvgText
                      key={p.i}
                      x={p.x} y={CHART_H - 4}
                      fontSize={8} fill={colors.muted} textAnchor={anchor}
                    >
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
                      {fmtAxisVal(selected.value)}{metricLabel ? ` ${metricLabel}` : ''}
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

// ── StatTile ───────────────────────────────────────────────────────────────────

function StatTile({ value, label, valueColor }) {
  return (
    <View style={styles.statTile}>
      <Text style={[styles.statValue, valueColor ? { color: valueColor } : null]}>
        {value}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ── ExerciseStatCard ───────────────────────────────────────────────────────────

function ExerciseStatCard({ exerciseId, def, logs, allLogs, periodLogs }) {
  const navigation = useNavigation();
  const { i18n } = useTranslation();
  const { label: weightLabel, toDisplay: wDisplay, fmt: fmtWeight } = useWeightUnit();

  const [expanded,    setExpanded]    = useState(false);
  const [chartPeriod, setChartPeriod] = useState('all');
  const [chartMetric, setChartMetric] = useState(null);

  const effectiveLogs = allLogs ?? logs ?? [];
  if (!effectiveLogs.length) return null;

  const name = def
    ? (i18n.language === 'en' ? (def.nameEn ?? def.name) : def.name)
    : '—';

  const metrics      = useMemo(() => getMetrics(def, effectiveLogs, weightLabel), [def, effectiveLogs, weightLabel]);
  const activeMetric = chartMetric ?? metrics[0]?.id;
  const metricLabel  = metrics.find((m) => m.id === activeMetric)?.label ?? '';
  const totals       = useMemo(() => computeTotals(def, effectiveLogs, fmtWeight), [def, effectiveLogs, fmtWeight]);
  const tableLogs    = useMemo(() => [...(logs ?? [])].reverse(), [logs]);
  const improvePct   = useMemo(() => computeExerciseImprovement(periodLogs ?? effectiveLogs, def), [periodLogs, effectiveLogs, def]);

  const chartData = useMemo(() => {
    let filtered = [...effectiveLogs];
    if (chartPeriod !== 'all') {
      const days   = chartPeriod === '1m' ? 30 : 90;
      const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
      filtered = filtered.filter(({ timestamp }) => timestamp >= cutoff);
    }
    const needsConv = activeMetric === 'kg' || activeMetric === 'vol';
    return filtered
      .map(({ timestamp, exercise }) => {
        const raw   = computeValue(exercise?.sets, activeMetric);
        const value = raw !== null && needsConv
          ? (activeMetric === 'kg'
              ? wDisplay(raw)
              : Math.round(wDisplay(1) * raw * 10) / 10)
          : raw;
        return {
          date: new Date(timestamp).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }),
          value,
        };
      })
      .filter((d) => d.value !== null);
  }, [effectiveLogs, chartPeriod, activeMetric, wDisplay]);

  return (
    <View style={styles.exCard}>
      {/* Header */}
      <View style={styles.exHeader}>
        <TouchableOpacity
          style={styles.exHeaderLeft}
          onPress={() => exerciseId && navigation.push('ExerciseHistory', { exerciseId })}
          activeOpacity={0.7}
        >
          <View style={styles.exNameRow}>
            <Text style={styles.exName} numberOfLines={1}>{name}</Text>
            {improvePct !== null && (
              <Text style={[
                styles.exImproveBadge,
                improvePct >= 0 ? styles.exImproveBadgePos : styles.exImproveBadgeNeg,
              ]}>
                {`${improvePct > 0 ? '+' : ''}${improvePct}%`}
              </Text>
            )}
          </View>
          {totals ? <Text style={styles.exTotals}>{totals}</Text> : null}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.expandBtn, expanded && styles.expandBtnActive]}
          onPress={() => setExpanded((v) => !v)}
          hitSlop={8}
        >
          <Text style={styles.expandBtnIcon}>📈</Text>
        </TouchableOpacity>
      </View>

      {/* Tabla de sesiones: últimas 6 */}
      <View style={styles.exTable}>
        {tableLogs.map(({ timestamp, exercise }) => {
          const done = exercise?.sets?.filter(
            (s) => s.done || s.weight || s.reps || s.time
          ) ?? [];
          if (!done.length) return null;
          return (
            <View key={timestamp} style={styles.exRow}>
              <Text style={styles.exRowDate}>{formatDate(timestamp)}</Text>
              <Text style={styles.exRowSets}>{summarizeSets(def, done, fmtWeight)}</Text>
            </View>
          );
        })}
      </View>

      {/* Gráfica expandible */}
      {expanded && (
        <View style={styles.chartSection}>
          <View style={styles.chartControls}>
            <View style={styles.btnGroup}>
              {PERIOD_OPTIONS.map(({ id, label }) => (
                <TouchableOpacity
                  key={id}
                  style={[styles.ctrlBtn, chartPeriod === id && styles.ctrlBtnActive]}
                  onPress={() => setChartPeriod(id)}
                >
                  <Text style={[styles.ctrlBtnText, chartPeriod === id && styles.ctrlBtnTextActive]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {metrics.length > 1 && (
              <View style={styles.btnGroup}>
                {metrics.map(({ id, label }) => (
                  <TouchableOpacity
                    key={id}
                    style={[styles.ctrlBtn, activeMetric === id && styles.ctrlBtnActive]}
                    onPress={() => setChartMetric(id)}
                  >
                    <Text style={[styles.ctrlBtnText, activeMetric === id && styles.ctrlBtnTextActive]}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          <MiniLineChart data={chartData} metricLabel={metricLabel} />
        </View>
      )}
    </View>
  );
}

// ── Screen ─────────────────────────────────────────────────────────────────────

export default function StatsScreen() {
  const insets      = useSafeAreaInsets();
  const { i18n }    = useTranslation();
  const { fmt: fmtWeight } = useWeightUnit();

  const workoutLog           = useStore((s) => s.workoutLog);
  const exerciseLibrary      = useStore((s) => s.exerciseLibrary);
  const customExercises      = useStore((s) => s.customExercises);
  const programs             = useStore((s) => s.programs);
  const profile              = useStore((s) => s.profile);
  const getEffectiveTemplate = useStore((s) => s.getEffectiveTemplate);
  const allExercises         = { ...exerciseLibrary, ...customExercises };

  const activeProgram = programs[profile.activeProgramId];

  const [scope,               setScope]               = useState('all');
  const [period,              setPeriod]              = useState('all');
  const [selectedExerciseIds, setSelectedExerciseIds] = useState(new Set());
  const [dropOpen,            setDropOpen]            = useState(false);

  // Limpiar filtro y cerrar dropdown cuando cambia scope o period
  useEffect(() => { setSelectedExerciseIds(new Set()); setDropOpen(false); }, [scope, period]);

  function toggleExercise(id) {
    setSelectedExerciseIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // ── Stat tiles ─────────────────────────────────────────────────────────────
  const totalSessions = workoutLog.length;

  const weekStreak = useMemo(() => computeWeekStreak(workoutLog), [workoutLog]);

  // ── Template IDs ───────────────────────────────────────────────────────────
  const programTemplateIds = useMemo(() => {
    const ids = new Set();
    if (!activeProgram) return ids;
    if (activeProgram.stages?.length > 0) {
      activeProgram.stages.forEach((st) => st.days.forEach((d) => ids.add(d.sessionTemplateId)));
    } else {
      (activeProgram.days ?? []).forEach((d) => ids.add(d.sessionTemplateId));
    }
    return ids;
  }, [activeProgram]);

  const programExerciseIds = useMemo(() => new Set(
    [...programTemplateIds].flatMap((id) => {
      const tpl = getEffectiveTemplate(id);
      return tpl?.exercises.map((e) => e.exerciseId) ?? [];
    })
  ), [programTemplateIds, getEffectiveTemplate]);

  // ── Filtered logs ──────────────────────────────────────────────────────────
  const filteredLog = useMemo(
    () => filterLog(workoutLog, scope, period, programTemplateIds),
    [workoutLog, scope, period, programTemplateIds]
  );
  const filteredLogScope = useMemo(
    () => filterLog(workoutLog, scope, 'all', programTemplateIds),
    [workoutLog, scope, programTemplateIds]
  );

  // ── Overall improvement (needs filteredLog) ────────────────────────────────
  const improvePct = useMemo(
    () => computeOverallImprovement(filteredLog, allExercises),
    [filteredLog]
  );
  const improveLabel = improvePct === null
    ? '—'
    : `${improvePct > 0 ? '+' : ''}${improvePct}%`;
  const improveColor = improvePct === null
    ? colors.muted
    : improvePct >= 0 ? colors.green : colors.red;

  // ── Exercises with data ────────────────────────────────────────────────────
  const exercisesWithLogs = useMemo(() => {
    const allIds = [...new Set(
      filteredLog.flatMap((log) =>
        log.exercises
          .filter((e) => e.sets.some((s) => s.done || s.weight || s.reps || s.time))
          .map((e) => e.exerciseId)
      )
    )];
    const scoped = scope === 'program'
      ? allIds.filter((id) => programExerciseIds.has(id))
      : allIds;
    return scoped.filter((id) => getExerciseLogsFrom(id, filteredLog).length > 0);
  }, [filteredLog, scope, programExerciseIds]);

  const displayedExercises = selectedExerciseIds.size > 0
    ? exercisesWithLogs.filter((id) => selectedExerciseIds.has(id))
    : exercisesWithLogs;

  const showExFilter = exercisesWithLogs.length > EXERCISE_THRESHOLD;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <AppHeader />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: spacing.xxl + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Stat tiles */}
        <View style={styles.statsGrid}>
          <StatTile value={totalSessions}  label="Sesiones"     />
          <StatTile value={improveLabel}   label="Mejora media" valueColor={improveColor} />
          <StatTile
            value={weekStreak > 0 ? `${weekStreak}sem` : '—'}
            label="Racha activa"
          />
        </View>

        {/* Scope + period bar */}
        <View style={styles.filterBar}>
          <View style={styles.btnGroup}>
            {[
              { id: 'program', label: 'Programa' },
              { id: 'all',     label: 'Todos'    },
            ].map(({ id, label }) => (
              <TouchableOpacity
                key={id}
                style={[styles.scopeBtn, scope === id && styles.scopeBtnActive]}
                onPress={() => setScope(id)}
              >
                <Text style={[styles.scopeBtnText, scope === id && styles.scopeBtnTextActive]}>
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.btnGroup}>
            {PERIOD_OPTIONS.map(({ id, label }) => (
              <TouchableOpacity
                key={id}
                style={[styles.ctrlBtn, period === id && styles.ctrlBtnActive]}
                onPress={() => setPeriod(id)}
              >
                <Text style={[styles.ctrlBtnText, period === id && styles.ctrlBtnTextActive]}>
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Filtro de ejercicios (aparece cuando hay más de EXERCISE_THRESHOLD) */}
        {showExFilter && (
          <View style={styles.dropWrapper}>
            <TouchableOpacity
              style={styles.dropBtn}
              onPress={() => setDropOpen((v) => !v)}
              activeOpacity={0.75}
            >
              <Text style={styles.dropBtnText}>
                {selectedExerciseIds.size === 0
                  ? 'Todos los ejercicios'
                  : `${selectedExerciseIds.size} ejercicio${selectedExerciseIds.size > 1 ? 's' : ''} seleccionado${selectedExerciseIds.size > 1 ? 's' : ''}`}
              </Text>
              <Text style={styles.dropArrow}>{dropOpen ? '▴' : '▾'}</Text>
            </TouchableOpacity>
            {dropOpen && (
              <View style={styles.dropList}>
                <ScrollView
                  nestedScrollEnabled
                  showsVerticalScrollIndicator={false}
                  style={{ maxHeight: 200 }}
                >
                  {exercisesWithLogs.map((id) => {
                    const def   = allExercises[id];
                    const name  = def
                      ? (i18n.language === 'en' ? (def.nameEn ?? def.name) : def.name)
                      : id;
                    const isSel = selectedExerciseIds.has(id);
                    return (
                      <TouchableOpacity
                        key={id}
                        style={styles.dropItem}
                        onPress={() => toggleExercise(id)}
                        activeOpacity={0.75}
                      >
                        <View style={[styles.dropCheck, isSel && styles.dropCheckActive]}>
                          {isSel && <Text style={styles.dropCheckMark}>✓</Text>}
                        </View>
                        <Text style={styles.dropItemText} numberOfLines={1}>{name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
                {selectedExerciseIds.size > 0 && (
                  <TouchableOpacity
                    style={styles.dropResetBtn}
                    onPress={() => setSelectedExerciseIds(new Set())}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.dropResetText}>Restablecer selección</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        )}

        {/* Exercise cards */}
        {displayedExercises.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📈</Text>
            <Text style={styles.emptyText}>
              {workoutLog.length === 0
                ? 'Completa tu primera sesión para ver el progreso aquí.'
                : 'Sin datos para el filtro seleccionado.'}
            </Text>
          </View>
        ) : (
          displayedExercises.map((exerciseId) => {
            const def         = allExercises[exerciseId];
            const periodLogs  = getExerciseLogsFrom(exerciseId, filteredLog);
            const logs        = periodLogs.slice(-6);
            const allLogs     = getExerciseLogsFrom(exerciseId, filteredLogScope);
            return (
              <ExerciseStatCard key={exerciseId} exerciseId={exerciseId} def={def} logs={logs} allLogs={allLogs} periodLogs={periodLogs} />
            );
          })
        )}
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
  content: {
    padding: spacing.xl,
    gap:     spacing.md,
  },

  // ── Stats ──────────────────────────────────────────────────────────────────
  statsGrid: {
    flexDirection: 'row',
    gap:           spacing.sm,
  },
  statTile: {
    flex:            1,
    backgroundColor: colors.surface,
    borderWidth:     borders.thin,
    borderColor:     colors.borderCard,
    borderRadius:    radius.md,
    padding:         spacing.md,
    alignItems:      'center',
    gap:             spacing.xs,
  },
  statValue: {
    fontSize:   typography.xxl,
    fontWeight: typography.heavy,
    color:      colors.accent,
  },
  statLabel: {
    fontSize:      typography.xs,
    color:         colors.muted,
    letterSpacing: 0.6,
    textAlign:     'center',
  },

  // ── Filter bar ─────────────────────────────────────────────────────────────
  filterBar: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    gap:            spacing.sm,
  },
  btnGroup: {
    flexDirection: 'row',
    gap:           spacing.xs,
  },
  scopeBtn: {
    paddingVertical:   spacing.xs + 2,
    paddingHorizontal: spacing.md,
    borderRadius:      radius.sm,
    borderWidth:       borders.thin,
    borderColor:       colors.border,
    backgroundColor:   colors.surface,
  },
  scopeBtnActive: {
    backgroundColor: withOpacity(colors.accent, 0.08),
    borderColor:     withOpacity(colors.accent, 0.3),
  },
  scopeBtnText: {
    fontSize:   typography.xs,
    color:      colors.muted,
    fontWeight: typography.medium,
  },
  scopeBtnTextActive: { color: colors.accent },

  ctrlBtn: {
    paddingVertical:   4,
    paddingHorizontal: spacing.sm,
    borderRadius:      5,
    borderWidth:       borders.thin,
    borderColor:       colors.border,
    backgroundColor:   colors.surface2,
  },
  ctrlBtnActive: {
    backgroundColor: withOpacity(colors.accent, 0.08),
    borderColor:     withOpacity(colors.accent, 0.3),
  },
  ctrlBtnText: {
    fontSize:   typography.xs,
    color:      colors.muted,
    fontWeight: typography.medium,
  },
  ctrlBtnTextActive: { color: colors.accent },

  // ── Exercise filter dropdown ───────────────────────────────────────────────
  dropWrapper: {
    zIndex: 10,
  },
  dropBtn: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'space-between',
    paddingVertical:   spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius:    radius.sm,
    borderWidth:     borders.thin,
    borderColor:     colors.border,
    backgroundColor: colors.surface,
  },
  dropBtnText: {
    fontSize:   typography.xs,
    color:      colors.text,
    fontWeight: typography.medium,
    flex:       1,
  },
  dropArrow: {
    fontSize: 10,
    color:    colors.muted,
    marginLeft: spacing.sm,
  },
  dropList: {
    marginTop:       2,
    borderRadius:    radius.sm,
    borderWidth:     borders.thin,
    borderColor:     colors.border,
    backgroundColor: colors.surface,
    overflow:        'hidden',
  },
  dropItem: {
    flexDirection:   'row',
    alignItems:      'center',
    paddingVertical:   spacing.sm,
    paddingHorizontal: spacing.md,
    gap:             spacing.sm,
    borderBottomWidth: borders.thin,
    borderBottomColor: colors.border,
  },
  dropCheck: {
    width:           16,
    height:          16,
    borderRadius:    3,
    borderWidth:     borders.thin,
    borderColor:     colors.border,
    backgroundColor: colors.surface2,
    alignItems:      'center',
    justifyContent:  'center',
    flexShrink:      0,
  },
  dropCheckActive: {
    backgroundColor: colors.accent,
    borderColor:     colors.accent,
  },
  dropCheckMark: {
    fontSize:   9,
    color:      colors.bg,
    lineHeight: 11,
  },
  dropItemText: {
    flex:     1,
    fontSize: typography.xs,
    color:    colors.text,
  },
  dropResetBtn: {
    paddingVertical:   spacing.sm,
    paddingHorizontal: spacing.md,
    alignItems:        'center',
  },
  dropResetText: {
    fontSize: typography.xs,
    color:    colors.muted,
  },

  // ── Exercise card ──────────────────────────────────────────────────────────
  exCard: {
    backgroundColor: colors.surface,
    borderWidth:     borders.thin,
    borderColor:     colors.borderCard,
    borderRadius:    radius.md,
    overflow:        'hidden',
  },
  exHeader: {
    flexDirection: 'row',
    alignItems:    'flex-start',
    padding:       spacing.md,
    paddingBottom: spacing.sm,
    gap:           spacing.sm,
  },
  exHeaderLeft: { flex: 1, gap: 3 },
  exNameRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.xs,
  },
  exName: {
    fontSize:   typography.sm,
    fontWeight: typography.medium,
    color:      colors.text,
    flexShrink: 1,
  },
  exImproveBadge: {
    fontSize:   typography.xs,
    fontWeight: typography.bold,
    flexShrink: 0,
  },
  exImproveBadgePos: { color: colors.green },
  exImproveBadgeNeg: { color: colors.red },
  exTotals: {
    fontSize: typography.xs,
    color:    colors.muted,
  },
  expandBtn: {
    borderWidth:       borders.thin,
    borderColor:       colors.border,
    borderRadius:      radius.sm,
    paddingVertical:   4,
    paddingHorizontal: spacing.sm,
    flexShrink:        0,
  },
  expandBtnActive: {
    backgroundColor: withOpacity(colors.accent, 0.08),
    borderColor:     withOpacity(colors.accent, 0.3),
  },
  expandBtnIcon: { fontSize: 13 },

  // ── Session table ──────────────────────────────────────────────────────────
  exTable: {
    paddingHorizontal: spacing.md,
    paddingBottom:     spacing.sm,
  },
  exRow: {
    flexDirection:   'row',
    justifyContent:  'space-between',
    alignItems:      'center',
    paddingVertical: 5,
    borderTopWidth:  borders.thin,
    borderTopColor:  colors.border,
  },
  exRowDate: {
    fontSize: typography.xs,
    color:    colors.muted,
  },
  exRowSets: {
    fontSize:   typography.xs,
    fontWeight: typography.medium,
    color:      colors.text,
  },

  // ── Chart ──────────────────────────────────────────────────────────────────
  chartSection: {
    borderTopWidth: borders.thin,
    borderTopColor: colors.border,
    padding:        spacing.md,
    gap:            spacing.sm,
  },
  chartControls: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    flexWrap:       'wrap',
    gap:            spacing.xs,
  },
  chartRow: {
    flexDirection: 'row',
    alignItems:    'flex-start',
  },
  yAxisArea: {
    width:    Y_AXIS_W,
  },
  yAxisLabel: {
    position:  'absolute',
    right:     4,
    fontSize:  8,
    color:     colors.muted,
    textAlign: 'right',
    width:     Y_AXIS_W - 4,
    lineHeight: 10,
  },
  chartContentArea: {
    flex:      1,
    minHeight: CHART_H,
    overflow:  'hidden',
  },
  chartEmpty: {
    paddingVertical: spacing.lg,
    alignItems:      'center',
  },
  chartEmptyText: {
    fontSize:  typography.xs,
    color:     colors.muted,
    textAlign: 'center',
  },

  // ── Empty state ────────────────────────────────────────────────────────────
  emptyState: {
    alignItems: 'center',
    padding:    spacing.xxl,
    gap:        spacing.md,
  },
  emptyIcon: { fontSize: 32 },
  emptyText: {
    fontSize:   typography.base,
    color:      colors.muted,
    textAlign:  'center',
    lineHeight: typography.base * 1.7,
  },
});
