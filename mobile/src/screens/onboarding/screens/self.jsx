/**
 * Las pantallas del camino «por mi cuenta» del recorrido de entrada (O03-04,
 * spec §8, §20): «¿plantilla o el mío?» (O04-02), las cuatro preguntas —nivel,
 * días, qué buscas y tiempo (O04-03)— y las propuestas (con su «preparando» y
 * «tu programa»).
 *
 * Cada una es un componente que `OnboardingFlowScreen` pinta por su id y recibe
 * `goTo(id)`. Las propuestas, «tu programa» y su hoja de ajustes son las de O01
 * (`components/onboarding/`). Nivel, objetivo y días van a `answers`; el nivel
 * también a `profile.onboardingAnswers`, que es de donde lo lee «Nuevo programa»
 * (O03-11 §25.2) para empezar directamente en `s_days`.
 *
 * Maqueta: docs/mockups/onboarding-m05.html (O04); la antigua, onboarding-2.html.
 */
import { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import Reanimated, { FadeIn } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { useStore } from '../../../../store/useStore';
import { spacing, textStyles } from '../../../theme';
import { useTheme, useThemedStyles } from '../../../useTheme';
import { Text } from '../../../components/ui/Text';
import { Rise } from '../../../components/ui/Rise';
import TemplateCarousel, { TemplateList } from '../../../components/onboarding/TemplateCarousel';
import { CheckIcon } from '../../../components/ui/EditorIcons';
import { showDialog } from '../../../components/ui/dialog';
import {
  FlowBody, FlowTitle, FlowOption, FlowTile, FlowChoice, FlowFooter, FlowImplies,
} from '../../../components/onboarding/flow';
import useFitdataImport from '../../../components/onboarding/useFitdataImport';
import {
  LEVEL_IDS, IDENTITY_OPTIONS, SESSION_CHOICES,
} from '../../../components/onboarding/proposalData';
import { afterProposal } from '../../../utils/onboardingFlow';
import { startBuilder } from '../startBuilder';
import { answersOf, levelOf, useProgramModel, TIMES } from './selfProgram';

/** «Tengo una copia de seguridad»: importa un `.fitdata` y sigue a Aprende (§8.2, O03-12). */
function useBackup(goTo) {
  const { t } = useTranslation();
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
  return { modal: fitdata.modal, secondary: [{ label: t('onboardingFlow.self.choice.backup'), onPress: fitdata.pickFile }] };
}

// ── Las cuatro preguntas (O04-03, spec §4) ────────────────────────────────────
// Nivel → días → objetivo → tiempo → plantillas. Cada una marca una respuesta, la
// explica en «Qué implica» y «Continuar» lleva a la siguiente: elegir no avanza.

const list = (v) => (Array.isArray(v) ? v : []);

/** Los puntos de la respuesta marcada (`onboardingFlow.self.ask.<pregunta>.<id>`), o nada. */
function impliesOf(t, kind, id) {
  if (id == null) return null;
  const base = `onboardingFlow.self.ask.${kind}.${id}`;
  return {
    points: list(t(`${base}.pts`, { returnObjects: true, defaultValue: [] })),
    warns:  list(t(`${base}.warn`, { returnObjects: true, defaultValue: [] })),
  };
}

function Ask({ n, kind, id, title, sub, cta, onNext, children }) {
  const { t } = useTranslation();
  const styles = useThemedStyles(makeStyles);
  return (
    <FlowBody footer={(
      <FlowFooter primary={{ label: cta ?? t('onboardingFlow.common.continue'), disabled: id == null, onPress: onNext }} />
    )}>
      <Rise index={0}><Text style={styles.step}>{t('onboardingFlow.self.ask.step', { n })}</Text></Rise>
      <FlowTitle text={title} sub={sub} index={1} />
      {children}
      <FlowImplies title={t('onboardingFlow.self.ask.implies')} k={id} {...impliesOf(t, kind, id)} />
    </FlowBody>
  );
}

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
    <Ask n={1} kind="level" id={level} title={t('onboardingFlow.self.level.title')} onNext={() => goTo('s_days')}>
      <View style={styles.opts}>
        {LEVEL_IDS.map((id, i) => (
          <FlowOption
            key={id}
            index={3 + i}
            title={t(`onboardingFlow.self.level.${id}`)}
            desc={t(`onboardingFlow.self.level.${id}Desc`)}
            selected={level === id}
            onPress={() => pick(id)}
          />
        ))}
      </View>
    </Ask>
  );
}

