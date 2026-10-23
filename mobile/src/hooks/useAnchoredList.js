/**
 * useAnchoredList(rootRef) — mide dónde colgar `components/ui/AnchoredList` (P16-04).
 * `rootRef` (de la pantalla) va al contenedor donde se pinta la lista; `open(ancla, n)`
 * la cuelga `n` px por debajo del borde superior del ancla (el botón que la abre,
 * o el hueco bajo la cabecera) y `top` es lo que recibe la lista (null = cerrada).
 */
import { useState } from 'react';

/** `open(anchorRef, offset)`: cuelga la lista `offset` px por debajo del borde superior del ancla. */
export function useAnchoredList(rootRef) {
  const [top, setTop] = useState(null);
  const open = (anchorRef, offset = 0) => {
    anchorRef.current?.measureInWindow((_x, y) => {
      rootRef.current?.measureInWindow((_rx, rootY) => setTop(y + offset - rootY));
    });
  };
  return { top, open, close: () => setTop(null) };
}
