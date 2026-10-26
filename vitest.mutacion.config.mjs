// I01-01: config de vitest solo para Stryker. Corre los tests de mobile/src/utils.
// ponytail: deja fuera los del store; un mutante que solo matan ellos sale como
// superviviente. Ampliar `include` si se muta el store (2.ª pasada de §3.1).
import { defineConfig, mergeConfig } from 'vitest/config'
import base from './vite.config.js'

export default mergeConfig(base, defineConfig({
  test: { include: ['mobile/src/utils/**/*.test.js'] },
}))
