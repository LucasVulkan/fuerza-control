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

import { Platform } from 'react-native';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import * as FileSystem from 'expo-file-system/legacy'; // v19: legacy = readAsStringAsync, EncodingType, cacheDirectory
import * as Sharing    from 'expo-sharing';
import * as SecureStore from 'expo-secure-store';
import { uploadBackup, findOrCreateFolder, pruneOldBackups, deleteAllBackups } from '../src/services/driveService';
import { registerBackupTask, unregisterBackupTask } from '../src/tasks/driveBackupTask';
import { createClientSlot, uploadProgram, downloadHistory, getSlotByClientCode, linkClientToSlot, uploadHistory, deleteClientSlot } from '../src/services/supabaseSync';

// Shared data & utilities (resolved by Metro watchFolders)
import { EXERCISE_LIBRARY } from '../../src/data/exerciseLibrary';
import { SESSION_TEMPLATES, PROGRAMS } from '../../src/data/programs';
import { getProgression } from '../../src/utils/progression';
import { generateId } from '../../src/utils/formatters';
// Program generation — static imports (Metro no soporta dynamic import() de forma fiable)
import { findBestArchetype } from '../../src/data/archetypes';
import { adaptArchetype } from '../../src/utils/archetypeAdapter';
import { generateProgram } from '../../src/utils/programGenerator';

// Mobile i18n instance
import i18n from '../src/i18n';

// Navigation ref (wired up in App.js)
import { navigateTo } from '../src/navigation/navigationRef';

// ─── Initial state ─────────────────────────────────────────────────────────────

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
  language: 'es',
  weightUnit: 'kg',
};

const INITIAL_ACTIVE_SESSION = {
  templateId: null,
  setsState: {},
  startedAt: null,
  notes: '',
  adHocExercises: [],
};

const INITIAL_UI = {
  view: 'home',
  toast: null,
  restTimer: { active: false, remaining: 0, total: 0, exerciseName: '' },
  _editingProgramId: null,
  _viewingProgramId: null,
  homeTab: 'session',
};

// ─── Store ─────────────────────────────────────────────────────────────────────

