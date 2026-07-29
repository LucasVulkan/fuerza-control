import { useState, useEffect, useRef, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Alert, Keyboard, PanResponder,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Reanimated, {
  useSharedValue, useAnimatedStyle, withTiming, runOnJS, Easing,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../store/useStore';
import { spacing, textStyles, withOpacity } from '../theme';
import { useTheme, useThemedStyles } from '../useTheme';
import { sessionStats } from '../utils/sessionStats';
import DragSheet from '../components/DragSheet';
import StageSelector from '../components/ui/StageSelector';
import StepField from '../components/ui/StepField';
import { ArrowIcon, MenuIcon, DragIcon, PencilIcon, CheckIcon } from '../components/ui/EditorIcons';

// SesionHeader / "Editar Programa" (210:2819) — alto exacto de Figma.
const HEADER_H = 64;
// Ancho del botón lápiz/check de la cabecera (y de su contrapeso invisible).
const HEADER_EDIT_W = 16;
// Gap entre tarjetas de sesión (space/sm) — se suma al alto de fila medido para
// obtener el paso del drag.
const CARD_GAP = spacing.sm;
// Fracción de fila que hay que recorrer para saltar de hueco al reordenar. Por
// encima de 0.5 deja una banda muerta de 2·(SWAP_AT−0.5) que evita el rebote.
const SWAP_AT = 0.65;
// Asentamiento al soltar y animación con la que los vecinos ceden el hueco.
// Iguales a propósito: ver `handleDragEnd`.
const SETTLE = { duration: 160, easing: Easing.inOut(Easing.ease) };

// ─── Tarjeta de sesión ────────────────────────────────────────────────────────
// Sesion Card / "Sesion card editor de programa" (210:3152) con dos cambios
// pedidos: el eyebrow "SESIÓN A" se sustituye por la letra delante del nombre, y
// se antepone un asa de arrastre. El asa reclama el gesto en `onStart` (igual
// que las filas del editor de sesión) — si esperase al movimiento, el ScrollView
// se lo llevaría antes.

function SessionCard({
  label, name, meta, isDragging, dragY, shift, animateShift, onPress,
  onDragStart, onDragMove, onDragEnd, onMeasure,
}) {
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);

  const cbs = useRef({ onDragStart, onDragMove, onDragEnd });
  useEffect(() => { cbs.current = { onDragStart, onDragMove, onDragEnd }; });

  // Las tarjetas que ceden el hueco se apartan una fila con `withTiming`;
  // cuando el gesto termina (`animateShift` false) el desplazamiento vuelve a 0
  // de golpe, en el mismo commit en que el store ya trae el orden nuevo — así no
  // se ve deshacer la animación.
  // Fuera del gesto, el desplazamiento se lee del prop DIRECTAMENTE, no del
  // shared value: al soltar, el store trae ya el orden nuevo y `shift` vale 0 en
  // ese mismo commit. Pasando por el efecto, el 0 llegaba un frame tarde y
  // durante ese frame las tarjetas se pintaban ya recolocadas pero todavía con
  // el transform viejo encima — el parpadeo de "sitios raros" al terminar.
  const shiftSv = useSharedValue(0);
  useEffect(() => {
    if (!animateShift) return;
    shiftSv.value = withTiming(shift, SETTLE);
  }, [shift, animateShift, shiftSv]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{
      translateY: isDragging ? dragY.value : (animateShift ? shiftSv.value : shift),
    }],
  }), [isDragging, animateShift, shift]);

  // El PanResponder tiene que ser UNA sola instancia por tarjeta: su
  // `gestureState` (el dy acumulado) vive dentro y se reinicia en cada `create`,
  // así que recrearlo a media pulsación perdería el arrastre. Inicializador
  // perezoso de useState en vez de useRef: misma estabilidad sin leer `.current`
  // durante el render.
  // Los `cbs.current` de dentro solo se evalúan al recibir el gesto, nunca en
  // render; la regla de purezas no puede verlo desde el inicializador.
  /* eslint-disable-next-line react-hooks/refs */
  const [pan] = useState(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderGrant:   ()        => cbs.current.onDragStart(),
    onPanResponderMove:    (_, gs)   => cbs.current.onDragMove(gs.dy),
    onPanResponderRelease: ()        => cbs.current.onDragEnd(),
    onPanResponderTerminate: ()      => cbs.current.onDragEnd(),
  }));

  return (
    <Reanimated.View
      onLayout={onMeasure}
      style={[
        styles.sesCard,
        isDragging && styles.sesCardDragging,
        // `elevation` además de `zIndex`: en Android sin ella la tarjeta
        // levantada pasa por debajo de sus hermanas.
        isDragging && { zIndex: 2, elevation: 4 },
        animStyle,
      ]}
    >
      <View {...pan.panHandlers} style={styles.dragHandle}>
        <DragIcon color={th.colors.mutedLight} />
      </View>
      <TouchableOpacity style={styles.sesBody} onPress={onPress} activeOpacity={0.7} disabled={isDragging}>
        {/* La letra acompaña al bloque entero (nombre + meta), centrada contra
            él — no es un prefijo del nombre. */}
        <Text style={styles.sesLetter}>{label}</Text>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.sesName} numberOfLines={1}>{name}</Text>
          <Text style={styles.sesMeta} numberOfLines={1}>{meta}</Text>
        </View>
        <ArrowIcon size={18} color={th.colors.accent} />
      </TouchableOpacity>
    </Reanimated.View>
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

  // ── Reordenar sesiones con drag ───────────────────────────────────────────
  // Reanimated no trae un primitivo de reordenar y las librerías que lo hacen
  // (draggable-flatlist y compañía) son una dependencia más y van por detrás de
  // Reanimated 4, así que va a mano — pero SIN tocar el orden pintado.
  //
  // Durante el gesto la lista se renderiza siempre en el orden del store: la
  // arrastrada sigue al dedo y las demás se apartan una fila con un transform.
  // Cero cambios de layout mientras se arrastra, que es lo que provocaba que las
  // tarjetas se solaparan, desaparecieran o dejaran huecos: las layout
  // animations competían con el reflow de la lista. El orden real solo se
  // escribe una vez, al soltar.
  const [drag, setDrag] = useState(null); // { id, from, to } o null
  const [rowH, setRowH] = useState(0);
  const dragRef = useRef(null);
  const dragY   = useSharedValue(0);

  const pitch = rowH + CARD_GAP;

  // Cuánto tiene que apartarse la tarjeta que ocupa `idx` en el orden del store.
  function shiftFor(idx) {
    if (!drag || pitch <= 0 || idx === drag.from) return 0;
    if (drag.to > drag.from && idx > drag.from && idx <= drag.to) return -pitch;
    if (drag.to < drag.from && idx >= drag.to   && idx <  drag.from) return  pitch;
    return 0;
  }

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

  function handleDragStart(templateId) {
    // `drag` sin `dragRef` = soltada y asentándose; no admitir otro gesto hasta
    // que termine, o se escribiría el orden dos veces.
    if (drag && !dragRef.current) return;
    const from = editorDays.findIndex((d) => d.sessionTemplateId === templateId);
    if (from < 0) return;
    dragY.value     = 0;
    dragRef.current = { id: templateId, from, to: from };
    setDrag(dragRef.current);
  }

  function handleDragMove(templateId, dy) {
    const state = dragRef.current;
    if (state?.id !== templateId) return;
    dragY.value = dy;
    if (pitch <= 0) return;

    // Banda muerta: hay que pasar de SWAP_AT para ceder el hueco, y volver a
    // pasarlo en sentido contrario para deshacerlo. Con el 0.5 implícito de un
    // `round`, el temblor del dedo justo en la frontera hacía ir y venir el
    // orden — ése era el flickering al arrastrar despacio.
    let to     = state.to;
    let offset = dy - (to - state.from) * pitch;
    while (offset >  pitch * SWAP_AT && to < editorDays.length - 1) { to += 1; offset -= pitch; }
    while (offset < -pitch * SWAP_AT && to > 0)                     { to -= 1; offset += pitch; }
    if (to === state.to) return;

    dragRef.current = { ...state, to };
    setDrag(dragRef.current);
  }

  // Al soltar NO se escribe el orden todavía: primero la tarjeta se asienta con
  // una animación hasta la posición exacta de su hueco destino. Cuando termina,
  // el transform vale justo lo que la separa de su sitio nuevo y los vecinos ya
  // están en el suyo, así que cambiar el orden y poner los transforms a cero es
  // un cambio de CERO píxeles — da igual que React y Reanimated no confirmen en
  // el mismo frame. Escribiendo el orden al soltar sí se notaba: durante un
  // frame la lista estaba ya recolocada pero con los transforms viejos encima.
  function handleDragEnd(templateId) {
    const state = dragRef.current;
    if (state?.id !== templateId) return;
    dragRef.current = null;
    dragY.value = withTiming((state.to - state.from) * pitch, SETTLE, (done) => {
      'worklet';
      if (done) runOnJS(commitDrag)(state);
    });
  }

  function commitDrag(state) {
    setDrag(null);
    dragY.value = 0;
    if (state.to === state.from) return;
    const order = editorDays.map((d) => d.sessionTemplateId);
    order.splice(state.from, 1);
    order.splice(state.to, 0, state.id);
    reorderSessionsInStage(editingId, hasStages ? selectedStageIdx : null, order);
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

  const isStageActive = selectedStageIdx === (activeProgram.currentStageIndex ?? 0);

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
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + spacing.xxl }]}
        keyboardShouldPersistTaps="handled"
        scrollEnabled={!drag}
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
                id:   stage.id ?? String(idx),
                name: stage.name,
                meta: t('editor.cyclesShort', { count: stage.durationWeeks ?? 0 }),
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

          {/* La lista se pinta SIEMPRE en el orden del store; durante el gesto
              solo se mueven transforms. */}
          <View style={{ gap: CARD_GAP }}>
            {editorDays.map(({ sessionTemplateId }, idx) => {
              const template = userPrograms[sessionTemplateId] ?? sessionTemplates[sessionTemplateId];
              if (!template) return null;
              const stats = sessionStats(template, allExercises);
              return (
                <SessionCard
                  key={sessionTemplateId}
                  label={template.label ?? ''}
                  name={template.name ?? ''}
                  meta={stats.minutes > 0
                    ? t('editor.sessionMeta',       { ex: stats.exercises, sets: stats.sets, min: stats.minutes })
                    : t('editor.sessionMetaNoTime', { ex: stats.exercises, sets: stats.sets })}
                  isDragging={drag?.id === sessionTemplateId}
                  dragY={dragY}
                  shift={shiftFor(idx)}
                  animateShift={!!drag}
                  onMeasure={idx === 0
                    ? (e) => {
                        const h = Math.round(e.nativeEvent.layout.height);
                        if (h !== rowH) setRowH(h);
                      }
                    : undefined}
                  onPress={() => navigation.navigate('SessionEditor', {
                    templateId: sessionTemplateId,
                    programId:  editingId,
                    stageIdx:   hasStages ? selectedStageIdx : null,
                  })}
                  onDragStart={() => handleDragStart(sessionTemplateId)}
                  onDragMove={(dy) => handleDragMove(sessionTemplateId, dy)}
                  onDragEnd={()  => handleDragEnd(sessionTemplateId)}
                />
              );
            })}
          </View>

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

      </ScrollView>

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
  sesCardDragging: { backgroundColor: th.colors.surface2 },
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
