/**
 * Los ejercicios que se juntaron en uno con su variante
 * (docs/specs/exercise-variants.md §3.3): tres jalones en «Jalón al pecho», dos
 * remos en «Remo en polea» y las dominadas (sin lastre, lastradas y de agarre
 * neutro) en «Dominadas».
 *
 * `migrateExerciseRefs` pasa al id nuevo todo lo que guarda ids —plantillas,
 * historial, alias, prescripciones del entrenador, la sesión en curso— y apunta
 * la variante que el id viejo llevaba en el nombre. Pura e idempotente: muta en
 * sitio y, sin ids viejos, no toca nada. Se llama en cada puerta de entrada de
 * datos (rehidratar, importar, lo que baja de otro móvil), porque un móvil con
 * la versión vieja sigue mandando los ids viejos.
 *
 * Choque: una plantilla con dos ids viejos que van al mismo (jalón prono y
 * jalón neutro) no puede quedar con el mismo ejercicio dos veces. El que no
 * lleva variante —o el primero— se queda el id; el resto pasa a «ejercicio
 * aparte» (`exerciseIdentity.compose`), cuya definición se añade a
 * `customExercises`. Si choca uno sin variante con la que separarse (lastradas
 * y sin lastre en la misma sesión), conserva su id viejo como copia del nuevo
 * con su nombre de siempre: no hay otra forma de que no se pisen. Las entradas del historial de esa plantilla reciben el
 * mismo reparto, para que cada jalón siga con su historial.
 */
import { compose } from './exerciseIdentity';

export const LEGACY_IDS = {
  pulldown_pronated:        { id: 'pulldown',  variant: { grip: 'pronated' } },
  pulldown_supinated:       { id: 'pulldown',  variant: { grip: 'supinated' } },
  pulldown_neutral:         { id: 'pulldown',  variant: { grip: 'neutral' } },
  seated_row_neutral:       { id: 'cable_row', variant: { grip: 'neutral' } },
  pull_up_weighted_barbell: { id: 'pull_up', name: 'Dominadas sin lastre', nameEn: 'Pull-ups (bodyweight)' },
  pull_up_weighted:         { id: 'pull_up', name: 'Dominadas lastradas',  nameEn: 'Weighted Pull-ups' },
  pull_up_neutral:          { id: 'pull_up',   variant: { grip: 'neutral' } },
};

// Un id viejo que se conservó como copia (un choque sin variante) ya es un
// ejercicio: no se vuelve a migrar. Por eso la pregunta necesita la librería.
const legacyIn = (lib) => (id) => Object.prototype.hasOwnProperty.call(LEGACY_IDS, id) && !lib[id];

/**
 * Reparto de una lista de ejercicios (`[{ exerciseId, … }]`): id viejo → id
 * nuevo. Los que no llevan variante eligen antes, así el que se queda el id es
 * el genérico y los que chocan tienen una variante con la que separarse.
 */
function assign(ids, ctx, fixed = {}) {
  const { isLegacy } = ctx;
  const taken = new Set(ids.filter((id) => !isLegacy(id)));
  const out   = { ...fixed };
  Object.values(out).forEach((id) => taken.add(id));
  const legacy = [...new Set(ids.filter((id) => isLegacy(id) && !out[id]))]
    .sort((a, b) => Number(!!LEGACY_IDS[a].variant) - Number(!!LEGACY_IDS[b].variant));
  for (const old of legacy) {
    const { id, variant, name, nameEn } = LEGACY_IDS[old];
    if (!taken.has(id)) { out[old] = id; taken.add(id); continue; }
    if (!variant) {
      if (!ctx.lib[old]) {
        const def = { ...ctx.lib[id], id: old, name, nameEn, isCustom: false };
        delete def.variants;
        ctx.lib[old] = def; ctx.newDefs[old] = def;
      }
      out[old] = old;
      taken.add(old);
      continue;
    }
    const apart = compose({ root: id, variant }, ctx.lib);
    if (apart.def) { ctx.lib[apart.id] = apart.def; ctx.newDefs[apart.id] = apart.def; }
    out[old] = apart.id;
    taken.add(apart.id);
  }
  return out;
}

