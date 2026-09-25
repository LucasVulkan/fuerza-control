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
import { autoLinkRepeated } from './exerciseLinks';
import { compressSession } from './sessionCompression';
import { resolveSlot, fitsEquipment, fitsLevel } from './slotResolver';
import { withStages } from './stageProgress';
import { normalizeWeeklyVolume } from './weeklyVolume';

// Series/reps/descanso por objetivo. Vivían en `programGenerator.js`, que era
// quien las escribía primero; al retirarse el procedural (rediseno.md §4) se
// mudan aquí, su único consumidor.
export const GOAL_PARAMS = {
  hypertrophy:  { sets: 3, minReps: 8,  maxReps: 12, restSec: 90  },
  strength:     { sets: 4, minReps: 5,  maxReps: 8,  restSec: 120 },
  max_strength: { sets: 5, minReps: 3,  maxReps: 5,  restSec: 180 },
  endurance:    { sets: 3, minReps: 12, maxReps: 20, restSec: 60  },
};

// Exportado: el panel de ajustes del onboarding (mobile) lo necesita para
// decidir qué limitación causó una sustitución dada (spec onboarding-simple
// §8 — la etiqueta HOMBRO/LUMBAR/RODILLA).
export const LIMITATION_GROUPS = {
  shoulder:   ['shoulders', 'chest'],
  lower_back: ['glutes_hamstrings', 'back'],
  knee:       ['quads'],
};

const LIMITATION_NOTE = {
  shoulder:   'Ejecuta con rango de movimiento reducido. Para si hay dolor. No llegues al fallo.',
  lower_back: 'Espalda neutra en todo momento. Reduce el peso si notas tensión lumbar.',
  knee:       'No dejes que la rodilla colapse. Reduce rango si hay molestia.',
};

// Ejercicio de core por defecto para rellenar cuando se reduce a beginner
const DEFAULT_CORE_EXERCISES = ['dead_bug', 'plank', 'crunch', 'leg_raise_lying'];

// Tier por defecto cuando la plantilla no lo declara (spec §3.1). El tier vive
// sólo aquí dentro: al exConfig sale como `isKey`, que sigue siendo booleano.
function tierOf(archetypeEx) {
  return archetypeEx.tier ?? (archetypeEx.role === 'key' ? 1 : 3);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getLimitedGroups(limitations) {
  if (!limitations || limitations.includes('none')) return [];
  return limitations.flatMap((l) => LIMITATION_GROUPS[l] ?? []);
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
    // Interno del adaptador (spec §3.3): la escalera de compresión necesita
    // distinguir el complementario del aislamiento, pero al sessionTemplate no
    // sale — `stripTier` lo quita en el último paso.
    tier: tierOf(archetypeEx),
    sets: isLimited ? Math.min(baseSets, 2) : baseSets,
    restSec: baseRestSec,
    minReps: isLimited ? 12 : baseMinReps,
    maxReps: isLimited ? 15 : baseMaxReps,
    progressionOverride: null,
    limitationNote,
  };
}

/** El `tier` no cruza la frontera del adaptador (spec §3.3). */
function stripTier(exConfig) {
  const out = { ...exConfig };
  delete out.tier;
  return out;
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
 *
 * Spec onboarding-simple.md §5.1: hasta ahora el recorte era invisible — el
 * usuario veía menos ejercicios de los que prometía la tarjeta y nadie se lo
 * explicaba. Ahora reporta qué quitó y qué añadió para que el panel de
 * ajustes lo pueda decir.
 */
function reduceForBeginner(exercises, userEquipment) {
  let result = [...exercises];
  const removed = [];

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
    removed.push(removableKey.exerciseId);
  }

  // Eliminar 1 accessory (el último que no sea core)
  const removableAccessory = [...result].reverse().find(
    (ex) => !ex.isKey && groupOf(ex) !== 'core'
  );
  if (removableAccessory) {
    result = result.filter((ex) => ex !== removableAccessory);
    removed.push(removableAccessory.exerciseId);
  }

  // Añadir core si no hay ninguno
  const hasCore = result.some((ex) => groupOf(ex) === 'core');
  let added = null;
  if (!hasCore) {
    const coreEx = DEFAULT_CORE_EXERCISES
      .map((id) => EXERCISE_LIBRARY[id])
      .find((ex) => ex && fitsEquipment(ex, userEquipment));

    if (coreEx) {
      result.push({
        exerciseId: coreEx.id,
        isKey: false,
        tier: 3,
        sets: 3,
        restSec: 60,
        minReps: coreEx.minTime ? null : 12,
        maxReps: coreEx.maxTime ? null : 20,
        progressionOverride: null,
        limitationNote: null,
      });
      added = coreEx.id;
    }
  }

  return { exercises: result, removed, added };
}

// ─── Adaptador principal ──────────────────────────────────────────────────────

