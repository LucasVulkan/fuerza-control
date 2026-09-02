# UI migration "FormaFit" — READ THIS FIRST

The app is being fully redesigned against a Figma file ("FormaFit"), screen by
screen. **Before touching any screen, read `docs/UI-MIGRATION.md`** — it holds the
migration status, the token system, the non-negotiable fidelity rules, how to
extract from Figma, the verification workflow, and the RN traps already hit.

Non-negotiable, stated repeatedly by the user:
**respect Figma EXACTLY** — radius, spacing, text size/tracking, layout, colour.
Never "the closest thing that already exists in the code".

Quick pointers:
- Tokens: `src/theme.js` (spacing/textStyles — spacing already holds Figma's exact
  values) + `src/themes.js` (colours/radius per theme; only touch `formaFit`).
- i18n: `src/locales/{es,en}.json` (i.e. `mobile/src/locales/` — the whole app
  lives under `mobile/` since sep-2026). Every visible string goes in both.
- Verify with `npx eslint <file>` (compare the count against HEAD — there are
  pre-existing errors, just don't add new ones) and `npx vitest run` from the repo
  root.

# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v54.0.0/ before writing any code.

# Expo UI skills (reference, vendored)

`docs/expo-skills/` holds Expo's official `building-native-ui` and `expo-ui`
skills (downloaded from github.com/expo/skills). Use them as reference for
native UI patterns — animations (Reanimated), gradients, visual effects, icons,
toolbars, etc.

Caveat: these skills assume **Expo Router** + **expo-ui** native components
(SwiftUI / Jetpack Compose, NativeTabs, SF Symbols). This app uses **React
Navigation** (`@react-navigation/*`) + **RN StyleSheet** + notifee, so route/
native-tab/native-component guidance does NOT apply directly — treat it as
inspiration, not a drop-in recipe.
