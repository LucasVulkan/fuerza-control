/**
 * clientSave — qué se guarda de un cliente en la cuenta y cómo se sabe si hay algo
 * por guardar (docs/specs/C10-clientes-de-la-cuenta.md §2.3 y §6, N-17, N-18).
 *
 *   buildClientCard      la ficha (`card_json`): lo que el entrenador escribe del cliente
 *   buildClientPrograms  sus programas (`programs_json`): activo y archivados, sus sesiones y ejercicios
 *   saveSig              firma de lo que se guardaría ahora; `!== savedSig` = hay algo pendiente
 *   applyClientCard      al recuperar: la ficha vuelve de `card_json`
 *   applyClientPrograms  al recuperar: los programas vuelven con sus ids
 *
 * Puro: sin imports del store. `state` es el estado del store (o uno plano en los tests).
 * Nada de conexión, envío ni `savedSig` entra en la ficha: guardar no es enviar (N-06).
 */

import { programTemplateIds } from './clientLogs';
import { programSignature } from './programSignature';

/** Copia con las claves ordenadas: el JSON (y la firma) no dependen del orden en que se escribieron. */
function canon(v) {
  if (Array.isArray(v)) return v.map(canon);
  if (v && typeof v === 'object') {
    return Object.fromEntries(Object.keys(v).sort().filter((k) => v[k] !== undefined).map((k) => [k, canon(v[k])]));
  }
  return v;
}

/** La ficha tal como se guarda (§2.3). Las etiquetas llevan su nombre: el registro es del móvil (fallo 25). */
export function buildClientCard(state, id) {
  const c = state.clients?.[id];
  if (!c) return null;
  const names = new Map((state.tagRegistry ?? []).map((t) => [t.id, t.name]));
  return {
    name:            c.name,
    fullName:        c.fullName ?? '',
    phone:           c.phone ?? '',
    email:           c.email ?? '',
    notes:           c.notes ?? '',
    billing:         c.billing ?? [],
    bodyWeight:      c.bodyWeight ?? [],
    status:          c.status ?? 'active',
    color:           c.color,
    createdAt:       c.createdAt,
    activeProgramId: c.activeProgramId ?? null,
    nextOverrides:   c.nextOverrides,
    tags:            (c.tags ?? []).map((tid) => ({ id: tid, name: names.get(tid) ?? null })),
  };
}

/** Ids de los ejercicios que usan estas sesiones (sueltos y dentro de bloques). */
function exerciseIdsOf(templates) {
  return new Set(templates.flatMap((t) => [
    ...(t.exercises ?? []).map((e) => e.exerciseId),
    ...(t.blocks ?? []).flatMap((b) => (b.movements ?? []).map((m) => m.exerciseId)),
  ]));
}

/**
 * `{ programs, sessionTemplates, customExercises }` del cliente: todos sus programas (`owner === id`,
 * también los archivados), las sesiones que usan, sus sesiones libres y solo los ejercicios propios que
 * esas sesiones usan. Lo mismo que reúne `_buildProgramJson` para un programa, para todos a la vez.
 */
export function buildClientPrograms(state, id) {
  const programs = Object.fromEntries(Object.entries(state.programs ?? {}).filter(([, p]) => p.owner === id));
  const tplIds = new Set();
  Object.values(programs).forEach((p) => programTemplateIds(p).forEach((t) => tplIds.add(t)));
  const sessionTemplates = Object.fromEntries(Object.entries(state.sessionTemplates ?? {})
    .filter(([tid, tpl]) => tplIds.has(tid) || (!tpl.programId && tpl.owner === id)));
  const used = exerciseIdsOf(Object.values(sessionTemplates));
  const customExercises = Object.fromEntries(Object.entries(state.customExercises ?? {}).filter(([eid]) => used.has(eid)));
  return { programs, sessionTemplates, customExercises };
}

/**
 * Firma de lo que se guardaría ahora (N-18): la ficha, los programas y, mientras nadie esté dentro
 * del hueco, los ids y `updatedAt` de lo apuntado (con alguien dentro lo apuntado no se sube, así que
 * no cuenta). Null si la ficha no existe.
 * ponytail: djb2 de 32 bits (`programSignature`); una colisión se saltaría un guardado. Si importa, SHA-1.
 */
export function saveSig(state, id) {
  const card = buildClientCard(state, id);
  if (!card) return null;
  const log = state.clients[id].seated ? [] : (state.clientLogs?.[id] ?? []).map((e) => [e.id, e.updatedAt ?? null]);
  return programSignature(canon({ card, programs: buildClientPrograms(state, id), log }));
}

/**
 * Recuperar: la ficha `id` (que ya existe en `state.clients`) con lo de `card`. Las etiquetas se
 * suman al registro por id; si el id ya existe con otro nombre se queda el del móvil.
 * @returns {{ client: object, tagRegistry: object[] }}
 */
export function applyClientCard(state, id, card) {
  const { tags = [], ...fields } = card ?? {};
  const registry = state.tagRegistry ?? [];
  const known = new Set(registry.map((t) => t.id));
  const added = tags.filter((t) => t?.id && t.name && !known.has(t.id)).map(({ id: tid, name }) => ({ id: tid, name }));
  return {
    client:      { ...state.clients[id], ...fields, tags: tags.map((t) => t.id) },
    tagRegistry: added.length ? [...registry, ...added] : registry,
  };
}

/**
 * Recuperar: los programas, sesiones y ejercicios de `programsJson` añadidos conservando sus ids.
 * Si un id ya existe en el móvil se deja el del móvil. Devuelve solo las tres claves que cambian.
 */
export function applyClientPrograms(state, programsJson) {
  const p = programsJson ?? {};
  return {
    programs:         { ...(p.programs ?? {}), ...state.programs },
    sessionTemplates: { ...(p.sessionTemplates ?? {}), ...state.sessionTemplates },
    customExercises:  { ...(p.customExercises ?? {}), ...state.customExercises },
  };
}
