import { View, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform, StyleSheet, Animated, PanResponder } from 'react-native';
import { Text, TextInput } from '../components/ui/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Svg, { Circle } from 'react-native-svg';
import { useStore, ownerLogOf } from '../../store/useStore';
import { useWeightUnit } from '../hooks/useWeightUnit';
import ExerciseCard, { NoteIcon } from '../components/workout/ExerciseCard';
import { HEADER_RULE_H, HeaderRule } from '../components/ui/ScreenHeader';
import { ArrowIcon } from '../components/ui/EditorIcons';
import SupersetBlock from '../components/workout/SupersetBlock';
import ConditioningBlockCard from '../components/workout/ConditioningBlockCard';
import NotesModal from '../components/workout/NotesModal';
import DragSheet from '../components/DragSheet';
import NavScrim from '../components/ui/NavScrim';
import SheetRow from '../components/ui/SheetRow';
import { Section } from '../components/ui/MenuList';
import { ROW_ICON } from '../components/ui/rowIcons';
import { spacing, textStyles, borders, withOpacity, lh } from '../theme';
import { useTheme, useThemedStyles } from '../useTheme';
import { formatSeconds } from '../utils/formatters';
import { defaultBlock } from '../utils/conditioningBlocks';
import { prevBlockResult } from '../utils/sessionRecap';
import { recentExerciseRefs } from '../utils/exerciseLinks';
import { isExerciseDone } from '../utils/exerciseStatus';
import { sessionSlots } from '../utils/sessionSlots';
import { useElapsedText } from '../components/ui/useElapsedText';
import AdHocTargetSheet from '../components/workout/AdHocTargetSheet';
import { backToMain } from '../navigation/navigationRef';
import Reanimated, { SlideInRight, Easing } from 'react-native-reanimated';

// Al abrir la sesión los ejercicios entran como tarjetas, de derecha a
// izquierda desde fuera de la pantalla y sin fundido, uno tras otro
// (U10-todo-pesa.md §7). Solo al montar: volver al Workout desde una pantalla
// apilada encima no lo remonta, y lo que se añade luego no va en esta lista.
// El primero espera a que la pantalla casi haya entrado: sin espera llegaba
// pegado a la cabecera.
const cardIn = (i) => SlideInRight
  .duration(360)
  .easing(Easing.bezier(0.35, 0, 0.15, 1))
  .delay(100 + 200 * i);


// ── Global "active set" pointer ───────────────────────────────────────────────
// Only one set in the whole workout screen is "active" (highlight) at a time,
// following real training order: exercise 1 → 2 → …, and within a superset
// group, interleaved by round (A1-S1, A2-S1, A1-S2, A2-S2, …) since that's how
// rest actually works for supersets (toggleSetDone rests only on the last
// member of the chain). Ad-hoc exercises come last, in the order they were added.

function buildActiveSlots(exerciseGroups, adHocExercises) {
  const slots = [];
  for (const group of exerciseGroups) {
    if (group.length === 1) {
      const { exConfig, setsState } = group[0];
      setsState.forEach((s, i) => slots.push({ exerciseId: exConfig.exerciseId, setIndex: i, done: s.done }));
    } else {
      const maxLen = Math.max(...group.map((g) => g.setsState.length));
      for (let round = 0; round < maxLen; round++) {
        for (const { exConfig, setsState } of group) {
          if (round < setsState.length) {
            slots.push({ exerciseId: exConfig.exerciseId, setIndex: round, done: setsState[round].done });
          }
        }
      }
    }
  }
  for (const adHoc of adHocExercises ?? []) {
    adHoc.setsState.forEach((s, i) => slots.push({ exerciseId: adHoc.exerciseId, setIndex: i, done: s.done }));
  }
  return slots;
}

function computeActiveSet(slots, afterExerciseId = null, afterSetIndex = -1) {
  let startPos = 0;
  if (afterExerciseId != null) {
    const idx = slots.findIndex((s) => s.exerciseId === afterExerciseId && s.setIndex === afterSetIndex);
    if (idx >= 0) startPos = idx + 1;
  }
  for (let i = startPos; i < slots.length; i++) {
    if (!slots[i].done) return { exerciseId: slots[i].exerciseId, setIndex: slots[i].setIndex };
  }
  return null;
}

// ── Ceja de la cabecera ───────────────────────────────────────────────────────
// "SESIÓN A · 07:36", con el reloj en accent. Vive en su propio componente (no
// en WorkoutScreen) para que el tick de 1s sólo repinte este texto y no toda la
// pantalla.

function HeaderEyebrow({ startedAt, label, styles, style }) {
  const elapsed = useElapsedText(startedAt);
  return (
    <Text style={[styles.eyebrowText, style]} numberOfLines={1}>
      {label}
      {elapsed ? <Text style={styles.eyebrowClock}>{` · ${elapsed}`}</Text> : null}
    </Text>
  );
}

