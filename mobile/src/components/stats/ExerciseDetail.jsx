/**
 * ExerciseDetail — la progresión de un ejercicio, a pantalla completa.
 *
 * Era una hoja hecha a mano (su `Modal`, su arrastre, una barra lima para cambiar
 * de ejercicio y una X de 14px). Ahora es una pantalla con la cabecera de
 * siempre: la flecha de volver y el atrás del sistema la cierran. Sigue siendo
 * un `Modal` y no una ruta porque la monta `ProgressTab`, que vive tanto en
 * Progresión como en la ficha de cliente, y cada una le da sus registros.
 *
 * Cambiar de ejercicio sin salir, en el orden de la lista de Progreso (con sus
 * filtros):
 *   · deslizar el contenido a los lados, o pulsar los nombres de debajo de la
 *     cabecera (el anterior y el siguiente);
 *   · pulsar el título abre la hoja con todos, con buscador.
 * Sobre la gráfica, arrastrar recorre los puntos y no cambia de ejercicio.
 *
 *   exerciseId  el que se enseña; null = cerrado
 *   order       ids en el orden de la lista de Progreso
 *   baseLog     los registros del sujeto (el usuario, o el cliente)
 *   onChange    (id) al cambiar de ejercicio
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { View, ScrollView, TouchableOpacity, Modal, PanResponder, StyleSheet, useWindowDimensions } from 'react-native';
import Reanimated, { useSharedValue, useAnimatedStyle, withTiming, withSequence, interpolate } from 'react-native-reanimated';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';

import { Text, TextInput } from '../ui/Text';
import ScreenHeader from '../ui/ScreenHeader';
import SegmentedControl from '../ui/SegmentedControl';
import RoundCheck from '../ui/RoundCheck';
import { MetricInfoSheet } from '../ui/MetricInfo';
import { CloseIcon } from '../ui/EditorIcons';
import DragSheet from '../DragSheet';
import ProgressChart from './ProgressChart';
import { useStore } from '../../../store/useStore';
import { useWeightUnit } from '../../hooks/useWeightUnit';
import { spacing, textStyles, borders, withOpacity, getCardRadii } from '../../theme';
import { useTheme, useThemedStyles } from '../../useTheme';
import { formatDate } from '../../utils/formatters';
import { recentE1RM } from '../../utils/oneRm';
import {
  getExerciseLogsFrom, seriesMetric, metricValue, linearRegressionPct,
  computeExPR, computeExSessionDeltas, lastSessionDelta,
} from '../../utils/improvement';
import { groupSetsByWeight, getPillVariant, buildSetLabel } from '../../utils/setDisplay';
import { filterBySearch } from '../../utils/searchText';
import { programTemplateOf } from '../../utils/freeSessions';
import { periodOptions, fmtVol } from './progressFormat';

const KG_TO_LB = 2.2046;
const DAY_MS   = 86400000;
const PERIOD_DAYS = { '7d': 7, '1m': 30, '3m': 90 };

// Las métricas de la gráfica. «Reps máx» (la mejor serie) es solo de la
// gráfica: la Mejora de los ejercicios sin peso sigue con las totales.
function getMetrics(def, logs, weightLabel, t) {
  if (def?.progressionModel === 'time_progression') {
    return [{ id: 'time', label: t('stats.metricTime'), short: t('stats.metricTime'), unit: 's' }];
  }
  const reps = t('stats.metricReps').toLowerCase();
  const m = [
    { id: 'repsMax', label: t('stats.metricMaxReps'),   short: t('stats.metricShortReps'),  unit: reps },
    { id: 'reps',    label: t('stats.metricTotalReps'), short: t('stats.metricShortTotal'), unit: reps },
  ];
  if (seriesMetric(logs, def) !== 'kg') return m;
  return [
    { id: 'kg', label: t('stats.metricMaxWeight'), short: t('stats.metricShortWeight'), unit: weightLabel },
    ...m,
    { id: 'vol',  label: t('stats.metricVolumeFull'), short: t('stats.metricShortVol'), unit: weightLabel },
    // «e1RM» y no «1RM»: es una estimación, no un máximo probado.
    { id: 'e1rm', label: 'e1RM', short: 'e1RM', unit: weightLabel },
  ];
}

// Mismas claves `dayCard.*` que usan Home y la lista de clientes; aquí sólo se
// alarga la escala hacia meses y años, que el resto de la app no necesitaba.
function timeAgo(timestamp, now, t) {
  if (!timestamp) return null;
  const days = Math.floor((now - timestamp) / DAY_MS);
  if (days === 0) return t('dayCard.today');
  if (days === 1) return t('dayCard.yesterday');
  if (days < 7)   return t('dayCard.daysAgo', { count: days });
  const w = Math.floor(days / 7);
  if (w === 1)   return t('dayCard.oneWeekAgo');
  if (w < 5)     return t('dayCard.weeksAgo', { count: w });
  const m = Math.floor(days / 30);
  if (m === 1)   return t('dayCard.oneMonthAgo');
  if (m < 12)    return t('dayCard.monthsAgo', { count: m });
  const y = Math.floor(days / 365);
  return y === 1 ? t('dayCard.oneYearAgo') : t('dayCard.yearsAgo', { count: y });
}

// Las series de una sesión en una línea: «80kg × 8/8/7», o por bloques de peso.
function buildSessionSummary(exercise, def, fmtWeight) {
  const done = exercise?.sets?.filter((s) => s.done || s.weight || s.reps || s.time) ?? [];
  if (!done.length) return null;
  if (def?.progressionModel === 'time_progression') {
    return done.map((s) => `${s.time ?? '?'}s`).join('/');
  }
  if (!done.some((s) => parseFloat(s.weight) > 0)) {
    const reps = done.map((s) => parseInt(s.reps) || 0).filter((r) => r > 0);
    return reps.length ? `${reps.join('/')} reps` : null;
  }
  const parts = [];
  let curW = null;
  let curReps = [];
  const flush = () => {
    if (curW === null) return;
    parts.push(curReps.length ? `${fmtWeight(curW)} × ${curReps.join('/')}` : fmtWeight(curW));
  };
  for (const s of done) {
    const w = parseFloat(s.weight) || 0;
    const r = parseInt(s.reps) || 0;
    if (w !== curW) { flush(); curW = w > 0 ? w : null; curReps = r > 0 ? [r] : []; }
    else if (r > 0) curReps.push(r);
  }
  flush();
  return parts.join(' · ') || null;
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

function fmtAxisVal(v) {
  if (v < 0) return `-${fmtAxisVal(-v)}`;
  if (v >= 1000) return `${Math.round(v / 100) / 10}k`;
  if (v >= 100)  return String(Math.round(v));
  return v % 1 === 0 ? String(v) : String(Math.round(v * 10) / 10);
}

// ── Pantalla ──────────────────────────────────────────────────────────────────

export default function ExerciseDetail({ exerciseId, onClose, ...rest }) {
  // Al cerrar, `exerciseId` pasa a null pero el Modal aún se está yendo: se
  // sigue pintando el último para que no salga en blanco.
  const [shownId, setShownId] = useState(exerciseId);
  if (exerciseId && exerciseId !== shownId) setShownId(exerciseId);

  return (
    <Modal visible={!!exerciseId} animationType="slide" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      {/* El Modal es otra ventana: sus márgenes no son los de la raíz (ver DragSheet). */}
      <SafeAreaProvider>
        {shownId ? <DetailBody id={shownId} onClose={onClose} {...rest} /> : null}
      </SafeAreaProvider>
    </Modal>
  );
}

