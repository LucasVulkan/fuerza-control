/**
 * LoadTab — panel de carga de entrenamiento (fase 3 de docs/specs/T04-training-load.md).
 *
 * Props (mismos que ProgressTab, para que el conmutador sea intercambiable):
 *   baseLog             WorkoutLog[]  – sesiones a analizar, ya filtradas por sujeto.
 *   allExercises        { [id]: def } – librería + ejercicios propios.
 *   fallbackBodyWeight  number|null   – peso a usar en las entradas que no lo traen.
 *                                       Si no se pasa, se deduce del propio log.
 *   program, client     – el programa y el cliente del sujeto (client = null: es el
 *                         propio usuario). Nada de esta pestaña lee del store lo que
 *                         es del sujeto: en el móvil del entrenador el store es suyo
 *                         (docs/specs/T11-carga-v1.md §3). La etapa en curso, cuando
 *                         haga falta (T11-07), sale de `athleteProgress(program, client)`.
 *   subjectName         – nombre del cliente; con `client`, los textos van en tercera persona.
 *
 * REGLA CRÍTICA (spec §4.1): el selector de período recorta lo que se PINTA,
 * nunca lo que se CALCULA. Las medias de 7 y 28 días, la monotonía y el strain
 * salen siempre del log completo — si se filtrara antes, con "1M" seleccionado
 * la media de 28 días sería imposible de calcular.
 *
 * Tampoco hay toggle de "Programa actual": la carga es sistémica y filtrar por
 * programa convertiría las sesiones de fuera en días de descanso falsos.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import Reanimated, {
  useSharedValue, useAnimatedStyle, withTiming, Easing, interpolate,
} from 'react-native-reanimated';
import { Text } from '../ui/Text';
import Svg, { Rect, Polyline, Line, Circle } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../../store/useStore';

import {
  loadState, setsByMuscleGroup, weeklySeries, indexTo100, effortTrend, performanceWeekly,
  loadSummary, loadBlocks, effortBlocks, strengthChange, monotonyStrain,
  SETS_TARGET_MIN, SETS_TARGET_MAX, MONOTONY_MODERATE, MONOTONY_HIGH, MIN_SESSIONS_FOR_MONOTONY,
} from '../../utils/trainingLoad';
import { spacing, textStyles, withOpacity } from '../../theme';
import { useTheme, useThemedStyles } from '../../useTheme';
import SegmentedControl from '../ui/SegmentedControl';
import EmptyState from '../ui/EmptyState';
import { FILL_MS, EMPTY_MS } from '../ui/StageCards';
import { InfoLabel, MetricInfoSheet } from '../ui/MetricInfo';

// "7D" no existe aquí: siete barras y dos líneas planas no son una tendencia.
const PERIOD_OPTIONS = [
  { id: '1m',  label: '1M'   },
  { id: '3m',  label: '3M'   },
  { id: '6m',  label: '6M'   },
];
const PERIOD_DAYS = { '1m': 30, '3m': 90, '6m': 180 };

const CHART_H = 140;
const PAD_TOP = 10;
const PAD_BOT = 6;
// Radio del punto que remata cada línea indexada. El eje X de `IndexChart` se
// insetea esta cantidad por los dos lados: sin ello el último punto cae en el
// borde exacto del SVG y el círculo sale cortado por la mitad.
// `LoadChart` no lo necesita — no lleva punto final, y sus barras ya quedan
// dentro por el medio paso del centrado.
const DOT_R   = 3;

// Tope de la escala de barras. Fijo para que la longitud signifique lo mismo
// entre grupos y semanas; solo crece si alguien se sale del rango.
const SETS_SCALE_MIN  = 24;

// Fantasma de la gráfica de Esfuerzo sin sRPE (alturas en %).
const GHOST_BARS = [40, 55, 50, 62, 30, 58, 64, 60, 66];

// ── Gráfico de tendencia ──────────────────────────────────────────────────────
//
// No reutiliza el `MiniLineChart` de ProgressTab: aquel guarda las posiciones en
// un array FIJO de 80 `Animated.Value` (Y_ANIM_COUNT), y aquí la serie son un
// punto por día — 365+ en un año. Además la marca es distinta (barras diarias
// bajo dos líneas) y no necesita scroll ni tooltip, porque el zoom lo da el
// selector de período. Es una desviación consciente de la spec §5.3.

function LoadChart({ days, mean7, mean28 }) {
  const th = useTheme();
  const [width, setWidth] = useState(0);

  const geometry = useMemo(() => {
    if (!width || !days.length) return null;
    const values = [
      ...days.map((d) => d.value ?? 0),
      ...mean7.filter((v) => v != null),
      ...mean28.filter((v) => v != null),
    ];
    const max = Math.max(...values, 1);
    const h   = CHART_H - PAD_TOP - PAD_BOT;
    const step = width / days.length;
    const y = (v) => PAD_TOP + h - (v / max) * h;
    const x = (i) => i * step + step / 2;

    const bars = days
      .map((d, i) => ({ i, v: d.value }))
      .filter(({ v }) => v != null && v > 0)
      .map(({ i, v }) => ({
        key: i,
        x:   x(i) - Math.max(1, Math.min(6, step * 0.6)) / 2,
        y:   y(v),
        w:   Math.max(1, Math.min(6, step * 0.6)),
        h:   PAD_TOP + h - y(v),
      }));

    // Los tramos sin dato parten la línea en vez de cruzarla en falso.
    const toSegments = (series) => {
      const out = [];
      let cur = [];
      series.forEach((v, i) => {
        if (v == null) { if (cur.length > 1) out.push(cur); cur = []; return; }
        cur.push(`${x(i).toFixed(1)},${y(v).toFixed(1)}`);
      });
      if (cur.length > 1) out.push(cur);
      return out.map((pts) => pts.join(' '));
    };

    return { bars, line7: toSegments(mean7), line28: toSegments(mean28) };
  }, [width, days, mean7, mean28]);

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {geometry && (
        <Svg width={width} height={CHART_H}>
          {geometry.bars.map((b) => (
            <Rect key={b.key} x={b.x} y={b.y} width={b.w} height={b.h} rx={1} fill={th.colors.muted} />
          ))}
          {geometry.line28.map((pts, i) => (
            <Polyline key={`m28-${i}`} points={pts} fill="none" stroke={th.colors.blue} strokeWidth={1.6}
              strokeLinejoin="round" strokeLinecap="round" />
          ))}
          {geometry.line7.map((pts, i) => (
            <Polyline key={`m7-${i}`} points={pts} fill="none" stroke={th.colors.accent} strokeWidth={2}
              strokeLinejoin="round" strokeLinecap="round" />
          ))}
        </Svg>
      )}
    </View>
  );
}

/**
 * Gráfico de líneas indexadas (base 100) para las series SEMANALES.
 *
 * Separado de `LoadChart` porque no comparte nada con él: sin barras, pocos
 * puntos, y una referencia horizontal en 100 que es la mitad del mensaje.
 */
