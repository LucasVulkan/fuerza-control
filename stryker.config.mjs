// I01-01 §3.1: mutación solo sobre lógica pura de mobile/src/utils/.
// Todos: npm run mutacion · uno: npm run mutacion -- --mutate mobile/src/utils/oneRm.js
const ficheros = [
  'progression', 'progressionForm', 'setPlan', 'oneRm', 'warmup', 'stageRx',
  'stageProgress', 'trainingLoad', 'prescription', 'sessionPlan', 'weekProgress',
  'weeklyVolume', 'adherence', 'improvement', 'clientLogs', 'programOwnership',
]

export default {
  testRunner: 'vitest',
  vitest: { configFile: 'vitest.mutacion.config.mjs' },
  mutate: ficheros.map((f) => `mobile/src/utils/${f}.js`),
  coverageAnalysis: 'perTest',
  reporters: ['clear-text', 'json', 'progress'],
  jsonReporter: { fileName: 'reports/mutation/mutation.json' },
  concurrency: 4,
  timeoutMS: 20000,
  // ponytail: in place (sin sandbox): el sandbox no ve mobile/node_modules. Si se corta
  // a medias, `git checkout mobile/src/utils` deja el código como estaba.
  inPlace: true,
  disableTypeChecks: false,
}
