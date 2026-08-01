/**
 * LoadTab — panel de carga de entrenamiento (fase 3 de docs/specs/training-load.md).
 *
 * Props (mismos que ProgressTab, para que el conmutador sea intercambiable):
 *   baseLog             WorkoutLog[]  – sesiones a analizar, ya filtradas por sujeto.
 *   allExercises        { [id]: def } – librería + ejercicios propios.
 *   fallbackBodyWeight  number|null   – peso a usar en las entradas que no lo traen.
 *                                       Si no se pasa, se deduce del propio log.
 *
 * REGLA CRÍTICA (spec §4.1): el selector de período recorta lo que se PINTA,
 * nunca lo que se CALCULA. Las medias de 7 y 28 días, la monotonía y el strain
 * salen siempre del log completo — si se filtrara antes, con "1M" seleccionado
 * la media de 28 días sería imposible de calcular.
 *
 * Tampoco hay toggle de "Programa actual": la carga es sistémica y filtrar por
 * programa convertiría las sesiones de fuera en días de descanso falsos.
 */
import { useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import Svg, { Rect, Polyline } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import {
  sessionLoads, dailySeries, rollingMean, monotony, strain, loadState, setsByMuscleGroup,
} from '../../../../src/utils/trainingLoad';
import { spacing, textStyles } from '../../theme';
import { useTheme, useThemedStyles } from '../../useTheme';
import SegmentedControl from '../ui/SegmentedControl';

// "7D" no existe aquí: siete barras y dos líneas planas no son una tendencia.
const PERIOD_OPTIONS = [
  { id: '1m',  label: '1M'   },
  { id: '3m',  label: '3M'   },
  { id: '6m',  label: '6M'   },
  { id: 'all', label: 'Todo' },
];
const PERIOD_DAYS = { '1m': 30, '3m': 90, '6m': 180 };

// Umbrales de monotonía. >2 es la señal de alarma clásica de Foster: mucha
// carga repetida sin variación.
const MONOTONY_MODERATE = 1.5;
const MONOTONY_HIGH     = 2.0;

// Mínimo de sesiones en la semana para que monotonía y strain signifiquen algo.
// Con una o dos, la desviación típica la dominan los ceros y el número miente.
const MIN_SESSIONS_FOR_MONOTONY = 3;

const CHART_H = 140;
const PAD_TOP = 10;
const PAD_BOT = 6;

// Rango de referencia de series semanales por grupo muscular. Es la horquilla
// habitual para hipertrofia; depende del objetivo, y así se dice en el pie.
const SETS_TARGET_MIN = 10;
const SETS_TARGET_MAX = 20;
// Tope de la escala de barras. Fijo para que la longitud signifique lo mismo
// entre grupos y semanas; solo crece si alguien se sale del rango.
const SETS_SCALE_MIN  = 24;

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
      ...days.map((d) => d.internal ?? 0),
      ...mean7.filter((v) => v != null),
      ...mean28.filter((v) => v != null),
    ];
    const max = Math.max(...values, 1);
    const h   = CHART_H - PAD_TOP - PAD_BOT;
    const step = width / days.length;
    const y = (v) => PAD_TOP + h - (v / max) * h;
    const x = (i) => i * step + step / 2;

    const bars = days
      .map((d, i) => ({ i, v: d.internal }))
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

// ── Panel ─────────────────────────────────────────────────────────────────────

