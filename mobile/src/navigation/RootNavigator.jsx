import { useEffect, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useTranslation } from 'react-i18next';

import { useStore }        from '../../store/useStore';
import { entryTab }        from '../utils/onboardingFlow';
import { athleteProgress, stageBannerDue } from '../utils/stageProgress';
import { navigationRef }   from './navigationRef';
import { useTheme, useThemedStyles } from '../useTheme';
import HomeScreen       from '../screens/HomeScreen';
import MyProgramScreen  from '../screens/MyProgramScreen';
import StatsScreen      from '../screens/StatsScreen';
import ProgramScreen    from '../screens/ProgramScreen';
import ClientsScreen    from '../screens/ClientsScreen';
import WorkoutScreen       from '../screens/WorkoutScreen';
import OnboardingFlowScreen from '../screens/onboarding/OnboardingFlowScreen';
import ProgramDetailScreen    from '../screens/ProgramDetailScreen';
import ProgramEditorScreen   from '../screens/ProgramEditorScreen';
import SessionEditorScreen   from '../screens/SessionEditorScreen';
import ExerciseEditorScreen  from '../screens/ExerciseEditorScreen';
import BlockEditorScreen     from '../screens/BlockEditorScreen';
import StagePlannerScreen    from '../screens/StagePlannerScreen';
import SessionRecapScreen    from '../screens/SessionRecapScreen';
import NextSessionScreen      from '../screens/NextSessionScreen';
import ExerciseSelectorScreen from '../screens/ExerciseSelectorScreen';
import PasteWorkoutScreen from '../screens/PasteWorkoutScreen';
import CustomExerciseScreen      from '../screens/CustomExerciseScreen';
import DriveBackupScreen        from '../screens/DriveBackupScreen';
import TrainerConnectionScreen  from '../screens/TrainerConnectionScreen';
import AccountScreen            from '../screens/AccountScreen';
import DocsScreen               from '../screens/DocsScreen';
import Toast                 from '../components/Toast';
import BottomTabBar          from '../components/ui/BottomTabBar';
import DialogHost            from '../components/ui/DialogHost';
import PaywallModal          from '../components/PaywallModal';
import LimitSheet            from '../components/LimitSheet';
import ExternalImportModal   from '../components/ExternalImportModal';
import { clientLink } from '../utils/clientLink';

const Stack = createNativeStackNavigator();
const Tab   = createBottomTabNavigator();

// ── Bottom tab navigator ───────────────────────────────────────────────────────
function MainTabs() {
  const { t }          = useTranslation();
  const th             = useTheme();
  const styles         = useThemedStyles(makeStyles);
  // Ya no es el muro del Pro (M01 §4.3): una preferencia, «no soy entrenador».
  const proTabsHidden  = useStore((s) => s.profile?.proTabsHidden  ?? false);
  const showProTabs    = !proTabsHidden;
  // El entrenador que no entrena abre en Clientes (O03 §7.9). Solo cuenta al montar.
  const firstTab       = useStore((s) => entryTab(s.profile));
  // Clients with unsent uploads (program changes and/or next-session prescriptions).
  // Etapa terminada esperando decisión: el punto del tab de Programa. La misma
  // regla que el aviso de la Home (`stageBannerDue`). El día se lee al pintar:
  // si cambia con la app abierta, el punto sale en el siguiente render.
  const stageBannerNow = useStore((s) => {
    const program = s.programs?.[s.profile?.activeProgramId];
    return !!program && stageBannerDue(program, athleteProgress(program), s.stageBannerSnooze?.[program.id]);
  });
  const pendingClients = useStore((s) =>
    Object.values(s.clients ?? {}).filter((c) => clientLink(c, s.trainerSync) === 'linked' && (c.programDirty || c.overridesDirty)).length
  );
  return (
    <Tab.Navigator
      initialRouteName={firstTab}
      // Barra propia (maqueta docs/mockups/tab-bar.html, opción H): los iconos
      // a dos colores y sus animaciones salen de la ruta, no de `tabBarIcon`.
      tabBar={(props) => <BottomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: styles.scene,
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ tabBarLabel: t('tabs.session') }}
      />
      {/* El programa vive aquí y no al final del scroll de Sesiones. El punto
          avisa de que hay una etapa terminada esperando — el aviso completo se
          queda en Sesiones, que es lo que decide qué entrenas mañana
          (docs/specs/U07-tab-programa.md §4.4). */}
      <Tab.Screen
        name="MyProgram"
        component={MyProgramScreen}
        options={{
          tabBarLabel: t('tabs.program'),
          tabBarBadge: stageBannerNow ? '' : undefined,
        }}
      />
      <Tab.Screen
        name="Stats"
        component={StatsScreen}
        options={{ tabBarLabel: t('tabs.progress') }}
      />
      {showProTabs && (
        <Tab.Screen
          name="Clients"
          component={ClientsScreen}
          options={{
            tabBarLabel: t('tabs.clients'),
            tabBarBadge: pendingClients > 0 ? pendingClients : undefined,
            tabBarBadgeStyle: { backgroundColor: th.colors.blue },
          }}
        />
      )}
      {showProTabs && (
        <Tab.Screen
          name="Program"
          component={ProgramScreen}
          options={{ tabBarLabel: t('tabs.templates') }}
        />
      )}
    </Tab.Navigator>
  );
}

