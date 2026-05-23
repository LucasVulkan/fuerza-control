import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, SafeAreaView, Switch,
} from 'react-native';
import { useStore } from '../../store/useStore';
import { colors, spacing, typography, radius, borders } from '../theme';

const PATTERNS = [
  { value: 'vertical_pull',   label: 'Tracción vertical' },
  { value: 'horizontal_pull', label: 'Tracción horizontal' },
  { value: 'vertical_push',   label: 'Empuje vertical' },
  { value: 'horizontal_push', label: 'Empuje horizontal' },
  { value: 'squat',           label: 'Pierna rodilla' },
  { value: 'hip_hinge',       label: 'Pierna cadera' },
  { value: 'core',            label: 'Core' },
  { value: 'carry_grip',      label: 'Agarre / Carga' },
  { value: 'calf_raise',      label: 'Gemelos' },
];

const EQUIPMENT_OPTIONS = [
  { value: 'barbell',         label: 'Barra' },
  { value: 'dumbbell',        label: 'Mancuernas' },
  { value: 'cables',          label: 'Poleas / cables' },
  { value: 'machines',        label: 'Máquinas' },
  { value: 'pullup_bar',      label: 'Barra de dominadas' },
  { value: 'resistance_band', label: 'Banda elástica' },
  { value: 'bodyweight',      label: 'Peso corporal' },
  { value: 'kettlebell',      label: 'Kettlebell' },
  { value: 'rings',           label: 'Anillas' },
  { value: 'parallettes',     label: 'Paralelas' },
];

function generateCustomId() {
  return 'custom_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
}

