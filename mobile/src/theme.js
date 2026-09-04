/**
 * Design tokens — single source of truth for the mobile app.
 * Mirrors the CSS variables in the web app's index.css (dark theme).
 *
 * Usage in components:
 *   import { colors, spacing, typography, radius } from '../theme';
 *   const styles = StyleSheet.create({ container: { backgroundColor: colors.bg } });
 *
 * To add a light theme in the future: create a lightColors object and swap at runtime.
 */

// ─── Color tokens ─────────────────────────────────────────────────────────────
export const colors = {
  // Backgrounds
  bg:         '#0a0a0a',
  surface:    '#141414',
  surface2:   '#1a1a1a',

  // Text
  text:       '#f0f0f0',
  mutedLight: '#9a9a9a', // metadata on dark surfaces — keeps ≥4.5:1 contrast at small sizes
  muted:      '#777777',
  muted2:     '#555555',

  // Accent
  accent:     '#e8ff47',
  onAccent:   '#0a0a0a',

  // Semantic
  border:     '#2a2a2a',
  borderCard: '#1f1f1f',
  green:      '#4ade80',
  orange:     '#fb923c',
  red:        '#f87171',
  blue:       '#57a8ff',

  // Session / day colors (match web CSS vars)
  day1: '#e8ff47',
  day2: '#ff6b35',
  day3: '#7eb8ff',
  day4: '#a78bfa',
  day5: '#34d399',
  day6: '#f472b6',
};

// ─── Spacing scale ────────────────────────────────────────────────────────────
// Mirrors Figma's `space/*` variables exactly (name AND value) — this is the
// authoritative scale for the FormaFit redesign, not an app-invented one.
// Confirmed across independent extractions: xs=2 (history.md, progress.md),
// xs2=4 (RACIONALIZACION.md §1), sm=6 (program-editor.md, exercice.md,
// segmented-control.md), sm2=8 (exercice-editor-elements.md), md=10 (history.md,
// modales.md, sesion-editor.md...), lg=15 (history.md, bloques-amrap.md,
// modales.md), xl=20 (modales.md), xxl=28 (RACIONALIZACION.md §1).
export const spacing = {
  xs:  2,
  xs2: 4,
  sm:  6,
  sm2: 8,
  md:  10,
  lg:  15,
  xl:  20,
  xxl: 28,
};

// ─── Border radius ────────────────────────────────────────────────────────────
export const radius = {
  xs:   4,
  sm:   6,
  md:   10,
  lg:   16,
  xl:   22,
  full: 9999,
};

// ─── Typography ───────────────────────────────────────────────────────────────
export const typography = {
  // Font sizes
  xs:   10,
  sm:   11,
  base: 13,
  md:   14,
  lg:   16,
  xl:   18,
  xxl:  22,

  // Font weights
  regular:  '400',
  medium:   '500',
  semibold: '600',
  bold:     '700',
  heavy:    '900',

  // Line heights
  tight:  1.2,
  normal: 1.5,
  loose:  1.8,
};

// ─── Composite text styles (Figma text/* tokens with exact tracking) ──────────
// `typography` above only has loose sizes/weights shared by all screens — these
// are exact Figma text styles (size + weight + letter-spacing bundled) used by
// the FormaFit redesign. Do not fold into `typography`, which other screens
// already consume as-is.
//
// The font is Inter (matching Figma). RN doesn't synthesize weights for custom
// fonts, so each weight is a distinct family loaded in App.js — the family, not
// `fontWeight`, is what actually selects the weight here. `fontWeight` is kept
// as documentation and as a fallback hint before the font loads.
export const textStyles = {
  hero:       { fontFamily: 'Inter_900Black',     fontSize: 20, fontWeight: '900', letterSpacing: 0 },    // text/hero — valor grande de las Progress cards
  cardType:   { fontFamily: 'Inter_800ExtraBold', fontSize: 12, fontWeight: '800', letterSpacing: 1.2 },  // "SESIÓN X" tags
  cardTitle:  { fontFamily: 'Inter_900Black',     fontSize: 16, fontWeight: '900', letterSpacing: 0.64 }, // nombre de sesión
  exercice:   { fontFamily: 'Inter_900Black',     fontSize: 16, fontWeight: '900', letterSpacing: 0 },    // text/Exercice — nombre de ejercicio (sin tracking, distinto de cardTitle)
  subtitle:   { fontFamily: 'Inter_500Medium',    fontSize: 12, fontWeight: '500', letterSpacing: 0.48 }, // meta fecha/etapa/duración
  tag:        { fontFamily: 'Inter_500Medium',    fontSize: 10, fontWeight: '500', letterSpacing: 0 },    // labels pequeños genéricos
  spacingTag: { fontFamily: 'Inter_800ExtraBold', fontSize: 10, fontWeight: '800', letterSpacing: 2 },    // labels uppercase muy trackeados
  smallBold:  { fontFamily: 'Inter_600SemiBold',  fontSize: 8,  fontWeight: '600', letterSpacing: 1.12 }, // text/SmallBold — labels 8px (etapa, entrenador, contadores)
  btnAction:  { fontFamily: 'Inter_900Black',     fontSize: 12, fontWeight: '900', letterSpacing: 0 },    // texto de botones
};

