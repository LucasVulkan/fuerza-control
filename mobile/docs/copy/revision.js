// Genera revision.html: capturas + textos de es.json de cada pantalla, para revisar el copy.
// uso (desde mobile/): node docs/copy/revision.js
const fs = require('fs'), path = require('path');
const here = __dirname, src = path.join(here, '../../src');
const es = require(path.join(src, 'locales/es.json'));
const flat = {};
(function w(o, p) { for (const k in o) { const q = p ? p + '.' + k : k; typeof o[k] === 'object' ? w(o[k], q) : (flat[q] = o[k]); } })(es, '');

// Claves usadas literalmente por cada archivo (t('x'), 'x' suelto, t(`x${…}`)).
function keysOf(file) {
  const s = fs.readFileSync(path.join(src, file), 'utf8');
  const ks = [...s.matchAll(/['"`]([a-zA-Z]+\.[\w.]+)['"`]/g)].map(m => m[1]).filter(k => k in flat);
  for (const m of s.matchAll(/\bt\(\s*`([\w.]+)\$\{/g)) ks.push(...Object.keys(flat).filter(k => k.startsWith(m[1])));
  return ks;
}

// ponytail: el reparto captura → archivos es a mano; si añades capturas, añade aquí su grupo.
const groups = [
  ['00[12]', 'Menú de ajustes', ['components/AppHeader.jsx']],
  ['003', 'Programas archivados', ['components/ArchivedProgramsSheet.jsx']],
  ['00[45]', 'Exportar / importar', ['components/ImportModal.jsx']],
  ['006', 'Entrenador (vincular)', ['screens/TrainerConnectionScreen.jsx', 'components/ClientGoogleLinkModal.jsx']],
  ['007', 'Copia en Google Drive', ['screens/DriveBackupScreen.jsx'], ['drive.']],
  ['008', 'Sincronización con clientes', ['components/TrainerSyncModal.jsx'], ['sync.']],
  ['0(09|10)', 'Preferencias', [], ['header.']],
  ['011', 'Paywall', ['components/PaywallModal.jsx'], ['paywall.', 'freePlan.']],
  ['012', 'Documentación', ['screens/DocsScreen.jsx', 'components/ui/MetricDoc.jsx'], ['docs.', 'chartDocs.']],
  ['013', 'Eliminar mi cuenta', ['components/DeleteAccountModal.jsx'], ['deleteAccount.']],
  ['02', 'Inicio', ['screens/HomeScreen.jsx', 'components/HomeProgramCard.jsx', 'components/ActiveSessionBanner.jsx', 'components/SessionList.jsx', 'components/ui/NoProgram.jsx'], ['freeSession.']],
  ['03', 'Entreno', ['screens/WorkoutScreen.jsx', 'components/workout/ExerciseCard.jsx', 'components/workout/NotesModal.jsx'], ['restTimer.']],
  ['050', 'Programa', ['screens/MyProgramScreen.jsx', 'components/ui/ProgramCard.jsx', 'utils/stageProgress.js']],
  ['060', 'Editor de programa', ['screens/ProgramEditorScreen.jsx', 'components/ui/StageCards.jsx', 'utils/stageRx.js']],
  ['064', 'Planificador de etapas', ['screens/StagePlannerScreen.jsx'], ['planner.']],
  ['06[78]', 'Selector de ejercicios', ['screens/ExerciseSelectorScreen.jsx']],
  ['070', 'Hoja de progresión', ['components/editor/ProgressionSheet.jsx', 'utils/progression.js'], ['progression.']],
  ['072', 'Ejercicio personalizado', ['screens/CustomExerciseScreen.jsx'], ['customExercise.']],
  ['08[01]', 'Progresión y carga', ['screens/StatsScreen.jsx', 'components/stats/LoadTab.jsx', 'components/stats/LoadCalendar.jsx', 'components/stats/ProgressTab.jsx'], ['load.', 'stats.']],
  ['082', 'Info de métricas', ['components/ui/MetricInfo.jsx'], ['metrics.']],
  ['090', 'Clientes', ['components/FreeClientsSheet.jsx', 'components/ClientCodeModal.jsx'], []],
  ['10', 'Onboarding', ['screens/OnboardingScreen.jsx', 'components/onboarding/AdjustSheet.jsx', 'components/onboarding/AdaptationPanel.jsx', 'utils/adaptationDiff.js'], ['onboarding.']],
];

const shots = fs.readdirSync(path.join(here, 'capturas')).filter(f => f.endsWith('.png')).sort();
const registro = fs.readFileSync(path.join(here, 'capturas/registro.md'), 'utf8');
const sospechosos = registro.split('## Textos sospechosos')[1]?.split('\n').filter(l => l.startsWith('- ')) ?? [];
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

let body = '';
for (const [prefix, title, files, prefixes = []] of groups) {
  const re = new RegExp('^' + prefix);
  const imgs = shots.filter(f => re.test(f));
  const keys = [...new Set([...files.flatMap(keysOf), ...Object.keys(flat).filter(k => prefixes.some(p => k.startsWith(p)))])]
    .sort((a, b) => flat[b].length - flat[a].length);
  const sus = sospechosos.filter(l => re.test(l.slice(2)));
  body += `<section id="g${esc(prefix)}"><h2>${esc(title)}</h2>
${sus.length ? `<ul class="sus">${sus.map(l => `<li>${esc(l.slice(2))}</li>`).join('')}</ul>` : ''}
<div class="cols"><div class="shots">${imgs.map(f => `<a href="capturas/${f}" target="_blank"><img loading="lazy" src="capturas/${f}" alt="${f}"><span>${f}</span></a>`).join('') || '<p class="muted">Sin captura (solo texto).</p>'}</div>
<table>${keys.map(k => `<tr class="${flat[k].length >= 60 ? 'long' : ''}"><td><div class="txt">${esc(flat[k]).replace(/\n/g, '<br>')}</div><code>${esc(k)}</code></td><td><input data-k="${esc(k)}" placeholder="nota…"></td></tr>`).join('')}</table></div></section>\n`;
}

const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Revisión de copy</title><style>
:root{--bg:#fff;--fg:#1a1a1a;--muted:#777;--line:#e5e5e5;--hi:#f4ffd6;--warn:#fff4e0;--acc:#6a8f00}
@media (prefers-color-scheme:dark){:root{--bg:#141414;--fg:#eee;--muted:#999;--line:#2c2c2c;--hi:#24300a;--warn:#3a2a10;--acc:#b5e61d}}
body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.45 system-ui,sans-serif}
header{position:sticky;top:0;z-index:2;background:var(--bg);border-bottom:1px solid var(--line);padding:10px 16px;display:flex;gap:12px;align-items:center;flex-wrap:wrap}
header h1{font-size:17px;margin:0;flex:1}
header label{font-size:13px;color:var(--muted)}
button{font:inherit;padding:6px 12px;border-radius:8px;border:1px solid var(--line);background:var(--acc);color:#000;cursor:pointer}
nav{padding:8px 16px;display:flex;flex-wrap:wrap;gap:6px 14px;font-size:13px}nav a{color:var(--acc)}
section{padding:8px 16px 24px;border-bottom:1px solid var(--line)}
h2{font-size:18px}
.cols{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.4fr);gap:20px}
@media (max-width:800px){.cols{grid-template-columns:1fr}}
.shots{display:flex;flex-wrap:wrap;gap:8px;align-content:flex-start}
.shots a{width:180px;font-size:11px;color:var(--muted);text-decoration:none}
.shots img{width:100%;border:1px solid var(--line);border-radius:6px;display:block}
table{border-collapse:collapse;width:100%}td{border-top:1px solid var(--line);padding:6px 4px;vertical-align:top}
td:last-child{width:34%}input{width:100%;box-sizing:border-box;font:inherit;font-size:13px;padding:4px 6px;border:1px solid var(--line);border-radius:6px;background:var(--bg);color:var(--fg)}
input:not(:placeholder-shown){border-color:var(--acc)}
tr.long .txt{background:var(--hi);padding:2px 4px;border-radius:4px}
code{font-size:11px;color:var(--muted)}
.sus{background:var(--warn);border-radius:8px;padding:8px 8px 8px 28px;font-size:14px}
.muted{color:var(--muted)}
body.onlylong tr:not(.long){display:none}
</style></head><body>
<header><h1>Revisión de copy · ${shots.length} capturas</h1>
<label><input type="checkbox" id="ol" style="width:auto"> solo textos largos</label>
<button id="cp">Copiar notas</button></header>
<nav>${groups.map(g => `<a href="#g${esc(g[0])}">${esc(g[1])}</a>`).join('')}</nav>
${body}
<script>
const K='copy-notas';let n={};try{n=JSON.parse(localStorage.getItem(K))||{}}catch(e){}
document.querySelectorAll('input[data-k]').forEach(i=>{i.value=n[i.dataset.k]||'';i.oninput=()=>{n[i.dataset.k]=i.value;if(!i.value)delete n[i.dataset.k];try{localStorage.setItem(K,JSON.stringify(n))}catch(e){}}});
ol.onchange=()=>document.body.classList.toggle('onlylong',ol.checked);
cp.onclick=()=>{const t=Object.entries(n).map(([k,v])=>'- \`'+k+'\`: '+v).join('\\n')||'(sin notas)';navigator.clipboard.writeText(t).then(()=>cp.textContent='Copiado ✓',()=>prompt('Copia esto:',t));setTimeout(()=>cp.textContent='Copiar notas',1500)};
</script></body></html>`;
fs.writeFileSync(path.join(here, 'revision.html'), html);
console.log('revision.html:', shots.length, 'capturas,', groups.length, 'grupos');