/**
 * Adapta un arquetipo a las respuestas del onboarding.
 *
 * Devuelve `{ program, sessionTemplates }` —el formato que espera el store—
 * más el diagnóstico de la adaptación (spec §5.1):
 * `substitutions` (qué cambió y por qué), `unresolved` (slots que la biblioteca
 * no pudo llenar), `overTime` (sesiones que no caben en el presupuesto ni tras
 * la compresión), `weekly` (series semanales por grupo) y `overBudget` (grupos
 * que siguen por encima de su techo porque ya sólo quedan principales). Hoy
 * nadie los consume — el preview lo hará en la fase 6 y el harness en la 7;
 * hasta entonces existen para que dejen de perderse dentro de la función.
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
  const substitutions = [];
  const unresolved = [];
  const overTime = [];
  const levelCuts = [];

  // A4: si el objetivo elegido difiere del objetivo del arquetipo, los keys
  // adoptan los parámetros del goal elegido (ver buildExConfig).
  const applyGoalParams = goal !== archetype.goal;
  const goalParams = GOAL_PARAMS[goal] ?? GOAL_PARAMS.hypertrophy;

  // Dos pasadas: el normalizador de volumen (§5.4) mira el CICLO entero, así que
  // primero se resuelven todas las sesiones y sólo después se montan las
  // plantillas. La compresión por tiempo va después del volumen a propósito
  // (§4): recortar series acorta la sesión, y el tiempo tiene la última palabra.
  const built = archetype.days.map((dayDef) => {
    const templateId = generateId('tpl');
    const usedIds = new Set();
    let exercises = [];

    dayDef.exercises.forEach((archetypeEx) => {
      const originalDef = EXERCISE_LIBRARY[archetypeEx.exerciseId];
      const isLimited = limitedGroups.includes(archetypeEx.primaryGroup);
      const tier = tierOf(archetypeEx);

      // Por qué hay que resolver el slot en vez de usar la preferencia de la
      // plantilla. A3: una limitación NO elimina el ejercicio, lo baja a una
      // variante amable (el resolvedor recibe `userLevel: 'beginner'`).
      const reason =
        !originalDef || !fitsEquipment(originalDef, equipment) ? 'equipment'
        : isLimited                                            ? 'limitation'
        : !fitsLevel(originalDef, level)                       ? 'level'
        // La preferencia ya está en la sesión (dos slots del arquetipo apuntan
        // al mismo ejercicio): se resuelve el segundo en vez de perderlo.
        : usedIds.has(archetypeEx.exerciseId)                  ? 'duplicate'
        : null;

      let resolvedId = archetypeEx.exerciseId;

      if (reason) {
        const resolved = resolveSlot({
          pattern:       archetypeEx.pattern,
          primaryGroup:  archetypeEx.primaryGroup,
          tier,
          goal,
          userLevel:     isLimited ? 'beginner' : level,
          userEquipment: equipment,
          excludeIds:    usedIds,
        });

        if (!resolved) {
          // La biblioteca no da más de sí. No se pierde en silencio: el hueco
          // sale en el resultado y un tier 1 aquí es violación de integridad.
          unresolved.push({ pattern: archetypeEx.pattern, primaryGroup: archetypeEx.primaryGroup, tier });
          return;
        }
        resolvedId = resolved.exercise.id;
        substitutions.push({ slotExerciseId: archetypeEx.exerciseId, resolvedExerciseId: resolvedId, reason });
      }

      usedIds.add(resolvedId);

      exercises.push(buildExConfig(archetypeEx, resolvedId, isLimited, limitations, applyGoalParams, goalParams));
    });

    // Ajustar según nivel — solo si el arquetipo NO está ya diseñado para
    // beginner (una plantilla beginner nativa no necesita reducción).
    if (level === 'beginner' && archetype.level !== 'beginner') {
      const reduced = reduceForBeginner(exercises, equipment);
      exercises = reduced.exercises;
      if (reduced.removed.length || reduced.added) {
        levelCuts.push({ label: dayDef.label, removedIds: reduced.removed, addedId: reduced.added });
      }
    }

    return { dayDef, templateId, exercises };
  });

  const discipline = answers.discipline ?? archetype.discipline;
  const volumeEmphasis = archetype.volumeEmphasis ?? [];

  // Volumen semanal del ciclo contra la banda del nivel (§5.4).
  const normalized = normalizeWeeklyVolume(built.map((b) => b.exercises), {
    daysPerWeek: answers.daysPerWeek,
    level,
    discipline,
    volumeEmphasis,
  });

  built.forEach(({ dayDef, templateId }, i) => {
    // Escalera de compresión (§5.3): baja series antes de borrar, en el orden
    // que dicte la disciplina. El objetivo elegido manda sobre el del arquetipo
    // — es lo que el usuario quiere conservar cuando algo tiene que caer.
    const compressed = compressSession(normalized.sessions[i], {
      sessionMinutes,
      discipline,
      volumeEmphasis,
    });
    if (compressed.overTime) overTime.push(dayDef.label);

    // El tier se queda aquí dentro (§3.3); fuera va el orden.
    const exercises = compressed.exercises.map((ex, idx) => ({ ...stripTier(ex), order: idx + 1 }));

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

  // Lo que el ciclo repite con la misma programación progresa junto (§5.5).
  // Después de recortar por volumen y por tiempo: si la compresión dejó una
  // instancia con menos series que otra, ya no son la misma prescripción.
  autoLinkRepeated(Object.values(sessionTemplates), () => generateId('lnk'))
    .forEach((tpl) => { sessionTemplates[tpl.id] = tpl; });

  // La primera fase de la plantilla ES la etapa base (§6.1). Sin `phases`, una
  // etapa sin límite de ciclos — el comportamiento de siempre. Las fases 2..N
  // las materializa `generateAndActivateProgram` con `addStageToProgram`, que ya
  // sabe clonar, aplicar el `rx` y encadenar `derivedFrom`.
  const phases = archetype.phases ?? null;
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
    [{
      id: generateId('stage'),
      name: phases?.[0]?.name ?? 'Etapa 1',
      durationWeeks: phases?.[0]?.durationWeeks ?? null,
      days: programDays,
    }],
    0,
  );

  return {
    program,
    sessionTemplates,
    phases,
    substitutions,
    unresolved,
    overTime,
    weekly: normalized.weekly,
    overBudget: normalized.overBudget,
    // §5.1: vacío salvo cuando `level: 'beginner'` adapta una plantilla de
    // otro nivel — campo AÑADIDO, ningún consumidor existente se entera.
    levelCuts,
  };
}
