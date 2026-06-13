/**
 * ProgressTab — shared progress/stats view.
 *
 * Used by StatsScreen (own user) and ClientsScreen (client detail › Progresión tab).
 *
 * Props:
 *   baseLog            WorkoutLog[]   – sessions to analyse; caller pre-filters to this
 *                                       subject (all of the user's log, or only the client's
 *                                       sessions).  ProgressTab adds its own scope/period.
 *   programTemplateIds Set<string>    – template IDs for "Programa actual" toggle.
 *                                       Pass an empty Set to hide the toggle.
 *   allExercises       { [id]: def }  – merged exercise library + custom exercises.
 */

import { useState, useRef, useMemo, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, Animated, Modal, Pressable, PanResponder, RefreshControl,
} from 'react-native';
import Svg, { G, Circle, Line, Rect, Text as SvgText } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useStore }      from '../../../store/useStore';
import { useWeightUnit } from '../../hooks/useWeightUnit';
import { colors, spacing, typography, radius, borders, withOpacity } from '../../theme';
import { formatDate }    from '../../../../src/utils/formatters';
import { bestSetE1RM, recentE1RM } from '../../../../src/utils/oneRm';

// ── Animated SVG primitives ───────────────────────────────────────────────────

const AnimatedLine   = Animated.createAnimatedComponent(Line);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// ── Layout constants ──────────────────────────────────────────────────────────

const CHART_H      = 128;
const PAD_TOP      = 12;
const PAD_BOT      = 24;
const Y_AXIS_W     = 24;
const C_PAD_L      = 6;
const C_PAD_R      = 12;
const MIN_SCROLL   = 12;
const Y_ANIM_COUNT = 80;

const PERIOD_OPTIONS = [
  { id: '7d',  label: '7D'   },
  { id: '1m',  label: '1M'   },
  { id: '3m',  label: '3M'   },
  { id: 'all', label: 'Todo' },
];

// ── Pure helpers ──────────────────────────────────────────────────────────────

