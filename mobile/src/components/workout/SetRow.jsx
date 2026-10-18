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

import { View, TouchableOpacity, StyleSheet, PanResponder, Keyboard, Pressable, Animated } from 'react-native';
import { Text, TextInput } from '../ui/Text';
import Chevron from './Chevron';
import Svg, { Path, Rect } from 'react-native-svg';
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useSharedValue, withTiming, runOnJS, Easing } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { spacing, borders, textStyles } from '../../theme';
import { useTheme, useThemedStyles } from '../../useTheme';
import { useStore } from '../../../store/useStore';
import { useWeightUnit } from '../../hooks/useWeightUnit';
import {
  scrubRuler, scrubValueAt, scrubXOf, scrubEdge, scrubPan, scrubPanDir, scrubPanMs,
  SCRUB_CANCEL_DY,
} from '../../utils/scrubScale';
import { GRID } from './grid';
import ScrubRuler, { SCRUB_MS, SCRUB_SNAP_MS } from './ScrubRuler';

const STEP_PX  = 8;
// Marca de la regla: se desliza al valor nuevo como en ScrubRuler.
const SNAP = { duration: SCRUB_SNAP_MS, easing: Easing.out(Easing.quad) };
const H_THRESH = 12;

// El chevron (siempre en tint/accent-50 en la casilla activa) vive en ./Chevron.

// ── TimerButton ───────────────────────────────────────────────────────────────

function TimerButton({ onTime }) {
  const styles = useThemedStyles(makeStyles);
  const th = useTheme();
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

  const iconColor = running ? th.colors.accent : th.colors.mutedLight;
  return (
    <TouchableOpacity
      style={[styles.timerBtn, running && styles.timerBtnRunning]}
      onPress={toggle}
      hitSlop={6}
    >
      {/* SVG y no glifos: el ▐▐ no se centraba. Picos redondeados 1 px. */}
      <Svg width={16} height={16} viewBox="0 0 16 16">
        {running ? (
          <>
            <Rect x={3.5} y={2} width={3.5} height={12} rx={1} fill={iconColor} />
            <Rect x={9} y={2} width={3.5} height={12} rx={1} fill={iconColor} />
          </>
        ) : (
          // El trazo de 2 con unión redonda redondea los picos con radio 1.
          <Path d="M4.5 3 L13 8 L4.5 13 Z" fill={iconColor} stroke={iconColor} strokeWidth={2} strokeLinejoin="round" />
        )}
      </Svg>
    </TouchableOpacity>
  );
}

// ── InputCell ─────────────────────────────────────────────────────────────────
//
// Dos modos de gesto, según `scrubField`:
//  · sin él (o en tiempo): el de siempre — la cifra cambia en la casilla mientras
//    arrastras, con chevrones y borde lima.
//  · con él ('weight' | 'reps' | 'rpe' | 'time', preferencia «Regla al deslizar», U10-01):
//    la casilla NO cambia durante el gesto. Avisa a SetRow (que pinta la regla y
//    la burbuja) y al soltar guarda el valor, sin animación.
//
// La regla va con `Gesture.Pan` y su worklet corre en el hilo de la interfaz: x
// del dedo, valor bajo él, cancelar, bordes y la marca (`markX`) se calculan ahí,
// a la par del dedo aunque JS vaya cargado. A JS solo llega lo que cambia (el
// valor para la burbuja, cancelar, el borde), además de medir la fila al empezar,
// el avance por los bordes y guardar al soltar. El gesto de siempre sigue con
// PanResponder.

