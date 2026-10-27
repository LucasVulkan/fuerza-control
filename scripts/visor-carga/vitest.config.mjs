// Solo para el visor de carga: corre visor.sim.js con los alias del repo.
import { defineConfig, mergeConfig } from 'vitest/config'
import base from '../../vite.config.js'

export default mergeConfig(base, defineConfig({
  test: { include: ['scripts/visor-carga/visor.sim.js'] },
}))
