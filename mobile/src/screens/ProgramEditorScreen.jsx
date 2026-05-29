import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, SafeAreaView, Alert, Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../store/useStore';
import { colors, spacing, typography, radius, borders, withOpacity } from '../theme';
import DayEditorCard from '../components/editor/DayEditorCard';

export default function ProgramEditorScreen({ navigation, route }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const programs              = useStore((s) => s.programs);
  const profile               = useStore((s) => s.profile);
  const ui                    = useStore((s) => s.ui);
  const beginEditSession      = useStore((s) => s.beginEditSession);
  const addSessionToProgram   = useStore((s) => s.addSessionToProgram);
  const removeSessionFromProgram = useStore((s) => s.removeSessionFromProgram);
  const renameProgram              = useStore((s) => s.renameProgram);
  const markProgramDirtyForClients = useStore((s) => s.markProgramDirtyForClients);
  const addStageToProgram     = useStore((s) => s.addStageToProgram);
  const removeStageFromProgram = useStore((s) => s.removeStageFromProgram);
  const updateStage           = useStore((s) => s.updateStage);
  const setCurrentStage       = useStore((s) => s.setCurrentStage);
  const showToast             = useStore((s) => s.showToast);

  const editingId     = ui._editingProgramId ?? profile.activeProgramId;
  const activeProgram = programs[editingId];
  const isFromClients = !!ui._editingProgramId;
  const hasStages     = (activeProgram?.stages?.length ?? 0) > 0;

  const [nameValue, setNameValue]               = useState(activeProgram?.name ?? '');
  const [selectedStageIdx, setSelectedStageIdx] = useState(activeProgram?.currentStageIndex ?? 0);

  const selectedStage = hasStages ? (activeProgram?.stages?.[selectedStageIdx] ?? null) : null;
  const [stageName, setStageName]   = useState(selectedStage?.name ?? '');
  const [stageWeeks, setStageWeeks] = useState(String(selectedStage?.durationWeeks ?? 4));

  useEffect(() => {
    beginEditSession();
  }, []);

  useEffect(() => {
    if (selectedStage) {
      setStageName(selectedStage.name);
      setStageWeeks(String(selectedStage.durationWeeks ?? 4));
    }
  }, [selectedStageIdx, activeProgram?.stages?.length]);

  useEffect(() => {
    if (hasStages) {
      const max = (activeProgram?.stages?.length ?? 1) - 1;
      if (selectedStageIdx > max) setSelectedStageIdx(max);
    }
  }, [activeProgram?.stages?.length]);

  if (!activeProgram) return null;

  const editorDays = hasStages
    ? (activeProgram.stages[selectedStageIdx]?.days ?? [])
    : (activeProgram.days ?? []);

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

  function commitStageWeeks() {
    const n = parseInt(stageWeeks);
    if (!isNaN(n) && n > 0 && n !== selectedStage?.durationWeeks) {
      updateStage(editingId, selectedStageIdx, { durationWeeks: n });
    } else {
      setStageWeeks(String(selectedStage?.durationWeeks ?? 4));
    }
  }

  function handleAddStage() {
    const wasStaged = hasStages;
    addStageToProgram(editingId);
    const newIdx = wasStaged ? (activeProgram?.stages?.length ?? 1) : 1;
    setSelectedStageIdx(newIdx);
    showToast(t('editor.toastStageAdded'));
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
            removeStageFromProgram(editingId, selectedStageIdx);
            setSelectedStageIdx(Math.max(0, selectedStageIdx - 1));
            showToast(t('editor.toastStageDeleted'));
          },
        },
      ]
    );
  }

  function handleCancel() {
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
    navigation.goBack();
  }

  function handleSave() {
    // Flush any text field that still has focus before saving
    Keyboard.dismiss();
    commitName();
    commitStageName();
    commitStageWeeks();
    // Mark any clients that have this program assigned as needing a re-upload
    markProgramDirtyForClients(editingId);
    useStore.setState((s) => ({ _editSnapshot: null, ui: { ...s.ui, _editingProgramId: null } }));
    navigation.goBack();
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.headerWrap}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleCancel} hitSlop={12} style={styles.backBtn}>
            <Text style={styles.backIcon}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {isFromClients ? t('editor.titleEditClient') : t('editor.titleEdit')}
          </Text>
        </View>
        <View style={styles.programNameWrap}>
          <TextInput
            style={styles.programNameInput}
            value={nameValue}
            onChangeText={setNameValue}
            onBlur={commitName}
            onSubmitEditing={commitName}
            placeholder="Nombre del programa"
            placeholderTextColor={colors.muted2}
            returnKeyType="done"
          />
        </View>
      </View>

      {/* Stage tabs */}
      {hasStages && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.stageTabs}
          contentContainerStyle={styles.stageTabsContent}
        >
          {activeProgram.stages.map((stage, idx) => {
            const isSelected = idx === selectedStageIdx;
            const isActive   = idx === (activeProgram.currentStageIndex ?? 0);
            return (
              <TouchableOpacity
                key={stage.id ?? idx}
                style={[styles.stageTab, isSelected && styles.stageTabActive]}
                onPress={() => setSelectedStageIdx(idx)}
              >
                <Text style={[styles.stageTabText, isSelected && styles.stageTabTextActive]}>
                  {stage.name}
                </Text>
                {isActive && <View style={styles.activeDot} />}
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity style={styles.addStageTab} onPress={handleAddStage}>
            <Text style={styles.addStageTabText}>＋</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* Stage meta row */}
      {hasStages && selectedStage && (
        <View style={styles.stageMeta}>
          <View style={styles.stageFields}>
            <TextInput
              style={styles.stageNameInput}
              value={stageName}
              onChangeText={setStageName}
              onBlur={commitStageName}
              onSubmitEditing={commitStageName}
              placeholder={t('editor.stageName')}
              placeholderTextColor={colors.muted}
              returnKeyType="done"
            />
            <View style={styles.stageWeeksRow}>
              <TextInput
                style={styles.stageWeeksInput}
                value={stageWeeks}
                onChangeText={setStageWeeks}
                onBlur={commitStageWeeks}
                onSubmitEditing={commitStageWeeks}
                keyboardType="numeric"
                returnKeyType="done"
              />
              <Text style={styles.stageWeeksLabel}>{t('editor.stageWeeks')}</Text>
            </View>
          </View>
          <View style={styles.stageActions}>
            {selectedStageIdx !== (activeProgram.currentStageIndex ?? 0) && (
              <TouchableOpacity
                style={styles.activateBtn}
                onPress={() => {
                  setCurrentStage(editingId, selectedStageIdx);
                  showToast(t('editor.toastStageActivated', { name: selectedStage.name }));
                }}
              >
                <Text style={styles.activateBtnText}>{t('editor.stageActivate')}</Text>
              </TouchableOpacity>
            )}
            {activeProgram.stages.length > 1 && (
              <TouchableOpacity style={styles.deleteStageBtn} hitSlop={12} onPress={handleDeleteStage}>
                <Text style={styles.deleteStageBtnText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* Scrollable content */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {!hasStages && (
          <Text style={styles.changesHint}>{t('editor.changesHint')}</Text>
        )}

        {editorDays.map(({ sessionTemplateId }) => (
          <DayEditorCard
            key={sessionTemplateId}
            templateId={sessionTemplateId}
            navigation={navigation}
            onRemove={
              editorDays.length > 1
                ? () => removeSessionFromProgram(editingId, sessionTemplateId)
                : null
            }
          />
        ))}

        <TouchableOpacity
          style={styles.addSessionBtn}
          onPress={() => addSessionToProgram(editingId, hasStages ? selectedStageIdx : null)}
        >
          <Text style={styles.addSessionBtnText}>
            {hasStages ? t('editor.addSessionToStage') : t('editor.addSession')}
          </Text>
        </TouchableOpacity>

        {!hasStages && (
          <TouchableOpacity style={styles.convertToStagesBtn} onPress={handleAddStage}>
            <Text style={styles.convertToStagesBtnText}>{t('editor.convertToStages')}</Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Save button — always accent, matching WorkoutScreen style */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.85}>
          <Text style={styles.saveBtnText}>{t('editor.saveChanges').toUpperCase()}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.discardBtn} onPress={handleCancel}>
          <Text style={styles.discardText}>{t('common.cancel')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  // Header
  headerWrap: {
    borderBottomWidth: borders.thin,
    borderBottomColor: colors.border,
  },
  header: {
    flexDirection: 'row', alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  backBtn: { padding: spacing.xs },
  backIcon: { fontSize: 26, color: colors.muted, lineHeight: 30 },
  headerTitle: {
    fontSize: typography.base, fontWeight: typography.bold,
    letterSpacing: 0.5, color: colors.text,
  },
  programNameWrap: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    paddingTop: spacing.xs,
  },
  programNameInput: {
    fontSize: typography.base,
    fontWeight: typography.bold,
    color: colors.text,
    backgroundColor: colors.surface2,
    borderWidth: borders.thin,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },

  // Stage tabs
  stageTabs: {
    borderBottomWidth: borders.thin, borderBottomColor: colors.border,
    backgroundColor: colors.surface, flexGrow: 0,
  },
  stageTabsContent: { paddingHorizontal: spacing.xs },
  stageTab: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm + 2,
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  stageTabActive: { borderBottomColor: colors.accent },
  stageTabText: { fontSize: typography.sm, color: colors.muted },
  stageTabTextActive: { color: colors.accent, fontWeight: typography.medium },
  activeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accent },
  addStageTab: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, justifyContent: 'center' },
  addStageTabText: { fontSize: 18, color: colors.muted, lineHeight: 22 },

  // Stage meta
  stageMeta: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: spacing.lg,
    paddingVertical:   spacing.sm,
    backgroundColor:   colors.surface2,
    borderBottomWidth: borders.thin,
    borderBottomColor: colors.border,
    gap:               spacing.sm,
  },
  stageFields: {
    flex:          1,
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.sm,
  },
  stageNameInput: {
    flex:              1,
    fontSize:          typography.sm,
    fontWeight:        typography.medium,
    color:             colors.text,
    backgroundColor:   colors.surface,
    borderWidth:       borders.thin,
    borderColor:       colors.border,
    borderRadius:      radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical:   spacing.xs + 2,
  },
  stageWeeksRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  stageWeeksInput: {
    width:           44,
    textAlign:       'center',
    fontSize:        typography.sm,
    color:           colors.text,
    backgroundColor: colors.surface,
    borderWidth:     borders.thin,
    borderColor:     colors.border,
    borderRadius:    radius.sm,
    paddingVertical: spacing.xs + 2,
  },
  stageWeeksLabel: { fontSize: typography.xs, color: colors.muted },
  stageActions: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.sm,
    marginLeft:    spacing.sm,
  },
  activateBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical:   4,
    backgroundColor:   withOpacity(colors.accent, 0.1),
    borderWidth:       borders.thin,
    borderColor:       withOpacity(colors.accent, 0.3),
    borderRadius:      radius.sm,
  },
  activateBtnText: { fontSize: typography.xs, color: colors.accent },
  deleteStageBtn: {
    width:           28,
    height:          28,
    alignItems:      'center',
    justifyContent:  'center',
    borderRadius:    radius.sm,
    backgroundColor: withOpacity(colors.red ?? '#ef4444', 0.08),
    borderWidth:     borders.thin,
    borderColor:     withOpacity(colors.red ?? '#ef4444', 0.25),
  },
  deleteStageBtnText: { fontSize: 13, color: colors.muted2 },

  // Content
  scrollContent: {
    paddingHorizontal: spacing.xl, paddingTop: spacing.md, gap: spacing.sm,
  },
  changesHint: { fontSize: typography.xs, color: colors.muted, lineHeight: 18, marginBottom: 4 },
  addSessionBtn: {
    paddingVertical: spacing.md + 2,
    borderRadius: radius.md,
    borderWidth: 1, borderStyle: 'dashed',
    borderColor: withOpacity(colors.accent, 0.4),
    alignItems: 'center',
    backgroundColor: withOpacity(colors.accent, 0.04),
    marginTop: 4,
  },
  addSessionBtnText: { fontSize: typography.base, color: colors.accent },
  convertToStagesBtn: {
    paddingVertical: spacing.md, borderRadius: radius.md,
    borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border,
    alignItems: 'center', marginTop: 4,
  },
  convertToStagesBtnText: { fontSize: typography.sm, color: colors.muted },

  // Footer — matches WorkoutScreen save/discard pattern
  footer: {
    paddingHorizontal: spacing.xl, paddingTop: spacing.md,
    backgroundColor: colors.bg,
    borderTopWidth: borders.thin, borderTopColor: colors.border,
  },
  saveBtn: {
    borderRadius: radius.md, paddingVertical: spacing.lg,
    alignItems: 'center', backgroundColor: colors.accent,
  },
  saveBtnText: {
    fontSize: typography.xl, fontWeight: typography.heavy,
    color: colors.onAccent, letterSpacing: 1.5,
  },
  discardBtn: { alignItems: 'center', paddingVertical: spacing.md },
  discardText: { fontSize: typography.base, color: colors.muted },
});
