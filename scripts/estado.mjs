/**
 * Genera `mobile/docs/estado.html` — el estado del proyecto en una página.
 *
 * NO es una fuente de datos: lo lee todo de las specs, que son lo que se
 * mantiene de verdad. Si aquí sale algo mal, se corrige en el documento, no
 * aquí. Esa es la razón de que esto sea un generador y no una página escrita a
 * mano: una segunda copia del estado se desvía el primer día que a alguien se
 * le olvide actualizarla.
 *
 * Fuentes, todas convenciones que ya existían:
 *   · `# Titulo` en la primera línea de cada spec
 *   · `> Estado: …` en la línea 3, en las 16 specs sin excepción
 *   · filas `| [n](#n) | severidad | ✅? titulo | archivo |` del índice de la auditoría
 *   · líneas `**Probar en dispositivo.** …` allí donde las haya
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

const leer = (f) => readFileSync(join(SPECS, f), 'utf8');
const esc  = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** Markdown mínimo: negrita, código y enlaces. Nada más — no hace falta. */
const md = (s) => esc(s)
  .replace(/`([^`]+)`/g, '<code>$1</code>')
  .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1');

// ── Fallos de la auditoría ────────────────────────────────────────────────────
const auditoria = leer('auditoria-tecnica.md');

const fallos = [...auditoria.matchAll(/^\| \[(\d+)\]\(#\d+\) \| ([^|]+) \| ([^|]+) \| ([^|]+) \|$/gm)]
  .map(([, num, sev, titulo, archivo]) => ({
    num:     Number(num),
    sev:     sev.trim(),
    hecho:   titulo.includes('✅'),
    titulo:  titulo.replace('✅', '').trim(),
    archivo: archivo.trim().replace(/`/g, ''),
  }));

if (fallos.length === 0) {
  throw new Error('No se ha podido leer el índice de la auditoría — ¿cambió el formato de la tabla?');
}

const peso = { '🔴': 0, '🟠': 1, '🟡': 2, '🟢': 3 };
const rank = (s) => peso[[...s][0]] ?? 9;

