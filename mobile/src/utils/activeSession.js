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
