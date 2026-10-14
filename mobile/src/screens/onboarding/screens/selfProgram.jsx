/**
 * «Tu programa» del camino «por mi cuenta» con el estilo del recorrido (O03-12,
 * spec §28.1): el programa elegido con sus sesiones y, encima, los ajustes (tiempo,
 * material y limitaciones) como filas que abren cada una su pregunta, con
 * `FlowOption`: una pregunta, un titular. El modelo (`usePreviewModel`) lo
 * calcula quien lo monta; aquí solo se pinta y se pregunta.
 *
 * Todo vive en una sola pantalla del recorrido: `ask` dice qué pregunta está
 * abierta (`null` = el programa). `OnboardingScreen` («Nuevo programa») sigue con
 * `ProgramPreviewItems` y `AdjustSheet`.
 */
import { useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Text } from '../../../components/ui/Text';
import {
  FlowBody, FlowTitle, FlowOption, FlowFooter, FlowNote,
} from '../../../components/onboarding/flow';
import SessionBlock from '../../../components/onboarding/builder/SessionBlock';
import { EQUIP_IDS, LIMIT_IDS, toggleExclusive, totalSetsOf, uniqueSessionTemplates, exerciseName, proposalNote } from '../../../components/onboarding/proposalData';
import { EQUIP_PRESETS, presetOf } from '../../../utils/equipmentPresets';
import { estimateSessionSec, includesWarmup } from '../../../utils/sessionCompression';
import { spacing, textStyles } from '../../../theme';
import { useThemedStyles } from '../../../useTheme';

const TIMES = [30, 45, 60, 90];
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
function MultiAsk({ title, sub, ids, labelOf, descOf, selected, onToggle, note, onDone }) {
  const { t } = useTranslation();
  return (
    <FlowBody footer={<FlowFooter primary={{ label: t('onboardingFlow.self.adjust.done'), onPress: onDone }} />}>
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
    </FlowBody>
  );
}

