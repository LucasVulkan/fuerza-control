/**
 * SetRow — fila de una serie individual.
 *
 * inputType: 'weight_reps' | 'reps' | 'time' | 'weight_time'
 *
 * Layouts:
 *   weight_reps  →  [S1] [peso] [reps] [✓]
 *   reps         →  [S1] [reps]        [✓]
 *   time         →  [S1] [seg]  [▶]    [✓]
 *   weight_time  →  [S1] [peso] [seg]  [▶] [✓]
 *
 * El botón ▶/⏸ arranca un cronómetro local que rellena el campo
 * de tiempo en vivo. Pausa/reanuda sin perder el tiempo acumulado.
 */

import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, PanResponder, Keyboard, Pressable, Animated,
} from 'react-native';
import { useState, useRef, useEffect, useCallback } from 'react';
import { colors, spacing, typography, radius, borders, withOpacity } from '../../theme';

const STEP_PX  = 8;
const H_THRESH = 12;

// ── TimerButton ───────────────────────────────────────────────────────────────

function TimerButton({ onTime }) {
  const [running,  setRunning]  = useState(false);
  const baseRef    = useRef(0);      // accumulated seconds before current segment
  const startRef   = useRef(null);   // Date.now() when current segment started
  const intervalRef = useRef(null);
  const onTimeRef  = useRef(onTime);

  useEffect(() => { onTimeRef.current = onTime; }, [onTime]);
  useEffect(() => () => clearInterval(intervalRef.current), []);

  function toggle() {
    if (running) {
      // Pause — accumulate elapsed and commit
      clearInterval(intervalRef.current);
      intervalRef.current = null;
      const segSec = Math.round((Date.now() - startRef.current) / 1000);
      baseRef.current += segSec;
      setRunning(false);
      onTimeRef.current(String(baseRef.current));
    } else {
      // Start / resume
      startRef.current = Date.now();
      intervalRef.current = setInterval(() => {
        const total = Math.round((Date.now() - startRef.current) / 1000) + baseRef.current;
        onTimeRef.current(String(total));
      }, 500);
      setRunning(true);
    }
  }

  return (
    <TouchableOpacity
      style={[styles.timerBtn, running && styles.timerBtnRunning]}
      onPress={toggle}
      hitSlop={6}
    >
      <Text style={[styles.timerBtnIcon, running && styles.timerBtnIconRunning]}>
        {running ? '▐▐' : '▶'}
      </Text>
    </TouchableOpacity>
  );
}

// ── InputCell ─────────────────────────────────────────────────────────────────

