/**
 * Theme registry — runtime-swappable design tokens.
 *
 * The web app themes via CSS variables (`[data-theme]`); React Native has no CSS
 * variables, so each theme is a plain object of tokens. Components read the
 * active theme through `useTheme()` / `useThemedStyles()` (see ./useTheme.js)
 * and rebuild their StyleSheet when it changes — that's what makes switching
 * live.
 *
 * Only colours, radii and fonts are themed. The spacing scale, the type roles
 * (`textStyles`) and the withOpacity helper are shared across all themes and
 * keep living in ./theme.js.
 *
 * Mirrors the themes defined in the web app's src/index.css.
 */

import { spacing, textStyles, borders, withOpacity } from './theme';

// ─── Radius presets ───────────────────────────────────────────────────────────
const ROUNDED = { xs: 4, sm: 6, md: 10, lg: 16, xl: 22, full: 9999 };
// Space — slightly softer corners (web: card 12 / btn·input 8).
const SOFT    = { xs: 4, sm: 8, md: 12, lg: 16, xl: 22, full: 9999 };
// Golden — esquinas de iOS: más redondas en lo pequeño, tarjeta a 14.
const IOS     = { xs: 6, sm: 8, md: 12, lg: 14, xl: 22, full: 9999 };
// Steel — piezas blandas y muy redondeadas, tarjeta a 20.
const STEEL   = { xs: 6, sm: 10, md: 14, lg: 20, xl: 24, full: 9999 };
// FormaFit — Figma's own radius scale. No dedicated "xl" in Figma; falls back
// to "lg" so components already reading th.radius.xl don't break.
const FORMAFIT_RADIUS = { xxs: 2, xs: 4, sm: 6, md: 10, lg: 18, xl: 18, full: 9999 };

// ─── System fonts (custom fonts land in a later phase) ────────────────────────
const SYSTEM_FONTS = { display: undefined, body: undefined };

// ─── Colour sets ──────────────────────────────────────────────────────────────
// Each set carries the full key surface used across the app so any screen can
// migrate without missing a token.

// `red` es el tono de RELLENO y `redText` el de TEXTO — la misma regla de dos
// tonos por familia que ya sigue el acento en formaFit (sólido para rellenos,
// claro para texto pequeño sobre fondo). En los cuatro temas legados coinciden
// porque su rojo ya es legible a 12 px; en formaFit no: el #ff0900 de Figma da
// 4.1:1 sobre `surface` y 4.3:1 sobre su propio tinte, los dos por debajo de
// AA. `redText` es el #ff5e58 del que sale `tint/red-50` del propio Figma, no
// un color inventado: 5.7:1.
// Golden — oscuro tranquilo, estilo iOS: grises de sistema con una pizca
// cálida y un acento dorado suave con texto negro encima. El texto se queda
// en blanco neutro; el color sólo lo llevan acento y sesiones
// (maqueta docs/mockups/temas-4.html, A1). Conserva el id `dark` para no
// perder la preferencia guardada de quien lo tenía elegido.
const darkColors = {
  bg:         '#0c0b0a',
  surface:    '#1d1c1a',
  surface2:   '#2b2a27',
  surface3:   '#383633',
  text:       '#ececee',
  mutedLight: '#9c9ca1',
  muted:      '#68676a',
  muted2:     '#4a4948',
  accent:     '#e2bb6c',
  onAccent:   '#0c0b0a',
  headerBg:   '#0c0b0a',
  border:     '#393734',
  borderCard: '#393734',
  btnFill:    '#393734',
  green:      '#9fd6a8',
  orange:     '#ff9f6b',
  red:        '#ff7a6e',
  redText:    '#ff7a6e',
  blue:       '#8ec5ec',
  day1: '#e2bb6c', day2: '#ff9f6b', day3: '#8ec5ec',
  day4: '#c9a7f0', day5: '#9fd6a8', day6: '#f09ab8',
};

// Midnight — pizarra casi neutra (el azul en la temperatura, no en el color),
// texto blanco roto y jerarquía con rellenos, sin los bordes cian de antes, que
// eran lo que lo hacía «neón» (maqueta docs/mockups/temas-1.html).
const midnightColors = {
  bg:         '#0a0d13',
  surface:    '#151a23',
  surface2:   '#1c222d',
  surface3:   '#252c39',
  text:       '#e4e7ec',
  mutedLight: '#9aa3b2',
  muted:      '#636d7e',
  muted2:     '#465064',
  accent:     '#8fb3ff',
  onAccent:   '#0a0d13',
  headerBg:   '#0a0d13',
  border:     '#2a3240',
  borderCard: '#2a3240',
  btnFill:    '#2f3747',
  green:      '#5fd4b0',
  orange:     '#f0a060',
  red:        '#f2787a',
  redText:    '#f2787a',
  blue:       '#7aa2ff',
  day1: '#8fb3ff', day2: '#c9a0f5', day3: '#5fd4b0',
  day4: '#f09ab8', day5: '#e8c278', day6: '#7ad0e8',
};

