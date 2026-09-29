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
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Text, TextInput } from '../ui/Text';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../../store/useStore';
import { resolveProgressionConfig, LEGACY_TYPE_MAP, DEFAULT_TARGET } from '../../utils/progression';
import { MAX_RELIABLE_REPS } from '../../utils/oneRm';
import { isBodyweight } from '../../utils/trainingLoad';
import { exerciseLinkGroups, exerciseInstanceCount } from '../../utils/exerciseLinks';
import { warmupSteps } from '../../utils/warmup';
import { useWeightUnit } from '../../hooks/useWeightUnit';
import { spacing, textStyles, lh, LINE } from '../../theme';
import { useTheme, useThemedStyles } from '../../useTheme';
import SegmentedControl from '../ui/SegmentedControl';
import { ArrowIcon, ProgressionIcon, VariantIcon, LockIcon } from '../ui/EditorIcons';
import VariantPicker from '../ui/VariantPicker';
import AnimatedHeight from '../ui/AnimatedHeight';
import { variantLabel, cleanVariant, variantDims } from '../../utils/variants';
import { decompose, compose, canBeUnilateral } from '../../utils/exerciseIdentity';
import StepField, { STEP_BTN } from '../ui/StepField';
import { OptionRow, ToggleRow, NavRow, NoteRow, CHEVRON_GREY } from '../ui/EditorRows';
import { GRID } from '../workout/grid';
import DragSheet from '../DragSheet';

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
      <View style={styles.warmupField}>
        <TextInput
          style={styles.warmupFieldInput}
          keyboardType="numeric"
          value={pctDraft}
          onChangeText={(v) => setPctDraft(v.replace(/[^0-9]/g, ''))}
          onBlur={commitPct}
          selectTextOnFocus
        />
        <Text style={styles.warmupFieldUnit}>%</Text>
      </View>
      <Text style={styles.warmupStepUnit}>×</Text>
      <View style={styles.warmupField}>
        <TextInput
          style={styles.warmupFieldInput}
          keyboardType="numeric"
          value={repsDraft}
          onChangeText={(v) => setRepsDraft(v.replace(/[^0-9]/g, ''))}
          onBlur={commitReps}
          selectTextOnFocus
        />
      </View>
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

  // Progression mode: 'auto' (engine suggests), 'fixed' (target, no
  // suggestions) or 'effort' (reps @ RPE, weight from e1RM —
  // effort-progression.md). Lo guardado como 'submax' se lee como Fija.
  const initMode = initProg.type === 'none' ? 'fixed' : initProg.type === 'effort' ? 'effort' : 'auto';
  const initType = initProg.type === 'none' || initProg.type === 'effort' ? 'double' : initProg.type;

  const w = exConfig.warmup ?? null;

  return {
    sets:           exConfig.sets         ?? 3,
    restSec:        exConfig.restSec      ?? 90,
    minReps:        exConfig.minReps      ?? def?.minReps ?? DEFAULT_TARGET.minReps,
    maxReps:        exConfig.maxReps      ?? def?.maxReps ?? DEFAULT_TARGET.maxReps,
    minTime:        exConfig.minTime      ?? def?.minTime ?? DEFAULT_TARGET.minTime,
    maxTime:        exConfig.maxTime      ?? def?.maxTime ?? DEFAULT_TARGET.maxTime,
    metric:         initMetric,
    isKey:          exConfig.isKey        ?? false,
    variant:        exConfig.variant      ?? null,
    tempo:          exConfig.tempo        ?? '',
    trainerNote:    exConfig.trainerNote  ?? '',
    trackRpe:       exConfig.trackRpe     ?? false,
    evalMaxRpe:     initProg.evaluation.maxRpe ?? 8,
    targetRpe:      initProg.targetRpe,
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
  templateId, exConfig, def, hasNextExercise, onSubstitute, onDelete, onIdentityChange,
}) {
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { t }                  = useTranslation();
  const { label: weightLabel } = useWeightUnit();
  const updateExerciseParams   = useStore((s) => s.updateExerciseParams);
  const setExerciseLinkGroup   = useStore((s) => s.setExerciseLinkGroup);
  const programs               = useStore((s) => s.programs);
  const sessionTemplatesAll    = useStore((s) => s.sessionTemplates);
  const exerciseLibrary        = useStore((s) => s.exerciseLibrary);
  const customExercises        = useStore((s) => s.customExercises);
  const identityCheck          = useStore((s) => s.identityCheck);
  const changeExerciseIdentity = useStore((s) => s.changeExerciseIdentity);
  const showToast              = useStore((s) => s.showToast);
  const lib = useMemo(() => ({ ...exerciseLibrary, ...customExercises }), [exerciseLibrary, customExercises]);

  const initialRef = useRef(computeInitial(exConfig, def));

  const i = initialRef.current;

  const [sets,           setSets]           = useState(i.sets);
  const [restSec,        setRestSec]        = useState(i.restSec);
  const [minReps,        setMinReps]        = useState(i.minReps);
  const [maxReps,        setMaxReps]        = useState(i.maxReps);
  const [minTime,        setMinTime]        = useState(i.minTime);
  const [maxTime,        setMaxTime]        = useState(i.maxTime);
  const [metric,         setMetric]         = useState(i.metric);
  const [isKey,          setIsKey]          = useState(i.isKey);
  const [variant,        setVariant]        = useState(i.variant);
  const [tempo,          setTempo]          = useState(i.tempo);
  const [trainerNote,    setTrainerNote]    = useState(i.trainerNote);
  const [trackRpe,       setTrackRpe]       = useState(i.trackRpe);
  const [evalMaxRpe,     setEvalMaxRpe]     = useState(i.evalMaxRpe);
  const [targetRpe,      setTargetRpe]      = useState(i.targetRpe);
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
  const [variantSheetOpen, setVariantSheetOpen] = useState(false);

  const stateRef  = useRef(null);
  const dirtyRef  = useRef(false);
  const timerRef  = useRef(null);
  const updateRef = useRef(updateExerciseParams);
  useEffect(() => { updateRef.current = updateExerciseParams; }, [updateExerciseParams]);

  stateRef.current = {
    sets, restSec, minReps, maxReps, minTime, maxTime, metric, isKey, variant, tempo, trainerNote,
    trackRpe, evalMaxRpe, targetRpe,
    progMode, progType, evalMode, evalPct, incrType, incrFixedValue, incrPctValue, incrMin,
    dropset, supersetWithNext,
    warmupMode, warmupSets, warmupCustomSteps, warmupRestSec,
  };

  const commitValues = useCallback((s) => {
    const isTimeMode = s.metric === 'time';
    const inputType  = s.metric === 'time' ? 'weight_time' : 'weight_reps';
    const effType    = s.progMode === 'auto' ? s.progType : s.progMode === 'effort' ? 'effort' : 'none';
    const warmup = s.warmupMode === 'auto'
      ? { mode: 'auto', sets: s.warmupSets, restSec: s.warmupRestSec }
      : s.warmupMode === 'custom'
        ? { mode: 'custom', steps: s.warmupCustomSteps, restSec: s.warmupRestSec }
        : null;

    const updates = {
      sets: s.sets, restSec: s.restSec, inputType,
      isKey:        s.isKey,
      // Solo informa (exercise-variants.md §2.3); vacía se guarda null. Un
      // ejercicio aparte conserva su variante fija: es lo que permite deshacerlo.
      variant:      def?.derived?.variant ?? cleanVariant(s.variant, def) ?? null,
      tempo:        s.tempo.trim() || null,
      trainerNote:  s.trainerNote.trim() || null,
      // Por esfuerzo no funciona sin RPE: se guarda encendido (§4.3).
      trackRpe:     s.progMode === 'effort' ? true : s.trackRpe,
      dropset:      s.dropset || null,
      supersetWithNext: s.supersetWithNext || null,
      warmup,
      // 'fixed' keeps double_progression so the target range still renders in
      // the workout; progression.type 'none' is what makes it fixed.
      progressionModel: s.progMode === 'auto'
        ? (LEGACY_TYPE_MAP[s.progType] ?? 'double_progression')
        : 'double_progression',
      progression: {
        type:      effType,
        direction: 'increase',
        ...(s.progMode === 'effort' ? { targetRpe: s.targetRpe } : {}),
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
    } else if (s.progMode === 'effort') {
      // Reps objetivo, no rango: se guarda min = max (§1.2.4).
      updates.minReps = s.minReps; updates.maxReps = s.minReps;
    } else {
      updates.minReps = s.minReps; updates.maxReps = s.maxReps;
    }

    updateRef.current(templateId, exConfig.exerciseId, updates);
  }, [templateId, exConfig.exerciseId, def]);

  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    dirtyRef.current = true;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => { commitValues(stateRef.current); }, 400);
    return () => clearTimeout(timerRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sets, restSec, minReps, maxReps, minTime, maxTime, metric, isKey, variant, tempo, trainerNote,
      trackRpe, evalMaxRpe, targetRpe,
      progMode, progType, evalMode, evalPct, incrType, incrFixedValue, incrPctValue, incrMin, dropset,
      supersetWithNext, warmupMode, warmupSets, warmupCustomSteps, warmupRestSec]);

  useEffect(() => {
    return () => {
      if (dirtyRef.current) { clearTimeout(timerRef.current); commitValues(stateRef.current); }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Cross-session linking ───────────────────────────────────────────────────
  const getTpl       = (tid) => sessionTemplatesAll[tid];
  const ownerProgram = programs[getTpl(templateId)?.programId];
  const linkGroups   = exerciseLinkGroups(ownerProgram, exConfig.exerciseId, getTpl);
  const showLinking  = exerciseInstanceCount(ownerProgram, exConfig.exerciseId, getTpl) > 1;
  const currentGroup = exConfig.linkGroup ?? null;

  function applyValues(v) {
    setSets(v.sets);           setRestSec(v.restSec);
    setMinReps(v.minReps);     setMaxReps(v.maxReps);
    setMinTime(v.minTime);     setMaxTime(v.maxTime);
    setMetric(v.metric);       setTempo(v.tempo);
    setVariant(v.variant);
    setIsKey(v.isKey);
    setTrainerNote(v.trainerNote);
    setTrackRpe(v.trackRpe);   setEvalMaxRpe(v.evalMaxRpe);
    setTargetRpe(v.targetRpe);
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
  const showTimeRange = isTime;
  const showRepsIncr  = progType === 'reps';
  const showTimeIncr  = progType === 'time';

  // Por esfuerzo: solo con carga externa, en reps y sin asistencia (§2.4).
  const canEffort = !isTime && !isBodyweight(def)
    && (def?.progressionDirection ?? 'increase') !== 'decrease';
  const isEffort  = progMode === 'effort';
  const effortRir = 10 - targetRpe;
  const effortRirTxt = effortRir === 0
    ? t('exerciseEditor.effortFailure')
    : t('exerciseEditor.effortRir', { count: effortRir });
  // Misma regla que el motor: pasado MAX_RELIABLE_REPS no calcula (§2.3).
  const effortUnreliable = isEffort && minReps + effortRir >= MAX_RELIABLE_REPS;
  const effortWarn = effortUnreliable ? (
    <Text style={styles.warnHint}>{t('exerciseEditor.effortUnreliable', { max: MAX_RELIABLE_REPS })}</Text>
  ) : null;

  function selectProgMode(mode) {
    if (mode === 'effort') { setMaxReps(minReps); setTrackRpe(true); }
    setProgMode(mode);
  }
  function selectMetric(m) {
    if (m === 'time' && progMode === 'effort') setProgMode('auto');
    setMetric(m);
  }

  const PROG_MODES = ['auto', 'fixed', ...(canEffort || isEffort ? ['effort'] : [])].map((id) => ({
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
    : isEffort
      ? t('exerciseEditor.effortVolume', { reps: minReps, rpe: targetRpe })
      : `${minReps === maxReps ? minReps : `${minReps}–${maxReps}`} reps`;
  // El calentamiento abre la prescripción, así que va delante: "C×2 · 3 × 8–12…".
  const warmupCount = warmupMode === 'auto'
    ? warmupSets
    : warmupMode === 'custom' ? warmupCustomSteps.length : 0;
  const volumeLine = [
    warmupCount > 0 ? t('exerciseEditor.warmup.summaryCount', { n: warmupCount }) : null,
    `${sets} × ${rangeTxt}`,
    t('exerciseEditor.restSummary', { s: restSec }),
    dropset ? t('exerciseEditor.dropsetSummary') : null,
  ].filter(Boolean).join(' · ');

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
    : t(`exerciseEditor.summaryProg.${progMode}`, { rpe: targetRpe });

  // Subtítulo de la fila de progresión — el mismo formato que dibuja Figma
  // ("Doble · todas las series · +2.5 kg").
  const progRowSub = progMode === 'auto'
    ? [
        t(`exerciseEditor.progTypes.${progType}`),
        t(`exerciseEditor.summaryEval.${effEvalMode}`, { pct: evalPct, rpe: evalMaxRpe }),
        `+${incTxt}`,
      ].join(' · ')
    : isEffort
      ? `RPE ${targetRpe} · ${effortRirTxt}`
      : t(`exerciseEditor.progModeDesc.${progMode}`);

  const warmupRestTxt = warmupRestSec > 0
    ? t('exerciseEditor.warmup.restShort', { s: warmupRestSec })
    : t('exerciseEditor.warmup.noTimer');
  const warmupRowSub = warmupMode === 'none'
    ? t('exerciseEditor.warmup.rowNoneSub')
    : warmupMode === 'auto'
      ? t('exerciseEditor.warmup.rowAutoSub',   { sets: warmupSets, rest: warmupRestTxt })
      : t('exerciseEditor.warmup.rowCustomSub', { n: warmupCustomSteps.length, rest: warmupRestTxt });

  // ── Qué ejercicio es: unilateral y ejercicio aparte (exercise-variants.md §6) ─
  // Los dos interruptores cambian el ejercicio (otro historial); la variante de
  // arriba solo informa.
  const dims    = variantDims(def);
  const ident   = decompose(exConfig.exerciseId, lib);
  const rootDef = lib[ident.root];
  const apartOn = !!ident.variant;
  const showUni = !ident.natural && (ident.uni || canBeUnilateral(rootDef, lib));
  const chosen  = cleanVariant(variant, def);
  const baseOf  = (uni) => {
    const c = compose({ root: ident.root, uni, variant: null }, lib);
    return (c.def ?? lib[c.id])?.name ?? c.id;
  };
  // Encender unilateral con aparte puesto: la variante fija pierde la anchura.
  const uniVariant = ident.variant && !ident.uni
    ? (ident.variant.grip ? { grip: ident.variant.grip } : null)
    : ident.variant;
  const uniTarget   = { root: ident.root, uni: !ident.uni, variant: uniVariant };
  const apartTarget = { root: ident.root, uni: ident.uni, variant: apartOn ? null : chosen };
  const uniCheck    = showUni ? identityCheck(templateId, exConfig.exerciseId, uniTarget) : null;
  const apartCheck  = apartOn || chosen ? identityCheck(templateId, exConfig.exerciseId, apartTarget) : null;
  const showApart   = dims.length > 0 || apartOn;
  const blockedHint = (check) => t(check.linked ? 'variants.blockedLinked' : 'variants.blocked', { name: check.name });

  function applyIdentity(target, toast) {
    // Lo pendiente del autoguardado va al ejercicio de ahora, antes de cambiarlo.
    if (dirtyRef.current) { clearTimeout(timerRef.current); commitValues(stateRef.current); dirtyRef.current = false; }
    const res = changeExerciseIdentity(templateId, exConfig.exerciseId, target);
    if (!res.id || res.id === exConfig.exerciseId) return;
    // La hoja sigue abierta (QA P44): el editor cambia de ejercicio sin
    // remontarse, así que el estado local tiene que coger la variante que quedó
    // (a una mano pierde la anchura; el aparte la fija).
    const now = useStore.getState().sessionTemplates[templateId]?.exercises
      ?.find((e) => e.exerciseId === res.id);
    setVariant(now?.variant ?? null);
    if (toast) showToast(toast, 2200, 'success');
    onIdentityChange?.(res.id);
  }

  // Fila VARIANTE: sale si hay algo dentro de la hoja. El subtítulo lo nombra.
  const showVariantRow = dims.length > 0 || showUni || apartOn;
  const dimsSub = [...(showUni ? ['unilateral'] : []), ...dims].map((d, n) => {
    const w = t(`variants.dim.${d}`);
    return n === 0 ? w : w.toLowerCase();
  }).join(' · ');
  const rowTitle = variantLabel(apartOn ? ident.variant : variant, t) || t('variants.none');

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
          onChange={selectMetric}
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
          ) : isEffort ? (
            <>
              <View style={styles.gridRow}>
                <StepField tight label={t('exerciseEditor.fieldTargetReps')} value={minReps} onChange={(v) => { setMinReps(v); setMaxReps(v); }} min={1} max={50} />
              </View>
              {effortWarn}
            </>
          ) : (
            <View style={styles.gridRow}>
              <StepField label={t('exerciseEditor.fieldMinReps')} value={minReps} onChange={setMinReps} min={1} max={50} />
              <StepField label={t('exerciseEditor.fieldMaxReps')} value={maxReps} onChange={setMaxReps} min={1} max={50} />
            </View>
          )}
        </View>
      </View>

      {/* ══ VARIANTE (no está en Figma — maqueta exercise-variants §1A) ═════ */}
      {showVariantRow && (
        <View style={styles.block}>
          <Text style={styles.secLabel}>{t('variants.section').toUpperCase()}</Text>
          <NavRow
            icon={<VariantIcon size={15} color={th.colors.accent} />}
            title={rowTitle}
            subtitle={dimsSub}
            onPress={() => setVariantSheetOpen(true)}
          />
        </View>
      )}

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
        {/* Marca el ejercicio como básico del día. Además de leerse de un
            vistazo en la lista de la sesión, es lo que permite que una regla de
            etapa distinga keys de accesorios (stage-planner.md §5). */}
        <ToggleRow
          label={t('exerciseEditor.isKeyLabel')}
          hint={t('exerciseEditor.isKeyHint')}
          value={isKey}
          onChange={setIsKey}
        />
        <ToggleRow
          label={t('exerciseEditor.trackRpeLabel')}
          value={trackRpe || isEffort}
          disabled={isEffort}
          alwaysHint={isEffort}
          hint={isEffort ? t('exerciseEditor.trackRpeLocked') : undefined}
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
        <NoteRow
          label={t('exerciseEditor.trainerNoteLabel')}
          value={trainerNote}
          onChangeText={setTrainerNote}
          placeholder={t('exerciseEditor.trainerNotePlaceholder')}
          hint={t('exerciseEditor.trainerNoteHint')}
        />
      </View>

      {/* Vinculación entre sesiones — solo si el ejercicio existe en más sesiones */}
      {showLinking && (
        <Text style={styles.secLabel}>{t('exerciseEditor.linkLabel').toUpperCase()}</Text>
      )}
      {showLinking && (
        <View style={styles.linkCard}>
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
              style={styles.addStepBtn}
              onPress={() => handleLinkSelect('__new__')}
              activeOpacity={0.7}
            >
              <Text style={styles.addStepText}>
                <Text style={styles.addPlus}>+</Text>{` ${t('exerciseEditor.linkNew')}`}
              </Text>
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

      {/* ══ HOJA: variante ══════════════════════════════════════════════════ */}
      <DragSheet
        visible={variantSheetOpen}
        onClose={() => setVariantSheetOpen(false)}
        title={t('variants.title')}
      >
        <AnimatedHeight>
          <View style={styles.sheetBody}>
            {/* Arriba lo que solo informa; con «Ejercicio aparte» es fija. */}
            {apartOn ? (
              <View style={{ gap: spacing.sm }}>
                <Text style={styles.groupCaption}>{t('variants.fixedTitle').toUpperCase()}</Text>
                <View style={styles.optGroup}>
                  <OptionRow
                    label={variantLabel(ident.variant, t)}
                    hint={t('variants.fixedHint')}
                    right={<LockIcon size={14} color={th.colors.mutedLight} />}
                  />
                </View>
              </View>
            ) : dims.length > 0 ? (
              <View>
                {/* Pasos con SegmentedControl, como la hoja de Progresión (QA P44). */}
                <VariantPicker def={def} value={variant} onChange={setVariant} />
                <Text style={[styles.hint, styles.variantHint]}>
                  {ident.uni && rootDef?.variants?.width && !def?.variants?.width
                    ? `${t('variants.howHint')} ${t('variants.widthNA')}`
                    : t('variants.howHint')}
                </Text>
              </View>
            ) : null}

            {/* Abajo lo que cambia el ejercicio: otro historial, otra progresión. */}
            {showUni || ident.natural || showApart ? (
              <View style={{ gap: spacing.sm }}>
                <Text style={styles.groupCaption}>{t('variants.identityTitle').toUpperCase()}</Text>
                <View style={styles.optGroup}>
                  {ident.natural ? (
                    <OptionRow label={t('variants.oneHand')} hint={t('variants.alreadyUnilateral')} />
                  ) : showUni ? (
                    <ToggleRow
                      label={t('variants.unilateral')}
                      hint={uniCheck?.blocked ? blockedHint(uniCheck) : t('variants.unilateralHint')}
                      value={ident.uni}
                      alwaysHint
                      warn={!!uniCheck?.blocked}
                      disabled={!!uniCheck?.blocked}
                      onChange={() => applyIdentity(uniTarget)}
                    />
                  ) : null}
                  {showApart ? (
                    <ToggleRow
                      label={t('variants.apart')}
                      hint={
                        apartCheck?.blocked ? blockedHint(apartCheck)
                          : apartOn ? t('variants.apartHintOn', { base: baseOf(ident.uni) })
                            : chosen ? t('variants.apartHintOff', { name: apartCheck.name, base: baseOf(ident.uni) })
                              : t('variants.apartNeedsVariant')
                      }
                      value={apartOn}
                      alwaysHint
                      warn={!!apartCheck?.blocked}
                      disabled={!!apartCheck?.blocked || (!apartOn && !chosen)}
                      onChange={() => applyIdentity(
                        apartTarget,
                        apartOn ? null : t('variants.toastApart', { name: apartCheck.name }),
                      )}
                    />
                  ) : null}
                </View>
              </View>
            ) : null}
          </View>
        </AnimatedHeight>
      </DragSheet>

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
                horizontal
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
                <Text style={styles.addStepText}>
                  <Text style={styles.addPlus}>+</Text>{` ${t('exerciseEditor.warmup.addStep')}`}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {warmupMode !== 'none' && (
            <View style={{ gap: spacing.sm }}>
              <StepField
                horizontal unit="s"
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
            <SegmentedControl options={PROG_MODES} value={progMode} onChange={selectProgMode} />
            <Text style={styles.hint}>{t(`exerciseEditor.progModeDesc.${progMode}`)}</Text>
          </View>

          {isEffort && (
            <View>
              <Text style={styles.stepTitle}>
                <Text style={styles.stepNum}>2 · </Text>{t('exerciseEditor.stepEffort')}
              </Text>
              <StepField
                horizontal
                label={t('exerciseEditor.maxRpeLabel')}
                value={targetRpe}
                onChange={setTargetRpe}
                min={6}
                max={10}
              />
              <Text style={styles.hint}>{effortRirTxt}</Text>
              {effortWarn}
            </View>
          )}

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
                      horizontal unit="%"
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
                      horizontal
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
                    horizontal
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
                          horizontal unit="%"
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
                          horizontal
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
  summaryTag:  { ...textStyles.caps, color: th.colors.accent },
  summaryMain: { ...textStyles.bodyStrong, color: th.colors.text },
  summarySub:  { ...textStyles.label,       color: th.tint.accent50 },

  // Título de grupo dentro de una hoja: el mismo tratamiento que `secLabel`, sin
  // su aire de arriba (en la hoja ya lo da el gap).
  groupCaption: { ...textStyles.caps, color: th.colors.mutedLight },
  variantHint:  { marginTop: spacing.md },

  // ── Etiquetas de sección (123:1635) ───────────────────────────────────────
  secLabel: {
    ...textStyles.caps,
    color:      th.colors.mutedLight,
    paddingTop: spacing.md,
  },

  // ── Grid 2×2 de cajas ─────────────────────────────────────────────────────
  grid:    { gap: spacing.md },
  gridRow: { flexDirection: 'row', gap: spacing.md },

  hint: { ...textStyles.body, color: th.colors.mutedLight, lineHeight: lh(textStyles.body.fontSize, LINE.row) },
  // Aviso de fiabilidad de Por esfuerzo: el naranja de `optRowWarn` (EditorRows).
  warnHint: { ...textStyles.body, color: th.colors.orange, lineHeight: lh(textStyles.body.fontSize, LINE.row) },

  // NavRow/OptionRow/ToggleRow/NoteRow viven en `ui/EditorRows.jsx` (compartidos
  // con el alta de ejercicio). `optRowLabel`/`optRowHint` se quedan aquí: se
  // reutilizan sueltos fuera de esos componentes (hint de vinculación, fila de
  // incremento mínimo).
  optRowLabel: { ...textStyles.bodyStrong, color: th.colors.text },
  optRowHint:  { ...textStyles.body, color: th.colors.mutedLight, lineHeight: lh(textStyles.body.fontSize, LINE.row) },

  // El contenedor recorta: por eso las filas solo llevan `radius/xxs` y las
  // esquinas exteriores salen del clip, igual que en Figma.
  optGroup: {
    borderRadius: th.radius.md,
    overflow:     'hidden',
    gap:          spacing.xs,
  },

  tempoValueRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  tempoValue:    { ...textStyles.bodyStrong, color: th.colors.mutedLight },

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
  linkPillText:       { ...textStyles.button, color: th.colors.text },
  linkPillTextActive: { color: th.colors.onAccent },

  // ── Acciones ──────────────────────────────────────────────────────────────
  btnRow: { flexDirection: 'row', gap: spacing.sm, paddingTop: spacing.md },
  substituteBtn: {
    flex:            1,
    alignItems:      'center',
    paddingVertical: spacing.md,
    backgroundColor: th.colors.surface2,
    borderRadius:    th.radius.sm,
  },
  substituteBtnText: { ...textStyles.button, color: th.colors.text },
  // Sin fondo, solo texto (QA): mismo tratamiento que "Descartar sesión".
  deleteBtn: {
    flex:            1,
    alignItems:      'center',
    paddingVertical: spacing.md,
  },
  deleteBtnText: { ...textStyles.button, color: th.tint.red50 },

  // ── Calentamiento (hoja) ──────────────────────────────────────────────────
  // Los campos son los MISMOS Input Field del grid de series del workout
  // (`workout/grid.js` + `SetRow`): misma geometría, mismo fondo y misma
  // tipografía, para que un paso de calentamiento se escriba igual en los dos
  // sitios.
  warmupStepRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  warmupStepIdx: { ...textStyles.button, color: th.tint.accent50, width: GRID.LABEL_W },
  // El "%" va DENTRO de la celda, no suelto al lado (QA).
  // La celda va en `surface` (en el workout es `bg`): la hoja ya es `bg` y una
  // celda del mismo color desaparecería.
  warmupField: {
    flex:            1,
    height:          GRID.CELL_H,
    backgroundColor: th.colors.surface,
    borderRadius:    GRID.RADIUS,
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             spacing.xs,
  },
  warmupFieldInput: {
    width:              40,
    height:             GRID.CELL_H,
    ...textStyles.itemTitle,
    fontFamily:         'Inter_800ExtraBold',
    color:              th.colors.text,
    textAlign:          'center',
    textAlignVertical:  'center',
    includeFontPadding: false,
    paddingVertical:    0,
    fontVariant:        ['tabular-nums'],
  },
  warmupFieldUnit:     { ...textStyles.label, color: th.colors.mutedLight },
  warmupStepUnit:      { ...textStyles.label, color: th.colors.mutedLight },
  warmupStepRemove:    { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  warmupStepRemoveTxt: { ...textStyles.body, color: th.tint.red50 },
  // Mismo botón de añadir que el resto de la app: texto plano, sin caja.
  addStepBtn:         { alignItems: 'center', paddingVertical: spacing.md },
  addStepBtnDisabled: { opacity: 0.35 },
  addStepText:        { ...textStyles.button, color: th.tint.accent50 },
  addPlus:            { color: th.colors.accent },

  // ── Incremento (hoja) ─────────────────────────────────────────────────────
  incrInputRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  // Sin ± (QA): es un dato que se teclea, no que se ajusta. En `surface`, que
  // es lo que se despega del `bg` de la hoja.
  incrInput: {
    minWidth:           80,
    height:             STEP_BTN,
    backgroundColor:    th.colors.surface,
    borderRadius:       th.radius.sm,
    paddingHorizontal:  spacing.md,
    ...textStyles.itemTitle,
    color:              th.colors.text,
    textAlign:          'center',
    textAlignVertical:  'center',
    includeFontPadding: false,
    paddingVertical:    0,
  },
  incrUnit: { ...textStyles.label, color: th.colors.mutedLight },
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
    ...textStyles.code,
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
    ...textStyles.caps,
    color:         th.colors.mutedLight,
    textTransform: 'uppercase',
    marginBottom:  spacing.sm,
  },
  stepNum: { color: th.colors.accent },
});
