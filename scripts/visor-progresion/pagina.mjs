// Página del visor: lee el JSON que escribe visor.sim.js y genera el HTML.
//   node scripts/visor-progresion/pagina.mjs <visor.json> <salida.html>
import { readFileSync, writeFileSync } from 'node:fs';

const [, , entrada, salida] = process.argv;
const casos = JSON.parse(readFileSync(entrada, 'utf8'));

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const n = (v) => (v == null || v === '' ? '' : String(v).replace('.', ','));

// Lectura de las trazas (27-oct-2026): qué cambia con el motor propuesto.
const HALLAZGOS = [
  ['ana', 7, 'Ana falla por poco con el peso nuevo: hoy baja a 30 kg; el propuesto <b>mantiene 32,5</b> y acaba subiendo a 35.'],
  ['marta-parcial', 5, 'Parcial 2 de 3 con 15/15/11: hoy sube; el propuesto <b>no sube</b> porque la tercera serie queda por debajo del rango.'],
  ['marta', 9, 'Día malo de Marta (10/9/9): los dos bajan. En el propuesto es «fallo grande» (falta un 22 % de las reps).'],
  ['carlos', 6, '<b>Duda nueva.</b> Carlos hace 5/5/5/4/4 y luego 5/5/5/5/4: mejora, pero sigue sin completar. El propuesto lo cuenta como segundo fallo y baja un 10 %. En reps, mejorar no es fallo. ¿Debería valer lo mismo para el peso?'],
  ['carlos', 8, 'Con −10 % y escalón de 5 kg, Carlos baja de 85 a 75 y luego a 70: más que hoy (de 5 en 5).'],
  ['pilar', 6, 'Pilar repite dos días flojos con la ayuda nueva: el propuesto le devuelve ayuda (+10 %, a 30 kg) al segundo; hoy ya lo hacía al primero.'],
  ['sergio', 3, 'Sergio, 12/12/7 = 31: hoy pide 8 en todas; el propuesto pide <b>12/11/11</b> (34 en total).'],
  ['sergio', 5, 'Sergio baja a 27: primer fallo, el propuesto mantiene la meta de 37. Al segundo (16) la baja a 19.'],
  ['pilar-plancha', 4, 'Plancha: hoy la frase y el gris se contradicen (30 s contra 60/45/25); el propuesto pide 145 s en total, repartidos 49/48/48.'],
  ['luis', 5, 'Luis tras un mes sin entrenar: los dos le piden subir. Lo del tiempo sin entrenar sigue sin decidir.'],
  ['marta', 9, 'Tras bajar, los dos piden el máximo del rango (8×15). Sin decidir.'],
];

const TIPO = { up: 'Subir', hold: 'Mantener', down: 'Bajar' };
const TIPO_ASIST = { up: 'Menos ayuda', down: 'Más ayuda', hold: 'Mantener' };
const TIPO_VOL = { up: 'Sube la meta', hold: 'Misma meta', down: 'Baja la meta' };

function rango(c) {
  const k = c.config;
  if (c.tiempo) return { min: k.minTime, max: k.maxTime, u: 's' };
  return { min: k.minReps, max: k.maxReps, u: '' };
}

const esVolumen = (c) => c.tiempo || c.config.progression.type === 'reps';

function propuesta(f, c, motor) {
  if (!f.chip) return '<span class="pill none">Sin propuesta</span><div class="why">Primera sesión: busca su peso</div>';
  const ch = f.chip;
  const vol = motor === 'propuesto' && esVolumen(c);
  const label = vol ? TIPO_VOL[ch.tipo] : (ch.assist ? TIPO_ASIST : TIPO)[ch.tipo];
  const cifra = vol && ch.total != null ? ` · ${ch.total}${c.tiempo ? ' s' : ' reps'}`
    : ch.peso != null && c.pesoInicial ? ` ${n(ch.peso)} kg`
    : ch.reps != null ? ` ${ch.reps} reps` : ch.tiempo != null ? ` ${ch.tiempo} s` : '';
  const e1rm = ch.e1rm ? `<div class="why">1RM estimado: ${n(Math.round(ch.e1rm * 10) / 10)} kg</div>` : '';
  return `<span class="pill ${ch.tipo}">${label}${cifra}</span><div class="why">${esc(ch.why)}</div>${e1rm}`;
}

