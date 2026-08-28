/**
 * OnboardingScreen.
 *
 * 4 modos:
 *   null              → selector (Auto / Manual / Importar / Plantilla / Entrenador)
 *   'auto'            → preguntas → propuestas → preview  (onboarding-proposals.md)
 *   'manual'          → nombre + nº de sesiones
 *   'template_picker' → clonar una plantilla propia
 *
 * El modo 'auto' tiene tres fases (`autoPhase`): las preguntas, la lista de
 * plantillas candidatas (con su detalle) y el preview del programa elegido.
 * Nada se guarda hasta que el usuario confirma en el preview — por eso "ver otro
 * programa" no deja programas huérfanos detrás.
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

import { useStore, normalizeOnboardingAnswers } from '../../store/useStore';
import { estimateSessionSec, includesWarmup } from '../../../src/utils/sessionCompression';
import { rankArchetypes } from '../../../src/data/archetypes';
import { adaptArchetype } from '../../../src/utils/archetypeAdapter';
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
const EQUIP_IDS = ['bodyweight', 'machines', 'dumbbells', 'barbell', 'pullup_bar', 'parallettes', 'kettlebell', 'resistance_band', 'ab_wheel'];
const LIMIT_IDS = ['none', 'shoulder', 'lower_back', 'knee'];
const PROG_IDS  = ['double_progression', 'linear', 'reps_progression'];

// §5.1: disciplina y objetivo se preguntan juntos. Son dos campos del motor pero
// una sola decisión del usuario, y separarlos obligaba a explicar la diferencia.
// `max_strength` ya no es opción: lo trae la plantilla si lo usa.
const IDENTITY_OPTIONS = [
  { id: 'muscle',       discipline: 'standard',     goal: 'hypertrophy' },
  { id: 'strength',     discipline: 'strength',     goal: 'strength'    },
  { id: 'glutes_legs',  discipline: 'glutes_legs',  goal: 'hypertrophy' },
  { id: 'calisthenics', discipline: 'calisthenics', goal: 'endurance'   },
];

// IDs exclusivos por campo: seleccionarlos limpia el resto y viceversa
// (limitations: 'none' = sin limitaciones; equipment: 'bodyweight' = solo peso corporal).
const EXCLUSIVE_IDS = { limitations: 'none', equipment: 'bodyweight' };

const LEVEL_ORDER    = { beginner: 0, intermediate: 1, advanced: 2 };
const GOAL_MIN_LEVEL = { hypertrophy: 'beginner', endurance: 'beginner', strength: 'intermediate', max_strength: 'advanced' };

function goalAvailable(goalId, level) {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[GOAL_MIN_LEVEL[goalId]];
}

// La distribución (full body / U/L / PPL) ya no se pregunta: es una propiedad de
// la plantilla que el usuario elige en la pantalla de propuestas. Se sigue
// guardando en el snapshot, tomada de la plantilla elegida (§9).

const totalWeeksOf = (phases) => (phases ?? []).reduce((n, p) => n + (p.durationWeeks ?? 0), 0);

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

// ─── Piezas compartidas por propuestas, detalle y preview ─────────────────────

/** Sesiones distintas del ciclo, en orden de aparición. */
function uniqueSessionTemplates(program, templates) {
  const days = program.stages?.length > 0 ? (program.stages[0].days ?? []) : (program.days ?? []);
  const seen = new Set();
  const out  = [];
  for (const day of days) {
    if (seen.has(day.sessionTemplateId)) continue;
    seen.add(day.sessionTemplateId);
    const tpl = templates[day.sessionTemplateId];
    if (tpl) out.push(tpl);
  }
  return out;
}

function exerciseName(allEx, id, language) {
  const def = allEx[id];
  if (!def) return id;
  return language === 'en' ? (def.nameEn ?? def.name) : def.name;
}

