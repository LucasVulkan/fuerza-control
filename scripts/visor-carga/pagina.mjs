// Página del visor de carga: lee el JSON que escribe visor.sim.js y genera el HTML.
//   node scripts/visor-carga/pagina.mjs <visor-carga.json> <salida.html>
import { readFileSync, writeFileSync } from 'node:fs';

const [, , entrada, salida] = process.argv;
const personas = JSON.parse(readFileSync(entrada, 'utf8'));
const es = JSON.parse(readFileSync(new URL('../../mobile/src/locales/es.json', import.meta.url), 'utf8'));

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const n1 = (v) => (Math.round(v * 10) / 10).toString().replace('.', ',');
const signo = (v) => `${v > 0 ? '+' : ''}${v} %`;

// Lectura de las trazas (27-oct-2026): dónde la app de hoy no dice nada útil o se
// equivoca, y dónde las frases propuestas aciertan o fallan. [persona, semana, texto]
const HALLAZGOS = [
  ['ana', 5, '<b>Ana y Luis: la vista Carga de hoy sale vacía las diez semanas</b> («apunta el esfuerzo»). Con ella desaparecen también Rendimiento y Series por grupo, que no usan el sRPE. Las frases propuestas funcionan sin sRPE (todas menos «Coste»): en esta semana de Ana ya dicen «1 sesión de 2» y «te faltan pecho, cuádriceps y hombro (3 de 6)».'],
  ['ana', 6, '<b>Una semana floja contamina la media durante un mes.</b> Ana entrena exactamente igual todo el tiempo, pero tras su semana de una sola sesión salen «Un 20 % más de trabajo que tu media» en la 6 y en la 8. La banda «lo normal» de ±10 % es más estrecha que ese ruido.'],
  ['luis', 6, '<b>Cuatro chips para alguien que sencillamente no viene:</b> «No viene» y además «Le falta pecho / cuádriceps / hombro», que no añaden nada. Convendría que «Le falta» no salga cuando ya sale «No viene».'],
  ['luis', 9, '<b>Al volver tras cuatro semanas, la frase de trabajo dice «Primeras semanas».</b> Con la media definida como las 4 semanas anteriores <i>con sesión</i>, no queda ninguna y cae en la rama de «aún no hay media». No es verdad: tiene cuatro semanas de historial, solo que viejo. Tampoco sale «Fuerza» en ninguna semana de Luis (nunca hay datos de hace 4 semanas).'],
  ['marta', 5, '<b>«Te costó más de lo normal» sin que haya costado más.</b> La semana 5 de Marta es idéntica a la 1 (3 series, sRPE 7, misma carga externa) y el cociente interna/externa es casi igual (3,44 contra 3,48), pero sale +19 % porque la media incluye las semanas de más volumen y la de descarga. Efecto de fondo: el modelo de minutos tiene partes fijas (calentamiento, transición), así que añadir series sube el trabajo más rápido que los minutos y «cuesta menos» (semana 3: −18 %, con sRPE 7 igual).'],
  ['javi', 8, '<b>La semana de fatiga de Javi se ve en la frase pero no en el aviso, y en la app de hoy no se ve.</b> Hoy: «+8 % · Carga estable», chip «bloque duro» y Rendimiento +9 % (usa el mejor 1RM de 4 semanas, así que las reps peores no bajan el índice). Propuesto: «Te costó más de lo normal para ese trabajo» (+33 % de coste), pero «Se está pasando» pide además más trabajo y esa semana hizo un 11 % menos, así que no salta.'],
  ['javi', 5, '<b>«Se está pasando» no sale en ninguna de las 50 semanas</b>, ni con el bloque duro de Javi. La semana 5 sí es +40 %, pero la 6 ya es +18 % porque la media absorbe la primera. Hoy, esta semana es «+25 % · Carga estable»: el umbral de «acumulando» está en +30 %.'],
  ['javi', 9, '<b>El chip de esfuerzo vs carga llega con una semana o más de retraso.</b> Compara medias de bloques: en la descarga de Javi (carga −52 %, «Estás descargando») el chip dice «= carga · ↑ esfuerzo → fatiga»; en la descarga de Marta (semana 4) dice «adaptación» y a la semana siguiente «descarga». Las frases propuestas, que miran solo esta semana, acertan (−51 % y −25 % de trabajo).'],
  ['carlos', 7, '<b>Faltar un día se lee como una descarga.</b> Hoy: «−36 % · Estás descargando», monotonía «pocas sesiones». Propuesto: «Un 36 % menos de trabajo» y «Te faltan: cuádriceps (10 de 15), pecho, espalda», que es lo correcto. Efecto colateral: al ser menos de −30 % cuenta como «semana de descarga» y retrasa el aviso «Plano» de la semana 9 a la 10.'],
  ['carlos', 10, '<b>El estancamiento de Carlos Hoy no se nota:</b> Rendimiento marca «+27 %» desde la semana 3 hasta la 10 (el índice comparado con el inicio, sin enseñar que lleva siete semanas sin moverse). La frase propuesta dice «Tu fuerza se mantiene» desde la 7 y «Plano» salta en la 10: por los números tendría que ser la 9 (ver la semana 7).'],
  ['javi', 6, '<b>Monotonía y strain no discriminan con 3-4 sesiones.</b> En las 29 semanas con sRPE y 3 o más sesiones la monotonía va de 0,86 a 1,15 y siempre sale «variada» (los umbrales son 1,5 y 2,0, pensados para entrenar casi a diario). El «strain % vs base» se calcula, pero LoadTab no lo muestra en ningún sitio (solo pinta las barras): p. ej. +20 % en esta semana.'],
];

