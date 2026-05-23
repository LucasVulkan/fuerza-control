/**
 * SetRow — fila de una serie individual.
 * Referencia: src/components/workout/SetRow.jsx (web original)
 *
 * Gestos en InputCell:
 *   onStartShouldSetPanResponder: false  → nunca captura en start
 *                                          → ScrollView puede scrollear siempre
 *   onMoveShouldSetPanResponder: true    → solo si claramente horizontal (>12px, dx>2·dy)
 *                                          → el Pressable cede el responder (yieldsTermination)
 *                                          → ScrollView retiene el gesto si es vertical
 *
 * Anti-lag: durante el swipe solo actualiza localValue (state local, sin Zustand).
 *           Al soltar el dedo se hace un único commit al store.
 */

import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, PanResponder, Keyboard, Pressable,
} from 'react-native';
import { useState, useRef, useEffect, useCallback } from 'react';
import { colors, spacing, typography, radius, borders, withOpacity } from '../../theme';

const STEP_PX  = 8;
const H_THRESH = 12; // px mínimo horizontal para activar swipe

// ── InputCell ─────────────────────────────────────────────────────────────────

function InputCell({
  value,
  prevValue  = '',   // valor de la última sesión (ya en unidades de display)
  onChangeText,
  keyboardType,
  scrollStep = 1,
  showHint   = false,
  isDone     = false,
}) {
  const inputRef = useRef(null);
  const [editing,      setEditing]      = useState(false);
  const [scrollActive, setScrollActive] = useState(false);

  // Valor local durante el swipe (evita re-renders de Zustand en cada paso)
  const [localValue, setLocalValue] = useState(
    value !== null && value !== undefined && value !== '' ? String(value) : '',
  );

  const editingRef      = useRef(false);
  const isSwiping       = useRef(false);
  // Si el valor actual está vacío, partimos del valor previo al swipear
  const localValueRef   = useRef(
    parseFloat(value !== '' && value != null ? value : prevValue) || 0,
  );
  const onChangeRef     = useRef(onChangeText);
  const scrollStepRef   = useRef(scrollStep);
  const lastDxRef       = useRef(0);

  // Sync local display con el valor externo cuando NO estamos arrastrando
  useEffect(() => {
    if (!isSwiping.current) {
      const str = value !== null && value !== undefined && value !== '' ? String(value) : '';
      setLocalValue(str);
      // Swipe parte del prev si el campo está vacío
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

  const panResponder = useRef(
    PanResponder.create({
      // ── Nunca capturar en start: ScrollView siempre puede scrollear ──────
      onStartShouldSetPanResponder:        () => false,
      onStartShouldSetPanResponderCapture: () => false,

      // ── Capturar solo swipes claramente horizontales ─────────────────────
      onMoveShouldSetPanResponder: (_, gs) =>
        !editingRef.current
        && Math.abs(gs.dx) > H_THRESH
        && Math.abs(gs.dx) > Math.abs(gs.dy) * 2,

      onPanResponderGrant: () => {
        Keyboard.dismiss();          // cierra el editor abierto en cualquier otra celda
        isSwiping.current = true;
        lastDxRef.current = 0;
        setScrollActive(true);
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
          // Solo estado local → sin Zustand → sin re-render del árbol
          setLocalValue(String(next));
          lastDxRef.current = gs.dx;
        }
      },

      onPanResponderRelease: () => {
        // Quitar el outline verde inmediatamente (antes de que Zustand re-renderice)
        isSwiping.current = false;
        setScrollActive(false);
        lastDxRef.current = 0;
        // Commit al store en el siguiente frame → la UI ya actualizó el estilo
        const val = localValueRef.current;
        requestAnimationFrame(() => { onChangeRef.current(String(val)); });
      },

      onPanResponderTerminate: () => {
        isSwiping.current = false;
        setScrollActive(false);
        lastDxRef.current = 0;
        const val = localValueRef.current;
        requestAnimationFrame(() => { onChangeRef.current(String(val)); });
      },
    })
  ).current;

  // ── Modo edición: TextInput real con autoFocus ───────────────────────────
  if (editing) {
    return (
      <View style={styles.inputCell}>
        <TextInput
          ref={inputRef}
          style={[styles.input, styles.inputEditing]}
          autoFocus
          value={localValue}
          onChangeText={(v) => {
            setLocalValue(v);
            onChangeText(v);
          }}
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

  // ── Modo display: Pressable + Text (sin TextInput activo → sin conflicto) ─
  const displayStr = localValue !== '' ? localValue : '';
  // Si no hay valor propio, mostrar el de la última sesión en gris
  const showPrev   = displayStr === '' && prevValue !== '';
  const renderStr  = showPrev ? String(prevValue) : displayStr;

  // Separar parte entera y decimal para que el punto decimal esté fijo
  // y el número no salte al añadir/quitar decimales durante el swipe
  const dotIdx = renderStr.indexOf('.');
  const intStr = renderStr
    ? (dotIdx >= 0 ? renderStr.slice(0, dotIdx) : renderStr)
    : '';
  const decStr = dotIdx >= 0 ? renderStr.slice(dotIdx) : '';

  return (
    <View style={styles.inputCell} {...panResponder.panHandlers}>
      <Pressable
        onPress={openEditor}
        style={[
          styles.input,
          scrollActive && styles.inputScrollActive,
          isDone && !scrollActive && styles.inputDone,
          showPrev && styles.inputPrev,
        ]}
      >
        {renderStr ? (
          <View style={styles.numRow}>
            {/* spacer espejo: mismo ancho que decPart → entero siempre centrado */}
            <View style={styles.decPart} />
            <Text style={[styles.valueText, showPrev && styles.valueTextPrev]}>{intStr}</Text>
            <Text style={[styles.valueText, styles.decPart, showPrev && styles.valueTextPrev]}>{decStr}</Text>
          </View>
        ) : (
          <Text style={styles.placeholder}>—</Text>
        )}
      </Pressable>

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
  isTime,
  weightDisplay,
  prevWeightDisplay,   // valor de peso de la última sesión (en unidades de display)
  prevReps,            // reps de la última sesión
  prevTime,            // segundos de la última sesión
  onWeightChange,
  onRepsChange,
  onTimeChange,
  onToggleDone,
  showHint,
  weightScrollStep,
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.setNum}>S{index + 1}</Text>

      {isTime ? (
        <InputCell
          value={set.time ?? ''}
          prevValue={prevTime ?? ''}
          onChangeText={onTimeChange}
          keyboardType="numeric"
          scrollStep={5}
          showHint={showHint}
          isDone={set.done}
        />
      ) : (
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
    width:         28,
    fontSize:      typography.xs,
    color:         colors.muted,
    letterSpacing: 0.5,
    textAlign:     'right',
  },

  inputCell: { flex: 1 },

  input: {
    width:             '100%',
    backgroundColor:   colors.surface2,
    borderWidth:       borders.thin,
    borderColor:       colors.borderCard,
    borderRadius:      radius.sm,
    paddingVertical:   spacing.sm,
    paddingHorizontal: spacing.xs,
    alignItems:        'center',
    justifyContent:    'center',
  },
  inputEditing: {
    // TextInput real — misma apariencia, añadir borde accent
    backgroundColor:   colors.surface2,
    borderWidth:       borders.thin,
    borderColor:       colors.accent,
    borderRadius:      radius.sm,
    color:             colors.text,
    fontSize:          typography.md,
    fontWeight:        typography.semibold,
    textAlign:         'center',
    paddingVertical:   spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  inputScrollActive: {
    borderColor:     colors.accent,
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

  // Parte entera + decimal con punto fijo para que no salte al swipear
  numRow: {
    flexDirection: 'row',
    alignItems:    'center',
  },
  decPart: {
    width:     22,   // reservado para ".5" — el View espejo izq. tiene el mismo ancho
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

  doneBtn: {
    width: 36, height: 36,
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
});
