import { useEffect, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useStore }        from '../../store/useStore';
import { navigationRef }   from './navigationRef';
import { borders, textStyles } from '../theme';
import { useTheme, useThemedStyles } from '../useTheme';
import HomeScreen       from '../screens/HomeScreen';
import MyProgramScreen  from '../screens/MyProgramScreen';
import StatsScreen      from '../screens/StatsScreen';
import ProgramScreen    from '../screens/ProgramScreen';
import ClientsScreen    from '../screens/ClientsScreen';
import WorkoutScreen       from '../screens/WorkoutScreen';
import SetupScreen         from '../screens/SetupScreen';
import OnboardingScreen    from '../screens/OnboardingScreen';
import ProgramDetailScreen    from '../screens/ProgramDetailScreen';
import ProgramEditorScreen   from '../screens/ProgramEditorScreen';
import SessionEditorScreen   from '../screens/SessionEditorScreen';
import ExerciseEditorScreen  from '../screens/ExerciseEditorScreen';
import BlockEditorScreen     from '../screens/BlockEditorScreen';
import StagePlannerScreen    from '../screens/StagePlannerScreen';
import SessionRecapScreen    from '../screens/SessionRecapScreen';
import NextSessionScreen      from '../screens/NextSessionScreen';
import ExerciseSelectorScreen from '../screens/ExerciseSelectorScreen';
import CustomExerciseScreen      from '../screens/CustomExerciseScreen';
import ExerciseHistoryScreen    from '../screens/ExerciseHistoryScreen';
import DriveBackupScreen        from '../screens/DriveBackupScreen';
import TrainerConnectionScreen  from '../screens/TrainerConnectionScreen';
import DocsScreen               from '../screens/DocsScreen';
import Toast                 from '../components/Toast';
import ExternalImportModal   from '../components/ExternalImportModal';

const Stack = createNativeStackNavigator();
const Tab   = createBottomTabNavigator();

// ── Tab icon factory ───────────────────────────────────────────────────────────
function tabIcon(name) {
  return ({ focused, color, size }) => (
    <Ionicons
      name={focused ? name : `${name}-outline`}
      size={size}
      color={color}
    />
  );
}

// Fondo sólido que se extiende detrás de la barra del sistema (edge-to-edge fix)
function TabBarBackground() {
  const styles = useThemedStyles(makeStyles);
  return <View style={[StyleSheet.absoluteFillObject, styles.tabBarBg]} />;
}

// ── Bottom tab navigator ───────────────────────────────────────────────────────
function MainTabs() {
  const insets         = useSafeAreaInsets();
  const { t }          = useTranslation();
  const th             = useTheme();
  const styles         = useThemedStyles(makeStyles);
  const isPro          = useStore((s) => s.profile?.isPro          ?? false);
  const proTabsHidden  = useStore((s) => s.profile?.proTabsHidden  ?? false);
  const showProTabs    = isPro || !proTabsHidden;
  // Clients with unsent uploads (program changes and/or next-session prescriptions).
  // Etapa terminada esperando decisión: el punto del tab de Programa.
  const stageAdvancePending = useStore((s) =>
    !!s.programs?.[s.profile?.activeProgramId]?.stageAdvancePending
  );
  const pendingClients = useStore((s) =>
    Object.values(s.clients ?? {}).filter((c) => c.syncSlotId && (c.programDirty || c.overridesDirty)).length
  );
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarBackground: () => <TabBarBackground />,
        tabBarStyle: [
          styles.tabBar,
          {
            paddingBottom: insets.bottom + 4,
            height:        56 + insets.bottom,
          },
        ],
        tabBarActiveTintColor:   th.colors.accent,
        tabBarInactiveTintColor: th.colors.muted,
        tabBarLabelStyle: styles.tabLabel,
        // La etiqueta la pinta react-navigation con su propio Text, fuera del
        // wrapper de src/components/ui/Text: aquí se le repite el trato.
        tabBarAllowFontScaling: false,
        sceneStyle: styles.scene,
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ tabBarLabel: t('tabs.session'),   tabBarIcon: tabIcon('barbell') }}
      />
      {/* El programa vive aquí y no al final del scroll de Sesiones. El punto
          avisa de que hay una etapa terminada esperando — el aviso completo se
          queda en Sesiones, que es lo que decide qué entrenas mañana
          (docs/specs/tab-programa.md §4.4). */}
      <Tab.Screen
        name="MyProgram"
        component={MyProgramScreen}
        options={{
          tabBarLabel: t('tabs.program'),
          tabBarIcon:  tabIcon('layers'),
          tabBarBadge: stageAdvancePending ? '' : undefined,
          tabBarBadgeStyle: { backgroundColor: th.colors.accent, minWidth: 8, maxHeight: 8, borderRadius: 4 },
        }}
      />
      <Tab.Screen
        name="Stats"
        component={StatsScreen}
        options={{ tabBarLabel: t('tabs.progress'),  tabBarIcon: tabIcon('stats-chart') }}
      />
      {showProTabs && (
        <Tab.Screen
          name="Clients"
          component={ClientsScreen}
          options={{
            tabBarLabel: t('tabs.clients'),
            tabBarIcon:  tabIcon('people'),
            tabBarBadge: pendingClients > 0 ? pendingClients : undefined,
            tabBarBadgeStyle: { backgroundColor: th.colors.blue, color: th.colors.onAccent, fontSize: 11 },
          }}
        />
      )}
      {showProTabs && (
        <Tab.Screen
          name="Program"
          component={ProgramScreen}
          options={{ tabBarLabel: t('tabs.templates'), tabBarIcon: tabIcon('copy') }}
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

  // Block render until AsyncStorage has been read. This prevents a brief flash
  // of MainTabs on first launch (new device → should open Setup/Onboarding).
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
          name="Setup"
          component={SetupScreen}
          options={{ animation: 'fade', gestureEnabled: false }}
        />
        <Stack.Screen
          name="Onboarding"
          component={OnboardingScreen}
          options={{ animation: 'slide_from_right', gestureEnabled: false }}
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
          name="CustomExercise"
          component={CustomExerciseScreen}
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="ExerciseHistory"
          component={ExerciseHistoryScreen}
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
    </View>
  );
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
  tabBar: {
    backgroundColor: 'transparent', // el background lo pone TabBarBackground
    borderTopColor:  th.colors.border,
    borderTopWidth:  borders.thin,
    elevation:       0,             // quita la sombra de Android
  },
  tabBarBg: {
    backgroundColor: th.colors.bg, // tan oscuro como el fondo de la app
  },
  tabLabel: {
    ...textStyles.micro,
  },
  scene: {
    backgroundColor: th.colors.bg,
  },
  stackContent: {
    backgroundColor: th.colors.bg,
  },
});
