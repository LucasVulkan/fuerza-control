/**
 * Volumen semanal por grupo muscular — spec
 * `mobile/docs/specs/program-templates.md` §5.4.
 *
 * El problema que resuelve: la plantilla fija las series **por ciclo**, y la
 * frecuencia las multiplica sin que nadie lo comprobara. La misma plantilla de
 * principiante entrenada 3 días da 12 series semanales de espalda; entrenada 6,
 * da 24. `reduceForBeginner` recorta por SESIÓN, así que corrige la magnitud
 * equivocada — la frecuencia no la ve.
 *
 * Aquí se mira el ciclo entero y se compara contra una banda por nivel. Sólo
 * recorta: un grupo por debajo de la banda no se rellena con ejercicios
 * inventados — el mínimo lo decide quien escribió la plantilla.
 */

import { EXERCISE_LIBRARY } from '../data/exerciseLibrary';
import { disciplineRules, tierOfExercise } from './sessionCompression';

/**
 * Sets semanales por grupo. `hard` es el techo que dispara el recorte;
 * `min`/`max` son la banda de trabajo, informativa (la usarán el preview y la
 * vista Carga).
 */
export const VOLUME_BANDS = {
  beginner:     { min: 8,  max: 12, hard: 14 },
  intermediate: { min: 12, max: 18, hard: 20 },
  advanced:     { min: 14, max: 22, hard: 26 },
};

/**
 * Grupos sujetos a recorte. `core`, `grip` y `legs_lower` quedan fuera a
 * propósito: sus series son baratas —descansos cortos, poca fatiga sistémica— y
 * su banda no es comparable a la de un motor primario. Sin esta lista, tres
 * planchas disparan el recorte de un programa perfectamente sano.
 */
export const CLAMPED_GROUPS = ['back', 'chest', 'shoulders', 'quads', 'glutes_hamstrings', 'arms'];

/**
 * Un grupo con énfasis declarado por la plantilla sube su techo. Sin esto, la
 * plantilla de glúteo (21 series por ciclo, deliberadas) se recorta a 20 y deja
 * de ser una plantilla de glúteo.
 */
export const EMPHASIS_BONUS = 6;

// Suelos, los mismos que la escalera de compresión.
const MIN_SETS_ACCESSORY = 2;
const MIN_ACCESSORIES = 2;
// Un principal puede bajar a 3 series como último recurso, pero no se elimina
// jamás — eso sigue siendo intocable (spec §2.9).
const MIN_SETS_TIER1 = 3;

const groupOf = (ex, allExercises) => allExercises[ex.exerciseId]?.primaryGroup;

/** Ciclos por semana: es lo que multiplica el volumen del ciclo. */
function cycleSpeed(sessions, daysPerWeek) {
  if (!daysPerWeek || !sessions.length) return 1;
  return daysPerWeek / sessions.length;
}

/**
 * Series semanales por grupo muscular.
 *
 * @param {object[][]} sessions      sesiones del ciclo, cada una con sus exConfig
 * @param {number}     daysPerWeek   frecuencia del usuario (no nº de sesiones)
 * @returns {Record<string, number>} puede dar fracciones (4 días / 3 sesiones)
 */
export function weeklySetsByGroup(sessions, daysPerWeek, allExercises = EXERCISE_LIBRARY) {
  const mult = cycleSpeed(sessions, daysPerWeek);
  const weekly = {};
  for (const session of sessions) {
    for (const ex of session) {
      // El grupo se lee de la biblioteca: el exConfig no lo lleva. Leerlo del
      // exConfig fue el bug de `reduceForBeginner` corregido en 746840c.
      const g = groupOf(ex, allExercises);
      if (g) weekly[g] = (weekly[g] ?? 0) + (ex.sets ?? 0) * mult;
    }
  }
  return weekly;
}

/** Techo de un grupo: banda del nivel × carácter de la disciplina + énfasis. */
export function ceilingFor(group, { level = 'intermediate', discipline = 'standard', volumeEmphasis = [] } = {}) {
  const band = VOLUME_BANDS[level] ?? VOLUME_BANDS.intermediate;
  const base = band.hard * disciplineRules(discipline).volumeBandScale;
  return base + (volumeEmphasis.includes(group) ? EMPHASIS_BONUS : 0);
}

/**
 * Candidatos a recortar de un grupo, en orden de preferencia: el tier más alto
 * primero (3 antes que 2), después la sesión que más aporte al grupo, y de ellos
 * el que más series tenga.
 *
 * Devuelve la lista entera y no sólo el mejor: el preferido puede estar ya en su
 * suelo de series y en una sesión que no admite quitarle nada, y en ese caso hay
 * que probar el siguiente antes de dar el grupo por perdido.
 *
 * `includeTier1` es el último recurso — ver el bucle principal.
 */