function series(lista, c, hizo) {
  const r = rango(c);
  return `<div class="sets">${lista.map((s) => {
    const v = Number(hizo ? (c.tiempo ? s.time : s.reps) : s.reps);
    const cls = !hizo ? '' : v < r.min ? 'bajo' : v >= r.max && r.max > r.min ? 'tope' : '';
    const peso = hizo ? s.weight : s.peso;
    const pesoTxt = c.pesoInicial ? `${n(peso)}<span class="x">×</span>` : '';
    const rpe = hizo && s.rpe ? `<sub>@${n(s.rpe)}</sub>` : '';
    return `<span class="set ${cls}">${pesoTxt}${n(v)}${r.u}${rpe}</span>`;
  }).join('')}</div>`;
}

function celda(f, c, motor) {
  const pide = f.plan ? `<div class="linea"><span class="lab">Pide</span>${series(f.plan, c, false)}</div>` : '';
  const hizo = f.hizo ? `<div class="linea"><span class="lab">Hizo</span>${series(f.hizo, c, true)}</div>` : '';
  return `${propuesta(f, c, motor)}${pide}${hizo}`;
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
  const filas = c.hoy.map((h, i) => {
    const p = c.propuesto[i];
    const ultima = h.hizo == null;
    const firma = (f) => JSON.stringify([f.chip?.tipo, f.plan?.map((x) => `${Number(x.peso) || 0}x${Number(x.reps)}`)]);
    const cambia = firma(h) !== firma(p);
    return `<tr id="${c.id}-${i + 1}" class="${ultima ? 'next' : ''}">
      <td class="num">${ultima ? '→' : i + 1}<div class="dia">${ultima ? '' : `día ${h.dia}`}</div></td>
      <td>${celda(h, c, 'hoy')}</td>
      <td class="${cambia ? 'cambia' : ''}">${celda(p, c, 'propuesto')}</td>
      <td class="nota">${esc(h.nota)}</td>
    </tr>`;
  }).join('');
  return `<section class="caso" id="${c.id}">
    <h2>${esc(c.nombre)}</h2>
    <p class="perfil">${esc(c.perfil)}</p>
    <p class="cfg">${configTxt(c)}</p>
    <div class="tabla"><table>
      <thead><tr><th>Sesión</th><th>Hoy en la app</th><th>Motor propuesto</th><th>Qué pasa</th></tr></thead>
      <tbody>${filas}</tbody>
    </table></div>
  </section>`;
}

