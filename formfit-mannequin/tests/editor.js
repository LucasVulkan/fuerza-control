// Prueba de humo del servidor del editor de afinado (X03-27): arranca tools/editor.js en un puerto libre, con una carpeta temporal de destino y sin ejecutar build.py,
// guarda un afinado, comprueba el archivo y rechaza lo que no debe (acción inexistente, nombre raro, cuerpo enorme o roto, host ajeno).
const http = require('http'), fs = require('fs'), os = require('os'), path = require('path');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ajustes-'));
Object.assign(process.env, { FF_AJUSTES: path.join(dir, 'ajustes'), FF_SIN_BUILD: '1' });
const { crear } = require('../tools/editor');
const srv = crear();
const pedir = (puerto, metodo, ruta, cuerpo, host) => new Promise((ok, mal) => { const r = http.request({ host: '127.0.0.1', port: puerto, method: metodo, path: ruta, headers: host ? { host } : {} }, res => { let t = ''; res.on('data', c => t += c); res.on('end', () => ok({ codigo: res.statusCode, t })); });
  r.on('error', e => ok({ codigo: 'error ' + e.code, t: '' })); r.end(cuerpo); });
srv.listen(0, '127.0.0.1', async () => {
  const p = srv.address().port, fallos = [], afinado = { base: { muneca: [10, 0, -10], codos: [0, 20, 0] }, rangos: { grip: { max: 1.3 } } };
  const ok = (c, txt) => { console.log(`${c ? 'ok   ' : 'FALLO'} ${txt}`); if (!c) fallos.push(txt); };
  const f = path.join(dir, 'ajustes', 'lat_pulldown.json');
  let r = await pedir(p, 'POST', '/ajustes/lat_pulldown', JSON.stringify(afinado));
  ok(r.codigo === 200, `POST de una acción válida: ${r.codigo}`);
  ok(fs.existsSync(f) && JSON.stringify(JSON.parse(fs.readFileSync(f, 'utf8'))) === JSON.stringify(afinado) && fs.readFileSync(f, 'utf8').includes('\n  "base"'), 'el archivo existe, con el mismo contenido y sangría de 2');
  r = await pedir(p, 'POST', '/ajustes/no_existe', '{}'); ok(r.codigo === 400 && !fs.existsSync(path.join(dir, 'ajustes', 'no_existe.json')), `acción inexistente: ${r.codigo}, sin archivo`);
  r = await pedir(p, 'POST', '/ajustes/..%2F..%2Fx', '{}'); ok(r.codigo === 404, `nombre con ruta: ${r.codigo}`);
  r = await pedir(p, 'POST', '/ajustes/lat_pulldown', '{"a":"' + 'x'.repeat(70000) + '"}'); ok(r.codigo === 413 || r.codigo === 'error ECONNRESET', `cuerpo de 70 KB: ${r.codigo}`);
  r = await pedir(p, 'POST', '/ajustes/lat_pulldown', '[1]'); ok(r.codigo === 400, `no es un objeto: ${r.codigo}`);
  r = await pedir(p, 'POST', '/ajustes/lat_pulldown', 'no es json'); ok(r.codigo === 400, `JSON roto: ${r.codigo}`);
  r = await pedir(p, 'POST', '/ajustes/lat_pulldown', '{}', 'ejemplo.com'); ok(r.codigo === 403, `host ajeno: ${r.codigo}`);
  r = await pedir(p, 'GET', '/'); ok(r.codigo === 302, `GET / lleva a /?editor: ${r.codigo}`);
  r = await pedir(p, 'GET', '/?editor'); ok(r.codigo === 200 && r.t.includes('id="afinado"'), `GET /?editor sirve el visor con el bloque Afinado: ${r.codigo}`);
  ok(fs.readdirSync(path.join(dir, 'ajustes')).join() === 'lat_pulldown.json', 'solo se escribió lat_pulldown.json');
  srv.close(); fs.rmSync(dir, { recursive: true, force: true });
  console.log(fallos.length ? `FALLOS: ${fallos.length}` : 'OK'); process.exit(fallos.length ? 1 : 0);
});
