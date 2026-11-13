// Servidor del editor de afinado (X03-27, spec X03 §31): `npm run editor` -> http://localhost:8770/?editor
// Sirve prototype/viewer.html y acepta POST /ajustes/<acción> con el JSON del afinado, que escribe en ajustes/<acción>.json
// y, después, ejecuta prototype/build.py para que la app lleve lo guardado. Node `http`, sin dependencias; solo escucha en 127.0.0.1.
// Variables de entorno (para pruebas): FF_AJUSTES = carpeta de destino, FF_EDITOR_PUERTO = puerto (0 = uno libre), FF_SIN_BUILD=1 = no ejecuta build.py.
const http = require('http'), fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..');
const MAX_CUERPO = 64 * 1024;   // el archivo de una acción pesa unos cientos de bytes

const acciones = () => Object.keys(JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'poses.json'), 'utf8')).exercises);
const construir = () => { if (!process.env.FF_SIN_BUILD) execFileSync('python', [path.join(ROOT, 'prototype', 'build.py')], { cwd: ROOT, stdio: 'pipe' }); };

function crear() {
  const carpeta = () => process.env.FF_AJUSTES || path.join(ROOT, 'ajustes');
  const responder = (res, codigo, cuerpo, tipo = 'application/json') => { res.writeHead(codigo, { 'content-type': tipo + '; charset=utf-8', 'cache-control': 'no-store' }); res.end(typeof cuerpo === 'string' || Buffer.isBuffer(cuerpo) ? cuerpo : JSON.stringify(cuerpo)); };
  return http.createServer((req, res) => {
    // contra el «DNS rebinding»: solo se atiende a quien pregunta por localhost / 127.0.0.1
    if (!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(req.headers.host || '')) return responder(res, 403, { error: 'host no permitido' });
    const url = new URL(req.url, 'http://localhost');
    if (req.method === 'GET' && url.pathname === '/' && !url.searchParams.has('editor')) { res.writeHead(302, { location: '/?editor' }); return res.end(); }   // la raíz abre ya el editor (el lanzador de la app solo sabe abrir la raíz)
    if (req.method === 'GET' && url.pathname === '/') return responder(res, 200, fs.readFileSync(path.join(ROOT, 'prototype', 'viewer.html')), 'text/html');
    const m = req.method === 'POST' && /^\/ajustes\/([A-Za-z0-9_]+)$/.exec(url.pathname);
    if (!m) return responder(res, 404, { error: 'no existe' });
    const accion = m[1]; let n = 0; const trozos = [];
    req.on('data', c => { n += c.length; if (n > MAX_CUERPO) { if (!res.headersSent) { res.setHeader('connection', 'close'); responder(res, 413, { error: 'cuerpo demasiado grande' }); } } else trozos.push(c); });   // lo que sobra se descarta
    req.on('end', () => {
      if (n > MAX_CUERPO) return;
      try {
        if (!acciones().includes(accion)) return responder(res, 400, { error: `acción desconocida: ${accion}` });
        let datos; try { datos = JSON.parse(Buffer.concat(trozos).toString('utf8')); } catch { return responder(res, 400, { error: 'JSON no válido' }); }
        if (!datos || typeof datos !== 'object' || Array.isArray(datos)) return responder(res, 400, { error: 'se esperaba un objeto' });
        fs.mkdirSync(carpeta(), { recursive: true });
        fs.writeFileSync(path.join(carpeta(), `${accion}.json`), JSON.stringify(datos, null, 2) + '\n');
        construir();
        responder(res, 200, { ok: true });
      } catch (e) { responder(res, 500, { error: String(e.message || e).split('\n')[0] }); }
    });
  });
}

module.exports = { crear };
if (require.main === module) {
  const puerto = process.env.FF_EDITOR_PUERTO ? +process.env.FF_EDITOR_PUERTO : 8770;
  try { construir(); } catch (e) { console.error('build.py ha fallado:', String(e.message).split('\n')[0]); process.exit(1); }   // que el visor lleve lo que ya hay en ajustes/
  crear().listen(puerto, '127.0.0.1', function () { console.log(`Editor de afinado: http://localhost:${this.address().port}/?editor  (Ctrl+C para salir)`); });
}
