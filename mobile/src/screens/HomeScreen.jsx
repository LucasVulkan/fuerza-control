import { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Alert,
} from 'react-native';
import Svg, { Path, G } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import { useStore, selectActiveProgram } from '../../store/useStore';
import { stageDays, stageDaysAt } from '../utils/stageProgress';
import AppHeader from '../components/AppHeader';
import ProgramUpdateModal from '../components/ProgramUpdateModal';
import DragSheet from '../components/DragSheet';
import { MenuRow, GroupedRow, Status, RowIcon } from '../components/ui/MenuList';
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

// ── Hero ───────────────────────────────────────────────────────────────────────
//
// La sesión que toca, y el ÚNICO elemento en color de la pantalla: a partir de
// aquí `accent` significa "esto es lo siguiente" y nada más (§1.1 de la spec).
// Las completadas conservan el check lima y pierden el fondo y el borde que las
// hacían lo más llamativo de la lista.
//
// No es una tarjeta más: se EXTRAE de la lista. Las demás conservan su orden
// alfabético, así que ninguna cambia de sitio al completarse.
//
// Solo tiene tres estados —Siguiente, En curso, y no existir— y los tres los
// decide `sessionPlan`. El "ciclo cerrado" que rondó el diseño no puede darse:
// guardar la última sesión cierra el ciclo y lo vacía en la misma escritura
// (`advanceCycle`), así que al volver a la Home ya estás en el siguiente y la A
// es un hero normal. Ver §3.2.1.

