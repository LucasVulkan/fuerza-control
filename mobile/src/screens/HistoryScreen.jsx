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
import Reanimated, { LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../store/useStore';
import AppHeader from '../components/AppHeader';
import SegmentedControl from '../components/ui/SegmentedControl';
import DragSheet from '../components/DragSheet';
import SessionCard from '../components/SessionCard';
import { ArrowIcon } from '../components/ui/EditorIcons';
import { spacing, typography, borders, withOpacity, textStyles, sheetRowBase } from '../theme';
import { useTheme, useThemedStyles } from '../useTheme';
import { volumeDeltas } from '../../../src/utils/sessionRecap';
import { internalLoad } from '../../../src/utils/trainingLoad';

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
            style={styles.cardGutter}
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
  sheetRow: { ...sheetRowBase(th), justifyContent: 'space-between' },
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

  // List — la lista va a sangre (el calendario de la cabecera lleva sus propios
  // bordes de lado a lado), así que el margen lateral lo pone cada tarjeta.
  listContent: {
    gap: spacing.md,
  },
  cardGutter: { marginHorizontal: spacing.lg },

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
