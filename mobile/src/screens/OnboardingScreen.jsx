/**
 * OnboardingScreen.
 *
 * 4 modos:
 *   null              → selector (Auto / Manual / Importar / Plantilla / Entrenador)
 *   'auto'            → tres preguntas → propuestas → tu programa (onboarding-simple.md)
 *   'manual'          → nombre + nº de sesiones
 *   'template_picker' → clonar una plantilla propia
 *
 * El modo 'auto' tiene tres fases (`autoPhase`): las tres preguntas (nivel,
 * qué buscas, días — auto-avanzan al tocar), la lista de plantillas
 * candidatas y el programa elegido con sus ajustes en vivo. Nada se guarda
 * hasta EMPEZAR/EDITAR — por eso "ver otro programa" no deja programas
 * huérfanos.
 *
 * Revisión 2 (docs/specs/onboarding-simple.md): la UI ya no porta el
 * onboarding web (`OptionCard`/`OnboardingStep`/`OnboardingProgress`
 * desaparecieron) — cada pieza sale de una pantalla migrada ya cerrada, con
 * cita de fichero y línea en la spec.
 *
 * Se reutiliza como pantalla de "nuevo programa" desde dentro de la app
 * pasando el parámetro de navegación: { fromApp: true }.
 */

import { useState, useMemo, useEffect } from 'react';
import {
  View, Text, ScrollView, TextInput,
  TouchableOpacity, ActivityIndicator,
  Alert, StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { Path, G, Circle } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';

import { useStore, normalizeOnboardingAnswers } from '../../store/useStore';
import { estimateSessionSec, includesWarmup } from '../utils/sessionCompression';
import { rankArchetypes } from '../data/archetypes';
import { adaptArchetype } from '../utils/archetypeAdapter';
import { diffAdaptations, computeAdjustments } from '../utils/adaptationDiff';
import ImportModal from '../components/ImportModal';
import ClientCodeModal from '../components/ClientCodeModal';
import CycleWeeks from '../components/onboarding/CycleWeeks';
import AdjustSheet from '../components/onboarding/AdjustSheet';
import AdaptationPanel from '../components/onboarding/AdaptationPanel';
import { ArrowIcon, ChevronDown } from '../components/ui/EditorIcons';
import ScreenHeader from '../components/ui/ScreenHeader';
import { NavRow } from '../components/ui/EditorRows';
import { RowIcon, ROW_CHEVRON } from '../components/ui/MenuList';
import { EQUIP_PRESETS, presetOf } from '../utils/equipmentPresets';
import { spacing, typography, textStyles, borders, withOpacity, sheetRowBase } from '../theme';
import { useTheme, useThemedStyles } from '../useTheme';
import { resolveColor } from '../themes';
import { parseImportFile } from '../utils/importFile';
import { templatesOf } from '../utils/programOwnership';
import { allProgramDays } from '../utils/stageProgress';

// ─── Datos estáticos (IDs) — igual que el original ────────────────────────────

const LEVEL_IDS = ['beginner', 'intermediate', 'advanced'];

// §5.1: disciplina y objetivo se preguntan juntos. Son dos campos del motor pero
// una sola decisión del usuario, y separarlos obligaba a explicar la diferencia.
// `max_strength` ya no es opción: lo trae la plantilla si lo usa.
const IDENTITY_OPTIONS = [
  { id: 'muscle',       discipline: 'standard',     goal: 'hypertrophy' },
  { id: 'strength',     discipline: 'strength',     goal: 'strength'    },
  { id: 'glutes_legs',  discipline: 'glutes_legs',  goal: 'hypertrophy' },
  { id: 'calisthenics', discipline: 'calisthenics', goal: 'endurance'   },
];

// §2 de la spec: nivel y días ya no vienen premarcados — son preguntas de
// verdad, no perillas con valor por defecto. Tiempo, material y limitaciones
// sí lo son: viven en la hoja de ajustes (§7) encima del programa ya montado.
const DEFAULT_ANSWERS = {
  level:            null,
  discipline:       null,
  goal:             null,
  daysPerWeek:      null,
  distribution:     null,
  sessionMinutes:   60,
  equipment:        EQUIP_PRESETS.gym,
  limitations:      ['none'],
  progressionModel: 'double_progression',
};

const totalWeeksOf = (phases) => (phases ?? []).reduce((n, p) => n + (p.durationWeeks ?? 0), 0);
const totalSetsOf  = (exercisesLists) => exercisesLists.reduce(
  (n, exercises) => n + (exercises ?? []).reduce((m, ex) => m + (ex.sets ?? 0), 0), 0,
);

// ─── Tarjeta de modo ──────────────────────────────────────────────────────────
//
// Misma anatomía que `QuestionCard` (§4 de onboarding-simple.md: tarjeta de
// elección, NO lista agrupada), más el icono gris de `MenuList` y la flecha de
// fila navegable. Los emoji se van con la migración: no hay ni uno en ninguna
// pantalla ya cerrada.

const MODE_ICONS = {
  auto:     <Path d="m12 3.5 2.7 5.5 6 .9-4.3 4.2 1 6-5.4-2.8-5.4 2.8 1-6L3.3 9.9l6-.9z" />,
  manual:   <Path d="M12 5v14M5 12h14" />,
  import:   <Path d="M12 5v14M6 13l6 6 6-6" />,
  template: <Path d="M4 7h16M4 12h16M4 17h10" />,
  trainer:  <G><Circle cx="12" cy="8" r="3.2" /><Path d="M5.5 19a6.5 6.5 0 0 1 13 0" /></G>,
};

// Botón primario del onboarding. La flecha es el `ArrowIcon` de la cabecera
// —el asset real— y no un "→" de texto: el glifo salía fino y sin centrar.
function PrimaryBtn({ label, onPress, disabled }) {
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <TouchableOpacity
      style={[styles.startBtn, disabled && styles.startBtnOff]}
      onPress={disabled ? undefined : onPress}
      activeOpacity={disabled ? 1 : 0.85}
    >
      <Text style={[styles.startBtnText, disabled && styles.startBtnTextOff]}>{label}</Text>
      <ArrowIcon size={14} color={disabled ? th.colors.mutedLight : th.colors.onAccent} />
    </TouchableOpacity>
  );
}