function filterLog(log, scope, period, programTemplateIds) {
  let filtered = [...log];
  if (scope === 'program' && programTemplateIds.size > 0) {
    filtered = filtered.filter((e) => programTemplateIds.has(e.sessionTemplateId));
  }
  if (period !== 'all') {
    const days   = period === '7d' ? 7 : period === '1m' ? 30 : period === '3m' ? 90 : 365;
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    filtered     = filtered.filter((e) => e.timestamp >= cutoff);
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
      timestamp:         log.timestamp,
      sessionTemplateId: log.sessionTemplateId,
      exercise:          log.exercises.find((e) => e.exerciseId === exerciseId),
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
    m.push({ id: 'vol',  label: 'Vol' });
    m.push({ id: 'e1rm', label: '1RM' });
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
  if (metricId === 'e1rm') {
    const v = bestSetE1RM(done);
    return v !== null ? Math.round(v * 10) / 10 : null;
  }
  return null;
}

function linearRegressionPct(logs, def) {
  if (!logs || logs.length < 2) return null;
  const model  = def?.progressionModel;
  const metric = model === 'time_progression' ? 'time' : model === 'submax' ? 'reps' : 'kg';
  const pts = [];
  for (let i = 0; i < logs.length; i++) {
    const v = computeValue(logs[i].exercise?.sets, metric)
           ?? computeValue(logs[i].exercise?.sets, 'reps');
    if (v !== null) pts.push({ x: i, y: v });
  }
  if (pts.length < 2) return null;
  const N     = pts.length;
  const sumX  = pts.reduce((s, p) => s + p.x, 0);
  const sumY  = pts.reduce((s, p) => s + p.y, 0);
  const sumXY = pts.reduce((s, p) => s + p.x * p.y, 0);
  const sumX2 = pts.reduce((s, p) => s + p.x * p.x, 0);
  const denom = N * sumX2 - sumX * sumX;
  if (denom === 0) return 0;
  const slope     = (N * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / N;
  const firstEst  = intercept;
  const lastEst   = intercept + slope * (pts[pts.length - 1].x);
  if (!firstEst || firstEst <= 0) return null;
  const pct = ((lastEst - firstEst) / firstEst) * 100;
  return Math.round(Math.max(-100, Math.min(200, pct)));
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
    const pct  = linearRegressionPct(logs, allExercises[id]);
    if (pct !== null) improvements.push(pct);
  }
  if (!improvements.length) return null;
  return Math.round(improvements.reduce((a, b) => a + b, 0) / improvements.length);
}

function computeExerciseImprovement(logs, def) {
  return linearRegressionPct(logs, def);
}

function fmtAxisVal(v) {
  if (v < 0) return `-${fmtAxisVal(-v)}`;
  if (v >= 1000) return `${Math.round(v / 100) / 10}k`;
  if (v >= 100)  return String(Math.round(v));
  return v % 1 === 0 ? String(v) : String(Math.round(v * 10) / 10);
}

function fmtVol(raw, toDisplay) {
  const v = Math.round(toDisplay(raw));
  return v >= 1000 ? `${Math.round(v / 100) / 10}k` : String(v);
}

function timeAgo(timestamp) {
  if (!timestamp) return null;
  const days = Math.floor((Date.now() - timestamp) / 86400000);
  if (days === 0) return 'Hoy';
  if (days === 1) return 'Ayer';
  if (days < 7)   return `Hace ${days} días`;
  const w = Math.floor(days / 7);
  if (w === 1)   return 'Hace 1 semana';
  if (w < 5)     return `Hace ${w} semanas`;
  const m = Math.floor(days / 30);
  if (m === 1)   return 'Hace 1 mes';
  if (m < 12)    return `Hace ${m} meses`;
  const y = Math.floor(days / 365);
  return y === 1 ? 'Hace 1 año' : `Hace ${y} años`;
}

function buildSessionSummary(exercise, def, fmtWeight) {
  const done = exercise?.sets?.filter((s) => s.done || s.weight || s.reps || s.time) ?? [];
  if (!done.length) return null;
  const model = def?.progressionModel;
  if (model === 'time_progression') {
    return done.map((s) => `${s.time ?? '?'}s`).join('/');
  }
  const hasSomeWeight = done.some((s) => parseFloat(s.weight) > 0);
  if (!hasSomeWeight) {
    const reps = done.map((s) => parseInt(s.reps) || 0).filter((r) => r > 0);
    return reps.length ? `${reps.join('/')} reps` : null;
  }
  const weightVals = done.map((s) => parseFloat(s.weight) || 0);
  const uniqueW    = new Set(weightVals.filter((w) => w > 0));
  if (uniqueW.size === 1) {
    const w    = [...uniqueW][0];
    const reps = done.map((s) => parseInt(s.reps) || 0).filter((r) => r > 0);
    return reps.length ? `${fmtWeight(w)} × ${reps.join('/')}` : fmtWeight(w);
  }
  const parts   = [];
  let curW      = null;
  let curReps   = [];
  const flush   = () => {
    if (curW === null) return;
    parts.push(curReps.length ? `${fmtWeight(curW)}×${curReps.join('/')}` : fmtWeight(curW));
  };
  for (const s of done) {
    const w = parseFloat(s.weight) || 0;
    const r = parseInt(s.reps)    || 0;
    if (w !== curW) { flush(); curW = w > 0 ? w : null; curReps = r > 0 ? [r] : []; }
    else if (r > 0) { curReps.push(r); }
  }
  flush();
  return parts.filter(Boolean).join(' / ') || null;
}

// ── SetPills — compact per-set chips ─────────────────────────────────────────

function SetPills({ exercise, def, fmtWeight }) {
  const done = exercise?.sets?.filter((s) => s.done || s.weight || s.reps || s.time) ?? [];
  if (!done.length) return <Text style={styles.modalSesSummary}>—</Text>;

  const model = def?.progressionModel;

  // Time-based: [30s] [45s]
  if (model === 'time_progression') {
    return (
      <View style={styles.setPillsRow}>
        {done.map((s, i) => (
          <View key={i} style={styles.setPill}>
            <Text style={styles.setPillText}>{s.time ?? '?'}s</Text>
          </View>
        ))}
      </View>
    );
  }

  const weights    = done.map((s) => parseFloat(s.weight) || 0);
  const hasWeight  = weights.some((w) => w > 0);

  // No weight — reps only: [5] [8] [6]
  if (!hasWeight) {
    const chips = done.map((s, i) => {
      const r = parseInt(s.reps) || 0;
      return r > 0 ? (
        <View key={i} style={styles.setPill}>
          <Text style={styles.setPillText}>{r}</Text>
        </View>
      ) : null;
    }).filter(Boolean);
    return <View style={styles.setPillsRow}>{chips}</View>;
  }

  const uniqueWeights = new Set(weights.filter((w) => w > 0));

  // Uniform weight — label + reps chips: 20kg [3] [3] [2]
  if (uniqueWeights.size === 1) {
    const w = [...uniqueWeights][0];
    const chips = done.map((s, i) => {
      const r = parseInt(s.reps) || 0;
      return r > 0 ? (
        <View key={i} style={styles.setPill}>
          <Text style={styles.setPillText}>{r}</Text>
        </View>
      ) : null;
    }).filter(Boolean);
    return (
      <View style={styles.setPillsRow}>
        <Text style={styles.setPillWeight}>{fmtWeight(w)}</Text>
        {chips}
      </View>
    );
  }

  // Varying weight — full chips: [20×3] [25×3]
  const chips = done.map((s, i) => {
    const w = parseFloat(s.weight) || 0;
    const r = parseInt(s.reps)    || 0;
    if (!w && !r) return null;
    const label = w > 0 && r > 0 ? `${fmtWeight(w)}×${r}` : w > 0 ? fmtWeight(w) : `${r}`;
    return (
      <View key={i} style={styles.setPill}>
        <Text style={styles.setPillText}>{label}</Text>
      </View>
    );
  }).filter(Boolean);
  return <View style={styles.setPillsRow}>{chips}</View>;
}

function getSessionTotalVol(session) {
  return session.exercises.reduce((sum, ex) => {
    const done = ex.sets.filter((s) => s.done || s.weight || s.reps);
    return sum + done.reduce((acc, s) => acc + (parseFloat(s.weight) || 0) * (parseInt(s.reps) || 0), 0);
  }, 0);
}

function computeThisWeekCount(log) {
  const now = new Date();
  const mon = new Date(now);
  mon.setHours(0, 0, 0, 0);
  mon.setDate(now.getDate() - (now.getDay() === 0 ? 6 : now.getDay() - 1));
  return log.filter((l) => l.timestamp >= mon.getTime()).length;
}

function computeVolumeImprovePct(filteredLog) {
  if (filteredLog.length < 2) return null;
  const sorted = [...filteredLog].sort((a, b) => a.timestamp - b.timestamp);
  const first  = getSessionTotalVol(sorted[0]);
  const last   = getSessionTotalVol(sorted[sorted.length - 1]);
  if (!first) return null;
  return Math.round((last - first) / first * 100);
}

function computeLastSessionVolume(filteredLog) {
  if (!filteredLog.length) return null;
  const last = [...filteredLog].sort((a, b) => b.timestamp - a.timestamp)[0];
  return getSessionTotalVol(last) || null;
}

function computeLastSessionDelta(filteredLog) {
  if (filteredLog.length < 2) return null;
  const sorted = [...filteredLog].sort((a, b) => a.timestamp - b.timestamp);
  const prev   = getSessionTotalVol(sorted[sorted.length - 2]);
  const last   = getSessionTotalVol(sorted[sorted.length - 1]);
  if (!prev) return null;
  return Math.round((last - prev) / prev * 100);
}

function computeLastLoadDelta(filteredLog, allExercises) {
  if (filteredLog.length < 2) return null;
  const sorted = [...filteredLog].sort((a, b) => a.timestamp - b.timestamp);
  const last   = sorted[sorted.length - 1];
  const prev   = sorted[sorted.length - 2];
  const improvements = [];
  for (const lastEx of last.exercises) {
    const prevEx = prev.exercises.find((e) => e.exerciseId === lastEx.exerciseId);
    if (!prevEx) continue;
    const def    = allExercises[lastEx.exerciseId];
    const model  = def?.progressionModel;
    const metric = model === 'time_progression' ? 'time' : 'kg';
    const lastVal = computeValue(lastEx.sets, metric) ?? computeValue(lastEx.sets, 'reps');
    const prevVal = computeValue(prevEx.sets, metric) ?? computeValue(prevEx.sets, 'reps');
    if (!prevVal || !lastVal || prevVal === 0) continue;
    improvements.push((lastVal - prevVal) / prevVal * 100);
  }
  if (!improvements.length) return null;
  return Math.round(improvements.reduce((a, b) => a + b, 0) / improvements.length);
}

function computeExVolumeImprovePct(logs) {
  if (logs.length < 2) return null;
  const getVol = ({ exercise }) => {
    const done = exercise?.sets?.filter((s) => s.done || s.weight || s.reps) ?? [];
    return done.reduce((sum, s) => sum + (parseFloat(s.weight) || 0) * (parseInt(s.reps) || 0), 0);
  };
  const first = getVol(logs[0]);
  const last  = getVol(logs[logs.length - 1]);
  if (!first) return null;
  return Math.round((last - first) / first * 100);
}

function computeExPR(logs, def) {
  const model  = def?.progressionModel;
  const metric = model === 'time_progression' ? 'time' : 'kg';
  let bestVal  = null;
  let bestTs   = null;
  let bestMet  = metric;
  for (const { timestamp, exercise } of logs) {
    const primary  = computeValue(exercise?.sets, metric);
    const fallback = primary === null ? computeValue(exercise?.sets, 'reps') : null;
    const v        = primary ?? fallback;
    const m        = primary !== null ? metric : 'reps';
    if (v !== null && (bestVal === null || v >= bestVal)) {
      bestVal = v; bestTs = timestamp; bestMet = m;
    }
  }
  return bestVal !== null ? { value: bestVal, timestamp: bestTs, metric: bestMet } : null;
}

function computeExSessionDeltas(logs, def, metricOverride = null) {
  const model     = def?.progressionModel;
  const primaryId = metricOverride
    ?? (model === 'time_progression' ? 'time' : model === 'submax' ? 'reps' : 'kg');
  let bestSoFar   = null;
  return logs.map(({ timestamp, exercise }, i) => {
    const pv       = computeValue(exercise?.sets, primaryId);
    const fv       = pv === null ? computeValue(exercise?.sets, 'reps') : null;
    const val      = pv ?? fv;
    const metricId = pv !== null ? primaryId : (fv !== null ? 'reps' : primaryId);
    const prev     = i > 0
      ? (computeValue(logs[i - 1].exercise?.sets, primaryId) ?? computeValue(logs[i - 1].exercise?.sets, 'reps'))
      : null;
    // Raw absolute delta (same unit as val: kg, reps, or seconds)
    const delta    = prev !== null && val !== null ? val - prev : null;
    const isPR = val !== null && bestSoFar !== null && val > bestSoFar;
    if (val !== null) bestSoFar = bestSoFar === null ? val : Math.max(bestSoFar, val);
    return { timestamp, val, delta, isPR, metricId, exercise };
  });
}

// ── SVG line chart ─────────────────────────────────────────────────────────────

function MiniLineChart({ data, metricLabel }) {
  const [chartW,   setChartW]   = useState(0);
  const [selected, setSelected] = useState(null);

  const scrollRef     = useRef(null);
  const clipWidthAnim = useRef(new Animated.Value(0)).current;
  const yAnims        = useRef(
    Array.from({ length: Y_ANIM_COUNT }, () => new Animated.Value(0))
  ).current;
  const prevLenRef = useRef(0);
  const initRef    = useRef(false);

  useEffect(() => { setSelected(null); }, [data]);

  useEffect(() => { // eslint-disable-line react-hooks/exhaustive-deps
    if (!chartW || data.length < 2) return;
    const needsSc  = data.length > MIN_SCROLL;
    const stepPx   = needsSc ? (chartW - C_PAD_L - C_PAD_R) / (MIN_SCROLL - 1) : 0;
    const pW       = needsSc ? (data.length - 1) * stepPx : Math.max(1, chartW - C_PAD_L - C_PAD_R);
    const sW       = C_PAD_L + pW + C_PAD_R;
    const pH       = CHART_H - PAD_TOP - PAD_BOT;
    const vals     = data.map((d) => d.value);
    const mn       = Math.min(...vals);
    const mx       = Math.max(...vals);
    const rng      = mx - mn || 1;
    const toYi     = (v) => PAD_TOP + pH - ((v - mn) / rng) * pH;
    const ptsI     = data.map((d, i) => ({
      y: toYi(d.value),
      x: C_PAD_L + (i / Math.max(1, data.length - 1)) * pW,
    }));
    const same = ptsI.length === prevLenRef.current;
    prevLenRef.current = ptsI.length;
    if (!initRef.current) {
      ptsI.forEach((p, i) => yAnims[i].setValue(p.y));
      initRef.current = true;
    } else if (same) {
      Animated.parallel(
        ptsI.map((p, i) =>
          Animated.timing(yAnims[i], { toValue: p.y, duration: 500, useNativeDriver: false })
        )
      ).start();
    } else {
      ptsI.forEach((p, i) => yAnims[i].setValue(p.y));
      const startW = needsSc ? sW - chartW : 0;
      clipWidthAnim.setValue(startW);
      Animated.timing(clipWidthAnim, { toValue: sW, duration: 700, useNativeDriver: false }).start();
    }
  }, [data, chartW]); // eslint-disable-line

  useEffect(() => { // eslint-disable-line react-hooks/exhaustive-deps
    if (!chartW || data.length < 2) return;
    const needsSc = data.length > MIN_SCROLL;
    const stepPx  = needsSc ? (chartW - C_PAD_L - C_PAD_R) / (MIN_SCROLL - 1) : 0;
    const pW      = needsSc ? (data.length - 1) * stepPx : Math.max(1, chartW - C_PAD_L - C_PAD_R);
    const sW      = C_PAD_L + pW + C_PAD_R;
    const startW  = needsSc ? sW - chartW : 0;
    clipWidthAnim.setValue(startW);
    Animated.timing(clipWidthAnim, { toValue: sW, duration: 900, useNativeDriver: false }).start();
  }, [chartW]); // eslint-disable-line

  if (data.length < 2) {
    return (
      <View style={styles.chartEmpty}>
        <Text style={styles.chartEmptyText}>Necesitas al menos 2 sesiones en este período.</Text>
      </View>
    );
  }

  const needsScroll = data.length > MIN_SCROLL;
  const plotH       = CHART_H - PAD_TOP - PAD_BOT;
  const stepPx      = needsScroll ? (chartW - C_PAD_L - C_PAD_R) / (MIN_SCROLL - 1) : 0;
  const plotW       = needsScroll ? (data.length - 1) * stepPx : Math.max(1, chartW - C_PAD_L - C_PAD_R);
  const svgW        = C_PAD_L + plotW + C_PAD_R;
  const values      = data.map((d) => d.value);
  const minV        = Math.min(...values);
  const maxV        = Math.max(...values);
  const range       = maxV - minV || 1;
  const toX         = (i) => C_PAD_L + (i / Math.max(1, data.length - 1)) * plotW;
  const toY         = (v) => PAD_TOP  + plotH - ((v - minV) / range) * plotH;
  const pts         = data.map((d, i) => ({ i, x: toX(i), y: toY(d.value), date: d.date, value: d.value }));
  const yTicks      = range === 0
    ? [{ v: minV, y: toY(minV) }]
    : [0, 1, 2, 3].map((k) => { const v = minV + (range / 3) * k; return { v: Math.round(v * 10) / 10, y: toY(v) }; });

  const valueText  = selected ? `${fmtAxisVal(selected.value)}${metricLabel ? ` ${metricLabel}` : ''}` : '';
  const dateText   = selected ? selected.date : '';
  const datePxW    = dateText.length  * 4.5;
  const valuePxW   = valueText.length * 6.5;
  const TW         = Math.max(56, Math.ceil(Math.max(datePxW, valuePxW) + 20));
  const TH         = 36;
  const tooltipX   = selected
    ? (needsScroll ? selected.x : Math.min(Math.max(selected.x, TW / 2 + 2), chartW - TW / 2 - 2))
    : 0;
  const tooltipY   = selected ? (selected.y - TH - 14 >= PAD_TOP ? selected.y - TH - 14 : selected.y + 14) : 0;

  const handlePress = (e) => {
    const { locationX, locationY } = e.nativeEvent;
    const hit = pts.find((p) => Math.hypot(p.x - locationX, p.y - locationY) < 22);
    setSelected(hit && hit.i !== selected?.i ? hit : null);
  };

  return (
    <View style={styles.chartRow}>
      <View style={[styles.yAxisArea, { height: CHART_H }]}>
        {yTicks.map(({ v, y }, i) => (
          <Text key={i} style={[styles.yAxisLabel, { top: y - 4 }]}>{fmtAxisVal(v)}</Text>
        ))}
      </View>
      <View style={styles.chartContentArea} onLayout={(e) => setChartW(e.nativeEvent.layout.width)}>
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
                  {/* Grid lines */}
                  {yTicks.map(({ y }, i) => (
                    <Line key={`grid-${i}`} x1={C_PAD_L} y1={y} x2={svgW - C_PAD_R} y2={y}
                      stroke={colors.border} strokeWidth={0.5} opacity={0.5}
                    />
                  ))}
                  {pts.slice(1).map((_, segI) => (
                    <AnimatedLine key={segI}
                      x1={pts[segI].x} y1={yAnims[segI]}
                      x2={pts[segI + 1].x} y2={yAnims[segI + 1]}
                      stroke={colors.accent} strokeWidth={1.5}
                    />
                  ))}
                  {pts.map((p, i) => {
                    const isSel = selected?.i === i;
                    return (
                      <AnimatedCircle key={i} cx={p.x} cy={yAnims[i]}
                        r={isSel ? 6 : 4} fill={colors.accent}
                        stroke={isSel ? colors.bg : 'none'} strokeWidth={isSel ? 2 : 0}
                      />
                    );
                  })}
                </Svg>
              </Animated.View>
              <Svg style={StyleSheet.absoluteFill} width={svgW} height={CHART_H} pointerEvents="none">
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
                    <Rect x={tooltipX - TW / 2} y={tooltipY} width={TW} height={TH}
                      fill={colors.surface2} stroke={colors.border} strokeWidth={1} rx={4} />
                    <SvgText x={tooltipX - datePxW / 2}  y={tooltipY + 13} fontSize={8}  fill={colors.muted}  textAnchor="start">{selected.date}</SvgText>
                    <SvgText x={tooltipX - valuePxW / 2} y={tooltipY + 28} fontSize={11} fill={colors.accent} textAnchor="start">
                      {fmtAxisVal(selected.value)}{metricLabel ? ` ${metricLabel}` : ''}
                    </SvgText>
                  </G>
                )}
              </Svg>
              {/* Tap layer for point selection — a Pressable (not Svg onPress) so
                  vertical drags are released to the parent ScrollView and scroll. */}
              <Pressable style={StyleSheet.absoluteFill} onPress={handlePress} />
            </View>
          </ScrollView>
        )}
      </View>
    </View>
  );
}

