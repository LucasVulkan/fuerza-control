/**
 * timerNotification.js
 *
 * Android: @notifee/react-native con cronómetro nativo.
 *   - showCountdownNotification: una sola notificación sticky al iniciar el timer.
 *     El SO hace tick automáticamente — funciona aunque la app esté minimizada o cerrada.
 *   - scheduleOsDoneNotification: alarma OS que suena al terminar el timer.
 *
 * iOS: expo-notifications para la notificación de fin (unchanged).
 *
 * Todas las funciones async son seguras sin await — no lanzan nunca.
 */

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

// ─── Notifee (Android only) ───────────────────────────────────────────────────

let _notifee           = null;
let _AndroidImportance = null;
let _TriggerType       = null;

if (Platform.OS === 'android') {
  try {
    const mod         = require('@notifee/react-native');
    _notifee           = mod.default;
    _AndroidImportance = mod.AndroidImportance;
    _TriggerType       = mod.TriggerType;
  } catch {
    // No disponible en Expo Go — las funciones fallan silenciosamente
  }
}

// ─── Fixed notification IDs ───────────────────────────────────────────────────

const COUNTDOWN_ID    = 'rest-timer-countdown';
const IOS_DONE_ID     = 'rest-timer-ios-done';
const ANDROID_DONE_ID = 'rest-timer-android-done';

// ─── Foreground handler ───────────────────────────────────────────────────────

/**
 * Suprime banners mientras la app está en primer plano.
 * Android: el canal LOW importance ya evita heads-up banners, nada más que hacer.
 * iOS:     expo-notifications necesita el handler explícito.
 */
export function setForegroundNotificationHandler() {
  if (Platform.OS !== 'ios') return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: false,
      shouldShowList:   false,
      shouldPlaySound:  false,
      shouldSetBadge:   false,
    }),
  });
}

// ─── Channels ─────────────────────────────────────────────────────────────────

/**
 * Crea los canales de Android. Idempotente — seguro llamarlo en cada arranque.
 */
export async function setupNotificationChannels() {
  if (Platform.OS !== 'android' || !_notifee) return;

  await _notifee.createChannel({
    id:         'rest-timer',
    name:       'Temporizador de descanso',
    importance: _AndroidImportance.LOW,
    vibration:  false,
    lights:     false,
  });

  await _notifee.createChannel({
    id:         'rest-done',
    name:       'Fin de descanso',
    importance: _AndroidImportance.HIGH,
    vibration:  true,
  });
}

// ─── Permissions ──────────────────────────────────────────────────────────────

export async function requestNotificationPermissions() {
  try {
    if (Platform.OS === 'android' && _notifee) {
      const settings = await _notifee.requestPermission();
      return settings.authorizationStatus >= 1;
    }
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

// ─── Android: cronómetro nativo ───────────────────────────────────────────────

/**
 * Muestra una notificación sticky con un cronómetro regresivo nativo.
 * Llamar UNA VEZ cuando el timer arranca — el SO gestiona el tick automáticamente.
 *
 * @param {number} remaining  - segundos restantes (para calcular endAt si no se pasa)
 * @param {number} _total     - ignorado (compatibilidad con firma anterior)
 * @param {string} exerciseName
 * @param {number} [endAt]    - timestamp ms de fin (Date.now() + remaining * 1000)
 */
export async function showCountdownNotification(remaining, _total, exerciseName, endAt) {
  if (Platform.OS !== 'android' || !_notifee) return;
  try {
    const targetTime = endAt ?? (Date.now() + remaining * 1000);
    await _notifee.displayNotification({
      id:    COUNTDOWN_ID,
      title: 'Descansando',
      body:  exerciseName ? `Siguiente: ${exerciseName}` : 'Recuperándote…',
      android: {
        channelId:            'rest-timer',
        ongoing:              true,
        asForegroundService:  false,
        color:                '#E8FF47',
        showChronometer:      true,
        chronometerDirection: 'down',
        timestamp:            targetTime,
        pressAction:          { id: 'default' },
      },
    });
  } catch {}
}

export async function dismissCountdownNotification() {
  if (Platform.OS !== 'android' || !_notifee) return;
  try { await _notifee.cancelNotification(COUNTDOWN_ID); } catch {}
}

// ─── OS-scheduled "done" notification ────────────────────────────────────────

/**
 * Programa la alerta de fin de descanso.
 * Usa notifee (Android) o expo-notifications (iOS).
 * Se dispara aunque la app esté cerrada.
 */
export async function scheduleOsDoneNotification(seconds, exerciseName) {
  const title = '✅ ¡A por la siguiente serie!';
  const body  = exerciseName
    ? `${exerciseName} — descansaste bien`
    : '¡Descanso terminado!';

  if (Platform.OS === 'ios') {
    try {
      await Notifications.cancelScheduledNotificationAsync(IOS_DONE_ID).catch(() => {});
      await Notifications.scheduleNotificationAsync({
        identifier: IOS_DONE_ID,
        content: { title, body, sound: 'default', data: { type: 'done' } },
        trigger: {
          type:    Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds,
          repeats: false,
        },
      });
    } catch {}

  } else if (Platform.OS === 'android' && _notifee && _TriggerType) {
    try {
      await _notifee.cancelTriggerNotification(ANDROID_DONE_ID).catch(() => {});
      await _notifee.createTriggerNotification(
        {
          id: ANDROID_DONE_ID,
          title,
          body,
          android: {
            channelId:   'rest-done',
            importance:  _AndroidImportance.HIGH,
            pressAction: { id: 'default' },
          },
        },
        {
          type:         _TriggerType.TIMESTAMP,
          timestamp:    Date.now() + seconds * 1000,
          alarmManager: { allowWhileIdle: true },
        },
      );
    } catch {}
  }
}

export async function cancelScheduledDoneNotification() {
  try {
    await Notifications.cancelScheduledNotificationAsync(IOS_DONE_ID).catch(() => {});
  } catch {}
  if (Platform.OS === 'android' && _notifee) {
    try { await _notifee.cancelTriggerNotification(ANDROID_DONE_ID).catch(() => {}); } catch {}
  }
}

// ─── Legacy aliases ───────────────────────────────────────────────────────────
export const scheduleIosDoneNotification     = (s, n) => scheduleOsDoneNotification(s, n);
export const cancelIosDoneNotification       = ()     => cancelScheduledDoneNotification();
export const scheduleAndroidDoneNotification = (s, n) => scheduleOsDoneNotification(s, n);
export const cancelAndroidDoneNotification   = ()     => cancelScheduledDoneNotification();
