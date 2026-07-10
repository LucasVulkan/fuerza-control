import { useState, useEffect, useRef, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Alert, Keyboard,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../store/useStore';
import { spacing, typography, borders, withOpacity } from '../theme';
import { useTheme, useThemedStyles } from '../useTheme';
import { resolveColor } from '../themes';
import { sessionStats } from '../utils/sessionStats';
import DragSheet from '../components/DragSheet';

export default function ProgramEditorScreen({ navigation }) {
  const { t } = useTranslation();
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();

  const programs              = useStore((s) => s.programs);
  const userPrograms          = useStore((s) => s.userPrograms); // subscribe for dirty-state reactivity
  const sessionTemplates      = useStore((s) => s.sessionTemplates);
  const exerciseLibrary       = useStore((s) => s.exerciseLibrary);
  const customExercises       = useStore((s) => s.customExercises);
  const profile               = useStore((s) => s.profile);
  const ui                    = useStore((s) => s.ui);
  const beginEditSession      = useStore((s) => s.beginEditSession);
  const addSessionToProgram   = useStore((s) => s.addSessionToProgram);
  const renameProgram              = useStore((s) => s.renameProgram);
  const markProgramDirtyForClients = useStore((s) => s.markProgramDirtyForClients);
  const addStageToProgram     = useStore((s) => s.addStageToProgram);
  const removeStageFromProgram = useStore((s) => s.removeStageFromProgram);
  const duplicateStageInProgram = useStore((s) => s.duplicateStageInProgram);
  const updateStage           = useStore((s) => s.updateStage);
  const setCurrentStage       = useStore((s) => s.setCurrentStage);
  const showToast             = useStore((s) => s.showToast);

  const editingId     = ui._editingProgramId ?? profile.activeProgramId;
  const activeProgram = programs[editingId];
  const isFromClients = !!ui._editingProgramId;
  const hasStages     = (activeProgram?.stages?.length ?? 0) > 0;

  const allExercises = useMemo(
    () => ({ ...exerciseLibrary, ...customExercises }),
    [exerciseLibrary, customExercises],
  );

  const [nameValue, setNameValue]               = useState(activeProgram?.name ?? '');
  const [selectedStageIdx, setSelectedStageIdx] = useState(activeProgram?.currentStageIndex ?? 0);
  const [stageSheetOpen, setStageSheetOpen]     = useState(false);

  const selectedStage = hasStages ? (activeProgram?.stages?.[selectedStageIdx] ?? null) : null;
  const [stageName, setStageName] = useState(selectedStage?.name ?? '');

  useEffect(() => {
    beginEditSession();
  }, []);

  useEffect(() => {
    if (selectedStage) setStageName(selectedStage.name);
  }, [selectedStageIdx, activeProgram?.stages?.length]);

  useEffect(() => {
    if (hasStages) {
      const max = (activeProgram?.stages?.length ?? 1) - 1;
      if (selectedStageIdx > max) setSelectedStageIdx(max);
    }
  }, [activeProgram?.stages?.length]);

  const leavingRef = useRef(false);

  // Reverts the live edits to the snapshot taken on entry, then clears edit state.
  function restoreSnapshot() {
    const snapshot = useStore.getState()._editSnapshot;
    if (snapshot) {
      useStore.setState({
        programs: snapshot.programs,
        sessionTemplates: snapshot.sessionTemplates,
        userPrograms: snapshot.userPrograms,
        _editSnapshot: null,
      });
    }
    useStore.setState((s) => ({ ui: { ...s.ui, _editingProgramId: null } }));
  }

  // True if the live store diverges from the entry snapshot, or a text field
  // holds an uncommitted edit (program name / stage name).
  function hasUnsavedChanges() {
    const st   = useStore.getState();
    const snap = st._editSnapshot;
    if (!snap) return false;
    // Edits land in programs[editingId] (structure) and userPrograms (per-session
    // overrides). Base sessionTemplates don't change while editing, so skip them.
    if (JSON.stringify(st.programs[editingId]) !== JSON.stringify(snap.programs[editingId])) return true;
    if (JSON.stringify(st.userPrograms) !== JSON.stringify(snap.userPrograms)) return true;
    if (nameValue.trim() !== (activeProgram?.name ?? '')) return true;
    if (selectedStage && stageName.trim() !== (selectedStage.name ?? '')) return true;
    return false;
  }

  // Intercept every exit (back arrow, swipe, hardware back). Warn only when
  // there are unsaved changes; otherwise leave silently.
  useEffect(() => {
    const sub = navigation.addListener('beforeRemove', (e) => {
      if (leavingRef.current || !hasUnsavedChanges()) return;
      e.preventDefault();
      Alert.alert(
        t('editor.unsavedTitle'),
        t('editor.unsavedBody'),
        [
          { text: t('editor.keepEditing'), style: 'cancel' },
          {
            text: t('editor.exitNoSave'),
            style: 'destructive',
            onPress: () => {
              leavingRef.current = true;
              restoreSnapshot();
              navigation.dispatch(e.data.action);
            },
          },
        ],
      );
    });
    return sub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation, editingId, nameValue, stageName, selectedStage, activeProgram]);

  // Reactive dirty flag for the header Save button.
  const dirty = useMemo(
    () => hasUnsavedChanges(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [programs, userPrograms, nameValue, stageName, selectedStageIdx],
  );

  if (!activeProgram) return null;

  const editorDays = hasStages
    ? (activeProgram.stages[selectedStageIdx]?.days ?? [])
    : (activeProgram.days ?? []);

  // ── Program summary ─────────────────────────────────────────────────────────
  const summaryLine = hasStages
    ? t('editor.programSummary', {
        stages:   activeProgram.stages.length,
        weeks:    activeProgram.stages.reduce((a, s) => a + (s.durationWeeks ?? 0), 0),
        sessions: activeProgram.stages.reduce((a, s) => a + (s.days?.length ?? 0) * (s.durationWeeks ?? 0), 0),
      })
    : t('editor.programSummarySimple', {
        sessions: editorDays.length,
        sets: editorDays.reduce((a, { sessionTemplateId }) => {
          const template = userPrograms[sessionTemplateId] ?? sessionTemplates[sessionTemplateId];
          return a + sessionStats(template, allExercises).sets;
        }, 0),
      });

  function commitName() {
    const trimmed = nameValue.trim();
    if (trimmed && trimmed !== activeProgram.name) renameProgram(editingId, trimmed);
    else setNameValue(activeProgram.name ?? '');
  }

  function commitStageName() {
    const trimmed = stageName.trim();
    if (trimmed && trimmed !== selectedStage?.name) updateStage(editingId, selectedStageIdx, { name: trimmed });
    else setStageName(selectedStage?.name ?? '');
  }

  function handleAddStage() {
    const wasStaged = hasStages;
    addStageToProgram(editingId);
    const newIdx = wasStaged ? (activeProgram?.stages?.length ?? 1) : 1;
    setSelectedStageIdx(newIdx);
    showToast(t('editor.toastStageAdded'), 2200, 'success');
  }

  function handleDeleteStage() {
    Alert.alert(
      '¿Eliminar etapa?',
      `¿Eliminar "${selectedStage?.name}"? Las sesiones de esta etapa se perderán.`,
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: 'Eliminar', style: 'destructive',
          onPress: () => {
            setStageSheetOpen(false);
            removeStageFromProgram(editingId, selectedStageIdx);
            setSelectedStageIdx(Math.max(0, selectedStageIdx - 1));
            showToast(t('editor.toastStageDeleted'), 2200, 'neutral');
          },
        },
      ]
    );
  }

  function handleSave() {
    // Flush any text field that still has focus before saving
    Keyboard.dismiss();
    commitName();
    commitStageName();
    // Mark any clients that have this program assigned as needing a re-upload
    markProgramDirtyForClients(editingId);
    showToast(t('editor.toastSaved'), 2200, 'success');
    leavingRef.current = true; // skip the unsaved-changes guard on the way out
    useStore.setState((s) => ({ _editSnapshot: null, ui: { ...s.ui, _editingProgramId: null } }));
    navigation.goBack();
  }

  const isStageActive = selectedStageIdx === (activeProgram.currentStageIndex ?? 0);

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      {/* Header */}
      <View style={styles.headerWrap}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12} style={styles.backBtn}>
            <Text style={styles.backIcon}>‹</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { flex: 1 }]} numberOfLines={1}>
            {isFromClients ? t('editor.titleEditClient') : t('editor.titleEdit')}
          </Text>
          <TouchableOpacity
            onPress={handleSave}
            disabled={!dirty}
            style={[styles.saveBtnHeader, !dirty && styles.saveBtnHeaderClean]}
            activeOpacity={0.85}
          >
            <Text style={[styles.saveBtnHeaderText, !dirty && styles.saveBtnHeaderTextClean]}>
              {dirty ? t('editor.save') : t('editor.saved')}
            </Text>
          </TouchableOpacity>
        </View>
        <View style={styles.programNameWrap}>
          <TextInput
            style={styles.programNameInput}
            value={nameValue}
            onChangeText={setNameValue}
            onBlur={commitName}
            onSubmitEditing={commitName}
            placeholder="Nombre del programa"
            placeholderTextColor={th.colors.muted2}
            returnKeyType="done"
          />
        </View>
      </View>

      {/* Scrollable content */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + spacing.xxl }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Summary ── */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTag}>{t('exerciseEditor.summaryTitle')}</Text>
          <Text style={styles.summaryMain}>{summaryLine}</Text>
        </View>

        {/* ── Stages: timeline + selected stage row ── */}
        {hasStages && (
          <View>
            <Text style={styles.secTitle}>{t('editor.sectionStages')}</Text>

            <View style={styles.timeline}>
              {activeProgram.stages.map((stage, idx) => {
                const isSelected = idx === selectedStageIdx;
                const isActive   = idx === (activeProgram.currentStageIndex ?? 0);
                return (
                  <TouchableOpacity
                    key={stage.id ?? idx}
                    style={[
                      styles.timelineSeg,
                      { flex: Math.max(1, stage.durationWeeks ?? 1) },
                      isSelected && styles.timelineSegSelected,
                    ]}
                    onPress={() => setSelectedStageIdx(idx)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[styles.timelineName, isSelected && styles.timelineNameSelected]}
                      numberOfLines={1}
                    >
                      {stage.name}{isActive ? ' ●' : ''}
                    </Text>
                    <Text style={styles.timelineWeeks}>
                      {t('editor.weeksShort', { weeks: stage.durationWeeks ?? 0 })}
                    </Text>
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity style={styles.timelineAdd} onPress={handleAddStage}>
                <Text style={styles.timelineAddText}>＋</Text>
              </TouchableOpacity>
            </View>

            {selectedStage && (
              <TouchableOpacity
                style={styles.stageRow}
                onPress={() => setStageSheetOpen(true)}
                activeOpacity={0.7}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={styles.stageRowTitleRow}>
                    <Text style={styles.stageRowTitle} numberOfLines={1}>{selectedStage.name}</Text>
                    {isStageActive && (
                      <Text style={styles.activeBadge}>{t('editor.stageActiveBadge')}</Text>
                    )}
                  </View>
                  <Text style={styles.stageRowSub}>
                    {t('editor.stageCardMeta', {
                      weeks:    selectedStage.durationWeeks ?? 0,
                      sessions: selectedStage.days?.length ?? 0,
                    })}
                  </Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {!hasStages && (
          <Text style={styles.changesHint}>{t('editor.changesHint')}</Text>
        )}

        {/* ── Sessions of the selected stage ── */}
        <View>
          <Text style={styles.secTitle}>
            {hasStages && selectedStage
              ? t('editor.sessionsOf', { stage: selectedStage.name })
              : t('editor.sectionSessions')}
          </Text>

          <View style={{ gap: spacing.sm }}>
            {editorDays.map(({ sessionTemplateId }) => {
              const template = userPrograms[sessionTemplateId] ?? sessionTemplates[sessionTemplateId];
              if (!template) return null;
              const color = resolveColor(th, template.color ?? 'var(--accent)');
              const stats = sessionStats(template, allExercises);
              return (
                <TouchableOpacity
                  key={sessionTemplateId}
                  style={[styles.sessionCard, { borderLeftColor: color }]}
                  onPress={() => navigation.navigate('SessionEditor', {
                    templateId: sessionTemplateId,
                    programId:  editingId,
                    stageIdx:   hasStages ? selectedStageIdx : null,
                  })}
                  activeOpacity={0.7}
                >
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.sesTag}>{`Sesión ${template.label ?? ''}`}</Text>
                    <Text style={[styles.sesName, { color }]} numberOfLines={1}>
                      {template.name ?? ''}
                    </Text>
                    <Text style={styles.sesMeta}>
                      {stats.minutes > 0
                        ? t('editor.sessionMeta',       { ex: stats.exercises, sets: stats.sets, min: stats.minutes })
                        : t('editor.sessionMetaNoTime', { ex: stats.exercises, sets: stats.sets })}
                    </Text>
                  </View>
                  <Text style={styles.chevron}>›</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            style={styles.addSessionBtn}
            onPress={() => addSessionToProgram(editingId, hasStages ? selectedStageIdx : null)}
          >
            <Text style={styles.addSessionBtnText}>
              {hasStages && selectedStage
                ? t('editor.addSessionNamed', { stage: selectedStage.name })
                : t('editor.addSession')}
            </Text>
          </TouchableOpacity>

          {!hasStages && (
            <TouchableOpacity style={styles.convertToStagesBtn} onPress={handleAddStage}>
              <Text style={styles.convertToStagesBtnText}>{t('editor.convertToStages')}</Text>
            </TouchableOpacity>
          )}
        </View>

      </ScrollView>

      {/* ── Stage settings sheet ── */}
      <DragSheet
        visible={stageSheetOpen}
        onClose={() => { commitStageName(); setStageSheetOpen(false); }}
        title={t('editor.stageSheetTitle')}
      >
        {selectedStage && (
          <View style={styles.sheetBody}>

            <View>
              <Text style={styles.secTitle}>{t('editor.stageNameLabel')}</Text>
              <TextInput
                style={styles.sheetInput}
                value={stageName}
                onChangeText={setStageName}
                onBlur={commitStageName}
                onSubmitEditing={commitStageName}
                placeholder={t('editor.stageName')}
                placeholderTextColor={th.colors.muted2}
                returnKeyType="done"
              />
            </View>

            <View>
              <Text style={styles.secTitle}>{t('editor.stageDurationLabel')}</Text>
              <View style={styles.weeksRow}>
                <Text style={styles.weeksLabel}>{t('editor.stageWeeksUnit')}</Text>
                <View style={styles.weeksControls}>
                  <TouchableOpacity
                    style={styles.weeksBtn}
                    onPress={() => updateStage(editingId, selectedStageIdx, {
                      durationWeeks: Math.max(1, (selectedStage.durationWeeks ?? 4) - 1),
                    })}
                  >
                    <Text style={styles.weeksBtnText}>−</Text>
                  </TouchableOpacity>
                  <Text style={styles.weeksValue}>{selectedStage.durationWeeks ?? 4}</Text>
                  <TouchableOpacity
                    style={styles.weeksBtn}
                    onPress={() => updateStage(editingId, selectedStageIdx, {
                      durationWeeks: Math.min(52, (selectedStage.durationWeeks ?? 4) + 1),
                    })}
                  >
                    <Text style={[styles.weeksBtnText, { color: th.colors.accent }]}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <View>
              <Text style={styles.secTitle}>{t('editor.stageStateLabel')}</Text>
              {isStageActive ? (
                <View style={styles.stateRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.stateTitle}>{t('editor.stageIsActive')}</Text>
                    <Text style={styles.stateHint}>{t('editor.stageActiveHint')}</Text>
                  </View>
                  <Text style={styles.activeBadge}>{t('editor.stageActiveBadge')}</Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.activateBtn}
                  onPress={() => {
                    setCurrentStage(editingId, selectedStageIdx);
                    showToast(t('editor.toastStageActivated', { name: selectedStage.name }), 2200, 'success');
                  }}
                >
                  <Text style={styles.activateBtnText}>{t('editor.stageActivateBtn')}</Text>
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity
              style={styles.dupStageBtn}
              onPress={() => {
                commitStageName(); // flush a pending rename so the copy inherits it
                const newIdx = duplicateStageInProgram(editingId, selectedStageIdx);
                if (newIdx != null) {
                  setSelectedStageIdx(newIdx);
                  showToast(t('editor.toastStageDuplicated'), 2200, 'success');
                }
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.dupStageBtnText}>{t('editor.stageDuplicateBtn')}</Text>
            </TouchableOpacity>

            {activeProgram.stages.length > 1 && (
              <TouchableOpacity style={styles.deleteStageBtn} onPress={handleDeleteStage}>
                <Text style={styles.deleteStageBtnText}>{t('editor.stageDeleteBtn')}</Text>
              </TouchableOpacity>
            )}

          </View>
        )}
      </DragSheet>

    </SafeAreaView>
  );
}

const makeStyles = (th) => StyleSheet.create({
  container: { flex: 1, backgroundColor: th.colors.bg },

  // Header
  headerWrap: {
    borderBottomWidth: borders.thin,
    borderBottomColor: th.colors.border,
  },
  header: {
    flexDirection: 'row', alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  backBtn: { padding: spacing.xs },
  backIcon: { fontSize: 26, color: th.colors.muted, lineHeight: 30 },
  headerTitle: {
    fontSize: typography.base, fontWeight: typography.bold,
    letterSpacing: 0.5, color: th.colors.text,
  },
  saveBtnHeader: {
    backgroundColor: th.colors.accent,
    borderRadius: th.radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 3,
    flexShrink: 0,
  },
  saveBtnHeaderText: {
    fontSize: typography.sm, fontWeight: typography.heavy,
    color: th.colors.onAccent, letterSpacing: 0.5,
  },
  saveBtnHeaderClean: {
    backgroundColor: th.colors.surface2,
    borderWidth: borders.thin, borderColor: th.colors.border,
  },
  saveBtnHeaderTextClean: { color: th.colors.muted },
  programNameWrap: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    paddingTop: spacing.xs,
  },
  programNameInput: {
    fontSize: typography.base,
    fontWeight: typography.bold,
    color: th.colors.text,
    backgroundColor: th.colors.surface2,
    borderWidth: borders.thin,
    borderColor: th.colors.border,
    borderRadius: th.radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },

  // Content
  scrollContent: {
    paddingHorizontal: spacing.xl, paddingTop: spacing.md,
    paddingBottom: spacing.xxl, gap: spacing.lg,
  },
  changesHint: { fontSize: typography.xs, color: th.colors.muted, lineHeight: 18 },

  secTitle: {
    fontSize:      typography.xs,
    fontWeight:    typography.bold,
    color:         th.colors.muted,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom:  spacing.sm,
  },

  // Summary
  summaryCard: {
    backgroundColor: withOpacity(th.colors.accent, 0.06),
    borderWidth:     borders.thin,
    borderColor:     withOpacity(th.colors.accent, 0.25),
    borderRadius:    th.radius.md,
    padding:         spacing.md,
  },
  summaryTag: {
    fontSize:      typography.xs - 1,
    fontWeight:    typography.heavy,
    color:         withOpacity(th.colors.accent, 0.7),
    letterSpacing: 1.2,
    marginBottom:  2,
  },
  summaryMain: {
    fontSize:   typography.md,
    fontWeight: typography.semibold,
    color:      th.colors.accent,
  },

  // Stage timeline
  timeline: {
    flexDirection: 'row',
    gap: 5,
  },
  timelineSeg: {
    backgroundColor: th.colors.surface,
    borderWidth: borders.thin,
    borderColor: th.colors.border,
    borderRadius: th.radius.sm,
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
    gap: 1,
    minWidth: 0,
  },
  timelineSegSelected: {
    backgroundColor: withOpacity(th.colors.accent, 0.1),
    borderColor: withOpacity(th.colors.accent, 0.5),
  },
  timelineName: {
    fontSize: typography.xs - 1,
    fontWeight: typography.bold,
    letterSpacing: 0.3,
    color: th.colors.muted,
    textTransform: 'uppercase',
  },
  timelineNameSelected: { color: th.colors.accent },
  timelineWeeks: { fontSize: typography.xs - 1, color: th.colors.muted2 },
  timelineAdd: {
    width: 34,
    borderWidth: 1, borderStyle: 'dashed', borderColor: th.colors.border,
    borderRadius: th.radius.sm,
    alignItems: 'center', justifyContent: 'center',
  },
  timelineAddText: { fontSize: typography.lg, color: th.colors.muted },

  // Selected stage row
  stageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    backgroundColor: th.colors.surface,
    borderWidth: borders.thin,
    borderColor: th.colors.border,
    borderRadius: th.radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    gap: spacing.sm,
  },
  stageRowTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  stageRowTitle: {
    fontSize: typography.base,
    fontWeight: typography.semibold,
    color: th.colors.text,
    flexShrink: 1,
  },
  stageRowSub: { fontSize: typography.xs, color: th.colors.muted, marginTop: 1 },
  activeBadge: {
    fontSize: 9,
    fontWeight: typography.heavy,
    letterSpacing: 0.6,
    color: th.colors.onAccent,
    backgroundColor: th.colors.accent,
    borderRadius: th.radius.xs,
    paddingHorizontal: 5,
    paddingVertical: 1,
    overflow: 'hidden',
  },
  chevron: { fontSize: typography.xl, color: th.colors.muted2 },

  // Session cards
  sessionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: th.colors.surface,
    borderWidth: borders.thin,
    borderColor: th.colors.border,
    borderLeftWidth: 3,
    borderRadius: th.radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  sesTag: {
    fontSize: 9, fontWeight: typography.bold,
    color: th.colors.muted2, letterSpacing: 1,
    textTransform: 'uppercase', marginBottom: 1,
  },
  sesName: {
    fontSize: typography.base, fontWeight: typography.bold,
    lineHeight: typography.base * 1.2,
  },
  sesMeta: { fontSize: typography.xs, color: th.colors.muted, marginTop: 2 },

  addSessionBtn: {
    paddingVertical: spacing.md + 2,
    borderRadius: th.radius.md,
    borderWidth: 1, borderStyle: 'dashed',
    borderColor: withOpacity(th.colors.accent, 0.4),
    alignItems: 'center',
    backgroundColor: withOpacity(th.colors.accent, 0.04),
    marginTop: spacing.sm,
  },
  addSessionBtnText: { fontSize: typography.base, color: th.colors.accent },
  convertToStagesBtn: {
    paddingVertical: spacing.md, borderRadius: th.radius.md,
    borderWidth: 1, borderStyle: 'dashed', borderColor: th.colors.border,
    alignItems: 'center', marginTop: spacing.sm,
  },
  convertToStagesBtnText: { fontSize: typography.sm, color: th.colors.muted },

  // Stage sheet
  sheetBody: {
    gap: spacing.lg,
    paddingBottom: spacing.sm,
  },
  sheetInput: {
    fontSize: typography.md,
    fontWeight: typography.semibold,
    color: th.colors.text,
    backgroundColor: th.colors.surface2,
    borderWidth: borders.thin,
    borderColor: th.colors.border,
    borderRadius: th.radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  weeksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: th.colors.surface2,
    borderWidth: borders.thin,
    borderColor: th.colors.border,
    borderRadius: th.radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  weeksLabel: { fontSize: typography.sm, color: th.colors.mutedLight },
  weeksControls: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  weeksBtn: {
    width: 36, height: 36,
    borderRadius: th.radius.sm,
    borderWidth: borders.thin,
    borderColor: th.colors.border,
    backgroundColor: th.colors.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  weeksBtnText: { fontSize: 18, color: th.colors.muted, lineHeight: 22 },
  weeksValue: {
    fontSize: typography.xl,
    fontWeight: typography.bold,
    color: th.colors.text,
    minWidth: 28,
    textAlign: 'center',
  },
  stateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: th.colors.surface2,
    borderWidth: borders.thin,
    borderColor: th.colors.border,
    borderRadius: th.radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    gap: spacing.sm,
  },
  stateTitle: { fontSize: typography.sm, fontWeight: typography.semibold, color: th.colors.text },
  stateHint:  { fontSize: typography.xs, color: th.colors.muted, marginTop: 1 },
  activateBtn: {
    paddingVertical: spacing.sm + 2,
    backgroundColor: withOpacity(th.colors.accent, 0.1),
    borderWidth: borders.thin,
    borderColor: withOpacity(th.colors.accent, 0.3),
    borderRadius: th.radius.md,
    alignItems: 'center',
  },
  activateBtnText: { fontSize: typography.sm, color: th.colors.accent, fontWeight: typography.medium },
  dupStageBtn: {
    paddingVertical: spacing.sm + 2,
    borderRadius: th.radius.md,
    borderWidth: borders.thin,
    borderColor: th.colors.border,
    alignItems: 'center',
  },
  dupStageBtnText: { fontSize: typography.sm, color: th.colors.mutedLight, fontWeight: typography.medium },
  deleteStageBtn: {
    paddingVertical: spacing.sm + 2,
    borderRadius: th.radius.md,
    borderWidth: borders.thin,
    borderColor: withOpacity(th.colors.red, 0.3),
    alignItems: 'center',
  },
  deleteStageBtnText: { fontSize: typography.sm, color: th.colors.red, fontWeight: typography.medium },
});
