/**
 * SessionEditorScreen — full-screen editor for one session template.
 *
 * Replaces the old accordion body of DayEditorCard: the exercise list gets
 * the whole screen, a live summary shows volume (sets per movement pattern)
 * and estimated duration, and tapping a row opens the exercise editor.
 * Drag (grip) to reorder and right-swipe to delete are unchanged.
 */
import { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  Animated, PanResponder, LayoutAnimation, Platform, UIManager,
  Modal, KeyboardAvoidingView, Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../store/useStore';
import { resolveProgressionConfig } from '../../../src/utils/progression';
import { exerciseLinkGroups } from '../../../src/utils/exerciseLinks';
import { sessionStats } from '../utils/sessionStats';
import { spacing, typography, borders, withOpacity } from '../theme';
import { useTheme, useThemedStyles } from '../useTheme';
import { resolveColor } from '../themes';
import ExerciseEditorInline from '../components/editor/ExerciseEditorInline';
import BlockEditorInline from '../components/editor/BlockEditorInline';
import DragSheet from '../components/DragSheet';
import { generateId } from '../../../src/utils/formatters';

// LayoutAnimation must be enabled explicitly on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ACTION_BTN_WIDTH = 75;
const SWIPE_OPEN       = ACTION_BTN_WIDTH * 2;
const ITEM_HEIGHT      = 58;

const SWAP_ANIM = {
  duration: 180,
  update: { type: LayoutAnimation.Types.easeInEaseOut },
};

// ─── Row meta + badges ────────────────────────────────────────────────────────

function rowMeta(exConfig, t) {
  const timed = exConfig.inputType === 'time' || exConfig.inputType === 'weight_time';
  const range = timed
    ? `${exConfig.minTime ?? 20}–${exConfig.maxTime ?? 40} s`
    : exConfig.minReps && exConfig.maxReps
      ? `${exConfig.minReps}–${exConfig.maxReps}`
      : t('workout.submax', 'submáx');
  return `${exConfig.sets} × ${range} · ${exConfig.restSec} s`;
}

function progMode(exConfig, def) {
  const prog = resolveProgressionConfig(exConfig, def);
  if (prog.type !== 'none') return 'auto';
  return (exConfig.progressionModel ?? def?.progressionModel) === 'submax' ? 'submax' : 'fixed';
}

// ─── Block row meta + badges ───────────────────────────────────────────────────

const BLOCK_BADGE_STYLE = {
  amrap:    'badgeBlockAmrap',
  emom:     'badgeBlockEmom',
  for_time: 'badgeBlockForTime',
};

function blockMeta(block, t) {
  const count = block.movements?.length ?? 0;
  if (block.format === 'amrap') {
    return t('blocks.meta.amrap', { count, min: Math.round((block.capSec ?? 600) / 60) });
  }
  if (block.format === 'emom') {
    const mm = Math.floor((block.intervalSec ?? 60) / 60);
    const ss = (block.intervalSec ?? 60) % 60;
    return t('blocks.meta.emom', { count, n: block.rounds ?? 10, interval: `${mm}:${String(ss).padStart(2, '0')}` });
  }
  return t('blocks.meta.forTime', { count, rounds: block.rounds ?? 3 });
}

function defaultBlock() {
  return {
    id: generateId('blk'),
    format: 'amrap',
    capSec: 600,
    intervalSec: null,
    rounds: null,
    emomMode: 'rotate',
    movements: [],
    name: null,
    notes: null,
  };
}

// ─── ExerciseRow ──────────────────────────────────────────────────────────────
// Grip (left 50 px) drags to reorder; right-swipe reveals a 2-button action
// panel (sustituir / eliminar) underneath — tap a button to act, tap the row
// again to close it. Tapping the body while closed opens the exercise editor.

function ExerciseRow({
  exConfig, def, onPress, linkBadge,
  isSSMember, ssConnectDown,
  onDragStart, onDragMove, onDragEnd,
  isOpen, onOpenChange,
  onSwipeDelete, onSubstitute,
}) {
  const { t } = useTranslation();
  const rs    = useThemedStyles(makeRs);

  const dragX    = useRef(new Animated.Value(0)).current;
  const modeRef  = useRef(null); // 'h' | 'v' | null
  const vStarted = useRef(false);
  const openRef  = useRef(false);

  // Callback refs prevent stale closures inside the once-created PanResponder
  const onDragStartRef  = useRef(onDragStart);
  const onDragMoveRef   = useRef(onDragMove);
  const onDragEndRef    = useRef(onDragEnd);
  const onOpenChangeRef = useRef(onOpenChange);
  const onPressRef      = useRef(onPress);
  useEffect(() => {
    onDragStartRef.current  = onDragStart;
    onDragMoveRef.current   = onDragMove;
    onDragEndRef.current    = onDragEnd;
    onOpenChangeRef.current = onOpenChange;
    onPressRef.current      = onPress;
  });

  // Another row opened (or a parent action closed this one) — snap shut.
  useEffect(() => {
    if (!isOpen && openRef.current) {
      openRef.current = false;
      Animated.spring(dragX, { toValue: 0, useNativeDriver: false, tension: 80 }).start();
    }
  }, [isOpen, dragX]);

  const panResponder = useRef(PanResponder.create({
    // Grip (leftmost 50 px): claim immediately → reliable vertical reorder.
    // Disabled while open (a touch there should close the row, not drag it).
    onStartShouldSetPanResponder: (e) => !openRef.current && e.nativeEvent.locationX < 50,
    // Horizontal right-swipe anywhere: claim on movement → reveal actions.
    // Disabled while already open — closing happens via tap, not drag.
    onMoveShouldSetPanResponder: (_, gs) => !openRef.current && gs.dx > 8 && gs.dx > Math.abs(gs.dy) * 1.3,
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
        dragX.setValue(Math.min(gs.dx, SWIPE_OPEN));
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
        const opening = gs.dx >= SWIPE_OPEN / 2;
        openRef.current = opening;
        Animated.spring(dragX, { toValue: opening ? SWIPE_OPEN : 0, useNativeDriver: false, tension: 80 }).start();
        onOpenChangeRef.current(opening);
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
      if (!openRef.current) Animated.spring(dragX, { toValue: 0, useNativeDriver: false }).start();
    },
  })).current;

  function closeRow() {
    openRef.current = false;
    Animated.spring(dragX, { toValue: 0, useNativeDriver: false, tension: 80 }).start();
    onOpenChangeRef.current(false);
  }

  function handleBodyPress() {
    if (openRef.current) { closeRow(); return; }
    onPressRef.current();
  }

  const mode = progMode(exConfig, def);

  return (
    <View style={{ position: 'relative' }}>
      <View style={rs.actionPanel} pointerEvents="box-none">
        <TouchableOpacity
          style={[rs.actionBtn, rs.actionBtnSubstitute]}
          onPress={() => { closeRow(); onSubstitute(exConfig.exerciseId); }}
          activeOpacity={0.75}
        >
          <Text style={rs.actionBtnText}>{t('editor.rowSubstitute')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[rs.actionBtn, rs.actionBtnDelete]}
          onPress={() => { closeRow(); onSwipeDelete(exConfig.exerciseId); }}
          activeOpacity={0.75}
        >
          <Text style={rs.actionBtnText}>{t('editor.rowDelete')}</Text>
        </TouchableOpacity>
      </View>

      <Animated.View
        style={[
          rs.row,
          isSSMember && rs.rowSS,
          ssConnectDown && rs.rowSSConnected,
          { transform: [{ translateX: dragX }] },
        ]}
        {...panResponder.panHandlers}
      >
        <Text style={rs.grip}>⠿</Text>

        <TouchableOpacity
          style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}
          onPress={handleBodyPress}
          activeOpacity={0.7}
        >
          <View style={{ flex: 1, minWidth: 0, justifyContent: 'center' }}>
            <Text style={rs.exName} numberOfLines={1}>{def?.name ?? exConfig.exerciseId}</Text>
            <View style={rs.metaRow}>
              <Text style={rs.exMeta}>{rowMeta(exConfig, t)}</Text>
              <Text style={[rs.badge, mode === 'auto' ? rs.badgeAuto : rs.badgeNeutral]}>
                {t(`editor.badges.${mode}`)}
              </Text>
              {linkBadge ? <Text style={[rs.badge, rs.badgeLink]}>{linkBadge}</Text> : null}
              {isSSMember ? <Text style={[rs.badge, rs.badgeSS]}>SS</Text> : null}
              {exConfig.isUnilateral ? <Text style={[rs.badge, rs.badgeUni]}>UNI</Text> : null}
              {exConfig.trackRpe ? <Text style={[rs.badge, rs.badgeRpe]}>RPE</Text> : null}
            </View>
          </View>
          <Text style={rs.chevron}>›</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const makeRs = (th) => StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2,
    gap: spacing.sm, minHeight: ITEM_HEIGHT,
    borderBottomWidth: borders.thin, borderBottomColor: th.colors.border,
    backgroundColor: th.colors.surface,
  },
  grip: { fontSize: 18, lineHeight: 22, flexShrink: 0, color: th.colors.muted2 },
  exName: { fontSize: typography.base, fontWeight: typography.medium, color: th.colors.text },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: 2, flexWrap: 'wrap' },
  exMeta: { fontSize: typography.xs, color: th.colors.muted },
  badge: {
    fontSize: 8, fontWeight: typography.bold, letterSpacing: 0.4,
    paddingHorizontal: 4, paddingVertical: 1,
    borderRadius: th.radius.xs, overflow: 'hidden',
  },
  badgeAuto:    { backgroundColor: withOpacity(th.colors.accent, 0.12), color: th.colors.accent },
  badgeNeutral: { backgroundColor: th.colors.surface2, color: th.colors.muted },
  badgeLink:    { backgroundColor: withOpacity(th.colors.green, 0.12), color: th.colors.green },
  badgeUni:     { backgroundColor: withOpacity(th.colors.orange, 0.12), color: th.colors.orange },
  badgeRpe:     { backgroundColor: withOpacity(th.colors.blue, 0.12), color: th.colors.blue },
  badgeSS:      { backgroundColor: withOpacity(th.colors.accent, 0.14), color: th.colors.accent },
  // Superset chain — continuous accent strip on the left; the connecting
  // member's bottom border is dropped so it visually merges into the next row.
  rowSS:          { borderLeftWidth: 3, borderLeftColor: th.colors.accent },
  rowSSConnected: { borderBottomWidth: 0 },
  chevron: { fontSize: typography.lg, color: th.colors.muted2, flexShrink: 0 },
  // Action panel sits behind the row (position:absolute, left:0) and is
  // progressively revealed as the row slides right on swipe.
  actionPanel: {
    position: 'absolute', left: 0, top: 0, bottom: 0,
    flexDirection: 'row', width: SWIPE_OPEN,
  },
  actionBtn: {
    width: ACTION_BTN_WIDTH, alignItems: 'center', justifyContent: 'center',
  },
  actionBtnSubstitute: { backgroundColor: th.colors.blue },
  actionBtnDelete:     { backgroundColor: th.colors.red },
  actionBtnText: {
    fontSize: typography.xs, fontWeight: typography.bold, color: th.colors.onAccent,
    textAlign: 'center', paddingHorizontal: 4,
  },
  badgeBlockAmrap:   { backgroundColor: withOpacity(th.colors.accent, 0.12), color: th.colors.accent },
  badgeBlockEmom:    { backgroundColor: withOpacity(th.colors.blue, 0.12),   color: th.colors.blue },
  badgeBlockForTime: { backgroundColor: withOpacity(th.colors.orange, 0.12), color: th.colors.orange },
  removeBtn: { fontSize: typography.md, color: th.colors.muted, padding: spacing.xs },
});

