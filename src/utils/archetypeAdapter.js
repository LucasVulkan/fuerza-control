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
import { GOAL_PARAMS } from './programGenerator';
import { withStages } from './stageProgress';

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
 * A4: si applyGoalParams (goal del usuario != goal del arquetipo) y el ejercicio
 * es key con minReps no nulo (no es de tiempo/submáx), adopta reps/rest del goal
 * elegido; sets = max(sets del arquetipo, sets del goal).
 */
function buildExConfig(archetypeEx, resolvedExId, isLimited, limitations, applyGoalParams = false, goalParams = null) {
  const limitationNote = isLimited
    ? getLimitationNote(archetypeEx.primaryGroup, limitations)
    : null;

  const isKey = archetypeEx.role === 'key';
  const useGoalParams = applyGoalParams && isKey && archetypeEx.minReps !== null && goalParams;

  const baseSets = useGoalParams ? Math.max(archetypeEx.sets, goalParams.sets) : archetypeEx.sets;
  const baseRestSec = useGoalParams ? goalParams.restSec : archetypeEx.restSec;
  const baseMinReps = useGoalParams ? goalParams.minReps : archetypeEx.minReps;
  const baseMaxReps = useGoalParams ? goalParams.maxReps : archetypeEx.maxReps;

  return {
    exerciseId: resolvedExId,
    isKey,
    sets: isLimited ? Math.min(baseSets, 2) : baseSets,
    restSec: baseRestSec,
    minReps: isLimited ? 12 : baseMinReps,
    maxReps: isLimited ? 15 : baseMaxReps,
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

  // El exConfig ya no lleva pattern/primaryGroup — se leen de la biblioteca.
  const patternOf = (ex) => EXERCISE_LIBRARY[ex.exerciseId]?.pattern;
  const groupOf   = (ex) => EXERCISE_LIBRARY[ex.exerciseId]?.primaryGroup;

  // Contar cuántos keys hay por patrón
  const keysByPattern = {};
  result.forEach((ex) => {
    if (ex.isKey) {
      keysByPattern[patternOf(ex)] = (keysByPattern[patternOf(ex)] ?? 0) + 1;
    }
  });

  // Eliminar 1 key — el ÚLTIMO de un patrón duplicado (conserva el principal,
  // que va antes en el día)
  const removableKey = [...result].reverse().find(
    (ex) => ex.isKey && (keysByPattern[patternOf(ex)] ?? 0) > 1
  );
  if (removableKey) {
    result = result.filter((ex) => ex !== removableKey);
    keysByPattern[patternOf(removableKey)]--;
  }

  // Eliminar 1 accessory (el último que no sea core)
  const removableAccessory = [...result].reverse().find(
    (ex) => !ex.isKey && groupOf(ex) !== 'core'
  );
  if (removableAccessory) {
    result = result.filter((ex) => ex !== removableAccessory);
  }

  // Añadir core si no hay ninguno
  const hasCore = result.some((ex) => groupOf(ex) === 'core');
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

// ─── B3: presupuesto de tiempo ────────────────────────────────────────────────
// Duplicado de programGenerator.js — misma fórmula espejo de `sessionStats`
// (mobile/src/utils/sessionStats.js): sets × (35s trabajo + restSec); en
// ejercicios de tiempo el "trabajo" es el punto medio de minTime–maxTime.
// No se comparte entre generateProgram/adaptArchetype a propósito: ambos
// caminos ya duplican LIMITATION_GROUPS/getLimitedGroups de forma independiente.

// Transición/montaje por ejercicio: buscar máquina, montar peso, ajustar.
const EXERCISE_OVERHEAD_SEC = 180;
// Calentamiento general, una vez por sesión (si la sesión no está vacía).
// Revisar cuando exista la feature warmup-sets (mobile/docs/specs/warmup-sets.md)
// para no contar el calentamiento dos veces.
const SESSION_OVERHEAD_SEC = 480;

function estimateSessionSec(exercises) {
  let seconds = 0;
  for (const ex of exercises) {
    const def = EXERCISE_LIBRARY[ex.exerciseId];
    const n = ex.sets ?? 0;
    const isTimed = def?.progressionModel === 'time_progression' || def?.progressionModel === 'submax';
    const work = isTimed ? ((def?.minTime ?? 20) + (def?.maxTime ?? 40)) / 2 : 35;
    seconds += n * (work + (ex.restSec ?? 90)) + EXERCISE_OVERHEAD_SEC;
  }
  if (exercises.length > 0) seconds += SESSION_OVERHEAD_SEC;
  return seconds;
}

/**
 * Recorta accesorios hasta caber en el presupuesto de `sessionMinutes` (B3.3-4).
 * Ver comentario largo en programGenerator.js#trimToTimeBudget — mismas reglas:
 * keys nunca se tocan, se quita el último accesorio con grupo ya cubierto
 * (si no hay, el último accesorio a secas), suelo duro de 1 key + 2 accesorios.
 */
function trimToTimeBudget(exercises, sessionMinutes) {
  if (!sessionMinutes) return exercises;
  const budgetSec = sessionMinutes * 60;
  const keyCount = exercises.filter((e) => e.isKey).length;
  let result = exercises;

  while (estimateSessionSec(result) > budgetSec) {
    const accessories = result.filter((e) => !e.isKey);
    if (accessories.length <= 2) break; // suelo duro: 1 key + 2 accesorios mínimo
    if (result.length - accessories.length !== keyCount) break; // guarda, no debería pasar

    const groupCounts = {};
    result.forEach((e) => {
      const g = EXERCISE_LIBRARY[e.exerciseId]?.primaryGroup;
      if (g) groupCounts[g] = (groupCounts[g] ?? 0) + 1;
    });

    let toRemove = null;
    for (let i = result.length - 1; i >= 0; i--) {
      const e = result[i];
      if (e.isKey) continue;
      const g = EXERCISE_LIBRARY[e.exerciseId]?.primaryGroup;
      if (g && groupCounts[g] > 1) { toRemove = e; break; }
    }
    if (!toRemove) {
      for (let i = result.length - 1; i >= 0; i--) {
        if (!result[i].isKey) { toRemove = result[i]; break; }
      }
    }
    if (!toRemove) break;
    result = result.filter((e) => e !== toRemove);
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
    sessionMinutes = 60,
  } = answers;

  const limitedGroups = getLimitedGroups(limitations);
  const programId = generateId('prog');
  const sessionTemplates = {};
  const programDays = [];

  // A4: si el objetivo elegido difiere del objetivo del arquetipo, los keys
  // adoptan los parámetros del goal elegido (ver buildExConfig).
  const applyGoalParams = goal !== archetype.goal;
  const goalParams = GOAL_PARAMS[goal] ?? GOAL_PARAMS.hypertrophy;

  archetype.days.forEach((dayDef) => {
    const templateId = generateId('tpl');
    const usedIds = new Set();
    let exercises = [];

    dayDef.exercises.forEach((archetypeEx) => {
      const originalDef = EXERCISE_LIBRARY[archetypeEx.exerciseId];
      const isLimited = limitedGroups.includes(archetypeEx.primaryGroup);

      // A3: si es key y el grupo está limitado, sustituir por variante suave
      // (beginner, mismo pattern+grupo) en vez de eliminar. Solo si no hay
      // sustituto se elimina el ejercicio.
      if (archetypeEx.role === 'key' && isLimited) {
        const sub = findSubstitute({
          pattern: archetypeEx.pattern,
          primaryGroup: archetypeEx.primaryGroup,
          userLevel: 'beginner',
          userEquipment: equipment,
          excludeIds: [...usedIds],
        });
        if (!sub) return; // no hay sustituto — slot vacío
        if (usedIds.has(sub.id)) return; // evitar duplicados en el día
        usedIds.add(sub.id);
        exercises.push(buildExConfig(archetypeEx, sub.id, isLimited, limitations, applyGoalParams, goalParams));
        return;
      }

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

      exercises.push(buildExConfig(archetypeEx, resolvedId, isLimited, limitations, applyGoalParams, goalParams));
    });

    // Ajustar según nivel — solo si el arquetipo NO está ya diseñado para
    // beginner (una plantilla beginner nativa no necesita reducción).
    if (level === 'beginner' && archetype.level !== 'beginner') {
      exercises = reduceForBeginner(exercises, equipment);
    }

    // B3: recortar accesorios si la sesión excede el presupuesto de tiempo.
    exercises = trimToTimeBudget(exercises, sessionMinutes);

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

  // Una etapa sin límite de ciclos — misma razón que en `programGenerator`.
  const program = withStages(
    {
      id: programId,
      name: archetype.name,
      type: 'primary',
      status: 'active',
      createdAt: new Date().toISOString().split('T')[0],
      currentWeek: 1,
      onboardingSnapshot: answers,
    },
    [{ id: generateId('stage'), name: 'Etapa 1', durationWeeks: null, days: programDays }],
    0,
  );

  return { program, sessionTemplates };
}
