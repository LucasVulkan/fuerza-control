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