// ── ExerciseDetailModal ────────────────────────────────────────────────────────

function ExerciseDetailModal({ visible, onClose, exerciseId, def: initDef, rawLogs: initRawLogs, programTemplateIds }) {
  const insets = useSafeAreaInsets();
  const { i18n } = useTranslation();
  const { label: weightLabel, toDisplay: wDisplay, fmt: fmtWeight } = useWeightUnit();

  const [modalPeriod, setModalPeriod] = useState('all');
  const [modalScope,  setModalScope]  = useState('all');
  const [chartMetric, setChartMetric] = useState(null);
  const [pctMode,     setPctMode]     = useState(false);

  // ── Exercise picker ────────────────────────────────────────────────────────
  const workoutLog_      = useStore((s) => s.workoutLog);
  const exerciseLibrary_ = useStore((s) => s.exerciseLibrary);
  const customExercises_ = useStore((s) => s.customExercises);
  const allEx = useMemo(
    () => ({ ...exerciseLibrary_, ...customExercises_ }),
    [exerciseLibrary_, customExercises_]
  );

  const [activeId,       setActiveId]       = useState(exerciseId ?? null);
  const [pickerMounted,  setPickerMounted]  = useState(false);
  const [exPickerSearch, setExPickerSearch] = useState('');

  // Animated values for picker open/close and content fade
  const pickerAnim     = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(1)).current;

  const arrowRotation    = pickerAnim.interpolate({ inputRange: [0, 1], outputRange: ['90deg', '-90deg'] });
  const pickerTranslateY = pickerAnim.interpolate({ inputRange: [0, 1], outputRange: [-10, 0], extrapolate: 'clamp' });

  function openPicker() {
    setPickerMounted(true);
    Animated.spring(pickerAnim, { toValue: 1, useNativeDriver: true, tension: 80, friction: 12 }).start();
  }

  function closePicker(onDone) {
    Animated.timing(pickerAnim, { toValue: 0, duration: 160, useNativeDriver: true })
      .start(({ finished }) => { if (finished) setPickerMounted(false); onDone?.(); });
  }

  function togglePicker() { if (pickerMounted) closePicker(); else openPicker(); }

  function switchExercise(id) {
    // Close picker
    Animated.timing(pickerAnim, { toValue: 0, duration: 160, useNativeDriver: true })
      .start(({ finished }) => { if (finished) setPickerMounted(false); });

    // useNativeDriver: false keeps opacity on the JS thread, ensuring it stays at 0
    // when React re-renders the new exercise content (no native thread race condition).
    // requestAnimationFrame gives React one frame to commit the new content before
    // starting the fade-in, preventing the flash.
    Animated.timing(contentOpacity, { toValue: 0, duration: 130, useNativeDriver: false })
      .start(() => {
        contentOpacity.setValue(0); // guarantee value is 0 before state update
        setActiveId(id);
        setExPickerSearch('');
        requestAnimationFrame(() => {
          Animated.timing(contentOpacity, { toValue: 1, duration: 220, useNativeDriver: false }).start();
        });
      });
  }

  // Reset filters when exercise switches
  useEffect(() => {
    setModalPeriod('all'); setModalScope('all'); setPctMode(false); setChartMetric(null);
  }, [activeId]);

  // All exercises that have at least one log entry, sorted alphabetically
  const pickerExercises = useMemo(() => {
    const ids = new Set();
    workoutLog_.forEach((e) => e.exercises?.forEach((ex) => ids.add(ex.exerciseId)));
    const getN = (id) => { const d = allEx[id]; return d ? (i18n.language === 'en' ? (d.nameEn ?? d.name) : d.name) : id; };
    return [...ids].sort((a, b) => getN(a).localeCompare(getN(b)));
  }, [workoutLog_, allEx, i18n.language]);

  const pickerFiltered = useMemo(() => {
    if (!exPickerSearch.trim()) return pickerExercises;
    const q = exPickerSearch.trim().toLowerCase();
    const getN = (id) => { const d = allEx[id]; return d ? (i18n.language === 'en' ? (d.nameEn ?? d.name) : d.name) : id; };
    return pickerExercises.filter((id) => getN(id).toLowerCase().includes(q));
  }, [pickerExercises, exPickerSearch, allEx, i18n.language]);

  // Shadow `def` and `rawLogs` — all downstream memos update automatically
  const def     = useMemo(() => (activeId ? allEx[activeId] : null) ?? initDef, [activeId, allEx, initDef]);
  const rawLogs = useMemo(
    () => (activeId && activeId !== exerciseId)
      ? getExerciseLogsFrom(activeId, workoutLog_)
      : (initRawLogs ?? []),
    [activeId, exerciseId, workoutLog_, initRawLogs]
  );

  // Header height — measured via onLayout so the floating picker can position correctly
  const [headerH, setHeaderH] = useState(84);

  const translateY      = useRef(new Animated.Value(0)).current;
  const backdropOpacity = translateY.interpolate({
    inputRange: [0, 300], outputRange: [1, 0], extrapolate: 'clamp',
  });
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gs) => {
        if (gs.dy > 0) translateY.setValue(gs.dy);
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > 120 || gs.vy > 0.8) {
          Animated.timing(translateY, {
            toValue: 900, duration: 240, useNativeDriver: true,
          }).start(() => { onClose(); });
        } else {
          Animated.spring(translateY, {
            toValue: 0, useNativeDriver: true, tension: 80, friction: 10,
          }).start();
        }
      },
    })
  ).current;

  useEffect(() => {
    if (visible) {
      setActiveId(exerciseId ?? null);
      setPickerMounted(false);
      setExPickerSearch('');
      pickerAnim.setValue(0);
      contentOpacity.setValue(1);
      translateY.setValue(700);
      Animated.spring(translateY, {
        toValue: 0, useNativeDriver: true, tension: 65, friction: 11,
      }).start();
    }
  }, [visible]);

  const baseLogs = rawLogs ?? [];
  const name = def ? (i18n.language === 'en' ? (def.nameEn ?? def.name) : def.name) : '—';

  const effectiveLogs = useMemo(() => {
    if (modalScope !== 'program' || !programTemplateIds?.size) return baseLogs;
    return baseLogs.filter((l) => programTemplateIds.has(l.sessionTemplateId));
  }, [baseLogs, modalScope, programTemplateIds]);

  const filteredLogs = useMemo(() => {
    if (modalPeriod === 'all') return effectiveLogs;
    const days   = modalPeriod === '7d' ? 7 : modalPeriod === '1m' ? 30 : modalPeriod === '3m' ? 90 : 365;
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    return effectiveLogs.filter(({ timestamp }) => timestamp >= cutoff);
  }, [effectiveLogs, modalPeriod]);

  const metrics      = useMemo(() => getMetrics(def, effectiveLogs, weightLabel), [def, effectiveLogs, weightLabel]);
  const activeMetric = chartMetric ?? metrics[0]?.id;
  const metricLabel  = pctMode ? '%' : (metrics.find((m) => m.id === activeMetric)?.label ?? '');

  const loadImprovePct   = useMemo(() => computeExerciseImprovement(filteredLogs, def), [filteredLogs, def]);
  const lastSesLoadDelta = useMemo(() => {
    if (filteredLogs.length < 2) return null;
    const primId = def?.progressionModel === 'time_progression' ? 'time' : 'kg';
    const last = computeValue(filteredLogs[filteredLogs.length - 1].exercise?.sets, primId)
      ?? computeValue(filteredLogs[filteredLogs.length - 1].exercise?.sets, 'reps');
    const prev = computeValue(filteredLogs[filteredLogs.length - 2].exercise?.sets, primId)
      ?? computeValue(filteredLogs[filteredLogs.length - 2].exercise?.sets, 'reps');
    if (last === null || prev === null) return null;
    return last - prev;
  }, [filteredLogs, def]);

  const volImprovePct  = useMemo(() => computeExVolumeImprovePct(filteredLogs), [filteredLogs]);
  const lastSesVolDelta = useMemo(() => {
    if (filteredLogs.length < 2) return null;
    const getVol = ({ exercise }) => {
      const done = exercise?.sets?.filter((s) => s.done || s.weight || s.reps) ?? [];
      return done.reduce((sum, s) => sum + (parseFloat(s.weight) || 0) * (parseInt(s.reps) || 0), 0);
    };
    return Math.round(getVol(filteredLogs[filteredLogs.length - 1]) - getVol(filteredLogs[filteredLogs.length - 2]));
  }, [filteredLogs]);

  const prData        = useMemo(() => computeExPR(effectiveLogs, def), [effectiveLogs, def]);
  // Session deltas follow the metric selected on the chart — the whole modal
  // "thinks" in one metric at a time.
  const sessionDeltas = useMemo(
    () => computeExSessionDeltas(filteredLogs, def, activeMetric),
    [filteredLogs, def, activeMetric]
  );
  // Current-ability estimate: best e1RM over the last 6 weeks (scope-filtered,
  // independent of the period filter so a short period doesn't blank the tile).
  const e1rmData = useMemo(() => recentE1RM(effectiveLogs), [effectiveLogs]);

  const chartData = useMemo(() => {
    const needsConv = activeMetric === 'kg' || activeMetric === 'vol' || activeMetric === 'e1rm';
    const rawData = filteredLogs
      .map(({ timestamp, exercise }) => {
        const raw   = computeValue(exercise?.sets, activeMetric);
        const value = raw !== null && needsConv
          ? (activeMetric === 'vol' ? Math.round(wDisplay(1) * raw * 10) / 10 : wDisplay(raw))
          : raw;
        return {
          date: new Date(timestamp).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }),
          value,
        };
      })
      .filter((d) => d.value !== null);
    if (pctMode && rawData.length >= 1 && rawData[0].value) {
      const first = rawData[0].value;
      return rawData.map((d, i) => ({
        ...d,
        value: i === 0 ? 0 : Math.round((d.value - first) / first * 100 * 10) / 10,
      }));
    }
    return rawData;
  }, [filteredLogs, activeMetric, wDisplay, pctMode]);

  const loadImpStr   = loadImprovePct !== null ? `${loadImprovePct > 0 ? '+' : ''}${loadImprovePct}%` : '—';
  const loadImpColor = loadImprovePct !== null ? (loadImprovePct >= 0 ? colors.green : colors.orange) : colors.muted;
  const lastLoadSubStr = (() => {
    if (lastSesLoadDelta === null) return null;
    const sign = lastSesLoadDelta >= 0 ? '+' : '−';
    const abs  = Math.abs(lastSesLoadDelta);
    const model = def?.progressionModel;
    if (model === 'time_progression') return `${sign}${abs}s últ.`;
    const hasWeight = filteredLogs.length > 0 &&
      computeValue(filteredLogs[filteredLogs.length - 1]?.exercise?.sets, 'kg') !== null;
    return hasWeight ? `${sign}${fmtWeight(abs)} últ.` : `${sign}${abs} reps últ.`;
  })();

  const volImpStr   = volImprovePct !== null ? `${volImprovePct > 0 ? '+' : ''}${volImprovePct}%` : '—';
  const volImpColor = volImprovePct !== null ? (volImprovePct >= 0 ? colors.green : colors.orange) : colors.muted;
  const lastVolSubStr = (() => {
    if (lastSesVolDelta === null) return null;
    const sign = lastSesVolDelta >= 0 ? '+' : '−';
    const abs  = Math.abs(lastSesVolDelta);
    return `${sign}${fmtVol(abs, wDisplay)} ${weightLabel} últ.`;
  })();

  const prDisplay = prData
    ? (prData.metric === 'time' ? `${prData.value}s` : prData.metric === 'kg' ? fmtWeight(prData.value) : `${prData.value} reps`)
    : null;
  const prAgoStr  = timeAgo(prData?.timestamp);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      {/* Backdrop — opacidad sincronizada con el gesto de arrastre */}
      <Animated.View
        style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.82)', opacity: backdropOpacity }]}
        pointerEvents="box-none"
      >
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />
      </Animated.View>
      {/* Layout shell — posiciona el sheet en la parte inferior */}
      <View style={styles.modalOverlay} pointerEvents="box-none">
        <Animated.View
          style={[styles.modalSheet, { paddingBottom: insets.bottom + spacing.lg, transform: [{ translateY }] }]}
          onStartShouldSetResponder={() => true}
        >
          {/* Drag zone: handle indicator + header */}
          <View
            {...panResponder.panHandlers}
            onLayout={(e) => setHeaderH(e.nativeEvent.layout.height)}
          >
            <View style={styles.dragHandleWrap}>
              <View style={styles.dragHandle} />
            </View>
            <View style={styles.modalHeader}>
              {/* Dropdown trigger — styled as a select box */}
              <TouchableOpacity
                style={[styles.modalTitleBtn, pickerMounted && styles.modalTitleBtnOpen]}
                onPress={togglePicker}
                activeOpacity={0.8}
              >
                <Text style={styles.modalTitle} numberOfLines={1}>{name}</Text>
                <Animated.Text style={[styles.modalTitleArrow, pickerMounted && styles.modalTitleArrowOpen, { transform: [{ rotate: arrowRotation }] }]}>
                  ›
                </Animated.Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={onClose} hitSlop={12} style={styles.modalCloseBtn}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Exercise picker — floats OVER the content, does not push it down */}
          {pickerMounted && (
            <Animated.View style={[styles.exPicker, { top: headerH, opacity: pickerAnim, transform: [{ translateY: pickerTranslateY }] }]}>
              <TextInput
                style={styles.exPickerSearch}
                placeholder="Buscar ejercicio..."
                placeholderTextColor={colors.muted}
                value={exPickerSearch}
                onChangeText={setExPickerSearch}
                autoCorrect={false}
                autoCapitalize="none"
              />
              <ScrollView style={styles.exPickerList} nestedScrollEnabled showsVerticalScrollIndicator={false}>
                {pickerFiltered.map((id) => {
                  const d = allEx[id];
                  const exName = d ? (i18n.language === 'en' ? (d.nameEn ?? d.name) : d.name) : id;
                  const isActive = id === activeId;
                  return (
                    <TouchableOpacity
                      key={id}
                      style={[styles.exPickerItem, isActive && styles.exPickerItemActive]}
                      onPress={() => switchExercise(id)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.exPickerItemText, isActive && styles.exPickerItemTextActive]} numberOfLines={1}>
                        {isActive ? '✓  ' : ''}{exName}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </Animated.View>
          )}

          {/* Content fades out/in when switching exercises */}
          <Animated.View style={[styles.flex, { opacity: contentOpacity }]}>
          <ScrollView showsVerticalScrollIndicator={false} nestedScrollEnabled>
            {/* Period + scope filters */}
            <View style={styles.modalFiltersRow}>
              {PERIOD_OPTIONS.map(({ id, label }) => (
                <TouchableOpacity
                  key={id}
                  style={[styles.ctrlBtn, modalPeriod === id && styles.ctrlBtnActive]}
                  onPress={() => setModalPeriod(id)}
                >
                  <Text style={[styles.ctrlBtnText, modalPeriod === id && styles.ctrlBtnTextActive]}>{label}</Text>
                </TouchableOpacity>
              ))}
              <View style={{ flex: 1 }} />
              {programTemplateIds?.size > 0 && (
                <TouchableOpacity
                  style={[styles.scopeToggle, modalScope === 'program' && styles.scopeToggleActive]}
                  onPress={() => setModalScope((s) => s === 'program' ? 'all' : 'program')}
                >
                  <Text style={[styles.scopeToggleText, modalScope === 'program' && styles.scopeToggleTextActive]}>
                    Programa actual
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* 3 stat tiles — order: 1RM est. (o PR) · Carga · Volumen */}
            <View style={styles.modalStatRow}>
              <View style={styles.modalStatTile}>
                {e1rmData ? (
                  <>
                    <Text style={[styles.modalStatValue, { color: colors.accent }]}>
                      {fmtWeight(Math.round(e1rmData.value * 10) / 10)}
                    </Text>
                    <Text style={styles.modalStatLabel}>1RM EST.</Text>
                    <Text style={styles.modalStatSub} numberOfLines={1}>
                      {prDisplay ? `PR ${prDisplay} · ${prAgoStr ?? ''}` : '—'}
                    </Text>
                  </>
                ) : (
                  <>
                    <Text style={[styles.modalStatValue, { color: colors.accent }]}>{prDisplay ?? '—'}</Text>
                    <Text style={styles.modalStatLabel}>PR</Text>
                    <Text style={styles.modalStatSub} numberOfLines={1}>{prAgoStr ?? '—'}</Text>
                  </>
                )}
              </View>
              <View style={styles.modalStatTile}>
                <Text style={[styles.modalStatValue, { color: loadImpColor }]}>{loadImpStr}</Text>
                <Text style={styles.modalStatLabel}>Carga</Text>
                <Text style={styles.modalStatSub} numberOfLines={1}>{lastLoadSubStr ?? '—'}</Text>
              </View>
              <View style={styles.modalStatTile}>
                <Text style={[styles.modalStatValue, { color: volImpColor }]}>{volImpStr}</Text>
                <Text style={styles.modalStatLabel}>Volumen</Text>
                <Text style={styles.modalStatSub} numberOfLines={1}>{lastVolSubStr ?? '—'}</Text>
              </View>
            </View>

            {/* Chart controls + chart */}
            <View style={styles.chartSection}>
              <View style={styles.chartControls}>
                <View style={styles.btnGroup}>
                  {metrics.length > 1 && metrics.map(({ id, label }) => (
                    <TouchableOpacity
                      key={id}
                      style={[styles.ctrlBtn, styles.ctrlBtnFull, activeMetric === id && styles.ctrlBtnActive]}
                      onPress={() => { setChartMetric(id); setPctMode(false); }}
                    >
                      <Text style={[styles.ctrlBtnText, activeMetric === id && styles.ctrlBtnTextActive]}>
                        {label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <MiniLineChart data={chartData} metricLabel={metricLabel} />
            </View>

            {/* Session list */}
            <View style={styles.modalSesSection}>
              <Text style={styles.modalSesSectionLabel}>SESIONES</Text>
              {[...sessionDeltas].reverse().map(({ timestamp, val, delta, isPR, metricId, exercise }) => {
                const deltaColor = delta !== null ? (delta >= 0 ? colors.green : colors.orange) : colors.muted;
                const deltaStr  = delta !== null ? (() => {
                  const sign = delta > 0 ? '+' : '';
                  if (metricId === 'kg' || metricId === 'e1rm') {
                    const abs = Math.abs(delta);
                    const rounded = abs % 1 === 0 ? abs : Math.round(abs * 10) / 10;
                    return `${sign}${delta < 0 ? '-' : ''}${fmtWeight(rounded)}`;
                  }
                  if (metricId === 'time') return `${sign}${Math.round(delta)}s`;
                  if (metricId === 'vol') {
                    return `${delta >= 0 ? '+' : '−'}${fmtVol(Math.abs(delta), wDisplay)} ${weightLabel}`;
                  }
                  return `${sign}${Math.round(delta)} reps`;
                })() : null;
                return (
                  <View key={timestamp} style={styles.modalSesRow}>
                    <View style={styles.modalSesLeft}>
                      <Text style={styles.modalSesDate}>{formatDate(timestamp)}</Text>
                      {deltaStr !== null && (
                        <Text style={[styles.modalSesDelta, { color: deltaColor }]}>
                          {deltaStr}
                        </Text>
                      )}
                    </View>
                    {isPR && (
                      <View style={styles.prPill}>
                        <Text style={styles.prPillText}>PR</Text>
                      </View>
                    )}
                    <SetPills exercise={exercise} def={def} fmtWeight={fmtWeight} />
                  </View>
                );
              })}
              {sessionDeltas.length === 0 && (
                <Text style={styles.modalSesEmpty}>Sin sesiones en este período.</Text>
              )}
            </View>
          </ScrollView>
          </Animated.View>{/* content opacity wrapper */}
        </Animated.View>{/* modal sheet */}
      </View>
    </Modal>
  );
}

// ── ExerciseStatCard ───────────────────────────────────────────────────────────

function ExerciseStatCard({ exerciseId, def, allLogs, periodLogs, rawLogs, programTemplateIds }) {
  const { i18n } = useTranslation();
  const [modalVisible, setModalVisible] = useState(false);

  const effectiveLogs  = allLogs ?? periodLogs ?? [];
  const sessionsCount  = (periodLogs ?? effectiveLogs).length;
  const name           = def ? (i18n.language === 'en' ? (def.nameEn ?? def.name) : def.name) : '—';
  const improvePct     = useMemo(
    () => computeExerciseImprovement(periodLogs ?? effectiveLogs, def),
    [periodLogs, effectiveLogs, def]
  );

  if (!effectiveLogs.length) return null;

  return (
    <View style={styles.exCard}>
      <TouchableOpacity
        style={styles.exRow}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.72}
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.exName} numberOfLines={1}>{name}</Text>
          <Text style={styles.exSub}>
            {`${sessionsCount} ${sessionsCount === 1 ? 'sesión' : 'sesiones'}`}
            {improvePct !== null && (
              <Text>
                {' · '}
                <Text style={{ color: improvePct >= 0 ? colors.green : colors.orange }}>
                  {`${improvePct > 0 ? '+' : ''}${improvePct}%`}
                </Text>
                {' progreso'}
              </Text>
            )}
          </Text>
        </View>
        <View style={styles.verBtn}>
          <Text style={styles.verBtnText}>ver</Text>
        </View>
      </TouchableOpacity>

      <ExerciseDetailModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        exerciseId={exerciseId}
        def={def}
        rawLogs={rawLogs ?? allLogs}
        programTemplateIds={programTemplateIds}
      />
    </View>
  );
}

// ── ProgressTab ────────────────────────────────────────────────────────────────

export default function ProgressTab({ baseLog, programTemplateIds, allExercises, onRefresh, refreshing = false }) {
  const insets = useSafeAreaInsets();
  const { i18n } = useTranslation();
  const { fmt: fmtWeight, toDisplay: wDisplay, label: weightLabel } = useWeightUnit();
  const getEffectiveTemplate = useStore((s) => s.getEffectiveTemplate);

  const [scope,         setScope]         = useState('all');
  const [period,        setPeriod]        = useState('all');
  const [search,        setSearch]        = useState('');
  const [selectedExIds, setSelectedExIds] = useState(new Set());
  const [dropOpen,      setDropOpen]      = useState(false);
  const [dropPos,       setDropPos]       = useState({ top: 0, left: 0, width: 300 });
  const dropBtnRef = useRef(null);

  useEffect(() => { setSelectedExIds(new Set()); setDropOpen(false); }, [scope, period]);

  function openDrop() {
    dropBtnRef.current?.measure((_x, _y, width, height, pageX, pageY) => {
      setDropPos({ top: pageY + height + 4, left: pageX, width });
      setDropOpen(true);
    });
  }

  function toggleEx(id) {
    setSelectedExIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const hasProgramScope = programTemplateIds?.size > 0;

  // Exercises in the active program (for scope='program' filtering of exercise list)
  const programExerciseIds = useMemo(() => {
    if (!hasProgramScope) return new Set();
    return new Set(
      [...programTemplateIds].flatMap((id) => {
        const tpl = getEffectiveTemplate(id);
        return tpl?.exercises.map((e) => e.exerciseId) ?? [];
      })
    );
  }, [programTemplateIds, hasProgramScope, getEffectiveTemplate]);

  // Logs filtered by scope + period (for summary tiles and exercise cards)
  const filteredLog = useMemo(
    () => filterLog(baseLog, scope, period, programTemplateIds ?? new Set()),
    [baseLog, scope, period, programTemplateIds]
  );

  // Logs filtered by scope only (no period) — for modal rawLogs baseline
  const filteredLogScope = useMemo(
    () => filterLog(baseLog, scope, 'all', programTemplateIds ?? new Set()),
    [baseLog, scope, programTemplateIds]
  );

  // ── Summary stats ────────────────────────────────────────────────────────
  const thisWeekCount = useMemo(() => computeThisWeekCount(baseLog), [baseLog]);

  const improvePct = useMemo(
    () => computeOverallImprovement(filteredLog, allExercises),
    [filteredLog, allExercises]
  );
  const lastLoadDelta = useMemo(
    () => computeLastLoadDelta(filteredLog, allExercises),
    [filteredLog, allExercises]
  );
  const volImprovePct = useMemo(() => computeVolumeImprovePct(filteredLog), [filteredLog]);
  const lastSesVol    = useMemo(() => computeLastSessionVolume(filteredLog), [filteredLog]);
  const lastSesDelta  = useMemo(() => computeLastSessionDelta(filteredLog), [filteredLog]);

  // Display strings
  const improveStr   = improvePct !== null ? `${improvePct > 0 ? '+' : ''}${improvePct}%` : '—';
  const improveColor = improvePct !== null ? (improvePct >= 0 ? colors.green : colors.orange) : colors.muted;
  const loadSubArrow = lastLoadDelta === null ? '→' : lastLoadDelta >= 0 ? '↑' : '↓';
  const loadSubStr   = lastLoadDelta !== null
    ? `${loadSubArrow} ${lastLoadDelta > 0 ? '+' : ''}${lastLoadDelta}% últ. ses.`
    : null;
  const loadSubColor = lastLoadDelta !== null ? (lastLoadDelta >= 0 ? colors.green : colors.orange) : colors.muted;

  const volStr      = volImprovePct !== null ? `${volImprovePct > 0 ? '+' : ''}${volImprovePct}%` : '—';
  const volColor    = volImprovePct !== null ? (volImprovePct >= 0 ? colors.green : colors.orange) : colors.muted;
  const volSubArrow = lastSesDelta === null ? '→' : lastSesDelta >= 0 ? '↑' : '↓';
  const volSubColor = lastSesDelta !== null ? (lastSesDelta >= 0 ? colors.green : colors.orange) : colors.muted;
  const volSubStr   = lastSesVol
    ? `${volSubArrow} ${fmtVol(lastSesVol, wDisplay)} ${weightLabel} últ. ses.`
    : null;

  // ── Exercise list ────────────────────────────────────────────────────────
  const exercisesWithLogs = useMemo(() => {
    const allIds = [...new Set(
      filteredLog.flatMap((log) =>
        log.exercises
          .filter((e) => e.sets.some((s) => s.done || s.weight || s.reps || s.time))
          .map((e) => e.exerciseId)
      )
    )];
    const scoped = (scope === 'program' && hasProgramScope)
      ? allIds.filter((id) => programExerciseIds.has(id))
      : allIds;
    return scoped.filter((id) => getExerciseLogsFrom(id, filteredLog).length > 0);
  }, [filteredLog, scope, hasProgramScope, programExerciseIds]);

  const displayedExercises = useMemo(() => {
    const base = selectedExIds.size > 0
      ? exercisesWithLogs.filter((id) => selectedExIds.has(id))
      : exercisesWithLogs;

    if (!search.trim()) return base;
    const q = search.trim().toLowerCase();
    const matching = base.filter((id) => {
      const def  = allExercises[id];
      const name = def ? (i18n.language === 'en' ? (def.nameEn ?? def.name) : def.name) : id;
      return name.toLowerCase().includes(q);
    });
    if (q.length >= 3) return matching;
    const rest = base.filter((id) => !matching.includes(id));
    return [...matching, ...rest];
  }, [exercisesWithLogs, selectedExIds, search, allExercises, i18n.language]);

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[styles.content, { paddingBottom: spacing.xxl + insets.bottom }]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      refreshControl={onRefresh ? (
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.accent}
          colors={[colors.accent]}
        />
      ) : undefined}
    >
      {/* ── Fila única: Período + toggle programa ────────────────────────── */}
      <View style={styles.topRow}>
        {PERIOD_OPTIONS.map(({ id, label }) => (
          <TouchableOpacity
            key={id}
            style={[styles.ctrlBtn, period === id && styles.ctrlBtnActive]}
            onPress={() => setPeriod(id)}
          >
            <Text style={[styles.ctrlBtnText, period === id && styles.ctrlBtnTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
        <View style={{ flex: 1 }} />
        {hasProgramScope && (
          <TouchableOpacity
            style={[styles.scopeToggle, scope === 'program' && styles.scopeToggleActive]}
            onPress={() => setScope((s) => s === 'program' ? 'all' : 'program')}
          >
            <Text style={[styles.scopeToggleText, scope === 'program' && styles.scopeToggleTextActive]}>
              Programa actual
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Tiles resumen ─────────────────────────────────────────────────── */}
      <View style={styles.statsGrid}>
        <View style={styles.statTile}>
          <Text style={styles.statValue}>{filteredLog.length}</Text>
          <Text style={styles.statLabel}>Sesiones</Text>
          <Text style={styles.statSub}>{thisWeekCount} esta semana</Text>
        </View>
        <View style={styles.statTile}>
          <Text style={[styles.statValue, { color: improveColor }]}>{improveStr}</Text>
          <Text style={styles.statLabel}>Carga</Text>
          <Text style={[styles.statSub, { color: loadSubColor }]} numberOfLines={1}>
            {loadSubStr ?? '—'}
          </Text>
        </View>
        <View style={styles.statTile}>
          <Text style={[styles.statValue, { color: volColor }]}>{volStr}</Text>
          <Text style={styles.statLabel}>Volumen</Text>
          <Text style={[styles.statSub, { color: volSubColor }]} numberOfLines={1}>
            {volSubStr ?? '—'}
          </Text>
        </View>
      </View>

      {/* ── Ejercicios ────────────────────────────────────────────────────── */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionLabel}>EJERCICIOS</Text>
        <Text style={styles.sectionCount}>{exercisesWithLogs.length}</Text>
      </View>

      {/* ── Búsqueda ──────────────────────────────────────────────────────── */}
      <TextInput
        style={styles.searchInput}
        placeholder="Buscar ejercicio..."
        placeholderTextColor={colors.muted}
        value={search}
        onChangeText={setSearch}
        autoCorrect={false}
        autoCapitalize="none"
      />

      {/* Selector multi-ejercicio */}
      {!search.trim() && exercisesWithLogs.length > 0 && (
        <View style={styles.dropWrapper}>
          <TouchableOpacity
            ref={dropBtnRef}
            style={styles.dropBtn}
            onPress={dropOpen ? () => setDropOpen(false) : openDrop}
            activeOpacity={0.75}
          >
            <Text style={styles.dropBtnText}>
              {selectedExIds.size === 0
                ? 'Todos los ejercicios'
                : `${selectedExIds.size} ejercicio${selectedExIds.size > 1 ? 's' : ''} seleccionado${selectedExIds.size > 1 ? 's' : ''}`}
            </Text>
            <Text style={styles.dropArrow}>{dropOpen ? '▴' : '▾'}</Text>
          </TouchableOpacity>

          {/* Modal so the list floats over ALL content without stealing scroll from the parent */}
          <Modal
            visible={dropOpen}
            transparent
            animationType="none"
            onRequestClose={() => setDropOpen(false)}
          >
            {/* Backdrop — closes on tap outside */}
            <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setDropOpen(false)} />
            <View style={[styles.dropList, { top: dropPos.top, left: dropPos.left, width: dropPos.width }]}>
              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 320 }}>
                {exercisesWithLogs.map((id) => {
                  const def  = allExercises[id];
                  const name = def
                    ? (i18n.language === 'en' ? (def.nameEn ?? def.name) : def.name)
                    : id;
                  const isSel = selectedExIds.has(id);
                  return (
                    <TouchableOpacity
                      key={id}
                      style={styles.dropItem}
                      onPress={() => toggleEx(id)}
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
              {selectedExIds.size > 0 && (
                <TouchableOpacity
                  style={styles.dropResetBtn}
                  onPress={() => { setSelectedExIds(new Set()); setDropOpen(false); }}
                  activeOpacity={0.75}
                >
                  <Text style={styles.dropResetText}>Restablecer selección</Text>
                </TouchableOpacity>
              )}
            </View>
          </Modal>
        </View>
      )}

      {/* Lista de ejercicios */}
      {displayedExercises.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📈</Text>
          <Text style={styles.emptyText}>
            {baseLog.length === 0
              ? 'Completa tu primera sesión para ver el progreso aquí.'
              : search.trim()
                ? 'Sin coincidencias para esa búsqueda.'
                : 'Sin datos para el filtro seleccionado.'}
          </Text>
        </View>
      ) : (
        <View style={styles.exerciseList}>
          {displayedExercises.map((exerciseId) => {
            const def        = allExercises[exerciseId];
            const periodLogs = getExerciseLogsFrom(exerciseId, filteredLog);
            const allLogs    = getExerciseLogsFrom(exerciseId, filteredLogScope);
            const rawLogs    = getExerciseLogsFrom(exerciseId, baseLog);
            return (
              <ExerciseStatCard
                key={exerciseId}
                exerciseId={exerciseId}
                def={def}
                allLogs={allLogs}
                periodLogs={periodLogs}
                rawLogs={rawLogs}
                programTemplateIds={programTemplateIds}
              />
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex:    { flex: 1 },
  content: { padding: spacing.xl, gap: spacing.md },

  // ── Top row ────────────────────────────────────────────────────────────────
  topRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },

  // ── Shared control button ──────────────────────────────────────────────────
  ctrlBtn: {
    paddingVertical:   spacing.sm,
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
  ctrlBtnText:       { fontSize: typography.sm, color: colors.muted, fontWeight: typography.regular },
  ctrlBtnTextActive: { color: colors.accent },
  btnGroup:          { flexDirection: 'row', gap: spacing.xs, flex: 1 },
  ctrlBtnFull:       { flex: 1, alignItems: 'center', paddingVertical: spacing.xs + 1 },

  // ── Scope toggle ────────────────────────────────────────────────────────────
  scopeToggle: {
    paddingVertical:   spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius:      radius.sm,
    borderWidth:       borders.thin,
    borderColor:       colors.border,
    backgroundColor:   colors.surface,
  },
  scopeToggleActive: {
    backgroundColor: withOpacity(colors.accent, 0.08),
    borderColor:     withOpacity(colors.accent, 0.3),
  },
  scopeToggleText:       { fontSize: typography.sm, color: colors.muted, fontWeight: typography.medium },
  scopeToggleTextActive: { color: colors.accent },

  // ── Summary tiles ──────────────────────────────────────────────────────────
  statsGrid: { flexDirection: 'row', gap: spacing.sm },
  statTile: {
    flex:            1,
    backgroundColor: colors.surface,
    borderWidth:     borders.thin,
    borderColor:     colors.borderCard,
    borderRadius:    radius.md,
    padding:         spacing.md,
    alignItems:      'center',
    justifyContent:  'center',
  },
  statValue: {
    fontSize:   typography.xl,
    fontWeight: typography.heavy,
    color:      colors.accent,
    lineHeight: typography.xl * 1.15,
    textAlign:  'center',
  },
  statLabel: {
    fontSize:      typography.xs,
    color:         colors.muted2,
    letterSpacing: 0.4,
    marginTop:     1,
    textAlign:     'center',
  },
  statSub: {
    fontSize:   9,
    color:      colors.muted,
    lineHeight: 13,
    marginTop:  6,
    textAlign:  'center',
  },

  // ── Search ─────────────────────────────────────────────────────────────────
  searchInput: {
    backgroundColor:   colors.surface2,
    borderWidth:       borders.thin,
    borderColor:       colors.border,
    borderRadius:      radius.md,
    color:             colors.text,
    fontSize:          typography.base,
    paddingHorizontal: spacing.md,
    paddingVertical:   10,
  },

  // ── Section header ─────────────────────────────────────────────────────────
  sectionHeader: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.xs,
    marginBottom:  -spacing.xs,
  },
  sectionLabel: {
    fontSize:      typography.xs,
    color:         colors.muted2,
    fontWeight:    typography.bold,
    letterSpacing: 1.2,
  },
  sectionCount: { fontSize: typography.xs, color: colors.muted2 },

  // ── Exercise dropdown selector ─────────────────────────────────────────────
  dropWrapper: { zIndex: 100, elevation: 10 },
  dropBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingVertical:   spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius:      radius.sm,
    borderWidth:       borders.thin,
    borderColor:       colors.border,
    backgroundColor:   colors.surface,
  },
  dropBtnText: { fontSize: typography.base, color: colors.muted, fontWeight: typography.regular, flex: 1 },
  dropArrow:   { fontSize: 10, color: colors.muted, marginLeft: spacing.sm },
  dropList: {
    position:        'absolute',
    borderRadius:    radius.sm,
    borderWidth:     borders.thin,
    borderColor:     colors.border,
    backgroundColor: colors.surface,
    overflow:        'hidden',
    shadowColor:     '#000',
    shadowOffset:    { width: 0, height: 4 },
    shadowOpacity:   0.3,
    shadowRadius:    8,
    elevation:       10,
  },
  dropItem: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingVertical:   spacing.sm + 2,
    paddingHorizontal: spacing.md,
    gap:               spacing.sm,
    borderBottomWidth: borders.thin,
    borderBottomColor: colors.border,
  },
  dropCheck: {
    width: 16, height: 16, borderRadius: 3,
    borderWidth: borders.thin, borderColor: colors.border,
    backgroundColor: colors.surface2,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  dropCheckActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  dropCheckMark:   { fontSize: 9, color: colors.bg, lineHeight: 11 },
  dropItemText:    { flex: 1, fontSize: typography.base, color: colors.muted },
  dropResetBtn:    { paddingVertical: spacing.sm, paddingHorizontal: spacing.md, alignItems: 'center' },
  dropResetText:   { fontSize: typography.sm, color: colors.muted },

  // ── Exercise list ──────────────────────────────────────────────────────────
  exerciseList: { gap: spacing.xs },
  exCard: {
    backgroundColor: colors.surface,
    borderWidth:     borders.thin,
    borderColor:     colors.borderCard,
    borderRadius:    radius.md,
    overflow:        'hidden',
  },
  exRow: {
    flexDirection: 'row',
    alignItems:    'center',
    padding:       spacing.md,
    gap:           spacing.sm,
  },
  exName: { fontSize: typography.sm, fontWeight: typography.medium, color: colors.text },
  exSub:  { fontSize: typography.xs, color: colors.muted, marginTop: 2 },
  verBtn: {
    paddingVertical:   4,
    paddingHorizontal: spacing.sm,
    borderRadius:      radius.sm,
    borderWidth:       borders.thin,
    borderColor:       colors.border,
    backgroundColor:   colors.surface2,
    flexShrink:        0,
  },
  verBtnText: { fontSize: typography.xs, color: colors.muted, fontWeight: typography.medium },

  // ── Modal ──────────────────────────────────────────────────────────────────
  modalOverlay: {
    flex:           1,
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor:      colors.bg,
    borderTopLeftRadius:  radius.xl,
    borderTopRightRadius: radius.xl,
    flex:                 1,
    marginTop:            44,
    paddingTop:           spacing.sm,
  },
  dragHandleWrap: {
    paddingTop:    spacing.sm,
    paddingBottom: spacing.md,
    alignItems:    'center',
  },
  dragHandle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border,
  },
  modalHeader: {
    flexDirection:     'row',
    alignItems:        'stretch',
    paddingHorizontal: spacing.xl,
    paddingBottom:     spacing.md,
    gap:               spacing.sm,
    borderBottomWidth: borders.thin,
    borderBottomColor: colors.border,
  },
  modalTitleBtn: {
    flex:              1,
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing.xs,
    minWidth:          0,
    backgroundColor:   colors.surface2,
    borderWidth:       borders.thin,
    borderColor:       colors.borderCard,
    borderRadius:      radius.sm,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical:   spacing.xs + 2,
  },
  modalTitleBtnOpen: {
    borderColor: colors.accent,
    backgroundColor: withOpacity(colors.accent, 0.06),
  },
  modalTitle: {
    flex:       1,
    fontSize:   typography.md,
    fontWeight: typography.medium,
    color:      colors.text,
    lineHeight: typography.md * 1.3,
  },
  modalTitleArrow: {
    fontSize:   18,
    fontWeight: typography.bold,
    color:      colors.muted,
    flexShrink: 0,
    lineHeight: 20,
  },
  modalTitleArrowOpen: {
    color: colors.accent,
  },
  // Exercise picker — floats absolutely over content
  exPicker: {
    position:          'absolute',
    left:              spacing.lg,
    right:             spacing.lg,
    zIndex:            20,
    backgroundColor:   colors.surface,
    borderRadius:      radius.md,
    borderWidth:       borders.thin,
    borderColor:       colors.borderCard,
    overflow:          'hidden',
    // Shadow
    shadowColor:       '#000',
    shadowOffset:      { width: 0, height: 6 },
    shadowOpacity:     0.35,
    shadowRadius:      12,
    elevation:         12,
  },
  exPickerSearch: {
    margin:            spacing.sm,
    backgroundColor:   colors.surface2,
    borderWidth:       borders.thin,
    borderColor:       colors.borderCard,
    borderRadius:      radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.sm,
    fontSize:          typography.base,
    color:             colors.text,
  },
  exPickerList:     { maxHeight: 380 },
  exPickerItem: {
    paddingHorizontal: spacing.lg,
    paddingVertical:   spacing.sm + 3,
    borderTopWidth:    borders.thin,
    borderTopColor:    colors.border,
  },
  exPickerItemActive:     { backgroundColor: withOpacity(colors.accent, 0.07) },
  exPickerItemText:       { fontSize: typography.base, color: colors.text },
  exPickerItemTextActive: { color: colors.accent, fontWeight: typography.semibold },
  modalCloseBtn: {
    width:           28,
    borderRadius:    radius.sm,
    backgroundColor: colors.surface2,
    alignItems:      'center',
    justifyContent:  'center',
    flexShrink:      0,
  },
  modalCloseText: { fontSize: typography.sm, color: colors.muted },
  modalFiltersRow: {
    flexDirection:     'row',
    gap:               spacing.xs,
    paddingHorizontal: spacing.xl,
    paddingTop:        spacing.md,
    paddingBottom:     spacing.sm,
  },

  // Modal stat tiles
  modalStatRow: {
    flexDirection:     'row',
    paddingHorizontal: spacing.xl,
    gap:               spacing.sm,
  },
  modalStatTile: {
    flex:            1,
    backgroundColor: colors.surface,
    borderWidth:     borders.thin,
    borderColor:     colors.borderCard,
    borderRadius:    radius.md,
    padding:         spacing.md,
    minHeight:       90,
    justifyContent:  'center',
    gap:             3,
  },
  modalStatValue: {
    fontSize:   typography.md,
    fontWeight: typography.heavy,
    color:      colors.text,
    lineHeight: typography.md * 1.2,
  },
  modalStatLabel: { fontSize: typography.xs, color: colors.muted2, letterSpacing: 0.4 },
  modalStatSub:   { fontSize: 9, color: colors.muted, marginTop: 2 },

  // Chart
  chartSection: {
    borderTopWidth:    borders.thin,
    borderTopColor:    colors.border,
    padding:           spacing.xl,
    paddingHorizontal: spacing.xl,
    gap:               spacing.sm,
    marginTop:         spacing.md,
  },
  chartControls: {
    flexDirection:  'row',
    justifyContent: 'flex-end',
    alignItems:     'center',
    flexWrap:       'wrap',
    gap:            spacing.xs,
  },
  chartRow:         { flexDirection: 'row', alignItems: 'flex-start' },
  yAxisArea:        { width: Y_AXIS_W },
  yAxisLabel: {
    position: 'absolute', right: 4, fontSize: 8,
    color: colors.muted, textAlign: 'right', width: Y_AXIS_W - 4, lineHeight: 10,
  },
  chartContentArea: { flex: 1, minHeight: CHART_H, overflow: 'hidden' },
  chartEmpty:       { paddingVertical: spacing.lg, alignItems: 'center' },
  chartEmptyText:   { fontSize: typography.xs, color: colors.muted, textAlign: 'center' },

  // Modal session list
  modalSesSection: {
    paddingHorizontal: spacing.xl,
    paddingBottom:     spacing.md,
  },
  modalSesSectionLabel: {
    fontSize:      typography.xs,
    color:         colors.muted2,
    fontWeight:    typography.bold,
    letterSpacing: 1.2,
    marginBottom:  spacing.xs,
  },
  modalSesRow: {
    flexDirection:   'row',
    alignItems:      'center',
    paddingVertical: 7,
    borderTopWidth:  borders.thin,
    borderTopColor:  colors.border,
    gap:             spacing.sm,
  },
  modalSesLeft: { flexDirection: 'row', alignItems: 'center', gap: 4, minWidth: 100 },
  modalSesDate:    { fontSize: typography.xs, color: colors.muted },
  modalSesDelta:   { fontSize: typography.xs, fontWeight: typography.bold },
  modalSesSummary: {
    flex:       1,
    fontSize:   typography.xs,
    color:      colors.text,
    fontWeight: typography.medium,
    textAlign:  'right',
  },
  // Set chips
  setPillsRow: {
    flex:           1,
    flexDirection:  'row',
    flexWrap:       'wrap',
    justifyContent: 'flex-end',
    alignItems:     'center',
    gap:            3,
  },
  setPill: {
    backgroundColor: colors.surface2,
    borderWidth:     0.5,
    borderColor:     colors.border,
    borderRadius:    3,
    paddingHorizontal: 5,
    paddingVertical:   2,
  },
  setPillText:   { fontSize: 10, color: colors.text,  fontWeight: typography.medium },
  setPillWeight: { fontSize: 10, color: colors.muted, fontWeight: typography.medium, marginRight: 1 },

  prPill: {
    paddingHorizontal: 6,
    paddingVertical:   2,
    backgroundColor:   withOpacity(colors.accent, 0.12),
    borderWidth:       borders.thin,
    borderColor:       withOpacity(colors.accent, 0.4),
    borderRadius:      radius.xs,
    flexShrink:        0,
  },
  prPillText: { fontSize: 8, fontWeight: typography.bold, color: colors.accent, letterSpacing: 0.5 },
  modalSesEmpty: { fontSize: typography.xs, color: colors.muted, paddingVertical: spacing.md, textAlign: 'center' },

  // ── Empty state ────────────────────────────────────────────────────────────
  emptyState: { alignItems: 'center', padding: spacing.xxl, gap: spacing.md },
  emptyIcon:  { fontSize: 32 },
  emptyText:  { fontSize: typography.base, color: colors.muted, textAlign: 'center', lineHeight: typography.base * 1.7 },
});
