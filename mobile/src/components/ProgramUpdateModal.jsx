/**
 * ProgramUpdateModal.jsx
 *
 * Shown when the trainer has pushed a new version of the client's program.
 * Lets the client choose:
 *   - Actualizar  → applies it; their progress is theirs and carries over
 *   - Ahora no    → dismisses, update stays pending
 *
 * There is no "start from scratch": progress is a counter owned by the client,
 * not something the trainer's copy can reset (see `docs/specs/C03-stage-locks.md`
 * §6.2). Only the trainer activating a different stage moves them.
 *
 * Desde U34 no pinta nada propio: es una decisión, así que sale con el diálogo
 * común (`showDialog`, U33) y la lista de cambios en su caja con scroll. Antes
 * era una tarjeta con su propio velo.
 */

import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../store/useStore';
import { showDialog } from './ui/dialog';

// Una línea del diff: `{ k, p }` desde U34 (se traduce al pintarla, en el
// idioma de ahora); las actualizaciones que quedaron pendientes de antes
// guardaban ya el texto.
function diffLine(line, t) {
  if (typeof line === 'string') return line;
  const p = { ...line.p };
  if (p.stageN)   p.stage   = t('programUpdate.diff.stageN',   { n: p.stageN });
  if (p.sessionN) p.session = t('programUpdate.diff.sessionN', { n: p.sessionN });
  return t(`programUpdate.diff.${line.k}`, p);
}

export default function ProgramUpdateModal() {
  const { t } = useTranslation();
  const pending                     = useStore((s) => s.clientSync?.pendingProgramUpdate);
  const applyPendingProgramUpdate   = useStore((s) => s.applyPendingProgramUpdate);
  const dismissPendingProgramUpdate = useStore((s) => s.dismissPendingProgramUpdate);

  useEffect(() => {
    if (!pending) return;
    showDialog(t('programUpdate.title'), t('programUpdate.applySub'), [
      { text: t('programUpdate.later'), style: 'cancel', onPress: dismissPendingProgramUpdate },
      { text: t('programUpdate.apply'), onPress: applyPendingProgramUpdate },
    ], { items: (pending.diff ?? []).map((line) => diffLine(line, t)) });
  }, [pending]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
