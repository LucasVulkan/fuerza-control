/**
 * useStageEnd — si sale el aviso de fin de etapa y qué dice (P08-weeks-model.md
 * §6.1). Lo pintan Inicio y Programa con `StageEndCard`; la cuenta es la misma
 * que enciende el punto del tab (`stageBannerDue`). Cuatro casos: bloqueada,
 * terminada sin entrenar lo que tocaba (se propone alargar), terminada, y
 * completada antes de tiempo. Sin aviso, `null`.
 */
import { useTranslation } from 'react-i18next';

import { useStore } from '../../store/useStore';
import { athleteProgress, stageStatus, stageBannerDue, localDay, addDays } from '../utils/stageProgress';
import { isStageLocked } from '../utils/stageLocks';

export default function useStageEnd(program) {
  const { t } = useTranslation();
  const advanceStage      = useStore((s) => s.advanceStage);
  const extendStage       = useStore((s) => s.extendStage);
  const snoozeStageBanner = useStore((s) => s.snoozeStageBanner);
  const snooze            = useStore((s) => s.stageBannerSnooze);
  const clientSync        = useStore((s) => s.clientSync);

  if (!program) return null;
  const today    = localDay();
  const progress = athleteProgress(program);
  const status   = stageStatus(program, progress, today);
  const idx      = status.stageIdx;
  const next     = program.stages?.[idx + 1];
  if (!next || !stageBannerDue(program, progress, snooze?.[program.id], today)) return null;

  const pid      = program.id;
  const nextName = (next.name ?? t('home.stageDefault', { n: idx + 2 })).toUpperCase();
  const base = {
    eyebrow:  `${t('home.stageDefault', { n: idx + 1 })}${status.stage?.name ? ` · ${status.stage.name}` : ''}`,
    sessions: status.expected != null ? t('home.stageEnd.sessions', { done: status.done, expected: status.expected }) : null,
  };
  const advance = { label: t('home.stageEnd.advance'), onPress: () => advanceStage(pid) };

  // No puede avanzar: sigue en la etapa (stage-locks §0.1). Se le recuerda cada
  // semana mientras su entrenador no la abra.
  if (isStageLocked(program, idx + 1, clientSync)) return {
    ...base,
    title: t('home.stageEnd.locked'),
    text:  t('home.stageEnd.lockedText', { next: nextName }),
    quiet: { label: t('home.stageEnd.understood'), onPress: () => snoozeStageBanner(pid, addDays(today, 7)) },
  };
  // Terminó por fecha sin entrenar lo que tocaba: se propone alargar, pero
  // avanzar sigue a un toque.
  if (status.ended && status.missingWeeks > 0) return {
    ...base,
    title: t('home.stageEnd.ended'),
    text:  t('home.stageEnd.behind', { count: status.missingWeeks }),
    main:  { label: t('home.stageEnd.extend', { count: status.missingWeeks }), onPress: () => extendStage(pid, status.missingWeeks) },
    quiet: advance,
  };
  if (status.ended) return {
    ...base,
    title: t('home.stageEnd.completed'),
    text:  t('home.stageEnd.next', { next: nextName }),
    main:  advance,
    // Con el aplazamiento: sin él, la semana añadida sería ya la última con todo
    // hecho y el aviso volvería al instante.
    quiet: { label: t('home.stageEnd.oneMore'), onPress: () => { extendStage(pid, 1); snoozeStageBanner(pid, addDays(status.endsOn, 7)); } },
  };
  // Anticipado: última semana y todas las sesiones hechas.
  return {
    ...base,
    title: t('home.stageEnd.completed'),
    text:  t('home.stageEnd.early', { next: nextName }),
    main:  advance,
    quiet: { label: t('home.stageEnd.notNow'), onPress: () => snoozeStageBanner(pid, status.endsOn) },
  };
}