// ── Specs ─────────────────────────────────────────────────────────────────────
const specs = readdirSync(SPECS)
  .filter((f) => f.endsWith('.md') && f !== 'README.md')
  .map((f) => {
    const texto  = leer(f);
    const lineas = texto.split('\n');
    const estado = (lineas.slice(0, 12).find((l) => l.startsWith('> Estado:')) ?? '')
      .replace('> Estado:', '').trim();
    if (!estado) throw new Error(`${f} no tiene línea "> Estado:" — la convención se rompió`);
    return {
      archivo: f,
      titulo:  (lineas[0] ?? '').replace(/^#\s*(Spec —\s*)?/, '').trim() || basename(f, '.md'),
      estado,
      pruebas: [...texto.matchAll(/\*\*Probar en dispositivo\.\*\*\s*([^\n]+)/g)].map((m) => m[1].trim()),
    };
  });

// ── Datos derivados ───────────────────────────────────────────────────────────
const hechos   = fallos.filter((f) => f.hecho).length;
const criticos = fallos.filter((f) => f.sev.includes('🔴'));
const pruebas  = specs.flatMap((s) => s.pruebas.map((p) => ({ spec: s.titulo, texto: p })));
// `execFileSync` y no `execSync`: en Windows este ultimo pasa por cmd.exe, donde
// el separador `|` del formato se interpreta como una tuberia.
const commit   = execFileSync('git', ['log', '-1', '--format=%h|%ad|%s', '--date=short'],
                              { cwd: RAIZ }).toString().trim().split('|');

const barra = (n, total) => `<div class="barra"><span style="width:${(n / total * 100).toFixed(1)}%"></span></div>`;

const filaFallo = (f) => `<tr class="${f.hecho ? 'ok' : 'pend'}">
  <td class="num">${f.num}</td>
  <td class="sev">${f.sev}</td>
  <td>${f.hecho ? '<span class="tick">✅</span>' : ''}${md(f.titulo)}</td>
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
<style>
  :root{--bg:#0f1113;--card:#17191c;--bd:#26292e;--tx:#e8eaed;--mut:#9aa0a6;
        --pend:#e8b84b;--crit:#ff6b6b;--acc:#b8ff00}
  *{box-sizing:border-box}
  body{margin:0;padding:32px 20px 80px;background:var(--bg);color:var(--tx);
       font:15px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
  main{max-width:960px;margin:0 auto}
  h1{font-size:26px;margin:0 0 4px}
  h2{font-size:17px;margin:36px 0 12px;letter-spacing:.02em}
  .sub{color:var(--mut);font-size:13px;margin-bottom:28px}
  .tarjeta{background:var(--card);border:1px solid var(--bd);border-radius:12px;padding:18px 20px}
  .cifra{font-size:40px;font-weight:700;line-height:1}
  .cifra small{font-size:16px;color:var(--mut);font-weight:400}
  .barra{height:7px;background:#24272b;border-radius:4px;overflow:hidden;margin:12px 0 8px}
  .barra span{display:block;height:100%;background:var(--acc)}
  .tabla-wrap{overflow-x:auto}
  table{width:100%;border-collapse:collapse;font-size:14px}
  th{text-align:left;color:var(--mut);font-weight:500;font-size:12px;text-transform:uppercase;
     letter-spacing:.05em;padding:0 8px 8px;border-bottom:1px solid var(--bd)}
  td{padding:9px 8px;border-bottom:1px solid #1e2124;vertical-align:top}
  tr.ok td{color:var(--mut)} tr.ok .ruta{opacity:.5}
  .num{color:var(--mut);width:34px} .tick{margin-right:6px}
  .sev{white-space:nowrap;width:1%;padding-right:14px}
  .ruta{width:34%;font-size:12px}
  code{background:#1e2126;padding:1px 5px;border-radius:4px;font-size:12px}
  .filtros{display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap}
  button{background:var(--card);color:var(--tx);border:1px solid var(--bd);border-radius:20px;
         padding:6px 15px;font-size:13px;cursor:pointer;font-family:inherit}
  button.on{background:var(--acc);color:#111;border-color:var(--acc);font-weight:600}
  .spec{display:flex;gap:14px;padding:13px 0;border-bottom:1px solid #1e2124}
  .spec b{display:block;margin-bottom:3px}
  .spec .est{color:var(--mut);font-size:13px}
  .spec .arch{color:#5f666d;font-size:11px;white-space:nowrap;padding-top:2px}
  .prueba{border-left:2px solid var(--pend);padding:2px 0 2px 14px;margin:14px 0}
  .prueba b{display:block;font-size:12px;color:var(--pend);text-transform:uppercase;
            letter-spacing:.05em;margin-bottom:3px}
  footer{color:#5f666d;font-size:12px;margin-top:44px;border-top:1px solid var(--bd);padding-top:14px}
</style></head><body>
<main>
  <h1>Forma Fit — estado</h1>
  <div class="sub">Generado desde <code>mobile/docs/specs/</code>. No se edita a mano:
    si algo aquí está mal, se corrige en la spec y se vuelve a generar.</div>

  <div class="tarjeta">
    <div class="cifra">${hechos}<small> / ${fallos.length} fallos resueltos</small></div>
    ${barra(hechos, fallos.length)}
    <div class="sub" style="margin:0">Críticos ${criticos.filter((f) => f.hecho).length}/${criticos.length} · ${resumenSev}</div>
  </div>

  <h2>Auditoría técnica</h2>
  <div class="filtros">
    <button class="on" data-f="pend">Pendientes</button>
    <button data-f="todos">Todos</button>
    <button data-f="ok">Resueltos</button>
  </div>
  <div class="tabla-wrap"><table>
    <thead><tr><th>#</th><th></th><th>Fallo</th><th>Archivo</th></tr></thead>
    <tbody>${[...fallos]
      .sort((a, b) => (a.hecho - b.hecho) || rank(a.sev) - rank(b.sev) || a.num - b.num)
      .map(filaFallo).join('')}</tbody>
  </table></div>

  <h2>Pendiente de probar a mano (${pruebas.length})</h2>
  ${pruebas.length === 0
    ? '<div class="sub">Nada pendiente.</div>'
    : pruebas.map((p) => `<div class="prueba"><b>${esc(p.spec)}</b>${md(p.texto)}</div>`).join('')}

  <h2>Specs (${specs.length})</h2>
  ${specs.map((s) => `<div class="spec">
    <div style="flex:1"><b>${esc(s.titulo)}</b><div class="est">${md(s.estado)}</div></div>
    <div class="arch">${esc(s.archivo)}</div>
  </div>`).join('')}

  <footer>${esc(commit[0] ?? '')} · ${esc(commit[1] ?? '')} · ${esc((commit[2] ?? '').slice(0, 90))}</footer>
</main>
<script>
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
  filtrar('pend');
</script>
</body></html>`;

writeFileSync(SALIDA, html, 'utf8');
console.log(`${hechos}/${fallos.length} fallos · ${pruebas.length} pruebas pendientes · ${specs.length} specs`);
console.log(SALIDA);
