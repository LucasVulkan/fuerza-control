/**
 * SetRow — fila de una serie individual (SetsGrid, spec §4.5).
 *
 * inputType: 'weight_reps' | 'reps' | 'time' | 'weight_time'
 *
 * Layouts (columnas del spec: 26 | 1fr… | 42 [| 42], gap 10):
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
import Svg, { Path } from 'react-native-svg';
import { useState, useRef, useEffect, useCallback } from 'react';
import { spacing, borders } from '../../theme';
import { useTheme, useThemedStyles } from '../../useTheme';
import { GRID } from './grid';

const STEP_PX  = 8;
const H_THRESH = 12;

// ── Chevron ───────────────────────────────────────────────────────────────────
// Path exacto del asset "Subtract" de Figma (Input Field Current/Empty, ~4.3×7.1),
// siempre en tint/accent-50 — no cambia de color entre estado idle/scroll-activo.
const CHEVRON_W = 4.28102;
const CHEVRON_H = 7.13504;

function Chevron({ direction = 'right', size = 8, color }) {
  return (
    <Svg
      width={size * (CHEVRON_W / CHEVRON_H)}
      height={size}
      viewBox={`0 0 ${CHEVRON_W} ${CHEVRON_H}`}
      style={direction === 'left' ? { transform: [{ scaleX: -1 }] } : undefined}
    >
      <Path d="M3.5 3.56752L0.5 6.06752V5.2218L2.48499 3.56752L0.5 1.91259V1.06752L3.5 3.56752Z" fill={color} />
    </Svg>
  );
}

// ── TimerButton ───────────────────────────────────────────────────────────────

function TimerButton({ onTime }) {
  const styles = useThemedStyles(makeStyles);
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
  prevSource = 'last',   // 'last' (grey ghost) | 'coach' (blue, trainer target)
  onChangeText,
  keyboardType,
  scrollStep = 1,
  showHint   = false,   // fila activa → estado "Current" del Input Field (105:2416)
  isDone     = false,   // serie marcada como hecha → texto en accent tint-50
}) {
  const th       = useTheme();
  const styles   = useThemedStyles(makeStyles);
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
          placeholderTextColor={th.colors.muted2}
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
  // Ghost: valor sugerido aún no confirmado. El spec lo quiere en limeGhost pero
  // el usuario prefiere el gris original (muted2) — la lima competía demasiado con
  // las series ya completadas. El objetivo del entrenador conserva su azul.
  const ghostStyle = showPrev
    ? (prevSource === 'coach' ? styles.valueTextCoach : styles.valueTextGhost)
    : null;
  // La celda ACTIVA mantiene la lógica y el look previos (borde accent-50 +
  // chevrones) — excepción explícita a la regla "sin bordes" del spec.
  const isCurrent = showHint;

  return (
    <View style={styles.inputCell} {...panResponder.panHandlers}>
      <Pressable
        onPress={openEditor}
        style={[
          styles.input,
          isDone && styles.inputDone,
          isCurrent && styles.inputCurrent,
        ]}
      >
        {renderStr ? (
          <View style={styles.numRow}>
            <View style={styles.decPart} />
            <Text style={[styles.valueText, isDone && styles.valueTextDone, ghostStyle]}>{intStr}</Text>
            <Text style={[styles.valueText, styles.decPart, isDone && styles.valueTextDone, ghostStyle]} numberOfLines={1}>{decStr}</Text>
          </View>
        ) : (
          <Text style={styles.placeholder}>–</Text>
        )}
      </Pressable>

      {/* Accent outline — fades in on scroll start, out on release */}
      <Animated.View
        pointerEvents="none"
        style={[styles.inputAccentOverlay, { opacity: accentAnim }]}
      />

      {(scrollActive || showHint) && (
        <View style={styles.arrowOverlay} pointerEvents="none">
          <Chevron direction="left"  size={9} color={th.tint.accent50} />
          <Chevron direction="right" size={9} color={th.tint.accent50} />
        </View>
      )}
    </View>
  );
}

// ── SetRow ────────────────────────────────────────────────────────────────────

