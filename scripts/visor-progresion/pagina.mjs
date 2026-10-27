// Página del visor: lee el JSON que escribe visor.sim.js y genera el HTML.
//   node scripts/visor-progresion/pagina.mjs <visor.json> <salida.html>
import { readFileSync, writeFileSync } from 'node:fs';

const [, , entrada, salida] = process.argv;
const casos = JSON.parse(readFileSync(entrada, 'utf8'));

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const n = (v) => (v == null || v === '' ? '' : String(v).replace('.', ','));

// Lo que salta a la vista: lectura de las trazas de abajo (27-oct-2026).
const HALLAZGOS = [
  ['ana', 7, 'Falla por poco (10/9/9) con el peso nuevo y la app <b>baja</b> al peso anterior. Es justo el caso de «fallar por poco debería mantener».'],
  ['marta', 9, 'Un solo día malo (10/9/9) y <b>baja</b>. La app no distingue un mal día de una racha.'],
  ['luis', 5, 'Vuelve tras un mes sin entrenar y la app le pide <b>+5 kg</b>. El motor no mira cuánto tiempo ha pasado.'],
  ['carlos', 2, 'Sube <b>5 kg por sesión</b> en sentadilla (el escalón de la librería), y al bajar también baja 5, no un 10 %.'],
  ['javi', 3, 'Por esfuerzo es muy «pegajoso»: un día fácil no sube nada (hace la media de 3 sesiones) y uno malo solo baja 2,5.'],
  ['elena', 5, 'Con el RPE apuntado en una sola serie, la app decide solo con esa serie y sube.'],
  ['sergio', 3, 'Con 12/12/7 pide <b>8 en todas</b>: la peor serie manda.'],
  ['sergio', 6, 'Tras el día malo, la frase dice «meta 6» pero el gris pide 7/5/4 (lo de la última vez). Dos mensajes distintos en la misma tarjeta.'],
  ['sergio', 8, 'Con 15/14/13 sigue pidiendo reps; nunca sugiere lastrarse.'],
  ['ana', 7, 'Tras bajar, el gris pide 30×<b>12</b>: después de fallar, te pide el máximo del rango.'],
  ['pilar-plancha', 4, 'En la plancha pasa lo mismo que con Sergio: la frase dice 30 s y el gris pide 60/45/25.'],
];

const TIPO = { up: 'Subir', hold: 'Mantener', down: 'Bajar' };

function rango(c) {
  const k = c.config;
  if (c.tiempo) return { min: k.minTime, max: k.maxTime, u: 's' };
  return { min: k.minReps, max: k.maxReps, u: '' };
}

function propuesta(f, c) {
  if (!f.chip) return '<span class="pill none">Sin propuesta</span><div class="why">Primera sesión: busca su peso</div>';
  const ch = f.chip;
  const asist = ch.assist;
  const label = asist ? { up: 'Menos ayuda', down: 'Más ayuda', hold: 'Mantener' }[ch.tipo] : TIPO[ch.tipo];
  const cifra = ch.peso != null && c.pesoInicial ? ` ${n(ch.peso)} kg`
    : ch.reps != null ? ` ${ch.reps} reps` : ch.tiempo != null ? ` ${ch.tiempo} s` : '';
  return `<span class="pill ${ch.tipo}">${label}${cifra}</span><div class="why">${esc(ch.why)}</div>`;
}

function series(sets, c, campo) {
  const r = rango(c);
  return `<div class="sets">${sets.map((s) => {
    const v = Number(campo === 'hizo' ? (c.tiempo ? s.time : s.reps) : s.reps);
    const cls = v < r.min ? 'bajo' : v >= r.max && r.max > r.min ? 'tope' : '';
    const peso = campo === 'hizo' ? s.weight : s.peso;
    const pesoTxt = c.pesoInicial ? `${n(peso)}<span class="x">×</span>` : '';
    const rpe = campo === 'hizo' && s.rpe ? `<sub>@${n(s.rpe)}</sub>` : '';
    return `<span class="set ${cls}">${pesoTxt}${n(v)}${r.u}${rpe}</span>`;
  }).join('')}</div>`;
}

