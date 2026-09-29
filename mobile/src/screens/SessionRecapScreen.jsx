/**
 * SessionRecapScreen — post-session summary, shown right after saving.
 *
 * Orden y lenguaje: docs/specs/pulido-ui.md §2 (U29), maqueta en
 * `docs/mockups/recap.html`. Cada bloque habla uno de tres lenguajes y siempre
 * el mismo, para que se vea de un vistazo qué se lee y qué se toca:
 *
 *   - **Resultado** (se lee): el marcador de arriba, tarjeta `surface`.
 *   - **Logro** (se celebra): los récords, relleno `tint/accent10`.
 *   - **Tu parte** (se escribe): todo lo que va bajo el lápiz y nada más —
 *     sRPE, peso corporal y nota. Los valores en celda `bg` con ± (`StepField`).
 *
 * El resultado va primero porque el recap es la recompensa; las preguntas justo
 * después, antes de la comparación por ejercicio (lo que menos se mira). El pie
 * con HECHO es fijo y avisa de que falta el sRPE sin obligar a contestarlo.
 *
 * Lo único que ESCRIBE es el feedback (sRPE, peso, nota — `setSessionFeedback`,
 * docs/specs/training-load.md §2) y las decisiones de sesión libre.
 *
 * Estilo: FormaFit, sin nodo en Figma — hereda tokens y anatomías de otras
 * pantallas: la letra y el nombre en Barlow son los de la sesión de hoy en
 * Inicio, las filas son la lista agrupada con `getCardRadii` y las de sesión
 * libre son `MenuRow`.
 */
import { useState, useEffect, useMemo, useRef } from 'react';
import { View, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Text, TextInput, MAX_FONT_SCALE } from '../components/ui/Text';
import Reanimated, {
  useSharedValue, useAnimatedStyle, withTiming, interpolateColor, FadeIn, LinearTransition,
} from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Svg, { Path } from 'react-native-svg';
import { useStore, ownerLogOf } from '../../store/useStore';
import { recapStats, detectPRs, compareToLast, prevBlockResult, volumeDeltas } from '../utils/sessionRecap';
import { describeBlockScore, compareBlockResults } from '../utils/conditioningBlocks';
import { sessionLoads, dailySeries, rollingMean } from '../utils/trainingLoad';
import { useWeightUnit } from '../hooks/useWeightUnit';
import { variantLabel, displayVariant } from '../utils/variants';
import { spacing, textStyles, getCardRadii } from '../theme';
import { useTheme, useThemedStyles } from '../useTheme';
import { backToMain } from '../navigation/navigationRef';
import { isFreeEntry } from '../utils/freeSessions';
import { athleteProgress } from '../utils/stageProgress';
import SegmentedControl from '../components/ui/SegmentedControl';
import StepField from '../components/ui/StepField';
import { MenuRow, RowIcon } from '../components/ui/MenuList';
import { CheckIcon, PencilIcon, ChevronDown } from '../components/ui/EditorIcons';
import { FOLD_MS } from '../components/ui/collapseOut';

const AnimatedTouchable = Reanimated.createAnimatedComponent(TouchableOpacity);

// Récords a la vista; el resto detrás de «Ver N más». Una sesión de 9
// ejercicios en los primeros meses puede dar 6-9 y se comían la pantalla.
const PRS_VISIBLE = 3;

function TrophyIcon({ size = 17, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M8 21h8M12 17v4M7 4h10v6a5 5 0 0 1-10 0V4zM7 6H4a1 1 0 0 0-1 1v1a3 3 0 0 0 3 3M17 6h3a1 1 0 0 1 1 1v1a3 3 0 0 1-3 3" />
    </Svg>
  );
}

// Session RPE (Foster CR-10). Whole numbers only — a session rating is a gut
// call, not a measurement, so the per-set RPE's decimals would be false
// precision.
const RPE_VALUES = Array.from({ length: 10 }, (_, i) => i + 1);

/**
 * Un botón de la escala de sRPE. NO es un SegmentedControl: ese control sirve
 * para alternar entre vistas/opciones existentes, no para puntuar en una
 * escala. Aun así el cambio de estado no puede ser en seco (regla de feedback
 * táctil, docs/UI-MIGRATION.md §4.10), así que el color de fondo y el del
 * número se interpolan con Reanimated.
 */
function RpeButton({ value, active, onPress }) {
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  const p      = useSharedValue(active ? 1 : 0);

  useEffect(() => {
    p.value = withTiming(active ? 1 : 0, { duration: 160 });
  }, [active, p]);

  const boxStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(p.value, [0, 1], [th.colors.surface2, th.colors.accent]),
  }));
  const textStyle = useAnimatedStyle(() => ({
    color: interpolateColor(p.value, [0, 1], [th.colors.mutedLight, th.colors.onAccent]),
  }));

  return (
    <AnimatedTouchable style={[styles.rpeBtn, boxStyle]} onPress={onPress} activeOpacity={0.8}>
      <Reanimated.Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[styles.rpeBtnText, textStyle]}>{value}</Reanimated.Text>
    </AnimatedTouchable>
  );
}

// Same badge-per-format mapping as SessionEditorScreen's block rows.
const BLOCK_BADGE_STYLE = {
  amrap:    'badgeBlockAmrap',
  emom:     'badgeBlockEmom',
  for_time: 'badgeBlockForTime',
};

