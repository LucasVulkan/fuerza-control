/**
 * ExerciseEditorInline — editor de un ejercicio, rediseño FormaFit (Figma
 * `123:1511` "Exercice Editor" + componentes `Exercice editor elements`
 * `160:1197` y `Option blocks` `176:1902`/`176:1952`).
 *
 * Estructura del mock, de arriba abajo: RESUMEN (tint/accent-10, sin borde) →
 * VOLUMEN (segmented REPS/TIME + grid 2×2 de cajas ±) → CALENTAMIENTO →
 * PROGRESIÓN → OPCIONES (lista agrupada) + Vinculación (tarjeta aparte).
 *
 * Tres piezas de la app no existen en el mock y se resolvieron con el patrón
 * "fila + hoja" que Figma sí usa para Progresión y Tempo (decisión del usuario):
 *   · Calentamiento — sección propia con una fila que abre su DragSheet.
 *   · Modo de progresión (Auto/Fija/Submáx) — pasa a ser el paso 1 de la hoja
 *     de progresión, así la pantalla queda con una sola fila como en Figma.
 *   · Tempo — la fila muestra el valor y abre una hoja con el input.
 * Los botones Sustituir / Eliminar del final tampoco están en Figma: son
 * funcionalidad pedida aparte, con el lenguaje de los botones que descubre el
 * swipe en el editor de sesión (surface2 / tint-red-30).
 *
 * Toda la lógica (autosave con debounce, vinculación, progresión, calentamiento)
 * se conserva tal cual; esto es un restyle + reorganización de la UI.
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, interpolate, interpolateColor, Easing,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../../store/useStore';
import { resolveProgressionConfig, LEGACY_TYPE_MAP } from '../../../../src/utils/progression';
import { exerciseLinkGroups, exerciseInstanceCount } from '../../../../src/utils/exerciseLinks';
import { warmupSteps } from '../../../../src/utils/warmup';
import { useWeightUnit } from '../../hooks/useWeightUnit';
import { spacing, textStyles } from '../../theme';
import { useTheme, useThemedStyles } from '../../useTheme';
import SegmentedControl from '../ui/SegmentedControl';
import { ArrowIcon, ProgressionIcon } from '../ui/EditorIcons';
import { GRID } from '../workout/grid';
import DragSheet from '../DragSheet';

// Chevron de fila navegable: la caja de Figma mide 14 pero el glifo real son
// 6.46×10.77 (regla 4 de UI-MIGRATION: caja de icono ≠ icono visible).
const ROW_CHEVRON = 10.77;
// Gris suelto del chevron de "Tempo" en Figma — el mismo literal que ya usa el
// chevron de sesión futura en HomeView.
const CHEVRON_GREY = '#d9d9d9';

// ─── StepField (Exercice editor elements / Caja `142:1119` + Horizontal `160:1198`)
//
// Dos disposiciones del mismo componente, las dos de Figma:
//   · `Caja` (por defecto) — label centrado arriba y la fila ±/valor/± abajo.
//     Se usa en el grid 2×2 de VOLUMEN. Figma dibuja dos versiones dentro del
//     propio grid (alto 68 con los botones centrados / hug con los botones a
//     los bordes): es una inconsistencia del mock, aquí van todas iguales.
//   · `Horizontal` — label a la izquierda y los controles a la derecha. Es la
//     que usan las hojas, donde el alto vertical es caro.
// `dark` pinta la caja sobre `color/app` en vez de `surface`: dentro de una hoja
// el fondo YA es `surface` y las cajas se perdían contra él.
const STEP_BTN  = 34;   // caja del botón ± (Figma 30; subido en QA)
const STEP_GAP  = 26;   // separación entre controles en la variante Horizontal
const GLYPH_W   = 13;   // largo de la barra del − / +
const GLYPH_T   = 2;    // grosor

function StepField({ label, value, onChange, min, max, step = 1, unit, horizontal, dark }) {
  const sf = useThemedStyles(makeSf);
  const [draft, setDraft] = useState(String(value));
  useEffect(() => { setDraft(String(value)); }, [value]);
  const numVal   = Number(value);
  const decimals = step < 1;

  // Redondeo a 2 decimales: sumar 0.25 repetidamente arrastra error binario.
  const round  = (n) => Math.round(n * 100) / 100;
  const commit = (n) => onChange(round(Math.min(max, Math.max(min, n))));

  function handleChangeText(v) {
    setDraft(decimals ? v.replace(/[^0-9.]/g, '') : v.replace(/[^0-9]/g, ''));
  }
  function handleBlur() {
    const n = decimals ? parseFloat(draft) : parseInt(draft, 10);
    if (!isNaN(n)) { const c = round(Math.min(max, Math.max(min, n))); setDraft(String(c)); onChange(c); }
    else setDraft(String(value));
  }

  const controls = (
    <View style={horizontal ? sf.controlsHorizontal : sf.controls}>
      <TouchableOpacity style={sf.stepBtn} onPress={() => commit(numVal - step)} activeOpacity={0.6}>
        <View style={sf.glyphBar} />
      </TouchableOpacity>
      <View style={sf.valueWrap}>
        <TextInput
          style={sf.valueInput}
          keyboardType={decimals ? 'decimal-pad' : 'numeric'}
          value={draft}
          onChangeText={handleChangeText}
          onBlur={handleBlur}
          selectTextOnFocus
        />
        {!!unit && <Text style={sf.unit}>{unit}</Text>}
      </View>
      <TouchableOpacity style={sf.stepBtn} onPress={() => commit(numVal + step)} activeOpacity={0.6}>
        <View style={sf.glyphBar} />
        <View style={[sf.glyphBar, sf.glyphBarV]} />
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={[horizontal ? sf.cardHorizontal : sf.card, dark && sf.cardDark]}>
      <Text style={horizontal ? sf.labelHorizontal : sf.label} numberOfLines={1}>{label}</Text>
      {controls}
    </View>
  );
}

const makeSf = (th) => StyleSheet.create({
  card: {
    flex:            1,
    height:          82,
    backgroundColor: th.colors.surface,
    borderRadius:    th.radius.sm,
    padding:         spacing.md,
    justifyContent:  'space-between',
    overflow:        'hidden',
  },
  // Horizontal (160:1198): px `space/md`, py `space/sm`.
  cardHorizontal: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    gap:               spacing.md,
    backgroundColor:   th.colors.surface,
    borderRadius:      th.radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.sm,
  },
  cardDark: { backgroundColor: th.colors.bg },

  label:           { ...textStyles.cardType, color: th.colors.text, textAlign: 'center' },
  labelHorizontal: { ...textStyles.cardType, color: th.colors.text, flexShrink: 1 },

  controls:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  controlsHorizontal: { flexDirection: 'row', alignItems: 'center', gap: STEP_GAP },

  stepBtn: {
    width:           STEP_BTN,
    height:          STEP_BTN,
    borderRadius:    th.radius.xs,
    backgroundColor: th.colors.surface2,
    alignItems:      'center',
    justifyContent:  'center',
  },
  // El − y el + van dibujados con Views y con las coordenadas puestas a mano
  // (no con glifos ni con centrado automático): así quedan clavados en el
  // centro de la caja sin depender de las métricas de la fuente. El + son dos
  // barras iguales, una girada 90° sobre su propio centro.
  glyphBar: {
    position:        'absolute',
    width:           GLYPH_W,
    height:          GLYPH_T,
    left:            (STEP_BTN - GLYPH_W) / 2,
    top:             (STEP_BTN - GLYPH_T) / 2,
    borderRadius:    GLYPH_T / 2,
    backgroundColor: th.tint.accent50,
  },
  glyphBarV: { transform: [{ rotate: '90deg' }] },

  valueWrap: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            spacing.xs2,
  },
  valueInput: {
    width:              44,
    ...textStyles.cardTitle,
    color:              th.colors.text,
    textAlign:          'center',
    textAlignVertical:  'center',
    includeFontPadding: false,
    backgroundColor:    'transparent',
    height:             STEP_BTN,
    paddingVertical:    0,
  },
  unit: { ...textStyles.subtitle, color: th.colors.mutedLight },
});

// ─── Switch (Icons / Switch, `176:1907`) ──────────────────────────────────────
// Carril 26×14.18 con pulgar de 11.82. Figma solo dibuja el estado ON (carril
// accent, pulgar negro); el OFF es decisión nuestra: surface2 + pulgar
// mutedLight, para que se lea apagado sin introducir un color nuevo.

// Figma da 26×14.18 / pulgar 11.82; en QA se pidió más grande, así que se
// escala el conjunto ×1.3 manteniendo las proporciones del mock.
const SW_SCALE = 1.3;
const TRACK_W  = 26 * SW_SCALE;
const TRACK_H  = 14.182 * SW_SCALE;
const THUMB    = 11.818 * SW_SCALE;
const SW_INSET = 1.18 * SW_SCALE;
const THUMB_X  = [SW_INSET, TRACK_W - THUMB - SW_INSET];
// Alto mínimo de las filas de opciones: el mismo para todas, lo marca la caja
// del switch (QA: la fila de Tempo se veía más fina que las demás).
const OPT_ROW_H = TRACK_W + spacing.sm * 2;

function Switch({ value }) {
  const th = useTheme();
  const p  = useSharedValue(value ? 1 : 0);

  // Los worklets solo pueden capturar valores serializables — `th` lleva
  // funciones dentro, así que se extraen los colores a strings sueltos.
  const trackColors = [th.colors.surface2,   th.colors.accent];
  const thumbColors = [th.colors.mutedLight, th.colors.onAccent];

  useEffect(() => {
    p.value = withTiming(value ? 1 : 0, { duration: 180, easing: Easing.inOut(Easing.ease) });
  }, [value, p]);

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(p.value, [0, 1], trackColors),
  }));
  const thumbStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(p.value, [0, 1], thumbColors),
    transform:       [{ translateX: interpolate(p.value, [0, 1], THUMB_X) }],
  }));

  return (
    <View style={swStyles.box}>
      <Animated.View style={[swStyles.track, trackStyle]}>
        <Animated.View style={[swStyles.thumb, thumbStyle]} />
      </Animated.View>
    </View>
  );
}

const swStyles = StyleSheet.create({
  box:   { width: TRACK_W, height: TRACK_W, alignItems: 'center', justifyContent: 'center' },
  track: { width: TRACK_W, height: TRACK_H, borderRadius: TRACK_H / 2, justifyContent: 'center' },
  thumb: { width: THUMB, height: THUMB, borderRadius: THUMB / 2, position: 'absolute' },
});

// ─── Filas de la lista agrupada (Option blocks / Opciones basicas) ────────────

function OptionRow({ label, hint, onPress, right }) {
  const styles = useThemedStyles(makeStyles);
  const Wrap   = onPress ? TouchableOpacity : View;
  const press  = onPress ? { onPress, activeOpacity: 0.7 } : null;
  return (
    <Wrap style={styles.optRow} {...press}>
      <View style={styles.optRowMeta}>
        <Text style={styles.optRowLabel}>{label}</Text>
        {!!hint && <Text style={styles.optRowHint}>{hint}</Text>}
      </View>
      {right}
    </Wrap>
  );
}

function ToggleRow({ label, hint, value, onChange }) {
  return (
    <OptionRow
      label={label}
      hint={value ? hint : undefined}
      onPress={() => onChange(!value)}
      right={<Switch value={value} />}
    />
  );
}

// Fila navegable "Progresion" (`163:1212`): icono opcional, título, subtítulo y
// chevron. Se reutiliza para Progresión y Calentamiento.
function NavRow({ icon, title, subtitle, onPress }) {
  const styles = useThemedStyles(makeStyles);
  const th     = useTheme();
  return (
    <TouchableOpacity style={styles.navRow} onPress={onPress} activeOpacity={0.7}>
      {icon}
      <View style={styles.navRowMeta}>
        <Text style={styles.navRowTitle}>{title}</Text>
        <Text style={styles.navRowSub}>{subtitle}</Text>
      </View>
      <ArrowIcon size={ROW_CHEVRON} color={th.colors.accent} />
    </TouchableOpacity>
  );
}

// ─── IncrementInput ───────────────────────────────────────────────────────────

function IncrementInput({ value, onChange, unit }) {
  const styles = useThemedStyles(makeStyles);
  const [draft, setDraft] = useState(String(value));
  useEffect(() => { setDraft(String(value)); }, [value]);

  return (
    <View style={styles.incrInputRow}>
      <TextInput
        style={styles.incrInput}
        value={draft}
        onChangeText={(v) => { if (/^\d*\.?\d*$/.test(v)) setDraft(v); }}
        onBlur={() => {
          const n = parseFloat(draft);
          const clamped = isNaN(n) || n < 0 ? 0 : n;
          setDraft(String(clamped));
          onChange(clamped);
        }}
        keyboardType="decimal-pad"
        selectTextOnFocus
      />
      <Text style={styles.incrUnit}>{unit}</Text>
    </View>
  );
}

// ─── WarmupStepRow ────────────────────────────────────────────────────────────

function WarmupStepRow({ index, step, onChange, onRemove }) {
  const styles = useThemedStyles(makeStyles);
  const [pctDraft, setPctDraft] = useState(String(step.pct));
  const [repsDraft, setRepsDraft] = useState(String(step.reps));
  useEffect(() => { setPctDraft(String(step.pct)); }, [step.pct]);
  useEffect(() => { setRepsDraft(String(step.reps)); }, [step.reps]);

  function commitPct() {
    const n = parseInt(pctDraft, 10);
    const c = isNaN(n) ? step.pct : Math.min(100, Math.max(1, n));
    setPctDraft(String(c));
    onChange({ ...step, pct: c });
  }
  function commitReps() {
    const n = parseInt(repsDraft, 10);
    const c = isNaN(n) ? step.reps : Math.min(50, Math.max(1, n));
    setRepsDraft(String(c));
    onChange({ ...step, reps: c });
  }

  return (
    <View style={styles.warmupStepRow}>
      <Text style={styles.warmupStepIdx}>{`C${index + 1}`}</Text>
      <TextInput
        style={styles.warmupStepInput}
        keyboardType="numeric"
        value={pctDraft}
        onChangeText={(v) => setPctDraft(v.replace(/[^0-9]/g, ''))}
        onBlur={commitPct}
        selectTextOnFocus
      />
      <Text style={styles.warmupStepUnit}>%</Text>
      <Text style={styles.warmupStepUnit}>×</Text>
      <TextInput
        style={styles.warmupStepInput}
        keyboardType="numeric"
        value={repsDraft}
        onChangeText={(v) => setRepsDraft(v.replace(/[^0-9]/g, ''))}
        onBlur={commitReps}
        selectTextOnFocus
      />
      <TouchableOpacity style={styles.warmupStepRemove} onPress={onRemove} hitSlop={8}>
        <Text style={styles.warmupStepRemoveTxt}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── ExerciseEditorInline ─────────────────────────────────────────────────────

// Editor state derived from an exConfig — used at mount and to re-sync after
// joining a link group (which may adopt the group's config).
function computeInitial(exConfig, def) {
  const initProg = resolveProgressionConfig(exConfig, def);

  const initInputType = exConfig.inputType ?? (
    (exConfig.progressionModel ?? def?.progressionModel) === 'time_progression' ? 'time' : 'weight_reps'
  );
  const initMetric = initInputType === 'time' || initInputType === 'weight_time' ? 'time' : 'reps';

  // Progression mode: 'auto' (engine suggests), 'fixed' (target, no suggestions),
  // 'submax' (no target, log only). Stored 'none' type splits into fixed/submax
  // by the persisted progressionModel ('submax' marks true submax).
  const storedModel = exConfig.progressionModel ?? def?.progressionModel;
  const initMode = initProg.type === 'none'
    ? (storedModel === 'submax' ? 'submax' : 'fixed')
    : 'auto';
  const initType = initProg.type === 'none' ? 'double' : initProg.type;

  const w = exConfig.warmup ?? null;

  return {
    sets:           exConfig.sets         ?? 3,
    restSec:        exConfig.restSec      ?? 90,
    minReps:        exConfig.minReps      ?? def?.minReps ?? 8,
    maxReps:        exConfig.maxReps      ?? def?.maxReps ?? 12,
    minTime:        exConfig.minTime      ?? def?.minTime ?? 20,
    maxTime:        exConfig.maxTime      ?? def?.maxTime ?? 40,
    metric:         initMetric,
    isUnilateral:   exConfig.isUnilateral ?? def?.isUnilateral ?? false,
    tempo:          exConfig.tempo        ?? '',
    trainerNote:    exConfig.trainerNote  ?? '',
    trackRpe:       exConfig.trackRpe     ?? false,
    evalMaxRpe:     initProg.evaluation.maxRpe ?? 8,
    progMode:       initMode,
    progType:       initType,
    evalMode:       initProg.evaluation.mode,
    evalPct:        Math.round((initProg.evaluation.pctThreshold ?? 0.8) * 100),
    incrType:       initProg.increment.type === 'stepped' ? 'fixed' : initProg.increment.type,
    incrFixedValue: initProg.increment.value        ?? 2.5,
    incrPctValue:   initProg.increment.pct          ?? 5,
    incrMin:        initProg.increment.minIncrement ?? 0,
    dropset:        exConfig.dropset ?? false,
    supersetWithNext: exConfig.supersetWithNext ?? false,
    warmupMode:        w ? w.mode : 'none',
    warmupSets:        w?.mode === 'auto' ? w.sets : 2,
    warmupCustomSteps: w?.mode === 'custom' ? w.steps : [{ pct: 50, reps: 8 }],
    warmupRestSec:     w?.restSec ?? 60,
  };
}

export default function ExerciseEditorInline({
  templateId, exConfig, def, hasNextExercise, onSubstitute, onDelete,
}) {
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { t }                  = useTranslation();
  const { label: weightLabel } = useWeightUnit();
  const updateExerciseParams   = useStore((s) => s.updateExerciseParams);
  const setExerciseLinkGroup   = useStore((s) => s.setExerciseLinkGroup);
  const programs               = useStore((s) => s.programs);
  const sessionTemplatesAll    = useStore((s) => s.sessionTemplates);
  const userProgramsAll        = useStore((s) => s.userPrograms);

  const initialRef = useRef(computeInitial(exConfig, def));

  const i = initialRef.current;

  const [sets,           setSets]           = useState(i.sets);
  const [restSec,        setRestSec]        = useState(i.restSec);
  const [minReps,        setMinReps]        = useState(i.minReps);
  const [maxReps,        setMaxReps]        = useState(i.maxReps);
  const [minTime,        setMinTime]        = useState(i.minTime);
  const [maxTime,        setMaxTime]        = useState(i.maxTime);
  const [metric,         setMetric]         = useState(i.metric);
  const [isUnilateral,   setIsUnilateral]   = useState(i.isUnilateral);
  const [tempo,          setTempo]          = useState(i.tempo);
  const [trainerNote,    setTrainerNote]    = useState(i.trainerNote);
  const [trackRpe,       setTrackRpe]       = useState(i.trackRpe);
  const [evalMaxRpe,     setEvalMaxRpe]     = useState(i.evalMaxRpe);
  const [progMode,       setProgMode]       = useState(i.progMode);
  const [progType,       setProgType]       = useState(i.progType);
  const [evalMode,       setEvalMode]       = useState(i.evalMode);
  const [evalPct,        setEvalPct]        = useState(i.evalPct);
  const [incrType,       setIncrType]       = useState(i.incrType);
  const [incrFixedValue, setIncrFixedValue] = useState(i.incrFixedValue);
  const [incrPctValue,   setIncrPctValue]   = useState(i.incrPctValue);
  const [incrMin,        setIncrMin]        = useState(i.incrMin);
  const [dropset,        setDropset]        = useState(i.dropset);
  const [supersetWithNext, setSupersetWithNext] = useState(i.supersetWithNext);
  const [warmupMode,        setWarmupMode]        = useState(i.warmupMode);
  const [warmupSets,        setWarmupSets]        = useState(i.warmupSets);
  const [warmupCustomSteps, setWarmupCustomSteps] = useState(i.warmupCustomSteps);
  const [warmupRestSec,     setWarmupRestSec]     = useState(i.warmupRestSec);
  const [sheetOpen,       setSheetOpen]       = useState(false);
  const [warmupSheetOpen, setWarmupSheetOpen] = useState(false);
  const [tempoSheetOpen,  setTempoSheetOpen]  = useState(false);

  const stateRef  = useRef(null);
  const dirtyRef  = useRef(false);
  const timerRef  = useRef(null);
  const updateRef = useRef(updateExerciseParams);
  useEffect(() => { updateRef.current = updateExerciseParams; }, [updateExerciseParams]);

  stateRef.current = {
    sets, restSec, minReps, maxReps, minTime, maxTime, metric, isUnilateral, tempo, trainerNote,
    trackRpe, evalMaxRpe,
    progMode, progType, evalMode, evalPct, incrType, incrFixedValue, incrPctValue, incrMin,
    dropset, supersetWithNext,
    warmupMode, warmupSets, warmupCustomSteps, warmupRestSec,
  };

  const commitValues = useCallback((s) => {
    const isTimeMode = s.metric === 'time';
    const inputType  = s.metric === 'time' ? 'weight_time' : 'weight_reps';
    const effType    = s.progMode === 'auto' ? s.progType : 'none';
    const warmup = s.warmupMode === 'auto'
      ? { mode: 'auto', sets: s.warmupSets, restSec: s.warmupRestSec }
      : s.warmupMode === 'custom'
        ? { mode: 'custom', steps: s.warmupCustomSteps, restSec: s.warmupRestSec }
        : null;

    const updates = {
      sets: s.sets, restSec: s.restSec, inputType,
      isUnilateral: s.isUnilateral,
      tempo:        s.tempo.trim() || null,
      trainerNote:  s.trainerNote.trim() || null,
      trackRpe:     s.trackRpe,
      dropset:      s.dropset || null,
      supersetWithNext: s.supersetWithNext || null,
      warmup,
      // 'fixed' keeps double_progression so the target range still renders in
      // the workout; 'submax' is the marker that distinguishes the two modes.
      progressionModel: s.progMode === 'auto'
        ? (LEGACY_TYPE_MAP[s.progType] ?? 'double_progression')
        : s.progMode === 'submax' ? 'submax' : 'double_progression',
      progression: {
        type:      effType,
        direction: 'increase',
        evaluation: {
          // RPE mode only makes sense when RPE is being recorded
          mode:         s.evalMode === 'rpe' && !s.trackRpe ? 'all_complete' : s.evalMode,
          pctThreshold: s.evalPct / 100,
          maxRpe:       s.evalMaxRpe,
          minRir:       2,
        },
        increment: {
          type:         s.incrType,
          value:        s.incrFixedValue,
          pct:          s.incrPctValue,
          steps:        [],
          minIncrement: s.incrMin > 0 ? s.incrMin : null,
        },
        seed: { weight: null, reps: null, time: null },
      },
    };

    if (isTimeMode) {
      updates.minTime = s.minTime; updates.maxTime = s.maxTime;
      updates.minReps = null;      updates.maxReps = null;
    } else if (s.progMode !== 'submax') {
      updates.minReps = s.minReps; updates.maxReps = s.maxReps;
    }

    updateRef.current(templateId, exConfig.exerciseId, updates);
  }, [templateId, exConfig.exerciseId]);

  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    dirtyRef.current = true;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => { commitValues(stateRef.current); }, 400);
    return () => clearTimeout(timerRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sets, restSec, minReps, maxReps, minTime, maxTime, metric, isUnilateral, tempo, trainerNote,
      trackRpe, evalMaxRpe,
      progMode, progType, evalMode, evalPct, incrType, incrFixedValue, incrPctValue, incrMin, dropset,
      supersetWithNext, warmupMode, warmupSets, warmupCustomSteps, warmupRestSec]);

  useEffect(() => {
    return () => {
      if (dirtyRef.current) { clearTimeout(timerRef.current); commitValues(stateRef.current); }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Cross-session linking ───────────────────────────────────────────────────
  const getTpl       = (tid) => userProgramsAll[tid] ?? sessionTemplatesAll[tid];
  const ownerProgram = programs[getTpl(templateId)?.programId];
  const linkGroups   = exerciseLinkGroups(ownerProgram, exConfig.exerciseId, getTpl);
  const showLinking  = exerciseInstanceCount(ownerProgram, exConfig.exerciseId, getTpl) > 1;
  const currentGroup = exConfig.linkGroup ?? null;

  function applyValues(v) {
    setSets(v.sets);           setRestSec(v.restSec);
    setMinReps(v.minReps);     setMaxReps(v.maxReps);
    setMinTime(v.minTime);     setMaxTime(v.maxTime);
    setMetric(v.metric);       setIsUnilateral(v.isUnilateral); setTempo(v.tempo);
    setTrainerNote(v.trainerNote);
    setTrackRpe(v.trackRpe);   setEvalMaxRpe(v.evalMaxRpe);
    setProgMode(v.progMode);   setProgType(v.progType);
    setEvalMode(v.evalMode);   setEvalPct(v.evalPct);
    setIncrType(v.incrType);   setIncrFixedValue(v.incrFixedValue);
    setIncrPctValue(v.incrPctValue); setIncrMin(v.incrMin);
    setDropset(v.dropset);
    setSupersetWithNext(v.supersetWithNext);
    setWarmupMode(v.warmupMode);   setWarmupSets(v.warmupSets);
    setWarmupCustomSteps(v.warmupCustomSteps); setWarmupRestSec(v.warmupRestSec);
  }

  function handleLinkSelect(gid) {
    if (gid !== '__new__' && (gid ?? null) === currentGroup) return;
    // Flush pending edits first so the debounced commit can't clobber the
    // config adopted from the group.
    clearTimeout(timerRef.current);
    if (dirtyRef.current) { commitValues(stateRef.current); dirtyRef.current = false; }
    setExerciseLinkGroup(templateId, exConfig.exerciseId, gid);
    // Joining a group may adopt its config — re-sync the editor's local state.
    const fresh = useStore.getState().getEffectiveTemplate(templateId)
      ?.exercises?.find((e) => e.exerciseId === exConfig.exerciseId);
    if (fresh) applyValues(computeInitial(fresh, def));
  }

  function addWarmupStep() {
    setWarmupCustomSteps((prev) => (prev.length >= 6 ? prev : [...prev, { pct: 50, reps: 8 }]));
  }
  function updateWarmupStep(idx, next) {
    setWarmupCustomSteps((prev) => prev.map((st, i2) => (i2 === idx ? next : st)));
  }
  function removeWarmupStep(idx) {
    setWarmupCustomSteps((prev) => prev.filter((_, i2) => i2 !== idx));
  }
  const warmupRampHint = warmupSteps({ mode: 'auto', sets: warmupSets })
    .map((st) => t('exerciseEditor.warmup.rampStep', { pct: st.pct, reps: st.reps }))
    .join(' · ');

  const isTime        = metric === 'time';
  const showRepsRange = !isTime && progMode !== 'submax';
  const showTimeRange = isTime;
  const showRepsIncr  = progType === 'reps';
  const showTimeIncr  = progType === 'time';

  const PROG_MODES = ['auto', 'fixed', 'submax'].map((id) => ({
    id, label: t(`exerciseEditor.progModes.${id}`),
  }));
  const PROG_TYPES = ['double', 'weight', 'reps', 'time'].map((id) => ({
    id, label: t(`exerciseEditor.progTypes.${id}`),
  }));
  const EVAL_MODES = [
    { id: 'all_complete', label: t('exerciseEditor.evalModes.all_complete') },
    { id: 'pct',          label: t('exerciseEditor.evalModes.pct')          },
    // RPE evaluation only offered when the exercise records RPE
    ...(trackRpe ? [{ id: 'rpe', label: t('exerciseEditor.evalModes.rpe') }] : []),
  ];
  const INCR_TYPES = [
    { id: 'fixed', label: t('exerciseEditor.incrTypes.fixed') },
    { id: 'pct',   label: t('exerciseEditor.incrTypes.pct')   },
  ];

  // ── Live summary ────────────────────────────────────────────────────────────
  const effEvalMode = evalMode === 'rpe' && !trackRpe ? 'all_complete' : evalMode;
  const rangeTxt = isTime
    ? `${minTime === maxTime ? minTime : `${minTime}–${maxTime}`} s`
    : progMode === 'submax'
      ? t('workout.submax', 'submáx')
      : `${minReps === maxReps ? minReps : `${minReps}–${maxReps}`} reps`;
  const volumeLine = `${sets} × ${rangeTxt} · ${restSec} s`
    + (dropset ? ` · ${t('exerciseEditor.dropsetSummary')}` : '');

  const incTxt = progType === 'reps'
    ? String(incrFixedValue)
    : incrType === 'pct'
      ? `${incrPctValue} %`
      : `${incrFixedValue} ${showTimeIncr ? 's' : weightLabel}`;
  const progLine = progMode === 'auto'
    ? t(`exerciseEditor.summaryProg.${progType}`, {
        inc:  incTxt,
        eval: t(`exerciseEditor.summaryEval.${effEvalMode}`, { pct: evalPct, rpe: evalMaxRpe }),
        max:  isTime ? maxTime : maxReps,
      })
    : t(`exerciseEditor.summaryProg.${progMode}`);

  // Subtítulo de la fila de progresión — el mismo formato que dibuja Figma
  // ("Doble · todas las series · +2.5 kg").
  const progRowSub = progMode === 'auto'
    ? [
        t(`exerciseEditor.progTypes.${progType}`),
        t(`exerciseEditor.summaryEval.${effEvalMode}`, { pct: evalPct, rpe: evalMaxRpe }),
        `+${incTxt}`,
      ].join(' · ')
    : t(`exerciseEditor.progModeDesc.${progMode}`);

  const warmupRestTxt = warmupRestSec > 0
    ? t('exerciseEditor.warmup.restShort', { s: warmupRestSec })
    : t('exerciseEditor.warmup.noTimer');
  const warmupRowSub = warmupMode === 'none'
    ? t('exerciseEditor.warmup.rowNoneSub')
    : warmupMode === 'auto'
      ? t('exerciseEditor.warmup.rowAutoSub',   { sets: warmupSets, rest: warmupRestTxt })
      : t('exerciseEditor.warmup.rowCustomSub', { n: warmupCustomSteps.length, rest: warmupRestTxt });

  return (
    <View style={styles.container}>

      {/* ══ RESUMEN (Exercice editor elements / Resumen, 166:1245) ═══════════ */}
      <View style={styles.summaryCard}>
        <Text style={styles.summaryTag}>{t('exerciseEditor.summaryTitle')}</Text>
        <Text style={styles.summaryMain}>{volumeLine}</Text>
        <Text style={styles.summarySub}>{progLine}</Text>
      </View>

      {/* ══ VOLUMEN ══════════════════════════════════════════════════════════ */}
      <View style={styles.block}>
        <Text style={styles.secLabel}>{t('exerciseEditor.sectionVolume').toUpperCase()}</Text>
        <SegmentedControl
          options={[
            { id: 'reps', label: t('exerciseEditor.metricReps').toUpperCase() },
            { id: 'time', label: t('exerciseEditor.metricTime').toUpperCase() },
          ]}
          value={metric}
          onChange={setMetric}
        />

        <View style={styles.grid}>
          <View style={styles.gridRow}>
            <StepField label={t('exerciseEditor.fieldSets')} value={sets}    onChange={setSets}    min={1}  max={8}   />
            <StepField label={t('exerciseEditor.fieldRest')} value={restSec} onChange={setRestSec} min={30} max={300} unit="s" />
          </View>

          {showTimeRange ? (
            <View style={styles.gridRow}>
              <StepField label={t('exerciseEditor.fieldMinTime')} value={minTime} onChange={setMinTime} min={5} max={300} unit="s" />
              <StepField label={t('exerciseEditor.fieldMaxTime')} value={maxTime} onChange={setMaxTime} min={5} max={300} unit="s" />
            </View>
          ) : showRepsRange ? (
            <View style={styles.gridRow}>
              <StepField label={t('exerciseEditor.fieldMinReps')} value={minReps} onChange={setMinReps} min={1} max={50} />
              <StepField label={t('exerciseEditor.fieldMaxReps')} value={maxReps} onChange={setMaxReps} min={1} max={50} />
            </View>
          ) : (
            <Text style={styles.hint}>{t('exerciseEditor.submaxHint')}</Text>
          )}
        </View>
      </View>

      {/* ══ CALENTAMIENTO (no está en Figma — fila + hoja) ═══════════════════ */}
      <View style={styles.block}>
        <Text style={styles.secLabel}>{t('exerciseEditor.warmup.title').toUpperCase()}</Text>
        <NavRow
          title={t(`exerciseEditor.warmup.${warmupMode}`)}
          subtitle={warmupRowSub}
          onPress={() => setWarmupSheetOpen(true)}
        />
      </View>

      {/* ══ PROGRESIÓN (142:1157) ════════════════════════════════════════════ */}
      <View style={styles.block}>
        <Text style={styles.secLabel}>{t('exerciseEditor.sectionProgression').toUpperCase()}</Text>
        <NavRow
          icon={<ProgressionIcon size={15} color={th.colors.accent} />}
          title={t(`exerciseEditor.progModes.${progMode}`)}
          subtitle={progRowSub}
          onPress={() => setSheetOpen(true)}
        />
      </View>

      {/* ══ OPCIONES (Option blocks, 176:1902 + 176:1952) ════════════════════ */}
      <Text style={styles.secLabel}>{t('exerciseEditor.sectionOptions').toUpperCase()}</Text>

      <View style={styles.optGroup}>
        <ToggleRow
          label={t('exerciseEditor.unilateralLabel')}
          value={isUnilateral}
          onChange={setIsUnilateral}
        />
        <ToggleRow
          label={t('exerciseEditor.trackRpeLabel')}
          value={trackRpe}
          onChange={(v) => {
            setTrackRpe(v);
            if (!v && evalMode === 'rpe') setEvalMode('all_complete');
          }}
        />
        {!isTime && (
          <ToggleRow
            label={t('exerciseEditor.dropsetLabel')}
            hint={t('exerciseEditor.dropsetHint')}
            value={dropset}
            onChange={setDropset}
          />
        )}
        {hasNextExercise && (
          <ToggleRow
            label={t('exerciseEditor.supersetLabel')}
            hint={t('exerciseEditor.supersetHint')}
            value={supersetWithNext}
            onChange={setSupersetWithNext}
          />
        )}
        <OptionRow
          label={t('exerciseEditor.tempoLabel')}
          onPress={() => setTempoSheetOpen(true)}
          right={(
            <View style={styles.tempoValueRow}>
              <Text style={styles.tempoValue}>{tempo || '—'}</Text>
              <ArrowIcon size={9.23} color={CHEVRON_GREY} />
            </View>
          )}
        />
        <View style={styles.noteRow}>
          <Text style={styles.optRowLabel}>{t('exerciseEditor.trainerNoteLabel')}</Text>
          <TextInput
            style={styles.noteInput}
            value={trainerNote}
            onChangeText={setTrainerNote}
            placeholder={t('exerciseEditor.trainerNotePlaceholder')}
            placeholderTextColor={th.colors.mutedLight}
            multiline
            maxLength={280}
          />
          <Text style={styles.optRowHint}>{t('exerciseEditor.trainerNoteHint')}</Text>
        </View>
      </View>

      {/* Vinculación entre sesiones — solo si el ejercicio existe en más sesiones */}
      {showLinking && (
        <View style={styles.linkCard}>
          <Text style={styles.optRowLabel}>{t('exerciseEditor.linkLabel')}</Text>
          <View style={styles.linkList}>
            <TouchableOpacity
              style={[styles.linkPill, !currentGroup && styles.linkPillActive]}
              onPress={() => handleLinkSelect(null)}
              activeOpacity={0.7}
            >
              <Text style={[styles.linkPillText, !currentGroup && styles.linkPillTextActive]}>
                {t('exerciseEditor.linkNone')}
              </Text>
            </TouchableOpacity>
            {linkGroups.map((g, idx) => (
              <TouchableOpacity
                key={g.id}
                style={[styles.linkPill, currentGroup === g.id && styles.linkPillActive]}
                onPress={() => handleLinkSelect(g.id)}
                activeOpacity={0.7}
              >
                <Text style={[styles.linkPillText, currentGroup === g.id && styles.linkPillTextActive]}>
                  {t('exerciseEditor.linkGroupN', { n: idx + 1 })} · {g.sessions.join(', ')}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[styles.linkPill, styles.linkPillNew]}
              onPress={() => handleLinkSelect('__new__')}
              activeOpacity={0.7}
            >
              <Text style={styles.linkPillNewText}>{t('exerciseEditor.linkNew')}</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.optRowHint}>{t('exerciseEditor.linkHint')}</Text>
        </View>
      )}

      {/* ══ ACCIONES (no están en Figma) ═════════════════════════════════════ */}
      <View style={styles.btnRow}>
        <TouchableOpacity style={styles.substituteBtn} onPress={onSubstitute} activeOpacity={0.8}>
          <Text style={styles.substituteBtnText}>{t('exerciseEditor.substituteBtn')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.deleteBtn} onPress={onDelete} activeOpacity={0.8}>
          <Text style={styles.deleteBtnText}>{t('common.delete')}</Text>
        </TouchableOpacity>
      </View>

      {/* ══ HOJA: calentamiento ══════════════════════════════════════════════ */}
      <DragSheet
        visible={warmupSheetOpen}
        onClose={() => setWarmupSheetOpen(false)}
        title={t('exerciseEditor.warmup.title')}
      >
        <View style={styles.sheetBody}>
          <SegmentedControl
            options={['none', 'auto', 'custom'].map((id) => ({
              id, label: t(`exerciseEditor.warmup.${id}`),
            }))}
            value={warmupMode}
            onChange={setWarmupMode}
          />

          {warmupMode === 'auto' && (
            <View style={{ gap: spacing.sm }}>
              <StepField
                horizontal dark
                label={t('exerciseEditor.warmup.setsLabel')}
                value={warmupSets}
                onChange={setWarmupSets}
                min={1}
                max={4}
              />
              <Text style={styles.hint}>{warmupRampHint}</Text>
            </View>
          )}

          {warmupMode === 'custom' && (
            <View style={{ gap: spacing.sm }}>
              {warmupCustomSteps.map((step, idx) => (
                <WarmupStepRow
                  key={idx}
                  index={idx}
                  step={step}
                  onChange={(next) => updateWarmupStep(idx, next)}
                  onRemove={() => removeWarmupStep(idx)}
                />
              ))}
              <TouchableOpacity
                style={[styles.addStepBtn, warmupCustomSteps.length >= 6 && styles.addStepBtnDisabled]}
                onPress={addWarmupStep}
                disabled={warmupCustomSteps.length >= 6}
              >
                <Text style={styles.addStepText}>{t('exerciseEditor.warmup.addStep')}</Text>
              </TouchableOpacity>
            </View>
          )}

          {warmupMode !== 'none' && (
            <View style={{ gap: spacing.sm }}>
              <StepField
                horizontal dark unit="s"
                label={t('exerciseEditor.warmup.restLabel')}
                value={warmupRestSec}
                onChange={setWarmupRestSec}
                min={0}
                max={180}
              />
              {warmupRestSec === 0 && (
                <Text style={styles.hint}>{t('exerciseEditor.warmup.noTimer')}</Text>
              )}
            </View>
          )}
        </View>
      </DragSheet>

      {/* ══ HOJA: tempo ══════════════════════════════════════════════════════ */}
      <DragSheet
        visible={tempoSheetOpen}
        onClose={() => setTempoSheetOpen(false)}
        title={t('exerciseEditor.tempoLabel')}
      >
        <View style={styles.sheetBody}>
          <TextInput
            style={styles.tempoInput}
            value={tempo}
            onChangeText={(v) => setTempo(v.replace(/[^0-9Xx]/g, '').toUpperCase().slice(0, 4))}
            maxLength={4}
            placeholder="—"
            placeholderTextColor={th.colors.mutedLight}
            autoCapitalize="characters"
            returnKeyType="done"
          />
          <Text style={styles.hint}>{t('exerciseEditor.tempoHint')}</Text>
        </View>
      </DragSheet>

      {/* ══ HOJA: configuración de la progresión ═════════════════════════════ */}
      <DragSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={t('exerciseEditor.sectionProgression')}
      >
        <View style={styles.sheetBody}>

          {/* 1 · Modo */}
          <View>
            <Text style={styles.stepTitle}>
              <Text style={styles.stepNum}>1 · </Text>{t('exerciseEditor.stepMode')}
            </Text>
            <SegmentedControl options={PROG_MODES} value={progMode} onChange={setProgMode} />
            <Text style={styles.hint}>{t(`exerciseEditor.progModeDesc.${progMode}`)}</Text>
          </View>

          {progMode === 'auto' && (
            <>
              {/* 2 · Qué progresa */}
              <View>
                <Text style={styles.stepTitle}>
                  <Text style={styles.stepNum}>2 · </Text>{t('exerciseEditor.stepType')}
                </Text>
                <SegmentedControl options={PROG_TYPES} value={progType} onChange={setProgType} />
                <Text style={styles.hint}>{t(`exerciseEditor.progTypeDesc.${progType}`)}</Text>
              </View>

              {/* 3 · Cuándo se cumple */}
              <View>
                <Text style={styles.stepTitle}>
                  <Text style={styles.stepNum}>3 · </Text>{t('exerciseEditor.stepEval')}
                </Text>
                <SegmentedControl options={EVAL_MODES} value={effEvalMode} onChange={setEvalMode} />
                <Text style={styles.hint}>{t(`exerciseEditor.evalModeDesc.${effEvalMode}`)}</Text>
                {evalMode === 'pct' && (
                  <View style={{ marginTop: spacing.md }}>
                    <StepField
                      horizontal dark unit="%"
                      label={t('exerciseEditor.evalPctLabel')}
                      value={evalPct}
                      onChange={setEvalPct}
                      min={50}
                      max={100}
                    />
                  </View>
                )}
                {evalMode === 'rpe' && trackRpe && (
                  <View style={{ marginTop: spacing.md }}>
                    <StepField
                      horizontal dark
                      label={t('exerciseEditor.maxRpeLabel')}
                      value={evalMaxRpe}
                      onChange={setEvalMaxRpe}
                      min={6}
                      max={10}
                    />
                  </View>
                )}
              </View>

              {/* 4 · Cuánto sube */}
              <View>
                <Text style={styles.stepTitle}>
                  <Text style={styles.stepNum}>4 · </Text>{t('exerciseEditor.stepIncr')}
                </Text>
                {showRepsIncr ? (
                  <StepField
                    horizontal dark
                    label={t('exerciseEditor.incrFixedRepsLabel')}
                    value={incrFixedValue}
                    onChange={setIncrFixedValue}
                    min={1}
                    max={10}
                  />
                ) : (
                  <>
                    <SegmentedControl options={INCR_TYPES} value={incrType} onChange={setIncrType} />
                    <Text style={styles.hint}>{t(`exerciseEditor.incrTypeDesc.${incrType}`)}</Text>
                    <View style={{ marginTop: spacing.md }}>
                      {incrType === 'pct' ? (
                        <StepField
                          horizontal dark unit="%"
                          label={t('exerciseEditor.incrValueLabel')}
                          value={incrPctValue}
                          onChange={setIncrPctValue}
                          min={1}
                          max={50}
                        />
                      ) : (
                        // Paso 0.25: la placa más pequeña habitual es de 1.25 kg
                        // por lado, así que las subidas útiles son múltiplos de
                        // 0.25 y no de 1.
                        <StepField
                          horizontal dark
                          label={t('exerciseEditor.incrValueLabel')}
                          unit={showTimeIncr ? 's' : weightLabel}
                          value={incrFixedValue}
                          onChange={setIncrFixedValue}
                          min={0}
                          max={50}
                          step={0.25}
                        />
                      )}
                    </View>
                    {incrType === 'pct' && (
                      <View style={styles.incrMinRow}>
                        <View style={styles.incrMinMeta}>
                          <Text style={styles.optRowLabel}>{t('exerciseEditor.incrMinLabel')}</Text>
                          <Text style={styles.optRowHint}>{t('exerciseEditor.incrMinHint')}</Text>
                        </View>
                        <IncrementInput
                          value={incrMin}
                          onChange={setIncrMin}
                          unit={showTimeIncr ? 's' : weightLabel}
                        />
                      </View>
                    )}
                  </>
                )}
              </View>
            </>
          )}

          {/* Resultado en lenguaje natural */}
          <View style={styles.summaryCard}>
            <Text style={styles.summarySub}>{progLine}</Text>
          </View>

        </View>
      </DragSheet>

    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const makeStyles = (th) => StyleSheet.create({

  // Frame raíz (123:1511): padding `space/lg`, gap `space/md`. El padding
  // superior lo pone la cabecera del modal, que vive en SessionEditorScreen.
  container: {
    paddingHorizontal: spacing.lg,
    paddingBottom:     spacing.xxl + spacing.lg,
    gap:               spacing.md,
  },

  // Cada "Bloque" del mock: etiqueta de sección + su contenido, gap `space/md`.
  block: { gap: spacing.md },

  // ── Resumen (166:1245) — solo relleno tint/accent-10, sin borde ────────────
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

  // ── Etiquetas de sección (123:1635) ───────────────────────────────────────
  secLabel: {
    ...textStyles.spacingTag,
    color:      th.colors.mutedLight,
    paddingTop: spacing.md,
  },

  // ── Grid 2×2 de cajas ─────────────────────────────────────────────────────
  grid:    { gap: spacing.md },
  gridRow: { flexDirection: 'row', gap: spacing.md },

  hint: { ...textStyles.tag, color: th.colors.mutedLight, lineHeight: 14 },

  // ── Fila navegable (Progresion, 163:1212) ─────────────────────────────────
  navRow: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             spacing.md,
    backgroundColor: th.colors.surface,
    borderRadius:    th.radius.sm,
    padding:         spacing.md,
  },
  navRowMeta:  { flex: 1, minWidth: 0, gap: spacing.xs },
  navRowTitle: { ...textStyles.cardType, color: th.colors.text },
  navRowSub:   { ...textStyles.tag,      color: th.colors.mutedLight },

  // ── Lista agrupada de opciones (176:1902) ─────────────────────────────────
  // El contenedor recorta: por eso las filas solo llevan `radius/xxs` y las
  // esquinas exteriores salen del clip, igual que en Figma.
  optGroup: {
    borderRadius: th.radius.md,
    overflow:     'hidden',
    gap:          spacing.xs,
  },
  optRow: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    gap:               spacing.md,
    minHeight:         OPT_ROW_H,
    backgroundColor:   th.colors.surface,
    borderRadius:      th.radius.xxs ?? 2,
    paddingHorizontal: spacing.lg,
    paddingVertical:   spacing.sm,
  },
  optRowMeta:  { flex: 1, minWidth: 0, gap: spacing.xs },
  optRowLabel: { ...textStyles.cardType, color: th.colors.text },
  optRowHint:  { ...textStyles.tag, color: th.colors.mutedLight, lineHeight: 14 },

  tempoValueRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  tempoValue:    { ...textStyles.cardType, color: th.colors.mutedLight, letterSpacing: 2 },

  // Última fila del grupo: la nota, con su textarea sobre `color/workout-card`.
  noteRow: {
    backgroundColor:   th.colors.surface,
    borderRadius:      th.radius.xxs ?? 2,
    paddingHorizontal: spacing.lg,
    paddingVertical:   spacing.sm,
    gap:               spacing.xs,
  },
  noteInput: {
    height:            42,
    backgroundColor:   th.colors.bg,
    borderRadius:      th.radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical:   spacing.sm,
    ...textStyles.tag,
    color:             th.colors.text,
    textAlignVertical: 'top',
  },

  // ── Vinculación (Option blocks / Vinculacion, 176:1952) ───────────────────
  linkCard: {
    backgroundColor:   th.colors.surface,
    borderRadius:      th.radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical:   spacing.md,
    gap:               spacing.sm,
  },
  linkList: { gap: spacing.sm },
  // 9 es literal de Figma (no hay token de espaciado con ese valor).
  linkPill: {
    backgroundColor:   th.colors.surface2,
    borderRadius:      th.radius.xs,
    paddingHorizontal: 9,
    paddingVertical:   spacing.sm,
  },
  linkPillActive:     { backgroundColor: th.colors.accent },
  linkPillText:       { ...textStyles.btnAction, color: th.colors.text },
  linkPillTextActive: { color: th.colors.onAccent },
  linkPillNew:        { alignItems: 'center' },
  linkPillNewText:    { ...textStyles.subtitle, color: th.colors.mutedLight },

  // ── Acciones ──────────────────────────────────────────────────────────────
  btnRow: { flexDirection: 'row', gap: spacing.sm, paddingTop: spacing.md },
  substituteBtn: {
    flex:            1,
    alignItems:      'center',
    paddingVertical: spacing.md,
    backgroundColor: th.colors.surface2,
    borderRadius:    th.radius.sm,
  },
  substituteBtnText: { ...textStyles.cardType, color: th.colors.text },
  deleteBtn: {
    flex:            1,
    alignItems:      'center',
    paddingVertical: spacing.md,
    backgroundColor: th.tint.red30,
    borderRadius:    th.radius.sm,
  },
  deleteBtnText: { ...textStyles.cardType, color: th.tint.red50 },

  // ── Calentamiento (hoja) ──────────────────────────────────────────────────
  // Los campos son los MISMOS Input Field del grid de series del workout
  // (`workout/grid.js` + `SetRow`): misma geometría, mismo fondo y misma
  // tipografía, para que un paso de calentamiento se escriba igual en los dos
  // sitios.
  warmupStepRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  warmupStepIdx: { ...textStyles.btnAction, color: th.tint.accent50, width: GRID.LABEL_W },
  warmupStepInput: {
    flex:               1,
    height:             GRID.CELL_H,
    backgroundColor:    th.colors.bg,
    borderRadius:       GRID.RADIUS,
    fontFamily:         'Inter_800ExtraBold',
    fontSize:           15,
    fontWeight:         '800',
    color:              th.colors.text,
    textAlign:          'center',
    textAlignVertical:  'center',
    includeFontPadding: false,
    paddingVertical:    0,
    fontVariant:        ['tabular-nums'],
  },
  warmupStepUnit:      { ...textStyles.subtitle, color: th.colors.mutedLight },
  warmupStepRemove:    { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  warmupStepRemoveTxt: { ...textStyles.subtitle, color: th.colors.muted },
  addStepBtn: {
    alignItems:      'center',
    paddingVertical: spacing.md,
    borderRadius:    GRID.RADIUS,
    backgroundColor: th.colors.bg,
  },
  addStepBtnDisabled: { opacity: 0.35 },
  addStepText:        { ...textStyles.cardType, color: th.tint.accent50 },

  // ── Incremento (hoja) ─────────────────────────────────────────────────────
  incrInputRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  // Sin ± (QA): es un dato que se teclea, no que se ajusta. Va sobre
  // `color/app` para no competir con el fondo `surface` de la hoja.
  incrInput: {
    minWidth:           80,
    height:             STEP_BTN,
    backgroundColor:    th.colors.bg,
    borderRadius:       th.radius.sm,
    paddingHorizontal:  spacing.md,
    ...textStyles.cardTitle,
    color:              th.colors.text,
    textAlign:          'center',
    textAlignVertical:  'center',
    includeFontPadding: false,
    paddingVertical:    0,
  },
  incrUnit: { ...textStyles.subtitle, color: th.colors.mutedLight },
  incrMinRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    gap:            spacing.md,
    marginTop:      spacing.md,
  },
  incrMinMeta: { flex: 1, minWidth: 0, gap: spacing.xs },

  // ── Tempo (hoja) ──────────────────────────────────────────────────────────
  tempoInput: {
    alignSelf:          'center',
    minWidth:           140,
    height:             48,
    backgroundColor:    th.colors.surface,
    borderRadius:       th.radius.sm,
    ...textStyles.hero,
    letterSpacing:      6,
    color:              th.colors.text,
    textAlign:          'center',
    textAlignVertical:  'center',
    includeFontPadding: false,
    paddingVertical:    0,
  },

  // ── Cuerpo de las hojas ───────────────────────────────────────────────────
  sheetBody: { gap: spacing.lg, paddingBottom: spacing.sm },
  // Misma tipografía Y mismo tratamiento que las etiquetas de sección del
  // editor (`secLabel`): `text/spacing-tag` en mayúsculas.
  stepTitle: {
    ...textStyles.spacingTag,
    color:         th.colors.mutedLight,
    textTransform: 'uppercase',
    marginBottom:  spacing.sm,
  },
  stepNum: { color: th.colors.accent },
});
