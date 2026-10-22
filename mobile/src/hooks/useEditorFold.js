/**
 * Plegado de la cabecera del editor (P16-02): `folded` es «la tarjeta de
 * identidad ha salido de pantalla». Va en estado de React y no en un valor
 * compartido porque solo cambia al cruzar el umbral (el `setState` repetido no
 * repinta) y así sirve a cualquier ScrollView. Se lo pasas a la pantalla como
 * `onScroll` + `scrollEventThrottle={16}` y a la cabecera en `editor.folded`.
 *
 * El umbral es el alto medido de la tarjeta (P16-03): `onCardLayout` va al
 * `onLayout` de `EditorIdentityCard` y se pliega unos 20 px antes de que acabe
 * de salir, como la maqueta. Hasta que se mide (o en una pantalla sin tarjeta),
 * un scroll fijo de 60 px.
 */
import { useRef, useState, useCallback } from 'react';

const DEFAULT_THRESHOLD = 60;
const LEAD = 20;

export function useEditorFold() {
  const [folded, setFolded] = useState(false);
  const cardH = useRef(0);
  const onCardLayout = useCallback((e) => { cardH.current = e.nativeEvent.layout.height; }, []);
  const onScroll = useCallback((e) => {
    const threshold = cardH.current > 0 ? cardH.current - LEAD : DEFAULT_THRESHOLD;
    setFolded(e.nativeEvent.contentOffset.y > threshold);
  }, []);
  return { folded, onScroll, onCardLayout };
}
