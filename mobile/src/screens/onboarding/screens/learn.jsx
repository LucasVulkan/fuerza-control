/**
 * Las pantallas del tramo «Aprende» del recorrido de entrada (O03-06, spec §11.2-11.4):
 *
 *   a_home   «¿Cómo quieres ver tus sesiones?» — Lista o Pestañas, una debajo de otra,
 *            cada una con su miniatura de Inicio. Guarda `profile.homeView`.
 *   a_input  «Pruébalo: arrastra el peso» — una fila de serie que se arrastra de
 *            verdad, con regla o solo deslizando. «Me quedo con este» guarda
 *            `profile.scrubRuler`.
 *   a_cards  las tarjetas simuladas (3-4 por camino, con puntos y Anterior/
 *            Siguiente). El entrenador que no entrena entra directamente aquí
 *            (`learnStart` del util).
 *
 * Orden: a_home → a_input → a_cards → done. Cada una recibe `goTo(id)`.
 * Maqueta: docs/mockups/onboarding-2.html (a_home, input, a_learn, t_learn).
 */
import { useEffect, useMemo, useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import Reanimated, {
  FadeInLeft, FadeInRight, useSharedValue, useAnimatedStyle, withTiming, Easing,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { useStore } from '../../../../store/useStore';
import { spacing, textStyles, withOpacity } from '../../../theme';
import { useTheme, useThemedStyles } from '../../../useTheme';
import { Text, MAX_FONT_SCALE } from '../../../components/ui/Text';
import { Rise } from '../../../components/ui/Rise';
import { FlowBody, FlowTitle, FlowOption, FlowFooter } from '../../../components/onboarding/flow';
import { FillPressable } from '../../../components/onboarding/flow/FlowFill';
import { useInk } from '../../../components/onboarding/flow/useFill';
import HomeViewPreview from '../../../components/onboarding/learn/HomeViewPreview';
import ScrubDemo from '../../../components/onboarding/learn/ScrubDemo';
import ClientsMini from '../../../components/onboarding/learn/ClientsMini';
import { Mini, MiniTemplates, MiniNext, MiniLogFor, MiniCoach } from '../../../components/onboarding/learn/CardMinis';
import { previewSessions, learnCards } from '../../../utils/onboardingPreview';

// Constantes y no `{}` en el selector: zustand 5 repinta sin fin si devuelve un objeto nuevo cada vez.
const NONE = {};
const answersOf = (s) => s.onboardingFlow?.answers ?? NONE;

/**
 * Las sesiones que enseñan las miniaturas de Inicio: las del programa del usuario
 * (el del recorrido o el activo) si tiene al menos dos; si no, unas genéricas.
 */
function usePreviewSessions() {
  const { t } = useTranslation();
  const program   = useStore((s) => s.programs[answersOf(s).programId ?? s.profile.activeProgramId]);
  const templates = useStore((s) => s.sessionTemplates);
  const library   = useStore((s) => s.exerciseLibrary);
  const custom    = useStore((s) => s.customExercises);
  return useMemo(() => {
    const real = previewSessions(program, templates, { ...library, ...custom });
    if (real.length >= 2) return real;
    const names = t('onboardingFlow.learn.sessionNames', { returnObjects: true });
    return (Array.isArray(names) ? names : []).map((name, i) => ({
      marker: String.fromCharCode(65 + i), name, exercises: 5, minutes: 55,
    }));
  }, [program, templates, library, custom, t]);
}

// ── a_home (§11.2) ────────────────────────────────────────────────────────────

/** Una de las dos opciones: la miniatura, su nombre y su línea. Se rellena de lima al elegirla. */
function ViewTile({ view, sessions, selected, title, desc, tag, onPress, index }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <Rise index={index} style={styles.cell}>
      <FillPressable
        selected={selected}
        onPress={onPress}
        style={styles.vtile}
        accessibilityRole="radio"
        accessibilityLabel={[title, desc].filter(Boolean).join(', ')}
      >
        {(p) => <ViewTileBody p={p} view={view} sessions={sessions} title={title} desc={desc} tag={tag} />}
      </FillPressable>
    </Rise>
  );
}

function ViewTileBody({ p, view, sessions, title, desc, tag }) {
  const C      = useTheme().colors;
  const styles = useThemedStyles(makeStyles);
  const titleInk = useInk(p, C.text, C.onAccent);
  const descInk  = useInk(p, C.mutedLight, withOpacity(C.onAccent, 0.68));
  const tagBg    = useInk(p, withOpacity(C.accent, 0.12), C.onAccent, 'backgroundColor');
  return (
    <>
      {/* El nombre arriba y, debajo, la miniatura en esquema (14-oct): se lee como un dibujo, no como algo que pulsar. */}
      <Reanimated.Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[styles.vtitle, titleInk]}>{title}</Reanimated.Text>
      <Reanimated.Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[styles.vdesc, descInk]}>{desc}</Reanimated.Text>
      {!!tag && (
        <Reanimated.View style={[styles.vtag, tagBg]}>
          <Text style={styles.vtagTxt}>{tag}</Text>
        </Reanimated.View>
      )}
      <View style={styles.vscreen}>
        <View style={styles.vmini}><HomeViewPreview view={view} sessions={sessions} wireframe /></View>
      </View>
    </>
  );
}

