/**
 * timerNotification.js
 *
 * Manages rest-timer notifications:
 *  - Android: sticky live countdown in the notification drawer (updates every second)
 *             + OS-scheduled HIGH-importance alert when time is up (fires even if app is killed)
 *  - iOS:     OS-scheduled one-shot notification that fires when the timer ends
 *             (survives app being killed; cancelled if the user stops early)
 *
 * All async functions are safe to call without await — they swallow every error.
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// ─── Foreground handler ────────────────────────────────────────────────────────

/**
 * Suppress all banners/sounds when the app is in the foreground.
 * The in-app RestTimerFloat + toast + haptic handle UX while the app is active.
 * Background / killed-app behaviour is controlled by the channel importance.
 * Call once at app startup (idempotent).
 */
export function setForegroundNotificationHandler() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: false,
      shouldShowList: false,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

// ─── Fixed notification identifiers ───────────────────────────────────────────
const COUNTDOWN_ID       = 'rest-timer-countdown';
const IOS_DONE_ID        = 'rest-timer-ios-done';
const ANDROID_DONE_ID    = 'rest-timer-android-done';

// ─── Android notification channels ────────────────────────────────────────────

/**
 * Create (or confirm) the two Android notification channels.
 * Must be called before sending any notifications.
 * Safe to call on every app launch — Android ignores duplicate channel creation.
 */
export async function setupNotificationChannels() {
  if (Platform.OS !== 'android') return;

  // "rest-timer": LOW importance → silent, no heads-up, shown in drawer only
  await Notifications.setNotificationChannelAsync('rest-timer', {
    name: 'Temporizador de descanso',
    importance: Notifications.AndroidImportance.LOW,
    sound: null,
    enableVibrate: false,
    showBadge: false,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });

  // "rest-done": HIGH importance → plays sound + shows heads-up banner
  await Notifications.setNotificationChannelAsync('rest-done', {
    name: 'Fin de descanso',
    importance: Notifications.AndroidImportance.HIGH,
    enableVibrate: true,
    showBadge: false,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
}

// ─── Permissions ──────────────────────────────────────────────────────────────

export async function requestNotificationPermissions() {
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtCountdown(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `${s}s`;
}

// ─── Android: live countdown ───────────────────────────────────────────────────

/**
 * Post (or update) the sticky countdown notification.
 * Calling with the same identifier replaces the existing notification in-place
 * via the underlying Android NotificationManager.notify(id, …) behaviour.
 */
export async function showCountdownNotification(remaining, total, exerciseName) {
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.scheduleNotificationAsync({
      identifier: COUNTDOWN_ID,
      content: {
        title: `⏱ ${fmtCountdown(remaining)}`,
        body: exerciseName
          ? `Siguiente: ${exerciseName}`
          : 'Recuperándote…',
        sticky: true,
        autoDismiss: false,
        color: '#E8FF47',
        data: { type: 'countdown', remaining, total },
      },
      // ChannelAwareTriggerInput — fires immediately to the specified channel
      trigger: { channelId: 'rest-timer' },
    });
  } catch {}
}

export async function dismissCountdownNotification() {
  try {
    await Notifications.dismissNotificationAsync(COUNTDOWN_ID);
  } catch {}
}

// ─── OS-scheduled "done" notification — survives app being killed ─────────────

/**
 * Schedule a one-shot OS notification that fires when the timer ends.
 * Uses the system scheduler so it fires correctly even if the app is killed.
 *
 * Call cancelScheduledDoneNotification() if the user stops the timer early
 * or if the timer completes while the app is in the foreground (haptic+toast
 * already provides the in-app feedback in that case).
 */
export async function scheduleOsDoneNotification(seconds, exerciseName) {
  const content = {
    title: '✅ ¡A por la siguiente serie!',
    body: exerciseName
      ? `${exerciseName} — descansaste bien`
      : '¡Descanso terminado!',
    sound: 'default',
    data: { type: 'done' },
  };

  if (Platform.OS === 'ios') {
    try {
      await Notifications.cancelScheduledNotificationAsync(IOS_DONE_ID).catch(() => {});
      await Notifications.scheduleNotificationAsync({
        identifier: IOS_DONE_ID,
        content,
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds,
          repeats: false,
        },
      });
    } catch {}
  } else if (Platform.OS === 'android') {
    try {
      await Notifications.cancelScheduledNotificationAsync(ANDROID_DONE_ID).catch(() => {});
      await Notifications.scheduleNotificationAsync({
        identifier: ANDROID_DONE_ID,
        content,
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds,
          repeats: false,
          channelId: 'rest-done',
        },
      });
    } catch {}
  }
}

export async function cancelScheduledDoneNotification() {
  try {
    await Notifications.cancelScheduledNotificationAsync(IOS_DONE_ID).catch(() => {});
    await Notifications.cancelScheduledNotificationAsync(ANDROID_DONE_ID).catch(() => {});
  } catch {}
}

// ─── Legacy aliases (kept for any future direct use) ─────────────────────────
export const scheduleIosDoneNotification    = (s, n) => scheduleOsDoneNotification(s, n);
export const cancelIosDoneNotification      = ()     => cancelScheduledDoneNotification();
export const scheduleAndroidDoneNotification = (s, n) => scheduleOsDoneNotification(s, n);
export const cancelAndroidDoneNotification  = ()     => cancelScheduledDoneNotification();
