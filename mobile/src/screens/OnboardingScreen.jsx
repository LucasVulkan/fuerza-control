/**
 * OnboardingScreen — port fiel del original web (OnboardingView.jsx).
 *
 * 3 modos:
 *   null    → selector (Auto / Manual / Importar)
 *   'auto'  → wizard 7-8 pasos
 *   'manual'→ nombre + nº de sesiones
 *
 * Se reutiliza como pantalla de "nuevo programa" desde dentro de la app
 * pasando el parámetro de navegación: { fromApp: true }.
 */

import { useState, useRef, useMemo, useEffect } from 'react';
import {
  View, Text, ScrollView, TextInput,
  TouchableOpacity, ActivityIndicator,
  Alert, StyleSheet,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';

import { useStore } from '../../store/useStore';
import { estimateSessionSec, includesWarmup } from '../../../src/utils/sessionCompression';
import ImportModal from '../components/ImportModal';
import ClientCodeModal from '../components/ClientCodeModal';
import OnboardingProgress from '../components/onboarding/OnboardingProgress';
import OnboardingStep from '../components/onboarding/OnboardingStep';
import OptionCard from '../components/onboarding/OptionCard';
import { spacing, typography, borders, withOpacity } from '../theme';
import { useTheme, useThemedStyles } from '../useTheme';
import { resolveColor } from '../themes';

// ─── Datos estáticos (IDs) — igual que el original ────────────────────────────

const LEVEL_IDS = ['beginner', 'intermediate', 'advanced'];
const DISC_IDS  = ['standard', 'calisthenics', 'glutes_legs', 'strength'];
const DIST_IDS  = ['full_body', 'upper_lower', 'push_pull_legs'];
const GOAL_IDS  = ['hypertrophy', 'endurance', 'strength', 'max_strength'];
const EQUIP_IDS = ['bodyweight', 'machines', 'dumbbells', 'barbell', 'pullup_bar', 'parallettes', 'kettlebell', 'resistance_band', 'ab_wheel'];
const LIMIT_IDS = ['none', 'shoulder', 'lower_back', 'knee'];
const PROG_IDS  = ['double_progression', 'linear', 'reps_progression'];

// IDs exclusivos por campo: seleccionarlos limpia el resto y viceversa
// (limitations: 'none' = sin limitaciones; equipment: 'bodyweight' = solo peso corporal).
const EXCLUSIVE_IDS = { limitations: 'none', equipment: 'bodyweight' };

const LEVEL_ORDER    = { beginner: 0, intermediate: 1, advanced: 2 };
// La distribucion NO se bloquea por nivel (program-templates.md §2.14): repartir
// los dias en full body, U/L o PPL es organización, no dificultad. Lo que sí
// cambia con el nivel es el volumen (VOLUME_BANDS), la selección de ejercicios
// (fitsLevel) y los objetivos de fuerza (GOAL_MIN_LEVEL).
const DIST_FOR       = {
  full_body:      ['standard', 'calisthenics', 'glutes_legs', 'strength'],
  upper_lower:    ['standard', 'calisthenics', 'strength'],
  push_pull_legs: ['standard', 'calisthenics', 'strength'],
};
const GOAL_MIN_LEVEL = { hypertrophy: 'beginner', endurance: 'beginner', strength: 'intermediate', max_strength: 'advanced' };

function goalAvailable(goalId, level) {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[GOAL_MIN_LEVEL[goalId]];
}

function distAvailable(distId, discipline) {
  return DIST_FOR[distId].includes(discipline);
}

// Distribución recomendada según los días disponibles, filtrada solo por
// disciplina. El nivel ya NO interviene: un principiante puede hacer PPL: lo que
// le distingue es cuánto volumen y qué ejercicios, no cómo reparte los días.
function recommendDistribution({ daysPerWeek: d, discipline }) {
  let preferred;
  if (d <= 2)       preferred = 'full_body';
  else if (d === 3) preferred = 'push_pull_legs';
  else if (d === 4) preferred = 'upper_lower';
  else if (d <= 6)  preferred = 'push_pull_legs';
  else              preferred = 'push_pull_legs'; // 7 días — con hint de descanso activo
  const ordered = [preferred, ...DIST_IDS.filter((id) => id !== preferred)];
  return ordered.find((id) => distAvailable(id, discipline)) ?? 'full_body';
}

// ─── Import helper ────────────────────────────────────────────────────────────

function parseImportFile(jsonString) {
  try {
    const parsed = JSON.parse(jsonString);
    if (!parsed.version) return { ok: false, error: 'El archivo no tiene campo "version".' };
    if (!['1', '2'].includes(String(parsed.version))) return { ok: false, error: `Versión ${parsed.version} no compatible.` };
    return { ok: true, data: parsed };
  } catch {
    return { ok: false, error: 'El archivo no es un JSON válido.' };
  }
}

// ─── Brand tag two-tone ───────────────────────────────────────────────────────

function FitLogo({ height = 18 }) {
  const th = useTheme();
  const width = height * (378 / 126);
  return (
    <Svg width={width} height={height} viewBox="0 0 378 126" fill="none">
      <Path d="M184.827 126H163.739C162.466 126 161.512 124.836 161.762 123.589L186.155 1.62099C186.344 0.678667 187.171 0.000366211 188.132 0.000366211H209.22C210.492 0.000366211 211.447 1.16425 211.197 2.41173L186.804 124.379C186.615 125.322 185.788 126 184.827 126Z" fill={th.colors.accent} />
      <Path d="M375.097 0C376.369 0 377.323 1.16388 377.074 2.41136L372.84 23.5796C372.652 24.5219 371.824 25.2002 370.863 25.2002H318.729C317.768 25.2002 316.941 25.8785 316.752 26.8208L297.24 124.379C297.052 125.322 296.225 126 295.264 126H274.175C272.903 126 271.949 124.836 272.198 123.589L291.394 27.6116C291.644 26.3641 290.689 25.2002 289.417 25.2002H243.936C242.664 25.2002 241.71 24.0363 241.959 22.7888L246.193 1.62062C246.381 0.678299 247.209 0 248.17 0H375.097Z" fill={th.colors.accent} />
      <Path d="M23.5472 126H2.45912C1.18693 126 0.232776 124.836 0.482272 123.589L20.338 24.3097C23.165 10.1749 35.5759 0.000366211 49.9907 0.000366211H138.66C139.933 0.000366211 140.887 1.16425 140.637 2.41173L136.404 23.5797C136.215 24.522 135.388 25.2003 134.427 25.2003H53.8989C48.9714 25.2003 44.7661 28.7627 43.956 33.6231L40.7111 53.0928C40.5063 54.3216 41.4539 55.4402 42.6997 55.4402H98.2176C99.5292 55.4402 100.492 56.6727 100.173 57.9451L96.1414 74.0731C95.9171 74.9705 95.1107 75.6001 94.1856 75.6001H36.9326C35.9716 75.6001 35.1442 76.2784 34.9558 77.2207L25.524 124.379C25.3356 125.322 24.5082 126 23.5472 126Z" fill={th.colors.accent} />
    </Svg>
  );
}

function BrandTag() {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.brandTag}>
      <Text style={styles.brandTagForma}>Forma</Text>
      <View style={{ marginTop: 3 }}><FitLogo height={13} /></View>
    </View>
  );
}

