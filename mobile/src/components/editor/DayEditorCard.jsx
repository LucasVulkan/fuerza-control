import { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Animated, PanResponder, LayoutAnimation, Platform, UIManager,
  Modal, KeyboardAvoidingView, SafeAreaView, ScrollView,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../../store/useStore';
import { colors, spacing, typography, radius, borders, resolveColor, withOpacity } from '../../theme';
import ExerciseEditorInline from './ExerciseEditorInline';

// LayoutAnimation must be enabled explicitly on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SWIPE_DELETE = 150;
const ITEM_HEIGHT  = 58;

const SWAP_ANIM = {
  duration: 180,
  update: { type: LayoutAnimation.Types.easeInEaseOut },
};

// ─── ExerciseRow ──────────────────────────────────────────────────────────────
// Manages horizontal swipe-to-delete and vertical drag gesture detection.
// The dragged item is made invisible by the parent (opacity:0 wrapper).
// An absolutely-positioned overlay follows the finger instead.

function ExerciseRow({
  exConfig, def, isEditing, onToggleEdit,
  onDragStart, onDragMove, onDragEnd,
  onSwipeDelete,
}) {
  const { t } = useTranslation();

  const dragX   = useRef(new Animated.Value(0)).current;
  const modeRef = useRef(null); // 'h' | 'v' | null
  const vStarted = useRef(false);

  // Callback refs prevent stale closures inside the once-created PanResponder
  const onDragStartRef = useRef(onDragStart);
  const onDragMoveRef  = useRef(onDragMove);
  const onDragEndRef   = useRef(onDragEnd);
  const onDeleteRef    = useRef(onSwipeDelete);
  useEffect(() => {
    onDragStartRef.current = onDragStart;
    onDragMoveRef.current  = onDragMove;
    onDragEndRef.current   = onDragEnd;
    onDeleteRef.current    = onSwipeDelete;
  });

  const bgColor = dragX.interpolate({
    inputRange: [0, 30, SWIPE_DELETE],
    outputRange: ['rgba(239,68,68,0)', 'rgba(239,68,68,0.06)', 'rgba(239,68,68,0.2)'],
    extrapolate: 'clamp',
  });
  const gripColor = dragX.interpolate({
    inputRange: [0, SWIPE_DELETE],
    outputRange: [colors.muted2, '#ef4444'],
    extrapolate: 'clamp',
  });
  const nameOpacity = dragX.interpolate({
    inputRange: [SWIPE_DELETE - 8, SWIPE_DELETE],
    outputRange: [1, 0], extrapolate: 'clamp',
  });
  const labelOpacity = dragX.interpolate({
    inputRange: [SWIPE_DELETE - 8, SWIPE_DELETE],
    outputRange: [0, 1], extrapolate: 'clamp',
  });

  const panResponder = useRef(PanResponder.create({
    // Claim immediately on grip area (leftmost 40 px) — prevents ScrollView from winning.
    // Grip (leftmost 50 px): claim immediately → reliable vertical reorder.
    onStartShouldSetPanResponder: (e) => e.nativeEvent.locationX < 50,
    // Horizontal right-swipe anywhere: claim on movement → swipe-to-delete.
    onMoveShouldSetPanResponder: (_, gs) => gs.dx > 8 && gs.dx > Math.abs(gs.dy) * 1.3,
    onPanResponderGrant: (e) => {
      modeRef.current = e.nativeEvent.locationX < 50 ? 'v' : null;
      vStarted.current = false;
      dragX.setValue(0);
    },
    onPanResponderMove: (_, gs) => {
      if (!modeRef.current) {
        // Only reachable via onMoveShouldSetPanResponder — must be a horizontal swipe.
        if (gs.dx > 0) modeRef.current = 'h';
        else return;
      }
      if (modeRef.current === 'h' && gs.dx > 0) {
        dragX.setValue(gs.dx);
      } else if (modeRef.current === 'v') {
        if (!vStarted.current) {
          vStarted.current = true;
          onDragStartRef.current();
        }
        onDragMoveRef.current(gs.dy);
      }
    },
    onPanResponderRelease: (_, gs) => {
      if (modeRef.current === 'h') {
        if (gs.dx >= SWIPE_DELETE) {
          Animated.timing(dragX, { toValue: 500, duration: 120, useNativeDriver: false }).start(() => {
            onDeleteRef.current(exConfig.exerciseId);
          });
          modeRef.current = null;
          return;
        }
        Animated.spring(dragX, { toValue: 0, useNativeDriver: false, tension: 80 }).start();
      } else if (modeRef.current === 'v' && vStarted.current) {
        onDragEndRef.current();
      }
      modeRef.current = null;
      vStarted.current = false;
    },
    onPanResponderTerminate: () => {
      if (modeRef.current === 'v' && vStarted.current) onDragEndRef.current();
      modeRef.current = null;
      vStarted.current = false;
      Animated.spring(dragX, { toValue: 0, useNativeDriver: false }).start();
    },
  })).current;

  return (
    <Animated.View
      style={[rs.row, { backgroundColor: bgColor }, { transform: [{ translateX: dragX }] }]}
      {...panResponder.panHandlers}
    >
      <Animated.Text style={[rs.grip, { color: gripColor }]}>⠿</Animated.Text>

      <View style={{ flex: 1, minWidth: 0, justifyContent: 'center' }}>
        <Animated.View style={{ opacity: nameOpacity }}>
          <Text style={rs.exName} numberOfLines={1}>{def?.name ?? exConfig.exerciseId}</Text>
          <Text style={rs.exMeta}>
            {`${exConfig.sets} series · ${exConfig.restSec}s`}
            {exConfig.minReps && exConfig.maxReps ? `  ·  ${exConfig.minReps}–${exConfig.maxReps} rep` : ''}
          </Text>
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: labelOpacity, justifyContent: 'center' }]}>
          <Text style={rs.deleteLabel}>{t('editor.dropToDelete')}</Text>
        </Animated.View>
      </View>

      <TouchableOpacity
        style={[rs.editBtn, isEditing && rs.editBtnActive]}
        onPress={onToggleEdit}
      >
        <Text style={[rs.editBtnText, isEditing && rs.editBtnTextActive]}>
          {isEditing ? t('editor.close') : '✎'}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const rs = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2,
    gap: spacing.sm, minHeight: ITEM_HEIGHT,
    borderBottomWidth: borders.thin, borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  grip: { fontSize: 18, lineHeight: 22, flexShrink: 0 },
  exName: { fontSize: typography.base, fontWeight: typography.medium, color: colors.text },
  exMeta: { fontSize: typography.xs, color: colors.muted, marginTop: 1 },
  deleteLabel: { fontSize: typography.sm, color: '#ef4444', fontWeight: typography.medium },
  editBtn: {
    backgroundColor: colors.surface2,
    borderWidth: borders.thin, borderColor: colors.border,
    borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 5,
    flexShrink: 0,
  },
  editBtnActive: { backgroundColor: withOpacity(colors.accent, 0.1), borderColor: withOpacity(colors.accent, 0.35) },
  editBtnText: { fontSize: 11, color: colors.muted },
  editBtnTextActive: { color: colors.accent },
});

