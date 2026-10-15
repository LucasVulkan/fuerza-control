// Genera pagina/index.html (la página compartible de revisión de copy).
// uso: node docs/copy/pagina/build.js   — lee ../textos/lote*.json y ../capturas/registro.md
const fs = require('fs'), path = require('path');
const here = __dirname, copy = path.join(here, '..');

const textos = Object.assign({}, ...fs.readdirSync(path.join(copy, 'textos')).filter(f => f.endsWith('.json'))
  .map(f => require(path.join(copy, 'textos', f))));
const es = require(path.join(copy, '../../src/locales/es.json')), flat = {};
(function w(o, p) { for (const k in o) { const q = p ? p + '.' + k : k; typeof o[k] === 'object' ? w(o[k], q) : (flat[q] = o[k]); } })(es, '');
const registro = fs.readFileSync(path.join(copy, 'capturas/registro.md'), 'utf8');
const sospechosos = (registro.split('## Textos sospechosos')[1] || '').split('\n').filter(l => l.startsWith('- ')).map(l => l.slice(2));

const areas = [
  ['00|01', 'Menú y ajustes'], ['02', 'Sesión'], ['03', 'Entreno'], ['05', 'Programa'],
  ['06|07', 'Editores'], ['08', 'Progresión'], ['09', 'Entrenador'], ['10', 'Onboarding'],
];
const titles = {
  '001-menu-arriba': 'Menú de ajustes', '002-menu-abajo': 'Menú de ajustes (abajo)', '003-programas-archivados': 'Programas archivados',
  '004-exportar': 'Exportar', '005-importar-selector': 'Importar archivo', '006-entrenador-vincular': 'Entrenador',
  '006b-vincular-google-previo': 'Vincular con Google', '006c-cambiar-entrenador': 'Cambiar de entrenador', '006d-desconectar': 'Desconectarme',
  '007-copia-drive': 'Copia en Google Drive', '008-sync-clientes': 'Sincronización con clientes', '009a-unidades-idioma-tema': 'Unidades, idioma y tema',
  '009c-peso-corporal': 'Peso corporal', '010-pestanas-interruptores': 'Interruptores de pestañas', '011a-paywall': 'Paywall (Forma Pro)',
  '013-eliminar-cuenta': 'Eliminar mi cuenta', '020-inicio-programa': 'Inicio', '021-inicio-desplazado': 'Inicio (abajo)',
  '022-hoja-sesion-libre': 'Sesión libre', '023-hoja-desde-plantillas': 'Desde tus plantillas', '024-banner-sesion-activa': 'Sesión en curso',
  '030a-workout-vacio': 'Entreno vacío', '031a-workout-ejercicio': 'Entreno: ejercicio', '031b-serie-marcada-descanso': 'Entreno: serie hecha',
  '032-regla-deslizar': 'Entreno: regla', '033-notas-ejercicio': 'Notas del ejercicio', '050-programa-arriba': 'Programa',
  '060-editor-programa': 'Editor de programa', '064-planificador-etapas': 'Planificador de etapas', '067-selector-ejercicios': 'Selector de ejercicios',
  '068-selector-sin-resultados': 'Selector: sin resultados', '070-hoja-progresion': 'Hoja de progresión', '072-ejercicio-personalizado': 'Ejercicio personalizado',
  '080-progresion-principal': 'Progresión', '081-carga-calendario': 'Carga y calendario', '082a-info-strain': 'Info: Strain',
  '082b-info-evolucion-carga': 'Info: evolución de carga', '090-clientes-panel': 'Clientes', '100a-onboarding-paso1': 'Onboarding · paso 1',
  '100b-onboarding-paso2': 'Onboarding · paso 2', '100c-onboarding-elegir': 'Onboarding · elegir', '100d-onboarding-paso-siguiente': 'Onboarding · paso 4',
  '100e-onboarding-paso-siguiente': 'Onboarding · paso 5', '100f-onboarding-paso-siguiente': 'Onboarding · paso 6',
  '101a-confirmacion-programa': 'Onboarding · confirmación', '101b-hoja-ajustes-sheet': 'Onboarding · ajustes',
};
const ids = fs.readdirSync(path.join(here, 'img')).filter(f => f.endsWith('.jpg')).map(f => f.slice(0, -4)).sort();
let docN = 0;
const screen = id => {
  const num = id.split('-')[0];
  const title = titles[id] || (id.startsWith('012') ? `Documentación · ${++docN}` : id);
  const seen = new Set();
  const texts = (textos[id + '.png'] || []).filter(t => { const k = t.key || t.text; if (seen.has(k)) return false; seen.add(k); return true; })
    .map(t => t.key ? { key: t.key, text: flat[t.key] } : t);   // el texto sale siempre de es.json
  return { id, num, title, texts, warn: sospechosos.filter(l => l.startsWith(num.slice(0, 3) + ' ') || l.startsWith(num + ' ')) };
};
const data = { areas: areas.map(([re, name]) => ({ name, screens: ids.filter(i => new RegExp('^(' + re + ')').test(i)).map(screen) })).filter(a => a.screens.length) };
const html = fs.readFileSync(path.join(here, 'template.html'), 'utf8')
  .replace('__DATA__', () => JSON.stringify(data).replace(/</g, '\\u003c'));
fs.writeFileSync(path.join(here, 'index.html'), html);
const n = data.areas.reduce((a, x) => a + x.screens.length, 0), sinTextos = data.areas.flatMap(a => a.screens).filter(s => !s.texts.length).map(s => s.id);
console.log(`index.html: ${n} pantallas; sin textos: ${sinTextos.length ? sinTextos.join(', ') : 'ninguna'}`);
