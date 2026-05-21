/**
 * Store principal de Zustand.
 * Única fuente de verdad para toda la app.
 *
 * Estructura de slices:
 *   - profile         → datos del usuario y onboarding
 *   - workoutLog      → historial de sesiones completadas
 *   - activeSession   → sesión en curso (no se persiste hasta guardar)
 *   - ui              → estado de navegación y feedback visual
 *
 * Persistencia: se usa el middleware `persist` de Zustand con localStorage.
 * Solo se persisten `profile` y `workoutLog` (activeSession es efímero).
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { EXERCISE_LIBRARY } from '../data/exerciseLibrary';
import { SESSION_TEMPLATES, PROGRAMS } from '../data/programs';
import { getProgression } from '../utils/progression';
import { generateId } from '../utils/formatters';
import { exportFullBackup, exportProgramWithLog, downloadJSON, parseImportFile, readFileAsText } from '../utils/storage';
import i18n from '../i18n.js';

// ─── Estado inicial ───────────────────────────────────────────────────────────

const INITIAL_PROFILE = {
  name: 'Usuario',
  activeProgramId: null,
  secondaryProgramIds: [],
  onboardingAnswers: {},
  onboardingCompleted: false,
  goals: [],
  bodyWeight: null,
  theme: 'dark',
  isPro: true,  // dev: true para ver todas las features
  language: 'es',
  weightUnit: 'kg', // 'kg' | 'lb' — los pesos se almacenan siempre en kg
};

const INITIAL_ACTIVE_SESSION = {
  templateId: null,
  setsState: {},
  startedAt: null,
  notes: '',
  adHocExercises: [], // [{ exerciseId, setsState: [{weight,reps,time,done}] }]
};

const INITIAL_UI = {
  view: 'home',
  toast: null,
  restTimer: {
    active: false,
    remaining: 0,
    total: 0,
    exerciseName: '',
  },
  _editingProgramId: null,
  _viewingProgramId: null,  // programId para ver en programPrint (managed)
  homeTab: 'session',  // tab activo al volver a home
};

// ─── Store ────────────────────────────────────────────────────────────────────

export const useStore = create(
  persist(
    (set, get) => ({
      // ── Estado ──────────────────────────────────────────────────────────────
      profile: INITIAL_PROFILE,
      workoutLog: [],
      activeSession: INITIAL_ACTIVE_SESSION,
      ui: INITIAL_UI,

      // Clientes (contenedores de programas managed) — PRO FEATURE
      clients: {},            // { [clientId]: { id, name, createdAt, programIds[] } }

      // Programas y templates editados por el usuario (sobreescriben los defaults del código)
      userPrograms: {},

      // Ejercicios creados por el usuario
      customExercises: {},

      // Snapshot para cancelar ediciones en el editor de programa
      _editSnapshot: null,

      // ── Referencias estáticas (no se persisten, vienen del código) ──────────
      exerciseLibrary: EXERCISE_LIBRARY,
      sessionTemplates: SESSION_TEMPLATES,
      programs: PROGRAMS,

      // ══════════════════════════════════════════════════════════════════════
      // ACCIONES — PERFIL
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
      // ACCIONES — ONBOARDING
      // ══════════════════════════════════════════════════════════════════════

      /**
       * Genera un programa desde las respuestas del onboarding y lo activa.
       * Importación dinámica del generador para no bloquear el bundle inicial.
       */
      generateAndActivateProgram: async (answers) => {
        const { findBestArchetype } = await import('../data/archetypes');
        const { adaptArchetype } = await import('../utils/archetypeAdapter');
        const { generateProgram } = await import('../utils/programGenerator');

        // Máquinas implica cables — cualquier gym con máquinas tiene poleas
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
          ui: { ...s.ui, view: 'programSummary' },
        }));
      },

      /**
       * Archiva el programa activo (no lo elimina, lo marca como archivado).
       */
      // Archivar programa (con opción de limpiar historial)
      archiveProgram: (programId, clearHistory = false) => {
        const { programs, profile } = get();
        const program = programs[programId];
        if (!program) return;
        // Recoger templateIds de TODAS las etapas (no solo program.days = etapa actual)
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
            [programId]: {
              ...program,
              status: 'archived',
              archivedAt: new Date().toISOString().split('T')[0],
            },
          },
          workoutLog: clearHistory
            ? s.workoutLog.filter((e) => !templateIds.has(e.sessionTemplateId))
            : s.workoutLog,
          profile: wasActive
            ? { ...s.profile, activeProgramId: null }
            : s.profile,
          // No navegamos a onboarding — el usuario se queda en home
        }));
      },

      // Alias para compatibilidad
      archiveActiveProgram: () => {
        const { profile } = get();
        if (!profile.activeProgramId) return;
        get().archiveProgram(profile.activeProgramId, false);
      },

      // Restaurar un programa archivado como activo personal
      restoreProgram: (programId) => {
        const { programs, profile } = get();
        const program = programs[programId];
        if (!program) return;

        // Archivar el actual si hay uno
        const updated = { ...programs };
        if (profile.activeProgramId && profile.activeProgramId !== programId) {
          updated[profile.activeProgramId] = {
            ...updated[profile.activeProgramId],
            status: 'archived',
            archivedAt: new Date().toISOString().split('T')[0],
          };
        }
        updated[programId] = {
          ...program, status: 'active', archivedAt: null, mode: 'personal',
        };

        set((s) => ({
          programs: updated,
          profile: { ...s.profile, activeProgramId: programId, onboardingCompleted: true },
          ui: { ...s.ui, view: 'home' },
        }));
      },

      // Eliminar programa definitivamente
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
          // Limpiar programId de cualquier cliente
          const nextClients = { ...s.clients };
          Object.keys(nextClients).forEach((cid) => {
            nextClients[cid] = {
              ...nextClients[cid],
              programIds: nextClients[cid].programIds.filter((id) => id !== programId),
            };
          });
          return {
            programs: next,
            clients: nextClients,
            workoutLog: deleteHistory
              ? s.workoutLog.filter((e) => !templateIds.has(e.sessionTemplateId))
              : s.workoutLog,
          };
        });
      },

      // ══════════════════════════════════════════════════════════════════════
      // ACCIONES — CLIENTES (PRO FEATURE)
      // ══════════════════════════════════════════════════════════════════════

      createClient: (name) => {
        const id = generateId('client');
        set((s) => ({
          clients: {
            ...s.clients,
            [id]: {
              id, name: name.trim(),
              createdAt: new Date().toISOString().split('T')[0],
              programIds: [], activeProgramId: null,
              fullName: '', phone: '', email: '', notes: '',
              bodyWeight: [], billing: [],
              status: 'active',
            },
          },
        }));
        return id;
      },

      renameClient: (clientId, name) => {
        set((s) => ({
          clients: { ...s.clients, [clientId]: { ...s.clients[clientId], name: name.trim() } },
        }));
      },

      updateClientInfo: (clientId, fields) => {
        set((s) => ({
          clients: { ...s.clients, [clientId]: { ...s.clients[clientId], ...fields } },
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

      setClientActiveProgram: (clientId, programId) => {
        set((s) => ({
          clients: {
            ...s.clients,
            [clientId]: { ...s.clients[clientId], activeProgramId: programId },
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

      importForClient: async (clientId, file, mode) => {
        try {
          const text = await readFileAsText(file);
          const result = parseImportFile(text);
          if (!result.ok) { get().showToast('⚠️ ' + result.error); return; }
          const data = result.data;
          const client = get().clients[clientId];
          if (!client) return;

          if (mode === 'replace') {
            if (data.program) {
              const programId = data.program.id;
              const alreadyLinked = (client.programIds ?? []).includes(programId);
              set((s) => ({
                programs: { ...s.programs, [programId]: { ...data.program, mode: 'managed', clientId } },
                sessionTemplates: { ...s.sessionTemplates, ...data.sessionTemplates },
                userPrograms: { ...s.userPrograms, ...data.userPrograms },
                customExercises: { ...s.customExercises, ...data.customExercises },
                clients: alreadyLinked ? s.clients : {
                  ...s.clients,
                  [clientId]: { ...s.clients[clientId], programIds: [...(s.clients[clientId].programIds ?? []), programId] },
                },
              }));
            }
            const currentIds = new Set(get().workoutLog.map((e) => e.id));
            const newEntries = (data.workoutLog ?? []).filter((e) => !currentIds.has(e.id));
            if (newEntries.length) set((s) => ({ workoutLog: [...s.workoutLog, ...newEntries] }));
            get().showToast('✓ Programa e historial actualizados');
          }

          if (mode === 'add_program') {
            if (!data.program) { get().showToast('⚠️ El archivo no contiene programa'); return; }
            const programId = data.program.id;
            set((s) => ({
              programs: { ...s.programs, [programId]: { ...data.program, mode: 'managed', clientId } },
              sessionTemplates: { ...s.sessionTemplates, ...data.sessionTemplates },
              userPrograms: { ...s.userPrograms, ...data.userPrograms },
              customExercises: { ...s.customExercises, ...data.customExercises },
              clients: {
                ...s.clients,
                [clientId]: {
                  ...s.clients[clientId],
                  programIds: [...new Set([...(s.clients[clientId].programIds ?? []), programId])],
                },
              },
            }));
            get().showToast('✓ Programa añadido al cliente');
          }

          if (mode === 'merge_log') {
            const currentIds = new Set(get().workoutLog.map((e) => e.id));
            const newEntries = (data.workoutLog ?? []).filter((e) => !currentIds.has(e.id));
            set((s) => ({
              workoutLog: [...s.workoutLog, ...newEntries],
              sessionTemplates: { ...s.sessionTemplates, ...data.sessionTemplates },
              userPrograms: { ...s.userPrograms, ...data.userPrograms },
            }));
            get().showToast(`✓ ${newEntries.length} sesiones añadidas`);
          }
        } catch (e) {
          get().showToast('⚠️ Error al leer el archivo');
        }
      },

      deleteClient: (clientId, withPrograms = false) => {
        const { clients, programs } = get();
        const client = clients[clientId];
        if (!client) return;

        set((s) => {
          const nextClients = { ...s.clients };
          delete nextClients[clientId];

          if (!withPrograms) return { clients: nextClients };

          // Borrar también programas e historial del cliente
          const nextPrograms = { ...s.programs };
          const templateIds = new Set();
          (client.programIds ?? []).forEach((pid) => {
            const prog = programs[pid];
            if (prog?.stages?.length > 0) {
              prog.stages.forEach((st) => st.days.forEach((d) => templateIds.add(d.sessionTemplateId)));
            } else {
              prog?.days.forEach((d) => templateIds.add(d.sessionTemplateId));
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

      createProgramForClient: (clientId, numSessions, programName) => {
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
            emphasis: '', color: colors[i % colors.length],
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
          ui: { ...s.ui, _editingProgramId: programId, view: 'programEditor' },
        }));
      },

      /**
       * Clona un programa existente con nuevos IDs para el programa y todos sus templates.
       * Útil para instanciar plantillas con clientes o duplicar programas.
       * @param {string} sourceProgramId — ID del programa fuente
       * @param {{ mode?, clientId?, name? }} opts
       * @returns {string|null} newProgramId
       */
      cloneProgramFromTemplate: (sourceProgramId, { mode = 'personal', clientId = null, name = null } = {}) => {
        const { programs, sessionTemplates, userPrograms } = get();
        const srcProgram = programs[sourceProgramId];
        if (!srcProgram) return null;

        const newProgramId = generateId('prog');
        const newTemplates = {};

        // Clona un array de days generando nuevos IDs de template para cada sesión
        function cloneDays(days) {
          return (days ?? []).map(({ sessionTemplateId, label }) => {
            const srcTemplate = userPrograms[sessionTemplateId] ?? sessionTemplates[sessionTemplateId];
            const newTemplateId = generateId('tpl');
            newTemplates[newTemplateId] = {
              ...(srcTemplate ?? { exercises: [], emphasis: '', color: 'var(--accent)' }),
              id: newTemplateId,
              programId: newProgramId,
            };
            return { sessionTemplateId: newTemplateId, label };
          });
        }

        let newDays;
        let newStages;

        if (srcProgram.stages?.length > 0) {
          // Clonar cada etapa de forma independiente con sus propios nuevos IDs
          newStages = srcProgram.stages.map((stage) => ({
            ...stage,
            days: cloneDays(stage.days),
          }));
          // program.days queda sincronizado con la etapa activa
          const currentIdx = srcProgram.currentStageIndex ?? 0;
          newDays = newStages[currentIdx]?.days ?? cloneDays(srcProgram.days);
        } else {
          newDays = cloneDays(srcProgram.days);
        }

        const newProgram = {
          ...srcProgram,
          id: newProgramId,
          name: name ?? srcProgram.name,
          mode,
          status: 'active',
          archivedAt: null,
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
            update.clients = {
              ...s.clients,
              [clientId]: {
                ...s.clients[clientId],
                programIds: [newProgramId, ...(s.clients[clientId]?.programIds ?? [])],
              },
            };
            update.ui = { ...s.ui, _editingProgramId: newProgramId, view: 'programEditor' };
          } else if (isPersonal) {
            update.profile = { ...s.profile, activeProgramId: newProgramId, onboardingCompleted: true };
          }
          // mode === 'template': solo añade al store, sin navegación
          return update;
        });

        return newProgramId;
      },

      // Abre el editor para un programa managed específico
      setEditingProgram: (programId) => {
        set((s) => ({ ui: { ...s.ui, _editingProgramId: programId, view: 'programEditor' } }));
      },

      setPrintingProgram: (programId) => {
        set((s) => ({ ui: { ...s.ui, _viewingProgramId: programId, view: 'programPrint' } }));
      },

      // Exporta un programa managed específico (no el activo)
      // PRO FEATURE — Compartir programa por Web Share API
      shareProgram: async (programId) => {
        const s = get();
        const { programs, sessionTemplates, userPrograms } = s;
        const program = programs[programId];
        if (!program) return;

        // Recoger templates de TODAS las etapas, no solo program.days
        const allTplIds = new Set();
        if (program.stages?.length > 0) {
          program.stages.forEach((st) => st.days.forEach((d) => allTplIds.add(d.sessionTemplateId)));
        } else {
          program.days.forEach((d) => allTplIds.add(d.sessionTemplateId));
        }
        const relevantTemplates = {};
        const relevantUserPrograms = {};
        allTplIds.forEach((sessionTemplateId) => {
          if (sessionTemplates[sessionTemplateId]) relevantTemplates[sessionTemplateId] = sessionTemplates[sessionTemplateId];
          if (userPrograms[sessionTemplateId]) relevantUserPrograms[sessionTemplateId] = userPrograms[sessionTemplateId];
        });

        const json = JSON.stringify({
          version: '2', exportType: 'program',
          exportDate: new Date().toISOString().split('T')[0],
          appName: 'Fuerza & Control',
          program: { ...program, mode: 'personal', status: 'active' },
          sessionTemplates: relevantTemplates,
          userPrograms: relevantUserPrograms,
          customExercises: {},
          workoutLog: [],
        }, null, 2);

        const safeName = program.name.replace(/[^a-zA-Z0-9áéíóúñ\s-]/g, '').replace(/\s+/g, '-').toLowerCase();
        const fileName = `${safeName}.fcdata`;

        // Web Share API — usar text/plain porque application/json no está en la lista
        // de tipos permitidos por Android Chrome. El contenido JSON es idéntico.
        if (navigator.share) {
          try {
            const file = new File([json], fileName, { type: 'text/plain' });
            if (navigator.canShare?.({ files: [file] })) {
              await navigator.share({
                files: [file],
                title: program.name,
                text: 'Programa de entrenamiento — Fuerza & Control',
              });
              return;
            }
          } catch (e) {
            if (e.name === 'AbortError') return;
          }
        }

        // Fallback: descarga directa
        downloadJSON(json, program.name);
        get().showToast('↓ Archivo descargado');
      },

      exportSpecificProgram: (programId) => {
        const s = get();
        const { programs, sessionTemplates, userPrograms, customExercises } = s;
        const program = programs[programId];
        if (!program) return;

        // Recoger templates de TODAS las etapas, no solo program.days
        const allTplIds = new Set();
        if (program.stages?.length > 0) {
          program.stages.forEach((st) => st.days.forEach((d) => allTplIds.add(d.sessionTemplateId)));
        } else {
          program.days.forEach((d) => allTplIds.add(d.sessionTemplateId));
        }
        const templateIds = [...allTplIds];
        const relevantTemplates = {};
        const relevantUserPrograms = {};
        templateIds.forEach((id) => {
          if (sessionTemplates[id]) relevantTemplates[id] = sessionTemplates[id];
          if (userPrograms[id]) relevantUserPrograms[id] = userPrograms[id];
        });

        const allExerciseIds = new Set(
          templateIds.flatMap((tplId) => {
            const tpl = userPrograms[tplId] ?? sessionTemplates[tplId];
            return tpl?.exercises.map((e) => e.exerciseId) ?? [];
          })
        );
        const referencedCustom = {};
        Object.entries(customExercises ?? {}).forEach(([id, def]) => {
          if (allExerciseIds.has(id)) referencedCustom[id] = def;
        });

        const json = JSON.stringify({
          version: '2', exportDate: new Date().toISOString().split('T')[0],
          exportType: 'program', appName: 'Fuerza & Control',
          program: { ...program, mode: 'personal', status: 'active' },
          sessionTemplates: relevantTemplates,
          userPrograms: relevantUserPrograms,
          customExercises: referencedCustom,
          workoutLog: [],
        }, null, 2);

        downloadJSON(json, program.name);
      },

      // ══════════════════════════════════════════════════════════════════════
      // ACCIONES — EDITOR DE PROGRAMA
      // ══════════════════════════════════════════════════════════════════════

      /**
       * Devuelve el template efectivo para un templateId:
       * userPrograms[id] si existe, si no el default del código.
       */
      getEffectiveTemplate: (templateId) => {
        const { userPrograms, sessionTemplates } = get();
        return userPrograms[templateId] ?? sessionTemplates[templateId];
      },

      /**
       * Añade un ejercicio personalizado a la librería del usuario.
       * @param {object} exerciseDef — debe incluir al menos id y name
       */
      addCustomExercise: (exerciseDef) => {
        set((s) => ({
          customExercises: { ...s.customExercises, [exerciseDef.id]: exerciseDef },
        }));
      },

      /**
       * Elimina un ejercicio personalizado.
       */
      deleteCustomExercise: (exerciseId) => {
        set((s) => {
          const next = { ...s.customExercises };
          delete next[exerciseId];
          return { customExercises: next };
        });
      },

      /**
       * Devuelve la librería efectiva: built-in + custom exercises mezclados.
       * Custom tiene prioridad en caso de colisión (no debería ocurrir con IDs únicos).
       */
      getEffectiveLibrary: () => {
        const { exerciseLibrary, customExercises } = get();
        return { ...exerciseLibrary, ...customExercises };
      },
      /**
       * Guarda un snapshot de userPrograms al entrar al editor.
       * Permite revertir los cambios si el usuario cancela.
       */
      beginEditSession: () => {
        const { userPrograms } = get();
        // Copia profunda de las claves actuales
        set({ _editSnapshot: JSON.parse(JSON.stringify(userPrograms)) });
      },

      /**
       * Restaura userPrograms al snapshot guardado y navega a home.
       * Si no había snapshot (nunca se llamó beginEditSession), no hace nada.
       */
      cancelEditSession: (destination = 'home', homeTab = 'session') => {
        const { _editSnapshot, ui, programs } = get();
        if (_editSnapshot !== null) {
          set({ userPrograms: _editSnapshot, _editSnapshot: null });
        }
        // Determinar tab de retorno según el mode del programa en edición
        const editingProgram = ui._editingProgramId ? programs[ui._editingProgramId] : null;
        const resolvedTab = editingProgram?.mode === 'template' ? 'templates'
          : editingProgram?.mode === 'managed' ? 'clients'
          : homeTab;
        set((s) => ({ ui: { ...s.ui, _editingProgramId: null, homeTab: resolvedTab } }));
        get().navigate(destination);
      },

      confirmEditSession: (destination = 'home', homeTab = 'session') => {
        const { ui, programs } = get();
        const editingProgram = ui._editingProgramId ? programs[ui._editingProgramId] : null;
        const resolvedTab = editingProgram?.mode === 'template' ? 'templates'
          : editingProgram?.mode === 'managed' ? 'clients'
          : homeTab;
        set((s) => ({ _editSnapshot: null, ui: { ...s.ui, _editingProgramId: null, homeTab: resolvedTab } }));
        get().navigate(destination);
      },

      /**
       * Actualiza los parámetros de un ejercicio dentro de un template.
       * Guarda el template completo en userPrograms.
       * @param {string} templateId
       * @param {string} exerciseId
       * @param {object} updates — { sets, restSec, minReps, maxReps, minTime, maxTime, weightStep }
       */
      updateExerciseParams: (templateId, exerciseId, updates) => {
        const template = get().getEffectiveTemplate(templateId);
        if (!template) return;

        const updatedExercises = template.exercises.map((ex) =>
          ex.exerciseId === exerciseId ? { ...ex, ...updates } : ex
        );

        set((s) => {
          const nextUserPrograms = {
            ...s.userPrograms,
            [templateId]: { ...template, exercises: updatedExercises },
          };

          // Si hay sesión activa y cambiaron las series, redimensionar setsState
          const isActiveSession = s.activeSession.templateId === templateId;
          if (!isActiveSession || updates.sets === undefined) {
            return { userPrograms: nextUserPrograms };
          }

          const newCount = parseInt(updates.sets);
          const currentSets = s.activeSession.setsState[exerciseId] ?? [];
          let resized;
          if (newCount > currentSets.length) {
            // Añadir sets vacíos
            const extra = Array.from({ length: newCount - currentSets.length }, () => ({
              weight: '', reps: '', time: '', done: false,
            }));
            resized = [...currentSets, ...extra];
          } else {
            // Recortar (conservar los que ya tienen datos)
            resized = currentSets.slice(0, newCount);
          }

          return {
            userPrograms: nextUserPrograms,
            activeSession: {
              ...s.activeSession,
              setsState: { ...s.activeSession.setsState, [exerciseId]: resized },
            },
          };
        });
      },

      /**
       * Sustituye un ejercicio en un template por otro de la librería.
       * Mantiene sets, restSec y order del slot original.
       * @param {string} templateId
       * @param {string} oldExerciseId
       * @param {string} newExerciseId
       */
      replaceExercise: (templateId, oldExerciseId, newExerciseId) => {
        const template = get().getEffectiveTemplate(templateId);
        const newDef = EXERCISE_LIBRARY[newExerciseId];
        if (!template || !newDef) return;

        // Buscar el slot original para mantener sets y order
        const oldExConfig = template.exercises.find((e) => e.exerciseId === oldExerciseId);

        const updatedExercises = template.exercises.map((ex) => {
          if (ex.exerciseId !== oldExerciseId) return ex;
          return {
            ...ex,
            exerciseId: newExerciseId,
            restSec: newDef.restSec ?? ex.restSec,
            progressionOverride: null,
          };
        });

        set((s) => {
          const nextUserPrograms = {
            ...s.userPrograms,
            [templateId]: { ...template, exercises: updatedExercises },
          };

          // Si hay sesión activa para este template, inicializar sets del nuevo ejercicio
          const isActiveSession = s.activeSession.templateId === templateId;
          if (!isActiveSession) return { userPrograms: nextUserPrograms };

          const sets = oldExConfig?.sets ?? 3;
          const newSets = Array.from({ length: sets }, () => ({
            weight: '', reps: '', time: '', done: false,
          }));

          const nextSetsState = { ...s.activeSession.setsState };
          delete nextSetsState[oldExerciseId];
          nextSetsState[newExerciseId] = newSets;

          return {
            userPrograms: nextUserPrograms,
            activeSession: {
              ...s.activeSession,
              setsState: nextSetsState,
            },
          };
        });
      },

      /**
       * Elimina un ejercicio de un template.
       * Si hay sesión activa, también lo elimina del setsState.
       */
      removeExercise: (templateId, exerciseId) => {
        const template = get().getEffectiveTemplate(templateId);
        if (!template) return;

        const updatedExercises = template.exercises
          .filter((ex) => ex.exerciseId !== exerciseId)
          .map((ex, idx) => ({ ...ex, order: idx + 1 }));

        set((s) => {
          const nextUserPrograms = {
            ...s.userPrograms,
            [templateId]: { ...template, exercises: updatedExercises },
          };

          const isActiveSession = s.activeSession.templateId === templateId;
          if (!isActiveSession) return { userPrograms: nextUserPrograms };

          const nextSetsState = { ...s.activeSession.setsState };
          delete nextSetsState[exerciseId];

          return {
            userPrograms: nextUserPrograms,
            activeSession: { ...s.activeSession, setsState: nextSetsState },
          };
        });
      },

      /**
       * Mueve un ejercicio una posición arriba o abajo dentro de un template.
       */
      reorderExercise: (templateId, exerciseId, direction, reorderedExercises) => {
        const template = get().getEffectiveTemplate(templateId);
        if (!template) return;

        // Si viene el array completo de dnd-kit, usarlo directamente
        if (reorderedExercises) {
          set((s) => ({
            userPrograms: {
              ...s.userPrograms,
              [templateId]: { ...template, exercises: reorderedExercises },
            },
          }));
          return;
        }

        // Fallback: swap simple con dirección (para compatibilidad)
        const exercises = [...template.exercises];
        const idx = exercises.findIndex((ex) => ex.exerciseId === exerciseId);
        if (idx === -1) return;
        const newIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (newIdx < 0 || newIdx >= exercises.length) return;
        [exercises[idx], exercises[newIdx]] = [exercises[newIdx], exercises[idx]];
        const reordered = exercises.map((ex, i) => ({ ...ex, order: i + 1 }));
        set((s) => ({
          userPrograms: {
            ...s.userPrograms,
            [templateId]: { ...template, exercises: reordered },
          },
        }));
      },

      /**
       * Añade un ejercicio al final de un template.
       * Si hay sesión activa, también inicializa sus sets.
       */
      addExercise: (templateId, exerciseId) => {
        const template = get().getEffectiveTemplate(templateId);
        const { exerciseLibrary, customExercises } = get();
        const exDef = exerciseLibrary[exerciseId] ?? customExercises[exerciseId];
        if (!template || !exDef) return;

        const newExConfig = {
          exerciseId,
          isKey: false,
          sets: 3,
          restSec: exDef.restSec ?? 90,
          minReps: exDef.minReps ?? null,
          maxReps: exDef.maxReps ?? null,
          progressionOverride: null,
          limitationNote: null,
          order: template.exercises.length + 1,
        };

        const updatedExercises = [...template.exercises, newExConfig];

        set((s) => {
          const nextUserPrograms = {
            ...s.userPrograms,
            [templateId]: { ...template, exercises: updatedExercises },
          };

          const isActiveSession = s.activeSession.templateId === templateId;
          if (!isActiveSession) return { userPrograms: nextUserPrograms };

          const newSets = Array.from({ length: 3 }, () => ({
            weight: '', reps: '', time: '', done: false,
          }));

          return {
            userPrograms: nextUserPrograms,
            activeSession: {
              ...s.activeSession,
              setsState: { ...s.activeSession.setsState, [exerciseId]: newSets },
            },
          };
        });
      },

      /**
       * Resetea un template a los valores originales del código.
       */
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

      // Renombra una sesión (template)
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

      // Crea un programa vacío con N sesiones y va al editor
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
            emphasis: '', color: colors[i % colors.length],
            exercises: [],
          };
          programDays.push({ sessionTemplateId: templateId, label });
        }

        const program = {
          id: programId, name: programName, mode,
          type: 'primary', status: 'active',
          createdAt: new Date().toISOString().split('T')[0],
          currentWeek: 1,
          onboardingSnapshot: { mode: 'manual' },
          days: programDays,
        };

        const isPersonal = mode === 'personal';
        set((s) => ({
          programs: { ...s.programs, [programId]: program },
          sessionTemplates: { ...s.sessionTemplates, ...newTemplates },
          profile: isPersonal ? { ...s.profile, activeProgramId: programId, onboardingCompleted: true } : s.profile,
          ui: {
            ...s.ui,
            view: 'programEditor',
            _editingProgramId: isPersonal ? null : programId,
          },
        }));
      },

      // Añade una sesión vacía al programa (o a una etapa concreta si stageIndex != null)
      addSessionToProgram: (programId, stageIndex = null) => {
        const { programs, sessionTemplates } = get();
        const program = programs[programId];
        if (!program) return;

        const labels = ['A', 'B', 'C', 'D', 'E', 'F'];
        const colors = ['var(--day1)', 'var(--day2)', 'var(--day3)', 'var(--day4)', 'var(--day5)', 'var(--day6)'];
        const hasStages = program.stages?.length > 0;

        const targetStageIdx = hasStages
          ? (stageIndex !== null ? stageIndex : (program.currentStageIndex ?? 0))
          : null;
        const targetDays = hasStages
          ? (program.stages[targetStageIdx]?.days ?? [])
          : program.days;

        const i       = targetDays.length;
        const label   = labels[i] ?? String(i + 1);
        const color   = colors[i % colors.length];
        const tplId   = generateId('tpl');

        const newTemplate = {
          id: tplId, programId,
          label, name: `Sesión ${label}`,
          emphasis: '', color, exercises: [],
        };

        if (hasStages) {
          const newDays   = [...targetDays, { sessionTemplateId: tplId, label }];
          const newStages = program.stages.map((st, i) =>
            i === targetStageIdx ? { ...st, days: newDays } : st
          );
          const isCurrentStage = targetStageIdx === (program.currentStageIndex ?? 0);
          set((s) => ({
            sessionTemplates: { ...s.sessionTemplates, [tplId]: newTemplate },
            programs: {
              ...s.programs,
              [programId]: {
                ...program,
                stages: newStages,
                days: isCurrentStage ? newDays : program.days,
              },
            },
          }));
        } else {
          set((s) => ({
            sessionTemplates: { ...s.sessionTemplates, [tplId]: newTemplate },
            programs: {
              ...s.programs,
              [programId]: {
                ...program,
                days: [...program.days, { sessionTemplateId: tplId, label }],
              },
            },
          }));
        }
      },

      /**
       * Elimina una sesión (template) de un programa.
       * La quita de program.days y, si tiene etapas, de la etapa correspondiente.
       * También la borra de sessionTemplates y userPrograms.
       */
      removeSessionFromProgram: (programId, templateId) => {
        const { programs } = get();
        const program = programs[programId];
        if (!program) return;

        const newDays = program.days.filter((d) => d.sessionTemplateId !== templateId);
        const newStages = program.stages?.map((stage) => ({
          ...stage,
          days: stage.days.filter((d) => d.sessionTemplateId !== templateId),
        }));

        set((s) => {
          const nextSessionTemplates = { ...s.sessionTemplates };
          delete nextSessionTemplates[templateId];
          const nextUserPrograms = { ...s.userPrograms };
          delete nextUserPrograms[templateId];

          return {
            programs: {
              ...s.programs,
              [programId]: {
                ...program,
                days: newDays,
                ...(newStages ? { stages: newStages } : {}),
              },
            },
            sessionTemplates: nextSessionTemplates,
            userPrograms: nextUserPrograms,
          };
        });
      },

      // ══════════════════════════════════════════════════════════════════════
      // ACCIONES — ETAPAS DE PROGRAMA (PRO FEATURE)
      // ══════════════════════════════════════════════════════════════════════

      /**
       * Añade una nueva etapa al programa.
       * Si el programa no tenía etapas, convierte las sessions actuales en "Etapa 1"
       * y crea la nueva etapa clonando esas sesiones con nuevos IDs.
       * PRO FEATURE: la restricción la aplica la UI, no la acción.
       */
      addStageToProgram: (programId, stageName = null, durationWeeks = 4) => {
        const { programs, sessionTemplates, userPrograms } = get();
        const program = programs[programId];
        if (!program) return;

        const hasStages = program.stages?.length > 0;
        const existingStages = program.stages ?? [];
        let updatedStages;
        const updatedSessionTemplates = { ...sessionTemplates };

        function cloneDays(sourceDays) {
          const newDays = [];
          sourceDays.forEach(({ sessionTemplateId, label }) => {
            const src = userPrograms[sessionTemplateId] ?? sessionTemplates[sessionTemplateId];
            const newTplId = generateId('tpl');
            updatedSessionTemplates[newTplId] = {
              ...(src ?? { exercises: [], emphasis: '', color: 'var(--accent)' }),
              id: newTplId,
              programId,
            };
            newDays.push({ sessionTemplateId: newTplId, label });
          });
          return newDays;
        }

        if (!hasStages) {
          // Primera vez: envuelve el programa actual como "Etapa 1"
          const stage1 = {
            id: generateId('stage'),
            name: 'Etapa 1',
            durationWeeks: 4,
            days: program.days,
          };
          const newStageDays = cloneDays(program.days);
          const newStage = {
            id: generateId('stage'),
            name: stageName ?? 'Etapa 2',
            durationWeeks,
            days: newStageDays,
          };
          updatedStages = [stage1, newStage];
        } else {
          // Clonar la última etapa
          const lastStage = existingStages[existingStages.length - 1];
          const newStageDays = cloneDays(lastStage.days);
          const newStage = {
            id: generateId('stage'),
            name: stageName ?? `Etapa ${existingStages.length + 1}`,
            durationWeeks,
            days: newStageDays,
          };
          updatedStages = [...existingStages, newStage];
        }

        set((s) => ({
          sessionTemplates: updatedSessionTemplates,
          programs: {
            ...s.programs,
            [programId]: {
              ...program,
              stages: updatedStages,
              currentStageIndex: program.currentStageIndex ?? 0,
              stageSessionsCompleted: program.stageSessionsCompleted ?? 0,
              stageAdvancePending: program.stageAdvancePending ?? false,
              // days sigue apuntando a la etapa activa actual
            },
          },
        }));
      },

      /** Actualiza nombre y/o duración de una etapa concreta. */
      updateStage: (programId, stageIndex, updates) => {
        const { programs } = get();
        const program = programs[programId];
        if (!program?.stages) return;
        const newStages = program.stages.map((st, i) =>
          i === stageIndex ? { ...st, ...updates } : st
        );
        set((s) => ({
          programs: { ...s.programs, [programId]: { ...program, stages: newStages } },
        }));
      },

      /**
       * Elimina una etapa del programa.
       * Si queda solo 1 etapa, colapsa el programa a no-staged.
       */
      removeStageFromProgram: (programId, stageIndex) => {
        const { programs } = get();
        const program = programs[programId];
        if (!program?.stages || program.stages.length <= 1) return;

        const newStages = program.stages.filter((_, i) => i !== stageIndex);
        const currentIdx = program.currentStageIndex ?? 0;
        const newCurrentIdx = stageIndex <= currentIdx ? Math.max(0, currentIdx - 1) : currentIdx;

        if (newStages.length === 1) {
          // Colapsar a programa sin etapas
          const { stages: _s, currentStageIndex: _csi, stageSessionsCompleted: _ssc, stageAdvancePending: _sap, ...rest } = program;
          set((s) => ({
            programs: {
              ...s.programs,
              [programId]: { ...rest, days: newStages[0].days },
            },
          }));
        } else {
          set((s) => ({
            programs: {
              ...s.programs,
              [programId]: {
                ...program,
                stages: newStages,
                currentStageIndex: newCurrentIdx,
                days: newStages[newCurrentIdx].days,
                stageSessionsCompleted: 0,
                stageAdvancePending: false,
              },
            },
          }));
        }
      },

      /**
       * Avanza a la siguiente etapa (auto o manual).
       * Sincroniza program.days con la nueva etapa y reinicia el contador.
       */
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

      /**
       * Cambia manualmente a cualquier etapa.
       * Reinicia el contador de sesiones completadas.
       */
      setCurrentStage: (programId, stageIndex) => {
        const { programs } = get();
        const program = programs[programId];
        if (!program?.stages?.length) return;
        if (stageIndex < 0 || stageIndex >= program.stages.length) return;
        const targetStage = program.stages[stageIndex];
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

      /** Descarta el banner de avance de etapa sin cambiar de etapa. */
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

      // ══════════════════════════════════════════════════════════════════════
      // ACCIONES — SESIÓN ACTIVA
      // ══════════════════════════════════════════════════════════════════════

      /**
       * Inicia una nueva sesión a partir de un templateId.
       * Inicializa el estado de sets vacío para cada ejercicio.
       */
      startSession: (templateId) => {
        // Usar getEffectiveTemplate para respetar ediciones del usuario
        const template = get().getEffectiveTemplate(templateId);
        if (!template) return;

        const setsState = {};
        template.exercises.forEach(({ exerciseId, sets }) => {
          setsState[exerciseId] = Array.from({ length: sets }, () => ({
            weight: '',
            reps: '',
            time: '',
            done: false,
          }));
        });

        set({
          activeSession: {
            templateId,
            setsState,
            startedAt: Date.now(),
          },
          ui: { ...get().ui, view: 'workout' },
        });
      },

      toggleSetDone: (exerciseId, setIndex) => {
        const { activeSession, exerciseLibrary, customExercises } = get();
        const sets = activeSession.setsState[exerciseId] ?? [];
        const set_ = sets[setIndex];
        if (!set_) return;

        const nowDone = !set_.done;
        const updatedSets = sets.map((s, i) =>
          i === setIndex ? { ...s, done: nowDone } : s
        );

        set((s) => ({
          activeSession: {
            ...s.activeSession,
            setsState: { ...s.activeSession.setsState, [exerciseId]: updatedSets },
          },
        }));

        if (nowDone) {
          const exDef = exerciseLibrary[exerciseId] ?? customExercises?.[exerciseId];
          // Leer restSec del template efectivo (donde están las ediciones del usuario)
          // antes de caer al valor de la librería estática
          const template = activeSession.templateId ? get().getEffectiveTemplate(activeSession.templateId) : null;
          const exConfig = template?.exercises?.find((e) => e.exerciseId === exerciseId);
          const restSec = exConfig?.restSec ?? exDef?.restSec ?? 90;
          get().startRestTimer(restSec, exDef?.name ?? exerciseId);
        }
      },

      /** Actualiza el valor de un campo (weight/reps/time) en un set concreto. */
      updateSetField: (exerciseId, setIndex, field, value) => {
        const { activeSession } = get();
        const sets = activeSession.setsState[exerciseId] ?? [];
        const updatedSets = sets.map((s, i) =>
          i === setIndex ? { ...s, [field]: value } : s
        );

        set((s) => ({
          activeSession: {
            ...s.activeSession,
            setsState: { ...s.activeSession.setsState, [exerciseId]: updatedSets },
          },
        }));
      },

      /**
       * Obtiene la recomendación de progresión para un ejercicio.
       */
      getProgressionRecommendation: (templateId, exerciseId) => {
        const { getEffectiveTemplate, exerciseLibrary, getLastSession } = get();
        const template = getEffectiveTemplate(templateId);
        if (!template) return null;

        const exConfig = template.exercises.find((e) => e.exerciseId === exerciseId);
        if (!exConfig) return null;

        const exDef = exerciseLibrary[exerciseId];
        const customExercises = get().customExercises;
        const baseDef = exDef ?? customExercises[exerciseId];
        if (!baseDef) return null;

        // El exConfig puede sobreescribir el progressionModel (custom exercises)
        const effectiveDef = exConfig.progressionModel
          ? { ...baseDef, progressionModel: exConfig.progressionModel }
          : baseDef;

        const lastSession = getLastSession(templateId);
        if (!lastSession) return null;

        const lastExercise = lastSession.exercises?.find((e) => e.exerciseId === exerciseId);
        if (!lastExercise) return null;

        return getProgression(effectiveDef, lastExercise.sets, exConfig.sets);
      },

      /**
       * Guarda la sesión activa en el historial.
       */
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
          const current = s.activeSession.adHocExercises ?? [];
          return {
            activeSession: {
              ...s.activeSession,
              adHocExercises: [
                ...current,
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
                setsState: ex.setsState.map((set, i) => i === setIdx ? { ...set, [field]: value } : set),
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
                setsState: ex.setsState.map((set, i) => i === setIdx ? { ...set, done: !set.done } : set),
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

      // Añade una serie extra a un ejercicio del programa durante la sesión activa
      addSetToSession: (exerciseId) => {
        set((s) => {
          const current = s.activeSession.setsState[exerciseId] ?? [];
          // Pre-rellena el peso de la última serie como punto de partida
          const lastSet = current[current.length - 1] ?? {};
          const newSet  = { weight: lastSet.weight ?? '', reps: '', time: '', done: false };
          return {
            activeSession: {
              ...s.activeSession,
              setsState: {
                ...s.activeSession.setsState,
                [exerciseId]: [...current, newSet],
              },
            },
          };
        });
      },

      saveSession: () => {
        const { activeSession, getEffectiveTemplate, workoutLog, programs } = get();
        if (!activeSession.templateId) return { ok: false, error: 'No hay sesión activa' };

        const template = getEffectiveTemplate(activeSession.templateId);
        if (!template) return { ok: false, error: 'Template no encontrado' };

        // Última sesión del mismo template para usar como fallback de sets marcados sin datos
        const lastSession = [...workoutLog]
          .filter((e) => e.sessionTemplateId === activeSession.templateId)
          .sort((a, b) => b.timestamp - a.timestamp)[0] ?? null;

        function resolveSet(set, lastSet) {
          // Si tiene datos escritos, usar tal cual
          if (set.weight !== '' || set.reps !== '' || set.time !== '') return set;
          // Si está marcado ✓ pero vacío, usar los valores del último día como fallback
          if (set.done && lastSet) {
            return {
              weight: lastSet.weight ?? '',
              reps:   lastSet.reps   ?? '',
              time:   lastSet.time   ?? '',
              done:   true,
            };
          }
          return set;
        }

        // Filtrar solo ejercicios con al menos un set con datos o marcado con fallback
        const exercises = template.exercises
          .map(({ exerciseId, sets: totalSets, minReps, maxReps, restSec }) => {
            const setsData   = activeSession.setsState[exerciseId] ?? [];
            const lastExData = lastSession?.exercises.find((e) => e.exerciseId === exerciseId);
            const lastSets   = lastExData?.sets ?? [];

            const resolved = setsData.map((s, i) => resolveSet(s, lastSets[i]));
            const validSets = resolved.filter(
              (s) => s.weight !== '' || s.reps !== '' || s.time !== '' || s.done
            );
            if (validSets.length === 0) return null;
            return { exerciseId, sets: validSets, totalSets, minReps, maxReps, restSec };
          })
          .filter(Boolean);

        if (exercises.length === 0) {
          return { ok: false, error: 'Sin datos registrados' };
        }

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
              exerciseId: adHoc.exerciseId,
              isAdHoc: true,
              sets: adHoc.setsState,
            })),
          ],
        };

        // Tracking de progreso de etapa
        const ownerProgramId = template?.programId;
        const ownerProgram   = ownerProgramId ? programs[ownerProgramId] : null;
        let stageUpdate = null;

        if (ownerProgram?.stages?.length > 0) {
          const stageIdx = ownerProgram.currentStageIndex ?? 0;
          const stage    = ownerProgram.stages[stageIdx];
          const stageTplIds = new Set((stage?.days ?? []).map((d) => d.sessionTemplateId));

          if (stageTplIds.has(activeSession.templateId) && stage) {
            const newCount  = (ownerProgram.stageSessionsCompleted ?? 0) + 1;
            const threshold = stage.durationWeeks * stage.days.length;
            const isLast    = stageIdx >= ownerProgram.stages.length - 1;
            stageUpdate = {
              programId: ownerProgramId,
              stageSessionsCompleted: newCount,
              stageAdvancePending: (newCount >= threshold && !isLast)
                || (ownerProgram.stageAdvancePending ?? false),
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
                stageAdvancePending:    stageUpdate.stageAdvancePending,
              },
            },
          } : {}),
        }));

        get().stopRestTimer();
        return { ok: true };
      },

      /** Descarta la sesión activa sin guardar. */
      discardSession: () => {
        get().stopRestTimer();
        set({ activeSession: INITIAL_ACTIVE_SESSION });
        get().navigate('home');
      },

      // ══════════════════════════════════════════════════════════════════════
      // ACCIONES — HISTORIAL
      // ══════════════════════════════════════════════════════════════════════

      deleteLogEntry: (logId) =>
        set((state) => ({
          workoutLog: state.workoutLog.filter((e) => e.id !== logId),
        })),

      /**
       * Obtiene la última sesión completada para un templateId dado.
       * @param {string} templateId
       * @returns {object|null}
       */
      getLastSession: (templateId) => {
        const { workoutLog } = get();
        return (
          workoutLog
            .filter((e) => e.sessionTemplateId === templateId)
            .sort((a, b) => b.timestamp - a.timestamp)[0] ?? null
        );
      },

      /**
       * Obtiene los últimos N logs de un ejercicio concreto (para stats).
       * @param {string} exerciseId
       * @param {number} limit
       */
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
      // ACCIONES — REST TIMER
      // ══════════════════════════════════════════════════════════════════════

      startRestTimer: (seconds, exerciseName) => {
        // Limpiamos cualquier interval previo
        const { _restInterval } = get();
        if (_restInterval) clearInterval(_restInterval);

        set((s) => ({
          ui: {
            ...s.ui,
            restTimer: {
              active: true,
              remaining: seconds,
              total: seconds,
              exerciseName,
            },
          },
        }));

        const interval = setInterval(() => {
          const { ui } = get();
          const next = ui.restTimer.remaining - 1;

          if (next <= 0) {
            clearInterval(get()._restInterval);
            set((s) => ({
              _restInterval: null,
              ui: {
                ...s.ui,
                restTimer: { ...s.ui.restTimer, active: false, remaining: 0 },
              },
            }));
            if ('vibrate' in navigator) navigator.vibrate([200, 100, 200]);
            get().showToast('¡Siguiente serie!');
            return;
          }

          set((s) => ({
            ui: {
              ...s.ui,
              restTimer: { ...s.ui.restTimer, remaining: next },
            },
          }));
        }, 1000);

        set({ _restInterval: interval });
      },

      stopRestTimer: () => {
        const { _restInterval } = get();
        if (_restInterval) clearInterval(_restInterval);
        set((s) => ({
          _restInterval: null,
          ui: {
            ...s.ui,
            restTimer: { active: false, remaining: 0, total: 0, exerciseName: '' },
          },
        }));
      },

      // ══════════════════════════════════════════════════════════════════════
      // ACCIONES — NAVEGACIÓN
      // ══════════════════════════════════════════════════════════════════════

      navigate: (view) => {
        set((s) => ({ ui: { ...s.ui, view } }));
        window.scrollTo(0, 0);
      },

      // ══════════════════════════════════════════════════════════════════════
      // ACCIONES — TOAST
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
      // ACCIONES — EXPORTAR / IMPORTAR
      // ══════════════════════════════════════════════════════════════════════

      // Exportar backup completo (programa + historial + clientes PRO + plantillas PRO)
      exportFullBackup: () => {
        const s = get();
        const json = exportFullBackup(s);
        downloadJSON(json, 'fc-backup');
      },

      // Exportar programa activo + su historial (para devolver al entrenador)
      exportProgramWithLog: () => {
        const s = get();
        const json = exportProgramWithLog(s);
        if (!json) { get().showToast('Sin programa activo'); return; }
        const name = s.programs[s.profile.activeProgramId]?.name ?? 'programa';
        downloadJSON(json, name);
      },

      /**
       * Importa datos ya parseados según las secciones seleccionadas por el usuario.
       * @param {object} data — resultado de parseImportFile (ya parseado en el modal)
       * @param {object} sections — { program, log, customExercises, clients, templates, templatesMode }
       */
      importData: (data, sections) => {
        const allFilePrograms = {
          ...(data.programs ?? {}),
          ...(data.program ? { [data.program.id]: data.program } : {}),
        };

        set((s) => {
          const updates = {};

          // sessionTemplates y userPrograms se necesitan para cualquier programa importado
          const needsTemplateData = sections.program || sections.clients || sections.templates;
          if (needsTemplateData) {
            updates.sessionTemplates = { ...s.sessionTemplates, ...(data.sessionTemplates ?? {}) };
            updates.userPrograms = { ...s.userPrograms, ...(data.userPrograms ?? {}) };
          }

          if (sections.program) {
            const personalPrograms = {};
            // Templates del archivo (sessionTemplates + userPrograms) para poder remapear
            const fileTplMap = { ...(data.sessionTemplates ?? {}), ...(data.userPrograms ?? {}) };

            Object.entries(allFilePrograms).forEach(([id, p]) => {
              if (p.mode === 'template' || p.mode === 'managed') return;

              const existingMode = s.programs[id]?.mode;
              // Solo proteger plantillas: importar sobre managed está permitido
              // (es exactamente el flujo de retorno cliente→entrenador con mismo ID)
              const conflictsWithProtected = existingMode === 'template';

              if (conflictsWithProtected) {
                // El ID ya pertenece a una plantilla/managed → clonar con nuevos IDs
                // para no pisar nunca la plantilla original.
                const newProgId = generateId('prog');
                const remappedTpls = {};

                const remapDays = (days) =>
                  (days ?? []).map(({ sessionTemplateId, label }) => {
                    const newTplId = generateId('tpl');
                    const src = fileTplMap[sessionTemplateId];
                    if (src) remappedTpls[newTplId] = { ...src, id: newTplId, programId: newProgId };
                    return { sessionTemplateId: newTplId, label };
                  });

                if (p.stages?.length > 0) {
                  // Remapear cada etapa y sincronizar program.days con la etapa activa
                  const newStages = p.stages.map((st) => ({ ...st, days: remapDays(st.days) }));
                  const currentIdx = p.currentStageIndex ?? 0;
                  personalPrograms[newProgId] = {
                    ...p, id: newProgId, mode: 'personal', status: 'active',
                    stages: newStages,
                    days: newStages[currentIdx]?.days ?? [],
                  };
                } else {
                  personalPrograms[newProgId] = {
                    ...p, id: newProgId, mode: 'personal', status: 'active',
                    days: remapDays(p.days),
                  };
                }

                // Añadir los templates remapeados al store
                updates.sessionTemplates = {
                  ...(updates.sessionTemplates ?? s.sessionTemplates),
                  ...remappedTpls,
                };
              } else {
                personalPrograms[id] = { ...p, mode: 'personal', status: 'active' };
              }
            });

            const firstId = Object.keys(personalPrograms)[0] ?? null;
            updates.programs = { ...(updates.programs ?? s.programs), ...personalPrograms };
            if (firstId) {
              updates.profile = {
                ...s.profile,
                activeProgramId: firstId,
                onboardingCompleted: true,
              };
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
            const managedPrograms = {};
            Object.entries(allFilePrograms).forEach(([id, p]) => {
              if (p.mode === 'managed') managedPrograms[id] = p;
            });
            updates.clients = { ...(s.clients ?? {}), ...(data.clients ?? {}) };
            updates.programs = { ...(updates.programs ?? s.programs), ...managedPrograms };
          }

          if (sections.templates) {
            const templateProgs = {};
            Object.entries(allFilePrograms).forEach(([id, p]) => {
              if (p.mode === 'template') templateProgs[id] = p;
            });
            const base = updates.programs ?? s.programs;
            if (sections.templatesMode === 'replace') {
              const withoutTemplates = Object.fromEntries(
                Object.entries(base).filter(([, p]) => p.mode !== 'template')
              );
              updates.programs = { ...withoutTemplates, ...templateProgs };
            } else {
              updates.programs = { ...base, ...templateProgs };
            }
          }

          return updates;
        });

        get().showToast('✓ Importado correctamente');
        return { ok: true };
      },
    }),

    // ── Configuración de persist ────────────────────────────────────────────
    {
      name: 'fc_tracker_v1',
      storage: createJSONStorage(() => localStorage),
      // Persistimos profile, workoutLog y activeSession
      // activeSession permite recuperar una sesión en progreso si se cierra la app
      partialize: (state) => ({
        profile: state.profile,
        workoutLog: state.workoutLog,
        activeSession: state.activeSession,
        userPrograms: state.userPrograms,
        customExercises: state.customExercises,
        programs: state.programs,
        sessionTemplates: state.sessionTemplates,
        clients: state.clients,
      }),
      // Al rehidratar: si hay sesión en progreso, navegar a workout automáticamente
      onRehydrateStorage: () => (state) => {
        if (!state) return;

        // Migración: normaliza colores hex hardcodeados → CSS vars en templates almacenados
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

        const hasProgram = state.profile?.activeProgramId && state.programs?.[state.profile.activeProgramId];
        if (!state.profile?.onboardingCompleted && !hasProgram) {
          state.ui = { ...INITIAL_UI, view: 'onboarding' };
        } else if (state.activeSession?.templateId) {
          state.ui = { ...state.ui, view: 'workout' };
        }
      },
    }
  )
);

