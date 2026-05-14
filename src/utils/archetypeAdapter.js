/**
 * Adaptador de arquetipos.
 * Toma un arquetipo y las respuestas del onboarding y devuelve
 * sessionTemplates listos para guardar en el store.
 *
 * Proceso por ejercicio:
 * 1. ¿El usuario tiene el equipo? → usar tal cual
 * 2. ¿No tiene el equipo? → buscar sustituto con mismo pattern + primaryGroup
 * 3. ¿Limitación física afecta al grupo? → sustituir por beginner o eliminar si es key
 * 4. ¿Nivel no encaja? → sustituir por variante del nivel correcto
 *
 * Proceso por día según nivel:
 * - beginner: eliminar 1 key (nunca el único de su patrón) + 1 accessory, añadir 1 core
 * - intermediate: usar el template tal cual
 * - advanced: añadir 1 accessory extra si está disponible
 */

import { EXERCISE_LIBRARY } from '../data/exerciseLibrary';
import { generateId } from './formatters';

const LIMITATION_GROUPS = {
  shoulder:   ['shoulders', 'chest'],
  lower_back: ['glutes_hamstrings', 'back'],
  knee:       ['quads'],
};

const LIMITATION_NOTE = {
  shoulder:   'Ejecuta con rango de movimiento reducido. Para si hay dolor. No llegues al fallo.',
  lower_back: 'Espalda neutra en todo momento. Reduce el peso si notas tensión lumbar.',
  knee:       'No dejes que la rodilla colapse. Reduce rango si hay molestia.',
};

const LEVEL_ORDER = { beginner: 0, intermediate: 1, advanced: 2 };

// Ejercicio de core por defecto para rellenar cuando se reduce a beginner
const DEFAULT_CORE_EXERCISES = ['dead_bug', 'plank', 'crunch', 'leg_raise_lying'];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function hasEquipment(ex, userEquipment) {
  if (!ex.equipment || ex.equipment.length === 0) return true;
  return ex.equipment.some((e) => userEquipment.includes(e));
}

function fitsLevel(ex, userLevel) {
  return LEVEL_ORDER[ex.level] <= LEVEL_ORDER[userLevel];
}

function getLimitedGroups(limitations) {
  if (!limitations || limitations.includes('none')) return [];
  return limitations.flatMap((l) => LIMITATION_GROUPS[l] ?? []);
}

/**
 * Busca el mejor sustituto para un ejercicio dado.
 * Respeta patrón, grupo muscular, equipo y nivel.
 */
function findSubstitute({ pattern, primaryGroup, userLevel, userEquipment, excludeIds = [] }) {
  const candidates = Object.values(EXERCISE_LIBRARY).filter((ex) => {
    if (excludeIds.includes(ex.id)) return false;
    if (ex.pattern !== pattern) return false;
    if (ex.primaryGroup !== primaryGroup) return false;
    if (!hasEquipment(ex, userEquipment)) return false;
    if (!fitsLevel(ex, userLevel)) return false;
    return true;
  });

  if (candidates.length) return candidates[0];

  // Relajar: mismo patrón, cualquier grupo
  const byPattern = Object.values(EXERCISE_LIBRARY).filter((ex) => {
    if (excludeIds.includes(ex.id)) return false;
    if (ex.pattern !== pattern) return false;
    if (!hasEquipment(ex, userEquipment)) return false;
    if (!fitsLevel(ex, userLevel)) return false;
    return true;
  });

  return byPattern[0] ?? null;
}

/**
 * Construye el exConfig final para un ejercicio del arquetipo.
 */
function buildExConfig(archetypeEx, resolvedExId, isLimited, limitations) {
  const limitationNote = isLimited
    ? getLimitationNote(archetypeEx.primaryGroup, limitations)
    : null;

  return {
    exerciseId: resolvedExId,
    isKey: archetypeEx.role === 'key',
    sets: isLimited ? Math.min(archetypeEx.sets, 2) : archetypeEx.sets,
    restSec: archetypeEx.restSec,
    minReps: isLimited ? 12 : archetypeEx.minReps,
    maxReps: isLimited ? 15 : archetypeEx.maxReps,
    progressionOverride: null,
    limitationNote,
  };
}

function getLimitationNote(group, limitations) {
  const match = limitations.find((l) => (LIMITATION_GROUPS[l] ?? []).includes(group));
  return match ? LIMITATION_NOTE[match] : null;
}

/**
 * Reduce el día a versión beginner:
 * - Elimina 1 key (el que no es único en su patrón ese día)
 * - Elimina 1 accessory
 * - Añade 1 core si no hay ninguno
 */
