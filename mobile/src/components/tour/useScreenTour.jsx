/**
 * useScreenTour — arranca y reabre el recorrido de una pantalla (U17-01).
 */
import { useState, useEffect, useCallback } from 'react';
import { useIsFocused } from '@react-navigation/native';

import { useStore } from '../../../store/useStore';
import ScreenTour from './ScreenTour';

const START_MS = 900;   // tras montar la pantalla: que acabe la entrada por partes y el layout exista

/**
 * El recorrido de una pantalla (U17-01 §3.2). Arranca solo la primera vez si
 * hace falta: sin «visto», con la pantalla en foco, sin nada encima (hoja,
 * paywall, actualización de programa, onboarding) y tras dejar montarse el
 * layout. Devuelve `open` (el botón **?**: lo vuelve a abrir desde el paso 1) y
 * `tour` (el elemento que la pantalla pinta en cualquier sitio).
 */
export function useScreenTour(id, steps) {
  const seen        = useStore((s) => !!s.profile.tipsSeen?.[id]);
  const markTipSeen = useStore((s) => s.markTipSeen);
  const resetTip    = useStore((s) => s.resetTip);
  // Algo encima: dos Modal a la vez no se pintan en iOS.
  const covered     = useStore((s) => !!(s.ui.paywallReason || s.ui.limitReason || s.clientSync?.pendingProgramUpdate || s.onboardingFlow));
  const focused     = useIsFocused();
  const [on, setOn] = useState(false);
  const has         = steps.length > 0;
  const idle        = focused && !covered;

  useEffect(() => {
    if (on || seen || !idle || !has) return undefined;
    const timer = setTimeout(() => setOn(true), START_MS);
    return () => clearTimeout(timer);
  }, [on, seen, idle, has]);

  // Si pierde el foco o algo se le pone encima, se cierra sin marcarlo como visto.
  if (on && !idle) setOn(false);

  const open  = useCallback(() => { resetTip(id); setOn(true); }, [resetTip, id]);
  const close = useCallback(() => { markTipSeen(id); setOn(false); }, [markTipSeen, id]);

  return { open, tour: on && has ? <ScreenTour steps={steps} onClose={close} /> : null };
}
