/**
 * exerciseLinks — exercises linked across sessions of a program.
 *
 * Instances with the same exerciseId AND the same exConfig.linkGroup share
 * their configuration (editing one edits all) and their training history
 * (progression / last-time references read the group's latest log entry,
 * whichever session it came from). linkGroup absent/null = independent.
 */

/** Config fields that travel with a link group (identity/order excluded). */
export const LINKED_CONFIG_KEYS = [
  // `isKey` viaja con el grupo: estar vinculado significa compartir la
  // estructura ENTERA, sin excepciones. Si una sentadilla es la principal de un
  // día y accesoria de otro, su programación ya difiere y no deberían estar en
  // el mismo grupo — la salida es desvincular, no una excepción que el usuario
  // no puede adivinar.
  'isKey',
  'sets', 'restSec', 'inputType',
  'minReps', 'maxReps', 'minTime', 'maxTime',
  'isUnilateral', 'tempo', 'trainerNote', 'trackRpe',
  'progressionModel', 'progression',
];

export function pickLinkedConfig(exConfig) {
  const out = {};
  for (const k of LINKED_CONFIG_KEYS) {
    if (k in (exConfig ?? {})) out[k] = exConfig[k];
  }
  return out;
}

/** All template ids of a program (stages included). */
export function programTemplateIds(program) {
  if (!program) return [];
  const days = program.stages?.length
    ? program.stages.flatMap((st) => st.days ?? [])
    : (program.days ?? []);
  return days.map((d) => d.sessionTemplateId);
}

/** Template ids whose effective template holds `exerciseId` in `linkGroup`. */
export function linkGroupTemplateIds(program, exerciseId, linkGroup, getTemplate) {
  if (!linkGroup) return [];
  return programTemplateIds(program).filter((tid) => {
    const tpl = getTemplate(tid);
    return tpl?.exercises?.some(
      (e) => e.exerciseId === exerciseId && e.linkGroup === linkGroup
    );
  });
}

/**
 * A template and every template it descends from, newest first.
 *
 * Creating a stage mints fresh `tpl_*` ids, so the first time an athlete trains
 * each session of a new stage there is no log entry under that id: no
 * progression chip and no ghost weights — they are left guessing their kilos on
 * every stage change. `tpl.derivedFrom` records "this session is the evolution
 * of that one" and this walks the chain back.
 *
 * Only stage-level copies chain (a new stage supersedes the previous one).
 * Duplicating a session INSIDE a stage does not: the copy and the original
 * coexist in the same cycle, so it is a new session, not an evolution of one.
 *
 * Defensive by construction — the chain lives in user-editable data: it stops
 * at a missing template and at a repeated id, so a stale or circular
 * `derivedFrom` can never hang the workout screen.
 *
 * @param {string}   templateId
 * @param {function} getTemplate  tid → template (the EFFECTIVE one)
 * @returns {string[]} always starts with `templateId` itself
 */
export function templateChainIds(templateId, getTemplate) {
  const chain = [];
  const seen  = new Set();
  let id = templateId;
  while (id && !seen.has(id)) {
    seen.add(id);
    chain.push(id);
    id = getTemplate(id)?.derivedFrom ?? null;
  }
  return chain;
}

/**
 * Latest logged performance of `exerciseId` among the given templates.
 * Returns the log's exercise object ({ exerciseId, sets, ... }) or null.
 */
export function lastLinkedExercise(workoutLog, templateIds, exerciseId) {
  const ids = new Set(templateIds);
  const entries = (workoutLog ?? [])
    .filter((e) => ids.has(e.sessionTemplateId))
    .sort((a, b) => b.timestamp - a.timestamp);
  for (const e of entries) {
    const ex = (e.exercises ?? []).find((x) => x.exerciseId === exerciseId);
    if (ex?.sets?.length) return ex;
  }
  return null;
}

/**
 * THE reference for an exercise: the last time it was actually performed, as
 * the workout screen, the progression chip and the ghost prefills all need it.
 *
 * One definition on purpose — these three used to resolve it separately and
 * only the linked case looked beyond the current template.
 *
 * A link group WINS over the derivation chain: it is an explicit decision by
 * the trainer ("these instances share their history"), while the chain is
 * automatic.
 *
 * @returns the log's exercise object ({ exerciseId, sets, … }) or null
 */