// ── Floating rest timer ───────────────────────────────────────────────────────

const RING_SIZE      = 64;
const RING_RADIUS    = 26;
const CIRCUMFERENCE  = 2 * Math.PI * RING_RADIUS; // ≈ 163.4
const SWIPE_THRESHOLD = 80;

// Alto de la barra de cabecera, sin la regla: `space/md` arriba y abajo más el
// bloque de ceja + nombre. Sólo se usa para el desplazamiento del teclado.
//
// Aquí había además cuatro constantes de colapso (grande/compacta y los dos
// umbrales de histéresis): la cabecera desplegada medía 68 y la compacta 38, y
// el crossfade entre las dos justificaba su existencia. Con la barra de 56 ya no
// hay nada que colapsar — se fueron con él.
const HEADER_H = 56;

function RestTimerFloat({ timer, onStop, bottomOffset }) {
  const { t }      = useTranslation();
  const th         = useTheme();
  const styles     = useThemedStyles(makeStyles);
  const translateX = useRef(new Animated.Value(0)).current;
  const opacity    = useRef(new Animated.Value(0)).current;

  // Slide in/out when timer activates/deactivates
  useEffect(() => {
    if (timer.active) {
      translateX.setValue(0);
      Animated.timing(opacity, {
        toValue: 1, duration: 250, useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(opacity, {
        toValue: 0, duration: 200, useNativeDriver: true,
      }).start();
    }
  }, [timer.active]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  (_, gs) => Math.abs(gs.dx) > 5,
      onPanResponderMove: (_, gs) => {
        if (gs.dx > 0) {
          translateX.setValue(gs.dx);
          opacity.setValue(Math.max(0, 1 - gs.dx / 160));
        }
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dx > SWIPE_THRESHOLD) {
          Animated.parallel([
            Animated.timing(translateX, { toValue: 500, duration: 220, useNativeDriver: true }),
            Animated.timing(opacity,    { toValue: 0,   duration: 220, useNativeDriver: true }),
          ]).start(() => onStop());
        } else {
          Animated.parallel([
            Animated.spring(translateX, { toValue: 0, useNativeDriver: true, tension: 80 }),
            Animated.timing(opacity,    { toValue: 1, duration: 120, useNativeDriver: true }),
          ]).start();
        }
      },
    })
  ).current;

  const progress    = timer.total > 0 ? timer.remaining / timer.total : 0;
  const dashOffset  = CIRCUMFERENCE * (1 - progress);

  return (
    <Animated.View
      pointerEvents={timer.active ? 'auto' : 'none'}
      style={[
        styles.timerFloat,
        { bottom: bottomOffset, transform: [{ translateX }], opacity },
      ]}
      {...panResponder.panHandlers}
    >
      {/* Ring + countdown */}
      <View style={styles.timerRingWrap}>
        <Svg
          width={RING_SIZE}
          height={RING_SIZE}
          style={{ transform: [{ rotate: '-90deg' }] }}
        >
          <Circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_RADIUS}
            stroke={withOpacity(th.colors.accent, 0.18)}
            strokeWidth={3.5}
            fill="none"
          />
          <Circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_RADIUS}
            stroke={th.colors.accent}
            strokeWidth={3.5}
            fill="none"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
          />
        </Svg>
        <Text style={styles.timerCountdown}>{formatSeconds(timer.remaining)}</Text>
      </View>

      {/* Exercise name */}
      <Text style={styles.timerExName} numberOfLines={2}>{timer.exerciseName}</Text>

      {/* Skip */}
      <TouchableOpacity style={styles.timerSkipBtn} onPress={onStop} hitSlop={8}>
        <Text style={styles.timerSkipText}>{t('restTimer.skip')}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}


// ── Screen ─────────────────────────────────────────────────────────────────────