function configTxt(c) {
  const k = c.config, p = k.progression;
  const tipo = { double: 'Peso por reglas', reps: 'Reps', time: 'Tiempo', effort: 'Por esfuerzo' }[p.type];
  const ev = p.evaluation?.mode === 'part' ? ` · Parcial ${p.evaluation.need} de ${k.sets}`
    : p.evaluation?.mode === 'rpe' ? ` · RPE máx. ${p.evaluation.maxRpe}` : '';
  const vol = c.tiempo ? `${k.sets} series, desde ${k.minTime} s`
    : p.type === 'reps' ? `${k.sets} series, desde ${k.minReps} reps`
    : p.type === 'effort' ? `${k.sets}×${k.minReps} @RPE ${p.targetRpe}`
    : `${k.sets}×${k.minReps === k.maxReps ? k.minReps : `${k.minReps}-${k.maxReps}`}`;
  return `${esc(c.nombreEjercicio)} · ${vol} · ${tipo}${ev}`;
}

function caso(c) {
  const filas = c.filas.map((f, i) => {
    const ultima = f.hizo == null;
    return `<tr id="${c.id}-${i + 1}" class="${ultima ? 'next' : ''}">
      <td class="num">${ultima ? '→' : i + 1}<div class="dia">${ultima ? '' : `día ${f.dia}`}</div></td>
      <td>${propuesta(f, c)}</td>
      <td>${f.plan ? series(f.plan, c, 'gris') : '<span class="muted">—</span>'}</td>
      <td>${ultima ? '' : series(f.hizo, c, 'hizo')}</td>
      <td class="nota">${esc(f.nota)}</td>
    </tr>`;
  }).join('');
  return `<section class="caso" id="${c.id}">
    <h2>${esc(c.nombre)}</h2>
    <p class="perfil">${esc(c.perfil)}</p>
    <p class="cfg">${configTxt(c)}</p>
    <div class="tabla"><table>
      <thead><tr><th>Sesión</th><th>La app propone</th><th>El gris pide</th><th>Hizo</th><th>Qué pasa</th></tr></thead>
      <tbody>${filas}</tbody>
    </table></div>
  </section>`;
}

