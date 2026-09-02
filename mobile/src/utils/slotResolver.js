/**
 * Resolvedor de slots — spec `mobile/docs/specs/program-templates.md` §5.2.
 *
 * Un ejercicio de una plantilla no es un ejercicio: es un **slot**
 * (`{ pattern, primaryGroup, tier }`) con una preferencia (`exerciseId`).
 * Cuando la preferencia no le sirve al usuario —no tiene el material, le queda
 * grande de nivel, o el grupo está limitado— hay que resolver el slot, no
 * "cambiar el ejercicio A por el B".
 *
 * Sustituye a `findSubstitute`, que filtraba por pattern+grupo+equipo+nivel y
 * devolvía `candidates[0]`: el primero del objeto, sin ordenar. Ignoraba
 * `priority[goal]`, la cercanía de nivel y `isCompound`, y cuando no encontraba
 * nada el llamante perdía el hueco en silencio.
 *
 * Puro y sin dependencias de React ni del store.
 */

import { EXERCISE_LIBRARY } from '../data/exerciseLibrary';

export const LEVEL_ORDER = { beginner: 0, intermediate: 1, advanced: 2 };

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };

/** Sin material declarado = peso corporal: le sirve a cualquiera. */
export function fitsEquipment(ex, equipment) {
  if (!ex.equipment || ex.equipment.length === 0) return true;
  return ex.equipment.some((e) => equipment.includes(e));
}

export function fitsLevel(ex, level) {
  return LEVEL_ORDER[ex.level] <= LEVEL_ORDER[level];
}

/**
 * Escalones de la cascada, en orden. Se para en el primero con resultados.
 *
 * La relajación va del patrón+grupo exacto hacia fuera, y sólo al final
 * abandona el patrón — porque el patrón es lo que la plantilla está pidiendo
 * de verdad ("un empuje horizontal aquí"), mientras que el grupo y el nivel son
 * matices. El escalón 5 existe sólo para tier 1: antes de dejar un ejercicio
 * principal sin resolver, se acepta cualquier compuesto del grupo.
 *
 * `respectLevel` se evalúa contra el nivel que reciba el resolvedor. Con una
 * limitación física el llamante pasa `userLevel: 'beginner'`, así que los
 * escalones 1 y 3 quedan restringidos a ejercicios beginner por construcción, y
 * los escalones 2 y 4 sólo actúan si la biblioteca no tiene ninguno — con la
 * cercanía de nivel eligiendo entonces lo menos exigente disponible. Es la misma
 * regla que `getKeyCandidatesWithFallback` (fase A1) aplica en el camino
 * procedural.
 */
const STEPS = [
  { samePattern: true,  sameGroup: true,  respectLevel: true  },
  { samePattern: true,  sameGroup: true,  respectLevel: false },
  { samePattern: true,  sameGroup: false, respectLevel: true  },
  { samePattern: true,  sameGroup: false, respectLevel: false },
  { samePattern: false, sameGroup: true,  respectLevel: false, compoundOnly: true, tier1Only: true },
];

/**
 * El mejor candidato de un escalón.
 *
 * 1. `priority[goal]` — lo que el ejercicio aporta al objetivo manda.
 * 2. compuesto primero, **sólo para tier 1**: un principal no puede ser un
 *    aislamiento; un accesorio sí.
 * 3. cercanía de nivel al del usuario.
 * 4. `id` alfabético — desempate determinista, para que las mismas respuestas
 *    den siempre el mismo programa.
 */
function pickBest(candidates, { tier, goal, userLevel }) {
  return [...candidates].sort((a, b) => {
    const pa = PRIORITY_ORDER[a.priority?.[goal] ?? 'medium'];
    const pb = PRIORITY_ORDER[b.priority?.[goal] ?? 'medium'];
    if (pa !== pb) return pa - pb;

    if (tier === 1 && a.isCompound !== b.isCompound) return a.isCompound ? -1 : 1;

    const da = Math.abs(LEVEL_ORDER[a.level] - LEVEL_ORDER[userLevel]);
    const db = Math.abs(LEVEL_ORDER[b.level] - LEVEL_ORDER[userLevel]);
    if (da !== db) return da - db;

    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  })[0];
}

/**
 * Resuelve un slot al mejor ejercicio disponible.
 *
 * @param {object}   slot
 * @param {string}   slot.pattern        patrón que pide la plantilla
 * @param {string}   slot.primaryGroup   grupo que pide la plantilla
 * @param {1|2|3}    [slot.tier]         1 = principal (habilita el escalón 5)
 * @param {string}   [slot.goal]         objetivo del usuario, para `priority`
 * @param {string}   [slot.userLevel]    'beginner' si el grupo está limitado
 * @param {string[]} [slot.userEquipment]
 * @param {string[]|Set} [slot.excludeIds] ya usados en la sesión
 * @param {object}   [slot.allExercises]
 * @returns {{ exercise: object, step: number } | null} `null` = la biblioteca
 *          no tiene nada. El llamante debe registrarlo, nunca ignorarlo.
 */
export function resolveSlot({
  pattern,
  primaryGroup,
  tier = 3,
  goal = 'hypertrophy',
  userLevel = 'intermediate',
  userEquipment = [],
  excludeIds = [],
  allExercises = EXERCISE_LIBRARY,
}) {
  const excluded = excludeIds instanceof Set ? excludeIds : new Set(excludeIds);
  const pool = Object.values(allExercises);

  for (let i = 0; i < STEPS.length; i++) {
    const step = STEPS[i];
    if (step.tier1Only && tier !== 1) continue;

    const candidates = pool.filter((ex) => {
      if (excluded.has(ex.id)) return false;
      if (step.samePattern  && ex.pattern      !== pattern)      return false;
      if (step.sameGroup    && ex.primaryGroup !== primaryGroup) return false;
      if (step.compoundOnly && !ex.isCompound)                   return false;
      if (step.respectLevel && !fitsLevel(ex, userLevel))        return false;
      return fitsEquipment(ex, userEquipment);
    });

    if (candidates.length) {
      return { exercise: pickBest(candidates, { tier, goal, userLevel }), step: i + 1 };
    }
  }

  return null;
}
