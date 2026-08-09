/**
 * driveBackupTask.js
 * Background fetch task for scheduled Drive backups (daily / weekly / monthly).
 * Registered in App.js. Runs when the OS decides to execute background fetches.
 *
 * NOTE: iOS only guarantees ~15-min minimum interval and may delay or skip
 * background tasks to save battery. Android (WorkManager) is more reliable.
 */

import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager    from 'expo-task-manager';
import * as SecureStore    from 'expo-secure-store';
import AsyncStorage        from '@react-native-async-storage/async-storage';

import { uploadBackup, findOrCreateFolder, pruneOldBackups } from '../services/driveService';
import { buildBackupJson, BACKUP_STORAGE_KEY } from '../../../src/utils/backupPayload';

export const DRIVE_BACKUP_TASK = 'DRIVE_BACKUP_TASK';

// Milliseconds for each frequency
const FREQ_MS = {
  daily:   24 * 60 * 60 * 1000,
  weekly:   7 * 24 * 60 * 60 * 1000,
  monthly: 30 * 24 * 60 * 60 * 1000,
};

// ── Task definition ───────────────────────────────────────────────────────────

TaskManager.defineTask(DRIVE_BACKUP_TASK, async () => {
  try {
    // Load drive config from SecureStore (can't access Zustand here)
    const raw = await SecureStore.getItemAsync('drive_backup_config');
    if (!raw) return BackgroundFetch.BackgroundFetchResult.NoData;

    const config = JSON.parse(raw);
    const { enabled, frequency, lastBackup, folderId } = config;

    if (!enabled || frequency === 'session') {
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    // Check if enough time has passed
    const minInterval = FREQ_MS[frequency];
    if (lastBackup && Date.now() - new Date(lastBackup).getTime() < minInterval) {
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    // Get access token
    const token = await SecureStore.getItemAsync('drive_access_token');
    if (!token) {
      // Token expired — set a flag so the UI can warn the user
      await SecureStore.setItemAsync('drive_needs_reconnect', 'true');
      return BackgroundFetch.BackgroundFetchResult.Failed;
    }

    // El backup se arma aquí, desde el estado que zustand persiste en cada
    // cambio. Antes se leía un snapshot de SecureStore que solo escribía la
    // copia por sesión: con frecuencia diaria/semanal/mensual esa clave no
    // existía nunca y la tarea salía por aquí en cada ejecución, para siempre
    // (fallo 3). Y cuando existía era una foto congelada del día en que se
    // escribió, así que la copia "diaria" subía siempre lo mismo.
    const persisted = await AsyncStorage.getItem(BACKUP_STORAGE_KEY);
    if (!persisted) return BackgroundFetch.BackgroundFetchResult.NoData;
    const backupJson = buildBackupJson(JSON.parse(persisted).state ?? {});

    // Upload
    const activeFolderId = folderId ?? (await findOrCreateFolder(token));
    const date     = new Date().toISOString().split('T')[0];
    const fileName = `forma-backup-${date}.json`;
    await uploadBackup(token, activeFolderId, fileName, backupJson);
    await pruneOldBackups(token, activeFolderId);

    // Update lastBackup in SecureStore config
    const updated = { ...config, lastBackup: new Date().toISOString(), folderId: activeFolderId };
    await SecureStore.setItemAsync('drive_backup_config', JSON.stringify(updated));

    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch {
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

// ── Registration helpers ──────────────────────────────────────────────────────

export async function registerBackupTask() {
  try {
    const status = await BackgroundFetch.getStatusAsync();
    if (
      status === BackgroundFetch.BackgroundFetchStatus.Restricted ||
      status === BackgroundFetch.BackgroundFetchStatus.Denied
    ) return;

    await BackgroundFetch.registerTaskAsync(DRIVE_BACKUP_TASK, {
      minimumInterval: 60 * 60, // 1 hour — OS decides when to actually run
      stopOnTerminate:  false,
      startOnBoot:      true,
    });
  } catch {
    // Task may already be registered — ignore
  }
}

export async function unregisterBackupTask() {
  try {
    await BackgroundFetch.unregisterTaskAsync(DRIVE_BACKUP_TASK);
  } catch {}
}
