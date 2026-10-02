/**
 * Genera `mobile/docs/estado.html` — el estado del proyecto en una página.
 *
 * NO es una fuente de datos: lo lee todo de las specs, que son lo que se
 * mantiene de verdad. Si aquí sale algo mal, se corrige en el documento, no
 * aquí. Esa es la razón de que esto sea un generador y no una página escrita a
 * mano: una segunda copia del estado se desvía el primer día que a alguien se
 * le olvide actualizarla.
 *
 * ── Lo que se lee de cada spec ──────────────────────────────────────────────
 *
 *   # Spec — Título
 *
 *   > Tema: <uno de TEMAS>
 *   > En corto: una frase, en cristiano, de qué va la cosa
 *   > Fase C19 · <estado> · Título de la fase · §3
 *   >
 *   > Estado: **…**   ← la prosa de siempre, con el detalle
 *
 * y, en cualquier sitio del documento, la lista de pruebas de cada fase:
 *
 *   **Probar C19**
 *
 *   - [ ] Lo que hay que comprobar en el móvil…
 *     (las líneas sangradas siguen siendo la misma casilla)
 *   - [x] Una que ya se probó
 *
 * Estados de la cabecera → lo que dice la página:
 *   pendiente                                  → Por hacer
 *   hecho      con alguna casilla sin marcar   → Por probar
 *   hecho      con todas marcadas              → Terminada
 *   terminado  (sin lista: nada que probar a mano, o anterior a las casillas)
 *                                              → Terminada
 *   aparcado                                   → Aparcada
 *
 * `hecho` sin lista FALLA: quien cierra una fase dice qué hay que probar, o la
 * marca `terminado` si no hay nada. Así la lista de «por probar» no depende de
 * que alguien se acuerde.
 *
 * Si una convención se rompe, esto FALLA en vez de callarse: una página de
 * estado que omite cosas en silencio es peor que no tenerla.
 *
 * Uso: `npm run estado`
 */

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join, basename } from 'node:path';

const RAIZ   = fileURLToPath(new URL('..', import.meta.url));
const SPECS  = join(RAIZ, 'mobile', 'docs', 'specs');
const SALIDA = join(RAIZ, 'mobile', 'docs', 'estado.html');

/**
 * Orden, etiqueta y LETRA de cada tema. La letra es la primera mitad del código
 * con el que se habla de una cosa concreta: `E14` es el fallo 14 de la
 * auditoría, `M02` la segunda fase de monetización. La segunda mitad la asigna
 * quien escribe la spec; aquí solo se comprueba que no se repita.
 */
const TEMAS = [
  ['errores',       'Errores',              'E'],
  ['monetización',  'Monetización',         'M'],
  ['onboarding',    'Onboarding',           'O'],
  ['programas',     'Programas y editor',   'P'],
  ['entrenamiento', 'Entrenamiento',        'T'],
  ['conexión',      'Entrenador ↔ cliente', 'C'],
  ['ui',            'Estructura y UI',      'U'],
  ['analítica',     'Analítica',            'A'],
  ['integridad',    'Integridad y tests',   'I'],
];
const letraDe = (tema) => TEMAS.find(([t]) => t === tema)?.[2];

const ESTADOS = ['pendiente', 'hecho', 'terminado', 'aparcado'];

const leer = (f) => readFileSync(join(SPECS, f), 'utf8').replace(/\r/g, '');
const esc  = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** Markdown mínimo: negrita, código y enlaces. Nada más — no hace falta. */
const md = (s) => esc(s)
  .replace(/`([^`]+)`/g, '<code>$1</code>')
  .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
  // Los `**` que quedan abren un negrita que se cierra fuera del trozo leido.
  .replace(/\*\*/g, '');

/**
 * Listas `**Probar C19**` + casillas `- [ ]` / `- [x]`, en cualquier parte del
 * documento. Se admite el prefijo `>` porque alguna vive dentro de una cita.
 * Devuelve `{ C19: [{ hecha, texto }] }`.
 */
function pruebasDe(texto, f) {
  const lineas = texto.split('\n').map((l) => l.replace(/^>\s?/, ''));
  const out = {};
  for (let i = 0; i < lineas.length; i++) {
    const m = lineas[i].match(/^\*\*Probar ([A-Z]\d{2})\*\*\s*$/);
    if (!m) continue;
    const lista = (out[m[1]] ??= []);
    let j = i + 1;
    while (j < lineas.length && lineas[j].trim() === '') j++;
    for (; j < lineas.length; j++) {
      const item = lineas[j].match(/^- \[([ xX])\] (.*)$/);
      if (item) lista.push({ hecha: item[1] !== ' ', texto: item[2].trim() });
      else if (/^\s{2,}\S/.test(lineas[j]) && lista.length) lista.at(-1).texto += ' ' + lineas[j].trim();
      else break;
    }
    if (lista.length === 0) throw new Error(`${f}: "**Probar ${m[1]}**" sin ninguna casilla "- [ ] …" debajo`);
    i = j - 1;
  }
  return out;
}

// ── Fallos de la auditoría ────────────────────────────────────────────────────
const auditoria = leer('auditoria-tecnica.md');

const resumenFallo = new Map(
  [...auditoria.matchAll(/(?:^|\n)## (\d+)\. [^\n]*\n\n> En corto: ([^\n]+)/g)]
    .map((m) => [Number(m[1]), m[2].trim()]),
);

const fallos = [...auditoria.matchAll(/^\| \[(\d+)\]\(#\d+\) \| ([^|]+) \| ([^|]+) \| ([^|]+) \|$/gm)]
  .map(([, num, sev, titulo, archivo]) => ({
    num:     Number(num),
    sev:     sev.trim(),
    hecho:   titulo.includes('✅'),
    titulo:  titulo.replace('✅', '').trim(),
    archivo: archivo.trim().replace(/`/g, ''),
    corto:   resumenFallo.get(Number(num)) ?? '',
  }));

