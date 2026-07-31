import { useState, useEffect, useRef, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, Keyboard,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Reanimated, { useAnimatedRef } from 'react-native-reanimated';
import Sortable from 'react-native-sortables';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../store/useStore';
import { spacing, textStyles, withOpacity } from '../theme';
import { useTheme, useThemedStyles } from '../useTheme';
import { sessionStats } from '../utils/sessionStats';
import DragSheet from '../components/DragSheet';
import StageSelector from '../components/ui/StageSelector';
import SegmentedControl from '../components/ui/SegmentedControl';
import StepField from '../components/ui/StepField';
import { ArrowIcon, MenuIcon, DragIcon, PencilIcon, CheckIcon, LockIcon } from '../components/ui/EditorIcons';
import { SORTABLE_PROPS } from '../components/ui/sortable';
import { isStageLocked } from '../../../src/utils/stageLocks';
import { clientStageIndex } from '../../../src/utils/stageProgress';

// SesionHeader / "Editar Programa" (210:2819) — alto exacto de Figma.
const HEADER_H = 64;
// Ancho del botón lápiz/check de la cabecera (y de su contrapeso invisible).
const HEADER_EDIT_W = 16;
// Gap entre tarjetas de sesión (space/sm). Lo aplica `Sortable.Grid` como
// `rowGap`: necesita conocerlo para colocar los huecos.
const CARD_GAP = spacing.sm;

// ─── Tarjeta de sesión ────────────────────────────────────────────────────────
// Sesion Card / "Sesion card editor de programa" (210:3152) con dos cambios
// pedidos: el eyebrow "SESIÓN A" se sustituye por la letra delante del nombre, y
// se antepone un asa de arrastre.
//
// El reordenado lo lleva `react-native-sortables` (ver la lista más abajo): el
// asa solo tiene que envolverse en `Sortable.Handle`.

function SessionCard({ label, name, meta, onPress }) {
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);

  return (
    <View style={styles.sesCard}>
      <Sortable.Handle style={styles.dragHandle}>
        <DragIcon color={th.colors.mutedLight} />
      </Sortable.Handle>
      <TouchableOpacity style={styles.sesBody} onPress={onPress} activeOpacity={0.7}>
        {/* La letra acompaña al bloque entero (nombre + meta), centrada contra
            él — no es un prefijo del nombre. */}
        <Text style={styles.sesLetter}>{label}</Text>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.sesName} numberOfLines={1}>{name}</Text>
          <Text style={styles.sesMeta} numberOfLines={1}>{meta}</Text>
        </View>
        <ArrowIcon size={18} color={th.colors.accent} />
      </TouchableOpacity>
    </View>
  );
}

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
  const clients               = useStore((s) => s.clients);
  const clientSync            = useStore((s) => s.clientSync);
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
  const reorderSessionsInStage = useStore((s) => s.reorderSessionsInStage);
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
  const [editingName, setEditingName]           = useState(false);
  const [selectedStageIdx, setSelectedStageIdx] = useState(activeProgram?.currentStageIndex ?? 0);
  const [stageSheetOpen, setStageSheetOpen]     = useState(false);
  const [menuOpen, setMenuOpen]                 = useState(false);

  const selectedStage = hasStages ? (activeProgram?.stages?.[selectedStageIdx] ?? null) : null;
  const [stageName, setStageName] = useState(selectedStage?.name ?? '');

  // Ref del ScrollView para el autoscroll de la lista reordenable.
  const scrollRef = useAnimatedRef();

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
    // `nameValue` solo es fuente de verdad mientras el título está en edición;
    // fuera de ahí el nombre se pinta del store y compararlo daría falsos
    // positivos (p. ej. si la pantalla montó antes de resolver el programa).
    if (editingName && nameValue.trim() !== (activeProgram?.name ?? '')) return true;
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
  }, [navigation, editingId, nameValue, editingName, stageName, selectedStage, activeProgram]);

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

  // ── Drag de sesiones ──────────────────────────────────────────────────────
  // Lo lleva `Sortable.Grid` (react-native-sortables): el orden pintado no
  // cambia durante el gesto, cada tarjeta se posiciona con un transform que vive
  // en el hilo de UI, y al soltar la librería reordena ahí mismo. El orden del
  // store solo se escribe en `onDragEnd`, cuando las posiciones ya coinciden.
  const sortableSessions = editorDays
    .map(({ sessionTemplateId: id }) => ({ id, template: userPrograms[id] ?? sessionTemplates[id] }))
    .filter((s) => s.template);

  function handleReorder({ data }) {
    reorderSessionsInStage(
      editingId,
      hasStages ? selectedStageIdx : null,
      data.map((s) => s.id),
    );
  }

  function commitName() {
    setEditingName(false);
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

  // Etapa activa REAL. En el móvil del entrenador la del programa es solo la que
  // él activó; el cliente puede haber avanzado por su cuenta. En el del cliente
  // no hay ficha de cliente que consultar y se cae a la del programa, que ahí sí
  // es la suya.
  const editedClient        = activeProgram.clientId ? clients?.[activeProgram.clientId] : null;
  const activeStageIdx      = clientStageIndex(editedClient, activeProgram);
  const isStageActive       = selectedStageIdx === activeStageIdx;
  const selectedStageLocked = isStageLocked(activeProgram, selectedStageIdx, clientSync);
  // Poner y quitar candados es cosa del entrenador: en el móvil del cliente el
  // control no aparece (si no, se abriría sus propias etapas). Y solo por
  // delante de donde está — encerrarle fuera de la etapa que entrena no tiene
  // sentido, e `isStageLocked` lo ignoraría igualmente.
  const isTrainerProgram    = !!clientSync?.slotId
    && !!clientSync.trainerProgramIds?.includes(activeProgram.id);
  const canLockStage        = !isTrainerProgram
    && selectedStageIdx > 0
    && selectedStageIdx > activeStageIdx;

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      {/* ── SesionHeader / "Editar Programa" (210:2819) ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} style={styles.headerSide}>
          <ArrowIcon size={20} color={th.colors.onAccent} back />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerEyebrow} numberOfLines={1}>
            {isFromClients ? t('editor.titleEditClient') : t('editor.titleEdit')}
          </Text>
          <View style={styles.headerTitleRow}>
            <View style={styles.headerTitleSpacer} />
            {editingName ? (
              <TextInput
                autoFocus
                style={styles.headerTitleInput}
                value={nameValue}
                onChangeText={setNameValue}
                onBlur={commitName}
                onSubmitEditing={commitName}
                placeholder={t('editor.programNamePlaceholder')}
                placeholderTextColor={withOpacity(th.colors.onAccent, 0.4)}
                returnKeyType="done"
              />
            ) : (
              <Text
                style={styles.headerTitle}
                numberOfLines={1}
                onPress={() => { setNameValue(activeProgram.name ?? ''); setEditingName(true); }}
                suppressHighlighting
              >
                {activeProgram.name ?? ''}
              </Text>
            )}
            <TouchableOpacity
              hitSlop={10}
              style={styles.headerEditBtn}
              onPress={() => {
                if (editingName) commitName();
                else { setNameValue(activeProgram.name ?? ''); setEditingName(true); }
              }}
            >
              {editingName
                ? <CheckIcon  size={16} color={th.colors.onAccent} />
                : <PencilIcon size={15} color={th.colors.onAccent} />}
            </TouchableOpacity>
          </View>
        </View>

        {/* El ⋮ solo tiene sentido sin etapas (única acción: convertir a etapas);
            con etapas se deja el hueco para que el título siga centrado. */}
        {hasStages ? (
          <View style={styles.headerSide} />
        ) : (
          <TouchableOpacity onPress={() => setMenuOpen(true)} hitSlop={10} style={styles.headerSide}>
            <MenuIcon size={26} color={th.colors.onAccent} />
          </TouchableOpacity>
        )}
      </View>

      {/* Scrollable content */}
      <Reanimated.ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + spacing.xxl }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Resumen (Exercice editor elements / Resumen) ── */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTag}>{t('exerciseEditor.summaryTitle')}</Text>
          <Text style={styles.summaryMain}>{summaryLine}</Text>
        </View>

        {/* ── Etapas ── */}
        {hasStages && (
          <View style={styles.section}>
            <Text style={styles.secTitle}>{t('editor.sectionStages').toUpperCase()}</Text>
            <StageSelector
              stages={activeProgram.stages.map((stage, idx) => ({
                id:     stage.id ?? String(idx),
                name:   stage.name,
                // El candado solo se pinta en el móvil del cliente: para el
                // entrenador `isStageLocked` siempre es false (no tiene slot).
                locked: isStageLocked(activeProgram, idx, clientSync),
                meta:   t('editor.cyclesShort', { count: stage.durationWeeks ?? 0 }),
              }))}
              value={activeProgram.stages[selectedStageIdx]?.id ?? String(selectedStageIdx)}
              onChange={(id) => {
                const idx = activeProgram.stages.findIndex((s, i) => (s.id ?? String(i)) === id);
                if (idx < 0) return;
                // Segunda pulsación sobre la etapa ya activa → abre el modal.
                if (idx === selectedStageIdx) setStageSheetOpen(true);
                else setSelectedStageIdx(idx);
              }}
              onAdd={handleAddStage}
            />
            <Text style={styles.stageHint}>{t('editor.stageTapHint')}</Text>
          </View>
        )}

        {!hasStages && (
          <Text style={styles.stageHint}>{t('editor.changesHint')}</Text>
        )}

        {/* ── Sesiones de la etapa seleccionada ── */}
        <View style={styles.section}>
          <Text style={styles.secTitle}>
            {(hasStages && selectedStage
              ? t('editor.sessionsOf', { stage: selectedStage.name })
              : t('editor.sectionSessions')).toUpperCase()}
          </Text>

          <Sortable.Grid
            {...SORTABLE_PROPS}
            data={sortableSessions}
            keyExtractor={(s) => s.id}
            rowGap={CARD_GAP}
            scrollableRef={scrollRef}
            onDragEnd={handleReorder}
            renderItem={({ item: { id, template } }) => {
              const stats = sessionStats(template, allExercises);
              return (
                <SessionCard
                  label={template.label ?? ''}
                  name={template.name ?? ''}
                  meta={stats.minutes > 0
                    ? t('editor.sessionMeta',       { ex: stats.exercises, sets: stats.sets, min: stats.minutes })
                    : t('editor.sessionMetaNoTime', { ex: stats.exercises, sets: stats.sets })}
                  onPress={() => navigation.navigate('SessionEditor', {
                    templateId: id,
                    programId:  editingId,
                    stageIdx:   hasStages ? selectedStageIdx : null,
                  })}
                />
              );
            }}
          />

          <TouchableOpacity
            style={styles.addSessionBtn}
            onPress={() => addSessionToProgram(editingId, hasStages ? selectedStageIdx : null)}
            activeOpacity={0.7}
          >
            <Text style={styles.addSessionBtnText}>
              {hasStages && selectedStage
                ? <>
                    {t('editor.addSessionPrefix')}
                    <Text style={styles.addSessionBtnStage}>{selectedStage.name}</Text>
                  </>
                : t('editor.addSession')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Guardar y cerrar (Buttons 388:2676) ── */}
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.85}>
          <Text style={styles.saveBtnText}>{t('editor.saveProgram')}</Text>
        </TouchableOpacity>

      </Reanimated.ScrollView>

      {/* ── Menú "···" del header ── */}
      <DragSheet visible={menuOpen} onClose={() => setMenuOpen(false)} title={t('editor.menuTitle')}>
        <TouchableOpacity
          style={styles.menuRow}
          onPress={() => { setMenuOpen(false); handleAddStage(); }}
          activeOpacity={0.7}
        >
          <Text style={styles.menuRowText}>{t('editor.convertToStages')}</Text>
          <ArrowIcon size={14} color={th.colors.mutedLight} />
        </TouchableOpacity>
      </DragSheet>

      {/* ── Stage settings sheet ── */}
      <DragSheet
        visible={stageSheetOpen}
        onClose={() => { commitStageName(); setStageSheetOpen(false); }}
        title={t('editor.stageSheetTitle')}
      >
        {selectedStage && (
          <View style={styles.sheetBody}>

            <View>
              <Text style={styles.sheetLabel}>{t('editor.stageNameLabel')}</Text>
              <TextInput
                style={styles.sheetInput}
                value={stageName}
                onChangeText={setStageName}
                onBlur={commitStageName}
                onSubmitEditing={commitStageName}
                placeholder={t('editor.stageName')}
                placeholderTextColor={th.colors.mutedLight}
                returnKeyType="done"
              />
            </View>

            <View>
              <Text style={styles.sheetLabel}>{t('editor.stageDurationLabel')}</Text>
              <StepField
                horizontal dark
                label={t('editor.stageWeeksUnit')}
                value={selectedStage.durationWeeks ?? 4}
                onChange={(v) => updateStage(editingId, selectedStageIdx, { durationWeeks: v })}
                min={1}
                max={52}
              />
            </View>

            <View>
              <Text style={styles.sheetLabel}>{t('editor.stageStateLabel')}</Text>
              {isStageActive ? (
                <View style={styles.stateRow}>
                  <View style={{ flex: 1, minWidth: 0, gap: spacing.xs }}>
                    <Text style={styles.stateTitle}>{t('editor.stageIsActive')}</Text>
                    <Text style={styles.stateHint}>{t('editor.stageActiveHint')}</Text>
                  </View>
                  <Text style={styles.activeBadge}>{t('editor.stageActiveBadge')}</Text>
                </View>
              ) : selectedStageLocked ? (
                // Bloqueada por el entrenador: sin botón, porque `setCurrentStage`
                // lo rechazaría igual y un botón que no hace nada es peor que
                // ninguno.
                <View style={styles.stateRow}>
                  <LockIcon size={14} color={th.colors.muted} />
                  <Text style={styles.stateHint}>{t('home.stageLockedShort')}</Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.activateBtn}
                  activeOpacity={0.8}
                  onPress={() => {
                    setCurrentStage(editingId, selectedStageIdx);
                    showToast(t('editor.toastStageActivated', { name: selectedStage.name }), 2200, 'success');
                  }}
                >
                  <Text style={styles.activateBtnText}>{t('editor.stageActivateBtn')}</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Acceso: el candado que el cliente ve en su móvil. Solo por
                delante de donde está — ver `canLockStage`. */}
            {canLockStage && (
              <View>
                <Text style={styles.sheetLabel}>{t('editor.stageAccessLabel')}</Text>
                <SegmentedControl
                  options={[
                    { id: 'open',   label: t('editor.stageAccessOpen') },
                    { id: 'locked', label: t('editor.stageAccessLocked') },
                  ]}
                  value={selectedStage.locked ? 'locked' : 'open'}
                  onChange={(id) => updateStage(editingId, selectedStageIdx, { locked: id === 'locked' })}
                />
                <Text style={[styles.stateHint, { marginTop: spacing.sm }]}>
                  {t(selectedStage.locked ? 'editor.stageAccessLockedHint' : 'editor.stageAccessOpenHint')}
                </Text>
              </View>
            )}

            {/* Mismo par de botones que cierra el editor de ejercicio:
                secundario `surface2` + destructivo `tint/red-30`. */}
            <View style={styles.sheetBtnRow}>
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
                activeOpacity={0.8}
              >
                <Text style={styles.dupStageBtnText}>{t('editor.stageDuplicateBtn')}</Text>
              </TouchableOpacity>

              {activeProgram.stages.length > 1 && (
                <TouchableOpacity style={styles.deleteStageBtn} onPress={handleDeleteStage} activeOpacity={0.8}>
                  <Text style={styles.deleteStageBtnText}>{t('editor.stageDeleteBtn')}</Text>
                </TouchableOpacity>
              )}
            </View>

          </View>
        )}
      </DragSheet>

    </SafeAreaView>
  );
}

