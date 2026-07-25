import {
  View, Text, ScrollView, TouchableOpacity,
  TextInput, KeyboardAvoidingView,
  Platform, StyleSheet, Animated, PanResponder,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Svg, { Circle, Path, Defs, LinearGradient as SvgLinearGradient, Stop, Rect } from 'react-native-svg';
import Reanimated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';
import { useStore } from '../../store/useStore';
import { useWeightUnit } from '../hooks/useWeightUnit';
import ExerciseCard, { NoteIcon } from '../components/workout/ExerciseCard';
import SupersetBlock from '../components/workout/SupersetBlock';
import ConditioningBlockCard from '../components/workout/ConditioningBlockCard';
import NotesModal from '../components/workout/NotesModal';
import { spacing, typography, textStyles, borders, withOpacity } from '../theme';
import { useTheme, useThemedStyles } from '../useTheme';
import { formatSeconds } from '../../../src/utils/formatters';
import { linkGroupTemplateIds, lastLinkedExercise } from '../../../src/utils/exerciseLinks';
import { isExerciseDone } from '../utils/exerciseStatus';

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

// ── Elapsed session clock ─────────────────────────────────────────────────────
// Derived from activeSession.startedAt (wall clock), so it survives app
// minimize/kill without any background logic — the tick only repaints whichever
// small text component uses the hook, not the whole screen.

function useElapsedText(startedAt) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!startedAt) return;
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [startedAt]);
  if (!startedAt) return null;
  const s  = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return hh > 0
    ? `${hh}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
    : `${mm}:${String(ss).padStart(2, '0')}`;
}

// ── Session header (sticky, 2 states) ─────────────────────────────────────────
// Grande: eyebrow "SESIÓN A · 07:36" + título + dots. Compacta: una fila
// "07:36 · Nombre" + dots. El reloj vive DENTRO de estos 2 componentes (no en
// WorkoutScreen) para que el tick de 1s sólo repinte el texto pequeño, no toda
// la pantalla.

function HeaderEyebrow({ startedAt, label, styles }) {
  const elapsed = useElapsedText(startedAt);
  return (
    <Text style={styles.eyebrowText} numberOfLines={1}>
      {elapsed ? `${label} · ${elapsed}` : label}
    </Text>
  );
}

function HeaderCompactSummary({ startedAt, title, styles }) {
  const elapsed = useElapsedText(startedAt);
  return (
    <Text style={styles.compactSummary} numberOfLines={1}>
      {elapsed ? `${elapsed} · ${title}` : title}
    </Text>
  );
}

// Icons/Arrow (98:137) — chevron path, redibujado con react-native-svg (mismo
// enfoque que el Chevron de SetRow.jsx). Figma lo rota 180°; replicamos la
// rotación porque el glifo es simétrico y el resultado final coincide.
function HeaderArrow({ size, th }) {
  const big = size >= 24;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg
        width={big ? 12 : 7.385}
        height={big ? 20 : 12.308}
        viewBox="0 0 12 20"
        fill="none"
        style={{ transform: [{ rotate: '180deg' }] }}
      >
        <Path d="M0 0L5 0L12 10L5 20L0 20L7 10L0 0Z" fill={th.colors.onAccent} />
      </Svg>
    </View>
  );
}

// Puntos de progreso (§4.3 de la guía) — relleno onAccent sólido = completo,
// anillo onAccent translúcido = pendiente (valores exactos del <circle> real:
// diámetro 6, Ellipse24=relleno sólido, Ellipse28=sólo borde). >7 unidades
// encoge el gap en vez de hacer wrap/scroll (decisión de esta implementación).
// `size` encoge en la cabecera compacta (igual que el icono de notas y la flecha).
function ProgressDots({ units, th, styles, size = 6 }) {
  if (units.length === 0) return null;
  const gap = units.length <= 7 ? spacing.sm : units.length <= 12 ? spacing.xs2 : spacing.xs;
  return (
    <View style={[styles.dotsRow, { gap }]}>
      {units.map((u) => (
        <View
          key={u.id}
          style={[
            { width: size, height: size, borderRadius: size / 2, borderWidth: 1 },
            u.done
              ? { backgroundColor: th.colors.onAccent, borderColor: th.colors.onAccent }
              : { backgroundColor: 'transparent', borderColor: withOpacity(th.colors.onAccent, 0.4) },
          ]}
        />
      ))}
    </View>
  );
}

// ── Floating rest timer ───────────────────────────────────────────────────────

const RING_SIZE      = 64;
const RING_RADIUS    = 26;
const CIRCUMFERENCE  = 2 * Math.PI * RING_RADIUS; // ≈ 163.4
const SWIPE_THRESHOLD = 80;

// SesionHeader (110:3692) — grande 64px / colapsada 36.71px (valores exactos
// de Figma, no tokenizados).
const HEADER_GRANDE_H  = 64;
const HEADER_COMPACT_H = 36.71;
const HEADER_COMPACT_ON  = 48; // scrollY a partir del cual colapsa
const HEADER_COMPACT_OFF = 24; // scrollY por debajo del cual vuelve a grande

// Alto fijo de la fila del eyebrow y de la fila de dots en la cabecera grande —
// iguales a propósito para que el título quede exactamente centrado (la mitad
// superior del bloque eyebrow+título+dots debe pesar igual que la inferior).
const HEADER_ROW_H = 14;

// Puntos de progreso — mismo tamaño en las 2 cabeceras (pedido explícito).
const DOT_SIZE = 8;

// Fundido del contenido bajo la cabecera sticky (evita el corte seco al hacer scroll).
const SCROLL_FADE_H = 20;

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
  const { t }      = useTranslation();
  const th         = useTheme();
  const styles     = useThemedStyles(makeStyles);

  const [notesOpen, setNotesOpen] = useState(false);

  // Cabecera sticky — 2 estados con histéresis (§4.2 de la guía): compacta a
  // partir de HEADER_COMPACT_ON, vuelve a grande por debajo de HEADER_COMPACT_OFF.
  // El crossfade usa Reanimated; se salta la animación en el montaje inicial
  // (mismo patrón que SegmentedControl.jsx).
  const [compact, setCompact] = useState(false);
  const compactProgress   = useSharedValue(0);
  const compactMountedRef = useRef(false);
  useEffect(() => {
    if (!compactMountedRef.current) { compactMountedRef.current = true; return; }
    compactProgress.value = withTiming(compact ? 1 : 0, { duration: 200, easing: Easing.inOut(Easing.ease) });
  }, [compact, compactProgress]);
  const headerBarAnimStyle = useAnimatedStyle(() => ({
    height: HEADER_GRANDE_H + (HEADER_COMPACT_H - HEADER_GRANDE_H) * compactProgress.value,
  }));
  const grandeLayerAnimStyle  = useAnimatedStyle(() => ({ opacity: 1 - compactProgress.value }));
  const compactLayerAnimStyle = useAnimatedStyle(() => ({ opacity: compactProgress.value }));
  const scrollFadeAnimStyle   = useAnimatedStyle(() => ({ opacity: compactProgress.value }));
  function handleHeaderScroll(e) {
    const y = e.nativeEvent.contentOffset.y;
    setCompact((prev) => {
      if (!prev && y > HEADER_COMPACT_ON) return true;
      if (prev && y < HEADER_COMPACT_OFF) return false;
      return prev;
    });
  }

  // Estado visual (colapsada/expandida) de cada miembro de superserie, reportado
  // por cada ExerciseCard vía onCollapsedChange — agregado por grupo más abajo
  // para decidir el borde de completado del SupersetBlock (§groupAllDone).
  // exerciseId -> boolean; solo se puebla para cards dentro de una superserie.
  const [memberCollapsed, setMemberCollapsed] = useState({});

  // Store state
  const activeSession      = useStore((s) => s.activeSession);
  const sessionTemplates   = useStore((s) => s.sessionTemplates);
  const userPrograms       = useStore((s) => s.userPrograms);
  const exerciseLibrary    = useStore((s) => s.exerciseLibrary);
  const customExercises    = useStore((s) => s.customExercises);
  const workoutLog         = useStore((s) => s.workoutLog);
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
  const updateFreeSessionName = useStore((s) => s.updateFreeSessionName);
  const setExerciseNote       = useStore((s) => s.setExerciseNote);
  const startBlock            = useStore((s) => s.startBlock);
  const updateBlockState      = useStore((s) => s.updateBlockState);
  const finishBlock           = useStore((s) => s.finishBlock);
  const resetBlock            = useStore((s) => s.resetBlock);

  // Derive template + exercises
  const template = userPrograms[activeSession.templateId] ?? sessionTemplates[activeSession.templateId];
  const allExercises = { ...exerciseLibrary, ...customExercises };

  // Sync setsState when template exercises change (e.g. after editing the program)
  useEffect(() => {
    syncSessionSets();
  }, [template?.exercises]);

  // Last session for progression recommendations
  const lastSession = workoutLog
    .filter((e) => e.sessionTemplateId === activeSession.templateId)
    .sort((a, b) => b.timestamp - a.timestamp)[0] ?? null;

  // Trainer's one-off prescription for this session (if any), keyed by exercise.
  const sessionOverride = clientSync.pendingOverrides?.[activeSession.templateId] ?? null;

  // Linked exercises read the group's latest performance (any session of the
  // group); unlinked ones keep the same-template reference.
  const ownerProgram = template?.programId ? useStore.getState().programs[template.programId] : null;
  const getEffectiveTemplate = (tid) => userPrograms[tid] ?? sessionTemplates[tid];

  const exercises = (template?.exercises ?? []).map((exConfig) => ({
    exConfig,
    def:         allExercises[exConfig.exerciseId],
    setsState:   activeSession.setsState[exConfig.exerciseId] ?? [],
    lastExercise: exConfig.linkGroup
      ? lastLinkedExercise(
          workoutLog,
          linkGroupTemplateIds(ownerProgram, exConfig.exerciseId, exConfig.linkGroup, getEffectiveTemplate),
          exConfig.exerciseId,
        )
      : lastSession?.exercises?.find((e) => e.exerciseId === exConfig.exerciseId) ?? null,
    overrideEx:  sessionOverride?.exercises?.[exConfig.exerciseId] ?? null,
  }));

  // Group consecutive exercises chained via exConfig.supersetWithNext into
  // superset blocks; everything else stays a standalone 1-item "group".
  const exerciseGroups = [];
  for (const item of exercises) {
    const prevGroup = exerciseGroups[exerciseGroups.length - 1];
    if (prevGroup?.[prevGroup.length - 1].exConfig.supersetWithNext) prevGroup.push(item);
    else exerciseGroups.push([item]);
  }

  // Puntos de progreso del header (§4.3): 1 unidad por ejercicio de fuerza
  // (miembros de superserie incluidos, aplanados) + 1 por ad-hoc + 1 por bloque
  // de acondicionamiento, en orden de pantalla. Mismo criterio de "completo"
  // que el auto-colapso de ExerciseCard (isExerciseDone).
  const dotUnits = [
    ...exerciseGroups.flat().map(({ exConfig, setsState }) => ({
      id:   exConfig.exerciseId,
      done: isExerciseDone(exConfig, setsState),
    })),
    ...(activeSession.adHocExercises ?? []).map((a) => ({
      id:   a.exerciseId,
      done: a.setsState.length > 0 && a.setsState.every((s) => s.done),
    })),
    ...(template?.blocks ?? []).map((b) => ({
      id:   b.id,
      done: activeSession.blockState?.[b.id]?.finishedAt != null,
    })),
  ];

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

  // Free session flag
  const isFree = activeSession.templateId === '__free__';

  // Header content — sessionLabel/titleText cubren ambos modos (plantilla y
  // sesión libre); el reloj se concatena dentro de HeaderEyebrow/HeaderCompactSummary.
  const sessionLabel    = isFree ? t('freeSession.badge').toUpperCase() : t('workout.sessionLabel', { label: template?.label ?? '' });
  const titleText       = isFree ? (activeSession.freeSessionName ?? '') : (template?.name ?? '');
  const hasSessionNotes = (activeSession.notes?.trim().length ?? 0) > 0;

  function handleGoBack() {
    // When the app is killed mid-workout and relaunched, Workout is set as the
    // initial route (no back stack). goBack() would fail silently in that case.
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Main', { screen: 'Home' });
    }
  }

  function handleSave() {
    const result = saveSession();
    if (!result.ok) { showToast(result.error, 2200, 'error'); return; }
    // The recap IS the confirmation — replace so back can't return to the
    // (now empty) workout screen.
    navigation.replace('SessionRecap', { entryId: result.entryId });
  }

  function handleDiscard() {
    discardSession(); // stops timer, resets session, navigates home via store ref
  }

  if (!template && !isFree) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Text style={styles.errorText}>Sin sesión activa</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header — sticky, fuera del ScrollView, 2 estados con crossfade (§4) */}
      <View style={styles.headerWrap}>
        <Reanimated.View style={[styles.headerBar, headerBarAnimStyle]}>
          {/* Grande */}
          <Reanimated.View
            pointerEvents={compact ? 'none' : 'auto'}
            style={[styles.headerLayerGrande, grandeLayerAnimStyle]}
          >
            <TouchableOpacity onPress={handleGoBack} hitSlop={10}>
              <HeaderArrow size={26} th={th} />
            </TouchableOpacity>
            <View style={styles.grandeCenter}>
              <HeaderEyebrow startedAt={activeSession.startedAt} label={sessionLabel} styles={styles} />
              {isFree ? (
                <TextInput
                  style={styles.freeNameInputHeader}
                  value={activeSession.freeSessionName ?? ''}
                  onChangeText={updateFreeSessionName}
                  placeholder={t('freeSession.namePlaceholder')}
                  placeholderTextColor={withOpacity(th.colors.onAccent, 0.4)}
                  returnKeyType="done"
                  maxLength={60}
                  textAlign="center"
                />
              ) : (
                <Text style={styles.grandeTitle} numberOfLines={1}>{titleText}</Text>
              )}
              <ProgressDots units={dotUnits} th={th} styles={styles} size={DOT_SIZE} />
            </View>
            <TouchableOpacity onPress={() => setNotesOpen(true)} hitSlop={10}>
              <NoteIcon th={th} filled={hasSessionNotes} size={26} tone="onAccent" />
            </TouchableOpacity>
          </Reanimated.View>

          {/* Compacta — todo el ancho, gap equidistante (space-between) */}
          <Reanimated.View
            pointerEvents={compact ? 'auto' : 'none'}
            style={[styles.headerLayerCompact, compactLayerAnimStyle]}
          >
            <TouchableOpacity onPress={handleGoBack} hitSlop={10}>
              <HeaderArrow size={16} th={th} />
            </TouchableOpacity>
            <View style={styles.compactTextWrap}>
              <HeaderCompactSummary
                startedAt={activeSession.startedAt}
                title={titleText || (isFree ? t('freeSession.namePlaceholder') : '')}
                styles={styles}
              />
            </View>
            <ProgressDots units={dotUnits} th={th} styles={styles} size={DOT_SIZE} />
            <TouchableOpacity onPress={() => setNotesOpen(true)} hitSlop={10}>
              <NoteIcon th={th} filled={hasSessionNotes} size={26} tone="onAccent" />
            </TouchableOpacity>
          </Reanimated.View>
        </Reanimated.View>
      </View>

      {/* Exercise list */}
      <View style={{ flex: 1 }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top + spacing.lg + HEADER_GRANDE_H + spacing.md}
      >
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: spacing.xxl + insets.bottom }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onScroll={handleHeaderScroll}
          scrollEventThrottle={16}
        >
          {/* Free session info banner */}
          {isFree && (
            <View style={styles.freeBanner}>
              <Text style={styles.freeBannerText}>{t('freeSession.infoText')}</Text>
            </View>
          )}

          {exerciseGroups.map((group, groupIdx) => {
            const isSuperset = group.length > 1;
            // Numeración de sesión (01, 02…) — un número por SLOT, no por card: los
            // miembros de una misma superserie comparten número (se distinguen por A1/A2).
            const orderNumber = String(groupIdx + 1).padStart(2, '0');
            // Grupo entero completo Y las N cards visualmente colapsadas a la vez —
            // dispara el borde de completado del SupersetBlock. Reabrir cualquier
            // miembro a mano (manualOpen) lo quita al instante, aunque sus datos
            // sigan "hechos": memberCollapsed refleja isCollapsed, no allDone.
            const groupAllDone = isSuperset
              && group.every(({ exConfig, setsState }) => isExerciseDone(exConfig, setsState))
              && group.every(({ exConfig }) => memberCollapsed[exConfig.exerciseId] === true);
            const cards = group.map(({ exConfig, def, setsState, lastExercise, overrideEx }, idx) => (
              <ExerciseCard
                key={exConfig.exerciseId}
                exConfig={exConfig}
                def={def}
                setsState={setsState}
                lastExercise={lastExercise}
                overrideEx={overrideEx}
                groupLabel={isSuperset ? `A${idx + 1}` : undefined}
                orderNumber={orderNumber}
                hideAddSetBtn={isSuperset}
                // Miembro de superserie: nunca dibuja su propio borde de completado —
                // el highlight es exclusivo del SupersetBlock (solo cuando el grupo
                // entero termina, `completed` más abajo), no de cada card individual.
                suppressCollapsedBorder={isSuperset}
                onCollapsedChange={isSuperset ? (val) => {
                  setMemberCollapsed((m) => (m[exConfig.exerciseId] === val ? m : { ...m, [exConfig.exerciseId]: val }));
                } : undefined}
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
                completed={groupAllDone}
                onAddSet={() => group.forEach((g) => addSetToSession(g.exConfig.exerciseId))}
              >
                {cards}
              </SupersetBlock>
            );
          })}

          {/* Ad-hoc exercises added during this session — continúan la numeración */}
          {(activeSession.adHocExercises ?? []).map((adHoc, adHocIdx) => {
            const def = allExercises[adHoc.exerciseId];
            const adHocConfig = {
              exerciseId: adHoc.exerciseId,
              sets:       adHoc.setsState.length,
              minReps:    def?.minReps ?? 8,
              maxReps:    def?.maxReps ?? 12,
              restSec:    def?.restSec ?? 90,
              isKey:      false,
            };
            return (
              <ExerciseCard
                key={adHoc.exerciseId}
                exConfig={adHocConfig}
                def={def}
                setsState={adHoc.setsState}
                lastExercise={null}
                orderNumber={String(exerciseGroups.length + adHocIdx + 1).padStart(2, '0')}
                activeSetIndex={activePointer?.exerciseId === adHoc.exerciseId ? activePointer.setIndex : -1}
                onFieldChange={(setIdx, field, value) =>
                  handleAdHocFieldChange(adHoc.exerciseId, setIdx, field, value)
                }
                onToggleDone={(setIdx) => handleAdHocToggleDone(adHoc.exerciseId, setIdx)}
                onAddSet={() => addAdHocSet(adHoc.exerciseId)}
                clientNote={activeSession.exerciseNotes?.[adHoc.exerciseId] ?? ''}
                onClientNoteChange={(text) => setExerciseNote(adHoc.exerciseId, text)}
              />
            );
          })}

          {/* Conditioning blocks — after all strength work (spec §2.1) */}
          {(template?.blocks ?? []).map((block) => (
            <ConditioningBlockCard
              key={block.id}
              block={block}
              state={activeSession.blockState?.[block.id] ?? null}
              allExercises={allExercises}
              onStart={() => startBlock(block.id)}
              onUpdate={(patch) => updateBlockState(block.id, patch)}
              onFinish={() => finishBlock(block.id)}
              onReset={() => resetBlock(block.id)}
            />
          ))}

          {/* Add exercise to session (ad-hoc) */}
          <TouchableOpacity
            style={styles.addExBtn}
            onPress={() => navigation.navigate('ExerciseSelector', {
              sessionMode: true,
              existingPatterns: (template?.exercises ?? [])
                .map((e) => allExercises[e.exerciseId]?.pattern)
                .filter(Boolean),
            })}
            activeOpacity={0.75}
          >
            <Text style={styles.addExBtnText}>+ {t('workout.addExercise')}</Text>
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

      {/* Fundido bajo la cabecera sticky — evita el corte seco del contenido al
          hacer scroll, visible sólo cuando la cabecera está colapsada (mismo
          progreso 0↔1 que el crossfade del header). */}
      <Reanimated.View pointerEvents="none" style={[styles.scrollFade, scrollFadeAnimStyle]}>
        <Svg width="100%" height={SCROLL_FADE_H}>
          <Defs>
            <SvgLinearGradient id="scrollFade" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={th.colors.bg} stopOpacity={1} />
              <Stop offset="1" stopColor={th.colors.bg} stopOpacity={0} />
            </SvgLinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height={SCROLL_FADE_H} fill="url(#scrollFade)" />
        </Svg>
      </Reanimated.View>
      </View>

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
    color:     th.colors.muted,
    fontSize:  typography.base,
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
    position:   'absolute',
    fontSize:   typography.base,
    fontWeight: typography.bold,
    color:      th.colors.text,
  },
  timerExName: {
    flex:       1,
    fontSize:   typography.sm,
    fontWeight: typography.medium,
    color:      th.colors.text,
    lineHeight: typography.sm * 1.4,
  },
  timerSkipBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical:   spacing.xs + 2,
    borderRadius:      th.radius.sm,
    borderWidth:       borders.thin,
    borderColor:       withOpacity(th.colors.accent, 0.35),
    backgroundColor:   withOpacity(th.colors.accent, 0.08),
  },
  timerSkipText: {
    fontSize:   typography.sm,
    fontWeight: typography.medium,
    color:      th.colors.accent,
  },

  // Header — SesionHeader (110:3692), 2 estados (§4)
  headerWrap: {
    marginHorizontal: spacing.lg,  // margen lateral de página (x=15 en el frame Figma)
    marginTop:        spacing.lg,  // y=15 bajo el safe-area
    marginBottom:     spacing.md,  // gap header→contenido, confirmado en ambos estados
  },
  headerBar: {
    backgroundColor: th.colors.accent,
    borderRadius:    th.radius.md,
    overflow:        'hidden',
  },
  headerLayerGrande: {
    position:          'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    flexDirection:      'row',
    alignItems:         'center',
    paddingHorizontal:  spacing.sm,
    gap:                spacing.sm,
  },
  // Compacta: sin gap fijo — justifyContent:'space-between' reparte el espacio
  // sobrante en partes iguales entre los 4 elementos (flecha/texto/dots/notas),
  // ocupando todo el ancho de la cabecera.
  headerLayerCompact: {
    position:          'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    flexDirection:      'row',
    alignItems:         'center',
    justifyContent:     'space-between',
    paddingHorizontal:  spacing.sm,
  },
  grandeCenter: {
    flex:       1,
    alignItems: 'center',
  },
  // Alto fijo (HEADER_ROW_H) igual al de dotsRow — el título queda exactamente
  // centrado sólo si eyebrow y dots pesan lo mismo por encima/debajo suyo.
  eyebrowText: {
    ...textStyles.spacingTag,
    color:         th.colors.onAccent,
    textAlign:     'center',
    textTransform: 'uppercase',
    lineHeight:    HEADER_ROW_H,
  },
  // lineHeight explícito y ajustado (no el "normal" del font, que en Inter Black
  // añade bastante más aire del necesario) — acerca el título a eyebrow/dots.
  grandeTitle: {
    ...textStyles.hero,
    color:      th.colors.onAccent,
    textAlign:  'center',
    lineHeight: 22,
  },
  freeNameInputHeader: {
    ...textStyles.hero,
    color:      th.colors.onAccent,
    textAlign:  'center',
    padding:    0,
    alignSelf:  'stretch',
    lineHeight: 22,
  },
  // flexShrink (no flex:1) + minWidth:0: en la compacta, el texto cede ancho a
  // los demás elementos y trunca (numberOfLines=1) en vez de acaparar el hueco
  // que deja justifyContent:'space-between'.
  compactTextWrap: { flexShrink: 1, minWidth: 0 },
  compactSummary: {
    ...textStyles.btnAction,
    color: th.colors.onAccent,
  },
  dotsRow: {
    height:        HEADER_ROW_H,
    flexDirection: 'row',
    alignItems:    'center',
  },
  scrollFade: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height:   SCROLL_FADE_H,
  },
  freeBanner: {
    backgroundColor: withOpacity(th.colors.accent, 0.06),
    borderWidth:     1,
    borderColor:     withOpacity(th.colors.accent, 0.18),
    borderRadius:    th.radius.sm,
    paddingVertical:   spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom:    spacing.xs,
  },
  freeBannerText: {
    fontSize:   typography.xs,
    color:      th.colors.muted,
    lineHeight: typography.xs * 1.6,
    textAlign:  'center',
  },
  // Content — margen lateral = página (spacing.lg, igual que headerWrap);
  // el gap superior lo aporta headerWrap.marginBottom, no padding propio aquí.
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom:     spacing.xxl,
    gap:               spacing.md,
  },

  // Add exercise (ad-hoc)
  addExBtn: {
    borderWidth:     borders.thin,
    borderColor:     withOpacity(th.colors.accent, 0.3),
    borderStyle:     'dashed',
    borderRadius:    th.radius.md,
    paddingVertical: spacing.md,
    alignItems:      'center',
    backgroundColor: withOpacity(th.colors.accent, 0.04),
    marginTop:       spacing.xs,
  },
  addExBtnText: {
    fontSize:      typography.base,
    fontWeight:    typography.medium,
    color:         th.colors.accent,
    letterSpacing: 0.5,
  },

  // Save / discard
  saveBtn: {
    borderRadius:    th.radius.md,
    paddingVertical: spacing.md + 4,
    alignItems:      'center',
    marginTop:       spacing.sm,
    backgroundColor: th.colors.accent,
  },
  saveBtnText: {
    fontSize:      typography.base,
    fontWeight:    typography.heavy,
    color:         th.colors.onAccent,
    letterSpacing: 1,
  },
  discardBtn: {
    alignItems:      'center',
    paddingVertical: spacing.md,
  },
  // Tertiary buttom (235:4760) — solo texto, spacingTag, uppercase, rojo (acción destructiva)
  discardText: {
    ...textStyles.spacingTag,
    color:         th.tint.red50,
    textTransform: 'uppercase',
  },
});
