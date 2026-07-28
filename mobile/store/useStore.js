/**
 * Mobile Zustand store — adapted from the web store.
 *
 * Key differences vs web:
 *  - Persistence: AsyncStorage instead of localStorage
 *  - No window / document / navigator DOM APIs
 *  - Vibration: expo-haptics instead of navigator.vibrate
 *  - File export: expo-file-system + expo-sharing
 *  - Navigation: imperatively via navigationRef (no window.scrollTo)
 *  - Import (document picker): not yet implemented — stubbed
 */

import { Platform, AppState } from 'react-native';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import * as FileSystem from 'expo-file-system/legacy'; // v19: legacy = readAsStringAsync, EncodingType, cacheDirectory
import * as Sharing    from 'expo-sharing';
import * as SecureStore from 'expo-secure-store';
import { uploadBackup, findOrCreateFolder, pruneOldBackups, deleteAllBackups, refreshAccessToken } from '../src/services/driveService';
import { GOOGLE_ANDROID_CLIENT_ID } from '../src/config/google';
import { RC_PRO_ENTITLEMENT } from '../src/config/revenuecat';
import { registerBackupTask, unregisterBackupTask } from '../src/tasks/driveBackupTask';
import { createClientSlot, uploadProgram, downloadHistory, downloadProgram, getSlotByClientCode, linkClientToSlot, uploadHistory, uploadOverrides, deleteClientSlot, claimTrainerSlots, getClientSlotByUserId, transferClientSlot, updateTrainerNameForSlots, getTrainerSlots } from '../src/services/supabaseSync';
import {
  showCountdownNotification,
  dismissCountdownNotification,
  scheduleOsDoneNotification,
  cancelScheduledDoneNotification,
} from '../src/services/timerNotification';

// Shared data & utilities (resolved by Metro watchFolders)
import { EXERCISE_LIBRARY } from '../../src/data/exerciseLibrary';
import { SESSION_TEMPLATES, PROGRAMS } from '../../src/data/programs';
import { getProgression } from '../../src/utils/progression';
import { generateId } from '../../src/utils/formatters';
import { splitClientLogEntries, mergeClientLog, reidProgramFile, scopeFilterForUpload } from '../../src/utils/clientLogs';
import { assignActiveProgram, deassignProgram } from '../../src/utils/clientPrograms';
import { linkGroupTemplateIds, lastLinkedExercise, pickLinkedConfig } from '../../src/utils/exerciseLinks';
import { forTimeElapsed, buildBlockResult } from '../../src/utils/conditioningBlocks';
import { consumeOverride, overrideStatus } from '../../src/utils/sessionOverride';
// Program generation — static imports (Metro no soporta dynamic import() de forma fiable)
import { findBestArchetype } from '../../src/data/archetypes';
import { adaptArchetype } from '../../src/utils/archetypeAdapter';
import { generateProgram } from '../../src/utils/programGenerator';

// Mobile i18n instance
import i18n from '../src/i18n';

// Navigation ref (wired up in App.js)
import { navigateTo } from '../src/navigation/navigationRef';

// ─── Initial state ─────────────────────────────────────────────────────────────

// ── Trainer session guard ──────────────────────────────────────────────────────
// Before any RLS-protected Supabase write, verify the session is active AND
// belongs to the correct user (trainerSync.userId).
// Cases handled:
//  - No session at all (app restart, token expired) → re-auth with stored code
//  - Session for wrong userId (trainer created a second code account) → re-auth
//    with the stored code to switch back to the correct account
async function _ensureTrainerSession(trainerSync) {
  const { supabase } = require('../src/config/supabase');
  const { data: { session } } = await supabase.auth.getSession();

  // Session is valid AND belongs to the expected trainer user → nothing to do
  if (session && (!trainerSync.userId || session.user.id === trainerSync.userId)) return;

  if (trainerSync.mode === 'code' && trainerSync.code) {
    const { recoverWithTrainerCode } = require('../src/services/supabaseAuth');
    await recoverWithTrainerCode(trainerSync.code);
  } else if (trainerSync.mode === 'google') {
    throw new Error('Sesión de Google expirada. Ve a Sincronización y vuelve a iniciar sesión con Google.');
  }
}

// Dropset actions all touch the `drops` array of the LAST work set only
// (dropset is prescribed as "last set carries drops", never an arbitrary one).
function updateLastSetDrops(setsState, exerciseId, updater) {
  const sets = setsState[exerciseId] ?? [];
  if (sets.length === 0) return setsState;
  const lastIdx = sets.length - 1;
  const updated = sets.map((st, i) =>
    i === lastIdx ? { ...st, drops: updater(st.drops ?? [], st) } : st
  );
  return { ...setsState, [exerciseId]: updated };
}

const INITIAL_PROFILE = {
  name: 'Usuario',
  activeProgramId: null,
  secondaryProgramIds: [],
  onboardingAnswers: {},
  onboardingCompleted: false,
  setupComplete: false,   // true tras elegir idioma + unidad en SetupScreen
  goals: [],
  bodyWeight: null,
  theme: 'dark',
  isPro: true,
  proTabsHidden: false,
  language: 'es',
  weightUnit: 'kg',
};

const INITIAL_ACTIVE_SESSION = {
  templateId: null,
  setsState: {},
  startedAt: null,
  notes: '',
  exerciseNotes: {},   // { [exerciseId]: string } — client feedback per exercise
  adHocExercises: [],
  freeSessionName: '',
  blockState: {},      // { [blockId]: { startedAt, finishedAt, rounds, extraReps, failed[], timeSec } }
};

const INITIAL_UI = {
  view: 'home',
  toast: null,
  restTimer: { active: false, remaining: 0, total: 0, exerciseName: '', endAt: 0 },
  _editingProgramId: null,
  _viewingProgramId: null,
  _blockPickerResult: null,
  homeTab: 'session',
};

// ─── Program diff helper ──────────────────────────────────────────────────────
/**
 * Compares the current active program with an incoming programJson from the trainer.
 * Returns a string[] with human-readable change lines, e.g.:
 *   ["+1 etapa nueva", "Etapa 1: +2 sesiones", "Sesión A: +3 ejercicios"]
 */
function buildProgramDiff(storeState, newProgramJson) {
  const { programs, profile, sessionTemplates, userPrograms } = storeState;
  const oldProg = programs[profile.activeProgramId];
  if (!oldProg) return ['Programa nuevo del entrenador'];

  const newPrograms    = { ...(newProgramJson.programs ?? {}), ...(newProgramJson.program ? { [newProgramJson.program.id]: newProgramJson.program } : {}) };
  const newProg        = newPrograms[profile.activeProgramId] ?? Object.values(newPrograms)[0];
  const newTemplates   = { ...(newProgramJson.sessionTemplates ?? {}), ...(newProgramJson.userPrograms ?? {}) };
  const oldTemplates   = { ...sessionTemplates, ...userPrograms };

  const getStages = (p) => p?.stages?.length > 0 ? p.stages : [{ days: p?.days ?? [], name: 'Principal' }];
  const oldStages = getStages(oldProg);
  const newStages = getStages(newProg);

  const lines = [];

  const stageDiff = newStages.length - oldStages.length;
  if (stageDiff > 0) lines.push(`+${stageDiff} etapa${stageDiff > 1 ? 's' : ''} nueva${stageDiff > 1 ? 's' : ''}`);
  if (stageDiff < 0) lines.push(`${Math.abs(stageDiff)} etapa${Math.abs(stageDiff) > 1 ? 's' : ''} eliminada${Math.abs(stageDiff) > 1 ? 's' : ''}`);

  for (let si = 0; si < Math.min(oldStages.length, newStages.length); si++) {
    const oldDays = oldStages[si].days ?? [];
    const newDays = newStages[si].days ?? [];
    const stageLabel = oldStages.length > 1 ? `Etapa ${si + 1}` : null;
    const sesDiff = newDays.length - oldDays.length;

    if (sesDiff !== 0) {
      const prefix = stageLabel ? `${stageLabel}: ` : '';
      lines.push(`${prefix}${sesDiff > 0 ? '+' : ''}${sesDiff} sesión${Math.abs(sesDiff) > 1 ? 'es' : ''}`);
    }

    for (let di = 0; di < Math.min(oldDays.length, newDays.length); di++) {
      const oldEx = (oldTemplates[oldDays[di].sessionTemplateId]?.exercises ?? []).length;
      const newEx = (newTemplates[newDays[di].sessionTemplateId]?.exercises ?? []).length;
      const exDiff = newEx - oldEx;
      if (exDiff !== 0) {
        const sesLabel = newDays[di].label ?? `Sesión ${di + 1}`;
        lines.push(`${sesLabel}: ${exDiff > 0 ? '+' : ''}${exDiff} ejercicio${Math.abs(exDiff) > 1 ? 's' : ''}`);
      }
    }
  }

  return lines.length > 0 ? lines : ['Cambios menores en el programa'];
}

// ─── Store ─────────────────────────────────────────────────────────────────────

