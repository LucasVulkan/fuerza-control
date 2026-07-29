/**
 * BlockEditorInline — editor de un bloque de acondicionamiento, rediseño
 * FormaFit (Figma `190:1661` "Bloques: AMRAP" y `192:1897` "Bloques: EMOM").
 *
 * Estructura del mock: RESUMEN → `1. FORMATO` (segmentado + descripción y, en
 * EMOM, el segmentado "Tipo de EMOM") → los parámetros del formato →
 * `N. MOVIMIENTOS` (lista agrupada) → `OPCIONES` (nombre + nota) → Guardar
 * preset / Eliminar bloque.
 *
 * Decisiones tomadas con el usuario en esta ronda:
 *   · "Rotar ejercicios" deja de ser un switch y pasa a segmentado, como dibuja
 *     Figma. Sigue mapeando a `emomMode` ('rotate' | 'all').
 *   · El intervalo de EMOM cambia el 120s por `Custom`, que abre una fila ±.
 *   · "For time" no está en Figma: se compone por analogía — rondas en fila ± y
 *     el tope como segmentado (Sin tope / Con tope), no como switch.
 *   · La fila de movimiento conserva TODA la funcionalidad: la etiqueta "reps"
 *     del mock es el selector de unidad que ya existía (ahora en accent, sin
 *     fondo y con nombres de 3 letras), y eliminar pasa al swipe para dejar
 *     sitio al asa de arrastre.
 *   · La unidad por defecto de un movimiento nuevo sale del ejercicio: los que
 *     progresan por tiempo (`time_progression`) entran en segundos.
 *
 * La lógica (autosave con debounce, presets, picker de movimientos) se conserva.
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Animated, PanResponder,
} from 'react-native';
import Reanimated, {
  useSharedValue, useAnimatedStyle, withTiming, runOnJS, Easing,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../../store/useStore';
import { emomTotalIntervals } from '../../../../src/utils/conditioningBlocks';
import { useWeightUnit } from '../../hooks/useWeightUnit';
import { spacing, textStyles } from '../../theme';
import { useTheme, useThemedStyles } from '../../useTheme';
import SegmentedControl from '../ui/SegmentedControl';
import StepField from '../ui/StepField';
import { DragIcon } from '../ui/EditorIcons';

const UNIT_CYCLE = ['reps', 'cal', 'm', 'sec'];

// Geometría de la lista de movimientos. Todas las filas miden lo mismo
// (padding 6+6 sobre un Input Field de 30), así que el paso del arrastre es un
// número fijo y no hay que medir nada.
const MOV_ROW_H = 42;
const MOV_GAP   = spacing.xs;
const MOV_STEP  = MOV_ROW_H + MOV_GAP;
// Botón que descubre el swipe, con el mismo lenguaje que el del editor de sesión.
const SWIPE_BTN_W = 104;
const SWIPE_INSET = spacing.md;
const SWIPE_OPEN  = SWIPE_BTN_W + SWIPE_INSET;
// Banda muerta del salto de hueco y asentamiento al soltar — mismos valores que
// los otros dos editores (ver UI-MIGRATION §"Reordenar").
const SWAP_AT = 0.65;
const SETTLE  = { duration: 160, easing: Easing.inOut(Easing.ease) };

// Compact "M:SS" / "M min" for a duration in seconds — matches how the
// workout clock reads, but collapses to whole minutes when there's no
// remainder so "10 min" doesn't become "10:00".
function fmtDuration(totalSec) {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return s === 0 ? `${m} min` : `${m}:${String(s).padStart(2, '0')}`;
}

// Unidad de arranque de un movimiento nuevo: los ejercicios que progresan por
// tiempo se registran en segundos, el resto en repeticiones.
function defaultUnitFor(def) {
  return def?.progressionModel === 'time_progression' ? 'sec' : 'reps';
}

// Radios de la lista agrupada: solo el primero y el último redondean por fuera.
function movRadii(th, isFirst, isLast) {
  const r = th.radius.sm;
  const x = th.radius.xxs ?? 2;
  return {
    borderTopLeftRadius:     isFirst ? r : x,
    borderTopRightRadius:    isFirst ? r : x,
    borderBottomLeftRadius:  isLast  ? r : x,
    borderBottomRightRadius: isLast  ? r : x,
  };
}

// ─── Fila de movimiento (Exercice editor elements / Ejercicio blqoues) ────────

function MovementRow({
  name, amount, unitLabel, weightValue, weightLabel, radii,
  onAmountChange, onUnitPress, onWeightChange, onRemove,
  isOpen, onOpenChange,
  isDragging, dragY, shift, animateShift, onDragStart, onDragMove, onDragEnd,
}) {
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { t }  = useTranslation();

  // ── Swipe para eliminar ──
  const [dragX] = useState(() => new Animated.Value(0));
  const openRef = useRef(false);
  const cbs     = useRef({ onOpenChange, onDragStart, onDragMove, onDragEnd });
  useEffect(() => { cbs.current = { onOpenChange, onDragStart, onDragMove, onDragEnd }; });

  useEffect(() => {
    if (!isOpen && openRef.current) {
      openRef.current = false;
      Animated.spring(dragX, { toValue: 0, useNativeDriver: false, tension: 80 }).start();
    }
  }, [isOpen, dragX]);

  /* eslint-disable-next-line react-hooks/refs */
  const [pan] = useState(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gs) => !openRef.current && gs.dx > 8 && gs.dx > Math.abs(gs.dy) * 1.3,
    onPanResponderMove: (_, gs) => { if (gs.dx > 0) dragX.setValue(Math.min(gs.dx, SWIPE_OPEN)); },
    onPanResponderRelease: (_, gs) => {
      const opening = gs.dx >= SWIPE_OPEN / 2;
      openRef.current = opening;
      cbs.current.onOpenChange(opening);
      Animated.spring(dragX, { toValue: opening ? SWIPE_OPEN : 0, useNativeDriver: false, tension: 80 }).start();
    },
  }));

  // ── Arrastre para reordenar (el asa reclama el gesto en `onStart`) ──
  /* eslint-disable-next-line react-hooks/refs */
  const [dragPan] = useState(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderGrant:     ()      => cbs.current.onDragStart(),
    onPanResponderMove:      (_, gs) => cbs.current.onDragMove(gs.dy),
    onPanResponderRelease:   ()      => cbs.current.onDragEnd(),
    onPanResponderTerminate: ()      => cbs.current.onDragEnd(),
  }));

  // Los vecinos ceden el hueco con `withTiming`; fuera del gesto el
  // desplazamiento se lee del prop DIRECTAMENTE, no del shared value — al
  // soltar, el orden nuevo y `shift = 0` llegan en el mismo commit y pasando
  // por el efecto el 0 llegaría un frame tarde (ver UI-MIGRATION §"Reordenar").
  const shiftSv = useSharedValue(0);
  useEffect(() => {
    if (!animateShift) return;
    shiftSv.value = withTiming(shift, SETTLE);
  }, [shift, animateShift, shiftSv]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{
      translateY: isDragging ? dragY.value : (animateShift ? shiftSv.value : shift),
    }],
  }), [isDragging, animateShift, shift]);

  return (
    <Reanimated.View style={[styles.movWrap, isDragging && { zIndex: 2, elevation: 4 }, animStyle]}>
      <View style={styles.movActions}>
        <TouchableOpacity style={styles.movDeleteBtn} onPress={onRemove} activeOpacity={0.8}>
          <Text style={styles.movDeleteText}>{t('common.delete')}</Text>
        </TouchableOpacity>
      </View>

      <Animated.View style={[styles.movRow, radii, { transform: [{ translateX: dragX }] }]} {...pan.panHandlers}>
        <Text style={styles.movName} numberOfLines={1}>{name}</Text>
        <TextInput
          style={styles.movField}
          keyboardType="numeric"
          value={String(amount)}
          onChangeText={onAmountChange}
          selectTextOnFocus
        />
        <TouchableOpacity onPress={onUnitPress} hitSlop={8} activeOpacity={0.6}>
          <Text style={styles.movUnit}>{unitLabel}</Text>
        </TouchableOpacity>
        <TextInput
          style={styles.movField}
          keyboardType="decimal-pad"
          placeholder="—"
          placeholderTextColor={th.colors.mutedLight}
          value={weightValue}
          onChangeText={onWeightChange}
        />
        <Text style={styles.movWeightUnit}>{weightLabel}</Text>
        <View {...dragPan.panHandlers} style={styles.movHandle}>
          <DragIcon color={th.colors.mutedLight} />
        </View>
      </Animated.View>
    </Reanimated.View>
  );
}

