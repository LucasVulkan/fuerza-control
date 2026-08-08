/**
 * Inert stand-in for every React Native / Expo module the mobile store pulls
 * in, so `mobile/store/useStore.js` can be imported from vitest (plain node).
 *
 * Why it has to exist: `react-native` ships Flow-typed source that vite's
 * parser rejects outright, and `vi.mock` doesn't help — the module is still
 * resolved and parsed before the mock replaces it. An alias intercepts one
 * step earlier, at resolution.
 *
 * Wired up in `vite.config.js` under `test.alias`, so it only exists during
 * `vitest`. Metro never sees this file.
 *
 * One file backs all of them: a namespace import of a missing export just
 * yields `undefined`, so extra exports here are free and missing ones only
 * matter when something actually calls them at import time.
 *
 * A green test proves the store's pure logic. It proves nothing about the
 * native side — that surface is fiction here.
 */

const noop      = () => {};
const asyncNoop = async () => {};

// ── react-native ──────────────────────────────────────────────────────────────
// OS 'ios' on purpose: the Android branch of `timerNotification.js` does a
// bare `require('@notifee/react-native')` at module scope.
export const Platform  = { OS: 'ios', select: (o) => o.ios ?? o.default };
export const AppState  = { currentState: 'active', addEventListener: () => ({ remove: noop }) };
export const Vibration = { vibrate: noop, cancel: noop };
export const Alert     = { alert: noop };

// ── expo-secure-store ─────────────────────────────────────────────────────────
export const getItemAsync    = async () => null;
export const setItemAsync    = asyncNoop;
export const deleteItemAsync = asyncNoop;

// ── expo-file-system/legacy ───────────────────────────────────────────────────
export const documentDirectory   = '/tmp/';
export const cacheDirectory      = '/tmp/';
export const EncodingType        = { UTF8: 'utf8' };
export const writeAsStringAsync  = asyncNoop;
export const readAsStringAsync   = async () => '';
export const StorageAccessFramework = {
  requestDirectoryPermissionsAsync: async () => ({ granted: false }),
  createFileAsync:                  async () => '/tmp/stub.fitdata',
};

// ── expo-sharing ──────────────────────────────────────────────────────────────
export const isAvailableAsync = async () => false;
export const shareAsync       = asyncNoop;

// ── expo-haptics ──────────────────────────────────────────────────────────────
export const impactAsync             = asyncNoop;
export const notificationAsync       = asyncNoop;
export const selectionAsync          = asyncNoop;
export const ImpactFeedbackStyle     = { Light: 'light', Medium: 'medium', Heavy: 'heavy' };
export const NotificationFeedbackType = { Success: 'success', Warning: 'warning', Error: 'error' };

// ── expo-task-manager / expo-background-fetch ─────────────────────────────────
export const defineTask             = noop;
export const isTaskRegisteredAsync  = async () => false;
export const registerTaskAsync      = asyncNoop;
export const unregisterTaskAsync    = asyncNoop;
export const BackgroundFetchResult  = { NoData: 1, NewData: 2, Failed: 3 };
export const BackgroundFetchStatus  = { Restricted: 1, Denied: 2, Available: 3 };

// ── expo-notifications ────────────────────────────────────────────────────────
export const setNotificationHandler         = noop;
export const scheduleNotificationAsync      = asyncNoop;
export const cancelScheduledNotificationAsync = asyncNoop;
export const dismissNotificationAsync       = asyncNoop;
export const setNotificationChannelAsync    = asyncNoop;
export const getPermissionsAsync            = async () => ({ status: 'granted' });
export const requestPermissionsAsync        = async () => ({ status: 'granted' });
export const AndroidImportance              = { HIGH: 4, DEFAULT: 3 };
export const TriggerType                    = { TIMESTAMP: 0 };
export const SchedulableTriggerInputTypes   = { TIME_INTERVAL: 'timeInterval' };

// ── @react-navigation/native ──────────────────────────────────────────────────
// El store lo alcanza vía `src/navigation/navigationRef.js`.
export const createNavigationContainerRef = () => ({
  current:  null,
  isReady:  () => false,
  navigate: noop,
  dispatch: noop,
  reset:    noop,
  goBack:   noop,
});

// ── default import: AsyncStorage, react-native-purchases, notifee ─────────────
export default {
  getItem:    async () => null,
  setItem:    asyncNoop,
  removeItem: asyncNoop,
  getAllKeys: async () => [],
  multiGet:   async () => [],
  multiSet:   asyncNoop,
  clear:      asyncNoop,
  configure:      noop,
  getCustomerInfo: async () => ({ entitlements: { active: {} } }),
  displayNotification: asyncNoop,
  cancelNotification:  asyncNoop,
};
