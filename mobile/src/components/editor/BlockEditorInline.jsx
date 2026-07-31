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
import Sortable from 'react-native-sortables';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../../store/useStore';
import { emomTotalIntervals } from '../../../../src/utils/conditioningBlocks';
import { useWeightUnit } from '../../hooks/useWeightUnit';
import { spacing, textStyles } from '../../theme';
import { useTheme, useThemedStyles } from '../../useTheme';
import SegmentedControl from '../ui/SegmentedControl';
import StepField from '../ui/StepField';
import { DragIcon } from '../ui/EditorIcons';
import { SORTABLE_PROPS } from '../ui/sortable';

const UNIT_CYCLE = ['reps', 'cal', 'm', 'sec'];

// Hueco entre tarjetas de movimiento — el mismo que entre las del editor de
// sesión, ahora que cada movimiento es una tarjeta suelta y no una lista pegada.
const MOV_GAP   = spacing.sm;
// Botón que descubre el swipe, con el mismo lenguaje que el del editor de sesión.
const SWIPE_BTN_W = 104;
const SWIPE_INSET = spacing.md;
const SWIPE_OPEN  = SWIPE_BTN_W + SWIPE_INSET;

// Identidad estable de cada movimiento MIENTRAS dura la edición: la lista
// reordenable la necesita como `key` y el dato guardado no sirve — dos
// movimientos pueden ser el mismo ejercicio, y una `key` posicional haría que
// la librería y el estado aplicasen el reordenado dos veces. No se persiste:
// `stripUids` la quita en los dos únicos puntos de escritura.
let uidSeq = 0;
const withUid   = (m) => ({ ...m, uid: `mov${(uidSeq += 1)}` });
const stripUids = (list) => list.map((m) => {
  const copy = { ...m };
  delete copy.uid;
  return copy;
});

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
// ─── Tarjeta de movimiento ────────────────────────────────────────────────────
// Dos líneas, no la fila compacta del mock original: en una sola línea el nombre
// competía por el ancho con dos inputs, el selector de unidad y el asa, y se
// truncaba casi siempre. Arriba nombre (a dos líneas si hace falta) y asa;
// abajo los controles, que ahí ya caben holgados.
//
// Cada movimiento es una tarjeta suelta con su radio completo: agrupadas con
// radios interiores de 2 px se leían como una lista continua, y con dos líneas
// por movimiento ya no hay nada que agrupar.

function MovementRow({
  name, amount, unitLabel, weightValue, weightLabel,
  onAmountChange, onUnitPress, onWeightChange, onRemove,
  isOpen, onOpenChange,
}) {
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { t }  = useTranslation();

  // ── Swipe para eliminar ──
  const [dragX] = useState(() => new Animated.Value(0));
  const openRef = useRef(false);
  const cbs     = useRef({ onOpenChange });
  useEffect(() => { cbs.current = { onOpenChange }; });

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

  return (
    <View style={styles.movWrap}>
      <View style={styles.movActions}>
        <TouchableOpacity style={styles.movDeleteBtn} onPress={onRemove} activeOpacity={0.8}>
          <Text style={styles.movDeleteText}>{t('common.delete')}</Text>
        </TouchableOpacity>
      </View>

      <Animated.View style={[styles.movCard, { transform: [{ translateX: dragX }] }]} {...pan.panHandlers}>
        <View style={styles.movBody}>
          <Text style={styles.movName} numberOfLines={2}>{name}</Text>

          <View style={styles.movControls}>
            <TextInput
              style={styles.movField}
              keyboardType="numeric"
              value={String(amount)}
              onChangeText={onAmountChange}
              selectTextOnFocus
            />
            {/* El selector de unidad cicla reps/cal/m/seg; en accent y con caja
                propia para que se lea como control y no como etiqueta del campo. */}
            <TouchableOpacity style={styles.movUnitBtn} onPress={onUnitPress} activeOpacity={0.6}>
              <Text style={styles.movUnit}>{unitLabel}</Text>
            </TouchableOpacity>

            <TextInput
              style={[styles.movField, styles.movFieldWeight]}
              keyboardType="decimal-pad"
              placeholder="—"
              placeholderTextColor={th.colors.mutedLight}
              value={weightValue}
              onChangeText={onWeightChange}
            />
            <Text style={styles.movWeightUnit}>{weightLabel}</Text>
          </View>
        </View>

        {/* Fuera del cuerpo para que el asa se centre contra la tarjeta ENTERA,
            no contra la línea del nombre. */}
        <Sortable.Handle style={styles.movHandle}>
          <DragIcon color={th.colors.mutedLight} />
        </Sortable.Handle>
      </Animated.View>
    </View>
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
    movements:   (block.movements ?? []).map(withUid),
    name:        block.name ?? '',
    notes:       block.notes ?? '',
    hasCap:      block.format === 'for_time' ? block.capSec != null : true,
  };
}

