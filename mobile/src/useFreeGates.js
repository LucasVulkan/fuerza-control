/**
 * Lo que el plan gratis deja hacer ahora mismo (`freeGates`, M01 §4.11), más
 * `gate(reason, fn)`: si hay motivo, el toque abre el paywall en vez de `fn`.
 *
 *   const { gates, gate } = useFreeGates();
 *   const lock = gates.client(client.id);           // 'frozen' | null
 *   <Button locked={!!lock} onPress={gate(lock, start)} />
 */

import { useMemo, useCallback } from 'react';
import { useStore } from '../store/useStore';
import { freeGates } from './utils/freePlan';

export function useFreeGates() {
  const isPro            = useStore((s) => s.profile?.isPro ?? false);
  const clients          = useStore((s) => s.clients);
  const freeClientIds    = useStore((s) => s.profile?.freeClientIds);
  const programs         = useStore((s) => s.programs);
  const sessionTemplates = useStore((s) => s.sessionTemplates);
  const openPaywall      = useStore((s) => s._paywall);

  const gates = useMemo(
    () => freeGates({ isPro, clients, freeClientIds, programs, sessionTemplates }),
    [isPro, clients, freeClientIds, programs, sessionTemplates],
  );
  const gate = useCallback((reason, fn) => (reason ? () => openPaywall(reason) : fn), [openPaywall]);
  return { gates, gate };
}
