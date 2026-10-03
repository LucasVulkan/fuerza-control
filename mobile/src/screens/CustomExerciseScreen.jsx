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
 * Volumen y Progresión son los del editor (progresion-clara.md §12, P65): la
 * misma hoja (`ProgressionSheet`) y el mismo formulario (`progressionForm`),
 * con un `def` borrador para que las opciones que ofrece sean las del
 * ejercicio que saldrá. La progresión entera se guarda en `def.progression`.
 */
import { useState } from 'react';
import { View, TouchableOpacity, ScrollView, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { Text, TextInput } from '../components/ui/Text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../store/useStore';
import { LEGACY_TYPE_MAP, progressionRule, DEFAULT_TARGET } from '../utils/progression';
import {
  initProgForm, patchProgForm, buildProgression, isEffort as isEffortForm, needsRpe,
} from '../utils/progressionForm';
import { MAX_RELIABLE_REPS } from '../utils/oneRm';
import { useWeightUnit } from '../hooks/useWeightUnit';
import { spacing, textStyles, lh, LINE } from '../theme';
import { useTheme, useThemedStyles } from '../useTheme';
import SegmentedControl from '../components/ui/SegmentedControl';
import StepField from '../components/ui/StepField';
import { NavRow, OptionRow, ToggleRow, NoteRow, CHEVRON_GREY } from '../components/ui/EditorRows';
import { ArrowIcon, ProgressionIcon, VariantIcon } from '../components/ui/EditorIcons';
import VariantPicker from '../components/ui/VariantPicker';
import AnimatedHeight from '../components/ui/AnimatedHeight';
import ProgressionSheet from '../components/editor/ProgressionSheet';
import DragSheet from '../components/DragSheet';
import { PATTERNS, MUSCLE_GROUPS, EQUIPMENT } from '../utils/exerciseTaxonomy';
import { VARIANT_DIMS, variantLabel, isEmptyVariant } from '../utils/variants';

import ScreenHeader from '../components/ui/ScreenHeader';
// El escalón de peso del `def` borrador y de partida del ejercicio: el de siempre.
const DRAFT_STEP = 2.5;

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
  const updateExerciseParams = useStore((s) => s.updateExerciseParams);
  const setSessionVariant    = useStore((s) => s.setSessionVariant);
  const showToast         = useStore((s) => s.showToast);

  const [name,      setName]      = useState('');
  const [nameError, setNameError] = useState(false);

  const [metric,  setMetric]  = useState('reps');
  const [sets,    setSets]    = useState(3);
  const [restSec, setRestSec] = useState(90);
  const [minReps, setMinReps] = useState(DEFAULT_TARGET.minReps);
  const [maxReps, setMaxReps] = useState(DEFAULT_TARGET.maxReps);
  const [minTime, setMinTime] = useState(DEFAULT_TARGET.minTime);
  const [maxTime, setMaxTime] = useState(DEFAULT_TARGET.maxTime);
  // «Rango» o «Reps fijas» (§5.1), como en el editor.
  const [repsMode, setRepsMode] = useState('range');

  const [pattern,      setPattern]      = useState('');
  const [primaryGroup, setPrimaryGroup] = useState('');
  const [equipment,    setEquipment]    = useState([]);
  const [isCompound,   setIsCompound]   = useState(true);
  const [level,        setLevel]        = useState('intermediate');
  const [isUnilateral, setIsUnilateral] = useState(false);
  // La misma hoja Variante que el editor (QA P44): elegir una opción ES decir
  // que el ejercicio tiene esa dimensión, y queda elegida para esta sesión.
  const [variant,          setVariant]          = useState({});
  const [variantSheetOpen, setVariantSheetOpen] = useState(false);
  const [tempo,        setTempo]        = useState('');
  const [notes,        setNotes]        = useState('');

  const [progSheetOpen,  setProgSheetOpen]  = useState(false);
  const [tagsSheetOpen,  setTagsSheetOpen]  = useState(false);
  const [tempoSheetOpen, setTempoSheetOpen] = useState(false);

  const isTime = metric === 'time';

  function toggleEquipment(val) {
    setEquipment((prev) => (prev.includes(val) ? prev.filter((e) => e !== val) : [...prev, val]));
  }

  // ── Progresión: el formulario del editor sobre un `def` borrador (§12.1) ────
  // Lo que la pantalla ya sabe del ejercicio: de ahí salen las opciones que
  // ofrece la hoja (`canAddWeight`, Por esfuerzo pide carga externa…).
  const draftDef = {
    progressionDirection: 'increase',
    weightStep:           DRAFT_STEP,
    isCustom:             true,
    equipment, level, isCompound, isUnilateral,
    inputType:            isTime ? 'weight_time' : 'weight_reps',
  };
  const ctx = { def: draftDef, sets, metric, range: repsMode === 'range' };
  const [prog, setProg] = useState(() => initProgForm({}, draftDef, ctx));
  // Un cambio deja el estado coherente de una vez (como `settle` del editor):
  // Reps o Tiempo piden un solo valor de inicio, el mínimo del rango (§5.1).
  function settle(next, c) {
    setProg(next);
    if (next.up === 'reps' && c.metric === 'reps') { setMaxReps(minReps); setRepsMode('fixed'); }
    if (next.up === 'time' && c.metric === 'time') setMaxTime(minTime);
  }
  const patchProg = (patch) => settle(patchProgForm(prog, patch, ctx), ctx);
  // Volumen puede dejar sin valer lo elegido: menos series, otra medida, un Rango.
  function changeVolume(over, apply) {
    const c = { ...ctx, ...over };
    apply();
    settle(patchProgForm(prog, {}, c), c);
  }
  function selectRepsMode(m) {
    changeVolume({ range: m === 'range' }, () => {
      setMaxReps(m === 'fixed' ? minReps : Math.min(50, minReps + 4));
      setRepsMode(m);
    });
  }
  const effort    = isEffortForm(prog, ctx);
  // Reps y Tiempo piden un solo valor de inicio, no un rango (§5.1).
  const startReps = prog.up === 'reps' && !isTime;
  const startTime = prog.up === 'time' && isTime;
  const effortRir = 10 - prog.targetRpe;
  // Misma regla que el motor: pasado MAX_RELIABLE_REPS no calcula (§2.3).
  const effortWarn = effort && minReps + effortRir >= MAX_RELIABLE_REPS ? (
    <Text style={styles.warnHint}>{t('exerciseEditor.effortUnreliable', { max: MAX_RELIABLE_REPS })}</Text>
  ) : null;

  // ── Resumen / textos en lenguaje natural (mismo cálculo que el editor real) ──
  const rangeTxt = isTime
    ? `${minTime === maxTime ? minTime : `${minTime}–${maxTime}`} s`
    : effort
      ? t('exerciseEditor.effortVolume', { reps: minReps, rpe: prog.targetRpe })
      : `${minReps === maxReps ? minReps : `${minReps}–${maxReps}`} reps`;

  // La frase de la regla sale del mismo motor que decide: el Resumen y la ficha
  // dicen lo mismo que el editor (§5.2).
  const ruleCfg = {
    sets, minReps, maxReps, minTime, maxTime,
    inputType: isTime ? 'weight_time' : 'weight_reps',
    ...buildProgression(prog, ctx),
  };
  const ruleTxt   = progressionRule(ruleCfg, draftDef, t, weightLabel);
  const ruleShort = progressionRule(ruleCfg, draftDef, t, weightLabel, { short: true });
  const progTitle = prog.up === 'none'
    ? t('exerciseEditor.progTitle.none')
    : effort
      ? t('exerciseEditor.progTitle.effort')
      : t(`exerciseEditor.progTitle.${prog.up}`);

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
    // La progresión entera va en el `def` (§12.2). `progressionModel` se sigue
    // escribiendo, lo leen otros sitios: `fixed` sin progresión.
    const { progression, weightStep } = buildProgression(prog, ctx);
    const progressionModel = prog.up === 'none'
      ? 'fixed'
      : (LEGACY_TYPE_MAP[progression.type] ?? 'double_progression');
    // Reps y Tiempo piden un solo valor de inicio, y Por esfuerzo reps fijas
    // (§5.1): min = max.
    const oneReps = repsMode === 'fixed' || progression.type === 'reps' || progression.type === 'effort';
    const target = isTimeMode
      ? { minTime, maxTime: progression.type === 'time' ? minTime : maxTime }
      : { minReps, maxReps: oneReps ? minReps : maxReps };

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
      // Dimensiones de variante (exercise-variants.md §4.6): todas las opciones.
      // Dimensiones de variante (exercise-variants.md §4.6): las que se
      // eligieron en la hoja, con todas sus opciones.
      ...(isEmptyVariant(variant) ? {} : {
        variants: {
          ...(variant.grip  ? { grip:  [...VARIANT_DIMS.grip] }  : {}),
          ...(variant.width ? { width: [...VARIANT_DIMS.width] } : {}),
        },
      }),
      progressionModel,
      progression,
      progressionDirection: 'increase',
      sets,
      ...target,
      // El escalón elegido, o 'exact' (Por esfuerzo); si no, el de partida.
      weightStep: weightStep ?? DRAFT_STEP,
      restSec,
      tips:       notes.trim() ? [notes.trim()] : [],
      isCustom:   true,
      inputType:  isTimeMode ? 'weight_time' : 'weight_reps',
      tempo:      tempo.trim() || null,
    };

    addCustomExercise(def);

    // Lo elegido en la hoja es la variante de este ejercicio donde se añade:
    // en la sesión (plantilla) o, en un entreno en marcha, la de hoy.
    const chosen = isEmptyVariant(variant) ? null : variant;
    // Lo que pide la progresión (Por esfuerzo, RPE máx.) va encendido en la
    // plantilla (§5.4).
    const params = { ...(chosen ? { variant: chosen } : {}), ...(needsRpe(prog, ctx) ? { trackRpe: true } : {}) };
    if (sessionMode) {
      addAdHocExercise(id);
      if (chosen) setSessionVariant(id, chosen);
    } else if (templateId && currentExerciseId) {
      replaceExercise(templateId, currentExerciseId, id);
      if (Object.keys(params).length) updateExerciseParams(templateId, id, params);
    } else if (templateId) {
      addExercise(templateId, id);
      if (Object.keys(params).length) updateExerciseParams(templateId, id, params);
    }
    showToast(t('customExercise.toastCreated'), 2200, 'success');
    navigation.pop(2);
  }

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.container}>
      {/* Se entra deslizando desde la derecha: se sale con ‹, como el resto
          de pantallas a las que se navega (U36). */}
      {/* Crear va arriba a la derecha, como «Añadir» en el selector de
          ejercicios: es la acción de la pantalla. Sin Cancelar: lo hace ‹. */}
      <ScreenHeader
        onBack={() => navigation.goBack()}
        eyebrow={t('customExercise.eyebrow')}
        title={t('customExercise.title')}
        right={(
          <TouchableOpacity
            style={[styles.createBtn, !name.trim() && styles.createBtnOff]}
            // Apagado sin nombre, pero pulsable: así marca el campo que falta.
            onPress={handleCreate}
            activeOpacity={0.85}
            accessibilityRole="button"
          >
            <Text style={[styles.createBtnText, !name.trim() && styles.createBtnTextOff]}>
              {t('customExercise.createBtn')}
            </Text>
          </TouchableOpacity>
        )}
      />

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
            <Text style={styles.summarySub}>{ruleTxt}</Text>
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
              onChange={(m) => changeVolume({ metric: m }, () => setMetric(m))}
            />
            {/* Rango o reps fijas (§5.1). Con Reps como progresión no hay rango:
                el campo de abajo es solo el inicio. */}
            {!isTime && !startReps && (
              <SegmentedControl
                options={['range', 'fixed'].map((id) => ({ id, label: t(`exerciseEditor.repsMode.${id}`) }))}
                value={repsMode}
                onChange={selectRepsMode}
              />
            )}
            <View style={styles.grid}>
              <View style={styles.gridRow}>
                <StepField label={t('exerciseEditor.fieldSets')} value={sets}    onChange={(v) => changeVolume({ sets: v }, () => setSets(v))} min={1}  max={8}   />
                <StepField label={t('exerciseEditor.fieldRest')} value={restSec} onChange={setRestSec} min={30} max={300} unit="s" />
              </View>
              {startTime ? (
                <StepField horizontal label={t('exerciseEditor.fieldStartTime')} value={minTime} onChange={(v) => { setMinTime(v); setMaxTime(v); }} min={5} max={300} unit="s" />
              ) : isTime ? (
                <View style={styles.gridRow}>
                  <StepField label={t('exerciseEditor.fieldMinTime')} value={minTime} onChange={setMinTime} min={5} max={300} unit="s" />
                  <StepField label={t('exerciseEditor.fieldMaxTime')} value={maxTime} onChange={setMaxTime} min={5} max={300} unit="s" />
                </View>
              ) : startReps || repsMode === 'fixed' ? (
                <>
                  <StepField horizontal label={t(startReps ? 'exerciseEditor.fieldStartReps' : 'exerciseEditor.fieldFixedReps')} value={minReps} onChange={(v) => { setMinReps(v); setMaxReps(v); }} min={1} max={50} />
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

          {/* ══ PROGRAMACIÓN — el mismo grupo de fichas que el editor (P64) ═══ */}
          <View style={styles.block}>
            <Text style={styles.secLabel}>{t('exerciseEditor.sectionProgramming').toUpperCase()}</Text>
            <View style={styles.optGroup}>
              <NavRow
                grouped
                icon={<ProgressionIcon size={15} color={th.colors.accent} />}
                title={t('exerciseEditor.sectionProgression')}
                strong={progTitle}
                subtitle={ruleShort}
                onPress={() => setProgSheetOpen(true)}
              />
              <NavRow
                grouped
                icon={<VariantIcon size={15} color={th.colors.accent} />}
                title={t('variants.section')}
                strong={[
                  ...(isUnilateral ? [t('variants.unilateral')] : []),
                  ...(variantLabel(variant, t) ? [variantLabel(variant, t)] : []),
                ].join(' · ') || t('variants.none')}
                subtitle={`${t('variants.dim.unilateral')} · ${t('variants.dim.grip').toLowerCase()} · ${t('variants.dim.width').toLowerCase()}`}
                onPress={() => setVariantSheetOpen(true)}
              />
            </View>
          </View>

          {/* ══ OPCIONES ══════════════════════════════════════════════════════ */}
          <Text style={styles.secLabel}>{t('exerciseEditor.sectionOptions').toUpperCase()}</Text>
          <View style={styles.optGroup}>
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

        </ScrollView>
      </KeyboardAvoidingView>

      {/* ══ HOJA: tempo — idéntica a la del editor real ══════════════════════ */}
      {/* ══ HOJA: variante — la del editor, sin «Ejercicio único» (un ejercicio
          nuevo aún no tiene nada de lo que separarse) ══════════════════════ */}
      <DragSheet
        visible={variantSheetOpen}
        onClose={() => setVariantSheetOpen(false)}
        title={t('variants.title')}
      >
        <AnimatedHeight>
          <View style={styles.sheetBody}>
            <View>
              <VariantPicker
                def={{ variants: isUnilateral ? { grip: VARIANT_DIMS.grip } : VARIANT_DIMS }}
                value={variant}
                onChange={setVariant}
              />
              <Text style={[styles.hint, { marginTop: spacing.md }]}>
                {isUnilateral ? `${t('variants.howHint')} ${t('variants.widthNA')}` : t('variants.howHint')}
              </Text>
            </View>
            <View style={{ gap: spacing.sm }}>
              <Text style={styles.sheetCaption}>{t('variants.identityTitle').toUpperCase()}</Text>
              <View style={styles.optGroup}>
                <ToggleRow
                  label={t('variants.unilateral')}
                  hint={t('variants.unilateralNewHint')}
                  value={isUnilateral}
                  alwaysHint
                  onChange={(v) => {
                    setIsUnilateral(v);
                    // Una mano no tiene anchura.
                    if (v && variant.width) { const next = { ...variant }; delete next.width; setVariant(next); }
                  }}
                />
              </View>
            </View>
          </View>
        </AnimatedHeight>
      </DragSheet>

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

      {/* ══ HOJA: progresión — la misma del editor (P65) ═════════════════════ */}
      <DragSheet
        visible={progSheetOpen}
        onClose={() => setProgSheetOpen(false)}
        title={t('exerciseEditor.sectionProgression')}
      >
        <ProgressionSheet
          prog={prog}
          ctx={ctx}
          minReps={minReps}
          maxReps={maxReps}
          minTime={minTime}
          maxTime={maxTime}
          onPatch={patchProg}
        />
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


  form: { paddingTop: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  block: { gap: spacing.md },

  secLabel: { ...textStyles.caps, color: th.colors.mutedLight, paddingTop: spacing.md },

  nameInput: {
    backgroundColor: th.colors.surface2, borderRadius: th.radius.sm,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    ...textStyles.itemTitle, color: th.colors.text,
  },
  nameInputError: { borderWidth: 1, borderColor: th.colors.red },
  errorText: { ...textStyles.body, color: th.colors.red, marginTop: spacing.xs },

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

  grid:    { gap: spacing.md },
  gridRow: { flexDirection: 'row', gap: spacing.md },
  hint:    { ...textStyles.body, color: th.colors.mutedLight, lineHeight: lh(textStyles.body.fontSize, LINE.row) },
  // Aviso de fiabilidad de Por esfuerzo: el naranja de `optRowWarn` (EditorRows).
  warnHint: { ...textStyles.body, color: th.colors.orange, lineHeight: lh(textStyles.body.fontSize, LINE.row) },

  optGroup: { borderRadius: th.radius.md, overflow: 'hidden', gap: spacing.xs },

  tempoValueRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  tempoValue:    { ...textStyles.bodyStrong, color: th.colors.mutedLight },
  tempoInput: {
    alignSelf: 'center', minWidth: 140, height: 48,
    backgroundColor: th.colors.surface, borderRadius: th.radius.sm,
    ...textStyles.code, color: th.colors.text,
    textAlign: 'center', textAlignVertical: 'center',
    includeFontPadding: false, paddingVertical: 0,
  },

  // ── Crear, en la cabecera — el mismo botón que «Añadir» del selector ────
  createBtn: {
    height: 32, paddingHorizontal: spacing.md, borderRadius: th.radius.md,
    backgroundColor: th.colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  createBtnOff:     { backgroundColor: th.colors.surface2 },
  createBtnText:    { ...textStyles.button, color: th.colors.onAccent },
  createBtnTextOff: { color: th.colors.muted },

  sheetBody: { gap: spacing.lg, paddingBottom: spacing.sm },
  sheetCaption: { ...textStyles.caps, color: th.colors.mutedLight },
  stepTitle: {
    ...textStyles.caps, color: th.colors.mutedLight,
    textTransform: 'uppercase', marginBottom: spacing.sm,
  },

  pillWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  pill: {
    paddingHorizontal: spacing.lg, height: 36, justifyContent: 'center',
    backgroundColor: th.colors.surface2, borderRadius: th.radius.sm,
  },
  pillOn:     { backgroundColor: th.colors.accent },
  pillText:   { ...textStyles.button, color: th.colors.mutedLight },
  pillTextOn: { color: th.colors.onAccent },
});
