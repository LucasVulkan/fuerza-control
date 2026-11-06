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
  loadState, setsByMuscleGroup, indexTo100, performanceWeekly,
  loadSummary, effortBlocks, weekBlocks, ratedSessions, effortVsLoad, rpeByExercise, strengthChange, monotonyStrain,
  SETS_TARGET_MIN, SETS_TARGET_MAX, MONOTONY_MODERATE, MONOTONY_HIGH, MIN_SESSIONS_FOR_MONOTONY,
} from '../../utils/trainingLoad';
import { spacing, textStyles, withOpacity } from '../../theme';
import { useTheme, useThemedStyles } from '../../useTheme';
import SegmentedControl from '../ui/SegmentedControl';
import EmptyState from '../ui/EmptyState';
import { FILL_MS, EMPTY_MS } from '../ui/StageCards';
import { InfoLabel, MetricInfoSheet } from '../ui/MetricInfo';

// "7D" no existe aquí: siete barras y dos líneas planas no son una tendencia.
const PERIOD_DAYS = { '1m': 30, '3m': 90, '6m': 180 };
const PERIOD_KEY  = { '1m': 'periodMonth', '3m': 'period3m', '6m': 'period6m' };

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

const GUIDE = { strokeDasharray: '2 3', strokeWidth: 1 };

/** Ancho de la columna del eje: el de su rótulo más largo (≈ 6,6 px por carácter a 11-12 px) y 6 de aire. */
const axisWidth = (labels) => Math.ceil(Math.max(...labels.map((l) => l.length)) * 6.6) + 6;

/** Fechas bajo el área de la gráfica: la primera, un par en medio y la última. `right` = ancho del eje. */
function XLabels({ dates, right = 0, span = 1 }) {
  const th = useTheme();
  const { i18n } = useTranslation();
  if (!dates || dates.length < 2) return null;
  const n = dates.length;
  const m = Math.min(span > 1 ? 3 : 4, n);
  const fmt = (ts) => new Date(ts).toLocaleDateString(i18n.language, { day: 'numeric', month: 'short' });
  // Con `span` (días por barra) cada rótulo es la franja: «4–10 ago», «28 oct–3 nov».
  const label = (ts) => {
    if (span <= 1) return fmt(ts);
    const a = new Date(ts); const b = new Date(ts); b.setDate(b.getDate() + span - 1);
    return a.getMonth() === b.getMonth() ? `${a.getDate()}–${fmt(b)}` : `${fmt(a)}–${fmt(b)}`;
  };
  const idx = [...new Set(Array.from({ length: m }, (_, k) => Math.round((k * (n - 1)) / (m - 1))))];
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingRight: right, marginTop: spacing.xs2 }}>
      {idx.map((i) => (
        <Text key={i} style={[textStyles.micro, { color: th.colors.mutedLight }]}>
          {label(dates[i])}
        </Text>
      ))}
    </View>
  );
}

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

    // Una guía cada 7 días, contando desde el último.
    const guides = days.map((_, i) => i).filter((i) => (days.length - 1 - i) % 7 === 0).map(x);

    return { bars, guides, line7: toSegments(mean7), line28: toSegments(mean28) };
  }, [width, days, mean7, mean28]);

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {geometry && (
        <Svg width={width} height={CHART_H}>
          {geometry.guides.map((gx, i) => (
            <Line key={`g${i}`} x1={gx} x2={gx} y1={PAD_TOP} y2={CHART_H - PAD_BOT} stroke={th.colors.surface2} {...GUIDE} />
          ))}
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
      <XLabels dates={days.map((d) => d.day)} />
    </View>
  );
}

/**
 * Gráfico de líneas indexadas (base 100) para las series SEMANALES.
 *
 * Separado de `LoadChart` porque no comparte nada con él: sin barras, pocos
 * puntos, y una referencia horizontal en 100 que es la mitad del mensaje.
 */
