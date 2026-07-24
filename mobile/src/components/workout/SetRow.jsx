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
import Svg, { Path } from 'react-native-svg';
import { useState, useRef, useEffect, useCallback } from 'react';
import { spacing, typography, textStyles, borders, withOpacity } from '../../theme';
import { useTheme, useThemedStyles } from '../../useTheme';

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
  // Ghost styling: grey for last-session reference, blue for a trainer target.
  const ghostStyle = showPrev
    ? (prevSource === 'coach' ? styles.valueTextCoach : styles.valueTextPrev)
    : null;
  // Input Field states (105:2415): fila activa = "Current" (borde + texto claro),
  // valor sin ser la activa = "Done" (texto mutedLight), sin valor = "Empty".
  const isCurrent = showHint;

  return (
    <View style={styles.inputCell} {...panResponder.panHandlers}>
      <Pressable
        onPress={openEditor}
        style={[
          styles.input,
          isCurrent && styles.inputCurrent,
          showPrev && styles.inputPrev,
          showPrev && prevSource === 'coach' && styles.inputCoach,
        ]}
      >
        {renderStr ? (
          <View style={styles.numRow}>
            <View style={styles.decPart} />
            <Text style={[styles.valueText, isDone && styles.valueTextDone, isCurrent && styles.valueTextCurrent, ghostStyle]}>{intStr}</Text>
            <Text style={[styles.valueText, styles.decPart, isDone && styles.valueTextDone, isCurrent && styles.valueTextCurrent, ghostStyle]} numberOfLines={1}>{decStr}</Text>
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
    flexDirection:   'row',
    alignItems:      'center',
    gap:             spacing.sm,
    paddingVertical: spacing.xs,
  },
  // "S1"/"S2"… — Black 12, sin tracking, sin relación con text/card-type.
  setNum: {
    width:      20,
    fontFamily: 'Inter_900Black',
    fontSize:   12,
    fontWeight: '900',
    color:      th.colors.mutedLight,
    textAlign:  'right',
  },
  setNumDone: {
    color: th.tint.accent50,
  },
  setNumActive: {
    color: th.colors.accent,
  },

  inputCell: { flex: 1 },

  // Input Field (105:2415) — Empty/Done: bg workout-card, sin borde. Current
  // (105:2416): + borde tint/accent-50. El valor de "workout-card" (#141414)
  // coincide con th.colors.bg en formaFit, no hace falta un token nuevo.
  // Alto igualado al de los botones (done/timer, 36×36) — pedido de QA.
  input: {
    width:            '100%',
    height:           36,
    backgroundColor:  th.colors.bg,
    borderRadius:     th.radius.sm,
    paddingHorizontal: spacing.sm,
    alignItems:        'center',
    justifyContent:    'center',
  },
  inputEditing: {
    backgroundColor:   th.colors.bg,
    borderWidth:       borders.thin,
    borderColor:       th.colors.accent,
    borderRadius:      th.radius.sm,
    color:             th.colors.text,
    fontSize:          typography.md,
    fontWeight:        typography.semibold,
    textAlign:         'center',
    paddingVertical:   spacing.xs + 2,
    paddingHorizontal: spacing.xs,
  },
  inputCurrent: {
    borderWidth: 0.5,
    borderColor: th.tint.accent50,
  },
  inputAccentOverlay: {
    position:        'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    borderWidth:     borders.thin,
    borderColor:     th.colors.accent,
    borderRadius:    th.radius.sm,
    backgroundColor: withOpacity(th.colors.accent, 0.06),
  },
  inputPrev: {
    borderWidth: 0.5,
    borderColor: th.colors.borderCard,
  },
  inputCoach: {
    borderWidth: 0.5,
    borderColor: th.tint.blue30,
  },

  // Done (mutedLight) / serie completada (accent tint-50) / Current (text, fila
  // activa, gana sobre completada) — todos comparten la fuente de Input Field
  // (ExtraBold 12/1.2, "text/card-type").
  valueText: {
    ...textStyles.cardType,
    color:     th.colors.mutedLight,
    textAlign: 'center',
  },
  valueTextDone: {
    color: th.tint.accent50,
  },
  valueTextCurrent: {
    color: th.colors.text,
  },
  valueTextPrev: {
    color:      th.colors.muted2,
    fontWeight: typography.regular,
  },
  valueTextCoach: {
    color:      th.colors.blue,
    fontWeight: typography.regular,
  },
  placeholder: {
    ...textStyles.cardType,
    color:     th.colors.muted,
    textAlign: 'center',
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

  // Done button — Icons Serie uncheck (105:2459) / Current Uncheck (105:2479) / done (106:2701)
  // Ligeramente más pequeño que las celdas (32, no 36) — pedido de QA, sin tocar
  // el ancho de los Input Field (flex:1, no dependen de este valor).
  // marginLeft extra (además del gap de `row`) — más aire respecto a la celda de la izquierda.
  doneBtn: {
    width:           32,
    height:          32,
    marginLeft:      spacing.xs,
    borderRadius:    th.radius.sm,
    backgroundColor: th.colors.surface2,
    alignItems:      'center',
    justifyContent:  'center',
  },
  // Hecha: fondo/borde tint accent (antes era el look de "activa"; se intercambiaron).
  doneBtnActive: {
    borderWidth:     0.5,
    borderColor:     th.tint.accent50,
    backgroundColor: th.tint.accent10,
  },
  doneMark: { fontSize: 16, color: th.colors.muted },
  // Activa (aún sin marcar): solo cambia el color del icono frente a las pendientes,
  // sin fondo/borde propio — el fondo/borde "tint" ahora es el de la serie hecha.
  doneMarkCurrent: { color: th.tint.accent50 },
  doneMarkActive:  { color: th.colors.accent },

  // Timer button — sin glifo propio en Figma, restyle por analogía alineado al done (32×32)
  timerBtn: {
    width:           32,
    height:          32,
    borderRadius:    th.radius.sm,
    backgroundColor: th.colors.surface2,
    alignItems:      'center',
    justifyContent:  'center',
  },
  timerBtnRunning: {
    borderWidth:     0.5,
    borderColor:     th.tint.accent50,
    backgroundColor: th.tint.accent10,
  },
  timerBtnIcon: {
    fontSize:           13,
    color:              th.colors.muted,
    lineHeight:         13,
    includeFontPadding: false,
    textAlign:          'center',
  },
  timerBtnIconRunning: {
    color: th.colors.accent,
  },
});
