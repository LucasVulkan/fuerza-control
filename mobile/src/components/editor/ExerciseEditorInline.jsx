import { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../../store/useStore';
import { resolveProgressionConfig, LEGACY_TYPE_MAP } from '../../../../src/utils/progression';
import { useWeightUnit } from '../../hooks/useWeightUnit';
import { spacing, typography, borders, withOpacity } from '../../theme';
import { useTheme, useThemedStyles } from '../../useTheme';

// ─── StepField ────────────────────────────────────────────────────────────────

function StepField({ label, value, onChange, min, max }) {
  const sf = useThemedStyles(makeSf);
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
    <View style={sf.card}>
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

const makeSf = (th) => StyleSheet.create({
  card: {
    flex:            1,
    backgroundColor: th.colors.surface,
    borderWidth:     borders.thin,
    borderColor:     th.colors.border,
    borderRadius:    th.radius.md,
    padding:         spacing.sm + 2,
    gap:             6,
  },
  label: {
    fontSize:      typography.xs,
    color:         th.colors.muted,
    letterSpacing: 0.5,
    fontWeight:    typography.medium,
    textAlign:     'center',
  },
  row: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.xs,
  },
  stepBtn: {
    width:           36,
    height:          36,
    borderRadius:    th.radius.sm,
    borderWidth:     borders.thin,
    borderColor:     th.colors.border,
    backgroundColor: th.colors.surface2,
    alignItems:      'center',
    justifyContent:  'center',
  },
  stepText: {
    fontSize:   18,
    color:      th.colors.muted,
    lineHeight: 22,
  },
  valueInput: {
    flex:               1,
    textAlign:          'center',
    textAlignVertical:  'center',
    includeFontPadding: false,
    fontSize:           typography.lg,
    fontWeight:         typography.bold,
    color:              th.colors.text,
    backgroundColor:    'transparent',
    height:             40,
    paddingVertical:    0,
  },
});

// ─── ToggleRow ────────────────────────────────────────────────────────────────

function ToggleRow({ label, value, onChange }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <TouchableOpacity style={styles.toggleRow} onPress={() => onChange(!value)} activeOpacity={0.7}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <View style={[styles.track, value && styles.trackOn]}>
        <View style={[styles.thumb, value && styles.thumbOn]} />
      </View>
    </TouchableOpacity>
  );
}

// ─── SegPicker ────────────────────────────────────────────────────────────────

