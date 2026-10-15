/**
 * HistoryList — la lista de sesiones registradas, con su filtro y su menú de
 * gestión.
 *
 * Era una pantalla con su pestaña propia. Pasa a ser el tercer segmento de
 * Progresión (spec U07-tab-programa.md §5): el historial no necesitaba una pestaña
 * de la barra, y su hueco lo ocupa «Programa». Al dejar de ser pantalla pierde
 * su `AppHeader`, su contenedor y el `paddingTop` del notch — los pone
 * `StatsScreen`, que es quien la monta ahora.
 *

 * El calendario de calor que tenía arriba se fue a la pestaña de Carga: pintaba
 * `internalLoad`, que es de allí. Ver `stats/LoadCalendar.jsx`.
 */
import { useState, useMemo } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Text } from '../ui/Text';
import Svg, { Path } from 'react-native-svg';
import Reanimated, { LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../../store/useStore';
import { programTemplateIds as programTemplateIds_ } from '../../utils/clientLogs';
import { programTemplateOf, isFreeEntry } from '../../utils/freeSessions';
import DragSheet from '../DragSheet';
import SheetRow from '../ui/SheetRow';
import { Section, MenuRow } from '../ui/MenuList';
import EmptyState from '../ui/EmptyState';
import { ROW_ICON } from '../ui/rowIcons';
import SessionCard from '../SessionCard';
import SegmentedControl from '../ui/SegmentedControl';
import RoundCheck from '../ui/RoundCheck';
import { spacing, textStyles, withOpacity } from '../../theme';
import { useTheme, useThemedStyles } from '../../useTheme';
import { volumeDeltas } from '../../utils/sessionRecap';


import { showDialog } from '../ui/dialog';

// La letra de una entrada en la tira: la de su plantilla, o ★ si es libre
// (como en la propia tarjeta, `SessionCard`).
const FREE = '★';

// ── Lista ──────────────────────────────────────────────────────────────────────

export default function HistoryList() {
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);

  const workoutLog      = useStore((s) => s.workoutLog);
  const deleteLogEntry  = useStore((s) => s.deleteLogEntry);
  const clearWorkoutLog = useStore((s) => s.clearWorkoutLog);
  const showToast       = useStore((s) => s.showToast);
  const programs        = useStore((s) => s.programs);
  const getEffectiveTemplate = useStore((s) => s.getEffectiveTemplate);
  const profile         = useStore((s) => s.profile);
  const activeProgram   = programs[profile.activeProgramId];

  const [scope,            setScope]            = useState('all');
  const [selectedStageIds, setSelectedStageIds] = useState(new Set());
  // Una sesión o todas (null): se filtra por una entera, no por dos o tres.
  const [letter,           setLetter]           = useState(null);
  const [filterOpen,       setFilterOpen]       = useState(false);

  const hasStages = (activeProgram?.stages?.length ?? 0) > 0;


  function handleScope(newScope) {
    setScope(newScope);
    setSelectedStageIds(new Set());
    setLetter(null);
  }

  function toggleStage(stageId) {
    Haptics.selectionAsync().catch(() => {});
    setSelectedStageIds((prev) => {
      const next = new Set(prev);
      if (next.has(stageId)) next.delete(stageId); else next.add(stageId);
      return next;
    });
  }

  // El alcance "del programa" lo calcula la util compartida, que es la misma
  // que decide qué sube el cliente a su entrenador y qué se borra al purgar.
  const programTemplateIds = useMemo(
    () => programTemplateIds_(activeProgram),
    [activeProgram],
  );

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

  const letterOf = (e) => (isFreeEntry(e) ? FREE : getEffectiveTemplate(e.sessionTemplateId)?.label ?? null);

  // Lo que deja el ámbito; las letras filtran encima, y solo salen las que hay.
  const scoped = useMemo(() => {
    let list = [...workoutLog];
    if (scope === 'program' && effectiveTemplateIds.size > 0) {
      // Las libres marcadas «Cuenta como» son del programa (T06-free-sessions.md §8).
      list = list.filter((e) => effectiveTemplateIds.has(programTemplateOf(e)));
    }
    return list.sort((a, b) => b.timestamp - a.timestamp);
  }, [workoutLog, scope, effectiveTemplateIds]);

  // Una pill por sesión del programa, tenga o no registros; «Libres» solo si
  // hay alguna libre en la lista.
  const present = useMemo(() => {
    const labels = new Set([...programTemplateIds]
      .map((id) => getEffectiveTemplate(id)?.label).filter(Boolean));
    const sorted = [...labels].sort((a, b) => a.localeCompare(b));
    return scoped.some(isFreeEntry) ? [...sorted, FREE] : sorted;
  }, [programTemplateIds, scoped, getEffectiveTemplate]);

  const filtered = useMemo(
    () => (letter ? scoped.filter((e) => letterOf(e) === letter) : scoped),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scoped, letter, getEffectiveTemplate],
  );

  // Las filas, con una cabecera por mes: el historial ya va por fecha, y el mes
  // sitúa sin otro filtro. Cada bloque redondea sus extremos.
  const rows = useMemo(() => {
    const out = [];
    let block = [];
    let month = null;
    const flush = () => {
      block.forEach((r, i) => { r.isFirst = i === 0; r.isLast = i === block.length - 1; });
      out.push(...block);
      block = [];
    };
    const locale = i18n.language === 'en' ? 'en-GB' : 'es-ES';
    filtered.forEach((e) => {
      const d = new Date(e.timestamp);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      if (key !== month) {
        flush();
        month = key;
        out.push({ id: `m-${key}`, month: `${d.toLocaleDateString(locale, { month: 'long' })} ${d.getFullYear()}` });
      }
      block.push({ id: e.id, entry: e });
    });
    flush();
    return out;
  }, [filtered, i18n.language]);

  const filterCount = (scope === 'program' ? 1 : 0) + selectedStageIds.size;

  /**
   * Borrado en bloque. Destructivo y sin deshacer, así que va con confirmación
   * nativa que dice cuántas sesiones se van y recuerda exportar. La cuenta se
   * calcula antes para que el aviso sea concreto y no un "esto borrará datos".
   */
  function confirmClear(scopeId) {
    const willDelete = scopeId === 'all'
      ? workoutLog.length
      : workoutLog.filter((e) => !programTemplateIds.has(programTemplateOf(e))).length;

    if (willDelete === 0) {
      showToast(t('history.clearNothing'), 2200, 'neutral');
      return;
    }
    showDialog(
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

  // Arriba, las sesiones en un segmentado a todo el ancho («Todas», una por
  // sesión del programa y ★ si hay libres). Debajo, qué se está viendo y la
  // caja de filtros (ámbito, etapas y borrado).
  const listHeader = (
    <>
      {present.length > 0 && (
        <View style={styles.sessionsRow}>
          <SegmentedControl
            options={[
              { id: 'all', label: t('history.allSessions') },
              ...present.map((l) => ({ id: l, label: l })),
            ]}
            value={letter ?? 'all'}
            onChange={(id) => setLetter(id === 'all' ? null : id)}
          />
        </View>
      )}
      <View style={styles.scopeRow}>
        <Text style={styles.countLine} numberOfLines={1}>
          {t('history.sessionsN', { count: filtered.length })}
          {letter ? ` · ${letter === FREE ? t('history.freePlural') : letter}` : ''}
        </Text>
        <TouchableOpacity
          style={[styles.iconBox, filterCount > 0 && styles.iconBoxActive]}
          onPress={() => setFilterOpen(true)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={t('history.filterTitle')}
        >
          <Svg viewBox="0 0 24 24" width={20} height={20} fill="none"
            stroke={filterCount > 0 ? th.colors.accent : th.colors.text}
            strokeWidth={2} strokeLinecap="round">
            <Path d="M3 6h18M6 12h12M9 18h6" />
          </Svg>
          {filterCount > 0 && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{filterCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </>
  );

  return (
    <View style={styles.container}>
      <Reanimated.FlatList
        itemLayoutAnimation={LinearTransition.duration(240)}
        data={rows}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={listHeader}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: spacing.xxl + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (item.month ? (
          <Text style={styles.month}>{item.month}</Text>
        ) : (
          <SessionCard
            session={item.entry}
            onDelete={deleteLogEntry}
            volumeDelta={deltas.get(item.id) ?? null}
            style={styles.cardGutter}
            isFirst={item.isFirst}
            isLast={item.isLast}
          />
        ))}
        ListEmptyComponent={
          <EmptyState
            style={styles.emptyState}
            icon={ROW_ICON.history}
            text={(scope === 'program' || letter)
              ? t('history.noSessionsProgram')
              : t('history.noSessionsEmpty')}
          />
        }
      />

      {/* Filtros: ámbito y etapas; al final, separado y en rojo, el borrado
          (lo que antes colgaba del «···»). */}
      <DragSheet
        visible={filterOpen}
        onClose={() => setFilterOpen(false)}
        title={t('history.filterTitle')}
        action={filterCount > 0 ? { label: t('exerciseSelector.filters.clear'), onPress: () => handleScope('all') } : undefined}
      >
        <View style={styles.sheetBody}>
          <Text style={styles.sheetCaps}>{t('history.scopeLabel')}</Text>
          <SegmentedControl
            options={[
              { id: 'program', label: t('history.currentProgram') },
              { id: 'all',     label: t('history.all') },
            ]}
            value={scope}
            onChange={handleScope}
          />

          {scope === 'program' && hasStages && (
            <Section title={t('history.stagesLabel')} style={styles.sheetSection}>
              {activeProgram.stages.map((stage, idx) => {
                const stageId = stage.id ?? idx;
                // Sin ninguna marcada se miran TODAS, así que todas salen
                // marcadas: es lo que de verdad está entrando en la lista.
                const on = selectedStageIds.size === 0 || selectedStageIds.has(stageId);
                return (
                  <MenuRow
                    key={stageId}
                    label={stage.name}
                    onPress={() => toggleStage(stageId)}
                    control={<RoundCheck on={on} />}
                  />
                );
              })}
            </Section>
          )}

          <Section title={t('history.manageTitle')} style={styles.sheetSection}>
            <SheetRow icon={ROW_ICON.history} label={t('history.clear.off_program.action')} onPress={() => confirmClear('off_program')} danger />
            <SheetRow icon={ROW_ICON.trash}   label={t('history.clear.all.action')}         onPress={() => confirmClear('all')}         danger />
          </Section>
          <Text style={styles.sheetHint}>{t('history.clearHint')}</Text>
        </View>
      </DragSheet>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const makeStyles = (th) => StyleSheet.create({
  container: {
    flex:            1,
    backgroundColor: th.colors.bg,
  },

  // Fila de arriba: la cápsula de letras y la caja de filtros (la de Clientes).
  flex: { flex: 1 },
  scopeRow: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing.sm2,
    paddingHorizontal: spacing.lg,
    paddingTop:        spacing.md,
  },
  sessionsRow: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  iconBox: {
    width: 42, height: 42, borderRadius: th.radius.sm,
    backgroundColor: th.colors.surface2,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  iconBoxActive: { backgroundColor: withOpacity(th.colors.accent, 0.10) },
  filterBadge: {
    position: 'absolute', top: 3, right: 3,
    minWidth: 14, height: 14, borderRadius: 7, paddingHorizontal: 3,
    backgroundColor: th.colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  filterBadgeText: { ...textStyles.micro, fontFamily: 'Inter_900Black', color: th.colors.onAccent },
  countLine: { ...textStyles.label, color: th.colors.mutedLight, flex: 1 },
  // Mes: la caja de las cabeceras de sección, con aire encima para separar bloques.
  month: {
    ...textStyles.caps, textTransform: 'uppercase', color: th.colors.mutedLight,
    paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.xs2,
  },

  // ── Hoja de filtros ──
  sheetBody: { paddingBottom: spacing.sm },
  sheetCaps: { ...textStyles.caps, color: th.colors.mutedLight, paddingBottom: spacing.sm },
  sheetSection: { marginTop: spacing.lg, marginBottom: 0 },
  sheetHint: {
    ...textStyles.label, color: th.colors.mutedLight,
    lineHeight: 15, paddingTop: spacing.sm, paddingHorizontal: spacing.xs2,
  },

  // List — la lista va a sangre (el calendario de la cabecera lleva sus propios
  // bordes de lado a lado), así que el margen lateral lo pone cada tarjeta.
  // Bloque agrupado, como la lista de Progreso/Ejercicios: 2 de hueco y radios
  // por posición (los pone `SessionCard` con `isFirst`/`isLast`). Que las filas
  // crezcan al desplegarse no lo impide — la abierta se redondea entera
  // mientras lo está, animado.
  listContent: {
    gap: spacing.xs,
  },
  cardGutter: { marginHorizontal: spacing.lg },

  // Empty state
  emptyState: { paddingVertical: spacing.xxl },
});
