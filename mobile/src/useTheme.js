/**
 * useTheme / useThemedStyles — the runtime theming hooks.
 *
 * A migrated component defines its styles as a module-level factory:
 *
 *   const makeStyles = (t) => StyleSheet.create({
 *     card: { backgroundColor: t.colors.surface, borderRadius: t.radius.md },
 *   });
 *
 *   function MyScreen() {
 *     const t      = useTheme();              // active theme tokens
 *     const styles = useThemedStyles(makeStyles); // rebuilt only when the theme changes
 *     ...
 *   }
 *
 * spacing / typography / withOpacity stay imported from ./theme as before — they
 * are shared across themes, so only `t.colors` and `t.radius` need the hook.
 */

import { useMemo } from 'react';
import { useStore } from '../store/useStore';
import { THEMES, DEFAULT_THEME } from './themes';

/** The active theme object: { colors, radius, fonts, spacing, typography, ... }. */
export function useTheme() {
  const id = useStore((s) => s.theme) ?? DEFAULT_THEME;
  return THEMES[id] ?? THEMES[DEFAULT_THEME];
}

/** Memoised styles rebuilt only when the theme changes. `makeStyles` must be
 *  a stable (module-level) reference. */
export function useThemedStyles(makeStyles) {
  const t = useTheme();
  return useMemo(() => makeStyles(t), [t, makeStyles]);
}