// ─── Border widths ────────────────────────────────────────────────────────────
export const borders = {
  thin:   1,
  medium: 2,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Converts a CSS-var-style color string (from the shared data layer)
 * to a concrete hex value for use in RN StyleSheets.
 *
 *   resolveColor('var(--day1)') → '#e8ff47'
 */
const CSS_VAR_MAP = {
  'var(--day1)':    colors.day1,
  'var(--day2)':    colors.day2,
  'var(--day3)':    colors.day3,
  'var(--day4)':    colors.day4,
  'var(--day5)':    colors.day5,
  'var(--day6)':    colors.day6,
  'var(--accent)':  colors.accent,
  'var(--bg)':      colors.bg,
  'var(--surface)': colors.surface,
  'var(--text)':    colors.text,
  'var(--muted)':   colors.muted,
  'var(--border)':  colors.border,
  'var(--green)':   colors.green,
};

export function resolveColor(cssVar) {
  return CSS_VAR_MAP[cssVar] ?? cssVar;
}

/**
 * Returns an RGBA string with the given hex color at the specified opacity.
 *   withOpacity(colors.accent, 0.1) → 'rgba(232, 255, 71, 0.10)'
 */
export function withOpacity(hex, opacity) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity.toFixed(2)})`;
}

/**
 * Radios asimétricos por posición dentro de una lista agrupada (§9 de
 * docs/UI-MIGRATION.md): primero/último redondeados, intermedios casi rectos.
 * Vive aquí, y no en la pantalla que lo estrenó (Progress), porque lo comparten
 * la lista de ejercicios, el detalle y el menú principal.
 */
export function getCardRadii(th, isFirst, isLast) {
  const xxs = th.radius.xxs ?? 2;
  if (isFirst && isLast) {
    return {
      borderTopLeftRadius: th.radius.md, borderTopRightRadius: th.radius.md,
      borderBottomLeftRadius: th.radius.md, borderBottomRightRadius: th.radius.md,
    };
  }
  if (isFirst) {
    return {
      borderTopLeftRadius: th.radius.md, borderTopRightRadius: th.radius.md,
      borderBottomLeftRadius: th.radius.xs, borderBottomRightRadius: th.radius.xs,
    };
  }
  if (isLast) {
    return {
      borderTopLeftRadius: xxs, borderTopRightRadius: th.radius.xs,
      borderBottomLeftRadius: th.radius.md, borderBottomRightRadius: th.radius.md,
    };
  }
  return {
    borderTopLeftRadius: xxs, borderTopRightRadius: xxs,
    borderBottomLeftRadius: xxs, borderBottomRightRadius: xxs,
  };
}

/**
 * Fila de opción de una hoja (`DragSheet`): el patrón único de los menús "···"
 * (§9 de docs/UI-MIGRATION.md). Vivía duplicado en seis pantallas, cada una con
 * su copia; está aquí para que el alto se ajuste UNA vez para todas — que es lo
 * que pidió el usuario en QA ("las filas son muy finas").
 *
 * `minHeight` en vez de más padding vertical: las filas de dos líneas (título +
 * hint del editor de programa) ya lo superan y no se estiran.
 */
export function sheetRowBase(th) {
  return {
    flexDirection:     'row',
    alignItems:        'center',
    minHeight:         48,
    backgroundColor:   th.colors.surface2,
    borderRadius:      th.radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.sm2,
  };
}

// ─── Convenience re-export (backwards compat with old theme import) ───────────
export const theme = { colors, spacing, radius, typography, borders, resolveColor, withOpacity };
export default theme;
