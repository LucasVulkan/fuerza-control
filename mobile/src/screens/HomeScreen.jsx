import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  Modal, StyleSheet, Alert,
} from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing, interpolateColor } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import { useStore, selectActiveProgram } from '../../store/useStore';
import AppHeader from '../components/AppHeader';
import ProgramUpdateModal from '../components/ProgramUpdateModal';
import { spacing, typography, textStyles, borders, withOpacity } from '../theme';
import { useTheme, useThemedStyles } from '../useTheme';
import { formatDate } from '../../../src/utils/formatters';
import { isStageLocked } from '../../../src/utils/stageLocks';
import { LockIcon } from '../components/ui/EditorIcons';
import { getWeekStatuses } from '../utils/weekProgress';

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

/**
 * Global "week" counter = total sessions logged for this program / sessions-per-cycle.
 * "Semana" in this app = one complete rotation through the session templates.
 */
function computeWeekNum(program, workoutLog) {
  const hasStages = (program.stages?.length ?? 0) > 0;

  if (hasStages) {
    // totalWeeksCompleted is incremented on the program each time a full cycle
    // is completed, regardless of stage. Stage changes don't reset it.
    return (program.totalWeeksCompleted ?? 0) + 1;
  }

  // Non-staged programs: count completed cycles from the workoutLog.
  const allIds = new Set((program.days ?? []).map((d) => d.sessionTemplateId));
  const sessionsPerCycle = Math.max(1, program.days?.length ?? 1);
  const total = workoutLog.filter((e) => allIds.has(e.sessionTemplateId)).length;
  return Math.floor(total / sessionsPerCycle) + 1;
}

/**
 * How many DISTINCT sessions have actually been completed in the current cycle
 * (via `program.cycleCompletedIds` — which templates, not a position count),
 * and how many sessions are in one cycle.
 */
function computeCycleProgress(program) {
  const hasStages   = (program.stages?.length ?? 0) > 0;
  const stageIdx    = program.currentStageIndex ?? 0;
  const currentDays = hasStages
    ? (program.stages[stageIdx]?.days ?? [])
    : (program.days ?? []);
  const sessionsPerCycle = Math.max(1, currentDays.length);
  const doneIds          = new Set(program.cycleCompletedIds ?? []);
  const doneInCycle      = currentDays.filter((d) => doneIds.has(d.sessionTemplateId)).length;
  return { doneInCycle, sessionsPerCycle };
}

/**
 * Data for the stage card (null when there are no stages).
 */
function computeStageInfo(program, t) {
  if ((program.stages?.length ?? 0) === 0) return null;
  const stageIdx         = program.currentStageIndex ?? 0;
  const stage            = program.stages[stageIdx];
  if (!stage) return null;
  const totalWeeks       = stage.durationWeeks ?? 4;
  // A week is a closed rotation, not a session count — repeating a session must
  // not move this. See `docs/specs/stage-locks.md` §3.
  const weekInStage      = Math.min((program.stageWeeksCompleted ?? 0) + 1, totalWeeks);
  const defaultLabel     = t('home.stageDefault', { n: stageIdx + 1 });
  return {
    stageLabel:    defaultLabel,
    stageName:     stage.name ?? defaultLabel,
    weekInStage,
    totalWeeks,
  };
}

/**
 * Determines the display status of each session slot, in fixed A→F order
 * (no reorder). Completion is tracked by WHICH templates were actually done
 * this cycle (`isDoneThisCycle`, from `cycleCompletedIds`), not by position —
 * completing sessions out of order used to mark the wrong card as done
 * (a positional counter assumed strict A→B→C… order).
 *
 *   'active'  — this is the session currently in progress (even if it was
 *               already done this cycle — repeating it shows it in-progress
 *               again until saved)
 *   'done'    — its templateId is already in cycleCompletedIds
 *   'next'    — the first NOT-done session in fixed order (the "hero"),
 *               always, regardless of what else might be active out of order
 *   'pending' — every other not-done session
 */
function getSessionStatus(templateId, isHero, isDoneThisCycle, activeTemplateId) {
  if (activeTemplateId && activeTemplateId === templateId) return 'active';
  if (isDoneThisCycle) return 'done';
  return isHero ? 'next' : 'pending';
}

// ── Banner (FormaFit) ────────────────────────────────────────────────────────
//
// Bloque accent sólido — el único hero en color invertido. Dos variantes que
// comparten la fila superior (nombre de programa · nº de ciclo + puntos de
// sesión) y se distinguen por lo que va debajo:
//   · con etapas → barra segmentada de la etapa ACTUAL (1 segmento = 1 ciclo)
//   · abierta    → nada; el banner termina en la fila superior, y esa altura
//                  menor es lo que comunica que el programa no tiene techo.
// Nunca se contradicen: el relleno del segmento en curso es la misma fracción
// que marcan los puntos (ambos salen de doneInCycle/sessionsPerCycle).

// Barra de etapa: un segmento por ciclo, todos del mismo ancho, con el skew
// -18deg que es la firma diagonal del sistema.
//
// Va en SVG y no con `transform: skewX` porque en Android RN aplica los
// transforms descomponiendo la matriz en propiedades de View (rotation, scale,
// translation) y el skew, que ninguna de ellas puede representar, se pierde por
// el camino — se veía recto. En iOS sí funcionaba: distinto render, mismo
// código. Aquí los paralelogramos son geometría explícita, igual en ambos.
const SEG_H    = spacing.sm2;
const SEG_GAP  = spacing.xs2;
const SEG_SKEW = 0.3249; // tan(18°)

