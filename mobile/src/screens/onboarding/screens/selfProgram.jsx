/**
 * «Tu programa» del camino «por mi cuenta» con el estilo del recorrido (O03-12,
 * spec §28.1): el programa elegido con sus sesiones y, encima, los ajustes (tiempo,
 * material y limitaciones) como filas que abren cada una su pregunta, con
 * `FlowOption`: una pregunta, un titular. El modelo (`usePreviewModel`) lo
 * calcula quien lo monta; aquí solo se pinta y se pregunta.
 *
 * Las preguntas son otra pantalla del recorrido (`s_adjust`), para que atrás vuelva aquí.
 * Elegir en una pregunta no guarda (O03-13): la elección es provisional, la pantalla
 * enseña cómo queda el programa y solo «Aceptar» la pasa a `answers`.
 * «Nuevo programa» sigue con `ProgramPreviewItems` y `AdjustSheet`.
 */
import { useMemo, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useStore } from '../../../../store/useStore';
import { rankArchetypes } from '../../../data/archetypes';
import { Text } from '../../../components/ui/Text';
import usePreviewModel from '../../../components/onboarding/usePreviewModel';
import {
  FlowBody, FlowTitle, FlowOption, FlowFooter, FlowNote,
} from '../../../components/onboarding/flow';
import SessionFold from '../../../components/onboarding/builder/SessionFold';
import { EQUIP_IDS, LIMIT_IDS, IDENTITY_OPTIONS, DEFAULT_ANSWERS, toggleExclusive, totalSetsOf, uniqueSessionTemplates, exerciseName, proposalNote } from '../../../components/onboarding/proposalData';
import { EQUIP_PRESETS, presetOf } from '../../../utils/equipmentPresets';
import { estimateSessionSec, includesWarmup } from '../../../utils/sessionCompression';
import { spacing, textStyles } from '../../../theme';
import { useThemedStyles } from '../../../useTheme';

export const TIMES = [30, 45, 60, 90];
const MATERIALS = ['gym', 'home', 'bodyweight'];

/** Lo que dice cada elección sobre el programa (los mismos textos de la hoja de O01). */
function timeHint(t, timeCuts) {
  const sets    = timeCuts.reduce((n, c) => n + c.setsDelta, 0);
  const removed = timeCuts.reduce((n, c) => n + c.removedIds.length, 0);
  if (sets <= 0) return { text: t('onboarding.adjustSheet.timeHintOk') };
  const labels = timeCuts.filter((c) => c.removedIds.length > 0).map((c) => c.label).join(' y ');
  return {
    tone: 'warn',
    text: removed > 0
      ? t('onboarding.adjustSheet.timeHintRemoved', { count: removed, labels, sets })
      : t('onboarding.adjustSheet.timeHintSetsOnly', { sets }),
  };
}

/** Las filas de una pregunta de elección múltiple: `ids` con su etiqueta, el pie «Listo». */
function MultiAsk({ title, sub, ids, labelOf, descOf, selected, onToggle, note, preview, onDone }) {
  return (
    <FlowBody footer={<AcceptFooter onAccept={onDone} />}>
      <FlowTitle text={title} sub={sub} />
      <View style={styles.opts}>
        {ids.map((id, i) => (
          <FlowOption
            key={id}
            index={2 + i}
            title={labelOf(id)}
            desc={descOf?.(id)}
            selected={selected.includes(id)}
            onPress={() => onToggle(id)}
          />
        ))}
      </View>
      {note}
      {preview}
    </FlowBody>
  );
}

function AcceptFooter({ onAccept }) {
  const { t } = useTranslation();
  return <FlowFooter primary={{ label: t('onboardingFlow.self.adjust.accept'), onPress: onAccept }} />;
}

// Constante y no `{}` en el selector: zustand 5 vuelve a pintar sin fin si devuelve un objeto nuevo cada vez.
const NONE = {};
export const answersOf = (s) => s.onboardingFlow?.answers ?? NONE;

/**
 * El nivel: el contestado en este recorrido o, si «Nuevo programa» arranca en
 * `s_days` (O03-11), el que ya estaba guardado en el perfil.
 */
export const levelOf = (s) => answersOf(s).level ?? s.profile.onboardingAnswers?.level ?? null;

/**
 * La propuesta elegida y su modelo en vivo. Lo elegido (`chosenId`) y los ajustes
 * (`tweaks`: tiempo, material, limitaciones) viven en `answers`, no en estado de
 * la pantalla, porque las preguntas son pantallas aparte (`s_adjust`) y `s_props`
 * se vuelve a montar al volver. `ready` apaga el cálculo mientras «preparando».
 * `draft`: ajustes provisionales de `s_adjust` (estable entre pintados), que se
 * ven en `model` y en `answers` sin haberse guardado.
 */
