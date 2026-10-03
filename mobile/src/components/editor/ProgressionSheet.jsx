/**
 * ProgressionSheet — el cuerpo de la hoja de Progresión (progresion-clara.md
 * §5.3 y §12): un paso por pregunta, solo los que encajan con lo elegido antes,
 * numerados según los que salgan. Lo usan el editor de ejercicio y el alta de
 * ejercicio propio: la misma hoja en los dos sitios.
 *
 * Solo pinta. Lo de «dejar el estado coherente» tras un cambio (encender RPE,
 * pasar a un solo valor de inicio…) toca el Volumen de cada pantalla y se queda
 * en quien la usa: aquí solo sale `onPatch(patch)`.
 *
 * `prog` es el formulario de `utils/progressionForm`; `ctx` = { def, sets,
 * metric, range }; el resto son los valores de Volumen que las pistas nombran.
 */
import { View, StyleSheet } from 'react-native';
import Reanimated, { FadeIn } from 'react-native-reanimated';
import { Text } from '../ui/Text';
import { useTranslation } from 'react-i18next';
import { MAX_RELIABLE_REPS } from '../../utils/oneRm';
import {
  upOptions, showHow, effortBlocked, isEffort as isEffortForm, minFails, libraryStep,
} from '../../utils/progressionForm';
import { useWeightUnit } from '../../hooks/useWeightUnit';
import { spacing, textStyles, lh, LINE } from '../../theme';
import { useThemedStyles } from '../../useTheme';
import SegmentedControl from '../ui/SegmentedControl';
import StepField from '../ui/StepField';
import AnimatedHeight from '../ui/AnimatedHeight';

