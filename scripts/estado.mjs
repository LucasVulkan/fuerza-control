/**
 * Genera `mobile/docs/estado.html` — el estado del proyecto en una página.
 *
 * NO es una fuente de datos: lo lee todo de las specs, que son lo que se
 * mantiene de verdad. Si aquí sale algo mal, se corrige en el documento, no
 * aquí. Esa es la razón de que esto sea un generador y no una página escrita a
 * mano: una segunda copia del estado se desvía el primer día que a alguien se
 * le olvide actualizarla.
 *
 * ── La cabecera estándar de una spec ────────────────────────────────────────
 *
 *   # Spec — Título
 *
 *   > Tema: <uno de TEMAS>
 *   > Progreso: hecho | parcial | sin-empezar
 *   > En corto: una frase, en cristiano, de qué va la cosa
 *   > Falta: qué queda por hacer, o "Nada."
 *   >
 *   > Estado: **…**   ← la prosa de siempre, con el detalle
 *
 * `En corto` es lo que hace útil esta página meses después: el título y el
 * archivo no bastan para acordarse de qué iba algo. Lo mismo dentro de la
 * auditoría, donde cada fallo lleva su propia línea `> En corto:`.
 *
 * Otras convenciones que se leen de aquí:
 *   · filas `| [n](#n) | severidad | ✅? titulo | archivo |` del índice de la auditoría
 *   · bloques `**Probar en dispositivo.** …` (hasta la línea en blanco) allí donde los haya
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

/** Orden y etiqueta de las secciones. El `tema:` de una spec sale de aquí. */
const TEMAS = [
  ['errores',      'Errores'],
  ['monetización', 'Monetización'],
  ['onboarding',   'Onboarding'],
  ['programas',    'Programas y editor'],
  ['entrenamiento', 'Entrenamiento'],
  ['conexión',     'Entrenador ↔ cliente'],
  ['ui',           'Estructura y UI'],
];
const PROGRESOS = ['hecho', 'parcial', 'sin-empezar'];
/** El valor de la spec es la clave; esto es solo como se lee en pantalla. */
const ETIQUETA = { hecho: 'Cerrada', parcial: 'A medias', 'sin-empezar': 'Sin empezar' };

/** Ancla ASCII: un `href="#monetización"` funciona, pero se rompe al copiarlo. */
const slug = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/gi, '-');

