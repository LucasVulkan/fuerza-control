// Solo para el visor de progresión: corre visor.sim.js con los alias del repo.
import { defineConfig, mergeConfig } from 'vitest/config'
import base from '../../vite.config.js'

export default mergeConfig(base, defineConfig({
  test: { include: ['scripts/visor-progresion/visor.sim.js'] },
}))
