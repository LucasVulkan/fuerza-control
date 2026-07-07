import { describe, it, expect } from 'vitest';
import { generateProgram, GOAL_PARAMS } from './programGenerator';
import { adaptArchetype } from './archetypeAdapter';
import { findBestArchetype } from '../data/archetypes';
import { EXERCISE_LIBRARY } from '../data/exerciseLibrary';

// ─── Replica de la normalización que hace generateAndActivateProgram ─────────
// (mobile/store/useStore.js ~línea 277) — machines implica cables.
function normalizeEquipment(equipment) {
  return equipment.includes('machines') && !equipment.includes('cables')
    ? [...equipment, 'cables']
    : equipment;
}

/** Replica el camino real: arquetipo si hay match, si no procedural. */
function runOnboarding(answers) {
  const normalized = { ...answers, equipment: normalizeEquipment(answers.equipment) };
  const archetype = findBestArchetype(normalized);
  return archetype ? adaptArchetype(archetype, normalized) : generateProgram(normalized);
}

function exerciseFitsEquipment(ex, equipment) {
  if (!ex.equipment || ex.equipment.length === 0) return true;
  return ex.equipment.some((e) => equipment.includes(e));
}

const ALL_EXERCISES = Object.values(EXERCISE_LIBRARY);

/**
 * Excepción aceptable a "≥1 key": el/los grupo(s) que esta emphasis usa como
 * keyGroup en DISTRIBUTION_PATTERNS no tienen NINGÚN ejercicio compuesto que
 * encaje con el equipo dado (p. ej. `back` no tiene ni un solo ejercicio
 * bodyweight-only en toda la librería) — no es un hueco que el generador esté
 * descartando pudiendo llenarlo, es la biblioteca agotada.
 */
const EMPHASIS_KEY_GROUPS = {
  pull: ['back'], push: ['chest', 'shoulders'], legs: ['quads', 'glutes_hamstrings'],
  upper: ['back', 'chest'], lower: ['quads', 'glutes_hamstrings'],
  glutes: ['glutes_hamstrings'], legs_pull: ['quads', 'back'],
  full: ['back', 'quads', 'glutes_hamstrings', 'chest'],
};

function noKeyGroupHasCompound(emphasis, equipment) {
  const groups = EMPHASIS_KEY_GROUPS[emphasis] ?? [];
  return groups.every((g) => !ALL_EXERCISES.some(
    (ex) => ex.primaryGroup === g && ex.isCompound && exerciseFitsEquipment(ex, equipment)
  ));
}

/** Corre las invariantes sobre un {program, sessionTemplates} ya generado. */
function checkInvariants(result, answers, normalizedEquipment) {
  const { program, sessionTemplates } = result;
  const violations = [];

  // La matriz solo pasa daysPerWeek == nº natural de la distribución para U/L (2/4)
  // y PPL (3) — igual que hace el selector real — así que el check es uniforme.
  if (program.days.length !== answers.daysPerWeek) {
    violations.push(`sessions: got ${program.days.length}, expected ${answers.daysPerWeek}`);
  }

  program.days.forEach((d) => {
    const tpl = sessionTemplates[d.sessionTemplateId];
    if (!tpl) { violations.push(`missing template for day ${d.label}`); return; }

    const hasKey = tpl.exercises.some((e) => e.isKey);
    if (!hasKey && !noKeyGroupHasCompound(tpl.emphasis, normalizedEquipment)) {
      violations.push(`day ${tpl.label}: no key exercise (and library has compounds for [${tpl.emphasis}] with this equipment)`);
    }

    const ids = tpl.exercises.map((e) => e.exerciseId);
    const uniqueIds = new Set(ids);
    if (uniqueIds.size !== ids.length) violations.push(`day ${tpl.label}: duplicate exerciseIds (${ids.join(',')})`);

    tpl.exercises.forEach((e) => {
      const def = EXERCISE_LIBRARY[e.exerciseId];
      if (!def) { violations.push(`day ${tpl.label}: unknown exerciseId ${e.exerciseId}`); return; }
      if (!exerciseFitsEquipment(def, normalizedEquipment)) {
        violations.push(`day ${tpl.label}: ${e.exerciseId} needs [${def.equipment}] not in [${normalizedEquipment}]`);
      }
    });

    if (tpl.exercises.length < 4) {
      // Excepción aceptable: la biblioteca no da más de sí con estos filtros.
      // No lo tratamos como violación automática — se cuenta aparte para inspección.
      violations.push(`__short__ day ${tpl.label}: only ${tpl.exercises.length} exercises`);
    }
  });

  return violations;
}

