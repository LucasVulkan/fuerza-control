/**
 * Plegado de la cabecera del editor (P16-02): `folded` es «la tarjeta de
 * identidad ha salido de pantalla». Va en estado de React y no en un valor
 * compartido porque solo cambia al cruzar el umbral (el `setState` repetido no
 * repinta) y así sirve a cualquier ScrollView. Se lo pasas a la pantalla como
 * `onScroll` + `scrollEventThrottle={16}` y a la cabecera en `editor.folded`.
 */
import { useState, useCallback } from 'react';

// P16-03: sin tarjeta aún, un scroll fijo. Con ella, el umbral es su alto medido
// (`onLayout` de la tarjeta menos unos 20 px, como la maqueta): pasa `threshold`.
const DEFAULT_THRESHOLD = 60;

export function useEditorFold(threshold = DEFAULT_THRESHOLD) {
  const [folded, setFolded] = useState(false);
  const onScroll = useCallback(
    (e) => setFolded(e.nativeEvent.contentOffset.y > threshold),
    [threshold],
  );
  return { folded, onScroll };
}