// ─── Tarjeta de modo ──────────────────────────────────────────────────────────

function ModeCard({ icon, title, desc, onPress, accent = false }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <TouchableOpacity
      style={[styles.modeCard, accent && styles.modeCardAccent]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Text style={styles.modeIcon}>{icon}</Text>
      <View style={styles.modeBody}>
        <Text style={[styles.modeTitle, accent && styles.modeTitleAccent]}>{title}</Text>
        <Text style={styles.modeDesc}>{desc}</Text>
      </View>
      <Text style={styles.modeArrow}>›</Text>
    </TouchableOpacity>
  );
}

// ─── Pantalla principal ───────────────────────────────────────────────────────

export default function OnboardingScreen() {
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  const insets     = useSafeAreaInsets();
  const navigation = useNavigation();
  const route      = useRoute();
  const fromApp    = route.params?.fromApp ?? false;

  const { t } = useTranslation();
  const generateAndActivateProgram = useStore((s) => s.generateAndActivateProgram);
  const createEmptyProgram         = useStore((s) => s.createEmptyProgram);
  const cloneProgramFromTemplate   = useStore((s) => s.cloneProgramFromTemplate);
  const importData                 = useStore((s) => s.importData);
  const exerciseLibrary            = useStore((s) => s.exerciseLibrary);
  const customExercises            = useStore((s) => s.customExercises);
  const storeNavigate              = useStore((s) => s.navigate);
  const language                   = useStore((s) => s.profile?.language ?? 'es');
  const isPro                      = useStore((s) => s.profile?.isPro ?? false);
  const programs                   = useStore((s) => s.programs);
  const pendingExternalImport      = useStore((s) => s.pendingExternalImport);
  const clearPendingExternalImport = useStore((s) => s.clearPendingExternalImport);
  const clientSync                 = useStore((s) => s.clientSync);
  const unlinkFromTrainer          = useStore((s) => s.unlinkFromTrainer);

  const templateList = useMemo(
    () => Object.values(programs ?? {})
      .filter((p) => p.mode === 'template')
      .sort((a, b) => a.name.localeCompare(b.name)),
    [programs],
  );

  const [mode,               setMode]              = useState(null);
  const [showClientCode,     setShowClientCode]     = useState(false);
  const [step,               setStep]              = useState(0);
  const [selectedTemplateId, setSelectedTemplateId] = useState(null);
  const [templateProgramName, setTemplateProgramName] = useState('');
  const [loading,          setLoading]         = useState(false);
  const [importState,      setImportState]     = useState(null);
  const [generatedProgram, setGeneratedProgram]= useState(null); // { program, sessionTemplates }
  const [expandedSessions, setExpandedSessions]= useState(new Set());
  const [manualSessions,   setManualSessions]  = useState(3);
  const [manualName,       setManualName]      = useState('');

  // Handle .fitdata files opened from the OS file explorer while on this screen.
  // AppHeader (which normally handles this) is not mounted during onboarding.
  useEffect(() => {
    if (!pendingExternalImport) return;
    const { rawContent, fileName } = pendingExternalImport;
    clearPendingExternalImport();
    const parsed = parseImportFile(rawContent);
    if (!parsed.ok) { Alert.alert('Archivo no válido', parsed.error); return; }
    setImportState({ fileName, parsedData: parsed.data });
  }, [pendingExternalImport]); // eslint-disable-line react-hooks/exhaustive-deps


  const [answers, setAnswers] = useState({
    level:            null,
    discipline:       null,
    distribution:     null,
    daysPerWeek:      3,
    sessionMinutes:   60,
    goal:             null,
    equipment:        [],
    limitations:      [],
    progressionModel: 'double_progression',
  });

  // B1: nivel → disciplina → días → tiempo → objetivo → equipo → limitaciones → distribución (+ progresión si advanced)
  const totalSteps = answers.level === 'advanced' ? 9 : 8;

  function set_(field, value) {
    setAnswers((a) => ({ ...a, [field]: value }));
  }

  function toggleMulti(field, id) {
    setAnswers((a) => {
      const current = a[field];
      const exclusiveId = EXCLUSIVE_IDS[field];
      if (id === exclusiveId) return { ...a, [field]: [exclusiveId] };
      const without = exclusiveId ? current.filter((x) => x !== exclusiveId) : current;
      return {
        ...a,
        [field]: without.includes(id) ? without.filter((x) => x !== id) : [...without, id],
      };
    });
  }

  function finish() {
    // If the user was connected to a trainer, disconnect now that they have
    // a new program. keepProgram=true so the newly created program is not
    // overwritten by the pre-link previousActiveProgramId.
    if (clientSync?.slotId) {
      unlinkFromTrainer({ keepProgram: true }).catch(() => {});
    }
    if (fromApp) {
      navigation.goBack();
    } else {
      navigation.replace('Main');
    }
  }

  function handleEditProgram() {
    navigation.replace('Main');
    setTimeout(() => storeNavigate('programEditor'), 150);
  }

  function toggleSession(tplId) {
    setExpandedSessions((prev) => {
      const next = new Set(prev);
      if (next.has(tplId)) next.delete(tplId);
      else next.add(tplId);
      return next;
    });
  }

  async function handleFinish() {
    setLoading(true);
    try {
      // A5: 'bodyweight' es un id de UI, no de equipo real — se traduce a
      // equipment: [] (exerciseFitsEquipment ya trata [] como "solo peso corporal").
      const submitAnswers = answers.equipment.includes('bodyweight')
        ? { ...answers, equipment: [] }
        : answers;
      const result = await generateAndActivateProgram(submitAnswers);
      if (fromApp) {
        // Desde dentro de la app: volver atrás sin mostrar preview
        navigation.goBack();
      } else {
        // Primera vez: mostrar preview del programa generado
        setGeneratedProgram(result);
        setLoading(false);
      }
    } catch (err) {
      console.error('Error generando programa:', err);
      Alert.alert('Error', 'No se pudo generar el programa. Inténtalo de nuevo.');
      setLoading(false);
    }
  }

  function handleManualCreate() {
    createEmptyProgram(manualSessions, manualName.trim() || t('onboarding.programNamePlaceholder', 'Mi programa'));
    // Navigate to Main first (activeProgramId is now set, ProgramEditor picks it up as fallback)
    if (fromApp) {
      navigation.goBack();
    } else {
      navigation.replace('Main');
    }
    setTimeout(() => storeNavigate('programEditor'), 150);
  }

  function handleLoadTemplate() {
    const src = programs[selectedTemplateId];
    if (!src) return;
    const name = templateProgramName.trim() || src.name;
    cloneProgramFromTemplate(selectedTemplateId, { name });
    finish();
  }

  async function handlePickFile() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/json', '*/*'],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.length) return;

      const raw    = await FileSystem.readAsStringAsync(result.assets[0].uri, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      const parsed = parseImportFile(raw);
      if (!parsed.ok) {
        Alert.alert(t('common.error', 'Error'), parsed.error);
        return;
      }
      setImportState({ fileName: result.assets[0].name, parsedData: parsed.data });
    } catch (err) {
      if (!err?.message?.includes('cancel')) {
        Alert.alert(t('common.error', 'Error'), err?.message ?? 'No se pudo leer el archivo');
      }
    }
  }

  function handleImport(parsedData, sections) {
    setImportState(null);
    importData(parsedData, sections);
    finish();
  }

  function nextStep() {
    if (step === totalSteps - 1) { handleFinish(); return; }
    setStep((s) => s + 1);
  }
  function prevStep() { setStep((s) => Math.max(0, s - 1)); }

  // ── Preview del programa generado ────────────────────────────────────────────
  if (generatedProgram) {
    const { program, sessionTemplates: generatedTemplates } = generatedProgram;
    const days = program.stages?.length > 0
      ? program.stages[0].days
      : program.days ?? [];

    // Sesiones únicas en orden de aparición
    const uniqueTemplates = [];
    const seen = new Set();
    for (const day of days) {
      const tid = day.sessionTemplateId;
      if (!seen.has(tid)) {
        seen.add(tid);
        const tpl = generatedTemplates[tid];
        if (tpl) uniqueTemplates.push(tpl);
      }
    }

    // 0 si alguna etapa es "sin límite": entonces el programa no tiene final y
    // no hay total que enseñar.
    const stages = program.stages ?? [];
    const totalWeeks = stages.every((s) => s.durationWeeks > 0)
      ? stages.reduce((n, s) => n + s.durationWeeks, 0)
      : 0;

    const countsWarmup = includesWarmup(answers.sessionMinutes);
    const estimatedMinutes = (tpl) => Math.round(
      estimateSessionSec(tpl.exercises ?? [], { ...exerciseLibrary, ...customExercises },
        { includeWarmup: countsWarmup }) / 60,
    );

    return (
      <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        {/* Header */}
        <View style={styles.previewHeader}>
          <BrandTag />
          <Text style={styles.previewReady}>✓ PROGRAMA LISTO</Text>
          <Text style={styles.previewTitle}>{program.name}</Text>
          <Text style={styles.previewMeta}>
            {/* La duración va en portada: es lo que convierte esto en un
                programa y no en una lista de ejercicios (§6). */}
            {totalWeeks > 0 && `${t('onboarding.preview.weeksAndPhases', {
              weeks: totalWeeks,
              phases: program.stages.length,
              defaultValue: `${totalWeeks} semanas · ${program.stages.length} fases`,
            })} · `}
            {days.length} sesiones por ciclo
          </Text>
          {/* B4: hint de ciclo cuando la frecuencia pedida supera las sesiones generadas */}
          {answers.daysPerWeek > days.length && (
            <Text style={styles.previewCycleHint}>
              {t('onboarding.preview.cycleHint', {
                sessions: days.length,
                days: answers.daysPerWeek,
                defaultValue: `Tus ${days.length} sesiones rotan en ciclo — entrenas ${answers.daysPerWeek} días a la semana.`,
              })}
            </Text>
          )}
          {/* §5.3.1: en sesiones cortas el tiempo se estima sin calentamiento
              general — en 30 o 45 minutos se entra a trabajar. Decirlo, porque
              el número de arriba depende de ello. */}
          {!countsWarmup && (
            <Text style={styles.previewCycleHint}>
              {t('onboarding.preview.noWarmupNote',
                'Tiempo estimado sin calentamiento general — en sesiones cortas se entra a trabajar. Incluye el cambio de material entre ejercicios.')}
            </Text>
          )}
        </View>

        {/* Sesiones expandibles */}
        <ScrollView contentContainerStyle={styles.previewList} showsVerticalScrollIndicator={false}>
          {uniqueTemplates.map((tpl, i) => {
            const accent     = resolveColor(th, tpl.color ?? 'var(--day1)');
            const isExpanded = expandedSessions.has(tpl.id);
            const allEx      = { ...exerciseLibrary, ...customExercises };
            return (
              <TouchableOpacity
                key={tpl.id}
                style={[styles.previewSession, { borderLeftColor: accent }]}
                onPress={() => toggleSession(tpl.id)}
                activeOpacity={0.75}
              >
                <Text style={[styles.previewSessionLabel, { color: accent }]}>
                  {tpl.label ?? String.fromCharCode(65 + i)}
                </Text>
                <View style={styles.previewSessionInfo}>
                  <View style={styles.previewSessionHeader}>
                    <Text style={styles.previewSessionName}>{tpl.name}</Text>
                    <Text style={styles.previewChevron}>{isExpanded ? '▲' : '▼'}</Text>
                  </View>
                  <Text style={styles.previewSessionMeta}>
                    {tpl.emphasis ? `${tpl.emphasis} · ` : ''}
                    {(tpl.exercises ?? []).length} ejercicios
                    {/* Duración estimada con el MISMO criterio que el recorte
                        (program-templates.md §5.3.1): por debajo de 60 min
                        pedidos no se cuenta el calentamiento general, así que
                        aquí no se usa `sessionStats` — daría un número que
                        contradice al presupuesto que acaba de aplicarse. */}
                    {` · ${t('onboarding.preview.estimatedMinutes', {
                      minutes: estimatedMinutes(tpl),
                      defaultValue: `~${estimatedMinutes(tpl)} min`,
                    })}`}
                  </Text>
                  {isExpanded && (
                    <View style={styles.previewExList}>
                      {(tpl.exercises ?? []).map((exCfg, idx) => {
                        const def  = allEx[exCfg.exerciseId];
                        const name = def
                          ? (language === 'en' ? (def.nameEn ?? def.name) : def.name)
                          : exCfg.exerciseId;
                        return (
                          <View key={idx} style={styles.previewExItem}>
                            <Text style={styles.previewExOrder}>{exCfg.order ?? idx + 1}</Text>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.previewExName}>{name}</Text>
                              <Text style={styles.previewExMeta}>
                                {exCfg.sets} series
                                {exCfg.minReps && exCfg.maxReps
                                  ? ` · ${exCfg.minReps}–${exCfg.maxReps} reps`
                                  : ''}
                              </Text>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Footer — Editar + Empezar */}
        <View style={styles.previewFooter}>
          <TouchableOpacity style={styles.editBtn} onPress={handleEditProgram} activeOpacity={0.85}>
            <Text style={styles.editBtnText}>EDITAR</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.startBtn} onPress={finish} activeOpacity={0.85}>
            <Text style={styles.startBtnText}>EMPEZAR →</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={[styles.loadingScreen, { paddingTop: insets.top }]}>
        <Text style={styles.loadingTitle}>{t('onboarding.generating', 'GENERANDO...')}</Text>
        <ActivityIndicator color={th.colors.accent} size="large" style={{ marginTop: spacing.lg }} />
        <Text style={styles.loadingDesc}>{t('onboarding.buildingPlan', 'Construyendo tu plan...')}</Text>
      </View>
    );
  }

  // ── Selector de modo ─────────────────────────────────────────────────────────
  if (mode === null) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.modeHeader}>
          {fromApp && (
            <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12} style={styles.backIcon}>
              <Text style={styles.backIconText}>‹</Text>
            </TouchableOpacity>
          )}
          <BrandTag />
          <Text style={styles.modeHeadline}>{t('onboarding.newProgram', 'Nuevo programa')}</Text>
          <Text style={styles.modeSubtitle}>{t('onboarding.howToCreate', '¿Cómo quieres crear tu programa?')}</Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.modeCards}
          showsVerticalScrollIndicator={false}
        >
          <ModeCard
            icon="🤖"
            title={t('onboarding.modeAuto', 'Programa automático')}
            desc={t('onboarding.modeAutoDesc', 'Responde unas preguntas y generamos tu programa personalizado.')}
            onPress={() => setMode('auto')}
            accent
          />
          <ModeCard
            icon="✏️"
            title={t('onboarding.modeManual', 'Programa vacío')}
            desc={t('onboarding.modeManualDesc', 'Crea un programa en blanco y añade tus propios ejercicios.')}
            onPress={() => setMode('manual')}
          />
          <ModeCard
            icon="📥"
            title={t('onboarding.modeImport', 'Importar archivo')}
            desc={t('onboarding.modeImportDesc', 'Carga un archivo .json exportado desde Forma Fit.')}
            onPress={handlePickFile}
          />
          {isPro && templateList.length > 0 && (
            <ModeCard
              icon="📐"
              title="Cargar plantilla"
              desc="Crea un programa a partir de una de tus plantillas."
              onPress={() => {
                setSelectedTemplateId(null);
                setTemplateProgramName('');
                setMode('template_picker');
              }}
            />
          )}
          <ModeCard
            icon="👤"
            title="Tengo un entrenador"
            desc="Introduce el código de tu entrenador para recibir tu programa y mantenerlo sincronizado."
            onPress={() => setShowClientCode(true)}
          />
        </ScrollView>

        {importState && (
          <ImportModal
            fileName={importState.fileName}
            parsedData={importState.parsedData}
            onImport={handleImport}
            onClose={() => setImportState(null)}
          />
        )}

        <ClientCodeModal
          visible={showClientCode}
          onClose={() => setShowClientCode(false)}
          onSuccess={() => navigation.replace('Main')}
        />
      </View>
    );
  }

  // ── Modo manual ──────────────────────────────────────────────────────────────
  if (mode === 'manual') {
    return (
      <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        {/* Cabecera */}
        <View style={styles.modeHeader}>
          <BrandTag />
          <Text style={styles.manualTag}>{t('onboarding.manualProgram', 'PROGRAMA MANUAL')}</Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.manualContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Nombre */}
          <View style={styles.manualField}>
            <Text style={styles.fieldLabel}>
              {t('onboarding.programName', 'NOMBRE DEL PROGRAMA')}
            </Text>
            <TextInput
              style={styles.textInput}
              value={manualName}
              onChangeText={setManualName}
              placeholder={t('onboarding.programNamePlaceholder', 'Mi programa')}
              placeholderTextColor={th.colors.muted2}
              returnKeyType="done"
              autoFocus
            />
          </View>

          {/* Nº de sesiones */}
          <View style={styles.manualField}>
            <Text style={styles.fieldLabel}>
              {t('onboarding.numberOfSessions', 'NÚMERO DE SESIONES')}
            </Text>
            <View style={styles.sessionsRow}>
              {[2, 3, 4, 5, 6].map((n) => (
                <TouchableOpacity
                  key={n}
                  style={[styles.sessionBtn, manualSessions === n && styles.sessionBtnOn]}
                  onPress={() => setManualSessions(n)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.sessionBtnText, manualSessions === n && styles.sessionBtnTextOn]}>
                    {n}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.sessionHint}>
              {t('onboarding.addMoreFromEditor', 'Podrás añadir más desde el editor.')}
            </Text>
          </View>

          {/* Info */}
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              {t('onboarding.emptySessionsHint', {
                count: manualSessions,
                defaultValue: `Se crearán ${manualSessions} sesiones vacías. Añade los ejercicios desde el editor.`,
              })}
            </Text>
          </View>
        </ScrollView>

        {/* Botones */}
        <View style={styles.manualFooter}>
          <TouchableOpacity style={styles.backBtn} onPress={() => setMode(null)} activeOpacity={0.75}>
            <Text style={styles.backBtnText}>‹ Atrás</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.createBtn, !manualName.trim() && styles.createBtnOff]}
            onPress={manualName.trim() ? handleManualCreate : undefined}
            activeOpacity={manualName.trim() ? 0.85 : 1}
          >
            <Text style={[styles.createBtnText, !manualName.trim() && styles.createBtnTextOff]}>
              {t('onboarding.createAndEdit', 'Crear y editar →')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Modo template picker ─────────────────────────────────────────────────────
  if (mode === 'template_picker') {
    const selectedTpl = selectedTemplateId ? programs[selectedTemplateId] : null;

    return (
      <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.modeHeader}>
          <BrandTag />
          <Text style={styles.modeHeadline}>Cargar plantilla</Text>
          <Text style={styles.modeSubtitle}>Selecciona una plantilla para crear tu programa</Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.tplPickerList}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {templateList.map((tpl) => {
            const isSelected = tpl.id === selectedTemplateId;
            const dayCount   = (tpl.stages?.length > 0
              ? tpl.stages.flatMap((s) => s.days ?? [])
              : tpl.days ?? []).length;
            return (
              <TouchableOpacity
                key={tpl.id}
                style={[styles.tplPickerCard, isSelected && styles.tplPickerCardActive]}
                onPress={() => {
                  setSelectedTemplateId(tpl.id);
                  setTemplateProgramName(tpl.name);
                }}
                activeOpacity={0.75}
              >
                <View style={styles.tplPickerCardBody}>
                  <Text style={[styles.tplPickerName, isSelected && styles.tplPickerNameActive]} numberOfLines={1}>
                    {tpl.name}
                  </Text>
                  {dayCount > 0 && (
                    <Text style={styles.tplPickerMeta}>{dayCount} sesiones por ciclo</Text>
                  )}
                </View>
                {isSelected && <Text style={styles.tplPickerCheck}>✓</Text>}
              </TouchableOpacity>
            );
          })}

          {/* Nombre del programa */}
          {selectedTpl && (
            <View style={styles.tplNameField}>
              <Text style={styles.fieldLabel}>NOMBRE DEL PROGRAMA</Text>
              <TextInput
                style={styles.textInput}
                value={templateProgramName}
                onChangeText={setTemplateProgramName}
                placeholder={selectedTpl.name}
                placeholderTextColor={th.colors.muted2}
                returnKeyType="done"
                autoCorrect={false}
              />
            </View>
          )}
        </ScrollView>

        {/* CTA */}
        <View style={styles.tplPickerFooter}>
          <TouchableOpacity style={styles.backBtn} onPress={() => setMode(null)} activeOpacity={0.75}>
            <Text style={styles.backBtnText}>‹ Atrás</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.createBtn, !selectedTemplateId && styles.createBtnOff]}
            onPress={handleLoadTemplate}
            disabled={!selectedTemplateId}
            activeOpacity={0.85}
          >
            <Text style={[styles.createBtnText, !selectedTemplateId && styles.createBtnTextOff]}>
              Crear programa →
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Modo automático — wizard ──────────────────────────────────────────────────
  return (
    <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* Cabecera con barra de progreso */}
      <View style={styles.wizardHeader}>
        <Text style={styles.appName}>{t('onboarding.appName', 'FUERZA & CONTROL')}</Text>
        <OnboardingProgress current={step + 1} total={totalSteps} />
        <Text style={styles.stepIndicator}>
          {t('onboarding.stepIndicator', { current: step + 1, total: totalSteps, defaultValue: `${step + 1} / ${totalSteps}` })}
        </Text>
      </View>

      {/* Pasos — B1: nivel → disciplina → días → tiempo → objetivo → equipo → limitaciones → distribución */}
      {step === 0 && <StepLevel      answers={answers} set_={set_}        onNext={nextStep} onBack={() => setMode(null)} />}
      {step === 1 && <StepDiscipline answers={answers} set_={set_}        onNext={nextStep} onBack={prevStep} />}
      {step === 2 && <StepDays       answers={answers} set_={set_}        onNext={nextStep} onBack={prevStep} />}
      {step === 3 && <StepTime       answers={answers} set_={set_}        onNext={nextStep} onBack={prevStep} />}
      {step === 4 && <StepGoal       answers={answers} set_={set_}        onNext={nextStep} onBack={prevStep} />}
      {step === 5 && <StepEquipment  answers={answers} toggleMulti={toggleMulti} onNext={nextStep} onBack={prevStep} />}
      {step === 6 && <StepLimitations answers={answers} toggleMulti={toggleMulti} onNext={nextStep} onBack={prevStep} />}
      {step === 7 && (
        <StepDistrib
          answers={answers} set_={set_}
          onNext={nextStep} onBack={prevStep}
          isLast={answers.level !== 'advanced'}
        />
      )}
      {step === 8 && answers.level === 'advanced' && (
        <StepProgression answers={answers} set_={set_} onNext={nextStep} onBack={prevStep} isLast />
      )}
    </View>
  );
}