function IndexChart({ series, dates, height = 96 }) {
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
    const guides = Array.from({ length: n }, (_, i) => x(i));
    return { lines, guides, baselineY: y(100) };
  }, [width, series, height]);

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {geometry && (
        <Svg width={width} height={height}>
          {geometry.guides.map((gx, i) => (
            <Line key={`g${i}`} x1={gx} x2={gx} y1={8} y2={height - 8} stroke={th.colors.surface2} {...GUIDE} />
          ))}
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
      <XLabels dates={dates} />
    </View>
  );
}

/** Columna de etiquetas del eje, colocadas en la misma `y` que las marcas del gráfico. */
function AxisLabels({ ticks, height, width }) {
  const th = useTheme();
  return (
    <View style={{ width, height }}>
      {ticks.map(({ y, label }) => (
        <Text key={label} style={[textStyles.label, { position: 'absolute', right: 0, top: y - 7, lineHeight: 14, color: th.colors.mutedLight }]}>
          {label}
        </Text>
      ))}
    </View>
  );
}

/** Barras de sRPE en escala 0-10 con el eje 0 · 5 · 10 a la derecha. `bars`: [{ v, recent }]; `dates`: un día por barra. */
function EffortBars({ bars, dates, guides = false, height = 84 }) {
  const th = useTheme();
  const [width, setWidth] = useState(0);
  const y = (v) => PAD_TOP + (height - PAD_TOP - PAD_BOT) * (1 - v / 10);
  const step = width / Math.max(bars.length, 1);
  const bw = Math.max(2, Math.min(18, step * 0.6));
  const ticks = [10, 5, 0].map((v) => ({ y: y(v), label: String(v) }));
  const aw = axisWidth(ticks.map((t) => t.label));
  return (
    <View>
    <View style={{ flexDirection: 'row', gap: spacing.sm }}>
      <View style={{ flex: 1 }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 && (
          <Svg width={width} height={height}>
            {guides && bars.slice(1).map((_, i) => (
              <Line key={`g${i}`} x1={(i + 1) * step} x2={(i + 1) * step} y1={PAD_TOP} y2={y(0)} stroke={th.colors.surface2} {...GUIDE} />
            ))}
            {[0, 5, 10].map((v) => (
              <Line key={v} x1={0} x2={width} y1={y(v)} y2={y(v)} stroke={th.colors.surface2} strokeWidth={1} />
            ))}
            {bars.map((b, i) => b.v == null ? null : (
              <Rect key={i} x={i * step + (step - bw) / 2} y={y(b.v)} width={bw} height={y(0) - y(b.v)} rx={2}
                fill={th.colors.orange} opacity={b.recent ? 1 : 0.45} />
            ))}
          </Svg>
        )}
      </View>
      <AxisLabels height={height} width={aw} ticks={ticks} />
    </View>
    <XLabels dates={dates} right={aw + spacing.sm} span={guides ? 7 : 1} />
    </View>
  );
}

