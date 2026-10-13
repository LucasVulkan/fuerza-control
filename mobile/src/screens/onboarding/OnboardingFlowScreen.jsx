/**
 * OnboardingFlowScreen — el recorrido de entrada por caminos (ruta `Start`,
 * docs/specs/O03-onboarding-caminos.md §16).
 *
 * Pinta lo que dice `onboardingFlow.screen` (store, persistido) con el registro
 * `SCREENS`: cada fichero de `screens/` exporta `{ id: Component }` y esta pantalla
 * no se toca al añadir caminos. Pone encima la cabecera fija (atrás · tramo ·
 * Saltar y la barra de cuatro tramos) y debajo la transición entre pantallas: 18 px
 * de desplazamiento, 260 ms, out cubic, hacia la izquierda al volver. El atrás de
 * Android hace lo que la flecha.
 *
 * Cada pantalla recibe `goTo(id)`. Si `id` aún no tiene pantalla (los caminos
 * llegan por olas), hace la SALIDA PROVISIONAL de O03-01 §17.5: termina el
 * recorrido y abre lo de hoy, para que la app siga usable.
 */
import { useCallback, useEffect, useState } from 'react';
import { View, BackHandler, StyleSheet } from 'react-native';
import Reanimated, { useSharedValue, useAnimatedStyle, withTiming, Easing, useReducedMotion } from 'react-native-reanimated';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useStore } from '../../../store/useStore';
import { useTheme } from '../../useTheme';
import FlowHeader from '../../components/onboarding/flow/FlowHeader';
import { SECTIONS, sectionOf, barFills, skipTarget, canGoBack } from '../../utils/onboardingFlow';

import commonScreens     from './screens/common';
import builderScreens    from './screens/builder';
import selfScreens       from './screens/self';
import coachedScreens    from './screens/coached';
import learnScreens      from './screens/learn';
import recoverScreens    from './screens/recover';
import trainerScreens    from './screens/trainer';
import newProgramScreens from './screens/newProgram';

const SCREENS = {
  ...commonScreens, ...builderScreens, ...selfScreens, ...coachedScreens,
  ...learnScreens, ...recoverScreens, ...trainerScreens, ...newProgramScreens,
};

const SLIDE_X  = 18;
const SLIDE_MS = 260;

/**
 * La salida provisional (O03-01 §17.5) hacia el camino que aún no existe:
 * entrenador → la app; con entrenador → el selector de siempre con la hoja del
 * código abierta; lo demás → el selector de siempre. Desaparece sola cuando el
 * camino registra su primera pantalla.
 */
function provisionalExit(id) {
  const { finishOnboardingFlow, setProfile } = useStore.getState();
  if (id?.startsWith('t_')) {
    finishOnboardingFlow();
  } else if (id?.startsWith('c_')) {
    setProfile({ role: 'coached', proTabsHidden: true });
    finishOnboardingFlow({ route: 'Onboarding', params: { openCode: true } });
  } else {
    finishOnboardingFlow({ route: 'Onboarding' });
  }
}

/** La pantalla que entra: se desplaza 18 px hacia su sitio (`dir` −1 = volviendo, 0 = sin mover). */
function Slide({ dir, children }) {
  const reduced = useReducedMotion();
  const x = useSharedValue(reduced ? 0 : dir * SLIDE_X);
  useEffect(() => {
    x.set(withTiming(0, { duration: SLIDE_MS, easing: Easing.out(Easing.cubic) }));
  }, [x]);
  const move = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));
  return <Reanimated.View style={[styles.fill, move]}>{children}</Reanimated.View>;
}

export default function OnboardingFlowScreen() {
  const { t } = useTranslation();
  const th     = useTheme();
  const insets = useSafeAreaInsets();
  const flow          = useStore((s) => s.onboardingFlow);
  const flowGo        = useStore((s) => s.flowGo);
  const flowBack      = useStore((s) => s.flowBack);
  const flowAnswer    = useStore((s) => s.flowAnswer);
  const pendingInvite = useStore((s) => s.pendingInviteCode);

  const screen = flow?.screen;
  const entry  = flow?.entry;
  const viaInvite = flow?.answers.viaInvite;

  // Hacia dónde se movió la pantalla, para que la transición entre por el lado
  // que toca (a la izquierda al volver). Se deriva en el render y no en un
  // efecto: el efecto llegaría un fotograma tarde.
  const [nav, setNav] = useState({ screen, len: flow?.history.length ?? 0, dir: 0 });
  if (flow && screen !== nav.screen) {
    setNav({ screen, len: flow.history.length, dir: flow.history.length < nav.len ? -1 : 1 });
  }

  // Invitación (M01-04): con un código pendiente, la bienvenida lo cuenta y el
  // recorrido se salta la bifurcación (§9.5). Si llega tarde, también vale.
  useEffect(() => {
    if (pendingInvite && entry === 'first' && !viaInvite) flowAnswer({ viaInvite: true });
  }, [pendingInvite, entry, viaInvite, flowAnswer]);

  // Un recorrido guardado con una pantalla que ya no existe (otra versión) se reinicia.
  useEffect(() => {
    if (screen && !SCREENS[screen]) useStore.getState().startOnboardingFlow({ entry });
  }, [screen, entry]);

  // El atrás de Android hace lo que la flecha. En la bienvenida, lo de siempre;
  // en el cierre no se sale (como la flecha, que ahí no está).
  useFocusEffect(useCallback(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      const f = useStore.getState().onboardingFlow;
      if (!f) return false;
      if (canGoBack(f)) { useStore.getState().flowBack(); return true; }
      return f.history.length > 0;
    });
    return () => sub.remove();
  }, []));

  const goTo = useCallback((id) => {
    if (id && SCREENS[id]) flowGo(id);
    else provisionalExit(id);
  }, [flowGo]);

  const Screen = screen ? SCREENS[screen] : null;
  if (!flow || !Screen) return <View style={[styles.root, { backgroundColor: th.colors.bg }]} />;

  const sec     = sectionOf(screen);
  const newProg = entry === 'newProgram';
  const showBar = sec >= 0 && !newProg;
  const skip    = skipTarget(screen, flow.answers, entry);
  let name = '';
  if (newProg) name = t('onboardingFlow.common.newProgram');
  else if (sec >= SECTIONS.length) name = t('onboardingFlow.common.completed');
  else if (showBar) name = t(`onboardingFlow.common.sections.${SECTIONS[sec]}`);

  return (
    <View style={[styles.root, { backgroundColor: th.colors.bg, paddingTop: insets.top }]}>
      <FlowHeader
        hidden={screen === 'welcome'}
        name={name}
        suffix={showBar && sec < SECTIONS.length ? t('onboardingFlow.common.stepOf', { n: sec + 1 }) : ''}
        fills={barFills(screen, flow.history, flow.answers)}
        showBar={showBar}
        canBack={canGoBack(flow)}
        onBack={flowBack}
        backLabel={t('onboardingFlow.common.back')}
        canSkip={!!skip}
        onSkip={() => goTo(skip)}
        skipLabel={t('onboardingFlow.common.skip')}
      />
      <Slide key={screen} dir={nav.dir}>
        <Screen goTo={goTo} />
      </Slide>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  fill: { flex: 1 },
});
