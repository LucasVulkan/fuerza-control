/**
 * HistoryScreen — historial de sesiones + calendario visual de entrenamientos.
 *
 * Novedades:
 *  - Calendario de las últimas 5 semanas en la cabecera (cuadrados por día)
 *  - Tarjeta de sesión con formato "Sesión A / nombre" (igual que HomeScreen)
 *  - Pills: verde = completada en rango, naranja = por debajo del rango, gris = sin completar
 *  - buildSetLabel cubre todas las combinaciones: weight×reps, weight×time, reps, time
 */
import { useState, useMemo } from 'react';
import {
  View, Text, TouchableOpacity,
  ScrollView, Alert, StyleSheet,
} from 'react-native';
// Reanimated drives both the delete-card exit + sibling reflow (`exiting`/
// `layout`) and the detail accordion (`FadeIn`/`FadeOut` + the card's own
// `layout` animates the height change) — one animation system, no JS-driven
// Animated.Value height chase fighting the UI-thread layout transition.
import Reanimated, { LinearTransition, SlideOutRight, FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../store/useStore';
import AppHeader from '../components/AppHeader';
import SegmentedControl from '../components/ui/SegmentedControl';
import DragSheet from '../components/DragSheet';
import { ArrowIcon } from '../components/ui/EditorIcons';
import { useWeightUnit } from '../hooks/useWeightUnit';
import { spacing, typography, borders, withOpacity, textStyles } from '../theme';
import { useTheme, useThemedStyles } from '../useTheme';
import { formatDate } from '../../../src/utils/formatters';
import { formatBlockScore } from '../../../src/utils/conditioningBlocks';
import { recapStats, volumeDeltas } from '../../../src/utils/sessionRecap';
import { internalLoad } from '../../../src/utils/trainingLoad';
import { buildSetLabel, groupSetsByWeight, getPillVariant } from '../utils/setDisplay';

// Same badge-per-format mapping as SessionEditorScreen's block rows / recap.
const BLOCK_BADGE_STYLE = {
  amrap:    'badgeBlockAmrap',
  emom:     'badgeBlockEmom',
  for_time: 'badgeBlockForTime',
};

// ── Calendar constants ─────────────────────────────────────────────────────────
const CELL_H  = 30;
const CELL_GAP = 3;

// ── Mapa de calor ──────────────────────────────────────────────────────────────
// Cuatro escalones, no un degradado continuo: en celdas de 30 px nadie
// distingue un 0,42 de un 0,55 de opacidad, y cuatro pasos sí se comparan de un
// vistazo. Por encima del segundo escalón el fondo ya es lo bastante sólido
// como para que el número del día tenga que ir en oscuro.
const HEAT_STEPS = [0.18, 0.42, 0.66, 0.9];
const HEAT_DARK_TEXT_FROM = 2;

/** Escalón de un día según los cortes de cuartil del propio usuario. */
function heatLevel(load, cuts) {
  if (!(load > 0) || !cuts?.length) return 0;
  return Math.min(HEAT_STEPS.length - 1, cuts.filter((c) => load >= c).length);
}

/**
 * Carga interna por día del log completo, y los cortes de la escala.
 *
 * Los cortes son **cuartiles del propio usuario**, no fracciones de un máximo.
 * Con una escala lineal desde cero el escalón más flojo no se usaba nunca: una
 * sesión de entrenamiento jamás está cerca de cero, así que la mitad baja de la
 * paleta quedaba muerta (verificado con datos reales: 0/6/22/13 días por
 * escalón). Por cuartiles, el color ordena los días entre sí, que es justo la
 * pregunta — "¿cuáles fueron mis días duros?".
 *
 * Se calculan sobre TODO el historial, no sobre el mes visible: si no,
 * cambiarían al pasar de mes y un mes de descarga se pintaría tan intenso como
 * uno duro.
 *
 * `internalLoad` es puro por entrada (sRPE × minutos acotados), así que esto no
 * necesita ni la librería de ejercicios ni el peso corporal.
 */
function getLoadHeat(workoutLog) {
  const byDay = new Map();
  for (const entry of workoutLog ?? []) {
    const d = new Date(entry.timestamp);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    const load = internalLoad(entry);
    const cur = byDay.get(key) ?? { load: null, sessions: 0 };
    if (load != null) cur.load = (cur.load ?? 0) + load;
    cur.sessions += 1;
    byDay.set(key, cur);
  }
  const values = [...byDay.values()].map((v) => v.load).filter((v) => v > 0).sort((a, b) => a - b);
  const q = (p) => values[Math.min(values.length - 1, Math.floor(values.length * p))];
  const cuts = values.length ? [q(0.25), q(0.5), q(0.75)] : [];
  return { byDay, cuts };
}

// Pure helper — computes grid weeks + trained-day map for any year/month
function getMonthData(y, m, heat) {
  const daysInM = new Date(y, m + 1, 0).getDate();
  let   startDow = new Date(y, m, 1).getDay();
  startDow = startDow === 0 ? 6 : startDow - 1; // Mon-aligned
  const cells = [
    ...Array(startDow).fill(null),
    ...Array.from({ length: daysInM }, (_, i) => i + 1),
  ];
  while (cells.length < 42) cells.push(null);
  const weeks = Array.from({ length: 6 }, (_, i) => cells.slice(i * 7, i * 7 + 7));

  // day → { load: number|null, sessions }. `load: null` con sessions > 0 =
  // entrenó pero no contestó el sRPE: no hay carga que pintar.
  const trainedDays = {};
  for (let day = 1; day <= daysInM; day++) {
    const hit = heat.byDay.get(`${y}-${m}-${day}`);
    if (hit) trainedDays[day] = hit;
  }
  return { weeks, trainedDays };
}


// ── WorkoutCalendar ────────────────────────────────────────────────────────────

function WorkoutCalendar({ onDayPress, selectedDate }) {
  const { t }            = useTranslation();
  const cal              = useThemedStyles(makeCal);
  const th               = useTheme();
  const workoutLog       = useStore((s) => s.workoutLog);

  const today = new Date();
  const [year,  setYear]  = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth()); // 0-indexed

  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth();

  function prevMonth() {
    if (month === 0) { setYear((y) => y - 1); setMonth(11); }
    else               setMonth((m) => m - 1);
  }
  function nextMonth() {
    if (isCurrentMonth) return;
    if (month === 11) { setYear((y) => y + 1); setMonth(0); }
    else               setMonth((m) => m + 1);
  }

  // La escala se calcula sobre TODO el log, no sobre el mes visible.
  const heat = useMemo(() => getLoadHeat(workoutLog), [workoutLog]);
  const { weeks, trainedDays } = useMemo(
    () => getMonthData(year, month, heat),
    [year, month, heat],
  );

  return (
    <View style={cal.wrap}>
      {/* Navigation */}
      <View style={cal.nav}>
        <TouchableOpacity onPress={prevMonth} hitSlop={12} style={cal.navBtn}>
          <Text style={cal.navIcon}>{'‹'}</Text>
        </TouchableOpacity>
        <Text style={cal.monthLabel}>{`${(t('months', { returnObjects: true }))[month]} ${year}`}</Text>
        <TouchableOpacity
          onPress={nextMonth}
          hitSlop={12}
          style={[cal.navBtn, isCurrentMonth && cal.navBtnOff]}
          disabled={isCurrentMonth}
        >
          <Text style={[cal.navIcon, isCurrentMonth && cal.navIconOff]}>{'›'}</Text>
        </TouchableOpacity>
      </View>

      {/* Day-of-week headers */}
      <View style={cal.header}>
        {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d) => (
          <Text key={d} style={cal.hDay}>{d}</Text>
        ))}
      </View>

      {/* Grid — trim trailing empty rows */}
      <View style={cal.grid}>
        {weeks.filter((week) => week.some((d) => d !== null)).map((week, wi) => (
          <View key={wi} style={cal.week}>
            {week.map((day, di) => {
              if (day === null) return <View key={di} style={cal.cellBlank} />;
              const hit     = trainedDays[day];
              const trained = !!hit;
              // Entrenó pero sin sRPE: no hay carga que pintar. Va en contorno,
              // NO en el tono más flojo — ese diría "sesión suave", cuando lo
              // que dice el dato es "no contestaste".
              const noRpe   = trained && hit.load == null;
              const level   = trained && !noRpe ? heatLevel(hit.load, heat.cuts) : -1;
              const isToday = isCurrentMonth && day === today.getDate();
              const isSel   = trained
                && selectedDate?.year  === year
                && selectedDate?.month === month
                && selectedDate?.day   === day;
              return (
                <TouchableOpacity
                  key={di}
                  style={[
                    cal.cell,
                    level >= 0 && { backgroundColor: withOpacity(th.colors.accent, HEAT_STEPS[level]) },
                    noRpe   && cal.cellNoRpe,
                    isToday && !trained && cal.cellToday,
                    isSel   && cal.cellSel,
                  ]}
                  onPress={() => trained && onDayPress?.({ year, month, day })}
                  activeOpacity={trained ? 0.72 : 1}
                >
                  <Text
                    style={[
                      cal.dayNum,
                      // El texto se invierte solo cuando el fondo ya es sólido.
                      level >= HEAT_DARK_TEXT_FROM && cal.dayNumOnHeat,
                      level >= 0 && level < HEAT_DARK_TEXT_FROM && cal.dayNumOnTint,
                      noRpe   && cal.dayNumNoRpe,
                      isToday && !trained && cal.dayNumToday,
                    ]}
                  >
                    {day}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>

      {/* Leyenda — tres estados que no se deducen del color solo */}
      <View style={cal.legend}>
        <Text style={cal.legendLabel}>{t('history.heatLegend')}</Text>
        <View style={cal.legendScale}>
          {HEAT_STEPS.map((a) => (
            <View key={a} style={[cal.legendSwatch, { backgroundColor: withOpacity(th.colors.accent, a) }]} />
          ))}
        </View>
        <Text style={cal.legendLabel}>{t('history.heatMore')}</Text>
        <View style={cal.legendSpacer} />
        <View style={[cal.legendSwatch, cal.cellNoRpe]} />
        <Text style={cal.legendLabel}>{t('history.heatNoRpe')}</Text>
      </View>
    </View>
  );
}

const makeCal = (th) => StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing.lg,
    paddingTop:        spacing.md,
    paddingBottom:     spacing.sm,
    borderBottomWidth: borders.thin,
    borderBottomColor: th.colors.border,
  },

  // Navigation row
  nav: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    marginBottom:   spacing.sm,
  },
  navBtn:     { padding: 4 },
  navBtnOff:  { opacity: 0.25 },
  navIcon:    { fontSize: 24, color: th.colors.muted, lineHeight: 28 },
  navIconOff: { color: th.colors.muted2 },
  monthLabel: {
    fontSize:      typography.sm,
    fontWeight:    typography.bold,
    color:         th.colors.text,
    letterSpacing: 0.5,
  },

  // Day-of-week header
  header: {
    flexDirection: 'row',
    gap:           CELL_GAP,
    marginBottom:  4,
  },
  // Subida de brillo y peso: en muted2 a 9 px la fila de días se perdía y el
  // calendario quedaba sin sus ejes.
  hDay: {
    flex:          1,
    textAlign:     'center',
    fontSize:      10,
    fontWeight:    typography.heavy,
    color:         th.colors.mutedLight,
    letterSpacing: 1.2,
  },

  // Grid
  grid: { gap: CELL_GAP },
  week: { flexDirection: 'row', gap: CELL_GAP },

  cellBlank: { flex: 1, height: CELL_H },

  cell: {
    flex:           1,
    height:         CELL_H,
    borderRadius:   th.radius.xs + 1,
    alignItems:     'center',
    justifyContent: 'center',
  },
  cellNoRpe: { borderWidth: 1, borderColor: th.tint.accent50 },
  cellToday: { borderWidth: 1, borderColor: withOpacity(th.colors.accent, 0.55) },
  // Seleccionado = contorno claro, NO otro color de fondo: el fondo ya codifica
  // la carga y pintarlo encima destruiría el dato que el mapa existe para dar.
  cellSel:   { borderWidth: 2, borderColor: th.colors.text },

  dayNum:       { fontSize: 10, color: th.colors.muted2 },
  dayNumOnTint: { color: th.colors.text,     fontWeight: typography.bold },
  dayNumOnHeat: { color: th.colors.onAccent, fontWeight: typography.heavy },
  dayNumNoRpe:  { color: th.colors.accent,   fontWeight: typography.bold },
  dayNumToday:  { color: th.colors.accent,   fontWeight: typography.medium },

  // ── Leyenda del mapa de calor ──
  legend: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.xs2,
    marginTop:     spacing.sm,
  },
  legendLabel:  { ...textStyles.tag, color: th.colors.muted },
  legendScale:  { flexDirection: 'row', gap: 2 },
  legendSwatch: { width: 12, height: 12, borderRadius: th.radius.xs - 1 },
  legendSpacer: { flex: 1 },
});