/** Líneas en % de cambio con eje de % a la derecha (pasos de 5, 10 o 20 según el rango) y punto al final. */
function PctChart({ series, dates, height = 110 }) {
  const th = useTheme();
  const [width, setWidth] = useState(0);
  const g = useMemo(() => {
    const vals = series.flatMap((l) => l.values).filter((v) => v != null);
    if (!width || vals.length < 2) return null;
    const lo = Math.min(...vals, 0);
    const hi = Math.max(...vals, 0);
    // Como mucho 5 marcas en el eje: el primer paso «redondo» que las deja en 4 tramos.
    const stepP = [5, 10, 20, 25, 50, 100, 200, 250, 500, 1000]
      .find((st) => Math.ceil(hi / st) - Math.floor(lo / st) <= 4) ?? 1000;
    const tLo = Math.floor(lo / stepP) * stepP;
    const tHi = Math.max(Math.ceil(hi / stepP) * stepP, tLo + stepP);
    const y = (v) => PAD_TOP + (height - PAD_TOP - PAD_BOT) * (1 - (v - tLo) / (tHi - tLo));
    const n = Math.max(...series.map((l) => l.values.length));
    const x = (i) => (n <= 1 ? width / 2 : (i / (n - 1)) * (width - DOT_R * 2) + DOT_R);
    const ticks = [];
    for (let v = tLo; v <= tHi; v += stepP) ticks.push({ v, y: y(v), label: `${v > 0 ? '+' : ''}${v} %` });
    const lines = series.map((l) => {
      const segments = []; let cur = [];
      l.values.forEach((v, i) => {
        if (v == null) { if (cur.length > 1) segments.push(cur); cur = []; return; }
        cur.push(`${x(i).toFixed(1)},${y(v).toFixed(1)}`);
      });
      if (cur.length > 1) segments.push(cur);
      let last = null;
      l.values.forEach((v, i) => { if (v != null) last = { x: x(i), y: y(v) }; });
      return { color: l.color, segments: segments.map((c) => c.join(' ')), last };
    });
    const guides = Array.from({ length: n }, (_, i) => x(i));
    return { ticks, lines, guides, axisW: axisWidth(ticks.map((tk) => tk.label)) };
  }, [width, series, height]);
  return (
    <View>
    <View style={{ flexDirection: 'row', gap: spacing.sm }}>
      <View style={{ flex: 1 }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {g && (
          <Svg width={width} height={height}>
            {g.guides.map((gx, i) => (
              <Line key={`g${i}`} x1={gx} x2={gx} y1={PAD_TOP} y2={height - PAD_BOT} stroke={th.colors.surface2} {...GUIDE} />
            ))}
            {g.ticks.map((t) => (
              <Line key={t.v} x1={0} x2={width} y1={t.y} y2={t.y} stroke={th.colors.surface2} strokeWidth={1}
                strokeDasharray={t.v === 0 ? '3 3' : undefined} />
            ))}
            {g.lines.map((l, li) => (
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
      {g && <AxisLabels height={height} width={g.axisW} ticks={g.ticks} />}
    </View>
    {g && <XLabels dates={dates} right={g.axisW + spacing.sm} />}
    </View>
  );
}

// ── Tarjetas de selección ─────────────────────────────────────────────────────

const TILE_H = 108;   // la altura de las de Ejercicios
const PERIODS = ['1m', '3m', '6m'];

/**
 * Una de las tres tarjetas. La elegida se rellena de lima desde la esquina de
 * arriba a la derecha, con el patrón de `StageCards` (T11 §4): círculo de radio
 * = diagonal, 450 ms al llenarse, 200 al vaciarse, y el texto cruza a `onAccent`.
 */
function MetricTile({ selected, onPress, label, value, unit, sub, color, empty = false }) {
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

  const face = (c, small, valueColor, style) => (
    <Reanimated.View style={[styles.tileFace, style]} pointerEvents="none">
      {/* Las Progress cards de Ejercicios: cifra y nombre, y debajo el subtítulo. */}
      <View style={styles.statValueBlock}>
        <Text style={[styles.statValue, { color: empty && c === C.text ? C.muted : valueColor }]} numberOfLines={1}
          adjustsFontSizeToFit minimumFontScale={0.6}>
          {value}
          {unit ? <Text style={[styles.statUnit, { color: small }]}>{` ${unit}`}</Text> : null}
        </Text>
        <Text style={[styles.statLabel, { color: c }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{label}</Text>
      </View>
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
      {face(C.text, C.mutedLight, color, off)}
      {face(C.onAccent, withOpacity(C.onAccent, 0.65), C.onAccent, on)}
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
    return {
      effort7: eff.length ? eff[eff.length - 1] : null,
      strengthPct: strengthChange(baseLog, allExercises, { fallbackBodyWeight: bodyWeight, endDay: load.endDay }),
    };
  }, [baseLog, allExercises, bodyWeight, days, load.endDay]);

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

  // Esfuerzo (T11-04), solo con sRPE: cifras, barras por semana o sesión y esfuerzo vs carga.
  const [effortView, setEffortView] = useState('weeks');   // no se guarda
  const nBlocks = Math.ceil(PERIOD_DAYS[period] / 7);
  const effort = useMemo(() => {
    if (load.source !== 'internal' || load.endDay == null) return null;
    const rated = ratedSessions(baseLog, load.endDay, PERIOD_DAYS[period]);
    const recentTs = new Set(ratedSessions(baseLog, load.endDay, 7).map((r) => r.ts));
    const blocks = weekBlocks(days, nBlocks);
    const means = effortBlocks(baseLog, days, nBlocks);
    const vs = effortVsLoad(days, { n: nBlocks });
    const vsN = vs.external.length;
    const vsBlocks = weekBlocks(days, Math.max(nBlocks, 8)).filter((b) => b.length === 7).slice(-vsN);
    return {
      recentMean: means.length ? means[means.length - 1] : null,
      weekDates: blocks.map((b) => b[0].day),
      sessionDates: rated.map((r) => r.ts),
      vsDates: vsBlocks.map((b) => b[0].day),
      countPeriod: rated.length,
      meanPeriod: rated.length ? rated.reduce((a, r) => a + r.rpe, 0) / rated.length : null,
      weekBars: means.map((v, i) => ({ v, recent: i === means.length - 1 })),
      weekStart: blocks.length ? blocks[0][0].day : null,
      sessionBars: rated.map((r) => ({ v: r.rpe, recent: recentTs.has(r.ts) })),
      sessionStart: rated.length ? rated[0].ts : null,
      vs,
      hasVs: vs.external.filter((v) => v != null).length >= 2,
    };
  }, [baseLog, days, load.source, load.endDay, period, nBlocks]);

  // RPE medio por ejercicio (T11-05): también sin sRPE, solo con RPE en las series.
  const rpeRows = useMemo(() => {
    if (load.endDay == null) return [];
    const from = new Date(load.endDay);
    from.setDate(from.getDate() - (PERIOD_DAYS[period] - 1));
    return rpeByExercise(baseLog, { from: from.getTime(), endDay: load.endDay });
  }, [baseLog, load.endDay, period]);

  const performance = useMemo(() => {
    if (perfAll.length < 2) return null;
    const nWeeks  = Math.ceil(PERIOD_DAYS[period] / 7);
    const shown   = perfAll.slice(-nWeeks);
    const values  = indexTo100(shown.map((w) => w.index));
    const last    = [...values].reverse().find((v) => v != null);
    return { values, dates: shown.map((w) => w.weekStart), pct: last != null ? Math.round(last - 100) : null, weeks: shown.length };
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
  const cap = (str) => str.charAt(0).toUpperCase() + str.slice(1);

  // Título, «i» y qué ficha abre, según la tarjeta elegida.
  const chartHead = {
    load:     { title: load.source === 'external' ? t('load.workTitle') : t('load.trendTitle'), info: { chart: 'loadOverTime', ids: ['sessionLoad', 'movingAverage', 'loadState'] } },
    effort:   { title: t('load.effortBarsTitle'), info: { ids: ['sessionLoad'] } },
    strength: { title: t('load.perfTitle'), info: { chart: 'performance', ids: ['performanceIndex', 'e1rm'] } },
  }[metric];

  const vsChip = effort?.vs.chip;
  const vsColor = vsChip?.label === 'adaptation' ? th.colors.accent
    : vsChip?.label === 'fatigue' ? th.colors.orange : th.colors.text;

  // Fila de la cifra: dato principal, su unidad y, si hay, el chip con el cambio.
  const figure = (value, unit, chip, color = th.colors.text) => (
    <View style={styles.valueRow}>
      <Text style={[styles.value, { color }]} numberOfLines={1}>
        {value}
        {unit ? <Text style={styles.valueUnit}>{` ${unit}`}</Text> : null}
      </Text>
      {chip || null}
    </View>
  );

  const hot = rpeRows.reduce((m, r) => (r.rpe4w != null && (m == null || r.rpe4w > m) ? r.rpe4w : m), null);

  return scroll(
    <>
      {/* ── Tarjetas: eligen la gráfica de debajo ───────────────────────── */}
      <View style={styles.statsGrid}>
        <MetricTile
          selected={metric === 'load'} onPress={() => setMetric('load')}
          label={t('load.cardLoad')} value={pctOrDash(load.vs28)}
          sub={t(third ? 'load.vsMonthThird' : 'load.vsMonthYou')} color={th.colors.accent}
        />
        <MetricTile
          selected={metric === 'effort'} onPress={() => setMetric('effort')}
          label={t('load.cardEffort')} value={tiles.effort7 != null ? dec(tiles.effort7.toFixed(1)) : '—'}
          unit={tiles.effort7 != null ? 'RPE' : null}
          sub={load.source === 'external' ? t('load.noEffort') : t('load.last7d')}
          empty={load.source === 'external'} color={th.colors.orange}
        />
        <MetricTile
          selected={metric === 'strength'} onPress={() => setMetric('strength')}
          label={t('load.cardStrength')} value={pctOrDash(tiles.strengthPct)}
          sub={t('load.in4Weeks')} color={th.colors.accent}
        />
      </View>

      {/* ── Un solo periodo para toda la pestaña, pegado a las tarjetas ──── */}
      <View>
        <SegmentedControl
          options={PERIODS.map((id) => ({ id, label: t(`load.${PERIOD_KEY[id]}`) }))}
          value={period}
          onChange={(id) => setProfile({ loadPeriod: id })}
        />
      </View>

      {/* ── La gráfica de la tarjeta elegida ────────────────────────────── */}
      <View style={styles.card}>
        <View style={styles.cardHead}>
          <InfoLabel align="left" textStyle={styles.cardTitle} onPress={() => setInfo(chartHead.info)}>
            {chartHead.title}
          </InfoLabel>
          {metric === 'effort' && effort && (
            <View style={styles.views}>
              {['weeks', 'sessions'].map((id) => (
                <TouchableOpacity key={id} onPress={() => setEffortView(id)} hitSlop={8}
                  accessibilityRole="button" accessibilityState={{ selected: effortView === id }}>
                  <Text style={[styles.viewBtn, { color: effortView === id ? th.colors.accent : th.colors.mutedLight }]}>
                    {t(id === 'weeks' ? 'load.effortWeeks' : 'load.effortSessions')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {metric === 'load' && (
          <>
            {load.vs28 != null && figure(pctOrDash(load.vs28), t(third ? 'load.vsMonthLongThird' : 'load.vsMonthLongYou'), null, th.colors.accent)}

            <LoadChart days={visible.days} mean7={visible.mean7} mean28={visible.mean28} />

            <View style={styles.chips}>
              <View style={styles.chip}>
                <View style={[styles.legendBar, { backgroundColor: th.colors.muted }]} />
                <Text style={styles.chipMuted}>{t('load.legendDaily')}</Text>
              </View>
              <View style={styles.chip}>
                <View style={[styles.legendLine, { backgroundColor: th.colors.accent }]} />
                <Text style={styles.chipMuted}>{t('load.legend7d')}</Text>
              </View>
              <View style={styles.chip}>
                <View style={[styles.legendLine, { backgroundColor: th.colors.blue }]} />
                <Text style={styles.chipMuted}>{t('load.legend28d')}</Text>
              </View>
            </View>

            {state && (
              <View style={styles.strip}>
                <View style={[styles.dot, { backgroundColor: stateColor }]} />
                <Text style={styles.stripText}>
                  <Text style={styles.stripTitle}>
                    {t(`load.state${third ? 'Third' : ''}${state[0].toUpperCase()}${state.slice(1)}`)}
                  </Text>
                  {` ${t('load.stateVs')}`}
                </Text>
              </View>
            )}

            {load.source === 'external' && (
              <Text style={styles.groupHint}>{t(third ? 'load.workHintThird' : 'load.workHint')}</Text>
            )}

          </>
        )}

        {metric === 'effort' && (effort ? (
          <>
            {figure(
              effort.recentMean != null ? dec(effort.recentMean.toFixed(1)) : '—',
              t('load.rpeLast7'),
              effort.meanPeriod != null ? (
                <View style={styles.chipBox}>
                  <Text style={styles.chipMuted}>
                    {`${t('load.rpeMeanChip', { p: t(`load.${PERIOD_KEY[period]}`).toLowerCase() })} `}
                    <Text style={styles.chipStrong}>{dec(effort.meanPeriod.toFixed(1))}</Text>
                    {` · ${t('load.sessionsCount', { count: effort.countPeriod })}`}
                  </Text>
                </View>
              ) : null,
            )}

            <EffortBars
              bars={effortView === 'weeks' ? effort.weekBars : effort.sessionBars}
              dates={effortView === 'weeks' ? effort.weekDates : effort.sessionDates}
              guides={effortView === 'weeks'}
            />

            <View style={styles.chips}>
              <View style={styles.chip}>
                <View style={[styles.dot, { backgroundColor: th.colors.orange, opacity: 0.45 }]} />
                <Text style={styles.chipMuted}>
                  {t(effortView === 'weeks' ? 'load.legendEarlierWeeks' : 'load.legendEarlierSessions')}
                </Text>
              </View>
              <View style={styles.chip}>
                <View style={[styles.dot, { backgroundColor: th.colors.orange }]} />
                <Text style={styles.chipMuted}>
                  {t('load.last7d')}
                </Text>
              </View>
            </View>
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
            {performance.pct != null && figure(signed(performance.pct), null, null,
              performance.pct >= 0 ? th.colors.accent : th.colors.orange)}

            <IndexChart series={[{ values: performance.values, color: th.colors.accent }]} dates={performance.dates} height={72} />

            {performance.pct != null && (
              <View style={styles.chips}>
                <View style={styles.chip}>
                  <View style={[styles.dot, {
                    backgroundColor: performance.pct >= 0 ? th.colors.accent : th.colors.orange,
                  }]} />
                  <Text style={styles.chipMuted}>{cap(t('load.perfDetail', { weeks: performance.weeks }))}</Text>
                </View>
              </View>
            )}
          </>
        )}
      </View>

      {/* ── Monotonía y strain (solo con CARGA elegida) ─────────────────── */}
      {metric === 'load' && (
        <>
          <View style={styles.factCard}>
            <View style={styles.cardHead}>
              <InfoLabel align="left" textStyle={styles.cardTitle} onPress={() => setInfo({ ids: ['monotony'] })}>
                {t('load.monotony')}
              </InfoLabel>
              <Text style={[styles.factValue, ms.monotony != null && ms.monotony >= MONOTONY_MODERATE && styles.factValueFlat]}>
                {ms.monotony != null ? `${dec(ms.monotony.toFixed(1))} · ${monotonyLabel}` : '—'}
              </Text>
            </View>
            <View style={styles.chipBox}>
              <Text style={styles.chipMuted}>
                {ms.monotony != null
                  ? t(third ? 'load.monotonyHintThird' : 'load.monotonyHint')
                  : t('load.needsSessions', { n: MIN_SESSIONS_FOR_MONOTONY })}
              </Text>
            </View>
          </View>
          <View style={styles.factCard}>
            <View style={styles.cardHead}>
              <InfoLabel align="left" textStyle={styles.cardTitle} onPress={() => setInfo({ ids: ['strain'] })}>
                {t('load.strain')}
              </InfoLabel>
              <Text style={styles.factValue}>{pctOrDash(ms.strainPct)}</Text>
            </View>
            <View style={styles.chipBox}>
              <Text style={styles.chipMuted}>{t(third ? 'load.strainHintThird' : 'load.strainHint')}</Text>
            </View>
          </View>
        </>
      )}

      {/* ── Esfuerzo vs carga (solo con ESFUERZO elegida) ───────────────── */}
      {metric === 'effort' && effort?.hasVs && (
        <View style={styles.card}>
          <View style={styles.cardHead}>
            <InfoLabel align="left" textStyle={styles.cardTitle}
              onPress={() => setInfo({ chart: 'effortVsLoad', ids: ['externalLoad', 'sessionLoad'] })}>
              {t('load.effortTitle')}
            </InfoLabel>
            <Text style={styles.cardMeta}>{t('load.weeksShown', { count: effort.vs.external.length })}</Text>
          </View>

          {vsChip && figure(cap(t(`load.trend.${vsChip.label}`)), null, null, vsColor)}

          <PctChart series={[
            { values: effort.vs.internal, color: th.colors.orange },
            { values: effort.vs.external, color: th.colors.accent },
          ]} dates={effort.vsDates} />

          {vsChip && (
            <>
              <View style={styles.chips}>
                <View style={styles.chip}>
                  <View style={[styles.dot, { backgroundColor: th.colors.accent }]} />
                  <Text style={styles.chipMuted}>{t('load.legendLoad')}</Text>
                  <Text style={styles.chipStrong}>{signed(Math.round(vsChip.loadPct))}</Text>
                </View>
                <View style={styles.chip}>
                  <View style={[styles.dot, { backgroundColor: th.colors.orange }]} />
                  <Text style={styles.chipMuted}>{t('load.legendEffort')}</Text>
                  <Text style={styles.chipStrong}>{signed(Math.round(vsChip.effortPct))}</Text>
                </View>
              </View>
              <Text style={styles.groupHint}>{t('load.trendHint')}</Text>
            </>
          )}
        </View>
      )}

      {/* ── RPE por ejercicio (solo con ESFUERZO elegida) ────────────────── */}
      {metric === 'effort' && rpeRows.length > 0 && (
        <View style={styles.card}>
          <View style={styles.cardHead}>
            <Text style={styles.cardTitle}>{t('load.rpeTitle')}</Text>
          </View>

          <View>
            <View style={styles.rpeRow}>
              <Text style={[styles.rpeHead, styles.rpeName]} numberOfLines={1}>{t('load.rpeExercise')}</Text>
              <Text style={[styles.rpeHead, styles.rpeNum]} numberOfLines={1}>{t('load.rpeSets')}</Text>
              {period === '1m' ? (
                <Text style={[styles.rpeHead, styles.rpeNum]} numberOfLines={1}>{t('load.rpeSingle')}</Text>
              ) : (
                <>
                  <Text style={[styles.rpeHead, styles.rpeNum]} numberOfLines={1}>{t('load.rpe4w')}</Text>
                  <Text style={[styles.rpeHead, styles.rpeNum]} numberOfLines={1}>{period.toUpperCase()}</Text>
                </>
              )}
            </View>
            {rpeRows.map((r) => {
              const def = allExercises?.[r.exerciseId];
              const name = def ? (i18n.language === 'en' ? (def.nameEn ?? def.name) : def.name) : r.exerciseId;
              const fmt = (v) => (v != null ? dec(v.toFixed(1)) : '—');
              return (
                <View key={r.exerciseId} style={[styles.rpeRow, styles.rpeRowLine]}>
                  <Text style={[styles.rpeCell, styles.rpeName]} numberOfLines={1}>{name}</Text>
                  <Text style={[styles.rpeCell, styles.rpeNumCell, styles.rpeNum]}>{r.sets}</Text>
                  {period === '1m' ? (
                    <Text style={[styles.rpeCell, styles.rpeNumCell, styles.rpeNum]}>{fmt(r.rpePeriod)}</Text>
                  ) : (
                    <>
                      <Text style={[styles.rpeCell, styles.rpeNumCell, styles.rpeNum,
                        hot != null && r.rpe4w === hot && { color: th.colors.orange }]}>{fmt(r.rpe4w)}</Text>
                      <Text style={[styles.rpeCell, styles.rpeNumCell, styles.rpeNum]}>{fmt(r.rpePeriod)}</Text>
                    </>
                  )}
                </View>
              );
            })}
          </View>
          <Text style={styles.groupHint}>{t('load.rpeFoot')}</Text>
        </View>
      )}

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
  // El aire bajo el conmutador de arriba lo pone ProgressPanel (`spacing.xl`).
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.md },

  // Periodo único, pegado a las tarjetas: 4 en vez del hueco normal.

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
    paddingHorizontal: spacing.xl,
    gap:            spacing.lg,
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
  cardTitle: { ...textStyles.caps, color: th.colors.mutedLight, textTransform: 'uppercase' },
  cardMeta:  { ...textStyles.label, color: th.colors.mutedLight },
  views:     { flexDirection: 'row', gap: spacing.md },
  viewBtn:   { ...textStyles.labelStrong },

  // Cifra y su cambio, como en el detalle de ejercicio.
  valueRow:  { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm2 },
  value:     { ...textStyles.heading, flexShrink: 1 },
  valueUnit: { ...textStyles.label, color: th.colors.mutedLight },

  // Chips de lectura y de leyenda.
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: th.colors.surface2, borderRadius: th.radius.xs,
    paddingHorizontal: spacing.sm2, paddingVertical: spacing.xs2,
  },
  chipBox: {
    backgroundColor: th.colors.surface2, borderRadius: th.radius.xs,
    paddingHorizontal: spacing.sm2, paddingVertical: spacing.xs2,
  },
  chipMuted:  { ...textStyles.label, color: th.colors.mutedLight },
  chipStrong: { ...textStyles.labelStrong, color: th.colors.text },
  legendBar:  { width: 4, height: 9, borderRadius: 1 },
  legendLine: { width: 13, height: 2, borderRadius: 2 },

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

  // Filas de Monotonía y Strain: línea encima, sin caja.
  // Monotonía y strain: tarjetas estrechas, título como las gráficas y valor a la derecha.
  factCard: {
    backgroundColor: th.colors.surface, borderRadius: th.radius.md,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.sm,
  },
  factValue: { ...textStyles.bodyStrong, color: th.colors.accent, textAlign: 'right', flexShrink: 1 },
  factValueFlat: { color: th.colors.mutedLight },

  // Esfuerzo sin sRPE: barras fantasma en contorno e invitación.
  ghostChart:  { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, height: 70 },
  ghostBar:    { flex: 1, borderRadius: th.radius.xs, borderWidth: 1, borderColor: th.colors.border },
  invite:      { gap: spacing.sm, backgroundColor: th.colors.surface2, borderRadius: th.radius.md, padding: spacing.md },
  inviteTitle: { ...textStyles.labelStrong, color: th.colors.text, lineHeight: 15 },
  stripText:  { ...textStyles.label, color: th.colors.mutedLight, flex: 1, lineHeight: 15 },
  stripTitle: { ...textStyles.label, color: th.colors.text },

  // ── RPE medio por ejercicio ──
  rpeRow:  { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rpeRowLine: { paddingVertical: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: th.colors.border },
  rpeHead: { ...textStyles.micro, color: th.colors.mutedLight, paddingBottom: spacing.xs2 },
  rpeCell: { ...textStyles.label, color: th.colors.text },
  rpeName: { flex: 1 },
  rpeNum:  { width: 64, textAlign: 'right', fontVariant: ['tabular-nums'] },
  rpeNumCell: { ...textStyles.labelStrong },

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
