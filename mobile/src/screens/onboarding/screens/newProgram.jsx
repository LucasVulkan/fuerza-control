/**
 * Las pantallas de «Nuevo programa» desde la app (O03-11, spec §25): elegir cómo
 * empezar, elegir una plantilla propia y el cierre. Es el mismo recorrido por
 * otra puerta (`entry: 'newProgram'`): sin Ajustes, sin bifurcación y sin Aprende.
 *
 * Las cinco salidas de `n_source` llevan a pantallas que ya existen: las
 * propuestas (`s_goal`…), el constructor, `c_code`, `n_templates` y el selector
 * de archivo `.fitdata`. Cada una es un componente que `OnboardingFlowScreen`
 * pinta por su id y recibe `goTo(id)`.
 *
 * Maqueta: docs/mockups/onboarding-2.html (n_source, n_templates, n_done).
 */
import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useStore } from '../../../../store/useStore';
import { spacing, textStyles } from '../../../theme';
import { useThemedStyles } from '../../../useTheme';
import { Text } from '../../../components/ui/Text';
import { Rise } from '../../../components/ui/Rise';
import NameField from '../../../components/ui/NameField';
import {
  FlowBody, FlowTitle, FlowOption, FlowFooter, FlowPanel, PanelButton,
} from '../../../components/onboarding/flow';
import useFitdataImport from '../../../components/onboarding/useFitdataImport';
import { templatesOf } from '../../../utils/programOwnership';
import { stageDays } from '../../../utils/stageProgress';
import { startBuilder } from '../startBuilder';

const K = 'onboardingFlow.newProgram';

// Constante y no `{}` en el selector: zustand 5 vuelve a pintar sin fin si devuelve un objeto nuevo cada vez.
const NONE = {};
const answersOf = (s) => s.onboardingFlow?.answers ?? NONE;

// ── Elige cómo empezar (§25.2) ────────────────────────────────────────────────

function Source({ goTo }) {
  const { t } = useTranslation();
  const styles = useThemedStyles(makeStyles);
  const hasTemplates = useStore((s) => templatesOf(s.programs).length > 0);
  const flowAnswer   = useStore((s) => s.flowAnswer);
  const importData   = useStore((s) => s.importData);
  const fitdata = useFitdataImport((data, sections) => {
    importData(data, sections);
    flowAnswer({ programSource: 'import', programId: null });
    goTo('n_done');
  });

  // El nivel del primer onboarding: lo lee el constructor para su profundidad y las propuestas (§25.4.4).
  const savedLevel = () => {
    const level = useStore.getState().profile.onboardingAnswers?.level ?? null;
    flowAnswer({ level });
    return level;
  };

  return (
    <FlowBody>
      <FlowTitle text={t(`${K}.source.title`)} sub={t(`${K}.source.sub`)} />
      <View style={styles.opts}>
        <FlowOption
          chevron
          index={2}
          title={t(`${K}.source.recommended`)}
          desc={t(`${K}.source.recommendedDesc`)}
          onPick={() => goTo(savedLevel() ? 's_goal' : 's_level')}
        />
        <FlowOption
          chevron
          index={3}
          title={t(`${K}.source.scratch`)}
          desc={t(`${K}.source.scratchDesc`)}
          onPick={() => { savedLevel(); startBuilder(goTo, 'self'); }}
        />
        {hasTemplates && (
          <FlowOption
            chevron
            index={4}
            title={t(`${K}.source.template`)}
            desc={t(`${K}.source.templateDesc`)}
            onPick={() => goTo('n_templates')}
          />
        )}
        <FlowOption
          chevron
          index={5}
          title={t(`${K}.source.coach`)}
          desc={t(`${K}.source.coachDesc`)}
          onPick={() => goTo('c_code')}
        />
        <FlowOption
          chevron
          index={6}
          title={t(`${K}.source.import`)}
          desc={t(`${K}.source.importDesc`)}
          onPick={fitdata.pickFile}
        />
      </View>
      {fitdata.modal}
    </FlowBody>
  );
}

// ── Desde una plantilla (§25.2) ───────────────────────────────────────────────

function Templates({ goTo }) {
  const { t } = useTranslation();
  const styles = useThemedStyles(makeStyles);
  const programs   = useStore((s) => s.programs);
  const clone      = useStore((s) => s.cloneProgramFromTemplate);
  const flowAnswer = useStore((s) => s.flowAnswer);
  const [sel,  setSel]  = useState(null);   // la plantilla elegida
  const [name, setName] = useState('');     // el nombre de la copia, prellenado con el suyo

  function use() {
    const id = clone(sel.id, { name: name.trim() || sel.name });
    if (!id) return;   // el plan gratis lo paró
    flowAnswer({ programId: id, programSource: 'catalog' });
    goTo('n_done');
  }

  return (
    <FlowBody
      footer={<FlowFooter primary={{ label: t(`${K}.templates.use`), onPress: use, disabled: !sel }} />}
    >
      <FlowTitle text={t(`${K}.templates.title`)} sub={t(`${K}.templates.sub`)} />
      <View style={styles.opts}>
        {templatesOf(programs).map((tpl, i) => {
          const days = stageDays(tpl);
          return (
            <FlowOption
              key={tpl.id}
              index={2 + i}
              title={tpl.name}
              desc={[
                `${t(`${K}.templates.sessions`, { count: days.length })} · ${t(`${K}.templates.stages`, { count: tpl.stages?.length ?? 1 })}`,
                days.map((d) => d.label).join(' · '),
              ].filter(Boolean).join('\n')}
              selected={sel?.id === tpl.id}
              onPress={() => { setSel(tpl); setName(tpl.name); }}
            />
          );
        })}
      </View>
      {!!sel && (
        <Rise index={2}>
          <Text style={styles.label}>{t(`${K}.templates.name`)}</Text>
          <NameField
            style={styles.nameInput}
            value={name}
            onChangeText={setName}
            placeholder={sel.name}
            autoCorrect={false}
          />
        </Rise>
      )}
    </FlowBody>
  );
}

// ── Programa listo (§25.2) ────────────────────────────────────────────────────

function Done() {
  const { t } = useTranslation();
  const imported = useStore((s) => answersOf(s).programSource === 'import');
  const name     = useStore((s) => s.programs[answersOf(s).programId]?.name ?? '');
  const finish   = useStore((s) => s.finishOnboardingFlow);

  const panel = (
    <FlowPanel desc={t(`${K}.done.hint`)}>
      <PanelButton label={t('onboardingFlow.done.cta')} onPress={() => finish()} />
    </FlowPanel>
  );

  return (
    <FlowBody footer={panel}>
      <FlowTitle text={t(`${K}.done.title`)} sub={imported ? t(`${K}.done.subImport`) : t(`${K}.done.sub`, { name })} />
    </FlowBody>
  );
}

export default { n_source: Source, n_templates: Templates, n_done: Done };

// ── Styles ────────────────────────────────────────────────────────────────────

const makeStyles = (th) => StyleSheet.create({
  opts: { gap: spacing.md },
  label: { ...textStyles.caps, color: th.colors.mutedLight, textTransform: 'uppercase', marginTop: spacing.xl, marginBottom: spacing.sm2 },
  nameInput: {
    ...textStyles.bodyStrong, color: th.colors.text,
    backgroundColor: th.colors.surface, borderRadius: th.radius.md,
    paddingVertical: spacing.lg - 2, paddingHorizontal: spacing.lg,
  },
});