export const useStore = create(
  persist(
    (set, get) => ({
      // ── State ──────────────────────────────────────────────────────────────
      profile: INITIAL_PROFILE,
      workoutLog: [],
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
      },

      clients: {},
      userPrograms: {},
      customExercises: {},
      _editSnapshot: null,

      // ── Trainer / client Supabase sync ────────────────────────────────────
      trainerSync: {
        mode:   null,   // null | 'offline' | 'code' | 'google'
        code:   null,   // string — trainer recovery code (only when mode === 'code')
        userId: null,   // Supabase user.id once authenticated
      },

      // ── Client sync (when user is a client connected to a trainer) ────────
      clientSync: {
        slotId:        null,  // trainer_clients row id
        clientCode:    null,  // the code the client entered
        supabaseUserId: null, // anonymous Supabase user id
        pendingUpload: false, // true when last session upload failed
      },

      // Static references (not persisted)
      exerciseLibrary: EXERCISE_LIBRARY,
      sessionTemplates: SESSION_TEMPLATES,
      programs: PROGRAMS,

      // ══════════════════════════════════════════════════════════════════════
      // PROFILE
      // ══════════════════════════════════════════════════════════════════════

      setProfile: (updates) =>
        set((state) => ({ profile: { ...state.profile, ...updates } })),

      setLanguage: (lang) => {
        set((state) => ({ profile: { ...state.profile, language: lang } }));
        i18n.changeLanguage(lang);
      },

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
          return {
            programs: next,
            workoutLog: deleteHistory
              ? s.workoutLog.filter((e) => !templateIds.has(e.sessionTemplateId))
              : s.workoutLog,
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
          return {
            clients: nextClients,
            programs: nextPrograms,
            workoutLog: s.workoutLog.filter((e) => !templateIds.has(e.sessionTemplateId)),
          };
        });
      },

      renameClient: (clientId, name) => {
        set((s) => ({
          clients: { ...s.clients, [clientId]: { ...s.clients[clientId], name: name.trim() } },
        }));
      },

      setClientActiveProgram: (clientId, programId) => {
        set((s) => ({
          clients: {
            ...s.clients,
            [clientId]: { ...s.clients[clientId], activeProgramId: programId },
          },
        }));
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
        const data = parsedData;
        const client = get().clients[clientId];
        if (!client) return;

        if (mode === 'replace') {
          if (data.program) {
            const programId = data.program.id;
            const alreadyLinked = (client.programIds ?? []).includes(programId);
            set((s) => ({
              programs: { ...s.programs, [programId]: { ...data.program, mode: 'managed', clientId } },
              sessionTemplates: { ...s.sessionTemplates, ...(data.sessionTemplates ?? {}) },
              userPrograms: { ...s.userPrograms, ...(data.userPrograms ?? {}) },
              customExercises: { ...s.customExercises, ...(data.customExercises ?? {}) },
              clients: alreadyLinked ? s.clients : {
                ...s.clients,
                [clientId]: {
                  ...s.clients[clientId],
                  programIds: [...(s.clients[clientId].programIds ?? []), programId],
                },
              },
            }));
          }
          const currentIds = new Set(get().workoutLog.map((e) => e.id));
          const newEntries = (data.workoutLog ?? []).filter((e) => !currentIds.has(e.id));
          if (newEntries.length) set((s) => ({ workoutLog: [...s.workoutLog, ...newEntries] }));
          get().showToast('✓ Programa e historial actualizados');
        } else if (mode === 'add_program') {
          if (!data.program) { get().showToast('⚠️ El archivo no contiene programa'); return; }
          const programId = data.program.id;
          set((s) => ({
            programs: { ...s.programs, [programId]: { ...data.program, mode: 'managed', clientId } },
            sessionTemplates: { ...s.sessionTemplates, ...(data.sessionTemplates ?? {}) },
            userPrograms: { ...s.userPrograms, ...(data.userPrograms ?? {}) },
            customExercises: { ...s.customExercises, ...(data.customExercises ?? {}) },
            clients: {
              ...s.clients,
              [clientId]: {
                ...s.clients[clientId],
                programIds: [...new Set([...(s.clients[clientId].programIds ?? []), programId])],
              },
            },
          }));
          get().showToast('✓ Programa añadido al cliente');
        } else if (mode === 'merge_log') {
          const currentIds = new Set(get().workoutLog.map((e) => e.id));
          const newEntries = (data.workoutLog ?? []).filter((e) => !currentIds.has(e.id));
          set((s) => ({
            workoutLog: [...s.workoutLog, ...newEntries],
            sessionTemplates: { ...s.sessionTemplates, ...(data.sessionTemplates ?? {}) },
            userPrograms: { ...s.userPrograms, ...(data.userPrograms ?? {}) },
          }));
          get().showToast(`✓ ${newEntries.length} sesiones añadidas`);
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
        const updatedExercises = template.exercises.map((ex) =>
          ex.exerciseId === exerciseId ? { ...ex, ...updates } : ex
        );
        set((s) => ({
          userPrograms: {
            ...s.userPrograms,
            [templateId]: { ...template, exercises: updatedExercises },
          },
        }));
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

      addExercise: (templateId, exerciseId) => {
        const template = get().getEffectiveTemplate(templateId);
        const { exerciseLibrary, customExercises } = get();
        const exDef = exerciseLibrary[exerciseId] ?? customExercises[exerciseId];
        if (!template || !exDef) return;
        const newExConfig = {
          exerciseId, isKey: false, sets: 3,
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
            // Add program to client's programIds list
            update.clients = {
              ...s.clients,
              [clientId]: {
                ...s.clients[clientId],
                programIds: [newProgramId, ...(s.clients[clientId]?.programIds ?? [])],
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
          activeSession: { templateId, setsState, startedAt: Date.now(), notes: '', adHocExercises: [] },
          ui: { ...get().ui, view: 'workout' },
        });
        get().navigate('workout');
      },

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
          if (existing.length === sets) return;
          changed = true;
          if (existing.length < sets) {
            setsState[exerciseId] = [
              ...existing,
              ...Array.from({ length: sets - existing.length }, emptySet),
            ];
          } else {
            setsState[exerciseId] = existing.slice(0, sets);
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
        if (!set_) return;
        const hasData = set_.weight !== '' || set_.reps !== '' || set_.time !== '';
        const nowDone = !set_.done;
        // Actualizar visualmente solo si tiene datos propios o ya estaba marcado (para desmarcar)
        if (hasData || set_.done) {
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
          const exConfig = template?.exercises?.find((e) => e.exerciseId === exerciseId);
          const restSec = exConfig?.restSec ?? exDef?.restSec ?? 90;
          get().startRestTimer(restSec, exDef?.name ?? exerciseId);
        }
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
            return { weight: lastSet.weight ?? '', reps: lastSet.reps ?? '', time: lastSet.time ?? '', done: true };
          }
          return s;
        }

        const exercises = template.exercises
          .map(({ exerciseId, sets: totalSets, minReps, maxReps, restSec }) => {
            const setsData = activeSession.setsState[exerciseId] ?? [];
            const lastExData = lastSession?.exercises.find((e) => e.exerciseId === exerciseId);
            const lastSets = lastExData?.sets ?? [];
            const resolved = setsData.map((s, i) => resolveSet(s, lastSets[i]));
            const validSets = resolved.filter((s) => s.weight !== '' || s.reps !== '' || s.time !== '' || s.done);
            if (validSets.length === 0) return null;
            return { exerciseId, sets: validSets, totalSets, minReps, maxReps, restSec };
          })
          .filter(Boolean);

        if (exercises.length === 0) return { ok: false, error: 'Sin datos registrados' };

        const logEntry = {
          id: generateId('log'),
          sessionTemplateId: activeSession.templateId,
          sessionName: template.name,
          timestamp: Date.now(),
          duration: activeSession.startedAt ? Date.now() - activeSession.startedAt : 0,
          notes: activeSession.notes ?? '',
          bodyWeight: null,
          exercises: [
            ...exercises,
            ...(activeSession.adHocExercises ?? []).map((adHoc) => ({
              exerciseId: adHoc.exerciseId, isAdHoc: true, sets: adHoc.setsState,
            })),
          ],
        };

        // Stage progress tracking
        const ownerProgramId = template?.programId;
        const ownerProgram = ownerProgramId ? programs[ownerProgramId] : null;
        let stageUpdate = null;
        if (ownerProgram?.stages?.length > 0) {
          const stageIdx = ownerProgram.currentStageIndex ?? 0;
          const stage = ownerProgram.stages[stageIdx];
          const stageTplIds = new Set((stage?.days ?? []).map((d) => d.sessionTemplateId));
          if (stageTplIds.has(activeSession.templateId) && stage) {
            const newCount = (ownerProgram.stageSessionsCompleted ?? 0) + 1;
            const threshold = stage.durationWeeks * stage.days.length;
            const isLast = stageIdx >= ownerProgram.stages.length - 1;
            stageUpdate = {
              programId: ownerProgramId,
              stageSessionsCompleted: newCount,
              stageAdvancePending: (newCount >= threshold && !isLast) || (ownerProgram.stageAdvancePending ?? false),
            };
          }
        }

        set((s) => ({
          workoutLog: [...s.workoutLog, logEntry],
          activeSession: INITIAL_ACTIVE_SESSION,
          ui: { ...s.ui, homeTab: 'session' },
          ...(stageUpdate ? {
            programs: {
              ...s.programs,
              [stageUpdate.programId]: {
                ...s.programs[stageUpdate.programId],
                stageSessionsCompleted: stageUpdate.stageSessionsCompleted,
                stageAdvancePending: stageUpdate.stageAdvancePending,
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

        return { ok: true };
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
        const { _restInterval } = get();
        if (_restInterval) clearInterval(_restInterval);

        set((s) => ({
          ui: {
            ...s.ui,
            restTimer: { active: true, remaining: seconds, total: seconds, exerciseName },
          },
        }));

        const interval = setInterval(() => {
          const { ui } = get();
          const next = ui.restTimer.remaining - 1;
          if (next <= 0) {
            clearInterval(get()._restInterval);
            set((s) => ({
              _restInterval: null,
              ui: { ...s.ui, restTimer: { ...s.ui.restTimer, active: false, remaining: 0 } },
            }));
            // Haptic feedback instead of navigator.vibrate
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            get().showToast('¡Siguiente serie!');
            return;
          }
          set((s) => ({
            ui: { ...s.ui, restTimer: { ...s.ui.restTimer, remaining: next } },
          }));
        }, 1000);

        set({ _restInterval: interval });
      },

      stopRestTimer: () => {
        const { _restInterval } = get();
        if (_restInterval) clearInterval(_restInterval);
        set((s) => ({
          _restInterval: null,
          ui: { ...s.ui, restTimer: { active: false, remaining: 0, total: 0, exerciseName: '' } },
        }));
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

      showToast: (msg, duration = 2200) => {
        const id = generateId('toast');
        set((s) => ({ ui: { ...s.ui, toast: { msg, id } } }));
        setTimeout(() => {
          const { ui } = get();
          if (ui.toast?.id === id) {
            set((s) => ({ ui: { ...s.ui, toast: null } }));
          }
        }, duration);
      },

      // ══════════════════════════════════════════════════════════════════════
      // EXPORT / SHARE (Native)
      // ══════════════════════════════════════════════════════════════════════

      // ── Export ────────────────────────────────────────────────────────────────

      exportFullBackup: async () => {
        const s        = get();
        const fileName = `fc-backup-${new Date().toISOString().split('T')[0]}.json`;
        const json     = JSON.stringify({
          version: '2', exportType: 'full',
          exportDate: new Date().toISOString().split('T')[0],
          appName: 'Forma Fit',
          profile: s.profile,
          workoutLog: s.workoutLog,
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
              perms.directoryUri, fileName, 'application/json',
            );
            await FileSystem.writeAsStringAsync(fileUri, json, { encoding: FileSystem.EncodingType.UTF8 });
          } else {
            const fileUri = FileSystem.documentDirectory + fileName;
            await FileSystem.writeAsStringAsync(fileUri, json, { encoding: FileSystem.EncodingType.UTF8 });
          }
          get().showToast('✓ Guardado: ' + fileName);
        } catch (e) {
          if (!e?.message?.includes('cancel') && !e?.message?.includes('Cancel')) {
            get().showToast('⚠️ Error al exportar');
          }
        }
      },

      exportProgramWithLog: async () => {
        const s = get();
        const { profile, programs, sessionTemplates, userPrograms, customExercises, workoutLog } = s;
        const program = programs[profile.activeProgramId];
        if (!program) { get().showToast('Sin programa activo'); return; }

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
            .flatMap((t) => (t.exercises ?? []).map((e) => e.exerciseId))
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
        const fileName = safeName + '-con-historial.json';
        try {
          if (Platform.OS === 'android') {
            const SAF   = FileSystem.StorageAccessFramework;
            const perms = await SAF.requestDirectoryPermissionsAsync();
            if (!perms.granted) return;
            const fileUri = await SAF.createFileAsync(
              perms.directoryUri, fileName, 'application/json',
            );
            await FileSystem.writeAsStringAsync(fileUri, json, { encoding: FileSystem.EncodingType.UTF8 });
          } else {
            const fileUri = FileSystem.documentDirectory + fileName;
            await FileSystem.writeAsStringAsync(fileUri, json, { encoding: FileSystem.EncodingType.UTF8 });
          }
          get().showToast('✓ Guardado: ' + fileName);
        } catch (e) {
          if (!e?.message?.includes('cancel') && !e?.message?.includes('Cancel')) {
            get().showToast('⚠️ Error al exportar');
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
            .flatMap((t) => (t.exercises ?? []).map((e) => e.exerciseId))
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
        const fileName = payload.safeName + suffix + '.json';
        try {
          if (Platform.OS === 'android') {
            const SAF   = FileSystem.StorageAccessFramework;
            const perms = await SAF.requestDirectoryPermissionsAsync();
            if (!perms.granted) return; // user cancelled picker
            const fileUri = await SAF.createFileAsync(
              perms.directoryUri, fileName, 'application/json',
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
          get().showToast('✓ Guardado: ' + fileName);
        } catch (e) {
          // ignore user-cancel from the directory picker
          if (!e?.message?.includes('cancel') && !e?.message?.includes('Cancel')) {
            get().showToast('⚠️ Error al guardar');
          }
        }
      },

      // Share a program via the OS share sheet (WhatsApp, email, etc.)
      shareSpecificProgram: async (programId, withLog = false) => {
        const payload = get()._buildProgramJson(programId, withLog);
        if (!payload) return;
        const suffix = withLog ? '-con-historial' : '';
        try {
          const fileUri = FileSystem.cacheDirectory + payload.safeName + suffix + '.json';
          await FileSystem.writeAsStringAsync(fileUri, payload.json, { encoding: FileSystem.EncodingType.UTF8 });
          if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(fileUri, {
              mimeType: 'application/json',
              dialogTitle: payload.programName + (withLog ? ' + historial' : ''),
            });
          } else {
            get().showToast('Compartir no disponible en este dispositivo');
          }
        } catch {
          get().showToast('⚠️ Error al compartir');
        }
      },

      // ── Import ────────────────────────────────────────────────────────────────

      importData: (data, sections) => {
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
            const firstId = Object.keys(personalPrograms)[0] ?? null;
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
          }
          return updates;
        });

        get().showToast('✓ Importado correctamente');
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
        set((s) => ({
          driveBackup: { ...s.driveBackup, enabled: true, email, needsReconnect: false },
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

      /**
       * Serialises current store state and uploads it to Drive.
       * Returns { ok: true, fileName } on success, { ok: false, error } on failure.
       */
      performDriveBackup: async () => {
        const { driveBackup } = get();
        if (!driveBackup.enabled) return { ok: false, error: 'Drive no conectado' };

        const token = await SecureStore.getItemAsync('drive_access_token');
        if (!token) {
          set((s) => ({ driveBackup: { ...s.driveBackup, needsReconnect: true } }));
          return { ok: false, error: 'Token expirado' };
        }

        const s = get();
        const json = JSON.stringify({
          version: '2', exportType: 'full',
          exportDate: new Date().toISOString().split('T')[0],
          appName: 'Forma Fit',
          profile: s.profile,
          workoutLog: s.workoutLog,
          userPrograms: s.userPrograms,
          programs: s.programs,
          sessionTemplates: s.sessionTemplates,
          customExercises: s.customExercises,
          clients: s.clients ?? {},
        }, null, 2);

        // Also persist JSON to SecureStore so the background task can reuse it
        await SecureStore.setItemAsync('drive_backup_json', json);

        const activeFolderId = driveBackup.folderId ?? (await findOrCreateFolder(token));
        const date     = new Date().toISOString().split('T')[0];
        const fileName = `forma-backup-${date}.json`;

        await uploadBackup(token, activeFolderId, fileName, json);
        await pruneOldBackups(token, activeFolderId);

        const now = new Date().toISOString();
        set((s) => ({
          driveBackup: {
            ...s.driveBackup,
            lastBackup: now, lastBackupFile: fileName, folderId: activeFolderId,
          },
        }));
        await get()._syncDriveConfigToSecureStore();
        return { ok: true, fileName };
      },

      // ══════════════════════════════════════════════════════════════════════
      // TRAINER SYNC (Supabase)
      // ══════════════════════════════════════════════════════════════════════

      /**
       * Sets the trainer sync mode and persists auth state.
       * mode: 'offline' | 'code' | 'google'
       * Payload: { code?, userId? }
       */
      setTrainerSyncMode: (mode, payload = {}) =>
        set((state) => ({
          trainerSync: {
            ...state.trainerSync,
            mode,
            code:   payload.code   ?? state.trainerSync.code,
            userId: payload.userId ?? state.trainerSync.userId,
          },
        })),

      /** Updates only the userId (e.g. after session restore). */
      setTrainerSyncUserId: (userId) =>
        set((state) => ({
          trainerSync: { ...state.trainerSync, userId },
        })),

      /** Resets sync mode (e.g. when switching modes). */
      resetTrainerSync: () =>
        set(() => ({ trainerSync: { mode: null, code: null, userId: null } })),

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

        const { slotId, clientCode } = await createClientSlot(trainerSync.userId, client.name);

        set((s) => ({
          clients: {
            ...s.clients,
            [clientId]: { ...s.clients[clientId], syncSlotId: slotId, syncCode: clientCode },
          },
        }));
      },

      uploadProgramToClient: async (clientId, programId) => {
        const { clients } = get();
        const client = clients[clientId];
        if (!client?.syncSlotId) throw new Error('Este cliente no tiene slot en Supabase.');
        const payload = get()._buildProgramJson(programId, false);
        if (!payload) throw new Error('Programa no encontrado.');
        await uploadProgram(client.syncSlotId, JSON.parse(payload.json));
      },

      /**
       * Downloads and merges a client's workout history from Supabase.
       * Uses the existing mergeWorkoutLog logic to avoid duplicates.
       */
      downloadClientHistory: async (clientId) => {
        const { clients } = get();
        const client = clients[clientId];
        if (!client?.syncSlotId) throw new Error('Este cliente no tiene slot en Supabase.');

        const { history, updatedAt } = await downloadHistory(client.syncSlotId);
        if (!history?.length) return { merged: 0 };

        // Merge into the trainer's local workoutLog using existing dedup logic
        const existing = get().workoutLog;
        const existingIds = new Set(existing.map((e) => e.id));
        const newEntries = history.filter((e) => !existingIds.has(e.id));

        if (newEntries.length > 0) {
          set((s) => ({
            workoutLog: [...s.workoutLog, ...newEntries]
              .sort((a, b) => b.timestamp - a.timestamp),
          }));
        }

        // Update last-sync timestamp on the client object
        set((s) => ({
          clients: {
            ...s.clients,
            [clientId]: { ...s.clients[clientId], lastHistorySync: updatedAt },
          },
        }));

        return { merged: newEntries.length };
      },

      /**
       * Validates a client code and returns slot info WITHOUT linking.
       * Used in step 1 of the modal to show "Programa encontrado".
       */
      validateClientCode: async (code) => {
        const slot = await getSlotByClientCode(code);
        if (!slot) throw new Error('Código no encontrado. Comprueba que lo has escrito bien.');
        if (!slot.program_json) throw new Error('El entrenador aún no ha subido ningún programa.');
        return {
          slotId:      slot.id,
          programName: slot.program_json?.program?.name ?? 'Programa',
          alreadyLinked: !!slot.client_id,
        };
      },

      /**
       * Links the client to a trainer slot and imports the program.
       * Flow: anonymous sign-in → link slot → import program → save state.
       */
      linkToTrainer: async (code) => {
        const { signInAnonymously } = require('../src/services/supabaseAuth');

        // 1. Anonymous Supabase session
        const { userId } = await signInAnonymously();

        // 2. Look up slot
        const slot = await getSlotByClientCode(code);
        if (!slot) throw new Error('Código no encontrado.');
        if (!slot.program_json) throw new Error('El entrenador aún no ha subido ningún programa.');

        // 3. Link userId to slot
        await linkClientToSlot(slot.id, userId);

        // 4. Save previous activeProgramId so we can restore it on unlink
        const previousActiveProgramId = get().profile.activeProgramId ?? null;

        // 5. Import the program using existing logic (same format as file export)
        get().importData(slot.program_json, { program: true, log: false });

        // 6. Save client sync state
        set(() => ({
          clientSync: {
            slotId:                slot.id,
            clientCode:            code.trim().toUpperCase(),
            supabaseUserId:        userId,
            pendingUpload:         false,
            previousActiveProgramId,
          },
        }));
      },

      /**
       * Uploads the client's full workout log to their trainer slot.
       * Called after each session save. Sets pendingUpload on failure.
       */
      uploadHistoryToTrainer: async () => {
        const { clientSync, workoutLog } = get();
        if (!clientSync.slotId) return; // not linked to a trainer

        try {
          await uploadHistory(clientSync.slotId, workoutLog);
          if (get().clientSync.pendingUpload) {
            set((s) => ({ clientSync: { ...s.clientSync, pendingUpload: false } }));
          }
        } catch {
          set((s) => ({ clientSync: { ...s.clientSync, pendingUpload: true } }));
        }
      },

      /** Disconnects the client from their trainer. */
      unlinkFromTrainer: async () => {
        const { clientSync, trainerSync } = get();

        // Restore previous activeProgramId if we saved one on link
        if (clientSync.previousActiveProgramId) {
          set((s) => ({
            profile: { ...s.profile, activeProgramId: clientSync.previousActiveProgramId },
          }));
        }

        set(() => ({
          clientSync: { slotId: null, clientCode: null, supabaseUserId: null, pendingUpload: false, previousActiveProgramId: null },
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
          const isPro = !!info.entitlements.active['pro'];
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
          const isPro = !!customerInfo.entitlements.active['pro'];
          set((s) => ({ profile: { ...s.profile, isPro } }));
          return { ok: true, isPro };
        } catch (e) {
          if (e?.userCancelled) return { ok: false, cancelled: true };
          return { ok: false, error: e?.message ?? 'Error al procesar la compra' };
        }
      },

      /** Restores previous purchases and syncs isPro. */
      restorePurchases: async () => {
        const RC = get()._getRC();
        if (!RC) return false;
        try {
          const info = await RC.restorePurchases();
          const isPro = !!info.entitlements.active['pro'];
          set((s) => ({ profile: { ...s.profile, isPro } }));
          get().showToast(isPro ? '✓ Compra restaurada' : 'No se encontraron compras anteriores');
          return isPro;
        } catch {
          get().showToast('⚠️ Error al restaurar compras');
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
        activeSession: state.activeSession,
        userPrograms: state.userPrograms,
        customExercises: state.customExercises,
        programs: state.programs,
        sessionTemplates: state.sessionTemplates,
        clients:     state.clients,
        driveBackup: state.driveBackup,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;

        // Apply language from persisted profile
        if (state.profile?.language) {
          i18n.changeLanguage(state.profile.language);
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

        // Navigate to appropriate screen after rehydration
        // (navigationRef may not be ready yet, so defer to next tick)
        const hasProgram      = state.profile?.activeProgramId && state.programs?.[state.profile.activeProgramId];
        const setupDone       = state.profile?.setupComplete;
        const onboardingDone  = state.profile?.onboardingCompleted;

        if (!setupDone && !onboardingDone && !hasProgram) {
          // Nuevo usuario — mostrar selector de idioma/unidades primero
          setTimeout(() => navigateTo('setup'), 100);
        } else if (!onboardingDone && !hasProgram) {
          // Setup hecho pero sin programa todavía
          setTimeout(() => navigateTo('onboarding'), 100);
        } else if (state.activeSession?.templateId) {
          setTimeout(() => navigateTo('workout'), 100);
        }
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
