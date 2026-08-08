import { fileURLToPath } from 'node:url'
import { defineConfig, configDefaults } from 'vitest/config'
import react from '@vitejs/plugin-react'

// `test.alias` applies to vitest only — the web build and Metro are untouched.
// See test/native-stub.js for why aliasing (not vi.mock) is what works.
const nativeStub = fileURLToPath(new URL('./test/native-stub.js', import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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
