import { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../../store/useStore';
import { colors, spacing, typography, radius, borders, withOpacity } from '../../theme';

const PROGRESSION_MODELS = [
  { id: 'double_progression', label: 'Doble progresión', desc: 'Peso + reps' },
  { id: 'time_progression',   label: 'Tiempo',           desc: 'Progresión temporal' },
  { id: 'submax',             label: 'Submáximo',        desc: 'RIR / esfuerzo' },
];

// ─── StepField ────────────────────────────────────────────────────────────────

function StepField({ label, value, onChange, min, max }) {
  const numVal = Number(value);
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
          value={String(value)}
          onChangeText={(v) => {
            const n = parseInt(v);
            if (!isNaN(n)) onChange(Math.min(max, Math.max(min, n)));
          }}
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

// ─── ExerciseEditorInline ─────────────────────────────────────────────────────

export default function ExerciseEditorInline({ templateId, exConfig, def, onClose, navigation }) {
  const { t } = useTranslation();
  const updateExerciseParams = useStore((s) => s.updateExerciseParams);

  // ── Snapshot initial config ───────────────────────────────────────────────
  const initInputType = exConfig.inputType ?? (
    (exConfig.progressionModel ?? def?.progressionModel) === 'time_progression' ? 'time' : 'weight_reps'
  );
  const initMetric = initInputType === 'time' || initInputType === 'weight_time' ? 'time' : 'reps';

  const initialRef = useRef({
    sets:             exConfig.sets             ?? 3,
    restSec:          exConfig.restSec          ?? 90,
    minReps:          exConfig.minReps          ?? def?.minReps ?? 8,
    maxReps:          exConfig.maxReps          ?? def?.maxReps ?? 12,
    minTime:          exConfig.minTime          ?? def?.minTime ?? 20,
    maxTime:          exConfig.maxTime          ?? def?.maxTime ?? 40,
    progressionModel: exConfig.progressionModel ?? def?.progressionModel ?? 'double_progression',
    metric:           initMetric,
    isUnilateral:     exConfig.isUnilateral     ?? def?.isUnilateral ?? false,
    tempo:            exConfig.tempo            ?? '',
  });

  const [sets,             setSets]             = useState(initialRef.current.sets);
  const [restSec,          setRestSec]          = useState(initialRef.current.restSec);
  const [minReps,          setMinReps]          = useState(initialRef.current.minReps);
  const [maxReps,          setMaxReps]          = useState(initialRef.current.maxReps);
  const [minTime,          setMinTime]          = useState(initialRef.current.minTime);
  const [maxTime,          setMaxTime]          = useState(initialRef.current.maxTime);
  const [progressionModel, setProgressionModel] = useState(initialRef.current.progressionModel);
  const [metric,           setMetric]           = useState(initialRef.current.metric);
  const [isUnilateral,     setIsUnilateral]     = useState(initialRef.current.isUnilateral);
  const [tempo,            setTempo]            = useState(initialRef.current.tempo);

  // ── Always-current ref for flush-on-unmount ────────────────────────────────
  const stateRef  = useRef(null);
  const dirtyRef  = useRef(false);
  const timerRef  = useRef(null);
  const updateRef = useRef(updateExerciseParams);
  useEffect(() => { updateRef.current = updateExerciseParams; }, [updateExerciseParams]);

  stateRef.current = { sets, restSec, minReps, maxReps, minTime, maxTime, progressionModel, metric, isUnilateral, tempo };

  // ── Commit helper ─────────────────────────────────────────────────────────
  const commitValues = useCallback((s) => {
    const isTimeMode   = s.metric === 'time';
    const isSubmaxMode = s.progressionModel === 'submax';
    const inputType    = s.metric === 'time' ? 'weight_time' : 'weight_reps';
    const updates = {
      sets: s.sets, restSec: s.restSec,
      progressionModel: s.progressionModel,
      inputType,
      isUnilateral: s.isUnilateral,
      tempo: s.tempo.trim() || null,
    };
    if (isTimeMode) {
      updates.minTime = s.minTime;
      updates.maxTime = s.maxTime;
      updates.minReps = null;
      updates.maxReps = null;
    } else if (!isSubmaxMode) {
      updates.minReps = s.minReps;
      updates.maxReps = s.maxReps;
    }
    updateRef.current(templateId, exConfig.exerciseId, updates);
  }, [templateId, exConfig.exerciseId]);

  // ── Debounced commit on any change ────────────────────────────────────────
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    dirtyRef.current = true;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      commitValues(stateRef.current);
    }, 400);
    return () => clearTimeout(timerRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sets, restSec, minReps, maxReps, minTime, maxTime, progressionModel, metric, isUnilateral, tempo]);

  // ── Flush pending commit on unmount (preserves changes on top-X close) ───
  useEffect(() => {
    return () => {
      if (dirtyRef.current) {
        clearTimeout(timerRef.current);
        commitValues(stateRef.current);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── isChanged ─────────────────────────────────────────────────────────────
  const i = initialRef.current;
  const isChanged =
    sets !== i.sets || restSec !== i.restSec ||
    minReps !== i.minReps || maxReps !== i.maxReps ||
    minTime !== i.minTime || maxTime !== i.maxTime ||
    progressionModel !== i.progressionModel ||
    metric !== i.metric ||
    isUnilateral !== i.isUnilateral ||
    tempo !== i.tempo;

  // ── Restore to initial ────────────────────────────────────────────────────
  function handleRestore() {
    clearTimeout(timerRef.current);
    setSets(i.sets);
    setRestSec(i.restSec);
    setMinReps(i.minReps);
    setMaxReps(i.maxReps);
    setMinTime(i.minTime);
    setMaxTime(i.maxTime);
    setProgressionModel(i.progressionModel);
    setMetric(i.metric);
    setIsUnilateral(i.isUnilateral);
    setTempo(i.tempo);
    // Immediately revert store (don't wait for debounce)
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

  const isTime   = metric === 'time';
  const isSubmax = progressionModel === 'submax';

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

      {/* ── Progresión (solo custom) ── */}
      {def?.isCustom && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>PROGRESIÓN</Text>
          <View style={styles.modelRow}>
            {PROGRESSION_MODELS.map((m) => (
              <TouchableOpacity
                key={m.id}
                style={[styles.modelBtn, progressionModel === m.id && styles.modelBtnActive]}
                onPress={() => setProgressionModel(m.id)}
              >
                <Text style={[styles.modelLabel, progressionModel === m.id && styles.modelLabelActive]}>
                  {m.label}
                </Text>
                <Text style={[styles.modelDesc, progressionModel === m.id && styles.modelDescActive]}>
                  {m.desc}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* ── Series + Descanso ── */}
      <View style={styles.fieldRow}>
        <StepField label={t('exerciseEditor.fieldSets')}  value={sets}    onChange={setSets}    min={1}  max={8}   />
        <StepField label={t('exerciseEditor.fieldRest')}  value={restSec} onChange={setRestSec} min={30} max={300} />
      </View>

      {/* ── Rango reps / tiempo ── */}
      {isTime ? (
        <View style={styles.fieldRow}>
          <StepField label={t('exerciseEditor.fieldMinTime')} value={minTime} onChange={setMinTime} min={5}  max={300} />
          <StepField label={t('exerciseEditor.fieldMaxTime')} value={maxTime} onChange={setMaxTime} min={5}  max={300} />
        </View>
      ) : !isSubmax ? (
        <View style={styles.fieldRow}>
          <StepField label={t('exerciseEditor.fieldMinReps')} value={minReps} onChange={setMinReps} min={1} max={50} />
          <StepField label={t('exerciseEditor.fieldMaxReps')} value={maxReps} onChange={setMaxReps} min={1} max={50} />
        </View>
      ) : (
        <Text style={styles.submaxHint}>{t('exerciseEditor.submaxHint')}</Text>
      )}

      {/* ── Opciones: unilateral + tempo ── */}
      <View style={styles.optionsBlock}>

        <ToggleRow label="Unilateral" value={isUnilateral} onChange={setIsUnilateral} />

        <View style={styles.divider} />

        {/* Tempo: label + hint on left, input on right */}
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

      {/* ── Acciones: [Substituir] [Restaurar] ── */}
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

  // ── Progression model ──────────────────────────────────────────────────────
  modelRow: {
    flexDirection: 'row',
    gap:           spacing.xs,
  },
  modelBtn: {
    flex:            1,
    padding:         spacing.xs + 2,
    backgroundColor: colors.surface,
    borderRadius:    radius.sm,
    borderWidth:     borders.thin,
    borderColor:     colors.border,
    alignItems:      'flex-start',
  },
  modelBtnActive:   { backgroundColor: 'rgba(232,255,71,0.08)', borderColor: 'rgba(232,255,71,0.3)' },
  modelLabel:       { fontSize: typography.xs, color: colors.muted, fontWeight: typography.medium },
  modelLabelActive: { color: colors.accent },
  modelDesc:        { fontSize: 9, color: colors.muted2, marginTop: 2 },
  modelDescActive:  { color: 'rgba(232,255,71,0.6)' },

  // ── Step fields ────────────────────────────────────────────────────────────
  fieldRow:   { flexDirection: 'row', gap: spacing.sm },
  submaxHint: { fontSize: typography.xs, color: colors.muted, lineHeight: 16 },

  // ── Options block ──────────────────────────────────────────────────────────
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

  // Tempo — label+hint left, input right
  tempoRow: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'space-between',
    paddingVertical: spacing.sm,
    gap:             spacing.sm,
  },
  tempoMeta: {
    flex: 1,
    gap:  2,
  },
  tempoHint: {
    fontSize:   9,
    color:      colors.muted2,
    lineHeight: 13,
    marginTop:  2,
  },
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
  restoreBtnDisabled: {
    opacity: 0.35,
  },
  restoreBtnText: {
    fontSize:   typography.sm,
    color:      colors.muted,
    fontWeight: typography.medium,
  },
  restoreBtnTextDisabled: {},
});
