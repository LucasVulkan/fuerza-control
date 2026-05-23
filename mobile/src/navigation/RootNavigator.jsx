import { View, StyleSheet } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, borders } from '../theme';
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
import ExerciseSelectorScreen from '../screens/ExerciseSelectorScreen';
import CustomExerciseScreen  from '../screens/CustomExerciseScreen';
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
  return <View style={[StyleSheet.absoluteFillObject, styles.tabBarBg]} />;
}

// ── Bottom tab navigator ───────────────────────────────────────────────────────
function MainTabs() {
  const insets = useSafeAreaInsets();
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarBackground: () => <TabBarBackground />,
        tabBarStyle: [styles.tabBar, { paddingBottom: insets.bottom }],
        tabBarActiveTintColor:   colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: styles.tabLabel,
        sceneStyle: styles.scene,
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ tabBarLabel: 'Sesión',    tabBarIcon: tabIcon('barbell') }}
      />
      <Tab.Screen
        name="History"
        component={HistoryScreen}
        options={{ tabBarLabel: 'Historial', tabBarIcon: tabIcon('time') }}
      />
      <Tab.Screen
        name="Stats"
        component={StatsScreen}
        options={{ tabBarLabel: 'Progreso',  tabBarIcon: tabIcon('stats-chart') }}
      />
      <Tab.Screen
        name="Clients"
        component={ClientsScreen}
        options={{ tabBarLabel: 'Clientes',  tabBarIcon: tabIcon('people') }}
      />
      <Tab.Screen
        name="Program"
        component={ProgramScreen}
        options={{ tabBarLabel: 'Programas', tabBarIcon: tabIcon('layers') }}
      />
    </Tab.Navigator>
  );
}

// ── Root stack ─────────────────────────────────────────────────────────────────
export default function RootNavigator() {
  return (
    <View style={styles.root}>
      <Stack.Navigator
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
          name="ExerciseSelector"
          component={ExerciseSelectorScreen}
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="CustomExercise"
          component={CustomExerciseScreen}
          options={{ animation: 'slide_from_right' }}
        />
      </Stack.Navigator>

      {/* Global toast — sits above all screens, never blocks touches */}
      <Toast />
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  tabBar: {
    backgroundColor: 'transparent', // el background lo pone TabBarBackground
    borderTopColor:  colors.border,
    borderTopWidth:  borders.thin,
    elevation:       0,             // quita la sombra de Android
  },
  tabBarBg: {
    backgroundColor: colors.surface,
  },
  tabLabel: {
    fontSize:  10,
    marginTop: 2,
  },
  scene: {
    backgroundColor: colors.bg,
  },
  stackContent: {
    backgroundColor: colors.bg,
  },
});
