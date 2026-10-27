/**
 * ProgressionSheet — el cuerpo de la hoja de Progresión, por niveles
 * (P18-motor-progresion.md §7, maqueta `docs/mockups/progresion-hoja.html`):
 * qué sube en tarjetas de carácter con su frase, cuándo y cuánto sube, y lo
 * avanzado plegado. Lo usan el editor de ejercicio y el alta de ejercicio
 * propio: la misma hoja en los dos sitios.
 *
 * Solo pinta. Lo de «dejar el estado coherente» tras un cambio (encender RPE,
 * pasar a un solo valor de inicio…) toca el Volumen de cada pantalla y se queda
 * en quien la usa: aquí solo sale `onPatch(patch)`.
 *
 * `prog` es el formulario de `utils/progressionForm`; `ctx` = { def, sets,
 * metric, range }; el resto son los valores de Volumen que se recuerdan bajo el
 * nombre (series y reps no se tocan aquí: siguen en Volumen).
 */
import { useState } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { Text } from '../ui/Text';
import { useTranslation } from 'react-i18next';
import { MAX_RELIABLE_REPS } from '../../utils/oneRm';
import { progressionRule } from '../../utils/progression';
import {
  upOptions, showHow, effortBlocked, isEffort as isEffortForm, libraryStep, buildProgression,
} from '../../utils/progressionForm';
import { useWeightUnit } from '../../hooks/useWeightUnit';
import { spacing, textStyles, lh, LINE } from '../../theme';
import { useTheme, useThemedStyles } from '../../useTheme';
import SegmentedControl from '../ui/SegmentedControl';
import StepField from '../ui/StepField';
import AnimatedHeight from '../ui/AnimatedHeight';

// Los iconos de las tarjetas de «Qué sube», trazados como en la maqueta (22×22).
// El de Reps (dos flechas en círculo) está por decidir (P18 §7).
const TILE_ICON = {
  weight: (c) => (<><Path d="M7.5 9V7.5a3.5 3.5 0 0 1 7 0V9" stroke={c} strokeWidth={2.2} fill="none" strokeLinecap="round" /><Circle cx={11} cy={14} r={5.2} stroke={c} strokeWidth={2.2} fill="none" /></>),
  assist: (c) => <Path d="M11 4v12M6 11l5 5 5-5" stroke={c} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" fill="none" />,
  reps:   (c) => (<><Path d="M4.5 10a6.5 6.5 0 0 1 11.6-3.6M17.5 12a6.5 6.5 0 0 1-11.6 3.6" stroke={c} strokeWidth={2.2} fill="none" strokeLinecap="round" /><Path d="M16.8 3.4v3.4h-3.4M5.2 18.6v-3.4h3.4" stroke={c} strokeWidth={2.2} fill="none" strokeLinecap="round" strokeLinejoin="round" /></>),
  time:   (c) => (<><Circle cx={11} cy={12} r={7.5} stroke={c} strokeWidth={2.2} fill="none" /><Path d="M11 8v4l2.5 2" stroke={c} strokeWidth={2.2} strokeLinecap="round" fill="none" /></>),
  effort: (c) => (<><Path d="M4 15a7 7 0 0 1 14 0" stroke={c} strokeWidth={2.2} strokeLinecap="round" fill="none" /><Path d="M11 15l4-5" stroke={c} strokeWidth={2.2} strokeLinecap="round" /></>),
  none:   (c) => <Path d="M5 11h12" stroke={c} strokeWidth={2.6} strokeLinecap="round" />,
};
const TILE_ORDER = ['weight', 'reps', 'time', 'effort', 'none'];
const WEIGHT_CHIPS = [1.25, 2.5, 5];
const PCT_CHIP = 5;
const REPS_CHIPS = [1, 2, 3];
const SECS_CHIPS = [5, 10, 15];

/** «**negrita** y el resto»: la parte que importa de cada frase va en negrita. */
function Bold({ text, style, boldStyle }) {
  return (
    <Text style={style}>
      {text.split('**').map((part, i) => (i % 2 ? <Text key={i} style={boldStyle}>{part}</Text> : part))}
    </Text>
  );
}