function IndexChart({ series, height = 96 }) {
  const th = useTheme();
  const [width, setWidth] = useState(0);

  const geometry = useMemo(() => {
    const values = series.flatMap((s) => s.values).filter((v) => v != null);
    if (!width || values.length < 2) return null;
    const min = Math.min(...values, 100);
    const max = Math.max(...values, 100);
    const pad = (max - min) * 0.12 || 10;
    const lo  = min - pad;
    const hi  = max + pad;
    const n   = Math.max(...series.map((s) => s.values.length));
    const y = (v) => 8 + (height - 16) - ((v - lo) / (hi - lo)) * (height - 16);
    const x = (i) => (n <= 1 ? width / 2 : (i / (n - 1)) * (width - DOT_R * 2) + DOT_R);

    const toSegments = (vals) => {
      const out = []; let cur = [];
      vals.forEach((v, i) => {
        if (v == null) { if (cur.length > 1) out.push(cur); cur = []; return; }
        cur.push(`${x(i).toFixed(1)},${y(v).toFixed(1)}`);
      });
      if (cur.length > 1) out.push(cur);
      return out.map((p) => p.join(' '));
    };

    const lines = series.map((s) => ({
      color: s.color,
      segments: toSegments(s.values),
      last: (() => {
        for (let i = s.values.length - 1; i >= 0; i--) {
          if (s.values[i] != null) return { x: x(i), y: y(s.values[i]) };
        }
        return null;
      })(),
    }));
    return { lines, baselineY: y(100) };
  }, [width, series, height]);

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {geometry && (
        <Svg width={width} height={height}>
          {/* Referencia: 100 = punto de partida de la ventana */}
          <Line x1={0} y1={geometry.baselineY} x2={width} y2={geometry.baselineY}
            stroke={th.colors.surface2} strokeWidth={1} strokeDasharray="3 3" />
          {geometry.lines.map((l, li) => (
            <React.Fragment key={li}>
              {l.segments.map((pts, si) => (
                <Polyline key={si} points={pts} fill="none" stroke={l.color} strokeWidth={2}
                  strokeLinejoin="round" strokeLinecap="round" />
              ))}
              {l.last && <Circle cx={l.last.x} cy={l.last.y} r={DOT_R} fill={l.color} />}
            </React.Fragment>
          ))}
        </Svg>
      )}
    </View>
  );
}