function DetailBody({ id, order = [], baseLog = [], allExercises = {}, programTemplateIds, onChange, onClose }) {
  const insets = useSafeAreaInsets();
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { t, i18n } = useTranslation();
  const periods = useMemo(() => periodOptions(t), [t]);
  const { label: weightLabel, toDisplay: wDisplay, fmt: fmtWeight, unit, isLb } = useWeightUnit();
  const unitLabel = unit.charAt(0).toUpperCase() + unit.slice(1);
  const getEffectiveTemplate = useStore((s) => s.getEffectiveTemplate);
  const { width: winW } = useWindowDimensions();

  const [now]        = useState(() => Date.now());
  const [info,        setInfo]        = useState(null);
  const [period,      setPeriod]      = useState('all');
  const [scope,       setScope]       = useState('all');
  const [chartMetric, setChartMetric] = useState(null);
  const [scrub,       setScrub]       = useState(null);
  const [pickerOpen,  setPickerOpen]  = useState(false);
  const [pickerQ,     setPickerQ]     = useState('');

  const nameOf = (exId) => {
    const d = allExercises[exId];
    return d ? (i18n.language === 'en' ? (d.nameEn ?? d.name) : d.name) : exId;
  };
  const fmtDay = (ts) => new Date(ts)
    .toLocaleDateString(i18n.language === 'en' ? 'en-GB' : 'es-ES', { day: 'numeric', month: 'short' })
    .replace('.', '');

  const def  = allExercises[id] ?? null;
  const name = nameOf(id);

  // ── Vecinos y deslizar ─────────────────────────────────────────────────────
  const idx    = order.indexOf(id);
  const prevId = idx > 0 ? order[idx - 1] : null;
  const nextId = idx >= 0 && idx < order.length - 1 ? order[idx + 1] : null;

  const tx      = useSharedValue(0);
  const lockRef = useRef(false);   // la gráfica lo pone a true mientras se toca
  const live    = useRef({});
  useEffect(() => { live.current = { prevId, nextId, onChange, winW }; });

  // Los gestos leen `live` al tocar, no al pintar: el lint no lo distingue.
  /* eslint-disable react-hooks/refs */
  const go = (dir) => {
    const target = dir > 0 ? live.current.nextId : live.current.prevId;
    if (!target) { tx.set(withTiming(0, { duration: 200 })); return; }
    const w = live.current.winW;
    Haptics.selectionAsync().catch(() => {});
    tx.set(withTiming(-dir * w, { duration: 160 }));
    setTimeout(() => {
      setScrub(null);
      live.current.onChange?.(target);
      tx.set(withSequence(withTiming(dir * w * 0.4, { duration: 0 }), withTiming(0, { duration: 220 })));
    }, 160);
  };
  const [swipe] = useState(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gs) =>
      !lockRef.current && Math.abs(gs.dx) > 16 && Math.abs(gs.dx) > Math.abs(gs.dy) * 1.5,
    onPanResponderMove: (_, gs) => {
      // En el primero y el último, el contenido se resiste: no hay a dónde ir.
      const edge = (gs.dx > 0 && !live.current.prevId) || (gs.dx < 0 && !live.current.nextId);
      tx.set(edge ? gs.dx / 4 : gs.dx);
    },
    onPanResponderTerminationRequest: () => false,
    onPanResponderRelease: (_, gs) => {
      if (gs.dx < -70 || (gs.dx < -30 && gs.vx < -0.5)) go(1);
      else if (gs.dx > 70 || (gs.dx > 30 && gs.vx > 0.5)) go(-1);
      else tx.set(withTiming(0, { duration: 200 }));
    },
    onPanResponderTerminate: () => tx.set(withTiming(0, { duration: 200 })),
  }));
  /* eslint-enable react-hooks/refs */
  const slideStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.get() }],
    opacity: interpolate(Math.abs(tx.get()), [0, winW], [1, 0.3]),
  }));

  // ── Datos ──────────────────────────────────────────────────────────────────
  const rawLogs = useMemo(() => getExerciseLogsFrom(id, baseLog), [id, baseLog]);
  const effectiveLogs = useMemo(() => {
    if (scope !== 'program' || !programTemplateIds?.size) return rawLogs;
    return rawLogs.filter((l) => programTemplateIds.has(programTemplateOf(l)));
  }, [rawLogs, scope, programTemplateIds]);
  const filteredLogs = useMemo(() => {
    const days = PERIOD_DAYS[period];
    return days ? effectiveLogs.filter(({ timestamp }) => timestamp >= now - days * DAY_MS) : effectiveLogs;
  }, [effectiveLogs, period, now]);

  const metrics      = useMemo(() => getMetrics(def, effectiveLogs, weightLabel, t), [def, effectiveLogs, weightLabel, t]);
  const metric       = metrics.find((m) => m.id === chartMetric) ?? metrics[0];
  const activeMetric = metric?.id;

  // La Mejora sigue a la métrica de toda la serie (reps totales sin peso), no a
  // la pill de la gráfica.
  const loadMetric       = useMemo(() => seriesMetric(effectiveLogs, def), [effectiveLogs, def]);
  const loadImprovePct   = useMemo(() => linearRegressionPct(filteredLogs, def, loadMetric), [filteredLogs, def, loadMetric]);
  const lastSesLoadDelta = useMemo(() => lastSessionDelta(filteredLogs, def, loadMetric), [filteredLogs, def, loadMetric]);
  const volImprovePct    = useMemo(() => computeExVolumeImprovePct(filteredLogs), [filteredLogs]);
  const lastSesVolDelta  = useMemo(() => {
    if (filteredLogs.length < 2) return null;
    const getVol = ({ exercise }) => (exercise?.sets?.filter((s) => s.done || s.weight || s.reps) ?? [])
      .reduce((sum, s) => sum + (parseFloat(s.weight) || 0) * (parseInt(s.reps) || 0), 0);
    return Math.round(getVol(filteredLogs[filteredLogs.length - 1]) - getVol(filteredLogs[filteredLogs.length - 2]));
  }, [filteredLogs]);
  const prData        = useMemo(() => computeExPR(effectiveLogs, def), [effectiveLogs, def]);
  const sessionDeltas = useMemo(() => computeExSessionDeltas(filteredLogs, def, activeMetric), [filteredLogs, def, activeMetric]);
  // Lo que puedes hoy: el mejor e1RM de las últimas 6 semanas (del alcance, no
  // del periodo, para que un periodo corto no deje la tarjeta vacía).
  const e1rmData = useMemo(() => recentE1RM(effectiveLogs), [effectiveLogs]);

  const points = useMemo(() => filteredLogs
    .map(({ timestamp, exercise }) => {
      const raw = metricValue(exercise?.sets, activeMetric, def);
      if (raw === null) return null;
      const value = activeMetric === 'vol' ? raw * (isLb ? KG_TO_LB : 1)
        : (activeMetric === 'kg' || activeMetric === 'e1rm') ? wDisplay(raw)
        : raw;
      return { t: timestamp, value, exercise };
    })
    .filter(Boolean), [filteredLogs, activeMetric, def, wDisplay, isLb]);

  // ── Textos de las tarjetas ─────────────────────────────────────────────────
  const prDisplay = prData
    ? (prData.metric === 'time' ? `${prData.value}s`
      : prData.metric === 'kg'   ? fmtWeight(prData.value)
      : `${prData.value} ${t('stats.metricReps').toLowerCase()}`)
    : null;
  const prAgoStr = timeAgo(prData?.timestamp, now, t);
  const signed = (v, body) => `${v >= 0 ? '+' : '−'}${body}`;
  const loadImpStr   = loadImprovePct !== null ? `${loadImprovePct > 0 ? '+' : ''}${loadImprovePct}%` : '—';
  const loadImpColor = (loadImprovePct === null || loadImprovePct >= 0) ? th.colors.accent : th.colors.orange;
  const lastLoadSubColor = (lastSesLoadDelta === null || lastSesLoadDelta >= 0) ? th.tint.accent50 : th.colors.orange;
  const lastLoadSubStr = lastSesLoadDelta === null ? null
    : loadMetric === 'time' ? `${signed(lastSesLoadDelta, `${Math.abs(lastSesLoadDelta)}s`)} ${t('stats.lastShort')}`
    : loadMetric === 'kg'   ? `${signed(lastSesLoadDelta, fmtWeight(Math.abs(lastSesLoadDelta)))} ${t('stats.lastShort')}`
    : `${signed(lastSesLoadDelta, Math.abs(lastSesLoadDelta))} ${t('stats.metricReps').toLowerCase()} ${t('stats.lastShort')}`;
  const volImpStr   = volImprovePct !== null ? `${volImprovePct > 0 ? '+' : ''}${volImprovePct}%` : '—';
  const volImpColor = (volImprovePct === null || volImprovePct >= 0) ? th.colors.accent : th.colors.orange;
  const lastVolSubColor = (lastSesVolDelta === null || lastSesVolDelta >= 0) ? th.tint.accent50 : th.colors.orange;
  const lastVolSubStr = lastSesVolDelta === null ? null
    : `${signed(lastSesVolDelta, fmtVol(Math.abs(lastSesVolDelta), wDisplay))} ${weightLabel} ${t('stats.lastShort')}`;

  // ── Tarjeta de la gráfica: la cifra es la de la sesión que se lee ──────────
  const fmtValue = (v) => (activeMetric === 'vol' || activeMetric === 'reps' || activeMetric === 'repsMax' || activeMetric === 'time')
    ? String(Math.round(v))
    : String(Math.round(v * 10) / 10);
  const sel   = scrub != null ? points[scrub] : null;
  const shown = sel ?? points[points.length - 1];
  // Lo que ha cambiado desde la primera sesión del periodo hasta la que se lee.
  const delta = shown && shown !== points[0] ? shown.value - points[0].value : null;

  const pickerList = useMemo(
    () => filterBySearch(order, pickerQ, (exId) => nameOf(exId)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [order, pickerQ, allExercises, i18n.language],
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScreenHeader
        onBack={onClose}
        eyebrow={t('stats.progressionEyebrow')}
        title={name}
        onTitlePress={order.length > 1 ? () => setPickerOpen(true) : undefined}
      />

      {/* El anterior y el siguiente: dicen que hay más, y se pulsan. */}
      {(prevId || nextId) && (
        <View style={styles.nbr}>
          <TouchableOpacity style={styles.nbrBtn} disabled={!prevId} onPress={() => go(-1)} hitSlop={8} activeOpacity={0.6}>
            <Text style={styles.nbrText} numberOfLines={1}>{prevId ? `‹ ${nameOf(prevId)}` : ''}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.nbrBtn} disabled={!nextId} onPress={() => go(1)} hitSlop={8} activeOpacity={0.6}>
            <Text style={[styles.nbrText, styles.nbrTextNext]} numberOfLines={1}>{nextId ? `${nameOf(nextId)} ›` : ''}</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.flex} {...swipe.panHandlers}>
        <Reanimated.View style={[styles.flex, slideStyle]}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxl }}>
            {/* Período + programa actual */}
            <View style={styles.periodRow}>
              <View style={styles.segmentedWrap}>
                <SegmentedControl options={periods} value={period} onChange={(p) => { setPeriod(p); setScrub(null); }} />
              </View>
              {programTemplateIds?.size > 0 && (
                <TouchableOpacity
                  style={[styles.programToggle, scope === 'program' && styles.programToggleActive]}
                  onPress={() => { setScope((s) => (s === 'program' ? 'all' : 'program')); setScrub(null); }}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.programToggleText, scope === 'program' && styles.programToggleTextActive]}>
                    {t('stats.currentProgram')}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Las tres tarjetas */}
            <View style={styles.statsRow}>
              <TouchableOpacity style={styles.statTile} onPress={() => setInfo({ ids: ['e1rm', 'pr'] })} activeOpacity={0.75}>
                {e1rmData ? (
                  <>
                    <View style={styles.statValueBlock}>
                      <Text style={[styles.statValue, { color: th.colors.accent }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
                        {fmtWeight(Math.round(e1rmData.value * 10) / 10)}
                      </Text>
                      <Text style={[styles.statLabel, styles.statLabelAsIs]} numberOfLines={1}>e1RM</Text>
                    </View>
                    <Text style={[styles.statSub, { color: th.colors.muted }]} numberOfLines={1}>
                      {prDisplay ? `PR ${prDisplay} · ${prAgoStr ?? ''}` : t('stats.e1rmSub')}
                    </Text>
                  </>
                ) : (
                  <>
                    <View style={styles.statValueBlock}>
                      <Text style={[styles.statValue, { color: th.colors.accent }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{prDisplay ?? '—'}</Text>
                      <Text style={styles.statLabel} numberOfLines={1}>PR</Text>
                    </View>
                    <Text style={[styles.statSub, { color: th.colors.muted }]} numberOfLines={1}>{prAgoStr ?? '—'}</Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={styles.statTile} onPress={() => setInfo({ ids: ['loadTrend'] })} activeOpacity={0.75}>
                <View style={styles.statValueBlock}>
                  <Text style={[styles.statValue, { color: loadImpColor }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{loadImpStr}</Text>
                  <Text style={styles.statLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{t('stats.statTrend')}</Text>
                </View>
                <Text style={[styles.statSub, { color: lastLoadSubColor }]} numberOfLines={1}>{lastLoadSubStr ?? '—'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.statTile} onPress={() => setInfo({ ids: ['volumeTrend'] })} activeOpacity={0.75}>
                <View style={styles.statValueBlock}>
                  <Text style={[styles.statValue, { color: volImpColor }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{volImpStr}</Text>
                  <Text style={styles.statLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{t('stats.statVolume')}</Text>
                </View>
                <Text style={[styles.statSub, { color: lastVolSubColor }]} numberOfLines={1}>{lastVolSubStr ?? '—'}</Text>
              </TouchableOpacity>
            </View>

            {/* La gráfica, en una tarjeta como las de Carga: métrica arriba,
                cifra y cambio, la línea, y abajo la sesión que se está leyendo. */}
            <View style={styles.chartCard}>
              {metrics.length > 1 && (
                <SegmentedControl
                  options={metrics.map((m) => ({ id: m.id, label: m.short }))}
                  value={activeMetric}
                  onChange={(m) => { setChartMetric(m); setScrub(null); }}
                />
              )}

              {shown && (
                <View style={styles.cardHead}>
                  <Text style={styles.cardTitle} numberOfLines={1}>
                    {`${metric?.label ?? ''} · ${t('history.sessionsN', { count: points.length })}`}
                  </Text>
                  <View style={styles.valueRow}>
                    <Text style={styles.value} numberOfLines={1}>
                      {fmtValue(shown.value)}
                      <Text style={styles.valueUnit}>{` ${metric?.unit ?? ''}`}</Text>
                    </Text>
                    {delta !== null && (
                      <View style={[styles.chip, delta >= 0 ? styles.chipUp : styles.chipDown]}>
                        <Text style={[styles.chipText, { color: delta >= 0 ? th.colors.accent : th.colors.orange }]}>
                          {`${delta >= 0 ? '+' : '−'}${fmtValue(Math.abs(delta))} ${metric?.unit ?? ''}`}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              )}

              <ProgressChart
                key={`${id}|${activeMetric}|${period}|${scope}`}
                points={points}
                selected={scrub}
                onSelect={setScrub}
                lockRef={lockRef}
                emptyText={t('stats.chartNeedsTwo')}
              />

              {shown && (
                <View style={styles.strip}>
                  <View style={styles.dot} />
                  <Text style={styles.stripText} numberOfLines={2}>
                    <Text style={styles.stripTitle}>{fmtDay(shown.t)}</Text>
                    {` · ${buildSessionSummary(shown.exercise, def, fmtWeight) ?? ''}`}
                  </Text>
                </View>
              )}
            </View>

            {/* Sesiones, en la métrica de la gráfica */}
            <View style={styles.sesSection}>
              {sessionDeltas.length === 0 ? (
                <Text style={styles.sesEmpty}>{t('stats.noSessionsPeriod')}</Text>
              ) : (
                <View style={styles.sesList}>
                  {[...sessionDeltas].reverse().map(({ timestamp, delta: d, isPR, metricId, exercise, sessionTemplateId }, i, arr) => {
                    const deltaStr = d === null ? null
                      : (metricId === 'kg' || metricId === 'e1rm') ? `${d > 0 ? '+' : d < 0 ? '−' : ''}${fmtWeight(Math.round(Math.abs(d) * 10) / 10)}`
                      : metricId === 'time' ? `${d > 0 ? '+' : ''}${Math.round(d)}s`
                      : metricId === 'vol'  ? `${d >= 0 ? '+' : '−'}${fmtVol(Math.abs(d), wDisplay)} ${weightLabel}`
                      : `${d > 0 ? '+' : ''}${Math.round(d)} ${t('stats.metricReps').toLowerCase()}`;
                    // El rango (minReps/minTime) sale de la plantilla de esa
                    // sesión concreta, igual que el historial.
                    const tpl   = sessionTemplateId ? getEffectiveTemplate(sessionTemplateId) : null;
                    const exCfg = tpl?.exercises?.find((ec) => ec.exerciseId === id);
                    return (
                      <View key={timestamp} style={[styles.sesItem, getCardRadii(th, i === 0, i === arr.length - 1)]}>
                        <View style={styles.sesHeaderRow}>
                          <Text style={styles.sesDate}>{formatDate(timestamp)}</Text>
                          <View style={styles.sesHeaderRight}>
                            {isPR && <View style={styles.prPill}><Text style={styles.prPillText}>PR</Text></View>}
                            {deltaStr !== null && (
                              <Text style={[styles.sesDelta, { color: d >= 0 ? th.colors.green : th.colors.orange }]}>{deltaStr}</Text>
                            )}
                          </View>
                        </View>
                        <View style={styles.sesPills}>
                          {groupSetsByWeight(exercise?.sets ?? []).map((group, gi) => (
                            <View key={gi} style={styles.sesGroup}>
                              {group.weight ? (
                                <View style={styles.sesWeightPill}>
                                  <Text style={styles.sesWeightText}>
                                    <Text style={styles.sesWeightNum}>{fmtAxisVal(wDisplay(group.weight))}</Text>
                                    <Text style={styles.sesWeightUnit}>{unitLabel}</Text>
                                    <Text style={styles.sesWeightX}>{' x'}</Text>
                                  </Text>
                                </View>
                              ) : null}
                              {group.sets.map((s, si) => {
                                const variant = getPillVariant(s, exCfg);
                                const { main, rpeNum } = buildSetLabel(s, si, fmtWeight, true);
                                return (
                                  <View key={si} style={[styles.sesPill, variant === 'done' && styles.sesPillDone, variant === 'partial' && styles.sesPillPartial]}>
                                    <Text style={[styles.sesPillText, variant === 'done' && styles.sesPillTextDone, variant === 'partial' && styles.sesPillTextPartial]}>
                                      {main}
                                      {rpeNum ? (
                                        <>
                                          <Text style={[styles.sesPillRpeAt, variant === 'done' && styles.sesPillRpeAtDone, variant === 'partial' && styles.sesPillRpeAtPartial]}>@</Text>
                                          {rpeNum}
                                        </>
                                      ) : null}
                                    </Text>
                                  </View>
                                );
                              })}
                            </View>
                          ))}
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          </ScrollView>
        </Reanimated.View>
      </View>

      {/* Cambiar a cualquier ejercicio de la lista */}
      <DragSheet visible={pickerOpen} onClose={() => { setPickerOpen(false); setPickerQ(''); }} title={t('stats.changeExercise')} tall>
        <View style={styles.pickerSearch}>
          <Svg viewBox="0 0 24 24" width={17} height={17} fill="none"
            stroke={th.colors.mutedLight} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm10 2-4.35-4.35" />
          </Svg>
          <TextInput
            style={styles.pickerInput}
            placeholder={t('stats.searchExercise')}
            placeholderTextColor={th.colors.mutedLight}
            value={pickerQ}
            onChangeText={setPickerQ}
            autoCorrect={false}
            autoCapitalize="none"
          />
          {pickerQ.length > 0 && (
            <TouchableOpacity onPress={() => setPickerQ('')} hitSlop={8}>
              <CloseIcon size={16} color={th.colors.mutedLight} />
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.pickerList}>
          {pickerList.map((exId, i) => {
            const on = exId === id;
            return (
              <TouchableOpacity
                key={exId}
                style={[styles.pickerRow, getCardRadii(th, i === 0, i === pickerList.length - 1), on && styles.pickerRowOn]}
                onPress={() => {
                  setPickerOpen(false);
                  setPickerQ('');
                  if (!on) { setScrub(null); onChange?.(exId); }
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.pickerName} numberOfLines={1}>{nameOf(exId)}</Text>
                <RoundCheck on={on} />
              </TouchableOpacity>
            );
          })}
        </View>
      </DragSheet>

      {/* Dentro del Modal: fuera quedaría por debajo y no se vería. */}
      <MetricInfoSheet ids={info?.ids} onClose={() => setInfo(null)} />
    </View>
  );
}

const makeStyles = (th) => StyleSheet.create({
  container: { flex: 1, backgroundColor: th.colors.bg },
  flex:      { flex: 1 },

  // Vecinos: gris y pequeños, bajo la cabecera.
  nbr: {
    flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md,
    paddingHorizontal: spacing.lg, paddingTop: spacing.sm2,
  },
  nbrBtn:      { maxWidth: '48%', paddingVertical: spacing.xs2 },
  nbrText:     { ...textStyles.labelStrong, color: th.colors.mutedLight },
  nbrTextNext: { textAlign: 'right' },

  periodRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingTop: spacing.sm2,
  },
  segmentedWrap: { width: 198 },
  programToggle: {
    backgroundColor: th.colors.surface2,
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    borderRadius: th.radius.sm,
  },
  programToggleActive:     { backgroundColor: th.colors.accent },
  programToggleText:       { ...textStyles.labelStrong, color: th.colors.mutedLight },
  programToggleTextActive: { color: th.colors.onAccent },

  // Las tarjetas: las mismas que en Progreso (statTile).
  statsRow: {
    flexDirection: 'row', gap: spacing.sm2, height: 108, alignItems: 'center',
    paddingHorizontal: spacing.lg, marginTop: spacing.lg,
  },
  statTile: {
    flex: 1, backgroundColor: th.colors.surface,
    paddingHorizontal: spacing.xl, paddingVertical: spacing.lg,
    borderRadius: th.radius.md,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden', gap: spacing.lg,
  },
  statValueBlock: { alignItems: 'center', gap: spacing.xs },
  statValue: { ...textStyles.title, textAlign: 'center' },
  statLabel: { ...textStyles.caps, textTransform: 'uppercase', color: th.colors.text, textAlign: 'center' },
  // «e1RM» se escribe así: en mayúsculas sería otra sigla.
  statLabelAsIs: { textTransform: 'none' },
  statSub: { ...textStyles.label, textAlign: 'center' },

  chartCard: {
    marginHorizontal: spacing.lg, marginTop: spacing.xl,
    backgroundColor: th.colors.surface, borderRadius: th.radius.md,
    padding: spacing.lg, gap: spacing.md,
  },
  cardHead:  { gap: spacing.xs2 },
  cardTitle: { ...textStyles.caps, color: th.colors.mutedLight, textTransform: 'uppercase' },
  valueRow:  { flexDirection: 'row', alignItems: 'center', gap: spacing.sm2 },
  value:     { ...textStyles.title, color: th.colors.text, flexShrink: 1 },
  valueUnit: { ...textStyles.labelStrong, color: th.colors.mutedLight },
  // El cambio en el periodo, como el chip de lectura de Carga.
  chip: {
    backgroundColor: th.colors.surface2, borderRadius: th.radius.xs,
    paddingHorizontal: spacing.sm2, paddingVertical: spacing.xs2,
  },
  chipUp:   { backgroundColor: th.tint.accent10 },
  chipDown: { backgroundColor: th.tint.orange30 },
  chipText: { ...textStyles.labelStrong },
  // La sesión leída, en la tira de Carga.
  strip: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm2,
    backgroundColor: th.colors.surface2, borderRadius: th.radius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
  },
  dot:        { width: 7, height: 7, borderRadius: 4, backgroundColor: th.colors.accent },
  stripText:  { ...textStyles.label, color: th.colors.mutedLight, flex: 1, lineHeight: 15 },
  stripTitle: { ...textStyles.label, color: th.colors.text },

  sesSection: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  sesList:    { gap: spacing.xs },
  sesItem: {
    backgroundColor: th.colors.surface,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    gap: spacing.sm, overflow: 'hidden',
  },
  sesHeaderRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sesDate:        { ...textStyles.label, color: th.colors.mutedLight },
  sesHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sesDelta:       { ...textStyles.labelStrong },
  // Series: mismo sistema que el historial — grupos (peso + pills) que fluyen y
  // se envuelven como unidad.
  sesPills: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  sesGroup: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  sesWeightPill: { paddingLeft: spacing.sm, paddingVertical: spacing.sm },
  sesWeightText: { ...textStyles.label },
  sesWeightNum:  { color: th.colors.accent },
  sesWeightUnit: { color: th.colors.text },
  sesWeightX:    { color: th.colors.mutedLight },
  sesPill:            { backgroundColor: th.colors.surface2, borderRadius: th.radius.xs, padding: spacing.sm },
  sesPillDone:        { backgroundColor: th.tint.accent10 },
  sesPillPartial:     { backgroundColor: th.tint.orange30 },
  sesPillText:        { ...textStyles.label, color: th.colors.mutedLight },
  sesPillTextDone:    { color: th.colors.accent },
  sesPillTextPartial: { color: th.colors.orange },
  sesPillRpeAt:        { color: th.colors.mutedLight },
  sesPillRpeAtDone:    { color: th.tint.accent50 },
  sesPillRpeAtPartial: { color: th.tint.orange50 },
  prPill: {
    paddingHorizontal: 6, paddingVertical: 2,
    backgroundColor: withOpacity(th.colors.accent, 0.12),
    borderWidth: borders.thin, borderColor: withOpacity(th.colors.accent, 0.4),
    borderRadius: th.radius.xs, flexShrink: 0,
  },
  prPillText: { ...textStyles.caps, color: th.colors.accent },
  sesEmpty:   { ...textStyles.label, color: th.colors.mutedLight, paddingVertical: spacing.md, textAlign: 'center' },

  // Hoja «Cambiar ejercicio»
  pickerSearch: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: th.colors.surface2, borderRadius: th.radius.sm,
    paddingHorizontal: spacing.lg, height: 42, marginBottom: spacing.md,
  },
  pickerInput: { flex: 1, padding: 0, ...textStyles.body, color: th.colors.text },
  pickerList:  { gap: spacing.xs },
  pickerRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: th.colors.surface,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
  },
  pickerRowOn: { backgroundColor: th.tint.accent10 },
  pickerName:  { ...textStyles.bodyStrong, color: th.colors.text, flex: 1 },
});
