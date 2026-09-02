/**
 * SessionCard — tarjeta de sesión del historial.
 *
 * Vive aquí y no dentro de HistoryScreen porque la usan dos pantallas: el
 * historial propio y el tab "Historial" de la ficha de cliente. Todo lo que
 * lee del store es global (plantillas, programas, librería de ejercicios), así
 * que sirve igual para las sesiones del cliente; el borrado entra por prop.
 */
import { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, Alert, StyleSheet } from 'react-native';
// Reanimated drives both the delete-card exit + sibling reflow (`exiting`/
// `layout`) and the detail accordion (`FadeIn`/`FadeOut` + the card's own
// `layout` animates the height change) — one animation system, no JS-driven
// Animated.Value height chase fighting the UI-thread layout transition.
import Reanimated, { LinearTransition, SlideOutRight, FadeIn, FadeOut } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../store/useStore';
import { useWeightUnit } from '../hooks/useWeightUnit';
import { spacing, typography, borders, withOpacity, textStyles } from '../theme';
import { useThemedStyles } from '../useTheme';
import { formatDate } from '../utils/formatters';
import { formatBlockScore } from '../utils/conditioningBlocks';
import { recapStats } from '../utils/sessionRecap';
import { buildSetLabel, groupSetsByWeight, getPillVariant } from '../utils/setDisplay';

// Same badge-per-format mapping as SessionEditorScreen's block rows / recap.
const BLOCK_BADGE_STYLE = {
  amrap:    'badgeBlockAmrap',
  emom:     'badgeBlockEmom',
  for_time: 'badgeBlockForTime',
};

export default function SessionCard({ session, onDelete, volumeDelta = null, style }) {
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
  }, [template, programs, session.sessionTemplateId, isFree]);

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
            <Text style={styles.cardDateCorner} numberOfLines={1}>{formatDate(session.timestamp)}</Text>
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

const makeStyles = (th) => StyleSheet.create({
  // El margen lateral lo pone quien la coloca (`style`): el historial la mete
  // en una lista a sangre, la ficha de cliente en un ScrollView ya con padding.
  card: {
    backgroundColor: th.colors.surface,
    borderRadius:    th.radius.md,
    overflow:        'hidden',
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
  cardStage:     { ...textStyles.tag, color: th.colors.mutedLight, flexShrink: 0 },

  // ── Fila de datos ──
  cardStatsRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm },
  cardStat:     { ...textStyles.tag, color: th.colors.mutedLight },
  cardStatNum:  { ...textStyles.cardType, color: th.colors.text },
  cardStatUnit: { ...textStyles.tag, color: th.colors.mutedLight },
  cardStatSep:  { ...textStyles.tag, color: th.colors.muted2 },
  deltaUp:      { color: th.colors.accent },
  deltaDown:    { color: th.tint.red50 },

  cardDateCorner: { ...textStyles.tag, color: th.colors.mutedLight, flexShrink: 0 },
  // `detail` no lleva padding lateral —cada sección se lo pone— así que este
  // texto suelto necesita el suyo o sale a sangre con el borde de la tarjeta.
  detailMeta: {
    ...textStyles.tag,
    color:             th.colors.mutedLight,
    paddingHorizontal: spacing.lg,
    marginBottom:      spacing.sm,
  },
  deleteRow: {
    paddingHorizontal: spacing.lg,
    paddingTop:        spacing.xs,
  },
  deleteRowText: {
    ...textStyles.spacingTag,
    textTransform: 'uppercase',
    color:         th.tint.red50,
  },

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
});
