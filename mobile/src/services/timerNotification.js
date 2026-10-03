/**
 * timerNotification.js
 *
 * Android: @notifee/react-native con cronómetro nativo.
 *   - showCountdownNotification: una sola notificación sticky al iniciar el timer.
 *     El SO hace tick del texto MM:SS automáticamente — funciona aunque la app
 *     esté minimizada o cerrada. NO lleva barra de progreso: Android solo anima
 *     el cronómetro por su cuenta; una barra requeriría re-publicar cada segundo
 *     (imposible con el JS suspendido) o un foreground service. Optamos por el
 *     cronómetro nativo en la notificación y la barra rica dentro de la app.
 *   - scheduleOsDoneNotification: alarma OS que suena al terminar el timer.
 *
 * iOS: expo-notifications para la notificación de fin (unchanged).
 *
 * Todas las funciones async son seguras sin await — no lanzan nunca.
 *
 * Los textos salen de i18n en el momento de mostrar o programar (`i18n.t`, no
 * el hook: esto no es React). Los canales de Android se nombran al crearlos al
 * arrancar, con el idioma que haya entonces.
 */

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import i18n from '../i18n';

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
    name:       i18n.t('restTimer.notifChannelRest'),
    importance: _AndroidImportance.LOW,
    vibration:  false,
    lights:     false,
  });

  await _notifee.createChannel({
    id:         'rest-done',
    name:       i18n.t('restTimer.notifChannelDone'),
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

// ─── Android: notificación de countdown ──────────────────────────────────────

/**
 * Muestra la notificación sticky al arrancar el timer.
 * Usa el cronómetro nativo de Android (showChronometer + chronometerDirection: 'down')
 * para que el SO haga el tick del texto aunque el JS esté suspendido en background.
 * Sin barra de progreso a propósito (ver cabecera del archivo).
 *
 * @param {string} exerciseName
 * @param {number} endAt       - timestamp ms de fin (base del cronómetro nativo)
 */
export async function showCountdownNotification(exerciseName, endAt) {
  if (Platform.OS !== 'android' || !_notifee) return;
  try {
    await _notifee.displayNotification({
      id:    COUNTDOWN_ID,
      title: exerciseName ?? i18n.t('restTimer.notifResting'),
      body:  i18n.t('restTimer.notifChannelRest'),
      android: {
        channelId:            'rest-timer',
        ongoing:              true,
        color:                '#E8FF47',
        showChronometer:      true,
        chronometerDirection: 'down',
        timestamp:            endAt,
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
  const title = i18n.t('restTimer.notifDoneTitle');
  const body  = exerciseName
    ? i18n.t('restTimer.notifDoneBodyNamed', { name: exerciseName })
    : i18n.t('restTimer.notifDoneBody');

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
