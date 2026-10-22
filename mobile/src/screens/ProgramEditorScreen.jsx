import { useState, useEffect, useMemo } from 'react';
import { View, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import { Text, TextInput } from '../components/ui/Text';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Reanimated, {
  useAnimatedRef, useSharedValue, useAnimatedStyle, withTiming, withDelay, runOnJS, runOnUI, LayoutAnimationConfig,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Sortable from 'react-native-sortables';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../store/useStore';
import { ownerClient } from '../utils/programOwnership';
import { spacing, textStyles } from '../theme';
import { useTheme, useThemedStyles } from '../useTheme';
import { sessionStats } from '../utils/sessionStats';
import DragSheet from '../components/DragSheet';
import SheetRow from '../components/ui/SheetRow';
import { Section, SectionLabel, MenuRow, Status, RowIcon } from '../components/ui/MenuList';
import { ROW_ICON } from '../components/ui/rowIcons';
import { Switch } from '../components/ui/EditorRows';
import StageCards from '../components/ui/StageCards';
import EditorIdentityCard from '../components/editor/EditorIdentityCard';
import { useSlidePages } from '../components/ui/useSlidePages';
import SegmentedControl from '../components/ui/SegmentedControl';
import SwipeRow from '../components/ui/SwipeRow';
import StepField from '../components/ui/StepField';
import { DragIcon, LockIcon, CheckIcon, GearIcon } from '../components/ui/EditorIcons';
import ScreenHeader from '../components/ui/ScreenHeader';
import { SORTABLE_PROPS } from '../components/ui/sortable';
import { isStageLocked, isTrainerProgram } from '../utils/stageLocks';
import { describeRx } from '../utils/stageRx';
import { athleteProgress, stageStatus, stageWeekLabel, programTotals, weeklySessions } from '../utils/stageProgress';
import { stageWeekRanges, stageRangeLabel, isDeload } from '../utils/stageStats';
import { useEditorExit } from '../hooks/useEditorExit';
import { useEditorBase, deleteWithUndo } from '../hooks/useEditorDraft';
import { templateEdited } from '../utils/editorDraft';
import { useEditorFold } from '../hooks/useEditorFold';

// Gap entre tarjetas de sesión (space/sm). Lo aplica `Sortable.Grid` como
// `rowGap`: necesita conocerlo para colocar los huecos.
const CARD_GAP = spacing.sm;
// La curva del cambio de página (`useSlidePages`): la vuelta de la capa del
// arrastre va con ella. Fuera del componente: un worklet no puede capturar
// `SegmentedControl` entero.
const SLIDE = SegmentedControl.TIMING;
// Lo que tarda en irse la página soltada deslizando, desde donde esté.

// ─── Tarjeta de sesión ────────────────────────────────────────────────────────
// Sesion Card / "Sesion card editor de programa" (210:3152) con dos cambios
// pedidos: el eyebrow "SESIÓN A" se sustituye por la letra, y la tarjeta se
// desliza como una fila de ejercicio del editor de sesión (`ui/SwipeRow`): la
// letra va a la izquierda, donde allí va el número, y el asa a la derecha.
// Sin la flecha accent de antes: con el asa pegada al borde y la ‹ de la tarjeta
// abierta eran tres símbolos de navegación en 40px.
//
// El reordenado lo lleva `react-native-sortables` (ver la lista más abajo): el
// asa solo tiene que envolverse en `Sortable.Handle`.

function SessionCard({ label, name, meta, edited, actions, isOpen, onOpenChange, onPress }) {
  const { t }  = useTranslation();
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);

  return (
    <SwipeRow
      actions={actions}
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      onPress={onPress}
      style={styles.sesCard}
      leading={<Text style={styles.sesLetter}>{label}</Text>}
      handle={(
        <Sortable.Handle style={styles.dragHandle}>
          <DragIcon color={th.colors.mutedLight} />
        </Sortable.Handle>
      )}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.sesName} numberOfLines={1}>{name}</Text>
        <Text style={styles.sesMeta} numberOfLines={1}>{meta}</Text>
      </View>
      {edited ? <Text style={styles.sesEdited}>{t('editor.editedTag')}</Text> : null}
    </SwipeRow>
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
  const setProgramSessionOrder     = useStore((s) => s.setProgramSessionOrder);
  const removeStageFromProgram = useStore((s) => s.removeStageFromProgram);
  const addStageToProgram     = useStore((s) => s.addStageToProgram);
  const updateStage           = useStore((s) => s.updateStage);
  const setCurrentStage       = useStore((s) => s.setCurrentStage);
  const reorderSessionsInStage = useStore((s) => s.reorderSessionsInStage);
  const duplicateSessionInProgram = useStore((s) => s.duplicateSessionInProgram);
  const removeSessionFromProgram  = useStore((s) => s.removeSessionFromProgram);
  const showToast             = useStore((s) => s.showToast);
  const { done }              = useEditorExit(navigation);

  const editingId     = ui._editingProgramId ?? profile.activeProgramId;
  // Siempre es la base del editor: se abre desde fuera por `navigate('programEditor')`.
  const { cancel }    = useEditorBase(navigation, true, editingId ? { kind: 'program', id: editingId } : null);
  const { folded, onScroll, onCardLayout } = useEditorFold();
  const activeProgram = programs[editingId];

  const allExercises = useMemo(
    () => ({ ...exerciseLibrary, ...customExercises }),
    [exerciseLibrary, customExercises],
  );

  const [selectedStageIdx, setSelectedStageIdx] = useState(activeProgram?.currentStageIndex ?? 0);
  const [stageSheetOpen, setStageSheetOpen]     = useState(false);
  const [openRowId, setOpenRowId]               = useState(null); // tarjeta con el panel de acciones abierto

  const selectedStage = activeProgram?.stages?.[selectedStageIdx] ?? null;
  const [stageName, setStageName] = useState(selectedStage?.name ?? '');

  // Ref del ScrollView para el autoscroll de la lista reordenable.
  const scrollRef = useAnimatedRef();

  // Cambiar de etapa desliza la página entera (cabecera, rótulo y sesiones),
  // como el editor de sesión al cambiar de sesión (P14 §3.4).
  const { slide, pageEntering, pageExiting } = useSlidePages();

  // La etapa elegida también en el hilo de UI: las fichas se rellenan y se
  // recolocan en cuanto se cambia, sin esperar a que React repinte la etapa.
  const page = useSharedValue(selectedStageIdx);

  // La capa que sigue al dedo al deslizar la cabecera (ver `headSwipe`).
  // `dragOut` marca que la página vieja está saliendo con ella.
  const { width: screenW } = useWindowDimensions();
  const dragX     = useSharedValue(0);
  const dragOut   = useSharedValue(false);
  const dragIn    = useSharedValue(false);
  const dragStyle = useAnimatedStyle(() => ({ transform: [{ translateX: dragX.get() }] }));
  // La nueva, tras un arrastre, no se ve los dos primeros fotogramas: la capa
  // aún puede estar fuera, con la vieja, y la nueva asomaba un fotograma
  // ocupándolo todo. Como entra desde fuera de la pantalla, no se nota.
  const enterPage = () => {
    'worklet';
    const a = pageEntering();
    if (!dragIn.value) return a;
    dragIn.set(false);
    return {
      initialValues: { ...a.initialValues, opacity: 0 },
      animations:    { ...a.animations, opacity: withDelay(32, withTiming(1, { duration: 0 })) },
    };
  };
  // Cuando React pinta la etapa nueva, la vieja deja la capa y sigue saliendo
  // por su cuenta desde donde iba; la capa vuelve a su sitio de golpe para que
  // la nueva entre desde fuera, como con la ficha.
  const exitPage = () => {
    'worklet';
    if (!dragOut.value) return pageExiting();
    const x = dragX.value;
    dragOut.set(false);
    dragX.set(0);
    return {
      initialValues: { transform: [{ translateX: x }] },
      animations:    { transform: [{ translateX: withTiming((x < 0 ? -1 : 1) * screenW, SLIDE) }] },
    };
  };

  // Al cambiar de etapa la lista nueva se monta sin alto hasta que se mide, y el
  // ScrollView, al encogerse el contenido, saltaba arriba del todo. Se sostiene
  // el alto de la página vieja mientras dura el cambio.
  // Valores compartidos y no `useRef`: el gesto de la cabecera se construye en
  // el render y el lint del compilador cree que leería ahí los `ref`.
  const pageH     = useSharedValue(0);
  const holdTimer = useSharedValue(0);
  const [holdH, setHoldH] = useState(0);
  function holdPage() {
    setHoldH(pageH.get());
    clearTimeout(holdTimer.get());
    holdTimer.set(setTimeout(() => setHoldH(0), 500));
  }

  useEffect(() => {
    if (selectedStage) setStageName(selectedStage.name);
  }, [selectedStageIdx, activeProgram?.stages?.length]);

  useEffect(() => {
    const max = (activeProgram?.stages?.length ?? 1) - 1;
    if (selectedStageIdx > max) {
      page.set(max);
      setSelectedStageIdx(max);
    }
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

  const stages = activeProgram.stages ?? [];
  // Con una sola etapa no hay etapas que enseñar: ni fichas ni número, y la
  // cabecera se llama como el programa (P14 §5.6).
  const single = stages.length === 1;
  // Una etapa sin límite hace el total indeterminado: `programTotals` suma las
  // que sí lo tienen y avisa para marcarlo con "+".
  const totals = programTotals(activeProgram);

  // ── Drag de sesiones ──────────────────────────────────────────────────────
  // Lo lleva `Sortable.Grid` (react-native-sortables): el orden pintado no
  // cambia durante el gesto, cada tarjeta se posiciona con un transform que vive
  // en el hilo de UI, y al soltar la librería reordena ahí mismo. El orden del
  // store solo se escribe en `onDragEnd`, cuando las posiciones ya coinciden.
  const sortableSessions = editorDays
    .map(({ sessionTemplateId: id }) => ({ id, template: sessionTemplates[id] }))
    .filter((s) => s.template);

  function handleReorder({ data }) {
    setOpenRowId(null);
    reorderSessionsInStage(
      editingId,
      selectedStageIdx,
      data.map((s) => s.id),
    );
  }

  function handleDeleteSession({ id, template }) {
    deleteWithUndo({
      kind: 'program', id: editingId, label: t('editor.toastUndo'),
      msg: t('editor.toastSessionDeleted', { name: template.name }),
      remove: () => removeSessionFromProgram(editingId, id),
    });
  }

  function handleDuplicateSession(id) {
    if (duplicateSessionInProgram(editingId, id)) {
      showToast(t('editor.toastSessionDuplicated'), 2200, 'success');
    }
  }

  function commitStageName() {
    const trimmed = stageName.trim();
    if (trimmed && trimmed !== selectedStage?.name) updateStage(editingId, selectedStageIdx, { name: trimmed });
    else setStageName(selectedStage?.name ?? '');
  }

  function handleDeleteStage() {
    setStageSheetOpen(false);
    setOpenRowId(null);
    deleteWithUndo({
      kind: 'program', id: editingId, label: t('editor.toastUndo'),
      msg: t('editor.toastStageDeleted', { name: selectedStage?.name ?? '' }),
      remove: () => removeStageFromProgram(editingId, selectedStageIdx),
    });
    slide(-1);
    holdPage();
    page.set(Math.max(0, selectedStageIdx - 1));
    setSelectedStageIdx(Math.max(0, selectedStageIdx - 1));
  }

  // El check escribe lo que hubiera a medias en los campos de texto, guarda y
  // sale del modo edición. El chevron es Cancelar (P16-01): lo escrito a medias
  // no cuenta, y si hay cambios en el borrador pregunta antes de descartar.
  function handleDone() {
    commitStageName();
    done();
  }

  // Etapa activa REAL. En el móvil del entrenador la del programa es solo la que
  // él activó; el cliente puede haber avanzado por su cuenta. En el del cliente
  // no hay ficha de cliente que consultar y se cae a la del programa, que ahí sí
  // es la suya.
  const editedClient        = ownerClient(clients, activeProgram);
  const status              = stageStatus(activeProgram, athleteProgress(activeProgram, editedClient));
  const activeStageIdx      = status.stageIdx;
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

  // ── Tarjetas de etapa (P14 §3.3) ────────────────────────────────────────────
  // Quién ve el candado: en el móvil del cliente, el de verdad; en el del
  // entrenador, el que puso él por delante de donde va el cliente (la regla de
  // `canLockStage`); en un programa propio, nadie.
  const lockedAt = (idx) => (fromTrainer
    ? isStageLocked(activeProgram, idx, clientSync)
    : !!editedClient && !!stages[idx]?.locked && idx > activeStageIdx);
  const ranges = stageWeekRanges(stages);
  const stageCards = stages.map((st, idx) => ({
    id:       st.id ?? String(idx),
    number:   idx + 1,
    range:    stageRangeLabel(st, ranges[idx], t),
    done:     idx < activeStageIdx,
    deload:   isDeload(st),
    locked:   lockedAt(idx),
    now:      idx === activeStageIdx,
  }));

  function selectStage(idx) {
    if (idx < 0 || idx >= stages.length || idx === selectedStageIdx) return;
    const dir = idx > selectedStageIdx ? 1 : -1;
    holdPage();
    setOpenRowId(null);
    // Los valores compartidos se escriben en el hilo de UI y la etapa cambia
    // DESPUÉS: escritos desde JS llegaban tarde en la build de release, y la
    // página nueva entraba con la dirección del cambio anterior (de la 3 a la
    // 1 tras avanzar, por la derecha).
    runOnUI(() => {
      page.set(idx);
      slide(dir);
      runOnJS(setSelectedStageIdx)(idx);
    })();
  }

  // «Nueva etapa» (el «+» de las fichas y la hoja de Ajustes): hasta que exista
  // el creador de etapas (P15), el planificador con su hoja de añadir abierta y
  // esta etapa como base; al aplicar vuelve aquí (P14 §5.5).
  function newStage() {
    commitStageName();
    navigation.navigate('StagePlanner', { programId: editingId, addFrom: selectedStageIdx, fromEditor: true });
  }

  // ── Cabecera de la etapa (P14 §3.4) ─────────────────────────────────────────
  const brow = selectedStageIdx === activeStageIdx
    ? { text: t('editor.stageBrowNow', { week: stageWeekLabel(status, t) }), color: th.colors.accent }
    : selectedStageIdx < activeStageIdx
      ? { text: t('editor.stageBrowDone'), color: th.colors.muted }
      : isDeload(selectedStage)
        ? { text: t('editor.stageBrowDeload'), color: th.colors.blue }
        : { text: t('editor.stageBrowNext'), color: th.colors.muted };
  // Semanas y sesiones por semana. El tramo («sem 5-8») no: ya lo dicen las
  // fichas de encima.
  const stageMeta = selectedStage
    ? `${selectedStage.durationWeeks == null ? t('home.stageOpen') : t('editor.weeksShort', { count: selectedStage.durationWeeks })} · ${t('home.stageSessionsPerWeek', { count: editorDays.length })}`
    : '';

  // Deslizar la cabecera a los lados cambia de etapa, igual que tocar su ficha.
  // Lo que sigue al dedo es una capa FIJA alrededor de la página, no la página:
  // la página se desmonta al cambiar de etapa y, si llevaba ella el
  // desplazamiento, lo perdía o lo heredaba la nueva (fotogramas sueltos). Al
  // soltar pasados 60 dp, la capa sigue saliendo con la página vieja dentro y
  // la etapa cambia en ese momento, como con la ficha: la nueva se va cargando
  // mientras la vieja sale (ver `exitPage`). Si no, la capa vuelve sin más. Hacia un lado sin
  // etapa, la capa va a un quinto del dedo.
  // Solo en horizontal, para no robarle el scroll vertical a la pantalla. Toda
  // la tarjeta, bordes y engranaje incluidos: es desde el lateral desde donde
  // se arrastra (tocar el engranaje sigue abriendo sus ajustes). Las sesiones
  // no cambian de etapa: deslizarlas es de `SwipeRow` (§4.2).
  const headSwipe = Gesture.Pan()
    .enabled(!single)
    .activeOffsetX([-20, 20])
    .failOffsetY([-10, 10])
    .onUpdate((e) => {
      const edge = e.translationX < 0 ? selectedStageIdx >= stages.length - 1 : selectedStageIdx <= 0;
      dragX.set(e.translationX * (edge ? 0.2 : 1));
    })
    .onEnd((e) => {
      const to = selectedStageIdx + (e.translationX < -60 ? 1 : e.translationX > 60 ? -1 : 0);
      if (to !== selectedStageIdx && to >= 0 && to < stages.length) {
        dragX.set(withTiming((to > selectedStageIdx ? -1 : 1) * screenW, SLIDE));
        dragOut.set(true);
        dragIn.set(true);
        runOnJS(selectStage)(to);
      } else {
        dragX.set(withTiming(0, { duration: 200 }));
      }
    })
    .onFinalize((_, ok) => {
      if (!ok) dragX.set(withTiming(0, { duration: 200 }));
    });

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      {/* ── SesionHeader / "Editar Programa" (210:2819) ── */}
      <ScreenHeader
        editor={{ base: true, onCancel: cancel, folded }}
        eyebrow={[t('editor.idProgram'), editedClient?.name].filter(Boolean).join(' · ')}
        title={activeProgram.name ?? ''}
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
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        {/* ── Tarjeta de identidad (P16-03). Sin lápiz si el programa es del
            entrenador: el cliente no lo renombra. ── */}
        <EditorIdentityCard
          eyebrow={t('editor.idProgram')}
          clientName={editedClient?.name}
          name={activeProgram.name ?? ''}
          stats={[
            totals.weeks > 0 && { n: `${totals.weeks}${totals.open ? '+' : ''}`, label: t('editor.idWeeks', { count: totals.weeks }) },
            { n: weeklySessions(stages[activeStageIdx]), label: t('editor.idSessionsWeek', { count: weeklySessions(stages[activeStageIdx]) }) },
            !single && { n: stages.length, label: t('editor.idStages', { count: stages.length }) },
          ].filter(Boolean)}
          onRename={fromTrainer ? undefined : (name) => renameProgram(editingId, name)}
          renameTitle={t('editor.idProgram')}
          onLayout={onCardLayout}
        />

        {/* ── Rótulo y tarjetas de etapa (P14 §3.2-3.3) ── */}
        <View style={styles.stagesBlock}>
          <View style={styles.stagesLabelRow}>
            {single ? (
              <Text style={styles.stagesLabel}>{t('editor.stagesLabelNone').toUpperCase()}</Text>
            ) : (
              <Text style={styles.stagesLabel}>{t('editor.stagesTitle').toUpperCase()}</Text>
            )}
            <TouchableOpacity onPress={() => navigation.navigate('StagePlanner', { programId: editingId, fromEditor: true })} hitSlop={8} accessibilityRole="button">
              <Text style={styles.viewPlan}>{t('editor.viewPlan')}</Text>
            </TouchableOpacity>
          </View>
          {!single && (
            <StageCards
              stages={stageCards}
              value={stageCards[selectedStageIdx]?.id}
              sel={page}
              onChange={(id) => selectStage(stageCards.findIndex((c) => c.id === id))}
              onAdd={newStage}
            />
          )}
        </View>

        {/* ── La etapa elegida: cabecera y sesiones, que entran juntas ── */}
        {/* La capa fija del arrastre: no cambia con la etapa (ver `headSwipe`). */}
        <Reanimated.View style={dragStyle}>
        <Reanimated.View
          key={stageCards[selectedStageIdx]?.id ?? selectedStageIdx}
          style={[styles.page, { minHeight: holdH }]}
          entering={enterPage}
          exiting={exitPage}
          onLayout={(e) => pageH.set(e.nativeEvent.layout.height)}
        >
          {/* Lo de dentro no hace su propio fundido al montarse o desmontarse con
              la página; lo que se añada o quite después, sí. */}
          <LayoutAnimationConfig skipEntering skipExiting>
            <GestureDetector gesture={headSwipe}>
              <View style={styles.stageHead}>
                <View style={styles.stageHeadText}>
                  <View style={styles.browRow}>
                    <Text style={[styles.brow, { color: brow.color }]}>{brow.text.toUpperCase()}</Text>
                    {lockedAt(selectedStageIdx) && (
                      <>
                        <Text style={[styles.brow, { color: th.colors.muted }]}>·</Text>
                        <LockIcon size={10} color={th.colors.redText} solid />
                        <Text style={[styles.brow, { color: th.colors.redText }]}>
                          {t('editor.stageBrowLocked').toUpperCase()}
                        </Text>
                      </>
                    )}
                  </View>
                  {/* Con una sola etapa el nombre sería el del programa, que ya dice
                      la tarjeta de arriba (P16-03 §5.1). */}
                  {!single && (
                    <View style={styles.stageTitleRow}>
                      <Text style={[styles.stageTitle, { color: isDeload(selectedStage) ? th.colors.blue : th.colors.accent }]}>
                        {selectedStageIdx + 1}
                      </Text>
                      <Text style={styles.stageTitleName} numberOfLines={1}>
                        {selectedStage?.name ?? ''}
                      </Text>
                    </View>
                  )}
                  <Text style={styles.stageMeta} numberOfLines={1}>{stageMeta}</Text>
                </View>
                <TouchableOpacity
                  style={styles.headBtn}
                  onPress={() => setStageSheetOpen(true)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={t('editor.stageSettingsA11y')}
                >
                  <GearIcon color={th.colors.mutedLight} />
                </TouchableOpacity>
              </View>
            </GestureDetector>

            <Text style={styles.sessionsTitle}>{t(single ? 'editor.sectionSessions' : 'editor.sessionsOfStage').toUpperCase()}</Text>

            <Sortable.Grid
              {...SORTABLE_PROPS}
              data={sortableSessions}
              keyExtractor={(s) => s.id}
              rowGap={CARD_GAP}
              scrollableRef={scrollRef}
              onDragStart={() => setOpenRowId(null)}
              onDragEnd={handleReorder}
              renderItem={({ item: { id, template } }) => {
                const stats = sessionStats(template, allExercises);
                const actions = [{
                  label: t('editor.rowDuplicate'), kind: 'neutral',
                  onPress: () => handleDuplicateSession(id),
                }];
                // Como en el editor de sesión: la última sesión de la etapa no se borra.
                if (sortableSessions.length > 1) {
                  actions.push({
                    label: t('editor.rowDelete'), kind: 'danger',
                    onPress: () => handleDeleteSession({ id, template }),
                  });
                }
                return (
                  <SessionCard
                    label={template.label ?? ''}
                    actions={actions}
                    isOpen={openRowId === id}
                    onOpenChange={(open) => setOpenRowId(open ? id : null)}
                    name={template.name ?? ''}
                    edited={templateEdited(ui._editorDraft, id, template)}
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
                {selectedStage && !single
                  ? <>
                      {t('editor.addSessionPrefix')}
                      <Text style={styles.addSessionBtnStage}>{selectedStage.name}</Text>
                    </>
                  : t('editor.addSession')}
              </Text>
            </TouchableOpacity>
          </LayoutAnimationConfig>
        </Reanimated.View>
        </Reanimated.View>

        {/* ── Qué sesión toca (U13 §8-9) ── */}
        <View style={styles.section}>
          <Text style={styles.secTitle}>{t('editor.sessionOrderTitle').toUpperCase()}</Text>
          <SegmentedControl
            options={['rotation', 'weekly', 'free'].map((id) => ({ id, label: t(`editor.sessionOrder_${id}`) }))}
            value={activeProgram.sessionOrder ?? 'rotation'}
            onChange={(id) => setProgramSessionOrder(editingId, id)}
          />
          <Text style={styles.stageHint}>{t(`editor.sessionOrderHint_${activeProgram.sessionOrder ?? 'rotation'}`)}</Text>
        </View>

      </Reanimated.ScrollView>

      {/* ── Ajustes de etapa ── Lo que se ajusta va en secciones con título, con
          las filas del resto de la app (`MenuRow`): lo que informa no tiene
          forma de botón y lo que se hace son filas con icono. */}
      <DragSheet
        visible={stageSheetOpen}
        onClose={() => { commitStageName(); setStageSheetOpen(false); }}
        title={t('editor.stageSheetTitle')}
        doneLabel={t('common.accept')}
      >
        {selectedStage && (
          <View>

            {/* Con una sola etapa el nombre no se ve en ningún sitio: la
                cabecera se llama como el programa. */}
            {!single && (
              <View style={styles.sheetBlock}>
                <SectionLabel>{t('editor.stageNameLabel')}</SectionLabel>
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
            )}

            {/* Procedencia. Es una etiqueta, no una regla viva: `applyRx` se
                materializó al crear la etapa y editarla a mano manda sobre
                esto. Sin ella, a las tres semanas nadie recuerda qué escalera
                montó. */}
            {selectedStage.rx && describeRx(selectedStage.rx, t).length > 0 && (
              <View style={styles.sheetBlock}>
                <SectionLabel>{t('editor.stageFromLabel')}</SectionLabel>
                <Text style={styles.stageRxLine}>
                  {describeRx(selectedStage.rx, t).join(' · ')}
                </Text>
              </View>
            )}

            {/* `durationWeeks: null` = sin límite: la etapa no termina sola. Un
                interruptor, y el contador solo cuando hay semanas que contar. */}
            <Section title={t('editor.stageDurationLabel')}>
              <MenuRow
                label={t('editor.stageNoLimit')}
                sub={t('editor.stageNoLimitHint')}
                subLines={0}
                control={<Switch value={selectedStage.durationWeeks == null} />}
                onPress={() => updateStage(editingId, selectedStageIdx, {
                  durationWeeks: selectedStage.durationWeeks == null ? 4 : null,
                })}
                accessibilityRole="switch"
                accessibilityState={{ checked: selectedStage.durationWeeks == null }}
              />
              {selectedStage.durationWeeks != null && (
                <MenuRow
                  label={t('editor.stageWeeksUnit')}
                  control={(
                    <StepField
                      horizontal
                      flat
                      label=""
                      value={selectedStage.durationWeeks}
                      onChange={(v) => updateStage(editingId, selectedStageIdx, { durationWeeks: v })}
                      min={1}
                      max={52}
                    />
                  )}
                />
              )}
            </Section>

            {/* Con una sola etapa siempre es la de ahora: no hay estado que
                decidir. */}
            {!single && (
              <Section title={t('editor.stageStateLabel')}>
                {isStageActive ? (
                  <MenuRow
                    label={t('editor.stageStateNow')}
                    status={<Status tone="on" label={stageWeekLabel(status, t)} />}
                  />
                ) : selectedStageLocked ? (
                  // Bloqueada por el entrenador: `setCurrentStage` lo rechazaría,
                  // así que solo se dice.
                  <MenuRow
                    icon={<LockIcon size={14} color={th.colors.redText} solid />}
                    label={t('editor.stageAccessLocked')}
                    sub={t('home.stageLockedShort')}
                  />
                ) : (
                  <MenuRow
                    icon={<RowIcon>{ROW_ICON.start}</RowIcon>}
                    label={t('editor.stageMoveHere')}
                    sub={t('editor.stageMoveHereSub')}
                    onPress={() => {
                      setCurrentStage(editingId, selectedStageIdx);
                      showToast(t('editor.toastStageActivated', { name: selectedStage.name }), 2200, 'success');
                    }}
                  />
                )}
              </Section>
            )}

            {/* Acceso: el candado que el cliente ve en su móvil. Solo por
                delante de donde está — ver `canLockStage`. */}
            {canLockStage && (
              <Section title={t('editor.stageAccessLabel')}>
                <MenuRow
                  label={t('editor.stageAccessLocked')}
                  sub={t(selectedStage.locked ? 'editor.stageAccessLockedHint' : 'editor.stageAccessOpenHint')}
                  subLines={0}
                  control={<Switch value={!!selectedStage.locked} />}
                  onPress={() => updateStage(editingId, selectedStageIdx, { locked: !selectedStage.locked })}
                  accessibilityRole="switch"
                  accessibilityState={{ checked: !!selectedStage.locked }}
                />
              </Section>
            )}

            {/* Las acciones cierran la hoja (`SheetRow`). */}
            <Section title={t('editor.stageActionsLabel')} style={styles.sheetLast}>
              <SheetRow
                icon={ROW_ICON.new}
                iconColor={th.colors.accent}
                labelColor={th.colors.accent}
                label={t('editor.stageNew')}
                sub={t('editor.stageNewSub')}
                onPress={newStage}
              />
              <SheetRow
                icon={ROW_ICON.duplicate}
                label={t('editor.stageDuplicateBtn')}
                sub={t('editor.stageDuplicateSub')}
                onPress={() => {
                  commitStageName(); // la copia hereda un nombre a medio escribir
                  // Al final, como en el planificador, nunca detrás de la
                  // original: el progreso del cliente guarda el ÍNDICE de su
                  // etapa, y una copia en medio le movería de etapa sin avisar.
                  const newIdx = stages.length;
                  addStageToProgram(editingId, {
                    sourceStageIdx: selectedStageIdx,
                    name:           `${stageName.trim() || selectedStage.name} ${t('editor.copySuffix')}`,
                    // Una etapa sin límite no se copia sin límite: misma regla
                    // que el planificador.
                    durationWeeks:  selectedStage.durationWeeks ?? 4,
                  });
                  slide(1);
                  holdPage();
                  page.set(newIdx);
                  setSelectedStageIdx(newIdx);
                  showToast(t('editor.toastStageDuplicated'), 2200, 'success');
                }}
              />
              {!single && (
                <SheetRow
                  icon={ROW_ICON.trash}
                  danger
                  label={t('editor.stageDeleteBtn')}
                  onPress={handleDeleteStage}
                />
              )}
            </Section>

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

  // ── Rótulo de las etapas ── pegado a las tarjetas (P14 §3.2)
  // 20 bajo la tarjeta de identidad: el gap de la página (10) más este margen.
  stagesBlock:    { gap: spacing.sm2, marginTop: spacing.md },
  stagesLabelRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  stagesLabel:    { ...textStyles.caps, color: th.colors.mutedLight, flexShrink: 1 },
  viewPlan:       { ...textStyles.button, color: th.colors.accent },

  // ── Cabecera de la etapa ── (P14 §3.4). 12 bajo las tarjetas: el gap de la
  // página (10) más este margen.
  page: { marginTop: spacing.xs },
  stageHead: {
    flexDirection:     'row',
    alignItems:        'flex-start',
    gap:               spacing.md,
    backgroundColor:   th.colors.surface,
    borderRadius:      th.radius.md,
    paddingTop:        16,
    paddingHorizontal: 14,
    paddingBottom:     14,
  },
  stageHeadText:  { flex: 1, minWidth: 0 },
  browRow:        { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 5 },
  brow:           { ...textStyles.caps },
  // Número y nombre como la ficha de la etapa en curso del tab Programa
  // (U14 §5.3): Barlow, apoyados en el mismo suelo (la cuenta de los 39/34 está
  // en `SessionList`), y el nombre en mayúsculas.
  stageTitleRow:  { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, marginTop: spacing.xs2 },
  stageTitle:     { ...textStyles.heroGlyph, lineHeight: 39, includeFontPadding: false, paddingRight: 2 },
  stageTitleName: {
    ...textStyles.heroName,
    lineHeight:         34,
    includeFontPadding: false,
    textTransform:      'uppercase',
    paddingRight:       2,
    flex:               1,
    color:              th.colors.text,
  },
  // La meta, también como en Programa.
  stageMeta:      { ...textStyles.body, color: th.colors.mutedLight, marginTop: spacing.xs },
  headBtn: {
    width:           36,
    height:          36,
    borderRadius:    11,
    backgroundColor: th.colors.surface2,
    alignItems:      'center',
    justifyContent:  'center',
  },
  sessionsTitle: {
    ...textStyles.caps,
    color:        th.colors.mutedLight,
    marginTop:    spacing.xl,
    marginBottom: spacing.sm2,
  },

  // ── Tarjeta de sesión ──
  // Lo que `SwipeRow` no decide: la tarjeta de sesión es más alta y más
  // redondeada que una fila de ejercicio (radius/md, space/md arriba y abajo).
  // Mismos 15px (`space/lg`) de Figma a la izquierda; a la derecha 6 porque el
  // icono del asa ya trae 9px de aire dentro de su caja de 26.
  sesCard: {
    borderRadius:      th.radius.md,
    paddingLeft:       spacing.lg,
    paddingRight:      spacing.sm,
    paddingVertical:   spacing.md,
  },
  // Zona de toque hasta los bordes de la tarjeta; los márgenes negativos
  // compensan el padding y el icono se queda donde estaba (QA P49).
  dragHandle: {
    alignSelf:       'stretch',
    alignItems:      'center',
    justifyContent:  'center',
    paddingLeft:     spacing.md,
    marginLeft:      spacing.sm - spacing.md,
    paddingRight:    spacing.sm,
    marginRight:     -spacing.sm,
    paddingVertical: spacing.md,
    marginVertical:  -spacing.md,
  },
  // Siempre `color/accent` del tema (no el color por sesión de day1…day6).
  // minWidth 20 = la columna de la letra (P16-06); la flecha ‹ que la sustituye al abrir es más estrecha.
  sesLetter: { ...textStyles.indexGlyph, color: th.colors.accent, textAlign: 'center', minWidth: 20 },
  sesName:   { ...textStyles.bodyStrong, color: th.colors.text },
  sesMeta:   { ...textStyles.label, color: th.colors.mutedLight },
  sesEdited: { ...textStyles.labelStrong, color: th.colors.accent },

  // "+ Añadir sesión a X" — texto plano, sin caja (decisión de QA sobre el
  // botón outline de Figma).
  addSessionBtn:      { alignItems: 'center', paddingVertical: spacing.md },
  addSessionBtnText:  { ...textStyles.button, color: th.tint.accent50 },
  addSessionBtnStage: { color: th.colors.accent },

  stageRxLine: { ...textStyles.label, color: th.colors.accent },

  // Hoja de ajustes de etapa: los bloques que no son filas llevan el mismo aire
  // que las secciones (`Section`), y la última no necesita el de abajo.
  sheetBlock: { marginBottom: spacing.xl },
  sheetLast:  { marginBottom: 0 },
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
});
