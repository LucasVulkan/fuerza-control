/**
 * Iconos a dos colores (maqueta docs/mockups/iconos-dos-colores.html): el
 * contorno en gris y en lima solo la parte que dice qué hace el icono.
 *
 * `<TwoTone g={…} a={…} gf={…} af={…} />` va dentro de un `<Svg viewBox="0 0 24 24">`:
 * `g`/`a` son trazos (gris / acento) y `gf`/`af` rellenos. Los paths no llevan
 * color: lo heredan del `G` que los envuelve.
 *
 * Donde el acento pisa el gris, el gris se corta (máscara con la forma del
 * acento engordada `GAP` por cada lado) para que los dos colores no se sumen.
 */
import { useId } from 'react';
import Svg, { Defs, G, Mask, Rect } from 'react-native-svg';

import { useTheme } from '../../useTheme';
import { ICON_STROKE, ICON_GAP, iconTones, strokeFor } from './iconTones';

/** Un icono suelto de caja 24: `<TwoToneIcon size color g a … />`. */
export function TwoToneIcon({ size, color, ...parts }) {
  const th = useTheme();
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <TwoTone {...parts} {...iconTones(th, color)} sw={strokeFor(size)} />
    </Svg>
  );
}

export function TwoTone({ g, a, gf, af, gray, accent, sw = ICON_STROKE, gap = ICON_GAP }) {
  const id = 'k' + useId().replace(/[^a-zA-Z0-9]/g, '');
  const hasAccent = a != null || af != null;
  const grays = (
    <>
      {g != null && <G stroke={gray} strokeWidth={sw} fill="none">{g}</G>}
      {gf != null && <G fill={gray} stroke="none">{gf}</G>}
    </>
  );
  return (
    <>
      {hasAccent && (
        <Defs>
          <Mask id={id} maskUnits="userSpaceOnUse" x={-4} y={-4} width={32} height={32}>
            <Rect x={-4} y={-4} width={32} height={32} fill="#fff" />
            {a != null && <G stroke="#000" strokeWidth={sw + 2 * gap} fill="none">{a}</G>}
            {af != null && <G fill="#000" stroke="#000" strokeWidth={2 * gap}>{af}</G>}
          </Mask>
        </Defs>
      )}
      {hasAccent ? <G mask={`url(#${id})`}>{grays}</G> : grays}
      {a != null && <G stroke={accent} strokeWidth={sw} fill="none">{a}</G>}
      {af != null && <G fill={accent} stroke="none">{af}</G>}
    </>
  );
}