function migrateBlocks(blocks, ctx) {
  for (const b of blocks ?? []) {
    for (const m of b?.movements ?? []) {
      if (ctx.isLegacy(m.exerciseId)) { m.exerciseId = LEGACY_IDS[m.exerciseId].id; ctx.changed = true; }
    }
  }
}

/** Una lista de ejercicios según un reparto. La variante del id viejo se apunta si no había otra. */
function applyTo(list, map, ctx) {
  for (const ex of list ?? []) {
    const old = ex?.exerciseId;
    if (!ctx.isLegacy(old)) continue;
    ex.exerciseId = map[old];
    const v = LEGACY_IDS[old].variant;
    if (v && !ex.variant) ex.variant = { ...v };
    ctx.changed = true;
  }
}

function migrateTemplates(map, ctx) {
  for (const tpl of Object.values(map ?? {})) {
    if (!tpl) continue;
    const ids = (tpl.exercises ?? []).map((e) => e?.exerciseId);
    if (ids.some(ctx.isLegacy)) {
      const plan = assign(ids, ctx);
      if (tpl.id) ctx.plans[tpl.id] = plan;
      applyTo(tpl.exercises, plan, ctx);
    }
    migrateBlocks(tpl.blocks, ctx);
  }
}

function migrateEntries(entries, ctx) {
  for (const e of entries ?? []) {
    if (!e) continue;
    const ids = (e.exercises ?? []).map((x) => x?.exerciseId);
    if (ids.some(ctx.isLegacy)) {
      // Lo que la plantilla ya repartió manda; lo demás (ad hoc) se reparte aquí.
      const plan = assign(ids, ctx, ctx.plans[e.sessionTemplateId] ?? {});
      applyTo(e.exercises, plan, ctx);
    }
    migrateBlocks(e.blocks, ctx);
  }
}

function renameKeys(obj, plan, ctx) {
  if (!obj) return;
  for (const old of Object.keys(obj)) {
    if (!ctx.isLegacy(old)) continue;
    const id = plan?.[old] ?? LEGACY_IDS[old].id;
    if (!(id in obj)) obj[id] = obj[old];
    delete obj[old];
    ctx.changed = true;
  }
}

/**
 * @param data  cualquier objeto con alguna de estas claves: `sessionTemplates`,
 *              `userPrograms`, `freeSessions`, `workoutLog`, `clientLogs`,
 *              `exerciseAliases`, `clientSync`, `activeSession`, `customExercises`.
 * @param lib   la librería (con los propios) contra la que se derivan los apartes.
 * @returns true si cambió algo.
 */
export function migrateExerciseRefs(data, lib) {
  if (!data) return false;
  const ctx = { lib: { ...lib, ...(data.customExercises ?? {}) }, newDefs: {}, plans: {}, changed: false };
  ctx.isLegacy = legacyIn(ctx.lib);

  migrateTemplates(data.sessionTemplates, ctx);
  migrateTemplates(data.userPrograms, ctx);
  migrateTemplates(data.freeSessions, ctx);
  migrateEntries(data.workoutLog, ctx);
  for (const entries of Object.values(data.clientLogs ?? {})) migrateEntries(entries, ctx);

  for (const [alias, id] of Object.entries(data.exerciseAliases ?? {})) {
    if (ctx.isLegacy(id)) { data.exerciseAliases[alias] = LEGACY_IDS[id].id; ctx.changed = true; }
  }
  for (const [tid, ov] of Object.entries(data.clientSync?.pendingOverrides ?? {})) {
    renameKeys(ov?.exercises, ctx.plans[tid], ctx);
  }

  const s = data.activeSession;
  if (s?.templateId) {
    const plan = ctx.plans[s.templateId];
    renameKeys(s.setsState, plan, ctx);
    renameKeys(s.exerciseNotes, plan, ctx);
    for (const a of s.adHocExercises ?? []) {
      if (ctx.isLegacy(a.exerciseId)) { a.exerciseId = LEGACY_IDS[a.exerciseId].id; ctx.changed = true; }
    }
  }

  if (Object.keys(ctx.newDefs).length) {
    data.customExercises = { ...(data.customExercises ?? {}), ...ctx.newDefs };
    ctx.changed = true;
  }
  return ctx.changed;
}