function InputCell({
  value,
  prevValue  = '',
  onChangeText,
  keyboardType,
  scrollStep = 1,
  showHint   = false,
  isDone     = false,
}) {
  const inputRef = useRef(null);
  const [editing,      setEditing]      = useState(false);
  const [scrollActive, setScrollActive] = useState(false);

  const [localValue, setLocalValue] = useState(
    value !== null && value !== undefined && value !== '' ? String(value) : '',
  );

  const editingRef    = useRef(false);
  const isSwiping     = useRef(false);
  const localValueRef = useRef(
    parseFloat(value !== '' && value != null ? value : prevValue) || 0,
  );
  const onChangeRef   = useRef(onChangeText);
  const scrollStepRef = useRef(scrollStep);
  const lastDxRef     = useRef(0);
  // Animated value for the accent overlay — fades in when scroll starts, out when it ends
  const accentAnim    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!isSwiping.current) {
      const str = value !== null && value !== undefined && value !== '' ? String(value) : '';
      setLocalValue(str);
      localValueRef.current = parseFloat(value !== '' && value != null ? value : prevValue) || 0;
    }
  }, [value, prevValue]);

  useEffect(() => { onChangeRef.current   = onChangeText; }, [onChangeText]);
  useEffect(() => { scrollStepRef.current = scrollStep;   }, [scrollStep]);

  const openEditor = useCallback(() => {
    editingRef.current = true;
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 30);
  }, []);

  const closeEditor = useCallback(() => {
    editingRef.current = false;
    setEditing(false);
  }, []);

  const fadeIn  = useCallback(() => {
    Animated.timing(accentAnim, { toValue: 1, duration: 80,  useNativeDriver: true }).start();
  }, []);
  const fadeOut = useCallback(() => {
    Animated.timing(accentAnim, { toValue: 0, duration: 220, useNativeDriver: true }).start();
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder:        () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, gs) =>
        !editingRef.current
        && Math.abs(gs.dx) > H_THRESH
        && Math.abs(gs.dx) > Math.abs(gs.dy) * 2,
      onPanResponderGrant: () => {
        Keyboard.dismiss();
        isSwiping.current = true;
        lastDxRef.current = 0;
        setScrollActive(true);
        fadeIn();
      },
      onPanResponderMove: (_, gs) => {
        const currSteps = Math.trunc(gs.dx / STEP_PX);
        const lastSteps = Math.trunc(lastDxRef.current / STEP_PX);
        const delta     = currSteps - lastSteps;
        if (delta !== 0) {
          const next = Math.max(
            0,
            Math.round((localValueRef.current + delta * scrollStepRef.current) * 100) / 100,
          );
          localValueRef.current = next;
          setLocalValue(String(next));
          lastDxRef.current = gs.dx;
        }
      },
      onPanResponderRelease: () => {
        isSwiping.current = false;
        setScrollActive(false);
        lastDxRef.current = 0;
        const val = localValueRef.current;
        requestAnimationFrame(() => { onChangeRef.current(String(val)); });
        fadeOut();
      },
      onPanResponderTerminate: () => {
        isSwiping.current = false;
        setScrollActive(false);
        lastDxRef.current = 0;
        const val = localValueRef.current;
        requestAnimationFrame(() => { onChangeRef.current(String(val)); });
        fadeOut();
      },
    })
  ).current;

  if (editing) {
    return (
      <View style={styles.inputCell}>
        <TextInput
          ref={inputRef}
          style={[styles.input, styles.inputEditing]}
          autoFocus
          value={localValue}
          onChangeText={(v) => { setLocalValue(v); onChangeText(v); }}
          keyboardType={keyboardType}
          placeholder="—"
          placeholderTextColor={colors.muted2}
          selectTextOnFocus
          returnKeyType="done"
          textAlign="center"
          onBlur={closeEditor}
          onSubmitEditing={() => { Keyboard.dismiss(); closeEditor(); }}
        />
      </View>
    );
  }

  const displayStr = localValue !== '' ? localValue : '';
  const showPrev   = displayStr === '' && prevValue !== '';
  const renderStr  = showPrev ? String(prevValue) : displayStr;

  const dotIdx = renderStr.indexOf('.');
  const intStr = renderStr ? (dotIdx >= 0 ? renderStr.slice(0, dotIdx) : renderStr) : '';
  const decStr = dotIdx >= 0 ? renderStr.slice(dotIdx) : '';

  return (
    <View style={styles.inputCell} {...panResponder.panHandlers}>
      <Pressable
        onPress={openEditor}
        style={[
          styles.input,
          isDone && !scrollActive && styles.inputDone,
          showPrev && styles.inputPrev,
        ]}
      >
        {renderStr ? (
          <View style={styles.numRow}>
            <View style={styles.decPart} />
            <Text style={[styles.valueText, showPrev && styles.valueTextPrev]}>{intStr}</Text>
            <Text style={[styles.valueText, styles.decPart, showPrev && styles.valueTextPrev]} numberOfLines={1}>{decStr}</Text>
          </View>
        ) : (
          <Text style={styles.placeholder}>—</Text>
        )}
      </Pressable>

      {/* Accent outline — fades in on scroll start, out on release */}
      <Animated.View
        pointerEvents="none"
        style={[styles.inputAccentOverlay, { opacity: accentAnim }]}
      />

      {(scrollActive || showHint) && (
        <View style={styles.arrowOverlay} pointerEvents="none">
          <Text style={[styles.arrow, scrollActive && styles.arrowActive]}>‹</Text>
          <Text style={[styles.arrow, scrollActive && styles.arrowActive]}>›</Text>
        </View>
      )}
    </View>
  );
}