// ── ¿Plantilla o el mío? (§8.2) ───────────────────────────────────────────────

function Choice({ goTo }) {
  const { t } = useTranslation();
  const styles = useThemedStyles(makeStyles);
  const path       = useStore((s) => answersOf(s).path);
  const flowAnswer = useStore((s) => s.flowAnswer);
  const backup     = useBackup(goTo);

  const next = () => (path === 'own' ? startBuilder(goTo, 'self') : goTo('s_level'));

  return (
    <FlowBody footer={<FlowFooter primary={{ label: t('onboardingFlow.common.continue'), disabled: !path, onPress: next }} secondary={backup.secondary} />}>
      <FlowTitle text={t('onboardingFlow.self.choice.title')} sub={t('onboardingFlow.self.choice.sub')} />
      <View style={styles.opts}>
        <FlowChoice
          index={2}
          art="template"
          title={t('onboardingFlow.self.choice.programs')}
          desc={t('onboardingFlow.self.choice.programsDesc')}
          selected={path === 'template'}
          onPress={() => flowAnswer({ path: 'template' })}
        />
        <FlowChoice
          index={3}
          art="own"
          title={t('onboardingFlow.self.choice.own')}
          desc={t('onboardingFlow.self.choice.ownDesc')}
          selected={path === 'own'}
          onPress={() => flowAnswer({ path: 'own' })}
        />
      </View>
      {backup.modal}
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
    <Ask n={2} kind="days" id={days} title={t('onboardingFlow.self.days.title')} sub={t('onboardingFlow.self.days.sub')} onNext={() => goTo('s_goal')}>
      {DAY_ROWS.map((row, r) => (
        <View key={r} style={styles.tiles}>
          {row.map((n, i) => (
            <FlowTile
              key={n}
              big={String(n)}
              index={3 + r * 4 + i}
              selected={days === n}
              onPress={() => flowAnswer({ days: n })}
            />
          ))}
          {Array.from({ length: 4 - row.length }, (_, i) => <View key={`gap${i}`} style={styles.gap} />)}
        </View>
      ))}
    </Ask>
  );
}

// ── Qué buscas (§8.3) ─────────────────────────────────────────────────────────

function Goal({ goTo }) {
  const { t } = useTranslation();
  const styles = useThemedStyles(makeStyles);
  const goal       = useStore((s) => answersOf(s).goal);
  const flowAnswer = useStore((s) => s.flowAnswer);
  return (
    <Ask n={3} kind="goal" id={goal} title={t('onboardingFlow.self.goal.title')} onNext={() => goTo('s_time')}>
      {[IDENTITY_OPTIONS.slice(0, 2), IDENTITY_OPTIONS.slice(2)].map((row, r) => (
        <View key={r} style={styles.tiles}>
          {row.map(({ id }, i) => (
            <FlowTile
              word
              key={id}
              big={t(`onboarding.identity.${id}.label`)}
              index={3 + r * 2 + i}
              selected={goal === id}
              onPress={() => flowAnswer({ goal: id })}
            />
          ))}
        </View>
      ))}
    </Ask>
  );
}

// ── Tiempo (O04-03) ───────────────────────────────────────────────────────────

