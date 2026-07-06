/**
 * SessionRecapScreen — post-session summary, shown right after saving.
 *
 * Read-only: duration · volume · sets, PRs (only when they exist), and the
 * per-exercise comparison against the previous run of the same session.
 * All numbers come from the just-saved log entry + pure utils; nothing new
 * is stored.
 */
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Svg, { Path } from 'react-native-svg';
import { useStore } from '../../store/useStore';
import { recapStats, detectPRs, compareToLast, doneSets, doneDrops } from '../../../src/utils/sessionRecap';
import { useWeightUnit } from '../hooks/useWeightUnit';
import { spacing, typography, borders, withOpacity } from '../theme';
import { useTheme, useThemedStyles } from '../useTheme';

function TrophyIcon({ size = 17, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M8 21h8M12 17v4M7 4h10v6a5 5 0 0 1-10 0V4zM7 6H4a1 1 0 0 0-1 1v1a3 3 0 0 0 3 3M17 6h3a1 1 0 0 1 1 1v1a3 3 0 0 1-3 3" />
    </Svg>
  );
}

function fmtDuration(ms) {
  const s  = Math.max(0, Math.floor((ms ?? 0) / 1000));
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return hh > 0
    ? `${hh}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
    : `${mm}:${String(ss).padStart(2, '0')}`;
}

export default function SessionRecapScreen({ navigation, route }) {
  const { entryId } = route.params ?? {};
  const { t, i18n } = useTranslation();
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  // fmt() appends the unit ("82.5kg"); toDisplay() gives the bare number.
  const { fmt, toDisplay, label: weightLabel } = useWeightUnit();
  const round1 = (v) => Math.round(v * 10) / 10;

  const workoutLog       = useStore((s) => s.workoutLog);
  const programs         = useStore((s) => s.programs);
  const sessionTemplates = useStore((s) => s.sessionTemplates);
  const exerciseLibrary  = useStore((s) => s.exerciseLibrary);
  const customExercises  = useStore((s) => s.customExercises);

  const entry = workoutLog.find((e) => e.id === entryId);
  if (!entry) return null;

  const allExercises = { ...exerciseLibrary, ...customExercises };
  const exName = (id) => {
    const def = allExercises[id];
    if (!def) return id;
    return i18n.language === 'en' ? (def.nameEn ?? def.name) : def.name;
  };

  const isFree = entry.sessionTemplateId === '__free__';
  const template = !isFree ? sessionTemplates[entry.sessionTemplateId] : null;
  const program  = template?.programId ? programs[template.programId] : null;
  const stageName = program?.stages?.length
    ? program.stages[program.currentStageIndex ?? 0]?.name
    : null;

  const stats  = recapStats(entry);
  const prs    = detectPRs(entry, workoutLog);
  const deltas = compareToLast(entry, workoutLog);

  // Rows: comparison rows when available; otherwise the plain exercise list
  // (free sessions / first run of a template).
  const rows = deltas ?? (entry.exercises ?? []).map((ex) => ({
    exerciseId: ex.exerciseId, sets: doneSets(ex), note: ex.note ?? null, delta: null,
  }));

  // Dropset — the last work set may carry sub-series at decreasing weight;
  // shown chained onto the line with "→" so they read as a continuation.
  function dropsSuffix(sets) {
    const drops = doneDrops(sets[sets.length - 1] ?? {});
    if (!drops.length) return '';
    return ' → ' + drops.map((d) => {
      const w = parseFloat(d.weight);
      if (w > 0 && d.reps) return `${fmt(w)}×${d.reps}`;
      if (d.reps)          return `${d.reps}`;
      return '·';
    }).join(' → ');
  }

  function setsLine(sets) {
    if (!sets.length) return '—';
    const weights = sets.map((s) => parseFloat(s.weight)).filter((w) => w > 0);
    const sameW = weights.length === sets.length && weights.every((w) => w === weights[0]);
    if (sameW) {
      return `${fmt(weights[0])} × ${sets.map((s) => s.reps || (s.time ? `${s.time}s` : '·')).join(' · ')}`
        + dropsSuffix(sets);
    }
    return sets.map((s) => {
      const w = parseFloat(s.weight);
      if (w > 0 && s.reps) return `${fmt(w)}×${s.reps}`;
      if (s.reps)          return `${s.reps}`;
      if (s.time)          return `${s.time}s`;
      return '·';
    }).join(' · ') + dropsSuffix(sets);
  }

  function deltaChip(delta) {
    if (!delta) return null;
    const sign = (n) => (n > 0 ? '+' : '−');
    let txt, tone;
    if (delta.kind === 'equal') { txt = '='; tone = 'eq'; }
    else if (delta.kind === 'weight') {
      txt = `${sign(delta.diff)}${fmt(round1(Math.abs(delta.diff)))}`;
      tone = delta.diff > 0 ? 'up' : 'dn';
    } else if (delta.kind === 'reps') {
      txt = `${sign(delta.diff)}${Math.abs(delta.diff)} ${t('recap.repsShort')}`;
      tone = delta.diff > 0 ? 'up' : 'dn';
    } else if (delta.kind === 'time') {
      txt = `${sign(delta.diff)}${Math.abs(delta.diff)} s`;
      tone = delta.diff > 0 ? 'up' : 'dn';
    } else { // sets
      txt = `${sign(delta.diff)}${Math.abs(delta.diff)} ${t('recap.setsShort')}`;
      tone = delta.diff > 0 ? 'up' : 'dn';
    }
    return (
      <View style={[styles.chip, styles[`chip_${tone}`]]}>
        <Text style={[styles.chipText, styles[`chipText_${tone}`]]}>{txt}</Text>
      </View>
    );
  }

  const sessionNote = entry.notes?.trim();

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.xl }]}
        showsVerticalScrollIndicator={false}
      >

        {/* Header */}
        <View style={styles.headerBlock}>
          <Text style={styles.completedTag}>{t('recap.completed')}</Text>
          <Text style={styles.sessionName}>
            {entry.sessionName ?? template?.name ?? ''}
          </Text>
          {stageName ? <Text style={styles.contextLine}>{stageName}</Text> : null}
        </View>

        {/* Hero stats */}
        <View style={styles.statsRow}>
          <View style={styles.statTile}>
            <Text style={styles.statValue}>{fmtDuration(entry.duration)}</Text>
            <Text style={styles.statLabel}>{t('recap.duration')}</Text>
          </View>
          <View style={styles.statTile}>
            <Text style={styles.statValue}>
              {stats.volume > 0 ? toDisplay(stats.volume) : '—'}
              {stats.volume > 0 ? <Text style={styles.statUnit}> {weightLabel}</Text> : null}
            </Text>
            <Text style={styles.statLabel}>{t('recap.volume')}</Text>
          </View>
          <View style={styles.statTile}>
            <Text style={styles.statValue}>
              {stats.setsDone}<Text style={styles.statUnit}>/{stats.setsPlanned}</Text>
            </Text>
            <Text style={styles.statLabel}>{t('recap.sets')}</Text>
          </View>
        </View>

        {/* PRs — only when there are any */}
        {prs.length > 0 && (
          <View>
            <Text style={[styles.secTitle, { color: th.colors.accent }]}>{t('recap.prs')}</Text>
            <View style={[styles.card, styles.prCard]}>
              {prs.map((pr, i) => (
                <View key={pr.exerciseId} style={[styles.row, i === prs.length - 1 && styles.rowLast]}>
                  <TrophyIcon color={th.colors.accent} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.exName}>{exName(pr.exerciseId)}</Text>
                    <Text style={styles.exSub}>
                      {pr.kind === 'e1rm'
                        ? `e1RM ${fmt(round1(pr.value))} · ${t('recap.previous')} ${fmt(round1(pr.prev))}`
                        : pr.kind === 'weight'
                        ? `${t('recap.topWeight')} ${fmt(round1(pr.value))} · ${t('recap.previous')} ${fmt(round1(pr.prev))}`
                        : `${t('recap.bestSet')} · ${pr.value} reps`}
                    </Text>
                  </View>
                  <View style={[styles.chip, styles.chip_up]}>
                    <Text style={[styles.chipText, styles.chipText_up]}>
                      {pr.kind === 'reps'
                        ? `+${pr.value - pr.prev} ${t('recap.repsShort')}`
                        : `+${fmt(round1(pr.value - pr.prev))}`}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Vs. last session / exercise list */}
        {rows.length > 0 && (
          <View>
            <Text style={styles.secTitle}>
              {deltas ? t('recap.vsLast') : t('recap.exercises')}
            </Text>
            <View style={styles.card}>
              {rows.map((row, i) => (
                <View key={row.exerciseId} style={[styles.row, i === rows.length - 1 && styles.rowLast]}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.exName}>{exName(row.exerciseId)}</Text>
                    <Text style={styles.exSub}>{setsLine(row.sets)}</Text>
                    {row.note ? (
                      <Text style={styles.exNote} numberOfLines={1}>“{row.note}”</Text>
                    ) : null}
                  </View>
                  {deltaChip(row.delta)}
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Session note */}
        {sessionNote ? (
          <View style={styles.noteCard}>
            <Text style={styles.noteText}>“{sessionNote}”</Text>
          </View>
        ) : null}

        {/* Done */}
        <TouchableOpacity
          style={styles.doneBtn}
          onPress={() => navigation.navigate('Main', { screen: 'Home' })}
          activeOpacity={0.85}
        >
          <Text style={styles.doneBtnText}>{t('recap.done')}</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (th) => StyleSheet.create({
  container: { flex: 1, backgroundColor: th.colors.bg },
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    gap: spacing.lg,
  },

  headerBlock: { alignItems: 'center', gap: 3, paddingTop: spacing.sm },
  completedTag: {
    fontSize: typography.xs,
    fontWeight: typography.heavy,
    letterSpacing: 2,
    color: th.colors.accent,
  },
  sessionName: {
    fontSize: typography.xxl,
    fontWeight: typography.heavy,
    color: th.colors.text,
  },
  contextLine: { fontSize: typography.sm, color: th.colors.muted },

  statsRow: { flexDirection: 'row', gap: spacing.sm },
  statTile: {
    flex: 1,
    backgroundColor: th.colors.surface,
    borderWidth: borders.thin,
    borderColor: th.colors.borderCard,
    borderRadius: th.radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    gap: 2,
  },
  statValue: {
    fontSize: typography.xl,
    fontWeight: typography.heavy,
    color: th.colors.text,
    fontVariant: ['tabular-nums'],
  },
  statUnit: { fontSize: typography.sm, fontWeight: typography.medium, color: th.colors.muted },
  statLabel: {
    fontSize: typography.xs - 1,
    fontWeight: typography.bold,
    letterSpacing: 0.8,
    color: th.colors.muted,
    textTransform: 'uppercase',
  },

  secTitle: {
    fontSize: typography.xs,
    fontWeight: typography.bold,
    color: th.colors.muted,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },

  card: {
    backgroundColor: th.colors.surface,
    borderWidth: borders.thin,
    borderColor: th.colors.borderCard,
    borderRadius: th.radius.md,
  },
  prCard: {
    borderColor: withOpacity(th.colors.accent, 0.35),
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: borders.thin,
    borderBottomColor: th.colors.borderCard,
  },
  rowLast: { borderBottomWidth: 0 },
  exName: { fontSize: typography.base, fontWeight: typography.semibold, color: th.colors.text },
  exSub: {
    fontSize: typography.xs,
    color: th.colors.muted,
    marginTop: 1,
    fontVariant: ['tabular-nums'],
  },
  exNote: {
    fontSize: typography.xs,
    color: th.colors.muted2,
    fontStyle: 'italic',
    marginTop: 2,
  },

  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: th.radius.sm,
    flexShrink: 0,
  },
  chipText: { fontSize: typography.xs, fontWeight: typography.bold, fontVariant: ['tabular-nums'] },
  chip_up:     { backgroundColor: withOpacity(th.colors.green, 0.12) },
  chipText_up: { color: th.colors.green },
  chip_eq:     { backgroundColor: th.colors.surface2 },
  chipText_eq: { color: th.colors.muted },
  chip_dn:     { backgroundColor: withOpacity(th.colors.red, 0.12) },
  chipText_dn: { color: th.colors.red },

  noteCard: {
    flexDirection: 'row',
    backgroundColor: th.colors.surface,
    borderWidth: borders.thin,
    borderColor: th.colors.borderCard,
    borderRadius: th.radius.md,
    padding: spacing.md,
  },
  noteText: { flex: 1, fontSize: typography.sm, color: th.colors.mutedLight, fontStyle: 'italic' },

  doneBtn: {
    backgroundColor: th.colors.accent,
    borderRadius: th.radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  doneBtnText: {
    fontSize: typography.md,
    fontWeight: typography.heavy,
    color: th.colors.onAccent,
    letterSpacing: 0.5,
  },
});