export default function CustomExerciseScreen({ navigation, route }) {
  const { templateId, currentExerciseId } = route.params ?? {};

  const addCustomExercise = useStore((s) => s.addCustomExercise);
  const addExercise = useStore((s) => s.addExercise);
  const replaceExercise = useStore((s) => s.replaceExercise);
  const showToast = useStore((s) => s.showToast);

  const [advanced, setAdvanced] = useState(false);
  const [errors, setErrors] = useState({});
  const [form, setForm] = useState({
    name: '', pattern: '',
    sets: 3, minReps: 8, maxReps: 12, restSec: 90,
    equipment: [], isUnilateral: false,
    progressionModel: 'double_progression', level: 'intermediate', notes: '',
  });

  function set_(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    if (errors[field]) setErrors((e) => ({ ...e, [field]: null }));
  }

  function toggleEquipment(val) {
    setForm((f) => ({
      ...f,
      equipment: f.equipment.includes(val)
        ? f.equipment.filter((e) => e !== val)
        : [...f.equipment, val],
    }));
  }

  function handleCreate() {
    const errs = {};
    if (!form.name.trim()) errs.name = 'El nombre es obligatorio';
    if (!form.pattern)     errs.pattern = 'Selecciona un patrón';
    if (Object.keys(errs).length) { setErrors(errs); return; }

    const id = generateCustomId();
    const def = {
      id,
      name: form.name.trim(),
      pattern: form.pattern,
      primaryGroup: 'custom',
      muscles: [],
      equipment: form.equipment,
      level: form.level,
      isCompound: true,
      isKeyCandidate: true,
      isUnilateral: form.isUnilateral,
      progressionModel: form.progressionModel,
      progressionDirection: 'increase',
      minReps: parseInt(form.minReps),
      maxReps: parseInt(form.maxReps),
      weightStep: 2.5,
      restSec: parseInt(form.restSec),
      tips: form.notes.trim() ? [form.notes.trim()] : [],
      isCustom: true,
    };

    addCustomExercise(def);
    if (templateId) {
      if (currentExerciseId) {
        replaceExercise(templateId, currentExerciseId, id);
        showToast('Ejercicio sustituido');
      } else {
        addExercise(templateId, id);
        showToast('Ejercicio añadido');
      }
    }
    // Go back twice: CustomExercise → ExerciseSelector → DayEditorCard
    navigation.pop(2);
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>NUEVO EJERCICIO</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
          <Text style={styles.closeBtn}>✕</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.form}
        keyboardShouldPersistTaps="handled"
      >
        {/* Nombre */}
        <View style={styles.field}>
          <Text style={styles.label}>NOMBRE *</Text>
          <TextInput
            style={[styles.input, errors.name && styles.inputError]}
            placeholder="Ej: Press Pallof con cable"
            placeholderTextColor={colors.muted}
            value={form.name}
            onChangeText={(v) => set_('name', v)}
          />
          {!!errors.name && <Text style={styles.errorText}>{errors.name}</Text>}
        </View>

        {/* Patrón */}
        <View style={styles.field}>
          <Text style={styles.label}>PATRÓN DE MOVIMIENTO *</Text>
          <View style={[styles.patternGrid, errors.pattern && { borderColor: colors.red }]}>
            {PATTERNS.map((p) => (
              <TouchableOpacity
                key={p.value}
                style={[styles.patternChip, form.pattern === p.value && styles.patternChipActive]}
                onPress={() => set_('pattern', p.value)}
              >
                <Text style={[styles.patternChipText, form.pattern === p.value && styles.patternChipTextActive]}>
                  {p.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {!!errors.pattern && <Text style={styles.errorText}>{errors.pattern}</Text>}
        </View>

        {/* Series, Reps mín, Reps máx */}
        <View style={styles.field}>
          <View style={styles.row3}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>SERIES</Text>
              <TextInput
                style={styles.input} keyboardType="numeric"
                value={String(form.sets)} onChangeText={(v) => set_('sets', v)}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>REPS MÍN</Text>
              <TextInput
                style={styles.input} keyboardType="numeric"
                value={String(form.minReps)} onChangeText={(v) => set_('minReps', v)}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>REPS MÁX</Text>
              <TextInput
                style={styles.input} keyboardType="numeric"
                value={String(form.maxReps)} onChangeText={(v) => set_('maxReps', v)}
              />
            </View>
          </View>
        </View>

        {/* Descanso */}
        <View style={styles.field}>
          <Text style={styles.label}>DESCANSO (SEGUNDOS)</Text>
          <View style={styles.restRow}>
            {[60, 90, 120, 180].map((s) => (
              <TouchableOpacity
                key={s}
                style={[styles.restChip, form.restSec === s && styles.restChipActive]}
                onPress={() => set_('restSec', s)}
              >
                <Text style={[styles.restChipText, form.restSec === s && styles.restChipTextActive]}>{s}s</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Equipo */}
        <View style={styles.field}>
          <Text style={styles.label}>MATERIAL NECESARIO</Text>
          <View style={styles.chipWrap}>
            {EQUIPMENT_OPTIONS.map((eq) => {
              const active = form.equipment.includes(eq.value);
              return (
                <TouchableOpacity
                  key={eq.value}
                  style={[styles.equipChip, active && styles.equipChipActive]}
                  onPress={() => toggleEquipment(eq.value)}
                >
                  <Text style={[styles.equipChipText, active && styles.equipChipTextActive]}>{eq.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Notas */}
        <View style={styles.field}>
          <Text style={styles.label}>NOTAS DE EJECUCIÓN</Text>
          <TextInput
            style={[styles.input, { height: 72, textAlignVertical: 'top', paddingTop: spacing.sm }]}
            placeholder="Ej: Mantener la columna neutra..."
            placeholderTextColor={colors.muted}
            value={form.notes}
            onChangeText={(v) => set_('notes', v)}
            multiline
          />
        </View>

        {/* Avanzado */}
        <TouchableOpacity onPress={() => setAdvanced((a) => !a)} style={styles.advancedToggle}>
          <Text style={styles.advancedToggleText}>{advanced ? '▾' : '›'} Opciones avanzadas</Text>
        </TouchableOpacity>

        {advanced && (
          <View style={styles.advancedSection}>
            {/* Unilateral */}
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Ejercicio unilateral (c/lado)</Text>
              <Switch
                value={form.isUnilateral}
                onValueChange={(v) => set_('isUnilateral', v)}
                trackColor={{ false: colors.surface2, true: colors.accent }}
                thumbColor={form.isUnilateral ? colors.onAccent : colors.muted}
              />
            </View>

            {/* Modelo de progresión */}
            <View style={[styles.field, { marginTop: spacing.md }]}>
              <Text style={styles.label}>MODELO DE PROGRESIÓN</Text>
              {[
                { value: 'double_progression', label: 'Doble progresión (peso + reps)' },
                { value: 'time_progression', label: 'Progresión en tiempo' },
                { value: 'submax', label: 'Submáximo (RIR)' },
                { value: 'load_progression', label: 'Progresión de carga' },
              ].map((m) => (
                <TouchableOpacity
                  key={m.value}
                  style={[styles.selectOption, form.progressionModel === m.value && styles.selectOptionActive]}
                  onPress={() => set_('progressionModel', m.value)}
                >
                  <Text style={[styles.selectOptionText, form.progressionModel === m.value && styles.selectOptionTextActive]}>
                    {m.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Nivel */}
            <View style={[styles.field, { marginTop: spacing.sm }]}>
              <Text style={styles.label}>NIVEL TÉCNICO</Text>
              {[
                { value: 'beginner', label: 'Principiante' },
                { value: 'intermediate', label: 'Intermedio' },
                { value: 'advanced', label: 'Avanzado' },
              ].map((lv) => (
                <TouchableOpacity
                  key={lv.value}
                  style={[styles.selectOption, form.level === lv.value && styles.selectOptionActive]}
                  onPress={() => set_('level', lv.value)}
                >
                  <Text style={[styles.selectOptionText, form.level === lv.value && styles.selectOptionTextActive]}>
                    {lv.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Bottom buttons */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.cancelBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.cancelBtnText}>Cancelar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.createExBtn} onPress={handleCreate}>
          <Text style={styles.createExBtnText}>CREAR EJERCICIO</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.xl, paddingVertical: spacing.md,
    borderBottomWidth: borders.thin, borderBottomColor: colors.border,
  },
  headerTitle: { fontSize: typography.xl, color: colors.text, fontFamily: 'BebasNeue_400Regular', letterSpacing: 1 },
  closeBtn: { fontSize: 22, color: colors.muted },
  form: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, gap: spacing.md },
  field: {},
  label: { fontSize: typography.xs, color: colors.muted, letterSpacing: 1.5, marginBottom: spacing.xs },
  input: {
    backgroundColor: colors.surface2, borderWidth: borders.thin, borderColor: colors.border,
    borderRadius: radius.md, color: colors.text, fontSize: typography.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2,
  },
  inputError: { borderColor: colors.red },
  errorText: { fontSize: typography.xs, color: colors.red, marginTop: 4 },
  patternGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  patternChip: {
    paddingHorizontal: spacing.sm + 2, paddingVertical: 6,
    backgroundColor: colors.surface2, borderRadius: radius.sm,
    borderWidth: borders.thin, borderColor: colors.border,
  },
  patternChipActive: { backgroundColor: `rgba(232,255,71,0.12)`, borderColor: `rgba(232,255,71,0.4)` },
  patternChipText: { fontSize: typography.xs, color: colors.muted },
  patternChipTextActive: { color: colors.accent },
  row3: { flexDirection: 'row', gap: spacing.sm },
  restRow: { flexDirection: 'row', gap: spacing.xs },
  restChip: {
    flex: 1, alignItems: 'center', paddingVertical: spacing.sm,
    backgroundColor: colors.surface2, borderRadius: radius.sm,
    borderWidth: borders.thin, borderColor: colors.border,
  },
  restChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  restChipText: { fontSize: typography.sm, color: colors.muted },
  restChipTextActive: { color: colors.onAccent },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  equipChip: {
    paddingHorizontal: spacing.sm, paddingVertical: 5,
    backgroundColor: colors.surface2, borderRadius: radius.sm,
    borderWidth: borders.thin, borderColor: colors.border,
  },
  equipChipActive: { backgroundColor: `rgba(232,255,71,0.12)`, borderColor: `rgba(232,255,71,0.4)` },
  equipChipText: { fontSize: typography.xs, color: colors.muted },
  equipChipTextActive: { color: colors.accent },
  advancedToggle: { paddingVertical: spacing.xs },
  advancedToggleText: { fontSize: typography.sm, color: colors.muted },
  advancedSection: {},
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm },
  switchLabel: { fontSize: typography.base, color: colors.text },
  selectOption: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    backgroundColor: colors.surface2, borderRadius: radius.sm,
    borderWidth: borders.thin, borderColor: colors.border,
    marginBottom: spacing.xs,
  },
  selectOptionActive: { backgroundColor: `rgba(232,255,71,0.1)`, borderColor: `rgba(232,255,71,0.4)` },
  selectOptionText: { fontSize: typography.sm, color: colors.muted },
  selectOptionTextActive: { color: colors.accent },
  footer: {
    flexDirection: 'row', gap: spacing.sm,
    paddingHorizontal: spacing.xl, paddingVertical: spacing.md,
    borderTopWidth: borders.thin, borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
  cancelBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 13, borderRadius: radius.md,
    borderWidth: borders.thin, borderColor: colors.border,
  },
  cancelBtnText: { fontSize: typography.base, color: colors.text },
  createExBtn: {
    flex: 2, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 13, borderRadius: radius.md,
    backgroundColor: colors.accent,
  },
  createExBtnText: {
    fontSize: 18, color: colors.onAccent,
    fontFamily: 'BebasNeue_400Regular', letterSpacing: 1.5,
  },
});
