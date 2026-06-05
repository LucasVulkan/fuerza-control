import {
  View, Text, ScrollView, TouchableOpacity,
  Modal, TextInput, KeyboardAvoidingView,
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
import { resolveColor, colors, spacing, typography, radius, borders, withOpacity } from '../theme';
import { formatSeconds } from '../../../src/utils/formatters';

// ── Floating rest timer ───────────────────────────────────────────────────────

const RING_SIZE      = 64;
const RING_RADIUS    = 26;
const CIRCUMFERENCE  = 2 * Math.PI * RING_RADIUS; // ≈ 163.4
const SWIPE_THRESHOLD = 80;

function RestTimerFloat({ timer, onStop, bottomOffset }) {
  const { t }      = useTranslation();
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
            stroke={withOpacity(colors.accent, 0.18)}
            strokeWidth={3.5}
            fill="none"
          />
          <Circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_RADIUS}
            stroke={colors.accent}
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

// ── Notes modal ───────────────────────────────────────────────────────────────

function NotesModal({ visible, value, onChange, onClose }) {
  const { t } = useTranslation();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      {/*
        KAV wraps the whole screen (flex:1). The flex:1 backdrop acts as the
        elastic spacer — when the keyboard appears KAV shrinks (behavior='padding'
        adds paddingBottom equal to keyboard height) and the sheet rides up above it.
        This works on both platforms; the old sibling-based structure meant the sheet
        (which was the KAV itself) would squish instead of moving.
      */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
      >
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={onClose} />
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{t('workout.sessionNotes')}</Text>
            <TouchableOpacity style={styles.modalSaveBtn} onPress={onClose}>
              <Text style={styles.modalSaveBtnText}>{t('common.save')}</Text>
            </TouchableOpacity>
          </View>
          <TextInput
            style={styles.notesInput}
            value={value}
            onChangeText={onChange}
            multiline
            autoFocus
            placeholder={t('workout.notesPlaceholder')}
            placeholderTextColor={colors.muted2}
            textAlignVertical="top"
          />
          <Text style={styles.notesHint}>{t('workout.notesSavedWith')}</Text>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Screen ─────────────────────────────────────────────────────────────────────

export default function WorkoutScreen() {
  const insets     = useSafeAreaInsets();
  const navigation = useNavigation();
  const { t }      = useTranslation();

  const [notesOpen, setNotesOpen] = useState(false);

  // Store state
  const activeSession      = useStore((s) => s.activeSession);
  const sessionTemplates   = useStore((s) => s.sessionTemplates);
  const userPrograms       = useStore((s) => s.userPrograms);
  const exerciseLibrary    = useStore((s) => s.exerciseLibrary);
  const customExercises    = useStore((s) => s.customExercises);
  const workoutLog         = useStore((s) => s.workoutLog);
  const restTimer          = useStore((s) => s.ui.restTimer);

  // Store actions
  const updateSetField        = useStore((s) => s.updateSetField);
  const toggleSetDone         = useStore((s) => s.toggleSetDone);
  const addSetToSession       = useStore((s) => s.addSetToSession);
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

  const exercises = (template?.exercises ?? []).map((exConfig) => ({
    exConfig,
    def:         allExercises[exConfig.exerciseId],
    setsState:   activeSession.setsState[exConfig.exerciseId] ?? [],
    lastExercise: lastSession?.exercises?.find((e) => e.exerciseId === exConfig.exerciseId) ?? null,
  }));

  // Free session flag
  const isFree = activeSession.templateId === '__free__';

  // Colors
  const accentColor = resolveColor(template?.color ?? 'var(--accent)');

  function handleSave() {
    const result = saveSession();
    if (!result.ok) { showToast('⚠️ ' + result.error); return; }
    showToast(t('workout.sessionSaved'));
    setTimeout(() => navigation.navigate('Main', { screen: 'Home' }), 800);
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
              <Text style={[styles.sesTag, { color: colors.accent }]}>
                {t('freeSession.badge').toUpperCase()}
              </Text>
              <TextInput
                style={styles.freeNameInput}
                value={activeSession.freeSessionName ?? ''}
                onChangeText={updateFreeSessionName}
                placeholder={t('freeSession.namePlaceholder')}
                placeholderTextColor={colors.muted}
                returnKeyType="done"
                maxLength={60}
              />
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

          {exercises.map(({ exConfig, def, setsState, lastExercise }) => (
            <ExerciseCard
              key={exConfig.exerciseId}
              exConfig={exConfig}
              def={def}
              setsState={setsState}
              lastExercise={lastExercise}
              onFieldChange={(setIdx, field, value) =>
                updateSetField(exConfig.exerciseId, setIdx, field, value)
              }
              onToggleDone={(setIdx) => toggleSetDone(exConfig.exerciseId, setIdx)}
              onAddSet={() => addSetToSession(exConfig.exerciseId)}
            />
          ))}

          {/* Ad-hoc exercises added during this session */}
          {(activeSession.adHocExercises ?? []).map((adHoc) => {
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
                onFieldChange={(setIdx, field, value) =>
                  updateAdHocSet(adHoc.exerciseId, setIdx, field, value)
                }
                onToggleDone={(setIdx) => toggleAdHocSetDone(adHoc.exerciseId, setIdx)}
                onAddSet={() => addAdHocSet(adHoc.exerciseId)}
              />
            );
          })}

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
        value={activeSession.notes ?? ''}
        onChange={updateSessionNotes}
        onClose={() => setNotesOpen(false)}
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

const styles = StyleSheet.create({
  container: {
    flex:            1,
    backgroundColor: colors.bg,
  },
  errorText: {
    color:     colors.muted,
    fontSize:  typography.base,
    textAlign: 'center',
    marginTop: spacing.xxl,
  },

  // Floating rest timer
  timerFloat: {
    position:          'absolute',
    left:              spacing.lg,
    right:             spacing.lg,
    backgroundColor:   colors.surface,
    borderWidth:       borders.thin,
    borderColor:       colors.borderCard,
    borderRadius:      radius.lg,
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
    color:      colors.text,
  },
  timerExName: {
    flex:       1,
    fontSize:   typography.sm,
    fontWeight: typography.medium,
    color:      colors.text,
    lineHeight: typography.sm * 1.4,
  },
  timerSkipBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical:   spacing.xs + 2,
    borderRadius:      radius.sm,
    borderWidth:       borders.thin,
    borderColor:       withOpacity(colors.accent, 0.35),
    backgroundColor:   withOpacity(colors.accent, 0.08),
  },
  timerSkipText: {
    fontSize:   typography.sm,
    fontWeight: typography.medium,
    color:      colors.accent,
  },

  // Header
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical:   spacing.md,
    borderBottomWidth: borders.thin,
    borderBottomColor: colors.border,
  },
  backBtn: { padding: spacing.xs },
  backIcon: {
    fontSize:   26,
    color:      colors.muted,
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
    color:      colors.text,
    lineHeight: typography.xl * 1.2,
  },
  driveIcon: {
    fontSize:   12,
    color:      colors.green,
    lineHeight: typography.xl * 1.2,
    opacity:    0.75,
  },
  trainerCredit: {
    fontSize:   typography.xs,
    color:      colors.muted,
    fontStyle:  'italic',
  },
  freeNameInput: {
    fontSize:   typography.xl,
    fontWeight: typography.heavy,
    color:      colors.text,
    lineHeight: typography.xl * 1.2,
    padding:    0,
    minHeight:  typography.xl * 1.2,
  },
  freeBanner: {
    backgroundColor: withOpacity(colors.accent, 0.06),
    borderWidth:     1,
    borderColor:     withOpacity(colors.accent, 0.18),
    borderRadius:    radius.sm,
    paddingVertical:   spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom:    spacing.xs,
  },
  freeBannerText: {
    fontSize:   typography.xs,
    color:      colors.muted,
    lineHeight: typography.xs * 1.6,
    textAlign:  'center',
  },
  notesBtn: {
    padding:         spacing.xs + 2,
    borderRadius:    radius.sm,
    borderWidth:     borders.thin,
    borderColor:     colors.border,
  },
  notesBtnActive: {
    borderColor:     withOpacity(colors.accent, 0.4),
    backgroundColor: withOpacity(colors.accent, 0.08),
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
    borderColor:     withOpacity(colors.accent, 0.3),
    borderStyle:     'dashed',
    borderRadius:    radius.md,
    paddingVertical: spacing.md,
    alignItems:      'center',
    backgroundColor: withOpacity(colors.accent, 0.04),
    marginTop:       spacing.xs,
  },
  addExBtnText: {
    fontSize:      typography.base,
    fontWeight:    typography.medium,
    color:         colors.accent,
    letterSpacing: 0.5,
  },

  // Save / discard
  saveBtn: {
    borderRadius:    radius.md,
    paddingVertical: spacing.md + 4,
    alignItems:      'center',
    marginTop:       spacing.sm,
    backgroundColor: colors.accent,
  },
  saveBtnText: {
    fontSize:      typography.base,
    fontWeight:    typography.heavy,
    color:         colors.onAccent,
    letterSpacing: 1,
  },
  discardBtn: {
    alignItems:      'center',
    paddingVertical: spacing.md,
  },
  discardText: {
    fontSize: typography.base,
    color:    colors.muted,
  },

  // Notes modal
  modalBackdrop: {
    flex:            1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius:  radius.lg,
    borderTopRightRadius: radius.lg,
    borderTopWidth:  borders.thin,
    borderTopColor:  colors.border,
    padding:         spacing.xl,
    paddingBottom:   spacing.xxl,
    gap:             spacing.md,
  },
  modalHandle: {
    width:           40,
    height:          4,
    borderRadius:    radius.full,
    backgroundColor: colors.border,
    alignSelf:       'center',
    marginBottom:    spacing.sm,
  },
  modalHeader: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
  },
  modalTitle: {
    fontSize:      typography.lg,
    fontWeight:    typography.heavy,
    color:         colors.text,
    letterSpacing: 1,
  },
  modalSaveBtn: {
    backgroundColor: colors.accent,
    borderRadius:    radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.sm,
  },
  modalSaveBtnText: {
    fontSize:   typography.base,
    fontWeight: typography.bold,
    color:      colors.onAccent,
  },
  notesInput: {
    backgroundColor: colors.surface2,
    borderWidth:     borders.thin,
    borderColor:     withOpacity(colors.accent, 0.4),
    borderRadius:    radius.md,
    color:           colors.text,
    fontSize:        typography.base,
    lineHeight:      typography.base * 1.7,
    padding:         spacing.md,
    minHeight:       140,
  },
  notesHint: {
    fontSize: typography.xs,
    color:    colors.muted2,
  },
});
