/**
 * Theme registry — runtime-swappable design tokens.
 *
 * The web app themes via CSS variables (`[data-theme]`); React Native has no CSS
 * variables, so each theme is a plain object of tokens. Components read the
 * active theme through `useTheme()` / `useThemedStyles()` (see ./useTheme.js)
 * and rebuild their StyleSheet when it changes — that's what makes switching
 * live.
 *
 * Only colours, radii and fonts are themed. The spacing scale, font sizes,
 * weights and the withOpacity helper are shared across all themes and keep
 * living in ./theme.js.
 *
 * Mirrors the themes defined in the web app's src/index.css.
 */

import { spacing, typography, borders, withOpacity } from './theme';

// ─── Radius presets ───────────────────────────────────────────────────────────
const ROUNDED = { xs: 4, sm: 6, md: 10, lg: 16, xl: 22, full: 9999 };
// Space — slightly softer corners (web: card 12 / btn·input 8).
const SOFT    = { xs: 4, sm: 8, md: 12, lg: 16, xl: 22, full: 9999 };
// FormaFit — Figma's own radius scale. No dedicated "xl" in Figma; falls back
// to "lg" so components already reading th.radius.xl don't break.
const FORMAFIT_RADIUS = { xxs: 2, xs: 4, sm: 6, md: 10, lg: 18, xl: 18, full: 9999 };

// ─── System fonts (custom fonts land in a later phase) ────────────────────────
const SYSTEM_FONTS = { display: undefined, body: undefined };

// ─── Colour sets ──────────────────────────────────────────────────────────────
// Each set carries the full key surface used across the app so any screen can
// migrate without missing a token.

const darkColors = {
  bg:         '#0a0a0a',
  surface:    '#141414',
  surface2:   '#1a1a1a',
  text:       '#f0f0f0',
  mutedLight: '#9a9a9a',
  muted:      '#777777',
  muted2:     '#555555',
  accent:     '#e8ff47',
  onAccent:   '#0a0a0a',
  headerBg:   '#0a0a0a',
  border:     '#2a2a2a',
  borderCard: '#1f1f1f',
  green:      '#4ade80',
  orange:     '#fb923c',
  red:        '#f87171',
  blue:       '#57a8ff',
  day1: '#e8ff47', day2: '#ff6b35', day3: '#7eb8ff',
  day4: '#a78bfa', day5: '#34d399', day6: '#f472b6',
};

const midnightColors = {
  bg:         '#04091a',
  surface:    '#0c1535',
  surface2:   '#111e45',
  text:       '#d8eeff',
  mutedLight: '#7fa8cc',
  muted:      '#4878a0',
  muted2:     '#2d5070',
  accent:     '#00c8f0',
  onAccent:   '#04091a',
  headerBg:   '#04091a',
  border:     'rgba(0,200,240,0.55)',
  borderCard: 'rgba(0,200,240,0.40)',
  green:      '#00e8a0',
  orange:     '#fb923c',
  red:        '#f87171',
  blue:       '#60a5fa',
  day1: '#00c8f0', day2: '#9b74f7', day3: '#00e8a0',
  day4: '#f472b6', day5: '#fbbf24', day6: '#60a5fa',
};

const earthyColors = {
  bg:         '#dbd5c8',
  surface:    '#e6e0d4',
  surface2:   '#cfc9bc',
  text:       '#26200f',
  mutedLight: '#4a4336',
  muted:      '#6e6455',
  muted2:     '#9a8e7e',
  accent:     '#6a9458',
  onAccent:   '#ffffff',
  headerBg:   '#4c453a',
  border:     '#b5afa2',
  borderCard: '#b5afa2',
  green:      '#5a8c48',
  orange:     '#b85c30',
  red:        '#b83838',
  blue:       '#486888',
  day1: '#9e5838', day2: '#527848', day3: '#486888',
  day4: '#8c5858', day5: '#786830', day6: '#605880',
};

// Space — light, modern: light-grey bg, white surfaces, black accent.
const spaceColors = {
  bg:         '#efefef',
  surface:    '#ffffff',
  surface2:   '#d6d6d6',
  text:       '#0a0a0a',
  mutedLight: '#444444',
  muted:      '#666666',
  muted2:     '#aaaaaa',
  accent:     '#111111',
  onAccent:   '#ffffff',
  headerBg:   '#e6e6e6',
  border:     '#cecece',
  borderCard: '#c0c0c0',
  green:      '#1a7a30',
  orange:     '#a04010',
  red:        '#a02020',
  blue:       '#335599',
  day1: '#111111', day2: '#335599', day3: '#226644',
  day4: '#774499', day5: '#aa5500', day6: '#995566',
};

// FormaFit — first theme of the Figma redesign: near-black bg, lime accent.
const formaFitColors = {
  bg:         '#141414',
  surface:    '#2a2a2a',
  surface2:   '#3a3a3a',
  text:       '#e6e6e6',
  mutedLight: '#818181',
  muted:      '#4d4d4d',
  muted2:     '#4d4d4d',
  accent:     '#aae216',
  onAccent:   '#000000',
  headerBg:   '#141414',
  border:     '#3a3a3a',
  borderCard: '#3a3a3a',
  green:      '#66fa39',
  orange:     '#fb923c',
  red:        '#ff0900',
  blue:       '#4c85ff',
  day1: '#aae216', day2: '#ff6b35', day3: '#4c85ff',
  day4: '#a78bfa', day5: '#66fa39', day6: '#f472b6',
};

// ─── Theme objects ────────────────────────────────────────────────────────────
function makeTheme({ id, name, scheme, colors, radius = ROUNDED, fonts = SYSTEM_FONTS }) {
  return { id, name, scheme, colors, radius, fonts, spacing, typography, borders, withOpacity };
}

export const THEMES = {
  dark:     makeTheme({ id: 'dark',     name: 'Oscuro',   scheme: 'dark',  colors: darkColors }),
  midnight: makeTheme({ id: 'midnight', name: 'Midnight', scheme: 'dark',  colors: midnightColors }),
  earthy:   makeTheme({ id: 'earthy',   name: 'Earthy',   scheme: 'light', colors: earthyColors }),
  space:    makeTheme({ id: 'space',    name: 'Space',    scheme: 'light', colors: spaceColors, radius: SOFT }),
  formaFit: makeTheme({ id: 'formaFit', name: 'FormaFit', scheme: 'dark',  colors: formaFitColors, radius: FORMAFIT_RADIUS }),
};

/** Ordered list for theme pickers. */
export const THEME_LIST = [THEMES.dark, THEMES.midnight, THEMES.earthy, THEMES.space, THEMES.formaFit];

export const DEFAULT_THEME = 'dark';

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
