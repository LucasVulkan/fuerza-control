import { isExerciseDone } from './exerciseStatus';

/**
 * activeSessionSummary — cómo se llama la sesión a medias y cuánto lleva.
 * Lo comparten el banner de Inicio (U52) y el diálogo de descartar (U53), así
 * que los dos dicen lo mismo. Recibe el estado del store; `null` si no hay
 * sesión a medias.
 *
 * El nombre lleva delante lo mismo que su fila en Inicio: la letra las del
 * programa («C · Empuje») y el número las libres guardadas («02 · Piernas»),
 * contado igual que la lista (las del dueño de la sesión, en orden de alta).
 * La sobre la marcha no tiene fila: su nombre o «Sesión libre».
 */
export function activeSessionSummary(state, t) {
  const a = state.activeSession;
  if (!a?.templateId) return null;
  const isFree = a.templateId === '__free__';
  const tpl    = isFree ? null : state.sessionTemplates?.[a.templateId];
  const unnamed = t('freeSession.templateUnnamed');

  const owner  = a.forClient ?? 'me';
  const number = () => {
    const i = Object.values(state.sessionTemplates ?? {})
      .filter((x) => !x.programId && x.kind !== 'template' && (x.owner ?? 'me') === owner)
      .indexOf(tpl);
    return i < 0 ? null : String(i + 1).padStart(2, '0');
  };
  const name = isFree
    ? (a.freeSessionName?.trim() || unnamed)
    : tpl?.programId
      ? [tpl.label, tpl.name].filter(Boolean).join(' · ')
      : [number(), tpl?.name || unnamed].filter(Boolean).join(' · ');

  const sets  = a.setsState ?? {};
  const units = [
    ...(tpl?.exercises ?? []).map((ex) => isExerciseDone(ex, sets[ex.exerciseId] ?? [])),
    ...(a.adHocExercises ?? []).map((ad) => isExerciseDone({}, ad.setsState ?? [])),
  ];

  return {
    name,
    done:   units.filter(Boolean).length,
    total:  units.length,
    client: a.forClient ? state.clients?.[a.forClient]?.name ?? null : null,
  };
}

/** «C · Empuje · 3 de 6 ejercicios» — sin cuenta si no hay ejercicios. */
export function activeSessionLine(summary, t) {
  return summary.total
    ? `${summary.name} · ${t('home.runningMeta', { done: summary.done, total: summary.total })}`
    : summary.name;
}

/**
 * activeSessionProgress — cuánto lleva la sesión en curso, para la tarjeta de
 * cierre del Workout y la hoja «Terminar sesión» (T09-cierre-entreno.md §3.2).
 *
 * Cuenta las series de trabajo de los ejercicios de la plantilla y de los
 * añadidos sobre la marcha (una serie cuenta si está marcada), y los bloques de
 * acondicionamiento aparte (hecho = `finishedAt`). «Todo hecho» usa además el
 * criterio de `isExerciseDone`, que exige los drops del dropset.
 *
 * `volumeKg` suma peso × reps de las series marcadas (el peso se guarda en kg).
 * `pending` lista lo que queda a medias, en el orden de la sesión, con
 * `{ kind: 'ex', id, done, total }` o `{ kind: 'block', id }`.
 */
export function activeSessionProgress(state) {
  const a = state.activeSession;
  if (!a?.templateId) return null;
  const isFree = a.templateId === '__free__';
  const tpl    = isFree ? null : state.sessionTemplates?.[a.templateId];
  const sets   = a.setsState ?? {};

  const exercises = [
    ...(tpl?.exercises ?? []).map((ex) => ({ id: ex.exerciseId, cfg: ex, sets: sets[ex.exerciseId] ?? [] })),
    ...(a.adHocExercises ?? []).map((ad) => ({ id: ad.exerciseId, cfg: {}, sets: ad.setsState ?? [] })),
  ];
  const blocks = [...(tpl?.blocks ?? []), ...(isFree ? (a.freeBlocks ?? []) : [])];
  const blockDone = (b) => a.blockState?.[b.id]?.finishedAt != null;

  let setsDone = 0, setsTotal = 0, exercisesDone = 0, volumeKg = 0;
  const pending = [];
  for (const ex of exercises) {
    const done = ex.sets.filter((s) => s.done);
    setsDone  += done.length;
    setsTotal += ex.sets.length;
    for (const s of done) {
      const w = parseFloat(s.weight), r = parseFloat(s.reps);
      if (w > 0 && r > 0) volumeKg += w * r;
    }
    if (isExerciseDone(ex.cfg, ex.sets)) exercisesDone += 1;
    else pending.push({ kind: 'ex', id: ex.id, done: done.length, total: ex.sets.length });
  }
  const blocksDone = blocks.filter(blockDone).length;
  for (const b of blocks) if (!blockDone(b)) pending.push({ kind: 'block', id: b.id });

  return {
    setsDone, setsTotal,
    exercisesDone, exercisesTotal: exercises.length,
    blocksDone, blocksTotal: blocks.length,
    volumeKg: Math.round(volumeKg),
    pending,
    allDone: exercises.length + blocks.length > 0 && pending.length === 0,
  };
}
