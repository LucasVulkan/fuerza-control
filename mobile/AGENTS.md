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

# Specs y estado del proyecto

`docs/specs/` tiene una spec por feature grande y
[`docs/specs/README.md`](docs/specs/README.md) es su índice. **Léelo antes de
tocar cualquier spec**: fija la cabecera estándar que llevan todas, los códigos
con los que se habla de cada cosa (`M02` es la fase 2 de monetización, `E14` el
fallo 14 de la auditoría) y el procedimiento para cerrar una fase, añadir una
spec o añadir un fallo.

`npm run estado` regenera `docs/estado.html` —la foto de qué falta y qué
está hecho— leyéndolo todo de las specs, y **falla** si la cabecera de alguna no
cuadra. Ejecútalo después de tocar cualquier documento de `docs/specs/`.

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
