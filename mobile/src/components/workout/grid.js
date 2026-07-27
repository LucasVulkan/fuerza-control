/**
 * Geometría del SetsGrid (Exercise Card Spec §4.5), compartida entre SetRow
 * (las filas) y ExerciseCard (la fila 0 de headers de columna) — si divergen,
 * los headers dejan de alinearse con las celdas.
 *
 * Columnas: 26 | 1fr… | 42 [| 42], gap 10. Celdas y botones: alto 44, radius 11.
 */
export const GRID = {
  LABEL_W: 26,   // columna "S1"
  BTN_W:   42,   // columnas play / check
  GAP:     10,
  CELL_H:  44,
  RADIUS:  11,
};
