/**
 * CustomExerciseScreen — alta de un ejercicio nuevo en la librería.
 *
 * Misma estructura y mismos elementos de UI que `ExerciseEditorInline`
 * (RESUMEN → VOLUMEN → PROGRESIÓN → OPCIONES), reutilizando sus componentes
 * compartidos (`NavRow`/`OptionRow`/`ToggleRow`/`NoteRow` de `ui/EditorRows`,
 * `StepField`, `SegmentedControl`, `DragSheet`). Dos piezas no existen en ese
 * editor porque son propias del ALTA, no de la configuración por sesión:
 *
 *   · Nombre — campo propio, arriba del todo (el editor no lo necesita: el
 *     ejercicio ya existe).
 *   · Clasificación (patrón / grupo muscular / equipo / tipo / nivel) — con el
 *     mismo patrón "fila + hoja" que Calentamiento o Progresión en el editor
 *     real (piezas que tampoco están en Figma, ver UI-MIGRATION §"Exercice
 *     Editor"). Es lo que antes eran los chips de "Patrón"/"Material" + las
 *     opciones avanzadas de nivel — ahora como tags de un único NavRow.
 *
 * La Progresión reutiliza el mismo sistema (Modo → Tipo → Incremento) que el
 * editor, aunque solo persiste lo que la ficha de librería puede guardar
 * (`progressionModel`/`weightStep`) — el modo de evaluación es una config por
 * SESIÓN, no de la ficha, así que ese paso no aplica aquí.
 */
import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../store/useStore';
import { LEGACY_TYPE_MAP } from '../../../src/utils/progression';
import { useWeightUnit } from '../hooks/useWeightUnit';
import { spacing, textStyles } from '../theme';
import { useTheme, useThemedStyles } from '../useTheme';
import SegmentedControl from '../components/ui/SegmentedControl';
import StepField from '../components/ui/StepField';
import { NavRow, OptionRow, ToggleRow, NoteRow, CHEVRON_GREY } from '../components/ui/EditorRows';
import { ArrowIcon, ProgressionIcon } from '../components/ui/EditorIcons';
import DragSheet from '../components/DragSheet';
import { PATTERNS, MUSCLE_GROUPS, EQUIPMENT } from '../utils/exerciseTaxonomy';

function generateCustomId() {
  return 'custom_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
}