const html = `<title>Visor de progresión</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@500;700&family=Source+Sans+3:wght@400;600&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>
/* Layout: una columna de casos; cada caso es una tabla sesión a sesión con los dos motores lado a lado. */
:root {
  --bg: #f6f7f4; --surface: #ffffff; --fg: #1d221c; --muted: #5d665b; --line: #dfe3db;
  --accent: #4a6b2a; --cambia: #f3f7e9;
  --up: #2f7a3a; --up-bg: #e3f2e2; --hold: #6b6455; --hold-bg: #eeebe3; --down: #b2452f; --down-bg: #f8e3dd;
  --bajo: #b2452f; --tope: #2f7a3a;
  --display: 'Archivo', 'Helvetica Neue', Arial, sans-serif;
  --body: 'Source Sans 3', 'Segoe UI', system-ui, sans-serif;
  --mono: 'IBM Plex Mono', ui-monospace, Consolas, monospace;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
  --bg: #141713; --surface: #1c201b; --fg: #e8ebe4; --muted: #9aa395; --line: #2e342c; --accent: #a9cf7e; --cambia: #222a1c;
  --up: #8fd39a; --up-bg: #1f3322; --hold: #c9c1ad; --hold-bg: #2b2923; --down: #f0957f; --down-bg: #3a221c;
  --bajo: #f0957f; --tope: #8fd39a; color-scheme: dark } }
:root[data-theme="dark"] {
  --bg: #141713; --surface: #1c201b; --fg: #e8ebe4; --muted: #9aa395; --line: #2e342c; --accent: #a9cf7e; --cambia: #222a1c;
  --up: #8fd39a; --up-bg: #1f3322; --hold: #c9c1ad; --hold-bg: #2b2923; --down: #f0957f; --down-bg: #3a221c;
  --bajo: #f0957f; --tope: #8fd39a; color-scheme: dark }
body { background: var(--bg); color: var(--fg); font: 16px/1.5 var(--body);
  padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); padding-block: 32px 64px; }
main { max-width: 1120px; margin: 0 auto; display: grid; gap: 40px; }
h1, h2 { font-family: var(--display); text-wrap: balance; margin: 0; }
h1 { font-size: 2rem; }
h2 { font-size: 1.3rem; }
.intro p { max-width: 70ch; margin: 8px 0 0; color: var(--muted); }
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
table { border-collapse: collapse; width: 100%; min-width: 820px; }
th { text-align: left; font: 600 .75rem var(--body); text-transform: uppercase; letter-spacing: .06em; color: var(--muted); padding: 10px 12px; border-bottom: 1px solid var(--line); }
td { padding: 10px 12px; border-bottom: 1px solid var(--line); vertical-align: top; }
tr:last-child td { border-bottom: 0; }
td.cambia { background: var(--cambia); }
tr.next td { border-top: 2px solid var(--line); }
tr:target td { outline: 2px solid var(--accent); outline-offset: -2px; }
.num { font: 500 1rem var(--mono); width: 56px; font-variant-numeric: tabular-nums; }
.dia { font-size: .75rem; color: var(--muted); }
.pill { display: inline-block; font-weight: 600; font-size: .9rem; padding: 2px 10px; border-radius: 6px; white-space: nowrap; }
.pill.up { color: var(--up); background: var(--up-bg); }
.pill.hold { color: var(--hold); background: var(--hold-bg); }
.pill.down { color: var(--down); background: var(--down-bg); }
.pill.none { color: var(--muted); border: 1px dashed var(--line); }
.why { font-size: .85rem; color: var(--muted); margin-top: 4px; max-width: 36ch; }
.linea { display: flex; gap: 8px; align-items: baseline; margin-top: 6px; }
.lab { font-size: .7rem; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); width: 32px; flex: none; }
.sets { display: flex; flex-wrap: wrap; gap: 6px; }
.set { font: .85rem var(--mono); font-variant-numeric: tabular-nums; border: 1px solid var(--line); border-radius: 5px; padding: 1px 6px; white-space: nowrap; }
.set .x { color: var(--muted); }
.set sub { color: var(--muted); font-size: .7rem; }
.set.bajo { color: var(--bajo); border-color: var(--bajo); }
.set.tope { color: var(--tope); border-color: var(--tope); }
.nota { font-size: .9rem; max-width: 24ch; }
</style>
<main>
  <header class="intro">
    <h1>Visor de progresión</h1>
    <p>Nueve personas pasadas sesión a sesión por dos motores: <b>el de la app hoy</b> y <b>el propuesto</b>, un prototipo con lo acordado en el replanteo que todavía no está en la app. En cada motor la persona sigue lo que ese motor le pide; las reps de cada día son las mismas en los dos. La última fila es lo que pediría en la siguiente sesión. Por esfuerzo (Javi) no cambia.</p>
    <div class="leyenda">
      <span><span class="set bajo">7</span> por debajo del mínimo</span>
      <span><span class="set tope">12</span> arriba del rango</span>
      <span><span class="pill up">Subir</span> <span class="pill hold">Mantener</span> <span class="pill down">Bajar</span></span>
      <span>Fondo verde: el propuesto decide distinto</span>
    </div>
  </header>
  <section class="hallazgos">
    <h2>Qué cambia</h2>
    <ol>${HALLAZGOS.map(([id, fila, txt]) => `<li>${txt} <a href="#${id}-${fila}">Ver fila</a></li>`).join('')}</ol>
  </section>
  <nav>${casos.map((c) => `<a href="#${c.id}">${esc(c.nombre.split(' · ')[0])}${c.id.includes('-') ? ` · ${esc(c.nombre.split(' · ')[1].split(' ').slice(0, 3).join(' '))}` : ''}</a>`).join('')}</nav>
  ${casos.map(caso).join('')}
</main>`;

writeFileSync(salida, html);