// ─── BlockEditorInline ────────────────────────────────────────────────────────

function computeInitial(block) {
  return {
    format:      block.format ?? 'amrap',
    capSec:      block.capSec ?? 600,
    intervalSec: block.intervalSec ?? 60,
    rounds:      block.rounds ?? (block.format === 'for_time' ? 3 : 10),
    emomMode:    block.emomMode ?? 'rotate',
    movements:   block.movements ?? [],
    name:        block.name ?? '',
    notes:       block.notes ?? '',
    hasCap:      block.format === 'for_time' ? block.capSec != null : true,
  };
}

const INTERVAL_PRESETS = [30, 45, 60, 90];

export default function BlockEditorInline({ templateId, block, allExercises, onClose, navigation }) {
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { t }  = useTranslation();
  const { label: weightLabel, toDisplay, toKg } = useWeightUnit();

  const updateBlock            = useStore((s) => s.updateBlock);
  const removeBlockFromSession = useStore((s) => s.removeBlockFromSession);
  const saveBlockPreset        = useStore((s) => s.saveBlockPreset);
  const showToast              = useStore((s) => s.showToast);
  const blockPickerResult      = useStore((s) => s.ui._blockPickerResult);
  const setBlockPickerResult   = useStore((s) => s.setBlockPickerResult);

  const initialRef = useRef(computeInitial(block));
  const i = initialRef.current;

  const [format,      setFormat]      = useState(i.format);
  const [capSec,      setCapSec]      = useState(i.capSec);
  const [intervalSec, setIntervalSec] = useState(i.intervalSec);
  const [rounds,      setRounds]      = useState(i.rounds);
  const [emomMode,    setEmomMode]    = useState(i.emomMode);
  const [movements,   setMovements]   = useState(i.movements);
  const [name,        setName]        = useState(i.name);
  const [notes,       setNotes]       = useState(i.notes);
  const [hasCap,      setHasCap]      = useState(i.hasCap);
  const [openRowIdx,  setOpenRowIdx]  = useState(null);
  // Un intervalo que no esté entre los presets arranca ya en modo Custom.
  const [intervalCustom, setIntervalCustom] = useState(!INTERVAL_PRESETS.includes(i.intervalSec));

  const stateRef  = useRef(null);
  const dirtyRef  = useRef(false);
  const timerRef  = useRef(null);
  const updateRef = useRef(updateBlock);
  useEffect(() => { updateRef.current = updateBlock; }, [updateBlock]);

  stateRef.current = { format, capSec, intervalSec, rounds, emomMode, movements, name, notes, hasCap };

  const commitValues = useCallback((s) => {
    const updates = {
      format:      s.format,
      capSec:      s.format === 'amrap' ? s.capSec : s.format === 'for_time' ? (s.hasCap ? s.capSec : null) : null,
      intervalSec: s.format === 'emom' ? s.intervalSec : null,
      rounds:      s.format === 'amrap' ? null : s.rounds,
      emomMode:    s.emomMode,
      movements:   s.movements,
      name:        s.name.trim() || null,
      notes:       s.notes.trim() || null,
    };
    updateRef.current(templateId, block.id, updates);
  }, [templateId, block.id]);

  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    dirtyRef.current = true;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => { commitValues(stateRef.current); }, 400);
    return () => clearTimeout(timerRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [format, capSec, intervalSec, rounds, emomMode, movements, name, notes, hasCap]);

  useEffect(() => {
    return () => {
      if (dirtyRef.current) { clearTimeout(timerRef.current); commitValues(stateRef.current); }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Movement picker handoff (ExerciseSelectorScreen → ui._blockPickerResult) ──
  const allExercisesRef = useRef(allExercises);
  useEffect(() => { allExercisesRef.current = allExercises; }, [allExercises]);
  useEffect(() => {
    if (!blockPickerResult) return;
    const def = allExercisesRef.current?.[blockPickerResult];
    setMovements((prev) => [
      ...prev,
      { exerciseId: blockPickerResult, amount: 10, unit: defaultUnitFor(def), weight: null },
    ]);
    setBlockPickerResult(null);
  }, [blockPickerResult, setBlockPickerResult]);

  function handleAddMovement() {
    navigation.navigate('ExerciseSelector', { templateId, blockPicker: true });
  }

  function handleRemoveMovement(idx) {
    setOpenRowIdx(null);
    setMovements((prev) => prev.filter((_, i2) => i2 !== idx));
  }

  function updateMovement(idx, patch) {
    setMovements((prev) => prev.map((m, i2) => i2 === idx ? { ...m, ...patch } : m));
  }

  function cycleUnit(idx) {
    const cur = movements[idx].unit ?? 'reps';
    const next = UNIT_CYCLE[(UNIT_CYCLE.indexOf(cur) + 1) % UNIT_CYCLE.length];
    updateMovement(idx, { unit: next });
  }

  // ── Reordenado de movimientos ─────────────────────────────────────────────
  // Mismo patrón que los otros dos editores: durante el gesto no se toca el
  // orden pintado, y al soltar la fila se asienta ANTES de escribir el orden.
  const [drag, setDrag] = useState(null);   // { idx, to }
  const dragRef = useRef(null);
  const dragY   = useSharedValue(0);

  function handleDragStart(idx) {
    setOpenRowIdx(null);
    dragRef.current = { idx, to: idx };
    setDrag(dragRef.current);
    dragY.value = 0;
  }

  function handleDragMove(idx, dy) {
    const state = dragRef.current;
    if (state?.idx !== idx) return;
    dragY.value = dy;
    // Banda muerta: con el 0.5 implícito de un `round`, el temblor del dedo en
    // la frontera hacía ir y venir el orden.
    const raw  = dy / MOV_STEP;
    const step = raw > 0 ? Math.floor(raw + (1 - SWAP_AT)) : Math.ceil(raw - (1 - SWAP_AT));
    const to   = Math.min(movements.length - 1, Math.max(0, idx + step));
    if (to === state.to) return;
    dragRef.current = { ...state, to };
    setDrag(dragRef.current);
  }

  function handleDragEnd(idx) {
    const state = dragRef.current;
    if (state?.idx !== idx) return;
    dragRef.current = null;
    dragY.value = withTiming((state.to - state.idx) * MOV_STEP, SETTLE, (done) => {
      'worklet';
      if (done) runOnJS(commitDrag)(state);
    });
  }

  function commitDrag(state) {
    setDrag(null);
    dragY.value = 0;
    if (state.to === state.idx) return;
    setMovements((prev) => {
      const next = [...prev];
      const [moved] = next.splice(state.idx, 1);
      next.splice(state.to, 0, moved);
      return next;
    });
  }

  // Desplazamiento de los vecinos mientras dura el gesto.
  function shiftFor(idx) {
    if (!drag || idx === drag.idx) return 0;
    const { idx: from, to } = drag;
    if (from < to && idx > from && idx <= to) return -MOV_STEP;
    if (from > to && idx < from && idx >= to) return  MOV_STEP;
    return 0;
  }

  function handleSavePreset() {
    // saveBlockPreset strips whatever `id` we pass and assigns a fresh presetId.
    saveBlockPreset({
      id: block.id,
      format,
      capSec:      format === 'amrap' ? capSec : format === 'for_time' ? (hasCap ? capSec : null) : null,
      intervalSec: format === 'emom' ? intervalSec : null,
      rounds:      format === 'amrap' ? null : rounds,
      emomMode,
      movements,
      name:  name.trim() || null,
      notes: notes.trim() || null,
    });
    showToast(t('blocks.presetSaved'), 2200, 'success');
  }

  function handleDeleteBlock() {
    Alert.alert(
      t('blocks.deleteBlock'),
      t('blocks.deleteConfirm', { name: name.trim() || t(`blocks.formats.${format}`) }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('blocks.deleteBlock'), style: 'destructive',
          onPress: () => { removeBlockFromSession(templateId, block.id); onClose(); },
        },
      ]
    );
  }

  const FORMAT_OPTIONS = ['amrap', 'emom', 'for_time'].map((id) => ({ id, label: t(`blocks.formats.${id}`) }));
  const EMOM_MODES     = ['all', 'rotate'].map((id) => ({ id, label: t(`blocks.emomModes.${id}`) }));
  const CAP_MODES      = [
    { id: 'none', label: t('blocks.capModes.none') },
    { id: 'cap',  label: t('blocks.capModes.cap')  },
  ];
  // El 120s de la app se cambia por `Custom`, que abre una fila ± (Figma).
  const INTERVAL_OPTIONS = [
    ...INTERVAL_PRESETS.map((s) => ({ id: String(s), label: `${s}s` })),
    { id: 'custom', label: t('blocks.intervalCustom') },
  ];

  // ── Live summary — the single most important thing this editor answers:
  // what happens each interval/round, how long it lasts, and whether the
  // movements all sit inside one round or are spread across several.
  const moveCount = movements.length;
  let summaryMain, summarySub;
  if (format === 'amrap') {
    // El número de ejercicios va también arriba, detrás de los minutos (QA),
    // aunque el subtítulo lo repita en lenguaje natural.
    summaryMain = moveCount > 0
      ? t('blocks.summary.amrapMainCount', { min: Math.round(capSec / 60), count: moveCount })
      : t('blocks.summary.amrapMain',      { min: Math.round(capSec / 60) });
    summarySub = moveCount > 0
      ? t('blocks.summary.amrapSub', { count: moveCount })
      : t('blocks.summary.empty');
  } else if (format === 'emom') {
    const totalIntervals = emomTotalIntervals({ format: 'emom', rounds, emomMode, movements });
    summaryMain = t('blocks.summary.emomMain', {
      rounds, interval: `${intervalSec}s`, total: fmtDuration(intervalSec * totalIntervals),
    });
    summarySub = moveCount === 0
      ? t('blocks.summary.empty')
      : moveCount === 1
        ? t('blocks.summary.emomSubOne')
        : emomMode === 'rotate'
          ? t('blocks.summary.emomSubRotate', { count: moveCount })
          : t('blocks.summary.emomSubAll', { count: moveCount });
  } else {
    summaryMain = hasCap
      ? t('blocks.summary.forTimeMainCap', { rounds, cap: Math.round(capSec / 60) })
      : t('blocks.summary.forTimeMainNoCap', { rounds });
    summarySub = moveCount > 0
      ? t('blocks.summary.forTimeSub', { count: moveCount })
      : t('blocks.summary.empty');
  }

  // Las secciones van numeradas como en Figma; EMOM mete "INTERVALO" en medio,
  // así que el número de MOVIMIENTOS depende del formato.
  const movementsStep = format === 'emom' ? 3 : 2;

  return (
    <View style={styles.container}>

      {/* ══ RESUMEN ══════════════════════════════════════════════════════════ */}
      <View style={styles.summaryCard}>
        <Text style={styles.summaryTag}>{t('exerciseEditor.summaryTitle')}</Text>
        <Text style={styles.summaryMain}>{summaryMain}</Text>
        <Text style={styles.summarySub}>{summarySub}</Text>
      </View>

      {/* ══ 1. FORMATO ═══════════════════════════════════════════════════════ */}
      <View style={styles.block}>
        <Text style={styles.secLabel}>{`1. ${t('blocks.formatLabel').toUpperCase()}`}</Text>
        <SegmentedControl options={FORMAT_OPTIONS} value={format} onChange={setFormat} />

        {format === 'emom' ? (
          <>
            <Text style={styles.subLabel}>{t('blocks.emomTypeLabel').toUpperCase()}</Text>
            <SegmentedControl options={EMOM_MODES} value={emomMode} onChange={setEmomMode} />
            <Text style={styles.hint}>{t(`blocks.emomModeDesc.${emomMode}`)}</Text>
          </>
        ) : (
          <Text style={styles.hint}>{t(`blocks.formatDesc.${format}`)}</Text>
        )}

        {format === 'amrap' && (
          <StepField
            horizontal unit="min"
            label={t('blocks.capLabel')}
            value={Math.round(capSec / 60)}
            onChange={(min) => setCapSec(min * 60)}
            min={1}
            max={60}
          />
        )}

        {format === 'for_time' && (
          <>
            <StepField
              horizontal
              label={t('blocks.roundsLabel')}
              value={rounds}
              onChange={setRounds}
              min={1}
              max={20}
            />
            <SegmentedControl
              options={CAP_MODES}
              value={hasCap ? 'cap' : 'none'}
              onChange={(v) => setHasCap(v === 'cap')}
            />
            {hasCap && (
              <StepField
                horizontal unit="min"
                label={t('blocks.capLabel')}
                value={Math.round(capSec / 60)}
                onChange={(min) => setCapSec(min * 60)}
                min={1}
                max={60}
              />
            )}
          </>
        )}
      </View>

      {/* ══ 2. INTERVALO (solo EMOM) ═════════════════════════════════════════ */}
      {format === 'emom' && (
        <View style={styles.block}>
          <Text style={styles.secLabel}>{`2. ${t('blocks.intervalLabel').toUpperCase()}`}</Text>
          <SegmentedControl
            options={INTERVAL_OPTIONS}
            value={intervalCustom ? 'custom' : String(intervalSec)}
            onChange={(v) => {
              if (v === 'custom') {
                setIntervalCustom(true);
                // Arranca en 120s: es el preset que Custom vino a sustituir, y
                // dejar el 30/45/60/90 de antes hacía que no pasara nada visible.
                if (INTERVAL_PRESETS.includes(intervalSec)) setIntervalSec(120);
                return;
              }
              setIntervalCustom(false);
              setIntervalSec(Number(v));
            }}
          />
          {intervalCustom && (
            <StepField
              horizontal unit="s"
              label={t('blocks.intervalLabel')}
              value={intervalSec}
              onChange={setIntervalSec}
              min={10}
              max={300}
              step={5}
            />
          )}
          <StepField
            horizontal
            label={t('blocks.roundsLabel')}
            value={rounds}
            onChange={setRounds}
            min={1}
            max={40}
          />
        </View>
      )}

      {/* ══ MOVIMIENTOS ══════════════════════════════════════════════════════ */}
      <View style={styles.block}>
        <View style={styles.movHeader}>
          <Text style={styles.secLabel}>{`${movementsStep}. ${t('blocks.movements').toUpperCase()}`}</Text>
          <Text style={styles.movHeaderNote}>{t('blocks.weightOptional')}</Text>
        </View>

        {movements.length > 0 && (
          <View style={styles.movList}>
            {movements.map((m, idx) => {
              const def = allExercises?.[m.exerciseId];
              return (
                <MovementRow
                  key={`${m.exerciseId}-${idx}`}
                  name={def?.name ?? m.exerciseId}
                  amount={m.amount}
                  unitLabel={t(`blocks.units.${m.unit ?? 'reps'}`)}
                  weightValue={m.weight == null ? '' : String(toDisplay(m.weight))}
                  weightLabel={weightLabel}
                  radii={movRadii(th, idx === 0, idx === movements.length - 1)}
                  onAmountChange={(v) => {
                    const n = parseInt(v.replace(/[^0-9]/g, ''), 10);
                    updateMovement(idx, { amount: isNaN(n) ? 0 : n });
                  }}
                  onUnitPress={() => cycleUnit(idx)}
                  onWeightChange={(v) => {
                    if (v === '') { updateMovement(idx, { weight: null }); return; }
                    if (/^\d*\.?\d*$/.test(v)) updateMovement(idx, { weight: toKg(v) });
                  }}
                  onRemove={() => handleRemoveMovement(idx)}
                  isOpen={openRowIdx === idx}
                  onOpenChange={(open) => setOpenRowIdx(open ? idx : null)}
                  isDragging={drag?.idx === idx}
                  dragY={dragY}
                  shift={shiftFor(idx)}
                  animateShift={!!drag}
                  onDragStart={() => handleDragStart(idx)}
                  onDragMove={(dy) => handleDragMove(idx, dy)}
                  onDragEnd={()   => handleDragEnd(idx)}
                />
              );
            })}
          </View>
        )}

        <TouchableOpacity style={styles.addMovementBtn} onPress={handleAddMovement} activeOpacity={0.75}>
          <Text style={styles.addMovementText}>
            <Text style={styles.addPlus}>+</Text>{` ${t('blocks.addMovement')}`}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ══ OPCIONES ═════════════════════════════════════════════════════════ */}
      <Text style={styles.secLabel}>{t('blocks.sectionOptions').toUpperCase()}</Text>
      <View style={styles.optionsCard}>
        <Text style={styles.optionsLabel}>{t('blocks.nameLabel')}</Text>
        <TextInput
          style={styles.nameInput}
          value={name}
          onChangeText={setName}
          placeholder={t(`blocks.formats.${format}`)}
          placeholderTextColor={th.colors.mutedLight}
        />
        <TextInput
          style={styles.noteInput}
          value={notes}
          onChangeText={setNotes}
          placeholder={t('blocks.notePlaceholder')}
          placeholderTextColor={th.colors.mutedLight}
          multiline
          maxLength={280}
        />
      </View>

      {/* ══ ACCIONES ═════════════════════════════════════════════════════════ */}
      <TouchableOpacity style={styles.presetBtn} onPress={handleSavePreset} activeOpacity={0.8}>
        <Text style={styles.presetBtnText}>{t('blocks.savePreset')}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteBlock} activeOpacity={0.8}>
        <Text style={styles.deleteBtnText}>{t('blocks.deleteBlock')}</Text>
      </TouchableOpacity>

    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const makeStyles = (th) => StyleSheet.create({

  container: {
    paddingHorizontal: spacing.lg,
    paddingBottom:     spacing.xxl + spacing.lg,
    gap:               spacing.md,
  },
  block: { gap: spacing.md },

  // ── Resumen (misma anatomía que el editor de ejercicio) ───────────────────
  summaryCard: {
    backgroundColor:   th.tint.accent10,
    borderRadius:      th.radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical:   spacing.md,
    gap:               spacing.sm,
  },
  summaryTag:  { ...textStyles.spacingTag, color: th.colors.accent },
  summaryMain: { ...textStyles.cardType,   color: th.colors.text },
  summarySub:  { ...textStyles.tag,        color: th.tint.accent50 },

  // ── Etiquetas ─────────────────────────────────────────────────────────────
  secLabel: { ...textStyles.spacingTag, color: th.colors.mutedLight, paddingTop: spacing.md },
  // Sub-etiqueta dentro de una sección ("TIPO DE EMOM"): sin el paddingTop, que
  // ya lo pone la etiqueta numerada de arriba.
  subLabel: { ...textStyles.spacingTag, color: th.colors.mutedLight },
  hint:     { ...textStyles.tag, color: th.colors.mutedLight, lineHeight: 14 },

  // ── Movimientos ───────────────────────────────────────────────────────────
  movHeader: {
    flexDirection:  'row',
    alignItems:     'flex-end',
    justifyContent: 'space-between',
    gap:            spacing.md,
  },
  movHeaderNote: { ...textStyles.tag, color: th.colors.mutedLight },
  movList:       { gap: MOV_GAP },
  movWrap:       { position: 'relative' },
  movRow: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             spacing.sm,
    height:          MOV_ROW_H,
    backgroundColor: th.colors.surface,
    overflow:        'hidden',
  },
  // El nombre lleva su propio padding izquierdo: la fila no tiene padding
  // horizontal para que el asa llegue al borde, como en Figma.
  movName: { ...textStyles.cardType, color: th.colors.text, flex: 1, minWidth: 0, paddingLeft: spacing.md },
  // Input Field del mock: `color/workout-card`, que en este tema es `bg`.
  movField: {
    width:              51,
    height:             30,
    backgroundColor:    th.colors.bg,
    borderRadius:       th.radius.sm,
    paddingHorizontal:  spacing.sm,
    paddingVertical:    0,
    ...textStyles.cardType,
    color:              th.colors.text,
    textAlign:          'center',
    textAlignVertical:  'center',
    includeFontPadding: false,
  },
  // Selector de unidad: el "reps" del mock es pulsable y cicla reps/cal/m/seg,
  // así que va en accent para que se lea como control, no como etiqueta.
  movUnit:       { ...textStyles.tag, color: th.colors.accent },
  movWeightUnit: { ...textStyles.tag, color: th.colors.mutedLight },
  // Ancho de sobra alrededor del icono: el asa es un blanco de 26px y costaba
  // acertar (QA). El PanResponder no respeta `hitSlop`, así que el área tiene
  // que ser la de la propia View.
  movHandle: { width: 44, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },

  // Panel que descubre el swipe (mismo lenguaje que el del editor de sesión).
  movActions: {
    position: 'absolute', left: 0, top: 0, bottom: 0,
    flexDirection: 'row',
    width:         SWIPE_OPEN,
    paddingRight:  SWIPE_INSET,
  },
  movDeleteBtn: {
    width:           SWIPE_BTN_W,
    alignItems:      'center',
    justifyContent:  'center',
    borderRadius:    th.radius.sm,
    backgroundColor: th.tint.red30,
  },
  movDeleteText: { ...textStyles.cardType, color: th.tint.red50 },

  // Figma lo dibuja con borde accent (192:1817), pero manda la consistencia
  // (QA): es el mismo botón de añadir que el resto de la app — texto plano con
  // el "+" en accent, sin caja.
  addMovementBtn:  { alignItems: 'center', paddingVertical: spacing.md },
  addMovementText: { ...textStyles.cardType, color: th.tint.accent50 },
  addPlus:         { color: th.colors.accent },

  // ── Opciones ──────────────────────────────────────────────────────────────
  optionsCard: {
    backgroundColor:   th.colors.surface,
    borderRadius:      th.radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical:   spacing.md,
    gap:               spacing.sm,
  },
  optionsLabel: { ...textStyles.cardType, color: th.colors.text },
  nameInput: {
    height:            30,
    backgroundColor:   th.colors.bg,
    borderRadius:      th.radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical:   0,
    ...textStyles.tag,
    color:             th.colors.text,
  },
  noteInput: {
    height:            54,
    backgroundColor:   th.colors.bg,
    borderRadius:      th.radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical:   spacing.sm,
    ...textStyles.tag,
    color:             th.colors.text,
    textAlignVertical: 'top',
  },

  // ── Acciones ──────────────────────────────────────────────────────────────
  presetBtn: {
    alignItems:      'center',
    paddingVertical: spacing.md,
    borderRadius:    th.radius.sm,
    backgroundColor: th.colors.surface2,
    marginTop:       spacing.md,
  },
  presetBtnText: { ...textStyles.cardType, color: th.colors.text },
  deleteBtn:     { alignItems: 'center', paddingVertical: spacing.md },
  deleteBtnText: { ...textStyles.cardType, color: th.tint.red50 },
});
