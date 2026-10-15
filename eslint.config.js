import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      // mobile/ uses react-native-reanimated (useSharedValue/.value mutation is
      // its intentional API, not a bug) — without this flag the compiler's
      // static rules don't recognize SharedValue as a known-mutable shape and
      // flag every `.value =` assignment as an immutability violation.
      'react-hooks/immutability':        ['error', { environment: { enableCustomTypeDefinitionForReanimated: true } }],
      'react-hooks/incompatible-library': ['warn',  { environment: { enableCustomTypeDefinitionForReanimated: true } }],
    },
  },
  {
    // El recorrido de entrada (O03 §16.1): cada fichero exporta el registro
    // `{ id: Component }` de su camino. No es una pantalla suelta, y en RN no hay
    // Fast Refresh de Vite que proteger.
    files: ['mobile/src/screens/onboarding/screens/*.jsx'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
])