// ── Root stack ─────────────────────────────────────────────────────────────────
export default function RootNavigator() {
  const styles       = useThemedStyles(makeStyles);
  const hasHydrated  = useStore((s) => s._hasHydrated);
  const initialRoute = useStore((s) => s._initialRoute ?? 'Main');

  // Workout nunca es la raíz de la pila: con una sola ruta, el atrás físico
  // de Android sale de la app en vez de volver a Home. Si el arranque tocaba
  // ser Workout (sesión a medias al matar la app), el Stack nace en Main y el
  // efecto de abajo apila Workout encima en cuanto el contenedor está listo.
  const stackInitialRoute = initialRoute === 'Workout' ? 'Main' : initialRoute;

  // Disparo único tras la hidratación, solo si tocaba arrancar en Workout.
  // El efecto de RootNavigator corre después de los de sus hijos (Stack.Navigator
  // ya montado) dentro del mismo commit, así que `isReady()` es de fiar aquí;
  // el listener de `state` es solo la red de seguridad por si no lo fuera.
  const resetToWorkoutDone = useRef(false);
  useEffect(() => {
    if (!hasHydrated || resetToWorkoutDone.current || initialRoute !== 'Workout') return;
    resetToWorkoutDone.current = true;
    const resetStack = () => navigationRef.reset({
      index: 1,
      routes: [{ name: 'Main' }, { name: 'Workout' }],
    });
    if (navigationRef.isReady()) {
      resetStack();
    } else {
      const unsubscribe = navigationRef.addListener('state', () => {
        unsubscribe();
        resetStack();
      });
    }
  }, [hasHydrated, initialRoute]);

  // Invitación (M01-04): con la app ya en uso, el código pendiente se abre en
  // Conexión con entrenador. En Start no se navega: el recorrido de
  // entrada ya lleva el código puesto (O03 §9.5).
  const pendingInvite = useStore((s) => s.pendingInviteCode);
  useEffect(() => {
    if (!hasHydrated || !pendingInvite) return;
    const go = () => {
      const route = navigationRef.getCurrentRoute()?.name;
      if (route === 'Start' || route === 'TrainerConnection') return;
      navigationRef.navigate('TrainerConnection', undefined, { pop: true });
    };
    if (navigationRef.isReady()) {
      go();
    } else {
      const unsubscribe = navigationRef.addListener('state', () => {
        unsubscribe();
        go();
      });
      return unsubscribe;
    }
  }, [hasHydrated, pendingInvite]);

  // Block render until AsyncStorage has been read. This prevents a brief flash
  // of MainTabs on first launch (new device → should open Start).
  if (!hasHydrated) {
    return <View style={styles.hydrating} />;
  }

  return (
    <View style={styles.root}>
      <Stack.Navigator
        initialRouteName={stackInitialRoute}
        screenOptions={{
          headerShown:  false,
          contentStyle: styles.stackContent,
          animation:    'slide_from_right',
        }}
      >
        <Stack.Screen name="Main"       component={MainTabs} />
        <Stack.Screen
          name="Workout"
          component={WorkoutScreen}
          options={{ animation: 'slide_from_right', gestureEnabled: false }}
        />
        <Stack.Screen
          name="Start"
          component={OnboardingFlowScreen}
          options={{ animation: 'fade', gestureEnabled: false }}
        />
        <Stack.Screen
          name="ProgramDetail"
          component={ProgramDetailScreen}
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="ProgramEditor"
          component={ProgramEditorScreen}
          options={{ animation: 'slide_from_right', gestureEnabled: false }}
        />
        <Stack.Screen
          name="SessionEditor"
          component={SessionEditorScreen}
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="ExerciseEditor"
          component={ExerciseEditorScreen}
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="BlockEditor"
          component={BlockEditorScreen}
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="StagePlanner"
          component={StagePlannerScreen}
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="SessionRecap"
          component={SessionRecapScreen}
          options={{ animation: 'slide_from_right', gestureEnabled: false }}
        />
        <Stack.Screen
          name="NextSession"
          component={NextSessionScreen}
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="ExerciseSelector"
          component={ExerciseSelectorScreen}
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="PasteWorkout"
          component={PasteWorkoutScreen}
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="CustomExercise"
          component={CustomExerciseScreen}
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="DriveBackup"
          component={DriveBackupScreen}
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="TrainerConnection"
          component={TrainerConnectionScreen}
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="Account"
          component={AccountScreen}
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="Docs"
          component={DocsScreen}
          options={{ animation: 'slide_from_right' }}
        />
      </Stack.Navigator>

      {/* Global toast — sits above all screens, never blocks touches */}
      <Toast />
      {/* Global como el toast, y por lo mismo: solo puede haber una
          importación en curso. Ver el fallo 11 de la auditoría. */}
      <ExternalImportModal />
      {/* Confirmaciones y avisos (`showDialog`), en vez del Alert nativo. */}
      <DialogHost />
      {/* El que abre una acción que choca con el plan gratis (M01 §4.2). */}
      <GlobalLimit />
      <GlobalPaywall />
    </View>
  );
}