/** `N semanas · M fases · S sesiones por ciclo` — la portada de cada tarjeta (§5.2). */
function proposalMeta(t, entry) {
  const phases = entry.archetype.phases ?? [];
  const weeks  = totalWeeksOf(phases);
  const parts  = [];
  if (weeks > 0) {
    parts.push(t('onboarding.preview.weeksAndPhases', {
      weeks, phases: phases.length, defaultValue: `${weeks} semanas · ${phases.length} fases`,
    }));
  }
  parts.push(t('onboarding.proposals.sessionsPerCycle', {
    sessions: entry.sessionsPerCycle,
    defaultValue: `${entry.sessionsPerCycle} sesiones por ciclo`,
  }));
  return parts.join(' · ');
}

// Orden de la tabla de §3.1. `rotates` y `slowCycle` son excluyentes entre sí,
// así que en la práctica sólo compiten la barra y el resto.
const NOTE_ORDER = ['needsBarbell', 'rotates', 'slowCycle', 'levelStretch', 'lowFrequency'];

/** El aviso honesto de la tarjeta. Sin ninguna nota, encaja y se dice. */
function proposalNote(t, entry, daysPerWeek) {
  const note = NOTE_ORDER.find((n) => entry.notes.includes(n));
  if (!note) return t('onboarding.proposals.notes.fits', 'Encaja con tu material.');
  return t(`onboarding.proposals.notes.${note}`, {
    exercises: entry.adaptationCost,
    sessions:  entry.sessionsPerCycle,
    days:      daysPerWeek,
    level:     t(`onboarding.levels.${entry.archetype.level}.label`, entry.archetype.level),
    defaultValue: '',
  });
}