// ─── BlockRow ─────────────────────────────────────────────────────────────────
// No drag, no swipe (v1 — few blocks per session, order = creation order).

function BlockRow({ block, onPress, onRemove }) {
  const { t } = useTranslation();
  const rs = useThemedStyles(makeRs);

  return (
    <View style={rs.row}>
      <TouchableOpacity
        style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}
        onPress={onPress}
        activeOpacity={0.7}
      >
        <View style={{ flex: 1, minWidth: 0, justifyContent: 'center' }}>
          <Text style={rs.exName} numberOfLines={1}>
            {block.name ?? t(`blocks.formats.${block.format}`)}
          </Text>
          <View style={rs.metaRow}>
            <Text style={[rs.badge, rs[BLOCK_BADGE_STYLE[block.format]]]}>
              {t(`blocks.formats.${block.format}`).toUpperCase()}
            </Text>
            <Text style={rs.exMeta}>{blockMeta(block, t)}</Text>
          </View>
        </View>
        <Text style={rs.chevron}>›</Text>
      </TouchableOpacity>
      <TouchableOpacity hitSlop={8} onPress={onRemove}>
        <Text style={rs.removeBtn}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function PencilIcon({ size = 15, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 20h9" stroke={color} strokeWidth={1.7} strokeLinecap="round" />
      <Path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"
            stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function CheckIcon({ size = 16, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M20 6L9 17l-5-5" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// ─── SessionEditorScreen ──────────────────────────────────────────────────────

export default function SessionEditorScreen({ navigation, route }) {
  const { templateId: initialTemplateId, programId, stageIdx = null } = route.params ?? {};
  const { t } = useTranslation();
  const th     = useTheme();
  const rs     = useThemedStyles(makeRs);
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();

  // The open session is local state (not a route param) so the chips bar can
  // switch sessions in place without stacking screens.
  const [templateId, setTemplateId] = useState(initialTemplateId);

  const programs         = useStore((s) => s.programs);
  const exerciseLibrary  = useStore((s) => s.exerciseLibrary);
  const customExercises  = useStore((s) => s.customExercises);
  const sessionTemplates = useStore((s) => s.sessionTemplates);
  const userPrograms     = useStore((s) => s.userPrograms);
  const removeExercise   = useStore((s) => s.removeExercise);
  const reorderExercise  = useStore((s) => s.reorderExercise);
  const renameSession    = useStore((s) => s.renameSession);
  const restoreSession   = useStore((s) => s.restoreSession);
  const removeSessionFromProgram   = useStore((s) => s.removeSessionFromProgram);
  const duplicateSessionInProgram  = useStore((s) => s.duplicateSessionInProgram);
  const showToast        = useStore((s) => s.showToast);
  const blockPresets          = useStore((s) => s.blockPresets);
  const addBlockToSession     = useStore((s) => s.addBlockToSession);
  const removeBlockFromSession = useStore((s) => s.removeBlockFromSession);
  const deleteBlockPreset     = useStore((s) => s.deleteBlockPreset);

  const allExercises = { ...exerciseLibrary, ...customExercises };
  const template = userPrograms[templateId] ?? sessionTemplates[templateId];
  const isEdited = !!userPrograms[templateId];

  // Sibling sessions (live from the store, so deletes/additions stay fresh)
  const program    = programs[programId];
  const stage      = stageIdx != null ? program?.stages?.[stageIdx] : null;
  const days       = stage?.days ?? program?.days ?? [];
  const sessionIds = days.map((d) => d.sessionTemplateId);
  const stageLabel = stage?.name;
  const canDelete  = sessionIds.length > 1;

  function switchSession(id) {
    if (id === templateId) return;
    setEditingName(false);
    setEditingExId(null);
    setEditingBlockId(null);
    setOpenExId(null);
    setTemplateId(id);
  }

  const [editingExId, setEditingExId] = useState(null);
  const [editingBlockId, setEditingBlockId] = useState(null);
  const [openExId, setOpenExId] = useState(null); // row with its swipe action panel revealed
  const [presetSheetOpen, setPresetSheetOpen] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue]     = useState('');
  const nameToggleGuard               = useRef(0); // debounces blur→re-press on the edit toggle

  // Drag state
  const [localOrder, setLocalOrder] = useState([]);
  const localOrderRef               = useRef([]);
  const [draggingId, setDraggingId] = useState(null);
  const draggingIdRef               = useRef(null);
  const startIdxRef                 = useRef(0);
  // Y offset for the floating overlay (raw dy from drag start)
  const overlayDY = useRef(new Animated.Value(0)).current;
  // Pixel offset from top of the list where drag started
  const draggingStartTopRef = useRef(0);

  useEffect(() => {
    if (!draggingIdRef.current) {
      const ids = (template?.exercises ?? []).map((ex) => ex.exerciseId);
      setLocalOrder(ids);
      localOrderRef.current = ids;
    }
  }, [template?.exercises]);

  if (!template) return null;

  const color = resolveColor(th, template.color ?? 'var(--accent)');
  const stats = sessionStats(template, allExercises);
  const patternEntries = Object.entries(stats.patternSets).sort((a, b) => b[1] - a[1]);

  // "G1"/"G2" badge for linked exercises (group number = order of appearance
  // of that exercise's groups within the program).
  const getTpl = (tid) => userPrograms[tid] ?? sessionTemplates[tid];
  function linkBadgeFor(exConfig) {
    if (!exConfig.linkGroup) return null;
    const groups = exerciseLinkGroups(program, exConfig.exerciseId, getTpl);
    const idx = groups.findIndex((g) => g.id === exConfig.linkGroup);
    return idx >= 0 ? `G${idx + 1}` : 'G1';
  }

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
    showToast(t('editor.toastExDeleted'), 2200, 'neutral');
  }

  function handleSubstituteExercise(exerciseId) {
    navigation.navigate('ExerciseSelector', {
      templateId,
      currentExerciseId: exerciseId,
      existingPatterns: [],
    });
  }

  function handleAddExercise() {
    const existingPatterns = template.exercises
      .map((ex) => allExercises[ex.exerciseId]?.pattern)
      .filter(Boolean);
    navigation.navigate('ExerciseSelector', { templateId, existingPatterns });
  }

  function handleAddBlock() {
    if (blockPresets.length > 0) {
      Alert.alert(
        t('blocks.addBlock'),
        '',
        [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('blocks.newBlock'), onPress: createNewBlock },
          { text: t('blocks.fromPreset'), onPress: () => setPresetSheetOpen(true) },
        ]
      );
    } else {
      createNewBlock();
    }
  }

  function createNewBlock() {
    const block = defaultBlock();
    addBlockToSession(templateId, block);
    setEditingBlockId(block.id);
  }

  function handlePickPreset(preset) {
    const { presetId: _presetId, ...rest } = preset;
    const block = { ...rest, id: generateId('blk') };
    addBlockToSession(templateId, block);
    setPresetSheetOpen(false);
    setEditingBlockId(block.id);
  }

  function handleRemoveBlock(block) {
    Alert.alert(
      t('blocks.deleteBlock'),
      t('blocks.deleteConfirm', { name: block.name ?? t(`blocks.formats.${block.format}`) }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('blocks.deleteBlock'), style: 'destructive',
          onPress: () => {
            if (editingBlockId === block.id) setEditingBlockId(null);
            removeBlockFromSession(templateId, block.id);
          },
        },
      ]
    );
  }

  function handleDeleteSession() {
    Alert.alert(
      t('editor.sessionDeleteBtn'),
      `¿Eliminar "${template.name}"?`,
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('editor.sessionDeleteBtn'), style: 'destructive',
          onPress: () => {
            navigation.goBack();
            removeSessionFromProgram(programId, templateId);
          },
        },
      ]
    );
  }

  function commitName() {
    const trimmed = nameValue.trim();
    if (trimmed && trimmed !== template.name) renameSession(templateId, trimmed);
    setEditingName(false);
    nameToggleGuard.current = Date.now();
  }

  function toggleEditName() {
    // A blur from tapping this same button may have just committed and closed —
    // ignore the immediate re-press so it doesn't bounce back into edit mode.
    if (Date.now() - nameToggleGuard.current < 250) return;
    if (editingName) {
      commitName();
    } else {
      setNameValue(template.name ?? '');
      setEditingName(true);
    }
  }

  const orderedExercises = localOrder
    .map((id) => template.exercises.find((ex) => ex.exerciseId === id))
    .filter(Boolean);

  // Editing exercise — resolved for modal
  const editingExConfig = editingExId
    ? template.exercises.find((ex) => ex.exerciseId === editingExId) ?? null
    : null;
  const editingDef = editingExId ? allExercises[editingExId] : null;
  const editingExHasNext = editingExId
    ? orderedExercises.findIndex((ex) => ex.exerciseId === editingExId) < orderedExercises.length - 1
    : false;

  // Editing block — resolved for modal
  const editingBlock = editingBlockId
    ? (template.blocks ?? []).find((b) => b.id === editingBlockId) ?? null
    : null;

  // The dragged item's content for the floating overlay
  const draggingExConfig = draggingId
    ? template.exercises.find((ex) => ex.exerciseId === draggingId)
    : null;
  const draggingDef = draggingId ? allExercises[draggingId] : null;

  return (
    <SafeAreaView edges={['top']} style={styles.container}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12} style={styles.backBtn}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.sesTag}>
            {`Sesión ${template.label ?? ''}`}{stageLabel ? ` · ${stageLabel}` : ''}
          </Text>
          <View style={styles.nameRow}>
            {editingName ? (
              <TextInput
                autoFocus
                value={nameValue}
                onChangeText={setNameValue}
                onBlur={commitName}
                onSubmitEditing={commitName}
                style={[styles.sesName, { color, flex: 1, borderBottomWidth: 1, borderBottomColor: th.colors.accent }]}
              />
            ) : (
              <Text style={[styles.sesName, { color }]} numberOfLines={1}>
                {template.name ?? ''}
              </Text>
            )}
            <TouchableOpacity hitSlop={8} onPress={toggleEditName} style={styles.iconBtn}>
              {editingName
                ? <CheckIcon size={16} color={th.colors.accent} />
                : <PencilIcon size={15} color={th.colors.muted} />}
            </TouchableOpacity>
          </View>
        </View>
        <View style={[styles.colorDot, { backgroundColor: color }]} />
      </View>

      {/* ── Session chips — switch sessions in place ── */}
      {sessionIds.length > 1 && (
        <View style={styles.chipsBar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsContent}>
            {sessionIds.map((id) => {
              const tmpl = userPrograms[id] ?? sessionTemplates[id];
              if (!tmpl) return null;
              const c = resolveColor(th, tmpl.color ?? 'var(--accent)');
              const isCurrent = id === templateId;
              return (
                <TouchableOpacity
                  key={id}
                  style={[
                    styles.sessionChip,
                    isCurrent && { backgroundColor: withOpacity(c, 0.14), borderColor: c },
                  ]}
                  onPress={() => switchSession(id)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.sessionChipText, isCurrent && { color: c }]}>
                    {tmpl.label ?? '·'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + spacing.xxl }]}
        keyboardShouldPersistTaps="handled"
      >

        {/* ── Summary ── */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTag}>{t('exerciseEditor.summaryTitle')}</Text>
          <Text style={styles.summaryMain}>
            {stats.minutes > 0
              ? t('editor.sessionMeta',       { ex: stats.exercises, sets: stats.sets, min: stats.minutes })
              : t('editor.sessionMetaNoTime', { ex: stats.exercises, sets: stats.sets })}
          </Text>
          {patternEntries.length > 0 && (
            <View style={styles.chipRow}>
              {patternEntries.map(([pattern, sets]) => (
                <Text key={pattern} style={styles.patternChip}>
                  {t(`exerciseSelector.patterns.${pattern}`, pattern)} ×{sets}
                </Text>
              ))}
            </View>
          )}
        </View>

        {/* ── Exercise list ── */}
        <View style={styles.listCard}>
          {orderedExercises.length === 0 && (
            <Text style={styles.emptyHint}>{t('editor.addExercise')}</Text>
          )}

          {orderedExercises.map((exConfig, idx) => {
            const isDragging = draggingId === exConfig.exerciseId;
            const prevEx = orderedExercises[idx - 1];
            const isSSMember = !!exConfig.supersetWithNext || !!prevEx?.supersetWithNext;
            return (
              <View key={exConfig.exerciseId} style={[{ overflow: 'visible' }, isDragging && { opacity: 0 }]}>
                <ExerciseRow
                  exConfig={exConfig}
                  def={allExercises[exConfig.exerciseId]}
                  linkBadge={linkBadgeFor(exConfig)}
                  isSSMember={isSSMember}
                  ssConnectDown={!!exConfig.supersetWithNext}
                  onPress={() => setEditingExId(exConfig.exerciseId)}
                  onDragStart={() => handleDragStart(exConfig.exerciseId)}
                  onDragMove={(dy) => handleDragMove(exConfig.exerciseId, dy)}
                  onDragEnd={() => handleDragEnd(exConfig.exerciseId)}
                  isOpen={openExId === exConfig.exerciseId}
                  onOpenChange={(open) => setOpenExId(open ? exConfig.exerciseId : null)}
                  onSwipeDelete={handleRemoveExercise}
                  onSubstitute={handleSubstituteExercise}
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
              <Text style={[rs.grip, { color: th.colors.muted2 }]}>⠿</Text>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={rs.exName} numberOfLines={1}>
                  {draggingDef?.name ?? draggingExConfig.exerciseId}
                </Text>
                <Text style={rs.exMeta}>{rowMeta(draggingExConfig, t)}</Text>
              </View>
            </Animated.View>
          )}
        </View>

        {/* ── Blocks (AMRAP/EMOM/for time) — after exercises, no drag/swipe v1 ── */}
        {template.blocks?.length > 0 && (
          <View>
            <Text style={styles.secTitle}>{t('blocks.sectionTitle')}</Text>
            <View style={styles.listCard}>
              {template.blocks.map((block) => (
                <BlockRow
                  key={block.id}
                  block={block}
                  onPress={() => setEditingBlockId(block.id)}
                  onRemove={() => handleRemoveBlock(block)}
                />
              ))}
            </View>
          </View>
        )}

        {/* ── Actions ── */}
        <TouchableOpacity style={styles.addExBtn} onPress={handleAddExercise}>
          <Text style={styles.addExBtnText}>{t('editor.addExercise')}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.addBlockBtn} onPress={handleAddBlock}>
          <Text style={styles.addBlockBtnText}>{t('blocks.addBlock')}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.dupBtn}
          onPress={() => {
            const newId = duplicateSessionInProgram(programId, templateId);
            if (newId) {
              switchSession(newId);
              showToast(t('editor.toastSessionDuplicated'), 2200, 'success');
            }
          }}
          activeOpacity={0.7}
        >
          <Text style={styles.dupBtnText}>{t('editor.sessionDuplicateBtn')}</Text>
        </TouchableOpacity>

        {isEdited && (
          <TouchableOpacity
            style={styles.footerBtn}
            onPress={() => {
              restoreSession(templateId);
              showToast(t('editor.toastReset'), 2200, 'success');
            }}
          >
            <Text style={styles.footerBtnText}>{t('editor.sessionRestoreBtn')}</Text>
          </TouchableOpacity>
        )}

        {canDelete && programId && (
          <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteSession}>
            <Text style={styles.deleteBtnText}>{t('editor.sessionDeleteBtn')}</Text>
          </TouchableOpacity>
        )}

      </ScrollView>

      {/* ── Exercise editor modal ── */}
      {editingExConfig && (
        <Modal
          visible
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setEditingExId(null)}
        >
          <SafeAreaView edges={['top', 'bottom']} style={styles.modalSafe}>
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
                  hasNextExercise={editingExHasNext}
                />
              </ScrollView>
            </KeyboardAvoidingView>
          </SafeAreaView>
        </Modal>
      )}

      {/* ── Block editor modal ── */}
      {editingBlock && (
        <Modal
          visible
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setEditingBlockId(null)}
        >
          <SafeAreaView edges={['top', 'bottom']} style={styles.modalSafe}>
            {/* Header */}
            <View style={styles.modalTopbar}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.modalExTag}>{t('blocks.sectionTitle').toUpperCase()}</Text>
                <Text style={styles.modalExName} numberOfLines={1}>
                  {editingBlock.name ?? t(`blocks.formats.${editingBlock.format}`)}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.modalAcceptBtn}
                onPress={() => setEditingBlockId(null)}
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
                <BlockEditorInline
                  templateId={templateId}
                  block={editingBlock}
                  allExercises={allExercises}
                  onClose={() => setEditingBlockId(null)}
                  navigation={navigation}
                />
              </ScrollView>
            </KeyboardAvoidingView>
          </SafeAreaView>
        </Modal>
      )}

      {/* ── Preset picker sheet ── */}
      <DragSheet
        visible={presetSheetOpen}
        onClose={() => setPresetSheetOpen(false)}
        title={t('blocks.fromPreset')}
      >
        <View style={{ paddingBottom: spacing.sm }}>
          {blockPresets.map((preset) => (
            <View key={preset.presetId} style={styles.presetRow}>
              <TouchableOpacity
                style={{ flex: 1, minWidth: 0 }}
                onPress={() => handlePickPreset(preset)}
                activeOpacity={0.7}
              >
                <Text style={styles.presetName} numberOfLines={1}>
                  {preset.name ?? t(`blocks.formats.${preset.format}`)}
                </Text>
                <Text style={styles.presetMeta}>{blockMeta(preset, t)}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                hitSlop={8}
                onPress={() => {
                  Alert.alert(
                    t('blocks.deletePreset'),
                    t('blocks.deleteConfirm', { name: preset.name ?? t(`blocks.formats.${preset.format}`) }),
                    [
                      { text: t('common.cancel'), style: 'cancel' },
                      { text: t('blocks.deletePreset'), style: 'destructive', onPress: () => deleteBlockPreset(preset.presetId) },
                    ]
                  );
                }}
              >
                <Text style={rs.removeBtn}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      </DragSheet>

    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const makeStyles = (th) => StyleSheet.create({
  container: { flex: 1, backgroundColor: th.colors.bg },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: borders.thin,
    borderBottomColor: th.colors.border,
  },
  backBtn: { padding: spacing.xs },
  backIcon: { fontSize: 26, color: th.colors.muted, lineHeight: 30 },
  sesTag: {
    fontSize: 9, fontWeight: typography.bold,
    color: th.colors.muted2, letterSpacing: 1,
    textTransform: 'uppercase', marginBottom: 1,
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  sesName: {
    fontSize: typography.lg, fontWeight: typography.bold,
    lineHeight: typography.lg * 1.2,
    flexShrink: 1,
  },
  iconBtn: { padding: spacing.xs },
  colorDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },

  // Session chips
  chipsBar: {
    borderBottomWidth: borders.thin,
    borderBottomColor: th.colors.border,
  },
  chipsContent: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  sessionChip: {
    minWidth: 44,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: th.radius.sm,
    borderWidth: borders.thin,
    borderColor: th.colors.border,
    backgroundColor: th.colors.surface,
    alignItems: 'center',
  },
  sessionChipText: {
    fontSize: typography.sm,
    fontWeight: typography.bold,
    color: th.colors.muted,
  },

  scrollContent: {
    paddingHorizontal: spacing.xl, paddingTop: spacing.md,
    gap: spacing.md,
  },

  // Summary
  summaryCard: {
    backgroundColor: withOpacity(th.colors.accent, 0.06),
    borderWidth:     borders.thin,
    borderColor:     withOpacity(th.colors.accent, 0.25),
    borderRadius:    th.radius.md,
    padding:         spacing.md,
    gap:             2,
  },
  summaryTag: {
    fontSize:      typography.xs - 1,
    fontWeight:    typography.heavy,
    color:         withOpacity(th.colors.accent, 0.7),
    letterSpacing: 1.2,
    marginBottom:  2,
  },
  summaryMain: {
    fontSize:   typography.md,
    fontWeight: typography.semibold,
    color:      th.colors.accent,
  },
  chipRow: {
    flexDirection: 'row', flexWrap: 'wrap',
    gap: spacing.xs, marginTop: spacing.sm,
  },
  patternChip: {
    fontSize: typography.xs,
    fontWeight: typography.medium,
    color: th.colors.mutedLight,
    backgroundColor: th.colors.surface2,
    borderWidth: borders.thin,
    borderColor: th.colors.border,
    borderRadius: th.radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    overflow: 'hidden',
  },

  // Section title (blocks)
  secTitle: {
    fontSize:      typography.xs,
    fontWeight:    typography.bold,
    color:         th.colors.muted,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom:  spacing.sm,
  },

  // List
  listCard: {
    backgroundColor: th.colors.surface,
    borderWidth: borders.thin,
    borderColor: th.colors.border,
    borderRadius: th.radius.md,
    overflow: 'visible',
  },
  emptyHint: {
    fontSize: typography.xs, color: th.colors.muted,
    padding: spacing.md, textAlign: 'center',
  },
  overlayRow: {
    position: 'absolute', left: 0, right: 0,
    elevation: 12, zIndex: 100,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8,
    backgroundColor: th.colors.surface2,
  },

  // Actions
  addExBtn: {
    paddingVertical: spacing.md,
    borderRadius: th.radius.md,
    borderWidth: 1, borderStyle: 'dashed',
    borderColor: withOpacity(th.colors.accent, 0.4),
    alignItems: 'center',
    backgroundColor: withOpacity(th.colors.accent, 0.04),
  },
  addExBtnText: { fontSize: typography.base, color: th.colors.accent },
  addBlockBtn: {
    paddingVertical: spacing.md,
    borderRadius: th.radius.md,
    borderWidth: 1, borderStyle: 'dashed',
    borderColor: th.colors.border,
    alignItems: 'center',
  },
  addBlockBtnText: { fontSize: typography.base, color: th.colors.mutedLight },
  presetRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: borders.thin, borderBottomColor: th.colors.border,
    gap: spacing.sm,
  },
  presetName: { fontSize: typography.base, fontWeight: typography.medium, color: th.colors.text },
  presetMeta: { fontSize: typography.xs, color: th.colors.muted, marginTop: 2 },
  footerBtn: {
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  footerBtnText: { fontSize: typography.sm, color: th.colors.muted },
  dupBtn: {
    paddingVertical: spacing.sm + 2,
    borderRadius: th.radius.md,
    borderWidth: borders.thin,
    borderColor: th.colors.border,
    alignItems: 'center',
  },
  dupBtnText: { fontSize: typography.sm, color: th.colors.mutedLight, fontWeight: typography.medium },
  deleteBtn: {
    paddingVertical: spacing.sm + 2,
    borderRadius: th.radius.md,
    borderWidth: borders.thin,
    borderColor: withOpacity(th.colors.red, 0.3),
    alignItems: 'center',
  },
  deleteBtnText: { fontSize: typography.sm, color: th.colors.red, fontWeight: typography.medium },

  // Exercise editor modal
  modalSafe: {
    flex:            1,
    backgroundColor: th.colors.bg,
  },
  modalTopbar: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: spacing.lg,
    paddingVertical:   spacing.md,
    borderBottomWidth: borders.thin,
    borderBottomColor: th.colors.border,
  },
  modalExTag: {
    fontSize:      typography.xs,
    fontWeight:    typography.bold,
    color:         th.colors.muted,
    letterSpacing: 1,
  },
  modalExName: {
    fontSize:   typography.lg,
    fontWeight: typography.bold,
    color:      th.colors.text,
    marginTop:  2,
  },
  modalAcceptBtn: {
    backgroundColor:   th.colors.accent,
    paddingHorizontal: spacing.md,
    paddingVertical:   8,
    borderRadius:      th.radius.sm,
    marginLeft:        spacing.md,
    alignItems:        'center',
    justifyContent:    'center',
  },
  modalAcceptTxt: {
    fontSize:   typography.sm,
    fontWeight: typography.heavy,
    color:      th.colors.onAccent,
    letterSpacing: 0.5,
  },
});