const makeStyles = (th) => StyleSheet.create({
  container: { flex: 1, backgroundColor: th.colors.bg },

  // ── SesionHeader / "Editar Programa" (210:2819) ──
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    height:            HEADER_H,
    marginHorizontal:  spacing.lg,   // margen de página del frame (x=15)
    marginTop:         spacing.lg,
    backgroundColor:   th.colors.accent,
    borderRadius:      th.radius.md,
    // Figma pide `space/sm`; sube a `space/lg` porque en dispositivo la flecha
    // y el ⋮ quedaban pegados al borde de la barra.
    paddingHorizontal: spacing.lg,
    overflow:          'hidden',
  },
  headerSide:   { width: 26, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, alignItems: 'center', gap: spacing.xs, minWidth: 0 },
  // Figma pinta el eyebrow en `color/muted` sobre el lima, no en onAccent.
  // Tipografía `text/btn-action` (Black) al tamaño de `spacing-tag` (10) y sin
  // tracking: sobre el lima pedía más peso, no más aire (QA).
  headerEyebrow: {
    ...textStyles.btnAction,
    fontSize:      10,
    // Un punto de tracking, a medio camino entre el 0 de `btn-action` y el 2 de
    // `spacing-tag`: sin nada de aire se leía apretado (QA).
    letterSpacing: 1,
    color:         th.colors.muted,
    textAlign:     'center',
    textTransform: 'uppercase',
  },
  // El lápiz descentraba el nombre: la fila centra el grupo entero, así que
  // lleva un contrapeso invisible del mismo ancho al otro lado.
  headerTitleSpacer: { width: HEADER_EDIT_W },
  headerEditBtn:     { width: HEADER_EDIT_W, alignItems: 'center' },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.sm,
    maxWidth:      '100%',
  },
  headerTitle: {
    ...textStyles.hero,
    color:      th.colors.onAccent,
    textAlign:  'center',
    lineHeight: 22,
    flexShrink: 1,
  },
  headerTitleInput: {
    ...textStyles.hero,
    color:      th.colors.onAccent,
    textAlign:  'center',
    lineHeight: 22,
    padding:    0,
    flexShrink: 1,
    minWidth:   80,
  },

  // ── Contenido ──
  // Padding de página `space/lg` y gap `space/md`, ambos del frame 210:2864.
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop:        spacing.md,
    gap:               spacing.md,
  },
  section:  { gap: spacing.xs2 },
  secTitle: {
    ...textStyles.spacingTag,
    color:      th.colors.mutedLight,
    paddingTop: spacing.md,
  },
  stageHint: { ...textStyles.subtitle, color: th.colors.muted },

  // ── Resumen ── (sin borde: en Figma es solo relleno tint/accent-10)
  summaryCard: {
    backgroundColor:   th.tint.accent10,
    borderRadius:      th.radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical:   spacing.md,
    gap:               spacing.sm,
  },
  summaryTag:  { ...textStyles.spacingTag, color: th.colors.accent },
  summaryMain: { ...textStyles.cardType,   color: th.colors.text },

  // ── Tarjeta de sesión ──
  // paddingLeft `space/sm`: los puntos del asa empiezan a 9px dentro de su caja
  // de 26, así que 6+9 deja el contenido en los 15px (`space/lg`) de Figma.
  sesCard: {
    flexDirection:    'row',
    alignItems:       'center',
    backgroundColor:  th.colors.surface,
    borderRadius:     th.radius.md,
    paddingLeft:      spacing.sm,
    paddingRight:     spacing.lg,
    paddingVertical:  spacing.md,
  },
  dragHandle: {
    width:          26,
    alignSelf:      'stretch',
    alignItems:     'center',
    justifyContent: 'center',
  },
  sesBody: {
    flex:          1,
    minWidth:      0,
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.md,
  },
  // Siempre `color/accent` del tema (no el color por sesión de day1…day6).
  sesLetter: { ...textStyles.hero, color: th.colors.accent, textAlign: 'center', minWidth: 16 },
  sesName:   { fontFamily: 'Inter_900Black', fontSize: 12, fontWeight: '900', color: th.colors.text },
  sesMeta:   { ...textStyles.subtitle, color: th.colors.mutedLight },

  // "+ Añadir sesión a X" — texto plano, sin caja (decisión de QA sobre el
  // botón outline de Figma).
  addSessionBtn:      { alignItems: 'center', paddingVertical: spacing.md },
  addSessionBtnText:  { ...textStyles.cardType, color: th.tint.accent50 },
  addSessionBtnStage: { color: th.colors.accent },

  // ── Guardar programa (Buttons 388:2676) ──
  saveBtn: {
    height:          44,
    borderRadius:    th.radius.md,
    backgroundColor: '#b8ff00', // literal de Figma, distinto de color/accent
    alignItems:      'center',
    justifyContent:  'center',
  },
  saveBtnText: { ...textStyles.cardType, color: th.colors.onAccent },

  // ── Menú "···" ──
  menuRow: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    gap:               spacing.xl,
    backgroundColor:   th.colors.surface2,
    borderRadius:      th.radius.sm,
    padding:           spacing.md,
    marginBottom:      spacing.md,
  },
  menuRowText: { ...textStyles.cardType, color: th.colors.text },

  // Stage sheet
  sheetBody: {
    gap: spacing.lg,
    paddingBottom: spacing.sm,
  },
  // Etiqueta de paso dentro de una hoja: igual que las de sección del editor de
  // ejercicio (`text/spacing-tag` mutedLight en mayúsculas).
  sheetLabel: {
    ...textStyles.spacingTag,
    color:         th.colors.mutedLight,
    textTransform: 'uppercase',
    marginBottom:  spacing.sm,
  },
  // Dentro de una hoja el fondo YA es `surface`, así que los campos van sobre
  // `color/app` para que se lean — mismo criterio que las hojas del editor de
  // ejercicio.
  sheetInput: {
    ...textStyles.cardType,
    color:             th.colors.text,
    backgroundColor:   th.colors.bg,
    borderRadius:      th.radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.md,
  },
  stateRow: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing.md,
    backgroundColor:   th.colors.bg,
    borderRadius:      th.radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.sm,
  },
  activeBadge: {
    ...textStyles.spacingTag,
    color:             th.colors.onAccent,
    backgroundColor:   th.colors.accent,
    borderRadius:      th.radius.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical:   spacing.xs2,
    overflow:          'hidden',
  },
  stateTitle: { ...textStyles.cardType, color: th.colors.text },
  stateHint:  { ...textStyles.tag,      color: th.colors.mutedLight, lineHeight: 14 },
  activateBtn: {
    paddingVertical: spacing.md,
    backgroundColor: th.colors.accent,
    borderRadius:    th.radius.sm,
    alignItems:      'center',
  },
  activateBtnText: { ...textStyles.cardType, color: th.colors.onAccent },
  sheetBtnRow: { flexDirection: 'row', gap: spacing.sm },
  dupStageBtn: {
    flex:            1,
    paddingVertical: spacing.md,
    borderRadius:    th.radius.sm,
    backgroundColor: th.colors.surface2,
    alignItems:      'center',
  },
  dupStageBtnText: { ...textStyles.cardType, color: th.colors.text },
  // Sin fondo, solo texto (QA): mismo tratamiento que "Descartar sesión".
  deleteStageBtn: {
    flex:            1,
    paddingVertical: spacing.md,
    alignItems:      'center',
  },
  deleteStageBtnText: { ...textStyles.cardType, color: th.tint.red50 },
});