export default function WorkoutScreen() {
  const insets     = useSafeAreaInsets();
  const navigation = useNavigation();
  const { t, i18n } = useTranslation();
  const th         = useTheme();
  const styles     = useThemedStyles(makeStyles);

  const [notesOpen, setNotesOpen] = useState(false);
  // Sesión libre: añadir/editar bloques sin pasar por el editor de sesión.
  const [addSheetOpen, setAddSheetOpen]   = useState(false);
  // Ejercicio ad-hoc cuya línea de objetivo se ha pulsado.
  const [editingAdHoc, setEditingAdHoc]   = useState(null);

  // Store state
  const activeSession      = useStore((s) => s.activeSession);
  const sessionTemplates   = useStore((s) => s.sessionTemplates);
  const exerciseLibrary    = useStore((s) => s.exerciseLibrary);
  const customExercises    = useStore((s) => s.customExercises);
  // El historial del dueño del entreno: el mío o el del cliente sin app para
  // el que apunto (C05-trainer-logging.md §3.3). De ahí salen los pesos de la
  // última vez y la progresión.
  const workoutLog         = useStore((s) => ownerLogOf(s));
  const clientName         = useStore((s) => (
    s.activeSession.forClient ? s.clients[s.activeSession.forClient]?.name ?? '' : null
  ));
  const clientSync         = useStore((s) => s.clientSync);
  const restTimer          = useStore((s) => s.ui.restTimer);

  // Store actions
  const updateSetField        = useStore((s) => s.updateSetField);
  const toggleSetDone         = useStore((s) => s.toggleSetDone);
  const addSetToSession       = useStore((s) => s.addSetToSession);
  const addDropToLastSet      = useStore((s) => s.addDropToLastSet);
  const updateDropField       = useStore((s) => s.updateDropField);
  const toggleDropDone        = useStore((s) => s.toggleDropDone);
  const removeDropFromLastSet = useStore((s) => s.removeDropFromLastSet);
  const updateSessionNotes    = useStore((s) => s.updateSessionNotes);
  const saveSession           = useStore((s) => s.saveSession);
  const discardSession        = useStore((s) => s.discardSession);
  const stopRestTimer         = useStore((s) => s.stopRestTimer);
  const showToast             = useStore((s) => s.showToast);
  const syncSessionSets       = useStore((s) => s.syncSessionSets);
  const updateAdHocSet        = useStore((s) => s.updateAdHocSet);
  const toggleAdHocSetDone    = useStore((s) => s.toggleAdHocSetDone);
  const addAdHocSet           = useStore((s) => s.addAdHocSet);
  const setAdHocConfig        = useStore((s) => s.setAdHocConfig);
  const setAdHocSets          = useStore((s) => s.setAdHocSets);
  const updateFreeSessionName = useStore((s) => s.updateFreeSessionName);
  const setExerciseNote       = useStore((s) => s.setExerciseNote);
  const addBlockToSession     = useStore((s) => s.addBlockToSession);
  const startBlock            = useStore((s) => s.startBlock);
  const updateBlockState      = useStore((s) => s.updateBlockState);
  const finishBlock           = useStore((s) => s.finishBlock);
  const resetBlock            = useStore((s) => s.resetBlock);

  // Free session flag
  const isFree = activeSession.templateId === '__free__';

  // Derive template + exercises
  const template = sessionTemplates[activeSession.templateId];
  const allExercises = { ...exerciseLibrary, ...customExercises };

  // Bloques de la sesión libre: no hay plantilla donde guardarlos, viven en la
  // propia sesión y se pintan al final, en el orden en que se añadieron.
  const freeBlocks = isFree ? (activeSession.freeBlocks ?? []) : [];

  // Sync setsState when template exercises change (e.g. after editing the program)
  useEffect(() => {
    syncSessionSets();
  }, [template?.exercises]);

  // Trainer's one-off prescription for this session (if any), keyed by exercise.
  const sessionOverride = clientSync.pendingOverrides?.[activeSession.templateId] ?? null;

  // Linked exercises read the group's latest performance (any session of the
  // group); unlinked ones keep the same-template reference.
  // Suscrito, no `getState()`: si el entrenador manda una versión nueva del
  // programa mientras la sesión está abierta —`checkAndPullProgramUpdates` corre
  // al volver a primer plano— las referencias de ejercicios vinculados se
  // quedaban obsoletas hasta remontar la pantalla. El ternario va DENTRO del
  // selector para que el hook se llame siempre.
  const ownerProgram = useStore((s) => (template?.programId ? s.programs[template.programId] : null));
  const getEffectiveTemplate = (tid) => sessionTemplates[tid];

  const exercises = (template?.exercises ?? []).map((exConfig) => {
    // Vinculado → el histórico del grupo; si no, el de esta sesión Y el de las
    // etapas de las que desciende: entrar en una etapa nueva no puede dejar al
    // cliente sin chip ni sin pesos de referencia (spec stage-planner §4.1).
    // Las tres últimas: la primera es la de hoy; Por esfuerzo promedia las tres
    // (progresion-clara §6.5).
    const recentSessions = recentExerciseRefs({
      workoutLog,
      program:    ownerProgram,
      templateId: activeSession.templateId,
      exConfig,
      getTemplate: getEffectiveTemplate,
    }, 3);
    return {
      exConfig,
      def:         allExercises[exConfig.exerciseId],
      setsState:   activeSession.setsState[exConfig.exerciseId] ?? [],
      lastExercise: recentSessions[0]?.exercise ?? null,
      recentSessions,
      overrideEx:  sessionOverride?.exercises?.[exConfig.exerciseId] ?? null,
    };
  });

  // Orden de pantalla: el MISMO que pinta el editor de sesión, bloques de
  // acondicionamiento mezclados incluidos (ver `utils/sessionSlots.js`). Antes
  // los bloques iban siempre al final; ahora su sitio lo decide el usuario al
  // reordenar, y aquí solo se respeta.
  const byId = new Map(exercises.map((it) => [it.exConfig.exerciseId, it]));
  const workSlots = sessionSlots(template).map((slot) => (
    slot.kind === 'block'
      ? slot
      : { ...slot, items: slot.members.map((ex) => byId.get(ex.exerciseId)).filter(Boolean) }
  )).filter((slot) => slot.kind === 'block' || slot.items.length > 0);
  const exerciseGroups = workSlots.filter((s) => s.kind === 'ex').map((s) => s.items);

  // Puntos de progreso del header (§4.3): 1 unidad por ejercicio de fuerza
  // (miembros de superserie incluidos, aplanados) + 1 por ad-hoc + 1 por bloque
  // de acondicionamiento, en orden de pantalla. Mismo criterio de "completo"
  // que el auto-colapso de ExerciseCard (isExerciseDone).
  const dotUnits = [
    ...workSlots.flatMap((slot) => (
      slot.kind === 'block'
        ? [{ id: slot.block.id, done: activeSession.blockState?.[slot.block.id]?.finishedAt != null }]
        : slot.items.map(({ exConfig, setsState }) => ({
            id:   exConfig.exerciseId,
            done: isExerciseDone(exConfig, setsState),
          }))
    )),
    ...(activeSession.adHocExercises ?? []).map((a) => ({
      id:   a.exerciseId,
      done: a.setsState.length > 0 && a.setsState.every((s) => s.done),
    })),
    ...freeBlocks.map((b) => ({
      id:   b.id,
      done: activeSession.blockState?.[b.id]?.finishedAt != null,
    })),
  ];

  // Misma tarjeta para los bloques de plantilla y los de la sesión libre; sólo
  // estos últimos son editables desde aquí (los otros se editan en su editor).
  function renderBlock(block, orderNumber) {
    return (
      <ConditioningBlockCard
        key={block.id}
        block={block}
        state={activeSession.blockState?.[block.id] ?? null}
        allExercises={allExercises}
        orderNumber={orderNumber}
        lastResult={prevBlockResult(
          { id: null, sessionTemplateId: activeSession.templateId, timestamp: Infinity },
          workoutLog, block.id,
        )}
        onStart={() => startBlock(block.id)}
        onUpdate={(patch) => updateBlockState(block.id, patch)}
        onFinish={() => finishBlock(block.id)}
        onReset={() => resetBlock(block.id)}
        onEdit={isFree ? () => editFreeBlock(block.id) : undefined}
      />
    );
  }

  function handleAddExercise() {
    navigation.navigate('ExerciseSelector', {
      sessionMode: true,
      eyebrow: sessionLabel,
      existingPatterns: (template?.exercises ?? [])
        .map((e) => allExercises[e.exerciseId]?.pattern)
        .filter(Boolean),
    });
  }

  // El bloque de la sesión libre se edita en la pantalla del editor de sesión,
  // con `'__free__'` por plantilla (sus bloques viven en `activeSession.freeBlocks`).
  function editFreeBlock(blockId) {
    navigation.navigate('BlockEditor', { templateId: '__free__', blockId });
  }

  function handleAddBlock() {
    const block = defaultBlock();
    addBlockToSession('__free__', block);
    editFreeBlock(block.id);
  }

  // Global active-set pointer (highlight) — recalculated when the "shape" of
  // the session changes (sets/exercises added or removed), preserved otherwise.
  // Adjust-during-render idiom (React docs: "You Might Not Need an Effect")
  // instead of useEffect, so this also covers the initial mount for free.
  const [activePointer, setActivePointer] = useState(null);
  const [lastShapeKey, setLastShapeKey] = useState(null);
  const shapeKey = [
    ...exerciseGroups.flat().map((g) => `${g.exConfig.exerciseId}:${g.setsState.length}`),
    ...(activeSession.adHocExercises ?? []).map((a) => `${a.exerciseId}:${a.setsState.length}`),
  ].join('|');
  if (shapeKey !== lastShapeKey) {
    setLastShapeKey(shapeKey);
    setActivePointer((prev) => {
      const slots = buildActiveSlots(exerciseGroups, activeSession.adHocExercises);
      const stillValid = prev && slots.some(
        (s) => s.exerciseId === prev.exerciseId && s.setIndex === prev.setIndex && !s.done
      );
      return stillValid ? prev : computeActiveSet(slots);
    });
  }

  function handleToggleDone(exerciseId, setIdx) {
    const result = toggleSetDone(exerciseId, setIdx);
    if (!result?.changed) return;
    const slots = buildActiveSlots(exerciseGroups, activeSession.adHocExercises);
    setActivePointer(
      result.done
        ? computeActiveSet(slots, exerciseId, setIdx)
        : { exerciseId, setIndex: setIdx }
    );
  }
  function handleFieldChange(exerciseId, setIdx, field, value) {
    updateSetField(exerciseId, setIdx, field, value);
    const unit = exerciseGroups.flat().find((g) => g.exConfig.exerciseId === exerciseId);
    const wasDone = unit?.setsState[setIdx]?.done;
    if (!wasDone) setActivePointer({ exerciseId, setIndex: setIdx });
  }
  function handleAdHocToggleDone(exerciseId, setIdx) {
    const result = toggleAdHocSetDone(exerciseId, setIdx);
    if (!result?.changed) return;
    const slots = buildActiveSlots(exerciseGroups, activeSession.adHocExercises);
    setActivePointer(
      result.done
        ? computeActiveSet(slots, exerciseId, setIdx)
        : { exerciseId, setIndex: setIdx }
    );
  }
  function handleAdHocFieldChange(exerciseId, setIdx, field, value) {
    updateAdHocSet(exerciseId, setIdx, field, value);
    const unit = (activeSession.adHocExercises ?? []).find((a) => a.exerciseId === exerciseId);
    const wasDone = unit?.setsState[setIdx]?.done;
    if (!wasDone) setActivePointer({ exerciseId, setIndex: setIdx });
  }

  // Header content — sessionLabel/titleText cubren ambos modos (plantilla y
  // sesión libre); el reloj se concatena dentro de HeaderEyebrow/HeaderCompactSummary.
  // Una sesión libre GUARDADA va por el camino de plantilla (`isFree` es solo la
  // sobre la marcha), pero no tiene letra: se rotula como libre
  // (T06-free-sessions.md §6.3). Se renombra en el editor, no aquí.
  const isFreeTpl       = !isFree && !!template && !template.programId;
  const sessionLabel    = (isFree || isFreeTpl) ? t('freeSession.badge').toUpperCase() : t('workout.sessionLabel', { label: template?.label ?? '' });
  // Entreno de un cliente: la ceja dice de quién es, en el azul del
  // entrenador, y en modo registro también el día (§3.7).
  const loggedDay       = activeSession.logOnly && activeSession.loggedAt
    ? new Date(activeSession.loggedAt).toLocaleDateString(i18n.language, { weekday: 'short', day: 'numeric' })
    : null;
  const eyebrowLabel    = clientName != null
    ? [clientName, sessionLabel, loggedDay].filter(Boolean).join(' · ')
    : sessionLabel;
  const titleText       = isFree
    ? (activeSession.freeSessionName ?? '')
    : (isFreeTpl ? (template.name || t('freeSession.templateUnnamed')) : (template?.name ?? ''));
  const hasSessionNotes = (activeSession.notes?.trim().length ?? 0) > 0;

  function handleGoBack() {
    // When the app is killed mid-workout and relaunched, Workout is set as the
    // initial route (no back stack). goBack() would fail silently in that case.
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      backToMain(navigation, { screen: 'Home' });
    }
  }

  function handleSave() {
    // Se lee antes: guardar vacía la sesión en curso.
    const clientId = activeSession.forClient ?? null;
    const result = saveSession();
    if (!result.ok) { showToast(result.error, 2200, 'error'); return; }
    // The recap IS the confirmation — replace so back can't return to the
    // (now empty) workout screen.
    navigation.replace('SessionRecap', { entryId: result.entryId, clientId });
  }

  function handleDiscard() {
    discardSession(); // stops timer, resets session, navigates home via store ref
  }

  if (!template && !isFree) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Text style={styles.errorText}>{t('workout.noActiveSession')}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header — sticky, fuera del ScrollView. Mismo lenguaje que
          `ScreenHeader` (barra de 56, ceja gris con el nombre debajo, botón de
          volver en caja, regla segmentada) pero componente propio: aquí la ceja
          lleva un reloj que repinta cada segundo y el título de una sesión
          libre es un campo de texto. */}
      <View style={styles.headerWrap}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleGoBack} style={styles.backBtn} hitSlop={10} activeOpacity={0.7}>
            <ArrowIcon size={15} color={th.colors.accent} back />
          </TouchableOpacity>

          <View style={styles.headerMid}>
            <HeaderEyebrow
              // Modo registro: sin reloj, que no mediría nada (§3.4).
              startedAt={activeSession.logOnly ? null : activeSession.startedAt}
              label={eyebrowLabel}
              styles={styles}
              style={clientName != null && { color: th.colors.blue }}
            />
            {isFree ? (
              <TextInput
                style={styles.freeNameInputHeader}
                value={activeSession.freeSessionName ?? ''}
                onChangeText={updateFreeSessionName}
                placeholder={t('freeSession.namePlaceholder')}
                placeholderTextColor={th.colors.mutedLight}
                returnKeyType="done"
                maxLength={60}
              />
            ) : (
              <Text style={styles.headerTitle} numberOfLines={1}>{titleText}</Text>
            )}
          </View>

          <TouchableOpacity onPress={() => setNotesOpen(true)} hitSlop={12} style={styles.headerAction}>
            <NoteIcon
              size={22}
              color={hasSessionNotes ? th.colors.accent : th.colors.mutedLight}
            />
          </TouchableOpacity>
        </View>

        {/* La regla que cierra la cabecera lleva el progreso: un segmento por
            ejercicio o bloque. Misma pieza que el paso del onboarding. */}
        <HeaderRule progress={dotUnits.map((u) => u.done)} />
      </View>

      {/* Exercise list */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top + HEADER_H + HEADER_RULE_H + spacing.md}
      >
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: spacing.xxl + insets.bottom }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Free session info text */}
          {isFree && <Text style={styles.freeInfoText}>{t('freeSession.infoText')}</Text>}

          {workSlots.map((slot, slotIdx) => {
            // Numeración por hueco, igual que en el editor de sesión: un bloque
            // de acondicionamiento ocupa su número y lo pinta, así los números
            // coinciden entre las dos pantallas.
            const orderNumber = String(slotIdx + 1).padStart(2, '0');
            if (slot.kind === 'block') return renderBlock(slot.block, orderNumber);
            const group = slot.items;
            const isSuperset = group.length > 1;
            const cards = group.map(({ exConfig, def, setsState, lastExercise, recentSessions, overrideEx }, idx) => (
              <ExerciseCard
                key={exConfig.exerciseId}
                exConfig={exConfig}
                def={def}
                setsState={setsState}
                lastExercise={lastExercise}
                recentSessions={recentSessions}
                overrideEx={overrideEx}
                // Superserie: mismo número de ejercicio, cambia la letra (03A / 03B).
                groupLetter={isSuperset ? String.fromCharCode(65 + idx) : undefined}
                orderNumber={orderNumber}
                // Costura del par: la primera card mantiene sus esquinas superiores
                // a 16 y aplana las inferiores; la última al revés.
                groupPos={!isSuperset ? undefined
                  : idx === 0 ? 'first'
                  : idx === group.length - 1 ? 'last'
                  : 'mid'}
                hideAddSetBtn={isSuperset}
                activeSetIndex={activePointer?.exerciseId === exConfig.exerciseId ? activePointer.setIndex : -1}
                onFieldChange={(setIdx, field, value) =>
                  handleFieldChange(exConfig.exerciseId, setIdx, field, value)
                }
                onToggleDone={(setIdx) => handleToggleDone(exConfig.exerciseId, setIdx)}
                onAddSet={() => addSetToSession(exConfig.exerciseId)}
                onAddDrop={() => addDropToLastSet(exConfig.exerciseId)}
                onDropFieldChange={(dropIdx, field, value) =>
                  updateDropField(exConfig.exerciseId, dropIdx, field, value)
                }
                onToggleDropDone={(dropIdx) => toggleDropDone(exConfig.exerciseId, dropIdx)}
                onRemoveDrop={(dropIdx) => removeDropFromLastSet(exConfig.exerciseId, dropIdx)}
                trainerName={template?.trainerName}
                clientNote={activeSession.exerciseNotes?.[exConfig.exerciseId] ?? ''}
                onClientNoteChange={(text) => setExerciseNote(exConfig.exerciseId, text)}
              />
            ));
            if (!isSuperset) return cards[0];
            const rounds  = Math.max(...group.map((g) => g.exConfig.sets ?? 0));
            const restSec = group[group.length - 1].exConfig.restSec ?? 90;
            return (
              <SupersetBlock
                key={group[0].exConfig.exerciseId}
                rounds={rounds}
                restSec={restSec}
                onAddSet={() => group.forEach((g) => addSetToSession(g.exConfig.exerciseId))}
              >
                {cards}
              </SupersetBlock>
            );
          }).map((node, i) => (
            <Reanimated.View key={node.key} entering={cardIn(i)}>{node}</Reanimated.View>
          ))}

          {/* Ad-hoc exercises added during this session — continúan la numeración */}
          {(activeSession.adHocExercises ?? []).map((adHoc, adHocIdx) => {
            const def = allExercises[adHoc.exerciseId];
            // Los valores por defecto siguen saliendo de la biblioteca; encima
            // va lo que el usuario haya tocado en la hoja de objetivo. `sets`
            // no se guarda: es `setsState.length` y punto.
            const adHocConfig = {
              exerciseId: adHoc.exerciseId,
              sets:       adHoc.setsState.length,
              minReps:    def?.minReps ?? 8,
              maxReps:    def?.maxReps ?? 12,
              restSec:    def?.restSec ?? 90,
              isKey:      false,
              ...(adHoc.config ?? {}),
            };
            return (
              <ExerciseCard
                key={adHoc.exerciseId}
                exConfig={adHocConfig}
                def={def}
                setsState={adHoc.setsState}
                lastExercise={null}
                orderNumber={String(workSlots.length + adHocIdx + 1).padStart(2, '0')}
                activeSetIndex={activePointer?.exerciseId === adHoc.exerciseId ? activePointer.setIndex : -1}
                onFieldChange={(setIdx, field, value) =>
                  handleAdHocFieldChange(adHoc.exerciseId, setIdx, field, value)
                }
                onToggleDone={(setIdx) => handleAdHocToggleDone(adHoc.exerciseId, setIdx)}
                onAddSet={() => addAdHocSet(adHoc.exerciseId)}
                onEditTarget={() => setEditingAdHoc(adHoc.exerciseId)}
                clientNote={activeSession.exerciseNotes?.[adHoc.exerciseId] ?? ''}
                onClientNoteChange={(text) => setExerciseNote(adHoc.exerciseId, text)}
              />
            );
          })}

          {/* Bloques creados durante la sesión libre — continúan la numeración */}
          {freeBlocks.map((block, i) => renderBlock(
            block,
            String(workSlots.length + (activeSession.adHocExercises?.length ?? 0) + i + 1).padStart(2, '0'),
          ))}

          {/* Añadir — en la libre abre la hoja (ejercicio o bloque), porque no
              pasa por el editor de sesión; en una de plantilla va directa al
              selector, que es lo único que se puede añadir sobre la marcha. */}
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => (isFree ? setAddSheetOpen(true) : handleAddExercise())}
            activeOpacity={0.7}
          >
            <Text style={styles.addBtnText}>
              <Text style={styles.addBtnPlus}>+</Text>
              {` ${isFree ? t('editor.addSheetTitle') : t('workout.addExercise')}`}
            </Text>
          </TouchableOpacity>

          {/* Save button */}
          <TouchableOpacity
            style={styles.saveBtn}
            onPress={handleSave}
            activeOpacity={0.85}
          >
            <Text style={styles.saveBtnText}>{t('workout.saveSession').toUpperCase()}</Text>
          </TouchableOpacity>

          {/* Discard */}
          <TouchableOpacity style={styles.discardBtn} onPress={handleDiscard}>
            <Text style={styles.discardText}>{t('workout.discardSession')}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Notes modal */}
      <NotesModal
        visible={notesOpen}
        title={t('workout.sessionNotes')}
        value={activeSession.notes ?? ''}
        onChange={updateSessionNotes}
        onClose={() => setNotesOpen(false)}
        placeholder={t('workout.notesPlaceholder')}
        hint={t('workout.notesSavedWith')}
      />

      {/* Hoja de "añadir" de la sesión libre — mismas opciones que el editor */}
      <DragSheet visible={addSheetOpen} onClose={() => setAddSheetOpen(false)} title={t('editor.addSheetTitle')}>
        {/* Las mismas dos filas que la hoja «Añadir» del editor de sesión. */}
        <Section style={styles.sheetSection}>
          {/* Se cierra al instante y no con la animación: la hoja es un Modal
              y la pantalla que se abre debajo no debe esperar a que se vaya. */}
          <SheetRow icon={ROW_ICON.exercise} label={t('editor.addExerciseOption')} onPress={() => { setAddSheetOpen(false); handleAddExercise(); }} />
          <SheetRow icon={ROW_ICON.block}    label={t('editor.addBlockOption')}    onPress={() => { setAddSheetOpen(false); handleAddBlock(); }} />
        </Section>
      </DragSheet>

      {/* Objetivo de un ejercicio añadido sobre la marcha. Se cierra solo si el
          ejercicio desaparece (borrado desde la propia tarjeta). */}
      {(() => {
        const ex = (activeSession.adHocExercises ?? []).find((a) => a.exerciseId === editingAdHoc);
        if (!ex) return null;
        const def = allExercises[ex.exerciseId];
        return (
          <AdHocTargetSheet
            def={def}
            name={def ? (i18n.language === 'en' ? (def.nameEn ?? def.name) : def.name) : ex.exerciseId}
            sets={ex.setsState.length}
            config={ex.config}
            onSets={(n) => setAdHocSets(ex.exerciseId, n)}
            onConfig={(patch) => setAdHocConfig(ex.exerciseId, patch)}
            onClose={() => setEditingAdHoc(null)}
          />
        );
      })()}

      {/* La lista pasa por debajo de los botones de Android (sin zona segura
          abajo, a propósito): un velo del color del fondo los despega del
          contenido. No captura toques. */}
      {insets.bottom > 0 && <NavScrim inset={insets.bottom} />}

      {/* Floating rest timer — sits above everything, swipe right to dismiss */}
      <RestTimerFloat
        timer={restTimer}
        onStop={stopRestTimer}
        bottomOffset={insets.bottom + 24}
      />
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const makeStyles = (th) => StyleSheet.create({
  container: {
    flex:            1,
    backgroundColor: th.colors.bg,
  },
  errorText: {
    ...textStyles.body,
    color:     th.colors.mutedLight,
    textAlign: 'center',
    marginTop: spacing.xxl,
  },

  // Floating rest timer
  timerFloat: {
    position:          'absolute',
    left:              spacing.lg,
    right:             spacing.lg,
    backgroundColor:   th.colors.surface,
    borderWidth:       borders.thin,
    borderColor:       th.colors.borderCard,
    borderRadius:      th.radius.lg,
    flexDirection:     'row',
    alignItems:        'center',
    paddingVertical:   spacing.sm,
    paddingHorizontal: spacing.md,
    gap:               spacing.md,
    // Shadow (iOS)
    shadowColor:       '#000',
    shadowOffset:      { width: 0, height: 4 },
    shadowOpacity:     0.35,
    shadowRadius:      12,
    // Elevation (Android)
    elevation:         10,
  },
  timerRingWrap: {
    width:          RING_SIZE,
    height:         RING_SIZE,
    alignItems:     'center',
    justifyContent: 'center',
  },
  timerCountdown: {
    ...textStyles.bodyStrong,
    position: 'absolute',
    color:    th.colors.text,
  },
  timerExName: {
    ...textStyles.label,
    flex:       1,
    color:      th.colors.text,
    lineHeight: lh(textStyles.label.fontSize),
  },
  timerSkipBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical:   spacing.xs + 2,
    borderRadius:      th.radius.sm,
    borderWidth:       borders.thin,
    borderColor:       withOpacity(th.colors.accent, 0.35),
    backgroundColor:   withOpacity(th.colors.accent, 0.08),
  },
  timerSkipText: { ...textStyles.label, color: th.colors.accent },

  // Header — mismo lenguaje que `ScreenHeader` (barra de 56 sobre el fondo de
  // la app, ceja gris, nombre debajo, botón de volver en caja y regla
  // segmentada), pero componente propio: éste lleva un reloj vivo y el nombre
  // editable de la sesión libre. Lo que se comparte es el estilo y `HeaderRule`,
  // no el componente.
  //
  // El wrap existe para que la regla llegue a sangre a los dos bordes mientras
  // la fila mantiene su margen lateral, y para el gap con el contenido.
  headerWrap: {
    backgroundColor: th.colors.bg,
    marginBottom:    spacing.md,  // gap header→contenido
  },
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical:   spacing.md,
  },
  backBtn: {
    width:           32,
    height:          32,
    borderRadius:    th.radius.md,
    backgroundColor: th.colors.surface2,
    alignItems:      'center',
    justifyContent:  'center',
  },
  // Centrado, como `ScreenHeader`: el bloque se centra dentro de `headerMid` y
  // el hueco de la nota mide lo que el botón de volver para que ese centro sea
  // el de la barra.
  headerMid:    { flex: 1, minWidth: 0, alignItems: 'center' },
  headerAction: { width: 32, alignItems: 'flex-end' },
  // Misma ceja que `ScreenHeader`: `card-type` tal cual, en `accent`. Aquí lleva
  // además el reloj, que ya iba en accent y ahora se funde con ella en una sola
  // línea: lo que lo separa es la cifra tabular, no el color.
  eyebrowText: {
    ...textStyles.caps,
    color:         th.colors.accent,
    textTransform: 'uppercase',
  },
  eyebrowClock: {
    color:         th.colors.accent,
    letterSpacing: 0,
    fontVariant:   ['tabular-nums'],
  },
  headerTitle: {
    ...textStyles.heading,
    color:     th.colors.text,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  freeNameInputHeader: {
    ...textStyles.heading,
    color:     th.colors.text,
    marginTop: spacing.xs,
    padding:   0,
    alignSelf: 'stretch',
    textAlign: 'center',
  },
  // Texto explicativo de la sesión libre: sin caja, tipografía de la app
  // (text/subtitle) y en mutedLight — es contexto, no un aviso.
  freeInfoText: {
    ...textStyles.body,
    color:      th.colors.mutedLight,
    lineHeight: 18,
    textAlign:  'center',
  },
  // Content — margen lateral = página (spacing.lg, igual que headerWrap);
  // el gap superior lo aporta headerWrap.marginBottom, no padding propio aquí.
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom:     spacing.xxl,
    gap:               spacing.md,
  },

  // Añadir — mismo botón que el editor de sesión (210:2784)
  addBtn:     { alignItems: 'center', paddingVertical: spacing.md },
  addBtnText: { ...textStyles.button, color: th.tint.accent50 },
  addBtnPlus: { color: th.colors.accent },

  // Hoja de "añadir" de la sesión libre
  sheetSection: { marginBottom: spacing.sm },

  // Save / discard
  saveBtn: {
    borderRadius:    th.radius.md,
    paddingVertical: spacing.md + 4,
    alignItems:      'center',
    marginTop:       spacing.sm,
    backgroundColor: th.colors.accent,
  },
  saveBtnText: { ...textStyles.button, color: th.colors.onAccent },
  discardBtn: {
    alignItems:      'center',
    paddingVertical: spacing.md,
  },
  // Tertiary buttom (235:4760) — solo texto, `caps`, uppercase, rojo (acción destructiva)
  discardText: {
    ...textStyles.caps,
    color:         th.tint.red50,
    textTransform: 'uppercase',
  },
});