function fmtDuration(ms) {
  const s  = Math.max(0, Math.floor((ms ?? 0) / 1000));
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return hh > 0
    ? `${hh}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
    : `${mm}:${String(ss).padStart(2, '0')}`;
}

export default function SessionRecapScreen({ navigation, route }) {
  // `clientId`: el entreno era de un cliente sin app (trainer-logging.md §3.3).
  // Todo se lee de su historial y el recap vuelve a Clientes.
  const { entryId, clientId = null } = route.params ?? {};
  const { t, i18n } = useTranslation();
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  // fmt() appends the unit ("82.5kg"); toDisplay() gives the bare number.
  const { fmt, toDisplay, toKg, label: weightLabel } = useWeightUnit();
  const round1 = (v) => Math.round(v * 10) / 10;

  const workoutLog       = useStore((s) => ownerLogOf(s, clientId));
  const client           = useStore((s) => (clientId ? s.clients[clientId] ?? null : null));
  const programs         = useStore((s) => s.programs);
  const sessionTemplates = useStore((s) => s.sessionTemplates);
  const exerciseLibrary  = useStore((s) => s.exerciseLibrary);
  const customExercises  = useStore((s) => s.customExercises);
  // El peso de referencia es el del dueño: el mío o el último que se apuntó al
  // cliente. Nunca el mío para un cliente.
  const myBodyWeight     = useStore((s) => s.profile.bodyWeight);
  const profileBodyWeight = clientId
    ? ([...workoutLog].reverse().find((e) => e.id !== entryId && e.bodyWeight != null)?.bodyWeight ?? null)
    : myBodyWeight;
  const setSessionFeedback = useStore((s) => s.setSessionFeedback);
  const saveEntryAsFreeTemplate = useStore((s) => s.saveEntryAsFreeTemplate);
  const addEntryExercisesToTemplate = useStore((s) => s.addEntryExercisesToTemplate);
  const setEntryCountsAs  = useStore((s) => s.setEntryCountsAs);
  const activeProgramId   = useStore((s) => s.profile.activeProgramId);
  const showToast          = useStore((s) => s.showToast);
  // Una por sesión: guardada, la fila se queda diciéndolo. Guardarla dos
  // veces daría dos sesiones idénticas y ninguna forma de saberlo.
  const [templateSaved, setTemplateSaved] = useState(false);
  const [exercisesAdded, setExercisesAdded] = useState(false);
  const [prsOpen, setPrsOpen] = useState(false);

  const entry = workoutLog.find((e) => e.id === entryId);

  // La nota se escribe en el entreno y se corrige aquí: el borrador solo llega
  // al store al soltar el campo.
  const [noteDraft, setNoteDraft] = useState(() => entry?.notes ?? '');
  const [noteFromWorkout]         = useState(() => !!entry?.notes?.trim());

  // «Falta: cómo de dura fue» baja hasta la tarjeta del sRPE.
  const scrollRef = useRef(null);
  const yourPartY = useRef(0);

  const allExercises = useMemo(
    () => ({ ...exerciseLibrary, ...customExercises }),
    [exerciseLibrary, customExercises],
  );

  /**
   * Carga de esta sesión contra la norma reciente, en %. El número de carga no
   * se enseña: sin unidad no dice nada, solo vale comparado consigo mismo.
   * La media de 7 días se toma hasta AYER (no incluye la sesión que se acaba
   * de guardar), que es lo que hace la comparación informativa en vez de
   * circular. Sin sRPE no hay carga interna, así que no se muestra nada.
   */
  const loadPct = useMemo(() => {
    if (!entry || entry.sessionRpe == null) return null;
    const loads = sessionLoads(workoutLog, allExercises, { fallbackBodyWeight: profileBodyWeight });
    const mine  = loads.find((l) => l.id === entry.id);
    if (mine?.internal == null) return null;
    const means = rollingMean(dailySeries(loads).map((d) => d.internal), 7);
    const base  = means.length >= 2 ? means[means.length - 2] : null;
    return base > 0 ? Math.round(((mine.internal - base) / base) * 100) : null;
  }, [entry, workoutLog, allExercises, profileBodyWeight]);

  const volumePct = useMemo(
    () => (entry ? volumeDeltas(workoutLog).get(entry.id) ?? null : null),
    [entry, workoutLog],
  );

  if (!entry) return null;

  const exName = (id) => {
    const def = allExercises[id];
    if (!def) return id;
    return i18n.language === 'en' ? (def.nameEn ?? def.name) : def.name;
  };

  // La variante con la que se hizo hoy (exercise-variants.md §4.4).
  const entryVariant = (id) => variantLabel(
    displayVariant(entry.exercises?.find((e) => e.exerciseId === id)?.variant, allExercises[id]), t,
  );

  const isFree = isFreeEntry(entry);
  // Sobre la marcha: la única que se puede guardar como sesión libre. Tras
  // guardarla la entrada se reapunta a la sesión nueva, así que la fila se
  // sostiene con `templateSaved` para seguir diciendo «Guardada».
  const onTheFly = !clientId && (entry.sessionTemplateId === '__free__' || templateSaved);
  const template = !isFree ? sessionTemplates[entry.sessionTemplateId] : null;

  // Sesión libre GUARDADA con ejercicios añadidos en el entreno (§7.2).
  const freeTpl  = isFree && !onTheFly ? sessionTemplates[entry.sessionTemplateId] : null;
  const newExIds = freeTpl && !clientId
    ? (entry.exercises ?? []).filter((ex) => ex.isAdHoc
      && !freeTpl.exercises.some((e) => e.exerciseId === ex.exerciseId))
    : [];

  // «Cuenta como Sesión X» (§7.3): las sesiones de la etapa en curso del
  // programa activo. Sin programa o sin sesiones no hay nada que sustituir.
  const activeProgram = isFree && !clientId ? programs[activeProgramId] : null;
  const stageDays = activeProgram?.stages?.length
    ? (activeProgram.stages[athleteProgress(activeProgram).currentStageIndex]?.days ?? [])
    : [];
  const countsAsLabel = entry.countsAs
    ? (stageDays.find((d) => d.sessionTemplateId === entry.countsAs)?.label
      ?? sessionTemplates[entry.countsAs]?.label ?? '')
    : null;
  // La etapa sale del progreso del ATLETA (la única puerta, weeks-model §3.7):
  // en el móvil del entrenador los campos del programa son de su copia.
  const program   = template?.programId ? programs[template.programId] : null;
  const stageName = program?.stages?.length
    ? program.stages[athleteProgress(program, client).currentStageIndex]?.name
    : null;

  const stats  = recapStats(entry);
  // Los mayores primero, por cuánto mejoran en proporción: +2 reps sobre 10
  // pesa más que +2,5 kg sobre 90.
  const prs = detectPRs(entry, workoutLog)
    .sort((a, b) => (b.value - b.prev) / (b.prev || 1) - (a.value - a.prev) / (a.prev || 1));
  const prIds  = new Set(prs.map((p) => p.exerciseId));
  // Solo con una vez anterior: sin ella no hay nada que decir (las series ya
  // las sabes — pulido-ui.md §2).
  const deltas = compareToLast(entry, workoutLog);

  const rpeMissing = entry.sessionRpe == null;
  const tone = clientId ? th.colors.blue : th.colors.accent;

  const dateLabel = new Date(entry.timestamp).toLocaleDateString(i18n.language, {
    weekday: 'short', day: 'numeric', month: 'short',
  });
  const metaLine = [stageName, dateLabel].filter(Boolean).join(' · ');

  // El último peso apuntado ANTES de esta sesión, con su distancia en días.
  const prevWeigh = workoutLog
    .filter((e) => e.id !== entry.id && e.bodyWeight != null && e.timestamp < entry.timestamp)
    .sort((a, b) => b.timestamp - a.timestamp)[0];
  const prevWeighDays = prevWeigh ? Math.round((entry.timestamp - prevWeigh.timestamp) / 86400000) : null;

  const shownWeight = entry.bodyWeight ?? profileBodyWeight;

  function saveBodyWeight(n) {
    if (n > 0) setSessionFeedback(entry.id, { bodyWeight: Math.round(toKg(n) * 10) / 10 }, clientId);
  }

  function saveNote() {
    const next = noteDraft.trim();
    if (next !== (entry.notes ?? '').trim()) setSessionFeedback(entry.id, { notes: next }, clientId);
  }

  // Desviación vs la sesión anterior: texto suelto alineado a la derecha, SIN
  // pill — mismo tratamiento que `sesDelta` en el detalle de ejercicio de
  // Progreso. Las pills se reservan para el badge PR.
  function deltaText(delta) {
    if (!delta) return <Text style={[styles.delta, styles.delta_eq]}>{t('recap.newExercise')}</Text>;
    const sign = (n) => (n > 0 ? '+' : '−');
    let txt, tone;
    if (delta.kind === 'equal') { txt = '='; tone = 'eq'; }
    else if (delta.kind === 'weight') {
      txt = `${sign(delta.diff)}${fmt(round1(Math.abs(delta.diff)))}`;
      tone = delta.diff > 0 ? 'up' : 'dn';
    } else if (delta.kind === 'reps') {
      txt = `${sign(delta.diff)}${Math.abs(delta.diff)} ${t('recap.repsShort')}`;
      tone = delta.diff > 0 ? 'up' : 'dn';
    } else if (delta.kind === 'time') {
      txt = `${sign(delta.diff)}${Math.abs(delta.diff)} s`;
      tone = delta.diff > 0 ? 'up' : 'dn';
    } else { // sets
      txt = `${sign(delta.diff)}${Math.abs(delta.diff)} ${t('recap.setsShort')}`;
      tone = delta.diff > 0 ? 'up' : 'dn';
    }
    return <Text style={[styles.delta, styles[`delta_${tone}`]]}>{txt}</Text>;
  }

  // compareBlockResults devuelve { better, kind, diff } estructurado, NO una
  // cadena ya formateada, así que el texto i18n se arma aquí.
  function blockDeltaText(delta) {
    if (delta.kind === null) return null; // no previous entry with this blockId
    if (delta.kind === 'equal') {
      return <Text style={[styles.delta, styles.delta_eq]}>=</Text>;
    }
    const tone = delta.better ? 'up' : 'dn';
    let txt;
    if (delta.kind === 'time') {
      const sign = delta.diff < 0 ? '−' : '+';
      const abs  = Math.abs(delta.diff);
      const mm   = Math.floor(abs / 60);
      const ss   = Math.floor(abs % 60);
      txt = `${sign}${mm}:${String(ss).padStart(2, '0')}`;
    } else {
      const sign  = delta.diff > 0 ? '+' : '−';
      const abs   = Math.abs(delta.diff);
      const label = delta.kind === 'rounds' ? t('blocks.delta.roundsShort')
        : delta.kind === 'reps' ? t('blocks.delta.repsShort')
        : t('blocks.delta.completedShort');
      txt = `${sign}${abs}${label ? ` ${label}` : ''}`;
    }
    return <Text style={[styles.delta, styles[`delta_${tone}`]]}>{txt}</Text>;
  }

  function prRow(pr, i, list) {
    const isReps = pr.kind === 'reps';
    const what   = pr.kind === 'e1rm' ? 'e1RM'
      : pr.kind === 'weight' ? t('recap.topWeight') : t('recap.bestSet');
    const prev   = isReps ? pr.prev : fmt(round1(pr.prev));
    return (
      <Reanimated.View
        key={pr.exerciseId}
        entering={i >= PRS_VISIBLE ? FadeIn.duration(FOLD_MS) : undefined}
        style={[styles.prRow, getCardRadii(th, i === 0, i === list.length - 1)]}
      >
        <TrophyIcon size={20} color={th.colors.accent} />
        <View style={styles.rowBody}>
          <Text style={styles.exName} numberOfLines={1}>{exName(pr.exerciseId)}</Text>
          <Text style={styles.exSub} numberOfLines={1}>{`${what} · ${t('recap.previous')} ${prev}`}</Text>
        </View>
        <View style={styles.prVal}>
          <Text style={styles.prValue}>
            {isReps ? t('recap.repsValue', { count: pr.value }) : fmt(round1(pr.value))}
          </Text>
          <Text style={[styles.delta, styles.delta_up]}>
            {isReps ? `+${pr.value - pr.prev}` : `+${toDisplay(round1(pr.value - pr.prev))}`}
          </Text>
        </View>
      </Reanimated.View>
    );
  }

  const shownPrs = prsOpen ? prs : prs.slice(0, PRS_VISIBLE);
  const showFree = (isFree && stageDays.length > 0) || newExIds.length > 0 || exercisesAdded || onTheFly;

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >

        {/* 1 · Marcador — se lee */}
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={styles.ceja}>
              <CheckIcon size={14} color={tone} />
              <Text style={[styles.cejaText, { color: tone }]} numberOfLines={1}>
                {clientId ? `${(client?.name ?? '').toUpperCase()} · ${t('recap.completed')}` : t('recap.completed')}
              </Text>
            </View>
            <View style={styles.ident}>
              {!!template?.label && (
                <View style={[styles.glyphBox, clientId && styles.glyphBoxClient]}>
                  <Text style={[styles.glyph, { color: tone }]}>{template.label}</Text>
                </View>
              )}
              <View style={styles.identText}>
                <Text style={styles.sessionName} numberOfLines={2}>
                  {entry.sessionName ?? template?.name ?? ''}
                </Text>
                <Text style={styles.metaLine} numberOfLines={1}>{metaLine}</Text>
              </View>
            </View>
          </View>
          <View style={styles.stats}>
            <View style={styles.stat}>
              <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
                {fmtDuration(entry.duration)}
              </Text>
              <Text style={styles.statLabel}>{t('recap.duration')}</Text>
            </View>
            <View style={[styles.stat, styles.statDivider]}>
              <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
                {stats.volume > 0 ? toDisplay(stats.volume) : '—'}
                {stats.volume > 0 ? <Text style={styles.statUnit}> {weightLabel}</Text> : null}
              </Text>
              <Text style={styles.statLabel}>{t('recap.volume')}</Text>
              {volumePct != null && (
                <Text style={[styles.delta, styles[`delta_${volumePct > 0 ? 'up' : volumePct < 0 ? 'dn' : 'eq'}`]]}>
                  {volumePct === 0 ? '=' : `${volumePct > 0 ? '+' : '−'}${Math.abs(volumePct)} %`}
                </Text>
              )}
            </View>
            <View style={[styles.stat, styles.statDivider]}>
              <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
                {stats.setsDone}<Text style={styles.statUnit}>/{stats.setsPlanned}</Text>
              </Text>
              <Text style={styles.statLabel}>{t('recap.sets')}</Text>
            </View>
          </View>
        </View>

        {/* 2 · Récords — se celebran */}
        {prs.length > 0 && (
          <Reanimated.View layout={LinearTransition.duration(FOLD_MS)} style={styles.section}>
            <View style={styles.secHead}>
              <TrophyIcon size={14} color={th.colors.accent} />
              <Text style={[styles.secTitle, { color: th.colors.accent }]}>{t('recap.prsCount', { count: prs.length })}</Text>
            </View>
            <View style={styles.groupedList}>
              {shownPrs.map((pr, i) => prRow(pr, i, shownPrs))}
            </View>
            {!prsOpen && prs.length > PRS_VISIBLE && (
              <TouchableOpacity style={styles.moreBtn} onPress={() => setPrsOpen(true)} activeOpacity={0.75}>
                <Text style={styles.moreBtnText}>{t('recap.morePrs', { count: prs.length - PRS_VISIBLE })}</Text>
              </TouchableOpacity>
            )}
          </Reanimated.View>
        )}

        {/* 3 · Tu parte — se escribe */}
        <Reanimated.View
          layout={LinearTransition.duration(FOLD_MS)}
          style={styles.section}
          onLayout={(e) => { yourPartY.current = e.nativeEvent.layout.y; }}
        >
          <View style={[styles.secHead, styles.secHeadSplit]}>
            <View style={styles.secHeadLeft}>
              <PencilIcon size={14} color={th.colors.mutedLight} />
              <Text style={styles.secTitle}>{t('recap.yourPart')}</Text>
            </View>
            <View style={[styles.pendChip, !rpeMissing && styles.pendChipOk]}>
              <Text style={[styles.pendText, !rpeMissing && styles.pendTextOk]}>
                {rpeMissing ? t('recap.unanswered') : t('recap.allAnswered')}
              </Text>
            </View>
          </View>

          {/* Session RPE — how hard the whole session felt (CR-10). Saved on tap;
              the per-set RPE rates one set, this rates the session. */}
          <View style={styles.card}>
            <View style={styles.qRow}>
              <View style={styles.qLeft}>
                {rpeMissing && <View style={styles.qDot} />}
                <Text style={styles.qText}>{t('recap.rpeQuestion')}</Text>
              </View>
              {!rpeMissing && <CheckIcon size={16} color={th.colors.accent} />}
            </View>
            <View style={styles.rpeScale}>
              {RPE_VALUES.map((v) => (
                <RpeButton
                  key={v}
                  value={v}
                  active={entry.sessionRpe === v}
                  onPress={() => setSessionFeedback(entry.id, { sessionRpe: v }, clientId)}
                />
              ))}
            </View>
            <View style={styles.rpeLabels}>
              <Text style={styles.rpeLabel}>{t('recap.rpeLow')}</Text>
              <Text style={styles.rpeLabel}>{t('recap.rpeMid')}</Text>
              <Text style={styles.rpeLabel}>{t('recap.rpeHigh')}</Text>
            </View>

            {/* Su resultado, no otra pregunta: debajo de una línea `bg`. En
                blanco y no en lima — más carga no es mejor ni peor. */}
            {loadPct != null && (
              <View style={styles.loadRow}>
                <Text style={styles.loadLabel}>{t('recap.sessionLoad')}</Text>
                <View style={styles.loadValueWrap}>
                  <Text style={styles.loadValue}>{`${loadPct > 0 ? '+' : loadPct < 0 ? '−' : ''}${Math.abs(loadPct)} %`}</Text>
                  <Text style={styles.loadPct}>{t('recap.vsMean7d')}</Text>
                </View>
              </View>
            )}
          </View>

          {/* Body weight — prefilled with the last known value; only saved when
              touched. ponytail: sin peso conocido el campo nace vacío y los ±
              arrancan del mínimo; basta con escribirlo. */}
          <View style={[styles.card, styles.weightCard]}>
            <StepField
              horizontal
              flat
              label={t('recap.bodyWeight')}
              value={shownWeight != null ? toDisplay(shownWeight) : ''}
              onChange={saveBodyWeight}
              min={20}
              max={500}
              step={0.1}
              unit={weightLabel}
            />
            {prevWeigh && (
              <Text style={styles.weightHint}>
                {prevWeighDays === 0
                  ? t('recap.lastWeightToday', { value: fmt(prevWeigh.bodyWeight) })
                  : t('recap.lastWeight', { value: fmt(prevWeigh.bodyWeight), count: prevWeighDays })}
              </Text>
            )}
          </View>

          <View style={styles.card}>
            <View style={styles.qRow}>
              <Text style={styles.qText}>{t('recap.note')}</Text>
              <Text style={styles.qAside}>{noteFromWorkout ? t('recap.noteFromWorkout') : t('recap.optional')}</Text>
            </View>
            <View style={styles.noteWell}>
              <View style={styles.notePencil}><PencilIcon size={14} color={th.colors.muted} /></View>
              <TextInput
                style={styles.noteInput}
                value={noteDraft}
                onChangeText={setNoteDraft}
                onBlur={saveNote}
                onEndEditing={saveNote}
                placeholder={t('recap.notePlaceholder')}
                placeholderTextColor={th.colors.muted}
                multiline
              />
            </View>
          </View>
        </Reanimated.View>

        {/* 4 · Vs. última sesión — solo el cambio; lo que hiciste ya lo sabes */}
        {deltas?.length > 0 && (
          <Reanimated.View layout={LinearTransition.duration(FOLD_MS)} style={styles.section}>
            <View style={[styles.secHead, styles.secHeadSplit]}>
              <Text style={styles.secTitle}>{t('recap.vsLast')}</Text>
              <Text style={styles.secAside}>{t('recap.exercisesCount', { count: deltas.length })}</Text>
            </View>
            <View style={styles.groupedList}>
              {deltas.map((row, i) => (
                <View
                  key={row.exerciseId}
                  style={[styles.listItem, styles.listItemRow, getCardRadii(th, i === 0, i === deltas.length - 1)]}
                >
                  <Text style={styles.exName} numberOfLines={1}>
                    {exName(row.exerciseId)}
                    {entryVariant(row.exerciseId)
                      ? <Text style={styles.exVariant}>{` · ${entryVariant(row.exerciseId)}`}</Text>
                      : null}
                  </Text>
                  <View style={styles.deltaRight}>
                    {prIds.has(row.exerciseId) && <TrophyIcon size={14} color={th.colors.accent} />}
                    {deltaText(row.delta)}
                  </View>
                </View>
              ))}
            </View>
          </Reanimated.View>
        )}

        {/* Conditioning blocks — only blocks that were actually started */}
        {entry.blocks?.length > 0 && (
          <Reanimated.View layout={LinearTransition.duration(FOLD_MS)} style={styles.section}>
            <View style={styles.secHead}>
              <Text style={styles.secTitle}>{t('blocks.recapSection')}</Text>
            </View>
            <View style={styles.groupedList}>
              {entry.blocks.map((block, i) => {
                const prev  = prevBlockResult(entry, workoutLog, block.blockId);
                const delta = compareBlockResults(block.format, block.result, prev);
                return (
                  <View
                    key={block.blockId}
                    style={[styles.listItem, styles.listItemRow, getCardRadii(th, i === 0, i === entry.blocks.length - 1)]}
                  >
                    <View style={styles.rowBody}>
                      <View style={styles.blockNameRow}>
                        <View style={[styles.badge, styles[BLOCK_BADGE_STYLE[block.format]]]}>
                          <Text style={[styles.badgeText, styles[`${BLOCK_BADGE_STYLE[block.format]}Text`]]}>
                            {t(`blocks.formats.${block.format}`).toUpperCase()}
                          </Text>
                        </View>
                        <Text style={styles.exName}>{block.name ?? t(`blocks.formats.${block.format}`)}</Text>
                      </View>
                      <Text style={styles.blockScore}>
                        {describeBlockScore(block, t)}
                      </Text>
                    </View>
                    {blockDeltaText(delta)}
                  </View>
                );
              })}
            </View>
          </Reanimated.View>
        )}

        {/* 5 · Esta sesión libre — sus tres decisiones, juntas y al final */}
        {showFree && (
          <Reanimated.View layout={LinearTransition.duration(FOLD_MS)} style={styles.section}>
            <View style={styles.secHead}>
              <Text style={styles.secTitle}>{t('recap.freeTitle')}</Text>
            </View>

            {/* Cuenta para el programa (free-sessions.md §7.3): la sesión libre
                sustituye a una de la etapa. Cambia en los dos sentidos mientras se
                está aquí; el contador de la etapa lo sigue. */}
            {isFree && stageDays.length > 0 && (
              <View style={styles.card}>
                <Text style={styles.qText}>{t('recap.countsAsTitle')}</Text>
                <SegmentedControl
                  options={[
                    { id: 'none', label: t('recap.countsAsNone') },
                    ...stageDays.map((d) => ({
                      id:    d.sessionTemplateId,
                      label: d.label ?? sessionTemplates[d.sessionTemplateId]?.label ?? '·',
                    })),
                  ]}
                  value={entry.countsAs ?? 'none'}
                  onChange={(id) => setEntryCountsAs(entry.id, id === 'none' ? null : id)}
                />
                {countsAsLabel != null && (
                  <Text style={styles.countsHint}>{t('recap.countsAsHint', { label: countsAsLabel })}</Text>
                )}
              </View>
            )}

            {(newExIds.length > 0 || exercisesAdded || onTheFly) && (
              <View style={styles.groupedList}>
                {/* Añadir a la sesión libre lo que se añadió en el entreno (§7.2).
                    Solo añade: la sesión tiene configuración que la entrada no lleva. */}
                {(newExIds.length > 0 || exercisesAdded) && (
                  <MenuRow
                    isFirst
                    isLast={!onTheFly}
                    icon={<RowIcon><Path d="M12 5v14M5 12h14" /></RowIcon>}
                    label={exercisesAdded
                      ? t('freeSession.exercisesAdded')
                      : t('freeSession.addExercises', { count: newExIds.length })}
                    sub={exercisesAdded ? null : t('recap.addExercisesSub')}
                    control={exercisesAdded ? <CheckIcon size={16} color={th.colors.accent} /> : null}
                    onPress={exercisesAdded ? undefined : () => {
                      addEntryExercisesToTemplate(entry.id);
                      setExercisesAdded(true);
                      showToast(t('freeSession.exercisesAdded'), 2200, 'success');
                    }}
                  />
                )}
                {/* Guardar como sesión libre — solo la sobre la marcha, y solo
                    aquí: al empezarla no sabes si merece guardarse, al acabarla sí
                    (free-sessions.md §7.1). */}
                {onTheFly && (
                  <MenuRow
                    isFirst={!(newExIds.length > 0 || exercisesAdded)}
                    isLast
                    icon={(
                      <RowIcon>
                        <Path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                        <Path d="M17 21v-8H7v8M7 3v5h8" />
                      </RowIcon>
                    )}
                    label={templateSaved ? t('freeSession.saved') : t('freeSession.saveAsFree')}
                    sub={templateSaved ? null : t('recap.saveAsFreeSub')}
                    control={templateSaved ? <CheckIcon size={16} color={th.colors.accent} /> : null}
                    onPress={templateSaved ? undefined : () => {
                      saveEntryAsFreeTemplate(entry.id);
                      setTemplateSaved(true);
                      showToast(t('freeSession.saved'), 2200, 'success');
                    }}
                  />
                )}
              </View>
            )}
          </Reanimated.View>
        )}

      </ScrollView>

      {/* Pie fijo. Avisa del sRPE sin bloquear HECHO: sin él la sesión se
          guarda igual, solo que sin carga. */}
      <View style={[styles.foot, { paddingBottom: insets.bottom + spacing.md }]}>
        {rpeMissing && (
          <TouchableOpacity
            style={styles.hint}
            onPress={() => scrollRef.current?.scrollTo({ y: Math.max(0, yourPartY.current - spacing.md), animated: true })}
            activeOpacity={0.7}
            hitSlop={8}
          >
            <View style={styles.qDot} />
            <Text style={styles.hintText}>
              {`${t('recap.missing')} `}
              <Text style={styles.hintStrong}>{t('recap.missingRpe')}</Text>
            </Text>
            <ChevronDown size={10} color={th.colors.mutedLight} />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.doneBtn}
          // Al acabar el de un cliente se vuelve a su ficha, que sigue abierta
          // en la pestaña de Clientes.
          onPress={() => backToMain(navigation, { screen: clientId ? 'Clients' : 'Home' })}
          activeOpacity={0.85}
        >
          <Text style={styles.doneBtnText}>{t('recap.done')}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const makeStyles = (th) => StyleSheet.create({
  container: { flex: 1, backgroundColor: th.colors.bg },
  // Página: padding lateral space/lg y gap space/md, igual que History/Progress.
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingTop:        spacing.md,
    paddingBottom:     spacing.xl,
    gap:               spacing.md,
  },

  // ── 1 · Marcador ──
  hero: {
    backgroundColor: th.colors.surface,
    borderRadius:    th.radius.lg,
    overflow:        'hidden',
  },
  heroTop:  { padding: spacing.lg, gap: spacing.md },
  ceja:     { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  cejaText: { ...textStyles.caps, flexShrink: 1 },
  ident:    { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  // La letra y el nombre en Barlow: los de la sesión de hoy en Inicio. Es la
  // misma sesión, antes y después.
  glyphBox: {
    width:           54,
    height:          54,
    borderRadius:    th.radius.md,
    backgroundColor: th.tint.accent10,
    alignItems:      'center',
    justifyContent:  'center',
    flexShrink:      0,
  },
  glyphBoxClient: { backgroundColor: th.tint.blue30 },
  glyph:          { ...textStyles.heroGlyph },
  identText:      { flex: 1, minWidth: 0, gap: spacing.xs2 },
  sessionName:    { ...textStyles.heroName, color: th.colors.text },
  metaLine:       { ...textStyles.label, color: th.colors.mutedLight },

  // Las cifras informan, no son el premio: `title`, como antes. Separadas por
  // líneas `bg` y no en tarjetas sueltas, que las hacían pesar como tres cosas.
  stats: {
    flexDirection:  'row',
    borderTopWidth: 2,
    borderTopColor: th.colors.bg,
  },
  stat: {
    flex:              1,
    alignItems:        'center',
    paddingHorizontal: spacing.sm,
    paddingVertical:   spacing.md,
    gap:               spacing.xs2,
  },
  statDivider: { borderLeftWidth: 2, borderLeftColor: th.colors.bg },
  statValue:   { ...textStyles.title, color: th.colors.text, textAlign: 'center', fontVariant: ['tabular-nums'] },
  statUnit:    { ...textStyles.label, color: th.colors.mutedLight },
  statLabel: {
    ...textStyles.caps,
    color:         th.colors.mutedLight,
    textTransform: 'uppercase',
    textAlign:     'center',
  },

  // ── Secciones ──
  section: { gap: spacing.sm2, marginTop: spacing.sm },
  secHead: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing.sm,
    paddingHorizontal: spacing.xs2,
  },
  secHeadSplit: { justifyContent: 'space-between' },
  secHeadLeft:  { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  secTitle: {
    ...textStyles.caps,
    color:         th.colors.mutedLight,
    textTransform: 'uppercase',
  },
  secAside: { ...textStyles.label, color: th.colors.mutedLight },

  card: {
    backgroundColor: th.colors.surface,
    borderRadius:    th.radius.lg,
    padding:         spacing.lg,
    gap:             spacing.md,
    overflow:        'hidden',
  },

  // ── 2 · Récords ──
  prRow: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing.md,
    backgroundColor:   th.tint.accent10,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.md,
  },
  prVal:   { alignItems: 'flex-end', gap: spacing.xs, flexShrink: 0 },
  prValue: { ...textStyles.itemTitle, color: th.colors.accent, fontVariant: ['tabular-nums'] },
  moreBtn: {
    backgroundColor: th.colors.surface,
    borderRadius:    th.radius.md,
    paddingVertical: spacing.md,
    alignItems:      'center',
  },
  moreBtnText: { ...textStyles.button, color: th.colors.accent },

  // ── 3 · Tu parte ──
  pendChip:    { backgroundColor: th.colors.surface2, borderRadius: th.radius.xs, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs2 },
  pendChipOk:  { backgroundColor: th.tint.accent10 },
  pendText:    { ...textStyles.labelStrong, color: th.colors.mutedLight },
  pendTextOk:  { color: th.colors.accent },
  qRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  qLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm2, flexShrink: 1 },
  qDot:  { width: 7, height: 7, borderRadius: 3.5, backgroundColor: th.colors.mutedLight },
  qText: { ...textStyles.bodyStrong, color: th.colors.text, flexShrink: 1 },
  qAside: { ...textStyles.label, color: th.colors.mutedLight },

  rpeScale: { flexDirection: 'row', gap: spacing.xs2 },
  rpeBtn: {
    flex:            1,
    paddingVertical: spacing.sm2,
    borderRadius:    th.radius.sm,
    alignItems:      'center',
    justifyContent:  'center',
  },
  rpeBtnText: { ...textStyles.button, fontVariant: ['tabular-nums'] },
  rpeLabels: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    marginTop:      -spacing.sm, // el gap de la card ya separa; esto lo acerca a la escala
  },
  rpeLabel: {
    ...textStyles.caps,
    color:         th.colors.mutedLight,
    textTransform: 'uppercase',
  },
  loadRow: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    gap:               spacing.sm,
    marginHorizontal:  -spacing.lg,
    marginBottom:      -spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical:   spacing.md,
    borderTopWidth:    2,
    borderTopColor:    th.colors.bg,
  },
  loadLabel:     { ...textStyles.caps, color: th.colors.mutedLight, textTransform: 'uppercase' },
  loadValueWrap: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  loadValue:     { ...textStyles.itemTitle, color: th.colors.text, fontVariant: ['tabular-nums'] },
  loadPct:       { ...textStyles.label, color: th.colors.mutedLight },

  weightCard: { paddingVertical: spacing.md, gap: spacing.xs2 },
  weightHint: { ...textStyles.label, color: th.colors.mutedLight },

  // La nota va en celda `bg`, la misma que dice «esto se escribe» en `StepField`.
  noteWell: {
    flexDirection:     'row',
    alignItems:        'flex-start',
    gap:               spacing.sm2,
    backgroundColor:   th.colors.bg,
    borderRadius:      th.radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.md,
    minHeight:         64,
  },
  notePencil: { paddingTop: 3 },
  noteInput: {
    ...textStyles.body,
    lineHeight:        21,
    flex:              1,
    color:             th.colors.text,
    padding:           0,
    textAlignVertical: 'top',
  },

  // ── 4 · Lista agrupada (vs. última y bloques) ──
  groupedList: { gap: spacing.xs },
  listItem: {
    backgroundColor:   th.colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.md,
    gap:               spacing.sm,
  },
  listItemRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm2 },
  deltaRight:  { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexShrink: 0 },
  rowBody:     { flex: 1, minWidth: 0, gap: spacing.xs },

  exName:    { ...textStyles.bodyStrong, color: th.colors.text, flexShrink: 1 },
  exVariant: { ...textStyles.label, color: th.colors.mutedLight },
  exSub:     { ...textStyles.label, color: th.colors.mutedLight },

  // ── Bloques ──
  blockNameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical:   1,
    borderRadius:      th.radius.xs,
  },
  badgeText: { ...textStyles.caps },
  badgeBlockAmrap:       { backgroundColor: th.tint.accent10 },
  badgeBlockAmrapText:   { color: th.colors.accent },
  badgeBlockEmom:        { backgroundColor: th.tint.blue30 },
  badgeBlockEmomText:    { color: th.colors.blue },
  badgeBlockForTime:     { backgroundColor: th.tint.orange30 },
  badgeBlockForTimeText: { color: th.colors.orange },
  blockScore: { ...textStyles.itemTitle, color: th.colors.text, fontVariant: ['tabular-nums'] },

  // ── Desviación vs sesión anterior: texto suelto a la derecha, sin pill.
  // accent = propio/positivo (en este tema no se usa verde); red apagado para
  // los retrocesos — decisión explícita del usuario para el recap.
  delta:    { ...textStyles.labelStrong, fontVariant: ['tabular-nums'], flexShrink: 0 },
  delta_up: { color: th.colors.accent },
  delta_eq: { color: th.colors.mutedLight },
  delta_dn: { color: th.tint.red50 },

  // ── 5 · Sesión libre ──
  countsHint: { ...textStyles.label, color: th.colors.mutedLight },

  // ── Pie fijo ──
  foot: {
    paddingHorizontal: spacing.lg,
    paddingTop:        spacing.md,
    gap:               spacing.sm2,
    backgroundColor:   th.colors.bg,
  },
  hint: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            spacing.sm,
  },
  hintText:   { ...textStyles.label, color: th.colors.mutedLight },
  hintStrong: { ...textStyles.labelStrong, color: th.colors.text },
  doneBtn: {
    backgroundColor: th.colors.accent,
    borderRadius:    th.radius.sm,
    paddingVertical: spacing.md,
    alignItems:      'center',
  },
  doneBtnText: { ...textStyles.button, color: th.colors.onAccent },
});
