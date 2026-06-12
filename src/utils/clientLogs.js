/**
 * Client-log helpers (trainer side).
 *
 * Pure functions that keep each client's history separate from the trainer's
 * own workoutLog, and that re-ID an imported program so two clients never share
 * one program object. Extracted from the store so they can be unit-tested.
 */

import { generateId } from './formatters';

/** Collects every sessionTemplateId referenced by a program (staged or flat). */
export function programTemplateIds(program) {
  const ids = new Set();
  if (program?.stages?.length > 0) {
    program.stages.forEach((st) => (st.days ?? []).forEach((d) => ids.add(d.sessionTemplateId)));
  } else {
    (program?.days ?? []).forEach((d) => ids.add(d.sessionTemplateId));
  }
  return ids;
}

/**
 * Splits client-owned entries out of a mixed workoutLog (legacy data model).
 * An entry belongs to a client when its sessionTemplateId is part of one of
 * that client's programs. Entries matching several clients (shared program —
 * the ambiguity this migration exists to eliminate) are copied to each.
 * Returns { personalLog, clientEntries: { [clientId]: entries[] } }.
 */
export function splitClientLogEntries(workoutLog, clients, programs) {
  const templateOwners = {}; // templateId → [clientId, ...]
  Object.values(clients ?? {}).forEach((c) => {
    (c.programIds ?? []).forEach((pid) => {
      programTemplateIds(programs?.[pid]).forEach((tid) => {
        (templateOwners[tid] ??= []).push(c.id);
      });
    });
  });
  const personalLog   = [];
  const clientEntries = {};
  (workoutLog ?? []).forEach((e) => {
    const owners = templateOwners[e.sessionTemplateId];
    if (owners?.length) {
      owners.forEach((cid) => (clientEntries[cid] ??= []).push(e));
    } else {
      personalLog.push(e);
    }
  });
  return { personalLog, clientEntries };
}

/** Merges incoming entries into a client log — deduped by id, sorted by timestamp. */
export function mergeClientLog(existing, incoming) {
  const base = existing ?? [];
  const ids  = new Set(base.map((e) => e.id));
  const fresh = (incoming ?? []).filter((e) => e.id && !ids.has(e.id));
  if (!fresh.length) return base;
  return [...base, ...fresh].sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0));
}

/**
 * Re-IDs a program file payload: new program id + new session template ids,
 * remapping days (flat and staged), the template maps, and the included
 * workoutLog entries so the history stays linked to the re-ID'd templates.
 * Used when importing a file whose program id already belongs to another
 * client (or to the trainer) — prevents two clients sharing one program object.
 */
export function reidProgramFile(data) {
  const newProgramId = generateId('prog');
  const idMap  = {};
  const mapTpl = (tid) => (idMap[tid] ??= generateId('tpl'));
  const cloneDays = (days) =>
    (days ?? []).map((d) => ({ ...d, sessionTemplateId: mapTpl(d.sessionTemplateId) }));

  const program = {
    ...data.program,
    id:   newProgramId,
    days: cloneDays(data.program.days),
    ...(data.program.stages?.length
      ? { stages: data.program.stages.map((st) => ({ ...st, days: cloneDays(st.days) })) }
      : {}),
  };

  const remapTemplates = (src) => {
    const out = {};
    Object.entries(src ?? {}).forEach(([tid, tpl]) => {
      if (idMap[tid]) out[idMap[tid]] = { ...tpl, id: idMap[tid], programId: newProgramId };
      else out[tid] = tpl; // not referenced by this program — keep untouched
    });
    return out;
  };

  return {
    ...data,
    program,
    sessionTemplates: remapTemplates(data.sessionTemplates),
    userPrograms:     remapTemplates(data.userPrograms),
    workoutLog: (data.workoutLog ?? []).map((e) =>
      idMap[e.sessionTemplateId] ? { ...e, sessionTemplateId: idMap[e.sessionTemplateId] } : e,
    ),
  };
}