// ─── Pasos individuales ───────────────────────────────────────────────────────

function StepLevel({ answers, set_, onNext, onBack }) {
  const { t } = useTranslation();
  return (
    <OnboardingStep
      title={t('onboarding.stepLevel.title', 'Nivel')}
      subtitle={t('onboarding.stepLevel.subtitle', '¿Cuál es tu nivel de experiencia?')}
      onNext={onNext}
      onBack={onBack}
      nextDisabled={!answers.level}
    >
      {LEVEL_IDS.map((id) => (
        <OptionCard
          key={id}
          label={t(`onboarding.levels.${id}.label`, id)}
          description={t(`onboarding.levels.${id}.description`, '')}
          detail={t(`onboarding.levels.${id}.detail`, '')}
          selected={answers.level === id}
          onClick={() => set_('level', id)}
        />
      ))}
    </OnboardingStep>
  );
}

function StepDiscipline({ answers, set_, onNext, onBack }) {
  const { t } = useTranslation();
  return (
    <OnboardingStep
      title={t('onboarding.stepDiscipline.title', 'Disciplina')}
      subtitle={t('onboarding.stepDiscipline.subtitle', '¿Qué tipo de entrenamiento prefieres?')}
      onNext={onNext}
      onBack={onBack}
      nextDisabled={!answers.discipline}
    >
      {DISC_IDS.map((id) => (
        <OptionCard
          key={id}
          label={t(`onboarding.disciplines.${id}.label`, id)}
          description={t(`onboarding.disciplines.${id}.description`, '')}
          detail={t(`onboarding.disciplines.${id}.detail`, '')}
          selected={answers.discipline === id}
          onClick={() => {
            set_('discipline', id);
            if (id === 'strength'    && !answers.goal) set_('goal', 'strength');
            if (id === 'glutes_legs' && !answers.goal) set_('goal', 'hypertrophy');
            if (id === 'glutes_legs')                  set_('distribution', 'full_body');
          }}
        />
      ))}
    </OnboardingStep>
  );
}