export default function ProgressionSheet({ prog, ctx, minReps, maxReps, minTime, maxTime, onPatch }) {
  const styles = useThemedStyles(makeStyles);
  const { t }                  = useTranslation();
  const { label: weightLabel } = useWeightUnit();
  const { def, sets } = ctx;
  const isTime     = ctx.metric === 'time';
  const repsFixed  = !ctx.range;
  const patchProg  = onPatch;
  const effort     = isEffortForm(prog, ctx);
  const assist     = def?.progressionDirection === 'decrease';

  const effortRir = 10 - prog.targetRpe;
  const effortRirTxt = effortRir === 0
    ? t('exerciseEditor.effortFailure')
    : t('exerciseEditor.effortRir', { count: effortRir });
  // Misma regla que el motor: pasado MAX_RELIABLE_REPS no calcula (§2.3).
  const effortUnreliable = effort && minReps + effortRir >= MAX_RELIABLE_REPS;
  const effortWarn = effortUnreliable ? (
    <Text style={styles.warnHint}>{t('exerciseEditor.effortUnreliable', { max: MAX_RELIABLE_REPS })}</Text>
  ) : null;

  const hint     = (txt) => <Text style={[styles.hint, styles.stepHint]}>{txt}</Text>;
  const warnHint = (txt) => <Text style={[styles.warnHint, styles.stepHint]}>{txt}</Text>;
  const gap      = (node) => <View style={styles.stepGap}>{node}</View>;
  const libStep  = libraryStep(def, effort);
  const sheetSteps = [];
  const addStep = (key, title, body) => sheetSteps.push({ key, title, body });
  const ofSets  = t('exerciseEditor.ofN', { n: sets });
  // La meta de Peso: el máximo del rango o las reps fijas; con Tiempo, los segundos.
  const goal    = isTime ? `${maxTime} s` : repsFixed ? minReps : maxReps;
  const floorTxt = isTime ? `${minTime} s` : minReps;

  const upHint = prog.up === 'weight'
    ? (assist ? 'weightAssist' : isTime ? 'weightTime' : repsFixed ? 'weightFixed' : 'weightRange')
    : prog.up;
  addStep('up', t('exerciseEditor.stepUp'), (
    <>
      <SegmentedControl
        options={upOptions(ctx).map((id) => ({
          id, label: t(`exerciseEditor.upOptions.${id === 'weight' && assist ? 'assist' : id}`),
        }))}
        value={prog.up}
        onChange={(id) => patchProg({ up: id })}
      />
      {hint(t(`exerciseEditor.upHint.${upHint}`, { reps: minReps, min: floorTxt }))}
    </>
  ));

  if (prog.up !== 'none' && showHow(prog, ctx)) {
    addStep('how', t('exerciseEditor.stepHow'), (
      <>
        <SegmentedControl
          options={[
            { id: 'rules',  label: t('exerciseEditor.howRules') },
            { id: 'effort', label: t('exerciseEditor.howEffort'), disabled: effortBlocked(ctx) },
          ]}
          value={prog.how}
          onChange={(id) => patchProg({ how: id })}
        />
        {hint(t(effort ? 'exerciseEditor.howEffortHint' : 'exerciseEditor.howRulesHint'))}
        {effortBlocked(ctx) && warnHint(t('exerciseEditor.effortNeedsFixed'))}
      </>
    ));
  }

  if (effort) {
    addStep('rpe', t('exerciseEditor.stepRpe'), (
      <>
        <StepField
          horizontal
          label={t('exerciseEditor.maxRpeLabel')}
          value={prog.targetRpe}
          onChange={(v) => patchProg({ targetRpe: v })}
          min={6}
          max={10}
        />
        {hint(`${effortRirTxt}. ${t('exerciseEditor.rpeAutoOn')}`)}
        {effortWarn}
      </>
    ));
    addStep('stepSize', t('exerciseEditor.stepSize'), (
      <>
        <SegmentedControl
          options={['step', 'exact'].map((id) => ({ id, label: t(`exerciseEditor.stepSizeOpt.${id}`) }))}
          value={prog.exact ? 'exact' : 'step'}
          onChange={(id) => patchProg({ exact: id === 'exact' })}
        />
        {!prog.exact && gap(
          <StepField
            horizontal
            label={t('exerciseEditor.stepSizeLabel')}
            unit={weightLabel}
            value={prog.step ?? libStep}
            onChange={(v) => patchProg({ step: v })}
            min={0.25}
            max={10}
            step={0.25}
          />,
        )}
        {hint(t(prog.exact ? 'exerciseEditor.stepSizeExactHint' : 'exerciseEditor.stepSizeHint'))}
      </>
    ));
    // Con Exacto el peso se mueve con cualquier cambio y «Al llegar» no se daría nunca.
    if (!prog.exact) {
      addStep('effWhen', t('exerciseEditor.stepWhen'), (
        <>
          <SegmentedControl
            options={['beat', 'reach'].map((id) => ({ id, label: t(`exerciseEditor.effWhen.${id}`) }))}
            value={prog.effWhen}
            onChange={(id) => patchProg({ effWhen: id })}
          />
          {hint(t(`exerciseEditor.effWhenHint.${prog.effWhen}`, { step: prog.step ?? libStep, unit: weightLabel }))}
          {hint(t('exerciseEditor.effDownHint'))}
        </>
      ));
    }
  } else if (prog.up !== 'none') {
    const whenTxt = prog.when === 'part'
      ? t('progression.rule.whenPart', { need: prog.need, n: sets })
      : prog.when === 'rpe'
        ? t('progression.rule.whenRpe', { rpe: prog.maxRpe })
        : t('progression.rule.whenAll');
    const metaTxt = prog.up === 'weight'
      ? t('exerciseEditor.metaReach', { goal })
      : t('exerciseEditor.metaOver', { floor: isTime ? `${minTime} s` : minReps });
    addStep('when', t('exerciseEditor.stepWhen'), (
      <>
        <SegmentedControl
          options={['all_complete', 'part', 'rpe'].map((id) => ({
            id, label: t(`exerciseEditor.evalModes.${id}`), disabled: id === 'part' && sets < 2,
          }))}
          value={prog.when}
          onChange={(id) => patchProg({ when: id })}
        />
        {prog.when === 'part' && gap(
          <StepField
            horizontal
            label={t('exerciseEditor.needLabel')}
            unit={ofSets}
            value={prog.need}
            onChange={(v) => patchProg({ need: v })}
            min={1}
            max={Math.max(1, sets - 1)}
          />,
        )}
        {prog.when === 'rpe' && gap(
          <StepField
            horizontal
            label={t('exerciseEditor.rpeMaxLabel')}
            value={prog.maxRpe}
            onChange={(v) => patchProg({ maxRpe: v })}
            min={6}
            max={10}
          />,
        )}
        {hint(`${t('exerciseEditor.whenHint', { when: whenTxt, meta: metaTxt })}${prog.when === 'rpe' ? ` ${t('exerciseEditor.rpeAutoOn')}` : ''}`)}
      </>
    ));

    addStep('incr', t('exerciseEditor.stepIncr'), prog.up === 'weight' ? (
      <>
        <SegmentedControl
          options={['fixed', 'pct'].map((id) => ({ id, label: t(`exerciseEditor.incrTypes.${id}`) }))}
          value={prog.incType}
          onChange={(id) => patchProg({ incType: id })}
        />
        {hint(t(`exerciseEditor.incrTypeDesc.${prog.incType}`))}
        {gap(prog.incType === 'pct' ? (
          <StepField
            horizontal unit="%"
            label={t('exerciseEditor.incrValueLabel')}
            value={prog.incPct}
            onChange={(v) => patchProg({ incPct: v })}
            min={1}
            max={50}
          />
        ) : (
          // Paso 0.25: la placa más pequeña habitual es de 1.25 kg por lado, así
          // que las subidas útiles son múltiplos de 0.25 y no de 1.
          <StepField
            horizontal
            label={t(assist ? 'exerciseEditor.incAssistLabel' : 'exerciseEditor.incWeightLabel')}
            unit={weightLabel}
            value={prog.incValue}
            onChange={(v) => patchProg({ incValue: v })}
            min={0.25}
            max={50}
            step={0.25}
          />
        ))}
        {prog.incType === 'pct' && (
          <>
            {gap(
              <StepField
                horizontal
                label={t('exerciseEditor.roundStepLabel')}
                unit={weightLabel}
                value={prog.step ?? libStep}
                onChange={(v) => patchProg({ step: v })}
                min={0.25}
                max={10}
                step={0.25}
              />,
            )}
            {hint(t('exerciseEditor.stepSizeHintPct'))}
          </>
        )}
      </>
    ) : (
      <>
        {prog.up === 'reps' ? (
          <StepField
            horizontal
            label={t('exerciseEditor.incrFixedRepsLabel')}
            value={prog.incValue}
            onChange={(v) => patchProg({ incValue: v })}
            min={1}
            max={10}
          />
        ) : (
          <StepField
            horizontal unit="s"
            label={t('exerciseEditor.incTimeLabel')}
            value={prog.incValue}
            onChange={(v) => patchProg({ incValue: v })}
            min={5}
            max={60}
            step={5}
          />
        )}
        {hint(t(prog.up === 'reps' ? 'exerciseEditor.incIntHintReps' : 'exerciseEditor.incIntHintTime'))}
      </>
    ));

    if (prog.up === 'weight') {
      const incTxt = prog.incType === 'pct' ? `${prog.incPct} %` : `${prog.incValue} ${weightLabel}`;
      const lowest = minFails(prog, ctx);
      addStep('down', t('exerciseEditor.stepDown'), (
        <>
          <SegmentedControl
            options={['never', 'fail'].map((id) => ({ id, label: t(`exerciseEditor.downOpt.${id}`) }))}
            value={prog.down}
            onChange={(id) => patchProg({ down: id })}
          />
          {prog.down === 'fail' ? (
            <>
              {gap(
                <StepField
                  horizontal
                  label={t('exerciseEditor.failsLabel')}
                  unit={ofSets}
                  value={prog.fails}
                  onChange={(v) => patchProg({ fails: v })}
                  min={lowest}
                  max={sets}
                />,
              )}
              {hint(t(assist ? 'exerciseEditor.downHintAssist' : 'exerciseEditor.downHint', { fails: prog.fails, inc: incTxt, floor: floorTxt }))}
              {prog.when === 'part' && hint(t('exerciseEditor.downPartHint', { need: prog.need, n: sets, min: lowest }))}
            </>
          ) : hint(t('exerciseEditor.downNeverHint'))}
        </>
      ));
    }
  }

  return (
    // Los pasos entran y salen según lo elegido: la hoja sigue su alto.
    <AnimatedHeight>
      <View style={styles.sheetBody}>
        {sheetSteps.map((st, n) => (
          <Reanimated.View key={st.key} entering={FadeIn.duration(180)}>
            <Text style={styles.stepTitle}>
              <Text style={styles.stepNum}>{`${n + 1} · `}</Text>{st.title}
            </Text>
            {st.body}
          </Reanimated.View>
        ))}
      </View>
    </AnimatedHeight>
  );
}

const makeStyles = (th) => StyleSheet.create({
  sheetBody: { gap: spacing.lg, paddingBottom: spacing.sm },
  // Misma tipografía Y mismo tratamiento que las etiquetas de sección del
  // editor (`secLabel`): `text/spacing-tag` en mayúsculas.
  stepTitle: {
    ...textStyles.caps,
    color:         th.colors.mutedLight,
    textTransform: 'uppercase',
    marginBottom:  spacing.sm,
  },
  stepNum: { color: th.colors.accent },
  hint: { ...textStyles.body, color: th.colors.mutedLight, lineHeight: lh(textStyles.body.fontSize, LINE.row) },
  // Aviso de fiabilidad de Por esfuerzo: el naranja de `optRowWarn` (EditorRows).
  warnHint: { ...textStyles.body, color: th.colors.orange, lineHeight: lh(textStyles.body.fontSize, LINE.row) },
  // La pista bajo el control de un paso, y el campo ± que cuelga de él.
  stepHint: { marginTop: spacing.sm2 },
  stepGap:  { marginTop: spacing.sm2 },
});
