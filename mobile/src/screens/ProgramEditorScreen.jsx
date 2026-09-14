import { useState, useEffect, useMemo } from 'react';
import { View, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Text, TextInput } from '../components/ui/Text';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Reanimated, { useAnimatedRef } from 'react-native-reanimated';
import Sortable from 'react-native-sortables';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../store/useStore';
import { ownerClient } from '../utils/programOwnership';
import { spacing, textStyles, withOpacity } from '../theme';
import { useTheme, useThemedStyles } from '../useTheme';
import { sessionStats } from '../utils/sessionStats';
import DragSheet from '../components/DragSheet';
import StageSelector from '../components/ui/StageSelector';
import SegmentedControl from '../components/ui/SegmentedControl';
import StepField from '../components/ui/StepField';
import { ArrowIcon, DragIcon, LockIcon, CheckIcon } from '../components/ui/EditorIcons';
import ScreenHeader from '../components/ui/ScreenHeader';
import { SORTABLE_PROPS } from '../components/ui/sortable';
import { isStageLocked, isTrainerProgram } from '../utils/stageLocks';
import { describeRx } from '../utils/stageRx';
import { clientStageIndex } from '../utils/stageProgress';
import { useEditorExit } from '../hooks/useEditorExit';

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
  const sessionTemplates      = useStore((s) => s.sessionTemplates);
  const exerciseLibrary       = useStore((s) => s.exerciseLibrary);
  const customExercises       = useStore((s) => s.customExercises);
  const profile               = useStore((s) => s.profile);
  const clients               = useStore((s) => s.clients);
  const clientSync            = useStore((s) => s.clientSync);
  const ui                    = useStore((s) => s.ui);
  const addSessionToProgram   = useStore((s) => s.addSessionToProgram);
  const renameProgram              = useStore((s) => s.renameProgram);
  const removeStageFromProgram = useStore((s) => s.removeStageFromProgram);
  const duplicateStageInProgram = useStore((s) => s.duplicateStageInProgram);
  const updateStage           = useStore((s) => s.updateStage);
  const setCurrentStage       = useStore((s) => s.setCurrentStage);
  const reorderSessionsInStage = useStore((s) => s.reorderSessionsInStage);
  const showToast             = useStore((s) => s.showToast);
  const { commit, done }      = useEditorExit(navigation);

  const editingId     = ui._editingProgramId ?? profile.activeProgramId;
  const activeProgram = programs[editingId];
  const isFromClients = !!ui._editingProgramId;

  const allExercises = useMemo(
    () => ({ ...exerciseLibrary, ...customExercises }),
    [exerciseLibrary, customExercises],
  );

  const [nameValue, setNameValue]               = useState(activeProgram?.name ?? '');
  const [editingName, setEditingName]           = useState(false);
  const [selectedStageIdx, setSelectedStageIdx] = useState(activeProgram?.currentStageIndex ?? 0);
  const [stageSheetOpen, setStageSheetOpen]     = useState(false);

  const selectedStage = activeProgram?.stages?.[selectedStageIdx] ?? null;
  const [stageName, setStageName] = useState(selectedStage?.name ?? '');

  // Ref del ScrollView para el autoscroll de la lista reordenable.
  const scrollRef = useAnimatedRef();

  useEffect(() => {
    if (selectedStage) setStageName(selectedStage.name);
  }, [selectedStageIdx, activeProgram?.stages?.length]);

  useEffect(() => {
    const max = (activeProgram?.stages?.length ?? 1) - 1;
    if (selectedStageIdx > max) setSelectedStageIdx(max);
  }, [activeProgram?.stages?.length]);


  // `_editingProgramId` es global y sale sucio: salir sin cambios no pasa por
  // `restoreSnapshot` y el id se quedaba puesto, así que quien entrase después
  // por el fallback —Onboarding— heredaba este programa. Se suelta al
  // desmontar, no antes: hacerlo con la pantalla en pantalla la repintaría con
  // otro programa durante la animación de salida.
  useEffect(() => () => {
    useStore.setState((s) => ({ ui: { ...s.ui, _editingProgramId: null } }));
  }, []);

  if (!activeProgram) return null;

  const editorDays = activeProgram.stages?.[selectedStageIdx]?.days ?? activeProgram.days ?? [];

  // ── Program summary ─────────────────────────────────────────────────────────
  // Todo programa tiene etapas, así que "periodizado" ya no es "¿tiene etapas?"
  // sino "¿tiene más de una?". Con una sola, el resumen sigue siendo el simple
  // de siempre: contar "1 etapa · 0 ciclos" no le dice nada a nadie.
  const isPeriodized = (activeProgram.stages?.length ?? 0) > 1;
  // Una etapa sin límite hace el total indeterminado: se suman las que sí lo
  // tienen y se marca con "+".
  const hasOpenStage = (activeProgram.stages ?? []).some((s) => s.durationWeeks == null);
  const summaryLine = isPeriodized
    ? t(hasOpenStage ? 'editor.programSummaryOpen' : 'editor.programSummary', {
        stages:   activeProgram.stages.length,
        weeks:    activeProgram.stages.reduce((a, s) => a + (s.durationWeeks ?? 0), 0),
        sessions: activeProgram.stages.reduce((a, s) => a + (s.days?.length ?? 0) * (s.durationWeeks ?? 0), 0),
      })
    : t('editor.programSummarySimple', {
        sessions: editorDays.length,
        sets: editorDays.reduce((a, { sessionTemplateId }) => {
          const template = sessionTemplates[sessionTemplateId];
          return a + sessionStats(template, allExercises).sets;
        }, 0),
      });

  // ── Drag de sesiones ──────────────────────────────────────────────────────
  // Lo lleva `Sortable.Grid` (react-native-sortables): el orden pintado no
  // cambia durante el gesto, cada tarjeta se posiciona con un transform que vive
  // en el hilo de UI, y al soltar la librería reordena ahí mismo. El orden del
  // store solo se escribe en `onDragEnd`, cuando las posiciones ya coinciden.
  const sortableSessions = editorDays
    .map(({ sessionTemplateId: id }) => ({ id, template: sessionTemplates[id] }))
    .filter((s) => s.template);

  function handleReorder({ data }) {
    reorderSessionsInStage(
      editingId,
      selectedStageIdx,
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

  // Los dos salen escribiendo lo que hubiera a medias en los campos de texto y
  // marcando a los clientes; lo que cambia es el destino. El chevron sube un
  // nivel —a la vista del programa— sin decir nada, y el check cierra el modo
  // edición entero y se va a Home.
  function handleBack() {
    commitName();
    commitStageName();
    commit();
    navigation.goBack();
  }

  function handleDone() {
    commitName();
    commitStageName();
    done();
  }

  // Etapa activa REAL. En el móvil del entrenador la del programa es solo la que
  // él activó; el cliente puede haber avanzado por su cuenta. En el del cliente
  // no hay ficha de cliente que consultar y se cae a la del programa, que ahí sí
  // es la suya.
  const editedClient        = ownerClient(clients, activeProgram);
  const activeStageIdx      = clientStageIndex(editedClient, activeProgram);
  const isStageActive       = selectedStageIdx === activeStageIdx;
  const selectedStageLocked = isStageLocked(activeProgram, selectedStageIdx, clientSync);
  // Poner y quitar candados es cosa del entrenador sobre el programa de UN
  // cliente: en el móvil del cliente el control no aparece (si no, se abriría
  // sus propias etapas) y en un programa propio no pinta nada — no hay nadie a
  // quien cerrarle la etapa. Y solo por delante de donde está — encerrarle
  // fuera de la etapa que entrena no tiene sentido, e `isStageLocked` lo
  // ignoraría igualmente.
  const fromTrainer         = isTrainerProgram(activeProgram, clientSync);
  const canLockStage        = !fromTrainer
    && !!editedClient
    && selectedStageIdx > 0
    && selectedStageIdx > activeStageIdx;

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      {/* ── SesionHeader / "Editar Programa" (210:2819) ── */}
      <ScreenHeader
        onBack={handleBack}
        eyebrow={isFromClients ? t('editor.titleEditClient') : t('editor.titleEdit')}
        title={activeProgram.name ?? ''}
        placeholder={t('editor.programNamePlaceholder')}
        renaming={editingName}
        draft={nameValue}
        onDraftChange={setNameValue}
        onRenameStart={() => { setNameValue(activeProgram.name ?? ''); setEditingName(true); }}
        onRenameCommit={commitName}
        right={() => (
          <TouchableOpacity onPress={handleDone} hitSlop={12} accessibilityRole="button">
            <CheckIcon size={20} color={th.colors.accent} />
          </TouchableOpacity>
        )}
      />

      {/* Scrollable content */}
      <Reanimated.ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + spacing.xxl }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Resumen (Exercice editor elements / Resumen) ── */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTag}>{t('editor.summaryProgram')}</Text>
          <Text style={styles.summaryMain}>{summaryLine}</Text>
        </View>

        {/* ── Etapas ── */}
        <View style={styles.section}>
          <Text style={styles.secTitle}>{t('editor.sectionStages').toUpperCase()}</Text>
          <StageSelector
            stages={activeProgram.stages.map((stage, idx) => ({
              id:     stage.id ?? String(idx),
              name:   stage.name,
              // El candado solo se pinta en el móvil del cliente: para el
              // entrenador `isStageLocked` siempre es false (no tiene slot).
              locked: isStageLocked(activeProgram, idx, clientSync),
              meta:   stage.durationWeeks == null
                ? t('editor.cyclesOpen')
                : t('editor.cyclesShort', { count: stage.durationWeeks }),
            }))}
            value={activeProgram.stages[selectedStageIdx]?.id ?? String(selectedStageIdx)}
            onChange={(id) => {
              const idx = activeProgram.stages.findIndex((s, i) => (s.id ?? String(i)) === id);
              if (idx < 0) return;
              // Segunda pulsación sobre la etapa ya activa → abre el modal.
              if (idx === selectedStageIdx) setStageSheetOpen(true);
              else setSelectedStageIdx(idx);
            }}
            // El `+` lleva al plan del programa: allí se ve lo que ya hay y
            // desde allí se añade. La hoja de dos filas que bifurcaba entre
            // "etapa nueva" y "planificar bloque" murió con el rediseño — una
            // etapa suelta es el plan con una etapa.
            onAdd={() => navigation.navigate('StagePlanner')}
          />
          <Text style={styles.stageHint}>{t('editor.stageTapHint')}</Text>
        </View>

        {/* ── Sesiones de la etapa seleccionada ── */}
        <View style={styles.section}>
          <Text style={styles.secTitle}>
            {(selectedStage
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
                    stageIdx:   selectedStageIdx,
                  })}
                />
              );
            }}
          />

          <TouchableOpacity
            style={styles.addSessionBtn}
            onPress={() => addSessionToProgram(editingId, selectedStageIdx)}
            activeOpacity={0.7}
          >
            <Text style={styles.addSessionBtnText}>
              {selectedStage
                ? <>
                    {t('editor.addSessionPrefix')}
                    <Text style={styles.addSessionBtnStage}>{selectedStage.name}</Text>
                  </>
                : t('editor.addSession')}
            </Text>
          </TouchableOpacity>
        </View>

      </Reanimated.ScrollView>

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

            {/* Procedencia. Es una etiqueta, no una regla viva: `applyRx` se
                materializó al crear la etapa y editarla a mano manda sobre
                esto. Sin ella, a las tres semanas nadie recuerda qué escalera
                montó. */}
            {selectedStage.rx && describeRx(selectedStage.rx, t).length > 0 && (
              <View>
                <Text style={styles.sheetLabel}>{t('editor.stageFromLabel')}</Text>
                <Text style={styles.stageRxLine}>
                  {describeRx(selectedStage.rx, t).join(' · ')}
                </Text>
              </View>
            )}

            <View>
              <Text style={styles.sheetLabel}>{t('editor.stageDurationLabel')}</Text>
              {/* `durationWeeks: null` = sin límite de ciclos: la etapa no
                  termina sola. El stepper no puede representarlo, así que la
                  opción vive en su propia fila y lo sustituye. */}
              {selectedStage.durationWeeks == null ? (
                <TouchableOpacity
                  style={[styles.noLimitRow, styles.noLimitRowActive]}
                  onPress={() => updateStage(editingId, selectedStageIdx, { durationWeeks: 4 })}
                  activeOpacity={0.7}
                >
                  <Text style={styles.noLimitTextActive}>{t('editor.cyclesNoLimit')}</Text>
                </TouchableOpacity>
              ) : (
                <>
                  <StepField
                    horizontal
                    label={t('editor.stageWeeksUnit')}
                    value={selectedStage.durationWeeks}
                    onChange={(v) => updateStage(editingId, selectedStageIdx, { durationWeeks: v })}
                    min={1}
                    max={52}
                  />
                  <TouchableOpacity
                    style={styles.noLimitRow}
                    onPress={() => updateStage(editingId, selectedStageIdx, { durationWeeks: null })}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.noLimitText}>{t('editor.cyclesNoLimit')}</Text>
                  </TouchableOpacity>
                </>
              )}
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

  // ── Contenido ──
  // Padding de página `space/lg` y gap `space/md`, ambos del frame 210:2864.
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop:        spacing.md,
    gap:               spacing.md,
  },
  section:  { gap: spacing.xs2 },
  secTitle: {
    ...textStyles.caps,
    color:      th.colors.mutedLight,
    paddingTop: spacing.md,
  },
  stageHint: { ...textStyles.body, color: th.colors.mutedLight },

  // ── Resumen ── (sin borde: en Figma es solo relleno tint/accent-10)
  summaryCard: {
    backgroundColor:   th.tint.accent10,
    borderRadius:      th.radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical:   spacing.md,
    gap:               spacing.sm,
  },
  summaryTag:  { ...textStyles.caps, color: th.colors.accent },
  summaryMain: { ...textStyles.bodyStrong, color: th.colors.text },

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
  sesLetter: { ...textStyles.title, color: th.colors.accent, textAlign: 'center', minWidth: 16 },
  sesName:   { ...textStyles.bodyStrong, color: th.colors.text },
  sesMeta:   { ...textStyles.label, color: th.colors.mutedLight },

  // "+ Añadir sesión a X" — texto plano, sin caja (decisión de QA sobre el
  // botón outline de Figma).
  addSessionBtn:      { alignItems: 'center', paddingVertical: spacing.md },
  addSessionBtnText:  { ...textStyles.button, color: th.tint.accent50 },
  addSessionBtnStage: { color: th.colors.accent },

  stageRxLine: { ...textStyles.label, color: th.colors.accent },

  // Stage sheet
  sheetBody: {
    gap: spacing.lg,
    paddingBottom: spacing.sm,
  },
  // Etiqueta de paso dentro de una hoja: igual que las de sección del editor de
  // ejercicio (`text/spacing-tag` mutedLight en mayúsculas).
  sheetLabel: {
    ...textStyles.caps,
    color:         th.colors.mutedLight,
    textTransform: 'uppercase',
    marginBottom:  spacing.sm,
  },
  // "Sin límite de ciclos" — fila propia porque el stepper no puede
  // representar la ausencia de número.
  noLimitRow: {
    marginTop:         spacing.sm,
    paddingVertical:   spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius:      th.radius.sm,
    // Dentro de una hoja el fondo ya es `surface`: los campos van sobre `bg`
    // para que se lean, mismo criterio que las hojas del editor de ejercicio.
    backgroundColor:   th.colors.bg,
  },
  noLimitRowActive:  { backgroundColor: withOpacity(th.colors.accent, 0.12) },
  noLimitText:       { ...textStyles.labelStrong, color: th.colors.mutedLight },
  noLimitTextActive: { ...textStyles.labelStrong, color: th.colors.accent },
  // Dentro de una hoja el fondo YA es `bg`, así que los campos van sobre
  // `surface` para que se lean — mismo criterio que las hojas del editor de
  // ejercicio.
  sheetInput: {
    ...textStyles.labelStrong,
    color:             th.colors.text,
    backgroundColor:   th.colors.surface,
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
    ...textStyles.caps,
    color:             th.colors.onAccent,
    backgroundColor:   th.colors.accent,
    borderRadius:      th.radius.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical:   spacing.xs2,
    overflow:          'hidden',
  },
  stateTitle: { ...textStyles.labelStrong, color: th.colors.text },
  stateHint:  { ...textStyles.label,      color: th.colors.mutedLight, lineHeight: 14 },
  activateBtn: {
    paddingVertical: spacing.md,
    backgroundColor: th.colors.accent,
    borderRadius:    th.radius.sm,
    alignItems:      'center',
  },
  activateBtnText: { ...textStyles.button, color: th.colors.onAccent },
  sheetBtnRow: { flexDirection: 'row', gap: spacing.sm },
  dupStageBtn: {
    flex:            1,
    paddingVertical: spacing.md,
    borderRadius:    th.radius.sm,
    backgroundColor: th.colors.surface2,
    alignItems:      'center',
  },
  dupStageBtnText: { ...textStyles.labelStrong, color: th.colors.text },
  // Sin fondo, solo texto (QA): mismo tratamiento que "Descartar sesión".
  deleteStageBtn: {
    flex:            1,
    paddingVertical: spacing.md,
    alignItems:      'center',
  },
  deleteStageBtnText: { ...textStyles.labelStrong, color: th.tint.red50 },
});
