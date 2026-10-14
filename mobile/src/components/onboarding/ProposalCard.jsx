/**
 * Las piezas de las propuestas de programa (O01), sacadas de `OnboardingScreen`
 * para que las compartan «Nuevo programa» y el camino «por mi cuenta» del
 * recorrido nuevo (O03-04): `ProposalCard`, la fila de datos, las barras de
 * exigencia, la sesión plegable y el chevron que gira.
 */
import { useEffect } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { Text } from '../ui/Text';
import { ChevronDown } from '../ui/EditorIcons';
import { spacing, textStyles, borders } from '../../theme';
import { useTheme, useThemedStyles } from '../../useTheme';
import { resolveColor } from '../../themes';
import { estimateSessionSec } from '../../utils/sessionCompression';
import { totalWeeksOf, totalSetsOf, proposalNote } from './proposalData';

export function RotatingChevron({ open, size = 12, color }) {
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

// Fila de 3 datos — §6.2/§6.3: valor `title` en `accent`, etiqueta
// `caps` en `mutedLight`. `bordered` añade el filete vertical entre
// columnas y el filete horizontal arriba/abajo (propuestas); el preview usa
// la misma fila sin ninguno de los dos.
export function StatsRow({ items, bordered = false, card = false }) {
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
export function Pips({ filled, total = 3 }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.pips}>
      {Array.from({ length: total }, (_, i) => (
        <View key={i} style={[styles.pip, i < filled && styles.pipOn]} />
      ))}
    </View>
  );
}

/** Una sesión del programa, plegable, con sus ejercicios. Se conserva (§6.4):
 * sin borde y con `ChevronDown` girando en vez del triángulo relleno. */
export function SessionRow({ tpl, index, allEx, exName, expanded, onToggle, countsWarmup }) {
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { t }  = useTranslation();
  const accent = resolveColor(th, tpl.color ?? 'var(--day1)');
  // Duración estimada con el MISMO criterio que el recorte (P04-program-templates.md
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
export default function ProposalCard({ entry, recommended, daysPerWeek, onPress }) {
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

const makeStyles = (th) => StyleSheet.create({
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
  statValue:    { ...textStyles.title, lineHeight: 26, color: th.colors.accent },
  statLabel:    { ...textStyles.caps, color: th.colors.mutedLight },
  pips:         { flexDirection: 'row', gap: 3, height: 24, alignItems: 'center' },
  pip:          { width: 14, height: 8, borderRadius: th.radius.xxs ?? 2, backgroundColor: th.colors.muted },
  pipOn:        { backgroundColor: th.colors.accent },

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
  previewSessionLetter: { ...textStyles.heading, fontFamily: 'Inter_900Black', lineHeight: 20, width: 16 },
  previewSessionInfo: { flex: 1 },
  previewSessionHeader: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
  },
  previewSessionName: { ...textStyles.itemTitle, color: th.colors.text, flex: 1 },
  previewSessionMeta: { ...textStyles.body, color: th.colors.mutedLight, marginTop: spacing.xs2 },
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
  // (`ProgramDetailScreen`: número en `labelStrong`/accent, nombre en `body`,
  // meta en `label`). Se conserva la densidad de aquí —número estrecho y
  // alineado a la derecha— porque esta lista vive dentro de una tarjeta
  // plegable, no en una pantalla de detalle a ancho completo.
  previewExOrder: {
    ...textStyles.labelStrong,
    color:      th.colors.accent,
    width:      16,
    textAlign:  'right',
    paddingTop: 2,
  },
  previewExName: { ...textStyles.body, color: th.colors.text },
  previewExMeta: {
    ...textStyles.label,
    color:     th.colors.mutedLight,
    marginTop: 1,
  },

  // Propuestas — tarjeta de plantilla candidata
  proposalCard: {
    backgroundColor: th.colors.surface,
    borderRadius:    th.radius.md,
    overflow:        'hidden',
  },
  proposalHead: { padding: spacing.lg, gap: spacing.sm },
  proposalTitleLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  proposalName:  { ...textStyles.itemTitle, flex: 1, color: th.colors.text },
  // Badge sólido (activeBadge de ProgramEditorScreen/StagePlannerScreen).
  proposalBadge: {
    backgroundColor:   th.colors.accent,
    borderRadius:      th.radius.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical:   spacing.xs2,
  },
  proposalBadgeText: { ...textStyles.caps, color: th.colors.onAccent },
  proposalByline:    { ...textStyles.body, color: th.colors.mutedLight },
  proposalSummary: { ...textStyles.body, color: th.colors.text, lineHeight: 12 * 1.6, paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.xs2 },
  proposalNote:    { ...textStyles.body, color: th.colors.mutedLight, lineHeight: 12 * 1.5, paddingHorizontal: spacing.lg, paddingBottom: spacing.md },

  proposalSessions: { paddingVertical: spacing.sm },
  proposalSessionRow: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical:   spacing.sm,
  },
  proposalSessionLetter: { ...textStyles.heading, fontFamily: 'Inter_900Black', lineHeight: 20, width: 16 },
  proposalSessionInfo:   { flex: 1, gap: 2, minWidth: 0 },
  proposalSessionName:   { ...textStyles.body, color: th.colors.text },
  proposalSessionMeta:   { ...textStyles.label, color: th.colors.mutedLight },
});
