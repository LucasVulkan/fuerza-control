import { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Alert,
} from 'react-native';
import Svg, { Path, G } from 'react-native-svg';
// Reanimated lleva las dos mitades del plegado: el `layout` de la tarjeta
// anima su propio alto y el contenido entra y sale con opacidad. Es el patrón
// del acordeón de `SessionCard`; ningún `Animated.Value` persiguiendo alturas
// desde JS.
import Reanimated, { LinearTransition, FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import { useStore, selectActiveProgram } from '../../store/useStore';
import { stageDays, stageDaysAt } from '../utils/stageProgress';
import AppHeader from '../components/AppHeader';
import ProgramUpdateModal from '../components/ProgramUpdateModal';
import DragSheet from '../components/DragSheet';
import { MenuRow, Status, RowIcon } from '../components/ui/MenuList';
import ProgramCard from '../components/ui/ProgramCard';
import { spacing, typography, textStyles, borders, withOpacity } from '../theme';
import { useTheme, useThemedStyles } from '../useTheme';
import { formatDate } from '../utils/formatters';
import { isStageLocked, isTrainerProgram } from '../utils/stageLocks';
import { LockIcon } from '../components/ui/EditorIcons';
import { DocSheet } from '../components/ui/DocPoints';
import { getWeekStatuses } from '../utils/weekProgress';
import { sessionPlan } from '../utils/sessionPlan';
import { sessionStats } from '../utils/sessionStats';
import { targetLabel, exerciseName } from '../utils/prescription';
import { isExerciseDone } from '../utils/exerciseStatus';
import { computeAdherence, adherencePct, adherenceColor, requiresAttention, STATUS } from '../utils/adherence';
import { sessionLoads, dailySeries } from '../utils/trainingLoad';

// Tint base "lima" (#b8ff00) — distinto del accent sólido (#aae216), sin
// token propio (mismo caso que el #81a71e del banner, ver theme.js).
const LIMA = '#b8ff00';

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Formats a Drive backup timestamp into a short, precise relative string.
 * Uses sub-hour precision for recent backups.
 */
function formatBackupTime(isoString) {
  if (!isoString) return null;
  const ms      = Date.now() - new Date(isoString).getTime();
  const mins    = Math.floor(ms / 60000);
  const hours   = Math.floor(ms / 3600000);
  const days    = Math.floor(ms / 86400000);
  if (mins  <  1) return 'ahora';
  if (mins  < 60) return `${mins}min`;
  if (hours < 24) return `${hours}h`;
  if (days  <  2) return 'ayer';
  if (days  <  7) return `${days}d`;
  // Older than a week: show short date
  const d = new Date(isoString);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

function daysSince(ts) {
  if (!ts) return null;
  return Math.floor((Date.now() - ts) / 86400000);
}

function relativeTime(ts, t) {
  const days = daysSince(ts);
  if (days === null) return null;
  if (days === 0)  return t('dayCard.today');
  if (days === 1)  return t('dayCard.yesterday');
  if (days < 7)   return t('dayCard.daysAgo', { count: days });
  if (days < 14)  return t('dayCard.oneWeekAgo');
  if (days < 30)  return t('dayCard.weeksAgo', { count: Math.floor(days / 7) });
  return formatDate(ts);
}

/** "42 min" / "2 h" — cuánto lleva abierta la sesión en curso. */
function elapsedShort(startedAt) {
  if (!startedAt) return null;
  const mins = Math.max(0, Math.floor((Date.now() - startedAt) / 60000));
  return mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)} h`;
}

/**
 * Global "week" counter = total sessions logged for this program / sessions-per-cycle.
 * "Semana" in this app = one complete rotation through the session templates.
 */
function computeWeekNum(program) {
  // `totalWeeksCompleted` sube en el programa cada vez que se cierra un ciclo
  // completo, sea cual sea la etapa; cambiar de etapa no lo reinicia.
  //
  // Aquí había una segunda rama que contaba ciclos desde el workoutLog para
  // programas SIN etapas, leyendo el espejo `program.days`. Todo programa tiene
  // etapas, así que era inalcanzable.
  return (program.totalWeeksCompleted ?? 0) + 1;
}

/**
 * How many DISTINCT sessions have actually been completed in the current cycle
 * (via `program.cycleCompletedIds` — which templates, not a position count),
 * and how many sessions are in one cycle.
 */
function computeCycleProgress(program) {
  const currentDays = stageDays(program);
  const sessionsPerCycle = Math.max(1, currentDays.length);
  const doneIds          = new Set(program.cycleCompletedIds ?? []);
  const doneInCycle      = currentDays.filter((d) => doneIds.has(d.sessionTemplateId)).length;
  return { doneInCycle, sessionsPerCycle };
}

/**
 * Data for the stage block of the program card (null when there is nothing
 * worth showing).
 *
 * `totalWeeks` is null when the stage has no cycle limit
 * (`durationWeeks: null`), and the caller must not try to count towards it.
 */
function computeStageInfo(program, t) {
  const stages = program.stages ?? [];
  if (stages.length === 0) return null;
  const stageIdx         = program.currentStageIndex ?? 0;
  const stage            = stages[stageIdx];
  if (!stage) return null;
  const totalWeeks       = stage.durationWeeks ?? null;
  // Una sola etapa y sin límite = programa sin periodizar. No hay nada que
  // contar ni total para la tira de ciclos, así que el bloque no se pinta —
  // que es lo que se veía antes de unificar el modelo, cuando un programa así
  // simplemente no tenía etapas.
  if (stages.length === 1 && totalWeeks == null) return null;
  // A week is a closed rotation, not a session count — repeating a session must
  // not move this. See `docs/specs/stage-locks.md` §3.
  const cyclesDone       = program.stageWeeksCompleted ?? 0;
  const weekInStage      = totalWeeks == null ? cyclesDone + 1 : Math.min(cyclesDone + 1, totalWeeks);
  // "Estoy en el ciclo N" y "he terminado los N" caen los dos en el mismo
  // `weekInStage` por el clamp, y se pintan distinto: terminada, la tira va
  // llena entera. Sin esto, cerrar una etapa en los ciclos ya hechos (al añadir
  // la siguiente) dejaba el último segmento vacío y parecía faltar un ciclo.
  const stageComplete    = totalWeeks != null && cyclesDone >= totalWeeks;
  const defaultLabel     = t('home.stageDefault', { n: stageIdx + 1 });
  return {
    stageLabel:    defaultLabel,
    stageName:     stage.name ?? defaultLabel,
    weekInStage,
    totalWeeks,
    stageComplete,
  };
}

// ── Weekly selector (L M X J V S D + 7 dots) ────────────────────────────────────
//
// Va arriba del todo y DESNUDA: sin caja, sin rótulo y sin contador. Se probó
// con caja rotulada "ESTA SEMANA" y un contador de entrenos, y el usuario lo
// rechazó — si algún día se quiere recuperar ese contador hay que dárselo de
// otra forma, porque con la caja se fue.
//
// Los puntos reflejan días REALMENTE entrenados (workoutLog), no una plantilla.
// Solo dos estados: entrenado = lima, cualquier otro = gris apagado. El día de
// hoy NO se marca en el punto — lo identifica su letra en lima, y basta.

function WeekDot({ status, styles }) {
  const trained = status === 'trained' || status === 'todayTrained';
  return <View style={[styles.weekDot, trained ? styles.weekDotTrained : styles.weekDotIdle]} />;
}

function WeekSelector({ workoutLog }) {
  const { t, i18n } = useTranslation();
  const styles  = useThemedStyles(makeStyles);
  const letters = t('home.weekDayLetters', { returnObjects: true });
  const days    = getWeekStatuses(workoutLog);

  const summary = days
    .map(({ date, status }) => {
      const name  = new Date(date).toLocaleDateString(i18n.language, { weekday: 'long' });
      const extra = status === 'trained' || status === 'todayTrained'
        ? t('home.dayTrained')
        : (status === 'today' ? t('dayCard.today') : null);
      return extra ? `${name}: ${extra}` : name;
    })
    .join(', ');

  return (
    <View style={styles.week} accessible accessibilityLabel={summary}>
      <View style={styles.weekLetters}>
        {letters.map((letter, i) => (
          <Text
            key={i}
            style={[styles.weekLetter, (days[i].status === 'today' || days[i].status === 'todayTrained') && styles.weekLetterToday]}
          >
            {letter}
          </Text>
        ))}
      </View>
      <View style={styles.weekDots}>
        {days.map(({ status }, i) => <WeekDot key={i} status={status} styles={styles} />)}
      </View>
    </View>
  );
}

// ── Sesiones ──────────────────────────────────────────────────────────────
//
// Una sola lista en orden de ciclo. Cada sesión es una fila plegable y la que
// toca hoy es esa misma fila a otra escala: en lima, con la letra grande y su
// botón puesto. Toda la cabecera abre; SOLO el botón entra a entrenar
// (docs/specs/home-sesiones-plegables.md §5).
//
// El hero suelto que había antes ya no existe: se sacaba de la lista, obligaba a
// elegir entre enseñar los ejercicios o caber en pantalla, y no había manera de
// mirar una sesión sin empezarla.

function HeroChevron({ size = 13, color = LIMA }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 12 12" fill="none">
      <Path d="M4 2l4.5 4L4 10" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/**
 * Los ejercicios de la sesión, tal cual se los va a encontrar dentro.
 *
 * Deliberadamente sosa —Inter en caja baja, sin filetes y sin lima— para que la
 * cabecera siga siendo lo que canta (§5.4). Los bloques de acondicionamiento van
 * detrás de los ejercicios, con su formato donde las series y sin la pastilla de
 * color del editor, que aquí sería un cuarto acento.
 */
function ExerciseLines({ template, allExercises }) {
  const { t, i18n } = useTranslation();
  const styles    = useThemedStyles(makeStyles);
  const exercises = template.exercises ?? [];
  const blocks    = template.blocks ?? [];

  const line = (key, idx, name, right) => (
    <View key={key} style={styles.exRow}>
      <Text style={styles.exIdx}>{idx}</Text>
      <Text style={styles.exName} numberOfLines={1}>{name}</Text>
      <Text style={styles.exTarget}>{right}</Text>
    </View>
  );

  return (
    <>
      {exercises.map((ex, i) => {
        const def = allExercises[ex.exerciseId];
        return line(
          `${ex.exerciseId}-${i}`,
          i + 1,
          exerciseName(def, i18n.language, ex.exerciseId),
          targetLabel(def, ex, t, { compact: true }),
        );
      })}
      {blocks.map((block, i) => line(
        `block-${i}`,
        exercises.length + i + 1,
        block.name ?? t(`blocks.formats.${block.format}`),
        t(`blocks.formats.${block.format}`).toUpperCase(),
      ))}
    </>
  );
}

/**
 * Una sesión cualquiera: 60 px cerrada, y al abrirse los ejercicios y SU botón
 * —en contorno, no en relleno—. Que el botón solo exista abierta es lo que dice
 * «puedes, pero no es lo que toca» sin un diálogo de confirmación.
 */
function SessionRow({
  marker, name, meta, done, adapted, open,
  cta, onToggle, onStart, a11yLabel, children,
}) {
  const { t }  = useTranslation();
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <Reanimated.View layout={LinearTransition.duration(240)} style={styles.sesCard}>
      <TouchableOpacity
        style={styles.sesHead}
        onPress={onToggle}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel={a11yLabel}
        accessibilityState={{ expanded: open }}
        accessibilityHint={t(open ? 'home.collapse' : 'home.expand')}
      >
        <Text style={[styles.sesGlyph, done && styles.sesGlyphDone]}>{marker}</Text>
        <Text style={[styles.sesName, done && styles.sesNameDone]} numberOfLines={1}>{name}</Text>
        {!!adapted && <Text style={styles.rowAdapted}>{t('home.adapted')}</Text>}
        <Text style={styles.sesMeta} numberOfLines={1}>{meta}</Text>
        {done && <CheckIcon size={14} color={LIMA} />}
      </TouchableOpacity>

      {open && (
        <Reanimated.View
          entering={FadeIn.duration(180)}
          exiting={FadeOut.duration(150)}
          style={styles.sesBody}
        >
          <View style={styles.sesBodyRule} />
          {children}
          <TouchableOpacity
            style={styles.sesBtn}
            onPress={onStart}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel={cta}
          >
            <Text style={styles.sesBtnText}>{cta}</Text>
            <HeroChevron color={th.colors.accent} />
          </TouchableOpacity>
        </Reanimated.View>
      )}
    </Reanimated.View>
  );
}

/**
 * La que toca hoy: la misma fila en lima y a otra escala. Es la ÚNICA pieza en
 * color de la pantalla, así que dentro el acento pasa a ser el negro —letra,
 * raya y series— y el botón se invierte (§1.1).
 *
 * El botón vive en el pie y no dentro del desplegable: abrir la tarjeta crece
 * por dentro y no lo mueve de sitio.
 */
function TodayCard({
  marker, flag, name, meta, open, cta, onToggle, onStart, a11yLabel, children,
}) {
  const { t }  = useTranslation();
  const styles = useThemedStyles(makeStyles);
  return (
    <Reanimated.View layout={LinearTransition.duration(240)} style={styles.today}>
      <TouchableOpacity
        style={styles.todayHead}
        onPress={onToggle}
        activeOpacity={0.9}
        accessibilityRole="button"
        accessibilityLabel={a11yLabel}
        accessibilityState={{ expanded: open }}
        accessibilityHint={t(open ? 'home.collapse' : 'home.expand')}
      >
        {/* La letra se empareja con el NOMBRE, no con el bloque entero: son la
            misma cosa dicha de dos maneras. Por eso el rótulo sale fuera y se
            queda a ancho completo —alineado con la raya, la meta y el botón— y
            la letra y el nombre forman su propia línea, apoyados en el mismo
            suelo. Sin un solo margen a ojo: se recoloca solo si el nombre rompe
            a dos líneas. Ver §5.2.1. */}
        <Text style={styles.todayFlag} numberOfLines={1}>{flag}</Text>
        <View style={styles.todayHeadRow}>
          {!!marker && <Text style={styles.todayGlyph}>{marker}</Text>}
          <Text style={styles.todayName} numberOfLines={2}>{name}</Text>
        </View>
        <View style={styles.todayRule} />
        <Text style={styles.todayMeta} numberOfLines={1}>{meta}</Text>
      </TouchableOpacity>

      {open && (
        <Reanimated.View
          entering={FadeIn.duration(180)}
          exiting={FadeOut.duration(150)}
          style={styles.todayBox}
        >
          {children}
        </Reanimated.View>
      )}

      <View style={styles.todayFoot}>
        <TouchableOpacity
          style={styles.todayBtn}
          onPress={onStart}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={cta}
        >
          <Text style={styles.todayBtnText}>{cta}</Text>
          <HeroChevron />
        </TouchableOpacity>
      </View>
    </Reanimated.View>
  );
}

/**
 * El texto del botón dice A DÓNDE LLEVA, con el nombre de la sesión dentro.
 * Sin letra (una plantilla sin `label`) cae a la forma corta: la interfaz no
 * promete lo que no tiene.
 */
function startCta(t, label, { active, done }) {
  if (active) return label ? t('home.btnContinueSession', { label }) : t('home.btnContinue');
  if (done)   return label ? t('home.btnRepeatSession',   { label }) : t('home.btnRepeat');
  return label ? t('home.btnStartSession', { label }) : t('home.btnStart');
}

// ── Hojas del programa (archivar / elegir etapa) ───────────────────────────────
//
// Las dos eran `Modal` propios con su backdrop, su título y su "Cancelar".
// Pasan a `DragSheet` + las filas de `ui/MenuList`, que es lo que manda §9 de
// docs/UI-MIGRATION.md: un solo bottom-sheet en toda la app y un solo tipo de
// fila. `background` en `bg` porque las filas van en `surface` y sobre la hoja
// (también `surface`) se fundirían. La salida es la propia cabecera de la hoja,
// así que no hay botón de cancelar.

function ArchiveSheet({ programName, onConfirm, onClose }) {
  const { t }  = useTranslation();
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <DragSheet visible onClose={onClose} title={t('home.archiveModal.title')}>
      <Text style={styles.sheetIntro}>
        <Text style={styles.sheetIntroName}>{programName}</Text>
        {'\n'}{t('home.archiveModal.desc')}
      </Text>
      <View style={styles.sheetGroup}>
        <MenuRow
          isFirst
          label={t('home.archiveModal.keepHistory')}
          sub={t('home.archiveModal.keepHistoryDesc')}
          subLines={0}
          minHeight={62}
          onPress={() => onConfirm(false)}
        />
        <MenuRow
          isLast
          label={t('home.archiveModal.clearHistory')}
          labelColor={th.tint.red50}
          sub={t('home.archiveModal.clearHistoryDesc')}
          subLines={0}
          minHeight={62}
          onPress={() => onConfirm(true)}
        />
      </View>
    </DragSheet>
  );
}

function StagePickerSheet({ program, onSelect, onClose }) {
  const { t }      = useTranslation();
  const th         = useTheme();
  const styles     = useThemedStyles(makeStyles);
  const clientSync = useStore((s) => s.clientSync);
  const currentIdx = program.currentStageIndex ?? 0;
  return (
    <DragSheet visible onClose={onClose} title={t('home.selectStage')}>
      <View style={styles.sheetGroup}>
        {program.stages.map((stage, idx) => {
          const isActive = idx === currentIdx;
          const locked   = isStageLocked(program, idx, clientSync);
          return (
            <MenuRow
              key={stage.id ?? idx}
              isFirst={idx === 0}
              isLast={idx === program.stages.length - 1}
              label={stage.name}
              labelColor={isActive ? th.colors.accent : undefined}
              sub={locked
                ? t('home.stageLockedShort')
                : stage.durationWeeks == null
                  ? t('home.stageMetaOpen', { sessions: stage.days?.length ?? 0 })
                  : t('home.stageMeta',     { cycles: stage.durationWeeks, sessions: stage.days?.length ?? 0 })}
              minHeight={62}
              disabled={locked}
              onPress={() => onSelect(idx)}
              // La etapa en curso lleva el mismo check lima que las frecuencias
              // de Drive. El hueco vacío de las demás mata el chevron de
              // `MenuRow`: aquí se elige, no se navega.
              control={isActive
                ? <CheckIcon size={16} color={th.colors.accent} />
                : locked
                  ? <LockIcon size={13} color={th.colors.muted} />
                  : <View style={styles.rowControlSpacer} />}
            />
          );
        })}
      </View>
    </DragSheet>
  );
}

// ── Iconos ────────────────────────────────────────────────────────────────────

function CheckIcon({ size = 16, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M20 6L9 17l-5-5" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// ── Section header ──────────────────────────────────────────────────────────────
// SESIONES lleva a la derecha el contador del ciclo, que sale entero de
// `sessionPlan`: la pantalla no compone la frase, solo decide si hay hueco para
// ella (sin ciclo que contar, `subtitle` viene a null y no se pinta nada).

function SectionHeader({ label, count, dim }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.secHeader}>
      <Text style={[styles.secHeaderLabel, dim && styles.secHeaderLabelDim]}>{label}</Text>
      {!!count && <Text style={styles.secHeaderCount}>{count}</Text>}
    </View>
  );
}

// ── HomeScreen ─────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const insets     = useSafeAreaInsets();
  const navigation = useNavigation();
  const { t }      = useTranslation();
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);

  const [archiveOpen, setArchiveOpen] = useState(false);
  const [stagePicker, setStagePicker] = useState(false);
  const [cycleDoc,    setCycleDoc]    = useState(false);
  const [freeSheet,   setFreeSheet]   = useState(false);
  const [freeTpls,    setFreeTpls]    = useState(false);
  // Acordeón puro: como mucho una sesión abierta. Ni se persiste ni se
  // recuerda al volver — es una preferencia de un segundo, no un ajuste.
  const [openId,      setOpenId]      = useState(null);

  const activeProgram        = useStore(selectActiveProgram);
  const activeSession        = useStore((s) => s.activeSession);
  const workoutLog           = useStore((s) => s.workoutLog);
  // Suscrito SOLO para que la pantalla se repinte al editar una sesion: los
  // datos se leen con `getEffectiveTemplate`, que es una funcion estable y por
  // si sola nunca dispara un render.
  // eslint-disable-next-line no-unused-vars
  const sessionTemplates     = useStore((s) => s.sessionTemplates);
  const getEffectiveTemplate = useStore((s) => s.getEffectiveTemplate);
  const getLastSession       = useStore((s) => s.getLastSession);
  const startSession         = useStore((s) => s.startSession);
  const startFreeSession     = useStore((s) => s.startFreeSession);
  const freeSessionPresets   = useStore((s) => s.freeSessionPresets);
  const deleteFreePreset     = useStore((s) => s.deleteFreeSessionPreset);
  const navigate             = useStore((s) => s.navigate);
  const clientSync           = useStore((s) => s.clientSync);
  const archiveProgram       = useStore((s) => s.archiveProgram);
  const advanceStage         = useStore((s) => s.advanceStage);
  const dismissStageAdvance  = useStore((s) => s.dismissStageAdvance);
  const setCurrentStage      = useStore((s) => s.setCurrentStage);
  const driveBackup          = useStore((s) => s.driveBackup);
  const exerciseLibrary      = useStore((s) => s.exerciseLibrary);
  const customExercises      = useStore((s) => s.customExercises);

  const allExercises = useMemo(
    () => ({ ...exerciseLibrary, ...customExercises }),
    [exerciseLibrary, customExercises],
  );

  function handleArchiveConfirm(clearHistory) {
    if (activeProgram) archiveProgram(activeProgram.id, clearHistory);
    setArchiveOpen(false);
  }

  // Empezar cualquier cosa con una sesión a medias la descartaba en silencio.
  const confirmDiscardActive = (onConfirm) => {
    Alert.alert(
      t('workout.discardConfirm'),
      undefined,
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('workout.discardSession'), style: 'destructive', onPress: onConfirm },
      ],
    );
  };

  const startFree = (preset) => {
    if (activeSession.templateId) { confirmDiscardActive(() => startFreeSession(preset)); return; }
    startFreeSession(preset);
  };

  // La hoja de "nueva / desde plantilla" SOLO existe cuando hay plantillas: sin
  // ninguna, el botón va directo a la sesión en blanco como siempre. Misma regla
  // que la fila de presets del editor de sesión, y la del hero (§5.3) en otra
  // pieza — la interfaz no promete lo que no tiene.
  const handleFreePress = () => {
    if (activeSession.templateId === '__free__') { navigation.navigate('Workout'); return; }
    if ((freeSessionPresets ?? []).length > 0) { setFreeSheet(true); return; }
    startFree(null);
  };

  const freePresetMeta = (preset) => [
    t('freeSession.templateExercises', { count: preset.exercises?.length ?? 0 }),
    (preset.blocks?.length ?? 0) > 0
      ? t('freeSession.templateBlocks', { count: preset.blocks.length })
      : null,
  ].filter(Boolean).join(' · ');

  const confirmDeleteFreePreset = (preset) => {
    Alert.alert(
      t('freeSession.deleteTemplate'),
      t('freeSession.deleteTemplateConfirm', { name: preset.name ?? t('freeSession.templateUnnamed') }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('freeSession.deleteTemplate'), style: 'destructive', onPress: () => deleteFreePreset(preset.presetId) },
      ],
    );
  };

  // ── Los 3 datos de la tarjeta de programa ────────────────────────────────────
  // Las mismas tres cifras que el entrenador ve del cliente, calculadas aquí del
  // lado del atleta: es la única lógica nueva de la convergencia, y el efecto
  // secundario es bueno — se ve de sí mismo exactamente lo que ven de él, sin
  // panel oculto (spec §4.3).
  const sessionsPerCycle = activeProgram ? Math.max(1, stageDays(activeProgram).length) : 0;

  const adherence = useMemo(() => computeAdherence({
    sessions: workoutLog,
    sessionsPerCycle,
  }), [workoutLog, sessionsPerCycle]);

  const adherence4w = useMemo(
    () => adherencePct({ sessions: workoutLog, sessionsPerCycle }),
    [workoutLog, sessionsPerCycle],
  );

  // Carga media: media de carga externa de los últimos 7 días frente a la de los
  // 28, en %. Con menos de dos semanas de historial no hay contra qué comparar.
  const loadPct = useMemo(() => {
    if (workoutLog.length < 2) return null;
    const days = dailySeries(sessionLoads(workoutLog, allExercises));
    if (days.length < 14) return null;
    const ext = days.map((d) => d.external ?? 0);
    const avg = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
    const m28 = avg(ext.slice(-28));
    if (!m28) return null;
    return Math.round((avg(ext.slice(-7)) / m28 - 1) * 100);
  }, [workoutLog, allExercises]);

  // ── Conexiones ───────────────────────────────────────────────────────────────
  const driveConnected  = driveBackup.enabled && !driveBackup.needsReconnect;
  const driveWarn       = driveBackup.enabled && driveBackup.needsReconnect;
  const driveBackupRel  = formatBackupTime(driveBackup.lastBackup);
  const driveSub        = driveWarn
    ? t('home.reconnect')
    : driveConnected
      ? [driveBackup.email, driveBackupRel].filter(Boolean).join(' · ')
      : t('home.notConnected');

  const trainerOk        = !!clientSync.slotId && !clientSync.syncErrorAt && !clientSync.pendingUpload;
  const trainerWarn      = !!clientSync.slotId && (!!clientSync.syncErrorAt || clientSync.pendingUpload);
  const trainerTitle     = (trainerOk || trainerWarn)
    ? (clientSync.trainerName ?? t('home.trainer'))
    : t('home.trainer');
  // La etiqueta de la fila es el NOMBRE del entrenador cuando lo hay, así que
  // el subtítulo dice el papel; sin nombre, la etiqueta ya es "Entrenador" y
  // repetirlo debajo no diría nada.
  const trainerSub       = trainerWarn
    ? t('home.pendingSync')
    : trainerOk
      ? (clientSync.trainerName ? t('home.trainer') : t('home.connected'))
      : t('home.notConnected');

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <AppHeader />
      <ProgramUpdateModal />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <WeekSelector workoutLog={workoutLog} />

        {activeProgram ? (() => {
          const hasStages   = (activeProgram.stages?.length ?? 0) > 0;
          const stageIdx    = activeProgram.currentStageIndex ?? 0;
          const currentStage = hasStages ? activeProgram.stages[stageIdx] : null;
          const nextStage    = hasStages ? activeProgram.stages[stageIdx + 1] : null;
          const nextStageLocked = isStageLocked(activeProgram, stageIdx + 1, clientSync);

          const stageInfo                  = computeStageInfo(activeProgram, t);
          const weekNum                    = computeWeekNum(activeProgram);
          const { doneInCycle }            = computeCycleProgress(activeProgram);

          // Current session templates in cycle order.
          const currentDays = stageDaysAt(activeProgram, stageIdx);
          const days = currentDays
            .map(({ sessionTemplateId }) => ({
              templateId:  sessionTemplateId,
              template:    getEffectiveTemplate(sessionTemplateId),
              lastSession: getLastSession(sessionTemplateId),
            }))
            .filter((d) => d.template);
          const byId = new Map(days.map((d) => [d.templateId, d]));

          // Trainer name — from the first session template that has one ("por …").
          const programTrainerName = days.map((d) => d.template?.trainerName).find(Boolean) ?? null;

          // ¿Cuál toca y por qué? — rótulo, marcadores y contador, en un sitio.
          const plan = sessionPlan({
            days: days.map((d) => ({ templateId: d.templateId, label: d.template.label })),
            cycleCompletedIds: activeProgram.cycleCompletedIds,
            activeTemplateId:  activeSession.templateId,
            t,
          });
          // Empezar una sesión que no toca ya no lleva diálogo: hay que abrir su
          // tarjeta y pulsar un botón que además va en contorno, o sea dos toques
          // deliberados. El aviso solo añadía fricción (spec §5.6). Descartar una
          // sesión a medias, en cambio, se sigue confirmando: ahí sí se pierde algo.
          const requestStart = (templateId) => {
            if (activeSession.templateId === templateId) { navigation.navigate('Workout'); return; }
            if (activeSession.templateId) { confirmDiscardActive(() => startSession(templateId)); return; }
            startSession(templateId);
          };

          // La meta de la tarjeta de hoy: los dos primeros datos salen de
          // `sessionStats`, que ya existe, y el tercero es cuándo fue la última
          // vez. Con la sesión a medias cambia entera — cuánto llevas y desde
          // cuándo, que es lo único que importa para volver a ella.
          const todayMeta = (day) => {
            if (activeSession.templateId === day.templateId) {
              const exs  = day.template.exercises ?? [];
              const done = exs.filter((ex) => isExerciseDone(ex, activeSession.setsState?.[ex.exerciseId] ?? [])).length;
              return t('home.heroMetaActive', {
                done, total: exs.length, ago: elapsedShort(activeSession.startedAt) ?? '',
              });
            }
            const stats = sessionStats(day.template, allExercises);
            const rel   = relativeTime(day.lastSession?.timestamp, t);
            return [
              t('home.sessionMeta', { count: stats.exercises, minutes: stats.minutes }),
              rel ? t('home.heroMetaLast', { rel: rel.toLowerCase() }) : t('home.firstTime').toLowerCase(),
            ].join(' · ');
          };

          return (
            <>
              <View>
                <SectionHeader label={t('home.sessions').toUpperCase()} count={plan.subtitle} />

                {/* Etapa terminada: el único "algo terminó" que persiste en la
                    Home. Va ENCIMA del hero y no lo sustituye — la sesión que
                    toca sigue siendo la que toca. Con la siguiente etapa
                    bloqueada el cliente no se queda sin nada que hacer: sigue en
                    la actual (spec stage-locks §0.1), así que el banner solo
                    cambia de mensaje. */}
                {activeProgram.stageAdvancePending && nextStage && (
                  <View style={styles.stageBanner}>
                    {nextStageLocked ? (
                      <>
                        <Text style={styles.stageBannerLabel}>{t('home.stageLockedTitle').toUpperCase()}</Text>
                        <Text style={styles.stageBannerText}>
                          {t('home.stageLockedText', {
                            current: currentStage?.name ?? t('home.currentStageDefault'),
                            next: nextStage.name,
                          })}
                        </Text>
                        <Text style={styles.stageBannerHint}>{t('home.stageLockedHint')}</Text>
                        <View style={styles.stageBannerBtns}>
                          <TouchableOpacity
                            style={styles.stageBannerBtn}
                            onPress={() => dismissStageAdvance(activeProgram.id)}
                            activeOpacity={0.7}
                          >
                            <Text style={styles.stageBannerBtnText}>{t('home.understood')}</Text>
                          </TouchableOpacity>
                        </View>
                      </>
                    ) : (
                      <>
                        <Text style={styles.stageBannerLabel}>{t('home.stageCompleted').toUpperCase()}</Text>
                        <Text style={styles.stageBannerText}>
                          {t('home.stageAdvanceText', {
                            current: currentStage?.name ?? t('home.currentStageDefault'),
                            next: nextStage.name,
                          })}
                        </Text>
                        <View style={styles.stageBannerBtns}>
                          <TouchableOpacity
                            style={[styles.stageBannerBtn, { flex: 2 }]}
                            onPress={() => advanceStage(activeProgram.id)}
                            activeOpacity={0.85}
                          >
                            <Text style={styles.stageBannerBtnText}>
                              {t('home.advanceTo', { name: (nextStage.name ?? '').toUpperCase() })}
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.stageBannerBtn, styles.stageBannerBtnQuiet]}
                            onPress={() => dismissStageAdvance(activeProgram.id)}
                            activeOpacity={0.7}
                          >
                            <Text style={[styles.stageBannerBtnText, styles.stageBannerBtnTextQuiet]}>
                              {t('home.close').toUpperCase()}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </>
                    )}
                  </View>
                )}

                {/* Todas las sesiones, en orden de ciclo: la que toca es una
                    más, en su hueco y a otra escala. NO es la lista agrupada de
                    Progreso: cada sesión es una tarjeta suelta con su radio
                    entero, porque cualquiera de ellas puede crecer. */}
                <View style={styles.group}>
                  {plan.rows.map((row) => {
                    const day = byId.get(row.templateId);
                    if (!day) return null;
                    const open   = openId === row.templateId;
                    const active = activeSession.templateId === row.templateId;
                    const name   = day.template.name ?? '';
                    const cta    = startCta(t, day.template.label ?? '', { active, done: row.isDone });
                    const toggle = () => setOpenId(open ? null : row.templateId);
                    const start  = () => requestStart(row.templateId);
                    const a11y   = `${t('workout.sessionLabel', { label: row.marker })}, ${name}, ${row.isDone ? t('home.sessionDone') : t('home.sessionPending')}`;
                    const lines  = (
                      <ExerciseLines template={day.template} allExercises={allExercises} />
                    );

                    if (row.isHero) {
                      return (
                        <TodayCard
                          key={row.templateId}
                          marker={row.marker}
                          flag={plan.heroLabel}
                          name={name}
                          meta={todayMeta(day)}
                          open={open}
                          cta={cta}
                          onToggle={toggle}
                          onStart={start}
                          a11yLabel={`${plan.heroLabel}, ${a11y}`}
                        >
                          {lines}
                        </TodayCard>
                      );
                    }

                    const stats = sessionStats(day.template, allExercises);
                    const rel   = relativeTime(day.lastSession?.timestamp, t);
                    return (
                      <SessionRow
                        key={row.templateId}
                        marker={row.marker}
                        name={name}
                        // Hecha: cuándo fue. Pendiente: cuánto dura. Cuántos
                        // ejercicios tiene está un toque más abajo, con los
                        // ejercicios de verdad.
                        meta={row.isDone && rel
                          ? rel.toLowerCase()
                          : t('home.rowMinutes', { minutes: stats.minutes })}
                        done={row.isDone}
                        // "Adaptada" es texto, no una pastilla: menos ruido, y el
                        // azul sigue significando entrenador.
                        adapted={!!clientSync.pendingOverrides?.[row.templateId]}
                        open={open}
                        cta={cta}
                        onToggle={toggle}
                        onStart={start}
                        a11yLabel={a11y}
                      >
                        {lines}
                      </SessionRow>
                    );
                  })}
                </View>

                {/* Sesión libre */}
                <TouchableOpacity
                  style={styles.freeSessionBtn}
                  onPress={handleFreePress}
                  activeOpacity={0.75}
                  accessibilityRole="button"
                >
                  <Text style={styles.freeSessionBtnText}>
                    {activeSession.templateId === '__free__'
                      ? t('freeSession.btnContinue')
                      : t('freeSession.btn')}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* ── El programa, al final ── la misma tarjeta que la ficha de
                  cliente. Mantener pulsada la etapa ya no existe: el ⋯ del pie
                  abre el archivado y la barra de etapa lleva al selector. */}
              <View style={styles.programBlock}>
                <ProgramCard
                  variant="self"
                  name={activeProgram.name}
                  cycleNum={weekNum}
                  trainerName={programTrainerName}
                  stage={stageInfo && {
                    label:       stageInfo.stageLabel,
                    name:        stageInfo.stageName,
                    weekInStage: stageInfo.weekInStage,
                    totalWeeks:  stageInfo.totalWeeks,
                  }}
                  stageRatios={stageInfo?.totalWeeks != null
                    ? Array.from({ length: stageInfo.totalWeeks }, (_, i) => (
                        stageInfo.stageComplete ? 1
                          : i < stageInfo.weekInStage - 1 ? 1
                          : i === stageInfo.weekInStage - 1 ? doneInCycle / Math.max(1, sessionsPerCycle)
                          : 0
                      ))
                    : null}
                  adherence={adherence4w}
                  adherenceColor={requiresAttention(adherence.status) ? adherenceColor(th, adherence.status) : null}
                  pace={adherence.status === STATUS.NO_DATA ? null : adherence.recentPerWeek}
                  loadPct={loadPct}
                  // El programa del entrenador no se edita aquí: la edición no
                  // sube por el canal (solo suben historial y contadores) y la
                  // siguiente actualización la reemplaza entera, así que el botón
                  // prometía algo que no pasaba. Sin él, VER ocupa el pie.
                  onEdit={isTrainerProgram(activeProgram, clientSync) ? undefined : () => navigate('programEditor')}
                  onView={() => navigate('programPrint')}
                  onMore={() => setArchiveOpen(true)}
                  // Los dos accesos que vivían en el banner se mudan a las
                  // piezas equivalentes de la tarjeta: la etiqueta CICLO abre la
                  // ficha del apartado (es el concepto que más cuesta y este es
                  // el sitio donde todo el mundo lo ve a diario) y el bloque de
                  // etapa abre el selector.
                  onCycleInfo={() => setCycleDoc(true)}
                  onStagePress={hasStages ? () => setStagePicker(true) : undefined}
                />
              </View>
            </>
          );
        })() : (
          /* ── Empty state ── */
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🏋️</Text>
            <Text style={styles.emptyText}>
              {t('home.noActiveProgram')}
            </Text>
            <TouchableOpacity
              style={styles.newProgramBtn}
              onPress={() => {
                if (clientSync?.slotId) {
                  Alert.alert(
                    '¿Crear nuevo programa?',
                    'Al crear un programa nuevo te desconectarás de tu entrenador y el programa actual será reemplazado.',
                    [
                      { text: 'Cancelar', style: 'cancel' },
                      { text: 'Continuar', style: 'destructive', onPress: () => navigate('onboarding') },
                    ],
                  );
                } else {
                  navigate('onboarding');
                }
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.newProgramBtnText}>{t('home.newProgram')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── CONEXIONES ── la otra anatomía de la MISMA lista, así que la
            pantalla acaba con un solo tipo de lista repetido dos veces. ── */}
        <View>
          <SectionHeader label={t('home.connections').toUpperCase()} dim />
          <View style={styles.group}>
            <MenuRow
              isFirst
              icon={<RowIcon><G><Path d="M12 3v12M7 10l5 5 5-5M4 20h16" /></G></RowIcon>}
              label="Drive"
              sub={driveSub}
              status={(
                <Status
                  tone={driveConnected ? 'on' : driveWarn ? 'warn' : 'off'}
                  color={driveConnected ? th.colors.green : undefined}
                  label={driveWarn ? t('home.reconnect') : driveConnected ? t('home.connected') : t('home.connect')}
                />
              )}
              onPress={() => navigation.navigate('DriveBackup')}
            />
            <MenuRow
              isLast
              icon={<RowIcon><G><Path d="M16 20v-2a4 4 0 0 0-8 0v2M12 4.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z" /></G></RowIcon>}
              label={trainerTitle}
              sub={trainerSub}
              status={(
                <Status
                  tone={trainerOk ? 'on' : trainerWarn ? 'warn' : 'off'}
                  color={trainerOk ? th.colors.blue : undefined}
                  label={trainerWarn ? t('home.pendingSync') : trainerOk ? t('home.connected') : t('home.connect')}
                />
              )}
              onPress={() => navigation.navigate('TrainerConnection')}
            />
          </View>
        </View>
      </ScrollView>

      {/* Modals */}
      {archiveOpen && (
        <ArchiveSheet
          programName={activeProgram?.name}
          onConfirm={handleArchiveConfirm}
          onClose={() => setArchiveOpen(false)}
        />
      )}
      <DocSheet visible={cycleDoc} sectionId="cycle" onClose={() => setCycleDoc(false)} />

      {/* ── Sesión libre: en blanco o desde plantilla (§7.2) ── */}
      {freeSheet && (
        <DragSheet visible onClose={() => setFreeSheet(false)} title={t('freeSession.startTitle')}>
          <View style={styles.sheetGroup}>
            <MenuRow
              isFirst
              label={t('freeSession.startBlank')}
              sub={t('freeSession.startBlankDesc')}
              subLines={0}
              minHeight={62}
              onPress={() => { setFreeSheet(false); startFree(null); }}
            />
            <MenuRow
              isLast
              label={t('freeSession.startFromTemplate')}
              sub={t('freeSession.startFromTemplateDesc')}
              subLines={0}
              minHeight={62}
              onPress={() => { setFreeSheet(false); setFreeTpls(true); }}
            />
          </View>
        </DragSheet>
      )}

      {freeTpls && (
        <DragSheet visible onClose={() => setFreeTpls(false)} title={t('freeSession.templatesTitle')}>
          <View style={styles.sheetGroup}>
            {freeSessionPresets.map((preset, i) => (
              <MenuRow
                key={preset.presetId}
                isFirst={i === 0}
                isLast={i === freeSessionPresets.length - 1}
                label={preset.name ?? t('freeSession.templateUnnamed')}
                sub={freePresetMeta(preset)}
                minHeight={62}
                onPress={() => { setFreeTpls(false); startFree(preset); }}
                // La ✕ por fila, como en el selector de presets de bloque: la
                // plantilla se borra donde se elige, que es donde estorba.
                control={(
                  <TouchableOpacity
                    onPress={() => confirmDeleteFreePreset(preset)}
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel={t('freeSession.deleteTemplate')}
                  >
                    <Text style={styles.freeTplRemove}>✕</Text>
                  </TouchableOpacity>
                )}
              />
            ))}
          </View>
        </DragSheet>
      )}
      {stagePicker && (activeProgram?.stages?.length ?? 0) > 0 && (
        <StagePickerSheet
          program={activeProgram}
          onSelect={(idx) => {
            if (idx !== (activeProgram.currentStageIndex ?? 0)) {
              setCurrentStage(activeProgram.id, idx);
            }
            setStagePicker(false);
          }}
          onClose={() => setStagePicker(false)}
        />
      )}
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const makeStyles = (th) => StyleSheet.create({

  container: {
    flex:            1,
    backgroundColor: th.colors.bg,
  },
  // Sin `gap`: cada bloque pone su propio aire (el rótulo de sección ya trae el
  // suyo, la tarjeta de programa va más separada que el resto).
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop:        spacing.sm,
    paddingBottom:     spacing.xxl * 2,
  },

  // ── Rótulos de sección ────────────────────────────────────────────────────────
  secHeader: {
    flexDirection: 'row',
    alignItems:    'baseline',
    gap:           spacing.sm,
    paddingHorizontal: spacing.xs2,
    marginTop:     spacing.lg,
    marginBottom:  spacing.sm2,
  },
  // SESIONES es el rótulo de la zona de entreno y va en `text`; los demás
  // rótulos de la pantalla se quedan en `mutedLight`.
  secHeaderLabel:    { ...textStyles.spacingTag, color: th.colors.text },
  secHeaderLabelDim: { color: th.colors.mutedLight },
  secHeaderCount: {
    fontFamily:    'Inter_600SemiBold',
    fontSize:      9,
    letterSpacing: 1.1,
    color:         th.colors.mutedLight,
    textTransform: 'uppercase',
    marginLeft:    'auto',
  },

  // ── Selector semanal (L M X J V S D + 7 puntos) ───────────────────────────────
  week: {
    gap:               spacing.md,
    paddingHorizontal: spacing.xl,
    paddingVertical:   9, // exacto de Figma, no cae en ningún token de spacing
  },
  weekLetters: { flexDirection: 'row', justifyContent: 'space-between' },
  weekLetter:  { ...textStyles.cardType, color: th.colors.mutedLight },
  weekLetterToday: { color: LIMA },
  weekDots: { flexDirection: 'row', justifyContent: 'space-between' },
  weekDot: {
    width:        12,
    height:       12,
    borderRadius: 6,
  },
  weekDotTrained: { backgroundColor: LIMA },
  weekDotIdle:    { backgroundColor: th.colors.muted },

  // ── Lista de sesiones ───────────────────────────────────────────────────
  // Los cuerpos y los huecos salen de la sesión de diseño
  // (docs/specs/home-sesiones-plegables.md §5), no de Figma: donde no hay token
  // —14, 12, 11— va el número exacto de la spec.
  //
  // Tarjetas sueltas, no una lista agrupada: cualquiera se despliega, así que
  // todas llevan su radio entero. El aire va DENTRO de la tarjeta (60 px de
  // alto) y no entre ellas: separadas y estrechas parecían una persiana, y
  // juntas y altas se leen como fichas.
  group: { gap: spacing.xs2 },

  sesCard: {
    backgroundColor: th.colors.surface,
    borderRadius:    th.radius.md,
    overflow:        'hidden',
  },
  sesHead: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               12,
    height:            60,
    paddingHorizontal: 14,
  },
  // `includeFontPadding: false` aquí y en la letra grande: es lo que deja que la
  // caja del texto valga lo que dice `lineHeight` y no lo que Android le suma
  // por su cuenta — sin eso, la letra no cae donde se la centra.
  sesGlyph: {
    ...textStyles.sessionGlyph,
    lineHeight:         22,
    includeFontPadding: false,
    width:              26,
    color:              LIMA,
  },
  sesGlyphDone: { color: th.colors.muted },
  sesName:      { ...textStyles.sessionName, flex: 1, color: th.colors.text },
  sesNameDone:  { color: th.colors.mutedLight },
  sesMeta:      { fontFamily: 'Inter_600SemiBold', fontSize: 11, color: th.colors.muted },
  rowAdapted:   { fontFamily: 'Inter_800ExtraBold', fontSize: 11, color: th.tint.blue70 },

  sesBody: { paddingHorizontal: 14, paddingTop: spacing.xs, paddingBottom: 14 },
  // La raya de la cabecera de hoy, apagada: separa sin contar nada.
  sesBodyRule: {
    height:          2,
    borderRadius:    2,
    backgroundColor: th.tint.accent50,
    marginBottom:    spacing.sm2,
  },
  // Contorno y no relleno: el lima sólido es de la que toca (§1.1).
  sesBtn: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    borderWidth:    borders.thin,
    borderColor:    th.colors.accent,
    borderRadius:   th.radius.md,
    padding:        14,
    marginTop:      12,
  },
  // 13 y no los 12 de `btnAction`: el botón es lo que hay que pulsar y a 12 se
  // quedaba por debajo del resto de la tarjeta.
  sesBtnText: { ...textStyles.btnAction, fontSize: 13, letterSpacing: 0.4, color: th.colors.accent },

  // ── La que toca hoy ─────────────────────────────────────────────────
  // La única pieza en color de la pantalla, así que dentro el acento es el
  // negro: letra, raya y series. El botón se invierte.
  today: {
    backgroundColor: th.colors.accent,
    borderRadius:    th.radius.md,
    overflow:        'hidden',
    // La de hoy respira el doble que las demás por arriba y por abajo: es la
    // pieza grande y pegada a sus vecinas se leía como parte de la misma lista.
    marginVertical:  spacing.xs2,
  },
  todayHead: {
    paddingTop:        14,
    paddingHorizontal: spacing.lg,
    paddingBottom:     11,
  },
  // `flex-end` y no `center`: la letra se apoya en la misma línea de suelo que
  // el nombre. Centrada tampoco quedaba mal, pero a media altura no está
  // alineada con nada y se lee como un descuadre.
  todayHeadRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, marginTop: spacing.sm },
  todayGlyph: {
    ...textStyles.sessionGlyphXL,
    lineHeight:         28,
    includeFontPadding: false,
    width:              26,
    color:              th.colors.onAccent,
  },
  todayFlag: {
    fontFamily:    'Inter_800ExtraBold',
    fontSize:      9,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color:         withOpacity(th.colors.onAccent, 0.55),
  },
  todayName: {
    ...textStyles.sessionNameXL,
    lineHeight: 25,
    color:      th.colors.onAccent,
    flex:       1,
  },
  todayRule: {
    height:          2,
    borderRadius:    2,
    backgroundColor: withOpacity(th.colors.onAccent, 0.85),
    marginTop:       11,
  },
  todayMeta: {
    marginTop:     spacing.md,
    fontFamily:    'Inter_700Bold',
    fontSize:      10,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color:         withOpacity(th.colors.onAccent, 0.55),
  },
  // 6 px a los lados y no 15: el lima queda de FILO, no de marco, y la tarjeta
  // se sigue leyendo como una sola pieza. El pie lleva el mismo margen.
  todayBox: {
    backgroundColor:   th.colors.bg,
    borderRadius:      th.radius.sm,
    marginHorizontal:  spacing.sm,
    paddingHorizontal: 12,
    paddingVertical:   9,
  },
  todayFoot: {
    paddingTop:        11,
    paddingHorizontal: spacing.sm,
    paddingBottom:     spacing.sm,
  },
  todayBtn: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'space-between',
    backgroundColor: th.colors.onAccent,
    borderRadius:    th.radius.md,
    padding:         spacing.lg,
  },
  todayBtnText: { ...textStyles.btnAction, fontSize: 13, letterSpacing: 0.4, color: LIMA },

  // ── Los ejercicios de la sesión desplegada ──────────────────────────────
  // Sosos a propósito: caja baja, sin filetes y sin lima. Dentro de la tarjeta
  // el acento ya lo gastan la raya y el botón; un tercero repetido siete veces
  // le quita fuerza justo a lo que hay que pulsar (§5.4).
  exRow:  { flexDirection: 'row', alignItems: 'baseline', gap: spacing.md, paddingVertical: spacing.xs2 },
  exIdx:  { fontFamily: 'Inter_600SemiBold', fontSize: 10, width: 11, color: th.colors.muted },
  exName: { fontFamily: 'Inter_500Medium', fontSize: 13, letterSpacing: 0.1, flex: 1, color: th.colors.text },
  exTarget: { fontFamily: 'Inter_600SemiBold', fontSize: 11, color: th.colors.mutedLight },


  // ── Banner de etapa terminada ─────────────────────────────────────────────────
  // Sobre `surface` y con los dos botones en outline: el relleno lima es del
  // hero, y aquí competiría con EMPEZAR.
  stageBanner: {
    backgroundColor: th.colors.surface,
    borderRadius:    th.radius.md,
    padding:         spacing.lg,
    marginBottom:    spacing.md,
  },
  stageBannerLabel: {
    ...textStyles.spacingTag,
    color:         th.colors.accent,
    textTransform: 'uppercase',
  },
  stageBannerText: {
    ...textStyles.subtitle,
    color:      th.colors.mutedLight,
    lineHeight: textStyles.subtitle.fontSize * 1.5,
    marginTop:  spacing.sm2,
  },
  // Segunda línea del caso bloqueado: lo que SÍ puede hacer mientras tanto.
  stageBannerHint: {
    ...textStyles.subtitle,
    color:      th.colors.muted,
    lineHeight: textStyles.subtitle.fontSize * 1.5,
    marginTop:  spacing.xs,
  },
  stageBannerBtns: {
    flexDirection: 'row',
    gap:           spacing.sm2,
    marginTop:     spacing.md,
  },
  stageBannerBtn: {
    flex:            1,
    paddingVertical: 11,
    borderRadius:    th.radius.md,
    borderWidth:     borders.thin,
    borderColor:     th.tint.accent50,
    alignItems:      'center',
    justifyContent:  'center',
  },
  stageBannerBtnQuiet:     { borderColor: th.colors.border },
  stageBannerBtnText: {
    fontFamily:    'Inter_900Black',
    fontSize:      11,
    letterSpacing: 1.2,
    color:         th.colors.accent,
    textAlign:     'center',
  },
  stageBannerBtnTextQuiet: { color: th.colors.mutedLight },

  // ── Bloque de programa ────────────────────────────────────────────────────────
  programBlock: { marginTop: spacing.xl },

  // ── Sesión libre ──────────────────────────────────────────────────────────────
  freeSessionBtn: {
    paddingVertical:   spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius:      th.radius.md,
    borderWidth:       0.5,
    borderColor:       th.tint.accent50,
    alignItems:        'center',
    marginTop:         spacing.md,
  },
  freeSessionBtnText: {
    ...textStyles.btnAction,
    color: th.colors.accent,
  },

  // ── Empty state ───────────────────────────────────────────────────────────────
  emptyState: {
    alignItems:      'center',
    paddingVertical: spacing.xxl * 2,
    gap:             spacing.lg,
  },
  emptyIcon: { fontSize: 40 },
  emptyText: {
    fontSize:   typography.base,
    color:      th.colors.muted,
    textAlign:  'center',
    lineHeight: typography.base * 1.7,
  },
  newProgramBtn: {
    backgroundColor:   th.colors.accent,
    borderRadius:      th.radius.md,
    paddingHorizontal: spacing.xxl,
    paddingVertical:   spacing.lg,
    marginTop:         spacing.sm,
  },
  newProgramBtnText: {
    fontSize:      typography.lg,
    fontWeight:    typography.heavy,
    color:         th.colors.bg,
    letterSpacing: 1,
  },

  // ── Hojas (DragSheet + filas de MenuList) ────────────────────────────────────
  sheetGroup:     { gap: spacing.xs, paddingBottom: spacing.sm },
  freeTplRemove:  { ...textStyles.cardType, color: th.colors.muted },
  // Ancho de un check: reserva el hueco de la derecha para que los nombres de
  // etapa terminen todos en la misma vertical, con o sin icono.
  rowControlSpacer: { width: 16 },
  sheetIntro: {
    ...textStyles.subtitle,
    color:        th.colors.mutedLight,
    lineHeight:   18,
    paddingBottom: spacing.md,
  },
  sheetIntroName: { color: th.colors.text },

});