const ESTADO = { loading: 'acumulando', steady: 'estable', unloading: 'descargando' };
const PILL = { loading: 'warn', steady: 'ok', unloading: 'hold' };

function fecha(w) {
  return new Date(2026, 7, 31 + 7 * (w - 1)).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }).replace('.', '');
}

function hizo(s, conRpe) {
  const h = s.hizo;
  const rpe = conRpe && h.rpe != null ? ` · sRPE ${n1(h.rpe)}` : '';
  const carga = h.ext != null ? `<div class="why">ext. ${Math.round(h.ext)}${h.int != null ? ` · int. ${Math.round(h.int)}` : ''}</div>` : '';
  return `<b>${h.sesiones}</b> ${h.sesiones === 1 ? 'sesión' : 'sesiones'} · ${h.series} series${rpe}${carga}`;
}

function hoy(s) {
  const h = s.hoy;
  if (h.vacia) return `<span class="pill none">vacía: ${esc(h.vacia)}</span><div class="why">Sale «apunta el esfuerzo»: no se enseña nada más.</div>`;
  const estado = h.estado ? `<span class="pill ${PILL[h.estado]}">${ESTADO[h.estado]}</span>` : '';
  const media = h.mediaSesiones != null ? ` <span class="m">(media ${n1(h.mediaSesiones)})</span>` : '';
  const mono = h.mono != null ? `<b>${n1(h.mono)}</b> ${esc(h.monoEtiqueta)}` : `— <span class="m">${esc(h.monoEtiqueta)}</span>`;
  const strain = h.strainPct != null ? `<div class="k m" title="LoadTab lo calcula pero no lo pinta">strain ${signo(h.strainPct)} vs base · no se enseña</div>` : '';
  const tend = h.tendencia ? `<div class="k">${esc(es.load.trend[h.tendencia])}</div>` : '';
  const rend = h.rend && h.rend.pct != null
    ? `<div class="k">Rendimiento <b>${signo(h.rend.pct)}</b> en ${h.rend.semanas} sem.${h.rend.actual ? '' : ' <span class="m">(dato de otra semana)</span>'}</div>` : '';
  const grupos = h.grupos.map((g) => `${esc(g.nombre)} ${g.sets}`).join(' · ');
  return `<div class="k"><b class="big">${esc(h.carga)}</b> ${esc(h.cargaEs)} ${estado}</div>
    <div class="k">Sesiones <b>${h.sesiones7d}</b>${media} · Monoton. ${mono}</div>
    ${strain}${tend}${rend}
    <div class="k m">7 d: ${grupos}</div>`;
}