const INTERVAL_PRESETS = [30, 45, 60, 90];

// `scrollableRef` es el del ScrollView de la pantalla que contiene el editor:
// lo necesita la lista reordenable para autoscroll al arrastrar cerca del borde.
export default function BlockEditorInline({ templateId, block, allExercises, onClose, navigation, scrollableRef }) {
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
      movements:   stripUids(s.movements),
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
      withUid({ exerciseId: blockPickerResult, amount: 10, unit: defaultUnitFor(def), weight: null }),
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
  // Lo lleva `Sortable.Grid`: el orden pintado no cambia durante el gesto y las
  // posiciones viven en el hilo de UI, así que no hay dos commits que
  // sincronizar. El estado solo se escribe al soltar, y solo si algo se movió —
  // si no, el autosave se dispararía por un arrastre que acabó donde empezó.
  function handleReorder({ data, fromIndex, toIndex }) {
    setOpenRowIdx(null);
    if (fromIndex !== toIndex) setMovements(data);
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
      movements: stripUids(movements),
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
          <Sortable.Grid
            {...SORTABLE_PROPS}
            data={movements}
            keyExtractor={(m) => m.uid}
            rowGap={MOV_GAP}
            scrollableRef={scrollableRef}
            onDragEnd={handleReorder}
            renderItem={({ item: m, index: idx }) => {
              const def = allExercises?.[m.exerciseId];
              return (
                <MovementRow
                  name={def?.name ?? m.exerciseId}
                  amount={m.amount}
                  unitLabel={t(`blocks.units.${m.unit ?? 'reps'}`)}
                  weightValue={m.weight == null ? '' : String(toDisplay(m.weight))}
                  weightLabel={weightLabel}
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
                />
              );
            }}
          />
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
  movWrap: { position: 'relative' },
  // El asa es hermana del cuerpo, no hija: así se centra contra el alto entero
  // de la tarjeta. El padding derecho lo pone ella, para que su blanco llegue al
  // borde en vez de dejar un hueco muerto.
  movCard: {
    flexDirection:   'row',
    backgroundColor: th.colors.surface,
    borderRadius:    th.radius.sm,
    paddingLeft:     spacing.md,
    overflow:        'hidden',
  },
  movBody: {
    flex:            1,
    minWidth:        0,
    paddingVertical: spacing.md,
    gap:             spacing.md,
  },
  movName: { ...textStyles.cardType, color: th.colors.text },
  // Ancho de sobra alrededor del icono: el asa es un blanco de 26px y costaba
  // acertar (QA). El área tiene que ser la de la propia View.
  movHandle: {
    width:          44,
    alignSelf:      'stretch',
    alignItems:     'center',
    justifyContent: 'center',
  },
  movControls: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.sm,
  },
  // Input Field del mock: `color/workout-card`, que en este tema es `bg`.
  movField: {
    width:              56,
    height:             34,
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
  // Separación extra contra el bloque de cantidad+unidad: pegados se leerían
  // como un mismo grupo, y el peso es otra cosa.
  movFieldWeight: { marginLeft: spacing.lg },
  // Selector de unidad: pulsable, cicla reps/cal/m/seg. Va en accent y con caja
  // para que se lea como control y no como etiqueta del campo de al lado.
  movUnitBtn: {
    height:            34,
    justifyContent:    'center',
    paddingHorizontal: spacing.md,
    borderRadius:      th.radius.sm,
    backgroundColor:   th.tint.accent10,
  },
  movUnit:       { ...textStyles.cardType, color: th.colors.accent },
  movWeightUnit: { ...textStyles.tag, color: th.colors.mutedLight },

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