function InputCell({
  value,
  prevValue  = '',
  prevSource = 'last',   // 'last' / 'plan' (grey ghost) | 'coach' (blue, trainer target)
  onChangeText,
  keyboardType,
  scrollStep = 1,
  showHint   = false,   // fila activa → estado "Current" del Input Field (105:2416)
  isDone     = false,   // serie marcada como hecha → texto en accent tint-50
  scrubField,           // 'weight' | 'reps' | 'rpe' | 'time' → modo regla; sin valor → gesto de siempre
  scrubUnit  = 'kg',
  rowWidth   = 0,
  measureRow,           // (cb) mide la View de la fila al activarse: hace falta la x del dedo en ella
  onScrubStart,         // ({ field, ruler, value, cell, initial, hasValue, prevValue, prevSource }) al activarse, con la medida ya hecha
  onScrubMove,          // ({ value?, ruler?, edge?, cancel? }) solo lo que cambia
  onScrubEnd,           // () al soltar o al cancelarse
  markX,                // shared value de SetRow: x de la marca de la regla
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
  const liveRef       = useRef({});      // props que lee el gesto (creado una sola vez)
  const cellRect      = useRef({ x: 0, width: 0 });
  // Mientras dura la regla, en JS: { pending, ruler, value, initial, edge, dir,
  // cancel, panTimer, pans }. `pending` = gesto ya activo pero aún sin la medida
  // de la fila.
  const scrubRef      = useRef(null);
  // Lo que lee el worklet. `sRuler` null = sin regla (aún sin medida, o terminada):
  // el worklet no hace nada.
  const sRuler   = useSharedValue(null);
  const sPageX   = useSharedValue(0);
  const sRowW    = useSharedValue(0);
  const sFinger  = useSharedValue(0);
  const sInitial = useSharedValue(0);
  const sValue   = useSharedValue(0);
  const sCancel  = useSharedValue(false);
  const sEdge    = useSharedValue(0);
  const sDir     = useSharedValue(0);
  const sPans    = useSharedValue(true);
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
  useEffect(() => {
    liveRef.current = {
      scrubField, scrubUnit, rowWidth, measureRow, onScrubStart, onScrubMove, onScrubEnd, markX,
      prevValue, prevSource, hasValue: value !== null && value !== undefined && value !== '',
    };
  });
  // El avance automático por los bordes no sobrevive a la casilla.
  useEffect(() => () => clearTimeout(scrubRef.current?.panTimer), []);

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

  const stopPan = useCallback((sc) => {
    if (sc) { clearTimeout(sc.panTimer); sc.panTimer = null; }
  }, []);

  // Un paso de regla cada cierto tiempo mientras el dedo siga a menos de 24 dp del
  // borde (peso y reps); más deprisa cuanto más cerca. El RPE no llega aquí. La
  // regla nueva se le pasa al worklet, y el valor bajo el dedo con ella.
  const panTickRef = useRef(null);
  useEffect(() => {
    panTickRef.current = (sc) => {
      sc.panTimer = null;
      if (scrubRef.current !== sc || sc.cancel || !sc.dir) return;
      const fx = sFinger.get();
      const next = scrubPan(sc.ruler, sc.dir);
      if (next !== sc.ruler) {
        sc.ruler = next;
        sRuler.set(next);
        const v = scrubValueAt(next, fx);
        const patch = { ruler: next };
        if (v !== sc.value) { sc.value = v; patch.value = v; }
        sValue.set(v);
        if (markX) markX.set(withTiming(scrubXOf(next, v), SNAP));
        liveRef.current.onScrubMove?.(patch);
      }
      sc.panTimer = setTimeout(() => panTickRef.current?.(sc), scrubPanMs(fx, sRowW.get()));
    };
  });
  const panTick = useCallback((sc) => panTickRef.current?.(sc), []);

  // Soltar o cancelar en modo regla: cierra la capa y, si el valor cambió respecto
  // al de la casilla, lo guarda en el siguiente frame (como el gesto de siempre).
  // Soltar en modo cancelar no guarda nada.
  const finishScrub = useCallback(() => {
    const sc = scrubRef.current;
    scrubRef.current  = null;
    sRuler.set(null);
    isSwiping.current = false;
    stopPan(sc);
    if (!sc || sc.pending) return;      // la medida no llegó: la capa nunca se abrió
    liveRef.current.onScrubEnd?.();
    if (sc.cancel || sc.value === sc.initial) return;
    const val = sc.value;
    localValueRef.current = val;
    // La casilla ya enseña el número nuevo bajo la capa, que se desvanece al encoger
    // (el efecto de `value` lo confirmará cuando el padre devuelva el valor guardado).
    setLocalValue(String(val));
    requestAnimationFrame(() => { onChangeRef.current(String(val)); });
  }, [stopPan, sRuler]);

  // ── Regla: el lado JS del gesto ──
  // Al activarse: mide la fila (la marca sale bajo el dedo: hace falta su x en
  // ella), arma la regla y se la pasa al worklet.
  const scrubStart = useCallback((absX) => {
    const live = liveRef.current;
    if (!live.scrubField || !live.measureRow) return;
    Keyboard.dismiss();
    isSwiping.current = true;
    const field = live.scrubField;
    const sc = {
      pending: true, ruler: null, value: 0, initial: localValueRef.current,
      edge: 0, dir: 0, cancel: false, panTimer: null, pans: field !== 'rpe',
    };
    scrubRef.current = sc;
    live.measureRow((_x, _y, w, _h, pageX) => {
      if (scrubRef.current !== sc) return;   // se soltó antes de que llegara la medida
      const lv = liveRef.current;
      const rowW = w || lv.rowWidth;
      const ruler = scrubRuler(field, sc.initial, absX - pageX, rowW, { unit: lv.scrubUnit });
      sc.pending = false;
      sc.ruler = ruler;
      sc.value = ruler.start;
      sPageX.set(pageX);
      sRowW.set(rowW);
      sFinger.set(absX - pageX);
      sInitial.set(sc.initial);
      sValue.set(ruler.start);
      sCancel.set(false);
      sEdge.set(0);
      sDir.set(0);
      sPans.set(sc.pans);
      if (lv.markX) lv.markX.set(scrubXOf(ruler, ruler.start));
      // Lo último, la regla: con ella el worklet empieza a trabajar.
      sRuler.set(ruler);
      const prevNum = parseFloat(lv.prevValue);
      lv.onScrubStart?.({
        field, ruler, value: ruler.start, cell: { ...cellRect.current },
        initial: sc.initial, hasValue: lv.hasValue,
        prevValue: Number.isFinite(prevNum) ? prevNum : null, prevSource: lv.prevSource,
      });
    });
  }, [sPageX, sRowW, sFinger, sInitial, sValue, sCancel, sEdge, sDir, sPans, sRuler]);

  // El worklet avisa cuando cambia algo de lo que pinta JS (en modo cancelar el
  // valor ya llega como la partida). En los bordes arranca el avance.
  const scrubUpdate = useCallback((v, cancel, edge, dir) => {
    const sc = scrubRef.current;
    if (!sc || sc.pending) return;
    const patch = {};
    if (v !== sc.value)       { sc.value = v;       patch.value = v; }
    if (cancel !== sc.cancel) { sc.cancel = cancel; patch.cancel = cancel; }
    if (edge !== sc.edge)     { sc.edge = edge;     patch.edge = edge; }
    sc.dir = dir;
    if (Object.keys(patch).length) liveRef.current.onScrubMove?.(patch);
    if (dir) {
      if (!sc.panTimer) sc.panTimer = setTimeout(() => panTick(sc), scrubPanMs(sFinger.get(), sRowW.get()));
    } else {
      stopPan(sc);
    }
  }, [panTick, stopPan, sFinger, sRowW]);

  // Se activa como el de siempre: 12 dp en horizontal antes que 12 en vertical
  // (si no, es scroll). Los callbacks leen refs al moverse, no al pintar: el lint
  // no lo distingue (mismo caso que SessionTabsCard).
  /* eslint-disable react-hooks/refs */
  const scrubGesture = useMemo(() => Gesture.Pan()
    .enabled(!!scrubField && !!markX)
    .activeOffsetX([-H_THRESH, H_THRESH])
    .failOffsetY([-H_THRESH, H_THRESH])
    .onStart((e) => {
      runOnJS(scrubStart)(e.absoluteX);
    })
    .onUpdate((e) => {
      const r = sRuler.get();
      if (!r) return;
      const fx = e.absoluteX - sPageX.get();
      sFinger.set(fx);
      const cancel = e.translationY < -SCRUB_CANCEL_DY;
      const v = cancel ? sInitial.get() : scrubValueAt(r, fx);
      const pans = !cancel && sPans.get();
      const edge = pans ? scrubEdge(fx, sRowW.get()) : 0;
      const dir  = pans ? scrubPanDir(fx, sRowW.get()) : 0;
      if (v !== sValue.get() || cancel !== sCancel.get()) {
        markX.set(withTiming(scrubXOf(r, v), SNAP));
      }
      if (v !== sValue.get() || cancel !== sCancel.get() || edge !== sEdge.get() || dir !== sDir.get()) {
        sValue.set(v); sCancel.set(cancel); sEdge.set(edge); sDir.set(dir);
        runOnJS(scrubUpdate)(v, cancel, edge, dir);
      }
    })
    .onFinalize(() => {
      runOnJS(finishScrub)();
    }),
  [scrubField, markX, scrubStart, scrubUpdate, finishScrub,
    sRuler, sPageX, sFinger, sInitial, sValue, sCancel, sEdge, sDir, sPans, sRowW]);
  /* eslint-enable react-hooks/refs */

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

  // Modo regla: Gesture.Pan; si no, el PanResponder de siempre.
  return (
    <GestureDetector gesture={scrubGesture}>
    <View
      style={styles.inputCell}
      onLayout={(e) => {
        const { x, width } = e.nativeEvent.layout;
        cellRect.current = { x, width };
      }}
      {...(scrubField ? null : panResponder.panHandlers)}
    >
      <Pressable
        onPress={openEditor}
        style={[
          styles.input,
          isDone && styles.inputDone,
          isCurrent && styles.inputCurrent,
        ]}
      >
        {renderStr ? (
          scrubField ? (
            // Modo regla: la cifra entera, decimal incluido, centrada (la casilla no
            // cambia mientras arrastras, así que no hace falta el pivote del entero).
            <Text style={[styles.valueText, isDone && styles.valueTextDone, ghostStyle]} numberOfLines={1}>
              {renderStr}
            </Text>
          ) : (
            <View style={styles.numRow}>
              <View style={styles.decPart} />
              <Text style={[styles.valueText, isDone && styles.valueTextDone, ghostStyle]}>{intStr}</Text>
              <Text style={[styles.valueText, styles.decPart, isDone && styles.valueTextDone, ghostStyle]} numberOfLines={1}>{decStr}</Text>
            </View>
          )
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
    </GestureDetector>
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

  // ── Regla al deslizar (U10-01) ──
  // El estado del gesto vive aquí: la capa cubre TODA la fila, no solo la casilla
  // que se arrastra. `InputCell` avisa; SetRow pinta `ScrubRuler`.
  const ruler = useStore((s) => s.profile?.scrubRuler ?? true);
  const { unit } = useWeightUnit();
  const [rowWidth, setRowWidth] = useState(0);
  const rowRef = useRef(null);
  const measureRow = useCallback((cb) => rowRef.current?.measure(cb), []);
  // { id, field, ruler, value, cell, closing, initial, hasValue, prevValue, prevSource, edge, cancel }
  const [scrub, setScrub] = useState(null);
  const markX      = useSharedValue(0);
  const scrubId    = useRef(0);
  const closeTimer = useRef(null);
  useEffect(() => () => clearTimeout(closeTimer.current), []);

  const onScrubStart = useCallback((info) => {
    clearTimeout(closeTimer.current);
    scrubId.current += 1;
    setScrub({ id: scrubId.current, ...info, edge: 0, cancel: false, closing: false });
  }, []);
  // `patch` trae solo lo que cambia: { value, ruler, edge, cancel }.
  const onScrubMove = useCallback((patch) => {
    setScrub((sc) => (sc && !sc.closing ? { ...sc, ...patch } : sc));
  }, []);
  const onScrubEnd = useCallback(() => {
    setScrub((sc) => (sc ? { ...sc, closing: true } : sc));
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setScrub(null), SCRUB_MS + 30);
  }, []);
  // Peso, reps, RPE y segundos (U10-12); apagada la preferencia, el gesto de siempre.
  const scrubProps = (field) => (ruler ? {
    scrubField: field, scrubUnit: unit, rowWidth, measureRow, onScrubStart, onScrubMove, onScrubEnd, markX,
  } : null);

  return (
    <View
      ref={rowRef}
      collapsable={false}
      style={[styles.row, scrub && styles.rowScrubbing]}
      onLayout={(e) => setRowWidth(e.nativeEvent.layout.width)}
    >
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
            {...scrubProps('weight')}
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
            {...scrubProps('reps')}
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
          {...scrubProps('reps')}
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
            {...scrubProps('time')}
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
            {...scrubProps('weight')}
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
            {...scrubProps('time')}
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
          isDone={set.done}
          {...scrubProps('rpe')}
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

      {scrub && rowWidth > 0 ? (
        <ScrubRuler
          key={scrub.id}
          field={scrub.field}
          ruler={scrub.ruler}
          value={scrub.value}
          cell={scrub.cell}
          rowWidth={rowWidth}
          closing={scrub.closing}
          initial={scrub.initial}
          hasValue={scrub.hasValue}
          prevValue={scrub.prevValue}
          prevSource={scrub.prevSource}
          edge={scrub.edge}
          cancel={scrub.cancel}
          markX={markX}
        />
      ) : null}
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
  // Mientras se arrastra una regla, la fila sube sobre las filas vecinas (la
  // burbuja asoma por encima de la suya).
  rowScrubbing: { zIndex: 20 },
  // Label "S1" (§4.5) — 12/800, muted, tabular. Fila completada → lime.
  setNum: {
    ...textStyles.labelStrong,
    width:       GRID.LABEL_W,
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
    ...textStyles.itemTitle,
    color:             th.colors.text,
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
    ...textStyles.itemTitle,
    fontFamily:  'Inter_800ExtraBold',
    color:       th.colors.text,
    textAlign:   'center',
    fontVariant: ['tabular-nums'],
  },
  valueTextDone: {
    color: th.colors.accent,
  },
  valueTextGhost: { fontFamily: 'Inter_700Bold', color: th.colors.muted2 },
  valueTextCoach: { fontFamily: 'Inter_700Bold', color: th.colors.blue },
  placeholder: {
    ...textStyles.itemTitleQuiet,
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

  // Botón check (§4.5) — 42 × 44, radius 11, bg btnFill, ✓ 15px muted.
  doneBtn: {
    width:           GRID.BTN_W,
    height:          GRID.CELL_H,
    borderRadius:    GRID.RADIUS,
    backgroundColor: th.colors.btnFill,
    alignItems:      'center',
    justifyContent:  'center',
  },
  doneBtnActive: {
    backgroundColor: th.colors.accent,
  },
  doneMark: { ...textStyles.itemTitle, color: th.colors.mutedLight },
  // Activa (aún sin marcar): solo cambia el color del icono frente a las pendientes.
  doneMarkCurrent: { color: th.tint.accent50 },
  doneMarkActive:  { fontFamily: 'Inter_900Black', color: th.colors.onAccent },

  // Botón play (§4.5) — misma caja que el check.
  timerBtn: {
    width:           GRID.BTN_W,
    height:          GRID.CELL_H,
    borderRadius:    GRID.RADIUS,
    backgroundColor: th.colors.btnFill,
    alignItems:      'center',
    justifyContent:  'center',
  },
  timerBtnRunning: {
    backgroundColor: th.tint.accent10,
  },
});