function candidatesFor(sessions, group, allExercises, includeTier1 = false) {
  const contribution = sessions.map((session) => session.reduce(
    (sum, ex) => sum + (groupOf(ex, allExercises) === group ? (ex.sets ?? 0) : 0), 0,
  ));

  const out = [];
  sessions.forEach((session, si) => {
    session.forEach((ex, ei) => {
      if (groupOf(ex, allExercises) !== group) return;
      const tier = tierOfExercise(ex);
      if (tier === 1 && !includeTier1) return;
      if (tier !== 1 && includeTier1) return;
      out.push({ si, ei, tier, sets: ex.sets ?? 0, contribution: contribution[si] });
    });
  });

  return out.sort((a, b) =>
    b.tier - a.tier || b.contribution - a.contribution || b.sets - a.sets);
}

/**
 * Un ejercicio se puede quitar si la sesión aguanta perderlo **y** el grupo
 * sigue cubierto por otro ejercicio de esa misma sesión.
 *
 * Lo segundo es la misma doctrina que la escalera de compresión: se elimina
 * redundancia, no estímulo único. Sin ello, recortar volumen semanal podía
 * dejar un día entero sin nada de espalda — bajaba el número, empeoraba el
 * entrenamiento. Si el grupo se queda sin candidato redundante, el exceso se
 * declara en `overBudget` y se acabó.
 */
function canDrop(session, index, group, allExercises) {
  if (session.filter((ex) => tierOfExercise(ex) !== 1).length <= MIN_ACCESSORIES) return false;
  return session.some((ex, i) => i !== index && groupOf(ex, allExercises) === group);
}

/**
 * Recorta el ciclo hasta que ningún grupo pase su techo.
 *
 * Orden: accesorios primero (series hasta 2, después eliminar si el grupo sigue
 * cubierto) y, sólo cuando se agotan, series de principales hasta 3.
 *
 * @returns {{ sessions, weekly, overBudget }} `overBudget` lista los grupos que
 *          siguen por encima porque ya nada puede bajar más sin romper un suelo.
 *          No se fuerza: se declara.
 */
export function normalizeWeeklyVolume(sessions, {
  daysPerWeek,
  level = 'intermediate',
  discipline = 'standard',
  volumeEmphasis = [],
  allExercises = EXERCISE_LIBRARY,
} = {}) {
  const opts = { level, discipline, volumeEmphasis };
  let result = sessions;
  const givenUp = new Set();

  for (;;) {
    const weekly = weeklySetsByGroup(result, daysPerWeek, allExercises);

    const excess = CLAMPED_GROUPS
      .filter((g) => !givenUp.has(g) && (weekly[g] ?? 0) > ceilingFor(g, opts))
      .map((g) => ({ group: g, over: weekly[g] - ceilingFor(g, opts) }))
      .sort((a, b) => b.over - a.over)[0];

    if (!excess) {
      return { sessions: result, weekly, overBudget: [...givenUp] };
    }

    // Primer candidato sobre el que se pueda actuar: bajarle una serie, o
    // quitarlo si ya está en su suelo y la sesión aguanta perderlo.
    let acted = false;
    for (const cand of candidatesFor(result, excess.group, allExercises)) {
      const session = result[cand.si];
      const ex = session[cand.ei];

      let newSession = null;
      if (ex.sets > MIN_SETS_ACCESSORY) {
        newSession = session.map((e, i) => (i === cand.ei ? { ...e, sets: e.sets - 1 } : e));
      } else if (canDrop(session, cand.ei, excess.group, allExercises)) {
        newSession = session.filter((_, i) => i !== cand.ei);
      }
      if (!newSession) continue;

      result = result.map((s, i) => (i === cand.si ? newSession : s));
      acted = true;
      break;
    }

    // Último recurso: bajarle una serie a un principal, con suelo de 3 y sin
    // eliminarlo nunca. Los accesorios ya se han agotado, así que la única
    // alternativa sería dejar el exceso tal cual — y un principiante con 24
    // series semanales de espalda las tiene aunque no las mire nadie. Bajar de
    // 4 a 3 series un básico no le quita el carácter al programa; el ejercicio
    // sigue ahí, con su progresión.
    if (!acted) {
      for (const cand of candidatesFor(result, excess.group, allExercises, true)) {
        const session = result[cand.si];
        const ex = session[cand.ei];
        if ((ex.sets ?? 0) <= MIN_SETS_TIER1) continue;

        result = result.map((s, i) => (i === cand.si
          ? s.map((e, j) => (j === cand.ei ? { ...e, sets: e.sets - 1 } : e))
          : s));
        acted = true;
        break;
      }
    }

    // Ni accesorios ni principales por encima de su suelo: el exceso se declara.
    if (!acted) givenUp.add(excess.group);
  }
}