export default function TuPrograma({ model, answers, chosen, days, loading, onAdjust, onConfirm, onOther }) {
  const { t } = useTranslation();
  const th = useThemedStyles(makeStyles);
  const [ask, setAsk]           = useState(null);       // null | 'time' | 'material' | 'equip' | 'limits'
  const [expanded, setExpanded] = useState(() => new Set());
  const back = () => setAsk(null);

  const { program, sessionTemplates } = model.tuned;
  const equipment   = answers.equipment ?? [];
  const limitations = answers.limitations ?? [];
  const preset      = presetOf(equipment);

  // ── Preguntas ────────────────────────────────────────────────────────────────
  if (ask === 'time') {
    const hint = timeHint(t, model.timeCuts);
    return (
      <FlowBody key={ask}>
        <FlowTitle text={t('onboardingFlow.self.adjust.timeTitle')} />
        <View style={styles.opts}>
          {TIMES.map((min, i) => (
            <FlowOption
              key={min}
              index={2 + i}
              title={t('onboardingFlow.self.props.minutes', { count: min })}
              selected={answers.sessionMinutes === min}
              onPress={() => onAdjust('sessionMinutes', min)}
              onPick={back}
            />
          ))}
        </View>
        <FlowNote tone={hint.tone} text={hint.text} />
      </FlowBody>
    );
  }

  if (ask === 'material') {
    return (
      <FlowBody key={ask}>
        <FlowTitle text={t('onboardingFlow.self.adjust.materialTitle')} />
        <View style={styles.opts}>
          {MATERIALS.map((id, i) => (
            <FlowOption
              key={id}
              index={2 + i}
              title={t(`onboarding.adjustSheet.material.${id}`)}
              desc={t(`onboarding.adjustSheet.materialHint.${id}`)}
              selected={preset === id}
              onPress={() => onAdjust('equipment', EQUIP_PRESETS[id])}
              onPick={back}
            />
          ))}
          <FlowOption
            chevron
            index={2 + MATERIALS.length}
            title={t('onboarding.adjustSheet.material.custom')}
            desc={t('onboarding.adjustSheet.materialHint.custom')}
            onPick={() => setAsk('equip')}
          />
        </View>
      </FlowBody>
    );
  }

  if (ask === 'equip') {
    const subs = model.dedupedSubs.filter((s) => s.reason === 'equipment').length;
    return (
      <MultiAsk
        key={ask}
        title={t('onboardingFlow.self.adjust.equipTitle')}
        sub={t('onboardingFlow.self.adjust.equipSub')}
        ids={EQUIP_IDS}
        labelOf={(id) => t(`onboarding.equipment.${id}.label`, id)}
        selected={equipment}
        onToggle={(id) => onAdjust('equipment', toggleExclusive(equipment, id, 'bodyweight'))}
        note={<FlowNote text={t('onboarding.adjustSheet.materialCustomHint', { subs, gaps: (model.tuned.unresolved ?? []).length })} />}
        onDone={back}
      />
    );
  }

  if (ask === 'limits') {
    const none = !limitations.length || limitations.includes('none');
    const subs = model.dedupedSubs.filter((s) => s.reason === 'limitation').length;
    return (
      <MultiAsk
        key={ask}
        title={t('onboardingFlow.self.adjust.limitsTitle')}
        sub={t('onboardingFlow.self.adjust.limitsSub')}
        ids={LIMIT_IDS}
        labelOf={(id) => t(`onboarding.limitations.${id}.label`, id)}
        descOf={(id) => t(`onboarding.limitations.${id}.description`, '')}
        selected={limitations}
        onToggle={(id) => onAdjust('limitations', toggleExclusive(limitations, id, 'none'))}
        note={<FlowNote text={none
          ? t('onboarding.adjustSheet.limitationsHintNone')
          : t('onboarding.adjustSheet.limitationsHint', { count: subs })}
        />}
        onDone={back}
      />
    );
  }

  // ── El programa ──────────────────────────────────────────────────────────────
  const templates    = uniqueSessionTemplates(program, sessionTemplates);
  const countsWarmup = includesWarmup(answers.sessionMinutes);
  const minutesOf    = (tpl) => Math.round(
    estimateSessionSec(tpl.exercises ?? [], model.allEx, { includeWarmup: countsWarmup }) / 60,
  );
  const mins = templates.map(minutesOf);
  const avg  = mins.length ? Math.round(mins.reduce((a, b) => a + b, 0) / mins.length) : 0;
  const sets = totalSetsOf(templates.map((tpl) => tpl.exercises));
  const toggle = (id) => setExpanded((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const equipLabel = preset === 'custom'
    ? t('onboarding.adjustSheet.material.custom')
    : t(`onboarding.adjustSheet.material.${preset}`);
  const limitLabel = (!limitations.length || limitations.includes('none'))
    ? t('onboarding.limitations.none.label')
    : limitations.map((id) => t(`onboarding.limitations.${id}.label`, id)).join(', ');
  const rows = [
    ['time',     t('onboarding.adjustSheet.step1'), t('onboardingFlow.self.props.minutes', { count: answers.sessionMinutes })],
    ['material', t('onboarding.adjustSheet.step2'), equipLabel],
    ['limits',   t('onboarding.adjustSheet.step3'), limitLabel],
  ];

  const { substituted, removed, gaps } = model.adjustments;
  const noteOf = (titleKey, list, line) => `*${t(titleKey)}*\n${list.map(line).join('\n')}`;
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

      <View style={styles.opts}>
        {rows.map(([id, title, desc], i) => (
          <FlowOption key={id} chevron index={2 + i} title={title} desc={desc} onPick={() => setAsk(id)} />
        ))}
      </View>

      {!!note && <FlowNote text={note} />}
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

      <Text style={th.section}>{t('onboardingFlow.self.props.sessionsTitle')}</Text>
      {templates.map((tpl, i) => {
        const open = expanded.has(tpl.id);
        return (
          <Pressable key={tpl.id} onPress={() => toggle(tpl.id)} accessibilityRole="button" accessibilityState={{ expanded: open }}>
            <SessionBlock
              letter={tpl.label ?? String.fromCharCode(65 + i)}
              title={tpl.name}
              note={t('onboardingFlow.self.props.sessionNote', { count: (tpl.exercises ?? []).length, minutes: mins[i] })}
            >
              {open && (
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
              )}
            </SessionBlock>
          </Pressable>
        );
      })}

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
