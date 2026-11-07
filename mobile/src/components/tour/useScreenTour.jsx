/**
 * useScreenTour — arranca y reabre el recorrido de una pantalla (U17-01).
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useIsFocused } from '@react-navigation/native';

import { useStore } from '../../../store/useStore';
import { showTour } from './tourBus';

const START_MS = 900;   // tras montar la pantalla: que acabe la entrada por partes y el layout exista

/**
 * El recorrido de una pantalla (U17-01 §3.2). Arranca solo la primera vez si
 * hace falta: sin «visto», con la pantalla en foco, sin nada encima (hoja,
 * paywall, actualización de programa, onboarding) y tras dejar montarse el
 * layout. Devuelve `open` (el botón **?**: lo vuelve a abrir desde el paso 1).
 * El recorrido lo pinta `TourHost`, en la raíz (`tourBus`).
 */
export function useScreenTour(id, steps) {
  const seen        = useStore((s) => !!s.profile.tipsSeen?.[id]);
  const markTipSeen = useStore((s) => s.markTipSeen);
  const resetTip    = useStore((s) => s.resetTip);
  // Algo encima: el recorrido no sale sobre una hoja, un diálogo o el paywall (regla 7).
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

  // Los pasos que haya al abrir; no cambian a mitad. Se leen del último render.
  const latest = useRef(steps);
  useEffect(() => { latest.current = steps; });
  useEffect(() => {
    if (!on || !has) return undefined;
    showTour({ id, steps: latest.current, onClose: close });
    return () => showTour(null);
  }, [on, has, id, close]);

  return open;
}