/**
 * Entra con 250 ms de retraso, como las demás hojas que se abren al cerrar
 * otra: la acción bloqueada casi siempre sale de una hoja que se está cerrando,
 * y en iOS un Modal no se presenta mientras otro se va.
 */
function GlobalPaywall() {
  const reason       = useStore((s) => s.ui.paywallReason);
  const closePaywall = useStore((s) => s.closePaywall);
  const [shown, setShown] = useState(null);
  useEffect(() => {
    if (!reason) return undefined;
    const timer = setTimeout(() => setShown(reason), 250);
    return () => clearTimeout(timer);
  }, [reason]);
  const close = () => { setShown(null); closePaywall(); };
  return reason && shown === reason ? <PaywallModal reason={reason} onClose={close} /> : null;
}

/** La hoja de límite (M04-02), con el mismo retraso y el mismo motivo que `GlobalPaywall`. */
function GlobalLimit() {
  const reason        = useStore((s) => s.ui.limitReason);
  const closeLimit    = useStore((s) => s.closeLimit);
  const limitToPaywall = useStore((s) => s.limitToPaywall);
  const [shown, setShown] = useState(null);
  useEffect(() => {
    if (!reason) return undefined;
    const timer = setTimeout(() => setShown(reason), 250);
    return () => clearTimeout(timer);
  }, [reason]);
  const close = (toPro) => { setShown(null); if (toPro) limitToPaywall(); else closeLimit(); };
  return reason && shown === reason ? <LimitSheet reason={reason} onClose={close} /> : null;
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const makeStyles = (th) => StyleSheet.create({
  root: {
    flex: 1,
  },
  hydrating: {
    flex: 1,
    backgroundColor: th.colors.bg,
  },
  scene: {
    backgroundColor: th.colors.bg,
  },
  stackContent: {
    backgroundColor: th.colors.bg,
  },
});
