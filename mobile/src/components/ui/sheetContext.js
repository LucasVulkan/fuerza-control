/**
 * Lo que un `DragSheet` ofrece a lo que lleva dentro: `dismiss()` lo cierra CON
 * su animación. En fichero aparte porque exportarlo desde `DragSheet.jsx` le
 * rompe el fast refresh (un módulo, o componentes, o lo otro).
 *
 * Sin esto, las filas de la hoja ponían su `visible` a false por su cuenta y la
 * hoja desaparecía de golpe — mientras que tocar el fondo sí la deslizaba: dos
 * formas distintas de cerrar la misma hoja.
 */
import { createContext } from 'react';

export const SheetContext = createContext(null);