function Home({ goTo }) {
  const { t } = useTranslation();
  const styles = useThemedStyles(makeStyles);
  const view       = useStore((s) => s.profile.homeView ?? 'cards');
  const setProfile = useStore((s) => s.setProfile);
  const linked     = useStore((s) => !!answersOf(s).linked);
  const sessions   = usePreviewSessions();
  return (
    <FlowBody footer={<FlowFooter primary={{ label: t('onboardingFlow.common.next'), onPress: () => goTo('a_input') }} />}>
      <FlowTitle text={t('onboardingFlow.learn.home.title')} sub={t('onboardingFlow.learn.home.sub')} />
      <View style={styles.vrow} accessibilityRole="radiogroup">
        <ViewTile
          index={2} view="cards" sessions={sessions} selected={view === 'cards'}
          title={t('onboardingFlow.learn.home.list')} desc={t('onboardingFlow.learn.home.listDesc')}
          onPress={() => setProfile({ homeView: 'cards' })}
        />
        <ViewTile
          index={3} view="tabs" sessions={sessions} selected={view === 'tabs'}
          title={t('onboardingFlow.learn.home.tabs')} desc={t('onboardingFlow.learn.home.tabsDesc')}
          // Con entrenador conectado se recomiendan: es para quien recibe un programa (U13 §1).
          tag={linked ? t('onboardingFlow.learn.home.forYou') : null}
          onPress={() => setProfile({ homeView: 'tabs' })}
        />
      </View>
    </FlowBody>
  );
}

// ── a_input (§11.3) ───────────────────────────────────────────────────────────

function Input({ goTo }) {
  const { t } = useTranslation();
  const styles = useThemedStyles(makeStyles);
  const stored     = useStore((s) => s.profile.scrubRuler ?? true);
  const setProfile = useStore((s) => s.setProfile);
  // Elegir una tarjeta solo cambia cómo responde la fila; se guarda con «Me quedo con este».
  const [ruler, setRuler] = useState(stored);
  return (
    <FlowBody
      footer={(
        <FlowFooter
          primary={{
            label: t('onboardingFlow.learn.input.keep'),
            onPress: () => { setProfile({ scrubRuler: ruler }); goTo('a_cards'); },
          }}
        />
      )}
    >
      <FlowTitle text={t('onboardingFlow.learn.input.title')} sub={t('onboardingFlow.learn.input.sub')} />
      <Rise index={2}><ScrubDemo ruler={ruler} /></Rise>
      <View style={styles.opts} accessibilityRole="radiogroup">
        <FlowOption
          index={3} selected={ruler} onPress={() => setRuler(true)}
          title={t('onboardingFlow.learn.input.ruler')} desc={t('onboardingFlow.learn.input.rulerDesc')}
        />
        <FlowOption
          index={4} selected={!ruler} onPress={() => setRuler(false)}
          title={t('onboardingFlow.learn.input.swipe')} desc={t('onboardingFlow.learn.input.swipeDesc')}
        />
      </View>
    </FlowBody>
  );
}

// ── a_cards (§11.4) ───────────────────────────────────────────────────────────

const DOT = 8;
const DOT_ON = 24;