export function lastExerciseRef({ workoutLog, program, templateId, exConfig, getTemplate }) {
  const exerciseId = exConfig?.exerciseId;
  if (!exerciseId) return null;
  const ids = exConfig.linkGroup
    ? linkGroupTemplateIds(program, exerciseId, exConfig.linkGroup, getTemplate)
    : templateChainIds(templateId, getTemplate);
  return lastLinkedExercise(workoutLog, ids, exerciseId);
}

/**
 * Existing link groups of an exercise in a program:
 * [{ id, templateIds, sessions: [session labels] }]
 */
export function exerciseLinkGroups(program, exerciseId, getTemplate) {
  const groups = new Map();
  for (const tid of programTemplateIds(program)) {
    const tpl = getTemplate(tid);
    const ex = tpl?.exercises?.find((e) => e.exerciseId === exerciseId);
    if (!ex?.linkGroup) continue;
    const g = groups.get(ex.linkGroup) ?? { id: ex.linkGroup, templateIds: [], sessions: [] };
    g.templateIds.push(tid);
    g.sessions.push(tpl.label ?? tpl.name ?? '?');
    groups.set(ex.linkGroup, g);
  }
  return [...groups.values()];
}

/** How many sessions of the program contain this exercise. */
export function exerciseInstanceCount(program, exerciseId, getTemplate) {
  return programTemplateIds(program).filter((tid) =>
    getTemplate(tid)?.exercises?.some((e) => e.exerciseId === exerciseId)
  ).length;
}

/**
 * Vincula automáticamente lo que el ciclo repite — spec
 * `mobile/docs/specs/program-templates.md` §5.5.
 *
 * Las plantillas repiten a propósito el mismo ejercicio en varias sesiones del
 * ciclo: la progresión doble necesita exposición repetida al mismo movimiento.
 * Pero cada instancia era independiente, así que dos sentadillas del mismo ciclo
 * progresaban por separado, cada una leyendo sólo su propio historial. Con
 * frecuencia 2 eso es la mitad de la información para decidir el peso de mañana.
 *
 * **Sólo se agrupan las instancias cuya programación coincide** — mismo
 * `pickLinkedConfig`: series, repeticiones, descanso, progresión y `isKey`. Si
 * difieren, se quedan sueltas, y con razón: es la regla que ya declara
 * `LINKED_CONFIG_KEYS` («si una sentadilla es la principal de un día y accesoria
 * de otro, su programación ya difiere y no deberían estar en el mismo grupo»).
 * O sea que la excepción de "objetivos diferentes" se detecta sola, sin que la
 * plantilla tenga que declararla.
 *
 * Va **después** del recorte por volumen y por tiempo: si la compresión deja una
 * instancia con 3 series y otra con 2, ya no deben vincularse. No se igualan a
 * la baja para poder juntarlas — sería inventar programación que la plantilla no
 * escribió.
 *
 * @param {object[]} templates  sessionTemplates del ciclo (una etapa)
 * @param {function} makeId     generador de ids (`() => generateId('lnk')`)
 * @returns {object[]} los mismos templates, con `linkGroup` donde toca
 */
export function autoLinkRepeated(templates, makeId) {
  // exerciseId → (configuración serializada → posiciones donde aparece)
  const byExercise = new Map();

  templates.forEach((tpl, ti) => {
    (tpl.exercises ?? []).forEach((ex, ei) => {
      if (ex.linkGroup) return; // ya vinculado a mano: no se toca
      const perEx = byExercise.get(ex.exerciseId) ?? new Map();
      const key = JSON.stringify(pickLinkedConfig(ex));
      perEx.set(key, [...(perEx.get(key) ?? []), { ti, ei }]);
      byExercise.set(ex.exerciseId, perEx);
    });
  });

  const assigned = new Map();
  for (const perEx of byExercise.values()) {
    for (const spots of perEx.values()) {
      // En SESIONES distintas: dos copias dentro del mismo día no son "el mismo
      // ejercicio repetido en la semana".
      if (new Set(spots.map((s) => s.ti)).size < 2) continue;
      const gid = makeId();
      spots.forEach((s) => assigned.set(`${s.ti}:${s.ei}`, gid));
    }
  }

  if (!assigned.size) return templates;

  return templates.map((tpl, ti) => ({
    ...tpl,
    exercises: (tpl.exercises ?? []).map((ex, ei) => {
      const gid = assigned.get(`${ti}:${ei}`);
      return gid ? { ...ex, linkGroup: gid } : ex;
    }),
  }));
}