const html = `<title>Visor de progresión</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@500;700&family=Source+Sans+3:wght@400;600&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>
/* Layout: una columna de casos; cada caso es una tabla sesión a sesión, como un cuaderno de entreno. */
:root {
  --bg: #f6f7f4; --surface: #ffffff; --fg: #1d221c; --muted: #5d665b; --line: #dfe3db;
  --accent: #4a6b2a;
  --up: #2f7a3a; --up-bg: #e3f2e2; --hold: #6b6455; --hold-bg: #eeebe3; --down: #b2452f; --down-bg: #f8e3dd;
  --bajo: #b2452f; --tope: #2f7a3a;
  --display: 'Archivo', 'Helvetica Neue', Arial, sans-serif;
  --body: 'Source Sans 3', 'Segoe UI', system-ui, sans-serif;
  --mono: 'IBM Plex Mono', ui-monospace, Consolas, monospace;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
  --bg: #141713; --surface: #1c201b; --fg: #e8ebe4; --muted: #9aa395; --line: #2e342c; --accent: #a9cf7e;
  --up: #8fd39a; --up-bg: #1f3322; --hold: #c9c1ad; --hold-bg: #2b2923; --down: #f0957f; --down-bg: #3a221c;
  --bajo: #f0957f; --tope: #8fd39a; color-scheme: dark } }
:root[data-theme="dark"] {
  --bg: #141713; --surface: #1c201b; --fg: #e8ebe4; --muted: #9aa395; --line: #2e342c; --accent: #a9cf7e;
  --up: #8fd39a; --up-bg: #1f3322; --hold: #c9c1ad; --hold-bg: #2b2923; --down: #f0957f; --down-bg: #3a221c;
  --bajo: #f0957f; --tope: #8fd39a; color-scheme: dark }
body { background: var(--bg); color: var(--fg); font: 16px/1.5 var(--body);
  padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); padding-block: 32px 64px; }
main { max-width: 1080px; margin: 0 auto; display: grid; gap: 40px; }
h1, h2 { font-family: var(--display); text-wrap: balance; margin: 0; }
h1 { font-size: 2rem; }
h2 { font-size: 1.3rem; }
.intro p { max-width: 68ch; margin: 8px 0 0; color: var(--muted); }
.leyenda { display: flex; flex-wrap: wrap; gap: 12px 20px; margin-top: 16px; font-size: .9rem; color: var(--muted); align-items: center; }
.hallazgos { background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 20px 24px; }
.hallazgos h2 { margin-bottom: 12px; }
.hallazgos ol { margin: 0; padding-left: 1.3em; display: grid; gap: 8px; }
.hallazgos a { color: var(--accent); font-weight: 600; text-decoration: none; white-space: nowrap; }
.hallazgos a:hover, .hallazgos a:focus-visible { text-decoration: underline; }
nav { display: flex; flex-wrap: wrap; gap: 8px; }
nav a { font-size: .9rem; color: var(--fg); border: 1px solid var(--line); border-radius: 999px; padding: 4px 12px; text-decoration: none; background: var(--surface); }
nav a:hover, nav a:focus-visible { border-color: var(--accent); }
.caso { display: grid; gap: 6px; scroll-margin-top: 16px; }
.perfil { margin: 0; color: var(--muted); max-width: 72ch; }
.cfg { margin: 0 0 8px; font-family: var(--mono); font-size: .85rem; color: var(--accent); }
.tabla { overflow-x: auto; background: var(--surface); border: 1px solid var(--line); border-radius: 10px; }
table { border-collapse: collapse; width: 100%; min-width: 760px; }
th { text-align: left; font: 600 .75rem var(--body); text-transform: uppercase; letter-spacing: .06em; color: var(--muted); padding: 10px 12px; border-bottom: 1px solid var(--line); }
td { padding: 10px 12px; border-bottom: 1px solid var(--line); vertical-align: top; }
tr:last-child td { border-bottom: 0; }
tr.next td { background: color-mix(in srgb, var(--accent) 7%, transparent); }
tr:target td { background: color-mix(in srgb, var(--accent) 16%, transparent); }
.num { font: 500 1rem var(--mono); width: 64px; font-variant-numeric: tabular-nums; }
.dia { font-size: .75rem; color: var(--muted); }
.pill { display: inline-block; font-weight: 600; font-size: .9rem; padding: 2px 10px; border-radius: 6px; white-space: nowrap; }
.pill.up { color: var(--up); background: var(--up-bg); }
.pill.hold { color: var(--hold); background: var(--hold-bg); }
.pill.down { color: var(--down); background: var(--down-bg); }
.pill.none { color: var(--muted); border: 1px dashed var(--line); }
.why { font-size: .85rem; color: var(--muted); margin-top: 4px; max-width: 30ch; }
.sets { display: flex; flex-wrap: wrap; gap: 6px; }
.set { font: .85rem var(--mono); font-variant-numeric: tabular-nums; border: 1px solid var(--line); border-radius: 5px; padding: 1px 6px; white-space: nowrap; }
.set .x { color: var(--muted); }
.set sub { color: var(--muted); font-size: .7rem; }
.set.bajo { color: var(--bajo); border-color: var(--bajo); }
.set.tope { color: var(--tope); border-color: var(--tope); }
.nota { font-size: .9rem; max-width: 26ch; }
.muted { color: var(--muted); }
</style>
<main>
  <header class="intro">
    <h1>Visor de progresión</h1>
    <p>Nueve personas pasadas por el motor de progresión real de la app, sesión a sesión. En cada fila: lo que la app propone antes de entrenar, el gris que ve en cada serie, lo que hizo de verdad y qué pasa ese día. La última fila de cada caso es lo que pediría en la siguiente sesión. Si no se dice otra cosa, el atleta usa el peso que le propone la app.</p>
    <div class="leyenda">
      <span><span class="set bajo">7</span> por debajo del mínimo</span>
      <span><span class="set tope">12</span> arriba del rango</span>
      <span><span class="pill up">Subir</span> <span class="pill hold">Mantener</span> <span class="pill down">Bajar</span></span>
    </div>
  </header>
  <section class="hallazgos">
    <h2>Lo que salta a la vista</h2>
    <ol>${HALLAZGOS.map(([id, fila, txt]) => `<li>${txt} <a href="#${id}-${fila}">Ver fila</a></li>`).join('')}</ol>
  </section>
  <nav>${casos.map((c) => `<a href="#${c.id}">${esc(c.nombre.split(' · ')[0])}${c.id.includes('-') ? ` · ${esc(c.nombre.split(' · ')[1].split(' ').slice(0, 3).join(' '))}` : ''}</a>`).join('')}</nav>
  ${casos.map(caso).join('')}
</main>`;

writeFileSync(salida, html);