function Time({ goTo }) {
  const { t } = useTranslation();
  const styles = useThemedStyles(makeStyles);
  const minutes    = useStore((s) => answersOf(s).sessionMinutes);
  const flowAnswer = useStore((s) => s.flowAnswer);
  return (
    <Ask
      n={4}
      kind="time"
      id={minutes}
      title={t('onboardingFlow.self.time.title')}
      cta={t('onboardingFlow.self.time.cta')}
      onNext={() => goTo('s_props')}
    >
      <View style={styles.tiles}>
        {TIMES.map((min, i) => (
          <FlowTile
            key={min}
            square
            big={String(min)}
            label={t('onboardingFlow.self.time.unit')}
            index={3 + i}
            selected={minutes === min}
            onPress={() => flowAnswer({ sessionMinutes: min })}
          />
        ))}
      </View>
    </Ask>
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
  const styles = useThemedStyles(makeStyles);
  const level      = useStore(levelOf);
  const goal       = useStore((s) => answersOf(s).goal);
  const entry      = useStore((s) => s.onboardingFlow?.entry);
  const flowAnswer = useStore((s) => s.flowAnswer);
  const flowDone   = useStore((s) => s.flowDone);
  const generate   = useStore((s) => s.generateAndActivateProgram);

  const [ticked,  setTicked]  = useState(0);          // casillas de «preparando» ya marcadas
  const [ready,   setReady]   = useState(false);      // acabó el «preparando»
  const [showAll, setShowAll] = useState(false);
  const [idx,     setIdx]     = useState(0);          // la tarjeta centrada del carrusel
  const [listId,  setListId]  = useState(null);       // la marcada en la lista de todas
  const [loading, setLoading] = useState(false);
  const [viewH,   setViewH]   = useState(0);          // alto del scroll de la pantalla
  const [carTop,  setCarTop]  = useState(0);          // dónde empieza el carrusel dentro de él
  const { days, ranked, answers, submitAnswers } = useProgramModel(ready);
  const top  = useMemo(() => ranked.slice(0, 3), [ranked]);
  // La elegida: en la lista, la marcada (puede no haber); en el carrusel, la centrada.
  const chosen = showAll ? ranked.find((r) => r.archetype.id === listId) : top[idx];

  // Las casillas se marcan una a una y luego entran las propuestas.
  useEffect(() => {
    const timers = [0, 1, 2, 3].map((i) => setTimeout(() => setTicked(i + 1), PREP_FIRST_MS + i * PREP_STEP_MS));
    timers.push(setTimeout(() => setReady(true), PREP_FIRST_MS + 3 * PREP_STEP_MS + PREP_END_MS));
    return () => timers.forEach(clearTimeout);
  }, []);

  async function confirm() {
    setLoading(true);
    try {
      // `distribution` ya no se pregunta, pero el snapshot la lleva: sale de la plantilla elegida.
      const { program } = await generate(
        { ...submitAnswers, distribution: chosen.archetype.distribution ?? 'full_body' }, chosen.archetype.id,
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

  // «Buscando tu programa»: repite lo contestado.
  if (!ready) {
    const prep = [
      t('onboardingFlow.self.props.level', { level: t(`onboardingFlow.self.level.${level}`, '') }),
      t(`onboarding.identity.${goal}.label`, ''),
      t('onboardingFlow.self.props.days', { count: days ?? 0 }),
      t('onboardingFlow.self.props.minutes', { count: answers.sessionMinutes }),
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

  // Propuestas (O04-04, O04-08): las tres mejores en un carrusel, o todas en una lista; el botón cambia de vista.
  const secondary = ranked.length > top.length
    ? [{
      label: showAll ? t('onboarding.proposals.seeTop') : t('onboardingFlow.self.props.seeAll'),
      onPress: () => { setShowAll((v) => !v); setListId(null); setIdx(0); },
    }]
    : [];
  return (
    <FlowBody onViewport={setViewH} footer={(
      <FlowFooter
        primary={{ label: t('onboardingFlow.self.cards.start'), loading, disabled: !chosen, onPress: confirm }}
        secondary={secondary}
      />
    )}>
      <FlowTitle text={t('onboardingFlow.self.props.title')} />
      {showAll ? (
        <TemplateList
          entries={ranked}
          answers={answers}
          days={days}
          minutes={answers.sessionMinutes}
          pickedId={listId}
          onPick={setListId}
        />
      ) : (
        // Su `y` y el alto del scroll dicen cuánto queda para la tarjeta.
        <View onLayout={(e) => setCarTop(e.nativeEvent.layout.y)}>
          <Rise index={2}>
            <TemplateCarousel
              availableH={viewH - carTop}
              entries={top}
              answers={answers}
              days={days}
              minutes={answers.sessionMinutes}
              onIndex={setIdx}
            />
          </Rise>
        </View>
      )}
    </FlowBody>
  );
}

export default { s_level: Level, s_choice: Choice, s_goal: Goal, s_days: Days, s_time: Time, s_props: Props };

// ── Styles ────────────────────────────────────────────────────────────────────

const makeStyles = (th) => StyleSheet.create({
  opts:  { gap: spacing.md },
  tiles: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  gap:   { flex: 1 },
  // «1 de 4»: texto discreto sobre el título, no otra barra.
  step:  { ...textStyles.caps, color: th.colors.mutedLight, textTransform: 'uppercase', marginBottom: spacing.sm2 },

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
});
