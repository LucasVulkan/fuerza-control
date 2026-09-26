/**
 * SessionCard — tarjeta de sesión del historial.
 *
 * Vive aquí y no dentro de HistoryScreen porque la usan dos pantallas: el
 * historial propio y el tab "Historial" de la ficha de cliente. Todo lo que
 * lee del store es global (plantillas, programas, librería de ejercicios), así
 * que sirve igual para las sesiones del cliente; el borrado entra por prop.
 */
import { useState, useMemo } from 'react';
import { View, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { Text } from './ui/Text';
// Reanimated drives both the delete-card exit + sibling reflow (`exiting`/
// `layout`) and the detail accordion (`FadeIn`/`FadeOut` + the card's own
// `layout` animates the height change) — one animation system, no JS-driven
// Animated.Value height chase fighting the UI-thread layout transition.
import Reanimated, {
  LinearTransition, SlideOutRight, FadeIn, FadeOut,
  useAnimatedStyle, withTiming,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../store/useStore';
import { useWeightUnit } from '../hooks/useWeightUnit';
import { spacing, withOpacity, textStyles, lh, getCardRadii } from '../theme';
import { useTheme, useThemedStyles } from '../useTheme';
import { formatDate } from '../utils/formatters';
import { formatBlockScore } from '../utils/conditioningBlocks';
import { recapStats } from '../utils/sessionRecap';
import { buildSetLabel, groupSetsByWeight, getPillVariant } from '../utils/setDisplay';
import { isFreeEntry } from '../utils/freeSessions';

// Same badge-per-format mapping as SessionEditorScreen's block rows / recap.
const BLOCK_BADGE_STYLE = {
  amrap:    'badgeBlockAmrap',
  emom:     'badgeBlockEmom',
  for_time: 'badgeBlockForTime',
};

// `isFirst`/`isLast` colocan la tarjeta dentro del bloque agrupado (radios por
// posición, como la lista de Progreso/Ejercicios). Por defecto es una tarjeta
// suelta —así la pinta la ficha de cliente, que no agrupa.
export default function SessionCard({ session, onDelete, volumeDelta = null, style, isFirst = true, isLast = true }) {
  const { t, i18n } = useTranslation();
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { fmt: fmtWeight, toDisplay, unit } = useWeightUnit();
  const unitLabel = unit.charAt(0).toUpperCase() + unit.slice(1);

  const [open, setOpen] = useState(false);

  // Los radios no los anima `LinearTransition` —sólo mide geometría—, así que
  // van en su propio `useAnimatedStyle`: cada `withTiming` reacciona a que
  // cambie su destino. Cubre los dos casos con el mismo código: la fila abierta
  // se redondea entera (deja de ser pieza del bloque mientras enseña el
  // detalle) y la vecina que hereda el radio grande al borrar un extremo no lo
  // cambia en seco.
  const radii = open
    ? { borderTopLeftRadius: th.radius.md, borderTopRightRadius: th.radius.md,
        borderBottomLeftRadius: th.radius.md, borderBottomRightRadius: th.radius.md }
    : getCardRadii(th, isFirst, isLast);
  const radiiStyle = useAnimatedStyle(() => ({
    borderTopLeftRadius:     withTiming(radii.borderTopLeftRadius,     { duration: 240 }),
    borderTopRightRadius:    withTiming(radii.borderTopRightRadius,    { duration: 240 }),
    borderBottomLeftRadius:  withTiming(radii.borderBottomLeftRadius,  { duration: 240 }),
    borderBottomRightRadius: withTiming(radii.borderBottomRightRadius, { duration: 240 }),
    // Deps explícitas: `radii` es un objeto nuevo en cada render y sin esto el
    // worklet se rehace en cualquier repintado, reiniciando un `withTiming` a
    // medio camino.
  }), [radii.borderTopLeftRadius, radii.borderTopRightRadius,
       radii.borderBottomLeftRadius, radii.borderBottomRightRadius]);

  const getEffectiveTemplate = useStore((s) => s.getEffectiveTemplate);
  const exerciseLibrary      = useStore((s) => s.exerciseLibrary);
  const customExercises      = useStore((s) => s.customExercises);
  const allExercises = { ...exerciseLibrary, ...customExercises };

  // Las dos clases de sesión libre (free-sessions.md §4.2); en el móvil del
  // entrenador la plantilla no existe y la entrada es la única pista.
  const isFree   = isFreeEntry(session);
  const template = isFree ? null : getEffectiveTemplate(session.sessionTemplateId);
  const label    = template?.label ?? '?';
  const name     = session.sessionName ?? (isFree ? t('freeSession.historyLabel') : (template?.name ?? session.sessionTemplateId));

  // exConfig lookup for pill range comparisons
  const exConfigs = useMemo(() => {
    const map = {};
    (template?.exercises ?? []).forEach((ec) => { map[ec.exerciseId] = ec; });
    return map;
  }, [template]);

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

      {/* Borrar vive aquí y no en la cabecera: es una acción rara y destructiva,
          y ahí competía por la esquina con la fecha —que sí se consulta— con
          dos alturas de texto que no había forma de alinear. Mismo tratamiento
          que "Descartar sesión" en el recap. */}
      <TouchableOpacity onPress={handleDelete} style={styles.deleteRow} activeOpacity={0.7}>
        <Text style={styles.deleteRowText}>{t('history.deleteTitle')}</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    // Reanimated's standard list-item primitives, not hand-rolled height math:
    // `exiting` plays the exit animation on the UI thread and defers the actual
    // unmount until it finishes; `layout` on every card (this one included) makes
    // siblings glide into the freed space automatically once it does.
    <Reanimated.View layout={LinearTransition.duration(240)} exiting={SlideOutRight.duration(240)} style={style}>
      <Reanimated.View style={[styles.card, radiiStyle]}>
          {/* Header — tap to expand */}
          <TouchableOpacity
            style={styles.cardHeader}
            onPress={() => setOpen((o) => !o)}
            activeOpacity={0.75}
          >
            <View style={styles.cardHeaderLeft}>
              {/* La letra va en su propia columna, centrada contra el bloque
                  entero (nombre + datos) — igual que en el editor de programa,
                  no como prefijo del nombre. La etapa se cayó de aquí: alargaba
                  la fila sin decir nada que no dijera ya el nombre. */}
              <Text style={styles.cardSesLetter}>{isFree ? '★' : label}</Text>
              <View style={styles.cardHeaderText}>
                <Text style={styles.cardSesName} numberOfLines={1}>{name}</Text>

                {/* Una sola línea de metadatos, como las filas de
                    Progreso/Ejercicios: mismo cuerpo para todo y color sólo
                    donde dice algo (delta, nota, adaptada). Los números en 14
                    Bold eran lo que hacía alta la fila. */}
                <Text style={styles.cardMeta} numberOfLines={1}>
                  {`${setsDone}/${setsPlanned} ${t('history.setsShort')} · RPE ${session.sessionRpe ?? '—'}`}
                  {volumeDelta != null && (
                    <>
                      {' · '}
                      <Text style={volumeDelta >= 0 ? styles.deltaUp : styles.deltaDown}>
                        {`${volumeDelta > 0 ? '+' : ''}${volumeDelta}%`}
                      </Text>
                    </>
                  )}
                  {hasNotes && (
                    <>
                      {' · '}
                      <Text style={styles.metaNote}>{t('history.noteTag')}</Text>
                    </>
                  )}
                  {session.adapted && (
                    <>
                      {' · '}
                      <Text style={styles.metaAdapted}>{t('home.adapted')}</Text>
                    </>
                  )}
                </Text>
              </View>
            </View>

            {/* Fecha aislada en su esquina: se busca por ella, no se lee de corrido. */}
            <Text style={styles.cardDateCorner} numberOfLines={1}>{formatDate(session.timestamp)}</Text>
          </TouchableOpacity>

          {/* Expanded detail — the card's own `layout` (LinearTransition, on the
              outer Reanimated.View) animates the resulting height change. */}
          {open && (
            <Reanimated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(150)}>
              {detailContent}
            </Reanimated.View>
          )}
      </Reanimated.View>
    </Reanimated.View>
  );
}