function Dot({ state }) {
  const th = useTheme();
  const on = state === 'on';
  const w  = useSharedValue(on ? DOT_ON : DOT);
  // El punto activo se alarga; los pasados quedan en lima apagado.
  useEffect(() => {
    w.set(withTiming(on ? DOT_ON : DOT, { duration: 350, easing: Easing.out(Easing.cubic) }));
  }, [on, w]);
  const style = useAnimatedStyle(() => ({ width: w.get() }));
  const color = on ? th.colors.accent : state === 'past' ? th.tint.accent50 : th.colors.surface2;
  return <Reanimated.View style={[{ height: DOT, borderRadius: DOT / 2, backgroundColor: color }, style]} />;
}

/** Los textos y la miniatura de cada tarjeta, por id (`learnCards`). */
function useCard(id) {
  const { t } = useTranslation();
  const a        = useStore(answersOf);
  const view     = useStore((s) => s.profile.homeView ?? 'cards');
  const client   = useStore((s) => s.clients[answersOf(s).clientId]);
  const program  = useStore((s) => s.programs[answersOf(s).programId ?? s.profile.activeProgramId]);
  const sessions = usePreviewSessions();
  const L = (k, o) => t(`onboardingFlow.learn.cards.${k}`, o);

  const trainer   = (a.linked?.trainerName ?? '').replace(/\*/g, '') || t('onboardingFlow.learn.yourTrainer');
  const trainerLc = (a.linked?.trainerName ?? '').replace(/\*/g, '') || t('onboardingFlow.learn.yourTrainerLc');
  const clientName = client?.name?.replace(/\*/g, '');

  switch (id) {
    case 'clients':
      return { title: L('clients.title'), sub: L('clients.sub'), mini: <ClientsMini /> };
    case 'today':
      return {
        title: L('today.title'),
        sub:   L(view === 'tabs' ? 'today.subTabs' : 'today.subCards'),
        mini:  <Mini interactive><HomeViewPreview view={view} sessions={sessions} spot="start" touchable /></Mini>,
      };
    case 'edit':
      return { title: L('edit.title'), sub: L('edit.sub'), mini: <MiniTemplates edit sessions={sessions} /> };
    case 'sees':
      return {
        title: L('sees.title', { trainer }),
        sub:   L('sees.sub'),
        mini:  <MiniCoach trainer={trainer} trainerLc={trainerLc} session={sessions[0]} />,
      };
    case 'free':
      return {
        title: L('free.title'),
        sub:   a.linked ? L('free.subLinked', { trainer: trainerLc }) : L('free.sub'),
        mini:  <Mini interactive><HomeViewPreview view={view} sessions={sessions} spot="free" touchable /></Mini>,
      };
    case 'templates':
      return {
        title: L('templates.title'),
        sub:   L('templates.sub', { client: clientName ?? t('onboardingFlow.learn.yourClient') }),
        mini:  <MiniTemplates sessions={sessions} templateName={program?.name ?? t('onboardingFlow.learn.mini.templateExample')} />,
      };
    case 'next':
      return {
        title: L('next.title'),
        sub:   L('next.sub'),
        mini:  <MiniNext clientName={clientName ?? t('onboardingFlow.learn.exampleClient')} />,
      };
    default: {   // 'log'
      const name = clientName ?? t('onboardingFlow.learn.exampleClient');
      return { title: L('log.title'), sub: L('log.sub', { client: name }), mini: <MiniLogFor clientName={name} session={sessions[0]} /> };
    }
  }
}

function CardBody({ id, index }) {
  const styles = useThemedStyles(makeStyles);
  const { title, sub, mini } = useCard(id);
  return (
    <>
      <Rise index={index}>
        <View style={styles.stage}>{mini}</View>
      </Rise>
      <FlowTitle text={title} sub={sub} index={index + 1} />
    </>
  );
}

