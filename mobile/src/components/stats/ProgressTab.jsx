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

import { useState, useMemo } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { Text, TextInput } from '../ui/Text';
import Reanimated, { LinearTransition } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useStore }      from '../../../store/useStore';
import { useWeightUnit } from '../../hooks/useWeightUnit';
import { spacing, textStyles, withOpacity, getCardRadii } from '../../theme';
import { useTheme, useThemedStyles } from '../../useTheme';
import {
  getExerciseLogsFrom, seriesMetric, linearRegressionPct, computeOverallImprovement,
  computeLastLoadDelta,
} from '../../utils/improvement';
import { recapStats }     from '../../utils/sessionRecap';
import { filterBySearch } from '../../utils/searchText';
import SegmentedControl  from '../ui/SegmentedControl';
import { MetricInfoSheet } from '../ui/MetricInfo';
import { CloseIcon } from '../ui/EditorIcons';
import RoundCheck from '../ui/RoundCheck';
import EmptyState from '../ui/EmptyState';
import { Rise } from '../ui/Rise';
import { ROW_ICON } from '../ui/rowIcons';
import DragSheet from '../DragSheet';
import ExerciseDetail from './ExerciseDetail';
import { periodOptions, fmtVol } from './progressFormat';
import { programTemplateOf, isFreeEntry } from '../../utils/freeSessions';

// ── Pure helpers ──────────────────────────────────────────────────────────────

function filterLog(log, scope, period, programTemplateIds) {
  let filtered = [...log];
  if (scope === 'program' && programTemplateIds.size > 0) {
    // Las libres entran solo si sustituyen a una sesión (T06-free-sessions.md §8).
    filtered = filtered.filter((e) => programTemplateIds.has(programTemplateOf(e)));
  }
  if (period !== 'all') {
    const days   = period === '7d' ? 7 : period === '1m' ? 30 : period === '3m' ? 90 : 365;
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    filtered     = filtered.filter((e) => e.timestamp >= cutoff);
  }
  return filtered;
}

