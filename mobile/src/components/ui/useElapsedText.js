import { useEffect, useState } from 'react';

/**
 * El reloj de la sesión en curso: "7:36" / "1:02:15". Sale de `startedAt`
 * (hora de pared), así que sobrevive a minimizar o matar la app sin lógica en
 * segundo plano. El tic de 1 s solo repinta el componente que lo usa: que sea
 * un texto pequeño, no la pantalla entera. Lo usan el Workout y el banner de
 * Inicio (U52).
 */
export function useElapsedText(startedAt) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!startedAt) return;
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [startedAt]);
  if (!startedAt) return null;
  const s  = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return hh > 0
    ? `${hh}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
    : `${mm}:${String(ss).padStart(2, '0')}`;
}