function Cards({ goTo }) {
  const { t } = useTranslation();
  const styles = useThemedStyles(makeStyles);
  const role       = useStore((s) => answersOf(s).role);
  const alsoTrains = useStore((s) => answersOf(s).alsoTrains);
  const linked     = useStore((s) => answersOf(s).linked);
  const clientMode = useStore((s) => answersOf(s).clientMode);
  const ids = useMemo(() => learnCards({ role, alsoTrains, linked, clientMode }), [role, alsoTrains, linked, clientMode]);

  const [at, setAt] = useState({ i: 0, dir: 0 });   // dir 0: la primera entra con la pantalla
  const last = at.i === ids.length - 1;
  const go = (d) => setAt((c) => ({ i: Math.max(0, Math.min(ids.length - 1, c.i + d)), dir: d }));

  const footer = (
    <FlowFooter>
      <View style={styles.nav}>
        {at.i > 0 && (
          <Pressable onPress={() => go(-1)} accessibilityRole="button" style={[styles.navBtn, styles.navPrev]}>
            <Text style={styles.navPrevTxt}>{t('onboardingFlow.learn.cards.prev')}</Text>
          </Pressable>
        )}
        <Pressable
          onPress={() => (last ? goTo('done') : go(1))}
          accessibilityRole="button"
          style={[styles.navBtn, styles.navNext]}
        >
          <Text style={styles.navNextTxt}>{last ? t('onboardingFlow.learn.cards.done') : t('onboardingFlow.common.next')}</Text>
        </Pressable>
      </View>
    </FlowFooter>
  );

  return (
    <FlowBody footer={footer}>
      <Rise index={0}>
        <View style={styles.dots} accessibilityRole="progressbar" accessibilityValue={{ min: 1, max: ids.length, now: at.i + 1 }}>
          {ids.map((id, j) => <Dot key={id} state={j === at.i ? 'on' : j < at.i ? 'past' : 'next'} />)}
        </View>
      </Rise>
      {/* Cada tarjeta entra por el lado de donde viene. */}
      <Reanimated.View key={ids[at.i]} entering={at.dir === 0 ? undefined : (at.dir > 0 ? FadeInRight : FadeInLeft).duration(260)}>
        <CardBody id={ids[at.i]} index={1} />
      </Reanimated.View>
    </FlowBody>
  );
}

export default { a_home: Home, a_input: Input, a_cards: Cards };

// ── Styles ────────────────────────────────────────────────────────────────────

const makeStyles = (th) => StyleSheet.create({
  // a_home
  // Una debajo de otra (14-oct): lado a lado las miniaturas se veían demasiado pequeñas.
  vrow:  { gap: spacing.md },
  cell:  {},
  vtile: {
    borderRadius: th.radius.lg,
    padding:      spacing.md,
    alignItems:   'stretch',
  },
  vscreen: {
    backgroundColor: th.colors.bg,
    borderRadius:    th.radius.md,
    padding:         spacing.md,
    marginTop:       spacing.md,
  },
  // Un poco más pequeña que el ancho de la tarjeta (14-oct).
  vmini: { width: '80%', alignSelf: 'center' },
  vtitle: { ...textStyles.itemTitleQuiet, paddingHorizontal: spacing.xs2 },
  vdesc:  { ...textStyles.label, marginTop: spacing.xs, paddingHorizontal: spacing.xs2, paddingBottom: spacing.xs2 },
  vtag: {
    alignSelf:         'flex-start',
    marginTop:         spacing.sm,
    marginLeft:        spacing.xs2,
    borderRadius:      th.radius.sm,
    paddingHorizontal: spacing.sm2,
    paddingVertical:   spacing.xs2 + 1,
    marginBottom:      spacing.xs2,
  },
  vtagTxt: { ...textStyles.caps, color: th.colors.accent },

  // a_input
  opts: { gap: spacing.md },

  // a_cards
  dots:  { flexDirection: 'row', gap: spacing.sm, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.lg, height: DOT },
  stage: {
    backgroundColor: th.colors.surface,
    borderRadius:    th.radius.lg,
    padding:         spacing.lg,
    marginBottom:    spacing.xl,
  },
  nav:        { flexDirection: 'row', gap: spacing.sm2 },
  navBtn:     { flex: 1, borderRadius: th.radius.md, paddingVertical: spacing.lg + 2, alignItems: 'center' },
  navPrev:    { backgroundColor: th.colors.surface2 },
  navPrevTxt: { ...textStyles.button, color: th.colors.text, textTransform: 'uppercase' },
  navNext:    { backgroundColor: th.colors.accent },
  navNextTxt: { ...textStyles.button, color: th.colors.onAccent, textTransform: 'uppercase' },
});
