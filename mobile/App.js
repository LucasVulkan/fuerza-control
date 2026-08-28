import 'react-native-url-polyfill/auto'; // Required for Supabase (URL API polyfill)
import 'react-native-gesture-handler'; // Must be first import
import './src/i18n';                   // Initialize i18n before rendering

// Required for expo-auth-session OAuth redirects (must be module-level)
import * as WebBrowser from 'expo-web-browser';
WebBrowser.maybeCompleteAuthSession();

import * as SplashScreen from 'expo-splash-screen';
// Keep the splash up until custom fonts are ready — RN renders text with a
// fallback family before load, causing a visible font swap otherwise.
SplashScreen.preventAutoHideAsync();

import { useEffect, useCallback, useRef } from 'react';
import { AppState, Platform, StyleSheet } from 'react-native';
import { useFonts } from 'expo-font';
import {
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  Inter_900Black,
  Inter_900Black_Italic,
} from '@expo-google-fonts/inter';
import { BarlowCondensed_800ExtraBold_Italic } from '@expo-google-fonts/barlow-condensed';
import * as Linking     from 'expo-linking';
import * as FileSystem  from 'expo-file-system/legacy';
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

// Ventana mínima entre dos comprobaciones de programa. Cambiar de app y volver
// es gesto de segundos; sin esto, cada ida y vuelta pegaría a Supabase.
const PULL_THROTTLE_MS = 60_000;

export default function App() {
  const checkProStatus              = useStore((s) => s.checkProStatus);
  const checkAndPullProgramUpdates  = useStore((s) => s.checkAndPullProgramUpdates);
  const showToast                   = useStore((s) => s.showToast);
  const setPendingExternalImport    = useStore((s) => s.setPendingExternalImport);

  // Custom fonts — Inter (Figma text styles) + Barlow Condensed (logo).
  // Each weight is its own named family: RN doesn't synthesize weights for
  // custom fonts, so textStyles reference these by fontFamily, not fontWeight.
  const [fontsLoaded] = useFonts({
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
    Inter_900Black,
    Inter_900Black_Italic,
    BarlowCondensed_800ExtraBold_Italic,
  });

  // Hide the splash once fonts are ready. Driven by an effect (not the root
  // view's onLayout — GestureHandlerRootView doesn't reliably forward onLayout,
  // which left the splash stuck on top of an interactive app).
  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded]);

  // ── Incoming .fitdata file handler ──────────────────────────────────────────
  // Called when the OS opens a .fitdata file and routes it to this app via
  // the VIEW intent filter (from file explorer, WhatsApp, Drive, etc.).
  //
  // Two URL forms to handle:
  //  - content://... — file explorer sends a content URI (path may not have .fitdata)
  //  - file://...    — direct file path (always has .fitdata in path)
  //
  // We store the raw content in the store so AppHeader can show the ImportModal
  // with section selection (same UX as importing via the settings menu).
  const handleIncomingFile = useCallback(async (url) => {
    if (!url) return;
    // Accept content:// and file:// URIs (from our intent filter)
    // plus any URL that explicitly mentions .fitdata (e.g. warm-start deep links).
    // Reject anything else (OAuth redirects, push notifications, etc.).
    const isFileIntent =
      url.startsWith('content://') ||
      url.startsWith('file://') ||
      url.includes('.fitdata');
    if (!isFileIntent) return;

    try {
      const rawContent = await FileSystem.readAsStringAsync(url, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      // Extract a human-readable filename (best-effort from the URI)
      const uriParts = url.split('/');
      const raw      = uriParts[uriParts.length - 1] ?? '';
      const fileName = decodeURIComponent(raw).split('?')[0] || 'backup.fitdata';

      // Hand off to AppHeader's ImportModal via the store
      setPendingExternalImport({ rawContent, fileName });
    } catch {
      showToast('No se pudo leer el archivo', 2200, 'error');
    }
  }, [showToast, setPendingExternalImport]);

  useEffect(() => {
    // Cold start — app opened directly from a file tap
    Linking.getInitialURL().then((url) => { if (url) handleIncomingFile(url); }).catch(() => {});
    // Warm start — app already running when file is tapped
    const sub = Linking.addEventListener('url', ({ url }) => handleIncomingFile(url));
    return () => sub.remove();
  }, [handleIncomingFile]);

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

  // If the user is a client connected to a trainer, silently pull program updates
  // on startup AND every time the app comes back to the foreground. Startup alone
  // was not enough: something the trainer sends while the client has the app open
  // (a stage unlock, a next-session prescription) would not land until they killed
  // and reopened it. One SELECT of one row by primary key, throttled so an
  // alt-tab burst doesn't repeat it.
  const lastPullRef = useRef(0);
  useEffect(() => {
    const pull = () => {
      if (Date.now() - lastPullRef.current < PULL_THROTTLE_MS) return;
      lastPullRef.current = Date.now();
      checkAndPullProgramUpdates().catch(() => {});
    };
    pull();
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') pull();
    });
    return () => sub.remove();
  }, [checkAndPullProgramUpdates]);

  // Initialise RevenueCat then sync pro status (native module — silently skipped in Expo Go)
  // EXPO_PUBLIC_FORCE_PRO=true skips the RC check (used in preview builds for testing)
  useEffect(() => {
    if (process.env.EXPO_PUBLIC_FORCE_PRO === 'true') return; // preview build → keep isPro as-is
    try {
      const Purchases = require('react-native-purchases').default;
      const { LOG_LEVEL } = require('react-native-purchases');
      if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.DEBUG);
      const apiKey = Platform.OS === 'ios' ? RC_IOS_API_KEY : RC_ANDROID_API_KEY;
      // Sin clave real no se configura nada. Con el marcador de posición,
      // `configure` pasa pero `getCustomerInfo` no resuelve nunca, y como
      // `checkProStatus` conserva el valor anterior cuando falla, el estado se
      // quedaba en el que trajera el perfil — que era Pro (fallo 9).
      if (!apiKey || apiKey.startsWith('YOUR_')) {
        console.warn('[RevenueCat] clave sin configurar para', Platform.OS, '— sin comprobacion de suscripcion');
        return;
      }
      Purchases.configure({ apiKey });
      checkProStatus();
    } catch {
      // Expo Go or build without native module — isPro stays as persisted value
    }
  }, []);

  if (!fontsLoaded) return null; // splash stays up until fonts are ready

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
