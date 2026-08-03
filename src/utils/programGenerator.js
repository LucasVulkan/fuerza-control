/**
 * Generador de programas a partir de las respuestas del onboarding.
 * Lógica pura — sin dependencias de React ni del store.
 */

import { EXERCISE_LIBRARY } from '../data/exerciseLibrary';
import { generateId } from './formatters';
import { withStages } from './stageProgress';

// ─── Parámetros por objetivo ──────────────────────────────────────────────────

export const GOAL_PARAMS = {
  hypertrophy:  { sets: 3, minReps: 8,  maxReps: 12, restSec: 90  },
  strength:     { sets: 4, minReps: 5,  maxReps: 8,  restSec: 120 },
  max_strength: { sets: 5, minReps: 3,  maxReps: 5,  restSec: 180 },
  endurance:    { sets: 3, minReps: 12, maxReps: 20, restSec: 60  },
};

// ─── Colores y etiquetas de días ─────────────────────────────────────────────

const DAY_COLORS = ['var(--day1)', 'var(--day2)', 'var(--day3)', 'var(--day4)', 'var(--day5)', 'var(--day6)'];
const DAY_LABELS = ['A', 'B', 'C', 'D', 'E', 'F'];

// ─── Patrones por disciplina + distribución ───────────────────────────────────