/** Una sesión del ciclo, plegable, con sus ejercicios. */
function SessionRow({ tpl, index, allEx, exName, expanded, onToggle, countsWarmup }) {
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { t }  = useTranslation();
  const accent = resolveColor(th, tpl.color ?? 'var(--day1)');
  // Duración estimada con el MISMO criterio que el recorte (program-templates.md
  // §5.3.1): por debajo de 60 min pedidos no se cuenta el calentamiento general,
  // así que aquí no se usa `sessionStats` — daría un número que contradice al
  // presupuesto que acaba de aplicarse.
  const minutes = Math.round(
    estimateSessionSec(tpl.exercises ?? [], allEx, { includeWarmup: countsWarmup }) / 60,
  );

  return (
    <TouchableOpacity
      style={[styles.previewSession, { borderLeftColor: accent }]}
      onPress={onToggle}
      activeOpacity={0.75}
    >
      <Text style={[styles.previewSessionLabel, { color: accent }]}>
        {tpl.label ?? String.fromCharCode(65 + index)}
      </Text>
      <View style={styles.previewSessionInfo}>
        <View style={styles.previewSessionHeader}>
          <Text style={styles.previewSessionName}>{tpl.name}</Text>
          <Text style={styles.previewChevron}>{expanded ? '▲' : '▼'}</Text>
        </View>
        <Text style={styles.previewSessionMeta}>
          {tpl.emphasis ? `${tpl.emphasis} · ` : ''}
          {t('onboarding.preview.exerciseCount', {
            exercises: (tpl.exercises ?? []).length,
            defaultValue: `${(tpl.exercises ?? []).length} ejercicios`,
          })}
          {` · ${t('onboarding.preview.estimatedMinutes', { minutes, defaultValue: `~${minutes} min` })}`}
        </Text>
        {expanded && (
          <View style={styles.previewExList}>
            {(tpl.exercises ?? []).map((exCfg, idx) => (
              <View key={idx} style={styles.previewExItem}>
                <Text style={styles.previewExOrder}>{exCfg.order ?? idx + 1}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.previewExName}>{exName(exCfg.exerciseId)}</Text>
                  <Text style={styles.previewExMeta}>
                    {t('onboarding.preview.setCount', {
                      sets: exCfg.sets,
                      defaultValue: `${exCfg.sets} series`,
                    })}
                    {exCfg.minReps && exCfg.maxReps ? ` · ${exCfg.minReps}–${exCfg.maxReps} reps` : ''}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

/**
 * §5.4 — lo que el adaptador tuvo que hacer para que la plantilla te encaje.
 *
 * `adaptArchetype` devuelve estos cuatro campos desde las fases 1-3 y hasta
 * ahora no los leía nadie: el programa llegaba con ejercicios sustituidos, con
 * huecos sin cubrir o pasado de tiempo, y no se decía. Enseñarlo es la promesa
 * de la feature, no un extra.
 */
function AdaptationNotice({
  substitutions, unresolved, overTime, overBudget,
  sessionMinutes, templates, allEx, language, countsWarmup,
}) {
  const styles = useThemedStyles(makeStyles);
  const { t }  = useTranslation();

  // El mismo hueco se resuelve igual en varias sesiones: decirlo una vez.
  const subs = [];
  const seenSub = new Set();
  for (const s of substitutions ?? []) {
    const key = `${s.slotExerciseId}→${s.resolvedExerciseId}`;
    if (seenSub.has(key)) continue;
    seenSub.add(key);
    subs.push(s);
  }

  const gaps = {};
  for (const u of unresolved ?? []) gaps[u.primaryGroup] = (gaps[u.primaryGroup] ?? 0) + 1;

  const late = (overTime ?? []).map((label) => {
    const tpl = Object.values(templates).find((x) => x.label === label);
    const minutes = tpl
      ? Math.round(estimateSessionSec(tpl.exercises ?? [], allEx, { includeWarmup: countsWarmup }) / 60)
      : 0;
    return { label, minutes };
  });

  const budget = overBudget ?? [];

  if (!subs.length && !Object.keys(gaps).length && !late.length && !budget.length) return null;

  const group = (g) => t(`exerciseSelector.groups.${g}`, g);

  return (
    <View style={styles.noticeCard}>
      <Text style={styles.noticeTitle}>
        {t('onboarding.preview.adaptedTitle', 'LO QUE HEMOS AJUSTADO')}
      </Text>

      {subs.map((s, i) => (
        <Text key={`s${i}`} style={styles.noticeItem}>
          {`${exerciseName(allEx, s.slotExerciseId, language)} → ${exerciseName(allEx, s.resolvedExerciseId, language)}`}
        </Text>
      ))}

      {Object.entries(gaps).map(([g, n]) => (
        <Text key={`u${g}`} style={styles.noticeWarn}>
          {t('onboarding.preview.unresolved', {
            slots: n,
            group: group(g),
            defaultValue: `No hemos podido cubrir ${n} huecos de ${group(g)} con tu material.`,
          })}
        </Text>
      ))}

      {late.map(({ label, minutes }) => (
        <Text key={`o${label}`} style={styles.noticeWarn}>
          {t('onboarding.preview.overTime', {
            label, minutes, budget: sessionMinutes,
            defaultValue: `Tu sesión ${label} dura ~${minutes} min, más de los ${sessionMinutes} que pediste.`,
          })}
        </Text>
      ))}

      {budget.map((g) => (
        <Text key={`b${g}`} style={styles.noticeWarn}>
          {t('onboarding.preview.overBudget', {
            group: group(g),
            defaultValue: `Volumen de ${group(g)} por encima de lo recomendado para tu nivel.`,
          })}
        </Text>
      ))}
    </View>
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

  // Fase del modo auto: preguntas → propuestas (con su detalle) → preview.
  const [autoPhase,  setAutoPhase]  = useState('questions');
  const [showAll,    setShowAll]    = useState(false);   // "ver todas" en propuestas
  const [detailId,   setDetailId]   = useState(null);    // arquetipo abierto en detalle
  const [chosen,     setChosen]     = useState(null);    // { archetypeId, adapted }

  // Nivel → identidad → días → material eligen la plantilla; tiempo y
  // limitaciones sólo ajustan la elegida. Se preguntan todas antes de la lista
  // para que el detalle de cada candidata enseñe los ejercicios definitivos.
  const stepIds = answers.level === 'advanced'
    ? ['level', 'identity', 'days', 'equipment', 'time', 'limitations', 'progression']
    : ['level', 'identity', 'days', 'equipment', 'time', 'limitations'];
  const totalSteps  = stepIds.length;
  // Bajar de avanzado a intermedio acorta la lista con el paso ya pasado.
  const currentStep = stepIds[Math.min(step, totalSteps - 1)];

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

  // Las respuestas tal y como las consume el motor. La misma normalización que
  // aplica el store, para que la plantilla que se previsualiza sea la que se
  // guarda.
  const submitAnswers = useMemo(() => normalizeOnboardingAnswers(answers), [answers]);

  // §3.1: el ranking nunca devuelve vacío y nunca oculta nada — el material
  // ordena, no filtra.
  const ranked = useMemo(
    () => (autoPhase === 'questions' ? [] : rankArchetypes(submitAnswers)),
    [autoPhase, submitAnswers],
  );

  const detailEntry = detailId ? ranked.find((r) => r.archetype.id === detailId) : null;
  const detailAdapted = useMemo(
    () => (detailEntry ? adaptArchetype(detailEntry.archetype, submitAnswers) : null),
    [detailEntry, submitAnswers],
  );

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

  // Elegir una plantilla NO guarda nada: adapta en memoria y enseña el preview.
  // El programa sólo se crea cuando el usuario confirma, para que "ver otro
  // programa" no vaya dejando programas a medias en el store.
  function chooseArchetype(entry, adapted) {
    setChosen({ archetypeId: entry.archetype.id, adapted });
    setExpandedSessions(new Set());
    setDetailId(null);
    setAutoPhase('preview');
  }

  function backToProposals() {
    setChosen(null);
    setDetailId(null);
    setExpandedSessions(new Set());
    setAutoPhase('proposals');
  }

  async function persistChosen() {
    const entry = ranked.find((r) => r.archetype.id === chosen.archetypeId);
    // §9: `distribution` ya no se pregunta, pero el snapshot la sigue llevando —
    // se toma de la plantilla elegida.
    const finalAnswers = { ...submitAnswers, distribution: entry?.archetype.distribution ?? 'full_body' };
    return generateAndActivateProgram(finalAnswers, chosen.archetypeId);
  }

  // `after` corre con el programa ya guardado y activo.
  async function confirmProgram(after) {
    setLoading(true);
    try {
      await persistChosen();
      after();
    } catch (err) {
      console.error('Error generando programa:', err);
      Alert.alert(t('common.error', 'Error'), t('onboarding.generateError', 'No se pudo generar el programa. Inténtalo de nuevo.'));
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
    if (step >= totalSteps - 1) { setAutoPhase('proposals'); return; }
    setStep((s) => s + 1);
  }
  function prevStep() { setStep((s) => Math.max(0, s - 1)); }

  // §4.6: volver atrás no pierde las respuestas — `answers` no se toca.
  function backToQuestions() {
    setShowAll(false);
    setDetailId(null);
    setStep(totalSteps - 1);
    setAutoPhase('questions');
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

  // ── Preview del programa elegido ─────────────────────────────────────────────
  // Todavía sin guardar: se pinta del `adaptArchetype` que hizo `chooseArchetype`.
  if (mode === 'auto' && autoPhase === 'preview' && chosen) {
    const {
      program, sessionTemplates: chosenTemplates, phases,
      substitutions, unresolved, overTime, overBudget,
    } = chosen.adapted;
    const totalWeeks      = totalWeeksOf(phases);
    const uniqueTemplates = uniqueSessionTemplates(program, chosenTemplates);
    const countsWarmup    = includesWarmup(answers.sessionMinutes);
    const allEx           = { ...exerciseLibrary, ...customExercises };
    const exName          = (id) => exerciseName(allEx, id, language);

    return (
      <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        {/* Header */}
        <View style={styles.previewHeader}>
          <BrandTag />
          <Text style={styles.previewReady}>{t('onboarding.preview.ready', '✓ PROGRAMA LISTO')}</Text>
          <Text style={styles.previewTitle}>{program.name}</Text>
          <Text style={styles.previewMeta}>
            {/* La duración va en portada: es lo que convierte esto en un
                programa y no en una lista de ejercicios (§4.5). */}
            {totalWeeks > 0 && `${t('onboarding.preview.weeksAndPhases', {
              weeks: totalWeeks,
              phases: phases.length,
              defaultValue: `${totalWeeks} semanas · ${phases.length} fases`,
            })} · `}
            {t('onboarding.proposals.sessionsPerCycle', {
              sessions: uniqueTemplates.length,
              defaultValue: `${uniqueTemplates.length} sesiones por ciclo`,
            })}
          </Text>
          {/* B4: hint de ciclo cuando la frecuencia pedida supera las sesiones generadas */}
          {answers.daysPerWeek > uniqueTemplates.length && (
            <Text style={styles.previewCycleHint}>
              {t('onboarding.preview.cycleHint', {
                sessions: uniqueTemplates.length,
                days: answers.daysPerWeek,
                defaultValue: `Tus ${uniqueTemplates.length} sesiones rotan en ciclo — entrenas ${answers.daysPerWeek} días a la semana.`,
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

        <ScrollView contentContainerStyle={styles.previewList} showsVerticalScrollIndicator={false}>
          {/* §5.4: lo que el adaptador tuvo que hacer para que el programa te
              encaje. Hasta ahora pasaba en silencio. */}
          <AdaptationNotice
            substitutions={substitutions}
            unresolved={unresolved}
            overTime={overTime}
            overBudget={overBudget}
            sessionMinutes={answers.sessionMinutes}
            templates={chosenTemplates}
            allEx={allEx}
            language={language}
            countsWarmup={countsWarmup}
          />

          {uniqueTemplates.map((tpl, i) => (
            <SessionRow
              key={tpl.id}
              tpl={tpl}
              index={i}
              allEx={allEx}
              exName={exName}
              expanded={expandedSessions.has(tpl.id)}
              onToggle={() => toggleSession(tpl.id)}
              countsWarmup={countsWarmup}
            />
          ))}

          <TouchableOpacity onPress={backToProposals} activeOpacity={0.75} style={styles.linkBtn}>
            <Text style={styles.linkBtnText}>
              {t('onboarding.proposals.another', '‹ Ver otro programa')}
            </Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Footer — Editar + Empezar. Aquí es donde el programa se guarda. */}
        <View style={styles.previewFooter}>
          <TouchableOpacity style={styles.editBtn} onPress={() => confirmProgram(handleEditProgram)} activeOpacity={0.85}>
            <Text style={styles.editBtnText}>{t('onboarding.preview.edit', 'EDITAR')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.startBtn} onPress={() => confirmProgram(finish)} activeOpacity={0.85}>
            <Text style={styles.startBtnText}>{t('onboarding.preview.start', 'EMPEZAR →')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Detalle de una candidata ─────────────────────────────────────────────────
  if (mode === 'auto' && autoPhase === 'proposals' && detailEntry) {
    const { archetype } = detailEntry;
    const { program, sessionTemplates: detailTemplates, phases } = detailAdapted;
    const uniqueTemplates = uniqueSessionTemplates(program, detailTemplates);
    const countsWarmup    = includesWarmup(answers.sessionMinutes);
    const allEx           = { ...exerciseLibrary, ...customExercises };
    const exName          = (id) => exerciseName(allEx, id, language);

    return (
      <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.previewHeader}>
          <Text style={styles.previewTitle}>{archetype.name}</Text>
          <Text style={styles.previewMeta}>{proposalMeta(t, detailEntry)}</Text>
          {archetype.summary ? <Text style={styles.proposalSummary}>{archetype.summary}</Text> : null}
        </View>

        <ScrollView contentContainerStyle={styles.previewList} showsVerticalScrollIndicator={false}>
          {/* Las fases: lo que distingue un programa de una lista de ejercicios */}
          <Text style={styles.sectionLabel}>{t('onboarding.proposals.phasesTitle', 'FASES')}</Text>
          {(phases ?? []).map((ph, i) => (
            <View key={i} style={styles.phaseRow}>
              <Text style={styles.phaseIndex}>{i + 1}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.phaseName}>{ph.name}</Text>
                <Text style={styles.phaseMeta}>
                  {t('onboarding.proposals.phaseWeeks', {
                    weeks: ph.durationWeeks,
                    defaultValue: `${ph.durationWeeks} semanas`,
                  })}
                </Text>
              </View>
            </View>
          ))}

          <Text style={[styles.sectionLabel, { marginTop: spacing.xl }]}>
            {t('onboarding.proposals.sessionsTitle', 'SESIONES')}
          </Text>
          {uniqueTemplates.map((tpl, i) => (
            <SessionRow
              key={tpl.id}
              tpl={tpl}
              index={i}
              allEx={allEx}
              exName={exName}
              expanded={expandedSessions.has(tpl.id)}
              onToggle={() => toggleSession(tpl.id)}
              countsWarmup={countsWarmup}
            />
          ))}
        </ScrollView>

        <View style={styles.previewFooter}>
          <TouchableOpacity style={styles.backBtn} onPress={() => setDetailId(null)} activeOpacity={0.75}>
            <Text style={styles.backBtnText}>{t('common.back', 'Atrás')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.startBtn} onPress={() => chooseArchetype(detailEntry, detailAdapted)} activeOpacity={0.85}>
            <Text style={styles.startBtnText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
              {t('onboarding.proposals.choose', 'ELEGIR ESTE PROGRAMA')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Propuestas ───────────────────────────────────────────────────────────────
  // §4.2: el material ordena, no filtra. Nada se oculta ni se bloquea aquí.
  if (mode === 'auto' && autoPhase === 'proposals') {
    const visible = showAll ? ranked : ranked.slice(0, 3);

    return (
      <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.previewHeader}>
          <BrandTag />
          <Text style={styles.previewTitle}>{t('onboarding.proposals.title', 'Tus programas')}</Text>
          <Text style={styles.previewMeta}>
            {t('onboarding.proposals.subtitle', 'Elegidos por lo que has contestado. Toca uno para verlo entero.')}
          </Text>
        </View>

        <ScrollView contentContainerStyle={styles.previewList} showsVerticalScrollIndicator={false}>
          {visible.map((entry, i) => (
            <TouchableOpacity
              key={entry.archetype.id}
              style={styles.proposalCard}
              onPress={() => { setExpandedSessions(new Set()); setDetailId(entry.archetype.id); }}
              activeOpacity={0.75}
            >
              <View style={styles.proposalHeader}>
                <Text style={styles.proposalName}>{entry.archetype.name}</Text>
                {i === 0 && (
                  <View style={styles.proposalBadge}>
                    <Text style={styles.proposalBadgeText}>
                      {t('onboarding.proposals.recommended', 'Recomendado')}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={styles.proposalMeta}>{proposalMeta(t, entry)}</Text>
              {entry.archetype.summary ? (
                <Text style={styles.proposalSummary}>{entry.archetype.summary}</Text>
              ) : null}
              <Text style={styles.proposalNote}>{proposalNote(t, entry, answers.daysPerWeek)}</Text>
            </TouchableOpacity>
          ))}

          {ranked.length > 3 && (
            <TouchableOpacity onPress={() => setShowAll((v) => !v)} activeOpacity={0.75} style={styles.linkBtn}>
              <Text style={styles.linkBtnText}>
                {showAll
                  ? t('onboarding.proposals.seeTop', 'Ver sólo las recomendadas')
                  : t('onboarding.proposals.seeAll', {
                    total: ranked.length,
                    defaultValue: `Ver las ${ranked.length} plantillas`,
                  })}
              </Text>
            </TouchableOpacity>
          )}
        </ScrollView>

        <View style={styles.previewFooter}>
          <TouchableOpacity style={styles.backBtn} onPress={backToQuestions} activeOpacity={0.75}>
            <Text style={styles.backBtnText}>{t('common.back', 'Atrás')}</Text>
          </TouchableOpacity>
        </View>
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

      {/* nivel → identidad → días → material → tiempo → limitaciones (+ progresión si avanzado) */}
      {(() => {
        const nav = {
          onNext: nextStep,
          onBack: step === 0 ? () => setMode(null) : prevStep,
          // El último paso no genera: lleva a la lista de propuestas.
          nextLabel: step === totalSteps - 1
            ? t('onboarding.proposals.seeProposals', 'VER PROGRAMAS')
            : undefined,
        };
        switch (currentStep) {
          case 'level':       return <StepLevel       answers={answers} set_={set_} {...nav} />;
          case 'identity':    return <StepIdentity    answers={answers} setAnswers={setAnswers} {...nav} />;
          case 'days':        return <StepDays        answers={answers} set_={set_} {...nav} />;
          case 'equipment':   return <StepEquipment   answers={answers} toggleMulti={toggleMulti} {...nav} />;
          case 'time':        return <StepTime        answers={answers} set_={set_} {...nav} />;
          case 'limitations': return <StepLimitations answers={answers} toggleMulti={toggleMulti} {...nav} />;
          case 'progression': return <StepProgression answers={answers} set_={set_} {...nav} />;
          default:            return null;
        }
      })()}
    </View>
  );
}

// ─── Pasos individuales ───────────────────────────────────────────────────────

function StepLevel({ answers, set_, onNext, onBack, nextLabel }) {
  const { t } = useTranslation();
  return (
    <OnboardingStep
      title={t('onboarding.stepLevel.title', 'Nivel')}
      subtitle={t('onboarding.stepLevel.subtitle', '¿Cuál es tu nivel de experiencia?')}
      onNext={onNext}
      onBack={onBack}
      nextLabel={nextLabel}
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

// B1: selector genérico de frecuencia 1–7. daysPerWeek = días que entrena por
// semana (frecuencia), no nº de sesiones distintas — el ciclo rotativo hace el resto.
function StepDays({ answers, set_, onNext, onBack, nextLabel }) {
  const styles = useThemedStyles(makeStyles);
  const { t } = useTranslation();
  const d = answers.daysPerWeek;

  return (
    <OnboardingStep
      title={t('onboarding.stepDays.titleFrequency', 'Días por semana')}
      subtitle={t('onboarding.stepDays.subtitleFrequency', '¿Cuántos días a la semana entrenas?')}
      onNext={onNext} onBack={onBack} nextLabel={nextLabel}
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

function StepTime({ answers, set_, onNext, onBack, nextLabel }) {
  const { t } = useTranslation();
  return (
    <OnboardingStep
      title={t('onboarding.stepTime.title', 'Tiempo por sesión')}
      subtitle={t('onboarding.stepTime.subtitle', '¿Cuánto tiempo tienes para entrenar cada día?')}
      onNext={onNext} onBack={onBack} nextLabel={nextLabel}
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

// §5.1: "¿Qué buscas?" — una sola pregunta que fija `discipline` y `goal`.
// Sigue habiendo un mínimo de nivel para los objetivos de fuerza (GOAL_MIN_LEVEL):
// eso bloquea una TARJETA de esta pregunta, no una plantilla de la lista.
function StepIdentity({ answers, setAnswers, onNext, onBack, nextLabel }) {
  const { t } = useTranslation();
  return (
    <OnboardingStep
      title={t('onboarding.identity.title', '¿Qué buscas?')}
      subtitle={t('onboarding.identity.subtitle', 'Con esto elegimos el tipo de programa.')}
      onNext={onNext} onBack={onBack} nextLabel={nextLabel}
      nextDisabled={!answers.discipline || !answers.goal}
    >
      {IDENTITY_OPTIONS.map(({ id, discipline, goal }) => {
        const available = goalAvailable(goal, answers.level);
        return (
          <OptionCard
            key={id}
            label={t(`onboarding.identity.${id}.label`, id)}
            description={t(`onboarding.identity.${id}.description`, '')}
            selected={answers.discipline === discipline && answers.goal === goal}
            disabled={!available}
            disabledReason={available ? undefined : t('onboarding.disabledReasons.requiresIntermediate', 'Requiere nivel intermedio')}
            onClick={() => available && setAnswers((a) => ({ ...a, discipline, goal }))}
          />
        );
      })}
    </OnboardingStep>
  );
}

function StepEquipment({ answers, toggleMulti, onNext, onBack, nextLabel }) {
  const { t } = useTranslation();
  return (
    <OnboardingStep
      title={t('onboarding.stepEquipment.title', 'Equipamiento')}
      subtitle={t('onboarding.stepEquipment.subtitle', '¿Con qué material entrenas? (Selección múltiple)')}
      onNext={onNext} onBack={onBack} nextLabel={nextLabel}
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

function StepLimitations({ answers, toggleMulti, onNext, onBack, nextLabel }) {
  const { t } = useTranslation();
  return (
    <OnboardingStep
      title={t('onboarding.stepLimitations.title', 'Limitaciones')}
      subtitle={t('onboarding.stepLimitations.subtitle', '¿Tienes alguna limitación física? (Selección múltiple)')}
      onNext={onNext} onBack={onBack} nextLabel={nextLabel}
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

function StepProgression({ answers, set_, onNext, onBack, nextLabel }) {
  const { t } = useTranslation();
  return (
    <OnboardingStep
      title={t('onboarding.stepProgression.title', 'Modelo de progresión')}
      subtitle={t('onboarding.stepProgression.subtitle', '¿Cómo quieres progresar semana a semana?')}
      onNext={onNext} onBack={onBack} nextLabel={nextLabel}
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

  // Propuestas — tarjeta de plantilla candidata
  proposalCard: {
    backgroundColor: th.colors.surface,
    borderRadius:    th.radius.md,
    padding:         spacing.lg,
    marginBottom:    spacing.md,
    gap:             spacing.sm,
  },
  proposalHeader: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    gap:            spacing.sm,
  },
  proposalName: {
    flex:       1,
    fontSize:   typography.lg,
    fontWeight: typography.heavy,
    color:      th.colors.text,
  },
  proposalBadge: {
    backgroundColor:   th.tint.accent10,
    borderRadius:      th.radius.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical:   spacing.xs,
  },
  proposalBadgeText: {
    fontSize:      typography.xs,
    fontWeight:    typography.bold,
    letterSpacing: 0.5,
    color:         th.colors.accent,
  },
  proposalMeta: {
    fontSize:   typography.sm,
    fontWeight: typography.medium,
    color:      th.colors.accent,
  },
  proposalSummary: {
    fontSize:   typography.base,
    color:      th.colors.text,
    lineHeight: typography.base * 1.5,
  },
  proposalNote: {
    fontSize:   typography.sm,
    color:      th.colors.mutedLight,
    lineHeight: typography.sm * 1.5,
  },

  // Detalle — fases
  sectionLabel: {
    fontSize:      typography.xs,
    fontWeight:    typography.heavy,
    letterSpacing: 1,
    color:         th.colors.muted,
    marginBottom:  spacing.sm,
  },
  phaseRow: {
    flexDirection:   'row',
    gap:             spacing.md,
    backgroundColor: th.colors.surface,
    borderRadius:    th.radius.sm,
    padding:         spacing.md,
    marginBottom:    spacing.xs2,
  },
  phaseIndex: {
    fontSize:   typography.sm,
    fontWeight: typography.heavy,
    color:      th.colors.accent,
    width:      14,
  },
  phaseName: {
    fontSize:   typography.base,
    fontWeight: typography.medium,
    color:      th.colors.text,
  },
  phaseMeta: {
    fontSize:  typography.xs,
    color:     th.colors.muted,
    marginTop: 1,
  },

  // Enlaces de texto ("ver todas", "ver otro programa")
  linkBtn: {
    paddingVertical: spacing.md,
    alignItems:      'center',
  },
  linkBtnText: {
    fontSize:   typography.base,
    fontWeight: typography.medium,
    color:      th.colors.accent,
  },

  // Aviso de adaptación (§5.4)
  noticeCard: {
    backgroundColor: th.colors.surface2,
    borderRadius:    th.radius.md,
    padding:         spacing.lg,
    marginBottom:    spacing.md,
    gap:             spacing.sm,
  },
  noticeTitle: {
    fontSize:      typography.xs,
    fontWeight:    typography.heavy,
    letterSpacing: 1,
    color:         th.colors.muted,
  },
  noticeItem: {
    fontSize:   typography.sm,
    color:      th.colors.mutedLight,
    lineHeight: typography.sm * 1.5,
  },
  noticeWarn: {
    fontSize:   typography.sm,
    color:      th.colors.orange,
    lineHeight: typography.sm * 1.5,
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