function propuesto(s) {
  const p = s.propuesto;
  const lineas = Object.values(p.frases).map((f) => `<li>${esc(f)}</li>`).join('');
  const chips = p.chips.map((c) => `<span class="chip">${esc(c)}</span>`).join('');
  return `<ul class="fr">${lineas}</ul>${chips ? `<div class="chips">${chips}</div>` : ''}`;
}

function persona(p) {
  const filas = p.semanas.map((s) => `<tr id="${p.id}-${s.n}">
      <td class="num">S${s.n}<div class="dia">${fecha(s.n)}</div></td>
      <td>${hizo(s, p.conRpe)}</td>
      <td>${hoy(s)}</td>
      <td class="${s.propuesto.chips.length ? 'cambia' : ''}">${propuesto(s)}</td>
      <td class="nota">${esc(s.nota)}</td>
    </tr>`).join('');
  return `<section class="caso" id="${p.id}">
    <h2>${esc(p.nombre)}</h2>
    <p class="perfil">${esc(p.perfil)}</p>
    <p class="cfg">${p.previstas} sesiones previstas por semana · ${p.conRpe ? 'apunta el sRPE' : 'sin sRPE'}</p>
    <div class="tabla"><table>
      <thead><tr><th>Semana</th><th>Hizo</th><th>Hoy en la app</th><th>Propuesto</th><th>Qué pasa</th></tr></thead>
      <tbody>${filas}</tbody>
    </table></div>
  </section>`;
}