const DISTRIBUTION_PATTERNS = {

  // ── Standard ──────────────────────────────────────────────────────────────
  standard_full_body: {
    days: [
      { name: 'Tracción prioritaria',  emphasis: 'pull',  keyGroup: 'back',             keyGroup2: 'glutes_hamstrings', accessories: ['chest', 'core', 'grip'] },
      { name: 'Empuje prioritario',    emphasis: 'push',  keyGroup: 'chest',            keyGroup2: 'quads',             accessories: ['back', 'core', 'arms'] },
      { name: 'Pierna prioritaria',    emphasis: 'legs',  keyGroup: 'quads',            keyGroup2: 'back',              accessories: ['glutes_hamstrings', 'core', 'grip'] },
      { name: 'Tracción y glúteo',     emphasis: 'pull',  keyGroup: 'back',             keyGroup2: 'glutes_hamstrings', accessories: ['shoulders', 'core', 'arms'] },
      { name: 'Empuje y core',         emphasis: 'push',  keyGroup: 'shoulders',        keyGroup2: 'quads',             accessories: ['chest', 'core', 'core'] },
      { name: 'Pierna completa',       emphasis: 'legs',  keyGroup: 'glutes_hamstrings',keyGroup2: 'quads',             accessories: ['back', 'core', 'grip'] },
    ],
  },

  standard_upper_lower: {
    days: [
      { name: 'Tren superior A', emphasis: 'upper', keyGroup: 'back',  keyGroup2: 'chest',            accessories: ['shoulders', 'arms', 'core'] },
      { name: 'Tren inferior A', emphasis: 'lower', keyGroup: 'quads', keyGroup2: 'glutes_hamstrings',accessories: ['glutes_hamstrings', 'core', 'grip'] },
      { name: 'Tren superior B', emphasis: 'upper', keyGroup: 'chest', keyGroup2: 'back',             accessories: ['shoulders', 'arms', 'core'] },
      { name: 'Tren inferior B', emphasis: 'lower', keyGroup: 'glutes_hamstrings', keyGroup2: 'quads',accessories: ['quads', 'core', 'grip'] },
    ],
  },

  standard_push_pull_legs: {
    days: [
      { name: 'Empuje',          emphasis: 'push', keyGroup: 'chest',            keyGroup2: 'shoulders',        accessories: ['arms', 'core'] },
      { name: 'Tracción',        emphasis: 'pull', keyGroup: 'back',             keyGroup2: null,               accessories: ['back', 'arms', 'grip', 'core'] },
      { name: 'Pierna',          emphasis: 'legs', keyGroup: 'quads',            keyGroup2: 'glutes_hamstrings',accessories: ['core', 'core'] },
    ],
  },

  // ── Calistenia ────────────────────────────────────────────────────────────
  calisthenics_full_body: {
    days: [
      { name: 'Tracción y core',     emphasis: 'pull', keyGroup: 'back',  keyGroup2: null,       accessories: ['glutes_hamstrings', 'core', 'grip'] },
      { name: 'Empuje y pierna',     emphasis: 'push', keyGroup: 'chest', keyGroup2: 'quads',    accessories: ['shoulders', 'core', 'arms'] },
      { name: 'Full body funcional', emphasis: 'full', keyGroup: 'back',  keyGroup2: 'quads',    accessories: ['core', 'grip', 'core'] },
      { name: 'Tracción y hombro',   emphasis: 'pull', keyGroup: 'back',  keyGroup2: 'shoulders',accessories: ['core', 'grip', 'arms'] },
      { name: 'Pierna y core',       emphasis: 'legs', keyGroup: 'quads', keyGroup2: null,       accessories: ['glutes_hamstrings', 'core', 'grip'] },
      { name: 'Completo funcional',  emphasis: 'full', keyGroup: 'back',  keyGroup2: 'glutes_hamstrings', accessories: ['core', 'core', 'grip'] },
    ],
  },

  calisthenics_upper_lower: {
    days: [
      { name: 'Tren superior A', emphasis: 'upper', keyGroup: 'back',  keyGroup2: 'chest', accessories: ['shoulders', 'core', 'grip'] },
      { name: 'Tren inferior A', emphasis: 'lower', keyGroup: 'quads', keyGroup2: null,    accessories: ['glutes_hamstrings', 'core', 'grip'] },
      { name: 'Tren superior B', emphasis: 'upper', keyGroup: 'chest', keyGroup2: 'back',  accessories: ['shoulders', 'core', 'grip'] },
      { name: 'Tren inferior B', emphasis: 'lower', keyGroup: 'glutes_hamstrings', keyGroup2: null, accessories: ['quads', 'core', 'grip'] },
    ],
  },

  calisthenics_push_pull_legs: {
    days: [
      { name: 'Empuje funcional',  emphasis: 'push', keyGroup: 'chest', keyGroup2: 'shoulders', accessories: ['core', 'arms', 'grip'] },
      { name: 'Tracción funcional',emphasis: 'pull', keyGroup: 'back',  keyGroup2: null,        accessories: ['back', 'core', 'grip'] },
      { name: 'Pierna funcional',  emphasis: 'legs', keyGroup: 'quads', keyGroup2: null,        accessories: ['glutes_hamstrings', 'core', 'grip'] },
    ],
  },

  // ── Glúteo / Pierna ───────────────────────────────────────────────────────
  glutes_legs_full_body: {
    days: [
      { name: 'Glúteo prioritario',       emphasis: 'glutes',    keyGroup: 'glutes_hamstrings', keyGroup2: null,    accessories: ['glutes_hamstrings', 'quads', 'core'] },
      { name: 'Pierna y tracción',        emphasis: 'legs_pull', keyGroup: 'quads',             keyGroup2: 'back',  accessories: ['glutes_hamstrings', 'core', 'arms'] },
      { name: 'Full body énfasis glúteo', emphasis: 'full',      keyGroup: 'glutes_hamstrings', keyGroup2: 'chest', accessories: ['quads', 'core', 'grip'] },
      { name: 'Glúteo e isquio',          emphasis: 'glutes',    keyGroup: 'glutes_hamstrings', keyGroup2: null,    accessories: ['glutes_hamstrings', 'back', 'core'] },
      { name: 'Pierna completa',          emphasis: 'legs',      keyGroup: 'quads',             keyGroup2: 'glutes_hamstrings', accessories: ['core', 'core', 'grip'] },
      { name: 'Glúteo y upper',           emphasis: 'full',      keyGroup: 'glutes_hamstrings', keyGroup2: 'back',  accessories: ['shoulders', 'core', 'arms'] },
    ],
  },

  // ── Fuerza ────────────────────────────────────────────────────────────────
  strength_full_body: {
    days: [
      { name: 'Tracción prioritaria',  emphasis: 'pull', keyGroup: 'back',             keyGroup2: 'glutes_hamstrings', accessories: ['chest', 'core', 'arms'] },
      { name: 'Empuje prioritario',    emphasis: 'push', keyGroup: 'chest',            keyGroup2: 'quads',             accessories: ['back', 'core', 'shoulders'] },
      { name: 'Pierna prioritaria',    emphasis: 'legs', keyGroup: 'quads',            keyGroup2: 'glutes_hamstrings', accessories: ['back', 'core', 'grip'] },
    ],
  },

  strength_upper_lower: {
    days: [
      { name: 'Tren superior A', emphasis: 'upper', keyGroup: 'chest', keyGroup2: 'back',             accessories: ['shoulders', 'arms', 'core'] },
      { name: 'Tren inferior A', emphasis: 'lower', keyGroup: 'quads', keyGroup2: 'glutes_hamstrings',accessories: ['back', 'core', 'grip'] },
      { name: 'Tren superior B', emphasis: 'upper', keyGroup: 'back',  keyGroup2: 'chest',            accessories: ['shoulders', 'arms', 'core'] },
      { name: 'Tren inferior B', emphasis: 'lower', keyGroup: 'glutes_hamstrings', keyGroup2: 'quads',accessories: ['back', 'core', 'grip'] },
    ],
  },

  strength_push_pull_legs: {
    days: [
      { name: 'Empuje',   emphasis: 'push', keyGroup: 'chest', keyGroup2: 'shoulders', accessories: ['arms', 'core'] },
      { name: 'Tracción', emphasis: 'pull', keyGroup: 'back',  keyGroup2: null,        accessories: ['back', 'arms', 'grip', 'core'] },
      { name: 'Pierna',   emphasis: 'legs', keyGroup: 'quads', keyGroup2: 'glutes_hamstrings', accessories: ['core', 'grip'] },
    ],
  },

};

