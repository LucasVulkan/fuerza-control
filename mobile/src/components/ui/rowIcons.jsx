/**
 * Iconos de fila — los trazos que van dentro de `RowIcon` (`ui/MenuList`), en
 * una caja de 24 con trazo redondeado. Un solo sitio para que «Editar» o
 * «Borrar» se dibujen igual en todas las hojas: antes cada pantalla declaraba
 * los suyos y ya había dos copias del mismo usuario.
 *
 * Son elementos, no componentes: `<RowIcon>{ROW_ICON.edit}</RowIcon>`, o
 * `icon={ROW_ICON.edit}` en `SheetRow`. Van en gris, no en lima (ver el
 * comentario de los iconos del menú ≡ en `AppHeader`).
 */
import { Path, G, Circle, Rect } from 'react-native-svg';

export const ROW_ICON = {
  // Del menú ≡, tal cual estaban.
  new:      <Path d="M12 5v14M5 12h14" />,
  archived: <Path d="M4 7h16M4 12h16M4 17h10" />,
  user:     <G><Circle cx="12" cy="8" r="3.2" /><Path d="M5.5 19a6.5 6.5 0 0 1 13 0" /></G>,
  cloud:    <Path d="M6 18a4 4 0 0 1 .6-8 6 6 0 0 1 11.5 2A3.5 3.5 0 0 1 17.5 18z" />,
  sync:     <G><Path d="M20.5 12a8.5 8.5 0 0 1-14 6.4" /><Path d="M3.5 12a8.5 8.5 0 0 1 14-6.4" /><Path d="M17 2.5v3.2h-3.2M7 21.5v-3.2h3.2" /></G>,
  export:   <Path d="M12 19V5M6 11l6-6 6 6" />,
  import:   <Path d="M12 5v14M6 13l6 6 6-6" />,
  plan:     <Path d="m12 3.5 2.7 5.5 6 .9-4.3 4.2 1 6-5.4-2.8-5.4 2.8 1-6L3.3 9.9l6-.9z" />,
  docs:     <G><Circle cx="12" cy="12" r="9" /><Path d="M12 16v-4M12 8h.01" /></G>,
  trash:    <Path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />,

  // Las hojas de opciones (pulido-ui.md §3).
  view:      <G><Path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><Circle cx="12" cy="12" r="3" /></G>,
  edit:      <G><Path d="M12 20h9" /><Path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" /></G>,
  duplicate: <G><Rect x="9" y="9" width="12" height="12" rx="2" /><Path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" /></G>,
  share:     <G><Circle cx="18" cy="5" r="2.5" /><Circle cx="6" cy="12" r="2.5" /><Circle cx="18" cy="19" r="2.5" /><Path d="M8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4" /></G>,
  send:      <G><Path d="M7 18a4 4 0 0 1-.5-7.97A6 6 0 0 1 18 9.5a3.5 3.5 0 0 1-.5 8.5" /><Path d="M12 21v-9M9 14.5l3-3 3 3" /></G>,
  unassign:  <G><Circle cx="9" cy="8" r="3.2" /><Path d="M2.5 19a6.5 6.5 0 0 1 13 0M16 11h6" /></G>,
  exercise:  <Path d="M6.5 6.5v11M17.5 6.5v11M3 9.5v5M21 9.5v5M6.5 12h11" />,
  block:     <G><Circle cx="12" cy="13" r="8" /><Path d="M12 9v4l2.5 2.5M9 2h6" /></G>,
  preset:    <Path d="M6 3h12v18l-6-4-6 4z" />,
  rename:    <Path d="M4 7V5h16v2M12 5v14M9 19h6" />,
  text:      <G><Path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z" /><Path d="M14 3v5h5M9 13h6M9 17h6" /></G>,
  start:     <Path d="M7 4.5v15l12-7.5z" />,
  progress:  <Path d="M5 20v-6M12 20V6M19 20V10" />,
  target:    <G><Circle cx="12" cy="12" r="9" /><Circle cx="12" cy="12" r="5" /><Circle cx="12" cy="12" r="1" /></G>,
  save:      <G><Path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><Path d="M17 21v-8H7v8M7 3v5h8" /></G>,
  history:   <G><Path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><Path d="M3 3v5h5M12 7v5l3 2" /></G>,
};