// Earthy — la carta de colores de referencia: fondo arena, tarjetas blanco
// roto, acento oliva y terracota. La cabecera va del color del fondo: el marrón
// de antes llevaba el texto oscuro del tema encima (1.7:1).
const earthyColors = {
  bg:         '#e3dccf',
  surface:    '#f5f1e9',
  surface2:   '#d6ccb9',
  surface3:   '#cbbfa8',
  text:       '#2a2318',
  mutedLight: '#5e5444',
  muted:      '#8a7f6d',
  muted2:     '#b0a592',
  accent:     '#55613a',
  onAccent:   '#ffffff',
  headerBg:   '#e3dccf',
  border:     '#d0c6b3',
  borderCard: '#e0d8c9',
  btnFill:    '#d0c6b3',
  green:      '#4f7a3a',
  orange:     '#a9532d',
  red:        '#a3302a',
  redText:    '#a3302a',
  blue:       '#4a6580',
  day1: '#a9532d', day2: '#55613a', day3: '#4a6580',
  day4: '#8f5050', day5: '#8a6d2a', day6: '#64587a',
};

// Space — claro, azul hielo: tarjetas blancas, acento cobalto y grises fríos.
// El negro se queda para el texto: con acento negro se leía en B/N. Los
// botones secundarios (`surface3`) van en azul pálido: en gris sobre la
// tarjeta blanca no se veían (maqueta docs/mockups/temas-5.html).
//
// EN PRUEBA (26-oct): acento más «icy» (#2a78c8, el más claro que aún da 4.5:1
// con texto blanco). Si no convence, el anterior era el cobalto #2b55e0
// (accent/blue/day1). El fondo blanco con tarjetas azules se probó y no.
const spaceColors = {
  bg:         '#edf2f9',
  surface:    '#ffffff',
  surface2:   '#dbe3f0',
  surface3:   '#d3e0fb',
  text:       '#121826',
  mutedLight: '#4f5b70',
  muted:      '#8a95a8',
  muted2:     '#b9c3d3',
  accent:     '#2a78c8',
  onAccent:   '#ffffff',
  headerBg:   '#edf2f9',
  border:     '#d3ddee',
  borderCard: '#e2e9f5',
  btnFill:    '#d3ddee',
  green:      '#1a7a40',
  orange:     '#bf4a16',
  red:        '#c0322b',
  redText:    '#c0322b',
  blue:       '#2a78c8',
  day1: '#2a78c8', day2: '#bf4a16', day3: '#117559',
  day4: '#7a45c9', day5: '#94620f', day6: '#a8406e',
};

// Steel — grafito con un pelo de azul, no negro: escalones de gris cercanos y un solo acento
// naranja-rojo, como las apps de banca «neumórficas». El fondo es más claro que
// el de los otros oscuros, así que la meta sube a #b4b7bd para seguir en AA; el
// acento lleva texto oscuro encima (con blanco daba 2.9:1). El rojo tira a rosa
// para no confundirse con el acento.
const steelColors = {
  bg:         '#191b20',
  surface:    '#25282e',
  surface2:   '#2e3138',
  surface3:   '#383b43',
  text:       '#ececee',
  mutedLight: '#b4b7bd',
  muted:      '#7d8087',
  muted2:     '#5c5f66',
  accent:     '#ff6a3d',
  onAccent:   '#1c1d20',
  headerBg:   '#191b20',
  border:     '#3e4149',
  borderCard: '#25282e',
  btnFill:    '#3e4149',
  green:      '#6fd49a',
  orange:     '#f5a65b',
  red:        '#ff7d86',
  redText:    '#ff7d86',
  blue:       '#7fa9e8',
  day1: '#ff6a3d', day2: '#c9cbd0', day3: '#7fa9e8',
  day4: '#b79cf0', day5: '#6fd49a', day6: '#f0c46a',
};