// Tonelaje de una sesión. Delega en `recapStats` para no tener dos definiciones
// de "volumen" en la app: la de aquí se dejaba fuera las sub-series de los
// dropsets, que son trabajo real y el recap sí contaba.
function getSessionTotalVol(session) {
  return recapStats(session).volume;
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

// ── ExerciseStatCard ───────────────────────────────────────────────────────────

function ExerciseStatCard({ exerciseId, def, allLogs, periodLogs, isFirst, isLast, onOpen }) {
  const { t, i18n } = useTranslation();
  const th       = useTheme();
  const styles   = useThemedStyles(makeStyles);

  const effectiveLogs  = allLogs ?? periodLogs ?? [];
  const sessionsCount  = (periodLogs ?? effectiveLogs).length;
  const name           = def ? (i18n.language === 'en' ? (def.nameEn ?? def.name) : def.name) : '—';
  const improvePct     = useMemo(
    () => linearRegressionPct(periodLogs ?? effectiveLogs, def, seriesMetric(effectiveLogs, def)),
    [periodLogs, effectiveLogs, def]
  );

  if (!effectiveLogs.length) return null;

  return (
    <>
      <TouchableOpacity
        style={[styles.exRow, getCardRadii(th, isFirst, isLast)]}
        onPress={() => onOpen(exerciseId)}
        activeOpacity={0.72}
      >
        <View style={styles.exLeft}>
          <Text style={styles.exName} numberOfLines={1}>{name}</Text>
          <Text style={styles.exSub} numberOfLines={1}>
            {t('stats.sessionsCount', { count: sessionsCount })}
            {improvePct !== null && (
              // Fragmento y no `<Text>`: un Text anidado sin estilo pasa por el
              // wrapper de ui/Text, que le inyecta la familia por defecto y le
              // rompe la herencia del padre. Aquí sólo hay que agrupar.
              <>
                {' · '}
                <Text style={{ color: improvePct >= 0 ? th.colors.accent : th.colors.orange }}>
                  {`${improvePct > 0 ? '+' : ''}${improvePct}%`}
                </Text>
                {' '}{t('stats.progressSuffix')}
              </>
            )}
          </Text>
        </View>
        <Text style={styles.exChevron}>›</Text>
      </TouchableOpacity>
    </>
  );
}

// ── ProgressTab ────────────────────────────────────────────────────────────────

export default function ProgressTab({ baseLog, programTemplateIds, allExercises, onRefresh, refreshing = false }) {
  const insets = useSafeAreaInsets();
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { t, i18n } = useTranslation();
  const periods = useMemo(() => periodOptions(t), [t]);
  const { toDisplay: wDisplay, label: weightLabel } = useWeightUnit();
  const getEffectiveTemplate = useStore((s) => s.getEffectiveTemplate);

  const [info, setInfo] = useState(null);

  const [scope,         setScope]         = useState('all');
  const [period,        setPeriod]        = useState('all');
  const [search,        setSearch]        = useState('');
  const [selectedExIds, setSelectedExIds] = useState(new Set());
  const [filterOpen,    setFilterOpen]    = useState(false);
  // El ejercicio abierto en el detalle; null = cerrado.
  const [detailId,      setDetailId]      = useState(null);

  // Cambiar de periodo o de alcance cambia qué ejercicios hay: la selección se
  // vacía con él (antes lo hacía un efecto).
  const changePeriod = (p) => { setPeriod(p); setSelectedExIds(new Set()); };
  const toggleScope  = () => { setScope((s) => (s === 'program' ? 'all' : 'program')); setSelectedExIds(new Set()); };

  function toggleEx(id) {
    Haptics.selectionAsync().catch(() => {});
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

  // Display strings — deltas con signo: accent/accent50 si >=0 o null, orange si <0.
  const improveStr   = improvePct !== null ? `${improvePct > 0 ? '+' : ''}${improvePct}%` : '—';
  const improveColor = (improvePct === null || improvePct >= 0) ? th.colors.accent : th.colors.orange;
  const loadSubStr   = lastLoadDelta !== null
    ? `${lastLoadDelta > 0 ? '+' : ''}${lastLoadDelta}% ${t('stats.lastSessionShort')}`
    : null;
  const loadSubColor = (lastLoadDelta === null || lastLoadDelta >= 0) ? th.tint.accent50 : th.colors.orange;

  const volStr      = volImprovePct !== null ? `${volImprovePct > 0 ? '+' : ''}${volImprovePct}%` : '—';
  const volColor    = (volImprovePct === null || volImprovePct >= 0) ? th.colors.accent : th.colors.orange;
  const volSubColor = (lastSesDelta === null || lastSesDelta >= 0) ? th.tint.accent50 : th.colors.orange;
  const volSubStr   = lastSesVol
    ? `${fmtVol(lastSesVol, wDisplay)} ${weightLabel} ${t('stats.lastSessionShort')}`
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
    // «Programa actual» enseña los ejercicios del programa… y los de las
    // sesiones libres que sustituyen a una (T06-free-sessions.md §8): si el
    // entreno cuenta como del programa, lo que se hizo en él también. En
    // `filteredLog` ya solo quedan las libres marcadas.
    const allowed = new Set([
      ...programExerciseIds,
      ...filteredLog.filter(isFreeEntry).flatMap((log) => log.exercises.map((e) => e.exerciseId)),
    ]);
    const scoped = (scope === 'program' && hasProgramScope)
      ? allIds.filter((id) => allowed.has(id))
      : allIds;
    return scoped.filter((id) => getExerciseLogsFrom(id, filteredLog).length > 0);
  }, [filteredLog, scope, hasProgramScope, programExerciseIds]);

  // { A: [ids], B: [ids] } — los ejercicios de cada sesión que tienen registro
  // aquí. Las A de varias etapas se juntan: en la hoja es una sola letra.
  const sessionGroups = useMemo(() => {
    if (!hasProgramScope) return [];
    const withLogs = new Set(exercisesWithLogs);
    const map = {};
    [...programTemplateIds].forEach((tplId) => {
      const tpl = getEffectiveTemplate(tplId);
      if (!tpl?.label) return;
      tpl.exercises.forEach((e) => {
        if (!withLogs.has(e.exerciseId)) return;
        const ids = (map[tpl.label] ??= []);
        if (!ids.includes(e.exerciseId)) ids.push(e.exerciseId);
      });
    });
    return Object.keys(map).sort().map((label) => ({ label, ids: map[label] }));
  }, [hasProgramScope, programTemplateIds, getEffectiveTemplate, exercisesWithLogs]);

  function toggleSessionGroup(ids) {
    Haptics.selectionAsync().catch(() => {});
    setSelectedExIds((prev) => {
      const all  = ids.every((id) => prev.has(id));
      const next = new Set(prev);
      ids.forEach((id) => (all ? next.delete(id) : next.add(id)));
      return next;
    });
  }

  const exName = (id) => {
    const d = allExercises[id];
    return d ? (i18n.language === 'en' ? (d.nameEn ?? d.name) : d.name) : id;
  };

  const displayedExercises = useMemo(() => {
    const base = selectedExIds.size > 0
      ? exercisesWithLogs.filter((id) => selectedExIds.has(id))
      : exercisesWithLogs;

    const q = search.trim();
    if (!q) return base;
    const matching = filterBySearch(base, q, (id) => {
      const def = allExercises[id];
      return def ? (i18n.language === 'en' ? (def.nameEn ?? def.name) : def.name) : id;
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
          tintColor={th.colors.accent}
          colors={[th.colors.accent]}
        />
      ) : undefined}
    >
      {/* ── Grupo control + cards (Figma 122:899: gap 15, py 10) ──────────────── */}
      {/* Entra por partes solo en el tab Progresión (que da el reloj); en la
          ficha de cliente los `Rise` no hacen nada. */}
      <View style={styles.headerGroup}>
      {/* ── Fila de control: período + toggle programa ──────────────────────── */}
      <Rise index={1}>
      <View style={styles.controlRow}>
        <View style={styles.segmentedWrap}>
          <SegmentedControl options={periods} value={period} onChange={changePeriod} />
        </View>
        {hasProgramScope && (
          <TouchableOpacity
            style={[styles.programToggle, scope === 'program' && styles.programToggleActive]}
            onPress={toggleScope}
            activeOpacity={0.75}
          >
            <Text style={[styles.programToggleText, scope === 'program' && styles.programToggleTextActive]}>
              {t('stats.currentProgram')}
            </Text>
          </TouchableOpacity>
        )}
      </View>
      </Rise>

      {/* ── Progress cards ───────────────────────────────────────────────────── */}
      <Rise index={2}>
      <View style={styles.statsGrid}>
        <TouchableOpacity
          style={styles.statTile}
          onPress={() => setInfo({ ids: ['sessionCount'] })}
          activeOpacity={0.75}
        >
          <View style={styles.statValueBlock}>
            <Text style={[styles.statValue, { color: th.colors.accent }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{String(filteredLog.length)}</Text>
            <Text style={styles.statLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{t('stats.statSessions')}</Text>
          </View>
          <Text style={[styles.statSub, { color: th.tint.accent50 }]} numberOfLines={1}>
            {t('stats.thisWeek', { count: thisWeekCount })}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.statTile}
          onPress={() => setInfo({ ids: ['loadTrend'] })}
          activeOpacity={0.75}
        >
          <View style={styles.statValueBlock}>
            <Text style={[styles.statValue, { color: improveColor }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{improveStr}</Text>
            <Text style={styles.statLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{t('stats.statTrend')}</Text>
          </View>
          <Text style={[styles.statSub, { color: loadSubColor }]} numberOfLines={1}>
            {loadSubStr ?? '—'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.statTile}
          onPress={() => setInfo({ ids: ['volumeTrend'] })}
          activeOpacity={0.75}
        >
          <View style={styles.statValueBlock}>
            <Text style={[styles.statValue, { color: volColor }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{volStr}</Text>
            <Text style={styles.statLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{t('stats.statVolume')}</Text>
          </View>
          <Text style={[styles.statSub, { color: volSubColor }]} numberOfLines={1}>
            {volSubStr ?? '—'}
          </Text>
        </TouchableOpacity>
      </View>
      </Rise>
      </View>

      {/* ── Búsqueda + filtros (la caja de Clientes) ─────────────────────── */}
      <Rise index={3}>
      <View style={styles.searchRow}>
        <View style={styles.searchInputWrap}>
          <Svg viewBox="0 0 24 24" width={17} height={17} fill="none"
            stroke={th.colors.mutedLight} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm10 2-4.35-4.35" />
          </Svg>
          <TextInput
            style={styles.searchInput}
            placeholder={t('stats.searchExercise')}
            placeholderTextColor={th.colors.mutedLight}
            value={search}
            onChangeText={setSearch}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={8} style={styles.searchClearBtn}>
              <CloseIcon size={16} color={th.colors.mutedLight} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={[styles.iconBox, selectedExIds.size > 0 && styles.iconBoxActive]}
          onPress={() => setFilterOpen(true)}
          disabled={exercisesWithLogs.length === 0}
          activeOpacity={0.7}
        >
          <Svg viewBox="0 0 24 24" width={20} height={20} fill="none"
            stroke={selectedExIds.size > 0 ? th.colors.accent : th.colors.text}
            strokeWidth={2} strokeLinecap="round">
            <Path d="M3 6h18M6 12h12M9 18h6" />
          </Svg>
          {selectedExIds.size > 0 && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{selectedExIds.size}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
      </Rise>

      {/* Lista de ejercicios (siempre visible) */}
      {displayedExercises.length === 0 ? (
        <Rise index={5}>
        <EmptyState
          style={styles.emptyState}
          icon={ROW_ICON.progress}
          text={baseLog.length === 0
            ? t('stats.emptyFirstSession')
            : search.trim()
              ? t('stats.emptyNoMatch')
              : t('stats.noData')}
        />
        </Rise>
      ) : (
        <Reanimated.View style={styles.exerciseList} layout={LinearTransition.duration(200)}>
          {displayedExercises.map((exerciseId, idx) => {
            const def        = allExercises[exerciseId];
            const periodLogs = getExerciseLogsFrom(exerciseId, filteredLog);
            const allLogs    = getExerciseLogsFrom(exerciseId, filteredLogScope);
            return (
              <Rise key={exerciseId} index={5 + idx}>
              <ExerciseStatCard
                exerciseId={exerciseId}
                def={def}
                allLogs={allLogs}
                periodLogs={periodLogs}
                isFirst={idx === 0}
                isLast={idx === displayedExercises.length - 1}
                onOpen={setDetailId}
              />
              </Rise>
            );
          })}
        </Reanimated.View>
      )}

      <MetricInfoSheet ids={info?.ids} onClose={() => setInfo(null)} />

      {/* Filtrar ejercicios: por sesión de golpe, o uno a uno */}
      <DragSheet
        visible={filterOpen}
        onClose={() => setFilterOpen(false)}
        title={t('stats.filterExercises')}
        action={selectedExIds.size > 0 ? { label: t('stats.reset'), onPress: () => setSelectedExIds(new Set()) } : undefined}
        footer={(
          <TouchableOpacity style={styles.cta} onPress={() => setFilterOpen(false)} activeOpacity={0.85}>
            <Text style={styles.ctaText}>
              {selectedExIds.size > 0
                ? t('exerciseSelector.filters.see', { count: selectedExIds.size })
                : t('stats.seeAll')}
            </Text>
          </TouchableOpacity>
        )}
      >
        {sessionGroups.length > 0 && (
          <>
            <Text style={styles.sheetCaps}>{t('stats.bySession')}</Text>
            <View style={styles.sessionPills}>
              {sessionGroups.map(({ label, ids }) => {
                const on = ids.every((id) => selectedExIds.has(id));
                return (
                  <TouchableOpacity
                    key={label}
                    style={[styles.sessionPill, on && styles.sessionPillOn]}
                    onPress={() => toggleSessionGroup(ids)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.sessionPillText, on && styles.sessionPillTextOn]}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}
        <Text style={styles.sheetCaps}>{t('stats.exercisesN', { count: exercisesWithLogs.length })}</Text>
        <View style={styles.exerciseList}>
          {exercisesWithLogs.map((id, i) => {
            const on = selectedExIds.has(id);
            return (
              <TouchableOpacity
                key={id}
                style={[styles.exRow, getCardRadii(th, i === 0, i === exercisesWithLogs.length - 1), on && styles.exRowSel]}
                onPress={() => toggleEx(id)}
                activeOpacity={0.7}
              >
                <View style={styles.exLeft}>
                  <Text style={styles.exName} numberOfLines={1}>{exName(id)}</Text>
                  <Text style={styles.exSub} numberOfLines={1}>
                    {t('stats.sessionsCount', { count: getExerciseLogsFrom(id, filteredLog).length })}
                  </Text>
                </View>
                <RoundCheck on={on} />
              </TouchableOpacity>
            );
          })}
        </View>
      </DragSheet>

      <ExerciseDetail
        exerciseId={detailId}
        order={displayedExercises}
        baseLog={baseLog}
        allExercises={allExercises}
        programTemplateIds={programTemplateIds}
        onChange={setDetailId}
        onClose={() => setDetailId(null)}
      />
    </ScrollView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const makeStyles = (th) => StyleSheet.create({
  flex:    { flex: 1 },
  // Página Figma (122:789): padding lateral space/lg (15), gap space/md (10).
  // `paddingTop: md` = el aire que había entre el conmutador y esto cuando el
  // conmutador iba dentro del scroll; ahora lo monta ProgressPanel encima.
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.md },

  // Grupo control+cards (Figma 122:899): gap space/lg (15) + padding vertical space/md (10).
  // Sólo abajo: el `gap` del contentContainer ya pone los 10 de arriba, y con el
  // padding además el contenido arrancaba 10px más bajo que en Carga e Historial
  // — el conmutador de Progresión es el mismo en las tres y tiene que verse igual.
  headerGroup: { width: '100%', gap: spacing.lg, paddingBottom: spacing.md },

  // ── Control row: segmented período + toggle programa ─────────────────────────
  controlRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    width:          '100%',
  },
  segmentedWrap: { width: 198 },
  programToggle: {
    backgroundColor:   th.colors.surface2,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.md,
    borderRadius:      th.radius.sm,
  },
  programToggleActive: { backgroundColor: th.colors.accent },
  programToggleText:       { ...textStyles.labelStrong, color: th.colors.mutedLight },
  programToggleTextActive: { color: th.colors.onAccent },

  // ── Progress cards (SESIONES · CARGA · VOLUMEN) ───────────────────────────────
  // Figma 122:893: altura fija 108, cards centradas (hug) en la fila. El gap
  // bajó de 10 a 8 y el radio de `lg` a `md` (U13 §12), como las de sesión.
  statsGrid: { flexDirection: 'row', gap: spacing.sm2, width: '100%', height: 108, alignItems: 'center' },
  statTile: {
    flex:              1,
    backgroundColor:   th.colors.surface,
    paddingHorizontal: spacing.xl,
    paddingVertical:   spacing.lg,
    borderRadius:      th.radius.md,
    alignItems:        'center',
    justifyContent:    'center',
    overflow:          'hidden',
    gap:               spacing.lg,
  },
  statValueBlock: { alignItems: 'center', gap: spacing.xs },
  statValue: { ...textStyles.title, textAlign: 'center' },
  statLabel: {
    ...textStyles.caps,
    textTransform: 'uppercase',
    color:         th.colors.text,
    textAlign:     'center',
  },
  statSub: { ...textStyles.label, textAlign: 'center' },

  // ── Buscador + caja de filtros: los de Clientes y del selector ────────────
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, width: '100%' },
  searchInputWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: th.colors.surface2, borderRadius: th.radius.sm,
    paddingHorizontal: spacing.lg, height: 42,
  },
  searchInput:    { flex: 1, padding: 0, ...textStyles.body, color: th.colors.text },
  searchClearBtn: { paddingLeft: spacing.xs2 },
  iconBox: {
    width: 42, height: 42, borderRadius: th.radius.sm,
    backgroundColor: th.colors.surface2,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  iconBoxActive: { backgroundColor: withOpacity(th.colors.accent, 0.10) },
  filterBadge: {
    position: 'absolute', top: 3, right: 3,
    minWidth: 14, height: 14, borderRadius: 7, paddingHorizontal: 3,
    backgroundColor: th.colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  filterBadgeText: { ...textStyles.micro, fontFamily: 'Inter_900Black', color: th.colors.onAccent },

  // ── Hoja de filtros ────────────────────────────────────────────────────────
  sheetCaps: { ...textStyles.caps, color: th.colors.mutedLight, paddingBottom: spacing.sm },
  sessionPills: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingBottom: spacing.lg },
  sessionPill: {
    minWidth: 36, height: 36, paddingHorizontal: spacing.md, borderRadius: th.radius.full,
    backgroundColor: th.colors.surface2, alignItems: 'center', justifyContent: 'center',
  },
  sessionPillOn:     { backgroundColor: th.colors.accent },
  sessionPillText:   { ...textStyles.button, color: th.colors.mutedLight },
  sessionPillTextOn: { color: th.colors.onAccent },
  exRowSel: { backgroundColor: th.tint.accent10 },
  cta: {
    height: 44, borderRadius: th.radius.md, backgroundColor: th.colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  ctaText: { ...textStyles.button, color: th.colors.onAccent },

  // ── Exercise list ──────────────────────────────────────────────────────────
  exerciseList: { gap: spacing.xs, width: '100%' },
  exRow: {
    backgroundColor:   th.colors.surface,
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical:   spacing.md,
    overflow:          'hidden',
  },
  exLeft: { flex: 1, gap: spacing.xs },
  exName: { ...textStyles.bodyStrong, color: th.colors.text },
  exSub:  { ...textStyles.label, color: th.colors.mutedLight },
  exChevron: { ...textStyles.heading, fontFamily: 'Inter_900Black', color: th.colors.mutedLight, marginLeft: spacing.sm },

  // ── Empty state ────────────────────────────────────────────────────────────
  emptyState: { paddingVertical: spacing.xxl },
});
