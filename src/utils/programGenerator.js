/**
 * Generador de programas a partir de las respuestas del onboarding.
 * Lógica pura — sin dependencias de React ni del store.
 */

import { EXERCISE_LIBRARY } from '../data/exerciseLibrary';
import { generateId } from './formatters';

// ─── Parámetros por objetivo ──────────────────────────────────────────────────

const GOAL_PARAMS = {
  hypertrophy:  { sets: 3, minReps: 8,  maxReps: 12, restSec: 90  },
  strength:     { sets: 4, minReps: 5,  maxReps: 8,  restSec: 120 },
  max_strength: { sets: 5, minReps: 3,  maxReps: 5,  restSec: 180 },
  endurance:    { sets: 3, minReps: 12, maxReps: 20, restSec: 60  },
};

// ─── Colores y etiquetas de días ─────────────────────────────────────────────

const DAY_COLORS = ['#e8ff47', '#ff6b35', '#7eb8ff', '#a78bfa', '#34d399', '#f472b6'];
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
      if (keyOnly) return false;
      return ex.level === 'beginner';
    }
    if (keyOnly && ex.priority?.[goal] === 'low') return false;
    return exerciseFitsLevel(ex, level);
  });

  return sortByPriority(raw, goal);
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
  } = answers;

  const goalParams = GOAL_PARAMS[goal] ?? GOAL_PARAMS.hypertrophy;
  const patternKey = `${discipline}_${distribution}`;
  const patternDays = DISTRIBUTION_PATTERNS[patternKey]?.days
    ?? DISTRIBUTION_PATTERNS.standard_full_body.days;
  const limitedGroups = getLimitedGroups(limitations);

  const exercisesPerSession = daysPerWeek <= 3 ? 5 : 4;
  const keysPerSession = 2; // siempre intentamos 2 keys

  const programId = generateId('prog');
  const sessionTemplates = {};
  const programDays = [];

  // Solo excludedByVariant es global — evita asistidas junto a no-asistidas en todo el programa
  // usedKeyIds se declara dentro del forEach — un key puede repetirse en días distintos
  const excludedByVariant = new Set();

  const activeDays = patternDays
    .slice(0, Math.min(daysPerWeek, patternDays.length))
    .map((dayDef, i) => ({
      ...dayDef,
      label: DAY_LABELS[i] ?? String(i + 1),
      color: DAY_COLORS[i] ?? '#e8ff47',
    }));

  activeDays.forEach((dayDef) => {
    const templateId = generateId('tpl');
    const exercises = [];
    const usedInSession = new Set(); // evitar repetir en el mismo día

    // ── Keys ─────────────────────────────────────────────────────────
    const keyGroups = [dayDef.keyGroup, dayDef.keyGroup2].filter(Boolean);
    const keyExercises = [];

    keyGroups.slice(0, keysPerSession).forEach((keyGroup) => {
      const candidates = getCandidates({
        primaryGroup: keyGroup,
        level, equipment, limitations,
        keyOnly: true, goal,
        excludedIds: new Set([...excludedByVariant, ...usedInSession]),
      });

      if (!candidates.length) return;

      const keyEx = candidates[0];
      usedInSession.add(keyEx.id);
      getRelatedIds(keyEx).forEach((id) => excludedByVariant.add(id));
      keyExercises.push(keyEx);
      exercises.push(buildExConfig(keyEx, goalParams, true, limitedGroups, limitations));
    });

    const primaryKeyEx = keyExercises[0] ?? null;

    // ── Accesorios ───────────────────────────────────────────────────
    const accessoryCount = exercisesPerSession - keyExercises.length;
    const accessorySlots = dayDef.accessories.slice(0, accessoryCount);

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

      if (!candidates.length) return;

      const ex = candidates[0];
      usedInSession.add(ex.id);

      // Uniarticulares siempre con parámetros de hipertrofia
      const params = ex.isCompound ? goalParams : GOAL_PARAMS.hypertrophy;
      exercises.push(buildExConfig(ex, params, false, limitedGroups, limitations, isLimited));
    });

    sessionTemplates[templateId] = {
      id: templateId,
      programId,
      label: dayDef.label,
      name: dayDef.name,
      emphasis: dayDef.emphasis,
      color: dayDef.color,
      generatedWarmup: buildWarmup(primaryKeyEx),
      exercises: exercises.map((e, idx) => ({ ...e, order: idx + 1 })),
    };

    programDays.push({ sessionTemplateId: templateId, label: dayDef.label, emphasis: dayDef.emphasis });
  });

  const program = {
    id: programId,
    name: buildProgramName(discipline, distribution, goal),
    type: 'primary',
    status: 'active',
    createdAt: new Date().toISOString().split('T')[0],
    currentWeek: 1,
    onboardingSnapshot: answers,
    days: programDays,
  };

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
