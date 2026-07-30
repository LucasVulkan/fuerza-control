import { View, StyleSheet } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useStore }        from '../../store/useStore';
import { borders } from '../theme';
import { useTheme, useThemedStyles } from '../useTheme';
import HomeScreen       from '../screens/HomeScreen';
import HistoryScreen    from '../screens/HistoryScreen';
import StatsScreen      from '../screens/StatsScreen';
import ProgramScreen    from '../screens/ProgramScreen';
import ClientsScreen    from '../screens/ClientsScreen';
import WorkoutScreen       from '../screens/WorkoutScreen';
import SetupScreen         from '../screens/SetupScreen';
import OnboardingScreen    from '../screens/OnboardingScreen';
import ProgramDetailScreen    from '../screens/ProgramDetailScreen';
import ProgramEditorScreen   from '../screens/ProgramEditorScreen';
import SessionEditorScreen   from '../screens/SessionEditorScreen';
import SessionRecapScreen    from '../screens/SessionRecapScreen';
import NextSessionScreen      from '../screens/NextSessionScreen';
import ExerciseSelectorScreen from '../screens/ExerciseSelectorScreen';
import CustomExerciseScreen      from '../screens/CustomExerciseScreen';
import ExerciseHistoryScreen    from '../screens/ExerciseHistoryScreen';
import DriveBackupScreen        from '../screens/DriveBackupScreen';
import TrainerConnectionScreen  from '../screens/TrainerConnectionScreen';
import DocsScreen               from '../screens/DocsScreen';
import Toast                 from '../components/Toast';

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
  const isPro          = useStore((s) => s.profile?.isPro          ?? true);
  const proTabsHidden  = useStore((s) => s.profile?.proTabsHidden  ?? false);
  const showProTabs    = isPro || !proTabsHidden;
  // Clients with unsent uploads (program changes and/or next-session prescriptions).
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
        sceneStyle: styles.scene,
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ tabBarLabel: t('tabs.session'),   tabBarIcon: tabIcon('barbell') }}
      />
      <Tab.Screen
        name="History"
        component={HistoryScreen}
        options={{ tabBarLabel: t('tabs.history'),   tabBarIcon: tabIcon('time') }}
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
            tabBarBadgeStyle: { backgroundColor: th.colors.blue, color: th.colors.onAccent, fontSize: 10 },
          }}
        />
      )}
      {showProTabs && (
        <Tab.Screen
          name="Program"
          component={ProgramScreen}
          options={{ tabBarLabel: t('tabs.templates'), tabBarIcon: tabIcon('layers') }}
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

  // Block render until AsyncStorage has been read. This prevents a brief flash
  // of MainTabs on first launch (new device → should open Setup/Onboarding).
  if (!hasHydrated) {
    return <View style={styles.hydrating} />;
  }

  return (
    <View style={styles.root}>
      <Stack.Navigator
        initialRouteName={initialRoute}
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
    fontSize: 9,
  },
  scene: {
    backgroundColor: th.colors.bg,
  },
  stackContent: {
    backgroundColor: th.colors.bg,
  },
});