if (fallos.length === 0) {
  throw new Error('No se ha podido leer el índice de la auditoría — ¿cambió el formato de la tabla?');
}
const sinCorto = fallos.filter((f) => !f.corto).map((f) => f.num);
if (sinCorto.length) {
  throw new Error(`Fallos sin línea "> En corto:" bajo su título: ${sinCorto.join(', ')}`);
}

const peso = { '🔴': 0, '🟠': 1, '🟡': 2, '🟢': 3 };
const rank = (s) => peso[[...s][0]] ?? 9;

// ── Specs ─────────────────────────────────────────────────────────────────────
const clave = (lineas, nombre) => {
  const l = lineas.slice(0, 30).find((x) => x.startsWith(`> ${nombre}:`));
  return l ? l.slice(nombre.length + 3).trim() : '';
};

/**
 * El texto de una sección del documento, de su encabezado al siguiente del
 * mismo nivel o superior. Sale en crudo: el markdown se lee bien tal cual y
 * así las tablas y los bloques de código no dependen de un renderizador.
 */
function seccionDe(texto, num) {
  const lineas = texto.split('\n');
  const escN = num.replace(/\./g, '\\.');
  const abre = new RegExp(`^(#{2,5})\\s+${escN}[.\\s]`);
  const i = lineas.findIndex((l) => abre.test(l));
  if (i === -1) return null;
  const nivel = lineas[i].match(/^#+/)[0].length;
  let j = i + 1;
  while (j < lineas.length) {
    const h = lineas[j].match(/^(#{1,5})\s/);
    if (h && h[1].length <= nivel) break;
    j++;
  }
  return lineas.slice(i, j).join('\n').replace(/\s+$/, '');
}

/**
 * `> Fase M01 · pendiente · Identidad en RevenueCat · §3`
 *
 * Solo la cabecera, hasta la linea `> Estado:`: mas abajo la prosa tiene frases
 * que empiezan por "Fase 3 ..." dentro de la misma cita.
 */
const fasesDe = (lineas, f) => lineas
  .slice(0, Math.max(0, lineas.findIndex((l) => l.startsWith('> Estado:'))))
  .filter((l) => l.startsWith('> Fase '))
  .map((l) => {
    const trozos = l.slice(7).split('·').map((x) => x.trim());
    const [codigo, estado] = trozos;
    const ref = trozos[trozos.length - 1];
    if (!/^[A-Z]\d{2}$/.test(codigo)) throw new Error(`${f}: código de fase "${codigo}" — se espera una letra y dos dígitos, p. ej. M01`);
    if (!ESTADOS.includes(estado)) throw new Error(`${f}: la fase ${codigo} tiene estado "${estado}". Los válidos: ${ESTADOS.join(', ')}`);
    if (!/^§[\d.]+$/.test(ref)) throw new Error(`${f}: la fase ${codigo} no acaba en "· §N", la sección del documento que la cuenta`);
    const titulo = trozos.slice(2, -1).join(' · ').trim();
    if (!titulo) throw new Error(`${f}: la fase ${codigo} no tiene título`);
    return { codigo, estado, titulo, ref };
  });

/** Pestaña en la que cae una fase: lo único que decide la página. */
const situacionDe = (x) => {
  if (x.estado === 'pendiente') return 'hacer';
  if (x.estado === 'aparcado')  return 'aparcada';
  if (x.estado === 'terminado') return 'terminada';
  return x.pruebas.every((p) => p.hecha) ? 'terminada' : 'probar';
};

const specs = readdirSync(SPECS)
  .filter((f) => f.endsWith('.md') && f !== 'README.md' && f !== 'auditoria-tecnica.md')
  .map((f) => {
    const texto  = leer(f);
    const lineas = texto.split('\n');
    if (/\*\*Probar en dispositivo/.test(texto)) {
      throw new Error(`${f}: queda un "**Probar en dispositivo.**" suelto. Las pruebas van en una lista "**Probar Xnn**" con casillas "- [ ]" (ver scripts/estado.mjs)`);
    }
    const pruebas = pruebasDe(texto, f);
    const fases  = fasesDe(lineas, f).map((x) => {
      const cuerpo = seccionDe(texto, x.ref.slice(1));
      // Una referencia que ya no existe es un puntero roto: mejor que reviente
      // aquí que descubrirlo al pulsarla.
      if (!cuerpo) throw new Error(`${f}: la fase ${x.codigo} apunta a ${x.ref} y ahí no hay ningún encabezado`);
      const fase = { ...x, cuerpo, pruebas: pruebas[x.codigo] ?? [] };
      if (fase.estado === 'hecho' && fase.pruebas.length === 0) {
        throw new Error(`${f}: la fase ${x.codigo} está "hecho" y no dice qué probar. Añade "**Probar ${x.codigo}**" con sus casillas, o márcala "terminado" si no hay nada que probar a mano`);
      }
      if (fase.estado === 'terminado' && fase.pruebas.some((p) => !p.hecha)) {
        throw new Error(`${f}: la fase ${x.codigo} está "terminado" con casillas sin marcar. Déjala en "hecho": pasa a terminada sola cuando se marquen todas`);
      }
      return { ...fase, situacion: situacionDe(fase) };
    });
    const ajenas = Object.keys(pruebas).filter((c) => !fases.some((x) => x.codigo === c));
    if (ajenas.length) throw new Error(`${f}: "**Probar ${ajenas[0]}**" no corresponde a ninguna fase de su cabecera`);
    const spec = {
      archivo: f,
      titulo:  (lineas[0] ?? '').replace(/^#\s*(Spec —\s*)?/, '').trim() || basename(f, '.md'),
      tema:    clave(lineas, 'Tema'),
      corto:   clave(lineas, 'En corto'),
      estado:  clave(lineas, 'Estado'),
      fases,
    };
    for (const k of ['tema', 'corto', 'estado']) {
      if (!spec[k]) throw new Error(`${f}: falta la línea "> ${k}:" de la cabecera estándar (ver scripts/estado.mjs)`);
    }
    if (!TEMAS.some(([t]) => t === spec.tema)) {
      throw new Error(`${f}: tema "${spec.tema}" desconocido. Los válidos: ${TEMAS.map(([t]) => t).join(', ')}`);
    }
    if (fases.length === 0) {
      throw new Error(`${f}: ninguna línea "> Fase ${letraDe(spec.tema) ?? 'X'}NN · estado · título". Toda spec tiene al menos una.`);
    }
    const ajena = fases.find((x) => x.codigo[0] !== letraDe(spec.tema));
    if (ajena) throw new Error(`${f}: la fase ${ajena.codigo} no empieza por "${letraDe(spec.tema)}", la letra del tema "${spec.tema}"`);
    return spec;
  })
  .sort((a, b) => TEMAS.findIndex(([t]) => t === a.tema) - TEMAS.findIndex(([t]) => t === b.tema)
    || a.titulo.localeCompare(b.titulo));

// Los códigos son la forma de referirse a una fase entre sesiones: si dos
// specs se pisan, el de ayer deja de significar lo que decía.
const vistos = new Map();
for (const s of specs) {
  for (const { codigo } of s.fases) {
    if (vistos.has(codigo)) throw new Error(`Código ${codigo} repetido: ${vistos.get(codigo)} y ${s.archivo}`);
    vistos.set(codigo, s.archivo);
  }
}

// ── Datos derivados ───────────────────────────────────────────────────────────
const cuenta = (fases) => {
  const c = { probar: 0, hacer: 0, terminada: 0, aparcada: 0, casillas: 0 };
  for (const x of fases) {
    c[x.situacion]++;
    if (x.situacion === 'probar') c.casillas += x.pruebas.filter((p) => !p.hecha).length;
  }
  return c;
};
const todasFases = specs.flatMap((s) => s.fases);
const total      = cuenta(todasFases);
const hechos     = fallos.filter((f) => f.hecho).length;
const criticos   = fallos.filter((f) => f.sev.includes('🔴'));
// `execFileSync` y no `execSync`: en Windows este ultimo pasa por cmd.exe, donde
// el separador `|` del formato se interpreta como una tuberia.
const commit = execFileSync('git', ['log', '-1', '--format=%h|%ad|%s', '--date=short'],
                            { cwd: RAIZ }).toString().trim().split('|');

/** El bloque del tablero en el que cae una spec: manda lo más urgente que tenga. */
for (const s of specs) {
  s.c = cuenta(s.fases);
  s.id = s.archivo.replace(/\.md$/, '');
  s.grupo = s.c.probar ? 'probar' : s.c.hacer ? 'hacer' : 'hecha';
}
const avance = (c) => c.terminada / (c.terminada + c.probar + c.hacer || 1);
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
const nombreTema = (tema) => TEMAS.find(([t]) => t === tema)[1];

/**
 * Anillo de progreso en dos tramos (terminado, por probar) sobre la pista gris.
 * Circunferencia 100 para que los porcentajes sean directamente la longitud;
 * el desfase 25 lo hace empezar a las doce.
 */
const anillo = (c, tam) => {
  const n = c.terminada + c.probar + c.hacer || 1;
  const t = c.terminada / n * 100;
  const p = c.probar / n * 100;
  const seg = (cls, largo, desde) => largo > 0
    ? `<circle cx="18" cy="18" r="15.9155" class="${cls}" stroke-dasharray="${largo.toFixed(2)} ${(100 - largo).toFixed(2)}" stroke-dashoffset="${(25 - desde).toFixed(2)}"/>`
    : '';
  const completa = c.probar === 0 && c.hacer === 0;
  return `<svg class="anillo" width="${tam}" height="${tam}" viewBox="0 0 36 36" aria-hidden="true">
    <circle cx="18" cy="18" r="15.9155" class="pista"/>${seg('t', t, 0)}${seg('p', p, t)}
    <text x="18" y="18" dy=".36em" text-anchor="middle">${completa ? '✓' : `${c.terminada}/${n}`}</text></svg>`;
};

const barra = (c) => {
  const n = c.terminada + c.probar + c.hacer || 1;
  const w = (k) => (c[k] / n * 100).toFixed(1);
  return `<div class="barra"><span class="t" style="width:${w('terminada')}%"></span><span class="p" style="width:${w('probar')}%"></span></div>`;
};

const chips = (c) => [
  c.casillas ? `<span class="chip p">${plural(c.casillas, 'prueba', 'pruebas')}</span>` : '',
  c.hacer ? `<span class="chip h">${c.hacer} por hacer</span>` : '',
  c.terminada ? `<span class="chip t">${plural(c.terminada, 'terminada', 'terminadas')}</span>` : '',
  c.aparcada ? `<span class="chip">${plural(c.aparcada, 'aparcada', 'aparcadas')}</span>` : '',
].join('');

const letra = (s) => `<span class="letra" title="${esc(nombreTema(s.tema))}">${letraDe(s.tema)}</span>`;

// ── Tablero ───────────────────────────────────────────────────────────────────
const tarjeta = (s) => `<button class="tile g-${s.grupo}" data-abre="${esc(s.id)}">
  ${anillo(s.c, 56)}
  <span class="tcuerpo">
    <span class="tcab">${letra(s)}<b>${esc(s.titulo)}</b></span>
    <span class="corto clamp">${md(s.corto)}</span>
    <span class="chips">${chips(s.c)}</span>
  </span>
</button>`;

const mini = (s) => `<button class="mini" data-abre="${esc(s.id)}">${letra(s)}<span>${esc(s.titulo)}</span>
  <span class="nfases">${plural(s.fases.length, 'fase', 'fases')}</span></button>`;

const BLOQUES = [
  ['probar', 'Por probar',           'Programado; falta que lo compruebes en el móvil.',
    (a, b) => b.c.casillas - a.c.casillas],
  ['hacer',  'Con cosas pendientes', 'Tienen fases sin programar todavía.',
    (a, b) => avance(b.c) - avance(a.c) || a.titulo.localeCompare(b.titulo)],
  ['hecha',  'Completadas',          'Todas sus fases terminadas.', () => 0],
];

const bloque = ([g, titulo, sub, orden]) => {
  const grupo = specs.filter((s) => s.grupo === g).sort(orden);
  if (grupo.length === 0) return '';
  return `<section class="bloque b-${g}">
    <h2><span class="punto"></span>${titulo}<span class="n">${grupo.length}</span></h2>
    <p class="sub">${sub}</p>
    <div class="${g === 'hecha' ? 'minis' : 'tiles'}">${grupo.map(g === 'hecha' ? mini : tarjeta).join('')}</div>
  </section>`;
};

const cuentaGrupo = (g) => specs.filter((s) => s.grupo === g).length;
const cifra = (g, num, texto) => `<div class="cifra c-${g}"><b>${num}</b><span>${texto}</span></div>`;

// ── Detalle de una spec ───────────────────────────────────────────────────────
const verDoc = (x, archivo) => `<details class="doc"><summary>Ver ${esc(x.ref)} de la spec</summary>
  <span class="ruta-doc">${esc(archivo)} ${esc(x.ref)}</span><pre>${esc(x.cuerpo)}</pre></details>`;

const casillas = (x) => `<ol class="pruebas">${x.pruebas.map((p, i) => `<li class="${p.hecha ? 'ok' : ''}">
  <span class="caja">${p.hecha ? '✓' : ''}</span><span class="n">${x.codigo}.${i + 1}</span><span>${md(p.texto)}</span></li>`).join('')}</ol>`;

const fase = {
  probar: (x, s) => `<div class="fase probar">
    <div class="fcab"><span class="cod">${esc(x.codigo)}</span><b>${md(x.titulo)}</b>
      <span class="chip p">${x.pruebas.filter((p) => p.hecha).length}/${x.pruebas.length}</span></div>
    ${casillas(x)}
    <div class="pista-uso">Cuando lo pruebes, dile a Claude «<b>${esc(x.codigo)} probada</b>» o «<b>${esc(x.codigo)}.1 falla: …</b>».</div>
    ${verDoc(x, s.archivo)}
  </div>`,
  hacer: (x, s) => `<div class="fase hacer ${x.situacion}">
    <div class="fcab"><span class="cod">${esc(x.codigo)}</span><b>${md(x.titulo)}</b>
      ${x.situacion === 'aparcada' ? '<span class="chip">aparcada</span>' : ''}
      ${x.pruebas.length ? `<span class="chip">${plural(x.pruebas.length, 'prueba preparada', 'pruebas preparadas')}</span>` : ''}</div>
    ${verDoc(x, s.archivo)}
  </div>`,
  terminada: (x) => `<div class="fase terminada">
    <div class="fcab"><span class="cod">${esc(x.codigo)}</span><span>${md(x.titulo)}</span>
      ${x.pruebas.length ? `<span class="chip t">✓ ${plural(x.pruebas.length, 'probada', 'probadas')}</span>` : ''}</div>
  </div>`,
};

const SECCIONES = [['probar', 'Por probar'], ['hacer', 'Por hacer'], ['terminada', 'Terminado']];

const detalle = (s) => `<section class="detalle" data-vista="${esc(s.id)}" hidden>
  <button class="volver" data-abre="">← Todas las specs</button>
  <div class="dcab">
    ${anillo(s.c, 88)}
    <div><div class="tema">${letra(s)}${esc(nombreTema(s.tema))} · <code>${esc(s.archivo)}</code></div>
      <h2>${esc(s.titulo)}</h2><p class="corto">${md(s.corto)}</p>
      <div class="chips">${chips(s.c)}</div></div>
  </div>
  ${SECCIONES.map(([k, e]) => {
    const fs = s.fases.filter((x) => x.situacion === k || (k === 'hacer' && x.situacion === 'aparcada'));
    return fs.length ? `<div class="dsec s-${k}"><h3><span class="punto"></span>${e}<span class="n">${fs.length}</span></h3>
      <div class="lista">${fs.map((x) => fase[k](x, s)).join('')}</div></div>` : '';
  }).join('')}
</section>`;

const filaFallo = (f) => `<tr class="${f.hecho ? 'ok' : 'pend'}">
  <td class="num"><span class="cod">E${String(f.num).padStart(2, '0')}</span></td>
  <td class="sev">${md(f.sev)}</td>
  <td><div class="tit">${f.hecho ? '<span class="tick">✅</span>' : ''}${md(f.titulo)}</div>
      <div class="corto">${md(f.corto)}</div></td>
  <td class="ruta"><code>${esc(f.archivo)}</code></td>
</tr>`;

const resumenSev = ['🔴', '🟠', '🟡', '🟢'].map((s) => {
  const g = fallos.filter((f) => f.sev.includes(s));
  return `${s} ${g.filter((f) => f.hecho).length}/${g.length}`;
}).join(' · ');

const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Estado — Forma Fit</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  :root{--bg:#0f1113;--card:#17191c;--card2:#1c1f23;--bd:#26292e;--tx:#e8eaed;--mut:#9aa0a6;--mut2:#5f666d;
        --pend:#f2c14e;--pendbg:#3a3220;--acc:#b8ff00;--accbg:#243016;--pista:#2a2e33;
        --num:'Barlow Condensed',system-ui,sans-serif}
  *{box-sizing:border-box}
  body{margin:0;padding:28px 16px 80px;background:var(--bg);color:var(--tx);
       font:15px/1.55 Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
  main{max-width:1040px;margin:0 auto}
  button{font:inherit;color:inherit;background:none;border:0;padding:0;cursor:pointer;text-align:left}
  button:focus-visible{outline:2px solid var(--acc);outline-offset:2px}
  code{background:#1e2126;padding:1px 5px;border-radius:4px;font-size:12px}
  [hidden]{display:none!important}
  .sub{color:var(--mut);font-size:13px;margin:0}
  .corto{color:var(--mut);font-size:13px;line-height:1.5;margin:0}

  /* ── cabecera ── */
  .top{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap}
  h1{font:700 34px/1 var(--num);letter-spacing:.01em;margin:0;text-transform:uppercase}
  h1 em{font-style:normal;color:var(--acc)}
  .gen{color:var(--mut2);font-size:12px}
  .resumen{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:22px}
  .cifra{background:var(--card);border:1px solid var(--bd);border-radius:14px;padding:14px 16px;border-top:3px solid var(--pista)}
  .cifra b{display:block;font:700 44px/1 var(--num)}
  .cifra span{color:var(--mut);font-size:13px}
  .c-probar{border-top-color:var(--pend)} .c-probar b{color:var(--pend)}
  .c-hecha{border-top-color:var(--acc)} .c-hecha b{color:var(--acc)}
  .global{margin-top:14px;display:flex;align-items:center;gap:12px;color:var(--mut);font-size:12.5px}
  .barra{flex:1;display:flex;height:8px;background:var(--pista);border-radius:4px;overflow:hidden}
  .barra .t{background:var(--acc)} .barra .p{background:var(--pend)}

  /* ── bloques del tablero ── */
  .bloque{margin-top:36px}
  h2{display:flex;align-items:center;gap:10px;font:700 22px/1.1 var(--num);text-transform:uppercase;letter-spacing:.03em;margin:0 0 4px}
  h2 .n,h3 .n{font:600 13px/1 Inter,sans-serif;color:var(--mut);background:var(--card2);border-radius:20px;padding:4px 9px}
  .punto{width:10px;height:10px;border-radius:50%;background:var(--mut2);flex:none}
  .b-probar .punto,.s-probar .punto{background:var(--pend);box-shadow:0 0 0 4px rgba(242,193,78,.15)}
  .b-hecha .punto,.s-terminada .punto{background:var(--acc)}
  .tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px;margin-top:14px}
  .tile{display:flex;gap:14px;align-items:flex-start;background:var(--card);border:1px solid var(--bd);
        border-radius:14px;padding:16px;transition:border-color .15s,transform .15s,background .15s}
  .tile:hover{border-color:#3a3f45;background:var(--card2);transform:translateY(-2px)}
  .tile.g-probar{border-color:#4a3f22;background:linear-gradient(180deg,#1f1c14,var(--card) 70%)}
  .tile.g-probar:hover{border-color:var(--pend)}
  .tcuerpo{display:flex;flex-direction:column;gap:6px;min-width:0}
  .tcab{display:flex;gap:8px;align-items:baseline}
  .tcab b{font-size:15px;line-height:1.3}
  .clamp{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
  .chips{display:flex;gap:6px;flex-wrap:wrap;margin-top:2px}
  .chip{font-size:11.5px;padding:3px 9px;border-radius:20px;background:var(--pista);color:var(--mut);white-space:nowrap}
  .chip.p{background:var(--pendbg);color:var(--pend);font-weight:600}
  .chip.t{background:var(--accbg);color:var(--acc)}
  .chip.h{background:#262a30;color:var(--tx)}
  .letra{flex:none;font:700 11px/1 ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--mut);
         background:var(--pista);border-radius:5px;padding:4px 5px}

  .anillo{flex:none}
  .anillo circle{fill:none;stroke-width:3.6}
  .anillo .pista{stroke:var(--pista)} .anillo .t{stroke:var(--acc)} .anillo .p{stroke:var(--pend)}
  .anillo text{fill:var(--tx);font:700 9px var(--num)}

  .minis{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:8px;margin-top:14px}
  .mini{display:flex;gap:9px;align-items:center;background:var(--card);border:1px solid var(--bd);
        border-left:3px solid var(--acc);border-radius:10px;padding:10px 12px;font-size:13.5px;color:#c5c9ce;
        transition:border-color .15s,background .15s}
  .mini:hover{background:var(--card2);border-color:#3a3f45;border-left-color:var(--acc);color:var(--tx)}
  .mini span:nth-child(2){flex:1;line-height:1.3}
  .nfases{font-size:11px;color:var(--mut2)}
  .mini.errores,.mini.errores:hover{border-left-color:var(--mut2)}

  /* ── detalle ── */
  .volver{color:var(--mut);font-size:13px;padding:8px 12px;border:1px solid var(--bd);border-radius:20px}
  .volver:hover{color:var(--tx);border-color:#3a3f45}
  .dcab{display:flex;gap:20px;align-items:center;margin:20px 0 8px;background:var(--card);border:1px solid var(--bd);
        border-radius:16px;padding:20px}
  .dcab h2{font-size:28px;margin:6px 0}
  .tema{display:flex;gap:8px;align-items:center;color:var(--mut);font-size:12px}
  .dcab .chips{margin-top:10px}
  .dsec{margin-top:28px}
  h3{display:flex;align-items:center;gap:10px;font:700 18px/1 var(--num);text-transform:uppercase;letter-spacing:.04em;margin:0 0 12px}
  .lista{display:flex;flex-direction:column;gap:8px}
  .fase{background:var(--card);border:1px solid var(--bd);border-left:3px solid #4a4f55;border-radius:12px;padding:14px 16px}
  .fase.probar{border-left-color:var(--pend)}
  .fase.terminada{border-left-color:var(--acc);padding:9px 14px;color:var(--mut);font-size:13.5px}
  .fase.aparcada{opacity:.55}
  .fcab{display:flex;gap:10px;align-items:baseline;flex-wrap:wrap}
  .fcab b,.fcab>span:not(.cod):not(.chip){flex:1;min-width:60%;line-height:1.4}
  .cod{font:600 11px/1 ui-monospace,SFMono-Regular,Menlo,monospace;background:var(--pista);color:var(--mut);
       border-radius:5px;padding:4px 6px;letter-spacing:.03em}
  .probar .cod{background:var(--pendbg);color:var(--pend)}
  .terminada .cod{background:var(--accbg);color:var(--acc)}
  .pruebas{list-style:none;margin:14px 0 0;padding:0;display:flex;flex-direction:column;gap:12px}
  .pruebas li{display:flex;gap:10px;font-size:14px;line-height:1.55}
  .pruebas li.ok{color:var(--mut)}
  .caja{flex:none;width:18px;height:18px;margin-top:2px;border:1.5px solid var(--pend);border-radius:5px;
        font-size:12px;line-height:15px;text-align:center;color:#111;font-weight:700}
  .ok .caja{background:var(--acc);border-color:var(--acc)}
  .pruebas .n{flex:none;font:500 11px/1.9 ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--mut);min-width:40px}
  .pista-uso{margin-top:14px;font-size:12px;color:var(--mut)} .pista-uso b{color:var(--tx);font-weight:500}
  details.doc{margin-top:10px}
  details.doc summary{font-size:12px;color:var(--mut);cursor:pointer}
  .ruta-doc{display:block;font-size:10.5px;color:var(--mut2);margin:8px 0 6px;font-family:ui-monospace,monospace}
  .doc pre{margin:0;white-space:pre-wrap;word-break:break-word;font-size:11.5px;line-height:1.6;color:var(--mut);
           max-height:360px;overflow:auto;border-left:2px solid var(--bd);padding-left:11px;
           font-family:ui-monospace,SFMono-Regular,Menlo,monospace}

  .tabla-wrap{overflow-x:auto;margin-top:16px}
  table{width:100%;border-collapse:collapse;font-size:14px}
  th{text-align:left;color:var(--mut);font-weight:500;font-size:12px;text-transform:uppercase;
     letter-spacing:.05em;padding:0 8px 8px;border-bottom:1px solid var(--bd)}
  td{padding:11px 8px;border-bottom:1px solid #1e2124;vertical-align:top}
  tr.ok td{color:var(--mut)} .num{width:34px} .tick{margin-right:6px}
  .sev{white-space:nowrap;width:1%;padding-right:14px} .ruta{width:26%;font-size:12px} .tit{margin-bottom:3px}

  footer{color:var(--mut2);font-size:12px;margin-top:48px;border-top:1px solid var(--bd);padding-top:14px}

  @media (max-width:600px){
    h1{font-size:28px}
    .resumen{gap:6px} .cifra{padding:10px 12px} .cifra b{font-size:34px} .cifra span{font-size:11.5px}
    .tiles{grid-template-columns:1fr}
    .dcab{flex-direction:column;align-items:flex-start;gap:12px;padding:16px}
    .dcab h2{font-size:24px}
  }
</style></head><body>
<main>
  <div class="top">
    <h1>Forma Fit <em>/</em> estado</h1>
    <span class="gen">Generado con <code>npm run estado</code> · ${esc(commit[1] ?? '')}</span>
  </div>

  <div id="tablero">
    <div class="resumen">
      ${cifra('probar', cuentaGrupo('probar'), `specs por probar · ${plural(total.casillas, 'prueba', 'pruebas')}`)}
      ${cifra('hacer', cuentaGrupo('hacer'), 'specs con cosas pendientes')}
      ${cifra('hecha', cuentaGrupo('hecha'), 'specs completadas')}
    </div>
    <div class="global">${barra(total)}<span>${total.terminada}/${total.terminada + total.probar + total.hacer} fases</span></div>

    ${BLOQUES.map(bloque).join('')}

    <section class="bloque">
      <h2><span class="punto"></span>Auditoría técnica<span class="n">${hechos}/${fallos.length}</span></h2>
      <p class="sub">Los fallos de <code>auditoria-tecnica.md</code>.</p>
      <div class="minis"><button class="mini errores" data-abre="errores"><span class="letra">E</span>
        <span>${hechos === fallos.length ? 'Todos los fallos resueltos' : plural(fallos.length - hechos, 'fallo pendiente', 'fallos pendientes')}</span>
        <span class="nfases">${hechos}/${fallos.length}</span></button></div>
    </section>
  </div>

  ${specs.map(detalle).join('\n')}

  <section class="detalle" data-vista="errores" hidden>
    <button class="volver" data-abre="">← Todas las specs</button>
    <div class="dcab"><div><div class="tema"><span class="letra">E</span>Errores · <code>auditoria-tecnica.md</code></div>
      <h2>Auditoría técnica</h2><p class="corto">${hechos}/${fallos.length} resueltos · críticos
      ${criticos.filter((f) => f.hecho).length}/${criticos.length} · ${resumenSev}</p></div></div>
    <div class="tabla-wrap"><table>
      <thead><tr><th>#</th><th></th><th>Fallo</th><th>Archivo</th></tr></thead>
      <tbody>${[...fallos]
        .sort((a, b) => (a.hecho - b.hecho) || rank(a.sev) - rank(b.sev) || a.num - b.num)
        .map(filaFallo).join('')}</tbody>
    </table></div>
  </section>

  <footer>${esc(commit[0] ?? '')} · ${esc(commit[1] ?? '')} · ${esc((commit[2] ?? '').slice(0, 90))}</footer>
</main>
<script>
  // Vistas por JS y no anclas de hash: la página se abre también como data:
  // URL, y ahí una navegación por #ancla no hace nada. localStorage puede no
  // existir o lanzar por lo mismo: sin él se arranca siempre en el tablero.
  const tablero = document.getElementById('tablero');
  const vistas = document.querySelectorAll('.detalle');
  let abierta = '';
  try { abierta = localStorage.getItem('estado.spec') || ''; } catch {}
  if (abierta && !document.querySelector('[data-vista="' + abierta + '"]')) abierta = '';

  const pintar = () => {
    tablero.hidden = !!abierta;
    vistas.forEach((v) => { v.hidden = v.dataset.vista !== abierta; });
    try { localStorage.setItem('estado.spec', abierta); } catch {}
  };
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-abre]');
    if (!b) return;
    abierta = b.dataset.abre;
    pintar();
    window.scrollTo(0, 0);
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && abierta) { abierta = ''; pintar(); } });
  pintar();
</script>
</body></html>`;

writeFileSync(SALIDA, html, 'utf8');
// Buscar a mano el siguiente numero libre es justo como se acaba reutilizando
// uno: se imprime, y quien anada una fase copia de aqui.
const libres = TEMAS.map(([, , l]) => {
  const usados = [...vistos.keys(), ...fallos.map((f) => `E${String(f.num).padStart(2, '0')}`)]
    .filter((c) => c[0] === l).map((c) => Number(c.slice(1)));
  return `${l}${String(Math.max(0, ...usados) + 1).padStart(2, '0')}`;
});
console.log(`Siguiente código libre: ${libres.join(' · ')}`);

const porProbar = todasFases.filter((x) => x.situacion === 'probar').map((x) => x.codigo);
console.log(`${total.terminada} terminadas · ${total.probar} por probar${porProbar.length ? ` (${porProbar.join(', ')})` : ''} `
  + `· ${total.hacer} por hacer · ${total.aparcada} aparcadas · ${hechos}/${fallos.length} fallos resueltos`);
console.log(SALIDA);
