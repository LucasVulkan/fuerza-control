// docs/catalogo.html (spec X03 §6): junta lo que se quiere (catalogo.js) con lo que hay en Blender (assets/index.json, del
// exportador) en la plantilla catalogo.template.html.   npm run catalogo
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const { CATALOGO, MANOS_NUEVAS, FUERA } = require(path.join(root, 'catalogo.js'));
const idx = JSON.parse(fs.readFileSync(path.join(root, 'assets/index.json'), 'utf8'));
const lib = fs.readFileSync(path.join(root, '../mobile/src/data/exerciseLibrary.js'), 'utf8');
const FICHAS = [...lib.matchAll(/\bid: '(\w+)'/g)].map(m => m[1]);

const VISOR = ['stand', 'seat', 'hinge', 'hang', 'row', 'cable', 'floor', 'split', 'bench'];   // bases con su lógica en runtime.js (`libre`: X03-02; floor, split y bench: X03-07)
const POSE = { ok: 'lista', revisar: 'revisar', borrador: 'borrador' };
const A = idx.acciones, H = idx.manos;
const pose = id => (A[id] ? POSE[A[id].estado] || 'borrador' : 'falta');

const MOV = CATALOGO.map(m => ({ id: m.id, n: m.nombre, ex: m.ejercicios.map(e => {
  const a = A[e.accion], base = a ? a.base : e.base;
  return { a: e.accion, n: e.nombre, pose: pose(e.accion), base, plan: base !== e.base ? e.base : null, logica: VISOR.includes(base),
    mano: a && a.mano !== undefined ? a.mano : e.mano, fichas: e.fichas || [],
    ejes: Object.entries(e.ejes || {}).map(([eje, vals]) => [eje, Object.entries(vals).map(([v, o]) => {
      const [org, mano] = o.split('|'), [src, acc] = org.split(':');
      if (src === 'accion') return [v, 'accion', acc || null, acc ? pose(acc) : 'falta', true, mano];
      return [v, src === 'hecha' ? 'script' : src, null, null, src === 'hecha', mano];
    })]) };
}) }));

const usadas = new Set(MOV.flatMap(m => m.ex.flatMap(e => [e.mano, ...e.ejes.flatMap(([, vs]) => vs.map(v => v[5]))])).filter(Boolean));
const MANOS = [...Object.entries(H).map(([id, h]) => [id, h.nombre, POSE[h.estado] || 'borrador']),
  ...[...usadas].filter(id => !H[id]).map(id => [id, MANOS_NUEVAS[id] || id, 'falta'])];

const enCat = new Set(MOV.flatMap(m => m.ex.flatMap(e => [e.a, ...e.ejes.flatMap(([, vs]) => vs.map(v => v[2]))])));
const fichasCat = MOV.flatMap(m => m.ex.flatMap(e => e.fichas));
const AVISOS = [
  ['Fichas de la app sin ejercicio en el catálogo (ni en FUERA)', FICHAS.filter(f => !fichasCat.includes(f) && !FUERA.includes(f))],
  ['Fichas del catálogo que no existen en la app', fichasCat.filter(f => !FICHAS.includes(f))],
  ['Fichas en dos ejercicios', fichasCat.filter((f, i) => fichasCat.indexOf(f) !== i)],
  ['Acciones de Blender que no están en el catálogo', Object.keys(A).filter(id => !enCat.has(id))],
  ['Variantes por script sobre una acción libre (no funcionan hasta su base)',
    MOV.flatMap(m => m.ex.filter(e => e.base === 'libre').flatMap(e => e.ejes.flatMap(([eje, vs]) => vs.filter(v => v[1] === 'script').map(v => `${e.a} · ${eje}: ${v[0]}`))))],
];

const datos = `const MOV = ${JSON.stringify(MOV)};\nconst MANOS = ${JSON.stringify(MANOS)};\nconst AVISOS = ${JSON.stringify(AVISOS)};\n` +
  `const GENERADO = ${JSON.stringify(new Date().toISOString().slice(0, 16).replace('T', ' '))};\n`;
const html = fs.readFileSync(path.join(__dirname, 'catalogo.template.html'), 'utf8').replace('/*DATOS*/', () => datos);
fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
fs.writeFileSync(path.join(root, 'docs/catalogo.html'), html);
const n = MOV.reduce((s, m) => s + m.ex.length, 0), hay = MOV.reduce((s, m) => s + m.ex.filter(e => e.pose !== 'falta').length, 0);
console.log(`docs/catalogo.html: ${MOV.length} movimientos, ${n} ejercicios (${hay} con acción), ${FICHAS.length} fichas en la app`);
for (const [t, l] of AVISOS) if (l.length) console.log(`  ${t}: ${l.length}`);
