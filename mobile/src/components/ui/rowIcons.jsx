/**
 * Iconos de fila — los trazos que van dentro de `RowIcon` (`ui/MenuList`), en
 * una caja de 24 con trazo redondeado. Un solo sitio para que «Editar» o
 * «Borrar» se dibujen igual en todas las hojas: antes cada pantalla declaraba
 * los suyos y ya había dos copias del mismo usuario.
 *
 * Son elementos, no componentes: `<RowIcon>{ROW_ICON.edit}</RowIcon>`, o
 * `icon={ROW_ICON.edit}` en `SheetRow`. Van a dos colores (`TwoTone`): gris y,
 * en lima apagado, la parte que dice qué hace cada uno — maqueta
 * docs/mockups/iconos-dos-colores.html. Con un `color` que no sea gris (rojo
 * de borrar), el icono entero va en ese color.
 */
import { Path, G, Circle, Rect } from 'react-native-svg';

import { TwoTone } from './TwoTone';

export const ROW_ICON = {
  // Del menú ≡.
  new: <TwoTone
    g={<Rect x="3.5" y="3.5" width="17" height="17" rx="4" />}
    a={<Path d="M12 8v8M8 12h8" />} />,
  archived: <TwoTone
    g={<G><Rect x="3.5" y="4" width="17" height="5" rx="1.5" /><Path d="M5 9v9.5a1.5 1.5 0 0 0 1.5 1.5h11a1.5 1.5 0 0 0 1.5-1.5V9" /></G>}
    a={<Path d="M10 13.5h4" />} />,
  user: <TwoTone
    g={<Path d="M5.5 19.5a6.5 6.5 0 0 1 13 0" />}
    a={<Circle cx="12" cy="8" r="3.4" />} />,
  cloud: <TwoTone
    g={<Path d="M6 18a4 4 0 0 1 .6-8 6 6 0 0 1 11.5 2A3.5 3.5 0 0 1 17.5 18z" />}
    a={<Path d="M9.5 14l2 2 3.5-3.5" />} />,
  sync: <TwoTone
    g={<Path d="M3.5 12a8.5 8.5 0 0 1 14-6.4M17 2.5v3.2h-3.2" />}
    a={<Path d="M20.5 12a8.5 8.5 0 0 1-14 6.4M7 21.5v-3.2h3.2" />} />,
  export: <TwoTone
    g={<Path d="M4 14v4.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V14" />}
    a={<Path d="M12 15V4M7.5 8.5 12 4l4.5 4.5" />} />,
  import: <TwoTone
    g={<Path d="M4 14v4.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V14" />}
    a={<Path d="M12 4v11M7.5 10.5 12 15l4.5-4.5" />} />,
  plan: <TwoTone
    g={<Path d="m12 3.5 2.7 5.5 6 .9-4.3 4.2 1 6-5.4-2.8-5.4 2.8 1-6L3.3 9.9l6-.9z" />}
    af={<Path d="m12 8.6 1.2 2.5 2.7.4-2 1.9.5 2.7-2.4-1.3-2.4 1.3.5-2.7-2-1.9 2.7-.4z" />} />,
  docs: <TwoTone
    g={<Circle cx="12" cy="12" r="9" />}
    a={<Path d="M12 16.5v-5" />}
    af={<Circle cx="12" cy="7.8" r="1.2" />} />,
  trash: <TwoTone
    g={<Path d="M6 9.5l.9 10.5h10.2L18 9.5M10 12v5M14 12v5" />}
    a={<Path d="M4 6.5h16M9.5 6.5V4h5v2.5" />} />,
  // Desconectar la cuenta (M03): la puerta y la flecha que sale.
  logout: <TwoTone
    g={<Path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4" />}
    a={<Path d="M16 16.5l4.5-4.5L16 7.5M20.5 12H9.5" />} />,

  // Las hojas de opciones (U09-pulido-ui.md §3).
  view: <TwoTone
    g={<Path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />}
    af={<Circle cx="12" cy="12" r="3.2" />} />,
  edit: <TwoTone
    g={<Path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" />}
    a={<Path d="M13 20h7" />} />,
  duplicate: <TwoTone
    g={<Path d="M5 15H4.5A1.5 1.5 0 0 1 3 13.5v-9A1.5 1.5 0 0 1 4.5 3h9A1.5 1.5 0 0 1 15 4.5V5" />}
    a={<Rect x="9" y="9" width="12" height="12" rx="2.5" />} />,
  share: <TwoTone
    g={<G><Path d="M8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4" /><Circle cx="18" cy="5" r="2.5" /><Circle cx="18" cy="19" r="2.5" /></G>}
    af={<Circle cx="6" cy="12" r="2.9" />} />,
  send: <TwoTone
    g={<Path d="M7 18a4 4 0 0 1-.5-7.97A6 6 0 0 1 18 9.5a3.5 3.5 0 0 1-.5 8.5" />}
    a={<Path d="M12 21v-9M9 14.5l3-3 3 3" />} />,
  unassign: <TwoTone
    g={<G><Circle cx="9" cy="8" r="3.2" /><Path d="M2.5 19a6.5 6.5 0 0 1 13 0" /></G>}
    a={<Path d="M16 11h6" />} />,
  exercise: <TwoTone
    g={<Path d="M6.5 12h11M2.5 10v4M21.5 10v4" />}
    a={<G><Rect x="4.5" y="6.5" width="3" height="11" rx="1" /><Rect x="16.5" y="6.5" width="3" height="11" rx="1" /></G>} />,
  block: <TwoTone
    g={<G><Circle cx="12" cy="13" r="8" /><Path d="M9.5 2h5" /></G>}
    a={<Path d="M12 9v4l2.5 2.5" />} />,
  preset: <TwoTone
    g={<Path d="M6 4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21l-6-4-6 4z" />}
    a={<Path d="M9.5 8h5" />} />,
  rename: <TwoTone
    g={<Path d="M4 7V5h12v2M10 5v14M7.5 19h5" />}
    a={<Path d="M19 9v10M17.5 9h3M17.5 19h3" />} />,
  text: <TwoTone
    g={<Path d="M14 3H6.5A1.5 1.5 0 0 0 5 4.5v15A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V8zM14 3v5h5" />}
    a={<Path d="M9 13h6M9 17h4" />} />,
  start: <TwoTone
    af={<Path d="M8 5.2v13.6a1 1 0 0 0 1.5.85l10.9-6.8a1 1 0 0 0 0-1.7L9.5 4.35A1 1 0 0 0 8 5.2z" />} />,
  // Barras macizas y no rayas: con el trazo fino las rayas pesaban menos que
  // el resto de iconos.
  progress: <TwoTone
    gf={<G><Rect x="3" y="13" width="4.5" height="8" rx="1.6" /><Rect x="9.75" y="9" width="4.5" height="12" rx="1.6" /></G>}
    af={<Rect x="16.5" y="3.5" width="4.5" height="17.5" rx="1.6" />} />,
  target: <TwoTone
    g={<G><Circle cx="12" cy="12" r="9" /><Circle cx="12" cy="12" r="5" /></G>}
    af={<Circle cx="12" cy="12" r="2" />} />,
  save: <TwoTone
    g={<Path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2zM7 3v5h8" />}
    a={<Path d="M17 21v-7H7v7" />} />,
  history: <TwoTone
    g={<Path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5" />}
    a={<Path d="M12 7.5V12l3 2" />} />,
  skip: <TwoTone
    g={<Circle cx="12" cy="12" r="9" />}
    a={<Path d="M5.6 5.6l12.8 12.8" />} />,

  // Las ventajas del paywall (M01-06).
  phone: <TwoTone
    g={<Rect x="6" y="2.5" width="12" height="19" rx="2.5" />}
    a={<Path d="M10.5 18h3" />} />,
  users: <TwoTone
    g={<G><Circle cx="9" cy="8" r="3.2" /><Path d="M2.5 19a6.5 6.5 0 0 1 13 0" /></G>}
    a={<Path d="M16 4.8a3.2 3.2 0 0 1 0 6.4M18 13.6a6.5 6.5 0 0 1 3.5 5.4" />} />,
  templates: <TwoTone
    g={<Rect x="4" y="14" width="16" height="6" rx="2" />}
    a={<Rect x="4" y="4" width="16" height="6" rx="2" />} />,
};
