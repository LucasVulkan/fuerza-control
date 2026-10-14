/**
 * Las pantallas del camino «por mi cuenta» del recorrido de entrada (O03-04,
 * spec §8, §20): nivel, «¿plantilla o el mío?», qué buscas, días y las
 * propuestas (con su «preparando» y «tu programa»).
 *
 * Cada una es un componente que `OnboardingFlowScreen` pinta por su id y recibe
 * `goTo(id)`. Las propuestas, «tu programa» y su hoja de ajustes son las de O01
 * (`components/onboarding/`). Nivel, objetivo y días van a `answers`; el nivel
 * también a `profile.onboardingAnswers`, que es de donde lo lee «Nuevo programa»
 * (O03-11 §25.2) para empezar directamente en `s_goal`.
 *
 * Maqueta: docs/mockups/onboarding-2.html (s_level, s_choice, s_goal, s_days, s_props).
 */
import { useEffect, useMemo, useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import Reanimated, { FadeIn } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { useStore } from '../../../../store/useStore';
import { rankArchetypes } from '../../../data/archetypes';
import { spacing, textStyles } from '../../../theme';
import { useTheme, useThemedStyles } from '../../../useTheme';
import { Text } from '../../../components/ui/Text';
import { Rise } from '../../../components/ui/Rise';
import { CheckIcon } from '../../../components/ui/EditorIcons';
import { showDialog } from '../../../components/ui/dialog';
import {
  FlowBody, FlowTitle, FlowOption, FlowTile, FlowFooter,
} from '../../../components/onboarding/flow';
import ProposalCard from '../../../components/onboarding/ProposalCard';
import { ProgramPreviewItems } from '../../../components/onboarding/ProgramPreview';
import usePreviewModel from '../../../components/onboarding/usePreviewModel';
import AdjustSheet from '../../../components/onboarding/AdjustSheet';
import useFitdataImport from '../../../components/onboarding/useFitdataImport';
import {
  LEVEL_IDS, IDENTITY_OPTIONS, DEFAULT_ANSWERS, SESSION_CHOICES,
} from '../../../components/onboarding/proposalData';
import { afterProposal } from '../../../utils/onboardingFlow';
import { startBuilder } from '../startBuilder';

// Constante y no `{}` en el selector: zustand 5 vuelve a pintar sin fin si devuelve un objeto nuevo cada vez.
const NONE = {};
const answersOf = (s) => s.onboardingFlow?.answers ?? NONE;

/**
 * El nivel: el contestado en este recorrido o, si «Nuevo programa» arranca en
 * `s_goal` (O03-11), el que ya estaba guardado en el perfil.
 */
const levelOf = (s) => answersOf(s).level ?? s.profile.onboardingAnswers?.level ?? null;

// ── Nivel (§8.1) ──────────────────────────────────────────────────────────────

function Level({ goTo }) {
  const { t } = useTranslation();
  const styles = useThemedStyles(makeStyles);
  const level      = useStore((s) => answersOf(s).level);
  const flowAnswer = useStore((s) => s.flowAnswer);
  const setProfile = useStore((s) => s.setProfile);

  function pick(id) {
    flowAnswer({ level: id });
    // Como en O01: el nivel queda también en las respuestas del perfil.
    setProfile({ onboardingAnswers: { ...useStore.getState().profile.onboardingAnswers, level: id } });
  }

  return (
    <FlowBody>
      <FlowTitle text={t('onboardingFlow.self.level.title')} />
      <View style={styles.opts}>
        {LEVEL_IDS.map((id, i) => (
          <FlowOption
            key={id}
            index={2 + i}
            title={t(`onboardingFlow.self.level.${id}`)}
            desc={t(`onboardingFlow.self.level.${id}Desc`)}
            selected={level === id}
            onPress={() => pick(id)}
            onPick={() => goTo('s_choice')}
          />
        ))}
      </View>
    </FlowBody>
  );
}

// ── ¿Plantilla o el mío? (§8.2) ───────────────────────────────────────────────

function Choice({ goTo }) {
  const { t } = useTranslation();
  const styles = useThemedStyles(makeStyles);
  const beginner   = useStore((s) => levelOf(s) === 'beginner');
  const entry      = useStore((s) => s.onboardingFlow?.entry);
  const flowAnswer = useStore((s) => s.flowAnswer);
  const importData = useStore((s) => s.importData);
  const flowDone   = useStore((s) => s.flowDone);

  const fitdata = useFitdataImport((data, sections) => {
    importData(data, sections);
    flowAnswer({ programSource: 'import' });
    flowDone({ key: 'program', ok: true, label: t('onboardingFlow.self.done.imported') });
    goTo(afterProposal(entry));
  });

  const toTemplates = () => { flowAnswer({ path: 'template' }); goTo('s_goal'); };
  const toBuilder   = () => { flowAnswer({ path: 'own' }); startBuilder(goTo, 'self'); };

  const secondary = [
    ...(beginner ? [{ label: t('onboardingFlow.self.choice.ownLink'), onPress: toBuilder }] : []),
    { label: t('onboardingFlow.self.choice.backup'), onPress: fitdata.pickFile },
  ];

  return (
    <FlowBody footer={<FlowFooter secondary={secondary} />}>
      <FlowTitle
        text={t(`onboardingFlow.self.choice.${beginner ? 'titleBeginner' : 'titleOther'}`)}
        sub={t(`onboardingFlow.self.choice.${beginner ? 'subBeginner' : 'subOther'}`)}
      />
      <View style={styles.opts}>
        <FlowOption
          chevron
          index={2}
          title={t('onboardingFlow.self.choice.programs')}
          desc={t('onboardingFlow.self.choice.programsDesc')}
          tag={beginner ? t('onboardingFlow.self.choice.recommended') : undefined}
          onPick={toTemplates}
        />
        {!beginner && (
          <FlowOption
            chevron
            index={3}
            title={t('onboardingFlow.self.choice.own')}
            desc={t('onboardingFlow.self.choice.ownDesc')}
            onPick={toBuilder}
          />
        )}
      </View>
      {fitdata.modal}
    </FlowBody>
  );
}

// ── Qué buscas (§8.3) ─────────────────────────────────────────────────────────

function Goal({ goTo }) {
  const { t } = useTranslation();
  const styles = useThemedStyles(makeStyles);
  const goal       = useStore((s) => answersOf(s).goal);
  const flowAnswer = useStore((s) => s.flowAnswer);
  return (
    <FlowBody>
      <FlowTitle text={t('onboardingFlow.self.goal.title')} />
      {[IDENTITY_OPTIONS.slice(0, 2), IDENTITY_OPTIONS.slice(2)].map((row, r) => (
        <View key={r} style={styles.tiles}>
          {row.map(({ id }, i) => (
            <FlowTile
              word
              key={id}
              big={t(`onboarding.identity.${id}.label`)}
              index={2 + r * 2 + i}
              selected={goal === id}
              onPress={() => flowAnswer({ goal: id })}
              onPick={() => goTo('s_days')}
            />
          ))}
        </View>
      ))}
    </FlowBody>
  );
}

// ── Días (§8.3) ───────────────────────────────────────────────────────────────

// Cuatro baldosas por fila; la última fila se completa con huecos para que midan lo mismo.
const DAY_ROWS = [SESSION_CHOICES.slice(0, 4), SESSION_CHOICES.slice(4)];

function Days({ goTo }) {
  const { t } = useTranslation();
  const styles = useThemedStyles(makeStyles);
  const days       = useStore((s) => answersOf(s).days);
  const flowAnswer = useStore((s) => s.flowAnswer);
  return (
    <FlowBody>
      <FlowTitle text={t('onboardingFlow.self.days.title')} sub={t('onboardingFlow.self.days.sub')} />
      {DAY_ROWS.map((row, r) => (
        <View key={r} style={styles.tiles}>
          {row.map((n, i) => (
            <FlowTile
              key={n}
              big={String(n)}
              index={2 + r * 4 + i}
              selected={days === n}
              onPress={() => flowAnswer({ days: n })}
              onPick={() => goTo('s_props')}
            />
          ))}
          {Array.from({ length: 4 - row.length }, (_, i) => <View key={`gap${i}`} style={styles.gap} />)}
        </View>
      ))}
    </FlowBody>
  );
}

// ── Propuestas (§8.3) ─────────────────────────────────────────────────────────

const PREP_STEP_MS  = 380;   // entre una casilla y la siguiente
const PREP_FIRST_MS = 450;   // hasta la primera
const PREP_END_MS   = 300;   // tras la última, antes de las propuestas

function PrepRow({ ok, label, index }) {
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <Rise index={index}>
      <View style={styles.prep}>
        <View style={[styles.prepDot, ok ? styles.prepOn : styles.prepOff]}>
          {ok && (
            <Reanimated.View entering={FadeIn.duration(180)}>
              <CheckIcon size={13} color={th.colors.onAccent} />
            </Reanimated.View>
          )}
        </View>
        <Text style={[styles.prepTxt, !ok && styles.prepTxtOff]}>{label}</Text>
      </View>
    </Rise>
  );
}