function HeroChevron({ size = 13, color = LIMA }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 12 12" fill="none">
      <Path d="M4 2l4.5 4L4 10" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function Hero({ label, marker, name, meta, cta, onPress, a11yLabel }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <TouchableOpacity
      style={styles.hero}
      onPress={onPress}
      activeOpacity={0.9}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
    >
      <Text style={styles.heroFlag}>{label}</Text>
      {/* El marcador delante del nombre, no una etiqueta "SESIÓN A" arriba a la
          derecha: el tag era la pieza que menos trabajaba del hero —repetía con
          dos palabras lo que la lista dice con una letra— y sobre el lima, en
          10 px al 50%, apenas se leía. El patrón ya existe en la app: la ficha
          de "Próxima sesión" de clientes es esta misma línea (letra + nombre).
          La letra va al 55% para prefijar, no para competir con el nombre. */}
      <Text style={styles.heroName} numberOfLines={2}>
        {!!marker && <Text style={styles.heroMarker}>{`${marker} · `}</Text>}
        {name}
      </Text>
      <Text style={styles.heroMeta} numberOfLines={2}>{meta}</Text>
      {/* La pieza más pesada del hero, y así debe seguir. */}
      <View style={styles.heroBtn}>
        <Text style={styles.heroBtnText}>{cta}</Text>
        <HeroChevron />
      </View>
    </TouchableOpacity>
  );
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
          const heroDay = plan.heroTemplateId ? byId.get(plan.heroTemplateId) : null;
          const heroIsActive = !!heroDay && activeSession.templateId === heroDay.templateId;

          // Starting anything (a session card or the free session) while one is
          // already in progress used to silently discard it — now it warns first.
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

          // Starting a session out of rotation is easy to do by accident —
          // confirm before starting anything that isn't the one that toca.
          const confirmOutOfOrder = (templateId, marker) => {
            Alert.alert(
              t('home.startOutOfOrderTitle', { label: t('workout.sessionLabel', { label: marker }) }),
              t('home.startOutOfOrderDesc'),
              [
                { text: t('common.cancel'), style: 'cancel' },
                { text: t('home.btnStart'), onPress: () => startSession(templateId) },
              ],
            );
          };

          const requestStart = (templateId, isHero, marker) => {
            if (activeSession.templateId === templateId) { navigation.navigate('Workout'); return; }
            if (activeSession.templateId) { confirmDiscardActive(() => startSession(templateId)); return; }
            if (!isHero) { confirmOutOfOrder(templateId, marker); return; }
            startSession(templateId);
          };

          // Meta del hero: los dos primeros datos salen de `sessionStats`, que ya
          // existe; el tercero es cuándo fue la última vez.
          let heroMeta = '';
          if (heroDay) {
            if (heroIsActive) {
              const exs  = heroDay.template.exercises ?? [];
              const done = exs.filter((ex) => isExerciseDone(ex, activeSession.setsState?.[ex.exerciseId] ?? [])).length;
              heroMeta = t('home.heroMetaActive', {
                done, total: exs.length, ago: elapsedShort(activeSession.startedAt) ?? '',
              });
            } else {
              const stats = sessionStats(heroDay.template, allExercises);
              const rel   = relativeTime(heroDay.lastSession?.timestamp, t);
              heroMeta = [
                t('home.sessionMeta', { count: stats.exercises, minutes: stats.minutes }),
                rel ? t('home.heroMetaLast', { rel: rel.toLowerCase() }) : t('home.firstTime').toLowerCase(),
              ].join(' · ');
            }
          }

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

                {heroDay && (
                  <Hero
                    label={plan.heroLabel}
                    marker={heroDay.template.label ?? ''}
                    name={heroDay.template.name ?? ''}
                    meta={heroMeta}
                    cta={heroIsActive ? t('home.btnContinue') : t('home.btnStart')}
                    onPress={() => requestStart(heroDay.templateId, true)}
                    // La letra sola basta en pantalla, pero en voz alta no dice
                    // nada: el lector se queda con "SESIÓN C" entero.
                    a11yLabel={`${plan.heroLabel}, ${t('workout.sessionLabel', { label: heroDay.template.label ?? '' })}, ${heroDay.template.name ?? ''}, ${heroMeta}`}
                  />
                )}

                {/* Las demás, en la lista agrupada que la app ya usa en Progreso
                    y en los menús: filas sueltas con 2 px de fondo de pantalla
                    entre ellas y radios por posición. Orden fijo A→F, así que
                    ninguna cambia de sitio al completarse. */}
                <View style={[styles.group, heroDay && styles.groupAfterHero]}>
                  {plan.rows.map((row, i) => {
                    const day = byId.get(row.templateId);
                    if (!day) return null;
                    const stats = sessionStats(day.template, allExercises);
                    const rel   = relativeTime(day.lastSession?.timestamp, t);
                    const meta  = row.isDone && rel
                      ? t('home.rowDone', { rel: rel.toLowerCase(), count: stats.exercises })
                      : t('home.sessionMeta', { count: stats.exercises, minutes: stats.minutes });
                    // "Adaptada" es TEXTO al principio del subtítulo, no una
                    // pastilla: menos ruido, y el azul sigue significando
                    // entrenador.
                    const adapted = !!clientSync.pendingOverrides?.[row.templateId];
                    return (
                      <GroupedRow
                        key={row.templateId}
                        isFirst={i === 0}
                        isLast={i === plan.rows.length - 1}
                        marker={row.marker}
                        markerColor={row.isDone ? th.colors.muted : LIMA}
                        title={day.template.name ?? ''}
                        subtitle={adapted
                          ? <><Text style={styles.rowAdapted}>{t('home.adapted')}</Text>{` · ${meta}`}</>
                          : meta}
                        right={row.isDone
                          ? <CheckIcon size={16} color={LIMA} />
                          : <Text style={styles.rowChevron}>›</Text>}
                        onPress={() => requestStart(row.templateId, false, row.marker)}
                        accessibilityLabel={`${t('workout.sessionLabel', { label: row.marker })}, ${day.template.name ?? ''}, ${row.isDone ? t('home.sessionDone') : t('home.sessionPending')}`}
                      />
                    );
                  })}
                </View>

                {/* Sesión libre */}
                <TouchableOpacity
                  style={styles.freeSessionBtn}
                  onPress={() => {
                    if (activeSession.templateId === '__free__') { navigation.navigate('Workout'); return; }
                    if (activeSession.templateId) { confirmDiscardActive(startFreeSession); return; }
                    startFreeSession();
                  }}
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

  // ── Hero ─────────────────────────────────────────────────────────────────────
  // El relleno sólido `accent` (#aae216), no el lima #b8ff00 — que es el color
  // de la tinta de dentro del botón.
  hero: {
    backgroundColor: th.colors.accent,
    borderRadius:    th.radius.lg,
    padding:         spacing.lg,
  },
  heroFlag: {
    fontFamily:    'Inter_900Black',
    fontSize:      10,
    letterSpacing: 2.2,
    textTransform: 'uppercase',
    color:         th.colors.onAccent,
  },
  // 20 px: el cuerpo de `text/hero`, el mismo que el nombre del programa y el
  // número de ciclo de la tarjeta. Empezó en 27, bajó a 22 y acabó aquí — que es
  // además el token, no un tamaño intermedio inventado.
  // Marcador y separador en la MISMA tinta que el nombre: al 55% sobre el lima
  // se leía gris y apagado, que era justo lo que se venía a arreglar. El punto
  // a media altura es lo que hace de prefijo — la jerarquía la pone el orden,
  // no una tinta más floja.
  //
  // Va DENTRO del `Text` del nombre, no en una fila aparte: con dos `Text` y un
  // `gap` la separación se sumaba dos veces (el espacio tipográfico antes del
  // punto y los 8 px del gap después) y el punto quedaba flotando. Anidado,
  // separa solo la tipografía.
  heroMarker: {
    ...textStyles.hero,
    letterSpacing: 0.5,
    color:         th.colors.onAccent,
  },
  // `Inter_900Black` es el peso más alto que carga la app (App.js), así que a
  // 20 px lo único que queda para ganar cuerpo es apretar: tracking a −0.5 e
  // interlineado a 1.05 densan el bloque sin tocar el tamaño.
  heroName: {
    ...textStyles.hero,
    lineHeight:    20 * 1.05,
    letterSpacing: -0.5,
    color:         th.colors.onAccent,
    marginTop:     spacing.md,
  },
  // `space/sm` y no `md`: nombre y meta se leen como un bloque.
  heroMeta: {
    fontFamily:    'Inter_600SemiBold',
    fontSize:      12,
    lineHeight:    12 * 1.35,
    letterSpacing: 0.3,
    color:         withOpacity(th.colors.onAccent, 0.62),
    marginTop:     spacing.sm,
  },
  heroBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    backgroundColor:   th.colors.onAccent,
    borderRadius:      th.radius.md,
    paddingVertical:   15,
    paddingHorizontal: spacing.lg,
    marginTop:         spacing.lg,
  },
  heroBtnText: { ...textStyles.btnAction, color: LIMA },

  // ── Lista agrupada ───────────────────────────────────────────────────────────
  // Los 2 px de separación son fondo de pantalla, no un filete: el grupo se lee
  // como un bloque por los radios, no por una línea que no significa nada.
  group:          { gap: spacing.xs },
  groupAfterHero: { marginTop: spacing.md },
  rowChevron:     { fontSize: 18, fontWeight: '900', color: th.colors.mutedLight, marginLeft: spacing.sm },
  rowAdapted:     { color: th.tint.blue70, fontFamily: 'Inter_800ExtraBold' },

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
