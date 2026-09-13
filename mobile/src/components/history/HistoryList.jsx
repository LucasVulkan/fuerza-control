/**
 * HistoryList — la lista de sesiones registradas, con su filtro y su menú de
 * gestión.
 *
 * Era una pantalla con su pestaña propia. Pasa a ser el tercer segmento de
 * Progresión (spec tab-programa.md §5): el historial no necesitaba una pestaña
 * de la barra, y su hueco lo ocupa «Programa». Al dejar de ser pantalla pierde
 * su `AppHeader`, su contenedor y el `paddingTop` del notch — los pone
 * `StatsScreen`, que es quien la monta ahora.
 *
 * `header` es el conmutador de Progresión, que viaja DENTRO del scroll como en
 * las otras dos pestañas. Se antepone al resto de la cabecera de la lista y se
 * pasa **como elemento**, nunca como función: `ListHeaderComponent={() => …}`
 * remonta la cabecera en cada render y se lleva por delante el scroll.
 *
 * El calendario de calor que tenía arriba se fue a la pestaña de Carga: pintaba
 * `internalLoad`, que es de allí. Ver `stats/LoadCalendar.jsx`.
 */
import { useState, useMemo } from 'react';
import { View, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { Text } from '../ui/Text';
import Svg, { Path } from 'react-native-svg';
import Reanimated, { LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../../store/useStore';
import { programTemplateIds as programTemplateIds_ } from '../../utils/clientLogs';
import DragSheet from '../DragSheet';
import SheetRow from '../ui/SheetRow';
import { Section, MenuRow } from '../ui/MenuList';
import SessionCard from '../SessionCard';
import { spacing, textStyles, lh } from '../../theme';
import { useTheme, useThemedStyles } from '../../useTheme';
import { volumeDeltas } from '../../utils/sessionRecap';


function CheckIcon({ size = 16, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M20 6L9 17l-5-5" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// ── Lista ──────────────────────────────────────────────────────────────────────

export default function HistoryList({ header }) {
  const insets = useSafeAreaInsets();
  const { t }  = useTranslation();
  const th     = useTheme();
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
  const [menuOpen,         setMenuOpen]         = useState(false);
  const [filterOpen,       setFilterOpen]       = useState(false);

  const hasStages = (activeProgram?.stages?.length ?? 0) > 0;


  function handleScope(newScope) {
    setScope(newScope);
    setSelectedStageIds(new Set());
  }

  // Lo que dice el chip: el ámbito, y la etapa sólo cuando se ha filtrado por
  // alguna (sin filtro se miran todas, que es lo que ya dice "programa actual").
  const stageFilterLabel = () => {
    if (scope !== 'program' || !hasStages || selectedStageIds.size === 0) return null;
    if (selectedStageIds.size === 1) {
      const only = activeProgram.stages.find((st, idx) => selectedStageIds.has(st.id ?? idx));
      return only?.name ?? null;
    }
    return t('history.stagesCount', { count: selectedStageIds.size });
  };
  const scopeLabel  = scope === 'program' ? t('history.currentProgram') : t('history.all');
  const stageLabel  = stageFilterLabel();
  const filterLabel = stageLabel ? `${scopeLabel} · ${stageLabel}` : scopeLabel;

  function toggleStage(stageId) {
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

  const filtered = useMemo(() => {
    let list = [...workoutLog];
    if (scope === 'program' && effectiveTemplateIds.size > 0) {
      list = list.filter((e) => effectiveTemplateIds.has(e.sessionTemplateId));
    }
    return list.sort((a, b) => b.timestamp - a.timestamp);
  }, [workoutLog, scope, effectiveTemplateIds]);

  /**
   * Borrado en bloque. Destructivo y sin deshacer, así que va con confirmación
   * nativa que dice cuántas sesiones se van y recuerda exportar. La cuenta se
   * calcula antes para que el aviso sea concreto y no un "esto borrará datos".
   */
  function confirmClear(scopeId) {
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
      {/* La lista va a sangre y cada tarjeta pone su propio margen, así que el
          conmutador necesita el suyo: en las otras dos pestañas se lo da el
          `contentContainer`. Mismo aire arriba que allí (`paddingTop: lg`). */}
      {!!header && <View style={styles.headerGutter}>{header}</View>}
      {/* Un solo control: ámbito y etapas viven dentro de la hoja que abre
          este chip. Apilados fuera —conmutador + tira de pastillas— eran dos
          filas de filtro antes de la primera sesión, y con el conmutador de
          Progresión encima habrían sido tres (spec tab-programa.md §5.1). */}
      <View style={styles.scopeRow}>
        <TouchableOpacity
          style={styles.filterChip}
          onPress={() => setFilterOpen(true)}
          activeOpacity={0.75}
          accessibilityRole="button"
        >
          <Text style={styles.filterChipText} numberOfLines={1}>{filterLabel}</Text>
          <Text style={styles.filterChipCaret}>{'▾'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.menuBtn}
          onPress={() => setMenuOpen(true)}
          activeOpacity={0.75}
          hitSlop={8}
        >
          <Text style={styles.menuBtnGlyph}>···</Text>
        </TouchableOpacity>
      </View>
    </>
  );

  return (
    <View style={styles.container}>
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
              {scope === 'program'
                ? t('history.noSessionsProgram')
                : t('history.noSessionsEmpty')}
            </Text>
          </View>
        }
      />

      {/* Filtros — ámbito arriba, etapas debajo. Elegir ámbito cierra (es una
          decisión y una sola); marcar etapas no, porque se marcan varias. */}
      {filterOpen && (
        <DragSheet visible onClose={() => setFilterOpen(false)} title={t('history.filterTitle')}>
          <Section title={t('history.scopeLabel')}>
            {[
              { id: 'program', label: t('history.currentProgram') },
              { id: 'all',     label: t('history.all') },
            ].map(({ id, label }) => (
              <MenuRow
                key={id}
                label={label}
                labelColor={scope === id ? th.colors.accent : undefined}
                onPress={() => { handleScope(id); setFilterOpen(false); }}
                control={scope === id
                  ? <CheckIcon size={16} color={th.colors.accent} />
                  : <View style={styles.rowControlSpacer} />}
              />
            ))}
          </Section>

          {scope === 'program' && hasStages && (
            <Section title={t('history.stagesLabel')}>
              {activeProgram.stages.map((stage, idx) => {
                const stageId = stage.id ?? idx;
                // Sin ninguna marcada se miran TODAS, así que todas salen
                // marcadas: es lo que de verdad está entrando en la lista.
                const on = selectedStageIds.size === 0 || selectedStageIds.has(stageId);
                return (
                  <MenuRow
                    key={stageId}
                    label={stage.name}
                    labelColor={on ? th.colors.accent : undefined}
                    onPress={() => toggleStage(stageId)}
                    control={on
                      ? <CheckIcon size={16} color={th.colors.accent} />
                      : <View style={styles.rowControlSpacer} />}
                  />
                );
              })}
            </Section>
          )}
        </DragSheet>
      )}

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
  // El chip: la misma caja que el `⋯` que tiene al lado, con el ancho que
  // sobra. `surface2` porque es un control, no un dato.
  filterChip: {
    flex:              1,
    height:            42,
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius:      th.radius.sm,
    backgroundColor:   th.colors.surface2,
  },
  filterChipText:  { ...textStyles.labelStrong, flex: 1, color: th.colors.text },
  filterChipCaret: { ...textStyles.label, color: th.colors.mutedLight },
  rowControlSpacer: { width: 16 },
  // 42×42 = misma caja que los botones que acompañan a la barra de búsqueda
  // (docs/UI-MIGRATION.md §9), para que las cajas de acción sean una sola familia.
  menuBtn: {
    width: 42, height: 42, borderRadius: th.radius.sm,
    backgroundColor: th.colors.surface2,
    alignItems: 'center', justifyContent: 'center',
  },
  menuBtnGlyph: { ...textStyles.itemTitle, color: th.colors.text, marginTop: -6 },

  // ── Hoja de gestión ──
  sheetBody: { gap: spacing.xs2, paddingBottom: spacing.sm },
  sheetHint: {
    ...textStyles.label, color: th.colors.mutedLight,
    lineHeight: 15, paddingTop: spacing.sm, paddingHorizontal: spacing.xs2,
  },

  // List — la lista va a sangre (el calendario de la cabecera lleva sus propios
  // bordes de lado a lado), así que el margen lateral lo pone cada tarjeta.
  listContent: {
    gap: spacing.md,
  },
  cardGutter:   { marginHorizontal: spacing.lg },
  headerGutter: { marginHorizontal: spacing.lg, marginTop: spacing.lg },

  // Empty state
  emptyState: {
    alignItems:     'center',
    justifyContent: 'center',
    padding:        spacing.xxl,
    gap:            spacing.md,
  },
  emptyIcon: { fontSize: 32 },
  emptyText: {
    ...textStyles.body,
    color:      th.colors.muted,
    textAlign:  'center',
    lineHeight: lh(textStyles.body.fontSize),
  },
});