function StageSegBar({ ratios, trackColor, fillColor }) {
  const [width, setWidth] = useState(0);
  const segW = (width - SEG_GAP * (ratios.length - 1)) / ratios.length;
  const d    = (SEG_SKEW * SEG_H) / 2; // desplazamiento del borde superior/inferior
  const para = (x, w) => `M${x + d},0 L${x + w + d},0 L${x + w - d},${SEG_H} L${x - d},${SEG_H} Z`;
  const segX = (i) => i * (segW + SEG_GAP);

  return (
    <View style={{ height: SEG_H }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {segW > 0 && (
        <Svg width={width} height={SEG_H}>
          {ratios.map((_, i) => (
            <Path key={`t${i}`} d={para(segX(i), segW)} fill={trackColor} />
          ))}
          {ratios.map((r, i) => (r > 0
            ? <Path key={`f${i}`} d={para(segX(i), segW * Math.min(1, r))} fill={fillColor} />
            : null))}
        </Svg>
      )}
    </View>
  );
}

// Puntos de ciclo: se rellenan (onAccent) por cada sesión hecha en el ciclo.
function CycleDots({ done, total, styles }) {
  return (
    <View style={styles.bnDots}>
      {Array.from({ length: total }, (_, i) => (
        <View key={i} style={[styles.bnDot, i < done ? styles.bnDotDone : styles.bnDotIdle]} />
      ))}
    </View>
  );
}

function Banner({ programName, trainerName, stageInfo, cicloNum, doneInCycle, sessionsPerCycle, onPress }) {
  const { t }      = useTranslation();
  const th         = useTheme();
  const styles     = useThemedStyles(makeStyles);
  const cicloLabel = String(cicloNum).padStart(2, '0');
  // "ETAPA 2 · VOLUMEN"; sin nombre propio la etapa se queda en "ETAPA 2".
  const stageTitle = stageInfo && (stageInfo.stageName !== stageInfo.stageLabel
    ? `${stageInfo.stageLabel} · ${stageInfo.stageName}`
    : stageInfo.stageLabel);

  return (
    <TouchableOpacity
      style={styles.banner}
      activeOpacity={onPress ? 0.9 : 1}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={styles.bnTop}>
        <View style={styles.bnNameBlock}>
          <Text style={styles.bnEyebrow}>{t('home.program')}</Text>
          <Text style={styles.bnProgName} numberOfLines={1}>{programName}</Text>
          {trainerName ? (
            <Text style={styles.bnTrainer} numberOfLines={1}>
              {t('home.bannerBy')} <Text style={styles.bnTrainerName}>{trainerName}</Text>
            </Text>
          ) : null}
        </View>

        <View style={styles.bnCycle}>
          <Text style={styles.bnEyebrow}>{t('home.cycle')}</Text>
          <Text style={styles.bnCicloNum}>{cicloLabel}</Text>
          <CycleDots done={doneInCycle} total={sessionsPerCycle} styles={styles} />
        </View>
      </View>

      {stageInfo && (
        <View style={styles.bnStage}>
          <View style={styles.bnStageLabels}>
            <Text style={styles.bnStageName} numberOfLines={1}>{stageTitle}</Text>
            <Text style={styles.bnStagePos}>
              {t('home.cycleProgress', { current: stageInfo.weekInStage, total: stageInfo.totalWeeks })}
            </Text>
          </View>
          {/* Un segmento por ciclo de la etapa: pasados al 100%, el actual a la
              fracción de sesiones hechas, los futuros vacíos. */}
          <StageSegBar
            ratios={Array.from({ length: stageInfo.totalWeeks }, (_, i) => (
              i < stageInfo.weekInStage - 1 ? 1
                : i === stageInfo.weekInStage - 1 ? doneInCycle / sessionsPerCycle
                : 0
            ))}
            trackColor={withOpacity(th.colors.onAccent, 0.16)}
            fillColor={th.colors.onAccent}
          />
        </View>
      )}
    </TouchableOpacity>
  );
}

// ── Weekly selector (L M X J V S D + 7 dots) ────────────────────────────────────
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

// ── Session cards ──────────────────────────────────────────────────────────────

function sessionA11yLabel(t, template, statusLabel) {
  return `${t('workout.sessionLabel', { label: template?.label ?? '' })}, ${template?.name ?? ''}, ${statusLabel}`;
}

/**
 * Sesion Card (Figma 104:74–78, coordenadas exactas verificadas vía get_metadata
 * sobre las instancias reales dentro de HomeView, no sobre el componente aislado):
 * card 363×81, texto a x=20/y=15 (space/xl · space/lg), zona de acción siempre con
 * el borde derecho en el mismo punto (343 de 363 = padding-right space/xl) sea cual
 * sea su contenido — check/chevron en caja 26×26, botón EMPEZAR/CONTINUAR 99×35.
 *
 * Orden fijo A→F, sin reorder. 3 tratamientos: 'done' (check + fondo/borde tinte
 * accent), 'active'/'next' (botón, mismo look), 'pending' (chevron, futura). El
 * cruce hacia/desde 'done' hace crossfade de fondo/borde/icono; el resto de
 * cambios de estado no animan.
 *
 * La animación de completar sesión se dispara al VOLVER (no con el cambio de
 * status en sí) porque este stack no usa enableFreeze — Home sigue re-renderizando
 * detrás de Workout/Recap, así que el status ya llega en 'done' desde antes de que
 * el usuario vuelva. Un efecto aparte hace la mutación real del shared value
 * leyendo `isDone` desde un ref siempre actualizado.
 *
 * CLAVE (raíz del bug anterior): el crossfade NO debe arrancar en el foco en sí.
 * El evento de foco se dispara al INICIO de la transición nativa del stack; un
 * crossfade de 300ms lanzado ahí se consume entero mientras Home todavía entra
 * deslizándose, y el usuario lo ve "ya completado". `InteractionManager.
 * runAfterInteractions` NO espera a las transiciones de native-stack (son nativas,
 * no crean handles JS), así que disparaba casi al instante — por eso fallaba.
 * Aquí esperamos al `transitionEnd` real del stack padre (Home ya asentada y
 * visible) para arrancar; un setTimeout es la red de seguridad por si ese evento
 * no llegara en alguna versión de react-native-screens.
 */
function SessionCard({ template, lastSession, status, onPress, hasOverride, doneThisCycle = false }) {
  const { t }      = useTranslation();
  const th         = useTheme();
  const styles     = useThemedStyles(makeStyles);
  const navigation = useNavigation();

  const isDone = status === 'done';
  // Repetir una sesión que ya contaba como hecha este ciclo la muestra como
  // 'active', lo que TAPABA su estado real: al empezar otra sesión, esta volvía
  // a "aparecer" completada de golpe y se leía como si la hubiéramos completado
  // sola. Ahora el fondo de completada se mantiene durante la repetición (ya
  // estaba hecha, y sigue estándolo) y solo cambia la acción: check ↔ Continuar.
  const showDoneChrome = isDone || (status === 'active' && doneThisCycle);
  // Última variante no-"done" — se congela al llegar a 'done' para que el
  // botón/chevron que se desvanece en el crossfade no cambie a mitad de camino.
  const [variant, setVariant] = useState(isDone ? 'next' : status);
  if (!isDone && variant !== status) setVariant(status);
  const isCta = variant === 'active' || variant === 'next';

  // Dos drivers, porque ya no van siempre juntos: `chromeAnim` es el fondo/borde
  // de completada y `actionAnim` el crossfade check ↔ botón.
  const chromeAnim = useSharedValue(showDoneChrome ? 1 : 0);
  const actionAnim = useSharedValue(isDone ? 1 : 0);

  const [settleTick, setSettleTick] = useState(0);
  const focusedBefore               = useRef(false);
  const isFocusedRef                = useRef(false);
  useFocusEffect(
    useCallback(() => {
      isFocusedRef.current = true;
      if (!focusedBefore.current) {
        focusedBefore.current = true;
        return () => { isFocusedRef.current = false; };
      }
      // Arranca el crossfade solo cuando la transición del stack ha terminado y
      // Home está asentada y visible — así el usuario ve la animación entera.
      let fired = false;
      const settle = () => { if (!fired) { fired = true; setSettleTick((n) => n + 1); } };
      const unsub  = navigation.getParent()?.addListener('transitionEnd', settle);
      // ponytail: red de seguridad — si transitionEnd no llega, anima igual.
      // Sube el valor si algún device transiciona más lento que esto.
      const timer  = setTimeout(settle, 500);
      return () => { isFocusedRef.current = false; unsub?.(); clearTimeout(timer); };
    }, [navigation]),
  );
  // Dispara con DOS entradas: el settle al volver a Home y cualquier cambio de
  // `isDone` con Home ya a la vista (empezar otra sesión desde aquí desenmascara
  // el 'done' de la que estaba en curso, sin que medie navegación alguna).
  //
  // Sin la segunda, ese caso no tenía focus al que engancharse y la tarjeta se
  // quedaba a medias — fondo y botón del estado viejo, contenido del nuevo —
  // hasta la siguiente vuelta a Home.
  //
  // El guard de foco es lo que preserva la intención original: un cambio que
  // ocurre con Home en segundo plano (guardar la sesión) NO se anima ahí, se
  // deja para el settle, y así el crossfade se ve entero al volver.
  const mountedRef = useRef(false);
  useEffect(() => {
    if (!mountedRef.current) { mountedRef.current = true; return; } // ya arrancaron en su valor
    if (!isFocusedRef.current) return;
    const cfg = { duration: 300, easing: Easing.inOut(Easing.ease) };
    chromeAnim.value = withTiming(showDoneChrome ? 1 : 0, cfg);
    actionAnim.value = withTiming(isDone ? 1 : 0, cfg);
  }, [settleTick, isDone, showDoneChrome, chromeAnim, actionAnim]);

  const cardAnimStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(chromeAnim.value, [0, 1], [th.colors.surface, th.tint.accent10]),
    borderColor:     interpolateColor(chromeAnim.value, [0, 1], ['transparent', th.tint.accent50]),
  }));
  // El elemento "actual" (según el status en vivo) se desvanece hacia dentro;
  // el "saliente" (congelado en `variant`) se desvanece hacia fuera — comparten
  // el mismo borde derecho porque sesRightOverlay se ancla con right:0.
  const currentAnimStyle  = useAnimatedStyle(() => ({ opacity: isDone ? actionAnim.value : 1 - actionAnim.value }));
  const outgoingAnimStyle = useAnimatedStyle(() => ({ opacity: isDone ? 1 - actionAnim.value : actionAnim.value }));

  const rel = relativeTime(lastSession?.timestamp, t);
  // El prefijo "Completada" solo aplica a hoy/ayer — a partir de "hace N días"
  // el texto va solo (pedido explícito, aunque el fragmento de tiempo siga en accent).
  const isRecent = [0, 1].includes(daysSince(lastSession?.timestamp));
  const statusLabel = isDone ? t('home.sessionDone') : isCta
    ? (variant === 'active' ? t('home.sessionActive') : t('home.sessionNext'))
    : t('home.sessionPending');

  const actionContent = (kind) => {
    if (kind === 'done') {
      return <View style={styles.sesActionBox}><CheckIcon size={24} color={LIMA} /></View>;
    }
    if (kind === 'cta') {
      return (
        <View style={styles.sesBtn}>
          <Text style={styles.sesBtnText}>
            {variant === 'active' ? t('home.btnContinue') : t('home.btnStart')}
          </Text>
          <FutureChevronIcon size={11} color={th.colors.onAccent} />
        </View>
      );
    }
    return <View style={styles.sesActionBox}><FutureChevronIcon size={18} /></View>;
  };

  const currentKind  = isDone ? 'done' : (isCta ? 'cta' : 'pending');
  const outgoingKind = isDone ? (isCta ? 'cta' : 'pending') : 'done';

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={sessionA11yLabel(t, template, statusLabel)}
    >
      <Animated.View style={[styles.sesCard, cardAnimStyle]}>
        <View style={styles.sesInfo}>
          <View style={styles.sesTagRow}>
            <Text style={styles.sesTag}>
              {t('workout.sessionLabel', { label: template?.label ?? '' }).toUpperCase()}
            </Text>
            {hasOverride && (
              <View style={styles.adaptedChip}><Text style={styles.adaptedChipText}>{t('home.adapted')}</Text></View>
            )}
          </View>
          {/* título + subtítulo van pegados, gap 0 en Figma — el gap.sm entre el
              tag y este bloque vive en sesInfo, no aquí dentro */}
          <View>
            <Text style={styles.sesTitle} numberOfLines={1}>{template?.name ?? ''}</Text>
            <Text style={styles.sesSubtitle} numberOfLines={1}>
              {rel ? (
                isRecent ? (
                  <>
                    {`${t('home.sessionDone')} `}
                    <Text style={{ color: th.colors.accent }}>{rel.toLowerCase()}</Text>
                  </>
                ) : (
                  <Text style={{ color: th.colors.accent }}>{rel}</Text>
                )
              ) : t('home.firstTime')}
            </Text>
          </View>
        </View>
        <View style={styles.sesRight}>
          <Animated.View style={currentAnimStyle}>{actionContent(currentKind)}</Animated.View>
          <Animated.View style={[styles.sesRightOverlay, outgoingAnimStyle]} pointerEvents="none">
            {actionContent(outgoingKind)}
          </Animated.View>
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
}

