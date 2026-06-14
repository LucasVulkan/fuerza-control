/**
 * ExerciseHistoryScreen — historial completo de un ejercicio.
 *
 * Recibe { exerciseId } como param de navegación.
 * Muestra: filtros de período, nº sesiones + PR (filtrado), gráfica, tabla completa.
 * Las filas donde se alcanzó el PR all-time quedan marcadas.
 */
import { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
} from 'react-native';
import MiniLineChart from '../components/charts/MiniLineChart';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../store/useStore';
import { useWeightUnit } from '../hooks/useWeightUnit';
import { spacing, typography, borders, withOpacity } from '../theme';
import { useThemedStyles } from '../useTheme';
import { formatDate } from '../../../src/utils/formatters';
import { summarizeSets } from '../../../src/utils/progression';

// ── Constants ──────────────────────────────────────────────────────────────────

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

// ── Screen ─────────────────────────────────────────────────────────────────────

export default function ExerciseHistoryScreen() {
  const insets     = useSafeAreaInsets();
  const navigation = useNavigation();
  const styles     = useThemedStyles(makeStyles);
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

const makeStyles = (th) => StyleSheet.create({
  container: {
    flex:            1,
    backgroundColor: th.colors.bg,
  },

  // Header
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.sm,
    borderBottomWidth: borders.thin,
    borderBottomColor: th.colors.border,
  },
  backBtn:     { width: 36, alignItems: 'center' },
  backIcon:    { fontSize: 28, color: th.colors.muted, lineHeight: 32 },
  headerTitle: {
    flex:       1,
    textAlign:  'center',
    fontSize:   typography.base,
    fontWeight: typography.heavy,
    color:      th.colors.text,
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
    borderColor:       th.colors.border,
    backgroundColor:   th.colors.surface2,
  },
  periodBtnActive: {
    backgroundColor: withOpacity(th.colors.accent, 0.08),
    borderColor:     withOpacity(th.colors.accent, 0.3),
  },
  periodBtnText:       { fontSize: typography.xs, color: th.colors.muted, fontWeight: typography.medium },
  periodBtnTextActive: { color: th.colors.accent },

  // Meta (count + PR)
  meta: { paddingHorizontal: spacing.xl },
  metaText: { fontSize: typography.sm, color: th.colors.muted },

  // Chart card
  chartCard: {
    marginHorizontal: spacing.xl,
    backgroundColor:  th.colors.surface,
    borderWidth:      borders.thin,
    borderColor:      th.colors.borderCard,
    borderRadius:     th.radius.md,
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
    borderColor:       th.colors.border,
    backgroundColor:   th.colors.surface2,
  },
  metricBtnActive: {
    backgroundColor: withOpacity(th.colors.accent, 0.08),
    borderColor:     withOpacity(th.colors.accent, 0.3),
  },
  metricBtnText:       { fontSize: typography.xs, color: th.colors.muted, fontWeight: typography.medium },
  metricBtnTextActive: { color: th.colors.accent },

  // Table
  table: {
    marginHorizontal: spacing.xl,
    backgroundColor:  th.colors.surface,
    borderWidth:      borders.thin,
    borderColor:      th.colors.borderCard,
    borderRadius:     th.radius.md,
    overflow:         'hidden',
  },
  row: {
    flexDirection:     'row',
    justifyContent:    'space-between',
    alignItems:        'center',
    paddingVertical:   spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: borders.thin,
    borderBottomColor: th.colors.border,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.xs,
  },
  rowDate: { fontSize: typography.sm, color: th.colors.muted },
  prBadge: {
    backgroundColor: withOpacity(th.colors.accent, 0.12),
    borderWidth:     borders.thin,
    borderColor:     withOpacity(th.colors.accent, 0.4),
    borderRadius:    3,
    paddingHorizontal: 5,
    paddingVertical:   1,
  },
  prBadgeText: {
    fontSize:      8,
    fontWeight:    typography.bold,
    color:         th.colors.accent,
    letterSpacing: 0.5,
  },
  rowSets: {
    fontSize:   typography.sm,
    fontWeight: typography.medium,
    color:      th.colors.text,
    textAlign:  'right',
    flexShrink: 1,
    marginLeft: spacing.sm,
  },

  // Empty state
  empty:     { padding: spacing.xl, alignItems: 'center' },
  emptyText: { fontSize: typography.sm, color: th.colors.muted, textAlign: 'center' },
});

