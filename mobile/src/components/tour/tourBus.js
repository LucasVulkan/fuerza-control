/**
 * El canal entre `useScreenTour` (cada pantalla) y `TourHost` (la raíz), como
 * `ui/dialog.js` con su host: el recorrido se pinta en la ventana principal y no
 * en un `Modal`, así sus coordenadas son las mismas que da `measureInWindow`.
 * `tour`: `{ id, steps, onClose }` o `null`.
 */
let listener = null;

export const setTourListener = (fn) => { listener = fn; };
export const showTour = (tour) => { listener?.(tour); };
