/**
 * ProgramDetailScreen — Mobile port of ProgramPrintView.
 * Shows the full structure of a program: days + exercises.
 * Reached via navigate('programPrint') or navigate('programSummary').
 */
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../store/useStore';
import { spacing, typography, borders } from '../theme';
import { useTheme, useThemedStyles } from '../useTheme';
import { resolveColor } from '../themes';

// ── Exercise row ───────────────────────────────────────────────────────────────

function ExerciseRow({ exConfig, def, isLast }) {
  const { t, i18n } = useTranslation();
  const styles = useThemedStyles(makeStyles);
  const name = def
    ? (i18n.language === 'en' ? (def.nameEn ?? def.name) : def.name)
    : exConfig.exerciseId;

  const repsLabel = (() => {
    if (exConfig.minReps && exConfig.maxReps) return `${exConfig.minReps}–${exConfig.maxReps} reps`;
    if (exConfig.minReps) return `${exConfig.minReps}+ reps`;
    if (exConfig.minTime && exConfig.maxTime) return `${exConfig.minTime}–${exConfig.maxTime}s`;
    return null;
  })();

  return (
    <View style={[styles.exRow, isLast && styles.exRowLast]}>
      <Text style={styles.exNum}>{exConfig.order ?? '·'}</Text>
      <View style={styles.exInfo}>
        <Text style={styles.exName} numberOfLines={1}>{name}</Text>
        <Text style={styles.exMeta}>
          {exConfig.sets} series
          {repsLabel ? ` · ${repsLabel}` : ''}
          {exConfig.restSec ? ` · ${exConfig.restSec}s descanso` : ''}
          {exConfig.isKey ? ` · ${t('common.keyExercise')}` : ''}
        </Text>
      </View>
    </View>
  );
}

// ── Day section ────────────────────────────────────────────────────────────────

function DaySection({ day, template, allExercises }) {
  const th        = useTheme();
  const styles    = useThemedStyles(makeStyles);
  const accent    = resolveColor(th, template?.color ?? 'var(--day1)');
  const exercises = template?.exercises ?? [];

  return (
    <View style={styles.daySection}>
      {/* Header */}
      <View style={[styles.dayHeader, { borderLeftColor: accent }]}>
        <Text style={[styles.dayLetter, { color: accent }]}>{template?.label ?? '?'}</Text>
        <View style={styles.dayHeaderText}>
          <Text style={[styles.dayName, { color: accent }]} numberOfLines={1}>
            {(template?.name ?? '').toUpperCase()}
          </Text>
          {template?.emphasis ? (
            <Text style={styles.dayEmphasis}>{template.emphasis}</Text>
          ) : null}
        </View>
      </View>

      {/* Exercise list */}
      {exercises.length > 0 ? (
        <View style={styles.exList}>
          {exercises.map((ex, i) => (
            <ExerciseRow
              key={ex.exerciseId}
              exConfig={ex}
              def={allExercises[ex.exerciseId]}
              isLast={i === exercises.length - 1}
            />
          ))}
        </View>
      ) : (
        <Text style={styles.noExercises}>Sin ejercicios configurados</Text>
      )}
    </View>
  );
}

// ── Screen ─────────────────────────────────────────────────────────────────────

export default function ProgramDetailScreen() {
  const insets     = useSafeAreaInsets();
  const navigation = useNavigation();
  const styles     = useThemedStyles(makeStyles);

  const ui                = useStore((s) => s.ui);
  const programs          = useStore((s) => s.programs);
  const profile           = useStore((s) => s.profile);
  const exerciseLibrary   = useStore((s) => s.exerciseLibrary);
  const customExercises   = useStore((s) => s.customExercises);
  const getEffectiveTemplate = useStore((s) => s.getEffectiveTemplate);
  // Supports both viewing a specific program (from Templates) or the active program
  const programId = ui._viewingProgramId ?? profile.activeProgramId;
  const program   = programs[programId];
  const allExercises = { ...exerciseLibrary, ...customExercises };

  if (!program) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12} style={styles.backBtn}>
            <Text style={styles.backIcon}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Programa</Text>
        </View>
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Programa no encontrado</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12} style={styles.backBtn}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>{program.name}</Text>
          <Text style={styles.headerSub}>
            {program.days?.length ?? 0} sesiones
            {program.mode === 'template' ? ' · Plantilla' : ''}
          </Text>
        </View>
      </View>

      {/* Days */}
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {(program.days ?? []).map((day) => {
          const tpl = getEffectiveTemplate(day.sessionTemplateId);
          return (
            <DaySection
              key={day.sessionTemplateId}
              day={day}
              template={tpl}
              allExercises={allExercises}
            />
          );
        })}
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
    paddingHorizontal: spacing.xl,
    paddingVertical:   spacing.md,
    borderBottomWidth: borders.thin,
    borderBottomColor: th.colors.border,
    gap:               spacing.sm,
  },
  backBtn: { padding: spacing.xs },
  backIcon: {
    fontSize:   26,
    color:      th.colors.muted,
    lineHeight: 30,
  },
  headerCenter: {
    flex: 1,
    gap:  2,
  },
  headerTitle: {
    fontSize:   typography.md,
    fontWeight: typography.bold,
    color:      th.colors.text,
  },
  headerSub: {
    fontSize: typography.xs,
    color:    th.colors.muted,
  },
  // Content
  content: {
    padding:       spacing.xl,
    paddingBottom: spacing.xxl,
    gap:           spacing.xl,
  },

  // Day section
  daySection: { gap: spacing.sm },
  dayHeader: {
    flexDirection: 'row',
    alignItems:    'flex-end',
    borderLeftWidth: 3,
    paddingLeft:   spacing.sm,
    gap:           spacing.sm,
    marginBottom:  spacing.xs,
  },
  dayLetter: {
    fontSize:   36,
    fontWeight: '900',
    lineHeight: 36,
  },
  dayHeaderText: { flex: 1, gap: 1 },
  dayName: {
    fontSize:      typography.lg,
    fontWeight:    typography.bold,
    letterSpacing: 0.3,
    lineHeight:    typography.lg * 1.1,
  },
  dayEmphasis: {
    fontSize: typography.xs,
    color:    th.colors.muted,
  },

  // Exercise list
  exList: {
    backgroundColor: th.colors.surface,
    borderWidth:     borders.thin,
    borderColor:     th.colors.borderCard,
    borderRadius:    th.radius.md,
    overflow:        'hidden',
  },
  exRow: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.sm,
    borderBottomWidth: borders.thin,
    borderBottomColor: th.colors.border,
    gap:               spacing.sm,
  },
  exRowLast: {
    borderBottomWidth: 0,
  },
  exNum: {
    width:     20,
    fontSize:  typography.sm,
    color:     th.colors.muted,
    textAlign: 'right',
  },
  exInfo: { flex: 1 },
  exName: {
    fontSize:   typography.base,
    fontWeight: typography.medium,
    color:      th.colors.text,
  },
  exMeta: {
    fontSize:  typography.xs,
    color:     th.colors.muted,
    marginTop: 2,
  },

  noExercises: {
    fontSize:    typography.sm,
    color:       th.colors.muted2,
    paddingLeft: spacing.sm,
    fontStyle:   'italic',
  },

  // Empty
  empty: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: typography.base,
    color:    th.colors.muted,
  },
});
