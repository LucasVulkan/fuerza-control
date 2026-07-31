/**
 * SessionRecapScreen — post-session summary, shown right after saving.
 *
 * Duration · volume · sets, PRs (only when they exist), and the per-exercise
 * comparison against the previous run of the same session. All numbers come
 * from the just-saved log entry + pure utils.
 *
 * The only thing it WRITES is the post-session feedback (session RPE + body
 * weight) — see `setSessionFeedback` in the store and
 * `docs/specs/training-load.md` §2.
 *
 * Estilo: FormaFit. Esta pantalla NO tiene nodo en Figma (no aparece en la
 * extracción), así que hereda tokens y anatomías ya cerradas en otras
 * pantallas en vez de inventar: las 3 cards de cabecera son las Progress cards
 * de `ProgressTab`, las series usan las pills compartidas de `setDisplay.js`
 * (mismas que History y el detalle de ejercicio) y la lista de ejercicios usa
 * la lista agrupada con `getCardRadii`. Sin bordes: en este tema solo aparecen
 * como highlight en 3 casos y ninguno es este (docs/UI-MIGRATION.md §4.6).
 */
import { useState, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, StyleSheet } from 'react-native';
import Reanimated, {
  useSharedValue, useAnimatedStyle, withTiming, interpolateColor,
} from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Svg, { Path } from 'react-native-svg';
import { useStore } from '../../store/useStore';
import { recapStats, detectPRs, compareToLast, doneSets, doneDrops, prevBlockResult } from '../../../src/utils/sessionRecap';
import { formatBlockScore, compareBlockResults } from '../../../src/utils/conditioningBlocks';
import { sessionLoads, dailySeries, rollingMean } from '../../../src/utils/trainingLoad';
import { buildSetLabel, groupSetsByWeight, getPillVariant } from '../utils/setDisplay';
import { useWeightUnit } from '../hooks/useWeightUnit';
import { spacing, textStyles, getCardRadii } from '../theme';
import { useTheme, useThemedStyles } from '../useTheme';

const AnimatedTouchable = Reanimated.createAnimatedComponent(TouchableOpacity);

function TrophyIcon({ size = 17, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M8 21h8M12 17v4M7 4h10v6a5 5 0 0 1-10 0V4zM7 6H4a1 1 0 0 0-1 1v1a3 3 0 0 0 3 3M17 6h3a1 1 0 0 1 1 1v1a3 3 0 0 1-3 3" />
    </Svg>
  );
}

// Session RPE (Foster CR-10). Whole numbers only — a session rating is a gut
// call, not a measurement, so the per-set RPE's decimals would be false
// precision.
const RPE_VALUES = Array.from({ length: 10 }, (_, i) => i + 1);

/**
 * Un botón de la escala de sRPE. NO es un SegmentedControl: ese control sirve
 * para alternar entre vistas/opciones existentes, no para puntuar en una
 * escala. Aun así el cambio de estado no puede ser en seco (regla de feedback
 * táctil, docs/UI-MIGRATION.md §4.10), así que el color de fondo y el del
 * número se interpolan con Reanimated.
 */
function RpeButton({ value, active, onPress }) {
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  const p      = useSharedValue(active ? 1 : 0);

  useEffect(() => {
    p.value = withTiming(active ? 1 : 0, { duration: 160 });
  }, [active, p]);

  const boxStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(p.value, [0, 1], [th.colors.surface2, th.colors.accent]),
  }));
  const textStyle = useAnimatedStyle(() => ({
    color: interpolateColor(p.value, [0, 1], [th.colors.mutedLight, th.colors.onAccent]),
  }));

  return (
    <AnimatedTouchable style={[styles.rpeBtn, boxStyle]} onPress={onPress} activeOpacity={0.8}>
      <Reanimated.Text style={[styles.rpeBtnText, textStyle]}>{value}</Reanimated.Text>
    </AnimatedTouchable>
  );
}