// ── SetRow ────────────────────────────────────────────────────────────────────

export default function SetRow({
  index,
  set,
  inputType,           // 'weight_reps' | 'reps' | 'time' | 'weight_time'
  weightDisplay,
  prevWeightDisplay,
  prevReps,
  prevTime,
  onWeightChange,
  onRepsChange,
  onTimeChange,
  onToggleDone,
  showHint,
  weightScrollStep,
  isActive,
  onCopyPrev,
  showRpe = false,     // exercise has 'Registrar RPE' enabled
  onRpeChange,
}) {
  return (
    <View style={styles.row}>
      {onCopyPrev ? (
        <TouchableOpacity onPress={onCopyPrev} hitSlop={8}>
          <Text style={[styles.setNum, isActive && styles.setNumActive]}>S{index + 1}</Text>
        </TouchableOpacity>
      ) : (
        <Text style={[styles.setNum, isActive && styles.setNumActive]}>S{index + 1}</Text>
      )}

      {/* ── weight_reps ── */}
      {inputType === 'weight_reps' && (
        <>
          <InputCell
            value={weightDisplay}
            prevValue={prevWeightDisplay ?? ''}
            onChangeText={onWeightChange}
            keyboardType="decimal-pad"
            scrollStep={weightScrollStep ?? 0.5}
            showHint={showHint}
            isDone={set.done}
          />
          <InputCell
            value={set.reps ?? ''}
            prevValue={prevReps ?? ''}
            onChangeText={onRepsChange}
            keyboardType="numeric"
            scrollStep={1}
            showHint={showHint}
            isDone={set.done}
          />
        </>
      )}

      {/* ── reps only ── */}
      {inputType === 'reps' && (
        <InputCell
          value={set.reps ?? ''}
          prevValue={prevReps ?? ''}
          onChangeText={onRepsChange}
          keyboardType="numeric"
          scrollStep={1}
          showHint={showHint}
          isDone={set.done}
        />
      )}

      {/* ── time only ── */}
      {inputType === 'time' && (
        <>
          <InputCell
            value={set.time ?? ''}
            prevValue={prevTime ?? ''}
            onChangeText={onTimeChange}
            keyboardType="numeric"
            scrollStep={5}
            showHint={showHint}
            isDone={set.done}
          />
          <TimerButton onTime={onTimeChange} />
        </>
      )}

      {/* ── weight + time ── */}
      {inputType === 'weight_time' && (
        <>
          <InputCell
            value={weightDisplay}
            prevValue={prevWeightDisplay ?? ''}
            onChangeText={onWeightChange}
            keyboardType="decimal-pad"
            scrollStep={weightScrollStep ?? 0.5}
            showHint={showHint}
            isDone={set.done}
          />
          <InputCell
            value={set.time ?? ''}
            prevValue={prevTime ?? ''}
            onChangeText={onTimeChange}
            keyboardType="numeric"
            scrollStep={5}
            showHint={showHint}
            isDone={set.done}
          />
          <TimerButton onTime={onTimeChange} />
        </>
      )}

      {/* ── RPE (opt-in per exercise) ── */}
      {showRpe && (
        <InputCell
          value={set.rpe ?? ''}
          onChangeText={onRpeChange}
          keyboardType="decimal-pad"
          scrollStep={0.5}
          isDone={set.done}
        />
      )}

      {/* ── Done ── */}
      <TouchableOpacity
        style={[styles.doneBtn, set.done && styles.doneBtnActive]}
        onPress={() => { Keyboard.dismiss(); onToggleDone(); }}
        hitSlop={8}
      >
        <Text style={[styles.doneMark, set.done && styles.doneMarkActive]}>✓</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  row: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             spacing.sm,
    paddingVertical: spacing.xs,
  },
  setNum: {
    width:         20,
    fontSize:      typography.xs,
    color:         colors.muted,
    letterSpacing: 0.5,
    textAlign:     'right',
  },
  setNumActive: {
    color:      colors.accent,
    fontWeight: typography.semibold,
  },

  inputCell: { flex: 1 },

  input: {
    width:             '100%',
    backgroundColor:   colors.surface2,
    borderWidth:       borders.thin,
    borderColor:       colors.borderCard,
    borderRadius:      radius.sm,
    paddingVertical:   spacing.xs + 2,
    paddingHorizontal: spacing.xs,
    alignItems:        'center',
    justifyContent:    'center',
  },
  inputEditing: {
    backgroundColor:   colors.surface2,
    borderWidth:       borders.thin,
    borderColor:       colors.accent,
    borderRadius:      radius.sm,
    color:             colors.text,
    fontSize:          typography.md,
    fontWeight:        typography.semibold,
    textAlign:         'center',
    paddingVertical:   spacing.xs + 2,
    paddingHorizontal: spacing.xs,
  },
  inputScrollActive: {
    borderColor:     colors.accent,
    backgroundColor: withOpacity(colors.accent, 0.06),
  },
  inputAccentOverlay: {
    position:        'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    borderWidth:     borders.thin,
    borderColor:     colors.accent,
    borderRadius:    radius.sm,
    backgroundColor: withOpacity(colors.accent, 0.06),
  },
  inputDone: {
    borderColor: withOpacity(colors.green, 0.3),
  },
  inputPrev: {
    borderColor: colors.borderCard,
  },

  valueText: {
    fontSize:   typography.md,
    fontWeight: typography.semibold,
    color:      colors.text,
    textAlign:  'center',
  },
  valueTextPrev: {
    color:      colors.muted2,
    fontWeight: typography.regular,
  },
  placeholder: {
    fontSize:   typography.md,
    fontWeight: typography.regular,
    color:      colors.muted2,
    textAlign:  'center',
  },

  numRow: {
    flexDirection: 'row',
    alignItems:    'baseline',
    flexWrap:      'nowrap',
  },
  decPart: {
    width:     36,
    textAlign: 'left',
  },

  arrowOverlay: {
    position:          'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: 5,
  },
  arrow:       { fontSize: 11, color: colors.muted,  opacity: 0.55, lineHeight: 13 },
  arrowActive: { color: colors.accent, opacity: 1 },

  // Done button
  doneBtn: {
    width:           36,
    height:          36,
    borderRadius:    radius.sm,
    borderWidth:     borders.thin,
    borderColor:     colors.border,
    backgroundColor: colors.surface2,
    alignItems:      'center',
    justifyContent:  'center',
  },
  doneBtnActive: {
    borderColor:     colors.green,
    backgroundColor: 'rgba(74,222,128,0.1)',
  },
  doneMark:       { fontSize: 16, color: colors.muted },
  doneMarkActive: { color: colors.green },

  // Timer button
  timerBtn: {
    width:           36,
    height:          36,
    borderRadius:    radius.sm,
    borderWidth:     borders.thin,
    borderColor:     colors.border,
    backgroundColor: colors.surface2,
    alignItems:      'center',
    justifyContent:  'center',
  },
  timerBtnRunning: {
    borderColor:     withOpacity(colors.accent, 0.5),
    backgroundColor: withOpacity(colors.accent, 0.1),
  },
  timerBtnIcon: {
    fontSize:           13,
    color:              colors.muted,
    lineHeight:         13,
    includeFontPadding: false,
    textAlign:          'center',
  },
  timerBtnIconRunning: {
    color: colors.accent,
  },
});