export function useProgramModel(ready = true, draft = NONE) {
  const level      = useStore(levelOf);
  const goal       = useStore((s) => answersOf(s).goal);
  const days       = useStore((s) => answersOf(s).days);
  const minutes    = useStore((s) => answersOf(s).sessionMinutes ?? null);
  const chosenId   = useStore((s) => answersOf(s).chosenId ?? null);
  const tweaks     = useStore((s) => answersOf(s).tweaks ?? NONE);
  const flowAnswer = useStore((s) => s.flowAnswer);

  const identity = IDENTITY_OPTIONS.find((o) => o.id === goal);
  // Lo que el motor recibe: las respuestas del recorrido más los ajustes.
  const answers = useMemo(() => ({
    ...DEFAULT_ANSWERS, ...(minutes ? { sessionMinutes: minutes } : null), ...tweaks, ...draft,
    level, discipline: identity?.discipline ?? null, goal: identity?.goal ?? null, daysPerWeek: days,
  }), [minutes, tweaks, draft, level, identity, days]);

  // SIN material a propósito (O01 §9): aún no se ha preguntado, y `equipment`
  // ausente le dice a `rankArchetypes` que no lo puntúe.
  const ranked = useMemo(() => (ready ? rankArchetypes({
    level, discipline: answers.discipline, goal: answers.goal, daysPerWeek: days,
  }) : []), [ready, level, answers.discipline, answers.goal, days]);
  const chosen = chosenId ? ranked.find((r) => r.archetype.id === chosenId) : null;
  const model  = usePreviewModel(chosen, answers);

  const setChosenId = (id) => flowAnswer({ chosenId: id });
  const commitTweaks = (patch) => flowAnswer({ tweaks: { ...useStore.getState().onboardingFlow?.answers.tweaks, ...patch } });
  return { days, chosenId, chosen, ranked, answers, model, setChosenId, commitTweaks };
}

/** Cada fila de ajuste abre `s_adjust` con su pregunta. */
function useOpenAdjust(goTo) {
  const flowAnswer = useStore((s) => s.flowAnswer);
  return (adjust) => { flowAnswer({ adjust }); goTo('s_adjust'); };
}

const back = () => useStore.getState().flowBack();

/** Rótulo de sección («Tus sesiones», «Ajustes»). */
function SectionLabel({ text }) {
  const th = useThemedStyles(makeStyles);
  return <Text style={th.section}>{text}</Text>;
}

/**
 * Las sesiones del programa en filas plegables (letra sin fondo, meta debajo,
 * chevron de desplegar) y, debajo, los avisos de lo que se adaptó. La comparten
 * «tu programa» y el repintado de `s_adjust`.
 */