export default function SetRow({
  index,
  set,
  label,               // overrides the default "S{index+1}" (used by drop rows: "D1"…)
  inputType,           // 'weight_reps' | 'reps' | 'time' | 'weight_time'
  weightDisplay,
  prevWeightDisplay,
  prevReps,
  prevTime,
  prevWeightSource = 'last',
  prevRepsSource   = 'last',
  prevTimeSource   = 'last',
  prevRpe,
  prevRpeSource    = 'last',
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
  const styles = useThemedStyles(makeStyles);
  const numLabel = label ?? `S${index + 1}`;
  return (
    <View style={styles.row}>
      {onCopyPrev ? (
        <TouchableOpacity onPress={onCopyPrev} hitSlop={8}>
          <Text style={[styles.setNum, set.done && styles.setNumDone, isActive && styles.setNumActive]}>{numLabel}</Text>
        </TouchableOpacity>
      ) : (
        <Text style={[styles.setNum, set.done && styles.setNumDone, isActive && styles.setNumActive]}>{numLabel}</Text>
      )}

      {/* ── weight_reps ── */}
      {inputType === 'weight_reps' && (
        <>
          <InputCell
            value={weightDisplay}
            prevValue={prevWeightDisplay ?? ''}
            prevSource={prevWeightSource}
            onChangeText={onWeightChange}
            keyboardType="decimal-pad"
            scrollStep={weightScrollStep ?? 0.5}
            showHint={showHint}
            isDone={set.done}
          />
          <InputCell
            value={set.reps ?? ''}
            prevValue={prevReps ?? ''}
            prevSource={prevRepsSource}
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
          prevSource={prevRepsSource}
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
            prevSource={prevTimeSource}
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
            prevSource={prevWeightSource}
            onChangeText={onWeightChange}
            keyboardType="decimal-pad"
            scrollStep={weightScrollStep ?? 0.5}
            showHint={showHint}
            isDone={set.done}
          />
          <InputCell
            value={set.time ?? ''}
            prevValue={prevTime ?? ''}
            prevSource={prevTimeSource}
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
          prevValue={prevRpe ?? ''}
          prevSource={prevRpeSource}
          onChangeText={onRpeChange}
          keyboardType="decimal-pad"
          scrollStep={0.5}
          isDone={set.done}
        />
      )}

      {/* ── Done — Icons Serie uncheck/Current Uncheck/done (105:2459/2479, 106:2701) ── */}
      <TouchableOpacity
        style={[
          styles.doneBtn,
          set.done && styles.doneBtnActive,
        ]}
        onPress={() => { Keyboard.dismiss(); onToggleDone(); }}
        hitSlop={8}
      >
        <Text style={[
          styles.doneMark,
          isActive && !set.done && styles.doneMarkCurrent,
          set.done && styles.doneMarkActive,
        ]}>✓</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const makeStyles = (th) => StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           GRID.GAP,
  },
  // Label "S1" (§4.5) — 12/800, muted, tabular. Fila completada → lime.
  setNum: {
    width:       GRID.LABEL_W,
    fontFamily:  'Inter_800ExtraBold',
    fontSize:    12,
    fontWeight:  '800',
    color:       th.colors.mutedLight,
    fontVariant: ['tabular-nums'],
  },
  setNumDone: {
    color: th.colors.accent,
  },
  setNumActive: {
    color: th.colors.accent,
  },

  inputCell: { flex: 1 },

  // Celda input (§4.5) — alto 44, radius 11, bg cellFill, contenido centrado 15px.
  input: {
    width:             '100%',
    height:            GRID.CELL_H,
    backgroundColor:   th.colors.bg,
    borderRadius:      GRID.RADIUS,
    paddingHorizontal: spacing.sm,
    alignItems:        'center',
    justifyContent:    'center',
  },
  // Completada: bg limeDim, texto lime.
  inputDone: {
    backgroundColor: th.tint.accent10,
  },
  inputEditing: {
    backgroundColor:   th.colors.bg,
    borderWidth:       borders.thin,
    borderColor:       th.colors.accent,
    borderRadius:      GRID.RADIUS,
    color:             th.colors.text,
    fontFamily:        'Inter_800ExtraBold',
    fontSize:          15,
    fontWeight:        '800',
    textAlign:         'center',
    paddingHorizontal: spacing.xs,
  },
  // Celda ACTIVA — se conserva tal cual (excepción a la regla "sin bordes").
  inputCurrent: {
    borderWidth: 0.5,
    borderColor: th.tint.accent50,
  },
  inputAccentOverlay: {
    position:        'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    borderWidth:     borders.thin,
    borderColor:     th.colors.accent,
    borderRadius:    GRID.RADIUS,
    backgroundColor: th.tint.accent10,
  },

  // Estados de celda (§4.5): valor del usuario 800/text · ghost 700/limeGhost
  // (o azul si es objetivo del coach) · completada lime · vacía 600/muted2.
  valueText: {
    fontFamily:  'Inter_800ExtraBold',
    fontSize:    15,
    fontWeight:  '800',
    color:       th.colors.text,
    textAlign:   'center',
    fontVariant: ['tabular-nums'],
  },
  valueTextDone: {
    color: th.colors.accent,
  },
  valueTextGhost: {
    fontFamily: 'Inter_700Bold',
    fontWeight: '700',
    color:      th.colors.muted2,
  },
  valueTextCoach: {
    fontFamily: 'Inter_700Bold',
    fontWeight: '700',
    color:      th.colors.blue,
  },
  placeholder: {
    fontFamily: 'Inter_600SemiBold',
    fontSize:   15,
    fontWeight: '600',
    color:      th.colors.muted,
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

  // Botón check (§4.5) — 42 × 44, radius 11, bg btnFill, ✓ 15px muted.
  doneBtn: {
    width:           GRID.BTN_W,
    height:          GRID.CELL_H,
    borderRadius:    GRID.RADIUS,
    backgroundColor: th.colors.surface2,
    alignItems:      'center',
    justifyContent:  'center',
  },
  doneBtnActive: {
    backgroundColor: th.colors.accent,
  },
  doneMark: { fontSize: 15, color: th.colors.mutedLight },
  // Activa (aún sin marcar): solo cambia el color del icono frente a las pendientes.
  doneMarkCurrent: { color: th.tint.accent50 },
  doneMarkActive:  { fontFamily: 'Inter_900Black', fontWeight: '900', color: th.colors.onAccent },

  // Botón play (§4.5) — misma caja que el check.
  timerBtn: {
    width:           GRID.BTN_W,
    height:          GRID.CELL_H,
    borderRadius:    GRID.RADIUS,
    backgroundColor: th.colors.surface2,
    alignItems:      'center',
    justifyContent:  'center',
  },
  timerBtnRunning: {
    backgroundColor: th.tint.accent10,
  },
  timerBtnIcon: {
    fontSize:           15,
    color:              th.colors.mutedLight,
    lineHeight:         16,
    includeFontPadding: false,
    textAlign:          'center',
  },
  timerBtnIconRunning: {
    color: th.colors.accent,
  },
});