// ─── DayEditorCard ────────────────────────────────────────────────────────────

export default function DayEditorCard({ templateId, onRemove, navigation }) {
  const { t } = useTranslation();

  const exerciseLibrary  = useStore((s) => s.exerciseLibrary);
  const customExercises  = useStore((s) => s.customExercises);
  const sessionTemplates = useStore((s) => s.sessionTemplates);
  const userPrograms     = useStore((s) => s.userPrograms);
  const removeExercise   = useStore((s) => s.removeExercise);
  const reorderExercise  = useStore((s) => s.reorderExercise);
  const renameSession    = useStore((s) => s.renameSession);
  const restoreSession   = useStore((s) => s.restoreSession);
  const showToast        = useStore((s) => s.showToast);

  const allExercises = { ...exerciseLibrary, ...customExercises };
  const template = userPrograms[templateId] ?? sessionTemplates[templateId];
  const isEdited = !!userPrograms[templateId];

  const [open, setOpen]               = useState(false);
  const [editingExId, setEditingExId] = useState(null);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue]     = useState('');

  // Drag state
  const [localOrder, setLocalOrder] = useState([]);
  const localOrderRef               = useRef([]);
  const [draggingId, setDraggingId] = useState(null);
  const draggingIdRef               = useRef(null);
  const startIdxRef                 = useRef(0);
  // Y offset for the floating overlay (raw dy from drag start)
  const overlayDY = useRef(new Animated.Value(0)).current;
  // Pixel offset from top of body where drag started
  const draggingStartTopRef = useRef(0);

  useEffect(() => {
    if (!draggingIdRef.current) {
      const ids = (template?.exercises ?? []).map((ex) => ex.exerciseId);
      setLocalOrder(ids);
      localOrderRef.current = ids;
    }
  }, [template?.exercises]);

  if (!template) return null;

  const color = resolveColor(template.color ?? 'var(--accent)');

  // ── Drag handlers ─────────────────────────────────────────────────────────

  function handleDragStart(exerciseId) {
    const idx = localOrderRef.current.indexOf(exerciseId);
    startIdxRef.current      = idx;
    draggingIdRef.current    = exerciseId;
    draggingStartTopRef.current = idx * ITEM_HEIGHT;
    overlayDY.setValue(0);
    setEditingExId(null);
    setDraggingId(exerciseId);
  }

  function handleDragMove(exerciseId, dy) {
    if (draggingIdRef.current !== exerciseId) return;

    // Overlay follows the finger exactly from its starting position
    overlayDY.setValue(dy);

    const startIdx  = startIdxRef.current;
    const steps     = Math.round(dy / ITEM_HEIGHT);
    const n         = localOrderRef.current.length;
    const targetIdx = Math.max(0, Math.min(n - 1, startIdx + steps));
    const currentPos = localOrderRef.current.indexOf(exerciseId);

    if (targetIdx !== currentPos) {
      const newOrder = [...localOrderRef.current];
      newOrder.splice(currentPos, 1);
      newOrder.splice(targetIdx, 0, exerciseId);
      // LayoutAnimation animates the non-dragged items sliding into place.
      // The dragged item itself is hidden (opacity:0) so its animation is invisible.
      LayoutAnimation.configureNext(SWAP_ANIM);
      localOrderRef.current = newOrder;
      setLocalOrder([...newOrder]);
    }
  }

  function handleDragEnd(exerciseId) {
    if (draggingIdRef.current !== exerciseId) return;
    draggingIdRef.current = null;

    const finalOrder = localOrderRef.current;
    const reordered  = finalOrder
      .map((id, i) => {
        const ex = template.exercises.find((e) => e.exerciseId === id);
        return ex ? { ...ex, order: i + 1 } : null;
      })
      .filter(Boolean);

    if (reordered.length === template.exercises.length) {
      reorderExercise(templateId, exerciseId, 'custom', reordered);
    }

    setDraggingId(null);
  }

  function handleRemoveExercise(exerciseId) {
    if (editingExId === exerciseId) setEditingExId(null);
    removeExercise(templateId, exerciseId);
    showToast(t('editor.toastExDeleted'));
  }

  function handleAddExercise() {
    const existingPatterns = template.exercises
      .map((ex) => allExercises[ex.exerciseId]?.pattern)
      .filter(Boolean);
    navigation.navigate('ExerciseSelector', { templateId, existingPatterns });
  }

  function commitName() {
    const trimmed = nameValue.trim();
    if (trimmed && trimmed !== template.name) renameSession(templateId, trimmed);
    setEditingName(false);
  }

  const orderedExercises = localOrder
    .map((id) => template.exercises.find((ex) => ex.exerciseId === id))
    .filter(Boolean);

  // Editing exercise — resolved for modal
  const editingExConfig = editingExId
    ? template.exercises.find((ex) => ex.exerciseId === editingExId) ?? null
    : null;
  const editingDef = editingExId ? allExercises[editingExId] : null;

  // The dragged item's content for the floating overlay
  const draggingExConfig = draggingId
    ? template.exercises.find((ex) => ex.exerciseId === draggingId)
    : null;
  const draggingDef = draggingId ? allExercises[draggingId] : null;

  return (
    <>
    <View style={[styles.card, { borderLeftColor: color }]}>
      {/* ── Header ── */}
      <TouchableOpacity
        style={styles.header}
        onPress={() => { if (!editingName) { setOpen((o) => !o); setEditingExId(null); } }}
        activeOpacity={0.7}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.sesTag}>{`Sesión ${template.label ?? ''}`}</Text>
          {editingName ? (
            <TextInput
              autoFocus
              value={nameValue}
              onChangeText={setNameValue}
              onBlur={commitName}
              onSubmitEditing={commitName}
              style={[styles.sesName, { color, borderBottomWidth: 1, borderBottomColor: colors.accent }]}
            />
          ) : (
            <Text style={[styles.sesName, { color }]} numberOfLines={1}>
              {template.name ?? ''}
            </Text>
          )}
          <Text style={styles.subLabel}>
            {template.exercises.length}{' '}
            {template.exercises.length === 1 ? 'ejercicio' : 'ejercicios'}
            {isEdited ? <Text style={{ color: colors.accent }}> · {t('editor.edited')}</Text> : null}
          </Text>
        </View>
        <View style={styles.headerBtns}>
          <TouchableOpacity
            hitSlop={8}
            onPress={() => { setNameValue(template.name); setEditingName(true); }}
            style={styles.iconBtn}
          >
            <Text style={styles.iconBtnText}>✎</Text>
          </TouchableOpacity>
          {onRemove && (
            <TouchableOpacity hitSlop={8} onPress={onRemove} style={[styles.iconBtn, { marginLeft: spacing.xs }]}>
              <Text style={[styles.iconBtnText, { color: colors.muted2 }]}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>

      {/* ── Exercise list ── */}
      {open && (
        <View style={styles.body}>
          {orderedExercises.length === 0 && (
            <Text style={styles.emptyHint}>Añade ejercicios con el botón de abajo</Text>
          )}

          {orderedExercises.map((exConfig) => {
            const isDragging = draggingId === exConfig.exerciseId;
            return (
              <View key={exConfig.exerciseId} style={[{ overflow: 'visible' }, isDragging && { opacity: 0 }]}>
                <ExerciseRow
                  exConfig={exConfig}
                  def={allExercises[exConfig.exerciseId]}
                  isEditing={editingExId === exConfig.exerciseId}
                  onToggleEdit={() => setEditingExId(editingExId === exConfig.exerciseId ? null : exConfig.exerciseId)}
                  onDragStart={() => handleDragStart(exConfig.exerciseId)}
                  onDragMove={(dy) => handleDragMove(exConfig.exerciseId, dy)}
                  onDragEnd={() => handleDragEnd(exConfig.exerciseId)}
                  onSwipeDelete={handleRemoveExercise}
                />
              </View>
            );
          })}

          {/* Floating overlay — absolutely positioned, follows finger */}
          {draggingId && draggingExConfig && (
            <Animated.View
              pointerEvents="none"
              style={[
                rs.row, styles.overlayRow,
                { top: draggingStartTopRef.current },
                { transform: [{ translateY: overlayDY }] },
              ]}
            >
              <Text style={[rs.grip, { color: colors.muted2 }]}>⠿</Text>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={rs.exName} numberOfLines={1}>
                  {draggingDef?.name ?? draggingExConfig.exerciseId}
                </Text>
                <Text style={rs.exMeta}>
                  {`${draggingExConfig.sets} series · ${draggingExConfig.restSec}s`}
                  {draggingExConfig.minReps && draggingExConfig.maxReps
                    ? `  ·  ${draggingExConfig.minReps}–${draggingExConfig.maxReps} rep`
                    : ''}
                </Text>
              </View>
            </Animated.View>
          )}

          {/* Add exercise + Restore */}
          <View style={styles.bodyActions}>
            <TouchableOpacity style={[styles.addExBtn, { flex: 1 }]} onPress={handleAddExercise}>
              <Text style={styles.addExBtnText}>{t('editor.addExercise')}</Text>
            </TouchableOpacity>
            {isEdited && (
              <TouchableOpacity
                style={styles.restoreBtn}
                onPress={() => {
                  restoreSession(templateId);
                  showToast('Sesión restaurada');
                }}
              >
                <Text style={styles.restoreBtnText}>Restaurar</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
    </View>

    {/* ── Exercise editor modal ────────────────────────────────────────────── */}
    {editingExConfig && (
      <Modal
        visible
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setEditingExId(null)}
      >
        <SafeAreaView style={styles.modalSafe}>
          {/* Header */}
          <View style={styles.modalTopbar}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.modalExTag}>EJERCICIO</Text>
              <Text style={styles.modalExName} numberOfLines={1}>
                {editingDef?.name ?? editingExId}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.modalAcceptBtn}
              onPress={() => setEditingExId(null)}
              activeOpacity={0.8}
            >
              <Text style={styles.modalAcceptTxt}>Aceptar</Text>
            </TouchableOpacity>
          </View>
          {/* Content */}
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <ExerciseEditorInline
                templateId={templateId}
                exConfig={editingExConfig}
                def={editingDef}
                onClose={() => setEditingExId(null)}
                navigation={navigation}
              />
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    )}
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: borders.thin,
    borderColor: colors.border,
    borderLeftWidth: 3,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
  },
  sesTag: {
    fontSize: 9, fontWeight: typography.bold,
    color: colors.muted2, letterSpacing: 1,
    textTransform: 'uppercase', marginBottom: 1,
  },
  sesName: {
    fontSize: typography.base, fontWeight: typography.bold,
    lineHeight: typography.base * 1.2,
  },
  subLabel: { fontSize: typography.xs, color: colors.muted, marginTop: 2 },
  headerBtns: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  iconBtn: { padding: spacing.xs },
  iconBtnText: { fontSize: 12, color: colors.muted },
  chevron: { fontSize: 16, color: colors.muted, marginLeft: 4 },

  body: {
    borderTopWidth: borders.thin, borderTopColor: colors.border,
    overflow: 'visible',
  },
  emptyHint: {
    fontSize: typography.xs, color: colors.muted,
    padding: spacing.md, textAlign: 'center',
  },
  // ── Exercise editor modal ────────────────────────────────────────────────
  modalSafe: {
    flex:            1,
    backgroundColor: colors.bg,
  },
  modalTopbar: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: spacing.lg,
    paddingVertical:   spacing.md,
    borderBottomWidth: borders.thin,
    borderBottomColor: colors.border,
  },
  modalExTag: {
    fontSize:      typography.xs,
    fontWeight:    typography.bold,
    color:         colors.muted,
    letterSpacing: 1,
  },
  modalExName: {
    fontSize:   typography.lg,
    fontWeight: typography.bold,
    color:      colors.text,
    marginTop:  2,
  },
  modalAcceptBtn: {
    backgroundColor:   colors.accent,
    paddingHorizontal: spacing.md,
    paddingVertical:   8,
    borderRadius:      radius.sm,
    marginLeft:        spacing.md,
    alignItems:        'center',
    justifyContent:    'center',
  },
  modalAcceptTxt: {
    fontSize:   typography.sm,
    fontWeight: typography.heavy,
    color:      colors.onAccent,
    letterSpacing: 0.5,
  },
  bodyActions: {
    flexDirection: 'row',
    gap: spacing.xs,
    margin: spacing.md,
  },
  addExBtn: {
    paddingVertical: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1, borderStyle: 'dashed',
    borderColor: withOpacity(colors.accent, 0.4),
    alignItems: 'center',
    backgroundColor: withOpacity(colors.accent, 0.04),
  },
  addExBtnText: { fontSize: typography.sm, color: colors.accent },
  restoreBtn: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    borderWidth: borders.thin,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  restoreBtnText: { fontSize: typography.xs, color: colors.muted },

  overlayRow: {
    position: 'absolute', left: 0, right: 0,
    elevation: 12, zIndex: 100,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8,
    backgroundColor: colors.surface2,
  },
});