function Props({ goTo }) {
  const { t } = useTranslation();
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  const level      = useStore(levelOf);
  const goal       = useStore((s) => answersOf(s).goal);
  const days       = useStore((s) => answersOf(s).days);
  const entry      = useStore((s) => s.onboardingFlow?.entry);
  const flowAnswer = useStore((s) => s.flowAnswer);
  const flowDone   = useStore((s) => s.flowDone);
  const generate   = useStore((s) => s.generateAndActivateProgram);

  const [ticked,  setTicked]  = useState(0);          // casillas de «preparando» ya marcadas
  const [ready,   setReady]   = useState(false);      // acabó el «preparando»
  const [showAll, setShowAll] = useState(false);
  const [chosenId, setChosenId] = useState(null);     // plantilla elegida
  const [adjust,  setAdjust]  = useState(DEFAULT_ANSWERS);   // tiempo, material y limitaciones
  const [sheetOpen, setSheetOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Las casillas se marcan una a una y luego entran las propuestas.
  useEffect(() => {
    const timers = [0, 1, 2].map((i) => setTimeout(() => setTicked(i + 1), PREP_FIRST_MS + i * PREP_STEP_MS));
    timers.push(setTimeout(() => setReady(true), PREP_FIRST_MS + 2 * PREP_STEP_MS + PREP_END_MS));
    return () => timers.forEach(clearTimeout);
  }, []);

  const identity = IDENTITY_OPTIONS.find((o) => o.id === goal);
  // Lo que el motor recibe: las respuestas del recorrido más los ajustes de la hoja.
  const answers = useMemo(() => ({
    ...adjust, level, discipline: identity?.discipline ?? null, goal: identity?.goal ?? null, daysPerWeek: days,
  }), [adjust, level, identity, days]);

  // SIN material a propósito (O01 §9): aún no se ha preguntado, y `equipment`
  // ausente le dice a `rankArchetypes` que no lo puntúe.
  const ranked = useMemo(() => (ready ? rankArchetypes({
    level, discipline: answers.discipline, goal: answers.goal, daysPerWeek: days,
  }) : []), [ready, level, answers.discipline, answers.goal, days]);
  const chosen = chosenId ? ranked.find((r) => r.archetype.id === chosenId) : null;
  const model  = usePreviewModel(chosen, answers);

  async function confirm() {
    setLoading(true);
    try {
      // `distribution` ya no se pregunta, pero el snapshot la lleva: sale de la plantilla elegida.
      const { program } = await generate(
        { ...model.submitAnswers, distribution: chosen.archetype.distribution ?? 'full_body' }, chosenId,
      );
      flowAnswer({ programSource: 'proposal', programId: program.id });
      flowDone({ key: 'program', ok: true, label: t('onboardingFlow.self.done.program', { name: program.name }) });
      goTo(afterProposal(entry));
    } catch (err) {
      console.error('Error generando programa:', err);
      showDialog(t('common.error', 'Error'), t('onboarding.generateError', 'No se pudo generar el programa. Inténtalo de nuevo.'));
      setLoading(false);
    }
  }

  // Tu programa: el elegido, todavía sin guardar.
  if (model.tuned) {
    return (
      <>
        <FlowBody footer={(
          <FlowFooter
            primary={{ label: t(`onboardingFlow.self.props.${loading ? 'generating' : 'start'}`), onPress: confirm, disabled: loading }}
            secondary={loading ? [] : [{ label: t('onboardingFlow.self.props.other'), onPress: () => setChosenId(null) }]}
          />
        )}>
          <FlowTitle text={model.tuned.program.name.replace(/\*/g, '')} sub={t('onboardingFlow.self.props.previewSub')} />
          <Rise index={2}>
            <View style={styles.preview}>
              <ProgramPreviewItems model={model} answers={answers} onOpenSheet={() => setSheetOpen(true)} />
            </View>
          </Rise>
        </FlowBody>
        <AdjustSheet
          visible={sheetOpen}
          onClose={() => setSheetOpen(false)}
          answers={answers}
          onChange={(field, value) => setAdjust((a) => ({ ...a, [field]: value }))}
          timeCuts={model.timeCuts}
          subs={model.dedupedSubs}
          unresolved={model.tuned.unresolved}
        />
      </>
    );
  }

  // «Buscando tu programa»: repite lo contestado.
  if (!ready) {
    const prep = [
      t('onboardingFlow.self.props.level', { level: t(`onboardingFlow.self.level.${level}`, '') }),
      t(`onboarding.identity.${goal}.label`, ''),
      t('onboardingFlow.self.props.days', { count: days ?? 0 }),
    ];
    return (
      <FlowBody>
        <FlowTitle text={t('onboardingFlow.self.props.searching')} sub={t('onboardingFlow.self.props.searchingSub')} />
        <View style={styles.preps}>
          {prep.map((label, i) => <PrepRow key={i} ok={ticked > i} label={label} index={2 + i} />)}
        </View>
      </FlowBody>
    );
  }

  // Propuestas: la tarjeta enseña la estructura, que no depende del material.
  const visible = showAll ? ranked : ranked.slice(0, 3);
  return (
    <FlowBody>
      <FlowTitle text={t('onboardingFlow.self.props.title')} sub={t('onboardingFlow.self.props.sub')} />
      <View style={styles.preview}>
        {visible.map((e, i) => (
          <Rise key={e.archetype.id} index={2 + i}>
            <ProposalCard entry={e} recommended={i === 0} daysPerWeek={days} onPress={() => setChosenId(e.archetype.id)} />
          </Rise>
        ))}
      </View>
      {ranked.length > 3 && (
        <Pressable onPress={() => setShowAll((v) => !v)} accessibilityRole="button" style={styles.link}>
          <Text style={[styles.linkTxt, { color: th.colors.accent }]}>
            {showAll ? t('onboarding.proposals.seeTop') : t('onboarding.proposals.seeAll', { total: ranked.length })}
          </Text>
        </Pressable>
      )}
    </FlowBody>
  );
}

export default { s_level: Level, s_choice: Choice, s_goal: Goal, s_days: Days, s_props: Props };

// ── Styles ────────────────────────────────────────────────────────────────────

const makeStyles = (th) => StyleSheet.create({
  opts:  { gap: spacing.md },
  tiles: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  gap:   { flex: 1 },

  // «Preparando»: la misma fila que las de «Listo»
  preps: { gap: spacing.sm2 },
  prep: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing.lg - 3,
    backgroundColor:   th.colors.surface,
    borderRadius:      th.radius.lg,
    paddingVertical:   spacing.lg - 1,
    paddingHorizontal: spacing.lg + 1,
  },
  prepDot:    { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  prepOn:     { backgroundColor: th.colors.accent },
  prepOff:    { borderWidth: 2, borderColor: th.colors.muted },
  prepTxt:    { ...textStyles.bodyStrong, color: th.colors.text, flex: 1 },
  prepTxtOff: { ...textStyles.body, color: th.colors.mutedLight },

  // Propuestas y «tu programa»: la lista de O01, con su separación
  preview: { gap: spacing.md },
  link:    { paddingVertical: spacing.lg, alignItems: 'center' },
  linkTxt: { ...textStyles.bodyStrong },
});
