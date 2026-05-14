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
import { exportFullBackup, exportProgramOnly, downloadJSON, parseImportFile, readFileAsText } from '../utils/storage';

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
};

const INITIAL_ACTIVE_SESSION = {
  /** ID del template de sesión en curso, ej. 'tpl_A' */
  templateId: null,
  /** Estado de los inputs de cada set: { [exId]: [{ weight, reps, time, done }] } */
  setsState: {},
  /** Timestamp de inicio */
  startedAt: null,
};

const INITIAL_UI = {
  /** 'home' | 'workout' | 'history' | 'stats' */
  view: 'home',
  toast: null,          // { msg, id }
  restTimer: {
    active: false,
    remaining: 0,
    total: 0,
    exerciseName: '',
  },
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

      // Programas y templates editados por el usuario (sobreescriben los defaults del código)
      userPrograms: {},       // { [templateId]: sessionTemplate editado }

      // Ejercicios creados por el usuario
      customExercises: {},    // { [exerciseId]: exerciseDef }

      // Snapshot para cancelar ediciones en el editor de programa
      _editSnapshot: null,    // { [templateId]: sessionTemplate } | null

      // ── Referencias estáticas (no se persisten, vienen del código) ──────────
      exerciseLibrary: EXERCISE_LIBRARY,
      sessionTemplates: SESSION_TEMPLATES,
      programs: PROGRAMS,

      // ══════════════════════════════════════════════════════════════════════
      // ACCIONES — PERFIL
      // ══════════════════════════════════════════════════════════════════════

      setProfile: (updates) =>
        set((state) => ({ profile: { ...state.profile, ...updates } })),

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
      archiveActiveProgram: () => {
        const { profile, programs } = get();
        if (!profile.activeProgramId) return;
        set((s) => ({
          programs: {
            ...s.programs,
            [profile.activeProgramId]: {
              ...programs[profile.activeProgramId],
              status: 'archived',
            },
          },
          profile: { ...s.profile, activeProgramId: null },
          ui: { ...s.ui, view: 'onboarding' },
        }));
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
      cancelEditSession: (destination = 'home') => {
        const { _editSnapshot } = get();
        if (_editSnapshot !== null) {
          set({ userPrograms: _editSnapshot, _editSnapshot: null });
        }
        get().navigate(destination);
      },

      /**
       * Confirma los cambios del editor (descarta el snapshot) y navega a home.
       */
      confirmEditSession: (destination = 'home') => {
        set({ _editSnapshot: null });
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
      createEmptyProgram: (numSessions, programName = 'Mi programa') => {
        const programId = generateId('prog');
        const labels = ['A', 'B', 'C', 'D', 'E', 'F'];
        const colors = ['#e8ff47', '#ff6b35', '#7eb8ff', '#a78bfa', '#34d399', '#f472b6'];
        const newTemplates = {};
        const programDays = [];

        for (let i = 0; i < numSessions; i++) {
          const templateId = generateId('tpl');
          const label = labels[i] ?? String(i + 1);
          newTemplates[templateId] = {
            id: templateId, programId,
            label, name: `Sesión ${label}`,
            emphasis: '', color: colors[i] ?? '#e8ff47',
            exercises: [],
          };
          programDays.push({ sessionTemplateId: templateId, label });
        }

        const program = {
          id: programId, name: programName,
          type: 'primary', status: 'active',
          createdAt: new Date().toISOString().split('T')[0],
          currentWeek: 1,
          onboardingSnapshot: { mode: 'manual' },
          days: programDays,
        };

        set((s) => ({
          programs: { ...s.programs, [programId]: program },
          sessionTemplates: { ...s.sessionTemplates, ...newTemplates },
          profile: { ...s.profile, activeProgramId: programId, onboardingCompleted: true },
          ui: { ...s.ui, view: 'programEditor' },
        }));
      },

      // Añade una sesión vacía al programa activo
      addSessionToProgram: (programId) => {
        const { programs, sessionTemplates } = get();
        const program = programs[programId];
        if (!program) return;

        const labels = ['A', 'B', 'C', 'D', 'E', 'F'];
        const colors = ['#e8ff47', '#ff6b35', '#7eb8ff', '#a78bfa', '#34d399', '#f472b6'];
        const i = program.days.length;
        const label = labels[i] ?? String(i + 1);
        const color = colors[i] ?? '#888';
        const templateId = generateId('tpl');

        const newTemplate = {
          id: templateId, programId,
          label, name: `Sesión ${label}`,
          emphasis: '', color,
          exercises: [],
        };

        set((s) => ({
          sessionTemplates: { ...s.sessionTemplates, [templateId]: newTemplate },
          programs: {
            ...s.programs,
            [programId]: {
              ...program,
              days: [...program.days, { sessionTemplateId: templateId, label }],
            },
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

      /** Marca/desmarca un set como completado y lanza el timer de descanso. */
      toggleSetDone: (exerciseId, setIndex) => {
        const { activeSession, exerciseLibrary } = get();
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
          const exDef = exerciseLibrary[exerciseId];
          const restSec = exDef?.restSec ?? 90;
          get().startRestTimer(restSec, exDef?.name ?? '');
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
      saveSession: () => {
        const { activeSession, getEffectiveTemplate, exerciseLibrary } = get();
        if (!activeSession.templateId) return { ok: false, error: 'No hay sesión activa' };

        const template = getEffectiveTemplate(activeSession.templateId);
        if (!template) return { ok: false, error: 'Template no encontrado' };

        // Filtrar solo ejercicios con al menos un set con datos
        const exercises = template.exercises
          .map(({ exerciseId, sets: totalSets, minReps, maxReps, restSec }) => {
            const setsData = activeSession.setsState[exerciseId] ?? [];
            const validSets = setsData.filter(
              (s) => s.weight !== '' || s.reps !== '' || s.time !== ''
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
          notes: '',
          bodyWeight: null,
          exercises,
        };

        set((s) => ({
          workoutLog: [...s.workoutLog, logEntry],
          activeSession: INITIAL_ACTIVE_SESSION,
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

      // Exportar backup completo
      exportFullBackup: () => {
        const s = get();
        const json = exportFullBackup(s);
        const name = s.programs[s.profile.activeProgramId]?.name ?? 'backup';
        downloadJSON(json, name);
      },

      // Exportar solo el programa (sin historial)
      exportProgramOnly: () => {
        const s = get();
        const json = exportProgramOnly(s);
        const name = s.programs[s.profile.activeProgramId]?.name ?? 'programa';
        downloadJSON(json, `programa-${name}`);
      },

      /**
       * Importa un archivo JSON exportado por la app.
       * @param {File} file
       * @param {'replace'|'merge_log'|'add_program'} mode
       *   - replace: reemplaza todo (backup completo)
       *   - merge_log: fusiona solo el historial (el cliente manda sus sesiones al entrenador)
       *   - add_program: importa el programa como nuevo programa activo, sin tocar el historial
       */
      importData: async (file, mode = 'replace') => {
        try {
          const text = await readFileAsText(file);
          const result = parseImportFile(text);

          if (!result.ok) {
            get().showToast('⚠️ ' + result.error);
            return { ok: false, error: result.error };
          }

          const data = result.data;

          if (mode === 'replace') {
            const importedTemplateIds = new Set([
              ...Object.keys(data.sessionTemplates ?? {}),
              ...Object.keys(data.userPrograms ?? {}),
            ]);
            set((s) => {
              const keptUserPrograms = Object.fromEntries(
                Object.entries(s.userPrograms).filter(([id]) => !importedTemplateIds.has(id))
              );
              return {
                profile: {
                  ...(data.profile ?? s.profile),
                  activeProgramId: data.program?.id ?? s.profile.activeProgramId,
                  theme: s.profile.theme,
                  onboardingCompleted: data.program ? true : (data.profile?.onboardingCompleted ?? s.profile.onboardingCompleted),
                },
                programs: data.program
                  ? { ...s.programs, [data.program.id]: data.program }
                  : s.programs,
                sessionTemplates: { ...s.sessionTemplates, ...data.sessionTemplates },
                userPrograms: { ...keptUserPrograms, ...data.userPrograms },
                customExercises: { ...s.customExercises, ...data.customExercises },
                workoutLog: data.workoutLog ?? [],
              };
            });
            get().showToast('✓ Importado correctamente');
          }

          if (mode === 'merge_log') {
            // Solo añade sesiones nuevas al historial actual (evita duplicados por id)
            const currentIds = new Set(get().workoutLog.map((e) => e.id));
            const newEntries = (data.workoutLog ?? []).filter((e) => !currentIds.has(e.id));
            set((s) => ({ workoutLog: [...s.workoutLog, ...newEntries] }));
            get().showToast(`✓ ${newEntries.length} sesiones añadidas al historial`);
          }

          if (mode === 'add_program') {
            if (!data.program) {
              get().showToast('⚠️ El archivo no contiene un programa');
              return { ok: false, error: 'Sin programa' };
            }
            set((s) => ({
              programs: { ...s.programs, [data.program.id]: data.program },
              sessionTemplates: { ...s.sessionTemplates, ...data.sessionTemplates },
              userPrograms: { ...s.userPrograms, ...data.userPrograms },
              customExercises: { ...s.customExercises, ...data.customExercises },
              profile: {
                ...s.profile,
                activeProgramId: data.program.id,
                onboardingCompleted: true,
              },
            }));
            get().showToast('✓ Programa importado correctamente');
          }

          return { ok: true, data };
        } catch (e) {
          get().showToast('⚠️ Error al leer el archivo');
          return { ok: false, error: e.message };
        }
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
      }),
      // Al rehidratar: si hay sesión en progreso, navegar a workout automáticamente
      onRehydrateStorage: () => (state) => {
        if (!state) return;
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