function ProgramSessions({ model, answers, title }) {
  const { t } = useTranslation();
  const th = useThemedStyles(makeStyles);
  const [expanded, setExpanded] = useState(() => new Set());

  const { program, sessionTemplates } = model.tuned;
  const templates    = uniqueSessionTemplates(program, sessionTemplates);
  const countsWarmup = includesWarmup(answers.sessionMinutes);
  const minutesOf    = (tpl) => Math.round(
    estimateSessionSec(tpl.exercises ?? [], model.allEx, { includeWarmup: countsWarmup }) / 60,
  );
  const toggle = (id) => setExpanded((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const { substituted, removed, gaps } = model.adjustments;
  const noteOf = (titleKey, list, line) => `*${t(titleKey)}*\n${list.map(line).join('\n')}`;

  return (
    <>
      <SectionLabel text={title} />
      {templates.map((tpl, i) => (
        <SessionFold
          key={tpl.id}
          letter={tpl.label ?? String.fromCharCode(65 + i)}
          title={tpl.name}
          meta={t('home.sessionMeta', { count: (tpl.exercises ?? []).length, minutes: minutesOf(tpl) })}
          open={expanded.has(tpl.id)}
          onToggle={() => toggle(tpl.id)}
        >
          <View style={th.exList}>
            {(tpl.exercises ?? []).map((ex, n) => (
              <View key={n} style={th.ex}>
                <Text style={th.exOrder}>{ex.order ?? n + 1}</Text>
                <View style={styles.fill}>
                  <Text style={th.exName}>{exerciseName(model.allEx, ex.exerciseId, model.language)}</Text>
                  <Text style={th.exMeta}>
                    {t('onboarding.preview.setCount', { sets: ex.sets })}
                    {ex.minReps && ex.maxReps ? ` · ${ex.minReps}–${ex.maxReps} reps` : ''}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </SessionFold>
      ))}

      {!countsWarmup && <FlowNote text={t('onboarding.preview.noWarmupNote')} />}
      {substituted.length > 0 && (
        <FlowNote tone="acc" text={noteOf('onboarding.adaptationPanel.substitutedTitle', substituted, (s) => `${s.from} → ${s.to}`)} />
      )}
      {removed.length > 0 && (
        <FlowNote tone="warn" text={noteOf('onboarding.adaptationPanel.removedTitle', removed, (r) => `${r.label} · ${r.name}`)} />
      )}
      {gaps.length > 0 && (
        <FlowNote tone="warn" text={noteOf('onboarding.adaptationPanel.gapsTitle', gaps, (g) => g.text)} />
      )}
    </>
  );
}

/**
 * `s_adjust`: una pregunta de ajuste (O03-12, O03-13). Cuál, la dice `answers.adjust`.
 * Elegir NO guarda: la elección es `draft` (estado de la pantalla), debajo se ve
 * cómo queda el programa con ella y solo «Aceptar» la pasa a `answers` y vuelve.
 * Atrás vuelve sin guardar. «Otro» del material apila otra `s_adjust` (la lista),
 * que se reconoce porque la anterior en el historial también es `s_adjust`; su
 * «Aceptar» vuelve de las dos a «tu programa».
 */
export function Adjust({ goTo }) {
  const { t } = useTranslation();
  const base    = useStore((s) => answersOf(s).adjust);
  const stacked = useStore((s) => s.onboardingFlow?.history.at(-1) === 's_adjust');
  const [draft, setDraft] = useState(NONE);
  const { answers, model, commitTweaks } = useProgramModel(true, draft);
  const ask = base === 'equip' && stacked ? 'equipList' : base;
  const equipment   = answers.equipment ?? [];
  const limitations = answers.limitations ?? [];
  const preset      = presetOf(equipment);
  if (!model.tuned) return null;   // se llegó sin programa elegido: no hay nada que ajustar

  const pick   = (field, value) => setDraft((d) => ({ ...d, [field]: value }));
  const accept = (pops = 1) => () => { commitTweaks(draft); for (let i = 0; i < pops; i++) back(); };
  const preview = <ProgramSessions model={model} answers={answers} title={t('onboardingFlow.self.adjust.preview')} />;

  if (ask === 'time') {
    const hint = timeHint(t, model.timeCuts);
    return (
      <FlowBody footer={<AcceptFooter onAccept={accept()} />}>
        <FlowTitle text={t('onboardingFlow.self.adjust.timeTitle')} />
        <View style={styles.opts}>
          {TIMES.map((min, i) => (
            <FlowOption
              key={min}
              index={2 + i}
              title={t('onboardingFlow.self.props.minutes', { count: min })}
              selected={answers.sessionMinutes === min}
              onPress={() => pick('sessionMinutes', min)}
            />
          ))}
        </View>
        <FlowNote tone={hint.tone} text={hint.text} />
        {preview}
      </FlowBody>
    );
  }

  if (ask === 'equip') {
    return (
      <FlowBody footer={<AcceptFooter onAccept={accept()} />}>
        <FlowTitle text={t('onboardingFlow.self.adjust.materialTitle')} />
        <View style={styles.opts}>
          {MATERIALS.map((id, i) => (
            <FlowOption
              key={id}
              index={2 + i}
              title={t(`onboarding.adjustSheet.material.${id}`)}
              desc={t(`onboarding.adjustSheet.materialHint.${id}`)}
              selected={preset === id}
              onPress={() => pick('equipment', EQUIP_PRESETS[id])}
            />
          ))}
          <FlowOption
            chevron
            index={2 + MATERIALS.length}
            title={t('onboarding.adjustSheet.material.custom')}
            desc={t('onboarding.adjustSheet.materialHint.custom')}
            onPick={() => goTo('s_adjust')}
          />
        </View>
        {preview}
      </FlowBody>
    );
  }

  if (ask === 'equipList') {
    const subs = model.dedupedSubs.filter((s) => s.reason === 'equipment').length;
    return (
      <MultiAsk
        title={t('onboardingFlow.self.adjust.equipTitle')}
        sub={t('onboardingFlow.self.adjust.equipSub')}
        ids={EQUIP_IDS}
        labelOf={(id) => t(`onboarding.equipment.${id}.label`, id)}
        selected={equipment}
        onToggle={(id) => pick('equipment', toggleExclusive(equipment, id, 'bodyweight'))}
        note={<FlowNote text={t('onboarding.adjustSheet.materialCustomHint', { subs, gaps: (model.tuned.unresolved ?? []).length })} />}
        preview={preview}
        onDone={accept(2)}
      />
    );
  }

  if (ask === 'limits') {
    const none = !limitations.length || limitations.includes('none');
    const subs = model.dedupedSubs.filter((s) => s.reason === 'limitation').length;
    return (
      <MultiAsk
        title={t('onboardingFlow.self.adjust.limitsTitle')}
        sub={t('onboardingFlow.self.adjust.limitsSub')}
        ids={LIMIT_IDS}
        labelOf={(id) => t(`onboarding.limitations.${id}.label`, id)}
        descOf={(id) => t(`onboarding.limitations.${id}.description`, '')}
        selected={limitations}
        onToggle={(id) => pick('limitations', toggleExclusive(limitations, id, 'none'))}
        note={<FlowNote text={none
          ? t('onboarding.adjustSheet.limitationsHintNone')
          : t('onboarding.adjustSheet.limitationsHint', { count: subs })}
        />}
        preview={preview}
        onDone={accept()}
      />
    );
  }
  return null;
}

/** «Tu programa»: el elegido, sus sesiones y debajo los ajustes en filas que abren `s_adjust`. */
export default function TuPrograma({ goTo, model, answers, chosen, days, loading, onConfirm, onOther }) {
  const { t } = useTranslation();
  const open = useOpenAdjust(goTo);

  const { program, sessionTemplates } = model.tuned;
  const equipment   = answers.equipment ?? [];
  const limitations = answers.limitations ?? [];
  const preset      = presetOf(equipment);

  const templates    = uniqueSessionTemplates(program, sessionTemplates);
  const countsWarmup = includesWarmup(answers.sessionMinutes);
  const mins = templates.map((tpl) => Math.round(
    estimateSessionSec(tpl.exercises ?? [], model.allEx, { includeWarmup: countsWarmup }) / 60,
  ));
  const avg  = mins.length ? Math.round(mins.reduce((a, b) => a + b, 0) / mins.length) : 0;
  const sets = totalSetsOf(templates.map((tpl) => tpl.exercises));

  const equipLabel = preset === 'custom'
    ? t('onboarding.adjustSheet.material.custom')
    : t(`onboarding.adjustSheet.material.${preset}`);
  const limitLabel = (!limitations.length || limitations.includes('none'))
    ? t('onboarding.limitations.none.label')
    : limitations.map((id) => t(`onboarding.limitations.${id}.label`, id)).join(', ');
  const rows = [
    ['time',   t('onboarding.adjustSheet.step1'), t('onboardingFlow.self.props.minutes', { count: answers.sessionMinutes })],
    ['equip',  t('onboarding.adjustSheet.step2'), equipLabel],
    ['limits', t('onboarding.adjustSheet.step3'), limitLabel],
  ];

  const note = proposalNote(t, chosen, days);

  return (
    <FlowBody footer={(
      <FlowFooter
        primary={{ label: t(`onboardingFlow.self.props.${loading ? 'generating' : 'start'}`), onPress: onConfirm, disabled: loading }}
        secondary={loading ? [] : [{ label: t('onboardingFlow.self.props.other'), onPress: onOther }]}
      />
    )}>
      <FlowTitle
        text={model.tuned.program.name.replace(/\*/g, '')}
        sub={t('onboardingFlow.self.props.programSub', { sessions: templates.length, minutes: avg, sets })}
      />

      {!!note && <FlowNote text={note} />}

      <ProgramSessions model={model} answers={answers} title={t('onboardingFlow.self.props.sessionsTitle')} />

      <SectionLabel text={t('onboardingFlow.self.props.adjustTitle')} />
      <View style={styles.opts}>
        {rows.map(([id, title, desc], i) => (
          <FlowOption key={id} chevron index={2 + i} title={title} desc={desc} onPick={() => open(id)} />
        ))}
      </View>

      <FlowNote text={t('onboardingFlow.self.props.previewSub')} />
    </FlowBody>
  );
}

const styles = StyleSheet.create({
  opts: { gap: spacing.md },
  fill: { flex: 1 },
});

const makeStyles = (c) => StyleSheet.create({
  section: {
    ...textStyles.caps,
    color:         c.colors.mutedLight,
    textTransform: 'uppercase',
    marginTop:     spacing.xl,
    marginBottom:  spacing.sm2,
  },
  exList: { marginTop: spacing.md, gap: spacing.sm },
  ex:     { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  exOrder: { ...textStyles.labelStrong, color: c.colors.accent, width: 16, textAlign: 'right', paddingTop: 2 },
  exName:  { ...textStyles.body, color: c.colors.text },
  exMeta:  { ...textStyles.label, color: c.colors.mutedLight, marginTop: 1 },
});