// ── ArchiveModal ───────────────────────────────────────────────────────────────

function ArchiveModal({ programName, onConfirm, onClose }) {
  const { t }    = useTranslation();
  const th       = useTheme();
  const styles   = useThemedStyles(makeStyles);
  const insets   = useSafeAreaInsets();
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={[styles.bottomSheet, { paddingBottom: Math.max(spacing.xxl, insets.bottom + spacing.lg) }]}>
        <Text style={styles.sheetTitle}>{t('home.archiveModal.title')}</Text>
        <Text style={styles.archiveDesc}>
          <Text style={{ color: th.colors.text, fontWeight: typography.semibold }}>{programName}</Text>
          {'\n'}{t('home.archiveModal.desc')}
        </Text>
        <ArchiveOption
          label={t('home.archiveModal.keepHistory')}
          desc={t('home.archiveModal.keepHistoryDesc')}
          onPress={() => onConfirm(false)}
        />
        <ArchiveOption
          label={t('home.archiveModal.clearHistory')}
          desc={t('home.archiveModal.clearHistoryDesc')}
          onPress={() => onConfirm(true)}
          danger
        />
        <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
          <Text style={styles.cancelBtnText}>{t('common.cancel')}</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

function ArchiveOption({ label, desc, onPress, danger }) {
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <TouchableOpacity
      style={[styles.archiveOption, danger && styles.archiveOptionDanger]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Text style={[styles.archiveOptionLabel, danger && { color: th.colors.red }]}>{label}</Text>
      <Text style={styles.archiveOptionDesc}>{desc}</Text>
    </TouchableOpacity>
  );
}

// ── StagePickerModal ───────────────────────────────────────────────────────────

function StagePickerModal({ program, onSelect, onClose }) {
  const { t }      = useTranslation();
  const th         = useTheme();
  const styles     = useThemedStyles(makeStyles);
  const insets     = useSafeAreaInsets();
  const clientSync = useStore((s) => s.clientSync);
  const currentIdx = program.currentStageIndex ?? 0;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={[styles.bottomSheet, { paddingBottom: Math.max(spacing.xxl, insets.bottom + spacing.lg) }]}>
        <Text style={styles.sheetTitle}>{t('home.selectStage')}</Text>
        <View style={styles.stageList}>
          {program.stages.map((stage, idx) => {
            const isActive = idx === currentIdx;
            const locked   = isStageLocked(program, idx, clientSync);
            return (
              <TouchableOpacity
                key={stage.id ?? idx}
                style={[
                  styles.stageOption,
                  isActive && styles.stageOptionActive,
                  locked   && styles.stageOptionLocked,
                ]}
                onPress={() => onSelect(idx)}
                disabled={locked}
                activeOpacity={isActive ? 1 : 0.7}
              >
                <View style={styles.stageOptionHeader}>
                  {locked && <LockIcon size={13} color={th.colors.muted} />}
                  <Text style={[
                    styles.stageOptionName,
                    isActive && styles.stageOptionNameActive,
                    locked   && styles.stageOptionNameLocked,
                  ]}>
                    {stage.name}
                  </Text>
                  {isActive && <Text style={styles.stageActiveLabel}>ACTIVA</Text>}
                </View>
                <Text style={styles.stageOptionDesc}>
                  {locked
                    ? t('home.stageLockedShort')
                    : `${stage.durationWeeks ?? 4} sem · ${stage.days?.length ?? 0} sesiones/ciclo`}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
          <Text style={styles.cancelBtnText}>{t('common.cancel')}</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

// ── ProgramBtn ─────────────────────────────────────────────────────────────────

function ProgramBtn({ label, onPress, icon }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <TouchableOpacity
      style={styles.programBtn}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
    >
      {icon}
      <Text style={styles.programBtnText}>{label}</Text>
    </TouchableOpacity>
  );
}

// ── Status card icons ─────────────────────────────────────────────────────────

function CheckIcon({ size = 16, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M20 6L9 17l-5-5" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// Flecha rellena de sesión futura (Figma, asset Rectangle57) — forma sólida,
// gris literal #d9d9d9 sin token.
function FutureChevronIcon({ size = 18, color = '#d9d9d9' }) {
  return (
    <Svg width={size * 0.6} height={size} viewBox="0 0 12 20" fill="none">
      <Path d="M0 0L5 0L12 10L5 20L0 20L7 10L0 0Z" fill={color} />
    </Svg>
  );
}

// ── Section header ──────────────────────────────────────────────────────────────
// Las 3 etiquetas (SESIONES/PROGRAMA/CONEXIONES) comparten el mismo estilo,
// exacto a Figma (text/spacing-tag, mutedLight).

function SectionHeader({ label }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.secHeader}>
      <Text style={styles.secHeaderLabel}>{label}</Text>
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

  const activeProgram        = useStore(selectActiveProgram);
  const activeSession        = useStore((s) => s.activeSession);
  const workoutLog           = useStore((s) => s.workoutLog);
  // Subscribed only so template/program edits re-render this screen
  // eslint-disable-next-line no-unused-vars
  const sessionTemplates     = useStore((s) => s.sessionTemplates);
  // eslint-disable-next-line no-unused-vars
  const userPrograms         = useStore((s) => s.userPrograms);
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

  function handleArchiveConfirm(clearHistory) {
    if (activeProgram) archiveProgram(activeProgram.id, clearHistory);
    setArchiveOpen(false);
  }

  // ── Status cards data ────────────────────────────────────────────────────────
  const driveConnected  = driveBackup.enabled && !driveBackup.needsReconnect;
  const driveWarn       = driveBackup.enabled && driveBackup.needsReconnect;
  const driveIconColor  = driveWarn ? th.colors.orange : driveConnected ? th.colors.green : th.colors.muted;
  const driveSub        = driveWarn
    ? t('home.reconnect')
    : driveConnected
      ? (driveBackup.lastBackup ? formatBackupTime(driveBackup.lastBackup) : t('home.connected'))
      : t('home.notConnected');

  const trainerOk        = !!clientSync.slotId && !clientSync.syncErrorAt && !clientSync.pendingUpload;
  const trainerWarn      = !!clientSync.slotId && (!!clientSync.syncErrorAt || clientSync.pendingUpload);
  const trainerIconColor = trainerWarn ? th.colors.orange : trainerOk ? th.colors.blue : th.colors.muted;
  const trainerTitle     = (trainerOk || trainerWarn)
    ? (clientSync.trainerName ?? t('home.trainer'))
    : t('home.trainer');
  const trainerSub       = trainerWarn
    ? t('home.pendingSync')
    : trainerOk ? t('home.connected') : t('home.notConnected');

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <AppHeader />
      <ProgramUpdateModal />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {activeProgram ? (() => {
          const hasStages   = (activeProgram.stages?.length ?? 0) > 0;
          const stageIdx    = activeProgram.currentStageIndex ?? 0;
          const currentStage = hasStages ? activeProgram.stages[stageIdx] : null;
          const nextStage    = hasStages ? activeProgram.stages[stageIdx + 1] : null;
          const nextStageLocked = isStageLocked(activeProgram, stageIdx + 1, clientSync);

          // Computed values for progress header
          const stageInfo                  = computeStageInfo(activeProgram, t);
          const weekNum                    = computeWeekNum(activeProgram, workoutLog);
          const { doneInCycle, sessionsPerCycle } = computeCycleProgress(activeProgram);

          // Current session templates in cycle order (handles both flat and staged programs)
          const currentDays = hasStages
            ? (activeProgram.stages[stageIdx]?.days ?? [])
            : (activeProgram.days ?? []);

          // Trainer name — from the first session template that has one ("by …").
          const programTrainerName = currentDays
            .map((d) => getEffectiveTemplate(d.sessionTemplateId)?.trainerName)
            .find(Boolean) ?? null;

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

          return (
            <>
              {/* Banner: programa · etapa · progreso · semana/sesiones.
                  Mantener pulsado abre el selector de etapa (sustituye al ··· ). */}
              <Banner
                programName={activeProgram.name}
                trainerName={programTrainerName}
                stageInfo={stageInfo}
                cicloNum={weekNum}
                doneInCycle={doneInCycle}
                sessionsPerCycle={sessionsPerCycle}
                onPress={hasStages ? () => setStagePicker(true) : undefined}
              />

              <WeekSelector workoutLog={workoutLog} />

              {/* Stage advance banner. Con la siguiente etapa bloqueada el
                  cliente no se queda sin nada que hacer: sigue en la actual
                  (decisión de producto, spec §0.1), así que el banner solo
                  cambia de mensaje — no aparece ningún botón que no funcione. */}
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
                          style={styles.stageBannerContinueBtn}
                          onPress={() => dismissStageAdvance(activeProgram.id)}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.stageBannerContinueBtnText}>{t('home.understood')}</Text>
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
                          style={styles.stageBannerAdvanceBtn}
                          onPress={() => advanceStage(activeProgram.id)}
                          activeOpacity={0.85}
                        >
                          <Text style={styles.stageBannerAdvanceBtnText}>
                            {t('home.advanceTo', { name: (nextStage.name ?? '').toUpperCase() })}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.stageBannerContinueBtn}
                          onPress={() => dismissStageAdvance(activeProgram.id)}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.stageBannerContinueBtnText}>{t('home.close').toUpperCase()}</Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  )}
                </View>
              )}

              {/* ── SESIONES ── orden fijo A→F, sin reorder (ver SessionCard) */}
              <View style={styles.section}>
                <SectionHeader label={t('home.sessions').toUpperCase()} />
                {(() => {
                  const doneIds  = new Set(activeProgram.cycleCompletedIds ?? []);
                  const rawDays  = currentDays
                    .map(({ sessionTemplateId }) => ({
                      templateId:  sessionTemplateId,
                      template:    getEffectiveTemplate(sessionTemplateId),
                      lastSession: getLastSession(sessionTemplateId),
                      isDone:      doneIds.has(sessionTemplateId),
                    }))
                    .filter((d) => d.template);
                  // La "hero" es siempre la primera sesión SIN completar en orden
                  // fijo, sin importar qué otra esté activa fuera de orden.
                  const heroIdx = rawDays.findIndex((d) => !d.isDone);
                  const days = rawDays.map((d, i) => ({
                    ...d,
                    status: getSessionStatus(d.templateId, i === heroIdx, d.isDone, activeSession?.templateId),
                  }));

                  // Starting a session out of rotation is easy to do by accident —
                  // confirm before starting anything that isn't the "next" slot.
                  const confirmOutOfOrder = (d) => {
                    Alert.alert(
                      t('home.startOutOfOrderTitle', {
                        label: t('workout.sessionLabel', { label: d.template.label ?? '' }),
                      }),
                      t('home.startOutOfOrderDesc'),
                      [
                        { text: t('common.cancel'), style: 'cancel' },
                        { text: t('home.btnStart'), onPress: () => startSession(d.templateId) },
                      ],
                    );
                  };

                  const requestStart = (d) => {
                    if (d.status === 'active') { navigation.navigate('Workout'); return; }
                    if (activeSession.templateId && activeSession.templateId !== d.templateId) {
                      confirmDiscardActive(() => startSession(d.templateId));
                      return;
                    }
                    if (d.status !== 'next') { confirmOutOfOrder(d); return; }
                    startSession(d.templateId);
                  };

                  return (
                    <View style={styles.sesList}>
                      {days.map((d) => (
                        <SessionCard
                          key={d.templateId}
                          template={d.template}
                          lastSession={d.lastSession}
                          status={d.status}
                          doneThisCycle={d.isDone}
                          hasOverride={!!clientSync.pendingOverrides?.[d.templateId]}
                          onPress={() => requestStart(d)}
                        />
                      ))}
                    </View>
                  );
                })()}

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

              {/* ── PROGRAMA ── */}
              <View style={styles.section}>
                <SectionHeader label={t('home.program').toUpperCase()} />
                <View style={styles.programActions}>
                  <ProgramBtn
                    label={t('home.edit')}
                    onPress={() => navigate('programEditor')}
                  />
                  <ProgramBtn
                    label={t('home.viewProgram')}
                    onPress={() => navigate('programPrint')}
                  />
                  <TouchableOpacity
                    style={styles.programBtnMore}
                    onPress={() => setArchiveOpen(true)}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={t('home.moreOptions')}
                  >
                    <Text style={styles.programBtnMoreText}>···</Text>
                  </TouchableOpacity>
                </View>
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

        {/* ── CONEXIONES (Drive + Entrenador) — solo destacan si necesitan atención ── */}
        <View style={styles.section}>
        <SectionHeader label={t('home.connections').toUpperCase()} />
        <View style={styles.statusCards}>

          {/* Drive */}
          <TouchableOpacity
            style={[styles.statusCard, driveWarn && styles.statusCardWarn]}
            onPress={() => navigation.navigate('DriveBackup')}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel={`Drive, ${driveSub}`}
          >
            <View style={[styles.statusDot, { backgroundColor: driveIconColor }]} />
            <View style={styles.statusInfo}>
              <Text style={styles.statusTitle} numberOfLines={1}>Drive</Text>
              <Text style={[styles.statusSub, driveWarn && { color: th.colors.orange }]} numberOfLines={1}>
                {driveSub}
              </Text>
            </View>
            <Text style={[styles.statusConnectBtn, driveConnected && styles.statusConnectBtnOk]}>
              {(driveConnected ? t('home.connected') : t('home.connect')).toUpperCase()}
            </Text>
          </TouchableOpacity>

          {/* Entrenador */}
          <TouchableOpacity
            style={[styles.statusCard, trainerWarn && styles.statusCardWarn]}
            onPress={() => navigation.navigate('TrainerConnection')}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel={`${trainerTitle}, ${trainerSub}`}
          >
            <View style={[styles.statusDot, { backgroundColor: trainerIconColor }]} />
            <View style={styles.statusInfo}>
              <Text style={styles.statusTitle} numberOfLines={1}>{trainerTitle}</Text>
              <Text style={[styles.statusSub, trainerWarn && { color: th.colors.orange }]} numberOfLines={1}>
                {trainerSub}
              </Text>
            </View>
            <Text style={[styles.statusConnectBtn, trainerOk && styles.statusConnectBtnOk]}>
              {(trainerOk ? t('home.connected') : t('home.connect')).toUpperCase()}
            </Text>
          </TouchableOpacity>

        </View>
        </View>
      </ScrollView>

      {/* Modals */}
      {archiveOpen && (
        <ArchiveModal
          programName={activeProgram?.name}
          onConfirm={handleArchiveConfirm}
          onClose={() => setArchiveOpen(false)}
        />
      )}
      {stagePicker && (activeProgram?.stages?.length ?? 0) > 0 && (
        <StagePickerModal
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
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop:    spacing.xl,
    paddingBottom: spacing.xxl * 2,
    gap:           spacing.lg,
  },

  // ── Section structure (Sesiones / Programa / Conexiones) ──────────────────────
  section: {
    gap: spacing.sm,
  },
  secHeader: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           6,
  },
  secHeaderLabel: {
    ...textStyles.spacingTag,
    color: th.colors.mutedLight,
  },

  // ── Banner (FormaFit) — bloque accent, tinta onAccent ─────────────────────────
  // Sobre el accent el texto usa su propia escala de tinta: sólido para lo
  // principal, 0.55 para eyebrows/secundario, 0.16 para los tracks.
  banner: {
    backgroundColor: th.colors.accent,
    borderRadius:    th.radius.lg,
    padding:         spacing.lg,
  },
  bnTop:       { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  bnEyebrow:   { ...textStyles.spacingTag, color: withOpacity(th.colors.onAccent, 0.55), textTransform: 'uppercase' },
  // Nombre de programa a 1 línea; el completo vive en el detalle del programa.
  // El line-height de Inter deja aire de sobra bajo el eyebrow: los márgenes
  // negativos pegan nombre y número a su etiqueta.
  bnNameBlock:   { flex: 1, minWidth: 0 },
  bnProgName:    { ...textStyles.hero, color: th.colors.onAccent, marginTop: -spacing.xs },
  bnTrainer:     { ...textStyles.subtitle, color: withOpacity(th.colors.onAccent, 0.55), marginTop: spacing.xs },
  bnTrainerName: { ...textStyles.btnAction, color: th.colors.onAccent },
  bnCycle:       { flexShrink: 0, alignItems: 'flex-end' },
  bnCicloNum:    { ...textStyles.hero, color: th.colors.onAccent, marginTop: -spacing.xs, fontVariant: ['tabular-nums'] },
  // Puntos de sesión del ciclo: hechos = tinta sólida; pendientes = track.
  bnDots:    { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, marginTop: spacing.sm2 },
  bnDot:     { width: 7, height: 7, borderRadius: 3.5 },
  bnDotDone: { backgroundColor: th.colors.onAccent },
  bnDotIdle: { backgroundColor: withOpacity(th.colors.onAccent, 0.16) },
  // Barra de la etapa actual (solo variante con etapas).
  bnStage:       { marginTop: spacing.lg },
  bnStageLabels: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm2, marginBottom: spacing.sm },
  bnStageName:   { ...textStyles.spacingTag, color: th.colors.onAccent, textTransform: 'uppercase', flexShrink: 1 },
  bnStagePos:    { ...textStyles.smallBold, color: withOpacity(th.colors.onAccent, 0.55), marginLeft: 'auto' },
  // (la barra segmentada se dibuja en SVG — ver StageSegBar)

  // ── Selector semanal (L M X J V S D + 7 puntos) ───────────────────────────────
  week: {
    gap:               spacing.md,
    paddingHorizontal: spacing.xl,
    paddingVertical:   9, // exacto de Figma, no cae en ningún token de spacing
    marginTop:         -spacing.sm, // acerca el selector al banner (ScrollView ya mete gap/lg)
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

  // ── Program label ────────────────────────────────────────────────────────────
  progHeader: {
    flexDirection: 'row',
    alignItems:    'flex-start',
    gap:           spacing.sm,
  },
  progLabel: {
    fontSize:      typography.sm,
    fontWeight:    typography.bold,
    letterSpacing: 2,
    color:         th.colors.muted2,
    textTransform: 'uppercase',
    paddingLeft:   2,
  },
  progTrainer: {
    fontSize:  typography.xs,
    color:     th.colors.muted2,
    marginTop: 1,
    paddingLeft: 2,
  },
  progTrainerInline: {
    fontSize:      typography.xs,
    color:         th.colors.muted2,
    fontWeight:    typography.regular,
    letterSpacing: 0,
    textTransform: 'none',
  },
  progDriveBlock: {
    alignItems: 'flex-end',
    marginTop:  2,
    gap:        1,
  },
  progDriveIcon: {
    fontSize:  13,
    color:     th.colors.green,
    opacity:   0.8,
  },
  progDriveTime: {
    fontSize:      typography.xs - 1,
    color:         th.colors.green,
    opacity:       0.7,
    textAlign:     'right',
  },

  // ── Progress header ──────────────────────────────────────────────────────────
  progressHeader: {
    flexDirection: 'row',
    gap:           8,
  },
  phCard: {
    backgroundColor: th.colors.surface2,
    borderWidth:     borders.thin,
    borderColor:     th.colors.border,
    borderRadius:    th.radius.md,
  },

  // Stage card (left, wider)
  phStage: {
    flex:    1.6,
    padding: spacing.md,
  },
  phStageRow1: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'flex-start',
    marginBottom:   3,
  },
  phStageLabel: {
    fontSize:      11,
    fontWeight:    typography.semibold,
    color:         th.colors.muted,
    letterSpacing: 0.2,
  },
  phStageMenu: {
    fontSize:      16,
    color:         th.colors.muted,
    lineHeight:    16,
    letterSpacing: 1,
  },
  phStageName: {
    fontSize:     15,
    fontWeight:   typography.bold,
    color:        th.colors.text,
    lineHeight:   15 * 1.2,
    marginBottom: 3,
  },
  phStageWeek: {
    fontSize:     11,
    fontWeight:   typography.regular,
    color:        th.colors.mutedLight,
    marginBottom: spacing.sm,
  },
  phBar: {
    height:          4,
    backgroundColor: th.colors.border,
    borderRadius:    2,
    overflow:        'hidden',
  },
  phBarFill: {
    height:          '100%',
    backgroundColor: th.colors.accent,
    borderRadius:    2,
  },

  // Week card (right, squarish)
  phWeekSq: {
    flex:           1,
    padding:        11,
    alignItems:     'center',
    justifyContent: 'space-between',
  },
  phWkTop: {
    fontSize:      11,
    fontWeight:    typography.semibold,
    color:         th.colors.muted,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  phWkNum: {
    fontSize:      22,
    fontWeight:    typography.bold,
    color:         th.colors.text,
    lineHeight:    22,
    letterSpacing: -0.5,
  },
  phWeekBottom: {
    alignItems: 'center',
    gap:        4,
  },
  phWkSes: {
    fontSize:   11,
    fontWeight: typography.regular,
    color:      th.colors.mutedLight,
    textAlign:  'center',
  },
  phDots: {
    flexDirection:  'row',
    gap:            5,
    alignItems:     'center',
    justifyContent: 'center',
  },
  phDot: {
    width:        8,
    height:       8,
    borderRadius: 4,
  },
  phDotDone: {
    backgroundColor: th.colors.accent,
  },
  phDotPending: {
    backgroundColor: withOpacity(th.colors.accent, 0.15),
    borderWidth:     1.5,
    borderColor:     withOpacity(th.colors.accent, 0.5),
  },
  phDotIdle: {
    backgroundColor: th.colors.border,
  },

  // Week pill (no stages, full width)
  phPill: {
    flex:           1,
    height:         54,
    flexDirection:  'row',
    alignItems:     'center',
    paddingHorizontal: spacing.lg,
  },
  phPillLeft: {
    flex:          1,
    flexDirection: 'row',
    alignItems:    'center',
    gap:           7,
  },
  phPillLabel: {
    fontSize:      11,
    fontWeight:    typography.semibold,
    color:         th.colors.muted,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  phPillNum: {
    fontSize:      22,
    fontWeight:    typography.bold,
    color:         th.colors.text,
    letterSpacing: -0.5,
    lineHeight:    22,
  },
  phPillDivider: {
    width:           1,
    height:          26,
    backgroundColor: th.colors.border,
    marginRight:     spacing.lg,
  },
  phPillRight: {
    alignItems: 'center',
    gap:        4,
  },

  // ── Session cards ─────────────────────────────────────────────────────────────
  sesList: {
    gap: spacing.md,
  },
  sesCard: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    borderWidth:       borders.thin,
    borderRadius:      th.radius.md,
    paddingHorizontal: spacing.xl,
    paddingVertical:   spacing.sm2, // Figma pide space/lg(15); en el dispositivo se veía con demasiado aire
  },
  sesInfo: {
    flex:     1,
    minWidth: 0,
    gap:      spacing.sm, // gap tag ⟷ bloque título+subtítulo (space/sm, Figma)
  },
  sesTagRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.sm,
  },
  sesTag: {
    ...textStyles.spacingTag,
    color: LIMA,
  },
  sesTitle: {
    ...textStyles.cardTitle,
    color: th.colors.text,
  },
  sesSubtitle: {
    ...textStyles.subtitle,
    color:     th.colors.mutedLight,
    marginTop: -3, // el line-height de la fuente deja aire de más entre título y subtítulo
  },
  // Sin ancho fijo: se ajusta al contenido "actual" (check/botón/chevron). El que
  // se desvanece va en sesRightOverlay, absolute + right:0, así el borde derecho
  // de la zona de acción no se mueve durante el fade (los 3 estados comparten el
  // mismo borde derecho en Figma: x+w=343 de 363).
  sesRight: {
    position: 'relative',
  },
  sesRightOverlay: {
    position:       'absolute',
    top: 0, right: 0, bottom: 0,
    justifyContent: 'center',
  },
  // Caja del check / del chevron futuro — icon-box de Figma (26×26).
  sesActionBox: {
    width:          26,
    height:         26,
    alignItems:     'center',
    justifyContent: 'center',
  },
  sesBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'center',
    gap:               spacing.sm,
    backgroundColor:   LIMA,
    borderRadius:      th.radius.md,
    paddingHorizontal: spacing.md, // Figma pide space/sm(6); en el dispositivo se veía apretado
    paddingVertical:   spacing.md,
  },
  sesBtnText: {
    ...textStyles.btnAction,
    color: th.colors.onAccent,
  },
  secLabel: {
    fontSize:      11,
    fontWeight:    typography.semibold,
    letterSpacing: 1,
    color:         th.colors.mutedLight,
    paddingLeft:   2,
    marginBottom:  1,
  },

  adaptedChip: {
    backgroundColor:   withOpacity(th.colors.blue, 0.14),
    borderRadius:      th.radius.full,
    paddingHorizontal: 7,
    paddingVertical:   1,
    flexShrink:        0,
  },
  adaptedChipText: {
    fontSize:      9,
    fontWeight:    typography.bold,
    color:         th.colors.blue,
    letterSpacing: 0.5,
  },

  // ── Stage advance banner ──────────────────────────────────────────────────────
  stageBanner: {
    backgroundColor: withOpacity(th.colors.accent, 0.06),
    borderWidth:     borders.thin,
    borderColor:     withOpacity(th.colors.accent, 0.25),
    borderRadius:    th.radius.md,
    padding:         spacing.md,
    gap:             spacing.sm,
  },
  stageBannerLabel: {
    fontSize:      typography.xs,
    fontWeight:    typography.bold,
    color:         th.colors.accent,
    letterSpacing: 1.5,
  },
  stageBannerText: {
    ...textStyles.subtitle,
    color:      th.colors.text,
    lineHeight: textStyles.subtitle.fontSize * 1.5,
  },
  // Segunda línea del caso bloqueado: lo que SÍ puede hacer mientras tanto.
  stageBannerHint: {
    ...textStyles.subtitle,
    color:      th.colors.mutedLight,
    lineHeight: textStyles.subtitle.fontSize * 1.5,
    marginTop:  spacing.xs,
  },
  stageBannerBtns: {
    flexDirection: 'row',
    gap:           spacing.sm,
    marginTop:     spacing.xs,
  },
  // Botones "Primary"/"Secondary" del componente Buttons de Figma (mismo par que
  // GUARDAR SESIÓN/Descartar sesión del footer de Workout, nodos 109:517/109:518).
  stageBannerAdvanceBtn: {
    flex:              2,
    backgroundColor:   LIMA,
    borderRadius:      th.radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical:   spacing.md,
    alignItems:        'center',
    justifyContent:    'center',
  },
  stageBannerAdvanceBtnText: {
    ...textStyles.cardType,
    color:     th.colors.onAccent,
    textAlign: 'center',
  },
  stageBannerContinueBtn: {
    flex:              1,
    paddingHorizontal: spacing.sm,
    paddingVertical:   spacing.md,
    borderRadius:      th.radius.md,
    alignItems:        'center',
    justifyContent:    'center',
  },
  stageBannerContinueBtnText: {
    ...textStyles.spacingTag,
    color:     th.tint.accent50,
    textAlign: 'center',
  },

  // ── Program action buttons — variante "Secondary" del componente Buttons ──────
  programActions: {
    flexDirection: 'row',
    gap:           spacing.md,
  },
  programBtn: {
    flex:            1,
    flexDirection:   'row',
    justifyContent:  'center',
    alignItems:      'center',
    gap:             spacing.sm,
    padding:         spacing.md,
    borderRadius:    th.radius.md,
    backgroundColor: th.colors.surface2,
  },
  programBtnText: {
    ...textStyles.cardType,
    color: th.colors.text,
  },
  programBtnMore: {
    padding:         spacing.md,
    borderRadius:    th.radius.md,
    backgroundColor: th.colors.surface2,
    alignItems:      'center',
    justifyContent:  'center',
  },
  programBtnMoreText: {
    ...textStyles.cardType,
    color: th.colors.text,
  },

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

  // ── Modals ────────────────────────────────────────────────────────────────────
  backdrop: {
    flex:            1,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  bottomSheet: {
    backgroundColor:      th.colors.surface,
    borderTopLeftRadius:  th.radius.lg,
    borderTopRightRadius: th.radius.lg,
    borderTopWidth:       borders.thin,
    borderTopColor:       th.colors.border,
    padding:              spacing.xl,
    paddingBottom:        spacing.xxl,
    gap:                  spacing.sm,
  },
  sheetTitle: {
    fontSize:      typography.lg,
    fontWeight:    typography.heavy,
    color:         th.colors.text,
    letterSpacing: 0.5,
    marginBottom:  spacing.xs,
  },
  archiveDesc: {
    fontSize:     typography.sm,
    color:        th.colors.muted,
    lineHeight:   typography.sm * 1.6,
    marginBottom: spacing.xs,
  },
  archiveOption: {
    backgroundColor: th.colors.surface2,
    borderWidth:     borders.thin,
    borderColor:     th.colors.borderCard,
    borderRadius:    th.radius.sm,
    padding:         spacing.md,
  },
  archiveOptionDanger: {
    borderColor:     withOpacity(th.colors.red, 0.3),
    backgroundColor: withOpacity(th.colors.red, 0.05),
  },
  archiveOptionLabel: {
    fontSize:   typography.base,
    fontWeight: typography.medium,
    color:      th.colors.text,
  },
  archiveOptionDesc: {
    fontSize:  typography.xs,
    color:     th.colors.muted,
    marginTop: 3,
  },
  cancelBtn: {
    paddingVertical: spacing.md,
    borderRadius:    th.radius.sm,
    borderWidth:     borders.thin,
    borderColor:     th.colors.border,
    alignItems:      'center',
    marginTop:       spacing.xs,
  },
  cancelBtnText: {
    fontSize:   typography.base,
    color:      th.colors.muted,
    fontWeight: typography.medium,
  },

  // ── Conexiones (Drive + Entrenador) ──────────────────────────────────────────
  statusCards: {
    gap: spacing.sm,
  },
  statusCard: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing.lg,
    backgroundColor:   th.colors.surface,
    borderRadius:      th.radius.md,
    paddingVertical:   spacing.md,
    paddingHorizontal: spacing.xxl,
  },
  statusCardWarn: {
    backgroundColor: withOpacity(th.colors.orange, 0.06),
    borderWidth:      borders.thin,
    borderColor:      withOpacity(th.colors.orange, 0.4),
  },
  statusDot: {
    width:        12,
    height:       12,
    borderRadius: 6,
  },
  statusInfo: {
    flex:     1,
    minWidth: 0,
  },
  statusTitle: {
    ...textStyles.btnAction,
    color: th.colors.text,
  },
  statusSub: {
    ...textStyles.tag,
    color:     th.colors.mutedLight,
    marginTop: 1,
  },
  statusConnectBtn: {
    ...textStyles.spacingTag,
    color: th.colors.accent,
  },
  statusConnectBtnOk: {
    color: th.tint.accent50,
  },

  // Stage picker
  stageList: {
    gap: spacing.sm,
  },
  stageOption: {
    backgroundColor: th.colors.surface2,
    borderWidth:     borders.thin,
    borderColor:     th.colors.borderCard,
    borderRadius:    th.radius.sm,
    padding:         spacing.md,
  },
  stageOptionActive: {
    backgroundColor: withOpacity(th.colors.accent, 0.06),
    borderColor:     withOpacity(th.colors.accent, 0.3),
  },
  // Bloqueada: sin fondo propio, solo apagada — que se lea como "no disponible",
  // no como un estado más (que es lo que sugeriría un color).
  stageOptionLocked: {
    backgroundColor: 'transparent',
  },
  stageOptionHeader: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    gap:            spacing.xs,
    marginBottom:   3,
  },
  stageOptionName: {
    flex:       1,
    fontSize:   typography.base,
    fontWeight: typography.medium,
    color:      th.colors.text,
  },
  stageOptionNameActive: {
    color: th.colors.accent,
  },
  stageOptionNameLocked: {
    color: th.colors.muted,
  },
  stageActiveLabel: {
    fontSize:      typography.xs,
    fontWeight:    typography.bold,
    color:         th.colors.accent,
    letterSpacing: 1,
  },
  stageOptionDesc: {
    fontSize: typography.xs,
    color:    th.colors.muted,
  },
});
