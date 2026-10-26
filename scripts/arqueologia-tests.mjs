// I01-01 §3.2: commits donde un `expect` de un test cambió en el mismo commit
// que el fichero que prueba (`x.test.js` ↔ `x.js`). Solo lee el historial.
//   node scripts/arqueologia-tests.mjs [ruta/a/x.test.js ...]
// Sin argumentos: todos los *.test.js de mobile/src/utils.
import { execFileSync } from 'node:child_process'

const git = (...a) => execFileSync('git', a, { encoding: 'utf8', maxBuffer: 1 << 28 })

const tests = process.argv.slice(2).length
  ? process.argv.slice(2)
  : git('ls-files', 'mobile/src/utils/*.test.js').trim().split('\n')

for (const test of tests) {
  const src = test.replace(/(\.[\w-]+)?\.test\.js$/, '.js')
  // --follow no vale con dos rutas: se miran los commits del test y se filtra.
  // Hasta sep-2026 la app vivía en la raíz (src/utils/…): se miran las dos rutas.
  const viejo = (p) => p.replace(/^mobile\//, '')
  const commits = git('log', '--format=%H', '--', test, viejo(test)).trim().split('\n').filter(Boolean)
  for (const sha of commits) {
    const files = git('show', '--format=', '--name-only', sha).split('\n')
    if (!files.includes(src) && !files.includes(viejo(src))) continue
    const diff = git('show', '--format=', '-U0', sha, '--', test, viejo(test))
    const quitados = diff.split('\n').filter((l) => /^-(?!--).*expect\(/.test(l))
    const puestos = diff.split('\n').filter((l) => /^\+(?!\+\+).*expect\(/.test(l))
    if (!quitados.length || !puestos.length) continue
    const asunto = git('log', '-1', '--format=%h %ad %s', '--date=short', sha).trim()
    console.log(`\n## ${test} · ${asunto}`)
    for (const l of quitados) console.log(l.trim())
    for (const l of puestos) console.log(l.trim())
  }
}
