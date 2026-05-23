import { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  Modal, StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import { useStore, selectActiveProgram } from '../../store/useStore';
import AppHeader from '../components/AppHeader';
import { colors, spacing, typography, radius, borders, resolveColor, withOpacity } from '../theme';
import { formatDate } from '../../../src/utils/formatters';

// ── Relative time ──────────────────────────────────────────────────────────────

function relativeTime(ts) {
  if (!ts) return 'Sin registros';
  const days = Math.floor((Date.now() - ts) / 86400000);
  if (days === 0) return 'Hoy';
  if (days === 1) return 'Ayer';
  if (days < 7)   return `Hace ${days} días`;
  if (days < 14)  return 'Hace 1 semana';
  return formatDate(ts);
}

// ── DayCard ────────────────────────────────────────────────────────────────────

function DayCard({ template, lastSession, allExercises, isActive, onPress }) {
  const { i18n } = useTranslation();
  const accent = resolveColor(template?.color ?? 'var(--day1)');
  const lastText = relativeTime(lastSession?.timestamp);

  const focus = (template?.exercises ?? [])
    .map(({ exerciseId }) => {
      const ex = allExercises[exerciseId];
      if (!ex) return exerciseId;
      return i18n.language === 'en' ? (ex.nameEn ?? ex.name) : ex.name;
    })
    .join(' · ');

  return (
    <TouchableOpacity
      style={[styles.dayCard, { borderLeftColor: accent }]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={styles.dayCardTop}>
        {/* Big letter */}
        <Text style={[styles.dayLetter, { color: accent }]}>
          {template?.label ?? '?'}
        </Text>

        {/* Right: badge or last time */}
        {isActive ? (
          <View style={[styles.inProgressBadge, { borderColor: accent }]}>
            <Text style={[styles.inProgressText, { color: accent }]}>EN CURSO</Text>
          </View>
        ) : (
          <Text style={styles.lastTime}>{lastText}</Text>
        )}
      </View>

      {/* Name */}
      <Text style={[styles.dayName, { color: accent }]} numberOfLines={1}>
        {(template?.name ?? '').toUpperCase()}
      </Text>

      {/* Exercise focus */}
      {focus ? (
        <Text style={styles.dayFocus} numberOfLines={1}>{focus}</Text>
      ) : null}
    </TouchableOpacity>
  );
}

// ── Archive modal ──────────────────────────────────────────────────────────────

function ArchiveModal({ programName, onConfirm, onClose }) {
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={styles.centerSheet}>
        <Text style={styles.archiveTitle}>Archivar programa</Text>
        <Text style={styles.archiveDesc}>
          <Text style={{ color: colors.text, fontWeight: '600' }}>{programName}</Text>
          {'\n'}Se guardará en archivados. Podrás restaurarlo después.
        </Text>

        <ArchiveOption
          label="Mantener historial"
          desc="El programa se archiva, el historial de sesiones se conserva"
          onPress={() => onConfirm(false)}
        />
        <ArchiveOption
          label="Borrar historial"
          desc="Se eliminarán todas las sesiones registradas de este programa"
          onPress={() => onConfirm(true)}
          danger
        />

        <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
          <Text style={styles.cancelBtnText}>Cancelar</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

function ArchiveOption({ label, desc, onPress, danger }) {
  return (
    <TouchableOpacity
      style={[styles.archiveOption, danger && styles.archiveOptionDanger]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Text style={[styles.archiveOptionLabel, danger && { color: colors.red }]}>{label}</Text>
      <Text style={styles.archiveOptionDesc}>{desc}</Text>
    </TouchableOpacity>
  );
}

// ── Screen ─────────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const insets     = useSafeAreaInsets();
  const navigation = useNavigation();

  const [archiveOpen,  setArchiveOpen]  = useState(false);
  const [stagePicker,  setStagePicker]  = useState(false);

  const activeProgram     = useStore(selectActiveProgram);
  const activeSession     = useStore((s) => s.activeSession);
  const exerciseLibrary   = useStore((s) => s.exerciseLibrary);
  const customExercises   = useStore((s) => s.customExercises);
  const sessionTemplates  = useStore((s) => s.sessionTemplates);   // subscribe for reactivity
  const userPrograms      = useStore((s) => s.userPrograms);        // subscribe for reactivity
  const getEffectiveTemplate = useStore((s) => s.getEffectiveTemplate);
  const getLastSession    = useStore((s) => s.getLastSession);
  const startSession      = useStore((s) => s.startSession);
  const navigate          = useStore((s) => s.navigate);
  const archiveProgram    = useStore((s) => s.archiveProgram);
  const advanceStage        = useStore((s) => s.advanceStage);
  const dismissStageAdvance = useStore((s) => s.dismissStageAdvance);
  const setCurrentStage     = useStore((s) => s.setCurrentStage);

  const allExercises = { ...exerciseLibrary, ...customExercises };

  function handleArchiveConfirm(clearHistory) {
    if (activeProgram) archiveProgram(activeProgram.id, clearHistory);
    setArchiveOpen(false);
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Shared header: F&C + settings menu */}
      <AppHeader />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {activeProgram ? (() => {
          const hasStages       = (activeProgram.stages?.length ?? 0) > 0;
          const currentStageIdx = activeProgram.currentStageIndex ?? 0;
          const currentStage    = hasStages ? activeProgram.stages[currentStageIdx] : null;
          const nextStage       = hasStages ? activeProgram.stages[currentStageIdx + 1] : null;
          const sessionsCompleted = activeProgram.stageSessionsCompleted ?? 0;
          const threshold         = currentStage
            ? currentStage.durationWeeks * (currentStage.days?.length || 1)
            : 0;
          const progress = threshold > 0 ? Math.min(1, sessionsCompleted / threshold) : 0;

          return (
            <>
              {/* Program label + stage chip */}
              <View style={styles.programMeta}>
                <Text style={styles.programMetaLabel}>PROGRAMA ACTIVO</Text>
                <View style={styles.programNameRow}>
                  <Text style={styles.programName}>{activeProgram.name}</Text>
                  {hasStages && (
                    <TouchableOpacity
                      style={styles.stageChip}
                      onPress={() => setStagePicker(true)}
                      activeOpacity={0.75}
                    >
                      <Text style={styles.stageChipText}>
                        {currentStage?.name ?? `Etapa ${currentStageIdx + 1}`}
                        {'  ▾'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Progress bar */}
                {hasStages && threshold > 0 && (
                  <View style={styles.progressSection}>
                    <View style={styles.progressLabels}>
                      <Text style={styles.progressLabel}>
                        {sessionsCompleted}/{threshold} sesiones
                      </Text>
                      <Text style={styles.progressLabel}>
                        {currentStageIdx + 1}/{activeProgram.stages.length} etapas
                      </Text>
                    </View>
                    <View style={styles.progressBarBg}>
                      <View
                        style={[
                          styles.progressBarFill,
                          { width: `${Math.round(progress * 100)}%` },
                        ]}
                      />
                    </View>
                  </View>
                )}
              </View>

              {/* Stage advance banner */}
              {activeProgram.stageAdvancePending && nextStage && (
                <View style={styles.stageBanner}>
                  <Text style={styles.stageBannerLabel}>ETAPA COMPLETADA</Text>
                  <Text style={styles.stageBannerText}>
                    {`Has completado ${currentStage?.name ?? 'la etapa actual'}. ¿Avanzar a ${nextStage.name}?`}
                  </Text>
                  <View style={styles.stageBannerBtns}>
                    <TouchableOpacity
                      style={styles.stageBannerAdvanceBtn}
                      onPress={() => advanceStage(activeProgram.id)}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.stageBannerAdvanceBtnText}>
                        {`AVANZAR A ${(nextStage.name ?? '').toUpperCase()}`}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.stageBannerContinueBtn}
                      onPress={() => dismissStageAdvance(activeProgram.id)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.stageBannerContinueBtnText}>Continuar</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Day cards */}
              <Text style={styles.sectionCaption}>SELECCIONAR SESIÓN</Text>
              <View style={styles.dayList}>
                {(activeProgram.days ?? []).map(({ sessionTemplateId }) => {
                  const tpl = getEffectiveTemplate(sessionTemplateId);
                  if (!tpl) return null;
                  const last = getLastSession(sessionTemplateId);
                  const isActive = activeSession?.templateId === sessionTemplateId;
                  return (
                    <DayCard
                      key={sessionTemplateId}
                      template={tpl}
                      lastSession={last}
                      allExercises={allExercises}
                      isActive={isActive}
                      onPress={isActive
                        ? () => navigation.navigate('Workout')
                        : () => startSession(sessionTemplateId)
                      }
                    />
                  );
                })}
              </View>

              {/* Program action buttons */}
              <Text style={styles.sectionCaption}>PROGRAMA</Text>
              <View style={styles.programActions}>
                <ProgramBtn label="Ver" onPress={() => navigate('programPrint')} accent />
                <ProgramBtn label="Editar" onPress={() => navigate('programEditor')} accent />
                <ProgramBtn label="Archivar" onPress={() => setArchiveOpen(true)} danger />
              </View>
            </>
          );
        })() : (
          /* Empty state */
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🏋️</Text>
            <Text style={styles.emptyText}>
              Aún no tienes un programa activo.{'\n'}Crea uno nuevo para empezar.
            </Text>
            <TouchableOpacity
              style={styles.newProgramBtn}
              onPress={() => navigate('onboarding')}
              activeOpacity={0.85}
            >
              <Text style={styles.newProgramBtnText}>NUEVO PROGRAMA</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Modals */}
      {archiveOpen && (
        <ArchiveModal
          programName={activeProgram?.name}
          onConfirm={handleArchiveConfirm}
          onClose={() => setArchiveOpen(false)}
        />
      )}

      {stagePicker && activeProgram?.stages?.length > 0 && (
        <StagePickerModal
          program={activeProgram}
          onSelect={(idx) => {
            if (idx !== (activeProgram.currentStageIndex ?? 0)) {
              setCurrentStage(activeProgram.id, idx);
            }
            setStagePicker(false);
          }}
          onClose={() => setStagePicker(false)}
        />
      )}
    </View>
  );
}

function StagePickerModal({ program, onSelect, onClose }) {
  const currentStageIdx = program.currentStageIndex ?? 0;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={styles.stagePickerSheet}>
        <Text style={styles.stagePickerTitle}>SELECCIONAR ETAPA</Text>
        <View style={styles.stageList}>
          {program.stages.map((stage, idx) => {
            const isActive = idx === currentStageIdx;
            return (
              <TouchableOpacity
                key={stage.id ?? idx}
                style={[styles.stageOption, isActive && styles.stageOptionActive]}
                onPress={() => onSelect(idx)}
                activeOpacity={isActive ? 1 : 0.7}
              >
                <View style={styles.stageOptionHeader}>
                  <Text style={[styles.stageOptionName, isActive && styles.stageOptionNameActive]}>
                    {stage.name}
                  </Text>
                  {isActive && (
                    <Text style={styles.stageActiveLabel}>ACTIVA</Text>
                  )}
                </View>
                <Text style={styles.stageOptionDesc}>
                  {`${stage.durationWeeks ?? 4} sem · ${stage.days?.length ?? 0} sesiones/semana`}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
          <Text style={styles.cancelBtnText}>Cancelar</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

function ProgramBtn({ label, onPress, accent, danger }) {
  return (
    <TouchableOpacity
      style={[
        styles.programBtn,
        danger && styles.programBtnDanger,
        accent && styles.programBtnAccent,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[
        styles.programBtnText,
        danger && styles.programBtnTextDanger,
        accent && styles.programBtnTextAccent,
      ]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex:            1,
    backgroundColor: colors.bg,
  },

  // Content
  content: {
    padding:       spacing.xl,
    paddingBottom: spacing.xxl,
    gap:           spacing.lg,
  },

  // Program meta
  programMeta: { gap: 2 },
  programMetaLabel: {
    fontSize:      typography.xs,
    fontWeight:    typography.bold,
    color:         colors.muted,
    letterSpacing: 2,
  },
  programName: {
    fontSize:   typography.md,
    fontWeight: typography.medium,
    color:      colors.text,
  },

  sectionCaption: {
    fontSize:      typography.xs,
    fontWeight:    typography.bold,
    color:         colors.muted,
    letterSpacing: 2,
    marginBottom:  -spacing.xs,
  },

  // Day list
  dayList: { gap: spacing.sm },

  // DayCard
  dayCard: {
    backgroundColor: colors.surface,
    borderWidth:     borders.thin,
    borderColor:     colors.borderCard,
    borderLeftWidth: 3,
    borderRadius:    radius.md,
    padding:         spacing.md,
    paddingLeft:     spacing.md - 1,
  },
  dayCardTop: {
    flexDirection:  'row',
    alignItems:     'flex-start',
    justifyContent: 'space-between',
    marginBottom:   spacing.xs,
  },
  dayLetter: {
    fontSize:   20,
    fontWeight: '900',
    lineHeight: 20,
  },
  inProgressBadge: {
    borderWidth:       borders.thin,
    borderRadius:      radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical:   2,
    marginTop:         spacing.xs,
    backgroundColor:   'rgba(255,255,255,0.04)',
  },
  inProgressText: {
    fontSize:      typography.xs,
    fontWeight:    typography.bold,
    letterSpacing: 1,
  },
  lastTime: {
    fontSize:  typography.xs,
    color:     colors.muted,
    marginTop: spacing.xs,
  },
  dayName: {
    fontSize:      typography.base,
    fontWeight:    typography.bold,
    letterSpacing: 0.5,
    lineHeight:    typography.base * 1.1,
  },
  dayFocus: {
    fontSize:  typography.sm,
    color:     colors.muted,
    marginTop: spacing.xs,
  },

  // Program action buttons
  programActions: {
    flexDirection: 'row',
    gap:           spacing.sm,
  },
  programBtn: {
    flex:            1,
    paddingVertical: spacing.sm,
    borderRadius:    radius.sm,
    borderWidth:     borders.thin,
    borderColor:     colors.border,
    alignItems:      'center',
    backgroundColor: colors.surface,
  },
  programBtnAccent: {
    backgroundColor: withOpacity(colors.accent, 0.07),
    borderColor:     withOpacity(colors.accent, 0.3),
  },
  programBtnDanger: {
    backgroundColor: 'rgba(248,113,113,0.07)',
    borderColor:     'rgba(248,113,113,0.3)',
  },
  programBtnText: {
    fontSize:   typography.sm,
    fontWeight: typography.medium,
    color:      colors.muted,
  },
  programBtnTextAccent: { color: colors.accent },
  programBtnTextDanger: { color: colors.red },

  // Program name row (name + stage chip)
  programNameRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    gap:            spacing.sm,
    marginTop:      2,
  },
  stageChip: {
    backgroundColor: withOpacity(colors.accent, 0.08),
    borderWidth:     borders.thin,
    borderColor:     withOpacity(colors.accent, 0.3),
    borderRadius:    radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    flexShrink: 0,
  },
  stageChipText: {
    fontSize:      typography.xs,
    fontWeight:    typography.bold,
    color:         colors.accent,
    letterSpacing: 0.5,
  },

  // Progress bar
  progressSection: {
    marginTop: spacing.sm,
    gap:       4,
  },
  progressLabels: {
    flexDirection:  'row',
    justifyContent: 'space-between',
  },
  progressLabel: {
    fontSize: typography.xs,
    color:    colors.muted,
  },
  progressBarBg: {
    height:          3,
    backgroundColor: colors.surface2,
    borderRadius:    radius.full,
    overflow:        'hidden',
  },
  progressBarFill: {
    height:          '100%',
    backgroundColor: colors.accent,
    borderRadius:    radius.full,
  },

  // Stage advance banner
  stageBanner: {
    backgroundColor: withOpacity(colors.accent, 0.06),
    borderWidth:     borders.thin,
    borderColor:     withOpacity(colors.accent, 0.25),
    borderRadius:    radius.md,
    padding:         spacing.md,
    gap:             spacing.sm,
  },
  stageBannerLabel: {
    fontSize:      typography.xs,
    fontWeight:    typography.bold,
    color:         colors.accent,
    letterSpacing: 1.5,
  },
  stageBannerText: {
    fontSize:   typography.sm,
    fontWeight: typography.medium,
    color:      colors.text,
    lineHeight: typography.sm * 1.5,
  },
  stageBannerBtns: {
    flexDirection: 'row',
    gap:           spacing.sm,
    marginTop:     spacing.xs,
  },
  stageBannerAdvanceBtn: {
    flex:            2,
    backgroundColor: colors.accent,
    borderRadius:    radius.sm,
    paddingVertical: spacing.sm + 2,
    alignItems:      'center',
  },
  stageBannerAdvanceBtnText: {
    fontSize:      typography.base,
    fontWeight:    typography.heavy,
    color:         colors.onAccent,
    letterSpacing: 0.5,
  },
  stageBannerContinueBtn: {
    flex:            1,
    borderWidth:     borders.thin,
    borderColor:     withOpacity(colors.accent, 0.3),
    borderRadius:    radius.sm,
    paddingVertical: spacing.sm + 2,
    alignItems:      'center',
  },
  stageBannerContinueBtnText: {
    fontSize:   typography.sm,
    color:      colors.muted,
    fontWeight: typography.medium,
  },

  // Stage picker modal
  stagePickerSheet: {
    backgroundColor:      colors.surface,
    borderTopLeftRadius:  radius.lg,
    borderTopRightRadius: radius.lg,
    borderTopWidth:       borders.thin,
    borderTopColor:       colors.border,
    padding:              spacing.xl,
    paddingBottom:        spacing.xxl,
    gap:                  spacing.sm,
  },
  stagePickerTitle: {
    fontSize:      typography.lg,
    fontWeight:    typography.heavy,
    color:         colors.text,
    letterSpacing: 1,
    marginBottom:  spacing.xs,
  },
  stageList: {
    gap: spacing.sm,
  },
  stageOption: {
    backgroundColor: colors.surface2,
    borderWidth:     borders.thin,
    borderColor:     colors.borderCard,
    borderRadius:    radius.sm,
    padding:         spacing.md,
  },
  stageOptionActive: {
    backgroundColor: withOpacity(colors.accent, 0.06),
    borderColor:     withOpacity(colors.accent, 0.3),
  },
  stageOptionHeader: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    marginBottom:   3,
  },
  stageOptionName: {
    fontSize:   typography.base,
    fontWeight: typography.medium,
    color:      colors.text,
  },
  stageOptionNameActive: {
    color: colors.accent,
  },
  stageActiveLabel: {
    fontSize:      typography.xs,
    fontWeight:    typography.bold,
    color:         colors.accent,
    letterSpacing: 1,
  },
  stageOptionDesc: {
    fontSize: typography.xs,
    color:    colors.muted,
  },

  // Empty state
  emptyState: {
    alignItems:     'center',
    paddingVertical: spacing.xxl * 2,
    gap:             spacing.lg,
  },
  emptyIcon: { fontSize: 40 },
  emptyText: {
    fontSize:  typography.base,
    color:     colors.muted,
    textAlign: 'center',
    lineHeight: typography.base * 1.7,
  },
  newProgramBtn: {
    backgroundColor:   colors.accent,
    borderRadius:      radius.md,
    paddingHorizontal: spacing.xxl,
    paddingVertical:   spacing.lg,
    marginTop:         spacing.sm,
  },
  newProgramBtnText: {
    fontSize:      typography.lg,
    fontWeight:    typography.heavy,
    color:         colors.bg,
    letterSpacing: 1,
  },

  // Modals shared
  backdrop: {
    flex:            1,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },

  // Archive modal
  centerSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius:  radius.lg,
    borderTopRightRadius: radius.lg,
    padding:         spacing.xl,
    paddingBottom:   spacing.xxl,
    gap:             spacing.sm,
  },
  archiveTitle: {
    fontSize:      typography.lg,
    fontWeight:    typography.heavy,
    color:         colors.text,
    letterSpacing: 0.5,
    marginBottom:  spacing.xs,
  },
  archiveDesc: {
    fontSize:   typography.sm,
    color:      colors.muted,
    lineHeight: typography.sm * 1.6,
    marginBottom: spacing.xs,
  },
  archiveOption: {
    backgroundColor: colors.surface2,
    borderWidth:     borders.thin,
    borderColor:     colors.borderCard,
    borderRadius:    radius.sm,
    padding:         spacing.md,
  },
  archiveOptionDanger: {
    borderColor: 'rgba(248,113,113,0.3)',
    backgroundColor: 'rgba(248,113,113,0.05)',
  },
  archiveOptionLabel: {
    fontSize:   typography.base,
    fontWeight: typography.medium,
    color:      colors.text,
  },
  archiveOptionDesc: {
    fontSize:  typography.xs,
    color:     colors.muted,
    marginTop: 3,
  },
  cancelBtn: {
    paddingVertical: spacing.md,
    borderRadius:    radius.sm,
    borderWidth:     borders.thin,
    borderColor:     colors.border,
    alignItems:      'center',
    marginTop:       spacing.xs,
  },
  cancelBtnText: {
    fontSize:   typography.base,
    color:      colors.muted,
    fontWeight: typography.medium,
  },

});
