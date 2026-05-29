import 'react-native-url-polyfill/auto'; // Required for Supabase (URL API polyfill)
import 'react-native-gesture-handler'; // Must be first import
import './src/i18n';                   // Initialize i18n before rendering

// Required for expo-auth-session OAuth redirects (must be module-level)
import * as WebBrowser from 'expo-web-browser';
WebBrowser.maybeCompleteAuthSession();

import { useEffect } from 'react';
import { Platform, StyleSheet } from 'react-native';
import {
  setForegroundNotificationHandler,
  setupNotificationChannels,
  requestNotificationPermissions,
} from './src/services/timerNotification';
import { StatusBar } from 'expo-status-bar';
import * as NavigationBar from 'expo-navigation-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';

import { navigationRef } from './src/navigation/navigationRef';
import RootNavigator from './src/navigation/RootNavigator';
import { colors } from './src/theme';
import { registerBackupTask } from './src/tasks/driveBackupTask';
import { RC_ANDROID_API_KEY, RC_IOS_API_KEY } from './src/config/revenuecat';
import { useStore } from './store/useStore';

export default function App() {
  const checkProStatus              = useStore((s) => s.checkProStatus);
  const checkAndPullProgramUpdates  = useStore((s) => s.checkAndPullProgramUpdates);

  // ── Notification setup ──────────────────────────────────────────────────────
  useEffect(() => {
    setForegroundNotificationHandler();
    setupNotificationChannels().catch(() => {});
    requestNotificationPermissions().catch(() => {});
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    // setBackgroundColorAsync no está soportado con edge-to-edge activado.
    // setButtonStyleAsync('light') sí funciona: pone los iconos del sistema en blanco
    // para que sean visibles sobre el fondo oscuro que pinta TabBarBackground.
    NavigationBar.setButtonStyleAsync('light').catch(() => {});
  }, []);

  // Register background Drive backup task (safe to call on every launch; ignored if already registered)
  useEffect(() => {
    registerBackupTask().catch(() => {});
  }, []);

  // If the user is a client connected to a trainer, silently pull program updates on startup.
  // This ensures trainerName, exercise changes, etc. are reflected without reconnecting.
  useEffect(() => {
    checkAndPullProgramUpdates().catch(() => {});
  }, []);

  // Initialise RevenueCat then sync pro status (native module — silently skipped in Expo Go)
  useEffect(() => {
    try {
      const Purchases = require('react-native-purchases').default;
      const { LOG_LEVEL } = require('react-native-purchases');
      if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.DEBUG);
      const apiKey = Platform.OS === 'ios' ? RC_IOS_API_KEY : RC_ANDROID_API_KEY;
      Purchases.configure({ apiKey });
      checkProStatus();
    } catch {
      // Expo Go or build without native module — isPro stays as persisted value
    }
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider style={{ backgroundColor: colors.surface }}>
        <NavigationContainer
          ref={navigationRef}
          theme={{
            ...DarkTheme,
            colors: {
              ...DarkTheme.colors,
              primary:      colors.accent,
              background:   colors.bg,
              card:         colors.surface,
              text:         colors.text,
              border:       colors.border,
              notification: colors.accent,
            },
          }}
        >
          <StatusBar style="light" backgroundColor={colors.bg} />
          <RootNavigator />
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
});