// B2: paso de distribución al FINAL del wizard, con la recomendada primera
// (según días+nivel+disciplina) y badge "Recomendado".
function StepDistrib({ answers, set_, onNext, onBack, isLast }) {
  const styles = useThemedStyles(makeStyles);
  const { t } = useTranslation();
  const recommended = recommendDistribution(answers);
  const orderedIds = [recommended, ...DIST_IDS.filter((id) => id !== recommended)];

  return (
    <OnboardingStep
      title={t('onboarding.stepDistribution.title', 'Distribución')}
      subtitle={t('onboarding.stepDistribution.subtitle', '¿Cómo quieres distribuir los días?')}
      onNext={onNext}
      onBack={onBack}
      nextDisabled={!answers.distribution}
      isLast={isLast}
    >
      {orderedIds.map((id) => {
        const available = DIST_FOR[id].includes(answers.discipline);
        const disabledReason = available
          ? undefined
          : t('onboarding.disabledReasons.notForDiscipline', { discipline: t(`onboarding.disciplines.${answers.discipline}.label`, answers.discipline), defaultValue: 'No disponible para esta disciplina' });
        return (
          <OptionCard
            key={id}
            label={t(`onboarding.distributions.${id}.label`, id)}
            description={t(`onboarding.distributions.${id}.description`, '')}
            badge={id === recommended ? t('onboarding.stepDistribution.recommended', 'Recomendado') : undefined}
            selected={answers.distribution === id}
            disabled={!available}
            disabledReason={disabledReason}
            onClick={() => available && set_('distribution', id)}
          />
        );
      })}
      {answers.daysPerWeek === 7 && (
        <Text style={styles.hint}>
          {t('onboarding.stepDistribution.sevenDaysHint', 'Con 7 días, incluye al menos un día suave o de descanso activo.')}
        </Text>
      )}
    </OnboardingStep>
  );
}

