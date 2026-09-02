import { fileURLToPath } from 'node:url'
import { defineConfig, configDefaults } from 'vitest/config'

// Ya no hay build web: esto es sólo la configuración de vitest. El plugin de
// React se cayó con la app web — ningún test importa JSX.
//
// `test.alias` no lo ve Metro. Ver test/native-stub.js para por qué aliasar
// (y no `vi.mock`) es lo que funciona.
const nativeStub = fileURLToPath(new URL('./test/native-stub.js', import.meta.url))

export default defineConfig({
  test: {
    // Claude Code worktrees are full copies of the repo: without this the whole
    // suite runs twice, half of it against whatever commit the copy sits on.
    exclude: [...configDefaults.exclude, '**/.claude/**'],
    alias: [
      { find: /^react-native$/, replacement: nativeStub },
      { find: /^expo-[\w-]+(\/.*)?$/, replacement: nativeStub },
      { find: '@react-native-async-storage/async-storage', replacement: nativeStub },
      { find: /^@react-navigation\/[\w-]+$/, replacement: nativeStub },
      { find: '@notifee/react-native', replacement: nativeStub },
      { find: 'react-native-purchases', replacement: nativeStub },
    ],
  },
})