const leer = (f) => readFileSync(join(SPECS, f), 'utf8');
const esc  = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** Markdown mínimo: negrita, código y enlaces. Nada más — no hace falta. */
const md = (s) => esc(s)
  .replace(/`([^`]+)`/g, '<code>$1</code>')
  .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
  // Los `**` que quedan abren un negrita que se cierra fuera del trozo leido.
  .replace(/\*\*/g, '');

/**
 * Bloques `**Probar en dispositivo.**` hasta la línea en blanco. Se admite el
 * prefijo `>` porque algunos viven dentro de la cita de cabecera.
 */
function pruebasDe(texto) {
  return [...texto.matchAll(/\*\*Probar en dispositivo\.\*\*([\s\S]*?)(?:\n\s*\n|\n>\s*\n)/g)]
    .map((m) => m[1].split('\n').map((l) => l.replace(/^>\s?/, '').trim()).join(' ').trim())
    .filter(Boolean);
}

// ── Fallos de la auditoría ────────────────────────────────────────────────────
const auditoria = leer('auditoria-tecnica.md');

const resumenFallo = new Map(
  [...auditoria.matchAll(/(?:^|\n)## (\d+)\. [^\n]*\r?\n\r?\n> En corto: ([^\r\n]+)/g)]
    .map((m) => [Number(m[1]), m[2].trim()]),
);

const fallos = [...auditoria.matchAll(/^\| \[(\d+)\]\(#\d+\) \| ([^|]+) \| ([^|]+) \| ([^|]+) \|\r?$/gm)]
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

const specs = readdirSync(SPECS)
  .filter((f) => f.endsWith('.md') && f !== 'README.md')
  .map((f) => {
    const texto  = leer(f);
    const lineas = texto.split('\n');
    const spec = {
      archivo: f,
      titulo:  (lineas[0] ?? '').replace(/^#\s*(Spec —\s*)?/, '').trim() || basename(f, '.md'),
      tema:     clave(lineas, 'Tema'),
      progreso: clave(lineas, 'Progreso'),
      corto:    clave(lineas, 'En corto'),
      falta:    clave(lineas, 'Falta'),
      estado:   clave(lineas, 'Estado'),
      pruebas:  pruebasDe(texto),
    };
    for (const k of ['tema', 'progreso', 'corto', 'falta', 'estado']) {
      if (!spec[k]) throw new Error(`${f}: falta la línea "> ${k}:" de la cabecera estándar (ver scripts/estado.mjs)`);
    }
    if (!TEMAS.some(([t]) => t === spec.tema)) {
      throw new Error(`${f}: tema "${spec.tema}" desconocido. Los válidos: ${TEMAS.map(([t]) => t).join(', ')}`);
    }
    if (!PROGRESOS.includes(spec.progreso)) {
      throw new Error(`${f}: progreso "${spec.progreso}" desconocido. Los válidos: ${PROGRESOS.join(', ')}`);
    }
    return spec;
  });

// ── Datos derivados ───────────────────────────────────────────────────────────
const hechos   = fallos.filter((f) => f.hecho).length;
const criticos = fallos.filter((f) => f.sev.includes('🔴'));
const pruebas  = specs.flatMap((s) => s.pruebas.map((p) => ({ spec: s.titulo, tema: s.tema, texto: p })));
const porProg  = (p) => specs.filter((s) => s.progreso === p).length;
// `execFileSync` y no `execSync`: en Windows este ultimo pasa por cmd.exe, donde
// el separador `|` del formato se interpreta como una tuberia.
const commit   = execFileSync('git', ['log', '-1', '--format=%h|%ad|%s', '--date=short'],
                              { cwd: RAIZ }).toString().trim().split('|');

const barra = (n, total) => `<div class="barra"><span style="width:${(n / total * 100).toFixed(1)}%"></span></div>`;

const filaFallo = (f) => `<tr class="${f.hecho ? 'ok' : 'pend'}">
  <td class="num">${f.num}</td>
  <td class="sev">${md(f.sev)}</td>
  <td><div class="tit">${f.hecho ? '<span class="tick">✅</span>' : ''}${md(f.titulo)}</div>
      <div class="corto">${md(f.corto)}</div></td>
  <td class="ruta"><code>${esc(f.archivo)}</code></td>
</tr>`;

const resumenSev = ['🔴', '🟠', '🟡', '🟢'].map((s) => {
  const g = fallos.filter((f) => f.sev.includes(s));
  return `${s} ${g.filter((f) => f.hecho).length}/${g.length}`;
}).join(' · ');

const tarjetaSpec = (s) => `<div class="ficha ${s.progreso}">
  <div class="fila">
    <b>${esc(s.titulo)}</b>
    <span class="chip ${s.progreso}">${esc(ETIQUETA[s.progreso])}</span>
  </div>
  <p class="corto">${md(s.corto)}</p>
  <p class="falta"><span>Falta</span> ${md(s.falta)}</p>
  ${s.pruebas.length ? `<p class="tienePrueba">🔍 ${s.pruebas.length} prueba${s.pruebas.length > 1 ? 's' : ''} a mano</p>` : ''}
  <div class="pie"><code>${esc(s.archivo)}</code></div>