export const useStore = create(
  persist(
    (set, get) => ({
      // ── State ──────────────────────────────────────────────────────────────
      profile: INITIAL_PROFILE,
      workoutLog: [],
      // Per-client histories (trainer side). Kept separate from the trainer's
      // own workoutLog so personal and client data never mix.
      // The trainer's copy is append-only: client-side deletions never remove
      // entries here — it's the trainer's professional record of the client.
      // Shape: { [clientId]: WorkoutEntry[] } — sorted by timestamp asc.
      clientLogs: {},
      activeSession: INITIAL_ACTIVE_SESSION,
      ui: INITIAL_UI,

      // Google Drive backup
      driveBackup: {
        enabled:        false,
        email:          null,
        folderId:       null,
        frequency:      'session', // 'session' | 'daily' | 'weekly' | 'monthly'
        lastBackup:     null,      // ISO string
        lastBackupFile: null,
        needsReconnect: false,     // set true when background task can't find token
        backupName:     '',        // custom prefix for backup filenames
      },

      clients: {},
      tagRegistry: [],   // [{ id, name }] — global tag list
      userPrograms: {},
      customExercises: {},
      blockPresets: [],  // [{ presetId, ...ConditioningBlock sin id }] — frozen copies, device-global
      _editSnapshot: null,

      // ── Trainer / client Supabase sync ────────────────────────────────────
      trainerSync: {
        mode:                  null,   // null | 'offline' | 'code' | 'google'
        code:                  null,   // string — trainer recovery code (only when mode === 'code')
        userId:                null,   // Supabase user.id once authenticated
        trainerName:           null,   // string — display name shown to clients on their programs
        lastSeenSessionsCount: {},     // { [clientId]: number } — count when trainer last viewed history
      },

      // ── Client sync (when user is a client connected to a trainer) ────────
      clientSync: {
        slotId:                null,  // trainer_clients row id
        clientCode:            null,  // the code the client entered
        supabaseUserId:        null,  // anonymous Supabase user id (or Google user id if linked)
        googleLinked:          false, // true once the client has linked a Google account
        trainerName:           null,  // trainer's display name (read from trainer_name column)
        pendingUpload:         false, // true when last sessions upload failed
        lastSyncedAt:          null,  // ISO — timestamp of last successful upload to trainer
        lastProgramImportedAt: null,  // ISO — timestamp of last program import (used to detect trainer updates)
        syncErrorAt:           null,  // ISO — timestamp of last failed upload to trainer
        pendingProgramUpdate:  null,  // { programJson, updatedAt, diff[] } — awaiting user action
        trainerProgramIds:     [],    // program ids imported from the trainer — scope of history uploads
        linkedAt:              null,  // ISO — when the client connected (free sessions before this stay private)
        pendingOverrides:      {},    // { [templateId]: override } — trainer's next-session prescriptions, consumed on save
      },

      // Static references (not persisted)
      exerciseLibrary: EXERCISE_LIBRARY,
      sessionTemplates: SESSION_TEMPLATES,
      programs: PROGRAMS,

      // Hydration gate — true once AsyncStorage has been read.
      // NOT persisted. RootNavigator waits for this before rendering.
      _hasHydrated:  false,
      _initialRoute: 'Main',

      // External file import — set when the OS opens a .fitdata file via intent.
      // NOT persisted. AppHeader watches this and shows ImportModal when set.
      pendingExternalImport: null,  // { rawContent: string, fileName: string } | null

      // ══════════════════════════════════════════════════════════════════════
      // PROFILE
      // ══════════════════════════════════════════════════════════════════════

      setProfile: (updates) =>
        set((state) => ({ profile: { ...state.profile, ...updates } })),

      setLanguage: (lang) => {
        set((state) => ({ profile: { ...state.profile, language: lang } }));
        i18n.changeLanguage(lang);
      },

      // Active UI theme (see src/themes.js). Persisted; consumed via useTheme().
      setTheme: (name) => set({ theme: name }),

      setActiveProgram: (programId) =>
        set((state) => ({ profile: { ...state.profile, activeProgramId: programId } })),

      // ══════════════════════════════════════════════════════════════════════
      // ONBOARDING
      // ══════════════════════════════════════════════════════════════════════

      generateAndActivateProgram: async (answers) => {
        const normalizedAnswers = {
          ...answers,
          equipment: answers.equipment.includes('machines') && !answers.equipment.includes('cables')
            ? [...answers.equipment, 'cables']
            : answers.equipment,
        };

        const archetype = findBestArchetype(normalizedAnswers);
        const { program, sessionTemplates } = archetype
          ? adaptArchetype(archetype, normalizedAnswers)
          : generateProgram(normalizedAnswers);

        set((s) => ({
          programs: { ...s.programs, [program.id]: program },
          sessionTemplates: { ...s.sessionTemplates, ...sessionTemplates },
          profile: {
            ...s.profile,
            activeProgramId: program.id,
            onboardingAnswers: answers,
            onboardingCompleted: true,
          },
          ui: { ...s.ui, view: 'home' },
        }));
        // Return program so caller can show a preview before navigating
        return { program, sessionTemplates };
      },

      archiveProgram: (programId, clearHistory = false) => {
        const { programs, profile } = get();
        const program = programs[programId];
        if (!program) return;
        const templateIds = new Set();
        if (program.stages?.length > 0) {
          program.stages.forEach((st) => st.days.forEach((d) => templateIds.add(d.sessionTemplateId)));
        } else {
          program.days.forEach((d) => templateIds.add(d.sessionTemplateId));
        }
        const wasActive = profile.activeProgramId === programId;
        set((s) => ({
          programs: {
            ...s.programs,
            [programId]: { ...program, status: 'archived', archivedAt: new Date().toISOString().split('T')[0] },
          },
          workoutLog: clearHistory
            ? s.workoutLog.filter((e) => !templateIds.has(e.sessionTemplateId))
            : s.workoutLog,
          profile: wasActive ? { ...s.profile, activeProgramId: null } : s.profile,
        }));
      },

      archiveActiveProgram: () => {
        const { profile } = get();
        if (!profile.activeProgramId) return;
        get().archiveProgram(profile.activeProgramId, false);
      },

      restoreProgram: (programId) => {
        const { programs, profile } = get();
        const program = programs[programId];
        if (!program) return;
        const updated = { ...programs };
        if (profile.activeProgramId && profile.activeProgramId !== programId) {
          updated[profile.activeProgramId] = {
            ...updated[profile.activeProgramId],
            status: 'archived',
            archivedAt: new Date().toISOString().split('T')[0],
          };
        }
        updated[programId] = { ...program, status: 'active', archivedAt: null, mode: 'personal' };
        set((s) => ({
          programs: updated,
          profile: { ...s.profile, activeProgramId: programId, onboardingCompleted: true },
          ui: { ...s.ui, view: 'home' },
        }));
        get().navigate('home');
      },

      deleteProgram: (programId, deleteHistory = false) => {
        const { programs } = get();
        const program = programs[programId];
        const templateIds = new Set();
        if (program?.stages?.length > 0) {
          program.stages.forEach((st) => st.days.forEach((d) => templateIds.add(d.sessionTemplateId)));
        } else {
          (program?.days ?? []).forEach((d) => templateIds.add(d.sessionTemplateId));
        }
        set((s) => {
          const next = { ...s.programs };
          delete next[programId];
          // Managed (client) programs keep their history in clientLogs — clear there too
          const ownerClientId = program?.clientId;
          const ownerLog      = ownerClientId ? s.clientLogs[ownerClientId] : null;
          return {
            programs: next,
            workoutLog: deleteHistory
              ? s.workoutLog.filter((e) => !templateIds.has(e.sessionTemplateId))
              : s.workoutLog,
            clientLogs: deleteHistory && ownerLog
              ? { ...s.clientLogs, [ownerClientId]: ownerLog.filter((e) => !templateIds.has(e.sessionTemplateId)) }
              : s.clientLogs,
          };
        });
      },

      // ══════════════════════════════════════════════════════════════════════
      // CLIENTS (PRO)
      // ══════════════════════════════════════════════════════════════════════

      createClient: async (name) => {
        const id = generateId('client');
        const clientBase = {
          id, name: name.trim(),
          createdAt: new Date().toISOString().split('T')[0],
          programIds: [], activeProgramId: null,
          fullName: '', phone: '', email: '', notes: '',
          bodyWeight: [], billing: [], status: 'active',
          syncCode: null,   // client_code shown to the trainer
          syncSlotId: null, // trainer_clients row id in Supabase
        };

        set((s) => ({ clients: { ...s.clients, [id]: clientBase } }));

        // If trainer is in connected mode, create the Supabase slot
        const { trainerSync } = get();
        if (trainerSync.mode !== 'offline' && trainerSync.mode !== null && trainerSync.userId) {
          try {
            const { slotId, clientCode } = await createClientSlot(trainerSync.userId, name.trim());
            set((s) => ({
              clients: {
                ...s.clients,
                [id]: { ...s.clients[id], syncCode: clientCode, syncSlotId: slotId },
              },
            }));
          } catch (err) {
            console.warn('[createClient] Supabase slot creation failed:', err.message);
            // Non-fatal — client still created locally
          }
        }

        return id;
      },

      updateClientInfo: (clientId, fields) => {
        set((s) => ({
          clients: { ...s.clients, [clientId]: { ...s.clients[clientId], ...fields } },
        }));
      },

      // ── Tag registry ──────────────────────────────────────────────────────
      createTag: (name) => {
        const id = generateId('tag');
        set((s) => ({ tagRegistry: [...s.tagRegistry, { id, name: name.trim() }] }));
        return id;
      },

      renameTag: (id, name) => {
        set((s) => ({
          tagRegistry: s.tagRegistry.map((t) => t.id === id ? { ...t, name: name.trim() } : t),
        }));
      },

      deleteTag: (id) => {
        set((s) => ({
          tagRegistry: s.tagRegistry.filter((t) => t.id !== id),
          clients: Object.fromEntries(
            Object.entries(s.clients).map(([cid, c]) => [
              cid,
              { ...c, tags: (c.tags ?? []).filter((tid) => tid !== id) },
            ])
          ),
        }));
      },

      deleteClient: (clientId) => {
        const client = get().clients[clientId];
        // Delete Supabase slot silently if it exists (invalidates client code)
        if (client?.syncSlotId) {
          deleteClientSlot(client.syncSlotId).catch(() => {});
        }
        set((s) => {
          const nextClients = { ...s.clients };
          const client = s.clients[clientId];
          delete nextClients[clientId];
          // Also remove programs assigned to this client
          const nextPrograms = { ...s.programs };
          const templateIds = new Set();
          (client?.programIds ?? []).forEach((pid) => {
            const prog = s.programs[pid];
            if (prog?.stages?.length > 0) {
              prog.stages.forEach((st) => st.days.forEach((d) => templateIds.add(d.sessionTemplateId)));
            } else {
              (prog?.days ?? []).forEach((d) => templateIds.add(d.sessionTemplateId));
            }
            delete nextPrograms[pid];
          });
          // Remove the client's separated history entirely
          const nextClientLogs = { ...s.clientLogs };
          delete nextClientLogs[clientId];
          return {
            clients: nextClients,
            programs: nextPrograms,
            workoutLog: s.workoutLog.filter((e) => !templateIds.has(e.sessionTemplateId)),
            clientLogs: nextClientLogs,
          };
        });
      },

      renameClient: (clientId, name) => {
        set((s) => ({
          clients: { ...s.clients, [clientId]: { ...s.clients[clientId], name: name.trim() } },
        }));
      },

      setClientActiveProgram: (clientId, programId) => {
        // Assigning makes the program active (archiving the previous one) and
        // marks it dirty so the trainer pushes it. Deassigning clears both.
        set((s) => ({
          clients: {
            ...s.clients,
            [clientId]: programId === null
              ? deassignProgram(s.clients[clientId])
              : assignActiveProgram(s.clients[clientId], programId),
          },
        }));
      },

      /**
       * Mark programDirty = true for every client that has this program as their active one
       * and has a sync slot configured. Call this after saving/editing a program.
       */
      markProgramDirtyForClients: (programId) => {
        set((s) => {
          const updated = {};
          Object.entries(s.clients).forEach(([cid, c]) => {
            if (c.activeProgramId === programId && c.syncSlotId) {
              updated[cid] = { ...c, programDirty: true };
            }
          });
          return Object.keys(updated).length > 0
            ? { clients: { ...s.clients, ...updated } }
            : {};
        });
      },

      addClientBilling: (clientId, entry) => {
        const id = generateId('bill');
        set((s) => ({
          clients: {
            ...s.clients,
            [clientId]: {
              ...s.clients[clientId],
              billing: [
                { id, ...entry, status: entry.status ?? 'pending' },
                ...(s.clients[clientId].billing ?? []),
              ],
            },
          },
        }));
      },

      updateClientBillingStatus: (clientId, billingId, status) => {
        set((s) => ({
          clients: {
            ...s.clients,
            [clientId]: {
              ...s.clients[clientId],
              billing: (s.clients[clientId].billing ?? []).map((b) =>
                b.id === billingId ? { ...b, status } : b
              ),
            },
          },
        }));
      },

      removeClientBilling: (clientId, billingId) => {
        set((s) => ({
          clients: {
            ...s.clients,
            [clientId]: {
              ...s.clients[clientId],
              billing: (s.clients[clientId].billing ?? []).filter((b) => b.id !== billingId),
            },
          },
        }));
      },

      addClientBodyWeight: (clientId, date, weight) => {
        const client = get().clients[clientId];
        if (!client) return;
        const existing = (client.bodyWeight ?? []).filter((e) => e.date !== date);
        const sorted = [...existing, { date, weight: parseFloat(weight) }]
          .sort((a, b) => a.date.localeCompare(b.date));
        set((s) => ({
          clients: { ...s.clients, [clientId]: { ...s.clients[clientId], bodyWeight: sorted } },
        }));
      },

      removeClientBodyWeight: (clientId, date) => {
        const client = get().clients[clientId];
        if (!client) return;
        set((s) => ({
          clients: {
            ...s.clients,
            [clientId]: {
              ...s.clients[clientId],
              bodyWeight: (s.clients[clientId].bodyWeight ?? []).filter((e) => e.date !== date),
            },
          },
        }));
      },

      // Mobile: receives parsedData (already parsed JSON) + mode string
      importForClient: (clientId, parsedData, mode) => {
        let data = parsedData;
        const client = get().clients[clientId];
        if (!client) return;

        // Collision-safe identity: if the file's program id already belongs to
        // ANOTHER client (or to the trainer), re-ID everything so two clients
        // never share one program object. Same-client matches keep their ids —
        // that's the update flow, and preserves template↔history linkage.
        if (data.program) {
          const existing = get().programs[data.program.id];
          const collides = existing && !(existing.mode === 'managed' && existing.clientId === clientId);
          if (collides) data = reidProgramFile(data);
        }

        // 'replace'     → incoming program becomes the client's ACTIVE program
        //                 (the previous active stays in programIds = archived).
        //                 Works even when the incoming id differs from the active.
        // 'replace_log' → same, plus merges the file's sessions into the log.
        if (mode === 'replace' || mode === 'replace_log') {
          if (!data.program) { get().showToast('El archivo no contiene ningún programa', 2200, 'error'); return; }
          const programId = data.program.id;
          set((s) => ({
            programs: { ...s.programs, [programId]: { ...data.program, mode: 'managed', clientId } },
            sessionTemplates: { ...s.sessionTemplates, ...(data.sessionTemplates ?? {}) },
            userPrograms: { ...s.userPrograms, ...(data.userPrograms ?? {}) },
            customExercises: { ...s.customExercises, ...(data.customExercises ?? {}) },
            // Incoming program becomes active; the previous active is archived.
            clients: { ...s.clients, [clientId]: assignActiveProgram(s.clients[clientId], programId) },
          }));
          // Entries from a client file belong to that client's log, not the trainer's
          if (mode === 'replace_log' && data.workoutLog?.length) {
            set((s) => ({
              clientLogs: {
                ...s.clientLogs,
                [clientId]: mergeClientLog(s.clientLogs[clientId], data.workoutLog),
              },
            }));
          }
          get().showToast(mode === 'replace_log' ? 'Programa e historial actualizados' : 'Programa actualizado');
        } else if (mode === 'merge_log') {
          const existing   = get().clientLogs[clientId] ?? [];
          const merged     = mergeClientLog(existing, data.workoutLog);
          const newCount   = merged.length - existing.length;
          set((s) => ({
            clientLogs: { ...s.clientLogs, [clientId]: merged },
            sessionTemplates: { ...s.sessionTemplates, ...(data.sessionTemplates ?? {}) },
            userPrograms: { ...s.userPrograms, ...(data.userPrograms ?? {}) },
          }));
          get().showToast(`${newCount} sesión${newCount !== 1 ? 'es' : ''} importada${newCount !== 1 ? 's' : ''}`);
        }
      },

      createProgramForClient: (clientId, numSessions, programName) => {
        const programId = generateId('prog');
        const labels    = ['A', 'B', 'C', 'D', 'E', 'F'];
        const colorList = ['var(--day1)', 'var(--day2)', 'var(--day3)', 'var(--day4)', 'var(--day5)', 'var(--day6)'];
        const newTemplates = {};
        const programDays  = [];

        for (let i = 0; i < numSessions; i++) {
          const templateId = generateId('tpl');
          const label = labels[i] ?? String(i + 1);
          newTemplates[templateId] = {
            id: templateId, programId,
            label, name: `Sesión ${label}`,
            emphasis: '', color: colorList[i % colorList.length],
            exercises: [],
          };
          programDays.push({ sessionTemplateId: templateId, label });
        }

        const program = {
          id: programId, name: programName.trim(), mode: 'managed', clientId,
          type: 'primary', status: 'active',
          createdAt: new Date().toISOString().split('T')[0],
          currentWeek: 1, days: programDays,
        };

        set((s) => ({
          programs: { ...s.programs, [programId]: program },
          sessionTemplates: { ...s.sessionTemplates, ...newTemplates },
          clients: {
            ...s.clients,
            [clientId]: {
              ...s.clients[clientId],
              programIds: [programId, ...(s.clients[clientId]?.programIds ?? [])],
            },
          },
          ui: { ...s.ui, _editingProgramId: programId },
        }));
        get().navigate('programEditor');
        return programId;
      },

      // ══════════════════════════════════════════════════════════════════════
      // PROGRAM EDITOR
      // ══════════════════════════════════════════════════════════════════════

      getEffectiveTemplate: (templateId) => {
        const { userPrograms, sessionTemplates } = get();
        return userPrograms[templateId] ?? sessionTemplates[templateId];
      },

      addCustomExercise: (exerciseDef) => {
        set((s) => ({
          customExercises: { ...s.customExercises, [exerciseDef.id]: exerciseDef },
        }));
      },

      deleteCustomExercise: (exerciseId) => {
        set((s) => {
          const next = { ...s.customExercises };
          delete next[exerciseId];
          return { customExercises: next };
        });
      },

      getEffectiveLibrary: () => {
        const { exerciseLibrary, customExercises } = get();
        return { ...exerciseLibrary, ...customExercises };
      },

      beginEditSession: () => {
        const { programs, sessionTemplates, userPrograms } = get();
        set({
          _editSnapshot: JSON.parse(JSON.stringify({ programs, sessionTemplates, userPrograms })),
        });
      },

      cancelEditSession: (destination = 'home') => {
        const { _editSnapshot } = get();
        if (_editSnapshot !== null) {
          set({ userPrograms: _editSnapshot, _editSnapshot: null });
        }
        set((s) => ({ ui: { ...s.ui, _editingProgramId: null } }));
        get().navigate(destination);
      },

      confirmEditSession: (destination = 'home') => {
        set((s) => ({ _editSnapshot: null, ui: { ...s.ui, _editingProgramId: null } }));
        get().navigate(destination);
      },

      updateExerciseParams: (templateId, exerciseId, updates) => {
        const template = get().getEffectiveTemplate(templateId);
        if (!template) return;
        const current = template.exercises.find((ex) => ex.exerciseId === exerciseId);
        const updatedExercises = template.exercises.map((ex) =>
          ex.exerciseId === exerciseId ? { ...ex, ...updates } : ex
        );

        // Linked instances (same exerciseId + linkGroup elsewhere in the
        // program) receive the same config update. Group membership itself
        // (linkGroup) never propagates.
        const group = 'linkGroup' in updates ? updates.linkGroup : current?.linkGroup;
        const sibUpdates = { ...updates };
        delete sibUpdates.linkGroup;
        let siblingIds = [];
        if (group && Object.keys(sibUpdates).length) {
          const program = get().programs[template.programId];
          siblingIds = linkGroupTemplateIds(program, exerciseId, group, get().getEffectiveTemplate)
            .filter((tid) => tid !== templateId);
        }

        set((s) => {
          const nextUserPrograms = {
            ...s.userPrograms,
            [templateId]: { ...template, exercises: updatedExercises },
          };
          for (const tid of siblingIds) {
            const tpl = s.userPrograms[tid] ?? s.sessionTemplates[tid];
            const sibEx = tpl?.exercises?.find((ex) => ex.exerciseId === exerciseId);
            if (!tpl || !sibEx) continue;
            const merged = { ...sibEx, ...sibUpdates };
            // Skip no-op writes so untouched siblings don't gain an "edited" copy.
            if (JSON.stringify(merged) === JSON.stringify(sibEx)) continue;
            nextUserPrograms[tid] = {
              ...tpl,
              exercises: tpl.exercises.map((ex) => ex.exerciseId === exerciseId ? merged : ex),
            };
          }
          return { userPrograms: nextUserPrograms };
        });
      },

      // Joins/leaves a link group. Joining a group with existing members
      // adopts the group's config (the group is the source of truth).
      // Pass '__new__' to create a fresh group, null to unlink.
      setExerciseLinkGroup: (templateId, exerciseId, groupId) => {
        const getTpl = get().getEffectiveTemplate;
        const template = getTpl(templateId);
        if (!template) return null;
        const gid = groupId === '__new__' ? generateId('lnk') : (groupId ?? null);

        let updates = { linkGroup: gid };
        if (gid) {
          const program = get().programs[template.programId];
          const memberTid = linkGroupTemplateIds(program, exerciseId, gid, getTpl)
            .find((tid) => tid !== templateId);
          const canonical = memberTid
            ? getTpl(memberTid)?.exercises?.find((e) => e.exerciseId === exerciseId)
            : null;
          if (canonical) updates = { ...pickLinkedConfig(canonical), linkGroup: gid };
        }
        get().updateExerciseParams(templateId, exerciseId, updates);
        return gid;
      },

      replaceExercise: (templateId, oldExerciseId, newExerciseId) => {
        const template = get().getEffectiveTemplate(templateId);
        if (!template) return;
        const updatedExercises = template.exercises.map((ex) =>
          ex.exerciseId !== oldExerciseId ? ex : { ...ex, exerciseId: newExerciseId, progressionOverride: null }
        );
        set((s) => ({
          userPrograms: {
            ...s.userPrograms,
            [templateId]: { ...template, exercises: updatedExercises },
          },
        }));
      },

      removeExercise: (templateId, exerciseId) => {
        const template = get().getEffectiveTemplate(templateId);
        if (!template) return;
        const updatedExercises = template.exercises
          .filter((ex) => ex.exerciseId !== exerciseId)
          .map((ex, idx) => ({ ...ex, order: idx + 1 }));
        set((s) => ({
          userPrograms: {
            ...s.userPrograms,
            [templateId]: { ...template, exercises: updatedExercises },
          },
        }));
      },

      reorderExercise: (templateId, _exerciseId, _direction, reorderedExercises) => {
        const template = get().getEffectiveTemplate(templateId);
        if (!template || !reorderedExercises) return;
        set((s) => ({
          userPrograms: {
            ...s.userPrograms,
            [templateId]: { ...template, exercises: reorderedExercises },
          },
        }));
      },

      // ── Conditioning blocks (AMRAP/EMOM/for time) — editor actions ──────────
      // Same immutable pattern as updateExerciseParams/reorderExercise: read
      // the effective template, write the copy to userPrograms.

      addBlockToSession: (templateId, block) => {
        const template = get().getEffectiveTemplate(templateId);
        if (!template) return;
        const blocks = [...(template.blocks ?? []), block];
        set((s) => ({
          userPrograms: { ...s.userPrograms, [templateId]: { ...template, blocks } },
        }));
      },

      updateBlock: (templateId, blockId, updates) => {
        const template = get().getEffectiveTemplate(templateId);
        if (!template) return;
        const blocks = (template.blocks ?? []).map((b) => b.id === blockId ? { ...b, ...updates } : b);
        set((s) => ({
          userPrograms: { ...s.userPrograms, [templateId]: { ...template, blocks } },
        }));
      },

      // Reordena los bloques de una sesión. Los bloques no llevan campo `order`:
      // el orden ES el del array (spec de acondicionamiento), así que basta con
      // sustituirlo por el nuevo.
      reorderBlocks: (templateId, blocks) => {
        const template = get().getEffectiveTemplate(templateId);
        if (!template || blocks.length !== (template.blocks ?? []).length) return;
        set((s) => ({
          userPrograms: { ...s.userPrograms, [templateId]: { ...template, blocks } },
        }));
      },

      removeBlockFromSession: (templateId, blockId) => {
        const template = get().getEffectiveTemplate(templateId);
        if (!template) return;
        const blocks = (template.blocks ?? []).filter((b) => b.id !== blockId);
        set((s) => ({
          userPrograms: { ...s.userPrograms, [templateId]: { ...template, blocks } },
        }));
      },

      // Presets — frozen copies (device-global, not synced): inserting one
      // into a session just copies its fields with a fresh block id.
      saveBlockPreset: (block) => {
        const { id: _id, ...rest } = block;
        const preset = { presetId: generateId('bpre'), ...rest };
        set((s) => ({ blockPresets: [...(s.blockPresets ?? []), preset] }));
      },

      deleteBlockPreset: (presetId) => {
        set((s) => ({ blockPresets: (s.blockPresets ?? []).filter((p) => p.presetId !== presetId) }));
      },

      // Transient handoff for the block movement picker: ExerciseSelectorScreen
      // writes the pick here instead of calling addExercise when navigated with
      // `blockPicker: true`; BlockEditorInline consumes it in a useEffect and clears it.
      setBlockPickerResult: (exerciseId) => {
        set((s) => ({ ui: { ...s.ui, _blockPickerResult: exerciseId } }));
      },

      addExercise: (templateId, exerciseId) => {
        const template = get().getEffectiveTemplate(templateId);
        const { exerciseLibrary, customExercises } = get();
        const exDef = exerciseLibrary[exerciseId] ?? customExercises[exerciseId];
        if (!template || !exDef) return;
        const newExConfig = {
          exerciseId, isKey: false, sets: exDef.sets ?? 3,
          restSec: exDef.restSec ?? 90,
          minReps: exDef.minReps ?? null, maxReps: exDef.maxReps ?? null,
          progressionOverride: null, limitationNote: null,
          order: template.exercises.length + 1,
        };
        set((s) => ({
          userPrograms: {
            ...s.userPrograms,
            [templateId]: { ...template, exercises: [...template.exercises, newExConfig] },
          },
        }));
      },

      resetTemplate: (templateId) => {
        set((s) => {
          const next = { ...s.userPrograms };
          delete next[templateId];
          return { userPrograms: next };
        });
      },

      renameProgram: (programId, newName) => {
        set((s) => ({
          programs: {
            ...s.programs,
            [programId]: { ...s.programs[programId], name: newName },
          },
        }));
      },

      restoreSession: (templateId) => {
        set((s) => {
          const { [templateId]: _removed, ...rest } = s.userPrograms;
          return { userPrograms: rest };
        });
      },

      renameSession: (templateId, newName) => {
        const template = get().getEffectiveTemplate(templateId);
        if (!template) return;
        set((s) => ({
          userPrograms: {
            ...s.userPrograms,
            [templateId]: { ...template, name: newName },
          },
        }));
      },

      createEmptyProgram: (numSessions, programName = 'Mi programa', mode = 'personal') => {
        const programId = generateId('prog');
        const labels = ['A', 'B', 'C', 'D', 'E', 'F'];
        const colors = ['var(--day1)', 'var(--day2)', 'var(--day3)', 'var(--day4)', 'var(--day5)', 'var(--day6)'];
        const newTemplates = {};
        const programDays = [];
        for (let i = 0; i < numSessions; i++) {
          const templateId = generateId('tpl');
          const label = labels[i] ?? String(i + 1);
          newTemplates[templateId] = {
            id: templateId, programId,
            label, name: `Sesión ${label}`,
            emphasis: '', color: colors[i % colors.length], exercises: [],
          };
          programDays.push({ sessionTemplateId: templateId, label });
        }
        const program = {
          id: programId, name: programName, mode,
          type: 'primary', status: 'active',
          createdAt: new Date().toISOString().split('T')[0],
          currentWeek: 1, onboardingSnapshot: { mode: 'manual' },
          days: programDays,
        };
        set((s) => ({
          programs: { ...s.programs, [programId]: program },
          sessionTemplates: { ...s.sessionTemplates, ...newTemplates },
          profile: mode === 'personal'
            ? { ...s.profile, activeProgramId: programId, onboardingCompleted: true }
            : s.profile,
        }));
        return programId;
      },

      addSessionToProgram: (programId, stageIndex = null) => {
        const { programs } = get();
        const program = programs[programId];
        if (!program) return;
        const labels = ['A', 'B', 'C', 'D', 'E', 'F'];
        const dayColors = ['var(--day1)', 'var(--day2)', 'var(--day3)', 'var(--day4)', 'var(--day5)', 'var(--day6)'];
        const hasStages = program.stages?.length > 0;
        const targetStageIdx = hasStages
          ? (stageIndex !== null ? stageIndex : (program.currentStageIndex ?? 0))
          : null;
        const targetDays = hasStages
          ? (program.stages[targetStageIdx]?.days ?? [])
          : program.days;
        const i = targetDays.length;
        const label = labels[i] ?? String(i + 1);
        const tplId = generateId('tpl');
        const newTemplate = {
          id: tplId, programId, label, name: `Sesión ${label}`,
          emphasis: '', color: dayColors[i % dayColors.length], exercises: [],
        };
        if (hasStages) {
          const newDays = [...targetDays, { sessionTemplateId: tplId, label }];
          const newStages = program.stages.map((st, idx) =>
            idx === targetStageIdx ? { ...st, days: newDays } : st
          );
          set((s) => ({
            sessionTemplates: { ...s.sessionTemplates, [tplId]: newTemplate },
            programs: { ...s.programs, [programId]: { ...program, stages: newStages } },
          }));
        } else {
          set((s) => ({
            sessionTemplates: { ...s.sessionTemplates, [tplId]: newTemplate },
            programs: {
              ...s.programs,
              [programId]: { ...program, days: [...program.days, { sessionTemplateId: tplId, label }] },
            },
          }));
        }
      },

      // Clones a session (edited version wins) into the same stage/program.
      // Returns the new template id so the caller can jump to the copy.
      duplicateSessionInProgram: (programId, templateId) => {
        const { programs, sessionTemplates, userPrograms } = get();
        const program = programs[programId];
        if (!program) return null;
        const labels = ['A', 'B', 'C', 'D', 'E', 'F'];
        const dayColors = ['var(--day1)', 'var(--day2)', 'var(--day3)', 'var(--day4)', 'var(--day5)', 'var(--day6)'];
        const hasStages = program.stages?.length > 0;

        let stageIdx = null;
        let days;
        if (hasStages) {
          stageIdx = program.stages.findIndex((st) => st.days.some((d) => d.sessionTemplateId === templateId));
          if (stageIdx < 0) return null;
          days = program.stages[stageIdx].days;
        } else {
          days = program.days ?? [];
          if (!days.some((d) => d.sessionTemplateId === templateId)) return null;
        }

        const src = userPrograms[templateId] ?? sessionTemplates[templateId];
        if (!src) return null;

        const i = days.length;
        const label = labels[i] ?? String(i + 1);
        const tplId = generateId('tpl');
        const newTemplate = {
          ...src,
          id: tplId,
          programId,
          label,
          name: `${src.name ?? 'Sesión'} (copia)`,
          color: dayColors[i % dayColors.length],
          // The copy starts unlinked — otherwise edits to it would propagate
          // back to the original through the link group.
          exercises: (src.exercises ?? []).map((ex) => ({ ...ex, linkGroup: null })),
          blocks: (src.blocks ?? []).map((b) => ({ ...b, id: generateId('blk') })),
        };
        const newDays = [...days, { sessionTemplateId: tplId, label }];

        if (hasStages) {
          const newStages = program.stages.map((st, idx) =>
            idx === stageIdx ? { ...st, days: newDays } : st
          );
          set((s) => ({
            sessionTemplates: { ...s.sessionTemplates, [tplId]: newTemplate },
            programs: { ...s.programs, [programId]: { ...program, stages: newStages } },
          }));
        } else {
          set((s) => ({
            sessionTemplates: { ...s.sessionTemplates, [tplId]: newTemplate },
            programs: { ...s.programs, [programId]: { ...program, days: newDays } },
          }));
        }
        return tplId;
      },

      removeSessionFromProgram: (programId, templateId) => {
        const { programs } = get();
        const program = programs[programId];
        if (!program) return;
        const hasStages = program.stages?.length > 0;

        if (hasStages) {
          const newStages = program.stages.map((st) => ({
            ...st,
            days: st.days.filter((d) => d.sessionTemplateId !== templateId),
          }));
          set((s) => {
            const nextSessionTemplates = { ...s.sessionTemplates };
            delete nextSessionTemplates[templateId];
            const nextUserPrograms = { ...s.userPrograms };
            delete nextUserPrograms[templateId];
            return {
              programs: { ...s.programs, [programId]: { ...program, stages: newStages } },
              sessionTemplates: nextSessionTemplates,
              userPrograms: nextUserPrograms,
            };
          });
        } else {
          const newDays = program.days.filter((d) => d.sessionTemplateId !== templateId);
          set((s) => {
            const nextSessionTemplates = { ...s.sessionTemplates };
            delete nextSessionTemplates[templateId];
            const nextUserPrograms = { ...s.userPrograms };
            delete nextUserPrograms[templateId];
            return {
              programs: { ...s.programs, [programId]: { ...program, days: newDays } },
              sessionTemplates: nextSessionTemplates,
              userPrograms: nextUserPrograms,
            };
          });
        }
      },

      // Reorders the sessions of a stage (or of a stage-less program) to match
      // `orderedTemplateIds`. The A/B/C… label means "position in the cycle",
      // not an identity — same convention as addSessionToProgram — so labels are
      // reassigned by position. The session NAME is left alone: a session called
      // "Sesión A" that moves to slot B keeps its name until the user renames it.
      reorderSessionsInStage: (programId, stageIndex, orderedTemplateIds) => {
        const { programs } = get();
        const program = programs[programId];
        if (!program) return;
        const hasStages = program.stages?.length > 0;
        const days = hasStages ? (program.stages[stageIndex]?.days ?? []) : (program.days ?? []);
        if (orderedTemplateIds.length !== days.length) return;

        const labels  = ['A', 'B', 'C', 'D', 'E', 'F'];
        const newDays = orderedTemplateIds.map((id, i) => ({
          ...days.find((d) => d.sessionTemplateId === id),
          sessionTemplateId: id,
          label: labels[i] ?? String(i + 1),
        }));

        set((s) => {
          const relabel = (bag) => {
            const next = { ...bag };
            newDays.forEach(({ sessionTemplateId, label }) => {
              if (next[sessionTemplateId]) next[sessionTemplateId] = { ...next[sessionTemplateId], label };
            });
            return next;
          };
          const nextProgram = hasStages
            ? { ...program, stages: program.stages.map((st, i) => (i === stageIndex ? { ...st, days: newDays } : st)) }
            : { ...program, days: newDays };
          return {
            programs:         { ...s.programs, [programId]: nextProgram },
            sessionTemplates: relabel(s.sessionTemplates),
            userPrograms:     relabel(s.userPrograms),
          };
        });
      },

      addStageToProgram: (programId) => {
        const { programs, sessionTemplates, userPrograms } = get();
        const program = programs[programId];
        if (!program) return;
        const hasStages = program.stages?.length > 0;
        const existingStages = program.stages ?? [];
        const updatedSessionTemplates = { ...sessionTemplates };

        function cloneDays(sourceDays) {
          return sourceDays.map(({ sessionTemplateId, label }) => {
            const src = userPrograms[sessionTemplateId] ?? sessionTemplates[sessionTemplateId];
            const newTplId = generateId('tpl');
            updatedSessionTemplates[newTplId] = {
              ...(src ?? { exercises: [], emphasis: '', color: 'var(--accent)' }),
              id: newTplId, programId,
            };
            return { sessionTemplateId: newTplId, label };
          });
        }

        let updatedStages;
        if (!hasStages) {
          const stage1 = { id: generateId('stage'), name: 'Etapa 1', durationWeeks: 4, days: program.days };
          const newStage = { id: generateId('stage'), name: 'Etapa 2', durationWeeks: 4, days: cloneDays(program.days) };
          updatedStages = [stage1, newStage];
        } else {
          const lastStage = existingStages[existingStages.length - 1];
          const newStage = { id: generateId('stage'), name: `Etapa ${existingStages.length + 1}`, durationWeeks: 4, days: cloneDays(lastStage.days) };
          updatedStages = [...existingStages, newStage];
        }

        set((s) => ({
          sessionTemplates: updatedSessionTemplates,
          programs: {
            ...s.programs,
            [programId]: { ...program, stages: updatedStages, currentStageIndex: program.currentStageIndex ?? 0 },
          },
        }));
      },

      updateStage: (programId, stageIndex, updates) => {
        const { programs } = get();
        const program = programs[programId];
        if (!program?.stages) return;
        const newStages = program.stages.map((st, i) => i === stageIndex ? { ...st, ...updates } : st);
        set((s) => ({ programs: { ...s.programs, [programId]: { ...program, stages: newStages } } }));
      },

      // Clones a stage (sessions included, edited versions win) right after the
      // source. Returns the new stage index so the caller can select it.
      duplicateStageInProgram: (programId, stageIndex) => {
        const { programs, sessionTemplates, userPrograms } = get();
        const program = programs[programId];
        const src = program?.stages?.[stageIndex];
        if (!src) return null;

        const updatedSessionTemplates = { ...sessionTemplates };
        // Link groups are remapped to fresh ids: copies stay linked to each
        // other (within the new stage) but never to the original stage.
        const groupMap = {};
        const remapGroup = (g) => {
          if (!g) return null;
          if (!groupMap[g]) groupMap[g] = generateId('lnk');
          return groupMap[g];
        };
        const newDays = (src.days ?? []).map(({ sessionTemplateId, label }) => {
          const tpl = userPrograms[sessionTemplateId] ?? sessionTemplates[sessionTemplateId];
          const newTplId = generateId('tpl');
          updatedSessionTemplates[newTplId] = {
            ...(tpl ?? { exercises: [], emphasis: '', color: 'var(--accent)' }),
            id: newTplId,
            programId,
            exercises: (tpl?.exercises ?? []).map((ex) => ({ ...ex, linkGroup: remapGroup(ex.linkGroup) })),
            blocks: (tpl?.blocks ?? []).map((b) => ({ ...b, id: generateId('blk') })),
          };
          return { sessionTemplateId: newTplId, label };
        });

        const newStage = {
          id: generateId('stage'),
          name: `${src.name} (copia)`,
          durationWeeks: src.durationWeeks ?? 4,
          days: newDays,
        };
        const newStages = [
          ...program.stages.slice(0, stageIndex + 1),
          newStage,
          ...program.stages.slice(stageIndex + 1),
        ];
        // The copy lands after the source — shift the active index if it
        // pointed past the insertion point.
        const cur = program.currentStageIndex ?? 0;
        const newCur = stageIndex < cur ? cur + 1 : cur;

        set((s) => ({
          sessionTemplates: updatedSessionTemplates,
          programs: {
            ...s.programs,
            [programId]: { ...program, stages: newStages, currentStageIndex: newCur },
          },
        }));
        return stageIndex + 1;
      },

      removeStageFromProgram: (programId, stageIndex) => {
        const { programs } = get();
        const program = programs[programId];
        if (!program?.stages || program.stages.length <= 1) return;
        const newStages = program.stages.filter((_, i) => i !== stageIndex);
        const currentIdx = program.currentStageIndex ?? 0;
        const newCurrentIdx = stageIndex <= currentIdx ? Math.max(0, currentIdx - 1) : currentIdx;
        if (newStages.length === 1) {
          const { stages: _s, currentStageIndex: _csi, ...rest } = program;
          set((s) => ({ programs: { ...s.programs, [programId]: { ...rest, days: newStages[0].days } } }));
        } else {
          set((s) => ({
            programs: {
              ...s.programs,
              [programId]: { ...program, stages: newStages, currentStageIndex: newCurrentIdx, days: newStages[newCurrentIdx].days },
            },
          }));
        }
      },

      setCurrentStage: (programId, stageIndex) => {
        const { programs } = get();
        const program = programs[programId];
        if (!program?.stages?.length) return;
        const targetStage = program.stages[stageIndex];
        if (!targetStage) return;
        set((s) => ({
          programs: {
            ...s.programs,
            [programId]: {
              ...program,
              currentStageIndex: stageIndex,
              days: targetStage.days,
              stageSessionsCompleted: 0,
              cycleCompletedIds: [],
              stageAdvancePending: false,
            },
          },
        }));
      },

      advanceStage: (programId) => {
        const { programs } = get();
        const program = programs[programId];
        if (!program?.stages?.length) return;
        const currentIdx = program.currentStageIndex ?? 0;
        const nextIdx = currentIdx + 1;
        if (nextIdx >= program.stages.length) return;
        const nextStage = program.stages[nextIdx];
        set((s) => ({
          programs: {
            ...s.programs,
            [programId]: {
              ...program,
              currentStageIndex: nextIdx,
              days: nextStage.days,
              stageSessionsCompleted: 0,
              cycleCompletedIds: [],
              stageAdvancePending: false,
            },
          },
        }));
      },

      dismissStageAdvance: (programId) => {
        const { programs } = get();
        const program = programs[programId];
        if (!program) return;
        set((s) => ({
          programs: {
            ...s.programs,
            [programId]: { ...program, stageAdvancePending: false },
          },
        }));
      },

      setEditingProgram: (programId) => {
        set((s) => ({ ui: { ...s.ui, _editingProgramId: programId } }));
        get().navigate('programEditor');
      },

      setPrintingProgram: (programId) => {
        set((s) => ({ ui: { ...s.ui, _viewingProgramId: programId } }));
        get().navigate('programPrint');
      },

      cloneProgramFromTemplate: (sourceProgramId, { mode = 'personal', clientId = null, name = null } = {}) => {
        const { programs, sessionTemplates, userPrograms } = get();
        const srcProgram = programs[sourceProgramId];
        if (!srcProgram) return null;

        const newProgramId = generateId('prog');
        const newTemplates = {};

        function cloneDays(days) {
          return (days ?? []).map(({ sessionTemplateId, label }) => {
            const srcTemplate = userPrograms[sessionTemplateId] ?? sessionTemplates[sessionTemplateId];
            const newTemplateId = generateId('tpl');
            newTemplates[newTemplateId] = {
              ...(srcTemplate ?? { exercises: [], emphasis: '', color: 'var(--accent)' }),
              id: newTemplateId, programId: newProgramId,
            };
            return { sessionTemplateId: newTemplateId, label };
          });
        }

        // Support staged programs (same as web store)
        let newDays, newStages;
        if (srcProgram.stages?.length > 0) {
          newStages = srcProgram.stages.map((stage) => ({
            ...stage,
            days: cloneDays(stage.days),
          }));
          const currentIdx = srcProgram.currentStageIndex ?? 0;
          newDays = newStages[currentIdx]?.days ?? cloneDays(srcProgram.days);
        } else {
          newDays = cloneDays(srcProgram.days);
        }

        const newProgram = {
          ...srcProgram, id: newProgramId, name: name ?? srcProgram.name,
          mode, status: 'active', archivedAt: null,
          createdAt: new Date().toISOString().split('T')[0],
          days: newDays,
          ...(newStages ? { stages: newStages } : {}),
        };
        if (clientId) newProgram.clientId = clientId;
        else delete newProgram.clientId;

        const isManaged = mode === 'managed';
        const isPersonal = mode === 'personal';

        set((s) => {
          const update = {
            programs: { ...s.programs, [newProgramId]: newProgram },
            sessionTemplates: { ...s.sessionTemplates, ...newTemplates },
          };
          if (isManaged && clientId) {
            const existingClient = s.clients[clientId] ?? {};
            const hasActiveProgram = !!(existingClient.activeProgramId && s.programs[existingClient.activeProgramId]);
            // Add program to client's programIds list; set as active if client had none
            update.clients = {
              ...s.clients,
              [clientId]: {
                ...existingClient,
                programIds: [newProgramId, ...(existingClient.programIds ?? [])],
                ...(!hasActiveProgram ? { activeProgramId: newProgramId } : {}),
              },
            };
            // Open editor for the new program
            update.ui = { ...s.ui, _editingProgramId: newProgramId };
          } else if (isPersonal) {
            update.profile = { ...s.profile, activeProgramId: newProgramId, onboardingCompleted: true };
          }
          return update;
        });

        return newProgramId;
      },

      // ══════════════════════════════════════════════════════════════════════
      // ACTIVE SESSION
      // ══════════════════════════════════════════════════════════════════════

      startSession: (templateId) => {
        const template = get().getEffectiveTemplate(templateId);
        if (!template) return;
        const setsState = {};
        template.exercises.forEach(({ exerciseId, sets }) => {
          setsState[exerciseId] = Array.from({ length: sets }, () => ({
            weight: '', reps: '', time: '', done: false,
          }));
        });
        set({
          activeSession: { templateId, setsState, startedAt: Date.now(), notes: '', exerciseNotes: {}, adHocExercises: [], freeSessionName: '', blockState: {} },
          ui: { ...get().ui, view: 'workout' },
        });
        get().navigate('workout');
      },

      startFreeSession: () => {
        set({
          activeSession: {
            templateId: '__free__',
            setsState: {},
            startedAt: Date.now(),
            notes: '',
            exerciseNotes: {},
            adHocExercises: [],
            freeSessionName: '',
            blockState: {},
          },
          ui: { ...get().ui, view: 'workout' },
        });
        get().navigate('workout');
      },

      updateFreeSessionName: (name) =>
        set((s) => ({ activeSession: { ...s.activeSession, freeSessionName: name } })),

      /** Sets the client's per-exercise feedback note for the active session. */
      setExerciseNote: (exerciseId, text) =>
        set((s) => ({
          activeSession: {
            ...s.activeSession,
            exerciseNotes: { ...(s.activeSession.exerciseNotes ?? {}), [exerciseId]: text },
          },
        })),

      // Reconciles activeSession.setsState with the current template.
      // Call this when entering WorkoutScreen after editing the program:
      // it adds missing exercises and adjusts set counts to match exConfig.sets.
      syncSessionSets: () => {
        const { activeSession, getEffectiveTemplate } = get();
        if (!activeSession.templateId) return;
        const template = getEffectiveTemplate(activeSession.templateId);
        if (!template) return;
        const setsState = { ...activeSession.setsState };
        let changed = false;
        const emptySet = () => ({ weight: '', reps: '', time: '', done: false });

        template.exercises.forEach(({ exerciseId, sets }) => {
          const existing = setsState[exerciseId] ?? [];
          if (existing.length !== sets) {
            changed = true;
            setsState[exerciseId] = existing.length < sets
              ? [...existing, ...Array.from({ length: sets - existing.length }, emptySet)]
              : existing.slice(0, sets);
          }
        });

        if (changed) {
          set((s) => ({ activeSession: { ...s.activeSession, setsState } }));
        }
      },

      toggleSetDone: (exerciseId, setIndex) => {
        const { activeSession, exerciseLibrary, customExercises } = get();
        const sets = activeSession.setsState[exerciseId] ?? [];
        const set_ = sets[setIndex];
        if (!set_) return { changed: false, done: false };
        const hasData = set_.weight !== '' || set_.reps !== '' || set_.time !== '';
        const nowDone = !set_.done;
        // Actualizar visualmente solo si tiene datos propios o ya estaba marcado (para desmarcar)
        const changed = hasData || set_.done;
        if (changed) {
          const updatedSets = sets.map((s, i) => i === setIndex ? { ...s, done: nowDone } : s);
          set((s) => ({
            activeSession: {
              ...s.activeSession,
              setsState: { ...s.activeSession.setsState, [exerciseId]: updatedSets },
            },
          }));
        }
        // Siempre triggear el timer al marcar (aunque no haya datos)
        if (nowDone) {
          const exDef = exerciseLibrary[exerciseId] ?? customExercises?.[exerciseId];
          const template = activeSession.templateId ? get().getEffectiveTemplate(activeSession.templateId) : null;
          const exIdx    = template?.exercises?.findIndex((e) => e.exerciseId === exerciseId) ?? -1;
          const exConfig = exIdx >= 0 ? template.exercises[exIdx] : null;

          // Superset: only the LAST member of the chain rests — a member
          // chained to the next (supersetWithNext) alternates with no rest.
          // Guarded by exIdx < length-1 so a stale flag on a now-last exercise
          // (its former chain partner was deleted) can't silently kill its timer.
          const hasNext = exIdx >= 0 && exIdx < template.exercises.length - 1;
          if (!(exConfig?.supersetWithNext && hasNext)) {
            const restSec = exConfig?.restSec ?? exDef?.restSec ?? 90;
            get().startRestTimer(restSec, exDef?.name ?? exerciseId);
          }
        }
        return { changed, done: nowDone };
      },

      updateSetField: (exerciseId, setIndex, field, value) => {
        const { activeSession } = get();
        const sets = activeSession.setsState[exerciseId] ?? [];
        const updatedSets = sets.map((s, i) => i === setIndex ? { ...s, [field]: value } : s);
        set((s) => ({
          activeSession: {
            ...s.activeSession,
            setsState: { ...s.activeSession.setsState, [exerciseId]: updatedSets },
          },
        }));
      },

      updateSessionNotes: (notes) => {
        set((s) => ({ activeSession: { ...s.activeSession, notes } }));
      },

      addAdHocExercise: (exerciseId) => {
        const allExercises = { ...get().exerciseLibrary, ...get().customExercises };
        const def = allExercises[exerciseId];
        const numSets = def?.sets ?? 3;
        const emptySet = () => ({ weight: '', reps: '', time: '', done: false });
        set((s) => {
          if ((s.activeSession.adHocExercises ?? []).some((e) => e.exerciseId === exerciseId)) return s;
          return {
            activeSession: {
              ...s.activeSession,
              adHocExercises: [
                ...(s.activeSession.adHocExercises ?? []),
                { exerciseId, setsState: Array.from({ length: numSets }, emptySet) },
              ],
            },
          };
        });
      },

      removeAdHocExercise: (exerciseId) => {
        set((s) => ({
          activeSession: {
            ...s.activeSession,
            adHocExercises: s.activeSession.adHocExercises.filter((e) => e.exerciseId !== exerciseId),
          },
        }));
      },

      updateAdHocSet: (exerciseId, setIdx, field, value) => {
        set((s) => ({
          activeSession: {
            ...s.activeSession,
            adHocExercises: s.activeSession.adHocExercises.map((ex) =>
              ex.exerciseId !== exerciseId ? ex : {
                ...ex,
                setsState: ex.setsState.map((st, i) => i === setIdx ? { ...st, [field]: value } : st),
              }
            ),
          },
        }));
      },

      toggleAdHocSetDone: (exerciseId, setIdx) => {
        const prevDone = get().activeSession.adHocExercises
          .find((ex) => ex.exerciseId === exerciseId)?.setsState[setIdx]?.done;
        set((s) => ({
          activeSession: {
            ...s.activeSession,
            adHocExercises: s.activeSession.adHocExercises.map((ex) =>
              ex.exerciseId !== exerciseId ? ex : {
                ...ex,
                setsState: ex.setsState.map((st, i) => i === setIdx ? { ...st, done: !st.done } : st),
              }
            ),
          },
        }));
        return { changed: true, done: !prevDone };
      },

      addAdHocSet: (exerciseId) => {
        set((s) => ({
          activeSession: {
            ...s.activeSession,
            adHocExercises: s.activeSession.adHocExercises.map((ex) =>
              ex.exerciseId !== exerciseId ? ex : {
                ...ex,
                setsState: [...ex.setsState, { weight: '', reps: '', time: '', done: false }],
              }
            ),
          },
        }));
      },

      addSetToSession: (exerciseId) => {
        set((s) => {
          const current = s.activeSession.setsState[exerciseId] ?? [];
          const lastSet = current[current.length - 1] ?? {};
          const newSet = { weight: lastSet.weight ?? '', reps: '', time: '', done: false };
          return {
            activeSession: {
              ...s.activeSession,
              setsState: { ...s.activeSession.setsState, [exerciseId]: [...current, newSet] },
            },
          };
        });
      },

      // Dropset — sub-series on the last work set, no rest timer, prefilled at
      // −20% of the previous weight (mother set or last drop), rounded to 2.5.
      addDropToLastSet: (exerciseId) => {
        set((s) => ({
          activeSession: {
            ...s.activeSession,
            setsState: updateLastSetDrops(s.activeSession.setsState, exerciseId, (drops, motherSet) => {
              const prevWeight = drops.length > 0
                ? parseFloat(drops[drops.length - 1].weight)
                : parseFloat(motherSet.weight);
              const nextWeight = !isNaN(prevWeight)
                ? String(Math.max(0, Math.round((prevWeight * 0.8) / 2.5) * 2.5))
                : '';
              return [...drops, { weight: nextWeight, reps: '', done: false }];
            }),
          },
        }));
      },

      updateDropField: (exerciseId, dropIndex, field, value) => {
        set((s) => ({
          activeSession: {
            ...s.activeSession,
            setsState: updateLastSetDrops(s.activeSession.setsState, exerciseId, (drops) =>
              drops.map((d, i) => i === dropIndex ? { ...d, [field]: value } : d)),
          },
        }));
      },

      toggleDropDone: (exerciseId, dropIndex) => {
        set((s) => ({
          activeSession: {
            ...s.activeSession,
            setsState: updateLastSetDrops(s.activeSession.setsState, exerciseId, (drops) =>
              drops.map((d, i) => i === dropIndex ? { ...d, done: !d.done } : d)),
          },
        }));
      },

      removeDropFromLastSet: (exerciseId, dropIndex) => {
        set((s) => ({
          activeSession: {
            ...s.activeSession,
            setsState: updateLastSetDrops(s.activeSession.setsState, exerciseId, (drops) =>
              drops.filter((_, i) => i !== dropIndex)),
          },
        }));
      },

      // ── Conditioning blocks — workout runtime ───────────────────────────────
      // Wall-clock only (spec §4): the source of truth is startedAt; the UI
      // derives everything else per render via src/utils/conditioningBlocks.

      startBlock: (blockId) => {
        const { activeSession } = get();
        const template = activeSession.templateId
          ? get().getEffectiveTemplate(activeSession.templateId) : null;
        const block = template?.blocks?.find((b) => b.id === blockId);
        if (!block) return;

        const startedAt = Date.now();
        set((s) => ({
          activeSession: {
            ...s.activeSession,
            blockState: {
              ...(s.activeSession.blockState ?? {}),
              [blockId]: { startedAt, finishedAt: null, rounds: 0, extraReps: 0, failed: [], timeSec: null },
            },
          },
        }));

        // A block has its own clock — the rest timer (and its notification)
        // yields to it.
        get().stopRestTimer();

        // Native chronometer notification for formats with a known end
        // (amrap: cap; emom: interval×rounds). for_time has no known end.
        const endMs = block.format === 'amrap' && block.capSec ? block.capSec * 1000
          : block.format === 'emom' ? (block.intervalSec ?? 60) * (block.rounds ?? 1) * 1000
          : null;
        if (endMs) {
          const name = block.name || i18n.t(`blocks.formats.${block.format}`);
          showCountdownNotification(name, startedAt + endMs).catch(() => {});
        }
      },

      updateBlockState: (blockId, patch) => {
        set((s) => {
          const current = s.activeSession.blockState?.[blockId];
          if (!current) return s;
          return {
            activeSession: {
              ...s.activeSession,
              blockState: { ...s.activeSession.blockState, [blockId]: { ...current, ...patch } },
            },
          };
        });
      },

      finishBlock: (blockId) => {
        const { activeSession } = get();
        const st = activeSession.blockState?.[blockId];
        if (!st || st.finishedAt) return;
        const template = activeSession.templateId
          ? get().getEffectiveTemplate(activeSession.templateId) : null;
        const block = template?.blocks?.find((b) => b.id === blockId);

        const patch = { finishedAt: Date.now() };
        // for_time: freeze the score at the moment of finishing (unless the
        // athlete's time was already set, e.g. reopened + refinished).
        if (block?.format === 'for_time' && st.timeSec == null) {
          patch.timeSec = forTimeElapsed(block, st.startedAt, Date.now()).elapsedSec;
        }
        get().updateBlockState(blockId, patch);

        // Drop the block's countdown notification — but never kill an active
        // rest timer's (they share the same native notification slot).
        if (!get().ui.restTimer.active) dismissCountdownNotification().catch(() => {});
      },

      resetBlock: (blockId) => {
        set((s) => {
          const next = { ...(s.activeSession.blockState ?? {}) };
          delete next[blockId];
          return { activeSession: { ...s.activeSession, blockState: next } };
        });
        if (!get().ui.restTimer.active) dismissCountdownNotification().catch(() => {});
      },

      getProgressionRecommendation: (templateId, exerciseId) => {
        const { getEffectiveTemplate, exerciseLibrary, customExercises, getLastSession } = get();
        const template = getEffectiveTemplate(templateId);
        if (!template) return null;
        const exConfig = template.exercises.find((e) => e.exerciseId === exerciseId);
        if (!exConfig) return null;
        const baseDef = exerciseLibrary[exerciseId] ?? customExercises[exerciseId];
        if (!baseDef) return null;
        const effectiveDef = exConfig.progressionModel
          ? { ...baseDef, progressionModel: exConfig.progressionModel } : baseDef;
        const lastSession = getLastSession(templateId);
        if (!lastSession) return null;
        const lastExercise = lastSession.exercises?.find((e) => e.exerciseId === exerciseId);
        if (!lastExercise) return null;
        return getProgression(effectiveDef, lastExercise.sets, exConfig.sets);
      },

      saveSession: () => {
        const { activeSession, getEffectiveTemplate, workoutLog, programs } = get();
        if (!activeSession.templateId) return { ok: false, error: 'No hay sesión activa' };

        // ── Free session — no template, only ad-hoc exercises ─────────────────
        if (activeSession.templateId === '__free__') {
          const adHoc = activeSession.adHocExercises ?? [];
          const hasData = adHoc.some((a) =>
            a.setsState.some((s) => s.weight !== '' || s.reps !== '' || s.time !== '' || s.done)
          );
          if (!hasData) return { ok: false, error: 'Sin datos registrados' };
          const freeNotes = activeSession.exerciseNotes ?? {};
          const logEntry = {
            id:                generateId('log'),
            sessionTemplateId: '__free__',
            sessionName:       activeSession.freeSessionName?.trim() || null,
            timestamp:         Date.now(),
            duration:          activeSession.startedAt ? Date.now() - activeSession.startedAt : 0,
            notes:             activeSession.notes ?? '',
            bodyWeight:        null,
            exercises:         adHoc.map((a) => ({
              exerciseId: a.exerciseId, isAdHoc: true, sets: a.setsState,
              ...(freeNotes[a.exerciseId]?.trim() ? { note: freeNotes[a.exerciseId].trim() } : {}),
            })),
          };
          set((s) => ({
            workoutLog:    [...s.workoutLog, logEntry],
            activeSession: INITIAL_ACTIVE_SESSION,
            ui:            { ...s.ui, homeTab: 'session' },
          }));
          return { ok: true, entryId: logEntry.id };
        }

        // ── Regular template session ───────────────────────────────────────────
        const template = getEffectiveTemplate(activeSession.templateId);
        if (!template) return { ok: false, error: 'Template no encontrado' };

        const lastSession = [...workoutLog]
          .filter((e) => e.sessionTemplateId === activeSession.templateId)
          .sort((a, b) => b.timestamp - a.timestamp)[0] ?? null;

        function resolveSet(s, lastSet) {
          // Cualquier dato → registrado como hecho (sin necesidad de pulsar ✓)
          if (s.weight !== '' || s.reps !== '' || s.time !== '') {
            return { ...s, done: true };
          }
          // Sin datos propios, pero ✓ marcado y hay sesión anterior → rellenar con valores anteriores
          if (s.done && lastSet) {
            return {
              weight: lastSet.weight ?? '', reps: lastSet.reps ?? '', time: lastSet.time ?? '', done: true,
            };
          }
          return s;
        }

        const sessionExNotes = activeSession.exerciseNotes ?? {};
        const exNote = (exerciseId) =>
          sessionExNotes[exerciseId]?.trim() ? { note: sessionExNotes[exerciseId].trim() } : {};

        const ownerProgramForLinks = template?.programId ? programs[template.programId] : null;
        const exercises = template.exercises
          .map(({ exerciseId, sets: totalSets, minReps, maxReps, restSec, linkGroup }) => {
            const setsData = activeSession.setsState[exerciseId] ?? [];
            // Linked exercises autofill from the group's latest performance
            // (any session of the group), not just this template's.
            const lastExData = linkGroup
              ? lastLinkedExercise(
                  workoutLog,
                  linkGroupTemplateIds(ownerProgramForLinks, exerciseId, linkGroup, get().getEffectiveTemplate),
                  exerciseId,
                )
              : lastSession?.exercises.find((e) => e.exerciseId === exerciseId);
            const lastSets = lastExData?.sets ?? [];
            const resolved = setsData.map((s, i) => resolveSet(s, lastSets[i]));
            const validSets = resolved.filter((s) => s.weight !== '' || s.reps !== '' || s.time !== '' || s.done);
            if (validSets.length === 0) return null;
            return { exerciseId, sets: validSets, totalSets, minReps, maxReps, restSec, ...exNote(exerciseId) };
          })
          .filter(Boolean);

        // Conditioning blocks — snapshot config + result for every block that
        // was actually started (unstarted blocks leave no trace, per spec §2.4).
        // The config is copied here (not referenced) so the log stays true to
        // what was actually run even if the trainer edits the block afterwards.
        const blockState = activeSession.blockState ?? {};
        const blocksLog = (template.blocks ?? [])
          .filter((block) => blockState[block.id]?.startedAt)
          .map((block) => ({
            blockId: block.id,
            format: block.format,
            name: block.name,
            capSec: block.capSec,
            intervalSec: block.intervalSec,
            rounds: block.rounds,
            emomMode: block.emomMode,
            movements: block.movements,
            result: buildBlockResult(block, blockState[block.id], Date.now()),
          }));

        // A block-only session (metcon day, no strength data) is still a session.
        if (exercises.length === 0 && blocksLog.length === 0) {
          return { ok: false, error: 'Sin datos registrados' };
        }

        // Tag the entry if the trainer had prescribed targets for this session.
        const wasAdapted = !!get().clientSync.pendingOverrides?.[activeSession.templateId];

        const logEntry = {
          id: generateId('log'),
          sessionTemplateId: activeSession.templateId,
          sessionName: template.name,
          timestamp: Date.now(),
          duration: activeSession.startedAt ? Date.now() - activeSession.startedAt : 0,
          notes: activeSession.notes ?? '',
          bodyWeight: null,
          // Full planned volume of the template — skipped exercises drop out of
          // `exercises`, so the recap can't reconstruct the plan without this.
          plannedSets: template.exercises.reduce((a, ex) => a + (ex.sets ?? 0), 0),
          ...(wasAdapted ? { adapted: true } : {}),
          ...(blocksLog.length > 0 ? { blocks: blocksLog } : {}),
          exercises: [
            ...exercises,
            ...(activeSession.adHocExercises ?? []).map((adHoc) => ({
              exerciseId: adHoc.exerciseId, isAdHoc: true, sets: adHoc.setsState,
              ...exNote(adHoc.exerciseId),
            })),
          ],
        };

        // Stage / cycle progress tracking
        const ownerProgramId = template?.programId;
        const ownerProgram = ownerProgramId ? programs[ownerProgramId] : null;
        let stageUpdate = null;
        if (ownerProgram?.stages?.length > 0) {
          // ── Staged program ─────────────────────────────────────────────────
          const stageIdx = ownerProgram.currentStageIndex ?? 0;
          const stage = ownerProgram.stages[stageIdx];
          const stageTplIds = new Set((stage?.days ?? []).map((d) => d.sessionTemplateId));
          if (stageTplIds.has(activeSession.templateId) && stage) {
            const newCount = (ownerProgram.stageSessionsCompleted ?? 0) + 1;
            const threshold = stage.durationWeeks * stage.days.length;
            const isLast = stageIdx >= ownerProgram.stages.length - 1;
            // A cycle is complete when every DISTINCT template in it has been
            // done at least once — not every N-th save (a positional counter
            // assumes strict A→B→C… order and breaks as soon as a session is
            // completed out of rotation, marking the wrong slot as done).
            const cycleIds = new Set(ownerProgram.cycleCompletedIds ?? []);
            cycleIds.add(activeSession.templateId);
            const cycleCompleted = cycleIds.size >= stageTplIds.size;
            stageUpdate = {
              programId: ownerProgramId,
              stageSessionsCompleted: newCount,
              cycleCompletedIds: cycleCompleted ? [] : [...cycleIds],
              stageAdvancePending: (newCount >= threshold && !isLast) || (ownerProgram.stageAdvancePending ?? false),
              totalWeeksCompleted: (ownerProgram.totalWeeksCompleted ?? 0) + (cycleCompleted ? 1 : 0),
            };
          }
        } else if (ownerProgram && ownerProgramId) {
          // ── Non-staged program: track rotation the same way ────────────────
          const tplIds = new Set((ownerProgram.days ?? []).map((d) => d.sessionTemplateId));
          if (tplIds.has(activeSession.templateId)) {
            const newCount = (ownerProgram.stageSessionsCompleted ?? 0) + 1;
            const cycleIds = new Set(ownerProgram.cycleCompletedIds ?? []);
            cycleIds.add(activeSession.templateId);
            const cycleCompleted = cycleIds.size >= tplIds.size;
            stageUpdate = {
              programId: ownerProgramId,
              stageSessionsCompleted: newCount,
              cycleCompletedIds: cycleCompleted ? [] : [...cycleIds],
              stageAdvancePending: ownerProgram.stageAdvancePending ?? false,
              totalWeeksCompleted: (ownerProgram.totalWeeksCompleted ?? 0) + (cycleCompleted ? 1 : 0),
            };
          }
        }

        set((s) => ({
          workoutLog: [...s.workoutLog, logEntry],
          activeSession: INITIAL_ACTIVE_SESSION,
          ui: { ...s.ui, homeTab: 'session' },
          // Consume the trainer's one-off prescription for this session, if any.
          ...(s.clientSync.pendingOverrides?.[activeSession.templateId] ? {
            clientSync: {
              ...s.clientSync,
              pendingOverrides: consumeOverride(s.clientSync.pendingOverrides, activeSession.templateId),
            },
          } : {}),
          ...(stageUpdate ? {
            programs: {
              ...s.programs,
              [stageUpdate.programId]: {
                ...s.programs[stageUpdate.programId],
                stageSessionsCompleted: stageUpdate.stageSessionsCompleted,
                cycleCompletedIds:      stageUpdate.cycleCompletedIds,
                stageAdvancePending:    stageUpdate.stageAdvancePending,
                totalWeeksCompleted:    stageUpdate.totalWeeksCompleted,
              },
            },
          } : {}),
        }));

        get().stopRestTimer();

        // Per-session Drive backup (fire and forget, non-blocking)
        const driveState = get().driveBackup;
        if (driveState.enabled && driveState.frequency === 'session') {
          get().performDriveBackup().catch(() => {});
        }

        // Upload history to trainer if client is connected (fire and forget)
        if (get().clientSync.slotId) {
          get().uploadHistoryToTrainer().catch(() => {});
        }

        return { ok: true, entryId: logEntry.id };
      },

      discardSession: () => {
        get().stopRestTimer();
        set({ activeSession: INITIAL_ACTIVE_SESSION });
        get().navigate('home');
      },

      // ══════════════════════════════════════════════════════════════════════
      // WORKOUT LOG
      // ══════════════════════════════════════════════════════════════════════

      deleteLogEntry: (logId) =>
        set((state) => ({ workoutLog: state.workoutLog.filter((e) => e.id !== logId) })),

      /** Deletes an entry from a client's separated history (trainer side). */
      deleteClientLogEntry: (clientId, logId) =>
        set((state) => ({
          clientLogs: {
            ...state.clientLogs,
            [clientId]: (state.clientLogs[clientId] ?? []).filter((e) => e.id !== logId),
          },
        })),

      getLastSession: (templateId) => {
        const { workoutLog } = get();
        return workoutLog
          .filter((e) => e.sessionTemplateId === templateId)
          .sort((a, b) => b.timestamp - a.timestamp)[0] ?? null;
      },

      getExerciseLogs: (exerciseId, limit = 6) => {
        const { workoutLog } = get();
        return workoutLog
          .filter((log) => log.exercises.some((e) => e.exerciseId === exerciseId))
          .sort((a, b) => a.timestamp - b.timestamp)
          .slice(-limit)
          .map((log) => ({
            timestamp: log.timestamp,
            exercise: log.exercises.find((e) => e.exerciseId === exerciseId),
          }));
      },

      // ══════════════════════════════════════════════════════════════════════
      // REST TIMER
      // ══════════════════════════════════════════════════════════════════════

      startRestTimer: (seconds, exerciseName) => {
        // Clean up any previous timer
        const { _restInterval, _appStateSub } = get();
        if (_restInterval) clearInterval(_restInterval);
        if (_appStateSub) _appStateSub.remove();

        const endAt = Date.now() + seconds * 1000;

        set((s) => ({
          ui: {
            ...s.ui,
            restTimer: { active: true, remaining: seconds, total: seconds, exerciseName, endAt },
          },
        }));

        // Show chronometer notification once — notifee handles the ticking natively,
        // so it stays correct while minimized without any per-second re-post.
        // Schedule OS-level "done" notification — fires even if the app is killed.
        showCountdownNotification(exerciseName, endAt).catch(() => {});
        scheduleOsDoneNotification(seconds, exerciseName).catch(() => {});

        // Helper: fire the "done" side-effects when the timer expires
        function fireDone() {
          cancelScheduledDoneNotification().catch(() => {}); // cancel OS notification (timer ended in foreground)
          dismissCountdownNotification().catch(() => {});
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          get().showToast('¡Siguiente serie!', 2200, 'neutral');
        }

        // AppState listener: re-sync when the app comes back to the foreground.
        // setInterval is throttled/paused in the background (especially in Expo Go),
        // so we recalculate remaining from the absolute endAt timestamp on resume.
        const appStateSub = AppState.addEventListener('change', (nextState) => {
          if (nextState !== 'active') return;
          const { ui } = get();
          if (!ui.restTimer.active) return; // timer was already stopped

          const remaining = Math.max(0, Math.round((ui.restTimer.endAt - Date.now()) / 1000));

          if (remaining <= 0) {
            // Timer expired while we were in the background
            const { _restInterval: iv, _appStateSub: sub } = get();
            if (iv) clearInterval(iv);
            if (sub) sub.remove();
            set((s) => ({
              _restInterval: null,
              _appStateSub: null,
              ui: { ...s.ui, restTimer: { ...s.ui.restTimer, active: false, remaining: 0 } },
            }));
            fireDone();
          } else {
            // Still running — just correct the in-app counter. The notification
            // chronometer is native and stayed correct on its own.
            set((s) => ({
              ui: { ...s.ui, restTimer: { ...s.ui.restTimer, remaining } },
            }));
          }
        });

        // Tick every second. Uses endAt (wall-clock) instead of decrementing so any
        // background pause is automatically corrected when the interval resumes.
        const interval = setInterval(() => {
          const { ui } = get();
          const remaining = Math.max(0, Math.round((ui.restTimer.endAt - Date.now()) / 1000));

          if (remaining <= 0) {
            const { _appStateSub: sub } = get();
            if (sub) sub.remove();
            clearInterval(get()._restInterval);
            set((s) => ({
              _restInterval: null,
              _appStateSub: null,
              ui: { ...s.ui, restTimer: { ...s.ui.restTimer, active: false, remaining: 0 } },
            }));
            fireDone();
            return;
          }

          // Drive the in-app countdown/bar. The notification chronometer is
          // native, so there's nothing to push to it each second.
          set((s) => ({
            ui: { ...s.ui, restTimer: { ...s.ui.restTimer, remaining } },
          }));
        }, 1000);

        set({ _restInterval: interval, _appStateSub: appStateSub });
      },

      stopRestTimer: () => {
        const { _restInterval, _appStateSub } = get();
        if (_restInterval) clearInterval(_restInterval);
        if (_appStateSub) _appStateSub.remove();
        set((s) => ({
          _restInterval: null,
          _appStateSub: null,
          ui: { ...s.ui, restTimer: { active: false, remaining: 0, total: 0, exerciseName: '', endAt: 0 } },
        }));
        dismissCountdownNotification().catch(() => {});
        cancelScheduledDoneNotification().catch(() => {});
      },

      // ══════════════════════════════════════════════════════════════════════
      // NAVIGATION
      // ══════════════════════════════════════════════════════════════════════

      navigate: (view) => {
        set((s) => ({ ui: { ...s.ui, view } }));
        // Delegate to React Navigation via the imperative ref
        navigateTo(view);
      },

      // ══════════════════════════════════════════════════════════════════════
      // TOAST
      // ══════════════════════════════════════════════════════════════════════

      showToast: (msg, duration = 2200, type = 'success') => {
        const id = generateId('toast');
        set((s) => ({ ui: { ...s.ui, toast: { msg, id, type } } }));
        setTimeout(() => {
          const { ui } = get();
          if (ui.toast?.id === id) {
            set((s) => ({ ui: { ...s.ui, toast: null } }));
          }
        }, duration);
      },

      // ── External file import (intent / share) ─────────────────────────────────
      // App.js calls setPendingExternalImport when the OS opens a .fitdata file.
      // AppHeader watches it and shows ImportModal so the user can choose sections.
      setPendingExternalImport: ({ rawContent, fileName }) =>
        set({ pendingExternalImport: { rawContent, fileName } }),
      clearPendingExternalImport: () =>
        set({ pendingExternalImport: null }),

      // ══════════════════════════════════════════════════════════════════════
      // EXPORT / SHARE (Native)
      // ══════════════════════════════════════════════════════════════════════

      // ── Export ────────────────────────────────────────────────────────────────

      exportFullBackup: async () => {
        const s        = get();
        const fileName = `fc-backup-${new Date().toISOString().split('T')[0]}.fitdata`;
        const json     = JSON.stringify({
          version: '2', exportType: 'full',
          exportDate: new Date().toISOString().split('T')[0],
          appName: 'Forma Fit',
          profile: s.profile,
          workoutLog: s.workoutLog,
          clientLogs: s.clientLogs ?? {},
          userPrograms: s.userPrograms,
          programs: s.programs,
          sessionTemplates: s.sessionTemplates,
          customExercises: s.customExercises,
          clients: s.clients ?? {},
        }, null, 2);

        try {
          if (Platform.OS === 'android') {
            const SAF   = FileSystem.StorageAccessFramework;
            const perms = await SAF.requestDirectoryPermissionsAsync();
            if (!perms.granted) return;
            const fileUri = await SAF.createFileAsync(
              perms.directoryUri, fileName, 'application/x-fitdata',
            );
            await FileSystem.writeAsStringAsync(fileUri, json, { encoding: FileSystem.EncodingType.UTF8 });
          } else {
            const fileUri = FileSystem.documentDirectory + fileName;
            await FileSystem.writeAsStringAsync(fileUri, json, { encoding: FileSystem.EncodingType.UTF8 });
          }
          get().showToast('Archivo exportado');
        } catch (e) {
          if (!e?.message?.includes('cancel') && !e?.message?.includes('Cancel')) {
            get().showToast('Error al exportar', 2200, 'error');
          }
        }
      },

      exportProgramWithLog: async () => {
        const s = get();
        const { profile, programs, sessionTemplates, userPrograms, customExercises, workoutLog } = s;
        const program = programs[profile.activeProgramId];
        if (!program) { get().showToast('Sin programa activo', 2200, 'error'); return; }

        const tplIds = new Set();
        if (program.stages?.length > 0) {
          program.stages.forEach((st) => st.days.forEach((d) => tplIds.add(d.sessionTemplateId)));
        } else {
          (program.days ?? []).forEach((d) => tplIds.add(d.sessionTemplateId));
        }
        const relTpl = {}, relUP = {};
        tplIds.forEach((id) => {
          if (sessionTemplates[id]) relTpl[id] = sessionTemplates[id];
          if (userPrograms[id])     relUP[id]  = userPrograms[id];
        });
        const usedExIds = new Set(
          [...Object.values(relTpl), ...Object.values(relUP)]
            .flatMap((t) => [
              ...(t.exercises ?? []).map((e) => e.exerciseId),
              ...(t.blocks ?? []).flatMap((b) => (b.movements ?? []).map((m) => m.exerciseId)),
            ])
        );
        const relCustom = {};
        Object.entries(customExercises ?? {}).forEach(([id, def]) => {
          if (usedExIds.has(id)) relCustom[id] = def;
        });

        const json = JSON.stringify({
          version: '2', exportType: 'program_with_log',
          exportDate: new Date().toISOString().split('T')[0],
          appName: 'Forma Fit',
          program: { ...program, mode: 'personal', status: 'active' },
          sessionTemplates: relTpl,
          userPrograms: relUP,
          customExercises: relCustom,
          workoutLog: workoutLog.filter((e) => tplIds.has(e.sessionTemplateId)),
        }, null, 2);

        const safeName = program.name
          .replace(/[^a-zA-Z0-9áéíóúñ\s-]/g, '')
          .replace(/\s+/g, '-').toLowerCase();
        const fileName = safeName + '-con-historial.fitdata';
        try {
          if (Platform.OS === 'android') {
            const SAF   = FileSystem.StorageAccessFramework;
            const perms = await SAF.requestDirectoryPermissionsAsync();
            if (!perms.granted) return;
            const fileUri = await SAF.createFileAsync(
              perms.directoryUri, fileName, 'application/x-fitdata',
            );
            await FileSystem.writeAsStringAsync(fileUri, json, { encoding: FileSystem.EncodingType.UTF8 });
          } else {
            const fileUri = FileSystem.documentDirectory + fileName;
            await FileSystem.writeAsStringAsync(fileUri, json, { encoding: FileSystem.EncodingType.UTF8 });
          }
          get().showToast('Archivo exportado');
        } catch (e) {
          if (!e?.message?.includes('cancel') && !e?.message?.includes('Cancel')) {
            get().showToast('Error al exportar', 2200, 'error');
          }
        }
      },

      // ── Build program JSON payload (shared helper) ──────────────────────────

      _buildProgramJson: (programId, withLog = false) => {
        const s = get();
        const { programs, sessionTemplates, userPrograms, customExercises, workoutLog } = s;
        const program = programs[programId];
        if (!program) return null;

        const tplIds = new Set();
        if (program.stages?.length > 0) {
          program.stages.forEach((st) => st.days.forEach((d) => tplIds.add(d.sessionTemplateId)));
        } else {
          (program.days ?? []).forEach((d) => tplIds.add(d.sessionTemplateId));
        }
        const relTpl = {}, relUP = {};
        tplIds.forEach((id) => {
          if (sessionTemplates[id]) relTpl[id] = sessionTemplates[id];
          if (userPrograms[id])     relUP[id]  = userPrograms[id];
        });
        const usedExIds = new Set(
          [...Object.values(relTpl), ...Object.values(relUP)]
            .flatMap((t) => [
              ...(t.exercises ?? []).map((e) => e.exerciseId),
              ...(t.blocks ?? []).flatMap((b) => (b.movements ?? []).map((m) => m.exerciseId)),
            ])
        );
        const relCustom = {};
        Object.entries(customExercises ?? {}).forEach(([id, def]) => {
          if (usedExIds.has(id)) relCustom[id] = def;
        });
        const log = withLog ? workoutLog.filter((e) => tplIds.has(e.sessionTemplateId)) : [];

        const safeName = program.name
          .replace(/[^a-zA-Z0-9áéíóúñ\s-]/g, '')
          .replace(/\s+/g, '-').toLowerCase();

        return {
          json: JSON.stringify({
            version: '2',
            exportType: withLog ? 'program_with_log' : 'program',
            exportDate: new Date().toISOString().split('T')[0],
            appName: 'Forma Fit',
            program: { ...program, mode: 'personal', status: 'active' },
            sessionTemplates: relTpl,
            userPrograms: relUP,
            customExercises: relCustom,
            workoutLog: log,
          }, null, 2),
          safeName,
          programName: program.name,
        };
      },

      // Export a program — Android: SAF (user picks folder, e.g. Downloads)
      //                    iOS: write to documentDirectory (Files app / iTunes)
      exportSpecificProgram: async (programId, withLog = false) => {
        const payload = get()._buildProgramJson(programId, withLog);
        if (!payload) return;
        const suffix   = withLog ? '-con-historial' : '';
        const fileName = payload.safeName + suffix + '.fitdata';
        try {
          if (Platform.OS === 'android') {
            const SAF   = FileSystem.StorageAccessFramework;
            const perms = await SAF.requestDirectoryPermissionsAsync();
            if (!perms.granted) return; // user cancelled picker
            const fileUri = await SAF.createFileAsync(
              perms.directoryUri, fileName, 'application/x-fitdata',
            );
            await FileSystem.writeAsStringAsync(fileUri, payload.json, {
              encoding: FileSystem.EncodingType.UTF8,
            });
          } else {
            const fileUri = FileSystem.documentDirectory + fileName;
            await FileSystem.writeAsStringAsync(fileUri, payload.json, {
              encoding: FileSystem.EncodingType.UTF8,
            });
          }
          get().showToast('Archivo exportado');
        } catch (e) {
          // ignore user-cancel from the directory picker
          if (!e?.message?.includes('cancel') && !e?.message?.includes('Cancel')) {
            get().showToast('Error al guardar', 2200, 'error');
          }
        }
      },

      // Share a program via the OS share sheet (WhatsApp, email, etc.)
      shareSpecificProgram: async (programId, withLog = false) => {
        const payload = get()._buildProgramJson(programId, withLog);
        if (!payload) return;
        const suffix = withLog ? '-con-historial' : '';
        try {
          const fileUri = FileSystem.cacheDirectory + payload.safeName + suffix + '.fitdata';
          await FileSystem.writeAsStringAsync(fileUri, payload.json, { encoding: FileSystem.EncodingType.UTF8 });
          if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(fileUri, {
              mimeType: 'application/x-fitdata',
              dialogTitle: payload.programName + (withLog ? ' + historial' : ''),
            });
          } else {
            get().showToast('Compartir no disponible', 2200, 'neutral');
          }
        } catch {
          get().showToast('Error al compartir', 2200, 'error');
        }
      },

      // ── Import ────────────────────────────────────────────────────────────────

      importData: (data, sections, { silent = false } = {}) => {
        const allFilePrograms = {
          ...(data.programs ?? {}),
          ...(data.program ? { [data.program.id]: data.program } : {}),
        };

        set((s) => {
          const updates = {};
          const needsTemplateData = sections.program || sections.clients || sections.templates;
          if (needsTemplateData) {
            updates.sessionTemplates = { ...s.sessionTemplates, ...(data.sessionTemplates ?? {}) };
            updates.userPrograms = { ...s.userPrograms, ...(data.userPrograms ?? {}) };
          }
          if (sections.program) {
            const personalPrograms = {};
            Object.entries(allFilePrograms).forEach(([id, p]) => {
              if (p.mode === 'template' || p.mode === 'managed') return;
              personalPrograms[id] = { ...p, mode: 'personal', status: 'active' };
            });
            const savedActiveId = data.profile?.activeProgramId;
            const firstId = (savedActiveId && personalPrograms[savedActiveId])
              ? savedActiveId
              : Object.keys(personalPrograms)[0] ?? null;
            updates.programs = { ...(updates.programs ?? s.programs), ...personalPrograms };
            if (firstId) {
              updates.profile = { ...s.profile, activeProgramId: firstId, onboardingCompleted: true };
            }
          }
          if (sections.templates) {
            const templatePrograms = {};
            const mode = sections.templatesMode ?? 'merge';
            Object.entries(allFilePrograms).forEach(([id, p]) => {
              if (p.mode !== 'template') return;
              templatePrograms[id] = p;
            });
            if (mode === 'replace') {
              // Remove existing templates, replace with imported ones
              const nonTemplates = {};
              Object.entries(s.programs ?? {}).forEach(([id, p]) => {
                if (p.mode !== 'template') nonTemplates[id] = p;
              });
              updates.programs = { ...(updates.programs ?? nonTemplates), ...templatePrograms };
            } else {
              updates.programs = { ...(updates.programs ?? s.programs), ...templatePrograms };
            }
          }
          if (sections.log) {
            const currentIds = new Set(s.workoutLog.map((e) => e.id));
            const newEntries = (data.workoutLog ?? []).filter((e) => !currentIds.has(e.id));
            updates.workoutLog = [...s.workoutLog, ...newEntries];
          }
          if (sections.customExercises) {
            updates.customExercises = { ...s.customExercises, ...(data.customExercises ?? {}) };
          }
          if (sections.clients) {
            updates.clients = { ...s.clients, ...(data.clients ?? {}) };
            // Restore per-client histories from backups that include them
            if (data.clientLogs && Object.keys(data.clientLogs).length) {
              const mergedLogs = { ...s.clientLogs };
              Object.entries(data.clientLogs).forEach(([cid, entries]) => {
                mergedLogs[cid] = mergeClientLog(mergedLogs[cid], entries);
              });
              updates.clientLogs = mergedLogs;
            }
          }
          // Legacy backups (pre-clientLogs) mixed client entries into workoutLog.
          // Split them out using the final clients + programs of this import.
          if (sections.log && !data.clientLogs) {
            const finalClients  = updates.clients    ?? s.clients;
            const finalPrograms = updates.programs   ?? s.programs;
            const finalLog      = updates.workoutLog ?? s.workoutLog;
            const { personalLog, clientEntries } = splitClientLogEntries(finalLog, finalClients, finalPrograms);
            if (Object.keys(clientEntries).length) {
              updates.workoutLog = personalLog;
              const mergedLogs = { ...(updates.clientLogs ?? s.clientLogs) };
              Object.entries(clientEntries).forEach(([cid, entries]) => {
                mergedLogs[cid] = mergeClientLog(mergedLogs[cid], entries);
              });
              updates.clientLogs = mergedLogs;
            }
          }
          return updates;
        });

        if (!silent) get().showToast('Importado correctamente');
        return { ok: true };
      },

      // ══════════════════════════════════════════════════════════════════════
      // GOOGLE DRIVE BACKUP
      // ══════════════════════════════════════════════════════════════════════

      /** Writes drive config (no tokens) to SecureStore so background task can read it. */
      _syncDriveConfigToSecureStore: async () => {
        const { driveBackup } = get();
        const config = {
          enabled:    driveBackup.enabled,
          frequency:  driveBackup.frequency,
          lastBackup: driveBackup.lastBackup,
          folderId:   driveBackup.folderId,
        };
        await SecureStore.setItemAsync('drive_backup_config', JSON.stringify(config));
      },

      /** Called after successful OAuth — stores tokens in SecureStore, updates state. */
      connectDrive: async (email, accessToken, refreshToken) => {
        await SecureStore.setItemAsync('drive_access_token', accessToken);
        if (refreshToken) await SecureStore.setItemAsync('drive_refresh_token', refreshToken);
        // Recover the existing backup folder (or create one if first time)
        let folderId = get().driveBackup.folderId ?? null;
        try { folderId = await findOrCreateFolder(accessToken); } catch {}
        set((s) => ({
          driveBackup: { ...s.driveBackup, enabled: true, email, needsReconnect: false, folderId },
        }));
        await get()._syncDriveConfigToSecureStore();
      },

      /** Clears all Drive state and tokens. Does NOT delete files from Drive. */
      disconnectDrive: async () => {
        await SecureStore.deleteItemAsync('drive_access_token').catch(() => {});
        await SecureStore.deleteItemAsync('drive_refresh_token').catch(() => {});
        await SecureStore.deleteItemAsync('drive_backup_config').catch(() => {});
        await SecureStore.deleteItemAsync('drive_backup_json').catch(() => {});
        await unregisterBackupTask().catch(() => {});
        set((s) => ({
          driveBackup: {
            ...s.driveBackup,
            enabled: false, email: null, folderId: null,
            lastBackup: null, lastBackupFile: null, needsReconnect: false,
          },
        }));
      },

      /** Updates backup frequency and registers / unregisters the background task. */
      setDriveFrequency: async (frequency) => {
        set((s) => ({ driveBackup: { ...s.driveBackup, frequency } }));
        await get()._syncDriveConfigToSecureStore();
        if (frequency === 'session') {
          await unregisterBackupTask().catch(() => {});
        } else {
          await registerBackupTask().catch(() => {});
        }
      },

      /** Updates the custom name prefix used for new backup filenames. */
      setDriveBackupName: (name) => {
        set((s) => ({ driveBackup: { ...s.driveBackup, backupName: name } }));
      },

      /**
       * Wraps any Drive operation with automatic token refresh on 401.
       * Usage: await get()._withDriveToken(async (token) => { ...drive calls... })
       */
      _withDriveToken: async (fn) => {
        let token = await SecureStore.getItemAsync('drive_access_token');
        if (!token) {
          set((s) => ({ driveBackup: { ...s.driveBackup, needsReconnect: true } }));
          throw new Error('Token expirado');
        }
        try {
          return await fn(token);
        } catch (e) {
          if (!e?.message?.includes('401')) throw e;
          // Token expired — try to refresh
          const refreshToken = await SecureStore.getItemAsync('drive_refresh_token');
          if (!refreshToken) {
            set((s) => ({ driveBackup: { ...s.driveBackup, needsReconnect: true } }));
            throw new Error('Token expirado');
          }
          try {
            const { access_token } = await refreshAccessToken(refreshToken, GOOGLE_ANDROID_CLIENT_ID);
            await SecureStore.setItemAsync('drive_access_token', access_token);
            return await fn(access_token); // retry with new token
          } catch {
            set((s) => ({ driveBackup: { ...s.driveBackup, needsReconnect: true } }));
            throw new Error('Token expirado');
          }
        }
      },

      /**
       * Serialises current store state and uploads it to Drive.
       * Returns { ok: true, fileName } on success, { ok: false, error } on failure.
       */
      performDriveBackup: async () => {
        const { driveBackup } = get();
        if (!driveBackup.enabled) return { ok: false, error: 'Drive no conectado' };

        const s = get();
        const json = JSON.stringify({
          version: '2', exportType: 'full',
          exportDate: new Date().toISOString().split('T')[0],
          appName: 'Forma Fit',
          profile: s.profile,
          workoutLog: s.workoutLog,
          clientLogs: s.clientLogs ?? {},
          userPrograms: s.userPrograms,
          programs: s.programs,
          sessionTemplates: s.sessionTemplates,
          customExercises: s.customExercises,
          clients: s.clients ?? {},
        }, null, 2);

        // Also persist JSON to SecureStore so the background task can reuse it
        await SecureStore.setItemAsync('drive_backup_json', json);

        try {
          const fileName = await get()._withDriveToken(async (token) => {
            const activeFolderId = driveBackup.folderId ?? (await findOrCreateFolder(token));
            const date     = new Date().toISOString().split('T')[0];
            const rawName  = driveBackup.backupName?.trim() || 'forma-backup';
            const safeName = rawName
              .toLowerCase()
              .replace(/[áàäâã]/g, 'a').replace(/[éèëê]/g, 'e')
              .replace(/[íìïî]/g, 'i').replace(/[óòöôõ]/g, 'o')
              .replace(/[úùüû]/g, 'u').replace(/ñ/g, 'n').replace(/ç/g, 'c')
              .replace(/[^a-z0-9\s-]/g, '')
              .replace(/\s+/g, '-')
              .replace(/-+/g, '-')
              .replace(/^-|-$/g, '') || 'forma-backup';
            const name = `${safeName}-${date}.fitdata`;
            await uploadBackup(token, activeFolderId, name, json);
            await pruneOldBackups(token, activeFolderId);
            const now = new Date().toISOString();
            set((s) => ({
              driveBackup: {
                ...s.driveBackup,
                lastBackup: now, lastBackupFile: name, folderId: activeFolderId,
              },
            }));
            await get()._syncDriveConfigToSecureStore();
            return name;
          });
          return { ok: true, fileName };
        } catch (e) {
          if (e?.message === 'Token expirado') return { ok: false, error: 'Token expirado' };
          return { ok: false, error: e?.message ?? 'Error desconocido' };
        }
      },

      // ══════════════════════════════════════════════════════════════════════
      // TRAINER SYNC (Supabase)
      // ══════════════════════════════════════════════════════════════════════

      /**
       * Sets the trainer sync mode and persists auth state.
       * mode: 'offline' | 'code' | 'google'
       * Payload: { code?, userId? }
       * code/userId always reset to null unless explicitly provided so that
       * switching modes never leaks stale credentials from the old mode.
       */
      setTrainerSyncMode: (mode, payload = {}) =>
        set((state) => ({
          trainerSync: {
            ...state.trainerSync,
            mode,
            code:   payload.code   ?? null,
            userId: payload.userId ?? null,
          },
        })),

      /** Updates only the userId (e.g. after session restore). */
      setTrainerSyncUserId: (userId) =>
        set((state) => ({
          trainerSync: { ...state.trainerSync, userId },
        })),

      /** Updates the trainer display name locally and syncs to all Supabase slots. */
      setTrainerName: (name) => {
        const trimmed = name?.trim() || null;
        set((state) => ({
          trainerSync: { ...state.trainerSync, trainerName: trimmed },
        }));
        // Propagate to Supabase so clients see the new name on their next sync
        const { trainerSync } = get();
        if (trainerSync.userId) {
          updateTrainerNameForSlots(trainerSync.userId, trimmed).catch(() => {});
        }
      },

      /** Resets sync mode (e.g. when switching modes). */
      resetTrainerSync: () =>
        set((state) => ({ trainerSync: { mode: null, code: null, userId: null, trainerName: state.trainerSync.trainerName } })),

      /**
       * Uploads a program to the client's Supabase slot.
       * Uses the same JSON format as the existing file export.
       */
      /**
       * Creates a Supabase slot for an existing client that was created before
       * the sync system. Assigns syncSlotId and syncCode to the client object.
       */
      connectClientToCloud: async (clientId) => {
        const { clients, trainerSync } = get();
        const client = clients[clientId];
        if (!client) throw new Error('Cliente no encontrado.');
        if (client.syncSlotId) throw new Error('Este cliente ya está conectado a la nube.');
        if (!trainerSync.userId) throw new Error('Primero configura el modo de sincronización.');

        // Ensure auth session is active — may have expired after app restart
        await _ensureTrainerSession(trainerSync);

        const { slotId, clientCode } = await createClientSlot(trainerSync.userId, client.name);

        set((s) => ({
          clients: {
            ...s.clients,
            [clientId]: { ...s.clients[clientId], syncSlotId: slotId, syncCode: clientCode },
          },
        }));
      },

      uploadProgramToClient: async (clientId, programId) => {
        const { clients, trainerSync } = get();
        const client = clients[clientId];
        if (!client?.syncSlotId) throw new Error('Este cliente no tiene slot en Supabase.');

        // Ensure auth session is active
        await _ensureTrainerSession(trainerSync);
        const payload = get()._buildProgramJson(programId, false);
        if (!payload) throw new Error('Programa no encontrado.');
        const programData   = JSON.parse(payload.json);
        const trainerName   = get().trainerSync.trainerName;
        if (trainerName?.trim()) {
          // Stamp trainerName into every session template so clients see attribution
          Object.values(programData.sessionTemplates ?? {}).forEach((tpl) => {
            tpl.trainerName = trainerName.trim();
          });
          Object.values(programData.userPrograms ?? {}).forEach((tpl) => {
            tpl.trainerName = trainerName.trim();
          });
        }
        await uploadProgram(client.syncSlotId, programData, trainerName?.trim() || null);
        // Clear pending-upload flag after successful push
        set((s) => ({
          clients: {
            ...s.clients,
            [clientId]: { ...s.clients[clientId], programDirty: false, programUploadedAt: new Date().toISOString() },
          },
        }));
      },

      // ── Next-session overrides (trainer side) ──────────────────────────────
      // A one-off prescription for the NEXT occurrence of a client's session.
      // Stored on the client; delivered to the client and consumed there later.
      setOverrideTarget: (clientId, templateId, exerciseId, patch) => {
        set((s) => {
          const client = s.clients[clientId];
          if (!client) return {};
          const overrides = { ...(client.nextOverrides ?? {}) };
          const ov = overrides[templateId] ?? {
            templateId, createdAt: new Date().toISOString(), exercises: {},
          };
          const exMap  = { ...(ov.exercises ?? {}) };
          const merged = { ...(exMap[exerciseId] ?? {}), ...patch };
          // Drop blank fields so an empty entry doesn't linger.
          Object.keys(merged).forEach((k) => {
            if (merged[k] == null || merged[k] === '') delete merged[k];
          });
          if (Object.keys(merged).length === 0) delete exMap[exerciseId];
          else exMap[exerciseId] = merged;

          if (Object.keys(exMap).length === 0) delete overrides[templateId];
          else overrides[templateId] = { ...ov, exercises: exMap };

          // overridesDirty mirrors programDirty: unsent changes to deliver.
          return { clients: { ...s.clients, [clientId]: { ...client, nextOverrides: overrides, overridesDirty: true } } };
        });
      },

      clearOverride: (clientId, templateId) => {
        set((s) => {
          const client = s.clients[clientId];
          if (!client) return {};
          return {
            clients: {
              ...s.clients,
              [clientId]: { ...client, nextOverrides: consumeOverride(client.nextOverrides, templateId), overridesDirty: true },
            },
          };
        });
      },

      /**
       * Uploads the client's next-session overrides to their slot. Re-stamps
       * createdAt to "now" so the consume baseline is the send moment (a session
       * the client did before sending doesn't count as consuming it).
       */
      sendOverrides: async (clientId) => {
        const { clients, trainerSync } = get();
        const client = clients[clientId];
        if (!client?.syncSlotId) throw new Error('Este cliente no tiene slot en Supabase.');
        await _ensureTrainerSession(trainerSync);

        const now = new Date().toISOString();
        const stamped = Object.fromEntries(
          Object.entries(client.nextOverrides ?? {}).map(([tid, ov]) => [tid, { ...ov, createdAt: now }]),
        );
        await uploadOverrides(client.syncSlotId, stamped);
        set((s) => ({
          clients: {
            ...s.clients,
            [clientId]: { ...s.clients[clientId], nextOverrides: stamped, overridesSentAt: now, overridesDirty: false },
          },
        }));
      },

      /**
       * Downloads and merges a client's workout history from Supabase.
       * Uses the existing mergeWorkoutLog logic to avoid duplicates.
       */
      downloadClientHistory: async (clientId) => {
        const { clients, trainerSync } = get();
        const client = clients[clientId];
        if (!client?.syncSlotId) throw new Error('Este cliente no tiene slot en Supabase.');

        // Ensure trainer session is active (may have expired after app restart)
        await _ensureTrainerSession(trainerSync);

        try {
          const { history, customExercises: clientCustom, updatedAt } =
            await downloadHistory(client.syncSlotId);
          if (!history?.length && !Object.keys(clientCustom ?? {}).length) {
            return { merged: 0 };
          }

          // Import any custom exercise definitions the client sent (so trainer can resolve names)
          if (clientCustom && Object.keys(clientCustom).length > 0) {
            set((s) => ({
              customExercises: { ...s.customExercises, ...clientCustom },
            }));
          }

          // Merge into this client's separated log — never into the trainer's own
          // workoutLog. Append-only by id: entries absent from the upload (client
          // deleted them, or reinstalled) are kept — this is the trainer's record.
          const existing  = get().clientLogs[clientId] ?? [];
          const merged    = mergeClientLog(existing, history);
          const newCount  = merged.length - existing.length;

          set((s) => ({
            clientLogs: { ...s.clientLogs, [clientId]: merged },
            clients: {
              ...s.clients,
              [clientId]: {
                ...s.clients[clientId],
                lastHistorySync: updatedAt,
                syncErrorAt:     null,
                ...(newCount > 0 ? { historyHasNew: true } : {}),
              },
            },
          }));

          return { merged: newCount };
        } catch (err) {
          // Record error timestamp so ClientCard can show a visual indicator
          set((s) => ({
            clients: {
              ...s.clients,
              [clientId]: {
                ...s.clients[clientId],
                syncErrorAt: new Date().toISOString(),
              },
            },
          }));
          throw err;
        }
      },

      /** Marks client history as viewed — clears badge and records current remote count as seen. */
      markHistoryViewed: (clientId) => {
        const remoteCount = get().clients[clientId]?.remoteSessionsCount ?? 0;
        set((s) => ({
          clients: {
            ...s.clients,
            [clientId]: { ...s.clients[clientId], historyHasNew: false },
          },
          trainerSync: {
            ...s.trainerSync,
            lastSeenSessionsCount: {
              ...s.trainerSync.lastSeenSessionsCount,
              [clientId]: remoteCount,
            },
          },
        }));
      },

      /**
       * Fetches all trainer slots from Supabase and updates each local client's
       * remoteSessionsCount. Lightweight — only reads sessions_count (no history JSON).
       * Called on ClientsScreen mount and pull-to-refresh.
       */
      refreshTrainerSlots: async () => {
        const { trainerSync, clients } = get();
        if (!trainerSync.userId) return;

        await _ensureTrainerSession(trainerSync);

        const slots = await getTrainerSlots(trainerSync.userId);

        // Build slotId → sessions_count map
        const countBySlot = {};
        slots.forEach((slot) => { countBySlot[slot.id] = slot.sessions_count ?? 0; });

        // Restore server slots that are missing from local state (e.g. after reinstall).
        // Only active slots (disconnected_at = null) are restored.
        const knownSlotIds = new Set(
          Object.values(clients).map((c) => c.syncSlotId).filter(Boolean),
        );
        const missingSlots = slots.filter(
          (s) => !knownSlotIds.has(s.id) && !s.disconnected_at,
        );
        if (missingSlots.length > 0) {
          set((s) => {
            const restored = { ...s.clients };
            for (const slot of missingSlots) {
              const id = generateId('client');
              restored[id] = {
                id,
                name:         slot.client_name ?? 'Cliente',
                createdAt:    new Date().toISOString().split('T')[0],
                programIds:   [],
                activeProgramId: null,
                fullName: '', phone: '', email: '', notes: '',
                bodyWeight: [], billing: [], status: 'active',
                syncCode:    slot.client_code ?? null,
                syncSlotId:  slot.id,
              };
            }
            return { clients: restored };
          });
        }

        // Update remoteSessionsCount for each matching local client
        set((s) => {
          const updated = { ...s.clients };
          Object.keys(updated).forEach((clientId) => {
            const slotId = updated[clientId].syncSlotId;
            if (slotId && countBySlot[slotId] !== undefined) {
              updated[clientId] = { ...updated[clientId], remoteSessionsCount: countBySlot[slotId] };
            }
          });
          return { clients: updated };
        });
      },

      /**
       * Validates a client code and returns slot info WITHOUT linking.
       * Used in step 1 of the modal to show "Programa encontrado".
       * Signs in anonymously first so RLS policies (auth.uid() checks) don't block the read.
       */
      validateClientCode: async (code) => {
        const { signInAnonymously } = require('../src/services/supabaseAuth');
        await signInAnonymously(); // ensure we have a Supabase session before querying
        const slot = await getSlotByClientCode(code);
        if (!slot) throw new Error('Código no encontrado. Comprueba que lo has escrito bien.');
        if (!slot.program_json) throw new Error('El entrenador aún no ha subido ningún programa.');
        return {
          slotId:           slot.id,
          programName:      slot.program_json?.program?.name ?? 'Programa',
          alreadyLinked:    !!slot.client_id,
          hasRemoteHistory: !!slot.history_updated_at,
          trainerName:      slot.trainer_name ?? null,
        };
      },

      /**
       * Links the client to a trainer slot and imports the program.
       * Flow: anonymous sign-in → link slot → import program → save state.
       *
       * @param {string}  code               The XXXX-XXXX trainer code.
       * @param {object}  [opts]
       * @param {boolean} [opts.mergeHistory] If true, download remote history and merge
       *                                      into the local workoutLog (deduplicated by id).
       */
      linkToTrainer: async (code, { mergeHistory = false } = {}) => {
        const { signInAnonymously } = require('../src/services/supabaseAuth');

        // 1. Anonymous Supabase session
        const { userId } = await signInAnonymously();

        // 2. Look up slot
        const slot = await getSlotByClientCode(code);
        if (!slot) throw new Error('Código no encontrado.');
        if (!slot.program_json) throw new Error('El entrenador aún no ha subido ningún programa.');

        // 3. Link this user (auth.uid()) to the slot via the verified RPC
        await linkClientToSlot(code);

        // 4. Save previous activeProgramId so we can restore it on unlink
        const previousActiveProgramId = get().profile.activeProgramId ?? null;

        // 5. Import the program using existing logic (same format as file export)
        get().importData(slot.program_json, { program: true, log: false }, { silent: true });

        // 6. Optionally merge remote workout history into local log
        if (mergeHistory) {
          try {
            const { history: remoteEntries, customExercises: remoteCustom } =
              await downloadHistory(slot.id);

            const localIds = new Set((get().workoutLog ?? []).map((e) => e.id));
            const newEntries = remoteEntries.filter((e) => e.id && !localIds.has(e.id));

            if (newEntries.length > 0 || Object.keys(remoteCustom ?? {}).length > 0) {
              set((s) => ({
                workoutLog: [...s.workoutLog, ...newEntries].sort(
                  (a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0),
                ),
                // Remote custom exercises fill gaps; local definitions take priority
                customExercises: { ...remoteCustom, ...s.customExercises },
              }));
            }
          } catch (err) {
            // Non-fatal — program still imported; history can be fetched manually later
            console.warn('[linkToTrainer] history merge failed:', err.message);
          }
        }

        // 7. Save client sync state
        set(() => ({
          clientSync: {
            slotId:                 slot.id,
            clientCode:             code.trim().toUpperCase(),
            supabaseUserId:         userId,
            trainerName:            slot.trainer_name ?? null,
            pendingUpload:          false,
            lastSyncedAt:           null,
            syncErrorAt:            null,
            lastProgramImportedAt:  new Date().toISOString(),
            previousActiveProgramId,
            trainerProgramIds:      [slot.program_json?.program?.id].filter(Boolean),
            linkedAt:               new Date().toISOString(),
          },
        }));

        get().showToast('Conectado con el entrenador');
      },

      /**
       * Checks whether the trainer has updated the program since the client last imported it.
       * If so, silently re-imports the new program_json.
       * Called on app startup so clients always get the latest program (e.g. new trainerName,
       * exercise changes, etc.) without having to disconnect and reconnect.
       */
      checkAndPullProgramUpdates: async () => {
        const { clientSync } = get();
        if (!clientSync.slotId) return;

        try {
          const { programJson, updatedAt, trainerName, overrides } = await downloadProgram(clientSync.slotId);

          // Always sync trainer name if it changed (independent of program updates)
          if (trainerName !== undefined && trainerName !== clientSync.trainerName) {
            set((s) => ({
              clientSync: { ...s.clientSync, trainerName: trainerName ?? null },
            }));
          }

          // Pull next-session overrides, skipping any already consumed locally
          // (a session of that template logged at/after the override was sent).
          // Independent of program updates, so handled before the early return.
          const log = get().workoutLog;
          const fresh = {};
          Object.entries(overrides ?? {}).forEach(([tid, ov]) => {
            if (overrideStatus(ov, log) !== 'consumed') fresh[tid] = ov;
          });
          set((s) => ({ clientSync: { ...s.clientSync, pendingOverrides: fresh } }));

          if (!programJson || !updatedAt) return;

          const lastImport = clientSync.lastProgramImportedAt;
          if (lastImport && new Date(updatedAt) <= new Date(lastImport)) return; // already up to date

          // Build a simple diff so the modal can show what changed
          const diff = buildProgramDiff(get(), programJson);

          // Store as pending — the user decides what to do via ProgramUpdateModal
          set((s) => ({
            clientSync: {
              ...s.clientSync,
              pendingProgramUpdate: { programJson, updatedAt, diff },
            },
          }));
        } catch {
          // Silent — network failure or RLS error; client keeps their local copy
        }
      },

      /** Apply the pending trainer program update. keepProgress=true preserves week/stage. */
      applyPendingProgramUpdate: (keepProgress) => {
        const { clientSync, programs, profile } = get();
        const pending = clientSync.pendingProgramUpdate;
        if (!pending) return;

        // Snapshot current progress before overwriting
        const oldProgram = programs[profile.activeProgramId];
        const savedProgress = keepProgress && oldProgram ? {
          currentWeek:       oldProgram.currentWeek       ?? 1,
          currentStageIndex: oldProgram.currentStageIndex ?? 0,
        } : null;

        get().importData(pending.programJson, { program: true, log: false }, { silent: true });

        // Restore progress capped to new program bounds
        if (savedProgress) {
          const newProg = get().programs[profile.activeProgramId];
          if (newProg) {
            const stageCount = newProg.stages?.length ?? 1;
            const safeStage  = Math.min(savedProgress.currentStageIndex, stageCount - 1);
            set((s) => ({
              programs: {
                ...s.programs,
                [profile.activeProgramId]: {
                  ...s.programs[profile.activeProgramId],
                  currentWeek:       savedProgress.currentWeek,
                  currentStageIndex: Math.max(0, safeStage),
                },
              },
            }));
          }
        }

        set((s) => ({
          clientSync: {
            ...s.clientSync,
            pendingProgramUpdate:  null,
            lastProgramImportedAt: new Date().toISOString(),
            // The updated program may carry a new id — keep it in upload scope
            trainerProgramIds: [...new Set([
              ...(s.clientSync.trainerProgramIds ?? []),
              ...(pending.programJson?.program?.id ? [pending.programJson.program.id] : []),
            ])],
          },
        }));
      },

      /** Dismiss the pending update without applying it (user can apply later via settings). */
      dismissPendingProgramUpdate: () => {
        set((s) => ({
          clientSync: { ...s.clientSync, pendingProgramUpdate: null },
        }));
      },

      /**
       * Uploads the client's workout history to their trainer slot.
       * Scope-filtered for privacy: only sessions of the trainer's program(s),
       * plus free sessions logged after connecting. The rest of the client's
       * personal history never leaves the device.
       * Called after each session save. Sets pendingUpload on failure.
       */
      uploadHistoryToTrainer: async () => {
        const { clientSync, workoutLog, customExercises, programs, profile } = get();
        if (!clientSync.slotId) return; // not linked to a trainer

        // Privacy-scoped slice: only trainer-program sessions + post-link free
        // sessions leave the device. Links created before trainerProgramIds
        // existed fall back to the active program (the trainer's, in the
        // standard linked flow).
        const { entries, customExercises: relevantCustom } = scopeFilterForUpload({
          workoutLog,
          programs,
          customExercises,
          trainerProgramIds:     clientSync.trainerProgramIds,
          fallbackProgramId:     profile.activeProgramId,
          linkedAt:              clientSync.linkedAt,
          lastProgramImportedAt: clientSync.lastProgramImportedAt,
        });

        try {
          await uploadHistory(clientSync.slotId, entries, relevantCustom);
          set((s) => ({
            clientSync: {
              ...s.clientSync,
              pendingUpload: false,
              lastSyncedAt:  new Date().toISOString(),
              syncErrorAt:   null,
            },
          }));
        } catch {
          set((s) => ({
            clientSync: {
              ...s.clientSync,
              pendingUpload: true,
              syncErrorAt:   new Date().toISOString(),
            },
          }));
        }
      },

      /** Disconnects the client from their trainer. */
      unlinkFromTrainer: async ({ keepProgram = false } = {}) => {
        const { clientSync, trainerSync } = get();

        // Restore previous activeProgramId if we saved one on link.
        // Skip when keepProgram=true — e.g. the user just created a new program
        // and we shouldn't overwrite it with the pre-link program.
        if (!keepProgram && clientSync.previousActiveProgramId) {
          set((s) => ({
            profile: { ...s.profile, activeProgramId: clientSync.previousActiveProgramId },
          }));
        }

        set(() => ({
          clientSync: { slotId: null, clientCode: null, supabaseUserId: null, googleLinked: false, trainerName: null, pendingUpload: false, lastSyncedAt: null, syncErrorAt: null, lastProgramImportedAt: null, previousActiveProgramId: null, trainerProgramIds: [], linkedAt: null, pendingOverrides: {} },
        }));

        // Restore trainer session automatically if we have the code
        if (trainerSync.mode === 'code' && trainerSync.code) {
          try {
            const { recoverWithTrainerCode } = require('../src/services/supabaseAuth');
            await recoverWithTrainerCode(trainerSync.code);
          } catch { /* silent — trainer can re-auth manually if needed */ }
        }
      },

      // ══════════════════════════════════════════════════════════════════════
      // CLIENT GOOGLE AUTH
      // ══════════════════════════════════════════════════════════════════════

      /**
       * Validates a Google login and finds the client's slot for auto-reconnect.
       * Signs in with Google → gets userId → queries trainer_clients by client_id.
       * Requires the RLS policy "client_can_read_own_slot" in Supabase.
       *
       * Returns { found: false } if no slot, or:
       * { found: true, slotId, userId, programName, hasRemoteHistory }
       */
      validateGoogleClient: async ({ idToken, accessToken }) => {
        const { loginWithGoogleClient } = require('../src/services/supabaseAuth');
        const { userId } = await loginWithGoogleClient({ idToken, accessToken });

        const slot = await getClientSlotByUserId(userId);
        if (!slot) return { found: false };
        if (!slot.program_json) throw new Error('Tu entrenador aún no ha subido ningún programa. Vuelve a intentarlo más tarde.');

        return {
          found:            true,
          slotId:           slot.id,
          userId,
          programName:      slot.program_json?.program?.name ?? 'Programa',
          hasRemoteHistory: !!slot.history_updated_at,
        };
      },

      /**
       * Finalizes a Google-based client reconnect on a new device.
       * Downloads the program from the slot and optionally merges remote history.
       * Called after the user confirms in the modal (confirm step).
       */
      confirmGoogleReconnect: async ({ slotId, googleUserId, mergeHistory = false }) => {
        // 1. Download program (also fetches trainer_name)
        const { programJson, trainerName } = await downloadProgram(slotId);
        if (!programJson) throw new Error('No se pudo descargar el programa.');

        // 2. Save current activeProgramId so it can be restored on disconnect
        const previousActiveProgramId = get().profile.activeProgramId ?? null;

        // 3. Import program
        get().importData(programJson, { program: true, log: false }, { silent: true });

        // 4. Optionally merge remote history (same logic as linkToTrainer)
        if (mergeHistory) {
          try {
            const { history: remoteEntries, customExercises: remoteCustom } =
              await downloadHistory(slotId);
            const localIds = new Set((get().workoutLog ?? []).map((e) => e.id));
            const newEntries = remoteEntries.filter((e) => e.id && !localIds.has(e.id));
            if (newEntries.length > 0 || Object.keys(remoteCustom ?? {}).length > 0) {
              set((s) => ({
                workoutLog: [...s.workoutLog, ...newEntries].sort(
                  (a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0),
                ),
                customExercises: { ...remoteCustom, ...s.customExercises },
              }));
            }
          } catch (err) {
            console.warn('[confirmGoogleReconnect] history merge failed:', err.message);
          }
        }

        // 5. Save client sync state
        set(() => ({
          clientSync: {
            slotId,
            clientCode:             null,   // not known in Google reconnect flow
            supabaseUserId:         googleUserId,
            googleLinked:           true,
            trainerName:            trainerName ?? null,
            pendingUpload:          false,
            lastSyncedAt:           null,
            syncErrorAt:            null,
            lastProgramImportedAt:  new Date().toISOString(),
            previousActiveProgramId,
            trainerProgramIds:      [programJson?.program?.id].filter(Boolean),
            linkedAt:               new Date().toISOString(),
          },
        }));
      },

      /**
       * Links the current anonymous client session to a Google account.
       * Flow: Google OAuth → loginWithGoogleClient → transferClientSlot (RPC) → update state.
       *
       * Must be called while the OLD anonymous session is still in memory
       * (clientSync.supabaseUserId holds the old anonymous user ID).
       * The RPC is called AS the new Google user, providing the old ID for verification.
       */
      linkGoogleForClient: async ({ idToken, accessToken }) => {
        const { clientSync } = get();
        if (!clientSync.slotId) throw new Error('No estás conectado a ningún entrenador.');

        // oldUserId must be the ID that currently owns the slot in the DB.
        // Prefer clientSync.supabaseUserId (saved when the client first connected)
        // because it always matches the DB's client_id.
        // Falling back to the live session only covers the legacy case where
        // supabaseUserId was not yet persisted (pre-migration clients).
        // Do NOT use currentUser?.id as the primary source: after a reinstall or
        // session expiry, Supabase creates a new anonymous user whose ID does not
        // match the slot's client_id → the RPC raises "slot not found or current
        // owner id does not match" on the first attempt, then the second attempt
        // silently skips the transfer (newUserId === oldUserId as Google user)
        // without actually updating the DB — leaving future reconnects broken.
        const { supabase: _sb } = require('../src/config/supabase');
        const { data: { user: currentUser } } = await _sb.auth.getUser();
        const oldUserId = clientSync.supabaseUserId ?? currentUser?.id;
        if (!oldUserId) throw new Error('No se encontró sesión activa. Reconéctate con el código del entrenador.');

        // 1. Sign in with Google — changes the Supabase session to the Google user.
        //    Depending on the Supabase project config, this may either create a new
        //    Google user OR link the Google identity to the existing anonymous account
        //    (same user ID). We handle both cases below.
        const { loginWithGoogleClient } = require('../src/services/supabaseAuth');
        const { userId: newUserId } = await loginWithGoogleClient({ idToken, accessToken });

        // 2. Transfer the slot only if Supabase issued a distinct Google user ID.
        //    If account-linking is enabled, newUserId === oldUserId and the slot
        //    already belongs to the right user — no RPC call needed.
        if (newUserId !== oldUserId) {
          // Caller is now the Google user; RPC verifies old ID matches current client_id.
          await transferClientSlot(clientSync.slotId, oldUserId, newUserId);
        }

        // 3. Update local state — slot is now owned by the Google user
        set((s) => ({
          clientSync: {
            ...s.clientSync,
            supabaseUserId: newUserId,
            googleLinked:   true,
          },
        }));
      },

      // ══════════════════════════════════════════════════════════════════════
      // REVENUECAT / PURCHASES
      // ══════════════════════════════════════════════════════════════════════

      /** Returns the Purchases instance or null if the native module isn't loaded (Expo Go). */
      _getRC: () => {
        try { return require('react-native-purchases').default; } catch { return null; }
      },

      /**
       * Fetches the current entitlements from RevenueCat and syncs isPro.
       * Call on app launch (after RC is configured) and after purchase/restore.
       */
      checkProStatus: async () => {
        const RC = get()._getRC();
        if (!RC) return get().profile.isPro;
        try {
          const info = await RC.getCustomerInfo();
          const isPro = !!info.entitlements.active[RC_PRO_ENTITLEMENT];
          set((s) => ({ profile: { ...s.profile, isPro } }));
          return isPro;
        } catch {
          return get().profile.isPro;
        }
      },

      /** Fetches the current RevenueCat offering. Returns null if unavailable. */
      getOffering: async () => {
        const RC = get()._getRC();
        if (!RC) return null;
        try {
          const offerings = await RC.getOfferings();
          return offerings.current ?? null;
        } catch {
          return null;
        }
      },

      /** Purchases a RevenueCat Package. Returns { ok, isPro } or { ok: false, cancelled, error }. */
      purchasePackage: async (pkg) => {
        const RC = get()._getRC();
        if (!RC) return { ok: false, error: 'Compras no disponibles en este entorno' };
        try {
          const { customerInfo } = await RC.purchasePackage(pkg);
          let isPro = !!customerInfo.entitlements.active[RC_PRO_ENTITLEMENT];
          // Entitlement may take a moment to propagate — re-check once after a short delay
          if (!isPro) {
            await new Promise((r) => setTimeout(r, 2000));
            isPro = await get().checkProStatus();
          }
          set((s) => ({ profile: { ...s.profile, isPro } }));
          return { ok: true, isPro };
        } catch (e) {
          if (e?.userCancelled) return { ok: false, cancelled: true };
          // Already purchased — restore entitlements instead of showing error
          if (e?.code === 'PRODUCT_ALREADY_PURCHASED') {
            const isPro = await get().restorePurchases().catch(() => false);
            return { ok: true, isPro };
          }
          return { ok: false, error: e?.message ?? 'Error al procesar la compra' };
        }
      },

      /** Restores previous purchases and syncs isPro. */
      restorePurchases: async () => {
        const RC = get()._getRC();
        if (!RC) return false;
        try {
          const info = await RC.restorePurchases();
          const isPro = !!info.entitlements.active[RC_PRO_ENTITLEMENT];
          set((s) => ({ profile: { ...s.profile, isPro } }));
          get().showToast(isPro ? 'Compra restaurada' : 'No se encontraron compras anteriores', 2200, isPro ? 'success' : 'neutral');
          return isPro;
        } catch {
          get().showToast('Error al restaurar compras', 2200, 'error');
          return false;
        }
      },

      /** Deletes all backup files from Drive and resets lastBackup metadata. */
      deleteDriveBackups: async () => {
        const { driveBackup } = get();
        const token = await SecureStore.getItemAsync('drive_access_token');
        if (!token) return;
        if (driveBackup.folderId) {
          await deleteAllBackups(token, driveBackup.folderId);
        }
        set((s) => ({
          driveBackup: { ...s.driveBackup, lastBackup: null, lastBackupFile: null },
        }));
        await get()._syncDriveConfigToSecureStore();
      },
    }),

    // ── Persist configuration ────────────────────────────────────────────────
    {
      name: 'fc_tracker_v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        profile: state.profile,
        workoutLog: state.workoutLog,
        clientLogs: state.clientLogs,
        activeSession: state.activeSession,
        userPrograms: state.userPrograms,
        customExercises: state.customExercises,
        blockPresets: state.blockPresets,
        programs: state.programs,
        sessionTemplates: state.sessionTemplates,
        clients:     state.clients,
        tagRegistry: state.tagRegistry,
        driveBackup: state.driveBackup,
        trainerSync: state.trainerSync,
        clientSync:  state.clientSync,   // persisted so the client stays connected across restarts
        theme:       state.theme,        // active UI theme
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;

        // Apply language from persisted profile
        if (state.profile?.language) {
          i18n.changeLanguage(state.profile.language);
        }

        // Clear stale active sessions (older than 12h) so the app doesn't
        // always open on WorkoutScreen after closing mid-session during testing.
        if (state.activeSession?.templateId) {
          const age = Date.now() - (state.activeSession.startedAt ?? 0);
          if (age > 12 * 60 * 60 * 1000) {
            state.activeSession = { templateId: null, setsState: {}, startedAt: null, notes: '', exerciseNotes: {}, adHocExercises: [], freeSessionName: '', blockState: {} };
          }
        }

        // Migrate: split client entries out of the personal workoutLog (one-time).
        // Runs only when clientLogs doesn't exist yet (first launch after update).
        if (!state.clientLogs) {
          state.clientLogs = {};
          const { personalLog, clientEntries } = splitClientLogEntries(
            state.workoutLog, state.clients, state.programs,
          );
          if (Object.keys(clientEntries).length) {
            state.workoutLog = personalLog;
            Object.entries(clientEntries).forEach(([cid, entries]) => {
              state.clientLogs[cid] = entries.sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0));
            });
          }
        }

        // Default the next-session overrides map on older persisted state.
        if (state.clientSync && !state.clientSync.pendingOverrides) state.clientSync.pendingOverrides = {};

        // Migrate string tags → tagRegistry IDs
        if (!state.tagRegistry) state.tagRegistry = [];
        const needsTagMigration = Object.values(state.clients ?? {}).some(
          (c) => (c.tags ?? []).some((t) => !String(t).startsWith('tag_'))
        );
        if (needsTagMigration) {
          const nameToId = {};
          Object.values(state.clients ?? {}).forEach((c) => {
            (c.tags ?? []).forEach((t) => {
              if (!String(t).startsWith('tag_') && !nameToId[t]) {
                const id = 'tag_' + Math.random().toString(36).slice(2, 10);
                state.tagRegistry.push({ id, name: String(t) });
                nameToId[t] = id;
              }
            });
          });
          Object.values(state.clients ?? {}).forEach((c) => {
            if (c.tags?.length) c.tags = c.tags.map((t) => nameToId[t] ?? t);
          });
        }

        // Migrate hex colors → CSS vars
        const HEX_TO_VAR = {
          '#e8ff47': 'var(--day1)', '#E8FF47': 'var(--day1)',
          '#ff6b35': 'var(--day2)', '#FF6B35': 'var(--day2)',
          '#7eb8ff': 'var(--day3)', '#7EB8FF': 'var(--day3)',
          '#a78bfa': 'var(--day4)', '#A78BFA': 'var(--day4)',
          '#34d399': 'var(--day5)', '#34D399': 'var(--day5)',
          '#f472b6': 'var(--day6)', '#F472B6': 'var(--day6)',
        };
        const migrateTemplates = (map) => {
          if (!map) return;
          Object.values(map).forEach((tpl) => {
            if (tpl?.color && HEX_TO_VAR[tpl.color]) tpl.color = HEX_TO_VAR[tpl.color];
          });
        };
        migrateTemplates(state.userPrograms);
        migrateTemplates(state.sessionTemplates);

        // Determine the initial screen. We set _hasHydrated + _initialRoute so
        // RootNavigator can mount the Stack with the correct initialRouteName
        // without any setTimeout / navigateTo race condition.
        const hasProgram     = state.profile?.activeProgramId && state.programs?.[state.profile.activeProgramId];
        const setupDone      = state.profile?.setupComplete;
        const onboardingDone = state.profile?.onboardingCompleted;

        let initialRoute = 'Main';
        if (!setupDone && !onboardingDone && !hasProgram) {
          initialRoute = 'Setup';
        } else if (!onboardingDone && !hasProgram) {
          initialRoute = 'Onboarding';
        } else if (state.activeSession?.templateId) {
          initialRoute = 'Workout';
        }

        useStore.setState({ _hasHydrated: true, _initialRoute: initialRoute });
      },
    }
  )
);

// ─── Selectors ─────────────────────────────────────────────────────────────────
export const selectView         = (s) => s.ui.view;
export const selectToast        = (s) => s.ui.toast;
export const selectRestTimer    = (s) => s.ui.restTimer;
export const selectActiveSession = (s) => s.activeSession;
export const selectWorkoutLog   = (s) => s.workoutLog; // sort outside the selector to avoid new-ref loop
export const selectProfile      = (s) => s.profile;
export const selectActiveProgram = (s) => s.programs[s.profile.activeProgramId];