// ── Tarjetas de selección ─────────────────────────────────────────────────────

const TILE_H = 112;
const PERIODS = ['1m', '3m', '6m'];

/** Línea de 22 px con los valores de las últimas 8 semanas; los huecos parten la línea. */
function Spark({ values, color, width }) {
  const pts = useMemo(() => {
    const ok = values.filter((v) => v != null && Number.isFinite(v));
    if (width <= 0 || ok.length < 2) return [];
    const lo = Math.min(...ok); const hi = Math.max(...ok);
    const n = values.length;
    const out = []; let cur = [];
    values.forEach((v, i) => {
      if (v == null || !Number.isFinite(v)) { if (cur.length > 1) out.push(cur); cur = []; return; }
      const x = n <= 1 ? width / 2 : 2 + (i / (n - 1)) * (width - 4);
      const y = hi === lo ? 11 : 20 - ((v - lo) / (hi - lo)) * 18;
      cur.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    });
    if (cur.length > 1) out.push(cur);
    return out.map((c) => c.join(' '));
  }, [values, width]);
  return (
    <Svg width={Math.max(width, 0)} height={22}>
      {pts.map((p, i) => (
        <Polyline key={i} points={p} fill="none" stroke={color} strokeWidth={1.7}
          strokeLinejoin="round" strokeLinecap="round" />
      ))}
    </Svg>
  );
}

/**
 * Una de las tres tarjetas. La elegida se rellena de lima desde la esquina de
 * arriba a la derecha, con el patrón de `StageCards` (T11 §4): círculo de radio
 * = diagonal, 450 ms al llenarse, 200 al vaciarse, y el texto cruza a `onAccent`.
 */