export default function ProgressionSheet({ name, prog, ctx, minReps, maxReps, minTime, maxTime, onPatch }) {
  const styles = useThemedStyles(makeStyles);
  const th     = useTheme();
  const { t }                  = useTranslation();
  const { label: weightLabel } = useWeightUnit();
  const [advOpen, setAdvOpen]       = useState(false);
  const [effortWhy, setEffortWhy]   = useState(false);
  const { def, sets } = ctx;
  const isTime    = ctx.metric === 'time';
  const repsFixed = !ctx.range;
  const effort    = isEffortForm(prog, ctx);
  const assist    = def?.progressionDirection === 'decrease';
  const isWeight  = prog.up === 'weight' && !effort;
  const libStep   = libraryStep(def, effort);

  // ── Qué sube: Esfuerzo es Peso calculado con el RPE (el `how` del formulario).
  const offered = upOptions(ctx);
  const effortTile = showHow({ ...prog, up: 'weight' }, ctx);
  const tiles = TILE_ORDER.filter((id) => (id === 'effort' ? effortTile : offered.includes(id)));
  const tile = effort ? 'effort' : prog.up;
  const pickTile = (id) => {
    if (id === 'effort' && effortBlocked(ctx)) { setEffortWhy(true); return; }
    setEffortWhy(false);
    onPatch(id === 'effort' ? { up: 'weight', how: 'effort' } : { up: id, how: 'rules' });
  };
  const sayKey = tile === 'weight'
    ? (assist ? 'assist' : isTime ? 'weightTime' : repsFixed ? 'weightFixed' : 'weight')
    : tile;

  // Bajo el nombre, su volumen como meta (en gris; se cambia en Volumen).
  const meta = prog.up === 'reps' ? t('exerciseEditor.sheet.metaReps', { sets, reps: minReps })
    : prog.up === 'time' ? t('exerciseEditor.sheet.metaSecs', { sets, secs: minTime })
    : prog.up === 'none' ? ''
    : isTime ? t('exerciseEditor.sheet.metaTime', { sets, min: minTime, max: maxTime })
    : repsFixed || effort ? t('exerciseEditor.sheet.metaFixed', { sets, reps: minReps })
    : t('exerciseEditor.sheet.metaRange', { sets, min: minReps, max: maxReps });

  // La meta de Peso: el máximo del rango o las reps fijas; con Tiempo, los segundos.
  const repsTxt = (n) => t('progression.next.reps', { count: n });
  const goalTxt  = isTime ? `${maxTime} s` : repsTxt(repsFixed ? minReps : maxReps);
  const floorTxt = isTime ? `${minTime} s` : repsTxt(minReps);
  const majority = Math.floor(sets / 2) + 1;

  const caps = (txt) => <Text style={styles.caps}>{txt.toUpperCase()}</Text>;
  const hint = (txt) => <Text style={styles.hint}>{txt}</Text>;
  const chips = (values, isOn, label, onPick) => (
    <View style={styles.chips}>
      {values.map((v) => {
        const on = isOn(v);
        return (
          <TouchableOpacity key={String(v)} style={[styles.chip, on && styles.chipOn]} onPress={() => onPick(v)} activeOpacity={0.7}>
            <Text style={[styles.chipText, on && styles.chipTextOn]}>{label(v)}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
  const row = (label, control) => (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      {control}
    </View>
  );
  const squares = (hit) => (
    <View style={styles.squares}>
      {Array.from({ length: Math.min(sets, 10) }, (_, i) => (
        <View key={i} style={[styles.square, i < hit ? styles.squareHit : styles.squareMid]} />
      ))}
    </View>
  );
  const whenCard = (id, hit, title, sub, disabled) => {
    const on = id === 'part' ? prog.when === 'part' : prog.when !== 'part';
    return (
      <TouchableOpacity
        style={[styles.card, on && styles.cardOn, disabled && styles.off]}
        disabled={disabled}
        onPress={() => onPatch({ when: id === 'part' ? 'part' : prog.when === 'rpe' ? 'rpe' : 'all_complete' })}
        activeOpacity={0.7}
      >
        {squares(hit)}
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardSub}>{sub}</Text>
      </TouchableOpacity>
    );
  };

  const effortRir = 10 - prog.targetRpe;
  // Misma regla que el motor: pasado MAX_RELIABLE_REPS no calcula (§2.3).
  const effortUnreliable = effort && minReps + effortRir >= MAX_RELIABLE_REPS;

  // La frase de la regla al pie: la misma que el motor (`progressionRule`).
  const ruleCfg = { sets, minReps, maxReps, minTime, maxTime, inputType: isTime ? 'weight_time' : 'weight_reps', ...buildProgression(prog, ctx) };
  const rule = progressionRule(ruleCfg, def, t, weightLabel);

  return (
    // Lo que se elige abre y cierra bloques: la hoja sigue su alto.
    <AnimatedHeight>
      <View style={styles.body}>
        <View>
          {name ? <Text style={styles.name}>{name}</Text> : null}
          {meta ? <Text style={styles.meta}>{meta}</Text> : null}
        </View>

        <View>
          {caps(t('exerciseEditor.sheet.up'))}
          <View style={styles.tiles}>
            {tiles.map((id) => {
              const on = id === tile;
              const blocked = id === 'effort' && effortBlocked(ctx);
              const color = on ? th.colors.onAccent : id === 'none' ? th.colors.mutedLight : th.colors.accent;
              const icon = id === 'weight' && assist ? 'assist' : id;
              return (
                <TouchableOpacity
                  key={id}
                  style={[styles.tile, on && styles.tileOn, blocked && styles.off]}
                  onPress={() => pickTile(id)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on, disabled: blocked }}
                >
                  <Svg width={22} height={22} viewBox="0 0 22 22">{TILE_ICON[icon](color)}</Svg>
                  <Text style={[styles.tileText, on && styles.tileTextOn]} numberOfLines={1}>
                    {t(`exerciseEditor.sheet.tiles.${icon}`)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Bold text={t(`exerciseEditor.sheet.say.${sayKey}`)} style={styles.say} boldStyle={styles.sayBold} />
          {effortWhy && <Text style={[styles.hint, styles.warn]}>{t('exerciseEditor.effortNeedsFixed')}</Text>}
        </View>

        {isWeight && (
          <View>
            {caps(t('exerciseEditor.sheet.when'))}
            <View style={styles.cards}>
              {whenCard('all', sets, t('exerciseEditor.sheet.allTitle'), t('exerciseEditor.sheet.allSub', { n: sets, goal: goalTxt }))}
              {whenCard('part', majority, t('exerciseEditor.sheet.partTitle'),
                t(repsFixed || isTime ? 'exerciseEditor.sheet.partSub' : 'exerciseEditor.sheet.partSubRange',
                  { need: majority, n: sets, goal: goalTxt, min: floorTxt }), sets < 2)}
            </View>
          </View>
        )}

        {isWeight && (
          <View>
            {caps(t(assist ? 'exerciseEditor.sheet.howMuchAssist' : 'exerciseEditor.sheet.howMuch'))}
            {row(t('exerciseEditor.sheet.eachTime'), chips(
              [...WEIGHT_CHIPS, 'pct'],
              (v) => (v === 'pct' ? prog.incType === 'pct' && prog.incPct === PCT_CHIP : prog.incType === 'fixed' && prog.incValue === v),
              (v) => (v === 'pct' ? `${PCT_CHIP} %` : `${v} ${weightLabel}`),
              (v) => onPatch(v === 'pct' ? { incType: 'pct', incPct: PCT_CHIP } : { incType: 'fixed', incValue: v }),
            ))}
          </View>
        )}

        {(prog.up === 'reps' || prog.up === 'time') && (
          <View>
            {caps(t('exerciseEditor.sheet.howMuch'))}
            {row(t('exerciseEditor.sheet.perSet'), chips(
              prog.up === 'reps' ? REPS_CHIPS : SECS_CHIPS,
              (v) => prog.incValue === v,
              (v) => (prog.up === 'reps' ? `+${repsTxt(v)}` : `+${v} s`),
              (v) => onPatch({ incValue: v }),
            ))}
          </View>
        )}

        {effort && (
          <View>
            {caps(t('exerciseEditor.sheet.effortGoal'))}
            <StepField horizontal label="RPE" value={prog.targetRpe} onChange={(v) => onPatch({ targetRpe: v })} min={6} max={10} />
            {hint(effortRir === 0 ? t('exerciseEditor.effortFailure') : t('exerciseEditor.sheet.rir', { count: effortRir }))}
            {effortUnreliable && <Text style={[styles.hint, styles.warn]}>{t('exerciseEditor.effortUnreliable', { max: MAX_RELIABLE_REPS })}</Text>}
          </View>
        )}

        {(isWeight || effort) && (
          <View style={styles.adv}>
            <TouchableOpacity style={styles.advHead} onPress={() => setAdvOpen((v) => !v)} activeOpacity={0.7}>
              <Text style={styles.advTitle}>{t('exerciseEditor.sheet.advanced')}</Text>
              <Text style={styles.advChevron}>{advOpen ? '⌄' : '›'}</Text>
            </TouchableOpacity>
            {advOpen && (
              <View style={styles.advBody}>
                {isWeight ? (
                  <>
                    <View>
                      <Text style={styles.advLabel}>{t('exerciseEditor.sheet.brake')}</Text>
                      <SegmentedControl
                        options={['no', 'rpe'].map((id) => ({ id, label: t(`exerciseEditor.sheet.brakeOpt.${id}`) }))}
                        value={prog.when === 'rpe' ? 'rpe' : 'no'}
                        onChange={(id) => onPatch({ when: id === 'rpe' ? 'rpe' : 'all_complete' })}
                      />
                      {prog.when === 'rpe' && (
                        <View style={styles.gap}>
                          <StepField horizontal label={t('exerciseEditor.sheet.brakeMax')} value={prog.maxRpe}
                            onChange={(v) => onPatch({ maxRpe: v })} min={6} max={10} />
                        </View>
                      )}
                      {hint(prog.when === 'rpe'
                        ? t('exerciseEditor.sheet.brakeOnHint', { rpe: prog.maxRpe })
                        : t('exerciseEditor.sheet.brakeOffHint'))}
                    </View>
                    <View>
                      <Text style={styles.advLabel}>{t('exerciseEditor.sheet.down')}</Text>
                      <SegmentedControl
                        options={['fail', 'never'].map((id) => ({ id, label: t(`exerciseEditor.sheet.downOpt.${id}`) }))}
                        value={prog.down}
                        onChange={(id) => onPatch({ down: id })}
                      />
                      {hint(t(prog.down === 'never' ? 'exerciseEditor.sheet.downNeverHint'
                        : assist ? 'exerciseEditor.sheet.downFailHintAssist' : 'exerciseEditor.sheet.downFailHint'))}
                    </View>
                    <StepField horizontal label={t('exerciseEditor.sheet.step')} unit={weightLabel}
                      value={prog.step ?? libStep} onChange={(v) => onPatch({ step: v })} min={0.25} max={10} step={0.25} />
                  </>
                ) : (
                  // Por esfuerzo: el escalón (o Exacto) y cuándo sube, que antes eran pasos.
                  <>
                    <View>
                      <Text style={styles.advLabel}>{t('exerciseEditor.stepSize')}</Text>
                      <SegmentedControl
                        options={['step', 'exact'].map((id) => ({ id, label: t(`exerciseEditor.stepSizeOpt.${id}`) }))}
                        value={prog.exact ? 'exact' : 'step'}
                        onChange={(id) => onPatch({ exact: id === 'exact' })}
                      />
                      {!prog.exact && (
                        <View style={styles.gap}>
                          <StepField horizontal label={t('exerciseEditor.stepSizeLabel')} unit={weightLabel}
                            value={prog.step ?? libStep} onChange={(v) => onPatch({ step: v })} min={0.25} max={10} step={0.25} />
                        </View>
                      )}
                      {hint(t(prog.exact ? 'exerciseEditor.stepSizeExactHint' : 'exerciseEditor.stepSizeHint'))}
                    </View>
                    {/* Con Exacto el peso se mueve con cualquier cambio y «Al llegar» no se daría nunca. */}
                    {!prog.exact && (
                      <View>
                        <Text style={styles.advLabel}>{t('exerciseEditor.stepWhen')}</Text>
                        <SegmentedControl
                          options={['beat', 'reach'].map((id) => ({ id, label: t(`exerciseEditor.effWhen.${id}`) }))}
                          value={prog.effWhen}
                          onChange={(id) => onPatch({ effWhen: id })}
                        />
                        {hint(t(`exerciseEditor.effWhenHint.${prog.effWhen}`, { step: prog.step ?? libStep, unit: weightLabel }))}
                        {hint(t('exerciseEditor.effDownHint'))}
                      </View>
                    )}
                  </>
                )}
              </View>
            )}
          </View>
        )}

        <Text style={styles.rule}>{rule}</Text>
      </View>
    </AnimatedHeight>
  );
}

const makeStyles = (th) => StyleSheet.create({
  body: { gap: spacing.xl, paddingBottom: spacing.sm },
  name: { ...textStyles.bodyStrong, color: th.colors.text },
  meta: { ...textStyles.label, color: th.colors.mutedLight, marginTop: spacing.xs, fontVariant: ['tabular-nums'] },
  // Misma tipografía que las etiquetas de sección del editor (`secLabel`).
  caps: { ...textStyles.caps, color: th.colors.muted, marginBottom: spacing.sm2 },
  hint: { ...textStyles.label, color: th.colors.mutedLight, marginTop: spacing.sm, lineHeight: lh(textStyles.label.fontSize, LINE.row) },
  // Aviso: el naranja de `optRowWarn` (EditorRows).
  warn: { color: th.colors.orange },
  off: { opacity: 0.4 },
  gap: { marginTop: spacing.sm2 },

  // Tarjetas de carácter: la elegida se rellena de lima con el texto en negro.
  tiles: { flexDirection: 'row', gap: spacing.sm },
  tile: {
    flex: 1, alignItems: 'center', gap: spacing.xs2,
    backgroundColor: th.colors.bg, borderRadius: th.radius.md,
    paddingTop: spacing.md, paddingBottom: spacing.sm2, paddingHorizontal: spacing.xs,
  },
  tileOn: { backgroundColor: th.colors.accent },
  tileText: { ...textStyles.labelStrong, color: th.colors.mutedLight },
  tileTextOn: { color: th.colors.onAccent },
  say: { ...textStyles.body, color: th.colors.mutedLight, marginTop: spacing.md, lineHeight: lh(textStyles.body.fontSize, LINE.row) },
  sayBold: { fontFamily: textStyles.labelStrong.fontFamily, color: th.colors.text },

  // Cuándo sube: tarjetas grandes con borde (no rellenas), un cuadradito por serie.
  cards: { flexDirection: 'row', gap: spacing.sm2 },
  card: {
    flex: 1, backgroundColor: th.colors.bg, borderRadius: th.radius.md,
    padding: spacing.md, borderWidth: 1, borderColor: 'transparent',
  },
  cardOn: { borderColor: th.colors.accent },
  squares: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs2, marginBottom: spacing.md },
  square: { width: 18, height: 18, borderRadius: th.radius.xs },
  squareHit: { backgroundColor: th.colors.accent },
  squareMid: { backgroundColor: th.colors.surface2, borderWidth: 1, borderColor: th.colors.mutedLight },
  cardTitle: { ...textStyles.bodyStrong, color: th.colors.text },
  cardSub: { ...textStyles.label, color: th.colors.mutedLight, marginTop: spacing.xs2 },

  // Cuánto sube: una fila con los chips del salto.
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm2,
    backgroundColor: th.colors.bg, borderRadius: th.radius.md,
    paddingVertical: spacing.sm2, paddingRight: spacing.sm2, paddingLeft: spacing.md,
  },
  rowLabel: { ...textStyles.bodyStrong, color: th.colors.mutedLight, flexShrink: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: spacing.xs2 },
  chip: { backgroundColor: th.colors.surface2, borderRadius: th.radius.sm, paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  chipOn: { backgroundColor: th.colors.accent },
  chipText: { ...textStyles.labelStrong, color: th.colors.mutedLight },
  chipTextOn: { color: th.colors.onAccent },

  // Avanzado, plegado.
  adv: { backgroundColor: th.colors.bg, borderRadius: th.radius.md },
  advHead: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.md, paddingHorizontal: spacing.md },
  advTitle: { ...textStyles.bodyStrong, color: th.colors.text },
  advChevron: { ...textStyles.bodyStrong, color: th.colors.muted },
  advBody: { paddingHorizontal: spacing.md, paddingBottom: spacing.md, gap: spacing.lg },
  advLabel: { ...textStyles.labelStrong, color: th.colors.text, marginBottom: spacing.sm },

  // La regla al pie, colgada de una raya lima.
  rule: {
    ...textStyles.body, color: th.colors.text, lineHeight: lh(textStyles.body.fontSize, LINE.row),
    borderLeftWidth: 2, borderLeftColor: th.colors.accent, paddingLeft: spacing.md,
  },
});