const makeStyles = (th) => StyleSheet.create({
  // El margen lateral lo pone quien la coloca (`style`): el historial la mete
  // en una lista a sangre, la ficha de cliente en un ScrollView ya con padding.
  // Sin `borderRadius`: lo pone `radiiStyle` (posición en el bloque + abierta).
  card: {
    backgroundColor: th.colors.surface,
    overflow:        'hidden',
  },
  cardHeader: {
    flexDirection:     'row',
    // Fila compacta: las dos líneas de la izquierda miden lo mismo que la
    // fecha de la derecha, así que ya se centran entre sí (antes la fecha se
    // clavaba arriba porque el bloque izquierdo era mucho más alto).
    alignItems:        'center',
    paddingHorizontal: spacing.lg,
    paddingVertical:   spacing.md,
    gap:               spacing.sm,
  },
  cardHeaderLeft: {
    flex:          1,
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.md,
  },
  cardHeaderText: { flex: 1, minWidth: 0, gap: spacing.xs },

  // Bold a 14: manda sobre su fila de metadatos por PESO, no por cuerpo. Pasó
  // por los dos extremos antes de quedarse aquí — a 12 estaba por debajo de sus
  // propios datos, y la Black a 16 gritaba en una lista que se recorre entera.
  cardSesName: {
    ...textStyles.bodyStrong,
    color:      th.colors.text,
    flexShrink: 1,
  },
  cardSesLetter: { ...textStyles.itemTitle, color: th.colors.accent, textAlign: 'center', minWidth: 16 },

  // ── Línea de datos ──
  cardMeta:    { ...textStyles.label, color: th.colors.mutedLight },
  deltaUp:     { color: th.colors.accent },
  deltaDown:   { color: th.tint.red50 },
  metaNote:    { color: th.colors.accent },
  metaAdapted: { color: th.colors.blue },

  cardDateCorner: { ...textStyles.label, color: th.colors.mutedLight, flexShrink: 0 },
  // `detail` no lleva padding lateral —cada sección se lo pone— así que este
  // texto suelto necesita el suyo o sale a sangre con el borde de la tarjeta.
  detailMeta: {
    ...textStyles.label,
    color:             th.colors.mutedLight,
    paddingHorizontal: spacing.lg,
    marginBottom:      spacing.sm,
  },
  deleteRow: {
    paddingHorizontal: spacing.lg,
    paddingTop:        spacing.xs,
  },
  deleteRowText: {
    ...textStyles.caps,
    textTransform: 'uppercase',
    color:         th.tint.red50,
  },


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
  noteSectionLabel: { ...textStyles.caps, color: th.colors.accent, opacity: 0.8 },
  noteSectionText: {
    ...textStyles.body,
    color:      th.colors.text,
    lineHeight: lh(textStyles.body.fontSize),
  },
  exSection: {
    paddingHorizontal: spacing.lg,
    gap:               spacing.xs,
  },
  exName: { ...textStyles.bodyStrong, color: th.colors.text },
  exNote: {
    ...textStyles.body,
    color:      th.colors.accent,
    lineHeight: lh(textStyles.body.fontSize),
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
  badgeText: { ...textStyles.caps },
  badgeBlockAmrap:       { backgroundColor: withOpacity(th.colors.accent, 0.12) },
  badgeBlockAmrapText:   { color: th.colors.accent },
  badgeBlockEmom:        { backgroundColor: withOpacity(th.colors.blue, 0.12) },
  badgeBlockEmomText:    { color: th.colors.blue },
  badgeBlockForTime:     { backgroundColor: withOpacity(th.colors.orange, 0.12) },
  badgeBlockForTimeText: { color: th.colors.orange },
  blockLineName:  { ...textStyles.body, flex: 1, color: th.colors.text },
  blockLineScore: {
    ...textStyles.bodyStrong,
    color:       th.colors.text,
    fontVariant: ['tabular-nums'],
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
    ...textStyles.label,
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
    ...textStyles.label,
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
});