// ─── Matriz representativa (~400-600 combos) ─────────────────────────────────

const LEVELS = ['beginner', 'intermediate', 'advanced'];
const GOALS = ['hypertrophy', 'strength', 'max_strength', 'endurance'];
const LIMITATIONS = [['none'], ['shoulder'], ['lower_back'], ['knee']];
const EQUIPMENT_SETS = [
  ['dumbbells'],
  [],
  ['machines', 'dumbbells'],
  ['pullup_bar', 'parallettes'],
  ['dumbbells', 'machines', 'cables', 'barbell', 'pullup_bar', 'kettlebell'],
];

// discipline+distribution+daysPerWeek reachable combos (espejo del selector real)
const DISCIPLINES = ['standard', 'calisthenics', 'glutes_legs', 'strength'];
const STRUCTURE_COMBOS = [
  { distribution: 'full_body', days: [2, 3, 4, 5, 6] },
  { distribution: 'upper_lower', days: [2, 4] },
  { distribution: 'push_pull_legs', days: [3] },
];

function buildMatrix() {
  const combos = [];
  DISCIPLINES.forEach((discipline) => {
    STRUCTURE_COMBOS.forEach(({ distribution, days }) => {
      days.forEach((daysPerWeek) => {
        LEVELS.forEach((level) => {
          GOALS.forEach((goal, gi) => {
            // Reducir densidad: limitación y equipo rotan por índice para no
            // explotar el producto cartesiano completo (representativo, no exhaustivo).
            const limitations = LIMITATIONS[(gi + LEVELS.indexOf(level)) % LIMITATIONS.length];
            const equipment = EQUIPMENT_SETS[(gi + daysPerWeek) % EQUIPMENT_SETS.length];
            combos.push({ level, discipline, distribution, daysPerWeek, goal, equipment, limitations });
          });
        });
      });
    });
  });
  return combos;
}

const MATRIX = buildMatrix();

describe(`invariantes del generador — matriz representativa (${MATRIX.length} combos)`, () => {
  it('nº de combos está en el rango esperado (~400-600)', () => {
    expect(MATRIX.length).toBeGreaterThan(300);
    expect(MATRIX.length).toBeLessThan(700);
  });

  const allViolations = [];
  let shortSessions = 0;

  MATRIX.forEach((answers, i) => {
    it(`combo #${i}: ${answers.discipline}/${answers.distribution}/${answers.daysPerWeek}d/${answers.level}/${answers.goal}/[${answers.equipment}]/[${answers.limitations}]`, () => {
      const normalizedEquipment = normalizeEquipment(answers.equipment);
      const result = runOnboarding(answers);
      const violations = checkInvariants(result, answers, normalizedEquipment);

      const real = [];
      violations.forEach((v) => {
        if (v.startsWith('__short__')) {
          shortSessions++;
          allViolations.push(v);
        } else {
          real.push(v);
          allViolations.push(v);
        }
      });

      expect(real, real.join('\n')).toEqual([]);
    });
  });

  it('reporte de sesiones cortas (<4 ejercicios) — informativo, no debe superar un puñado', () => {
    // No hay un límite exacto en la spec; lo que importa es que sean casos de
    // biblioteca agotada (bodyweight + limitaciones), no huecos descartados.
    console.log(`Sesiones <4 ejercicios: ${shortSessions} / matriz de ${MATRIX.length} combos`);
    expect(shortSessions).toBeLessThan(MATRIX.length * 0.1);
  });
});