// ─── Grupos afectados por limitación ─────────────────────────────────────────

const LIMITATION_GROUPS = {
  shoulder:   ['shoulders', 'chest'],
  lower_back: ['glutes_hamstrings', 'back'],
  knee:       ['quads'],
};

const LIMITATION_NOTE = {
  shoulder:   'Ejecuta con rango de movimiento reducido. Para si hay dolor. No llegues al fallo.',
  lower_back: 'Espalda neutra en todo momento. Reduce el peso si notas tensión lumbar. Para si hay dolor.',
  knee:       'No dejes que la rodilla colapse hacia dentro. Reduce rango si hay molestia. Para si hay dolor.',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function exerciseFitsEquipment(ex, equipment) {
  if (!ex.equipment || ex.equipment.length === 0) return true;
  return ex.equipment.some((e) => equipment.includes(e));
}

function exerciseFitsLevel(ex, level) {
  const order = { beginner: 0, intermediate: 1, advanced: 2 };
  return order[ex.level] <= order[level];
}

function getLimitedGroups(limitations) {
  if (!limitations || limitations.includes('none')) return [];
  return limitations.flatMap((l) => LIMITATION_GROUPS[l] ?? []);
}

/** IDs de variantes relacionadas que deben excluirse si este ejercicio está en el programa */
function getRelatedIds(ex) {
  const ids = [...(ex.relatedVariants ?? [])];
  if (ex.assistedVariantId) ids.push(ex.assistedVariantId);
  return ids;
}

/** Ordena candidatos por prioridad para el objetivo dado (high primero) */
function sortByPriority(candidates, goal) {
  const order = { high: 0, medium: 1, low: 2 };
  return [...candidates].sort((a, b) => {
    const pa = order[a.priority?.[goal] ?? 'medium'];
    const pb = order[b.priority?.[goal] ?? 'medium'];
    return pa - pb;
  });
}

function getCandidates({ primaryGroup, level, equipment, limitations, keyOnly = false, goal = 'hypertrophy', excludedIds = new Set() }) {
  const limitedGroups = getLimitedGroups(limitations);
  const isLimited = limitedGroups.includes(primaryGroup);

  const raw = Object.values(EXERCISE_LIBRARY).filter((ex) => {
    if (ex.primaryGroup !== primaryGroup) return false;
    if (keyOnly && !ex.isKeyCandidate) return false;
    if (keyOnly && !ex.isCompound) return false; // keys siempre compuestos
    if (!exerciseFitsEquipment(ex, equipment)) return false;
    if (excludedIds.has(ex.id)) return false;
    if (isLimited) {
      // A3: sustituir por variante suave, no eliminar. Para keys: compounds
      // beginner del grupo (proxy de "amable con la articulación"); si no hay,
      // no-compound beginner.
      if (keyOnly) return ex.level === 'beginner' && ex.isCompound;
      return ex.level === 'beginner';
    }
    if (keyOnly && ex.priority?.[goal] === 'low') return false;
    return exerciseFitsLevel(ex, level);
  });

  return sortByPriority(raw, goal);
}

const LEVEL_ORDER = { beginner: 0, intermediate: 1, advanced: 2 };

/**
 * A1: fallback en cascada para keys. El nivel es orientación, no barrera.
 * 1. isKeyCandidate && isCompound, nivel ≤ usuario, priority≠low (estándar).
 * 2. isKeyCandidate && isCompound, cualquier nivel — orden por cercanía de nivel.
 * 3. isCompound del grupo, cualquier nivel — mismo orden.
 *
 * Con limitación (isLimited), el paso 1 ya viene relajado a beginner
 * compound/no-compound del grupo (A3). Si ni así hay nada (grupo sin ningún
 * ejercicio beginner en la biblioteca — p. ej. quads hoy), caer en los mismos
 * escalones 2/3 que el caso no limitado: la cercanía de nivel prioriza lo menos
 * avanzado disponible, y buildExConfig sigue aplicando la nota de limitación.
 */
function getKeyCandidatesWithFallback({ primaryGroup, level, equipment, limitations, goal, excludedIds }) {
  const limitedGroups = getLimitedGroups(limitations);
  const isLimited = limitedGroups.includes(primaryGroup);
  const effectiveLevel = isLimited ? 'beginner' : level;

  const step1 = getCandidates({ primaryGroup, level, equipment, limitations, keyOnly: true, goal, excludedIds });
  if (step1.length) return step1;

  // Cercanía de nivel primero (a 'beginner' si está limitado), priority como desempate
  const byLevelCloseness = (candidates) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return [...candidates].sort((a, b) => {
      const da = Math.abs(LEVEL_ORDER[a.level] - LEVEL_ORDER[effectiveLevel]);
      const db = Math.abs(LEVEL_ORDER[b.level] - LEVEL_ORDER[effectiveLevel]);
      if (da !== db) return da - db;
      const pa = priorityOrder[a.priority?.[goal] ?? 'medium'];
      const pb = priorityOrder[b.priority?.[goal] ?? 'medium'];
      return pa - pb;
    });
  };

  // Escalón 2: isKeyCandidate && isCompound, cualquier nivel
  const step2raw = Object.values(EXERCISE_LIBRARY).filter((ex) => {
    if (ex.primaryGroup !== primaryGroup) return false;
    if (!ex.isKeyCandidate || !ex.isCompound) return false;
    if (!exerciseFitsEquipment(ex, equipment)) return false;
    if (excludedIds.has(ex.id)) return false;
    return true;
  });
  const step2 = byLevelCloseness(step2raw);
  if (step2.length) return step2;

  // Escalón 3: isCompound del grupo, cualquier nivel
  const step3raw = Object.values(EXERCISE_LIBRARY).filter((ex) => {
    if (ex.primaryGroup !== primaryGroup) return false;
    if (!ex.isCompound) return false;
    if (!exerciseFitsEquipment(ex, equipment)) return false;
    if (excludedIds.has(ex.id)) return false;
    return true;
  });
  return byLevelCloseness(step3raw);
}