// ─── Selectores atómicos (para evitar re-renders innecesarios) ────────────────

/** Vista activa */
export const selectView = (s) => s.ui.view;

/** Toast activo */
export const selectToast = (s) => s.ui.toast;

/** Estado del rest timer */
export const selectRestTimer = (s) => s.ui.restTimer;

/** Sesión activa completa */
export const selectActiveSession = (s) => s.activeSession;

/** Sets de un ejercicio concreto en la sesión activa */
export const selectExerciseSets = (exerciseId) => (s) =>
  s.activeSession.setsState[exerciseId] ?? [];

/** Historial ordenado de más reciente a más antiguo */
export const selectWorkoutLog = (s) =>
  [...s.workoutLog].sort((a, b) => b.timestamp - a.timestamp);

/** Perfil del usuario */
export const selectProfile = (s) => s.profile;

/** Programa activo */
export const selectActiveProgram = (s) => s.programs[s.profile.activeProgramId];

/** Programas archivados */
export const selectArchivedPrograms = (s) =>
  Object.values(s.programs ?? {})
    .filter((p) => p.status === 'archived')
    .sort((a, b) => (b.archivedAt ?? '').localeCompare(a.archivedAt ?? ''));

/** Programas de clientes (managed) — PRO FEATURE */
export const selectManagedPrograms = (s) =>
  Object.values(s.programs ?? {})
    .filter((p) => p.mode === 'managed' && p.status !== 'archived')
    .sort((a, b) => a.name.localeCompare(b.name));

/** Plantillas de programas reutilizables (template) — PRO FEATURE */
export const selectTemplatePrograms = (s) =>
  Object.values(s.programs ?? {})
    .filter((p) => p.mode === 'template')
    .sort((a, b) => a.name.localeCompare(b.name));
