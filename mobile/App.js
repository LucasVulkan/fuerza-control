import 'react-native-gesture-handler'; // Must be first import
import './src/i18n';                   // Initialize i18n before rendering

// Required for expo-auth-session OAuth redirects (must be module-level)
import * as WebBrowser from 'expo-web-browser';
WebBrowser.maybeCompleteAuthSession();

import { useEffect } from 'react';
import { Platform, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as NavigationBar from 'expo-navigation-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';

import { navigationRef } from './src/navigation/navigationRef';
import RootNavigator from './src/navigation/RootNavigator';
import { colors } from './src/theme';
import { registerBackupTask } from './src/tasks/driveBackupTask';

export default function App() {
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
