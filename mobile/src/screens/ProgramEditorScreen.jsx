import { useState, useEffect, useMemo } from 'react';
import { View, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import { Text, TextInput } from '../components/ui/Text';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Reanimated, {
  useAnimatedRef, useSharedValue, useAnimatedStyle, withTiming, runOnJS, LayoutAnimationConfig,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Sortable from 'react-native-sortables';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../store/useStore';
import { ownerClient } from '../utils/programOwnership';
import { spacing, textStyles, withOpacity } from '../theme';
import { useTheme, useThemedStyles } from '../useTheme';
import { sessionStats } from '../utils/sessionStats';
import DragSheet from '../components/DragSheet';
import StageCards from '../components/ui/StageCards';
import { useSlidePages } from '../components/ui/useSlidePages';
import SegmentedControl from '../components/ui/SegmentedControl';
import SwipeRow from '../components/ui/SwipeRow';
import StepField from '../components/ui/StepField';
import { DragIcon, LockIcon, CheckIcon, GearIcon } from '../components/ui/EditorIcons';
import ScreenHeader from '../components/ui/ScreenHeader';
import { SORTABLE_PROPS } from '../components/ui/sortable';
import { isStageLocked, isTrainerProgram } from '../utils/stageLocks';
import { describeRx } from '../utils/stageRx';
import { athleteProgress, stageStatus, stageWeekLabel, programTotals } from '../utils/stageProgress';
import { stageWeekRanges, stageRangeLabel, isDeload } from '../utils/stageStats';
import { useEditorExit } from '../hooks/useEditorExit';

import { showDialog } from '../components/ui/dialog';
// Gap entre tarjetas de sesión (space/sm). Lo aplica `Sortable.Grid` como
// `rowGap`: necesita conocerlo para colocar los huecos.
const CARD_GAP = spacing.sm;
// Lo que tarda en irse la página soltada deslizando, desde donde esté.
const DRAG_OUT = { duration: 220 };

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

function SessionCard({ label, name, meta, actions, isOpen, onOpenChange, onPress }) {
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
  const duplicateStageInProgram = useStore((s) => s.duplicateStageInProgram);
  const updateStage           = useStore((s) => s.updateStage);
  const setCurrentStage       = useStore((s) => s.setCurrentStage);
  const reorderSessionsInStage = useStore((s) => s.reorderSessionsInStage);
  const duplicateSessionInProgram = useStore((s) => s.duplicateSessionInProgram);
  const removeSessionFromProgram  = useStore((s) => s.removeSessionFromProgram);
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

  // Deslizar la cabecera desplaza la página con el dedo y la apaga al final del
  // recorrido, solo como respuesta visual: la etapa cambia al soltar, como
  // siempre. `dragStage` es la etapa arrastrada (-1 si el último cambio no fue
  // deslizando): la página nueva no hereda el desplazamiento de la vieja.
  const { width: screenW } = useWindowDimensions();
  const dragX     = useSharedValue(0);
  const dragStage = useSharedValue(-1);
  // Opaca hasta un tercio del ancho; apagada del todo a los nueve décimos.
  const fadeAt = (x) => {
    'worklet';
    return 1 - Math.min(Math.max((Math.abs(x) / screenW - 0.33) / 0.57, 0), 1);
  };
  const dragStyle = useAnimatedStyle(() => {
    const x = dragStage.get() === selectedStageIdx ? dragX.get() : 0;
    return { opacity: fadeAt(x), transform: [{ translateX: x }] };
  });
  // La página que se deja deslizando sigue su camino desde donde la llevaba el
  // dedo; cambiando de otra forma, la salida de siempre.
  const exitPage = () => {
    'worklet';
    if (dragStage.value < 0) return pageExiting();
    const x = dragX.value;
    return {
      initialValues: { opacity: fadeAt(x), transform: [{ translateX: x }] },
      animations:    {
        opacity:   withTiming(0, DRAG_OUT),
        transform: [{ translateX: withTiming((x < 0 ? -1 : 1) * screenW, DRAG_OUT) }],
      },
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
    showDialog(
      t('editor.sessionDeleteBtn'),
      t('editor.sessionDeleteConfirm', { name: template.name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('editor.sessionDeleteBtn'), style: 'destructive',
          onPress: () => removeSessionFromProgram(editingId, id),
        },
      ]
    );
  }

  function handleDuplicateSession(id) {
    if (duplicateSessionInProgram(editingId, id)) {
      showToast(t('editor.toastSessionDuplicated'), 2200, 'success');
    }
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
    showDialog(
      t('planner.deleteTitle'),
      t('planner.deleteBody', { name: selectedStage?.name ?? '' }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'), style: 'destructive',
          onPress: () => {
            setStageSheetOpen(false);
            setOpenRowId(null);
            removeStageFromProgram(editingId, selectedStageIdx);
            dragStage.set(-1);
            slide(-1);
            holdPage();
            page.set(Math.max(0, selectedStageIdx - 1));
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

  function selectStage(idx, swiped = false) {
    if (idx < 0 || idx >= stages.length || idx === selectedStageIdx) return;
    page.set(idx);
    if (!swiped) dragStage.set(-1);
    slide(idx > selectedStageIdx ? 1 : -1);
    holdPage();
    setOpenRowId(null);
    setSelectedStageIdx(idx);
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

  // Deslizar la cabecera a los lados cambia de etapa. Solo en horizontal, para
  // no robarle el scroll vertical a la pantalla; y fuera del engranaje, que
  // queda fuera del detector. Las sesiones no cambian de etapa: deslizarlas es
  // de `SwipeRow` (§4.2). Mientras se arrastra, la página va con el dedo (a un
  // quinto si no hay etapa hacia ese lado). Al soltar pasados 60 dp sigue
  // saliendo en el hilo de UI, sin esperar a que React pinte la etapa nueva, y
  // cambia de etapa; si no, vuelve a su sitio.
  const cur  = selectedStageIdx;
  const last = stages.length - 1;
  const headSwipe = Gesture.Pan()
    .activeOffsetX([-20, 20])
    .failOffsetY([-10, 10])
    .onStart(() => {
      dragX.set(0);
      dragStage.set(cur);
    })
    .onUpdate((e) => {
      const edge = e.translationX < 0 ? cur >= last : cur <= 0;
      dragX.set(e.translationX * (edge ? 0.2 : 1));
    })
    .onEnd((e) => {
      const to = e.translationX < -60 ? cur + 1 : e.translationX > 60 ? cur - 1 : cur;
      if (to !== cur && to >= 0 && to <= last) {
        dragX.set(withTiming((to > cur ? -1 : 1) * screenW, DRAG_OUT));
        runOnJS(selectStage)(to, true);
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
        {/* ── Rótulo y tarjetas de etapa (P14 §3.2-3.3) ── */}
        <View style={styles.stagesBlock}>
          <View style={styles.stagesLabelRow}>
            <Text style={styles.stagesLabel}>
              <Text style={styles.stagesLabelNum}>{stages.length}</Text>
              {` ${t(totals.open ? 'editor.stagesLabelOpen' : 'editor.stagesLabel', { count: stages.length, weeks: totals.weeks })}`.toUpperCase()}
            </Text>
            <TouchableOpacity onPress={() => navigation.navigate('StagePlanner')} hitSlop={8} accessibilityRole="button">
              <Text style={styles.viewPlan}>{t('editor.viewPlan')}</Text>
            </TouchableOpacity>
          </View>
          <StageCards
            stages={stageCards}
            value={stageCards[selectedStageIdx]?.id}
            sel={page}
            onChange={(id) => selectStage(stageCards.findIndex((c) => c.id === id))}
            // Hasta que exista el creador de etapas (P15), «nueva etapa» va al
            // planificador (P14 §5.5).
            onAdd={() => navigation.navigate('StagePlanner')}
          />
        </View>

        {/* ── La etapa elegida: cabecera y sesiones, que entran juntas ── */}
        <Reanimated.View
          key={stageCards[selectedStageIdx]?.id ?? selectedStageIdx}
          style={[styles.page, { minHeight: holdH }, dragStyle]}
          entering={pageEntering}
          exiting={exitPage}
          onLayout={(e) => pageH.set(e.nativeEvent.layout.height)}
        >
          {/* Lo de dentro no hace su propio fundido al montarse o desmontarse con
              la página; lo que se añada o quite después, sí. */}
          <LayoutAnimationConfig skipEntering skipExiting>
            <View style={styles.stageHead}>
              <GestureDetector gesture={headSwipe}>
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
                  <View style={styles.stageTitleRow}>
                    <Text style={[styles.stageTitle, { color: isDeload(selectedStage) ? th.colors.blue : th.colors.accent }]}>
                      {selectedStageIdx + 1}
                    </Text>
                    <Text style={styles.stageTitleName} numberOfLines={1}>
                      {selectedStage?.name ?? ''}
                    </Text>
                  </View>
                  <Text style={styles.stageMeta} numberOfLines={1}>{stageMeta}</Text>
                </View>
              </GestureDetector>
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

            <Text style={styles.sessionsTitle}>{t('editor.sessionsOfStage').toUpperCase()}</Text>

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
          </LayoutAnimationConfig>
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
              {/* `durationWeeks: null` = sin límite de semanas: la etapa no
                  termina sola. El stepper no puede representarlo, así que la
                  opción vive en su propia fila y lo sustituye. */}
              {selectedStage.durationWeeks == null ? (
                <TouchableOpacity
                  style={[styles.noLimitRow, styles.noLimitRowActive]}
                  onPress={() => updateStage(editingId, selectedStageIdx, { durationWeeks: 4 })}
                  activeOpacity={0.7}
                >
                  <Text style={styles.noLimitTextActive}>{t('editor.weeksNoLimit')}</Text>
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
                    <Text style={styles.noLimitText}>{t('editor.weeksNoLimit')}</Text>
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
                    dragStage.set(-1);
                    slide(1);
                    holdPage();
                    page.set(newIdx);
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

  // ── Rótulo de las etapas ── pegado a las tarjetas (P14 §3.2)
  stagesBlock:    { gap: spacing.sm2 },
  stagesLabelRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  stagesLabel:    { ...textStyles.caps, color: th.colors.mutedLight, flexShrink: 1 },
  stagesLabelNum: { color: th.colors.text },
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
  // minWidth 16 = el ancho de la flecha ‹ que la sustituye al abrir la tarjeta.
  sesLetter: { ...textStyles.itemTitle, color: th.colors.accent, textAlign: 'center', minWidth: 16 },
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
  // "Sin límite de semanas" — fila propia porque el stepper no puede
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
