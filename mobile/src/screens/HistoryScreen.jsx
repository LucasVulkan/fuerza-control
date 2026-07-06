/**
 * HistoryScreen — historial de sesiones + calendario visual de entrenamientos.
 *
 * Novedades:
 *  - Calendario de las últimas 5 semanas en la cabecera (cuadrados por día)
 *  - Tarjeta de sesión con formato "Sesión A / nombre" (igual que HomeScreen)
 *  - Pills: verde = completada en rango, naranja = por debajo del rango, gris = sin completar
 *  - buildSetLabel cubre todas las combinaciones: weight×reps, weight×time, reps, time
 */
import { useState, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  ScrollView, Alert, StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../store/useStore';
import AppHeader from '../components/AppHeader';
import { useWeightUnit } from '../hooks/useWeightUnit';
import { spacing, typography, borders, withOpacity } from '../theme';
import { useTheme, useThemedStyles } from '../useTheme';
import { resolveColor } from '../themes';
import { formatDate } from '../../../src/utils/formatters';
import { formatBlockScore } from '../../../src/utils/conditioningBlocks';

// Same badge-per-format mapping as SessionEditorScreen's block rows / recap.
const BLOCK_BADGE_STYLE = {
  amrap:    'badgeBlockAmrap',
  emom:     'badgeBlockEmom',
  for_time: 'badgeBlockForTime',
};

// ── buildSetLabel ──────────────────────────────────────────────────────────────

function buildSetLabel(s, i, fmtWeight) {
  const hasW = s.weight && Number(s.weight) > 0;
  const hasR = s.reps   && Number(s.reps)   > 0;
  const hasT = s.time   && Number(s.time)   > 0;
  const rpe  = s.rpe && Number(s.rpe) > 0 ? ` @${s.rpe}` : '';
  if (hasW && hasR) return `${fmtWeight(s.weight)}×${s.reps}${rpe}`;
  if (hasW && hasT) return `${fmtWeight(s.weight)}×${s.time}s${rpe}`;
  if (hasR)         return `${s.reps} reps${rpe}`;
  if (hasT)         return `${s.time}s${rpe}`;
  if (hasW)         return `${fmtWeight(s.weight)}${rpe}`;
  return `S${i + 1}`;
}

// ── getPillVariant ─────────────────────────────────────────────────────────────
// 'done' = verde, 'partial' = naranja, 'empty' = gris

function getPillVariant(s, exConfig) {
  const hasData = (s.weight && Number(s.weight) > 0)
               || (s.reps   && Number(s.reps)   > 0)
               || (s.time   && Number(s.time)   > 0);
  if (!hasData)       return 'empty';
  if (s.done === false) return 'partial'; // explicitly not done (new entries only)

  // Compare to target range when available
  if (exConfig) {
    const inputType   = exConfig.inputType ?? 'weight_reps';
    const isTimeBased = inputType === 'time' || inputType === 'weight_time';
    if (isTimeBased && exConfig.minTime && Number(s.time) < Number(exConfig.minTime)) return 'partial';
    if (!isTimeBased && exConfig.minReps && Number(s.reps) < Number(exConfig.minReps)) return 'partial';
  }

  return 'done';
}

// ── Calendar constants ─────────────────────────────────────────────────────────
const CELL_H  = 30;
const CELL_GAP = 3;

// Pure helper — computes grid weeks + trained-day map for any year/month
function getMonthData(y, m, workoutLog, sessionTemplates, userPrograms) {
  const daysInM = new Date(y, m + 1, 0).getDate();
  let   startDow = new Date(y, m, 1).getDay();
  startDow = startDow === 0 ? 6 : startDow - 1; // Mon-aligned
  const cells = [
    ...Array(startDow).fill(null),
    ...Array.from({ length: daysInM }, (_, i) => i + 1),
  ];
  while (cells.length < 42) cells.push(null);
  const weeks = Array.from({ length: 6 }, (_, i) => cells.slice(i * 7, i * 7 + 7));

  const trainedDays = {};
  workoutLog.forEach((entry) => {
    const d = new Date(entry.timestamp);
    if (d.getFullYear() !== y || d.getMonth() !== m) return;
    const day  = d.getDate();
    const tmpl = userPrograms[entry.sessionTemplateId] ?? sessionTemplates[entry.sessionTemplateId];
    const lbl  = entry.sessionTemplateId === '__free__' ? '★' : (tmpl?.label ?? '·');
    if (!trainedDays[day]) trainedDays[day] = [];
    if (!trainedDays[day].includes(lbl)) trainedDays[day].push(lbl);
  });
  return { weeks, trainedDays };
}


// ── WorkoutCalendar ────────────────────────────────────────────────────────────

function WorkoutCalendar({ onDayPress, selectedDate }) {
  const { t }            = useTranslation();
  const cal              = useThemedStyles(makeCal);
  const workoutLog       = useStore((s) => s.workoutLog);
  const sessionTemplates = useStore((s) => s.sessionTemplates);
  const userPrograms     = useStore((s) => s.userPrograms);

  const today = new Date();
  const [year,  setYear]  = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth()); // 0-indexed

  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth();

  function prevMonth() {
    if (month === 0) { setYear((y) => y - 1); setMonth(11); }
    else               setMonth((m) => m - 1);
  }
  function nextMonth() {
    if (isCurrentMonth) return;
    if (month === 11) { setYear((y) => y + 1); setMonth(0); }
    else               setMonth((m) => m + 1);
  }

  const { weeks, trainedDays } = useMemo(
    () => getMonthData(year, month, workoutLog, sessionTemplates, userPrograms),
    [year, month, workoutLog, sessionTemplates, userPrograms],
  );

  return (
    <View style={cal.wrap}>
      {/* Navigation */}
      <View style={cal.nav}>
        <TouchableOpacity onPress={prevMonth} hitSlop={12} style={cal.navBtn}>
          <Text style={cal.navIcon}>{'‹'}</Text>
        </TouchableOpacity>
        <Text style={cal.monthLabel}>{`${(t('months', { returnObjects: true }))[month]} ${year}`}</Text>
        <TouchableOpacity
          onPress={nextMonth}
          hitSlop={12}
          style={[cal.navBtn, isCurrentMonth && cal.navBtnOff]}
          disabled={isCurrentMonth}
        >
          <Text style={[cal.navIcon, isCurrentMonth && cal.navIconOff]}>{'›'}</Text>
        </TouchableOpacity>
      </View>

      {/* Day-of-week headers */}
      <View style={cal.header}>
        {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d) => (
          <Text key={d} style={cal.hDay}>{d}</Text>
        ))}
      </View>

      {/* Grid — trim trailing empty rows */}
      <View style={cal.grid}>
        {weeks.filter((week) => week.some((d) => d !== null)).map((week, wi) => (
          <View key={wi} style={cal.week}>
            {week.map((day, di) => {
              if (day === null) return <View key={di} style={cal.cellBlank} />;
              const labels  = trainedDays[day] ?? [];
              const trained = labels.length > 0;
              const isToday = isCurrentMonth && day === today.getDate();
              const isSel   = trained
                && selectedDate?.year  === year
                && selectedDate?.month === month
                && selectedDate?.day   === day;
              return (
                <TouchableOpacity
                  key={di}
                  style={[
                    cal.cell,
                    trained && cal.cellTrained,
                    isToday && !trained && cal.cellToday,
                    isSel   && cal.cellSel,
                  ]}
                  onPress={() => trained && onDayPress?.({ year, month, day })}
                  activeOpacity={trained ? 0.72 : 1}
                >
                  <Text
                    style={[
                      cal.dayNum,
                      trained             && cal.dayNumTrained,
                      isToday && !trained && cal.dayNumToday,
                    ]}
                  >
                    {day}
                  </Text>
                  {trained && (
                    <Text style={cal.sesLetter} numberOfLines={1}>{labels[0]}</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

const makeCal = (th) => StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing.xl,
    paddingTop:        spacing.md,
    paddingBottom:     spacing.sm,
    borderBottomWidth: borders.thin,
    borderBottomColor: th.colors.border,
  },

  // Navigation row
  nav: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    marginBottom:   spacing.sm,
  },
  navBtn:     { padding: 4 },
  navBtnOff:  { opacity: 0.25 },
  navIcon:    { fontSize: 24, color: th.colors.muted, lineHeight: 28 },
  navIconOff: { color: th.colors.muted2 },
  monthLabel: {
    fontSize:      typography.sm,
    fontWeight:    typography.bold,
    color:         th.colors.text,
    letterSpacing: 0.5,
  },

  // Day-of-week header
  header: {
    flexDirection: 'row',
    gap:           CELL_GAP,
    marginBottom:  4,
  },
  hDay: {
    flex:          1,
    textAlign:     'center',
    fontSize:      9,
    color:         th.colors.muted2,
    letterSpacing: 0.5,
  },

  // Grid
  grid: { gap: CELL_GAP },
  week: { flexDirection: 'row', gap: CELL_GAP },

  cellBlank: { flex: 1, height: CELL_H },

  cell: {
    flex:           1,
    height:         CELL_H,
    borderRadius:   th.radius.xs + 1,
    alignItems:     'center',
    justifyContent: 'center',
  },
  cellTrained: { backgroundColor: th.colors.accent },
  cellToday:   { borderWidth: 1, borderColor: withOpacity(th.colors.accent, 0.55) },
  // Selected trained day — green so it's clearly distinct from unselected yellow
  cellSel:     { backgroundColor: th.colors.green },

  dayNum:        { fontSize: 10, color: th.colors.muted2 },
  dayNumTrained: { fontSize: 11, fontWeight: typography.bold, color: th.colors.onAccent },
  dayNumToday:   { color: th.colors.accent, fontWeight: typography.medium },

  // Tiny session-label overlay — bottom-right corner of trained cell
  sesLetter: {
    position:   'absolute',
    bottom:     1,
    right:      2,
    fontSize:   7,
    fontWeight: typography.bold,
    color:      th.colors.onAccent,
    lineHeight: 8,
  },
});

// ── SessionCard ────────────────────────────────────────────────────────────────

function SessionCard({ session, onDelete }) {
  const { t, i18n } = useTranslation();
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { fmt: fmtWeight } = useWeightUnit();
  const [open, setOpen] = useState(false);

  const getEffectiveTemplate = useStore((s) => s.getEffectiveTemplate);
  const exerciseLibrary      = useStore((s) => s.exerciseLibrary);
  const customExercises      = useStore((s) => s.customExercises);
  const programs             = useStore((s) => s.programs);
  const allExercises = { ...exerciseLibrary, ...customExercises };

  const isFree   = session.sessionTemplateId === '__free__';
  const template = isFree ? null : getEffectiveTemplate(session.sessionTemplateId);
  const label    = template?.label ?? '?';
  const name     = session.sessionName ?? (isFree ? t('freeSession.historyLabel') : (template?.name ?? session.sessionTemplateId));
  const accent   = isFree ? th.colors.muted : resolveColor(th,template?.color ?? 'var(--accent)');

  // exConfig lookup for pill range comparisons
  const exConfigs = useMemo(() => {
    const map = {};
    (template?.exercises ?? []).forEach((ec) => { map[ec.exerciseId] = ec; });
    return map;
  }, [template]);

  // Stage name (if applicable — never for free sessions)
  const stageName = useMemo(() => {
    if (isFree || !template?.programId) return null;
    const program = programs[template.programId];
    if (!program?.stages?.length) return null;
    for (const stage of program.stages) {
      if (stage.days.some((d) => d.sessionTemplateId === session.sessionTemplateId)) {
        return stage.name;
      }
    }
    return null;
  }, [template, programs, session.sessionTemplateId]);

  const durationMin = session.duration ? Math.round(session.duration / 60000) : null;
  const hasNotes    = !!session.notes?.trim()
                   || (session.exercises ?? []).some((e) => !!e.note);

  function handleDelete() {
    Alert.alert(
      t('history.deleteTitle'),
      t('history.deleteConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.delete'), style: 'destructive', onPress: () => onDelete(session.id) },
      ],
    );
  }

  return (
    <View style={styles.card}>
      {/* Header — tap to expand */}
      <TouchableOpacity
        style={[styles.cardHeader, { borderLeftColor: accent }]}
        onPress={() => setOpen((o) => !o)}
        activeOpacity={0.75}
      >
        <View style={styles.cardHeaderLeft}>
          {/* "Sesión A" tag — or "Sesión libre" badge */}
          <Text style={[styles.cardSesTag, { color: isFree ? th.colors.accent : accent }]} numberOfLines={1}>
            {isFree ? t('freeSession.badge').toUpperCase() : t('workout.sessionLabel', { label })}
          </Text>
          {/* Session name in white */}
          <Text style={styles.cardSesName} numberOfLines={1}>{name}</Text>
          {/* Meta: date · stage · duration · nota */}
          <View style={styles.cardMeta}>
            <Text style={styles.cardDate}>{formatDate(session.timestamp)}</Text>
            {stageName   && <Text style={styles.cardMetaSep}>·</Text>}
            {stageName   && <Text style={styles.cardDate}>{stageName}</Text>}
            {durationMin ? <Text style={styles.cardMetaSep}>·</Text> : null}
            {durationMin ? <Text style={styles.cardDate}>{`${durationMin} min`}</Text> : null}
            {hasNotes && (
              <View style={styles.noteTag}>
                <Text style={styles.noteTagText}>NOTA</Text>
              </View>
            )}
            {session.adapted && (
              <View style={styles.adaptedTag}>
                <Text style={styles.adaptedTagText}>{t('home.adapted')}</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.cardHeaderRight}>
          <TouchableOpacity onPress={handleDelete} hitSlop={8} style={styles.deleteBtn}>
            <Text style={styles.deleteBtnText}>✕</Text>
          </TouchableOpacity>
          <Text style={[styles.chevron, open && styles.chevronOpen]}>▾</Text>
        </View>
      </TouchableOpacity>

      {/* Expanded detail */}
      {open && (
        <View style={styles.detail}>
          {!!session.notes?.trim() && (
            <View style={styles.noteSection}>
              <Text style={styles.noteSectionLabel}>NOTA</Text>
              <Text style={styles.noteSectionText}>{session.notes}</Text>
            </View>
          )}

          {(session.exercises ?? []).map((ex) => {
            const def    = allExercises[ex.exerciseId];
            const exName = def
              ? (i18n.language === 'en' ? (def.nameEn ?? def.name) : def.name)
              : ex.exerciseId;

            const hasSets = (ex.sets ?? []).some(
              (s) => s.done || s.weight || s.reps || s.time,
            );
            if (!hasSets) return null;

            const exCfg = exConfigs[ex.exerciseId];

            return (
              <View key={ex.exerciseId} style={styles.exSection}>
                <Text style={styles.exName}>{exName}</Text>
                <View style={styles.setPills}>
                  {/* Logged sets */}
                  {(ex.sets ?? []).map((s, i) => {
                    const variant = getPillVariant(s, exCfg);
                    return (
                      <View
                        key={`set-${i}`}
                        style={[
                          styles.setPill,
                          variant === 'done'    && styles.setPillDone,
                          variant === 'partial' && styles.setPillPartial,
                        ]}
                      >
                        <Text
                          style={[
                            styles.setPillText,
                            variant === 'done'    && styles.setPillTextDone,
                            variant === 'partial' && styles.setPillTextPartial,
                          ]}
                        >
                          {buildSetLabel(s, i, fmtWeight)}
                        </Text>
                      </View>
                    );
                  })}
                  {/* Planned but not started */}
                  {Array.from({
                    length: Math.max(0, (ex.totalSets ?? ex.sets?.length ?? 0) - (ex.sets?.length ?? 0)),
                  }).map((_, i) => (
                    <View key={`empty-${i}`} style={styles.setPill}>
                      <Text style={styles.setPillText}>—</Text>
                    </View>
                  ))}
                </View>
                {!!ex.note && (
                  <Text style={styles.exNote}>📝 {ex.note}</Text>
                )}
              </View>
            );
          })}

          {/* Conditioning blocks — v1: just the score, one line per block */}
          {(session.blocks ?? []).map((block) => (
            <View key={block.blockId} style={styles.blockLine}>
              <View style={[styles.badge, styles[BLOCK_BADGE_STYLE[block.format]]]}>
                <Text style={[styles.badgeText, styles[`${BLOCK_BADGE_STYLE[block.format]}Text`]]}>
                  {t(`blocks.formats.${block.format}`).toUpperCase()}
                </Text>
              </View>
              <Text style={styles.blockLineName} numberOfLines={1}>
                {block.name ?? t(`blocks.formats.${block.format}`)}
              </Text>
              <Text style={styles.blockLineScore}>
                {formatBlockScore(block.result, block.format)}
                {block.result.capped ? ` ${t('blocks.cappedTag')}` : ''}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ── Screen ─────────────────────────────────────────────────────────────────────

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const { t }  = useTranslation();
  const styles = useThemedStyles(makeStyles);

  const workoutLog     = useStore((s) => s.workoutLog);
  const deleteLogEntry = useStore((s) => s.deleteLogEntry);
  const programs       = useStore((s) => s.programs);
  const profile        = useStore((s) => s.profile);
  const activeProgram  = programs[profile.activeProgramId];

  const [scope,            setScope]            = useState('all');
  const [selectedStageIds, setSelectedStageIds] = useState(new Set());
  const [selectedDate,     setSelectedDate]     = useState(null); // { year, month, day }

  const hasStages = (activeProgram?.stages?.length ?? 0) > 0;

  function handleScope(newScope) {
    setScope(newScope);
    setSelectedStageIds(new Set());
    setSelectedDate(null);
  }

  function handleDayPress({ year, month, day }) {
    setSelectedDate((prev) =>
      prev?.year === year && prev?.month === month && prev?.day === day
        ? null          // tap again to deselect
        : { year, month, day },
    );
  }

  function toggleStage(stageId) {
    setSelectedStageIds((prev) => {
      const next = new Set(prev);
      if (next.has(stageId)) next.delete(stageId); else next.add(stageId);
      return next;
    });
  }

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

  const effectiveTemplateIds = useMemo(() => {
    if (scope !== 'program' || !hasStages || selectedStageIds.size === 0) return programTemplateIds;
    const ids = new Set();
    activeProgram.stages.forEach((st, idx) => {
      if (selectedStageIds.has(st.id ?? idx)) st.days.forEach((d) => ids.add(d.sessionTemplateId));
    });
    return ids;
  }, [activeProgram, scope, selectedStageIds, programTemplateIds, hasStages]);

  const filtered = useMemo(() => {
    let list = [...workoutLog];
    if (scope === 'program' && effectiveTemplateIds.size > 0) {
      list = list.filter((e) => effectiveTemplateIds.has(e.sessionTemplateId));
    }
    if (selectedDate) {
      list = list.filter((e) => {
        const d = new Date(e.timestamp);
        return (
          d.getFullYear() === selectedDate.year &&
          d.getMonth()    === selectedDate.month &&
          d.getDate()     === selectedDate.day
        );
      });
    }
    return list.sort((a, b) => b.timestamp - a.timestamp);
  }, [workoutLog, scope, effectiveTemplateIds, selectedDate]);

  // Rendered inline so it closes over scope/hasStages/selectedStageIds state
  const listHeader = (
    <>
      <WorkoutCalendar onDayPress={handleDayPress} selectedDate={selectedDate} />

      {/* Date filter chip — shown when a calendar day is selected */}
      {selectedDate && (
        <View style={styles.dateFilterRow}>
          <Text style={styles.dateFilterLabel}>
            {`${selectedDate.day} de ${(t('months', { returnObjects: true }))[selectedDate.month]}`}
          </Text>
          <TouchableOpacity
            onPress={() => setSelectedDate(null)}
            hitSlop={8}
            style={styles.dateFilterClose}
          >
            <Text style={styles.dateFilterCloseText}>{'✕'}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Scope selector */}
      <View style={styles.scopeRow}>
        {[
          { id: 'program', label: t('history.currentProgram') },
          { id: 'all',     label: t('history.all') },
        ].map(({ id, label }) => {
          const active = scope === id;
          return (
            <TouchableOpacity
              key={id}
              style={[styles.scopeBtn, active && styles.scopeBtnActive]}
              onPress={() => handleScope(id)}
              activeOpacity={0.75}
            >
              <Text style={[styles.scopeBtnText, active && styles.scopeBtnTextActive]}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Stage pills */}
      {scope === 'program' && hasStages && (
        <View style={styles.stagePillsRow}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.stagePillsContent}
          >
            {activeProgram.stages.map((stage, idx) => {
              const stageId  = stage.id ?? idx;
              const isActive = selectedStageIds.size === 0 || selectedStageIds.has(stageId);
              return (
                <TouchableOpacity
                  key={stageId}
                  style={[styles.stagePill, isActive && styles.stagePillActive]}
                  onPress={() => toggleStage(stageId)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.stagePillText, isActive && styles.stagePillTextActive]}>
                    {stage.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
            {selectedStageIds.size > 0 && (
              <TouchableOpacity
                style={styles.stagePillReset}
                onPress={() => setSelectedStageIds(new Set())}
                activeOpacity={0.7}
              >
                <Text style={styles.stagePillResetText}>{t('history.allStages')}</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>
      )}
    </>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <AppHeader />
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={() => listHeader}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: spacing.xxl + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <SessionCard session={item} onDelete={deleteLogEntry} />
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📭</Text>
            <Text style={styles.emptyText}>
              {selectedDate
                ? t('history.noSessionsDate', {
                    day: selectedDate.day,
                    month: (t('months', { returnObjects: true }))[selectedDate.month],
                  })
                : scope === 'program'
                  ? t('history.noSessionsProgram')
                  : t('history.noSessionsEmpty')}
            </Text>
          </View>
        }
      />
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const makeStyles = (th) => StyleSheet.create({
  container: {
    flex:            1,
    backgroundColor: th.colors.bg,
  },

  // Scope selector
  scopeRow: {
    flexDirection:     'row',
    gap:               spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingTop:        spacing.md,
    paddingBottom:     spacing.sm,
  },
  scopeBtn: {
    flex:            1,
    paddingVertical: spacing.sm,
    borderRadius:    th.radius.sm,
    borderWidth:     borders.thin,
    borderColor:     th.colors.border,
    backgroundColor: th.colors.surface,
    alignItems:      'center',
  },
  scopeBtnActive: {
    backgroundColor: withOpacity(th.colors.accent, 0.08),
    borderColor:     withOpacity(th.colors.accent, 0.3),
  },
  scopeBtnText: {
    fontSize:   typography.sm,
    color:      th.colors.muted,
    fontWeight: typography.medium,
  },
  scopeBtnTextActive: {
    color: th.colors.accent,
  },

  // Stage pills
  stagePillsRow: {
    borderBottomWidth: borders.thin,
    borderBottomColor: th.colors.border,
  },
  stagePillsContent: {
    paddingHorizontal: spacing.xl,
    paddingVertical:   spacing.sm,
    gap:               spacing.xs,
    flexDirection:     'row',
    alignItems:        'center',
  },
  stagePill: {
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.xs,
    borderRadius:      th.radius.full,
    borderWidth:       borders.thin,
    borderColor:       th.colors.border,
    backgroundColor:   th.colors.surface2,
  },
  stagePillActive: {
    backgroundColor: withOpacity(th.colors.accent, 0.08),
    borderColor:     withOpacity(th.colors.accent, 0.3),
  },
  stagePillText: {
    fontSize:   typography.xs,
    color:      th.colors.muted,
    fontWeight: typography.medium,
  },
  stagePillTextActive: { color: th.colors.accent },
  stagePillReset: {
    paddingHorizontal: spacing.sm,
    paddingVertical:   spacing.xs,
  },
  stagePillResetText: { fontSize: typography.xs, color: th.colors.muted },

  // List
  listContent: {
    gap: spacing.sm,
  },

  // Empty state
  emptyState: {
    alignItems:     'center',
    justifyContent: 'center',
    padding:        spacing.xxl,
    gap:            spacing.md,
  },
  emptyIcon: { fontSize: 32 },
  emptyText: {
    fontSize:   typography.base,
    color:      th.colors.muted,
    textAlign:  'center',
    lineHeight: typography.base * 1.7,
  },

  // ── SessionCard ──────────────────────────────────────────────────────────────
  card: {
    backgroundColor: th.colors.surface,
    borderWidth:     borders.thin,
    borderColor:     th.colors.borderCard,
    borderRadius:    th.radius.md,
    overflow:        'hidden',
    marginHorizontal: spacing.xl,
  },
  cardHeader: {
    flexDirection:   'row',
    alignItems:      'center',
    padding:         spacing.md,
    borderLeftWidth: 3,
    gap:             spacing.sm,
  },
  cardHeaderLeft: {
    flex: 1,
    gap:  2,
  },

  // "Sesión A" tag line
  cardSesTag: {
    fontSize:      10,
    fontWeight:    typography.bold,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom:  4,
  },
  // Session name
  cardSesName: {
    fontSize:   typography.base,
    fontWeight: typography.heavy,
    color:      th.colors.text,
    lineHeight: typography.base * 1.2,
  },

  cardMeta: {
    flexDirection: 'row',
    alignItems:    'center',
    flexWrap:      'wrap',
    gap:           spacing.xs,
    marginTop:     3,
  },
  cardDate: {
    fontSize: typography.xs,
    color:    th.colors.muted,
  },
  cardMetaSep: {
    fontSize: typography.xs,
    color:    th.colors.muted2,
  },
  noteTag: {
    backgroundColor: withOpacity(th.colors.accent, 0.08),
    borderWidth:     borders.thin,
    borderColor:     withOpacity(th.colors.accent, 0.25),
    borderRadius:    3,
    paddingHorizontal: 5,
    paddingVertical:   1,
  },
  noteTagText: {
    fontSize:      8,
    fontWeight:    typography.bold,
    color:         th.colors.accent,
    letterSpacing: 0.5,
  },
  adaptedTag: {
    backgroundColor:   withOpacity(th.colors.blue, 0.1),
    borderWidth:       borders.thin,
    borderColor:       withOpacity(th.colors.blue, 0.3),
    borderRadius:      3,
    paddingHorizontal: 5,
    paddingVertical:   1,
  },
  adaptedTagText: {
    fontSize:      8,
    fontWeight:    typography.bold,
    color:         th.colors.blue,
    letterSpacing: 0.5,
  },
  cardHeaderRight: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.sm,
    flexShrink:    0,
  },
  deleteBtn:     { padding: spacing.xs },
  deleteBtnText: { fontSize: typography.base, color: th.colors.muted2 },
  chevron: {
    fontSize: typography.base,
    color:    th.colors.muted,
  },
  chevronOpen: { transform: [{ rotate: '180deg' }] },

  // Detail
  detail: {
    borderTopWidth: borders.thin,
    borderTopColor: th.colors.border,
  },
  noteSection: {
    padding:         spacing.md,
    backgroundColor: withOpacity(th.colors.accent, 0.04),
    borderLeftWidth: 2,
    borderLeftColor: withOpacity(th.colors.accent, 0.3),
    gap:             spacing.xs,
  },
  noteSectionLabel: {
    fontSize:      typography.xs,
    fontWeight:    typography.bold,
    color:         th.colors.accent,
    letterSpacing: 1.5,
    opacity:       0.8,
  },
  noteSectionText: {
    fontSize:   typography.sm,
    color:      th.colors.text,
    lineHeight: typography.sm * 1.6,
  },
  exSection: {
    padding:        spacing.md,
    borderTopWidth: borders.thin,
    borderTopColor: th.colors.border,
    gap:            spacing.xs,
  },
  exName: {
    fontSize:   typography.sm,
    fontWeight: typography.medium,
    color:      th.colors.text,
  },
  exNote: {
    fontSize:   typography.xs,
    color:      th.colors.accent,
    fontStyle:  'italic',
    lineHeight: 16,
  },

  // ── Conditioning blocks (v1: one compact line per block) ────────────────────
  blockLine: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            spacing.xs,
    padding:        spacing.md,
    borderTopWidth: borders.thin,
    borderTopColor: th.colors.border,
  },
  badge: {
    paddingHorizontal: spacing.xs + 2,
    paddingVertical:   1,
    borderRadius:      th.radius.xs,
  },
  badgeText: { fontSize: 9, fontWeight: typography.bold, letterSpacing: 0.5 },
  badgeBlockAmrap:       { backgroundColor: withOpacity(th.colors.accent, 0.12) },
  badgeBlockAmrapText:   { color: th.colors.accent },
  badgeBlockEmom:        { backgroundColor: withOpacity(th.colors.blue, 0.12) },
  badgeBlockEmomText:    { color: th.colors.blue },
  badgeBlockForTime:     { backgroundColor: withOpacity(th.colors.orange, 0.12) },
  badgeBlockForTimeText: { color: th.colors.orange },
  blockLineName: {
    flex:       1,
    fontSize:   typography.sm,
    fontWeight: typography.medium,
    color:      th.colors.text,
  },
  blockLineScore: {
    fontSize:      typography.sm,
    fontWeight:    typography.bold,
    color:         th.colors.text,
    fontVariant:   ['tabular-nums'],
  },

  setPills: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           spacing.xs,
  },

  // Pills — base (gray = not done)
  setPill: {
    backgroundColor:   th.colors.surface2,
    borderWidth:       borders.thin,
    borderColor:       th.colors.border,
    borderRadius:      th.radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical:   2,
  },
  // Green — done and within range
  setPillDone: {
    backgroundColor: withOpacity(th.colors.green, 0.08),
    borderColor:     withOpacity(th.colors.green, 0.3),
  },
  // Orange — done but below range
  setPillPartial: {
    backgroundColor: withOpacity(th.colors.orange, 0.10),
    borderColor:     withOpacity(th.colors.orange, 0.35),
  },
  setPillText: {
    fontSize: typography.xs,
    color:    th.colors.muted,
  },
  setPillTextDone: {
    color: th.colors.green,
  },
  setPillTextPartial: {
    color: th.colors.orange,
  },

  // ── Date filter chip ─────────────────────────────────────────────────────────
  dateFilterRow: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: spacing.xl,
    paddingVertical:   spacing.sm,
    gap:               spacing.xs,
    borderBottomWidth: borders.thin,
    borderBottomColor: th.colors.border,
    backgroundColor:   withOpacity(th.colors.accent, 0.06),
  },
  dateFilterLabel: {
    flex:       1,
    fontSize:   typography.sm,
    fontWeight: typography.medium,
    color:      th.colors.accent,
  },
  dateFilterClose: {
    padding:         4,
    borderRadius:    th.radius.sm,
    backgroundColor: withOpacity(th.colors.accent, 0.12),
  },
  dateFilterCloseText: {
    fontSize:   typography.xs,
    color:      th.colors.accent,
    fontWeight: typography.bold,
  },
});
