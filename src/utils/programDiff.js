/**
 * programDiff — qué cambia de verdad entre dos etapas de un programa.
 *
 * Spec: `mobile/docs/specs/program-view.md` §4.2.
 *
 * ── Por qué no se lee `stage.rx` ────────────────────────────────────────────
 *
 * Porque miente en cuanto alguien toca un ejercicio. La regla de etapa se
 * MATERIALIZA al crear la etapa (`stageRx.js`) y a partir de ahí la etapa es
 * editable a mano como cualquier otra: `rx` queda como procedencia, no como
 * descripción de lo que hay. El subtítulo del visualizador sale de comparar los
 * ejercicios de verdad.
 *
 * ── Emparejado de sesiones ──────────────────────────────────────────────────
 *
 * `cloneDays` (store, `addStageToProgram`) deja `derivedFrom` en cada plantilla
 * nueva apuntando a la de origen. Subiendo por esa cadena se empareja una sesión
 * con su antepasada aunque haya etapas intermedias. Si no resuelve —etapas
 * hechas a mano, plantillas importadas— se cae a emparejar por índice, que es
 * como se clonan los días.
 *
 * ── No es `buildProgramDiff` ────────────────────────────────────────────────
 *
 * El del store compara dos VERSIONES del mismo programa por conteos, con textos
 * en español a pelo, para avisar de que el entrenador ha cambiado algo. Otra
 * pregunta, otro contrato.
 */

const MAX_HOPS = 10;

/** Sube por `derivedFrom` hasta dar con una plantilla del conjunto destino. */
function originIn(tpl, targetIds, allTemplates) {
  let cur = tpl;
  for (let i = 0; i < MAX_HOPS && cur?.derivedFrom; i++) {
    if (targetIds.has(cur.derivedFrom)) return cur.derivedFrom;
    cur = allTemplates?.[cur.derivedFrom];
  }
  return null;
}

/** Empareja cada plantilla de `to` con la de `from` de la que desciende. */
function pairSessions(fromTemplates, toTemplates, allTemplates) {
  const fromIds = new Set(fromTemplates.map((t) => t?.id).filter(Boolean));
  const byId    = new Map(fromTemplates.map((t) => [t?.id, t]));
  const used    = new Set();

  const pairs = toTemplates.map((tpl) => {
    const originId = originIn(tpl, fromIds, allTemplates);
    if (originId != null && !used.has(originId)) {
      used.add(originId);
      return { from: byId.get(originId), to: tpl };
    }
    return { from: null, to: tpl };
  });

  // Lo que no resolvió la cadena se empareja por índice contra lo que sobra.
  const spare = fromTemplates.filter((t) => !used.has(t?.id));
  let s = 0;
  for (const pair of pairs) {
    if (!pair.from && s < spare.length) pair.from = spare[s++];
  }
  return pairs;
}

const totalSets = (templates) => (templates ?? []).reduce(
  (acc, tpl) => acc + (tpl?.exercises ?? []).reduce((a, ex) => a + (ex.sets ?? 0), 0),
  0,
);

const blockCount = (templates) => (templates ?? []).reduce(
  (acc, tpl) => acc + (tpl?.blocks?.length ?? 0),
  0,
);

/**
 * @param {Array} fromTemplates plantillas de la etapa de referencia (la 1)
 * @param {Array} toTemplates   plantillas de la etapa que se mira
 * @param {Object} allTemplates mapa id → plantilla, para subir por `derivedFrom`
 * @returns {{ setsDelta, added, removed, replaced, blocksDelta, reps }}
 *          `reps` es `{ delta, count }` o `null`. Todo a cero = sin cambios.
 */
export function stageDiff(fromTemplates, toTemplates, allTemplates) {
  const pairs = pairSessions(fromTemplates ?? [], toTemplates ?? [], allTemplates);

  let added = 0;
  let removed = 0;
  let replaced = 0;
  const repsDeltas = new Map();

  for (const { from, to } of pairs) {
    const oldEx = from?.exercises ?? [];
    const newEx = to?.exercises   ?? [];
    const oldIds = new Set(oldEx.map((e) => e.exerciseId));
    const newIds = new Set(newEx.map((e) => e.exerciseId));

    const inn = [...newIds].filter((id) => !oldIds.has(id)).length;
    const out = [...oldIds].filter((id) => !newIds.has(id)).length;
    // Entra uno y sale otro en la misma sesión: es UN cambio (sustitución), no dos.
    const swapped = Math.min(inn, out);
    replaced += swapped;
    added    += inn - swapped;
    removed  += out - swapped;

    // Desplazamiento de repeticiones de los que siguen estando. Sin esto, una
    // etapa de intensificación —que no toca ni series ni ejercicios— no tendría
    // nada que enseñar.
    const oldByExId = new Map(oldEx.map((e) => [e.exerciseId, e]));
    for (const ex of newEx) {
      const prev = oldByExId.get(ex.exerciseId);
      if (!prev || prev.minReps == null || ex.minReps == null) continue;
      const d = ex.minReps - prev.minReps;
      if (d !== 0) repsDeltas.set(d, (repsDeltas.get(d) ?? 0) + 1);
    }
  }

  // El desplazamiento más repetido: una escalera aplica el mismo a casi todos,
  // y una edición suelta posterior no debería robarle el titular.
  let reps = null;
  for (const [delta, count] of repsDeltas) {
    if (!reps || count > reps.count) reps = { delta, count };
  }

  return {
    setsDelta:   totalSets(toTemplates) - totalSets(fromTemplates),
    added,
    removed,
    replaced,
    blocksDelta: blockCount(toTemplates) - blockCount(fromTemplates),
    reps,
  };
}

/** true si el diff no tiene nada que contar (y entonces no se pinta línea). */
export function isEmptyDiff(d) {
  return !d
    || (d.setsDelta === 0 && d.added === 0 && d.removed === 0
        && d.replaced === 0 && d.blocksDelta === 0 && d.reps == null);
}