export default function LoadTab({ baseLog, allExercises, fallbackBodyWeight, onRefresh, refreshing = false }) {
  const insets = useSafeAreaInsets();
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { t }  = useTranslation();

  const [period, setPeriod] = useState('3m');

  // Peso de referencia: el que pase el llamador (el perfil, más al día que el
  // log) o, si no, el más reciente que aparezca en el propio historial — que es
  // lo correcto cuando el sujeto es un cliente y no el usuario del dispositivo.
  const bodyWeight = useMemo(() => {
    if (fallbackBodyWeight != null) return fallbackBodyWeight;
    const withWeight = (baseLog ?? [])
      .filter((e) => e.bodyWeight != null)
      .sort((a, b) => b.timestamp - a.timestamp);
    return withWeight[0]?.bodyWeight ?? null;
  }, [fallbackBodyWeight, baseLog]);

  // Cálculo SIEMPRE sobre el log completo (§4.1).
  const metrics = useMemo(() => {
    const loads = sessionLoads(baseLog ?? [], allExercises, { fallbackBodyWeight: bodyWeight });
    const days  = dailySeries(loads);
    const internal = days.map((d) => d.internal);
    return {
      loads,
      days,
      internal,
      mean7:  rollingMean(internal, 7),
      mean28: rollingMean(internal, 28),
    };
  }, [baseLog, allExercises, bodyWeight]);

  const { loads, days, internal, mean7, mean28 } = metrics;

  const summary = useMemo(() => {
    if (!days.length) return null;
    const week        = internal.slice(-7);
    const weekDays    = days.slice(-7);
    const weekSessions = weekDays.reduce((a, d) => a + d.sessions, 0);
    const weekLoad    = week.reduce((a, v) => a + (v ?? 0), 0);

    const m7  = mean7[mean7.length - 1];
    const m28 = mean28[mean28.length - 1];

    const enoughSessions = weekSessions >= MIN_SESSIONS_FOR_MONOTONY;
    const mono   = enoughSessions ? monotony(week) : null;
    const strn   = enoughSessions ? strain(week)   : null;

    // Línea base del strain: las 4 semanas anteriores a la actual. Un umbral
    // absoluto de strain no existe — solo vale contra el propio historial.
    const prevStrains = [];
    for (let k = 1; k <= 4; k++) {
      const from = internal.length - 7 * (k + 1);
      if (from < 0) break;
      const s = strain(internal.slice(from, from + 7));
      if (s != null) prevStrains.push(s);
    }
    const strainBase = prevStrains.length
      ? prevStrains.reduce((a, b) => a + b, 0) / prevStrains.length
      : null;

    return {
      weekLoad,
      weekSessions,
      vs28: m28 > 0 && m7 != null ? Math.round((m7 / m28 - 1) * 100) : null,
      mono,
      strain: strn,
      strainPct: strn != null && strainBase > 0 ? Math.round((strn / strainBase - 1) * 100) : null,
      state: loadState(m7, m28),
    };
  }, [days, internal, mean7, mean28]);

  // Ventana visible — recorta SOLO lo que se pinta.
  const visible = useMemo(() => {
    const n = PERIOD_DAYS[period];
    if (!n || days.length <= n) return { days, mean7, mean28 };
    return {
      days:   days.slice(-n),
      mean7:  mean7.slice(-n),
      mean28: mean28.slice(-n),
    };
  }, [period, days, mean7, mean28]);

  // Series por grupo de los últimos 7 días — ventana móvil, NO semana natural:
  // un lunes por la mañana la semana natural está casi vacía y el panel diría
  // que te falta todo.
  // `now` se congela al montar: la ventana no debe moverse mientras la pantalla
  // está abierta, y `Date.now()` dentro del useMemo es impuro (react-hooks/purity).
  const [now] = useState(() => Date.now());
  const groupSets = useMemo(() => {
    const DAY = 86400000;
    const week  = setsByMuscleGroup(baseLog ?? [], allExercises, { from: now - 7 * DAY,  to: now });
    const month = setsByMuscleGroup(baseLog ?? [], allExercises, { from: now - 28 * DAY, to: now });
    // Un grupo que entrenas habitualmente pero NO esta semana tiene que salir a
    // cero, no desaparecer: el hueco es exactamente lo que hay que ver. La
    // referencia de "habitualmente" son los últimos 28 días del propio usuario.
    const byGroup = new Map(week.map((g) => [g.group, g.sets]));
    for (const { group } of month) if (!byGroup.has(group)) byGroup.set(group, 0);
    return [...byGroup.entries()]
      .map(([group, sets]) => ({ group, sets }))
      .sort((a, b) => b.sets - a.sets);
  }, [baseLog, allExercises, now]);

  const hasSessions = (loads?.length ?? 0) > 0;
  const hasRpe      = loads.some((l) => l.internal != null);

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

  if (!hasSessions || !hasRpe) {
    return scroll(
      <View style={styles.emptyState}>
        <Text style={styles.emptyText}>
          {!hasSessions ? t('load.emptyNoSessions') : t('load.emptyNoRpe')}
        </Text>
      </View>,
    );
  }

  const monoLabel = summary?.mono == null ? null
    : summary.mono >= MONOTONY_HIGH     ? t('load.monotonyHigh')
    : summary.mono >= MONOTONY_MODERATE ? t('load.monotonyModerate')
    : t('load.monotonyLow');
  const monoColor = summary?.mono == null ? th.colors.mutedLight
    : summary.mono >= MONOTONY_HIGH     ? th.colors.red
    : summary.mono >= MONOTONY_MODERATE ? th.colors.orange
    : th.colors.accent;

  const stateColor = summary?.state === 'loading'   ? th.colors.orange
    : summary?.state === 'unloading' ? th.colors.mutedLight
    : th.colors.accent;

  const signed = (n) => `${n > 0 ? '+' : ''}${n}%`;

  return scroll(
    <>
      <View style={styles.controlRow}>
        <View style={styles.segmentedWrap}>
          <SegmentedControl options={PERIOD_OPTIONS} value={period} onChange={setPeriod} />
        </View>
      </View>

      {/* ── Indicadores ─────────────────────────────────────────────────── */}
      <View style={styles.statsGrid}>
        <View style={styles.statTile}>
          <View style={styles.statValueBlock}>
            <Text style={[styles.statValue, { color: th.colors.accent }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
              {Math.round(summary.weekLoad)}
            </Text>
            <Text style={styles.statLabel}>{t('load.load7d')}</Text>
          </View>
          <Text style={[styles.statSub, { color: th.tint.accent50 }]} numberOfLines={1}>
            {summary.vs28 != null ? `${signed(summary.vs28)} ${t('load.vs28d')}` : '—'}
          </Text>
        </View>

        <View style={styles.statTile}>
          <View style={styles.statValueBlock}>
            <Text style={[styles.statValue, { color: monoColor }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
              {summary.mono != null ? summary.mono.toFixed(1) : '—'}
            </Text>
            <Text style={styles.statLabel}>{t('load.monotony')}</Text>
          </View>
          <Text style={[styles.statSub, { color: monoColor }]} numberOfLines={1}>
            {monoLabel ?? t('load.needsSessions')}
          </Text>
        </View>

        <View style={styles.statTile}>
          <View style={styles.statValueBlock}>
            <Text style={[styles.statValue, { color: th.colors.accent }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
              {summary.strain != null ? Math.round(summary.strain) : '—'}
            </Text>
            <Text style={styles.statLabel}>{t('load.strain')}</Text>
          </View>
          <Text style={[styles.statSub, { color: th.tint.accent50 }]} numberOfLines={1}>
            {summary.strainPct != null ? `${signed(summary.strainPct)} ${t('load.vsBaseline')}` : '—'}
          </Text>
        </View>
      </View>

      {/* ── Tendencia ───────────────────────────────────────────────────── */}
      <View style={styles.card}>
        <View style={styles.cardHead}>
          <Text style={styles.cardTitle}>{t('load.trendTitle')}</Text>
          <Text style={styles.cardMeta}>{t('load.perDay')}</Text>
        </View>

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

        {summary.state && (
          <View style={styles.strip}>
            <View style={[styles.dot, { backgroundColor: stateColor }]} />
            <Text style={styles.stripText}>
              <Text style={styles.stripTitle}>{t(`load.state.${summary.state}.title`)}</Text>
              {` ${t(`load.state.${summary.state}.detail`, { pct: Math.abs(summary.vs28 ?? 0) })}`}
            </Text>
          </View>
        )}
      </View>

      {/* ── Series por grupo muscular ───────────────────────────────────── */}
      {groupSets.length > 0 && (
        <View style={styles.card}>
          <View style={styles.cardHead}>
            <Text style={styles.cardTitle}>{t('load.groupsTitle')}</Text>
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
    </>,
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const makeStyles = (th) => StyleSheet.create({
  flex:    { flex: 1 },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.md },

  controlRow:    { flexDirection: 'row', alignItems: 'center' },
  segmentedWrap: { width: 198 },

  // Mismas Progress cards que la pestaña de Ejercicios.
  statsGrid: { flexDirection: 'row', gap: spacing.md, width: '100%', height: 108, alignItems: 'center' },
  statTile: {
    flex:              1,
    backgroundColor:   th.colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.lg,
    borderRadius:      th.radius.lg,
    alignItems:        'center',
    justifyContent:    'center',
    overflow:          'hidden',
    gap:               spacing.sm,
  },
  statValueBlock: { alignItems: 'center', gap: spacing.xs },
  statValue: { ...textStyles.hero, textAlign: 'center' },
  statLabel: {
    ...textStyles.spacingTag,
    textTransform: 'uppercase',
    color:         th.colors.text,
    textAlign:     'center',
  },
  statSub: { ...textStyles.tag, textAlign: 'center' },

  card: {
    backgroundColor: th.colors.surface,
    borderRadius:    th.radius.lg,
    padding:         spacing.lg,
    gap:             spacing.md,
  },
  cardHead:  { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  cardTitle: { ...textStyles.cardType, color: th.colors.text, textTransform: 'uppercase' },
  cardMeta:  { ...textStyles.tag, color: th.colors.mutedLight },

  legend:     { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  legendBar:  { width: 4, height: 9, borderRadius: 1 },
  legendLine: { width: 13, height: 2, borderRadius: 2 },
  legendText: { ...textStyles.tag, color: th.colors.mutedLight },

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
  stripText:  { ...textStyles.tag, color: th.colors.mutedLight, flex: 1, lineHeight: 15 },
  stripTitle: { ...textStyles.tag, color: th.colors.text },

  // ── Series por grupo ──
  groupList:  { gap: spacing.sm2 },
  groupRow:   { flexDirection: 'row', alignItems: 'center', gap: spacing.sm2 },
  groupName:  { ...textStyles.tag, color: th.colors.mutedLight, width: 76 },
  groupTrack: {
    flex: 1, height: 9, borderRadius: 3,
    backgroundColor: th.colors.surface2,
    overflow: 'hidden',
  },
  groupFill:  { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 3 },
  groupMark:  { position: 'absolute', top: 0, bottom: 0, width: 1, backgroundColor: th.colors.bg },
  groupCount: { ...textStyles.cardType, width: 22, textAlign: 'right', fontVariant: ['tabular-nums'] },
  groupHint:  { ...textStyles.tag, color: th.colors.muted, lineHeight: 15 },

  emptyState: { alignItems: 'center', paddingVertical: spacing.xxl, paddingHorizontal: spacing.lg },
  emptyText:  { ...textStyles.subtitle, color: th.colors.mutedLight, textAlign: 'center', lineHeight: 19 },
});