// FormaFit — first theme of the Figma redesign: near-black bg, lime accent.
//
// surface / surface2 siguen la escala del Exercise Card Spec v6, que construye
// toda la jerarquía con rellenos (sin bordes): body de tarjeta = surface, banda
// del header, barras de búsqueda y controles segmentados = surface2.
// `border`/`borderCard` NO acompañan el cambio: son líneas, no superficies.
const formaFitColors = {
  // Bajado de #151515 (QA 1-oct): un fondo más negro separa más las tarjetas.
  bg:         '#0f0f0f',
  surface:    '#1f1f1f',
  surface2:   '#272727',
  text:       '#e6e6e6',
  // #818181 era el gris de Figma, pero Figma lo fijó antes de que este tema
  // subiera las superficies: sobre `surface` daba 4.23:1 y sobre `surface2`
  // 3.83:1, los dos por debajo de AA, y `mutedLight` es el color de TODA la
  // meta de la app (234 estilos) a 12 px. #949494 da 5.43 y 4.92 sin acercarse
  // a `text` (13.2:1), así que la jerarquía de color sigue intacta.
  mutedLight: '#949494',
  // Subido un paso corto desde #4d4d4d: 1.95:1 sobre `surface` era un gris que
  // en pantalla no estaba. A #585858 son 2.32:1 — sigue siendo el tono de punto,
  // línea y desactivado, y sigue MUY lejos de AA, así que los sitios que hoy lo
  // usan como color de texto siguen mal. Esto es un respiro, no el arreglo.
  muted:      '#585858',
  muted2:     '#4d4d4d',
  accent:     '#aae216',
  onAccent:   '#000000',
  headerBg:   '#0f0f0f',
  border:     '#3a3a3a',
  borderCard: '#3a3a3a',
  // Relleno de los ✓ sin marcar (U10-04): un paso más claro que `surface2`.
  btnFill:    '#3a3a3a',
  // Lo que va encima de una tarjeta en `surface`: las pestañas sin abrir del
  // Inicio por pestañas y los botones secundarios de una sesión (REPETIR,
  // EDITAR, compartir). Medio paso entre `surface2`, que sobre la tarjeta casi
  // no se veía, y `border` (U13 §10).
  surface3:   '#333333',
  green:      '#66fa39',
  orange:     '#fb923c',
  red:        '#ff0900',
  redText:    '#ff5e58',
  blue:       '#4c85ff',
  day1: '#aae216', day2: '#ff6b35', day3: '#4c85ff',
  day4: '#a78bfa', day5: '#66fa39', day6: '#f472b6',
};

// ─── Theme objects ────────────────────────────────────────────────────────────
function makeTheme({ id, name, scheme, colors, radius = ROUNDED, fonts = SYSTEM_FONTS, tint }) {
  const derivedTint = {
    accent10: withOpacity(colors.accent, 0.1),
    accent50: withOpacity(colors.accent, 0.5),
    red30:    withOpacity(colors.red, 0.3),
    red50:    withOpacity(colors.red, 0.5),
    orange30: withOpacity(colors.orange, 0.3),
    orange50: withOpacity(colors.orange, 0.5),
    blue30:   withOpacity(colors.blue, 0.3),
    blue70:   withOpacity(colors.blue, 0.7),
  };
  return { id, name, scheme, colors, radius, fonts, spacing, textStyles, borders, withOpacity, tint: { ...derivedTint, ...tint } };
}

export const THEMES = {
  dark:     makeTheme({ id: 'dark',     name: 'Golden',   scheme: 'dark', colors: darkColors, radius: IOS }),
  midnight: makeTheme({ id: 'midnight', name: 'Midnight', scheme: 'dark',  colors: midnightColors }),
  earthy:   makeTheme({ id: 'earthy',   name: 'Earthy',   scheme: 'light', colors: earthyColors }),
  space:    makeTheme({ id: 'space',    name: 'Space',    scheme: 'light', colors: spaceColors, radius: SOFT }),
  steel:    makeTheme({ id: 'steel',    name: 'Steel',    scheme: 'dark',  colors: steelColors, radius: STEEL }),
  formaFit: makeTheme({ id: 'formaFit', name: 'FormaFit', scheme: 'dark',  colors: formaFitColors, radius: FORMAFIT_RADIUS, tint: {
    accent10: 'rgba(184, 255, 0, 0.1)',   // tint/accent-10 (base #b8ff00, NO #aae216)
    accent50: 'rgba(184, 255, 0, 0.5)',   // tint/accent-50
    red30:    'rgba(189, 6, 0, 0.3)',     // tint/red-30 (base #bd0600)
    red50:    'rgba(255, 94, 88, 0.5)',   // tint/red-50
    blue30:   'rgba(0, 62, 195, 0.3)',    // tint/blue-30
    blue70:   'rgba(89, 142, 255, 0.7)',  // tint/blue-70
  } }),
};

/** Ordered list for theme pickers. */
export const THEME_LIST = [THEMES.formaFit, THEMES.dark, THEMES.steel, THEMES.midnight, THEMES.earthy, THEMES.space];

export const DEFAULT_THEME = 'formaFit';

// ─── CSS-var resolver (theme-aware) ───────────────────────────────────────────
// The shared data layer stores session colours as CSS-var strings (e.g.
// 'var(--day1)'). Resolve them against the ACTIVE theme so day colours change
// with the theme, not against a frozen palette.
const VAR_TO_KEY = {
  'var(--day1)': 'day1', 'var(--day2)': 'day2', 'var(--day3)': 'day3',
  'var(--day4)': 'day4', 'var(--day5)': 'day5', 'var(--day6)': 'day6',
  'var(--accent)': 'accent', 'var(--bg)': 'bg', 'var(--surface)': 'surface',
  'var(--text)': 'text', 'var(--muted)': 'muted', 'var(--border)': 'border',
  'var(--green)': 'green',
};

export function resolveColor(t, cssVar) {
  const key = VAR_TO_KEY[cssVar];
  return key ? (t.colors[key] ?? cssVar) : cssVar;
}
