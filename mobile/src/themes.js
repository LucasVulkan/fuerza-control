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
  border:     '#b5afa2',
  borderCard: '#b5afa2',
  green:      '#5a8c48',
  orange:     '#b85c30',
  red:        '#b83838',
  blue:       '#486888',
  day1: '#9e5838', day2: '#527848', day3: '#486888',
  day4: '#8c5858', day5: '#786830', day6: '#605880',
};

// ─── Theme objects ────────────────────────────────────────────────────────────
function makeTheme({ id, name, scheme, colors, radius = ROUNDED, fonts = SYSTEM_FONTS }) {
  return { id, name, scheme, colors, radius, fonts, spacing, typography, borders, withOpacity };
}

export const THEMES = {
  dark:     makeTheme({ id: 'dark',     name: 'Oscuro',   scheme: 'dark',  colors: darkColors }),
  midnight: makeTheme({ id: 'midnight', name: 'Midnight', scheme: 'dark',  colors: midnightColors }),
  earthy:   makeTheme({ id: 'earthy',   name: 'Earthy',   scheme: 'light', colors: earthyColors }),
};

/** Ordered list for theme pickers. */
export const THEME_LIST = [THEMES.dark, THEMES.midnight, THEMES.earthy];

export const DEFAULT_THEME = 'dark';