function ModeCard({ icon, title, desc, badge, onPress }) {
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <TouchableOpacity style={styles.modeCard} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.modeIcon}><RowIcon>{MODE_ICONS[icon]}</RowIcon></View>
      <View style={styles.modeBody}>
        <View style={styles.modeTitleLine}>
          <Text style={styles.modeTitle}>{title}</Text>
          {badge ? (
            <View style={styles.modeBadge}><Text style={styles.modeBadgeText}>{badge}</Text></View>
          ) : null}
        </View>
        <Text style={styles.modeDesc}>{desc}</Text>
      </View>
      <ArrowIcon size={ROW_CHEVRON} color={th.colors.muted} />
    </TouchableOpacity>
  );
}

// ─── Cabecera lima — §4: ProgramDetailScreen `styles.header` + `CycleDots` de
// HomeScreen. La usan las tres preguntas, propuestas y el programa elegido;
// sólo las preguntas pintan los tres puntos. ──────────────────────────────────

function RotatingChevron({ open, size = 12, color }) {
  const rotation = useSharedValue(open ? 180 : 0);
  useEffect(() => {
    rotation.value = withTiming(open ? 180 : 0, { duration: 180 });
  }, [open, rotation]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.value}deg` }] }));
  return (
    <Animated.View style={style}>
      <ChevronDown size={size} color={color} />
    </Animated.View>
  );
}

function LimeHeader({ eyebrow, title, onBack, dotsDone }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <ScreenHeader
      onBack={onBack}
      eyebrow={eyebrow}
      title={title}
      right={dotsDone != null ? (ink) => (
        <View style={styles.limeHeaderDots}>
          {[0, 1, 2].map((i) => (
            <View
              key={i}
              style={[styles.limeDot, { backgroundColor: i < dotsDone ? ink : withOpacity(ink, 0.2) }]}
            />
          ))}
        </View>
      ) : null}
    />
  );
}

// Contenedor de las tres preguntas: cabecera fija + pregunta + hint. Sin
// botón "Siguiente" — las tres auto-avanzan al tocar una opción (§6.1).
function QuestionScreen({ title, dotsDone, onBack, sectionLabel, hint, children }) {
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { t }  = useTranslation();
  return (
    <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <LimeHeader eyebrow={t('onboarding.newProgram', 'NUEVO PROGRAMA')} title={title} onBack={onBack} dotsDone={dotsDone} />
      <ScrollView contentContainerStyle={styles.qBody} showsVerticalScrollIndicator={false}>
        {sectionLabel ? <Text style={styles.sectionLabel}>{sectionLabel}</Text> : null}
        {children}
        {hint ? <Text style={styles.qHint}>{hint}</Text> : null}
      </ScrollView>
    </View>
  );
}

// Tarjeta de opción de nivel/identidad — §4: "tarjetas de navegación"
// (Clientes/History/HomeView), NO lista agrupada (`getCardRadii` es para
// listas densas de datos, no de elección). Selección: `tint.accent10` +
// borde `accent50` + nombre en `accent` (§6.1).
function QuestionCard({ title, subtitle, selected, onPress }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <TouchableOpacity style={[styles.qCard, selected && styles.qCardOn]} onPress={onPress} activeOpacity={0.75}>
      <Text style={[styles.qCardTitle, selected && styles.qCardTitleOn]}>{title}</Text>
      {subtitle ? <Text style={styles.qCardSubtitle}>{subtitle}</Text> : null}
    </TouchableOpacity>
  );
}

// ─── Piezas compartidas por propuestas y programa elegido ─────────────────────

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

// El mismo hueco se resuelve igual en varias sesiones: decirlo una vez.
function dedupSubstitutions(substitutions) {
  const out = [];
  const seen = new Set();
  for (const s of substitutions ?? []) {
    const key = `${s.slotExerciseId}→${s.resolvedExerciseId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

// Orden de gravedad: una nota, la primera que aplique. `needsBarbell` nunca
// se emite aquí (§9: no se rankea con `equipment`) y `rotates` no se pinta —
// `CycleWeeks` lo enseña mejor que una frase.
const NOTE_PRIORITY = ['slowCycle', 'levelStretch', 'lowFrequency'];

/** El aviso que manda, o `null` si no hay nada que decir. */
function proposalNote(t, entry, daysPerWeek) {
  const note = NOTE_PRIORITY.find((n) => entry.notes.includes(n));
  if (!note) return null;
  return t(`onboarding.proposals.notes.${note}`, {
    exercises: entry.adaptationCost,
    sessions:  entry.sessionsPerCycle,
    days:      daysPerWeek,
    level:     t(`onboarding.levels.${entry.archetype.level}.label`, entry.archetype.level),
  });
}

// Fila de 3 datos — §6.2/§6.3: valor `hero` 22 en `accent`, etiqueta
// `smallBold` 11 en `mutedLight`. `bordered` añade el filete vertical entre
// columnas y el filete horizontal arriba/abajo (propuestas); el preview usa
// la misma fila sin ninguno de los dos.
function StatsRow({ items, bordered = false, card = false }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={[styles.statsRow, bordered && styles.statsRowBordered, card && styles.statsRowCard]}>
      {items.map((item, i) => (
        <View key={i} style={[styles.stat, i > 0 && (bordered || card) && styles.statDivider]}>
          {item.custom ?? <Text style={styles.statValue}>{item.value}</Text>}
          <Text style={styles.statLabel} numberOfLines={1}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}

// Tres barras de exigencia — principiante 1, intermedio 2, avanzado 3.
function Pips({ filled, total = 3 }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.pips}>
      {Array.from({ length: total }, (_, i) => (
        <View key={i} style={[styles.pip, i < filled && styles.pipOn]} />
      ))}
    </View>
  );
}

/** Una sesión del ciclo, plegable, con sus ejercicios. Se conserva (§6.4):
 * sin borde y con `ChevronDown` girando en vez del triángulo relleno. */
function SessionRow({ tpl, index, allEx, exName, expanded, onToggle, countsWarmup }) {
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { t }  = useTranslation();
  const accent = resolveColor(th, tpl.color ?? 'var(--day1)');
  // Duración estimada con el MISMO criterio que el recorte (program-templates.md
  // §5.3.1): por debajo de `NO_WARMUP_BELOW_MIN` (45) no se cuenta el calentamiento,
  // así que aquí no se usa `sessionStats` — daría un número que contradice al
  // presupuesto que acaba de aplicarse.
  const minutes = Math.round(
    estimateSessionSec(tpl.exercises ?? [], allEx, { includeWarmup: countsWarmup }) / 60,
  );

  return (
    <TouchableOpacity
      style={styles.previewSession}
      onPress={onToggle}
      activeOpacity={0.75}
    >
      <Text style={[styles.previewSessionLetter, { color: accent }]}>
        {tpl.label ?? String.fromCharCode(65 + index)}
      </Text>
      <View style={styles.previewSessionInfo}>
        <View style={styles.previewSessionHeader}>
          <Text style={styles.previewSessionName}>{tpl.name}</Text>
          <RotatingChevron open={expanded} size={10} color={th.colors.mutedLight} />
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
 * Tarjeta de plantilla candidata — §6.2, tres bloques.
 *
 * Se pinta ANTES de preguntar el material: los conteos de ejercicios/series
 * de cada sesión son los del ARQUETIPO crudo (antes de adaptar), no los que
 * sobrevivirían a la sustitución por equipo — es lo único cierto en este
 * punto y lo que distingue una plantilla de otra.
 */
function ProposalCard({ entry, recommended, daysPerWeek, onPress }) {
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { t }  = useTranslation();
  const { archetype } = entry;
  const weeks       = totalWeeksOf(archetype.phases);
  const phasesCount = archetype.phases?.length ?? 0;
  const totalSets   = totalSetsOf(archetype.days.map((d) => d.exercises));
  const levelBars   = { beginner: 1, intermediate: 2, advanced: 3 }[archetype.level] ?? 2;
  const nota        = proposalNote(t, entry, daysPerWeek);

  return (
    <TouchableOpacity style={styles.proposalCard} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.proposalHead}>
        <View style={styles.proposalTitleLine}>
          <Text style={styles.proposalName}>{archetype.name}</Text>
          {recommended && (
            <View style={styles.proposalBadge}>
              <Text style={styles.proposalBadgeText}>{t('onboarding.proposals.best', 'MEJOR')}</Text>
            </View>
          )}
        </View>
        <Text style={styles.proposalByline}>
          {weeks > 0 ? `${t('onboarding.proposals.weeks', { weeks, defaultValue: `${weeks} semanas` })} · ` : ''}
          {t('onboarding.proposals.phasesCount', { count: phasesCount, defaultValue: `${phasesCount} fases` })}
        </Text>
      </View>

      <StatsRow bordered items={[
        { value: archetype.days.length, label: t('onboarding.proposals.sessionsLabel', 'SESIONES') },
        { value: totalSets,             label: t('onboarding.proposals.setsLabel', 'SERIES') },
        { custom: <Pips filled={levelBars} />, label: t('onboarding.proposals.demandLabel', 'EXIGENCIA') },
      ]} />

      <View style={styles.proposalSessions}>
        {archetype.days.map((d, i) => {
          const exCount  = d.exercises.length;
          const setCount = totalSetsOf([d.exercises]);
          return (
            <View key={i} style={styles.proposalSessionRow}>
              <Text style={[styles.proposalSessionLetter, { color: resolveColor(th, d.color ?? 'var(--day1)') }]}>
                {d.label}
              </Text>
              <View style={styles.proposalSessionInfo}>
                <Text style={styles.proposalSessionName} numberOfLines={1}>{d.name}</Text>
                <Text style={styles.proposalSessionMeta}>
                  {t('onboarding.preview.exerciseCount', { exercises: exCount, defaultValue: `${exCount} ejercicios` })}
                  {` · `}
                  {t('onboarding.preview.setCount', { sets: setCount, defaultValue: `${setCount} series` })}
                </Text>
              </View>
            </View>
          );
        })}
      </View>

      {archetype.summary ? <Text style={styles.proposalSummary}>{archetype.summary}</Text> : null}
      {nota ? <Text style={styles.proposalNote}>{nota}</Text> : null}
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
  const clientSync                 = useStore((s) => s.clientSync);
  const unlinkFromTrainer          = useStore((s) => s.unlinkFromTrainer);

  const templateList = useMemo(() => templatesOf(programs), [programs]);

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

  // El .fitdata abierto desde el explorador lo atiende `ExternalImportModal`,
  // en `RootNavigator`. La copia que había aquí existía porque `AppHeader` no
  // está montado durante el onboarding; con el modal global eso deja de
  // importar, y el cierre del onboarding tras importar un programa lo decide
  // allí `profile.onboardingCompleted` en vez de qué pantalla montó el modal.


  const [answers, setAnswers] = useState(DEFAULT_ANSWERS);

  // Fase del modo auto: preguntas → propuestas → programa elegido.
  const [autoPhase, setAutoPhase] = useState('questions');
  const [showAll,   setShowAll]   = useState(false);   // "ver todas" en propuestas
  const [chosenId,  setChosenId]  = useState(null);    // plantilla elegida
  const [sheetOpen, setSheetOpen] = useState(false);           // hoja de ajustes (§7)
  const [adjustmentsOpen, setAdjustmentsOpen] = useState(false); // panel colapsado (§8)

  // Nivel, identidad y días son las tres preguntas de verdad — auto-avanzan.
  const stepIds     = ['level', 'identity', 'days'];
  const totalSteps  = stepIds.length;
  const currentStep = stepIds[Math.min(step, totalSteps - 1)];

  function set_(field, value) {
    setAnswers((a) => ({ ...a, [field]: value }));
  }

  // Las respuestas tal y como las consume el motor. La misma normalización que
  // aplica el store, para que la plantilla que se previsualiza sea la que se
  // guarda.
  const submitAnswers = useMemo(() => normalizeOnboardingAnswers(answers), [answers]);
  const allEx = useMemo(
    () => ({ ...exerciseLibrary, ...customExercises }),
    [exerciseLibrary, customExercises],
  );

  // SIN material a propósito (§9): en este punto no se ha preguntado, y
  // `equipment` ausente le dice a `rankArchetypes` que no lo puntúe. Pasarle
  // `[]` sería decirle que el usuario no tiene nada, que es otra cosa.
  const ranked = useMemo(() => (autoPhase === 'questions' ? [] : rankArchetypes({
    level:       answers.level,
    discipline:  answers.discipline,
    goal:        answers.goal,
    daysPerWeek: answers.daysPerWeek,
  })), [autoPhase, answers.level, answers.discipline, answers.goal, answers.daysPerWeek]);

  const chosenEntry = chosenId ? ranked.find((r) => r.archetype.id === chosenId) : null;

  // El motor, en vivo. Se recalcula con cada toque de la hoja de ajustes: es
  // lo que convierte "material" y "tiempo" en algo que se ve pasar en vez de
  // en dos preguntas más.
  const tuned = useMemo(
    () => (chosenEntry ? adaptArchetype(chosenEntry.archetype, submitAnswers) : null),
    [chosenEntry, submitAnswers],
  );

  // §5.2: la MISMA plantilla y las MISMAS respuestas, sin presupuesto de
  // tiempo — sólo para restar y saber qué se llevó el recorte. Un
  // `adaptArchetype` de más por render del preview; es puro y son milisegundos.
  const freeTuned = useMemo(
    () => (chosenEntry ? adaptArchetype(chosenEntry.archetype, { ...submitAnswers, sessionMinutes: null }) : null),
    [chosenEntry, submitAnswers],
  );
  const timeCuts = useMemo(
    () => (tuned && freeTuned ? diffAdaptations(freeTuned, tuned) : []),
    [tuned, freeTuned],
  );
  const dedupedSubs = useMemo(() => dedupSubstitutions(tuned?.substitutions), [tuned]);
  const dayColorOf = useMemo(() => {
    const byLabel = {};
    for (const tpl of Object.values(tuned?.sessionTemplates ?? {})) {
      byLabel[tpl.label] = resolveColor(th, tpl.color ?? 'var(--day1)');
    }
    return (label) => byLabel[label] ?? th.colors.accent;
  }, [tuned, th]);
  const adjustments = useMemo(() => computeAdjustments({
    subs:           dedupedSubs,
    unresolved:     tuned?.unresolved,
    levelCuts:      tuned?.levelCuts,
    timeCuts,
    overBudget:     tuned?.overBudget,
    limitations:    answers.limitations,
    sessionMinutes: answers.sessionMinutes,
    allEx, language, dayColorOf, t,
  }), [dedupedSubs, tuned, timeCuts, answers.limitations, answers.sessionMinutes, allEx, language, dayColorOf, t]);

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

  // Elegir una plantilla NO guarda nada: va directo al programa, donde se
  // adapta en vivo. Sólo se crea al confirmar, para que "ver otro programa"
  // no vaya dejando programas a medias en el store.
  function chooseArchetype(entry) {
    setChosenId(entry.archetype.id);
    setExpandedSessions(new Set());
    setAdjustmentsOpen(false);
    setSheetOpen(false);
    setAutoPhase('preview');
  }

  function backToProposals() {
    setChosenId(null);
    setExpandedSessions(new Set());
    setAutoPhase('proposals');
  }

  async function persistChosen() {
    // §9: `distribution` ya no se pregunta, pero el snapshot la sigue llevando —
    // se toma de la plantilla elegida.
    const finalAnswers = { ...submitAnswers, distribution: chosenEntry?.archetype.distribution ?? 'full_body' };
    return generateAndActivateProgram(finalAnswers, chosenId);
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
        Alert.alert(t('common.error', 'Error'), t(parsed.errorKey, parsed.errorParams));
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

  // Volver atrás no pierde nada — `answers` no se toca.
  function backToQuestions() {
    setShowAll(false);
    setChosenId(null);
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

  // ── Tu programa: el elegido, todavía sin guardar ─────────────────────────────
  // Se pinta del `adaptArchetype` en vivo, y la hoja de ajustes (§7) lo
  // repinta con cada toque. La cabecera va FIJA, fuera del `ScrollView` — es
  // lo que responde a la hoja (trampa §12).
  if (mode === 'auto' && autoPhase === 'preview' && tuned) {
    const {
      program, sessionTemplates: tunedTemplates, phases,
    } = tuned;
    const totalWeeks      = totalWeeksOf(phases);
    const phasesCount     = phases?.length ?? 0;
    const uniqueTemplates = uniqueSessionTemplates(program, tunedTemplates);
    const countsWarmup    = includesWarmup(answers.sessionMinutes);
    const exName          = (id) => exerciseName(allEx, id, language);

    const minutosPorSesion = uniqueTemplates.map((tpl) => Math.round(
      estimateSessionSec(tpl.exercises ?? [], allEx, { includeWarmup: countsWarmup }) / 60,
    ));
    const mediaMinutos = minutosPorSesion.length
      ? Math.round(minutosPorSesion.reduce((a, b) => a + b, 0) / minutosPorSesion.length)
      : 0;
    // §6.3.2: sobre las plantillas YA ADAPTADAS, no sobre el arquetipo — por
    // eso bajan al apretar el tiempo.
    const totalSets = totalSetsOf(uniqueTemplates.map((tpl) => tpl.exercises));

    const materialLabel    = t(`onboarding.adjustSheet.material.${presetOf(answers.equipment)}`).toUpperCase();
    const limitationsList  = answers.limitations ?? [];
    const limitationsLabel = (!limitationsList.length || limitationsList.includes('none'))
      ? t('onboarding.limitations.none.label', 'Sin limitaciones').toUpperCase()
      : limitationsList.length === 1
        ? t(`onboarding.limitations.${limitationsList[0]}.label`, limitationsList[0]).toUpperCase()
        : t('onboarding.chips.limitationsCount', { count: limitationsList.length }).toUpperCase();
    const adjustNavTitle = `${answers.sessionMinutes} MIN · ${materialLabel} · ${limitationsLabel}`;

    return (
      <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <LimeHeader
          eyebrow={t('onboarding.preview.eyebrow', 'TU PROGRAMA')}
          title={program.name}
          onBack={backToProposals}
        />

        <ScrollView contentContainerStyle={styles.previewList} showsVerticalScrollIndicator={false}>
          <Text style={styles.byline}>
            {[
              totalWeeks > 0 ? t('onboarding.proposals.weeks', { weeks: totalWeeks, defaultValue: `${totalWeeks} semanas` }) : null,
              phasesCount > 0 ? t('onboarding.proposals.phasesCount', { count: phasesCount, defaultValue: `${phasesCount} fases` }) : null,
              t(`onboarding.goals.${answers.goal}.label`, answers.goal ?? ''),
            ].filter(Boolean).join(' · ')}
          </Text>

          <StatsRow card items={[
            { value: uniqueTemplates.length, label: t('onboarding.proposals.sessionsLabel', 'SESIONES') },
            { value: totalSets,              label: t('onboarding.preview.setsLabel', 'SERIES') },
            { value: `${mediaMinutos}′`,     label: t('onboarding.preview.perSessionLabel', 'POR SESIÓN') },
          ]} />

          {/* §5.3.1/§9: en sesiones cortas el tiempo se estima sin
              calentamiento general — decirlo, porque los datos de arriba
              dependen de ello y nunca usan `sessionStats`. */}
          {!countsWarmup && (
            <Text style={styles.previewCycleHint}>
              {t('onboarding.preview.noWarmupNote',
                'Tiempo estimado sin calentamiento general — en sesiones cortas se entra a trabajar. Incluye el cambio de material entre ejercicios.')}
            </Text>
          )}

          <View>
            <Text style={styles.sectionLabel}>{t('onboarding.preview.cycleSectionLabel', 'Cómo se reparte')}</Text>
            <CycleWeeks templates={uniqueTemplates} daysPerWeek={answers.daysPerWeek} />
            {/* El dibujo del ciclo sin decir qué es un ciclo no explica nada:
                misma frase que la pantalla de programa vacío. */}
            <Text style={[styles.qHint, styles.hintGap]}>{t('onboarding.cycleExplainer')}</Text>
          </View>

          <View>
            <Text style={styles.sectionLabel}>{t('onboarding.preview.adjustSectionLabel', 'Ajustes')}</Text>
            <NavRow
              title={adjustNavTitle}
              subtitle={t('onboarding.preview.adjustNavSubtitle', 'Tiempo, material y limitaciones')}
              onPress={() => setSheetOpen(true)}
            />
          </View>

          {adjustments.count > 0 && (
            <TouchableOpacity
              style={styles.adjRow}
              onPress={() => setAdjustmentsOpen((v) => !v)}
              activeOpacity={0.75}
            >
              <Text style={styles.adjRowText}>
                {t('onboarding.preview.adjustmentsRow', { count: adjustments.count, defaultValue: `${adjustments.count} ajustes a tu programa` })}
              </Text>
              <RotatingChevron open={adjustmentsOpen} size={12} color={th.colors.mutedLight} />
            </TouchableOpacity>
          )}
          {adjustmentsOpen && <AdaptationPanel adjustments={adjustments} />}

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

        {/* Aquí es donde el programa se guarda por primera vez. */}
        <View style={styles.previewFooter}>
          <View style={styles.previewFooterInner}>
            <Text style={styles.changeLaterText}>
              {t('onboarding.preview.changeLater', 'Puedes cambiar cualquier cosa después, en el editor.')}
            </Text>
            <View style={styles.previewFooterBtns}>
              <TouchableOpacity style={styles.editBtn} onPress={() => confirmProgram(handleEditProgram)} activeOpacity={0.85}>
                <Text style={styles.editBtnText}>{t('onboarding.preview.edit', 'EDITAR')}</Text>
              </TouchableOpacity>
              <PrimaryBtn label={t('onboarding.preview.start')} onPress={() => confirmProgram(finish)} />
            </View>
          </View>
        </View>

        <AdjustSheet
          visible={sheetOpen}
          onClose={() => setSheetOpen(false)}
          answers={answers}
          onChange={set_}
          timeCuts={timeCuts}
          subs={dedupedSubs}
          unresolved={tuned.unresolved}
        />
      </View>
    );
  }

  // ── Propuestas ───────────────────────────────────────────────────────────────
  // Todavía sin saber el material: la tarjeta enseña la ESTRUCTURA (sesiones,
  // ciclo y semanas), que no depende de lo que el usuario tenga.
  if (mode === 'auto' && autoPhase === 'proposals') {
    const visible = showAll ? ranked : ranked.slice(0, 3);
    const levelLabel = t(`onboarding.levels.${answers.level}.label`, answers.level ?? '');

    return (
      <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <LimeHeader
          eyebrow={t('onboarding.proposals.eyebrow', {
            level: levelLabel.toUpperCase(), count: answers.daysPerWeek,
            defaultValue: `${levelLabel.toUpperCase()} · ${answers.daysPerWeek} DÍAS`,
          })}
          title={t('onboarding.proposals.title', 'Tus programas')}
          onBack={backToQuestions}
        />

        <ScrollView contentContainerStyle={styles.previewList} showsVerticalScrollIndicator={false}>
          {visible.map((entry, i) => (
            <ProposalCard
              key={entry.archetype.id}
              entry={entry}
              recommended={i === 0}
              daysPerWeek={answers.daysPerWeek}
              onPress={() => chooseArchetype(entry)}
            />
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
      </View>
    );
  }

  // ── Selector de modo ─────────────────────────────────────────────────
  if (mode === null) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <LimeHeader
          eyebrow={t('onboarding.newProgram', 'NUEVO PROGRAMA')}
          title={t('onboarding.howToCreate')}
          onBack={fromApp ? () => navigation.goBack() : null}
        />

        <ScrollView
          contentContainerStyle={styles.modeCards}
          showsVerticalScrollIndicator={false}
        >
          <ModeCard
            icon="auto"
            title={t('onboarding.modeAuto')}
            desc={t('onboarding.modeAutoDesc')}
            badge={t('onboarding.modeRecommended')}
            onPress={() => setMode('auto')}
          />
          <ModeCard
            icon="manual"
            title={t('onboarding.modeManual')}
            desc={t('onboarding.modeManualDesc')}
            onPress={() => setMode('manual')}
          />
          <ModeCard
            icon="import"
            title={t('onboarding.modeImport')}
            desc={t('onboarding.modeImportDesc')}
            onPress={handlePickFile}
          />
          {isPro && templateList.length > 0 && (
            <ModeCard
              icon="template"
              title={t('onboarding.modeTemplate')}
              desc={t('onboarding.modeTemplateDesc', { count: templateList.length })}
              onPress={() => {
                setSelectedTemplateId(null);
                setTemplateProgramName('');
                setMode('template_picker');
              }}
            />
          )}
          <ModeCard
            icon="trainer"
            title={t('onboarding.modeTrainer')}
            desc={t('onboarding.modeTrainerDesc')}
            onPress={() => setShowClientCode(true)}
          />

          <Text style={styles.modeFooterHint}>{t('onboarding.modeFooterHint')}</Text>
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

  // ── Modo manual ────────────────────────────────────────────────────
  if (mode === 'manual') {
    return (
      <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <LimeHeader
          eyebrow={t('onboarding.newProgram', 'NUEVO PROGRAMA')}
          title={t('onboarding.modeManual')}
          onBack={() => setMode(null)}
        />

        {/* Pie y cuerpo dentro del KAV: si no, el teclado tapa los botones y no
            se puede crear el programa sin cerrarlo antes. */}
        <KeyboardAvoidingView
          style={styles.kav}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
        <ScrollView
          contentContainerStyle={styles.formBody}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View>
            <Text style={styles.sectionLabel}>{t('onboarding.programName')}</Text>
            <TextInput
              style={styles.textInput}
              value={manualName}
              onChangeText={setManualName}
              placeholder={t('onboarding.programNamePlaceholder')}
              placeholderTextColor={th.colors.mutedLight}
              returnKeyType="done"
              autoFocus
            />
          </View>

          <View>
            <Text style={styles.sectionLabel}>{t('onboarding.sessionsPerCycle')}</Text>
            {/* Mismo rango que la pregunta de días (1-7): una sola sesión es un
                ciclo válido, y siete es el techo en las dos pantallas. */}
            <View style={styles.dayChipsRow}>
              {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                <TouchableOpacity
                  key={n}
                  style={[styles.dayChip, manualSessions === n && styles.dayChipOn]}
                  onPress={() => setManualSessions(n)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.dayChipText, manualSessions === n && styles.dayChipTextOn]}>
                    {n}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={[styles.qHint, styles.hintGap]}>
              {t('onboarding.emptySessionsHint', { count: manualSessions })}
            </Text>
            <Text style={[styles.qHint, styles.hintGap]}>
              {t('onboarding.cycleExplainer')}
            </Text>
          </View>
        </ScrollView>

        <View style={styles.previewFooter}>
          <View style={styles.previewFooterBtns}>
            <TouchableOpacity style={styles.editBtn} onPress={() => setMode(null)} activeOpacity={0.85}>
              <Text style={styles.editBtnText}>{t('onboarding.back')}</Text>
            </TouchableOpacity>
            <PrimaryBtn
              label={t('onboarding.createAndEdit')}
              onPress={handleManualCreate}
              disabled={!manualName.trim()}
            />
          </View>
        </View>
        </KeyboardAvoidingView>
      </View>
    );
  }

  // ── Modo template picker ───────────────────────────────────────────
  if (mode === 'template_picker') {
    const selectedTpl = selectedTemplateId ? programs[selectedTemplateId] : null;

    return (
      <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <LimeHeader
          eyebrow={t('onboarding.newProgram', 'NUEVO PROGRAMA')}
          title={t('onboarding.modeTemplate')}
          onBack={() => setMode(null)}
        />

        <KeyboardAvoidingView
          style={styles.kav}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
        <ScrollView
          contentContainerStyle={styles.formBody}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View>
            <Text style={styles.sectionLabel}>{t('onboarding.yourTemplates')}</Text>
            <View style={styles.qCards}>
              {templateList.map((tpl) => {
                const dayCount = allProgramDays(tpl).length;
                return (
                  <QuestionCard
                    key={tpl.id}
                    title={tpl.name}
                    subtitle={dayCount > 0 ? t('onboarding.templateMeta', { count: dayCount }) : null}
                    selected={tpl.id === selectedTemplateId}
                    onPress={() => {
                      setSelectedTemplateId(tpl.id);
                      setTemplateProgramName(tpl.name);
                    }}
                  />
                );
              })}
            </View>
          </View>

          {selectedTpl && (
            <View>
              <Text style={styles.sectionLabel}>{t('onboarding.programName')}</Text>
              <TextInput
                style={styles.textInput}
                value={templateProgramName}
                onChangeText={setTemplateProgramName}
                placeholder={selectedTpl.name}
                placeholderTextColor={th.colors.mutedLight}
                returnKeyType="done"
                autoCorrect={false}
              />
              <Text style={[styles.qHint, styles.hintGap]}>
                {t('onboarding.templateCopyHint')}
              </Text>
            </View>
          )}
        </ScrollView>

        <View style={styles.previewFooter}>
          <View style={styles.previewFooterBtns}>
            <TouchableOpacity style={styles.editBtn} onPress={() => setMode(null)} activeOpacity={0.85}>
              <Text style={styles.editBtnText}>{t('onboarding.back')}</Text>
            </TouchableOpacity>
            <PrimaryBtn
              label={t('onboarding.createProgram')}
              onPress={handleLoadTemplate}
              disabled={!selectedTemplateId}
            />
          </View>
        </View>
        </KeyboardAvoidingView>
      </View>
    );
  }

  // ── Modo automático — las tres preguntas ──────────────────────────────────────
  const onBack = step === 0 ? () => setMode(null) : prevStep;
  switch (currentStep) {
    case 'level':    return <StepLevel    answers={answers} set_={set_} onNext={nextStep} onBack={onBack} />;
    case 'identity': return <StepIdentity answers={answers} set_={set_} onNext={nextStep} onBack={onBack} />;
    case 'days':     return <StepDays     answers={answers} set_={set_} onNext={nextStep} onBack={onBack} />;
    default:         return null;
  }
}

// ─── Pasos individuales — §6.1 ─────────────────────────────────────────────────

function StepLevel({ answers, set_, onNext, onBack }) {
  const { t } = useTranslation();
  return (
    <QuestionScreen
      title={t('onboarding.stepLevel.headerTitle', 'Tu nivel')}
      dotsDone={1}
      onBack={onBack}
      sectionLabel={t('onboarding.stepLevel.title', '¿Cuál es tu nivel?')}
      hint={t('onboarding.stepLevel.hint', 'Marca tu banda de volumen y qué programas te proponemos.')}
    >
      <View style={{ gap: spacing.sm }}>
        {LEVEL_IDS.map((id) => (
          <QuestionCard
            key={id}
            title={t(`onboarding.levels.${id}.label`, id)}
            subtitle={t(`onboarding.levels.${id}.description`, '')}
            selected={answers.level === id}
            onPress={() => { set_('level', id); onNext(); }}
          />
        ))}
      </View>
    </QuestionScreen>
  );
}

// §5.1: "¿Qué buscas?" — una sola pregunta que fija `discipline` y `goal`.
// Ninguna tarjeta se bloquea nunca: la identidad se pregunta antes que el
// nivel no gana nada bloqueando, así que no hay nada contra lo que validar.
function StepIdentity({ answers, set_, onNext, onBack }) {
  const { t } = useTranslation();
  return (
    <QuestionScreen
      title={t('onboarding.identity.title', '¿Qué buscas?')}
      dotsDone={2}
      onBack={onBack}
      sectionLabel={t('onboarding.identity.title', '¿Qué buscas?')}
      hint={t('onboarding.identity.subtitle', 'Con esto elegimos el tipo de programa.')}
    >
      <View style={{ gap: spacing.sm }}>
        {IDENTITY_OPTIONS.map(({ id, discipline, goal }) => (
          <QuestionCard
            key={id}
            title={t(`onboarding.identity.${id}.label`, id)}
            subtitle={t(`onboarding.identity.${id}.description`, '')}
            selected={answers.discipline === discipline && answers.goal === goal}
            onPress={() => {
              set_('discipline', discipline);
              set_('goal', goal);
              onNext();
            }}
          />
        ))}
      </View>
    </QuestionScreen>
  );
}

// Chips 1-7 (§4: `ProgramDetailScreen.jsx styles.chip`). Ninguno premarcado
// al entrar — `daysPerWeek: null` en `DEFAULT_ANSWERS`.
function StepDays({ answers, set_, onNext, onBack }) {
  const styles = useThemedStyles(makeStyles);
  const { t } = useTranslation();
  const d = answers.daysPerWeek;

  return (
    <QuestionScreen
      title={t('onboarding.stepDays.headerTitle', 'Días por semana')}
      dotsDone={3}
      onBack={onBack}
      sectionLabel={t('onboarding.stepDays.subtitleFrequency', '¿Cuántos días a la semana entrenas?')}
      hint={t('onboarding.stepDays.cycleHint',
        'Hay programas con más sesiones que días. Su ciclo dura más de una semana — te lo enseñamos en cada uno.')}
    >
      <View style={styles.dayChipsRow}>
        {[1, 2, 3, 4, 5, 6, 7].map((n) => (
          <TouchableOpacity
            key={n}
            style={[styles.dayChip, d === n && styles.dayChipOn]}
            onPress={() => { set_('daysPerWeek', n); onNext(); }}
            activeOpacity={0.75}
          >
            <Text style={[styles.dayChipText, d === n && styles.dayChipTextOn]}>{n}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </QuestionScreen>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const makeStyles = (th) => StyleSheet.create({
  // ── Selector de modo (§4: tarjeta de elección + icono y flecha de fila) ────
  modeCards: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.sm },
  modeCard: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing.lg,
    backgroundColor:   th.colors.surface,
    borderRadius:      th.radius.md,
    paddingVertical:   spacing.md,
    paddingHorizontal: spacing.lg,
  },
  modeIcon:      { width: 20, alignItems: 'center', flexShrink: 0 },
  modeBody:      { flex: 1, minWidth: 0, gap: 3 },
  modeTitleLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  modeTitle:     { ...textStyles.cardTitle, color: th.colors.text, flexShrink: 1 },
  // Badge sólido de las propuestas (`proposalBadge`): marca la ruta por
  // defecto sin usar el tratamiento accent10/accent50, que significa ELEGIDO.
  modeBadge: {
    backgroundColor:   th.colors.accent,
    borderRadius:      th.radius.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical:   spacing.xs2,
    flexShrink:        0,
  },
  modeBadgeText:  { ...textStyles.spacingTag, color: th.colors.onAccent },
  modeDesc:       { ...textStyles.subtitle, color: th.colors.mutedLight, lineHeight: 17 },
  modeFooterHint: {
    ...textStyles.subtitle,
    color:             th.colors.mutedLight,
    lineHeight:        18,
    paddingHorizontal: spacing.xs2,
    paddingTop:        spacing.sm,
  },

  // ── Formularios (programa vacío / cargar plantilla) ────────────────────────
  formBody: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.xl },
  qCards:   { gap: spacing.sm },
  hintGap:  { marginTop: spacing.md },
  // Caja de `nameInput` (CustomExerciseScreen) con el texto de 14 ExtraBold de
  // `MenuList.rowLabel`: en `cardTitle` (16) el nombre se veía enorme.
  textInput: {
    backgroundColor:   th.colors.surface2,
    borderRadius:      th.radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.sm2,
    fontFamily:        'Inter_800ExtraBold',
    fontSize:          14,
    color:             th.colors.text,
  },


  screen: {
    flex:            1,
    backgroundColor: th.colors.bg,
  },

  // Brand tag

  // Los tres puntos de progreso, en el hueco de acciones de `ScreenHeader`. El
  // color no vive aquí: lo da la cabecera por el render-prop `right`, porque su
  // tinta cambia con la variante de cabecera que esté puesta.
  limeHeaderDots:    { flexDirection: 'row', gap: spacing.sm },
  limeDot:           { width: 7, height: 7, borderRadius: 3.5 },

  // Chips de días 1-7
  dayChipsRow: { flexDirection: 'row', gap: spacing.sm },
  dayChip: {
    flex:            1,
    alignItems:      'center',
    paddingVertical: spacing.sm,
    borderRadius:    th.radius.sm,
    backgroundColor: th.colors.surface,
  },
  dayChipOn:      { backgroundColor: th.colors.accent },
  dayChipText:    { ...textStyles.cardTitle, color: th.colors.mutedLight },
  dayChipTextOn:  { color: th.colors.onAccent },

  // ── Las tres preguntas ─────────────────────────────────────────────────────
  qBody: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  sectionLabel: {
    ...textStyles.spacingTag,
    color:         th.colors.mutedLight,
    textTransform: 'uppercase',
    marginBottom:  spacing.sm,
  },
  qHint: { ...textStyles.subtitle, color: th.colors.mutedLight, lineHeight: 12 * 1.5 },
  // Columna, no fila: en fila el subtítulo se quedaba el ancho y el título se
  // comprimía hasta no leerse. El borde va también en la tarjeta apagada, en
  // transparente, para que seleccionar no mueva el layout 1 px.
  qCard: {
    backgroundColor:   th.colors.surface,
    borderRadius:      th.radius.md,
    paddingVertical:   spacing.md,
    paddingHorizontal: spacing.lg,
    gap:               3,
    borderWidth:       borders.thin,
    borderColor:       'transparent',
  },
  qCardOn: {
    backgroundColor: th.tint.accent10,
    borderColor:     th.tint.accent50,
  },
  qCardTitle:   { ...textStyles.cardTitle, color: th.colors.text },
  qCardTitleOn: { color: th.colors.accent },
  qCardSubtitle: { ...textStyles.subtitle, color: th.colors.mutedLight },

  // ── Fila de 3 datos (§6.2/§6.3) ────────────────────────────────────────────
  statsRow:         { flexDirection: 'row', gap: spacing.md, paddingVertical: spacing.md },
  statsRowCard: {
    backgroundColor:   th.colors.surface,
    borderRadius:      th.radius.md,
    paddingHorizontal: spacing.lg,
  },
  statsRowBordered: {
    borderTopWidth:    borders.thin,
    borderTopColor:    th.colors.border,
    borderBottomWidth: borders.thin,
    borderBottomColor: th.colors.border,
    paddingHorizontal: spacing.lg,
  },
  stat:         { flex: 1, gap: spacing.xs2 },
  statDivider:  { borderLeftWidth: borders.thin, borderLeftColor: th.colors.border, paddingLeft: spacing.md },
  statValue:    { ...textStyles.hero, fontSize: 22, lineHeight: 24, color: th.colors.accent },
  statLabel:    { ...textStyles.smallBold, fontSize: 11, color: th.colors.mutedLight },
  pips:         { flexDirection: 'row', gap: 3, height: 24, alignItems: 'center' },
  pip:          { width: 14, height: 8, borderRadius: th.radius.xxs ?? 2, backgroundColor: th.colors.muted },
  pipOn:        { backgroundColor: th.colors.accent },

  byline: { ...textStyles.subtitle, color: th.colors.mutedLight },

  // Programa elegido
  previewCycleHint: { ...textStyles.subtitle, color: th.colors.accent },
  previewList: {
    paddingHorizontal: spacing.xl,
    paddingTop:        spacing.xl,
    paddingBottom:     spacing.xxl,
    gap:               spacing.md,
  },
  // Fila de ajustes aplicados (§6.3.5) — `sheetRowBase` de theme.js: es la
  // misma fila de opción que abre una hoja en el resto de la app.
  adjRow: { ...sheetRowBase(th), justifyContent: 'space-between' },
  adjRowText: { ...textStyles.subtitle, color: th.colors.mutedLight, flex: 1 },

  previewSession: {
    flexDirection:   'row',
    // Arriba, no centrada: al desplegar los ejercicios la letra se iba al
    // medio de la tarjeta en vez de quedarse junto al nombre.
    alignItems:      'flex-start',
    backgroundColor: th.colors.surface,
    borderRadius:    th.radius.md,
    padding:         spacing.md,
    gap:             spacing.md,
  },
  // La misma letra que la tarjeta de propuesta: color, sin recuadro.
  previewSessionLetter: { fontSize: 18, fontWeight: typography.heavy, lineHeight: 20, width: 16 },
  previewSessionInfo: { flex: 1 },
  previewSessionHeader: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
  },
  previewSessionName: { ...textStyles.cardTitle, color: th.colors.text, flex: 1 },
  previewSessionMeta: { ...textStyles.subtitle, color: th.colors.mutedLight, marginTop: spacing.xs2 },
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
  // La misma fila de ejercicio que el visualizador de programa ya migrado
  // (`ProgramDetailScreen`: número en `cardType`/accent, nombre en `subtitle` a
  // 14, meta en `tag`). Se conserva la densidad de aquí —número estrecho y
  // alineado a la derecha— porque esta lista vive dentro de una tarjeta
  // plegable, no en una pantalla de detalle a ancho completo.
  previewExOrder: {
    ...textStyles.cardType,
    color:      th.colors.accent,
    width:      16,
    textAlign:  'right',
    paddingTop: 2,
  },
  previewExName: {
    ...textStyles.subtitle,
    fontSize: 14,
    color:    th.colors.text,
  },
  previewExMeta: {
    ...textStyles.tag,
    color:     th.colors.mutedLight,
    marginTop: 1,
  },
  kav: { flex: 1, minHeight: 0 },
  // Sin filete: §4.6 deja los bordes sólo como highlight de acento, y los dos
  // botones ya se leen como pie.
  previewFooter: {
    paddingHorizontal: spacing.xl,
    paddingVertical:   spacing.lg,
  },
  previewFooterInner: { gap: spacing.sm },
  changeLaterText: { ...textStyles.subtitle, color: th.colors.mutedLight },
  previewFooterBtns: { flexDirection: 'row', gap: spacing.sm },
  editBtn: {
    flex:            1,
    borderRadius:    th.radius.md,
    paddingVertical: spacing.md,
    alignItems:      'center',
    justifyContent:  'center',
    backgroundColor: th.colors.surface2,
  },
  editBtnText: { ...textStyles.btnAction, color: th.colors.text },
  startBtn: {
    flex:            2,
    flexDirection:   'row',
    gap:             spacing.sm,
    backgroundColor: th.colors.accent,
    borderRadius:    th.radius.md,
    paddingVertical: spacing.md,
    alignItems:      'center',
    justifyContent:  'center',
  },
  startBtnText:    { ...textStyles.btnAction, fontSize: 14, color: th.colors.onAccent },
  startBtnOff:     { backgroundColor: th.colors.surface2 },
  startBtnTextOff: { color: th.colors.mutedLight },

  // Propuestas — tarjeta de plantilla candidata
  proposalCard: {
    backgroundColor: th.colors.surface,
    borderRadius:    th.radius.md,
    overflow:        'hidden',
  },
  proposalHead: { padding: spacing.lg, gap: spacing.sm },
  proposalTitleLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  proposalName:  { ...textStyles.cardTitle, flex: 1, color: th.colors.text },
  // Badge sólido (activeBadge de ProgramEditorScreen/StagePlannerScreen).
  proposalBadge: {
    backgroundColor:   th.colors.accent,
    borderRadius:      th.radius.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical:   spacing.xs2,
  },
  proposalBadgeText: { ...textStyles.spacingTag, color: th.colors.onAccent },
  proposalByline:    { ...textStyles.subtitle, color: th.colors.mutedLight },
  proposalSummary: { ...textStyles.subtitle, color: th.colors.text, lineHeight: 12 * 1.6, paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.xs2 },
  proposalNote:    { ...textStyles.subtitle, color: th.colors.mutedLight, lineHeight: 12 * 1.5, paddingHorizontal: spacing.lg, paddingBottom: spacing.md },

  proposalSessions: { paddingVertical: spacing.sm },
  proposalSessionRow: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical:   spacing.sm,
  },
  proposalSessionLetter: { fontSize: 18, fontWeight: typography.heavy, lineHeight: 20, width: 16 },
  proposalSessionInfo:   { flex: 1, gap: 2, minWidth: 0 },
  proposalSessionName:   { ...textStyles.subtitle, color: th.colors.text },
  proposalSessionMeta:   { ...textStyles.tag, color: th.colors.mutedLight },

  // Enlaces de texto ("ver todas")
  linkBtn: {
    paddingVertical: spacing.md,
    alignItems:      'center',
  },
  linkBtnText: { ...textStyles.subtitle, color: th.colors.accent },

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




  // Template picker
});
