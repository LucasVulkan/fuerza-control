/**
 * Datos y funciones puras de las propuestas de programa (O01, docs/specs/O01-onboarding-simple.md),
 * de las pantallas del camino «por mi cuenta» del recorrido nuevo (O03-04), que
 * también sirve a «Nuevo programa» desde la app (O03-11). Salieron de
 * `OnboardingScreen`, que se borró.
 */
import { EQUIP_PRESETS } from '../../utils/equipmentPresets';

// Opciones de "días por semana" y de "sesiones por semana": el mismo rango en
// las dos preguntas — una sola sesión ya es un programa válido y siete es el techo.
export const SESSION_CHOICES = [1, 2, 3, 4, 5, 6, 7];

export const LEVEL_IDS = ['beginner', 'intermediate', 'advanced'];

// §5.1: disciplina y objetivo se preguntan juntos. Son dos campos del motor pero
// una sola decisión del usuario, y separarlos obligaba a explicar la diferencia.
// `max_strength` ya no es opción: lo trae la plantilla si lo usa.
export const IDENTITY_OPTIONS = [
  { id: 'muscle',       discipline: 'standard',     goal: 'hypertrophy' },
  { id: 'strength',     discipline: 'strength',     goal: 'strength'    },
  { id: 'glutes_legs',  discipline: 'glutes_legs',  goal: 'hypertrophy' },
  { id: 'calisthenics', discipline: 'calisthenics', goal: 'endurance'   },
];

// §2 de la spec: nivel y días ya no vienen premarcados — son preguntas de
// verdad, no perillas con valor por defecto. Tiempo, material y limitaciones
// sí lo son: viven en la hoja de ajustes (§7) encima del programa ya montado.
export const DEFAULT_ANSWERS = {
  level:            null,
  discipline:       null,
  goal:             null,
  daysPerWeek:      null,
  distribution:     null,
  sessionMinutes:   60,
  equipment:        EQUIP_PRESETS.gym,
  limitations:      ['none'],
  progressionModel: 'double_progression',
};

export const totalWeeksOf = (phases) => (phases ?? []).reduce((n, p) => n + (p.durationWeeks ?? 0), 0);
export const totalSetsOf  = (exercisesLists) => exercisesLists.reduce(
  (n, exercises) => n + (exercises ?? []).reduce((m, ex) => m + (ex.sets ?? 0), 0), 0,
);

/** Sesiones distintas del programa, en orden de aparición. */
export function uniqueSessionTemplates(program, templates) {
  const days = program.stages?.length > 0 ? (program.stages[0].days ?? []) : (program.days ?? []);
  const seen = new Set();
  const out  = [];
  for (const day of days) {
    if (seen.has(day.sessionTemplateId)) continue;
    seen.add(day.sessionTemplateId);
    const tpl = templates[day.sessionTemplateId];
    if (tpl) out.push(tpl);
  }
  return out;
}

export function exerciseName(allEx, id, language) {
  const def = allEx[id];
  if (!def) return id;
  return language === 'en' ? (def.nameEn ?? def.name) : def.name;
}

// El mismo hueco se resuelve igual en varias sesiones: decirlo una vez.
export function dedupSubstitutions(substitutions) {
  const out = [];
  const seen = new Set();
  for (const s of substitutions ?? []) {
    const key = `${s.slotExerciseId}→${s.resolvedExerciseId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

// Orden de gravedad: una nota, la primera que aplique. `needsBarbell` nunca
// se emite aquí (§9: no se rankea con `equipment`). `slowCycle` y `rotates`, las
// del generador sobre días y sesiones, tampoco: las sustituye la comparación de
// abajo, que es exacta y no depende de sus umbrales.
const NOTE_PRIORITY = ['levelStretch', 'lowFrequency'];

/** El aviso que manda, o `null` si no hay nada que decir. */
export function proposalNote(t, entry, daysPerWeek) {
  // Las sesiones del programa son sus entrenos por semana (P08-weeks-model.md §0.4),
  // y el generador puede proponer más o menos que los días elegidos: se acepta y
  // se ajusta en el editor (§8.1). Es lo primero que hay que saber, así que manda.
  const sessions = entry.sessionsPerCycle;
  if (daysPerWeek && sessions !== daysPerWeek) {
    return t(`onboarding.proposals.notes.${sessions > daysPerWeek ? 'moreSessions' : 'fewerSessions'}`, {
      sessions, count: daysPerWeek,
    });
  }
  const note = NOTE_PRIORITY.find((n) => entry.notes.includes(n));
  if (!note) return null;
  return t(`onboarding.proposals.notes.${note}`, {
    exercises: entry.adaptationCost,
    sessions:  entry.sessionsPerCycle,
    days:      daysPerWeek,
    level:     t(`onboarding.levels.${entry.archetype.level}.label`, entry.archetype.level),
  });
}

export const EQUIP_IDS = ['bodyweight', 'machines', 'dumbbells', 'barbell', 'pullup_bar', 'parallettes', 'kettlebell', 'resistance_band', 'ab_wheel'];
export const LIMIT_IDS = ['none', 'shoulder', 'lower_back', 'knee'];

/** `id === exclusiveId` limpia el resto; cualquier otro lo quita del grupo. */
export function toggleExclusive(current, id, exclusiveId) {
  if (id === exclusiveId) return [exclusiveId];
  const without = (current ?? []).filter((x) => x !== exclusiveId);
  return without.includes(id) ? without.filter((x) => x !== id) : [...without, id];
}
