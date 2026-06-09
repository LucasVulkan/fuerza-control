import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Switch, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from '../../store/useStore';
import { colors, spacing, typography, radius, borders, withOpacity } from '../theme';

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

// ─── StepField — igual que en ExerciseEditorInline ────────────────────────────
function StepField({ label, value, onChange, min, max }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => { setDraft(String(value)); }, [value]);
  const numVal = Number(value);

  return (
    <View style={sf.card}>
      <Text style={sf.label}>{label}</Text>
      <View style={sf.row}>
        <TouchableOpacity style={sf.btn} onPress={() => onChange(Math.max(min, numVal - 1))}>
          <Text style={sf.btnText}>−</Text>
        </TouchableOpacity>
        <TextInput
          style={sf.valueInput}
          keyboardType="numeric"
          value={draft}
          onChangeText={(v) => setDraft(v.replace(/[^0-9]/g, ''))}
          onBlur={() => {
            const n = parseInt(draft, 10);
            if (!isNaN(n)) { const c = Math.min(max, Math.max(min, n)); setDraft(String(c)); onChange(c); }
            else setDraft(String(value));
          }}
          selectTextOnFocus
        />
        <TouchableOpacity style={sf.btn} onPress={() => onChange(Math.min(max, numVal + 1))}>
          <Text style={sf.btnText}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const sf = StyleSheet.create({
  card: {
    flex:            1,
    backgroundColor: colors.surface,
    borderWidth:     borders.thin,
    borderColor:     colors.border,
    borderRadius:    radius.md,
    padding:         spacing.sm + 2,
    gap:             6,
  },
  label: {
    fontSize:      typography.xs,
    color:         colors.muted,
    letterSpacing: 0.5,
    fontWeight:    typography.medium,
    textAlign:     'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  btn: {
    width:           36,
    height:          36,
    borderRadius:    radius.sm,
    borderWidth:     borders.thin,
    borderColor:     colors.border,
    backgroundColor: colors.surface2,
    alignItems:      'center',
    justifyContent:  'center',
  },
  btnText: { fontSize: 18, color: colors.muted, lineHeight: 22 },
  valueInput: {
    flex:               1,
    textAlign:          'center',
    textAlignVertical:  'center',
    includeFontPadding: false,
    fontSize:           typography.lg,
    fontWeight:         typography.bold,
    color:              colors.text,
    backgroundColor:    'transparent',
    height:             36,
    paddingVertical:    0,
  },
});

export default function CustomExerciseScreen({ navigation, route }) {
  const { templateId, currentExerciseId, sessionMode = false } = route.params ?? {};
  const insets = useSafeAreaInsets();

  const addCustomExercise = useStore((s) => s.addCustomExercise);
  const addExercise       = useStore((s) => s.addExercise);
  const replaceExercise   = useStore((s) => s.replaceExercise);
  const addAdHocExercise  = useStore((s) => s.addAdHocExercise);
  const showToast         = useStore((s) => s.showToast);

  const [advanced, setAdvanced] = useState(false);
  const [errors,   setErrors]   = useState({});
  const [form, setForm] = useState({
    name: '', pattern: '',
    sets: 3, minReps: 8, maxReps: 12, restSec: 90,
    equipment: [], isUnilateral: false,
    progressionModel: 'double_progression', level: 'intermediate', notes: '',
    // Flexible tracking
    metric: 'reps',       // 'reps' | 'time'
    tempo: '',
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

  // Always include weight — user simply leaves it blank when not applicable
  function derivedInputType() {
    return form.metric === 'time' ? 'weight_time' : 'weight_reps';
  }

  function handleCreate() {
    const errs = {};
    if (!form.name.trim()) errs.name = 'El nombre es obligatorio';
    if (Object.keys(errs).length) { setErrors(errs); return; }

    const id  = generateCustomId();
    const itp = derivedInputType();
    const def = {
      id,
      name:                 form.name.trim(),
      pattern:              form.pattern,
      primaryGroup:         'custom',
      muscles:              [],
      equipment:            form.equipment,
      level:                form.level,
      isCompound:           true,
      isKeyCandidate:       true,
      isUnilateral:         form.isUnilateral,
      progressionModel:     form.progressionModel,
      progressionDirection: 'increase',
      sets:                 parseInt(form.sets)    || 3,
      minReps:              parseInt(form.minReps) || 8,
      maxReps:              parseInt(form.maxReps) || 12,
      weightStep:           2.5,
      restSec:              parseInt(form.restSec) || 90,
      tips:                 form.notes.trim() ? [form.notes.trim()] : [],
      isCustom:             true,
      // Flexible tracking defaults
      inputType:            itp,
      tempo:                form.tempo.trim() || null,
    };

    addCustomExercise(def);

    if (sessionMode) {
      addAdHocExercise(id);
      showToast('Ejercicio añadido', 2200, 'success');
    } else if (templateId) {
      if (currentExerciseId) {
        replaceExercise(templateId, currentExerciseId, id);
        showToast('Ejercicio sustituido', 2200, 'success');
      } else {
        addExercise(templateId, id);
        showToast('Ejercicio añadido', 2200, 'success');
      }
    }
    navigation.pop(2);
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>NUEVO EJERCICIO</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
          <Text style={styles.closeBtn}>✕</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top + 56}
      >
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

          {/* Tipo de seguimiento */}
          <View style={styles.field}>
            <Text style={styles.label}>TIPO DE SEGUIMIENTO</Text>
            {/* Reps / Tiempo */}
            <View style={styles.segRow}>
              <TouchableOpacity
                style={[styles.segBtn, form.metric === 'reps' && styles.segBtnActive]}
                onPress={() => set_('metric', 'reps')}
              >
                <Text style={[styles.segLabel, form.metric === 'reps' && styles.segLabelActive]}>Reps</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.segBtn, form.metric === 'time' && styles.segBtnActive]}
                onPress={() => set_('metric', 'time')}
              >
                <Text style={[styles.segLabel, form.metric === 'time' && styles.segLabelActive]}>Tiempo</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Series + rango */}
          <View style={styles.stepRow}>
            <StepField label="SERIES"   value={form.sets}    onChange={(v) => set_('sets', v)}    min={1}  max={8}   />
            <StepField
              label={form.metric === 'reps' ? 'REPS MÍN' : 'SEG MÍN'}
              value={form.minReps}
              onChange={(v) => set_('minReps', v)}
              min={1} max={form.metric === 'reps' ? 50 : 300}
            />
            <StepField
              label={form.metric === 'reps' ? 'REPS MÁX' : 'SEG MÁX'}
              value={form.maxReps}
              onChange={(v) => set_('maxReps', v)}
              min={1} max={form.metric === 'reps' ? 50 : 300}
            />
          </View>

          {/* Descanso */}
          <View style={styles.stepRow}>
            <StepField label="DESCANSO (s)" value={form.restSec} onChange={(v) => set_('restSec', v)} min={15} max={600} />
          </View>

          {/* Patrón de movimiento — opcional, útil para búsquedas */}
          <View style={styles.field}>
            <Text style={styles.label}>PATRÓN DE MOVIMIENTO</Text>
            <View style={styles.chipWrap}>
              {PATTERNS.map((p) => (
                <TouchableOpacity
                  key={p.value}
                  style={[styles.chip, form.pattern === p.value && styles.chipActive]}
                  onPress={() => set_('pattern', form.pattern === p.value ? '' : p.value)}
                >
                  <Text style={[styles.chipText, form.pattern === p.value && styles.chipTextActive]}>
                    {p.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Tempo */}
          <View style={styles.field}>
            <Text style={styles.label}>TEMPO</Text>
            <View style={styles.tempoRow}>
              <TextInput
                style={styles.tempoInput}
                value={form.tempo}
                onChangeText={(v) => set_('tempo', v.replace(/[^0-9Xx]/g, '').toUpperCase().slice(0, 4))}
                maxLength={4}
                placeholder="—"
                placeholderTextColor={colors.muted2}
                keyboardType="default"
                autoCapitalize="characters"
              />
              <Text style={styles.tempoHint}>Exc · Pausa · Con · Pausa</Text>
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
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => toggleEquipment(eq.value)}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{eq.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Unilateral */}
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Ejercicio unilateral (por lado)</Text>
            <Switch
              value={form.isUnilateral}
              onValueChange={(v) => set_('isUnilateral', v)}
              trackColor={{ false: colors.surface2, true: withOpacity(colors.accent, 0.4) }}
              thumbColor={form.isUnilateral ? colors.accent : colors.muted}
            />
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

          {/* Opciones avanzadas */}
          <TouchableOpacity onPress={() => setAdvanced((a) => !a)} style={styles.advancedToggle}>
            <Text style={styles.advancedToggleText}>{advanced ? '▾' : '›'} Opciones avanzadas</Text>
          </TouchableOpacity>

          {advanced && (
            <View style={styles.advancedSection}>
              {/* Modelo de progresión */}
              <View style={styles.field}>
                <Text style={styles.label}>MODELO DE PROGRESIÓN</Text>
                {[
                  { value: 'double_progression', label: 'Doble progresión (peso + reps)' },
                  { value: 'time_progression',   label: 'Progresión en tiempo' },
                  { value: 'submax',             label: 'Submáximo (RIR)' },
                  { value: 'load_progression',   label: 'Progresión de carga' },
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
                  { value: 'beginner',     label: 'Principiante' },
                  { value: 'intermediate', label: 'Intermedio'   },
                  { value: 'advanced',     label: 'Avanzado'     },
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
      </KeyboardAvoidingView>

      {/* Footer */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <TouchableOpacity style={styles.cancelBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.cancelBtnText}>Cancelar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.createExBtn} onPress={handleCreate}>
          <Text style={styles.createExBtnText}>CREAR EJERCICIO</Text>
        </TouchableOpacity>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.xl, paddingVertical: spacing.md,
    borderBottomWidth: borders.thin, borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: typography.xl, fontWeight: typography.heavy,
    color: colors.text, letterSpacing: 1,
  },
  closeBtn: { fontSize: 20, color: colors.muted },

  form: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, gap: spacing.lg },
  field: {},
  stepRow: { flexDirection: 'row', gap: spacing.sm },
  label: { fontSize: typography.xs, color: colors.muted, letterSpacing: 1.5, marginBottom: spacing.xs },

  input: {
    backgroundColor: colors.surface2, borderWidth: borders.thin, borderColor: colors.border,
    borderRadius: radius.md, color: colors.text, fontSize: typography.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2,
  },
  inputError: { borderColor: colors.red },
  errorText: { fontSize: typography.xs, color: colors.red, marginTop: 4 },

  // Tipo selector (same design as ExerciseEditorInline)
  segRow: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.xs },
  segBtn: {
    flex: 1, paddingVertical: spacing.sm + 2,
    borderRadius: radius.sm, borderWidth: borders.thin, borderColor: colors.border,
    backgroundColor: colors.surface2, alignItems: 'center',
  },
  segBtnActive: { backgroundColor: withOpacity(colors.accent, 0.10), borderColor: withOpacity(colors.accent, 0.40) },
  segLabel:       { fontSize: typography.sm, color: colors.muted, fontWeight: typography.medium },
  segLabelActive: { color: colors.accent },

  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    paddingHorizontal: spacing.sm + 2, paddingVertical: 6,
    backgroundColor: colors.surface2, borderRadius: radius.sm,
    borderWidth: borders.thin, borderColor: colors.border,
  },
  chipActive:     { backgroundColor: withOpacity(colors.accent, 0.12), borderColor: withOpacity(colors.accent, 0.4) },
  chipText:       { fontSize: typography.xs, color: colors.muted },
  chipTextActive: { color: colors.accent },


  tempoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  tempoInput: {
    backgroundColor: colors.surface2, borderWidth: borders.thin, borderColor: colors.border,
    borderRadius: radius.md, color: colors.text, fontSize: typography.lg,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2,
    width: 80, textAlign: 'center', letterSpacing: 5,
  },
  tempoHint: { fontSize: typography.xs, color: colors.muted2, lineHeight: 18 },

  switchRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderTopWidth: borders.thin, borderTopColor: colors.border,
    borderBottomWidth: borders.thin, borderBottomColor: colors.border,
    paddingHorizontal: 2,
  },
  switchLabel: { fontSize: typography.base, color: colors.text },

  advancedToggle: { paddingVertical: spacing.xs },
  advancedToggleText: { fontSize: typography.sm, color: colors.muted },
  advancedSection: { gap: spacing.sm },

  selectOption: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    backgroundColor: colors.surface2, borderRadius: radius.sm,
    borderWidth: borders.thin, borderColor: colors.border,
    marginBottom: spacing.xs,
  },
  selectOptionActive:     { backgroundColor: withOpacity(colors.accent, 0.1), borderColor: withOpacity(colors.accent, 0.4) },
  selectOptionText:       { fontSize: typography.sm, color: colors.muted },
  selectOptionTextActive: { color: colors.accent },

  footer: {
    flexDirection: 'row', gap: spacing.sm,
    paddingHorizontal: spacing.xl, paddingTop: spacing.md,
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
    fontSize:      typography.lg,
    fontWeight:    typography.heavy,
    color:         colors.onAccent,
    letterSpacing: 1,
  },
});