// ─── Casos de regresión con nombre propio ────────────────────────────────────

describe('regresión — casos con nombre propio', () => {
  it('beginner + dumbbells + hipertrofia + full_body 3d → todas las sesiones con key', () => {
    const result = runOnboarding({
      level: 'beginner', discipline: 'standard', distribution: 'full_body',
      daysPerWeek: 3, goal: 'hypertrophy', equipment: ['dumbbells'], limitations: ['none'],
    });
    expect(result.program.days.length).toBe(3);
    result.program.days.forEach((d) => {
      const tpl = result.sessionTemplates[d.sessionTemplateId];
      expect(tpl.exercises.some((e) => e.isKey)).toBe(true);
    });
  });

  it('limitación shoulder + PPL → el día de Empuje conserva ≥1 key sustituido con limitationNote', () => {
    const result = runOnboarding({
      level: 'intermediate', discipline: 'standard', distribution: 'push_pull_legs',
      daysPerWeek: 3, goal: 'hypertrophy', equipment: ['dumbbells', 'machines', 'cables', 'barbell'],
      limitations: ['shoulder'],
    });
    const pushDay = result.program.days.find((d) => d.emphasis === 'push');
    expect(pushDay).toBeTruthy();
    const tpl = result.sessionTemplates[pushDay.sessionTemplateId];
    const limitedKeys = tpl.exercises.filter((e) => e.isKey && e.limitationNote);
    expect(limitedKeys.length).toBeGreaterThanOrEqual(1);
  });

  it('equipment: [] (bodyweight) → programa completo, solo ejercicios sin equipo', () => {
    const result = runOnboarding({
      level: 'beginner', discipline: 'standard', distribution: 'full_body',
      daysPerWeek: 3, goal: 'hypertrophy', equipment: [], limitations: ['none'],
    });
    expect(result.program.days.length).toBe(3);
    result.program.days.forEach((d) => {
      const tpl = result.sessionTemplates[d.sessionTemplateId];
      tpl.exercises.forEach((e) => {
        const def = EXERCISE_LIBRARY[e.exerciseId];
        expect(!def.equipment || def.equipment.length === 0).toBe(true);
      });
    });
  });

  it('fuerza + full_body + 5 días → 5 sesiones', () => {
    const result = runOnboarding({
      level: 'intermediate', discipline: 'strength', distribution: 'full_body',
      daysPerWeek: 5, goal: 'strength', equipment: ['dumbbells', 'machines', 'cables', 'barbell'],
      limitations: ['none'],
    });
    expect(result.program.days.length).toBe(5);
  });

  it('adaptArchetype con goal=strength sobre arquetipo hypertrophy → los keys llevan reps de fuerza (5-8)', () => {
    const archetype = findBestArchetype({
      discipline: 'standard', distribution: 'full_body', goal: 'hypertrophy',
      level: 'intermediate', daysPerWeek: 3,
    });
    expect(archetype).toBeTruthy();
    expect(archetype.goal).toBe('hypertrophy');

    const result = adaptArchetype(archetype, {
      level: 'intermediate', equipment: ['dumbbells', 'machines', 'cables', 'barbell'],
      limitations: ['none'], goal: 'strength',
    });

    const strengthParams = GOAL_PARAMS.strength;
    result.program.days.forEach((d) => {
      const tpl = result.sessionTemplates[d.sessionTemplateId];
      tpl.exercises.filter((e) => e.isKey).forEach((e) => {
        const def = EXERCISE_LIBRARY[e.exerciseId];
        if (def.minReps === null) return; // tiempo/submáx — no se tocan
        expect(e.minReps).toBe(strengthParams.minReps);
        expect(e.maxReps).toBe(strengthParams.maxReps);
      });
    });
  });
});