const html = `<title>Visor de carga semanal</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@500;700&family=Source+Sans+3:wght@400;600&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>
/* Layout: una columna de personas; cada una es una tabla semana a semana con lo de hoy y lo propuesto lado a lado. */
:root {
  --bg: #f6f7f4; --surface: #ffffff; --fg: #1d221c; --muted: #5d665b; --line: #dfe3db;
  --accent: #4a6b2a; --cambia: #f3f7e9;
  --up: #2f7a3a; --up-bg: #e3f2e2; --hold: #6b6455; --hold-bg: #eeebe3; --down: #b2452f; --down-bg: #f8e3dd;
  --display: 'Archivo', 'Helvetica Neue', Arial, sans-serif;
  --body: 'Source Sans 3', 'Segoe UI', system-ui, sans-serif;
  --mono: 'IBM Plex Mono', ui-monospace, Consolas, monospace;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
  --bg: #141713; --surface: #1c201b; --fg: #e8ebe4; --muted: #9aa395; --line: #2e342c; --accent: #a9cf7e; --cambia: #222a1c;
  --up: #8fd39a; --up-bg: #1f3322; --hold: #c9c1ad; --hold-bg: #2b2923; --down: #f0957f; --down-bg: #3a221c; color-scheme: dark } }
:root[data-theme="dark"] {
  --bg: #141713; --surface: #1c201b; --fg: #e8ebe4; --muted: #9aa395; --line: #2e342c; --accent: #a9cf7e; --cambia: #222a1c;
  --up: #8fd39a; --up-bg: #1f3322; --hold: #c9c1ad; --hold-bg: #2b2923; --down: #f0957f; --down-bg: #3a221c; color-scheme: dark }
body { background: var(--bg); color: var(--fg); font: 16px/1.5 var(--body);
  padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); padding-block: 32px 64px; }
main { max-width: 1240px; margin: 0 auto; display: grid; gap: 40px; }
h1, h2 { font-family: var(--display); text-wrap: balance; margin: 0; }
h1 { font-size: 2rem; }
h2 { font-size: 1.3rem; }
.intro p { max-width: 74ch; margin: 8px 0 0; color: var(--muted); }
.leyenda { display: flex; flex-wrap: wrap; gap: 12px 20px; margin-top: 16px; font-size: .9rem; color: var(--muted); align-items: center; }
.hallazgos { background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 20px 24px; }
.hallazgos h2 { margin-bottom: 12px; }
.hallazgos ol { margin: 0; padding-left: 1.3em; display: grid; gap: 10px; }
.hallazgos a { color: var(--accent); font-weight: 600; text-decoration: none; white-space: nowrap; }
.hallazgos a:hover, .hallazgos a:focus-visible { text-decoration: underline; }
nav { display: flex; flex-wrap: wrap; gap: 8px; }
nav a { font-size: .9rem; color: var(--fg); border: 1px solid var(--line); border-radius: 999px; padding: 4px 12px; text-decoration: none; background: var(--surface); }
nav a:hover, nav a:focus-visible { border-color: var(--accent); }
.caso { display: grid; gap: 6px; scroll-margin-top: 16px; }
.perfil { margin: 0; color: var(--muted); max-width: 76ch; }
.cfg { margin: 0 0 8px; font-family: var(--mono); font-size: .85rem; color: var(--accent); }
.tabla { overflow-x: auto; background: var(--surface); border: 1px solid var(--line); border-radius: 10px; }
table { border-collapse: collapse; width: 100%; min-width: 1040px; }
th { text-align: left; font: 600 .75rem var(--body); text-transform: uppercase; letter-spacing: .06em; color: var(--muted); padding: 10px 12px; border-bottom: 1px solid var(--line); }
td { padding: 10px 12px; border-bottom: 1px solid var(--line); vertical-align: top; font-size: .92rem; }
tr:last-child td { border-bottom: 0; }
td.cambia { background: var(--cambia); }
tr:target td { outline: 2px solid var(--accent); outline-offset: -2px; }
.num { font: 500 1rem var(--mono); width: 64px; font-variant-numeric: tabular-nums; }
.dia { font-size: .72rem; color: var(--muted); }
.why { font-size: .78rem; color: var(--muted); margin-top: 2px; }
.k { margin-top: 3px; }
.k:first-child { margin-top: 0; }
.m { color: var(--muted); font-size: .82rem; }
.big { font: 600 1.1rem var(--mono); }
.pill { display: inline-block; font-weight: 600; font-size: .8rem; padding: 1px 8px; border-radius: 6px; white-space: nowrap; }
.pill.ok { color: var(--up); background: var(--up-bg); }
.pill.hold { color: var(--hold); background: var(--hold-bg); }
.pill.warn { color: var(--down); background: var(--down-bg); }
.pill.none { color: var(--muted); border: 1px dashed var(--line); }
.fr { margin: 0; padding-left: 1.1em; display: grid; gap: 3px; max-width: 46ch; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.chip { font-weight: 600; font-size: .8rem; color: var(--down); background: var(--down-bg); border-radius: 999px; padding: 2px 10px; white-space: nowrap; }
.nota { font-size: .88rem; max-width: 24ch; }
</style>
<main>
  <header class="intro">
    <h1>Visor de carga semanal</h1>
    <p>Cinco personas, diez semanas, pasadas semana a semana por las funciones reales de <code>trainingLoad.js</code>. Por cada semana (cerrada el domingo a las 23:00) se enseña <b>lo que enseñaría hoy la vista Carga</b> y <b>la tarjeta «Resumen de la semana» propuesta</b>, con sus frases y los avisos para el entrenador. El plan previsto de Marta y Javi ya incluye sus descargas y su bloque duro; la media de la tarjeta es la de las 4 semanas anteriores con alguna sesión (si hay menos de 2, «Primeras semanas»); «Coste» y «Trabajo» exigen al menos 2 semanas previas. «Fuerza» compara con el índice de hace 4 semanas.</p>
    <div class="leyenda">
      <span><span class="pill ok">estable</span> <span class="pill warn">acumulando</span> <span class="pill hold">descargando</span> estado de Hoy</span>
      <span><span class="chip">Aviso</span> para el entrenador</span>
      <span>Fondo verde: la semana dispara algún aviso</span>
      <span>ext./int.: carga externa e interna de la semana</span>
    </div>
  </header>
  <section class="hallazgos">
    <h2>Qué se ve</h2>
    <ol>${HALLAZGOS.map(([id, fila, txt]) => `<li>${txt} <a href="#${id}-${fila}">Ver fila</a></li>`).join('')}</ol>
  </section>
  <nav>${personas.map((p) => `<a href="#${p.id}">${esc(p.nombre.split(' · ')[0])}</a>`).join('')}</nav>
  ${personas.map(persona).join('')}
</main>`;

writeFileSync(salida, html);
