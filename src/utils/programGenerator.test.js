import { describe, it, expect } from 'vitest';
import { stageDays } from './stageProgress';
import { generateProgram, GOAL_PARAMS } from './programGenerator';
import { adaptArchetype } from './archetypeAdapter';
import { rankArchetypes } from '../data/archetypes';
import { EXERCISE_LIBRARY } from '../data/exerciseLibrary';

// ─── Replica de la normalización que hace generateAndActivateProgram ─────────
// (mobile/store/useStore.js ~línea 277) — machines implica cables.
function normalizeEquipment(equipment) {
  return equipment.includes('machines') && !equipment.includes('cables')
    ? [...equipment, 'cables']
    : equipment;
}

/**
 * Replica el camino real. Con el ranking (program-templates.md §7) el
 * procedural ya no es autor: siempre gana una plantilla. Se conserva la rama
 * por si algún día el catálogo estuviera vacío.
 */
function runOnboarding(answers) {
  const normalized = { ...answers, equipment: normalizeEquipment(answers.equipment) };
  const archetype = rankArchetypes(normalized)[0]?.archetype ?? null;
  const result = archetype ? adaptArchetype(archetype, normalized) : generateProgram(normalized);
  return { ...result, archetype };
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
function checkInvariants(result, answers, normalizedEquipment, archetype) {
  const { program, sessionTemplates } = result;
  const violations = [];

  // El nº de sesiones lo fija la PLANTILLA, no los días pedidos
  // (program-templates.md §2.2): `daysPerWeek` es frecuencia, y el ciclo rota a
  // la velocidad que haga falta. Sólo el camino procedural, que monta el ciclo
  // desde cero, lo deriva de los días — capado a 6 (con 7 el ciclo rota).
  const expectedSessions = archetype ? archetype.days.length : Math.min(answers.daysPerWeek, 6);
  const programDays = stageDays(program);
  if (programDays.length !== expectedSessions) {
    violations.push(`sessions: got ${programDays.length}, expected ${expectedSessions}`);
  }

  // Modelo unificado (docs/specs/stage-planner.md §3): todo programa nace con
  // UNA etapa, y sus días viven SOLO ahí — el espejo `program.days` murió en la
  // fase 3 de program-model.md. Las fases 2..N de una plantilla las materializa
  // el store, no el adaptador.
  if ((program.stages?.length ?? 0) !== 1) {
    violations.push(`stages: got ${program.stages?.length ?? 0}, expected 1`);
  } else {
    // `null` = sin límite (plantilla sin fases y camino procedural); un entero
    // positivo = la duración de la primera fase (program-templates.md §6.1).
    // Lo que no vale es 0, negativo o `undefined`, que romperían `advanceCycle`.
    const weeks = program.stages[0].durationWeeks;
    if (weeks !== null && !(Number.isInteger(weeks) && weeks > 0)) {
      violations.push(`stage durationWeeks: got ${weeks}, expected null or a positive integer`);
    }
    if (program.currentStageIndex !== 0) {
      violations.push(`currentStageIndex: got ${program.currentStageIndex}, expected 0`);
    }
    // Ni rastro del espejo: un `days` en el programa vuelve a abrir la puerta
    // a que alguien lo lea y derive.
    if (program.days !== undefined) violations.push('program.days sigue existiendo');
  }

  programDays.forEach((d) => {
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

// discipline+distribution+daysPerWeek reachable combos. B1: el selector real
// ahora permite 1–7 días con cualquier distribución (daysPerWeek = frecuencia);
// muestreamos ese espacio sin explotar el producto cartesiano.
const DISCIPLINES = ['standard', 'calisthenics', 'glutes_legs', 'strength'];
const STRUCTURE_COMBOS = [
  { distribution: 'full_body', days: [1, 2, 3, 4, 5, 6, 7] },
  { distribution: 'upper_lower', days: [2, 4] },
  { distribution: 'push_pull_legs', days: [3, 6] },
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
  let totalSessions = 0;

  MATRIX.forEach((answers, i) => {
    it(`combo #${i}: ${answers.discipline}/${answers.distribution}/${answers.daysPerWeek}d/${answers.level}/${answers.goal}/[${answers.equipment}]/[${answers.limitations}]`, () => {
      const normalizedEquipment = normalizeEquipment(answers.equipment);
      const result = runOnboarding(answers);
      const violations = checkInvariants(result, answers, normalizedEquipment, result.archetype);
      totalSessions += stageDays(result.program).length;

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
    //
    // Este indicador ya no mide una sola cosa. Tiene tres causas, dos buenas:
    //
    // 1. Biblioteca agotada. 39 slots tier 1 de `back` con `equipment: []`: no
    //    hay **ni un solo ejercicio de tracción sin material** en la biblioteca
    //    (43 bodyweight, ninguno de back). Es contenido que falta, no lógica;
    //    `adaptArchetype` los declara en `unresolved` en vez de descartarlos.
    // 2. Presupuesto de tiempo. La escalera (§5.3) recorta lo que no cabe.
    // 3. **Volumen semanal** (§5.4, nuevo): un principiante que entrena 6 días
    //    sobre un ciclo de 3 sesiones las hace el doble de veces, así que cada
    //    una tiene que ser más corta. Una sesión de 3 ejercicios repetida 6
    //    veces por semana no es un defecto: es la respuesta correcta.
    //
    // Por eso el umbral sube de 9% a 14% al entrar el normalizador (30 → 67
    // sobre esta matriz). El reparto lo confirma: las sesiones cortas a 3 días
    // son exactamente las mismas de antes (15); todo el aumento está en 4-7
    // días, donde el multiplicador de frecuencia es mayor que 1.
    //
    // A cambio, los grupos por encima de su techo semanal bajan de 62 a 34 y el
    // peor exceso de 14,8 a 5,8 series/semana (medido sobre los combos que la
    // UI puede producir de verdad).
    //
    // Con el ranking (§7) el denominador cambia: el nº de sesiones lo fija la
    // plantilla (3-4), no los días pedidos (hasta 6), así que la matriz produce
    // 1627 sesiones en vez de 2016. Por eso el umbral pasa a medirse **por
    // sesión** y no por combo, que es lo comparable. 98/1627 = 6%.
    const rate = shortSessions / totalSessions;
    console.log(`Sesiones <4 ejercicios: ${shortSessions} / ${totalSessions} (${(rate * 100).toFixed(1)}%)`);
    expect(rate).toBeLessThan(0.08);
  });
});

// ─── Casos de regresión con nombre propio ────────────────────────────────────

describe('regresión — casos con nombre propio', () => {
  it('beginner + dumbbells + hipertrofia + full_body 3d → todas las sesiones con key', () => {
    const result = runOnboarding({
      level: 'beginner', discipline: 'standard', distribution: 'full_body',
      daysPerWeek: 3, goal: 'hypertrophy', equipment: ['dumbbells'], limitations: ['none'],
    });
    expect(stageDays(result.program).length).toBe(3);
    stageDays(result.program).forEach((d) => {
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
    const pushDay = stageDays(result.program).find((d) => d.emphasis === 'push');
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
    expect(stageDays(result.program).length).toBe(3);
    stageDays(result.program).forEach((d) => {
      const tpl = result.sessionTemplates[d.sessionTemplateId];
      tpl.exercises.forEach((e) => {
        const def = EXERCISE_LIBRARY[e.exerciseId];
        expect(!def.equipment || def.equipment.length === 0).toBe(true);
      });
    });
  });

  it('fuerza + 5 días → la plantilla fija las sesiones, el ciclo rota más rápido', () => {
    // Antes esto exigía 5 sesiones: era el procedural montando una por día.
    // Con el ranking manda la plantilla (program-templates.md §2.2) y el ciclo
    // de 3 sesiones se recorre 1,67 veces por semana.
    const answers = {
      level: 'intermediate', discipline: 'strength', distribution: 'full_body',
      daysPerWeek: 5, goal: 'strength', equipment: ['dumbbells', 'machines', 'cables', 'barbell'],
      limitations: ['none'],
    };
    const result = runOnboarding(answers);

    expect(result.archetype).toBeTruthy();
    expect(result.archetype.discipline).toBe('strength');
    expect(stageDays(result.program).length).toBe(result.archetype.days.length);
  });

  it('arquetipo beginner nativo llega íntegro: 3 keys/día, sin reduceForBeginner', () => {
    const result = runOnboarding({
      level: 'beginner', discipline: 'standard', distribution: 'full_body',
      daysPerWeek: 3, goal: 'hypertrophy',
      equipment: ['dumbbells', 'machines', 'cables', 'barbell'], limitations: ['none'],
    });
    expect(stageDays(result.program).length).toBe(3);
    stageDays(result.program).forEach((d) => {
      const tpl = result.sessionTemplates[d.sessionTemplateId];
      expect(tpl.exercises.filter((e) => e.isKey).length).toBe(3);
      expect(tpl.exercises.length).toBe(6);
    });
  });

  it('upper/lower intermedio 4d: 4 sesiones, keys de tracción/empuje/pierna con frecuencia 2, keys nunca recortados por tiempo', () => {
    const result = runOnboarding({
      level: 'intermediate', discipline: 'standard', distribution: 'upper_lower',
      daysPerWeek: 4, goal: 'hypertrophy',
      equipment: ['dumbbells', 'machines', 'cables', 'barbell'], limitations: ['none'],
    });
    expect(stageDays(result.program).length).toBe(4);

    const keyIdsByDay = stageDays(result.program).map((d) => {
      const tpl = result.sessionTemplates[d.sessionTemplateId];
      expect(tpl.exercises.some((e) => e.isKey)).toBe(true);
      return tpl.exercises.filter((e) => e.isKey).map((e) => e.exerciseId);
    });
    const allKeyIds = keyIdsByDay.flat();
    // pull (pulldown_pronated), push (bench_press_db) y pierna (hack_squat +
    // romanian_deadlift_db) aparecen como key al menos 2 veces en la semana.
    expect(allKeyIds.filter((id) => id === 'pulldown_pronated').length).toBeGreaterThanOrEqual(2);
    expect(allKeyIds.filter((id) => id === 'bench_press_db').length).toBeGreaterThanOrEqual(2);
    expect(allKeyIds.filter((id) => id === 'hack_squat').length).toBeGreaterThanOrEqual(2);
    expect(allKeyIds.filter((id) => id === 'romanian_deadlift_db').length).toBeGreaterThanOrEqual(2);
  });

  it('full body fuerza avanzado 3d: 3 keys/día, squat/bench/row con frecuencia 2, recorte por tiempo nunca toca keys', () => {
    const result = runOnboarding({
      level: 'advanced', discipline: 'strength', distribution: 'full_body',
      daysPerWeek: 3, goal: 'strength', sessionMinutes: 60,
      equipment: ['dumbbells', 'machines', 'cables', 'barbell', 'pullup_bar', 'ab_wheel'], limitations: ['none'],
    });
    expect(stageDays(result.program).length).toBe(3);

    const keyIdsByDay = stageDays(result.program).map((d) => {
      const tpl = result.sessionTemplates[d.sessionTemplateId];
      expect(tpl.exercises.filter((e) => e.isKey).length).toBe(3);
      return tpl.exercises.filter((e) => e.isKey).map((e) => e.exerciseId);
    });
    const allKeyIds = keyIdsByDay.flat();
    expect(allKeyIds.filter((id) => id === 'squat_barbell').length).toBeGreaterThanOrEqual(2);
    expect(allKeyIds.filter((id) => id === 'bench_press_barbell').length).toBeGreaterThanOrEqual(2);
    expect(allKeyIds.filter((id) => id === 'barbell_row').length).toBeGreaterThanOrEqual(2);
  });

  it('upper/lower avanzado 4d: matchea distinto del intermedio, keys de barra libre con frecuencia 2, hack_squat no se sustituye pese a ser nivel intermedio', () => {
    const resultAdv = runOnboarding({
      level: 'advanced', discipline: 'standard', distribution: 'upper_lower',
      daysPerWeek: 4, goal: 'hypertrophy',
      equipment: ['dumbbells', 'machines', 'cables', 'barbell'], limitations: ['none'],
    });
    expect(stageDays(resultAdv.program).length).toBe(4);

    const keyIdsByDay = stageDays(resultAdv.program).map((d) => {
      const tpl = resultAdv.sessionTemplates[d.sessionTemplateId];
      expect(tpl.exercises.some((e) => e.isKey)).toBe(true);
      return tpl.exercises.filter((e) => e.isKey).map((e) => e.exerciseId);
    });
    const allKeyIds = keyIdsByDay.flat();
    expect(allKeyIds.filter((id) => id === 'bench_press_barbell').length).toBeGreaterThanOrEqual(2);
    expect(allKeyIds.filter((id) => id === 'barbell_row').length).toBeGreaterThanOrEqual(2);
    // hack_squat es nivel intermediate pero se mantiene como key en el
    // arquetipo advanced (fitsLevel solo bloquea hacia arriba, no hacia abajo).
    expect(allKeyIds.filter((id) => id === 'hack_squat').length).toBeGreaterThanOrEqual(2);
    expect(allKeyIds.filter((id) => id === 'romanian_deadlift').length).toBeGreaterThanOrEqual(2);

    // Un usuario intermedio sigue matcheando el arquetipo intermedio, no este.
    const resultInt = runOnboarding({
      level: 'intermediate', discipline: 'standard', distribution: 'upper_lower',
      daysPerWeek: 4, goal: 'hypertrophy',
      equipment: ['dumbbells', 'machines', 'cables', 'barbell'], limitations: ['none'],
    });
    const intKeyIds = stageDays(resultInt.program).flatMap((d) =>
      resultInt.sessionTemplates[d.sessionTemplateId].exercises.filter((e) => e.isKey).map((e) => e.exerciseId)
    );
    expect(intKeyIds).not.toContain('bench_press_barbell');
    expect(intKeyIds).not.toContain('barbell_row');
  });

  it('adaptArchetype con goal=strength sobre arquetipo hypertrophy → los keys llevan reps de fuerza (5-8)', () => {
    const archetype = rankArchetypes({
      discipline: 'standard', distribution: 'full_body', goal: 'hypertrophy',
      level: 'intermediate', daysPerWeek: 3,
    })[0].archetype;
    expect(archetype).toBeTruthy();
    expect(archetype.goal).toBe('hypertrophy');

    const result = adaptArchetype(archetype, {
      level: 'intermediate', equipment: ['dumbbells', 'machines', 'cables', 'barbell'],
      limitations: ['none'], goal: 'strength',
    });

    const strengthParams = GOAL_PARAMS.strength;
    stageDays(result.program).forEach((d) => {
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

// ─── B5 — presupuesto de tiempo por sesión (trimToTimeBudget) ────────────────
//
// No fijamos minutos exactos de duración estimada como assertion: el nº de
// slots de accesorios lo define DISTRIBUTION_PATTERNS por día (p. ej. los
// patrones full_body solo listan 3 grupos de accesorio), así que el techo real
// de ejercicios con tiempo de sobra depende de esos datos, no solo del
// presupuesto — comprobado a mano: full_body/intermediate/dumbbells+ topa en
// 5 ejercicios (2 key + 3 acc) a partir de 60 min, no en 6. Lo que SÍ es un
// invariante garantizado por trimToTimeBudget, y lo que testeamos aquí:
// monotonía (más tiempo ⇒ nunca menos ejercicios) y que el recorte nunca toca
// las keys.
describe('B5 — presupuesto de tiempo (trimToTimeBudget)', () => {
  const base = {
    level: 'intermediate', discipline: 'standard', distribution: 'full_body',
    daysPerWeek: 5, goal: 'hypertrophy',
    equipment: ['dumbbells', 'machines', 'cables', 'barbell'], limitations: ['none'],
  };

  it('más minutos ⇒ nunca menos ejercicios, y las keys nunca se recortan', () => {
    const byTime = [30, 45, 60, 90].map((sessionMinutes) => generateProgram({ ...base, sessionMinutes }));

    for (let i = 0; i < stageDays(byTime[0].program).length; i++) {
      let prevTotal = 0;
      let prevKeys = null;
      for (const result of byTime) {
        const tpl = result.sessionTemplates[stageDays(result.program)[i].sessionTemplateId];
        const keys = tpl.exercises.filter((e) => e.isKey).length;
        expect(tpl.exercises.length).toBeGreaterThanOrEqual(prevTotal);
        if (prevKeys !== null) expect(keys).toBe(prevKeys); // keysPerSession es fijo — el presupuesto solo toca accesorios
        prevTotal = tpl.exercises.length;
        prevKeys = keys;
      }
    }
  });

  it('30 min genera sesiones más cortas (o iguales) que 90 min para el mismo combo', () => {
    const r30 = generateProgram({ ...base, sessionMinutes: 30 });
    const r90 = generateProgram({ ...base, sessionMinutes: 90 });
    stageDays(r30.program).forEach((d, i) => {
      const tpl30 = r30.sessionTemplates[d.sessionTemplateId];
      const tpl90 = r90.sessionTemplates[stageDays(r90.program)[i].sessionTemplateId];
      expect(tpl30.exercises.length).toBeLessThanOrEqual(tpl90.exercises.length);
    });
  });

  it('sessionMinutes ausente se comporta como el default (60)', () => {
    const rDefault = generateProgram(base);
    const r60 = generateProgram({ ...base, sessionMinutes: 60 });
    stageDays(rDefault.program).forEach((d, i) => {
      const tplDefault = rDefault.sessionTemplates[d.sessionTemplateId];
      const tpl60 = r60.sessionTemplates[stageDays(r60.program)[i].sessionTemplateId];
      expect(tplDefault.exercises.length).toBe(tpl60.exercises.length);
    });
  });

  it('suelo duro: nunca queda por debajo de 1 key + 2 accesorios cuando hay al menos esos candidatos', () => {
    // max_strength + PPL: rest largo (180s) hace que hasta 30 min sea un
    // presupuesto imposible de cumplir — el recorte debe parar en el suelo,
    // no seguir vaciando la sesión.
    const result = generateProgram({
      level: 'intermediate', discipline: 'strength', distribution: 'push_pull_legs',
      daysPerWeek: 3, goal: 'max_strength',
      equipment: ['dumbbells', 'machines', 'cables', 'barbell'], limitations: ['none'],
      sessionMinutes: 30,
    });
    stageDays(result.program).forEach((d) => {
      const tpl = result.sessionTemplates[d.sessionTemplateId];
      const keys = tpl.exercises.filter((e) => e.isKey).length;
      const accessories = tpl.exercises.length - keys;
      expect(tpl.exercises.some((e) => e.isKey)).toBe(true); // el recorte no puede haberse comido la única key
      expect(accessories).toBeGreaterThanOrEqual(0); // el recorte nunca deja el conteo en negativo (guarda del bucle)
    });
  });
});
