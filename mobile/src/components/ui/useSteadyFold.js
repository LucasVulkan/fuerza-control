/**
 * useSteadyFold — el acordeón de sesiones sin saltos de golpe.
 *
 * Al plegar una sesión el alto del contenido cambia de golpe (Reanimated anima
 * el dibujo, no el alto de Yoga). Si con eso lo que queda no llega al fondo de
 * la pantalla, el ScrollView se recoloca de un tirón y la pantalla entera
 * salta. Un relleno al final guarda el hueco en el mismo render que el
 * plegado, y se recorta en cuanto deja de verse. Lo demás se desplaza con la
 * animación del plegado, que el ojo sí sigue.
 *
 * Acordeón puro: como mucho una abierta. Pide `scrollProps` en el ScrollView,
 * un `<View style={{ height: pad }} />` al final del contenido y `{...row(id)}`
 * en cada fila.
 */
import { useRef, useState } from 'react';

export function useSteadyFold() {
  const [openId, setOpenId] = useState(null);
  const [pad,    setPad]    = useState(0);
  const m = useRef({ y: 0, viewH: 0, contentH: 0, pad: 0, bodies: {} }).current;

  const setPadding = (p) => { m.pad = p; setPad(p); };

  // Lo que sobra del relleno por debajo de la pantalla se quita sin que se vea.
  const trim = () => {
    const need = Math.max(0, Math.ceil(m.y + m.viewH - (m.contentH - m.pad)));
    if (need < m.pad) setPadding(need);
  };

  const toggle = (id) => {
    const h = openId ? (m.bodies[openId] ?? 0) : 0;
    const slack = m.contentH - m.viewH - m.y;   // lo que queda por bajar
    if (h > slack) setPadding(m.pad + Math.ceil(h - slack));
    setOpenId(openId === id ? null : id);
  };

  return {
    pad,
    row: (id) => ({
      open:         openId === id,
      onToggle:     () => toggle(id),
      onBodyLayout: (e) => { m.bodies[id] = e.nativeEvent.layout.height; },
    }),
    scrollProps: {
      scrollEventThrottle: 16,
      onScroll:            (e) => { m.y = e.nativeEvent.contentOffset.y; },
      onLayout:            (e) => { m.viewH = e.nativeEvent.layout.height; },
      onContentSizeChange: (_w, h) => { m.contentH = h; trim(); },
      onScrollEndDrag:     trim,
      onMomentumScrollEnd: trim,
    },
  };
}
