import { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../../store/useStore';
import { resolveProgressionConfig, LEGACY_TYPE_MAP } from '../../../../src/utils/progression';
import { useWeightUnit } from '../../hooks/useWeightUnit';
import { colors, spacing, typography, radius, borders, withOpacity } from '../../theme';

// ─── StepField ────────────────────────────────────────────────────────────────

function StepField({ label, value, onChange, min, max }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => { setDraft(String(value)); }, [value]);
  const numVal = Number(value);

  function handleChangeText(v) { setDraft(v.replace(/[^0-9]/g, '')); }
  function handleBlur() {
    const n = parseInt(draft, 10);
    if (!isNaN(n)) { const c = Math.min(max, Math.max(min, n)); setDraft(String(c)); onChange(c); }
    else setDraft(String(value));
  }

  return (
    <View style={sf.wrap}>
      <Text style={sf.label}>{label}</Text>
      <View style={sf.row}>
        <TouchableOpacity style={sf.stepBtn} onPress={() => onChange(Math.max(min, numVal - 1))}>
          <Text style={sf.stepText}>−</Text>
        </TouchableOpacity>
        <TextInput
          style={sf.valueInput}
          keyboardType="numeric"
          value={draft}
          onChangeText={handleChangeText}
          onBlur={handleBlur}
          selectTextOnFocus
        />
        <TouchableOpacity style={sf.stepBtn} onPress={() => onChange(Math.min(max, numVal + 1))}>
          <Text style={sf.stepText}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const sf = StyleSheet.create({
  wrap:       { flex: 1 },
  label:      { fontSize: typography.xs, color: colors.muted, letterSpacing: 1, textTransform: 'uppercase', marginBottom: spacing.xs, textAlign: 'center' },
  row:        { flexDirection: 'row', alignItems: 'center', borderWidth: borders.thin, borderColor: colors.borderCard, borderRadius: radius.sm, overflow: 'hidden' },
  stepBtn:    { width: 36, height: 38, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface2 },
  stepText:   { fontSize: 18, color: colors.muted, lineHeight: 22 },
  valueInput: { flex: 1, textAlign: 'center', fontSize: typography.md, fontWeight: typography.medium, color: colors.text, backgroundColor: colors.surface, height: 38 },
});

// ─── ToggleRow ────────────────────────────────────────────────────────────────

function ToggleRow({ label, value, onChange }) {
  return (
    <TouchableOpacity style={styles.toggleRow} onPress={() => onChange(!value)} activeOpacity={0.7}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <View style={[styles.track, value && styles.trackOn]}>
        <View style={[styles.thumb, value && styles.thumbOn]} />
      </View>
    </TouchableOpacity>
  );
}

// ─── SegPicker — horizontal pill selector ────────────────────────────────────

function SegPicker({ options, value, onChange }) {
  return (
    <View style={styles.segRow}>
      {options.map((opt) => (
        <TouchableOpacity
          key={opt.id}
          style={[styles.segBtn, value === opt.id && styles.segBtnActive]}
          onPress={() => onChange(opt.id)}
        >
          <Text style={[styles.segLabel, value === opt.id && styles.segLabelActive]}>
            {opt.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ─── IncrementInput — decimal text input with unit label ─────────────────────

function IncrementInput({ value, onChange, unit }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => { setDraft(String(value)); }, [value]);

  return (
    <View style={styles.incrInputRow}>
      <TextInput
        style={styles.incrInput}
        value={draft}
        onChangeText={(v) => {
          if (/^\d*\.?\d*$/.test(v)) setDraft(v);
        }}
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

// ─── ExerciseEditorInline ─────────────────────────────────────────────────────

export default function ExerciseEditorInline({ templateId, exConfig, def, onClose, navigation }) {
  const { t }            = useTranslation();
  const { label: weightLabel } = useWeightUnit();
  const updateExerciseParams   = useStore((s) => s.updateExerciseParams);

  // ── Resolve current progression config ───────────────────────────────────
  const initProg = resolveProgressionConfig(exConfig, def);

  const initInputType = exConfig.inputType ?? (
    (exConfig.progressionModel ?? def?.progressionModel) === 'time_progression' ? 'time' : 'weight_reps'
  );
  const initMetric = initInputType === 'time' || initInputType === 'weight_time' ? 'time' : 'reps';

  // ── Snapshot initial values (for isChanged + Restore) ────────────────────
  const initialRef = useRef({
    sets:           exConfig.sets         ?? 3,
    restSec:        exConfig.restSec      ?? 90,
    minReps:        exConfig.minReps      ?? def?.minReps ?? 8,
    maxReps:        exConfig.maxReps      ?? def?.maxReps ?? 12,
    minTime:        exConfig.minTime      ?? def?.minTime ?? 20,
    maxTime:        exConfig.maxTime      ?? def?.maxTime ?? 40,
    metric:         initMetric,
    isUnilateral:   exConfig.isUnilateral ?? def?.isUnilateral ?? false,
    tempo:          exConfig.tempo        ?? '',
    // Progression
    progType:       initProg.type,
    evalMode:       initProg.evaluation.mode,
    evalPct:        Math.round((initProg.evaluation.pctThreshold ?? 0.8) * 100),
    incrType:       initProg.increment.type === 'stepped' ? 'fixed' : initProg.increment.type,
    incrFixedValue: initProg.increment.value ?? 2.5,
    incrPctValue:   initProg.increment.pct   ?? 5,
  });

  const i = initialRef.current;

  // ── State ─────────────────────────────────────────────────────────────────
  const [sets,           setSets]           = useState(i.sets);
  const [restSec,        setRestSec]        = useState(i.restSec);
  const [minReps,        setMinReps]        = useState(i.minReps);
  const [maxReps,        setMaxReps]        = useState(i.maxReps);
  const [minTime,        setMinTime]        = useState(i.minTime);
  const [maxTime,        setMaxTime]        = useState(i.maxTime);
  const [metric,         setMetric]         = useState(i.metric);
  const [isUnilateral,   setIsUnilateral]   = useState(i.isUnilateral);
  const [tempo,          setTempo]          = useState(i.tempo);
  // Progression
  const [progType,       setProgType]       = useState(i.progType);
  const [evalMode,       setEvalMode]       = useState(i.evalMode);
  const [evalPct,        setEvalPct]        = useState(i.evalPct);
  const [incrType,       setIncrType]       = useState(i.incrType);
  const [incrFixedValue, setIncrFixedValue] = useState(i.incrFixedValue);
  const [incrPctValue,   setIncrPctValue]   = useState(i.incrPctValue);

  // ── Always-current ref for flush-on-unmount ───────────────────────────────
  const stateRef  = useRef(null);
  const dirtyRef  = useRef(false);
  const timerRef  = useRef(null);
  const updateRef = useRef(updateExerciseParams);
  useEffect(() => { updateRef.current = updateExerciseParams; }, [updateExerciseParams]);

  stateRef.current = {
    sets, restSec, minReps, maxReps, minTime, maxTime, metric, isUnilateral, tempo,
    progType, evalMode, evalPct, incrType, incrFixedValue, incrPctValue,
  };

  // ── Commit helper ─────────────────────────────────────────────────────────
  const commitValues = useCallback((s) => {
    const isTimeMode = s.metric === 'time';
    const isNoneType = s.progType === 'none';
    const inputType  = s.metric === 'time' ? 'weight_time' : 'weight_reps';

    const updates = {
      sets:         s.sets,
      restSec:      s.restSec,
      inputType,
      isUnilateral: s.isUnilateral,
      tempo:        s.tempo.trim() || null,
      // Legacy field — kept for backward compatibility with any web code that still reads it
      progressionModel: LEGACY_TYPE_MAP[s.progType] ?? 'double_progression',
      // New progression object — full model
      progression: {
        type:      s.progType,
        direction: 'increase', // 'decrease' for assisted exercises — expose in UI later
        evaluation: {
          mode:         s.evalMode,
          pctThreshold: s.evalPct / 100,
          maxRpe:       8,
          minRir:       2,
        },
        increment: {
          type:  s.incrType,
          value: s.incrFixedValue,
          pct:   s.incrPctValue,
          steps: [],
        },
        seed: { weight: null, reps: null, time: null },
      },
    };

    if (isTimeMode) {
      updates.minTime = s.minTime;
      updates.maxTime = s.maxTime;
      updates.minReps = null;
      updates.maxReps = null;
    } else if (!isNoneType) {
      updates.minReps = s.minReps;
      updates.maxReps = s.maxReps;
    }

    updateRef.current(templateId, exConfig.exerciseId, updates);
  }, [templateId, exConfig.exerciseId]);

  // ── Debounced commit on any state change ──────────────────────────────────
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    dirtyRef.current = true;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => { commitValues(stateRef.current); }, 400);
    return () => clearTimeout(timerRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sets, restSec, minReps, maxReps, minTime, maxTime, metric, isUnilateral, tempo,
      progType, evalMode, evalPct, incrType, incrFixedValue, incrPctValue]);

  // ── Flush on unmount ──────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (dirtyRef.current) { clearTimeout(timerRef.current); commitValues(stateRef.current); }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── isChanged ─────────────────────────────────────────────────────────────
  const isChanged =
    sets !== i.sets || restSec !== i.restSec ||
    minReps !== i.minReps || maxReps !== i.maxReps ||
    minTime !== i.minTime || maxTime !== i.maxTime ||
    metric !== i.metric || isUnilateral !== i.isUnilateral || tempo !== i.tempo ||
    progType !== i.progType || evalMode !== i.evalMode || evalPct !== i.evalPct ||
    incrType !== i.incrType || incrFixedValue !== i.incrFixedValue || incrPctValue !== i.incrPctValue;

  // ── Restore ───────────────────────────────────────────────────────────────
  function handleRestore() {
    clearTimeout(timerRef.current);
    setSets(i.sets);           setRestSec(i.restSec);
    setMinReps(i.minReps);     setMaxReps(i.maxReps);
    setMinTime(i.minTime);     setMaxTime(i.maxTime);
    setMetric(i.metric);       setIsUnilateral(i.isUnilateral); setTempo(i.tempo);
    setProgType(i.progType);   setEvalMode(i.evalMode);         setEvalPct(i.evalPct);
    setIncrType(i.incrType);   setIncrFixedValue(i.incrFixedValue); setIncrPctValue(i.incrPctValue);
    commitValues(i);
    dirtyRef.current = false;
  }

  function handleSubstitute() {
    navigation.navigate('ExerciseSelector', {
      templateId,
      currentExerciseId: exConfig.exerciseId,
      existingPatterns: [],
    });
    onClose();
  }

  // ── Derived flags ─────────────────────────────────────────────────────────
  const isTime   = metric === 'time';
  const isNone   = progType === 'none';
  const isReps   = progType === 'reps';
  const showRepsRange  = !isTime && !isNone;
  const showTimeRange  = isTime;
  const showWeightIncr = progType === 'weight' || progType === 'double';
  const showTimeIncr   = progType === 'time';
  const showRepsIncr   = progType === 'reps';
  const showIncrement  = showWeightIncr || showTimeIncr || showRepsIncr;

  // Unit label for the increment input
  const incrUnit = showTimeIncr ? 's' : (incrType === 'pct' ? '%' : weightLabel);

  // ── Build option arrays (inside component so t() works) ───────────────────
  const PROG_TYPES = [
    { id: 'double', label: t('exerciseEditor.progTypes.double') },
    { id: 'weight', label: t('exerciseEditor.progTypes.weight') },
    { id: 'reps',   label: t('exerciseEditor.progTypes.reps')   },
    { id: 'time',   label: t('exerciseEditor.progTypes.time')   },
    { id: 'none',   label: t('exerciseEditor.progTypes.none')   },
  ];
  const EVAL_MODES = [
    { id: 'all_complete', label: t('exerciseEditor.evalModes.all_complete') },
    { id: 'pct',          label: t('exerciseEditor.evalModes.pct')          },
  ];
  const INCR_TYPES = [
    { id: 'fixed', label: t('exerciseEditor.incrTypes.fixed') },
    { id: 'pct',   label: t('exerciseEditor.incrTypes.pct')   },
  ];

  return (
    <View style={styles.container}>

      {/* ── Tipo: Reps / Tiempo ── */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>TIPO</Text>
        <View style={styles.segRow}>
          <TouchableOpacity
            style={[styles.segBtn, metric === 'reps' && styles.segBtnActive]}
            onPress={() => setMetric('reps')}
          >
            <Text style={[styles.segLabel, metric === 'reps' && styles.segLabelActive]}>Reps</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segBtn, metric === 'time' && styles.segBtnActive]}
            onPress={() => setMetric('time')}
          >
            <Text style={[styles.segLabel, metric === 'time' && styles.segLabelActive]}>Tiempo</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Series + Descanso ── */}
      <View style={styles.fieldRow}>
        <StepField label={t('exerciseEditor.fieldSets')}  value={sets}    onChange={setSets}    min={1}  max={8}   />
        <StepField label={t('exerciseEditor.fieldRest')}  value={restSec} onChange={setRestSec} min={30} max={300} />
      </View>

      {/* ── Rango reps / tiempo ── */}
      {showTimeRange ? (
        <View style={styles.fieldRow}>
          <StepField label={t('exerciseEditor.fieldMinTime')} value={minTime} onChange={setMinTime} min={5}  max={300} />
          <StepField label={t('exerciseEditor.fieldMaxTime')} value={maxTime} onChange={setMaxTime} min={5}  max={300} />
        </View>
      ) : showRepsRange ? (
        <View style={styles.fieldRow}>
          <StepField label={t('exerciseEditor.fieldMinReps')} value={minReps} onChange={setMinReps} min={1} max={50} />
          <StepField label={t('exerciseEditor.fieldMaxReps')} value={maxReps} onChange={setMaxReps} min={1} max={50} />
        </View>
      ) : (
        <Text style={styles.submaxHint}>{t('exerciseEditor.submaxHint')}</Text>
      )}

      {/* ── Progresión ── */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>{t('exerciseEditor.sectionProgression')}</Text>

        {/* Type selector — 2 rows: 3 + 2 */}
        <View style={[styles.segRow, { marginBottom: spacing.xs }]}>
          {PROG_TYPES.slice(0, 3).map((pt) => (
            <TouchableOpacity
              key={pt.id}
              style={[styles.segBtn, progType === pt.id && styles.segBtnActive]}
              onPress={() => setProgType(pt.id)}
            >
              <Text style={[styles.segLabel, progType === pt.id && styles.segLabelActive]}>
                {pt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.segRow}>
          {PROG_TYPES.slice(3).map((pt) => (
            <TouchableOpacity
              key={pt.id}
              style={[styles.segBtn, progType === pt.id && styles.segBtnActive]}
              onPress={() => setProgType(pt.id)}
            >
              <Text style={[styles.segLabel, progType === pt.id && styles.segLabelActive]}>
                {pt.label}
              </Text>
            </TouchableOpacity>
          ))}
          {/* spacer so last row matches width */}
          <View style={[styles.segBtn, { opacity: 0 }]} pointerEvents="none" />
        </View>

        {/* Type description */}
        {!isNone && (
          <Text style={styles.progTypeDesc}>
            {t(`exerciseEditor.progTypeDesc.${progType}`)}
          </Text>
        )}
      </View>

      {/* ── Evaluación ── */}
      {!isNone && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t('exerciseEditor.sectionEvaluation')}</Text>
          <SegPicker options={EVAL_MODES} value={evalMode} onChange={setEvalMode} />
          {evalMode === 'pct' && (
            <View style={[styles.fieldRow, { marginTop: spacing.sm }]}>
              <StepField
                label={`${t('exerciseEditor.evalPctLabel')} (%)`}
                value={evalPct}
                onChange={setEvalPct}
                min={50}
                max={100}
              />
              <View style={{ flex: 2 }} />
            </View>
          )}
        </View>
      )}

      {/* ── Incremento ── */}
      {showIncrement && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t('exerciseEditor.sectionIncrement')}</Text>

          {showRepsIncr ? (
            /* Reps progression: only fixed increment makes sense */
            <View style={[styles.fieldRow]}>
              <StepField
                label={t('exerciseEditor.incrFixedRepsLabel')}
                value={incrFixedValue}
                onChange={setIncrFixedValue}
                min={1}
                max={10}
              />
              <View style={{ flex: 2 }} />
            </View>
          ) : (
            <>
              <SegPicker options={INCR_TYPES} value={incrType} onChange={setIncrType} />
              <View style={{ marginTop: spacing.sm }}>
                <IncrementInput
                  value={incrType === 'pct' ? incrPctValue : incrFixedValue}
                  onChange={incrType === 'pct' ? setIncrPctValue : setIncrFixedValue}
                  unit={incrType === 'pct' ? '%' : (showTimeIncr ? 's' : weightLabel)}
                />
              </View>
            </>
          )}
        </View>
      )}

      {/* ── Opciones: unilateral + tempo ── */}
      <View style={styles.optionsBlock}>
        <ToggleRow label="Unilateral" value={isUnilateral} onChange={setIsUnilateral} />
        <View style={styles.divider} />
        <View style={styles.tempoRow}>
          <View style={styles.tempoMeta}>
            <Text style={styles.toggleLabel}>Tempo</Text>
            <Text style={styles.tempoHint}>Exc · Pausa · Con · Pausa</Text>
          </View>
          <TextInput
            style={styles.tempoInput}
            value={tempo}
            onChangeText={(v) => setTempo(v.replace(/[^0-9Xx]/g, '').toUpperCase().slice(0, 4))}
            maxLength={4}
            placeholder="—"
            placeholderTextColor={colors.muted2}
            keyboardType="default"
            autoCapitalize="characters"
            returnKeyType="done"
          />
        </View>
      </View>

      {/* ── Acciones ── */}
      <View style={styles.btnRow}>
        <TouchableOpacity style={styles.substituteBtn} onPress={handleSubstitute}>
          <Text style={styles.substituteBtnText}>{t('exerciseEditor.substituteBtn')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.restoreBtn, !isChanged && styles.restoreBtnDisabled]}
          onPress={isChanged ? handleRestore : undefined}
          disabled={!isChanged}
        >
          <Text style={[styles.restoreBtnText, !isChanged && styles.restoreBtnTextDisabled]}>
            Restaurar
          </Text>
        </TouchableOpacity>
      </View>

    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface2,
    borderWidth:     borders.thin,
    borderColor:     colors.border,
    borderRadius:    radius.md,
    padding:         spacing.md,
    marginTop:       spacing.xs,
    gap:             spacing.md,
  },

  section:      {},
  sectionLabel: {
    fontSize:      typography.xs,
    color:         colors.muted,
    letterSpacing: 1,
    marginBottom:  spacing.xs,
  },

  // ── Tipo selector ──────────────────────────────────────────────────────────
  segRow: {
    flexDirection: 'row',
    gap:           spacing.xs,
  },
  segBtn: {
    flex:            1,
    paddingVertical: spacing.sm,
    borderRadius:    radius.sm,
    borderWidth:     borders.thin,
    borderColor:     colors.border,
    backgroundColor: colors.surface,
    alignItems:      'center',
  },
  segBtnActive: {
    backgroundColor: withOpacity(colors.accent, 0.10),
    borderColor:     withOpacity(colors.accent, 0.40),
  },
  segLabel: {
    fontSize:   typography.sm,
    color:      colors.muted,
    fontWeight: typography.medium,
  },
  segLabelActive: {
    color: colors.accent,
  },

  // ── Progression type description ───────────────────────────────────────────
  progTypeDesc: {
    fontSize:   typography.xs,
    color:      colors.muted2,
    marginTop:  spacing.xs,
    lineHeight: typography.xs * 1.5,
  },

  // ── Increment input ────────────────────────────────────────────────────────
  incrInputRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.sm,
  },
  incrInput: {
    backgroundColor:   colors.surface,
    borderWidth:       borders.thin,
    borderColor:       colors.borderCard,
    borderRadius:      radius.sm,
    paddingHorizontal: spacing.md,
    height:            38,
    fontSize:          typography.md,
    fontWeight:        typography.medium,
    color:             colors.text,
    textAlign:         'center',
    minWidth:          80,
  },
  incrUnit: {
    fontSize:   typography.sm,
    color:      colors.muted,
    fontWeight: typography.medium,
  },

  // ── Step fields ────────────────────────────────────────────────────────────
  fieldRow: { flexDirection: 'row', gap: spacing.sm },

  // ── Options block ──────────────────────────────────────────────────────────
  submaxHint: { fontSize: typography.xs, color: colors.muted, lineHeight: 16 },

  optionsBlock: {
    backgroundColor:   colors.surface,
    borderRadius:      radius.sm,
    borderWidth:       borders.thin,
    borderColor:       colors.border,
    paddingVertical:   spacing.xs,
    paddingHorizontal: spacing.md,
  },
  divider: {
    height:          borders.thin,
    backgroundColor: colors.border,
    marginVertical:  spacing.xs,
  },

  // Toggle
  toggleRow: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'space-between',
    paddingVertical: spacing.sm,
  },
  toggleLabel: {
    fontSize:   typography.sm,
    color:      colors.text,
    fontWeight: typography.medium,
  },
  track: {
    width:           40,
    height:          22,
    borderRadius:    11,
    backgroundColor: colors.border,
    padding:         2,
    justifyContent:  'center',
  },
  trackOn: {
    backgroundColor: withOpacity(colors.accent, 0.25),
    borderWidth:     1,
    borderColor:     withOpacity(colors.accent, 0.6),
  },
  thumb: {
    width:           18,
    height:          18,
    borderRadius:    9,
    backgroundColor: colors.muted,
  },
  thumbOn: {
    backgroundColor: colors.accent,
    transform:       [{ translateX: 18 }],
  },

  // Tempo
  tempoRow: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'space-between',
    paddingVertical: spacing.sm,
    gap:             spacing.sm,
  },
  tempoMeta: { flex: 1, gap: 2 },
  tempoHint: { fontSize: 9, color: colors.muted2, lineHeight: 13, marginTop: 2 },
  tempoInput: {
    backgroundColor:   colors.surface2,
    borderWidth:       borders.thin,
    borderColor:       colors.borderCard,
    borderRadius:      radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical:   7,
    fontSize:          typography.md,
    fontWeight:        typography.semibold,
    color:             colors.text,
    width:             72,
    textAlign:         'center',
    letterSpacing:     4,
  },

  // ── Buttons ────────────────────────────────────────────────────────────────
  btnRow: { flexDirection: 'row', gap: spacing.xs },

  substituteBtn: {
    flex:            1,
    alignItems:      'center',
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius:    radius.sm,
    borderWidth:     borders.thin,
    borderColor:     colors.borderCard,
  },
  substituteBtnText: {
    fontSize:   typography.sm,
    color:      colors.text,
    fontWeight: typography.medium,
  },
  restoreBtn: {
    alignItems:        'center',
    justifyContent:    'center',
    paddingVertical:   spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius:      radius.sm,
    borderWidth:       borders.thin,
    borderColor:       colors.borderCard,
  },
  restoreBtnDisabled:     { opacity: 0.35 },
  restoreBtnText:         { fontSize: typography.sm, color: colors.muted, fontWeight: typography.medium },
  restoreBtnTextDisabled: {},
});