// ── SessionCard ────────────────────────────────────────────────────────────────

function SessionCard({ session, onDelete, volumeDelta = null }) {
  const { t, i18n } = useTranslation();
  const styles = useThemedStyles(makeStyles);
  const { fmt: fmtWeight, toDisplay, unit } = useWeightUnit();
  const unitLabel = unit.charAt(0).toUpperCase() + unit.slice(1);

  const [open, setOpen] = useState(false);

  const getEffectiveTemplate = useStore((s) => s.getEffectiveTemplate);
  const exerciseLibrary      = useStore((s) => s.exerciseLibrary);
  const customExercises      = useStore((s) => s.customExercises);
  const programs             = useStore((s) => s.programs);
  const allExercises = { ...exerciseLibrary, ...customExercises };

  const isFree   = session.sessionTemplateId === '__free__';
  const template = isFree ? null : getEffectiveTemplate(session.sessionTemplateId);
  const label    = template?.label ?? '?';
  const name     = session.sessionName ?? (isFree ? t('freeSession.historyLabel') : (template?.name ?? session.sessionTemplateId));

  // exConfig lookup for pill range comparisons
  const exConfigs = useMemo(() => {
    const map = {};
    (template?.exercises ?? []).forEach((ec) => { map[ec.exerciseId] = ec; });
    return map;
  }, [template]);

  // Stage name (if applicable — never for free sessions)
  const stageName = useMemo(() => {
    if (isFree || !template?.programId) return null;
    const program = programs[template.programId];
    if (!program?.stages?.length) return null;
    for (const stage of program.stages) {
      if (stage.days.some((d) => d.sessionTemplateId === session.sessionTemplateId)) {
        return stage.name;
      }
    }
    return null;
  }, [template, programs, session.sessionTemplateId]);

  const durationMin = session.duration ? Math.round(session.duration / 60000) : null;
  // Series hechas/planificadas: puro por entrada, sin recorrer el log.
  const { setsDone, setsPlanned } = useMemo(() => recapStats(session), [session]);
  const hasNotes    = !!session.notes?.trim()
                   || (session.exercises ?? []).some((e) => !!e.note);

  // Same "has data" criteria used by the expanded exercise list below.
  const exerciseCount = useMemo(
    () => (session.exercises ?? []).filter(
      (e) => (e.sets ?? []).some((s) => s.done || s.weight || s.reps || s.time),
    ).length,
    [session.exercises],
  );

  function handleDelete() {
    Alert.alert(
      t('history.deleteTitle'),
      t('history.deleteConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        // No manual exit animation here — the Reanimated.View wrapper below
        // (exiting={SlideOutRight}) intercepts the unmount that follows
        // onDelete() and animates it + the sibling reflow on the UI thread.
        { text: t('common.delete'), style: 'destructive', onPress: () => onDelete(session.id) },
      ],
    );
  }

  // Rendered only while `open` — see the FadeIn/FadeOut wrapper below.
  const detailContent = (
    <View style={styles.detail}>
      {/* Duración y nº de ejercicios bajan aquí: en la cabecera competían con
          los tres datos que de verdad se comparan entre sesiones, y esta es
          información de contexto que se consulta al abrir, no al ojear. */}
      <Text style={styles.detailMeta}>
        {[
          durationMin ? `${durationMin} min` : null,
          exerciseCount > 0 ? t('common.exercises', { count: exerciseCount }) : null,
        ].filter(Boolean).join('  ·  ')}
      </Text>

      {!!session.notes?.trim() && (
        <View style={styles.noteSection}>
          <Text style={styles.noteSectionLabel}>NOTA</Text>
          <Text style={styles.noteSectionText}>{session.notes}</Text>
        </View>
      )}

      {(session.exercises ?? []).map((ex) => {
        const def    = allExercises[ex.exerciseId];
        const exName = def
          ? (i18n.language === 'en' ? (def.nameEn ?? def.name) : def.name)
          : ex.exerciseId;

        const hasSets = (ex.sets ?? []).some(
          (s) => s.done || s.weight || s.reps || s.time,
        );
        if (!hasSets) return null;

        const exCfg = exConfigs[ex.exerciseId];

        return (
          <View key={ex.exerciseId} style={styles.exSection}>
            <Text style={styles.exName}>{exName}</Text>
            <View style={styles.setPills}>
              {/* Logged sets — grouped by consecutive weight runs: one
                  weightless weight-pill followed by its reps/RPE pills */}
              {groupSetsByWeight(ex.sets ?? []).map((group, gi) => (
                <View key={`grp-${gi}`} style={styles.setGroup}>
                  {group.weight ? (
                    <View style={styles.weightPill}>
                      <Text style={styles.weightPillText}>
                        <Text style={styles.weightPillNum}>{toDisplay(group.weight)}</Text>
                        <Text style={styles.weightPillUnit}>{unitLabel}</Text>
                        <Text style={styles.weightPillX}>{' x'}</Text>
                      </Text>
                    </View>
                  ) : null}
                  {group.sets.map((s, i) => {
                    const variant = getPillVariant(s, exCfg);
                    const { main, rpeNum } = buildSetLabel(s, i, fmtWeight, true);
                    return (
                      <View
                        key={`set-${gi}-${i}`}
                        style={[
                          styles.setPill,
                          variant === 'done'    && styles.setPillDone,
                          variant === 'partial' && styles.setPillPartial,
                        ]}
                      >
                        <Text
                          style={[
                            styles.setPillText,
                            variant === 'done'    && styles.setPillTextDone,
                            variant === 'partial' && styles.setPillTextPartial,
                          ]}
                        >
                          {main}
                          {rpeNum ? (
                            <>
                              <Text
                                style={[
                                  styles.setPillRpeAt,
                                  variant === 'done'    && styles.setPillRpeAtDone,
                                  variant === 'partial' && styles.setPillRpeAtPartial,
                                ]}
                              >
                                @
                              </Text>
                              {rpeNum}
                            </>
                          ) : null}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              ))}
              {/* Planned but not started */}
              {Array.from({
                length: Math.max(0, (ex.totalSets ?? ex.sets?.length ?? 0) - (ex.sets?.length ?? 0)),
              }).map((_, i) => (
                <View key={`empty-${i}`} style={styles.setPill}>
                  <Text style={styles.setPillText}>—</Text>
                </View>
              ))}
            </View>
            {!!ex.note && (
              <Text style={styles.exNote}>📝 {ex.note}</Text>
            )}
          </View>
        );
      })}

      {/* Conditioning blocks — v1: just the score, one line per block */}
      {(session.blocks ?? []).map((block) => (
        <View key={block.blockId} style={styles.blockLine}>
          <View style={[styles.badge, styles[BLOCK_BADGE_STYLE[block.format]]]}>
            <Text style={[styles.badgeText, styles[`${BLOCK_BADGE_STYLE[block.format]}Text`]]}>
              {t(`blocks.formats.${block.format}`).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.blockLineName} numberOfLines={1}>
            {block.name ?? t(`blocks.formats.${block.format}`)}
          </Text>
          <Text style={styles.blockLineScore}>
            {formatBlockScore(block.result, block.format)}
            {block.result.capped ? ` ${t('blocks.cappedTag')}` : ''}
          </Text>
        </View>
      ))}
    </View>
  );

  return (
    // Reanimated's standard list-item primitives, not hand-rolled height math:
    // `exiting` plays the exit animation on the UI thread and defers the actual
    // unmount until it finishes; `layout` on every card (this one included) makes
    // siblings glide into the freed space automatically once it does.
    <Reanimated.View layout={LinearTransition.duration(240)} exiting={SlideOutRight.duration(240)}>
      <View style={styles.card}>
          {/* Header — tap to expand */}
          <TouchableOpacity
            style={styles.cardHeader}
            onPress={() => setOpen((o) => !o)}
            activeOpacity={0.75}
          >
            <View style={styles.cardHeaderLeft}>
              {/* Identidad: letra en accent + nombre + etapa, todo en una línea.
                  La etapa va pegada al nombre y no perdida entre metadatos: es
                  lo que sitúa la sesión dentro del programa. */}
              <View style={styles.cardIdRow}>
                <Text style={styles.cardSesName} numberOfLines={1}>
                  <Text style={styles.cardSesLetter}>{isFree ? '★' : label}</Text>
                  {'  '}{name}
                </Text>
                {stageName ? (
                  <Text style={styles.cardStage} numberOfLines={1}>{stageName}</Text>
                ) : null}
              </View>

              {/* Datos de la sesión. Texto suelto, no chips: son tres cifras,
                  no tres botones. Sin carga — un número de carga aislado no
                  dice nada sin su serie temporal, que vive en la pestaña Carga. */}
              <View style={styles.cardStatsRow}>
                <Text style={styles.cardStat}>
                  <Text style={styles.cardStatNum}>{setsDone}</Text>
                  <Text style={styles.cardStatUnit}>{`/${setsPlanned} `}</Text>
                  {t('history.setsShort')}
                </Text>
                <Text style={styles.cardStatSep}>·</Text>
                <Text style={styles.cardStat}>
                  {'RPE '}
                  <Text style={session.sessionRpe != null ? styles.cardStatNum : styles.cardStatUnit}>
                    {session.sessionRpe ?? '—'}
                  </Text>
                </Text>
                {volumeDelta != null && (
                  <>
                    <Text style={styles.cardStatSep}>·</Text>
                    <Text style={[styles.cardStat, volumeDelta >= 0 ? styles.deltaUp : styles.deltaDown]}>
                      {`${volumeDelta > 0 ? '+' : ''}${volumeDelta}%`}
                    </Text>
                  </>
                )}
                {hasNotes && (
                  <View style={styles.noteTag}>
                    <Text style={styles.noteTagText}>NOTA</Text>
                  </View>
                )}
                {session.adapted && (
                  <View style={styles.adaptedTag}>
                    <Text style={styles.adaptedTagText}>{t('home.adapted')}</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Fecha aislada en su esquina: se busca por ella, no se lee de corrido. */}
            <View style={styles.cardHeaderRight}>
              <Text style={styles.cardDateCorner} numberOfLines={1}>{formatDate(session.timestamp)}</Text>
              <TouchableOpacity onPress={handleDelete} hitSlop={8} style={styles.deleteBtn}>
                <Text style={styles.deleteBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>

          {/* Expanded detail — the card's own `layout` (LinearTransition, on the
              outer Reanimated.View) animates the resulting height change. */}
          {open && (
            <Reanimated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(150)}>
              {detailContent}
            </Reanimated.View>
          )}
      </View>
    </Reanimated.View>
  );
}

// ── Screen ─────────────────────────────────────────────────────────────────────

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const { t }  = useTranslation();
  const styles = useThemedStyles(makeStyles);

  const workoutLog      = useStore((s) => s.workoutLog);
  const deleteLogEntry  = useStore((s) => s.deleteLogEntry);
  const clearWorkoutLog = useStore((s) => s.clearWorkoutLog);
  const showToast       = useStore((s) => s.showToast);
  const programs        = useStore((s) => s.programs);
  const profile         = useStore((s) => s.profile);
  const activeProgram   = programs[profile.activeProgramId];

  const [scope,            setScope]            = useState('all');
  const [selectedStageIds, setSelectedStageIds] = useState(new Set());
  const [selectedDate,     setSelectedDate]     = useState(null); // { year, month, day }
  const [menuOpen,         setMenuOpen]         = useState(false);

  const hasStages = (activeProgram?.stages?.length ?? 0) > 0;


  function handleScope(newScope) {
    setScope(newScope);
    setSelectedStageIds(new Set());
    setSelectedDate(null);
  }

  function handleDayPress({ year, month, day }) {
    setSelectedDate((prev) =>
      prev?.year === year && prev?.month === month && prev?.day === day
        ? null          // tap again to deselect
        : { year, month, day },
    );
  }

  function toggleStage(stageId) {
    setSelectedStageIds((prev) => {
      const next = new Set(prev);
      if (next.has(stageId)) next.delete(stageId); else next.add(stageId);
      return next;
    });
  }

  const programTemplateIds = useMemo(() => {
    const ids = new Set();
    if (!activeProgram) return ids;
    if (activeProgram.stages?.length > 0) {
      activeProgram.stages.forEach((st) => st.days.forEach((d) => ids.add(d.sessionTemplateId)));
    } else {
      (activeProgram.days ?? []).forEach((d) => ids.add(d.sessionTemplateId));
    }
    return ids;
  }, [activeProgram]);

  const effectiveTemplateIds = useMemo(() => {
    if (scope !== 'program' || !hasStages || selectedStageIds.size === 0) return programTemplateIds;
    const ids = new Set();
    activeProgram.stages.forEach((st, idx) => {
      if (selectedStageIds.has(st.id ?? idx)) st.days.forEach((d) => ids.add(d.sessionTemplateId));
    });
    return ids;
  }, [activeProgram, scope, selectedStageIds, programTemplateIds, hasStages]);

  // Una sola pasada para TODA la lista: por tarjeta sería O(n²).
  const deltas = useMemo(() => volumeDeltas(workoutLog), [workoutLog]);

  const filtered = useMemo(() => {
    let list = [...workoutLog];
    if (scope === 'program' && effectiveTemplateIds.size > 0) {
      list = list.filter((e) => effectiveTemplateIds.has(e.sessionTemplateId));
    }
    if (selectedDate) {
      list = list.filter((e) => {
        const d = new Date(e.timestamp);
        return (
          d.getFullYear() === selectedDate.year &&
          d.getMonth()    === selectedDate.month &&
          d.getDate()     === selectedDate.day
        );
      });
    }
    return list.sort((a, b) => b.timestamp - a.timestamp);
  }, [workoutLog, scope, effectiveTemplateIds, selectedDate]);

  /**
   * Borrado en bloque. Destructivo y sin deshacer, así que va con confirmación
   * nativa que dice cuántas sesiones se van y recuerda exportar. La cuenta se
   * calcula antes para que el aviso sea concreto y no un "esto borrará datos".
   */
  function confirmClear(scopeId) {
    setMenuOpen(false);
    const willDelete = scopeId === 'all'
      ? workoutLog.length
      : workoutLog.filter((e) => !programTemplateIds.has(e.sessionTemplateId)).length;

    if (willDelete === 0) {
      showToast(t('history.clearNothing'), 2200, 'neutral');
      return;
    }
    Alert.alert(
      t(`history.clear.${scopeId}.title`),
      t(`history.clear.${scopeId}.body`, { count: willDelete }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text:    t('history.clear.confirm'),
          style:   'destructive',
          onPress: () => {
            const removed = clearWorkoutLog(scopeId);
            showToast(t('history.clearDone', { count: removed }), 2200, 'neutral');
          },
        },
      ],
    );
  }

  // Rendered inline so it closes over scope/hasStages/selectedStageIds state
  const listHeader = (
    <>
      <WorkoutCalendar onDayPress={handleDayPress} selectedDate={selectedDate} />

      {/* Date filter chip — shown when a calendar day is selected */}
      {selectedDate && (
        <View style={styles.dateFilterRow}>
          <Text style={styles.dateFilterLabel}>
            {`${selectedDate.day} de ${(t('months', { returnObjects: true }))[selectedDate.month]}`}
          </Text>
          <TouchableOpacity
            onPress={() => setSelectedDate(null)}
            hitSlop={8}
            style={styles.dateFilterClose}
          >
            <Text style={styles.dateFilterCloseText}>{'✕'}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Scope selector + menú de gestión del historial */}
      <View style={styles.scopeRow}>
        <View style={styles.scopeSegmented}>
          <SegmentedControl
            options={[
              { id: 'program', label: t('history.currentProgram') },
              { id: 'all',     label: t('history.all') },
            ]}
            value={scope}
            onChange={handleScope}
          />
        </View>
        <TouchableOpacity
          style={styles.menuBtn}
          onPress={() => setMenuOpen(true)}
          activeOpacity={0.75}
          hitSlop={8}
        >
          <Text style={styles.menuBtnGlyph}>···</Text>
        </TouchableOpacity>
      </View>

      {/* Stage pills */}
      {scope === 'program' && hasStages && (
        <View style={styles.stagePillsRow}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.stagePillsContent}
          >
            {activeProgram.stages.map((stage, idx) => {
              const stageId  = stage.id ?? idx;
              const isActive = selectedStageIds.size === 0 || selectedStageIds.has(stageId);
              return (
                <TouchableOpacity
                  key={stageId}
                  style={[styles.stagePill, isActive && styles.stagePillActive]}
                  onPress={() => toggleStage(stageId)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.stagePillText, isActive && styles.stagePillTextActive]}>
                    {stage.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
            {selectedStageIds.size > 0 && (
              <TouchableOpacity
                style={styles.stagePillReset}
                onPress={() => setSelectedStageIds(new Set())}
                activeOpacity={0.7}
              >
                <Text style={styles.stagePillResetText}>{t('history.allStages')}</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>
      )}
    </>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <AppHeader />
      <Reanimated.FlatList
        itemLayoutAnimation={LinearTransition.duration(240)}
        data={filtered}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={listHeader}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: spacing.xxl + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <SessionCard
            session={item}
            onDelete={deleteLogEntry}
            volumeDelta={deltas.get(item.id) ?? null}
          />
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📭</Text>
            <Text style={styles.emptyText}>
              {selectedDate
                ? t('history.noSessionsDate', {
                    day: selectedDate.day,
                    month: (t('months', { returnObjects: true }))[selectedDate.month],
                  })
                : scope === 'program'
                  ? t('history.noSessionsProgram')
                  : t('history.noSessionsEmpty')}
            </Text>
          </View>
        }
      />

      {/* Gestión del historial — patrón unificado de modales (DragSheet) */}
      <DragSheet visible={menuOpen} onClose={() => setMenuOpen(false)} title={t('history.manageTitle')}>
        <View style={styles.sheetBody}>
          <SheetRow label={t('history.clear.off_program.action')} onPress={() => confirmClear('off_program')} danger />
          <SheetRow label={t('history.clear.all.action')}         onPress={() => confirmClear('all')}         danger />
          <Text style={styles.sheetHint}>{t('history.clearHint')}</Text>
        </View>
      </DragSheet>
    </View>
  );
}

function SheetRow({ label, onPress, danger = false }) {
  const styles = useThemedStyles(makeStyles);
  const th     = useTheme();
  return (
    <TouchableOpacity style={styles.sheetRow} onPress={onPress} activeOpacity={0.7}>
      <Text style={[styles.sheetRowText, danger && { color: th.colors.red }]}>{label}</Text>
      <ArrowIcon size={14} color={danger ? th.colors.red : th.colors.mutedLight} />
    </TouchableOpacity>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const makeStyles = (th) => StyleSheet.create({
  container: {
    flex:            1,
    backgroundColor: th.colors.bg,
  },

  // Scope selector
  scopeRow: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing.sm2,
    paddingHorizontal: spacing.lg,
    paddingTop:        spacing.md,
    paddingBottom:     spacing.sm,
  },
  scopeSegmented: { flex: 1 },
  // 42×42 = misma caja que los botones que acompañan a la barra de búsqueda
  // (docs/UI-MIGRATION.md §9), para que las cajas de acción sean una sola familia.
  menuBtn: {
    width: 42, height: 42, borderRadius: th.radius.sm,
    backgroundColor: th.colors.surface2,
    alignItems: 'center', justifyContent: 'center',
  },
  menuBtnGlyph: { ...textStyles.cardTitle, color: th.colors.text, marginTop: -6 },

  // ── Hoja de gestión ──
  sheetBody: { gap: spacing.xs2, paddingBottom: spacing.sm },
  sheetRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: th.colors.surface2,
    borderRadius: th.radius.sm,
    padding: spacing.md,
  },
  sheetRowText: { ...textStyles.cardType, color: th.colors.text },
  sheetHint: {
    ...textStyles.tag, color: th.colors.mutedLight,
    lineHeight: 15, paddingTop: spacing.sm, paddingHorizontal: spacing.xs2,
  },

  // Stage pills
  stagePillsRow: {
    borderBottomWidth: borders.thin,
    borderBottomColor: th.colors.border,
  },
  stagePillsContent: {
    paddingHorizontal: spacing.lg,
    paddingVertical:   spacing.sm,
    gap:               spacing.xs,
    flexDirection:     'row',
    alignItems:        'center',
  },
  stagePill: {
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.xs,
    borderRadius:      th.radius.full,
    borderWidth:       borders.thin,
    borderColor:       th.colors.border,
    backgroundColor:   th.colors.surface2,
  },
  stagePillActive: {
    backgroundColor: withOpacity(th.colors.accent, 0.08),
    borderColor:     withOpacity(th.colors.accent, 0.3),
  },
  stagePillText: {
    fontSize:   typography.xs,
    color:      th.colors.muted,
    fontWeight: typography.medium,
  },
  stagePillTextActive: { color: th.colors.accent },
  stagePillReset: {
    paddingHorizontal: spacing.sm,
    paddingVertical:   spacing.xs,
  },
  stagePillResetText: { fontSize: typography.xs, color: th.colors.muted },

  // List
  listContent: {
    gap: spacing.md,
  },

  // Empty state
  emptyState: {
    alignItems:     'center',
    justifyContent: 'center',
    padding:        spacing.xxl,
    gap:            spacing.md,
  },
  emptyIcon: { fontSize: 32 },
  emptyText: {
    fontSize:   typography.base,
    color:      th.colors.muted,
    textAlign:  'center',
    lineHeight: typography.base * 1.7,
  },

  // ── SessionCard ──────────────────────────────────────────────────────────────
  card: {
    backgroundColor: th.colors.surface,
    borderRadius:    th.radius.md,
    overflow:        'hidden',
    marginHorizontal: spacing.lg,
  },
  cardHeader: {
    flexDirection:     'row',
    // flex-start y no center: la fecha tiene que quedar clavada en la esquina
    // superior, no centrada respecto a las dos filas de la izquierda.
    alignItems:        'flex-start',
    paddingHorizontal: spacing.lg,
    paddingVertical:   spacing.md,
    gap:               spacing.sm,
  },
  cardHeaderLeft: {
    flex: 1,
    gap:  spacing.sm,
  },
  cardIdRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },

  // El nombre baja de `cardTitle` (16) a `cardType` (12) para que la tarjeta no
  // crezca al ganar la fila de datos: dos filas compactas ocupan lo mismo que
  // el título grande + la línea de metadatos de antes.
  cardSesName: {
    ...textStyles.cardType,
    color:      th.colors.text,
    flexShrink: 1,
  },
  cardSesLetter: { ...textStyles.cardType, color: th.colors.accent },
  cardStage:     { ...textStyles.tag, color: th.colors.muted, flexShrink: 0 },

  // ── Fila de datos ──
  cardStatsRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm },
  cardStat:     { ...textStyles.tag, color: th.colors.mutedLight },
  cardStatNum:  { ...textStyles.cardType, color: th.colors.text },
  cardStatUnit: { ...textStyles.tag, color: th.colors.mutedLight },
  cardStatSep:  { ...textStyles.tag, color: th.colors.muted2 },
  deltaUp:      { color: th.colors.accent },
  deltaDown:    { color: th.tint.red50 },

  cardDateCorner: { ...textStyles.tag, color: th.colors.mutedLight },
  detailMeta:     { ...textStyles.tag, color: th.colors.muted, marginBottom: spacing.sm },

  noteTag: {
    backgroundColor: withOpacity(th.colors.accent, 0.08),
    borderWidth:     borders.thin,
    borderColor:     withOpacity(th.colors.accent, 0.25),
    borderRadius:    3,
    paddingHorizontal: 5,
    paddingVertical:   1,
  },
  noteTagText: {
    fontSize:      8,
    fontWeight:    typography.bold,
    color:         th.colors.accent,
    letterSpacing: 0.5,
  },
  adaptedTag: {
    backgroundColor:   withOpacity(th.colors.blue, 0.1),
    borderWidth:       borders.thin,
    borderColor:       withOpacity(th.colors.blue, 0.3),
    borderRadius:      3,
    paddingHorizontal: 5,
    paddingVertical:   1,
  },
  adaptedTagText: {
    fontSize:      8,
    fontWeight:    typography.bold,
    color:         th.colors.blue,
    letterSpacing: 0.5,
  },
  cardHeaderRight: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.sm,
    flexShrink:    0,
  },
  deleteBtn:     { padding: spacing.xs },
  deleteBtnText: { fontSize: 18, color: th.colors.muted2 },

  // Detail — separación por espaciado, sin líneas divisorias (Figma no muestra
  // ningún separador interno en la tarjeta expandida)
  detail: {
    gap: spacing.md,
    paddingBottom: spacing.sm,
  },
  noteSection: {
    padding:         spacing.md,
    backgroundColor: withOpacity(th.colors.accent, 0.04),
    borderLeftWidth: 2,
    borderLeftColor: withOpacity(th.colors.accent, 0.3),
    gap:             spacing.xs,
  },
  noteSectionLabel: {
    fontSize:      typography.xs,
    fontWeight:    typography.bold,
    color:         th.colors.accent,
    letterSpacing: 1.5,
    opacity:       0.8,
  },
  noteSectionText: {
    fontSize:   typography.sm,
    color:      th.colors.text,
    lineHeight: typography.sm * 1.6,
  },
  exSection: {
    paddingHorizontal: spacing.lg,
    gap:               spacing.xs,
  },
  exName: {
    ...textStyles.cardType,
    color: th.colors.text,
  },
  exNote: {
    fontSize:   typography.xs,
    color:      th.colors.accent,
    fontStyle:  'italic',
    lineHeight: 16,
  },

  // ── Conditioning blocks (v1: one compact line per block) ────────────────────
  blockLine: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing.xs,
    paddingHorizontal: spacing.md,
  },
  badge: {
    paddingHorizontal: spacing.xs + 2,
    paddingVertical:   1,
    borderRadius:      th.radius.xs,
  },
  badgeText: { fontSize: 9, fontWeight: typography.bold, letterSpacing: 0.5 },
  badgeBlockAmrap:       { backgroundColor: withOpacity(th.colors.accent, 0.12) },
  badgeBlockAmrapText:   { color: th.colors.accent },
  badgeBlockEmom:        { backgroundColor: withOpacity(th.colors.blue, 0.12) },
  badgeBlockEmomText:    { color: th.colors.blue },
  badgeBlockForTime:     { backgroundColor: withOpacity(th.colors.orange, 0.12) },
  badgeBlockForTimeText: { color: th.colors.orange },
  blockLineName: {
    flex:       1,
    fontSize:   typography.sm,
    fontWeight: typography.medium,
    color:      th.colors.text,
  },
  blockLineScore: {
    fontSize:      typography.sm,
    fontWeight:    typography.bold,
    color:         th.colors.text,
    fontVariant:   ['tabular-nums'],
  },

  // Outer wrap — groups (weight-pill + its reps pills) wrap as a unit, with a
  // bigger gap between groups than inside one.
  setPills: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           spacing.sm,
  },
  // One weight-run: the weight pill glued to its reps/RPE pills.
  setGroup: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.xs,
  },

  // Weight pill — no background, three colored spans ("80" / "Kg" / " x").
  // pl-only (no pr) so the "x" sits glued to the following reps pill group.
  weightPill: {
    paddingLeft:     spacing.sm,
    paddingVertical: spacing.sm,
  },
  weightPillText: {
    ...textStyles.tag,
  },
  weightPillNum:  { color: th.colors.accent },
  weightPillUnit: { color: th.colors.text },
  weightPillX:    { color: th.colors.mutedLight },

  // Pills — base (gray = not done). No border in Figma for any pill variant.
  setPill: {
    backgroundColor:   th.colors.surface2,
    borderRadius:      th.radius.xs,
    padding:           spacing.sm,
  },
  // Accent — done and within range (FormaFit: no green here, accent instead)
  setPillDone: {
    backgroundColor: th.tint.accent10,
  },
  // Orange — done but below range
  setPillPartial: {
    backgroundColor: th.tint.orange30,
  },
  setPillText: {
    ...textStyles.tag,
    color: th.colors.mutedLight,
  },
  setPillTextDone: {
    color: th.colors.accent,
  },
  setPillTextPartial: {
    color: th.colors.orange,
  },
  // The "@" glyph in "12@8" — dimmer than the surrounding numbers, which stay
  // in the pill's solid variant color (Figma: only the "@" span is tinted).
  setPillRpeAt:        { color: th.colors.mutedLight },
  setPillRpeAtDone:    { color: th.tint.accent50 },
  setPillRpeAtPartial: { color: th.tint.orange50 },

  // ── Date filter chip ─────────────────────────────────────────────────────────
  dateFilterRow: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: spacing.lg,
    paddingVertical:   spacing.sm,
    gap:               spacing.xs,
    borderBottomWidth: borders.thin,
    borderBottomColor: th.colors.border,
    backgroundColor:   withOpacity(th.colors.accent, 0.06),
  },
  dateFilterLabel: {
    flex:       1,
    fontSize:   typography.sm,
    fontWeight: typography.medium,
    color:      th.colors.accent,
  },
  dateFilterClose: {
    padding:         4,
    borderRadius:    th.radius.sm,
    backgroundColor: withOpacity(th.colors.accent, 0.12),
  },
  dateFilterCloseText: {
    fontSize:   typography.xs,
    color:      th.colors.accent,
    fontWeight: typography.bold,
  },
});