export default function CustomExerciseScreen({ navigation, route }) {
  const { t } = useTranslation();
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { templateId, currentExerciseId, sessionMode = false } = route.params ?? {};
  const { label: weightLabel } = useWeightUnit();

  const addCustomExercise = useStore((s) => s.addCustomExercise);
  const addExercise       = useStore((s) => s.addExercise);
  const replaceExercise   = useStore((s) => s.replaceExercise);
  const addAdHocExercise  = useStore((s) => s.addAdHocExercise);
  const showToast         = useStore((s) => s.showToast);

  const [name,      setName]      = useState('');
  const [nameError, setNameError] = useState(false);

  const [metric,  setMetric]  = useState('reps');
  const [sets,    setSets]    = useState(3);
  const [restSec, setRestSec] = useState(90);
  const [minReps, setMinReps] = useState(8);
  const [maxReps, setMaxReps] = useState(12);
  const [minTime, setMinTime] = useState(20);
  const [maxTime, setMaxTime] = useState(40);

  const [progMode,       setProgMode]       = useState('auto');
  const [progType,       setProgType]       = useState('double');
  const [incrFixedValue, setIncrFixedValue] = useState(2.5);

  const [pattern,      setPattern]      = useState('');
  const [primaryGroup, setPrimaryGroup] = useState('');
  const [equipment,    setEquipment]    = useState([]);
  const [isCompound,   setIsCompound]   = useState(true);
  const [level,        setLevel]        = useState('intermediate');
  const [isUnilateral, setIsUnilateral] = useState(false);
  const [tempo,        setTempo]        = useState('');
  const [notes,        setNotes]        = useState('');

  const [progSheetOpen,  setProgSheetOpen]  = useState(false);
  const [tagsSheetOpen,  setTagsSheetOpen]  = useState(false);
  const [tempoSheetOpen, setTempoSheetOpen] = useState(false);

  const isTime        = metric === 'time';
  const showRepsRange = !isTime && progMode !== 'submax';
  const showTimeRange = isTime;
  const showRepsIncr   = progType === 'reps';
  const showTimeIncr   = progType === 'time';

  function toggleEquipment(val) {
    setEquipment((prev) => (prev.includes(val) ? prev.filter((e) => e !== val) : [...prev, val]));
  }

  // ── Resumen / textos en lenguaje natural (mismo cálculo que el editor real) ──
  const rangeTxt = isTime
    ? `${minTime === maxTime ? minTime : `${minTime}–${maxTime}`} s`
    : progMode === 'submax'
      ? t('workout.submax', 'submáx')
      : `${minReps === maxReps ? minReps : `${minReps}–${maxReps}`} reps`;

  const incTxt = showRepsIncr
    ? String(incrFixedValue)
    : `${incrFixedValue} ${showTimeIncr ? 's' : weightLabel}`;
  const progLine = progMode === 'auto'
    ? `${t(`exerciseEditor.progModeDesc.${progMode}`)} · +${incTxt}`
    : t(`exerciseEditor.progModeDesc.${progMode}`);

  const patternLabel = pattern ? t(`exerciseSelector.patterns.${pattern}`) : null;
  const groupLabel   = primaryGroup ? t(`exerciseSelector.groups.${primaryGroup}`) : null;
  const equipLabel   = equipment.length
    ? equipment.map((e) => t(`exerciseSelector.equipment.${e}`)).join(', ')
    : t('exerciseSelector.equipment.bodyweight');
  const levelLabel = level === 'beginner' ? t('exerciseSelector.levelBeginner')
    : level === 'intermediate' ? t('exerciseSelector.levelIntermediate')
    : t('customExercise.levelAdvanced');

  const volumeLine = [`${sets} × ${rangeTxt}`, t('exerciseEditor.restSummary', { s: restSec }), patternLabel, equipLabel]
    .filter(Boolean).join(' · ');

  const tagsSummary = [patternLabel, groupLabel, equipLabel, levelLabel].filter(Boolean).join(' · ');

  function handleCreate() {
    if (!name.trim()) { setNameError(true); return; }

    const id = generateCustomId();
    const isTimeMode = metric === 'time';
    const progressionModel = progMode === 'auto'
      ? (LEGACY_TYPE_MAP[progType] ?? 'double_progression')
      : progMode === 'submax' ? 'submax' : 'double_progression';

    const def = {
      id,
      name:                 name.trim(),
      pattern,
      primaryGroup:         primaryGroup || 'custom',
      muscles:              [],
      equipment,
      level,
      isCompound,
      isKeyCandidate:       true,
      isUnilateral,
      progressionModel,
      progressionDirection: 'increase',
      sets,
      ...(isTimeMode ? { minTime, maxTime } : { minReps, maxReps }),
      weightStep: incrFixedValue,
      restSec,
      tips:       notes.trim() ? [notes.trim()] : [],
      isCustom:   true,
      inputType:  isTimeMode ? 'weight_time' : 'weight_reps',
      tempo:      tempo.trim() || null,
    };

    addCustomExercise(def);

    if (sessionMode) {
      addAdHocExercise(id);
    } else if (templateId && currentExerciseId) {
      replaceExercise(templateId, currentExerciseId, id);
    } else if (templateId) {
      addExercise(templateId, id);
    }
    showToast(t('customExercise.toastCreated'), 2200, 'success');
    navigation.pop(2);
  }

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('customExercise.title')}</Text>
        <TouchableOpacity style={styles.iconBox} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Text style={styles.closeGlyph}>✕</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">

          {/* ══ NOMBRE — propio del alta, no existe en el editor ══════════════ */}
          <View>
            <Text style={styles.secLabel}>{t('customExercise.nameLabel')}</Text>
            <TextInput
              style={[styles.nameInput, nameError && styles.nameInputError]}
              placeholder={t('customExercise.namePlaceholder')}
              placeholderTextColor={th.colors.mutedLight}
              value={name}
              onChangeText={(v) => { setName(v); if (nameError) setNameError(false); }}
            />
            {nameError && <Text style={styles.errorText}>{t('customExercise.nameError')}</Text>}
          </View>

          {/* ══ RESUMEN ═══════════════════════════════════════════════════════ */}
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTag}>{t('exerciseEditor.summaryTitle')}</Text>
            <Text style={styles.summaryMain}>{volumeLine}</Text>
            <Text style={styles.summarySub}>{progLine}</Text>
          </View>

          {/* ══ VOLUMEN ═══════════════════════════════════════════════════════ */}
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

          {/* ══ PROGRESIÓN — mismo sistema que el editor real ═══════════════════ */}
          <View style={styles.block}>
            <Text style={styles.secLabel}>{t('exerciseEditor.sectionProgression').toUpperCase()}</Text>
            <NavRow
              icon={<ProgressionIcon size={15} color={th.colors.accent} />}
              title={t(`exerciseEditor.progModes.${progMode}`)}
              subtitle={progLine}
              onPress={() => setProgSheetOpen(true)}
            />
          </View>

          {/* ══ OPCIONES ══════════════════════════════════════════════════════ */}
          <Text style={styles.secLabel}>{t('exerciseEditor.sectionOptions').toUpperCase()}</Text>
          <View style={styles.optGroup}>
            <ToggleRow
              label={t('exerciseEditor.unilateralLabel')}
              value={isUnilateral}
              onChange={setIsUnilateral}
            />
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
              label={t('customExercise.notesLabel')}
              value={notes}
              onChangeText={setNotes}
              placeholder={t('customExercise.notesPlaceholder')}
            />
          </View>

          {/* ══ CLASIFICACIÓN — patrón/grupo/equipo/tipo/nivel, no existe en el
              editor real (el ejercicio ya está clasificado): mismo patrón "fila
              + hoja" que Progresión/Calentamiento ═══════════════════════════ */}
          <Text style={styles.secLabel}>{t('customExercise.tagsRowTitle').toUpperCase()}</Text>
          <NavRow
            title={tagsSummary || t('customExercise.tagsRowEmpty')}
            subtitle={t('customExercise.tagsRowHint')}
            onPress={() => setTagsSheetOpen(true)}
          />

          {/* ══ ACCIONES — abajo del proceso, no flotantes ═══════════════════ */}
          <View style={styles.btnRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
              <Text style={styles.cancelBtnText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.createBtn} onPress={handleCreate} activeOpacity={0.85}>
              <Text style={styles.createBtnText}>{t('customExercise.createBtn')}</Text>
            </TouchableOpacity>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>

      {/* ══ HOJA: tempo — idéntica a la del editor real ══════════════════════ */}
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

      {/* ══ HOJA: progresión — mismos pasos que el editor real, sin el paso de
          evaluación (es config por sesión, no de la ficha) ═══════════════════ */}
      <DragSheet
        visible={progSheetOpen}
        onClose={() => setProgSheetOpen(false)}
        title={t('exerciseEditor.sectionProgression')}
      >
        <View style={styles.sheetBody}>
          <View>
            <Text style={styles.stepTitle}>
              <Text style={styles.stepNum}>1 · </Text>{t('exerciseEditor.stepMode')}
            </Text>
            <SegmentedControl
              options={['auto', 'fixed', 'submax'].map((id) => ({ id, label: t(`exerciseEditor.progModes.${id}`) }))}
              value={progMode}
              onChange={setProgMode}
            />
            <Text style={styles.hint}>{t(`exerciseEditor.progModeDesc.${progMode}`)}</Text>
          </View>

          {progMode === 'auto' && (
            <>
              <View>
                <Text style={styles.stepTitle}>
                  <Text style={styles.stepNum}>2 · </Text>{t('exerciseEditor.stepType')}
                </Text>
                <SegmentedControl
                  options={['double', 'weight', 'reps', 'time'].map((id) => ({ id, label: t(`exerciseEditor.progTypes.${id}`) }))}
                  value={progType}
                  onChange={setProgType}
                />
                <Text style={styles.hint}>{t(`exerciseEditor.progTypeDesc.${progType}`)}</Text>
              </View>

              <View>
                <Text style={styles.stepTitle}>
                  <Text style={styles.stepNum}>3 · </Text>{t('exerciseEditor.stepIncr')}
                </Text>
                <StepField
                  horizontal
                  label={showRepsIncr ? t('exerciseEditor.incrFixedRepsLabel') : t('exerciseEditor.incrValueLabel')}
                  unit={showRepsIncr ? undefined : (showTimeIncr ? 's' : weightLabel)}
                  value={incrFixedValue}
                  onChange={setIncrFixedValue}
                  min={showRepsIncr ? 1 : 0}
                  max={showRepsIncr ? 10 : 50}
                  step={showRepsIncr ? 1 : 0.25}
                />
              </View>
            </>
          )}

          <View style={styles.summaryCard}>
            <Text style={styles.summarySub}>{progLine}</Text>
          </View>
        </View>
      </DragSheet>

      {/* ══ HOJA: clasificación (patrón / grupo muscular / equipo / tipo / nivel) */}
      <DragSheet
        visible={tagsSheetOpen}
        onClose={() => setTagsSheetOpen(false)}
        title={t('customExercise.tagsSheetTitle')}
      >
        <View style={styles.sheetBody}>
          <View>
            <Text style={styles.stepTitle}>{t('customExercise.patternSectionLabel')}</Text>
            <View style={styles.pillWrap}>
              {PATTERNS.map((p) => {
                const on = pattern === p;
                return (
                  <TouchableOpacity
                    key={p}
                    style={[styles.pill, on && styles.pillOn]}
                    onPress={() => setPattern(on ? '' : p)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.pillText, on && styles.pillTextOn]}>
                      {t(`exerciseSelector.patterns.${p}`)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View>
            <Text style={styles.stepTitle}>{t('exerciseSelector.filters.muscleGroup')}</Text>
            <View style={styles.pillWrap}>
              {MUSCLE_GROUPS.map((g) => {
                const on = primaryGroup === g;
                return (
                  <TouchableOpacity
                    key={g}
                    style={[styles.pill, on && styles.pillOn]}
                    onPress={() => setPrimaryGroup(on ? '' : g)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.pillText, on && styles.pillTextOn]}>
                      {t(`exerciseSelector.groups.${g}`)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View>
            <Text style={styles.stepTitle}>{t('exerciseSelector.filters.equipment')}</Text>
            <View style={styles.pillWrap}>
              {EQUIPMENT.map((eq) => {
                const on = equipment.includes(eq);
                return (
                  <TouchableOpacity
                    key={eq}
                    style={[styles.pill, on && styles.pillOn]}
                    onPress={() => toggleEquipment(eq)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.pillText, on && styles.pillTextOn]}>
                      {t(`exerciseSelector.equipment.${eq}`)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View>
            <Text style={styles.stepTitle}>{t('exerciseSelector.filters.type')}</Text>
            <SegmentedControl
              options={[
                { id: 'compound',  label: t('exerciseSelector.filters.compound') },
                { id: 'isolation', label: t('exerciseSelector.filters.isolation') },
              ]}
              value={isCompound ? 'compound' : 'isolation'}
              onChange={(id) => setIsCompound(id === 'compound')}
            />
          </View>

          <View>
            <Text style={styles.stepTitle}>{t('customExercise.levelSectionLabel')}</Text>
            <SegmentedControl
              options={[
                { id: 'beginner',     label: t('exerciseSelector.levelBeginner') },
                { id: 'intermediate', label: t('exerciseSelector.levelIntermediate') },
                { id: 'advanced',     label: t('customExercise.levelAdvanced') },
              ]}
              value={level}
              onChange={setLevel}
            />
          </View>
        </View>
      </DragSheet>

    </SafeAreaView>
  );
}

const makeStyles = (th) => StyleSheet.create({
  container: { flex: 1, backgroundColor: th.colors.bg },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm,
    gap: spacing.md,
  },
  headerTitle: { ...textStyles.hero, color: th.colors.text, flexShrink: 1 },
  iconBox: {
    width: 42, height: 42, borderRadius: th.radius.sm,
    backgroundColor: th.colors.surface2,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  closeGlyph: { fontSize: 17, color: th.colors.text },

  form: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  block: { gap: spacing.md },

  secLabel: { ...textStyles.spacingTag, color: th.colors.mutedLight, paddingTop: spacing.md },

  nameInput: {
    backgroundColor: th.colors.surface2, borderRadius: th.radius.sm,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    ...textStyles.cardTitle, color: th.colors.text,
  },
  nameInputError: { borderWidth: 1, borderColor: th.colors.red },
  errorText: { ...textStyles.tag, color: th.colors.red, marginTop: spacing.xs },

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

  grid:    { gap: spacing.md },
  gridRow: { flexDirection: 'row', gap: spacing.md },
  hint:    { ...textStyles.tag, color: th.colors.mutedLight, lineHeight: 14 },

  optGroup: { borderRadius: th.radius.md, overflow: 'hidden', gap: spacing.xs },

  tempoValueRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  tempoValue:    { ...textStyles.cardType, color: th.colors.mutedLight, letterSpacing: 2 },
  tempoInput: {
    alignSelf: 'center', minWidth: 140, height: 48,
    backgroundColor: th.colors.surface, borderRadius: th.radius.sm,
    ...textStyles.hero, letterSpacing: 6, color: th.colors.text,
    textAlign: 'center', textAlignVertical: 'center',
    includeFontPadding: false, paddingVertical: 0,
  },

  // ── Acciones — abajo del proceso ────────────────────────────────────────
  btnRow: { flexDirection: 'row', gap: spacing.sm, paddingTop: spacing.md },
  cancelBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingVertical: spacing.md, borderRadius: th.radius.sm,
    backgroundColor: th.colors.surface2,
  },
  cancelBtnText: { ...textStyles.cardType, color: th.colors.text },
  createBtn: {
    flex: 2, alignItems: 'center', justifyContent: 'center',
    paddingVertical: spacing.md, borderRadius: th.radius.sm,
    backgroundColor: '#b8ff00',
  },
  createBtnText: { ...textStyles.btnAction, color: th.colors.onAccent },

  sheetBody: { gap: spacing.lg, paddingBottom: spacing.sm },
  stepTitle: {
    ...textStyles.spacingTag, color: th.colors.mutedLight,
    textTransform: 'uppercase', marginBottom: spacing.sm,
  },
  stepNum: { color: th.colors.accent },

  pillWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  pill: {
    paddingHorizontal: spacing.lg, height: 36, justifyContent: 'center',
    backgroundColor: th.colors.surface2, borderRadius: th.radius.sm,
  },
  pillOn:     { backgroundColor: th.colors.accent },
  pillText:   { ...textStyles.btnAction, color: th.colors.mutedLight },
  pillTextOn: { color: th.colors.onAccent },
});
