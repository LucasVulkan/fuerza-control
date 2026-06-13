/**
 * Next-session prescription ("override") — a trainer's one-off targets for the
 * NEXT occurrence of a client's session, consumed once the client trains it.
 *
 * This is NOT editing the program: it's a lightweight, single-use layer on top
 * of it. Anything meant to persist belongs in the program instead.
 *
 * Shape (MVP — exercise-level targets):
 *   override = {
 *     templateId,
 *     createdAt,                                   // ISO string
 *     exercises: { [exerciseId]: { weight?, reps?, note? } },
 *   }
 *
 * Designed to grow without breaking: per-set targets (`sets: [...]`), a one-off
 * set count, and a one-off exercise substitution (`replaceWith`) slot into the
 * per-exercise entry later.
 */

/** True when the override carries no actual prescription (safe to drop). */
export function isEmptyOverride(override) {
  const ex = override?.exercises ?? {};
  return !Object.values(ex).some(
    (e) => e && (e.weight != null || e.reps != null || e.time != null || e.rpe != null
                 || (e.note ?? '').trim() !== ''),
  );
}

/**
 * Resolves a single field's ghost value + source: a trainer target wins over the
 * last-session reference; both render dimmed and are overwritten by the client.
 */
export function resolveRef(target, last) {
  if (target != null && target !== '') return { value: String(target), source: 'coach' };
  if (last   != null && last   !== '') return { value: String(last),   source: 'last' };
  return { value: '', source: 'none' };
}

/**
 * Resolves the "ghost" value (and its source) a workout field should pre-fill.
 * The trainer's target wins over the last-session reference; both render dimmed
 * and are overwritten when the client enters their own value.
 *
 *   source 'coach' → trainer target (rendered in the trainer/blue colour)
 *   source 'last'  → last-session reference (rendered grey, as today)
 *   source 'none'  → nothing to suggest
 *
 * @returns {{ weight: Ref, reps: Ref }}  Ref = { value: string, source }
 */
export function resolveExerciseReference(overrideEx, lastWeight, lastReps) {
  return {
    weight: resolveRef(overrideEx?.weight, lastWeight),
    reps:   resolveRef(overrideEx?.reps,   lastReps),
  };
}

/**
 * Override status, derived from the client's history the trainer already pulls
 * (no extra sync plumbing): consumed once a session of this template is logged
 * at or after the override was created.
 *
 * @returns {'none'|'pending'|'consumed'}
 */
export function overrideStatus(override, clientSessions) {
  if (!override) return 'none';
  const created = override.createdAt ? new Date(override.createdAt).getTime() : 0;
  const consumed = (clientSessions ?? []).some(
    (s) => s.sessionTemplateId === override.templateId && (s.timestamp ?? 0) >= created,
  );
  return consumed ? 'consumed' : 'pending';
}

/** Removes a template's override from the map (the consume step). Pure. */
export function consumeOverride(overrides, templateId) {
  if (!overrides || !(templateId in overrides)) return overrides ?? {};
  const { [templateId]: _drop, ...rest } = overrides;
  return rest;
}