function reduceForBeginner(exercises, userEquipment) {
  let result = [...exercises];

  // Contar cuántos keys hay por patrón
  const keysByPattern = {};
  result.forEach((ex) => {
    if (ex.isKey) {
      keysByPattern[ex.pattern] = (keysByPattern[ex.pattern] ?? 0) + 1;
    }
  });

  // Eliminar 1 key — el que tenga otro key del mismo patrón en el día
  const removableKey = result.find(
    (ex) => ex.isKey && (keysByPattern[ex.pattern] ?? 0) > 1
  );
  if (removableKey) {
    result = result.filter((ex) => ex !== removableKey);
    keysByPattern[removableKey.pattern]--;
  }

  // Eliminar 1 accessory (el último que no sea core)
  const removableAccessory = [...result].reverse().find(
    (ex) => !ex.isKey && ex.primaryGroup !== 'core'
  );
  if (removableAccessory) {
    result = result.filter((ex) => ex !== removableAccessory);
  }

  // Añadir core si no hay ninguno
  const hasCore = result.some((ex) => ex.primaryGroup === 'core');
  if (!hasCore) {
    const coreEx = DEFAULT_CORE_EXERCISES
      .map((id) => EXERCISE_LIBRARY[id])
      .find((ex) => ex && hasEquipment(ex, userEquipment));

    if (coreEx) {
      result.push({
        exerciseId: coreEx.id,
        isKey: false,
        sets: 3,
        restSec: 60,
        minReps: coreEx.minTime ? null : 12,
        maxReps: coreEx.maxTime ? null : 20,
        progressionOverride: null,
        limitationNote: null,
      });
    }
  }

  return result;
}

// ─── Adaptador principal ──────────────────────────────────────────────────────

/**
 * Adapta un arquetipo a las respuestas del onboarding.
 * Devuelve { program, sessionTemplates } en el mismo formato que generateProgram.
 */
export function adaptArchetype(archetype, answers) {
  const {
    level = 'intermediate',
    equipment = ['dumbbells', 'machines'],
    limitations = ['none'],
    goal = 'hypertrophy',
  } = answers;

  const limitedGroups = getLimitedGroups(limitations);
  const programId = generateId('prog');
  const sessionTemplates = {};
  const programDays = [];

  archetype.days.forEach((dayDef) => {
    const templateId = generateId('tpl');
    const usedIds = new Set();
    let exercises = [];

    dayDef.exercises.forEach((archetypeEx) => {
      const originalDef = EXERCISE_LIBRARY[archetypeEx.exerciseId];
      const isLimited = limitedGroups.includes(archetypeEx.primaryGroup);

      // Si es key y el grupo está limitado — no añadir
      if (archetypeEx.role === 'key' && isLimited) return;

      let resolvedId = archetypeEx.exerciseId;

      // ¿Tiene equipo? ¿Encaja el nivel?
      const needsSubstitution =
        !originalDef ||
        !hasEquipment(originalDef, equipment) ||
        !fitsLevel(originalDef, level) ||
        (isLimited && archetypeEx.role === 'accessory');

      if (needsSubstitution) {
        const sub = findSubstitute({
          pattern: archetypeEx.pattern,
          primaryGroup: isLimited ? archetypeEx.primaryGroup : archetypeEx.primaryGroup,
          userLevel: isLimited ? 'beginner' : level,
          userEquipment: equipment,
          excludeIds: [...usedIds],
        });

        if (!sub) return; // no hay sustituto — slot vacío
        resolvedId = sub.id;
      }

      if (usedIds.has(resolvedId)) return; // evitar duplicados en el día
      usedIds.add(resolvedId);

      exercises.push(buildExConfig(archetypeEx, resolvedId, isLimited, limitations));
    });

    // Ajustar según nivel
    if (level === 'beginner') {
      exercises = reduceForBeginner(exercises, equipment);
    }

    // Añadir orden
    exercises = exercises.map((ex, idx) => ({ ...ex, order: idx + 1 }));

    // Warmup del primer key
    const firstKey = exercises.find((ex) => ex.isKey);
    const firstKeyDef = firstKey ? EXERCISE_LIBRARY[firstKey.exerciseId] : null;
    const warmup = firstKeyDef?.warmup?.length
      ? firstKeyDef.warmup
      : ['5–8 min movilidad articular general', '10 rotaciones de hombro', '10 círculos de cadera'];

    sessionTemplates[templateId] = {
      id: templateId,
      programId,
      label: dayDef.label,
      name: dayDef.name,
      emphasis: dayDef.emphasis,
      color: dayDef.color,
      generatedWarmup: warmup,
      exercises,
    };

    programDays.push({
      sessionTemplateId: templateId,
      label: dayDef.label,
      emphasis: dayDef.emphasis,
    });
  });

  const program = {
    id: programId,
    name: archetype.name,
    type: 'primary',
    status: 'active',
    createdAt: new Date().toISOString().split('T')[0],
    currentWeek: 1,
    onboardingSnapshot: answers,
    days: programDays,
  };

  return { program, sessionTemplates };
}