function MetricTile({ selected, onPress, label, value, unit, sub, values, color, empty = false }) {
  const th     = useTheme();
  const C      = th.colors;
  const styles = useThemedStyles(makeStyles);
  const [w, setW] = useState(0);
  const p = useSharedValue(selected ? 1 : 0);

  useEffect(() => {
    p.set(withTiming(selected ? 1 : 0, { duration: selected ? FILL_MS : EMPTY_MS, easing: Easing.out(Easing.cubic) }));
  }, [selected, p]);

  const circle = useAnimatedStyle(() => ({ transform: [{ scale: p.get() }] }));
  const off    = useAnimatedStyle(() => ({ opacity: interpolate(p.get(), [0, 0.6], [1, 0], 'clamp') }));
  const on     = useAnimatedStyle(() => ({ opacity: interpolate(p.get(), [0.4, 1], [0, 1], 'clamp') }));
  const R      = Math.ceil(Math.hypot(w, TILE_H));

  const face = (c, small, sparkColor, valueColor, style) => (
    <Reanimated.View style={[styles.tileFace, style]} pointerEvents="none">
      {/* Orden de las Progress cards de Ejercicios: cifra, nombre, gráfica, subtítulo. */}
      <View style={styles.statValueBlock}>
        <Text style={[styles.statValue, { color: empty && c === C.text ? C.muted : valueColor }]} numberOfLines={1}
          adjustsFontSizeToFit minimumFontScale={0.6}>
          {value}
          {unit ? <Text style={[styles.statUnit, { color: small }]}>{` ${unit}`}</Text> : null}
        </Text>
        <Text style={[styles.statLabel, { color: c }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{label}</Text>
      </View>
      <Spark values={values} color={sparkColor} width={w - spacing.lg * 2} />
      <Text style={[styles.statSub, { color: small }]} numberOfLines={1}>{sub}</Text>
    </Reanimated.View>
  );

  return (
    <TouchableOpacity
      style={[styles.statTile, empty && styles.tileEmpty]}
      onPress={onPress}
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${label}, ${value}${unit ? ` ${unit}` : ''}, ${sub}`}
    >
      {w > 0 && (
        <Reanimated.View
          pointerEvents="none"
          style={[styles.tileFill, { width: R * 2, height: R * 2, borderRadius: R, left: w - R, top: -R }, circle]}
        />
      )}
      {face(C.text, C.mutedLight, color, color, off)}
      {face(C.onAccent, withOpacity(C.onAccent, 0.65), C.onAccent, C.onAccent, on)}
    </TouchableOpacity>
  );
}

// ── Panel ─────────────────────────────────────────────────────────────────────

export default function LoadTab({
  baseLog, allExercises, fallbackBodyWeight, subjectName, client = null,
  onRefresh, refreshing = false,
}) {
  const insets = useSafeAreaInsets();
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { t, i18n } = useTranslation();
  const navigate = useStore((s) => s.navigate);

  // Desde la ficha del cliente los textos hablan de él en tercera persona.
  const third = client != null;
  const dec   = (n) => (i18n.language?.startsWith('es') ? String(n).replace('.', ',') : String(n));

  const [info, setInfo] = useState(null);
  const [metric, setMetric] = useState('load');   // no se guarda (T11 §4)

  // Un solo periodo para toda la pestaña, preferencia del usuario (T11 §3).
  const storedPeriod = useStore((s) => s.profile.loadPeriod);
  const setProfile   = useStore((s) => s.setProfile);
  const period = PERIODS.includes(storedPeriod) ? storedPeriod : '3m';

  // Peso de referencia: el que pase el llamador (la ficha de cliente trae el suyo;
  // el perfil, más al día que el log) o, si no, el más reciente que aparezca en el
  // propio historial.
  const bodyWeight = useMemo(() => {
    if (fallbackBodyWeight != null) return fallbackBodyWeight;
    const withWeight = (baseLog ?? [])
      .filter((e) => e.bodyWeight != null)
      .sort((a, b) => b.timestamp - a.timestamp);
    return withWeight[0]?.bodyWeight ?? null;
  }, [fallbackBodyWeight, baseLog]);

  // `now` se congela al montar: las ventanas no deben moverse con la pantalla
  // abierta, y `Date.now()` dentro del useMemo es impuro (react-hooks/purity).
  const [now] = useState(() => Date.now());

  // Cálculo SIEMPRE sobre el log completo (§4.1): el periodo recorta lo que se pinta.
  const load = useMemo(
    () => loadSummary(baseLog, allExercises, { fallbackBodyWeight: bodyWeight, now }),
    [baseLog, allExercises, bodyWeight, now],
  );
  const { days, mean7, mean28 } = load;

  const perfAll = useMemo(
    () => performanceWeekly(baseLog ?? [], allExercises, { fallbackBodyWeight: bodyWeight }),
    [baseLog, allExercises, bodyWeight],
  );

  const tiles = useMemo(() => {
    const eff = effortBlocks(baseLog, days);
    const from = load.endDay != null ? load.endDay - 8 * 7 * 86400000 : 0;
    return {
      loadSpark: loadBlocks(days),
      effortSpark: eff,
      effort7: eff.length ? eff[eff.length - 1] : null,
      strengthSpark: perfAll.filter((w) => w.weekStart >= from).map((w) => w.index),
      strengthPct: strengthChange(baseLog, allExercises, { fallbackBodyWeight: bodyWeight, endDay: load.endDay }),
    };
  }, [baseLog, allExercises, bodyWeight, days, load.endDay, perfAll]);

  // Ventana visible — recorta SOLO lo que se pinta.
  const visible = useMemo(() => {
    const n = PERIOD_DAYS[period];
    if (!n || days.length <= n) return { days, mean7, mean28 };
    return { days: days.slice(-n), mean7: mean7.slice(-n), mean28: mean28.slice(-n) };
  }, [period, days, mean7, mean28]);

  const state = loadState(mean7[mean7.length - 1], mean28[mean28.length - 1]);
  const ms = useMemo(() => monotonyStrain(days), [days]);

  const groupSets = useMemo(() => {
    const DAY = 86400000;
    const week  = setsByMuscleGroup(baseLog ?? [], allExercises, { from: now - 7 * DAY,  to: now });
    const month = setsByMuscleGroup(baseLog ?? [], allExercises, { from: now - 28 * DAY, to: now });
    // Un grupo que entrenas habitualmente pero NO esta semana tiene que salir a
    // cero, no desaparecer: el hueco es exactamente lo que hay que ver.
    const byGroup = new Map(week.map((g) => [g.group, g.sets]));
    for (const { group } of month) if (!byGroup.has(group)) byGroup.set(group, 0);
    return [...byGroup.entries()]
      .map(([group, sets]) => ({ group, sets }))
      .sort((a, b) => b.sets - a.sets);
  }, [baseLog, allExercises, now]);

  /**
   * Esfuerzo vs carga, SEMANAL (necesita sRPE). El indexado se hace DESPUÉS de
   * recortar por periodo; la lectura del chip sale de la serie COMPLETA.
   */
  const effort = useMemo(() => {
    if (load.source !== 'internal') return null;
    const allWeeks = weeklySeries(days);
    if (allWeeks.length < 2) return null;
    const nWeeks  = Math.ceil(PERIOD_DAYS[period] / 7);
    const shown   = allWeeks.slice(-nWeeks);
    return {
      external: indexTo100(shown.map((w) => w.external)),
      internal: indexTo100(shown.map((w) => w.internal)),
      trend: effortTrend(
        indexTo100(allWeeks.map((w) => w.external)),
        indexTo100(allWeeks.map((w) => w.internal)),
      ),
    };
  }, [days, period, load.source]);

  const performance = useMemo(() => {
    if (perfAll.length < 2) return null;
    const nWeeks  = Math.ceil(PERIOD_DAYS[period] / 7);
    const shown   = perfAll.slice(-nWeeks);
    const values  = indexTo100(shown.map((w) => w.index));
    const last    = [...values].reverse().find((v) => v != null);
    return { values, pct: last != null ? Math.round(last - 100) : null, weeks: shown.length };
  }, [perfAll, period]);

  const scroll = (children) => (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[styles.content, { paddingBottom: spacing.xxl + insets.bottom }]}
      showsVerticalScrollIndicator={false}
      refreshControl={onRefresh ? (
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh}
          tintColor={th.colors.accent} colors={[th.colors.accent]} />
      ) : undefined}
    >
      {children}
    </ScrollView>
  );

  if (!days.length) {
    return scroll(
      <EmptyState
        style={styles.emptyState}
        ghost="bars"
        title={t('empty.loadTitle')}
        text={third ? t('load.emptyThird', { name: subjectName ?? '' }) : t('empty.loadText')}
        // Desde la ficha no hay «Empieza a entrenar»: llevaría al Entreno del entrenador.
        action={third ? undefined : { label: t('empty.startTraining'), onPress: () => navigate('home') }}
      />,
    );
  }

  const stateColor = state === 'loading'   ? th.colors.orange
    : state === 'unloading' ? th.colors.mutedLight
    : th.colors.accent;

  const monotonyLabel = ms.monotony == null ? null : t(ms.monotony >= MONOTONY_HIGH ? 'load.monotonyHigh'
    : ms.monotony >= MONOTONY_MODERATE ? 'load.monotonyModerate' : 'load.monotonyLow');

  const signed = (n) => `${n > 0 ? '+' : ''}${n} %`;
  const pctOrDash = (n) => (n != null && Number.isFinite(n) ? signed(n) : '—');

  // Título, «i» y qué ficha abre, según la tarjeta elegida.
  const chartHead = {
    load:     { title: load.source === 'external' ? t('load.workTitle') : t('load.trendTitle'), info: { chart: 'loadOverTime', ids: ['sessionLoad', 'movingAverage', 'loadState'] } },
    effort:   { title: t('load.effortTitle'), info: { chart: 'effortVsLoad', ids: ['externalLoad', 'sessionLoad', 'indexed100'] } },
    strength: { title: t('load.perfTitle'), info: { chart: 'performance', ids: ['performanceIndex', 'e1rm'] } },
  }[metric];

  return scroll(
    <>
      {/* ── Tarjetas: eligen la gráfica de debajo ───────────────────────── */}
      <View style={styles.statsGrid}>
        <MetricTile
          selected={metric === 'load'} onPress={() => setMetric('load')}
          label={t('load.cardLoad')} value={pctOrDash(load.vs28)}
          sub={t(third ? 'load.vsMonthThird' : 'load.vsMonthYou')}
          values={tiles.loadSpark} color={th.colors.accent}
        />
        <MetricTile
          selected={metric === 'effort'} onPress={() => setMetric('effort')}
          label={t('load.cardEffort')} value={tiles.effort7 != null ? dec(tiles.effort7.toFixed(1)) : '—'}
          unit={tiles.effort7 != null ? '/10' : null}
          sub={load.source === 'external' ? t('load.noEffort') : t('load.last7d')}
          empty={load.source === 'external'}
          values={tiles.effortSpark} color={th.colors.orange}
        />
        <MetricTile
          selected={metric === 'strength'} onPress={() => setMetric('strength')}
          label={t('load.cardStrength')} value={pctOrDash(tiles.strengthPct)}
          sub={t('load.in4Weeks')}
          values={tiles.strengthSpark} color={th.colors.accent}
        />
      </View>

      {/* ── La gráfica de la tarjeta elegida ────────────────────────────── */}
      <View style={styles.card}>
        <View style={styles.cardHead}>
          <InfoLabel align="left" textStyle={styles.cardTitle} onPress={() => setInfo(chartHead.info)}>
            {chartHead.title}
          </InfoLabel>
          <View style={styles.segmentedWrap}>
            <SegmentedControl
              options={PERIOD_OPTIONS} value={period}
              onChange={(id) => setProfile({ loadPeriod: id })}
            />
          </View>
        </View>

        {metric === 'load' && (
          <>
            {state && (
              <View style={styles.read}>
                <View style={[styles.dot, styles.readDot, { backgroundColor: stateColor }]} />
                <Text style={styles.stripText}>
                  <Text style={styles.stripTitle}>
                    {t(`load.state${third ? 'Third' : ''}${state[0].toUpperCase()}${state.slice(1)}`)}
                  </Text>
                  {` ${t('load.stateVs')}`}
                </Text>
              </View>
            )}

            <LoadChart days={visible.days} mean7={visible.mean7} mean28={visible.mean28} />

            <View style={styles.legend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendBar, { backgroundColor: th.colors.muted }]} />
                <Text style={styles.legendText}>{t('load.legendDaily')}</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendLine, { backgroundColor: th.colors.accent }]} />
                <Text style={styles.legendText}>{t('load.legend7d')}</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendLine, { backgroundColor: th.colors.blue }]} />
                <Text style={styles.legendText}>{t('load.legend28d')}</Text>
              </View>
            </View>

            {load.source === 'external' && (
              <Text style={styles.groupHint}>{t(third ? 'load.workHintThird' : 'load.workHint')}</Text>
            )}

            <View style={styles.fact}>
              <View style={styles.factHead}>
                <InfoLabel align="left" textStyle={styles.factTitle} onPress={() => setInfo({ ids: ['monotony'] })}>
                  {t('load.monotony')}
                </InfoLabel>
                <Text style={[styles.factValue, ms.monotony != null && ms.monotony >= MONOTONY_MODERATE && styles.factValueFlat]}>
                  {ms.monotony != null ? `${dec(ms.monotony.toFixed(1))} · ${monotonyLabel}` : '—'}
                </Text>
              </View>
              <Text style={styles.groupHint}>
                {ms.monotony != null
                  ? t(third ? 'load.monotonyHintThird' : 'load.monotonyHint')
                  : t('load.needsSessions', { n: MIN_SESSIONS_FOR_MONOTONY })}
              </Text>
            </View>

            <View style={styles.fact}>
              <View style={styles.factHead}>
                <InfoLabel align="left" textStyle={styles.factTitle} onPress={() => setInfo({ ids: ['strain'] })}>
                  {t('load.strain')}
                </InfoLabel>
                <Text style={styles.factValue}>{pctOrDash(ms.strainPct)}</Text>
              </View>
              <Text style={styles.groupHint}>{t(third ? 'load.strainHintThird' : 'load.strainHint')}</Text>
            </View>
          </>
        )}

        {metric === 'effort' && (effort ? (
          <>
            <IndexChart series={[
              { values: effort.internal, color: th.colors.orange },
              { values: effort.external, color: th.colors.accent },
            ]} />

            <View style={styles.legend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendLine, { backgroundColor: th.colors.accent }]} />
                <Text style={styles.legendText}>{t('load.legendExternal')}</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendLine, { backgroundColor: th.colors.orange }]} />
                <Text style={styles.legendText}>{t('load.legendEffort')}</Text>
              </View>
            </View>

            {effort.trend && (
              <View style={[
                styles.trendChip,
                effort.trend === 'adaptation' && styles.trendChipGood,
                effort.trend === 'fatigue'    && styles.trendChipWarn,
              ]}>
                <Text style={[
                  styles.trendChipText,
                  effort.trend === 'adaptation' && { color: th.colors.accent },
                  effort.trend === 'fatigue'    && { color: th.colors.orange },
                ]}>
                  {t(`load.trend.${effort.trend}`)}
                </Text>
              </View>
            )}
          </>
        ) : load.source === 'external' ? (
          <>
            <View style={styles.ghostChart}>
              {GHOST_BARS.map((h, i) => <View key={i} style={[styles.ghostBar, { height: `${h}%` }]} />)}
            </View>
            <View style={styles.invite}>
              <Text style={styles.inviteTitle}>
                {third ? t('load.inviteThirdTitle', { name: subjectName ?? '' }) : t('load.inviteTitle')}
              </Text>
              <Text style={styles.groupHint}>{t(third ? 'load.inviteThirdText' : 'load.inviteText')}</Text>
            </View>
          </>
        ) : null)}

        {metric === 'strength' && performance && (
          <>
            <IndexChart series={[{ values: performance.values, color: th.colors.accent }]} height={72} />

            {performance.pct != null && (
              <View style={styles.strip}>
                <View style={[styles.dot, {
                  backgroundColor: performance.pct >= 0 ? th.colors.accent : th.colors.orange,
                }]} />
                <Text style={styles.stripText}>
                  <Text style={styles.stripTitle}>
                    {`${performance.pct > 0 ? '+' : ''}${performance.pct}%`}
                  </Text>
                  {` ${t('load.perfDetail', { weeks: performance.weeks })}`}
                </Text>
              </View>
            )}
          </>
        )}
      </View>

      {/* ── Series por grupo muscular ───────────────────────────────────── */}
      {groupSets.length > 0 && (
        <View style={styles.card}>
          <View style={styles.cardHead}>
            <InfoLabel align="left" textStyle={styles.cardTitle} onPress={() => setInfo({ chart: 'muscleGroups', ids: ['muscleGroupSets'] })}>{t('load.groupsTitle')}</InfoLabel>
            <Text style={styles.cardMeta}>{t('load.last7d')}</Text>
          </View>

          <View style={styles.groupList}>
            {groupSets.map(({ group, sets }) => {
              const scale = Math.max(SETS_SCALE_MIN, groupSets[0].sets);
              const inRange = sets >= SETS_TARGET_MIN && sets <= SETS_TARGET_MAX;
              // Dentro de rango = accent; fuera = naranja, por arriba y por
              // abajo (docs/UI-MIGRATION.md §4.9 — aquí no se usa rojo).
              const color = inRange ? th.colors.accent : th.colors.orange;
              return (
                <View key={group} style={styles.groupRow}>
                  <Text style={styles.groupName} numberOfLines={1}>
                    {group === 'other'
                      ? t('load.groupOther')
                      : t(`exerciseSelector.groups.${group}`)}
                  </Text>
                  <View style={styles.groupTrack}>
                    <View style={[styles.groupFill, {
                      width: `${Math.min(100, (sets / scale) * 100)}%`,
                      backgroundColor: color,
                    }]} />
                    {/* Marcas del rango de referencia */}
                    <View style={[styles.groupMark, { left: `${(SETS_TARGET_MIN / scale) * 100}%` }]} />
                    <View style={[styles.groupMark, { left: `${(SETS_TARGET_MAX / scale) * 100}%` }]} />
                  </View>
                  <Text style={[styles.groupCount, { color }]}>{sets}</Text>
                </View>
              );
            })}
          </View>

          <Text style={styles.groupHint}>
            {t('load.groupsHint', { min: SETS_TARGET_MIN, max: SETS_TARGET_MAX })}
          </Text>
        </View>
      )}

      <MetricInfoSheet chart={info?.chart} ids={info?.ids} onClose={() => setInfo(null)} />
    </>,
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const makeStyles = (th) => StyleSheet.create({
  flex:    { flex: 1 },
  // `paddingTop: md` = el aire que había entre el conmutador y esto cuando el
  // conmutador iba dentro del scroll; ahora lo monta ProgressPanel encima.
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.md },

  segmentedWrap: { width: 150 },

  // Mismas Progress cards que la pestaña de Ejercicios (gap 8, radio `md`: U13 §12).
  statsGrid: { flexDirection: 'row', gap: spacing.sm2, width: '100%', height: TILE_H, alignItems: 'center' },
  statTile: {
    flex:            1,
    height:          TILE_H,
    backgroundColor: th.colors.surface,
    borderRadius:    th.radius.md,
    overflow:        'hidden',
  },
  tileFill: { position: 'absolute', backgroundColor: th.colors.accent },
  tileFace: {
    ...StyleSheet.absoluteFillObject,
    alignItems:     'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    gap:            spacing.sm,
  },
  statValueBlock: { alignItems: 'center', gap: spacing.xs },
  // Sin dato (ESFUERZO sin sRPE): en contorno y sin fondo; al elegirla se llena igual.
  tileEmpty: { backgroundColor: 'transparent', borderWidth: 1, borderColor: th.colors.border },
  statValue: { ...textStyles.title, textAlign: 'center' },
  statUnit:  { ...textStyles.label },
  statLabel: {
    ...textStyles.caps,
    textTransform: 'uppercase',
    textAlign:     'center',
  },
  statSub: { ...textStyles.label, textAlign: 'center' },

  card: {
    backgroundColor: th.colors.surface,
    borderRadius:    th.radius.md,
    padding:         spacing.lg,
    gap:             spacing.md,
  },
  cardHead:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { ...textStyles.labelStrong, color: th.colors.text, textTransform: 'uppercase' },
  cardMeta:  { ...textStyles.label, color: th.colors.mutedLight },

  legend:     { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  legendBar:  { width: 4, height: 9, borderRadius: 1 },
  legendLine: { width: 13, height: 2, borderRadius: 2 },
  legendText: { ...textStyles.label, color: th.colors.mutedLight },

  strip: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             spacing.sm2,
    backgroundColor: th.colors.surface2,
    borderRadius:    th.radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.md,
  },
  dot:        { width: 7, height: 7, borderRadius: 4 },
  read:       { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm2 },
  readDot:    { marginTop: 4 },

  // Filas de Monotonía y Strain: línea encima, sin caja.
  fact:          { gap: spacing.xs2, borderTopWidth: 1, borderTopColor: th.colors.border, paddingTop: spacing.md },
  factHead:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  factTitle:     { ...textStyles.labelStrong, color: th.colors.text },
  factValue:     { ...textStyles.labelStrong, color: th.colors.accent, textAlign: 'right', flexShrink: 1 },
  factValueFlat: { color: th.colors.mutedLight },

  // Esfuerzo sin sRPE: barras fantasma en contorno e invitación.
  ghostChart:  { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, height: 70 },
  ghostBar:    { flex: 1, borderRadius: th.radius.xs, borderWidth: 1, borderColor: th.colors.border },
  invite:      { gap: spacing.sm, backgroundColor: th.colors.surface2, borderRadius: th.radius.md, padding: spacing.md },
  inviteTitle: { ...textStyles.labelStrong, color: th.colors.text, lineHeight: 15 },
  stripText:  { ...textStyles.label, color: th.colors.mutedLight, flex: 1, lineHeight: 15 },
  stripTitle: { ...textStyles.label, color: th.colors.text },

  // ── Chip de lectura (esfuerzo vs carga) ──
  trendChip: {
    alignSelf:         'flex-start',
    backgroundColor:   th.colors.surface2,
    borderRadius:      th.radius.xs,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.sm,
  },
  trendChipGood: { backgroundColor: th.tint.accent10 },
  trendChipWarn: { backgroundColor: th.tint.orange30 },
  trendChipText: {
    ...textStyles.caps,
    color:         th.colors.mutedLight,
    textTransform: 'uppercase',
  },

  // ── Series por grupo ──
  groupList:  { gap: spacing.sm2 },
  groupRow:   { flexDirection: 'row', alignItems: 'center', gap: spacing.sm2 },
  groupName:  { ...textStyles.label, color: th.colors.mutedLight, width: 76 },
  groupTrack: {
    flex: 1, height: 9, borderRadius: 3,
    backgroundColor: th.colors.surface2,
    overflow: 'hidden',
  },
  groupFill:  { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 3 },
  groupMark:  { position: 'absolute', top: 0, bottom: 0, width: 1, backgroundColor: th.colors.bg },
  groupCount: { ...textStyles.labelStrong, width: 22, textAlign: 'right', fontVariant: ['tabular-nums'] },
  groupHint:  { ...textStyles.label, color: th.colors.mutedLight, lineHeight: 15 },

  emptyState: { paddingVertical: spacing.xxl },
});
