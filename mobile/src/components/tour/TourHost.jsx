/**
 * TourHost — pinta el recorrido que pide `useScreenTour`. Se monta una sola vez
 * en la raíz (`RootNavigator`), encima de las pantallas y la barra de pestañas.
 */
import { useEffect, useState } from 'react';

import ScreenTour from './ScreenTour';
import { setTourListener } from './tourBus';

export default function TourHost() {
  const [tour, setTour] = useState(null);
  useEffect(() => {
    setTourListener(setTour);
    return () => setTourListener(null);
  }, []);
  return tour ? <ScreenTour key={tour.id} steps={tour.steps} onClose={tour.onClose} /> : null;
}
