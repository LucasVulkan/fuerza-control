/**
 * `npm run plan` — sirve `estado.html` en http://localhost:8769 y deja editarla:
 * arrastrar el plan reescribe `mobile/docs/plan.md`, pulsar una casilla de
 * prueba la marca o desmarca en su spec, y «+ Idea» añade una a ideas.md. Cada vez que se pide la página se
 * regenera con `estado.mjs`, así que también recoge lo que cambie a mano.
 *
 * Solo escucha en 127.0.0.1 y solo escribe plan.md, ideas.md o un .md de docs/specs.
 */
import http from 'node:http';
import { readFileSync, writeFileSync, readdirSync, unlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const DOCS = join(RAIZ, 'mobile', 'docs');
const SPECS = join(DOCS, 'specs');
const PUERTO = 8769;

const generar = () => {
  execFileSync(process.execPath, [join(RAIZ, 'scripts', 'estado.mjs')], { cwd: RAIZ, stdio: 'pipe' });
  return readFileSync(join(DOCS, 'estado.html'));
};

const CABECERA = `<!-- Plan: cada "## " es una versión, en orden; debajo, un código por línea
     (spec T08, tarea T08-03 o idea P17) en el orden en que se hará.
     Lo reescribe \`npm run plan\` al arrastrar; a mano también vale. -->
`;

const guardarPlan = ({ versiones }) => {
  if (!Array.isArray(versiones)) throw new Error('falta la lista de versiones');
  const texto = versiones.map((v) => {
    const nombre = String(v.nombre ?? '').replace(/\s+/g, ' ').trim();
    if (!nombre) throw new Error('una versión sin nombre');
    const items = (v.items ?? []).map(String);
    const malo = items.find((c) => !/^[A-Z]\d{2}(-\d{2})?$/.test(c));
    if (malo) throw new Error(`código raro: ${malo}`);
    return [`## ${nombre}`, ...items].join('\n');
  }).join('\n\n');
  return [join(DOCS, 'plan.md'), `${CABECERA}\n${texto}\n`];
};

/**
 * Cambia la casilla `i` de las listas `**Probar <codigo>**` del archivo. Recorre
 * las listas igual que `pruebasDe` en estado.mjs, para que el índice sea el mismo.
 */
const cambiarCasilla = ({ archivo, codigo, i }) => {
  if (!readdirSync(SPECS).includes(archivo) || !archivo.endsWith('.md')) throw new Error(`archivo desconocido: ${archivo}`);
  const ruta = join(SPECS, archivo);
  const crlf = readFileSync(ruta, 'utf8').includes('\r\n');
  const lineas = readFileSync(ruta, 'utf8').replace(/\r/g, '').split('\n');
  const sinCita = (l) => l.replace(/^>\s?/, '');
  let n = 0;
  for (let k = 0; k < lineas.length; k++) {
    if (sinCita(lineas[k]).trim() !== `**Probar ${codigo}**`) continue;
    let j = k + 1;
    while (j < lineas.length && sinCita(lineas[j]).trim() === '') j++;
    for (; j < lineas.length; j++) {
      const l = sinCita(lineas[j]);
      if (/^- \[[ xX]\] /.test(l)) {
        if (n++ === i) {
          lineas[j] = lineas[j].replace(/- \[([ xX])\]/, (_, m) => (m === ' ' ? '- [x]' : '- [ ]'));
          return [ruta, lineas.join(crlf ? '\r\n' : '\n')];
        }
      } else if (!(/^\s{2,}\S/.test(l))) break;
    }
  }
  throw new Error(`no encuentro la casilla ${codigo}.${i + 1} en ${archivo}`);
};

/** Añade `## P17 · Título` + notas al final de ideas.md. El código lo propone la página (el siguiente libre del tema). */
const nuevaIdea = ({ codigo, titulo, cuerpo }) => {
  codigo = String(codigo ?? '');
  titulo = String(titulo ?? '').replace(/\s+/g, ' ').trim();
  if (codigo && !/^[A-Z]\d{2}$/.test(codigo)) throw new Error(`código raro: ${codigo}`);
  if (!titulo) throw new Error('la idea no tiene título');
  const ruta = join(DOCS, 'ideas.md');
  const texto = readFileSync(ruta, 'utf8');
  const fin = texto.includes('\r\n') ? '\r\n' : '\n';
  const notas = String(cuerpo ?? '').replace(/\r/g, '').trim()
    .replace(/^## /gm, '### '); // un `## ` en las notas partiría la idea en dos
  const idea = [`## ${codigo ? `${codigo} · ` : ''}${titulo}`, ...(notas ? ['', notas] : [])].join('\n');
  return [ruta, `${texto.replace(/\s*$/, '')}\n\n${idea}\n`.replace(/\r?\n/g, fin)];
};

const API = { '/api/plan': guardarPlan, '/api/casilla': cambiarCasilla, '/api/idea': nuevaIdea };

http.createServer((req, res) => {
  const fallo = (e) => {
    res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
    const texto = String(e.stderr || e.message || e);
    res.end(texto.match(/^Error: (.*)$/m)?.[1] ?? texto);
  };
  if (req.method === 'GET' && (req.url === '/' || req.url.startsWith('/estado.html'))) {
    try { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(generar()); } catch (e) { fallo(e); }
  } else if (req.method === 'GET' && req.url === '/api/ok') {
    res.end('ok');
  } else if (req.method === 'POST' && API[req.url]) {
    let cuerpo = '';
    req.on('data', (d) => { cuerpo += d; });
    req.on('end', () => {
      try {
        const [ruta, nuevo] = API[req.url](JSON.parse(cuerpo));
        let antes = null;
        try { antes = readFileSync(ruta, 'utf8'); } catch {}
        writeFileSync(ruta, nuevo, 'utf8');
        // Si lo guardado rompe una regla de estado.mjs, se deshace y se avisa:
        // nunca se queda un .md que impida generar la página.
        try { generar(); } catch (e) { if (antes === null) unlinkSync(ruta); else writeFileSync(ruta, antes, 'utf8'); throw e; }
        res.end('ok');
      } catch (e) { fallo(e); }
    });
  } else {
    res.writeHead(404).end();
  }
}).listen(PUERTO, '127.0.0.1', () => console.log(`Plan y estado en http://localhost:${PUERTO}`));
