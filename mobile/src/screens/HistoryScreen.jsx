/**
 * HistoryScreen — port fiel de HistoryView + SessionCard web.
 * Filtros: "Este programa" / "Todos" + pills de etapas.
 * SessionCard expandible: muestra ejercicios y series.
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
import { resolveColor, colors, spacing, typography, radius, borders, withOpacity } from '../theme';
import { formatDate } from '../../../src/utils/formatters';

// ── Helpers ────────────────────────────────────────────────────────────────────

function buildSetLabel(set, index, fmtWeight) {
  if (set.time)               return `${set.time}s`;
  if (set.weight && set.reps) return `${fmtWeight(set.weight)}×${set.reps}`;
  if (set.reps)               return `${set.reps} reps`;
  if (set.weight)             return fmtWeight(set.weight);
  return `S${index + 1}`;
}

// ── SessionCard ────────────────────────────────────────────────────────────────

function SessionCard({ session, onDelete }) {
  const { i18n } = useTranslation();
  const { fmt: fmtWeight } = useWeightUnit();
  const [open, setOpen] = useState(false);

  const getEffectiveTemplate = useStore((s) => s.getEffectiveTemplate);
  const exerciseLibrary      = useStore((s) => s.exerciseLibrary);
  const customExercises      = useStore((s) => s.customExercises);
  const programs             = useStore((s) => s.programs);
  const allExercises = { ...exerciseLibrary, ...customExercises };

  const template  = getEffectiveTemplate(session.sessionTemplateId);
  const label     = template?.label ?? '?';
  const name      = template?.name  ?? session.sessionTemplateId;
  const accent    = resolveColor(template?.color ?? 'var(--accent)');

  // Nombre de etapa (si aplica)
  const stageName = useMemo(() => {
    if (!template?.programId) return null;
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
  const hasNotes    = !!session.notes?.trim();

  function handleDelete() {
    Alert.alert(
      'Eliminar sesión',
      '¿Eliminar esta sesión del historial? No se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: () => onDelete(session.id) },
      ],
    );
  }

  return (
    <View style={styles.card}>
      {/* Header — tap para expandir */}
      <TouchableOpacity
        style={[styles.cardHeader, { borderLeftColor: accent }]}
        onPress={() => setOpen((o) => !o)}
        activeOpacity={0.75}
      >
        <View style={styles.cardHeaderLeft}>
          <Text style={[styles.cardDayLabel, { color: accent }]} numberOfLines={1}>
            {`DÍA ${label} · ${name.toUpperCase()}`}
          </Text>
          <View style={styles.cardMeta}>
            <Text style={styles.cardDate}>{formatDate(session.timestamp)}</Text>
            {stageName ? <Text style={styles.cardMetaSep}>·</Text> : null}
            {stageName ? <Text style={styles.cardDate}>{stageName}</Text> : null}
            {durationMin ? <Text style={styles.cardMetaSep}>·</Text> : null}
            {durationMin ? <Text style={styles.cardDate}>{durationMin} min</Text> : null}
            {hasNotes ? (
              <View style={styles.noteTag}>
                <Text style={styles.noteTagText}>NOTA</Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.cardHeaderRight}>
          <TouchableOpacity
            onPress={handleDelete}
            hitSlop={8}
            style={styles.deleteBtn}
          >
            <Text style={styles.deleteBtnText}>✕</Text>
          </TouchableOpacity>
          <Text style={[styles.chevron, open && styles.chevronOpen]}>▾</Text>
        </View>
      </TouchableOpacity>

      {/* Detalle expandido */}
      {open && (
        <View style={styles.detail}>
          {/* Nota */}
          {hasNotes && (
            <View style={styles.noteSection}>
              <Text style={styles.noteSectionLabel}>NOTA</Text>
              <Text style={styles.noteSectionText}>{session.notes}</Text>
            </View>
          )}

          {/* Ejercicios */}
          {(session.exercises ?? []).map((ex) => {
            const def    = allExercises[ex.exerciseId];
            const exName = def
              ? (i18n.language === 'en' ? (def.nameEn ?? def.name) : def.name)
              : ex.exerciseId;

            // Solo mostrar el ejercicio si al menos una serie tiene datos reales
            const hasSets = (ex.sets ?? []).some(
              (s) => s.done || s.weight || s.reps || s.time,
            );
            if (!hasSets) return null;

            return (
              <View key={ex.exerciseId} style={styles.exSection}>
                <Text style={styles.exName}>{exName}</Text>
                <View style={styles.setPills}>
                  {/* Sets registrados → pill verde con valor */}
                  {(ex.sets ?? []).map((s, i) => (
                    <View key={`done-${i}`} style={[styles.setPill, styles.setPillDone]}>
                      <Text style={[styles.setPillText, styles.setPillTextDone]}>
                        {buildSetLabel(s, i, fmtWeight)}
                      </Text>
                    </View>
                  ))}
                  {/* Sets no registrados → pill gris con guión */}
                  {Array.from({
                    length: Math.max(0, (ex.totalSets ?? ex.sets?.length ?? 0) - (ex.sets?.length ?? 0)),
                  }).map((_, i) => (
                    <View key={`empty-${i}`} style={styles.setPill}>
                      <Text style={styles.setPillText}>—</Text>
                    </View>
                  ))}
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

// ── Screen ─────────────────────────────────────────────────────────────────────

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const { t }  = useTranslation();

  const workoutLog     = useStore((s) => s.workoutLog);
  const deleteLogEntry = useStore((s) => s.deleteLogEntry);
  const programs       = useStore((s) => s.programs);
  const profile        = useStore((s) => s.profile);
  const activeProgram  = programs[profile.activeProgramId];

  const [scope,            setScope]            = useState('all');
  const [selectedStageIds, setSelectedStageIds] = useState(new Set());

  const hasStages = (activeProgram?.stages?.length ?? 0) > 0;

  function handleScope(newScope) {
    setScope(newScope);
    setSelectedStageIds(new Set());
  }

  function toggleStage(stageId) {
    setSelectedStageIds((prev) => {
      const next = new Set(prev);
      if (next.has(stageId)) next.delete(stageId);
      else next.add(stageId);
      return next;
    });
  }

  // IDs de templates del programa activo (todas las etapas)
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

  // Si hay etapas seleccionadas → filtrar por ellas
  const effectiveTemplateIds = useMemo(() => {
    if (scope !== 'program' || !hasStages || selectedStageIds.size === 0) {
      return programTemplateIds;
    }
    const ids = new Set();
    activeProgram.stages.forEach((st, idx) => {
      const stageId = st.id ?? idx;
      if (selectedStageIds.has(stageId)) {
        st.days.forEach((d) => ids.add(d.sessionTemplateId));
      }
    });
    return ids;
  }, [activeProgram, scope, selectedStageIds, programTemplateIds, hasStages]);

  const filtered = useMemo(() => {
    let list = [...workoutLog];
    if (scope === 'program' && effectiveTemplateIds.size > 0) {
      list = list.filter((e) => effectiveTemplateIds.has(e.sessionTemplateId));
    }
    return list.sort((a, b) => b.timestamp - a.timestamp);
  }, [workoutLog, scope, effectiveTemplateIds]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <AppHeader />

      {/* Scope selector */}
      <View style={styles.scopeRow}>
        {[
          { id: 'program', label: 'Este programa' },
          { id: 'all',     label: 'Todos' },
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
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stagePillsContent}>
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
                <Text style={styles.stagePillResetText}>Todas ✕</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>
      )}

      {/* List */}
      {filtered.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📭</Text>
          <Text style={styles.emptyText}>
            {scope === 'program'
              ? 'No hay sesiones registradas para este programa.'
              : 'Completa tu primera sesión para verla aquí.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: spacing.xxl + insets.bottom },
          ]}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <SessionCard item={item} session={item} onDelete={deleteLogEntry} />
          )}
        />
      )}
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex:            1,
    backgroundColor: colors.bg,
  },

  // Scope selector
  scopeRow: {
    flexDirection:     'row',
    gap:               spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingTop:        spacing.xl,
    paddingBottom:     spacing.sm,
  },
  scopeBtn: {
    flex:              1,
    paddingVertical:   spacing.sm,
    borderRadius:      radius.sm,
    borderWidth:       borders.thin,
    borderColor:       colors.border,
    backgroundColor:   colors.surface,
    alignItems:        'center',
  },
  scopeBtnActive: {
    backgroundColor: withOpacity(colors.accent, 0.08),
    borderColor:     withOpacity(colors.accent, 0.3),
  },
  scopeBtnText: {
    fontSize:   typography.sm,
    color:      colors.muted,
    fontWeight: typography.medium,
  },
  scopeBtnTextActive: {
    color: colors.accent,
  },

  // Stage pills
  stagePillsRow: {
    borderBottomWidth: borders.thin,
    borderBottomColor: colors.border,
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
    borderRadius:      radius.full,
    borderWidth:       borders.thin,
    borderColor:       colors.border,
    backgroundColor:   colors.surface2,
  },
  stagePillActive: {
    backgroundColor: withOpacity(colors.accent, 0.08),
    borderColor:     withOpacity(colors.accent, 0.3),
  },
  stagePillText: {
    fontSize:   typography.xs,
    color:      colors.muted,
    fontWeight: typography.medium,
  },
  stagePillTextActive: {
    color: colors.accent,
  },
  stagePillReset: {
    paddingHorizontal: spacing.sm,
    paddingVertical:   spacing.xs,
  },
  stagePillResetText: {
    fontSize: typography.xs,
    color:    colors.muted,
  },

  // List
  listContent: {
    padding: spacing.xl,
    gap:     spacing.sm,
  },

  // Empty state
  emptyState: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    padding:        spacing.xxl,
    gap:            spacing.md,
  },
  emptyIcon: { fontSize: 32 },
  emptyText: {
    fontSize:   typography.base,
    color:      colors.muted,
    textAlign:  'center',
    lineHeight: typography.base * 1.7,
  },

  // SessionCard
  card: {
    backgroundColor: colors.surface,
    borderWidth:     borders.thin,
    borderColor:     colors.borderCard,
    borderRadius:    radius.md,
    overflow:        'hidden',
  },
  cardHeader: {
    flexDirection:  'row',
    alignItems:     'center',
    padding:        spacing.md,
    borderLeftWidth: 3,
    gap:            spacing.sm,
  },
  cardHeaderLeft: {
    flex: 1,
    gap:  3,
  },
  cardDayLabel: {
    fontSize:      typography.base,
    fontWeight:    typography.bold,
    letterSpacing: 0.5,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems:    'center',
    flexWrap:      'wrap',
    gap:           spacing.xs,
  },
  cardDate: {
    fontSize: typography.xs,
    color:    colors.muted,
  },
  cardMetaSep: {
    fontSize: typography.xs,
    color:    colors.muted2,
  },
  noteTag: {
    backgroundColor: withOpacity(colors.accent, 0.08),
    borderWidth:     borders.thin,
    borderColor:     withOpacity(colors.accent, 0.25),
    borderRadius:    3,
    paddingHorizontal: 5,
    paddingVertical:   1,
  },
  noteTagText: {
    fontSize:      8,
    fontWeight:    typography.bold,
    color:         colors.accent,
    letterSpacing: 0.5,
  },
  cardHeaderRight: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.sm,
    flexShrink:    0,
  },
  deleteBtn: {
    padding: spacing.xs,
  },
  deleteBtnText: {
    fontSize: typography.base,
    color:    colors.muted2,
  },
  chevron: {
    fontSize: typography.base,
    color:    colors.muted,
  },
  chevronOpen: {
    transform: [{ rotate: '180deg' }],
  },

  // Detail
  detail: {
    borderTopWidth: borders.thin,
    borderTopColor: colors.border,
  },
  noteSection: {
    padding:         spacing.md,
    backgroundColor: withOpacity(colors.accent, 0.04),
    borderLeftWidth: 2,
    borderLeftColor: withOpacity(colors.accent, 0.3),
    gap:             spacing.xs,
  },
  noteSectionLabel: {
    fontSize:      typography.xs,
    fontWeight:    typography.bold,
    color:         colors.accent,
    letterSpacing: 1.5,
    opacity:       0.8,
  },
  noteSectionText: {
    fontSize:   typography.sm,
    color:      colors.text,
    lineHeight: typography.sm * 1.6,
  },
  exSection: {
    padding:         spacing.md,
    borderTopWidth:  borders.thin,
    borderTopColor:  colors.border,
    gap:             spacing.xs,
  },
  exName: {
    fontSize:   typography.sm,
    fontWeight: typography.medium,
    color:      colors.text,
  },
  setPills: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           spacing.xs,
  },
  setPill: {
    backgroundColor:   colors.surface2,
    borderWidth:       borders.thin,
    borderColor:       colors.border,
    borderRadius:      radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical:   2,
  },
  setPillDone: {
    backgroundColor: 'rgba(74,222,128,0.08)',
    borderColor:     'rgba(74,222,128,0.3)',
  },
  setPillText: {
    fontSize: typography.xs,
    color:    colors.muted,
  },
  setPillTextDone: {
    color: colors.green,
  },
});