// ─── B3: presupuesto de tiempo ────────────────────────────────────────────────

// exercisesPerSession inicial según minutos de sesión pedidos (B3.2).
const EXERCISES_PER_SESSION_BY_TIME = { 30: 3, 45: 4, 60: 5, 90: 6 };

// Transición/montaje por ejercicio: buscar máquina, montar peso, ajustar.
const EXERCISE_OVERHEAD_SEC = 180;
// Calentamiento general, una vez por sesión (si la sesión no está vacía).
// Revisar cuando exista la feature warmup-sets (mobile/docs/specs/warmup-sets.md)
// para no contar el calentamiento dos veces.
const SESSION_OVERHEAD_SEC = 480;

/**
 * Estima segundos de una sesión. Fórmula espejo de `sessionStats`
 * (mobile/src/utils/sessionStats.js): por ejercicio, sets × (35s trabajo +
 * restSec) + overhead de transición; en ejercicios de tiempo el "trabajo" es
 * el punto medio de minTime–maxTime; más un calentamiento general único por
 * sesión no vacía. Duplicada aquí (no en mobile/) porque src/ no puede
 * importar de mobile/.
 * exercises: exConfig[] (forma de buildExConfig/adaptArchetype: exerciseId,
 * sets, restSec, minReps/maxReps — null si es de tiempo).
 */
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
 * Recorta accesorios de una sesión ya construida hasta caber en el
 * presupuesto de `sessionMinutes` (B3.3-4).
 *
 * Reglas (en este orden, revisado línea a línea por Fable — no reordenar):
 * - Los keys NUNCA se recortan por tiempo (ni se cuentan como candidatos aquí).
 * - Mientras el tiempo estimado supere el presupuesto y queden accesorios
 *   recortables: se quita el ÚLTIMO accesorio (recorremos de atrás hacia
 *   delante) cuyo primaryGroup ya esté cubierto por otro ejercicio de la
 *   sesión (key o accesorio) — perder ese ejercicio no deja el grupo a cero.
 *   Si ninguno cumple eso, se quita el último accesorio a secas.
 * - Suelo duro: nunca bajar de 1 key + 2 accesorios (3 ejercicios totales).
 *   Si aun en el suelo no cabe en el presupuesto, se deja así — el preview
 *   mostrará la duración real (más larga que el presupuesto pedido).
 */
