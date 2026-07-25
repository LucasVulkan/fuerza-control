import {
  View, Text, ScrollView, TouchableOpacity,
  TextInput, KeyboardAvoidingView,
  Platform, StyleSheet, Animated, PanResponder,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Svg, { Circle } from 'react-native-svg';
import { useStore } from '../../store/useStore';
import { useWeightUnit } from '../hooks/useWeightUnit';
import ExerciseCard from '../components/workout/ExerciseCard';
import SupersetBlock from '../components/workout/SupersetBlock';
import ConditioningBlockCard from '../components/workout/ConditioningBlockCard';
import NotesModal from '../components/workout/NotesModal';
import { spacing, typography, textStyles, borders, withOpacity } from '../theme';
import { useTheme, useThemedStyles } from '../useTheme';
import { resolveColor } from '../themes';
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
// minimize/kill without any background logic — the tick only repaints.

function ElapsedClock({ startedAt }) {
  const styles = useThemedStyles(makeStyles);
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);
  if (!startedAt) return null;
  const s  = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const txt = hh > 0
    ? `${hh}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
    : `${mm}:${String(ss).padStart(2, '0')}`;
  return <Text style={styles.elapsedClock}>{txt}</Text>;
}

// ── Floating rest timer ───────────────────────────────────────────────────────

const RING_SIZE      = 64;
const RING_RADIUS    = 26;
const CIRCUMFERENCE  = 2 * Math.PI * RING_RADIUS; // ≈ 163.4
const SWIPE_THRESHOLD = 80;

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

  // Colors
  const accentColor = resolveColor(th,template?.color ?? 'var(--accent)');

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
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            // When the app is killed mid-workout and relaunched, Workout is set as the
            // initial route (no back stack). goBack() would fail silently in that case.
            if (navigation.canGoBack()) {
              navigation.goBack();
            } else {
              navigation.navigate('Main', { screen: 'Home' });
            }
          }}
          hitSlop={12}
          style={styles.backBtn}
        >
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          {isFree ? (
            <>
              <Text style={[styles.sesTag, { color: th.colors.accent }]}>
                {t('freeSession.badge').toUpperCase()}
              </Text>
              <View style={styles.sesNameRow}>
                <TextInput
                  style={[styles.freeNameInput, { flex: 1 }]}
                  value={activeSession.freeSessionName ?? ''}
                  onChangeText={updateFreeSessionName}
                  placeholder={t('freeSession.namePlaceholder')}
                  placeholderTextColor={th.colors.muted}
                  returnKeyType="done"
                  maxLength={60}
                />
                <ElapsedClock startedAt={activeSession.startedAt} />
              </View>
            </>
          ) : (
            <>
              <Text style={[styles.sesTag, { color: accentColor }]} numberOfLines={1}>
                {t('workout.sessionLabel', { label: template.label ?? '' })}
              </Text>
              <View style={styles.sesNameRow}>
                <Text style={[styles.sesName, { flex: 1 }]} numberOfLines={1}>
                  {template.name ?? ''}
                </Text>
                <ElapsedClock startedAt={activeSession.startedAt} />
              </View>
            </>
          )}
        </View>
        <TouchableOpacity
          onPress={() => setNotesOpen(true)}
          hitSlop={12}
          style={[
            styles.notesBtn,
            (activeSession.notes?.trim().length > 0) && styles.notesBtnActive,
          ]}
        >
          <Text style={styles.notesIcon}>📝</Text>
        </TouchableOpacity>
      </View>

      {/* Exercise list */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top + 56}
      >
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: spacing.xxl + insets.bottom }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
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

  // Header
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical:   spacing.md,
    borderBottomWidth: borders.thin,
    borderBottomColor: th.colors.border,
  },
  backBtn: { padding: spacing.xs },
  backIcon: {
    fontSize:   26,
    color:      th.colors.muted,
    lineHeight: 30,
  },
  headerCenter: {
    flex: 1,
    gap:  2,
  },
  sesTag: {
    fontSize:      10,
    fontWeight:    typography.bold,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  sesNameRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.xs,
  },
  sesName: {
    fontSize:   typography.xl,
    fontWeight: typography.heavy,
    color:      th.colors.text,
    lineHeight: typography.xl * 1.2,
  },
  elapsedClock: {
    fontSize:    typography.sm,
    fontWeight:  typography.semibold,
    color:       th.colors.muted,
    fontVariant: ['tabular-nums'],
    flexShrink:  0,
  },
  driveIcon: {
    fontSize:   12,
    color:      th.colors.green,
    lineHeight: typography.xl * 1.2,
    opacity:    0.75,
  },
  trainerCredit: {
    fontSize:   typography.xs,
    color:      th.colors.muted,
    fontStyle:  'italic',
  },
  freeNameInput: {
    fontSize:   typography.xl,
    fontWeight: typography.heavy,
    color:      th.colors.text,
    lineHeight: typography.xl * 1.2,
    padding:    0,
    minHeight:  typography.xl * 1.2,
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
  notesBtn: {
    padding:         spacing.xs + 2,
    borderRadius:    th.radius.sm,
    borderWidth:     borders.thin,
    borderColor:     th.colors.border,
  },
  notesBtnActive: {
    borderColor:     withOpacity(th.colors.accent, 0.4),
    backgroundColor: withOpacity(th.colors.accent, 0.08),
  },
  notesIcon: { fontSize: 16 },

  // Content
  content: {
    padding:       spacing.xl,
    paddingBottom: spacing.xxl,
    gap:           spacing.md,
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