function SegPicker({ options, value, onChange }) {
  const styles = useThemedStyles(makeStyles);
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

// ─── ExerciseEditorInline ─────────────────────────────────────────────────────

export default function ExerciseEditorInline({ templateId, exConfig, def, onClose, navigation }) {
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { t }                  = useTranslation();
  const { label: weightLabel } = useWeightUnit();
  const updateExerciseParams   = useStore((s) => s.updateExerciseParams);

  const initProg = resolveProgressionConfig(exConfig, def);

  const initInputType = exConfig.inputType ?? (
    (exConfig.progressionModel ?? def?.progressionModel) === 'time_progression' ? 'time' : 'weight_reps'
  );
  const initMetric = initInputType === 'time' || initInputType === 'weight_time' ? 'time' : 'reps';

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
    trainerNote:    exConfig.trainerNote  ?? '',
    trackRpe:       exConfig.trackRpe     ?? false,
    evalMaxRpe:     initProg.evaluation.maxRpe ?? 8,
    progType:       initProg.type,
    evalMode:       initProg.evaluation.mode,
    evalPct:        Math.round((initProg.evaluation.pctThreshold ?? 0.8) * 100),
    incrType:       initProg.increment.type === 'stepped' ? 'fixed' : initProg.increment.type,
    incrFixedValue: initProg.increment.value        ?? 2.5,
    incrPctValue:   initProg.increment.pct          ?? 5,
    incrMin:        initProg.increment.minIncrement ?? 0,
  });

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
  const [progType,       setProgType]       = useState(i.progType);
  const [evalMode,       setEvalMode]       = useState(i.evalMode);
  const [evalPct,        setEvalPct]        = useState(i.evalPct);
  const [incrType,       setIncrType]       = useState(i.incrType);
  const [incrFixedValue, setIncrFixedValue] = useState(i.incrFixedValue);
  const [incrPctValue,   setIncrPctValue]   = useState(i.incrPctValue);
  const [incrMin,        setIncrMin]        = useState(i.incrMin);

  const stateRef  = useRef(null);
  const dirtyRef  = useRef(false);
  const timerRef  = useRef(null);
  const updateRef = useRef(updateExerciseParams);
  useEffect(() => { updateRef.current = updateExerciseParams; }, [updateExerciseParams]);

  stateRef.current = {
    sets, restSec, minReps, maxReps, minTime, maxTime, metric, isUnilateral, tempo, trainerNote,
    trackRpe, evalMaxRpe,
    progType, evalMode, evalPct, incrType, incrFixedValue, incrPctValue, incrMin,
  };

  const commitValues = useCallback((s) => {
    const isTimeMode = s.metric === 'time';
    const isNoneType = s.progType === 'none';
    const inputType  = s.metric === 'time' ? 'weight_time' : 'weight_reps';

    const updates = {
      sets: s.sets, restSec: s.restSec, inputType,
      isUnilateral: s.isUnilateral,
      tempo:        s.tempo.trim() || null,
      trainerNote:  s.trainerNote.trim() || null,
      trackRpe:     s.trackRpe,
      progressionModel: LEGACY_TYPE_MAP[s.progType] ?? 'double_progression',
      progression: {
        type:      s.progType,
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
    } else if (!isNoneType) {
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
      progType, evalMode, evalPct, incrType, incrFixedValue, incrPctValue, incrMin]);

  useEffect(() => {
    return () => {
      if (dirtyRef.current) { clearTimeout(timerRef.current); commitValues(stateRef.current); }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isChanged =
    sets !== i.sets || restSec !== i.restSec ||
    minReps !== i.minReps || maxReps !== i.maxReps ||
    minTime !== i.minTime || maxTime !== i.maxTime ||
    metric !== i.metric || isUnilateral !== i.isUnilateral || tempo !== i.tempo ||
    trainerNote !== i.trainerNote || trackRpe !== i.trackRpe || evalMaxRpe !== i.evalMaxRpe ||
    progType !== i.progType || evalMode !== i.evalMode || evalPct !== i.evalPct ||
    incrType !== i.incrType || incrFixedValue !== i.incrFixedValue ||
    incrPctValue !== i.incrPctValue || incrMin !== i.incrMin;

  function handleRestore() {
    clearTimeout(timerRef.current);
    setSets(i.sets);           setRestSec(i.restSec);
    setMinReps(i.minReps);     setMaxReps(i.maxReps);
    setMinTime(i.minTime);     setMaxTime(i.maxTime);
    setMetric(i.metric);       setIsUnilateral(i.isUnilateral); setTempo(i.tempo);
    setTrainerNote(i.trainerNote);
    setTrackRpe(i.trackRpe);   setEvalMaxRpe(i.evalMaxRpe);
    setProgType(i.progType);   setEvalMode(i.evalMode);         setEvalPct(i.evalPct);
    setIncrType(i.incrType);   setIncrFixedValue(i.incrFixedValue);
    setIncrPctValue(i.incrPctValue); setIncrMin(i.incrMin);
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

  const isTime         = metric === 'time';
  const isNone         = progType === 'none';
  const showRepsRange  = !isTime && !isNone;
  const showTimeRange  = isTime;
  const showWeightIncr = progType === 'weight' || progType === 'double';
  const showTimeIncr   = progType === 'time';
  const showRepsIncr   = progType === 'reps';
  const showIncrement  = showWeightIncr || showTimeIncr || showRepsIncr;

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
    // RPE evaluation only offered when the exercise records RPE
    ...(trackRpe ? [{ id: 'rpe', label: t('exerciseEditor.evalModes.rpe') }] : []),
  ];
  const INCR_TYPES = [
    { id: 'fixed', label: t('exerciseEditor.incrTypes.fixed') },
    { id: 'pct',   label: t('exerciseEditor.incrTypes.pct')   },
  ];

  return (
    <View style={styles.container}>

      {/* ══ VOLUMEN ══════════════════════════════════════════════════════════ */}
      <View>
        <Text style={styles.secTitle}>{t('exerciseEditor.sectionVolume')}</Text>
        <SegPicker
          options={[
            { id: 'reps', label: 'Reps' },
            { id: 'time', label: 'Tiempo' },
          ]}
          value={metric}
          onChange={setMetric}
        />

        <View style={[styles.fieldRow, { marginTop: spacing.sm }]}>
          <StepField label={t('exerciseEditor.fieldSets')} value={sets}    onChange={setSets}    min={1}  max={8}   />
          <StepField label={t('exerciseEditor.fieldRest')} value={restSec} onChange={setRestSec} min={30} max={300} />
        </View>

        {showTimeRange ? (
          <View style={[styles.fieldRow, { marginTop: spacing.sm }]}>
            <StepField label={t('exerciseEditor.fieldMinTime')} value={minTime} onChange={setMinTime} min={5}  max={300} />
            <StepField label={t('exerciseEditor.fieldMaxTime')} value={maxTime} onChange={setMaxTime} min={5}  max={300} />
          </View>
        ) : showRepsRange ? (
          <View style={[styles.fieldRow, { marginTop: spacing.sm }]}>
            <StepField label={t('exerciseEditor.fieldMinReps')} value={minReps} onChange={setMinReps} min={1} max={50} />
            <StepField label={t('exerciseEditor.fieldMaxReps')} value={maxReps} onChange={setMaxReps} min={1} max={50} />
          </View>
        ) : (
          <Text style={styles.hint}>{t('exerciseEditor.submaxHint')}</Text>
        )}
      </View>

      <View style={styles.divider} />

      {/* ══ PROGRESIÓN ═══════════════════════════════════════════════════════ */}
      <View>
        <Text style={styles.secTitle}>{t('exerciseEditor.sectionProgression')}</Text>

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
          <View style={[styles.segBtn, { opacity: 0 }]} pointerEvents="none" />
        </View>

        {!isNone && (
          <Text style={styles.hint}>{t(`exerciseEditor.progTypeDesc.${progType}`)}</Text>
        )}

        {/* ── Evaluación ── */}
        {!isNone && (
          <>
            <Text style={styles.subSecTitle}>{t('exerciseEditor.sectionEvaluation')}</Text>
            <SegPicker options={EVAL_MODES} value={evalMode} onChange={setEvalMode} />
            <Text style={styles.hint}>{t(`exerciseEditor.evalModeDesc.${evalMode}`)}</Text>
            {evalMode === 'pct' && (
              <View style={[styles.fieldRow, { marginTop: spacing.sm }]}>
                <StepField
                  label={`${t('exerciseEditor.evalPctLabel')} (%)`}
                  value={evalPct}
                  onChange={setEvalPct}
                  min={50}
                  max={100}
                />
                <View style={{ flex: 1 }} />
              </View>
            )}
            {evalMode === 'rpe' && (
              <View style={[styles.fieldRow, { marginTop: spacing.sm }]}>
                <StepField
                  label={t('exerciseEditor.maxRpeLabel')}
                  value={evalMaxRpe}
                  onChange={setEvalMaxRpe}
                  min={6}
                  max={10}
                />
                <View style={{ flex: 1 }} />
              </View>
            )}
          </>
        )}

        {/* ── Incremento ── */}
        {showIncrement && (
          <>
            <Text style={styles.subSecTitle}>{t('exerciseEditor.sectionIncrement')}</Text>
            {showRepsIncr ? (
              <View style={styles.fieldRow}>
                <StepField
                  label={t('exerciseEditor.incrFixedRepsLabel')}
                  value={incrFixedValue}
                  onChange={setIncrFixedValue}
                  min={1}
                  max={10}
                />
                <View style={{ flex: 1 }} />
              </View>
            ) : (
              <>
                <SegPicker options={INCR_TYPES} value={incrType} onChange={setIncrType} />
                <Text style={styles.hint}>{t(`exerciseEditor.incrTypeDesc.${incrType}`)}</Text>
                <View style={{ marginTop: spacing.sm }}>
                  <IncrementInput
                    value={incrType === 'pct' ? incrPctValue : incrFixedValue}
                    onChange={incrType === 'pct' ? setIncrPctValue : setIncrFixedValue}
                    unit={incrType === 'pct' ? '%' : (showTimeIncr ? 's' : weightLabel)}
                  />
                </View>
                {incrType === 'pct' && (
                  <View style={styles.incrMinRow}>
                    <View style={styles.incrMinMeta}>
                      <Text style={styles.incrMinLabel}>{t('exerciseEditor.incrMinLabel')}</Text>
                      <Text style={styles.hint}>{t('exerciseEditor.incrMinHint')}</Text>
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
          </>
        )}
      </View>

      <View style={styles.divider} />

      {/* ══ OPCIONES ═════════════════════════════════════════════════════════ */}
      <View>
        <Text style={styles.secTitle}>{t('exerciseEditor.sectionOptions')}</Text>
        <View style={styles.optionsCard}>
          <ToggleRow label="Unilateral" value={isUnilateral} onChange={setIsUnilateral} />
          <View style={styles.optionsDivider} />
          <ToggleRow
            label={t('exerciseEditor.trackRpeLabel')}
            value={trackRpe}
            onChange={(v) => {
              setTrackRpe(v);
              if (!v && evalMode === 'rpe') setEvalMode('all_complete');
            }}
          />
          <View style={styles.optionsDivider} />
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
              placeholderTextColor={th.colors.muted2}
              keyboardType="default"
              autoCapitalize="characters"
              returnKeyType="done"
            />
          </View>
          <View style={styles.optionsDivider} />
          <View style={styles.noteBlock}>
            <Text style={styles.toggleLabel}>{t('exerciseEditor.trainerNoteLabel')}</Text>
            <Text style={styles.tempoHint}>{t('exerciseEditor.trainerNoteHint')}</Text>
            <TextInput
              style={styles.noteInput}
              value={trainerNote}
              onChangeText={setTrainerNote}
              placeholder={t('exerciseEditor.trainerNotePlaceholder')}
              placeholderTextColor={th.colors.muted2}
              multiline
              maxLength={280}
            />
          </View>
        </View>
      </View>

      {/* ══ ACCIONES ═════════════════════════════════════════════════════════ */}
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

const makeStyles = (th) => StyleSheet.create({

  container: {
    padding:       spacing.lg,
    paddingBottom: spacing.xxl + spacing.lg,
    gap:           spacing.lg,
  },

  // ── Section headers ────────────────────────────────────────────────────────
  sectionHeader: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    marginBottom:   spacing.sm,
  },
  secTitle: {
    fontSize:      typography.xs,
    fontWeight:    typography.bold,
    color:         th.colors.muted,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom:  spacing.sm,
  },
  subSecTitle: {
    fontSize:      typography.xs,
    fontWeight:    typography.bold,
    color:         th.colors.muted,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop:     spacing.lg,
    marginBottom:  spacing.sm,
  },

  // ── Dividers ───────────────────────────────────────────────────────────────
  divider: {
    height:          StyleSheet.hairlineWidth,
    backgroundColor: th.colors.border,
  },

  // ── Hints ─────────────────────────────────────────────────────────────────
  hint: {
    fontSize:   typography.xs,
    color:      th.colors.muted2,
    lineHeight: typography.xs * 1.5,
    marginTop:  spacing.xs,
  },

  // ── Metric pills ───────────────────────────────────────────────────────────
  metricBtns: {
    flexDirection: 'row',
    gap:           spacing.xs,
  },
  metricBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical:   4,
    borderRadius:      th.radius.sm,
    borderWidth:       borders.thin,
    borderColor:       th.colors.border,
    backgroundColor:   th.colors.surface,
  },
  metricBtnActive: {
    backgroundColor: withOpacity(th.colors.accent, 0.10),
    borderColor:     withOpacity(th.colors.accent, 0.40),
  },
  metricBtnText: {
    fontSize:   typography.xs,
    color:      th.colors.muted,
    fontWeight: typography.medium,
  },
  metricBtnTextActive: {
    color: th.colors.accent,
  },

  // ── Field grid ─────────────────────────────────────────────────────────────
  fieldRow: {
    flexDirection: 'row',
    gap:           spacing.sm,
  },

  // ── Segmented picker ───────────────────────────────────────────────────────
  segRow: {
    flexDirection: 'row',
    gap:           spacing.xs,
  },
  segBtn: {
    flex:            1,
    paddingVertical: spacing.sm,
    borderRadius:    th.radius.sm,
    borderWidth:     borders.thin,
    borderColor:     th.colors.border,
    backgroundColor: th.colors.surface,
    alignItems:      'center',
  },
  segBtnActive: {
    backgroundColor: withOpacity(th.colors.accent, 0.10),
    borderColor:     withOpacity(th.colors.accent, 0.40),
  },
  segLabel: {
    fontSize:   typography.sm,
    color:      th.colors.muted,
    fontWeight: typography.medium,
  },
  segLabelActive: {
    color: th.colors.accent,
  },

  // ── Increment input ────────────────────────────────────────────────────────
  incrInputRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.sm,
  },
  incrInput: {
    backgroundColor:    th.colors.surface,
    borderWidth:        borders.thin,
    borderColor:        th.colors.border,
    borderRadius:       th.radius.sm,
    paddingHorizontal:  spacing.md,
    height:             38,
    fontSize:           typography.md,
    fontWeight:         typography.medium,
    color:              th.colors.text,
    textAlign:          'center',
    textAlignVertical:  'center',
    includeFontPadding: false,
    minWidth:           80,
  },
  incrUnit: {
    fontSize:   typography.sm,
    color:      th.colors.muted,
    fontWeight: typography.medium,
  },

  // ── Min increment ──────────────────────────────────────────────────────────
  incrMinRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    gap:            spacing.sm,
    marginTop:      spacing.sm,
  },
  incrMinMeta: { flex: 1 },
  incrMinLabel: {
    fontSize:   typography.sm,
    color:      th.colors.text,
    fontWeight: typography.medium,
  },

  // ── Options card ───────────────────────────────────────────────────────────
  optionsCard: {
    backgroundColor: th.colors.surface,
    borderWidth:     borders.thin,
    borderColor:     th.colors.border,
    borderRadius:    th.radius.md,
  },
  optionsDivider: {
    height:          borders.thin,
    backgroundColor: th.colors.border,
  },

  // ── Toggle ─────────────────────────────────────────────────────────────────
  toggleRow: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingVertical:   spacing.sm,
    paddingHorizontal: spacing.md,
  },
  toggleLabel: {
    fontSize:   typography.sm,
    color:      th.colors.text,
    fontWeight: typography.medium,
  },
  track: {
    width:           40,
    height:          22,
    borderRadius:    11,
    backgroundColor: th.colors.border,
    padding:         2,
    justifyContent:  'center',
  },
  trackOn: {
    backgroundColor: withOpacity(th.colors.accent, 0.25),
    borderWidth:     1,
    borderColor:     withOpacity(th.colors.accent, 0.6),
  },
  thumb: {
    width:           18,
    height:          18,
    borderRadius:    9,
    backgroundColor: th.colors.muted,
  },
  thumbOn: {
    backgroundColor: th.colors.accent,
    transform:       [{ translateX: 18 }],
  },

  // ── Tempo ──────────────────────────────────────────────────────────────────
  tempoRow: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingVertical:   spacing.sm,
    paddingHorizontal: spacing.md,
    gap:               spacing.sm,
  },
  tempoMeta: { flex: 1, gap: 2 },
  tempoHint: { fontSize: 9, color: th.colors.muted2, lineHeight: 13, marginTop: 2 },
  noteBlock: {
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.sm,
    gap: 2,
  },
  noteInput: {
    marginTop:        spacing.xs,
    backgroundColor:  th.colors.surface2,
    borderWidth:      borders.thin,
    borderColor:      th.colors.border,
    borderRadius:     th.radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical:  spacing.sm,
    color:            th.colors.text,
    fontSize:         typography.sm,
    minHeight:        60,
    textAlignVertical: 'top',
  },
  tempoInput: {
    backgroundColor:    th.colors.surface2,
    borderWidth:        borders.thin,
    borderColor:        th.colors.border,
    borderRadius:       th.radius.sm,
    paddingHorizontal:  spacing.sm,
    paddingVertical:    7,
    fontSize:           typography.md,
    fontWeight:         typography.semibold,
    color:              th.colors.text,
    width:              72,
    textAlign:          'center',
    textAlignVertical:  'center',
    includeFontPadding: false,
    letterSpacing:      4,
  },

  // ── Action buttons ─────────────────────────────────────────────────────────
  btnRow: {
    flexDirection: 'row',
    gap:           spacing.xs,
  },
  substituteBtn: {
    flex:            1,
    alignItems:      'center',
    paddingVertical: spacing.sm,
    backgroundColor: th.colors.surface,
    borderRadius:    th.radius.sm,
    borderWidth:     borders.thin,
    borderColor:     th.colors.border,
  },
  substituteBtnText: {
    fontSize:   typography.sm,
    color:      th.colors.text,
    fontWeight: typography.medium,
  },
  restoreBtn: {
    alignItems:        'center',
    justifyContent:    'center',
    paddingVertical:   spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius:      th.radius.sm,
    borderWidth:       borders.thin,
    borderColor:       th.colors.border,
  },
  restoreBtnDisabled:     { opacity: 0.35 },
  restoreBtnText:         { fontSize: typography.sm, color: th.colors.muted, fontWeight: typography.medium },
  restoreBtnTextDisabled: {},
});