</div>`;

const seccionTema = ([tema, etiqueta]) => {
  const grupo = specs.filter((s) => s.tema === tema && s.archivo !== 'auditoria-tecnica.md');
  if (grupo.length === 0) return '';
  const listos = grupo.filter((s) => s.progreso === 'hecho').length;
  const orden  = (s) => PROGRESOS.indexOf(s.progreso);
  return `<section class="seccion" data-sec="${slug(tema)}">
  <h2>${esc(etiqueta)} <small>${listos}/${grupo.length} cerradas</small></h2>
  <div class="rejilla">${[...grupo].sort((a, b) => orden(b) - orden(a) || a.titulo.localeCompare(b.titulo)).map(tarjetaSpec).join('')}</div>
  </section>`;
};

const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Estado — Forma Fit</title>
<style>
  :root{--bg:#0f1113;--card:#17191c;--bd:#26292e;--tx:#e8eaed;--mut:#9aa0a6;
        --pend:#e8b84b;--crit:#ff6b6b;--acc:#b8ff00}
  *{box-sizing:border-box}
  body{margin:0;padding:32px 20px 80px;background:var(--bg);color:var(--tx);
       font:15px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
  main{max-width:1000px;margin:0 auto}
  h1{font-size:26px;margin:0 0 4px}
  h2{font-size:17px;margin:40px 0 14px;letter-spacing:.02em;scroll-margin-top:16px}
  h2 small{color:var(--mut);font-weight:400;font-size:13px;margin-left:8px}
  .sub{color:var(--mut);font-size:13px;margin-bottom:28px}
  .tarjeta{background:var(--card);border:1px solid var(--bd);border-radius:12px;padding:18px 20px}
  .cifra{font-size:40px;font-weight:700;line-height:1}
  .cifra small{font-size:16px;color:var(--mut);font-weight:400}
  .barra{height:7px;background:#24272b;border-radius:4px;overflow:hidden;margin:12px 0 8px}
  .barra span{display:block;height:100%;background:var(--acc)}
  .nav{display:flex;gap:8px;flex-wrap:wrap;margin:22px 0 4px;position:sticky;top:0;
       background:var(--bg);padding:10px 0;z-index:2}
  .nav button{color:var(--mut)}
  .nav button:hover{color:var(--tx);border-color:var(--acc)}
  .nav button.on{color:#111}
  .cuenta{display:inline-block;background:var(--pend);color:#111;border-radius:20px;
          padding:0 6px;font-size:11px;font-weight:700;margin-left:5px}
  .nav button.on .cuenta{background:#111;color:var(--acc)}
  .seccion[hidden]{display:none}
  .seccion h2:first-child{margin-top:26px}
  .tabla-wrap{overflow-x:auto}
  table{width:100%;border-collapse:collapse;font-size:14px}
  th{text-align:left;color:var(--mut);font-weight:500;font-size:12px;text-transform:uppercase;
     letter-spacing:.05em;padding:0 8px 8px;border-bottom:1px solid var(--bd)}
  td{padding:11px 8px;border-bottom:1px solid #1e2124;vertical-align:top}
  tr.ok td{color:var(--mut)} tr.ok .ruta{opacity:.5}
  .num{color:var(--mut);width:34px} .tick{margin-right:6px}
  .sev{white-space:nowrap;width:1%;padding-right:14px}
  .ruta{width:26%;font-size:12px}
  .tit{margin-bottom:3px}
  .corto{color:var(--mut);font-size:13px;line-height:1.5;margin:0}
  code{background:#1e2126;padding:1px 5px;border-radius:4px;font-size:12px}
  .filtros{display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap}
  button{background:var(--card);color:var(--tx);border:1px solid var(--bd);border-radius:20px;
         padding:6px 15px;font-size:13px;cursor:pointer;font-family:inherit}
  button.on{background:var(--acc);color:#111;border-color:var(--acc);font-weight:600}
  .rejilla{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px}
  .ficha{background:var(--card);border:1px solid var(--bd);border-left-width:3px;
         border-radius:10px;padding:14px 16px}
  .ficha.hecho{border-left-color:var(--acc)}
  .ficha.parcial{border-left-color:var(--pend)}
  .ficha.sin-empezar{border-left-color:#4a4f55}
  .ficha .fila{display:flex;justify-content:space-between;align-items:baseline;gap:10px;margin-bottom:7px}
  .ficha b{font-size:14px;line-height:1.35}
  .chip{font-size:10px;letter-spacing:.04em;padding:3px 8px;
        border-radius:20px;white-space:nowrap;background:#24272b;color:var(--mut)}
  .chip.hecho{background:var(--acc);color:#111;font-weight:600}
  .chip.parcial{background:#3a3220;color:var(--pend)}
  .falta{font-size:13px;color:var(--tx);margin:9px 0 0;line-height:1.5}
  .falta span{display:inline-block;font-size:10px;text-transform:uppercase;letter-spacing:.06em;
              color:var(--pend);margin-right:6px}
  .tienePrueba{font-size:12px;color:var(--pend);margin:8px 0 0}
  .pie{margin-top:11px;padding-top:9px;border-top:1px solid #1e2124;font-size:11px;color:#5f666d}
  .pie .est{display:block;margin-top:5px;line-height:1.45}
  .prueba{border-left:2px solid var(--pend);padding:2px 0 2px 14px;margin:14px 0}
  .prueba b{display:block;font-size:12px;color:var(--pend);text-transform:uppercase;
            letter-spacing:.05em;margin-bottom:3px}
  footer{color:#5f666d;font-size:12px;margin-top:44px;border-top:1px solid var(--bd);padding-top:14px}
</style></head><body>
<main>
  <h1>Forma Fit — estado</h1>
  <div class="sub">Generado desde <code>mobile/docs/specs/</code> con <code>npm run estado</code>.
    No se edita a mano: si algo aquí está mal, se corrige en la spec y se vuelve a generar.</div>

  <div class="tarjeta">
    <div class="cifra">${hechos}<small> / ${fallos.length} fallos resueltos</small></div>
    ${barra(hechos, fallos.length)}
    <div class="sub" style="margin:0">Críticos ${criticos.filter((f) => f.hecho).length}/${criticos.length} · ${resumenSev}</div>
    <div class="sub" style="margin:14px 0 0">
      ${specs.length} specs · ${porProg('hecho')} cerradas · ${porProg('parcial')} a medias ·
      ${porProg('sin-empezar')} sin empezar · <strong>${pruebas.length} pruebas a mano pendientes</strong>
    </div>
  </div>

  <nav class="nav">
    <button class="on" data-sec="todo">Todo</button>
    ${TEMAS.map(([t, e]) => `<button data-sec="${slug(t)}">${esc(e)}</button>`).join('')}
    <button data-sec="pruebas">Pruebas a mano <span class="cuenta">${pruebas.length}</span></button>
  </nav>

  <section class="seccion" data-sec="errores">
    <h2>Errores <small>${hechos}/${fallos.length} resueltos — auditoría técnica</small></h2>
    <div class="filtros">
      <button data-f="pend">Pendientes</button>
      <button class="on" data-f="todos">Todos</button>
      <button data-f="ok">Resueltos</button>
    </div>
    <div class="tabla-wrap"><table>
      <thead><tr><th>#</th><th></th><th>Fallo</th><th>Archivo</th></tr></thead>
      <tbody>${[...fallos]
        .sort((a, b) => (a.hecho - b.hecho) || rank(a.sev) - rank(b.sev) || a.num - b.num)
        .map(filaFallo).join('')}</tbody>
    </table></div>
  </section>

  ${TEMAS.filter(([t]) => t !== 'errores').map(seccionTema).join('\n')}

  <section class="seccion" data-sec="pruebas">
    <h2>Pruebas a mano <small>${pruebas.length} pendientes</small></h2>
    <div class="sub">Lo que no se puede comprobar con <code>vitest</code>: los stubs del test
      son inertes, así que un test verde prueba la lógica, nunca que el lado nativo funcione.</div>
    ${pruebas.length === 0
      ? '<div class="sub">Nada pendiente.</div>'
      : pruebas.map((p) => `<div class="prueba"><b>${esc(p.spec)}</b>${md(p.texto)}</div>`).join('')}
  </section>

  <footer>${esc(commit[0] ?? '')} · ${esc(commit[1] ?? '')} · ${esc((commit[2] ?? '').slice(0, 90))}</footer>
</main>
<script>
  // Pestanas por JS y no anclas de hash: la pagina se abre desde el visor de la
  // app como data: URL, y ahi una navegacion por #ancla no hace nada.
  const tabs = document.querySelectorAll('.nav [data-sec]');
  const secciones = document.querySelectorAll('.seccion');
  const mostrar = (sec) => {
    secciones.forEach((s) => { s.hidden = sec !== 'todo' && s.dataset.sec !== sec; });
    tabs.forEach((t) => t.classList.toggle('on', t.dataset.sec === sec));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  tabs.forEach((t) => { t.onclick = () => mostrar(t.dataset.sec); });

  const btns = document.querySelectorAll('[data-f]');
  const filtrar = (modo) => {
    document.querySelectorAll('tbody tr').forEach((tr) => {
      tr.style.display = (modo === 'todos' || tr.classList.contains(modo)) ? '' : 'none';
    });
  };
  btns.forEach((b) => { b.onclick = () => {
    btns.forEach((o) => o.classList.toggle('on', o === b));
    filtrar(b.dataset.f);
  }; });
  filtrar('todos');
  mostrar('todo');
</script>
</body></html>`;

writeFileSync(SALIDA, html, 'utf8');
console.log(`${hechos}/${fallos.length} fallos · ${specs.length} specs `
  + `(${porProg('hecho')} cerradas, ${porProg('parcial')} a medias, ${porProg('sin-empezar')} sin empezar) `
  + `· ${pruebas.length} pruebas a mano`);
console.log(SALIDA);