// Same badge-per-format mapping as SessionEditorScreen's block rows.
const BLOCK_BADGE_STYLE = {
  amrap:    'badgeBlockAmrap',
  emom:     'badgeBlockEmom',
  for_time: 'badgeBlockForTime',
};

function fmtDuration(ms) {
  const s  = Math.max(0, Math.floor((ms ?? 0) / 1000));
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return hh > 0
    ? `${hh}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
    : `${mm}:${String(ss).padStart(2, '0')}`;
}

export default function SessionRecapScreen({ navigation, route }) {
  const { entryId } = route.params ?? {};
  const { t, i18n } = useTranslation();
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  // fmt() appends the unit ("82.5kg"); toDisplay() gives the bare number.
  const { fmt, toDisplay, toKg, label: weightLabel } = useWeightUnit();
  const round1 = (v) => Math.round(v * 10) / 10;

  const workoutLog       = useStore((s) => s.workoutLog);
  const programs         = useStore((s) => s.programs);
  const sessionTemplates = useStore((s) => s.sessionTemplates);
  const exerciseLibrary  = useStore((s) => s.exerciseLibrary);
  const customExercises  = useStore((s) => s.customExercises);
  const profileBodyWeight = useStore((s) => s.profile.bodyWeight);
  const setSessionFeedback = useStore((s) => s.setSessionFeedback);

  const entry = workoutLog.find((e) => e.id === entryId);

  // Draft for the body-weight field: the last known weight prefills it, and it
  // only reaches the store once it parses (so "78." mid-typing isn't saved).
  const [weightDraft, setWeightDraft] = useState(() => {
    const kg = entry?.bodyWeight ?? profileBodyWeight;
    return kg != null ? String(toDisplay(kg)) : '';
  });

  const allExercises = useMemo(
    () => ({ ...exerciseLibrary, ...customExercises }),
    [exerciseLibrary, customExercises],
  );

  /**
   * Carga de esta sesión y su comparación con la norma reciente.
   * La media de 7 días se toma hasta AYER (no incluye la sesión que se acaba
   * de guardar), que es lo que hace la comparación informativa en vez de
   * circular. Sin sRPE no hay carga interna, así que no se muestra nada.
   */
  const loadInfo = useMemo(() => {
    if (!entry || entry.sessionRpe == null) return null;
    const loads = sessionLoads(workoutLog, allExercises, { fallbackBodyWeight: profileBodyWeight });
    const mine  = loads.find((l) => l.id === entry.id);
    if (mine?.internal == null) return null;
    const means = rollingMean(dailySeries(loads).map((d) => d.internal), 7);
    const base  = means.length >= 2 ? means[means.length - 2] : null;
    return {
      value: Math.round(mine.internal),
      pct:   base > 0 ? Math.round(((mine.internal - base) / base) * 100) : null,
    };
  }, [entry, workoutLog, allExercises, profileBodyWeight]);

  if (!entry) return null;

  const exName = (id) => {
    const def = allExercises[id];
    if (!def) return id;
    return i18n.language === 'en' ? (def.nameEn ?? def.name) : def.name;
  };

  const isFree = entry.sessionTemplateId === '__free__';
  const template = !isFree ? sessionTemplates[entry.sessionTemplateId] : null;
  const program  = template?.programId ? programs[template.programId] : null;
  const stageName = program?.stages?.length
    ? program.stages[program.currentStageIndex ?? 0]?.name
    : null;

  const stats  = recapStats(entry);
  const prs    = detectPRs(entry, workoutLog);
  const deltas = compareToLast(entry, workoutLog);

  // Rows: comparison rows when available; otherwise the plain exercise list
  // (free sessions / first run of a template).
  const rows = deltas ?? (entry.exercises ?? []).map((ex) => ({
    exerciseId: ex.exerciseId, sets: doneSets(ex), note: ex.note ?? null, delta: null,
  }));

  // The logged entry carries each exercise's own minReps/maxReps — that's what
  // getPillVariant needs to colour a set as in/out of the target range.
  const exCfgById = Object.fromEntries((entry.exercises ?? []).map((ex) => [ex.exerciseId, ex]));

  function saveBodyWeight() {
    const n = parseFloat(weightDraft.replace(',', '.'));
    if (!isNaN(n) && n > 0) {
      setSessionFeedback(entry.id, { bodyWeight: Math.round(toKg(n) * 10) / 10 });
    }
  }

  // Weight-runs: a weightless weight pill + its reps/RPE pills (History
  // anatomy). Función, no componente: declarado dentro del render, un
  // componente tendría identidad nueva en cada pasada y remontaría las pills.
  function setPillsFor(sets, exCfg) {
    // Dropset — the last work set may carry sub-series at decreasing weight,
    // chained with "→" so they read as a continuation of that set.
    const drops = doneDrops(sets[sets.length - 1] ?? {});
    return (
      <View style={styles.setPills}>
        {groupSetsByWeight(sets).map((group, gi) => (
          <View key={`grp-${gi}`} style={styles.setGroup}>
            {group.weight ? (
              <View style={styles.weightPill}>
                <Text style={styles.weightPillText}>
                  <Text style={styles.weightPillNum}>{toDisplay(group.weight)}</Text>
                  <Text style={styles.weightPillUnit}>{weightLabel}</Text>
                  <Text style={styles.weightPillX}>{' x'}</Text>
                </Text>
              </View>
            ) : null}
            {group.sets.map((s, i) => {
              const variant = getPillVariant(s, exCfg);
              const { main, rpeNum } = buildSetLabel(s, i, fmt, true);
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
        {drops.map((d, i) => {
          const w = parseFloat(d.weight);
          return (
            <View key={`drop-${i}`} style={styles.setGroup}>
              <Text style={styles.dropArrow}>→</Text>
              <View style={styles.setPill}>
                <Text style={styles.setPillText}>
                  {w > 0 && d.reps ? `${toDisplay(w)}${weightLabel}×${d.reps}` : (d.reps || '·')}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    );
  }

  // Desviación vs la sesión anterior: texto suelto alineado a la derecha, SIN
  // pill — mismo tratamiento que `sesDelta` en el detalle de ejercicio de
  // Progreso. Las pills se reservan para los datos de serie y para el badge PR.
  function deltaText(delta) {
    if (!delta) return null;
    const sign = (n) => (n > 0 ? '+' : '−');
    let txt, tone;
    if (delta.kind === 'equal') { txt = '='; tone = 'eq'; }
    else if (delta.kind === 'weight') {
      txt = `${sign(delta.diff)}${fmt(round1(Math.abs(delta.diff)))}`;
      tone = delta.diff > 0 ? 'up' : 'dn';
    } else if (delta.kind === 'reps') {
      txt = `${sign(delta.diff)}${Math.abs(delta.diff)} ${t('recap.repsShort')}`;
      tone = delta.diff > 0 ? 'up' : 'dn';
    } else if (delta.kind === 'time') {
      txt = `${sign(delta.diff)}${Math.abs(delta.diff)} s`;
      tone = delta.diff > 0 ? 'up' : 'dn';
    } else { // sets
      txt = `${sign(delta.diff)}${Math.abs(delta.diff)} ${t('recap.setsShort')}`;
      tone = delta.diff > 0 ? 'up' : 'dn';
    }
    return <Text style={[styles.delta, styles[`delta_${tone}`]]}>{txt}</Text>;
  }

  // compareBlockResults devuelve { better, kind, diff } estructurado, NO una
  // cadena ya formateada, así que el texto i18n se arma aquí.
  function blockDeltaText(delta) {
    if (delta.kind === null) return null; // no previous entry with this blockId
    if (delta.kind === 'equal') {
      return <Text style={[styles.delta, styles.delta_eq]}>=</Text>;
    }
    const tone = delta.better ? 'up' : 'dn';
    let txt;
    if (delta.kind === 'time') {
      const sign = delta.diff < 0 ? '−' : '+';
      const abs  = Math.abs(delta.diff);
      const mm   = Math.floor(abs / 60);
      const ss   = Math.floor(abs % 60);
      txt = `${sign}${mm}:${String(ss).padStart(2, '0')}`;
    } else {
      const sign  = delta.diff > 0 ? '+' : '−';
      const abs   = Math.abs(delta.diff);
      const label = delta.kind === 'rounds' ? t('blocks.delta.roundsShort')
        : delta.kind === 'reps' ? t('blocks.delta.repsShort')
        : t('blocks.delta.completedShort');
      txt = `${sign}${abs}${label ? ` ${label}` : ''}`;
    }
    return <Text style={[styles.delta, styles[`delta_${tone}`]]}>{txt}</Text>;
  }

  const sessionNote = entry.notes?.trim();

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.xxl }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >

        {/* Header */}
        <View style={styles.headerBlock}>
          <Text style={styles.completedTag}>{t('recap.completed')}</Text>
          <Text style={styles.sessionName}>
            {entry.sessionName ?? template?.name ?? ''}
          </Text>
          {stageName ? <Text style={styles.contextLine}>{stageName}</Text> : null}
        </View>

        {/* Session RPE — how hard the whole session felt (CR-10). Saved on tap;
            the per-set RPE rates one set, this rates the session. */}
        <View style={styles.card}>
          <Text style={styles.feedbackTitle}>{t('recap.rpeQuestion')}</Text>
          <View style={styles.rpeScale}>
            {RPE_VALUES.map((v) => (
              <RpeButton
                key={v}
                value={v}
                active={entry.sessionRpe === v}
                onPress={() => setSessionFeedback(entry.id, { sessionRpe: v })}
              />
            ))}
          </View>
          <View style={styles.rpeLabels}>
            <Text style={styles.rpeLabel}>{t('recap.rpeLow')}</Text>
            <Text style={styles.rpeLabel}>{t('recap.rpeMid')}</Text>
            <Text style={styles.rpeLabel}>{t('recap.rpeHigh')}</Text>
          </View>

          {/* Carga de la sesión — aparece al contestar el sRPE. Sin unidad:
              "AU" es jerga y el número solo vale comparado consigo mismo, que
              es justo lo que aporta el porcentaje de al lado. */}
          {loadInfo && (
            <View style={styles.loadRow}>
              <Text style={styles.loadLabel}>{t('recap.sessionLoad')}</Text>
              <View style={styles.loadValueWrap}>
                <Text style={styles.loadValue}>{loadInfo.value}</Text>
                {loadInfo.pct != null && (
                  <Text style={styles.loadPct}>
                    {`${loadInfo.pct > 0 ? '+' : ''}${loadInfo.pct}% ${t('recap.vsMean7d')}`}
                  </Text>
                )}
              </View>
            </View>
          )}
        </View>

        {/* Body weight — always editable, prefilled with the last known value. */}
        <View style={[styles.card, styles.weightRow]}>
          <Text style={styles.feedbackTitle}>{t('recap.bodyWeight')}</Text>
          <View style={styles.weightInputWrap}>
            <TextInput
              style={styles.weightInput}
              value={weightDraft}
              onChangeText={setWeightDraft}
              onEndEditing={saveBodyWeight}
              onBlur={saveBodyWeight}
              keyboardType="decimal-pad"
              placeholder="—"
              placeholderTextColor={th.colors.muted}
              selectTextOnFocus
              maxLength={6}
            />
            <Text style={styles.weightUnit}>{weightLabel}</Text>
          </View>
        </View>

        {/* Hero stats — Progress card anatomy (surface, radius/lg, text/hero) */}
        <View style={styles.statsRow}>
          <View style={styles.statTile}>
            <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
              {fmtDuration(entry.duration)}
            </Text>
            <Text style={styles.statLabel}>{t('recap.duration')}</Text>
          </View>
          <View style={styles.statTile}>
            <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
              {stats.volume > 0 ? toDisplay(stats.volume) : '—'}
              {stats.volume > 0 ? <Text style={styles.statUnit}> {weightLabel}</Text> : null}
            </Text>
            <Text style={styles.statLabel}>{t('recap.volume')}</Text>
          </View>
          <View style={styles.statTile}>
            <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
              {stats.setsDone}<Text style={styles.statUnit}>/{stats.setsPlanned}</Text>
            </Text>
            <Text style={styles.statLabel}>{t('recap.sets')}</Text>
          </View>
        </View>

        {/* PRs — only when there are any. Accent tint fill, no border: same
            treatment as the "Resumen" cards of the editors. */}
        {prs.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.secTitle, { color: th.colors.accent }]}>{t('recap.prs')}</Text>
            <View style={styles.prCard}>
              {prs.map((pr) => (
                <View key={pr.exerciseId} style={styles.prRow}>
                  <TrophyIcon color={th.colors.accent} />
                  <View style={styles.rowBody}>
                    <Text style={styles.exName}>{exName(pr.exerciseId)}</Text>
                    <Text style={styles.exSub}>
                      {pr.kind === 'e1rm'
                        ? `e1RM ${fmt(round1(pr.value))} · ${t('recap.previous')} ${fmt(round1(pr.prev))}`
                        : pr.kind === 'weight'
                        ? `${t('recap.topWeight')} ${fmt(round1(pr.value))} · ${t('recap.previous')} ${fmt(round1(pr.prev))}`
                        : `${t('recap.bestSet')} · ${pr.value} reps`}
                    </Text>
                  </View>
                  <View style={styles.chip}>
                    <Text style={styles.chipText}>
                      {pr.kind === 'reps'
                        ? `+${pr.value - pr.prev} ${t('recap.repsShort')}`
                        : `+${fmt(round1(pr.value - pr.prev))}`}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Conditioning blocks — only blocks that were actually started */}
        {entry.blocks?.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.secTitle}>{t('blocks.recapSection')}</Text>
            <View style={styles.groupedList}>
              {entry.blocks.map((block, i) => {
                const prev  = prevBlockResult(entry, workoutLog, block.blockId);
                const delta = compareBlockResults(block.format, block.result, prev);
                return (
                  <View
                    key={block.blockId}
                    style={[styles.listItem, styles.listItemRow, getCardRadii(th, i === 0, i === entry.blocks.length - 1)]}
                  >
                    <View style={styles.rowBody}>
                      <View style={styles.blockNameRow}>
                        <View style={[styles.badge, styles[BLOCK_BADGE_STYLE[block.format]]]}>
                          <Text style={[styles.badgeText, styles[`${BLOCK_BADGE_STYLE[block.format]}Text`]]}>
                            {t(`blocks.formats.${block.format}`).toUpperCase()}
                          </Text>
                        </View>
                        <Text style={styles.exName}>{block.name ?? t(`blocks.formats.${block.format}`)}</Text>
                      </View>
                      <Text style={styles.blockScore}>
                        {formatBlockScore(block.result, block.format)}
                        {block.result.capped ? ` ${t('blocks.cappedTag')}` : ''}
                      </Text>
                    </View>
                    {blockDeltaText(delta)}
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Vs. last session / exercise list */}
        {rows.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.secTitle}>
              {deltas ? t('recap.vsLast') : t('recap.exercises')}
            </Text>
            <View style={styles.groupedList}>
              {rows.map((row, i) => (
                <View
                  key={row.exerciseId}
                  style={[styles.listItem, getCardRadii(th, i === 0, i === rows.length - 1)]}
                >
                  <View style={styles.itemHead}>
                    <Text style={styles.exName} numberOfLines={1}>{exName(row.exerciseId)}</Text>
                    {deltaText(row.delta)}
                  </View>
                  {row.sets.length > 0
                    ? setPillsFor(row.sets, exCfgById[row.exerciseId])
                    : <Text style={styles.exSub}>—</Text>}
                  {row.note ? (
                    <Text style={styles.exNote} numberOfLines={1}>“{row.note}”</Text>
                  ) : null}
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Session note */}
        {sessionNote ? (
          <View style={styles.card}>
            <Text style={styles.noteText}>“{sessionNote}”</Text>
          </View>
        ) : null}

        {/* Done */}
        <TouchableOpacity
          style={styles.doneBtn}
          onPress={() => navigation.navigate('Main', { screen: 'Home' })}
          activeOpacity={0.85}
        >
          <Text style={styles.doneBtnText}>{t('recap.done')}</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (th) => StyleSheet.create({
  container: { flex: 1, backgroundColor: th.colors.bg },
  // Página: padding lateral space/lg y gap space/md, igual que History/Progress.
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingTop:        spacing.md,
    gap:               spacing.md,
  },

  headerBlock: { alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.md },
  completedTag: { ...textStyles.spacingTag, color: th.colors.accent },
  sessionName:  { ...textStyles.hero, color: th.colors.text, textAlign: 'center' },
  contextLine:  { ...textStyles.subtitle, color: th.colors.mutedLight },

  section: { gap: spacing.sm },
  secTitle: {
    ...textStyles.spacingTag,
    color:         th.colors.mutedLight,
    textTransform: 'uppercase',
  },

  card: {
    backgroundColor: th.colors.surface,
    borderRadius:    th.radius.lg,
    padding:         spacing.lg,
    gap:             spacing.md,
  },

  // ── Post-session feedback (sRPE + body weight) ──
  feedbackTitle: { ...textStyles.cardType, color: th.colors.text },
  rpeScale: { flexDirection: 'row', gap: spacing.xs2 },
  rpeBtn: {
    flex:            1,
    paddingVertical: spacing.sm2,
    borderRadius:    th.radius.sm,
    alignItems:      'center',
    justifyContent:  'center',
  },
  rpeBtnText: { ...textStyles.btnAction, fontVariant: ['tabular-nums'] },
  rpeLabels: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    marginTop:      -spacing.sm, // el gap de la card ya separa; esto lo acerca a la escala
  },
  rpeLabel: {
    ...textStyles.smallBold,
    color:         th.colors.mutedLight,
    textTransform: 'uppercase',
  },
  loadRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    gap:            spacing.sm,
  },
  loadLabel:     { ...textStyles.spacingTag, color: th.colors.mutedLight, textTransform: 'uppercase' },
  loadValueWrap: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  loadValue:     { ...textStyles.cardTitle, color: th.colors.accent, fontVariant: ['tabular-nums'] },
  // Neutro a propósito: más carga no es "mejor" ni "peor", así que no lleva el
  // verde/rojo de los deltas de rendimiento.
  loadPct:       { ...textStyles.tag, color: th.colors.mutedLight },

  weightRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
  },
  weightInputWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  weightInput: {
    minWidth:          70,
    paddingVertical:   spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius:      th.radius.sm,
    backgroundColor:   th.colors.surface2,
    textAlign:         'right',
    ...textStyles.cardTitle,
    color:             th.colors.accent,
    fontVariant:       ['tabular-nums'],
  },
  weightUnit: { ...textStyles.tag, color: th.colors.mutedLight },

  // ── Hero stats (anatomía de las Progress cards) ──
  statsRow: { flexDirection: 'row', gap: spacing.md },
  statTile: {
    flex:              1,
    backgroundColor:   th.colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.lg,
    borderRadius:      th.radius.lg,
    alignItems:        'center',
    justifyContent:    'center',
    gap:               spacing.xs,
    overflow:          'hidden',
  },
  statValue: { ...textStyles.hero, color: th.colors.text, textAlign: 'center' },
  statUnit:  { ...textStyles.tag,  color: th.colors.mutedLight },
  statLabel: {
    ...textStyles.spacingTag,
    color:         th.colors.text,
    textTransform: 'uppercase',
    textAlign:     'center',
  },

  // ── PRs ──
  prCard: {
    backgroundColor: th.tint.accent10,
    borderRadius:    th.radius.lg,
    padding:         spacing.md,
    gap:             spacing.md,
  },
  prRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm2 },

  // ── Lista agrupada (bloques y ejercicios) ──
  groupedList: { gap: spacing.xs },
  listItem: {
    backgroundColor: th.colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.md,
    gap:               spacing.sm,
  },
  listItemRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm2 },
  itemHead: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    gap:            spacing.sm,
    minWidth:       0,
  },
  rowBody:  { flex: 1, minWidth: 0, gap: spacing.xs },

  exName: { ...textStyles.cardType, color: th.colors.text, flexShrink: 1 },
  exSub:  { ...textStyles.tag, color: th.colors.mutedLight },
  exNote: { ...textStyles.tag, color: th.colors.muted, fontStyle: 'italic' },

  // ── Pills de series (misma anatomía exacta que History) ──
  setPills: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  setGroup: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  weightPill:     { paddingLeft: spacing.sm, paddingVertical: spacing.sm },
  weightPillText: { ...textStyles.tag },
  weightPillNum:  { color: th.colors.accent },
  weightPillUnit: { color: th.colors.text },
  weightPillX:    { color: th.colors.mutedLight },
  setPill: {
    backgroundColor: th.colors.surface2,
    borderRadius:    th.radius.xs,
    padding:         spacing.sm,
  },
  setPillDone:    { backgroundColor: th.tint.accent10 },
  setPillPartial: { backgroundColor: th.tint.orange30 },
  setPillText:        { ...textStyles.tag, color: th.colors.mutedLight },
  setPillTextDone:    { color: th.colors.accent },
  setPillTextPartial: { color: th.colors.orange },
  setPillRpeAt:        { color: th.colors.mutedLight },
  setPillRpeAtDone:    { color: th.tint.accent50 },
  setPillRpeAtPartial: { color: th.tint.orange50 },
  // Dropset: la flecha va DELANTE de la pill porque la sub-serie es una
  // continuación de la anterior (al revés que las pills de calentamiento).
  dropArrow: { fontSize: 14, color: th.colors.mutedLight },

  // ── Bloques ──
  blockNameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical:   1,
    borderRadius:      th.radius.xs,
  },
  badgeText: { ...textStyles.smallBold },
  badgeBlockAmrap:       { backgroundColor: th.tint.accent10 },
  badgeBlockAmrapText:   { color: th.colors.accent },
  badgeBlockEmom:        { backgroundColor: th.tint.blue30 },
  badgeBlockEmomText:    { color: th.colors.blue },
  badgeBlockForTime:     { backgroundColor: th.tint.orange30 },
  badgeBlockForTimeText: { color: th.colors.orange },
  blockScore: { ...textStyles.cardTitle, color: th.colors.text, fontVariant: ['tabular-nums'] },

  // ── Desviación vs sesión anterior: texto suelto a la derecha, sin pill.
  // accent = propio/positivo (en este tema no se usa verde); red apagado para
  // los retrocesos — decisión explícita del usuario para el recap.
  delta:    { ...textStyles.cardType, fontVariant: ['tabular-nums'], flexShrink: 0 },
  delta_up: { color: th.colors.accent },
  delta_eq: { color: th.colors.mutedLight },
  delta_dn: { color: th.tint.red50 },

  // El badge de PR sí es pill (igual que `prPill` en el detalle de ejercicio).
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical:   spacing.xs2,
    borderRadius:      th.radius.xs,
    flexShrink:        0,
    backgroundColor:   th.tint.accent10,
  },
  chipText: { ...textStyles.tag, color: th.colors.accent, fontVariant: ['tabular-nums'] },

  noteText: { ...textStyles.subtitle, color: th.colors.mutedLight, fontStyle: 'italic' },

  doneBtn: {
    backgroundColor: th.colors.accent,
    borderRadius:    th.radius.sm,
    paddingVertical: spacing.md,
    alignItems:      'center',
    marginTop:       spacing.sm,
  },
  doneBtnText: { ...textStyles.btnAction, color: th.colors.onAccent },
});
