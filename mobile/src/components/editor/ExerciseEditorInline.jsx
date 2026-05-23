import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../../store/useStore';
import { colors, spacing, typography, radius, borders } from '../../theme';

const PROGRESSION_MODELS = [
  { id: 'double_progression', label: 'Doble progresión', desc: 'Peso + reps' },
  { id: 'time_progression',   label: 'Tiempo',           desc: 'Progresión temporal' },
  { id: 'submax',             label: 'Submáximo',        desc: 'RIR / esfuerzo' },
];

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
  wrap: { flex: 1 },
  label: { fontSize: typography.xs, color: colors.muted, letterSpacing: 1, textTransform: 'uppercase', marginBottom: spacing.xs, textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', borderWidth: borders.thin, borderColor: colors.borderCard, borderRadius: radius.sm, overflow: 'hidden' },
  stepBtn: { width: 36, height: 38, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface2 },
  stepText: { fontSize: 18, color: colors.muted, lineHeight: 22 },
  valueInput: { flex: 1, textAlign: 'center', fontSize: typography.md, fontWeight: typography.medium, color: colors.text, backgroundColor: colors.surface, height: 38 },
});

// ─── ExerciseEditorInline ─────────────────────────────────────────────────────

export default function ExerciseEditorInline({ templateId, exConfig, def, onClose, navigation }) {
  const { t } = useTranslation();

  const updateExerciseParams = useStore((s) => s.updateExerciseParams);
  const showToast = useStore((s) => s.showToast);

  const [sets, setSets] = useState(exConfig.sets ?? 3);
  const [restSec, setRestSec] = useState(exConfig.restSec ?? 90);
  const [minReps, setMinReps] = useState(exConfig.minReps ?? def?.minReps ?? 8);
  const [maxReps, setMaxReps] = useState(exConfig.maxReps ?? def?.maxReps ?? 12);
  const [minTime, setMinTime] = useState(exConfig.minTime ?? def?.minTime ?? 20);
  const [maxTime, setMaxTime] = useState(exConfig.maxTime ?? def?.maxTime ?? 40);
  const [progressionModel, setProgressionModel] = useState(
    exConfig.progressionModel ?? def?.progressionModel ?? 'double_progression'
  );

  const isTime   = progressionModel === 'time_progression';
  const isSubmax = progressionModel === 'submax';

  function handleSave() {
    const updates = { sets, restSec, progressionModel };
    if (isTime) {
      updates.minTime = minTime;
      updates.maxTime = maxTime;
      updates.minReps = null;
      updates.maxReps = null;
    } else if (!isSubmax) {
      updates.minReps = minReps;
      updates.maxReps = maxReps;
      updates.minTime = null;
      updates.maxTime = null;
    }
    updateExerciseParams(templateId, exConfig.exerciseId, updates);
    showToast(t('exerciseEditor.toastUpdated'));
    onClose();
  }

  function handleSubstitute() {
    navigation.navigate('ExerciseSelector', {
      templateId,
      currentExerciseId: exConfig.exerciseId,
      existingPatterns: [],
    });
    onClose();
  }

  return (
    <View style={styles.container}>

      {/* Progression model — solo custom */}
      {def?.isCustom && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>TIPO DE PROGRESIÓN</Text>
          <View style={styles.modelRow}>
            {PROGRESSION_MODELS.map((m) => (
              <TouchableOpacity
                key={m.id}
                style={[styles.modelBtn, progressionModel === m.id && styles.modelBtnActive]}
                onPress={() => setProgressionModel(m.id)}
              >
                <Text style={[styles.modelLabel, progressionModel === m.id && styles.modelLabelActive]}>{m.label}</Text>
                <Text style={[styles.modelDesc, progressionModel === m.id && styles.modelDescActive]}>{m.desc}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Sets + Rest */}
      <View style={styles.fieldRow}>
        <StepField label={t('exerciseEditor.fieldSets')} value={sets} onChange={setSets} min={1} max={8} />
        <StepField label={t('exerciseEditor.fieldRest')} value={restSec} onChange={setRestSec} min={30} max={300} />
      </View>

      {/* Rep / time range */}
      {isTime ? (
        <View style={styles.fieldRow}>
          <StepField label={t('exerciseEditor.fieldMinTime')} value={minTime} onChange={setMinTime} min={5} max={300} />
          <StepField label={t('exerciseEditor.fieldMaxTime')} value={maxTime} onChange={setMaxTime} min={5} max={300} />
        </View>
      ) : !isSubmax ? (
        <View style={styles.fieldRow}>
          <StepField label={t('exerciseEditor.fieldMinReps')} value={minReps} onChange={setMinReps} min={1} max={50} />
          <StepField label={t('exerciseEditor.fieldMaxReps')} value={maxReps} onChange={setMaxReps} min={1} max={50} />
        </View>
      ) : (
        <Text style={styles.submaxHint}>{t('exerciseEditor.submaxHint')}</Text>
      )}

      {/* Buttons */}
      <View style={styles.btnRow}>
        <TouchableOpacity style={styles.substituteBtn} onPress={handleSubstitute}>
          <Text style={styles.substituteBtnText}>{t('exerciseEditor.substituteBtn')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
          <Text style={styles.cancelBtnText}>{t('common.cancel')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
          <Text style={styles.saveBtnText}>{t('exerciseEditor.saveBtn')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface2,
    borderWidth: borders.thin, borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.xs,
    gap: spacing.md,
  },
  section: {},
  sectionLabel: { fontSize: typography.xs, color: colors.muted, letterSpacing: 1, marginBottom: spacing.xs },
  modelRow: { flexDirection: 'row', gap: spacing.xs },
  modelBtn: {
    flex: 1, padding: spacing.xs + 2,
    backgroundColor: colors.surface, borderRadius: radius.sm,
    borderWidth: borders.thin, borderColor: colors.border,
    alignItems: 'flex-start',
  },
  modelBtnActive: { backgroundColor: `rgba(232,255,71,0.08)`, borderColor: `rgba(232,255,71,0.3)` },
  modelLabel: { fontSize: typography.xs, color: colors.muted, fontWeight: typography.medium },
  modelLabelActive: { color: colors.accent },
  modelDesc: { fontSize: 9, color: colors.muted2, marginTop: 2 },
  modelDescActive: { color: `rgba(232,255,71,0.6)` },
  fieldRow: { flexDirection: 'row', gap: spacing.sm },
  submaxHint: { fontSize: typography.xs, color: colors.muted, lineHeight: 16 },
  btnRow: { flexDirection: 'row', gap: spacing.xs },
  substituteBtn: {
    flex: 1, alignItems: 'center', paddingVertical: spacing.sm,
    backgroundColor: colors.surface, borderRadius: radius.sm,
    borderWidth: borders.thin, borderColor: colors.borderCard,
  },
  substituteBtnText: { fontSize: typography.xs, color: colors.text },
  cancelBtn: {
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: spacing.sm, paddingHorizontal: spacing.md,
    borderRadius: radius.sm, borderWidth: borders.thin, borderColor: colors.borderCard,
  },
  cancelBtnText: { fontSize: typography.xs, color: colors.muted },
  saveBtn: {
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: spacing.sm, paddingHorizontal: spacing.lg,
    borderRadius: radius.sm, backgroundColor: colors.accent,
  },
  saveBtnText: { fontSize: 14, color: colors.onAccent, fontFamily: 'BebasNeue_400Regular', letterSpacing: 1 },
});