// B1: selector genérico de frecuencia 1–7. daysPerWeek = días que entrena por
// semana (frecuencia), no nº de sesiones distintas — el ciclo rotativo hace el resto.
function StepDays({ answers, set_, onNext, onBack }) {
  const styles = useThemedStyles(makeStyles);
  const { t } = useTranslation();
  const d = answers.daysPerWeek;

  return (
    <OnboardingStep
      title={t('onboarding.stepDays.titleFrequency', 'Días por semana')}
      subtitle={t('onboarding.stepDays.subtitleFrequency', '¿Cuántos días a la semana entrenas?')}
      onNext={onNext} onBack={onBack}
    >
      <View style={styles.dayBtns}>
        {[1, 2, 3, 4, 5, 6, 7].map((n) => (
          <TouchableOpacity
            key={n}
            style={[styles.dayBtn, d === n && styles.dayBtnOn]}
            onPress={() => set_('daysPerWeek', n)}
            activeOpacity={0.75}
          >
            <Text style={[styles.dayBtnText, d === n && styles.dayBtnTextOn]}>{n}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={styles.hint}>
        {t('onboarding.stepDays.daysCount', { count: d, defaultValue: `${d} días a la semana` })}
      </Text>
    </OnboardingStep>
  );
}

// B1: tiempo disponible por sesión → answers.sessionMinutes (presupuesto B3).
const TIME_OPTIONS = [30, 45, 60, 90];

function StepTime({ answers, set_, onNext, onBack }) {
  const { t } = useTranslation();
  return (
    <OnboardingStep
      title={t('onboarding.stepTime.title', 'Tiempo por sesión')}
      subtitle={t('onboarding.stepTime.subtitle', '¿Cuánto tiempo tienes para entrenar cada día?')}
      onNext={onNext} onBack={onBack}
    >
      {TIME_OPTIONS.map((min) => (
        <OptionCard
          key={min}
          label={t(`onboarding.sessionTimes.${min}.label`, `${min} min`)}
          description={t(`onboarding.sessionTimes.${min}.description`, '')}
          selected={answers.sessionMinutes === min}
          onClick={() => set_('sessionMinutes', min)}
        />
      ))}
    </OnboardingStep>
  );
}

function StepGoal({ answers, set_, onNext, onBack }) {
  const { t } = useTranslation();
  return (
    <OnboardingStep
      title={t('onboarding.stepGoal.title', 'Objetivo')}
      subtitle={t('onboarding.stepGoal.subtitle', '¿Cuál es tu objetivo principal?')}
      onNext={onNext} onBack={onBack}
      nextDisabled={!answers.goal}
    >
      {GOAL_IDS.map((id) => {
        const available = goalAvailable(id, answers.level);
        return (
          <OptionCard
            key={id}
            label={t(`onboarding.goals.${id}.label`, id)}
            description={t(`onboarding.goals.${id}.description`, '')}
            selected={answers.goal === id}
            disabled={!available}
            disabledReason={!available ? (GOAL_MIN_LEVEL[id] === 'intermediate' ? t('onboarding.disabledReasons.requiresIntermediate', 'Requiere nivel intermedio') : t('onboarding.disabledReasons.requiresAdvanced', 'Requiere nivel avanzado')) : undefined}
            onClick={() => available && set_('goal', id)}
          />
        );
      })}
    </OnboardingStep>
  );
}

function StepEquipment({ answers, toggleMulti, onNext, onBack }) {
  const { t } = useTranslation();
  return (
    <OnboardingStep
      title={t('onboarding.stepEquipment.title', 'Equipamiento')}
      subtitle={t('onboarding.stepEquipment.subtitle', '¿Con qué material entrenas? (Selección múltiple)')}
      onNext={onNext} onBack={onBack}
      nextDisabled={answers.equipment.length === 0}
    >
      {EQUIP_IDS.map((id) => (
        <OptionCard
          key={id}
          label={t(`onboarding.equipment.${id}.label`, id)}
          description={t(`onboarding.equipment.${id}.description`, '')}
          multi
          selected={answers.equipment.includes(id)}
          onClick={() => toggleMulti('equipment', id)}
        />
      ))}
    </OnboardingStep>
  );
}

function StepLimitations({ answers, toggleMulti, onNext, onBack }) {
  const { t } = useTranslation();
  return (
    <OnboardingStep
      title={t('onboarding.stepLimitations.title', 'Limitaciones')}
      subtitle={t('onboarding.stepLimitations.subtitle', '¿Tienes alguna limitación física? (Selección múltiple)')}
      onNext={onNext} onBack={onBack}
      nextDisabled={answers.limitations.length === 0}
    >
      {LIMIT_IDS.map((id) => (
        <OptionCard
          key={id}
          label={t(`onboarding.limitations.${id}.label`, id)}
          description={t(`onboarding.limitations.${id}.description`, '')}
          multi
          selected={answers.limitations.includes(id)}
          onClick={() => toggleMulti('limitations', id)}
        />
      ))}
    </OnboardingStep>
  );
}

function StepProgression({ answers, set_, onNext, onBack, isLast }) {
  const { t } = useTranslation();
  return (
    <OnboardingStep
      title={t('onboarding.stepProgression.title', 'Modelo de progresión')}
      subtitle={t('onboarding.stepProgression.subtitle', '¿Cómo quieres progresar semana a semana?')}
      onNext={onNext} onBack={onBack}
      isLast={isLast}
    >
      {PROG_IDS.map((id) => (
        <OptionCard
          key={id}
          label={t(`onboarding.progressionModels.${id}.label`, id)}
          description={t(`onboarding.progressionModels.${id}.description`, '')}
          selected={answers.progressionModel === id}
          onClick={() => set_('progressionModel', id)}
        />
      ))}
    </OnboardingStep>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const makeStyles = (th) => StyleSheet.create({
  screen: {
    flex:            1,
    backgroundColor: th.colors.bg,
  },

  // Brand tag
  brandTag: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.xs,
  },
  brandTagForma: {
    fontSize:      typography.lg,
    fontWeight:    typography.heavy,
    color:         th.colors.text,
    letterSpacing: 0.5,
  },
  brandTagFit: {
    fontSize:      typography.sm,
    fontWeight:    typography.bold,
    color:         th.colors.accent,
    letterSpacing: 1,
  },

  // Preview del programa generado
  previewHeader: {
    paddingHorizontal: spacing.xl,
    paddingTop:        spacing.xl,
    paddingBottom:     spacing.lg,
    gap:               4,
  },
  previewReady: {
    fontSize:      typography.xs,
    fontWeight:    typography.bold,
    color:         th.colors.green,
    letterSpacing: 1,
    marginTop:     spacing.sm,
  },
  previewTitle: {
    fontSize:      28,
    fontWeight:    typography.heavy,
    color:         th.colors.text,
    letterSpacing: 0.5,
    lineHeight:    32,
    marginTop:     4,
  },
  previewMeta: {
    fontSize:  typography.base,
    color:     th.colors.muted,
    marginTop: 4,
  },
  previewCycleHint: {
    fontSize:   typography.sm,
    color:      th.colors.accent,
    marginTop:  4,
    lineHeight: typography.sm * 1.5,
  },
  previewList: {
    paddingHorizontal: spacing.xl,
    paddingBottom:     spacing.xxl,
    gap:               spacing.sm,
  },
  previewSession: {
    flexDirection:   'row',
    alignItems:      'flex-start',
    backgroundColor: th.colors.surface,
    borderWidth:     borders.thin,
    borderColor:     th.colors.border,
    borderLeftWidth: 3,
    borderRadius:    th.radius.md,
    padding:         spacing.md,
    gap:             spacing.md,
  },
  previewSessionLabel: {
    fontSize:   22,
    fontWeight: typography.heavy,
    width:      28,
    textAlign:  'center',
    lineHeight: 24,
    paddingTop: 2,
  },
  previewSessionInfo: { flex: 1 },
  previewSessionHeader: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
  },
  previewSessionName: {
    fontSize:   typography.base,
    fontWeight: typography.medium,
    color:      th.colors.text,
    flex:       1,
  },
  previewChevron: {
    fontSize:  typography.xs,
    color:     th.colors.muted,
    marginLeft: spacing.xs,
  },
  previewSessionMeta: {
    fontSize:  typography.xs,
    color:     th.colors.muted,
    marginTop: 2,
  },
  previewExList: {
    marginTop:      spacing.sm,
    paddingTop:     spacing.sm,
    borderTopWidth: borders.thin,
    borderTopColor: th.colors.border,
    gap:            spacing.xs,
  },
  previewExItem: {
    flexDirection: 'row',
    alignItems:    'flex-start',
    gap:           spacing.sm,
  },
  previewExOrder: {
    fontSize:  typography.xs,
    color:     th.colors.muted2,
    width:     16,
    textAlign: 'right',
    paddingTop: 2,
  },
  previewExName: {
    fontSize:   typography.sm,
    fontWeight: typography.medium,
    color:      th.colors.text,
  },
  previewExMeta: {
    fontSize:  typography.xs,
    color:     th.colors.muted,
    marginTop: 1,
  },
  previewFooter: {
    flexDirection:     'row',
    gap:               spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical:   spacing.lg,
    borderTopWidth:    borders.thin,
    borderTopColor:    th.colors.border,
  },
  editBtn: {
    flex:            1,
    borderRadius:    th.radius.md,
    paddingVertical: spacing.md,
    alignItems:      'center',
    justifyContent:  'center',
    borderWidth:     borders.thin,
    borderColor:     th.colors.border,
    backgroundColor: th.colors.surface,
  },
  editBtnText: {
    fontSize:      typography.base,
    fontWeight:    typography.heavy,
    letterSpacing: 1,
    color:         th.colors.muted,
  },
  startBtn: {
    flex:            2,
    backgroundColor: th.colors.accent,
    borderRadius:    th.radius.md,
    paddingVertical: spacing.md,
    alignItems:      'center',
    justifyContent:  'center',
  },
  startBtnText: {
    fontSize:      typography.lg,
    fontWeight:    typography.heavy,
    letterSpacing: 1.5,
    color:         th.colors.onAccent,
  },

  // Loading
  loadingScreen: {
    flex:            1,
    backgroundColor: th.colors.bg,
    alignItems:      'center',
    justifyContent:  'center',
    gap:             spacing.sm,
  },
  loadingTitle: {
    fontSize:      28,
    fontWeight:    typography.heavy,
    color:         th.colors.accent,
    letterSpacing: 2,
    textAlign:     'center',
  },
  loadingDesc: { fontSize: typography.base, color: th.colors.muted, textAlign: 'center' },

  // Mode selector
  modeHeader: {
    paddingHorizontal: spacing.xl,
    paddingTop:        spacing.xl,
    paddingBottom:     spacing.lg,
    gap:               4,
  },
  backIcon:     { marginBottom: spacing.sm },
  backIconText: { fontSize: 24, color: th.colors.muted },
  modeHeadline: {
    fontSize:      28,
    fontWeight:    typography.heavy,
    color:         th.colors.text,
    letterSpacing: 0.5,
    lineHeight:    32,
  },
  modeSubtitle: { fontSize: typography.base, color: th.colors.muted, marginTop: 4 },

  modeCards: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl, gap: spacing.sm },

  modeCard: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             spacing.lg,
    backgroundColor: th.colors.surface,
    borderWidth:     borders.thin,
    borderColor:     th.colors.border,
    borderRadius:    th.radius.lg,
    padding:         spacing.xl,
  },
  modeCardAccent: {
    backgroundColor: withOpacity(th.colors.accent, 0.06),
    borderColor:     withOpacity(th.colors.accent, 0.25),
  },
  modeIcon:  { fontSize: 28, lineHeight: 32, flexShrink: 0 },
  modeBody:  { flex: 1, gap: 3 },
  modeTitle: { fontSize: typography.md, fontWeight: typography.semibold, color: th.colors.text },
  modeTitleAccent: { color: th.colors.accent },
  modeDesc:  { fontSize: typography.sm, color: th.colors.muted, lineHeight: typography.sm * 1.5 },
  modeArrow: { fontSize: 20, color: th.colors.muted, flexShrink: 0 },

  // Wizard header
  wizardHeader: {
    paddingHorizontal: spacing.xl,
    paddingTop:        spacing.xl,
    paddingBottom:     spacing.lg,
    gap:               spacing.sm,
  },
  stepIndicator: {
    fontSize:      typography.xs,
    color:         th.colors.muted,
    letterSpacing: 1,
    marginTop:     4,
  },

  // Manual
  manualTag: {
    fontSize:      typography.xs,
    color:         th.colors.muted,
    letterSpacing: 1,
    marginTop:     2,
  },
  manualContent: { padding: spacing.xl, gap: spacing.xxl },
  manualField:   { gap: spacing.sm },
  fieldLabel: {
    fontSize:      typography.xs,
    fontWeight:    typography.bold,
    color:         th.colors.muted,
    letterSpacing: 2,
  },
  textInput: {
    backgroundColor:   th.colors.surface2,
    borderWidth:       borders.thin,
    borderColor:       th.colors.border,
    borderRadius:      th.radius.md,
    color:             th.colors.text,
    fontSize:          typography.md,
    paddingVertical:   spacing.md,
    paddingHorizontal: spacing.lg,
  },
  sessionsRow: { flexDirection: 'row', gap: spacing.sm },
  sessionBtn: {
    flex:            1,
    height:          56,
    borderRadius:    th.radius.md,
    borderWidth:     borders.thin,
    borderColor:     th.colors.border,
    backgroundColor: th.colors.surface,
    alignItems:      'center',
    justifyContent:  'center',
  },
  sessionBtnOn: {
    borderColor:     th.colors.accent,
    backgroundColor: withOpacity(th.colors.accent, 0.08),
  },
  sessionBtnText:   { fontSize: 24, fontWeight: typography.heavy, color: th.colors.muted },
  sessionBtnTextOn: { color: th.colors.accent },
  sessionHint: { fontSize: typography.xs, color: th.colors.muted, marginTop: 4 },

  infoBox: {
    backgroundColor: th.colors.surface,
    borderWidth:     borders.thin,
    borderColor:     th.colors.borderCard,
    borderRadius:    th.radius.md,
    padding:         spacing.md,
  },
  infoText: { fontSize: typography.sm, color: th.colors.muted, lineHeight: typography.sm * 1.6 },

  manualFooter: {
    flexDirection:     'row',
    gap:               spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical:   spacing.lg,
    borderTopWidth:    borders.thin,
    borderTopColor:    th.colors.border,
  },
  backBtn: {
    backgroundColor: th.colors.surface,
    borderWidth:     borders.thin,
    borderColor:     th.colors.border,
    borderRadius:    th.radius.md,
    paddingVertical:   14,
    paddingHorizontal: spacing.xl,
    justifyContent:  'center',
  },
  backBtnText: { fontSize: typography.base, color: th.colors.text, fontWeight: typography.medium },
  createBtn: {
    flex:            1,
    backgroundColor: th.colors.accent,
    borderRadius:    th.radius.md,
    paddingVertical: 14,
    alignItems:      'center',
    justifyContent:  'center',
  },
  createBtnOff:     { backgroundColor: th.colors.surface2 },
  createBtnText:    { fontSize: 16, fontWeight: typography.heavy, letterSpacing: 1, color: th.colors.onAccent },
  createBtnTextOff: { color: th.colors.muted },

  // StepDays helpers
  dayBtns: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap', marginBottom: spacing.md },
  dayBtn: {
    width:           60,
    height:          60,
    borderRadius:    th.radius.md,
    borderWidth:     borders.thin,
    borderColor:     th.colors.border,
    backgroundColor: th.colors.surface,
    alignItems:      'center',
    justifyContent:  'center',
  },
  dayBtnOn: {
    borderColor:     th.colors.accent,
    backgroundColor: withOpacity(th.colors.accent, 0.08),
  },
  dayBtnText:   { fontSize: 26, fontWeight: typography.heavy, color: th.colors.muted },
  dayBtnTextOn: { color: th.colors.accent },

  hint: { fontSize: typography.xs, color: th.colors.muted, marginTop: spacing.xs },

  // Template picker
  tplPickerList: {
    padding:    spacing.lg,
    gap:        spacing.sm,
    paddingBottom: spacing.xxl,
  },
  tplPickerCard: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: th.colors.surface,
    borderWidth:     borders.thin,
    borderColor:     th.colors.border,
    borderRadius:    th.radius.md,
    padding:         spacing.md,
    gap:             spacing.sm,
  },
  tplPickerCardActive: {
    borderColor:     th.colors.accent,
    backgroundColor: withOpacity(th.colors.accent, 0.06),
  },
  tplPickerCardBody: { flex: 1, minWidth: 0 },
  tplPickerName: {
    fontSize:   typography.base,
    fontWeight: typography.medium,
    color:      th.colors.muted,
  },
  tplPickerNameActive: { color: th.colors.text },
  tplPickerMeta: {
    fontSize:  typography.xs,
    color:     th.colors.muted,
    marginTop: 2,
  },
  tplPickerCheck: {
    fontSize:   typography.base,
    color:      th.colors.accent,
    fontWeight: typography.heavy,
  },
  tplNameField: {
    marginTop: spacing.md,
    gap:       spacing.xs,
  },
  tplPickerFooter: {
    flexDirection:   'row',
    gap:             spacing.sm,
    padding:         spacing.lg,
    paddingBottom:   spacing.xl,
    borderTopWidth:  borders.thin,
    borderTopColor:  th.colors.border,
  },
});