function trimToTimeBudget(exercises, sessionMinutes) {
  if (!sessionMinutes) return exercises;
  const budgetSec = sessionMinutes * 60;
  const keyCount = exercises.filter((e) => e.isKey).length;
  let result = exercises;

  while (estimateSessionSec(result) > budgetSec) {
    const accessories = result.filter((e) => !e.isKey);
    if (accessories.length <= 2) break; // suelo duro: 1 key + 2 accesorios mínimo
    if (result.length - accessories.length !== keyCount) break; // no debería pasar, guarda

    const groupCounts = {};
    result.forEach((e) => {
      const g = EXERCISE_LIBRARY[e.exerciseId]?.primaryGroup;
      if (g) groupCounts[g] = (groupCounts[g] ?? 0) + 1;
    });

    // Último accesorio cuyo grupo aparece más de una vez (ya cubierto por otro ejercicio)
    let toRemove = null;
    for (let i = result.length - 1; i >= 0; i--) {
      const e = result[i];
      if (e.isKey) continue;
      const g = EXERCISE_LIBRARY[e.exerciseId]?.primaryGroup;
      if (g && groupCounts[g] > 1) { toRemove = e; break; }
    }
    // Si ninguno tiene grupo duplicado, el último accesorio a secas
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

// ─── Generador principal ──────────────────────────────────────────────────────

export function generateProgram(answers) {
  const {
    level = 'beginner',
    discipline = 'standard',
    distribution = 'full_body',
    daysPerWeek = 3,
    goal = 'hypertrophy',
    equipment = ['dumbbells', 'machines'],
    limitations = ['none'],
    sessionMinutes = 60,
  } = answers;

  const goalParams = GOAL_PARAMS[goal] ?? GOAL_PARAMS.hypertrophy;
  const patternKey = `${discipline}_${distribution}`;
  const patternDays = DISTRIBUTION_PATTERNS[patternKey]?.days
    ?? DISTRIBUTION_PATTERNS.standard_full_body.days;
  const limitedGroups = getLimitedGroups(limitations);

  const exercisesPerSession = EXERCISES_PER_SESSION_BY_TIME[sessionMinutes] ?? 5;
  const keysPerSession = 2; // siempre intentamos 2 keys

  const programId = generateId('prog');
  const sessionTemplates = {};
  const programDays = [];

  // Solo excludedByVariant es global — evita asistidas junto a no-asistidas en todo el programa
  // usedKeyIds se declara dentro del forEach — un key puede repetirse en días distintos
  const excludedByVariant = new Set();

  // A6: si se piden más días que patrones disponibles, ciclar (día 4 = patrón 1
  // otra vez) en vez de recortar en silencio. Label/color/templateId propios por
  // día — el templateId ya se genera fresco por día más abajo.
  // B2: daysPerWeek pasa a ser frecuencia (1–7); las sesiones distintas se capan
  // a 6 — con 7 días el ciclo rota y el preview muestra el hint de ciclo.
  const sessionCount = Math.min(Math.max(1, daysPerWeek), 6);
  const activeDays = Array.from({ length: sessionCount }, (_, i) => {
    const dayDef = patternDays[i % patternDays.length];
    return {
      ...dayDef,
      label: DAY_LABELS[i] ?? String(i + 1),
      color: DAY_COLORS[i] ?? '#e8ff47',
    };
  });

  activeDays.forEach((dayDef) => {
    const templateId = generateId('tpl');
    const exercises = [];
    const usedInSession = new Set(); // evitar repetir en el mismo día

    // ── Keys ─────────────────────────────────────────────────────────
    const keyGroups = [dayDef.keyGroup, dayDef.keyGroup2].filter(Boolean);
    const keyExercises = [];
    const unfilledKeyGroups = []; // A2: hueco de key sin candidato → se rellena como accesorio

    keyGroups.slice(0, keysPerSession).forEach((keyGroup) => {
      const candidates = getKeyCandidatesWithFallback({
        primaryGroup: keyGroup,
        level, equipment, limitations, goal,
        excludedIds: new Set([...excludedByVariant, ...usedInSession]),
      });

      if (!candidates.length) {
        unfilledKeyGroups.push(keyGroup);
        return;
      }

      const keyEx = candidates[0];
      usedInSession.add(keyEx.id);
      getRelatedIds(keyEx).forEach((id) => excludedByVariant.add(id));
      keyExercises.push(keyEx);
      exercises.push(buildExConfig(keyEx, goalParams, true, limitedGroups, limitations));
    });

    const primaryKeyEx = keyExercises[0] ?? null;

    // ── Accesorios ───────────────────────────────────────────────────
    // A2: huecos de key sin candidato pasan a intentarse como accesorio del mismo grupo (isKey: false)
    const accessoryCount = exercisesPerSession - keyExercises.length;
    const accessorySlots = [...unfilledKeyGroups, ...dayDef.accessories].slice(0, accessoryCount);

    accessorySlots.forEach((group) => {
      const isLimited = limitedGroups.includes(group);
      const sessionExcluded = new Set([...usedInSession, ...excludedByVariant]);

      // Intento 1: grupo correcto, nivel ≤ seleccionado
      let candidates = getCandidates({ primaryGroup: group, level, equipment, limitations, goal, excludedIds: sessionExcluded });

      // Intento 2: mismo grupo, nivel inferior
      if (!candidates.length) {
        const lowerLevel = level === 'advanced' ? 'intermediate' : 'beginner';
        candidates = sortByPriority(
          Object.values(EXERCISE_LIBRARY).filter((ex) => {
            if (ex.primaryGroup !== group) return false;
            if (!exerciseFitsEquipment(ex, equipment)) return false;
            if (sessionExcluded.has(ex.id)) return false;
            return exerciseFitsLevel(ex, lowerLevel);
          }), goal
        );
      }

      // Intento 3: cualquier grupo, nivel ≤ seleccionado
      if (!candidates.length) {
        candidates = sortByPriority(
          Object.values(EXERCISE_LIBRARY).filter((ex) => {
            if (!exerciseFitsEquipment(ex, equipment)) return false;
            if (sessionExcluded.has(ex.id)) return false;
            return exerciseFitsLevel(ex, level);
          }), goal
        );
      }

      // Intento 4 (A2): cualquier grupo, cualquier nivel — con 43 ejercicios de
      // peso corporal en la biblioteca esto no debería quedar vacío nunca.
      if (!candidates.length) {
        candidates = sortByPriority(
          Object.values(EXERCISE_LIBRARY).filter((ex) => {
            if (!exerciseFitsEquipment(ex, equipment)) return false;
            if (sessionExcluded.has(ex.id)) return false;
            return true;
          }), goal
        );
      }

      if (!candidates.length) return;

      const ex = candidates[0];
      usedInSession.add(ex.id);

      // Uniarticulares siempre con parámetros de hipertrofia
      const params = ex.isCompound ? goalParams : GOAL_PARAMS.hypertrophy;
      exercises.push(buildExConfig(ex, params, false, limitedGroups, limitations, isLimited));
    });

    // B3: recortar accesorios si la sesión excede el presupuesto de tiempo.
    const budgetedExercises = trimToTimeBudget(exercises, sessionMinutes);

    sessionTemplates[templateId] = {
      id: templateId,
      programId,
      label: dayDef.label,
      name: dayDef.name,
      emphasis: dayDef.emphasis,
      color: dayDef.color,
      generatedWarmup: buildWarmup(primaryKeyEx),
      exercises: budgetedExercises.map((e, idx) => ({ ...e, order: idx + 1 })),
    };

    programDays.push({ sessionTemplateId: templateId, label: dayDef.label, emphasis: dayDef.emphasis });
  });

  // Una etapa, sin límite de ciclos (`durationWeeks: null`): es el
  // comportamiento que tenía un programa generado antes de unificar el modelo,
  // y el onboarding no pregunta duración (ver `docs/specs/stage-planner.md`
  // §3.2.h). El usuario se la pone desde el editor cuando quiera.
  const program = withStages(
    {
      id: programId,
      name: buildProgramName(discipline, distribution, goal),
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

// ─── Helpers de construcción ──────────────────────────────────────────────────

function buildExConfig(ex, goalParams, isKey, limitedGroups, limitations, isLimitedSlot = false) {
  const isLimited = limitedGroups.includes(ex.primaryGroup) || isLimitedSlot;

  const params = isLimited
    ? { sets: 2, restSec: 60 }
    : { sets: isKey ? goalParams.sets : Math.max(2, goalParams.sets - 1), restSec: isKey ? goalParams.restSec : Math.round(goalParams.restSec * 0.75) };

  const repParams = ex.progressionModel === 'time_progression' || ex.progressionModel === 'submax'
    ? {}
    : { minReps: isLimited ? 12 : goalParams.minReps, maxReps: isLimited ? 15 : goalParams.maxReps };

  const limitationNote = isLimited ? getLimitationNote(ex.primaryGroup, limitations) : null;

  return { exerciseId: ex.id, isKey, sets: params.sets, restSec: params.restSec, progressionOverride: null, limitationNote, ...repParams };
}

function getLimitationNote(group, limitations) {
  const match = limitations.find((l) => (LIMITATION_GROUPS[l] ?? []).includes(group));
  return match ? LIMITATION_NOTE[match] : null;
}

function buildWarmup(keyEx) {
  if (!keyEx?.warmup?.length) {
    return ['5–8 min movilidad articular general', '10 rotaciones de hombro', '10 círculos de cadera'];
  }
  return keyEx.warmup;
}

function buildProgramName(discipline, distribution, goal) {
  const disciplines = {
    standard:      'Full Body',
    calisthenics:  'Calistenia',
    glutes_legs:   'Pierna & Glúteo',
    strength:      'Fuerza',
  };
  const distributions = {
    full_body:      'Full Body',
    upper_lower:    'Upper / Lower',
    push_pull_legs: 'Push / Pull / Pierna',
  };
  const goals = {
    hypertrophy:  'Hipertrofia',
    strength:     'Fuerza',
    max_strength: 'Fuerza Máxima',
    endurance:    'Resistencia',
  };
  const distLabel = discipline === 'standard' ? distributions[distribution] : disciplines[discipline];
  return `${distLabel} · ${goals[goal] ?? goal}`;
}
