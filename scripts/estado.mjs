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
 *   > Fase C05-01 · <estado> · Título de la fase · §3 · antes C19   ← «antes» es opcional
 *   >
 *   > Estado: **…**   ← la prosa de siempre, con el detalle
 *
 * El archivo se llama `C05-trainer-logging.md`: tema (C) + número de spec (05) +
 * nombre. Las fases son `C05-01`, `C05-02`… dentro de SU spec: tema > spec > tarea.
 * «antes» guarda el código de cuando las fases se numeraban por tema (C19), que
 * sigue en comentarios de src/ y mensajes de commit: `npm run estado C19` lo traduce.
 *
 * y, en cualquier sitio del documento, la lista de pruebas de cada fase:
 *
 *   **Probar C05-01**
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
 * Uso: `npm run estado`            regenera la página
 *      `npm run estado C19`       traduce un código viejo (o enseña una spec/tarea nueva)
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

// Hoy en local (`sv` da AAAA-MM-DD): las fechas de las specs son del día en que se trabajó.
const HOY = new Date().toLocaleDateString('sv');
const esFecha = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

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
 * Listas `**Probar C05-01**` + casillas `- [ ]` / `- [x]`, en cualquier parte del
 * documento. Se admite el prefijo `>` porque alguna vive dentro de una cita.
 * Devuelve `{ 'C05-01': [{ hecha, texto }] }`.
 */
function pruebasDe(texto, f) {
  const lineas = texto.split('\n').map((l) => l.replace(/^>\s?/, ''));
  const out = {};
  for (let i = 0; i < lineas.length; i++) {
    const m = lineas[i].match(/^\*\*Probar ([A-Z]\d{2}-\d{2})\*\*\s*$/);
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
 * `> Fase M01-01 · pendiente · Identidad en RevenueCat · §3 · antes M01`
 *
 * El `antes` es opcional y va el último.
 *
 * Solo la cabecera, hasta la linea `> Estado:`: mas abajo la prosa tiene frases
 * que empiezan por "Fase 3 ..." dentro de la misma cita.
 */
const fasesDe = (lineas, f, codSpec) => lineas
  .slice(0, Math.max(0, lineas.findIndex((l) => l.startsWith('> Estado:'))))
  .filter((l) => l.startsWith('> Fase '))
  .map((l) => {
    const trozos = l.slice(7).split('·').map((x) => x.trim());
    const antes = /^antes [A-Z]\d{2}$/.test(trozos.at(-1)) ? trozos.pop().slice(6) : '';
    const [codigo, estado] = trozos;
    const ref = trozos[trozos.length - 1];
    if (!/^[A-Z]\d{2}-\d{2}$/.test(codigo)) throw new Error(`${f}: código de fase "${codigo}" — se espera spec + tarea, p. ej. M01-02`);
    if (!codigo.startsWith(`${codSpec}-`)) throw new Error(`${f}: la fase ${codigo} no cuelga de la spec ${codSpec} (el prefijo del archivo)`);
    if (!ESTADOS.includes(estado)) throw new Error(`${f}: la fase ${codigo} tiene estado "${estado}". Los válidos: ${ESTADOS.join(', ')}`);
    if (!/^§[\d.]+$/.test(ref)) throw new Error(`${f}: la fase ${codigo} no acaba en "· §N", la sección del documento que la cuenta`);
    const titulo = trozos.slice(2, -1).join(' · ').trim();
    if (!titulo) throw new Error(`${f}: la fase ${codigo} no tiene título`);
    return { codigo, estado, titulo, ref, antes };
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
    const codigo = f.match(/^([A-Z]\d{2})-/)?.[1];
    if (!codigo) throw new Error(`${f}: el archivo debe empezar por su código de spec, p. ej. C05-${f}`);
    const texto  = leer(f);
    const lineas = texto.split('\n');
    if (/\*\*Probar en dispositivo/.test(texto)) {
      throw new Error(`${f}: queda un "**Probar en dispositivo.**" suelto. Las pruebas van en una lista "**Probar Xnn**" con casillas "- [ ]" (ver scripts/estado.mjs)`);
    }
    const pruebas = pruebasDe(texto, f);
    const fases  = fasesDe(lineas, f, codigo).map((x) => {
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
      codigo,
      titulo:  (lineas[0] ?? '').replace(/^#\s*(Spec —\s*)?/, '').trim() || basename(f, '.md'),
      tema:    clave(lineas, 'Tema'),
      corto:   clave(lineas, 'En corto'),
      estado:  clave(lineas, 'Estado'),
      inicio:  clave(lineas, 'Inicio'),
      fin:     clave(lineas, 'Fin'),
      fases,
    };
    for (const k of ['tema', 'corto', 'estado']) {
      if (!spec[k]) throw new Error(`${f}: falta la línea "> ${k}:" de la cabecera estándar (ver scripts/estado.mjs)`);
    }
    if (!TEMAS.some(([t]) => t === spec.tema)) {
      throw new Error(`${f}: tema "${spec.tema}" desconocido. Los válidos: ${TEMAS.map(([t]) => t).join(', ')}`);
    }
    if (fases.length === 0) {
      throw new Error(`${f}: ninguna línea "> Fase ${codigo}-01 · estado · título". Toda spec tiene al menos una.`);
    }
    if (codigo[0] !== letraDe(spec.tema)) throw new Error(`${f}: la spec ${codigo} no empieza por "${letraDe(spec.tema)}", la letra del tema "${spec.tema}"`);
    const repetida = fases.find((x, i) => fases.findIndex((y) => y.codigo === x.codigo) !== i);
    if (repetida) throw new Error(`${f}: la fase ${repetida.codigo} aparece dos veces`);

    // Fechas de trabajo. Las tareas aparcadas NO cuentan: ni empiezan la spec ni
    // impiden que acabe. Inicio = el día en que la primera salió de «pendiente»
    // (no el día en que se escribió la spec); Fin = el día en que la última lo hizo.
    const activas   = fases.filter((x) => x.estado !== 'aparcado');
    const empezada  = activas.some((x) => x.estado !== 'pendiente');
    const completa  = activas.length > 0 && activas.every((x) => x.estado !== 'pendiente');
    for (const [k, v] of [['Inicio', spec.inicio], ['Fin', spec.fin]]) {
      if (v && !esFecha(v)) throw new Error(`${f}: "> ${k}: ${v}" no es una fecha AAAA-MM-DD`);
    }
    if (empezada && !spec.inicio) throw new Error(`${f}: tiene tareas empezadas y le falta "> Inicio: AAAA-MM-DD" bajo "En corto" — el día en que salió de pendiente la primera (hoy es ${HOY})`);
    if (!empezada && spec.inicio) throw new Error(`${f}: lleva "> Inicio:" pero ninguna tarea ha salido de pendiente (las aparcadas no cuentan). Quítalo`);
    if (completa && !spec.fin) throw new Error(`${f}: todas sus tareas (salvo las aparcadas) están hechas y le falta "> Fin: AAAA-MM-DD" bajo "Inicio" (hoy es ${HOY})`);
    if (!completa && spec.fin) throw new Error(`${f}: lleva "> Fin:" pero le quedan tareas pendientes. Quítalo`);
    if (spec.fin && spec.fin < spec.inicio) throw new Error(`${f}: "Fin" (${spec.fin}) es anterior a "Inicio" (${spec.inicio})`);
    if (spec.inicio > HOY) throw new Error(`${f}: "Inicio" (${spec.inicio}) es futuro; hoy es ${HOY}`);
    return spec;
  })
  .sort((a, b) => TEMAS.findIndex(([t]) => t === a.tema) - TEMAS.findIndex(([t]) => t === b.tema)
    || a.codigo.localeCompare(b.codigo));

// Los códigos son la forma de referirse a una spec entre sesiones: si dos se
// pisan, el de ayer deja de significar lo que decía. Las fases cuelgan de su
// spec (se comprueba arriba), así que basta con que no haya dos specs iguales.
const vistos = new Map();
for (const s of specs) {
  if (vistos.has(s.codigo)) throw new Error(`Código de spec ${s.codigo} repetido: ${vistos.get(s.codigo)} y ${s.archivo}`);
  vistos.set(s.codigo, s.archivo);
}
// ── Ideas ─────────────────────────────────────────────────────────────────────
// `mobile/docs/ideas.md` lo escribe el usuario a mano: cada `## ` es una idea,
// con código opcional (`## P17 · Título`, `## P16-06 · Título`). Un código ya
// usado por una spec o tarea FALLA: la idea se convirtió y hay que borrarla.
const ideas = readFileSync(join(RAIZ, 'mobile', 'docs', 'ideas.md'), 'utf8').replace(/\r/g, '')
  .split(/^## /m).slice(1)
  .map((trozo) => {
    const [cab, ...resto] = trozo.split('\n');
    const m = cab.match(/^([A-Z]\d{2}(?:-\d{2})?)\s*·\s*(.+)$/);
    const idea = { codigo: m?.[1] ?? '', titulo: (m?.[2] ?? cab).trim(), cuerpo: resto.join('\n').trim() };
    const c = idea.codigo;
    if (c) {
      const donde = `ideas.md: la idea ${c}`;
      if (!TEMAS.some(([, , l]) => l === c[0])) throw new Error(`${donde} empieza por "${c[0]}", que no es la letra de ningún tema`);
      const spec = specs.find((s) => s.codigo === c.slice(0, 3));
      if (c.length === 3 && spec) throw new Error(`${donde} ya es la spec ${spec.archivo}. Bórrala de ideas.md o cámbiale el código`);
      if (c.length > 3 && !spec) throw new Error(`${donde} es una tarea de la spec ${c.slice(0, 3)}, que no existe`);
      if (c.length > 3 && spec.fases.some((x) => x.codigo === c)) throw new Error(`${donde} ya es una tarea de ${spec.archivo}. Bórrala de ideas.md o cámbiale el código`);
    }
    return idea;
  });
const repeIdea = ideas.find((x, i) => x.codigo && ideas.findIndex((y) => y.codigo === x.codigo) !== i);
if (repeIdea) throw new Error(`ideas.md: el código ${repeIdea.codigo} aparece dos veces`);

// Buscar a mano el siguiente numero libre es justo como se acaba reutilizando
// uno: se calcula aquí, para la consola y para el «+ Idea» de la página.
const temasLibres = TEMAS.filter(([t]) => t !== 'errores').map(([, nombre, l]) => {
  const usados = [...specs.map((s) => s.codigo), ...ideas.map((x) => x.codigo.slice(0, 3))]
    .filter((c) => c[0] === l).map((c) => Number(c.slice(1)));
  return { nombre, codigo: `${l}${String(Math.max(0, ...usados) + 1).padStart(2, '0')}` };
});
const libres = temasLibres.map((t) => t.codigo);

const viejos = new Map(); // 'C19' → { s, x }
for (const s of specs) for (const x of s.fases) if (x.antes) viejos.set(x.antes, { s, x });

// `npm run estado C19` / `C05` / `C05-01`: traduce y sale, sin regenerar nada.
// Un `Cnn` suelto es ambiguo: spec nueva Y tarea antigua (C05 era una tarea de
// triaje y hoy es una spec). Se enseñan las dos lecturas.
const consulta = process.argv[2]?.toUpperCase();
if (consulta) {
  const tarea = ({ s, x }) => [`${x.codigo} · ${x.titulo}`, `    ${s.codigo} ${s.titulo} · ${s.archivo} ${x.ref} · ${x.estado}`].join('\n');
  const lecturas = [];
  const viejo = viejos.get(consulta);
  if (viejo) lecturas.push(`${consulta} como código ANTIGUO (comentarios de src/, commits) → ${tarea(viejo)}`);
  const nueva = specs.find((s) => s.codigo === consulta);
  if (nueva) {
    lecturas.push([`${consulta} como SPEC → ${nueva.titulo} · ${nueva.archivo}`,
      ...nueva.fases.map((x) => `    ${x.codigo} · ${x.estado} · ${x.titulo}`)].join('\n'));
  }
  const fase = specs.flatMap((s) => s.fases.map((x) => ({ s, x }))).find(({ x }) => x.codigo === consulta);
  if (fase) lecturas.push(`TAREA → ${tarea(fase)}`);
  const idea = ideas.find((x) => x.codigo === consulta);
  if (idea) lecturas.push(`IDEA (ideas.md) → ${idea.codigo} · ${idea.titulo}${idea.cuerpo ? `\n${idea.cuerpo.replace(/^/gm, '    ')}` : ''}`);
  if (!lecturas.length) { console.error(`${consulta}: ni spec, ni tarea, ni idea, ni código antiguo.`); process.exit(1); }
  console.log(lecturas.join('\n'));
  process.exit(0);
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

// Rama de cada tarea hecha: «develop» si la nombra (`T09-01`, o la spec entera
// `T09`) algún commit de develop o de la rama actual que aún no esté en main; si
// no, «main». Los `docs` no cuentan: anotar una spec o marcar una casilla no
// lleva código a ninguna rama. ponytail: un commit sin código deja su tarea en
// «main»; por eso los commits llevan el código de la tarea (AGENTS.md).
const enDevelop = new Set(execFileSync('git', ['log', 'develop', 'HEAD', '^main', '--format=%x00%s%n%b'], { cwd: RAIZ })
  .toString().split('\0').filter((c) => c && !/^docs\b/.test(c))
  .flatMap((c) => [...c.matchAll(/\b[A-Z]\d{2}(?:-\d{2})?\b/g)].map((m) => m[0])));
for (const s of specs) {
  for (const x of s.fases) {
    const hecha = x.situacion === 'probar' || x.situacion === 'terminada';
    x.rama = !hecha ? '' : enDevelop.has(x.codigo) || enDevelop.has(s.codigo) ? 'develop' : 'main';
  }
}
const chipRama = (x) => (x.rama ? `<span class="chip rama-${x.rama}">${x.rama}</span>` : '');

// ── Plan ──────────────────────────────────────────────────────────────────────
// `mobile/docs/plan.md`: cada `## ` es una versión, en orden de salida; debajo,
// un código por línea en el orden en que se hará. Un código de spec (`T08`)
// mete todas sus tareas salvo las que estén puestas sueltas (`T08-03`) en otro
// sitio; también vale el código de una idea (`P17`). Lo reescribe el servidor
// de `npm run plan` al arrastrar; a mano también vale.
const PLAN = join(RAIZ, 'mobile', 'docs', 'plan.md');
const versiones = [];
try {
  for (const l of readFileSync(PLAN, 'utf8').replace(/\r/g, '').split('\n')) {
    if (l.startsWith('## ')) versiones.push({ nombre: l.slice(3).trim(), items: [] });
    else if (/^[A-Z]\d{2}(-\d{2})?\s*$/.test(l) && versiones.length) versiones.at(-1).items.push(l.trim());
  }
} catch (e) { if (e.code !== 'ENOENT') throw e; }
const specDe = new Map(specs.map((s) => [s.codigo, s]));
const faseDe = new Map(specs.flatMap((s) => s.fases.map((x) => [x.codigo, { s, x }])));
const ideaDe = new Map(ideas.filter((x) => x.codigo).map((x) => [x.codigo, x]));
const enPlan = new Set();
for (const v of versiones) {
  for (const c of v.items) {
    if (!specDe.has(c) && !faseDe.has(c) && !ideaDe.has(c)) throw new Error(`plan.md: «${c}» (en ${v.nombre}) no es ninguna spec, tarea ni idea`);
    if (enPlan.has(c)) throw new Error(`plan.md: «${c}» aparece dos veces`);
    enPlan.add(c);
  }
}
const viva = (x) => x.situacion === 'hacer' || x.situacion === 'probar';
/** Las tareas que trae una spec puesta en el plan: las que no están sueltas en otro sitio. */
const tareasDeSpec = (s) => s.fases.filter((x) => !enPlan.has(x.codigo) && x.situacion !== 'aparcada');
/** Specs con alguna tarea por hacer que el plan no cubre, e ideas con código fuera del plan. */
const sinPlanificar = [
  ...specs.filter((s) => !enPlan.has(s.codigo) && s.fases.some((x) => x.situacion === 'hacer' && !enPlan.has(x.codigo))).map((s) => s.codigo),
  ...[...ideaDe.keys()].filter((c) => !enPlan.has(c)),
];

/** El bloque del tablero en el que cae una spec: manda lo más urgente que tenga. */
for (const s of specs) {
  s.c = cuenta(s.fases);
  s.id = s.archivo.replace(/\.md$/, '');
  // Sin ninguna tarea viva (todas aparcadas) no es «completada»: está aparcada.
  s.grupo = s.c.probar ? 'probar' : s.c.hacer ? 'hacer' : s.c.terminada ? 'hecha' : 'aparcada';
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

const letra = (s) => `<span class="letra" title="${esc(nombreTema(s.tema))}">${esc(s.codigo)}</span>`;

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

/** Tema > spec > tarea. El tablero enseña los temas; cada tema, sus specs en orden de código. */
const specsDe = (tema) => specs.filter((s) => s.tema === tema);
const cuentaTema = (tema) => cuenta(specsDe(tema).flatMap((s) => s.fases));

const tarjetaTema = ([tema, nombre, l]) => {
  const ss = specsDe(tema);
  const c = cuentaTema(tema);
  return `<button class="tile ${c.casillas ? 'g-probar' : ''}" data-abre="t-${esc(tema)}">
  ${anillo(c, 56)}
  <span class="tcuerpo">
    <span class="tcab"><span class="letra">${l}</span><b>${esc(nombre)}</b></span>
    <span class="corto">${plural(ss.length, 'spec', 'specs')} · ${plural(ss.flatMap((s) => s.fases).length, 'tarea', 'tareas')}</span>
    <span class="chips">${chips(c)}</span>
  </span>
</button>`;
};

/** Lo apuntado a mano en ideas.md, antes de ser spec. */
const bloqueIdeas = () => `<section class="bloque b-ideas">
    <h2><span class="punto"></span>Ideas<span class="n">${ideas.length}</span>
      <button class="irlinea solo-edicion" data-accion="nueva-idea">+ Idea</button></h2>
    <p class="sub">Lo apuntas tú en <code>mobile/docs/ideas.md</code>; «vamos con P17» y Claude la pasa a spec.</p>
    <form class="formu nueva-idea" hidden>
      <select name="codigo">${temasLibres.map((t) => `<option value="${t.codigo}">${esc(t.nombre)} · ${t.codigo}</option>`).join('')}
        <option value="">Sin tema (sin código)</option></select>
      <input name="titulo" placeholder="Título de la idea" required autocomplete="off">
      <textarea name="cuerpo" rows="4" placeholder="Notas, dudas, lo que quieras (opcional)"></textarea>
      <div class="botones"><button type="submit" class="guardar">Guardar idea</button><button type="button" data-accion="cancelar-form">Cancelar</button></div>
    </form>
    <div class="lista-probar">${ideas.map((x) => `<details class="idea">
      <summary>${x.codigo ? `<span class="cod">${esc(x.codigo)}</span>` : ''}<span class="pt">${md(x.titulo)}</span></summary>
      ${x.cuerpo ? `<pre>${esc(x.cuerpo)}</pre>` : ''}</details>`).join('')}</div>
  </section>`;

// ── Plan (vista) ──────────────────────────────────────────────────────────────
// Tarjetas que se arrastran por el asa (`npm run plan`). Una spec lleva dentro
// sus tareas vivas, y cada una se puede sacar a otra versión por separado.
const NOMBRE_SIT = { hacer: 'por hacer', probar: 'por probar', terminada: 'terminada', aparcada: 'aparcada' };
const CHIP_SIT = { hacer: 'h', probar: 'p', terminada: 't', aparcada: '' };
const cartaTarea = (x, s, suelta) => `<div class="pc tarea ${x.situacion}" data-codigo="${x.codigo}" data-spec="${s.codigo}">
  <span class="asa" title="Arrastrar">⠿</span>${suelta ? '<span class="orden-n"></span>' : ''}<span class="cod">${esc(x.codigo)}</span>
  <button class="pt" data-abre="${esc(s.id)}">${md(x.titulo)}${suelta ? ` <span class="de">· ${esc(s.titulo)}</span>` : ''}</button>
  <span class="chip ${CHIP_SIT[x.situacion]}">${x.situacion === 'terminada' ? '✓ ' : ''}${NOMBRE_SIT[x.situacion]}</span></div>`;

const cartaPlan = (c) => {
  if (ideaDe.has(c)) {
    return `<div class="pc idea-pc" data-codigo="${c}"><span class="asa" title="Arrastrar">⠿</span><span class="orden-n"></span>
      <span class="cod">${esc(c)}</span><span class="pt">${md(ideaDe.get(c).titulo)}</span><span class="chip">idea</span></div>`;
  }
  if (faseDe.has(c)) { const { s, x } = faseDe.get(c); return cartaTarea(x, s, true); }
  const s = specDe.get(c);
  const ts = tareasDeSpec(s);
  const vivas = ts.filter(viva);
  return `<div class="pc spec ${vivas.length ? '' : 'hecha'}" data-codigo="${c}">
  <div class="pcab"><span class="asa" title="Arrastrar">⠿</span><span class="orden-n"></span>${letra(s)}
    <button class="pt" data-abre="${esc(s.id)}">${esc(s.titulo)}</button>
    <span class="chips">${chips(cuenta(ts))}</span>
    ${vivas.length ? `<button class="desplegar" aria-expanded="false">${plural(vivas.length, 'tarea', 'tareas')} ▸</button>` : ''}</div>
  <div class="ptareas" data-spec="${c}" hidden>${vivas.map((x) => cartaTarea(x, s, false)).join('')}</div>
</div>`;
};

/** Las tareas que cubre una versión, para su barra. */
const tareasDeVersion = (v) => v.items.flatMap((c) => (specDe.has(c) ? tareasDeSpec(specDe.get(c)) : faseDe.has(c) ? [faseDe.get(c).x] : []));
const pendienteItem = (c) => ideaDe.has(c) || (faseDe.has(c) ? viva(faseDe.get(c).x) : tareasDeSpec(specDe.get(c)).some(viva));

const bloquePlan = () => {
  const sig = versiones.flatMap((v) => v.items.map((c) => ({ v, c }))).find(({ c }) => pendienteItem(c));
  const titulo = (c) => ideaDe.get(c)?.titulo ?? faseDe.get(c)?.x.titulo ?? specDe.get(c).titulo;
  const abre = (c) => specDe.get(c)?.id ?? faseDe.get(c)?.s.id ?? '';
  const version = (v) => {
    const c = cuenta(tareasDeVersion(v));
    return `<div class="version" data-version="${esc(v.nombre)}">
    <div class="vcab"><span class="asa vasa" title="Mover la versión">⠿</span><button class="vplegar" aria-expanded="true" title="Plegar o desplegar">▾</button><b class="vnombre">${esc(v.nombre)}</b><span class="n">${v.items.length}</span>
      ${barra(c)}<span class="vcuenta">${c.terminada}/${c.terminada + c.probar + c.hacer}</span>
      <button class="vborrar solo-edicion" title="Borrar la versión vacía" ${v.items.length ? 'hidden' : ''}>×</button></div>
    <div class="vlista">${v.items.map(cartaPlan).join('')}</div></div>`;
  };
  return `<section class="bloque b-plan">
    <h2><span class="punto"></span>Plan<span class="n">${plural(versiones.length, 'versión', 'versiones')}</span>
      <button class="irlinea solo-edicion" data-accion="nueva-version">+ Versión</button></h2>
    <form class="formu nueva-version" hidden>
      <input name="nombre" placeholder="Nombre de la versión (p. ej. 1.2)" required autocomplete="off">
      <div class="botones"><button type="submit" class="guardar">Crear</button><button type="button" data-accion="cancelar-form">Cancelar</button></div>
    </form>
    <p class="sub">Cada versión, lo que entra; dentro, el orden. Pulsa su nombre para cambiarlo. <span class="sin-edicion">Para arrastrar, ábrela con <code>npm run plan</code>.</span></p>
    ${sig ? `<button class="siguiente" data-abre="${esc(abre(sig.c))}"><span class="etq">Lo siguiente · ${esc(sig.v.nombre)}</span>
      <span class="cod">${esc(sig.c)}</span><span class="pt">${md(titulo(sig.c))}</span></button>` : ''}
    <div class="versiones">${versiones.map(version).join('')}</div>
    <details class="version sinplan" open><summary class="vcab"><b>Sin planificar</b><span class="n">${sinPlanificar.length}</span>
      <span class="sub">Specs con tareas por hacer e ideas que no están en ninguna versión.</span></summary>
      <div class="vlista">${sinPlanificar.map(cartaPlan).join('')}</div></details>
  </section>`;
};

/** Franja que cruza los temas: lo único que el usuario tiene que accionar. */
const franjaProbar = () => {
  const xs = specs.flatMap((s) => s.fases.filter((x) => x.situacion === 'probar').map((x) => ({ s, x })));
  if (xs.length === 0) return '';
  return `<section class="bloque b-probar" data-filtrable>
    <h2><span class="punto"></span>Por probar<span class="n">${xs.length}</span></h2>
    <p class="sub">Programado; falta que lo compruebes en el móvil.</p>
    <div class="lista-probar">${xs.map(({ s, x }) => `<button class="pp" data-abre="${esc(s.id)}" data-rama="${x.rama}">
      <span class="cod">${esc(x.codigo)}</span>${antes(x)}<span class="pt">${md(x.titulo)}</span>${chipRama(x)}
      <span class="chip p">${plural(x.pruebas.filter((p) => !p.hecha).length, 'prueba', 'pruebas')}</span></button>`).join('')}</div>
  </section>`;
};

const vistaTema = ([tema, nombre, l]) => {
  const vivas = specsDe(tema).filter((s) => s.grupo === 'probar' || s.grupo === 'hacer');
  const hechas = specsDe(tema).filter((s) => s.grupo === 'hecha');
  const aparcadas = specsDe(tema).filter((s) => s.grupo === 'aparcada');
  const c = cuentaTema(tema);
  return `<section class="detalle" data-vista="t-${esc(tema)}" data-padre="" hidden>
  <button class="volver" data-abre="">← Todo</button>
  <div class="dcab">${anillo(c, 88)}
    <div><div class="tema"><span class="letra">${l}</span>Tema</div>
      <h2>${esc(nombre)}</h2><p class="corto">${plural(specsDe(tema).length, 'spec', 'specs')}, por orden de código.</p>
      <div class="chips">${chips(c)}</div></div></div>
  ${vivas.length ? `<div class="tiles">${vivas.map(tarjeta).join('')}</div>` : ''}
  ${hechas.length ? `<section class="bloque b-hecha"><h2><span class="punto"></span>Completadas<span class="n">${hechas.length}</span></h2>
    <div class="minis">${hechas.map(mini).join('')}</div></section>` : ''}
  ${aparcadas.length ? `<section class="bloque"><h2><span class="punto"></span>Aparcadas<span class="n">${aparcadas.length}</span></h2>
    <p class="sub">Todas sus tareas están aparcadas: no cuentan.</p>
    <div class="minis">${aparcadas.map(mini).join('')}</div></section>` : ''}
</section>`;
};

// ── Línea de tiempo ───────────────────────────────────────────────────────────
// Una barra por spec, de su Inicio a su Fin (o a hoy si sigue abierta). Las
// aparcadas no cuentan, así que una spec solo con aparcadas no sale; y una spec
// sin ninguna tarea empezada va abajo, en «Sin iniciar».
const DIA = 864e5;
const diaN = (s) => Math.round(Date.parse(s) / DIA);
const fechaCorta = (s) => new Date(`${s}T00:00:00Z`).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', timeZone: 'UTC' }).replace('.', '');
const duracion = (s) => diaN(s.fin || HOY) - diaN(s.inicio) + 1;

const lineaTiempo = () => {
  const con = specs.filter((s) => s.inicio);
  if (con.length === 0) return '<p class="sub">Ninguna spec ha empezado todavía.</p>';
  const PX = 9;   // por día: unos 95 días caben en una pantalla de escritorio
  let d0 = Math.min(...con.map((s) => diaN(s.inicio)));
  d0 -= (new Date(d0 * DIA).getUTCDay() + 6) % 7;            // al lunes de esa semana
  const dHoy = diaN(HOY);
  const dias = dHoy - d0 + 1 + 6;
  const ancho = dias * PX;
  const semanas = Array.from({ length: Math.ceil(dias / 7) }, (_, i) => d0 + i * 7);

  const cab = `<div class="tl-etq tl-cab"></div><div class="tl-pista tl-cab">${semanas.map((w) =>
    `<span class="tl-sem" style="left:${(w - d0) * PX}px">${fechaCorta(new Date(w * DIA).toISOString().slice(0, 10))}</span>`).join('')}</div>`;

  // Una línea por spec: el nombre no baja de línea (se ve entero en el título al
  // pasar el ratón) y las fechas viajan junto a la barra, no debajo del nombre.
  // El texto va a la derecha de la barra, o a su izquierda si ahí ya no cabe.
  const fila = (s) => {
    const x0 = (diaN(s.inicio) - d0) * PX;
    const d = duracion(s);
    const w = d * PX;
    const rango = `${fechaCorta(s.inicio)} → ${s.fin ? fechaCorta(s.fin) : 'hoy'}`;
    const texto = `${d} d · ${rango}`;
    const aLaDerecha = x0 + w + 6 + 150 <= ancho;
    const pos = aLaDerecha ? `left:${x0 + w + 6}px` : `right:${ancho - x0 + 6}px`;
    return `<div class="tl-etq"><button data-abre="${esc(s.id)}" title="${esc(`${s.codigo} · ${s.titulo}`)}">${letra(s)}<span class="tl-tit">${esc(s.titulo)}</span></button></div>
      <div class="tl-pista"><button class="tl-barra g-${s.grupo}${s.fin ? '' : ' abierta'}" data-abre="${esc(s.id)}"
          style="left:${x0}px;width:${w}px" title="${esc(`${s.codigo} · ${rango} · ${plural(d, 'día', 'días')}`)}"></button>
        <span class="tl-dur" style="${pos}">${texto}</span></div>`;
  };
  const cabGrupo = (letraTxt, nombre, n) => `<div class="tl-etq tl-tema"><span class="letra">${esc(letraTxt)}</span>${esc(nombre)}${n ? `<span class="n">${n}</span>` : ''}</div><div class="tl-pista tl-tema"></div>`;
  const porInicio = (a, b) => a.inicio.localeCompare(b.inicio) || a.codigo.localeCompare(b.codigo);

  // Orden 1: por tema, dentro de cada uno las que empezaron antes primero.
  const filasTema = TEMAS.filter(([t]) => t !== 'errores').map(([tema, nombre, l]) => {
    const ss = con.filter((s) => s.tema === tema).sort(porInicio);
    return ss.length ? cabGrupo(l, nombre) + ss.map(fila).join('') : '';
  }).join('');
  // Orden 2: lo que sigue abierto primero, y dentro de cada bloque, las más antiguas arriba.
  const abiertas  = con.filter((s) => !s.fin).sort(porInicio);
  const cerradas  = con.filter((s) => s.fin).sort(porInicio);
  const filasProgreso = (abiertas.length ? cabGrupo('▶', 'En progreso', abiertas.length) + abiertas.map(fila).join('') : '')
    + (cerradas.length ? cabGrupo('✓', 'Terminadas', cerradas.length) + cerradas.map(fila).join('') : '');

  const tabla = (orden, filas) => `<div class="tl-scroll" data-orden="${orden}" hidden><div class="tl" style="--px:${PX}px;--ancho:${ancho}px;--hoy:${(dHoy - d0) * PX + PX / 2}px">${cab}${filas}</div></div>`;
  const media = cerradas.length ? Math.round(cerradas.reduce((a, s) => a + duracion(s), 0) / cerradas.length) : 0;
  const sinIniciar = specs.filter((s) => !s.inicio && s.grupo !== 'aparcada');

  return `<p class="corto">${plural(con.length, 'spec empezada', 'specs empezadas')} · ${plural(cerradas.length, 'terminada', 'terminadas')}
      (duración media ${plural(media, 'día', 'días')}) · ${plural(abiertas.length, 'abierta', 'abiertas')}.
      Las tareas aparcadas no cuentan.</p>
    <div class="orden" role="group" aria-label="Orden"><button data-orden="tema">Por tema</button><button data-orden="progreso">En progreso primero</button></div>
    <div class="leyenda"><span><i class="g-hecha"></i>implementada y probada</span><span><i class="g-probar"></i>por probar</span>
      <span><i class="g-hacer"></i>con tareas por hacer</span><span><i class="abierta g-hacer"></i>sigue abierta (llega a hoy)</span></div>
    ${tabla('tema', filasTema)}${tabla('progreso', filasProgreso)}
    ${sinIniciar.length ? `<section class="bloque"><h2><span class="punto"></span>Sin iniciar<span class="n">${sinIniciar.length}</span></h2>
      <p class="sub">Ninguna tarea ha salido de «pendiente».</p><div class="minis">${sinIniciar.map(mini).join('')}</div></section>` : ''}`;
};

const vistaLinea = () => `<section class="detalle" data-vista="linea" data-padre="" hidden>
  <button class="volver" data-abre="">← Todo</button>
  <div class="dcab"><div><div class="tema">Temas</div><h2>Línea de tiempo</h2></div></div>
  ${lineaTiempo()}
</section>`;

const cuentaGrupo = (g) => specs.filter((s) => s.grupo === g).length;
const cifra = (g, num, texto) => `<div class="cifra c-${g}"><b>${num}</b><span>${texto}</span></div>`;

// ── Detalle de una spec ───────────────────────────────────────────────────────
const verDoc = (x, archivo) => `<details class="doc"><summary>Ver ${esc(x.ref)} de la spec</summary>
  <span class="ruta-doc">${esc(archivo)} ${esc(x.ref)}</span><pre>${esc(x.cuerpo)}</pre></details>`;

const antes = (x) => (x.antes ? `<span class="antes">antes ${esc(x.antes)}</span>` : '');

const casillas = (x, s) => `<ol class="pruebas">${x.pruebas.map((p, i) => `<li class="${p.hecha ? 'ok' : ''}" data-casilla="${esc(s.archivo)}|${x.codigo}|${i}">
  <span class="caja">${p.hecha ? '✓' : ''}</span><span class="n">${x.codigo}.${i + 1}</span><span>${md(p.texto)}</span></li>`).join('')}</ol>`;

const fase = {
  probar: (x, s) => `<div class="fase probar" data-rama="${x.rama}">
    <div class="fcab"><span class="cod">${esc(x.codigo)}</span>${antes(x)}<b>${md(x.titulo)}</b>${chipRama(x)}
      <span class="chip p">${x.pruebas.filter((p) => p.hecha).length}/${x.pruebas.length}</span></div>
    ${casillas(x, s)}
    <div class="pista-uso">Cuando lo pruebes, dile a Claude «<b>${esc(x.codigo)} probada</b>» o «<b>${esc(x.codigo)}.1 falla: …</b>».</div>
    ${verDoc(x, s.archivo)}
  </div>`,
  hacer: (x, s) => `<div class="fase hacer ${x.situacion}" data-rama="">
    <div class="fcab"><span class="cod">${esc(x.codigo)}</span>${antes(x)}<b>${md(x.titulo)}</b>
      ${x.situacion === 'aparcada' ? '<span class="chip">aparcada</span>' : ''}
      ${x.pruebas.length ? `<span class="chip">${plural(x.pruebas.length, 'prueba preparada', 'pruebas preparadas')}</span>` : ''}</div>
    ${verDoc(x, s.archivo)}
  </div>`,
  terminada: (x) => `<div class="fase terminada" data-rama="${x.rama}">
    <div class="fcab"><span class="cod">${esc(x.codigo)}</span>${antes(x)}<span>${md(x.titulo)}</span>${chipRama(x)}
      ${x.pruebas.length ? `<span class="chip t">✓ ${plural(x.pruebas.length, 'probada', 'probadas')}</span>` : ''}</div>
  </div>`,
};

const SECCIONES = [['probar', 'Por probar'], ['hacer', 'Por hacer'], ['terminada', 'Terminado']];

const detalle = (s) => `<section class="detalle" data-vista="${esc(s.id)}" data-padre="t-${esc(s.tema)}" hidden>
  <button class="volver" data-abre="t-${esc(s.tema)}">← ${esc(nombreTema(s.tema))}</button>
  <div class="dcab">
    ${anillo(s.c, 88)}
    <div><div class="tema">${letra(s)}${esc(nombreTema(s.tema))} · <code>${esc(s.archivo)}</code></div>
      <h2>${esc(s.titulo)}</h2><p class="corto">${md(s.corto)}</p>
      <div class="chips">${chips(s.c)}</div></div>
  </div>
  ${SECCIONES.map(([k, e]) => {
    const fs = s.fases.filter((x) => x.situacion === k || (k === 'hacer' && x.situacion === 'aparcada'));
    return fs.length ? `<div class="dsec s-${k}" data-filtrable><h3><span class="punto"></span>${e}<span class="n">${fs.length}</span></h3>
      <div class="lista">${fs.map((x) => fase[k](x, s)).join('')}</div></div>` : '';
  }).join('')}
  <p class="sub sin-rama" hidden>Ninguna tarea hecha de esta spec en esta rama.</p>
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

  /* ── barra fija: pestañas y rama ── */
  .fija{position:sticky;top:0;z-index:10;display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin:18px -16px 0;
        padding:10px 16px;background:rgba(15,17,19,.94);backdrop-filter:blur(8px);border-bottom:1px solid var(--bd)}
  .pestanas{display:flex;gap:4px;overflow-x:auto;flex:1;min-width:0}
  .pestanas button{display:flex;align-items:center;gap:7px;white-space:nowrap;font:700 15px/1 var(--num);text-transform:uppercase;
        letter-spacing:.04em;color:var(--mut);padding:9px 12px;border-radius:10px}
  .pestanas button:hover{color:var(--tx);background:var(--card)}
  .pestanas button[aria-current=true]{color:var(--tx);background:var(--card2);box-shadow:inset 0 -2px 0 var(--acc)}
  .pestanas .n{font:600 11px/1 Inter,sans-serif;color:var(--mut);background:var(--pista);border-radius:20px;padding:3px 7px;text-transform:none}
  .fuera{display:none!important}
  .vacio{margin-top:36px}
  #tablero .resumen{margin-top:18px}
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
  .lista-probar{display:flex;flex-direction:column;gap:8px;margin-top:14px}
  .pp{display:flex;gap:10px;align-items:center;background:#1f1c14;border:1px solid #4a3f22;border-left:3px solid var(--pend);
      border-radius:10px;padding:10px 14px;font-size:14px}
  .pp:hover{border-color:var(--pend)} .pp .pt{flex:1;line-height:1.35}
  .pp .cod{background:var(--pendbg);color:var(--pend)}
  .idea{background:var(--card);border:1px solid var(--bd);border-left:3px solid var(--mut2);border-radius:10px;padding:10px 14px;font-size:14px}
  .idea summary{display:flex;gap:10px;align-items:center;cursor:pointer;list-style:none} .idea summary::-webkit-details-marker{display:none}
  .idea .pt{flex:1;line-height:1.35}
  .idea pre{margin:10px 0 0;white-space:pre-wrap;word-break:break-word;font:12.5px/1.6 Inter,sans-serif;color:var(--mut)}
  .chip.rama-develop{background:#1d2a3a;color:#8ab8ff} .chip.rama-main{background:var(--pista);color:var(--mut)}
  .filtro-rama{display:flex;gap:6px;align-items:center;font-size:12px;color:var(--mut)}
  .filtro-rama button{font-size:12.5px;color:var(--mut);padding:6px 12px;border:1px solid var(--bd);border-radius:20px}
  .filtro-rama button[aria-pressed=true]{background:var(--accbg);color:var(--acc);border-color:var(--acc)}
  .b-plan .punto{background:var(--acc)}
  .siguiente{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:14px;width:100%;background:var(--accbg);
             border:1px solid var(--acc);border-radius:12px;padding:12px 16px;font-size:15px}
  .siguiente .etq{width:100%;font:700 12px/1 var(--num);text-transform:uppercase;letter-spacing:.06em;color:var(--acc)}
  .siguiente .cod{background:var(--acc);color:#111}
  .versiones{display:flex;flex-direction:column;gap:14px;margin-top:14px}
  .version{background:var(--card);border:1px solid var(--bd);border-radius:14px;padding:12px}
  .sinplan{margin-top:14px;border-style:dashed}
  .vcab{display:flex;align-items:center;gap:10px;font-size:14px;list-style:none}
  .vcab::-webkit-details-marker{display:none} summary.vcab{cursor:pointer;flex-wrap:wrap}
  .vcab b{font:700 18px/1 var(--num);text-transform:uppercase;letter-spacing:.03em}
  .vcab .n{font:600 12px/1 Inter,sans-serif;color:var(--mut);background:var(--card2);border-radius:20px;padding:4px 8px}
  .vcab .barra{max-width:220px} .vcuenta{font-size:12px;color:var(--mut)}
  .vborrar{margin-left:auto;color:var(--mut);font-size:18px;padding:0 6px}
  .vlista{display:flex;flex-direction:column;gap:6px;margin-top:10px;min-height:44px;counter-reset:n;border-radius:10px}
  .vlista:empty{border:1px dashed var(--bd)}
  .vlista>.pc{counter-increment:n}
  .vlista>.pc .orden-n::before{content:counter(n)}
  .orden-n{font:600 11px/1 ui-monospace,monospace;color:var(--mut2);min-width:14px;text-align:right}
  .pc{background:var(--card2);border:1px solid var(--bd);border-radius:10px;padding:8px 10px;font-size:14px}
  .pc.tarea,.pc.idea-pc{display:flex;gap:9px;align-items:center}
  .pcab{display:flex;gap:9px;align-items:center;flex-wrap:wrap}
  .pc .pt{flex:1;min-width:40%;line-height:1.35} .pc button.pt:hover{color:var(--acc)}
  .pc .de{color:var(--mut);font-size:12.5px}
  /* Terminada: franja lima, ✓ en lugar del número y título tachado. */
  .pc.hecha,.pc.terminada{border-left:3px solid var(--acc);background:#161a14}
  .pc.hecha .pt,.pc.terminada .pt{color:var(--mut);text-decoration:line-through;text-decoration-color:var(--mut2)}
  .vlista>.pc.hecha .orden-n::before,.vlista>.pc.terminada .orden-n::before{content:'✓';color:var(--acc);font-weight:700}
  .vplegar{color:var(--mut);font-size:13px;width:18px;text-align:center;transition:transform .15s}
  .vplegar:hover{color:var(--tx)}
  .version.plegada .vplegar{transform:rotate(-90deg)}
  .version.plegada .vlista,.version.plegada .vcab .n{display:none}
  .version.plegada .vcab .barra{max-width:none}
  .pc .chips{margin:0}
  .desplegar{font-size:12px;color:var(--mut);padding:3px 8px;border:1px solid var(--bd);border-radius:20px}
  .ptareas{display:flex;flex-direction:column;gap:6px;margin:8px 0 0 22px}
  .ptareas .pc{background:var(--card)}
  .asa{color:var(--mut2);cursor:grab;user-select:none;display:none;font-size:15px;line-height:1}
  .editable .asa{display:inline}
  .solo-edicion{display:none} .editable .solo-edicion:not([hidden]){display:inline-block}
  .editable .sin-edicion{display:none}
  .editable .vnombre{cursor:text}
  .editable .pruebas .caja{cursor:pointer}
  .sortable-ghost{opacity:.35}
  .nueva-version{flex-direction:row!important;flex-wrap:wrap;align-items:center} .nueva-version input{flex:1;min-width:200px}
  .formu{display:flex;flex-direction:column;gap:8px;margin-top:14px;background:var(--card);border:1px solid var(--bd);
              border-radius:12px;padding:14px}
  .formu select,.formu input,.formu textarea{font:inherit;font-size:14px;color:var(--tx);background:#0b0c0e;
              border:1px solid var(--bd);border-radius:8px;padding:9px 11px;resize:vertical}
  .formu :focus{outline:none;border-color:var(--acc)}
  .formu .botones{display:flex;gap:8px}
  .formu .botones button{font-size:13px;padding:8px 14px;border:1px solid var(--bd);border-radius:20px;color:var(--mut)}
  .vnombre[contenteditable=true]{outline:1px solid var(--acc);border-radius:4px;padding:2px 6px;cursor:text}
  .aviso{position:fixed;left:50%;bottom:20px;transform:translateX(-50%);z-index:20;max-width:min(560px,calc(100% - 32px));
         background:#3a1d1d;border:1px solid #a33;color:#fdd;border-radius:12px;padding:12px 16px;font-size:13.5px;cursor:pointer}
  .formu .guardar{background:var(--acc);color:#111!important;border-color:var(--acc)!important;font-weight:600}
  .antes{font-size:10.5px;color:var(--mut2);font-family:ui-monospace,monospace}
  .irlinea{margin-left:auto;font:500 12px Inter,sans-serif;text-transform:none;letter-spacing:0;color:var(--acc);
           border:1px solid var(--accbg);background:var(--accbg);border-radius:20px;padding:6px 12px}
  .irlinea:hover{border-color:var(--acc)}

  /* ── línea de tiempo ── */
  .leyenda{display:flex;gap:16px;flex-wrap:wrap;margin:12px 0 0;font-size:12px;color:var(--mut)}
  .leyenda span{display:flex;align-items:center;gap:6px}
  .leyenda i{width:22px;height:10px;border-radius:3px;display:inline-block}
  .tl-scroll{margin-top:18px;overflow-x:auto;border:1px solid var(--bd);border-radius:14px;background:var(--card)}
  .tl{--etq:300px;display:grid;grid-template-columns:var(--etq) var(--ancho);min-width:max-content}
  .tl-etq{position:sticky;left:0;z-index:2;background:var(--card);border-right:1px solid var(--bd);border-bottom:1px solid #1e2124;
          padding:0 10px;display:flex;align-items:center;min-width:0}
  .tl-etq button{display:flex;gap:7px;align-items:baseline;font-size:12.5px;line-height:1.3;min-width:0;max-width:100%}
  .tl-etq button:hover .tl-tit{color:var(--tx)}
  .tl-tit{color:#c5c9ce;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
  .tl-pista{position:relative;height:32px;border-bottom:1px solid #1e2124;
            background-image:linear-gradient(to right,#22252a 1px,transparent 1px);background-size:calc(7*var(--px)) 100%}
  .tl-pista::after{content:"";position:absolute;top:0;bottom:0;left:var(--hoy);width:2px;background:var(--acc);opacity:.55;pointer-events:none}
  .tl-cab{height:30px;border-bottom:1px solid var(--bd);background-color:var(--card)}
  .tl-cab::after{display:none}
  .tl-sem{position:absolute;top:8px;font-size:10.5px;color:var(--mut2);padding-left:4px;white-space:nowrap}
  .tl-tema{height:30px;background-color:var(--card2);flex-direction:row;align-items:center;gap:8px;
           font:700 12px/1 var(--num);text-transform:uppercase;letter-spacing:.05em;color:var(--tx)}
  .tl-etq.tl-tema{background:var(--card2)}
  .tl-pista.tl-tema{background-color:var(--card2)}
  .tl-barra{position:absolute;top:7px;height:18px;border-radius:5px;min-width:6px}
  .tl-barra.g-hecha{background:var(--acc)} .tl-barra.g-probar{background:var(--pend)} .tl-barra.g-hacer{background:#5a6068}
  .tl-barra:hover{filter:brightness(1.15);outline:2px solid #fff3}
  .tl-barra.abierta{border-top-right-radius:0;border-bottom-right-radius:0;
                    -webkit-mask-image:linear-gradient(to right,#000 70%,rgba(0,0,0,.25));mask-image:linear-gradient(to right,#000 70%,rgba(0,0,0,.25))}
  .tl-dur{position:absolute;top:8px;font-size:11px;color:var(--mut);white-space:nowrap}
  .tl-tema .n{font:600 11px/1 Inter,sans-serif;color:var(--mut);background:var(--card);border-radius:20px;padding:3px 7px;margin-left:4px}
  .orden{display:flex;gap:6px;margin-top:14px}
  .orden button{font-size:12.5px;color:var(--mut);padding:7px 13px;border:1px solid var(--bd);border-radius:20px}
  .orden button[aria-pressed=true]{background:var(--accbg);color:var(--acc);border-color:var(--acc)}
  .leyenda i.g-hecha{background:var(--acc)} .leyenda i.g-probar{background:var(--pend)} .leyenda i.g-hacer{background:#5a6068}
  .leyenda i.abierta{background:linear-gradient(to right,#5a6068 55%,rgba(90,96,104,.2))}
  .detalle .tiles{margin-top:20px}
  .detalle .bloque{margin-top:28px}
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
    .tl{--etq:150px}
    .fija{gap:6px} .pestanas{flex-basis:100%} .pestanas button{padding:8px 9px;font-size:14px}
    .pp{flex-wrap:wrap} .pp .pt{flex-basis:calc(100% - 80px)}
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

  <div class="fija">
    <nav class="pestanas" aria-label="Secciones">
      <button data-abre="" data-pestana="plan">Plan<span class="n">${plural(versiones.length, 'versión', 'versiones')}</span></button>
      <button data-abre="" data-pestana="probar">Por probar<span class="n" id="n-probar">${total.probar}</span></button>
      <button data-abre="" data-pestana="ideas">Ideas<span class="n">${ideas.length}</span></button>
      <button data-abre="" data-pestana="temas">Temas<span class="n">${TEMAS.length}</span></button>
    </nav>
    <div class="filtro-rama" role="group" aria-label="Rama">Rama
      <button data-filtro="">Todo</button><button data-filtro="main">main</button><button data-filtro="develop">develop</button></div>
  </div>

  <div id="tablero">
    <div class="resumen">
      ${cifra('probar', total.probar, `tareas por probar · ${plural(total.casillas, 'prueba', 'pruebas')}`)}
      ${cifra('hacer', total.hacer, 'tareas por hacer')}
      ${cifra('hecha', total.terminada, 'tareas terminadas')}
    </div>
    <div class="global">${barra(total)}<span>${total.terminada}/${total.terminada + total.probar + total.hacer} tareas</span></div>

    <div data-de="plan">${bloquePlan()}</div>
    <div data-de="probar">${franjaProbar() || '<p class="sub vacio">Nada por probar.</p>'}</div>
    <div data-de="ideas">${bloqueIdeas()}</div>

    <section class="bloque" data-de="temas">
      <h2><span class="punto"></span>Temas<span class="n">${TEMAS.length}</span>
        <button class="irlinea" data-abre="linea">Línea de tiempo →</button></h2>
      <p class="sub">Tema › spec › tarea: <code>C05-02</code> es la tarea 2 de la spec 5 de Entrenador ↔ cliente.</p>
      <div class="tiles">${TEMAS.filter(([t]) => t !== 'errores').map(tarjetaTema).join('')}
        <button class="tile" data-abre="errores"><span class="tcuerpo">
          <span class="tcab"><span class="letra">E</span><b>Errores · auditoría técnica</b></span>
          <span class="corto">${hechos === fallos.length ? 'Todos los fallos resueltos' : plural(fallos.length - hechos, 'fallo pendiente', 'fallos pendientes')}</span>
          <span class="chips"><span class="chip ${hechos === fallos.length ? 't' : 'h'}">${hechos}/${fallos.length}</span></span></span></button>
      </div>
    </section>
  </div>

  ${TEMAS.filter(([t]) => t !== 'errores').map(vistaTema).join('\n')}
  ${specs.map(detalle).join('\n')}
  ${vistaLinea()}

  <section class="detalle" data-vista="errores" data-padre="" hidden>
    <button class="volver" data-abre="">← Todo</button>
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

  <div class="aviso" role="alert" hidden></div>
  <footer>${esc(commit[0] ?? '')} · ${esc(commit[1] ?? '')} · ${esc((commit[2] ?? '').slice(0, 90))}</footer>
</main>
<script src="https://cdnjs.cloudflare.com/ajax/libs/Sortable/1.15.2/Sortable.min.js"></script>
<script>
  // Vistas por JS y no anclas de hash: la página se abre también como data:
  // URL, y ahí una navegación por #ancla no hace nada. localStorage puede no
  // existir o lanzar por lo mismo: sin él se arranca siempre en el tablero.
  const tablero = document.getElementById('tablero');
  const vistas = document.querySelectorAll('.detalle');
  let abierta = '';
  try { abierta = localStorage.getItem('estado.spec') || ''; } catch {}
  if (abierta && !document.querySelector('[data-vista="' + abierta + '"]')) abierta = '';

  // Pestañas de la portada: se ve un bloque cada vez. Se recuerda la última.
  let pestana = 'plan';
  try { pestana = localStorage.getItem('estado.pestana') || 'plan'; } catch {}
  const pintar = () => {
    tablero.hidden = !!abierta;
    document.querySelectorAll('[data-de]').forEach((b) => b.classList.toggle('fuera', b.dataset.de !== pestana));
    document.querySelectorAll('[data-pestana]').forEach((b) => b.setAttribute('aria-current', String(!abierta && b.dataset.pestana === pestana)));
    try { localStorage.setItem('estado.pestana', pestana); } catch {}
    vistas.forEach((v) => { v.hidden = v.dataset.vista !== abierta; });
    try { localStorage.setItem('estado.spec', abierta); } catch {}
    // En el móvil la línea no cabe: se abre mirando a hoy, que es el extremo derecho.
    const sc = document.querySelector('.tl-scroll:not([hidden])');
    if (abierta === 'linea' && sc) sc.scrollLeft = sc.scrollWidth;
  };
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-abre]');
    if (!b) return;
    abierta = b.dataset.abre;
    if (b.dataset.pestana) pestana = b.dataset.pestana;
    pintar();
    window.scrollTo(0, 0);
  });
  // Orden de la línea de tiempo: por tema o lo abierto primero. Se recuerda; sin localStorage, por tema.
  let orden = 'tema';
  try { orden = localStorage.getItem('estado.orden') || 'tema'; } catch {}
  const pintarOrden = () => {
    document.querySelectorAll('.tl-scroll').forEach((e) => { e.hidden = e.dataset.orden !== orden; });
    document.querySelectorAll('.orden button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.orden === orden)));
    try { localStorage.setItem('estado.orden', orden); } catch {}
    const sc = document.querySelector('.tl-scroll:not([hidden])');
    if (abierta === 'linea' && sc) sc.scrollLeft = sc.scrollWidth;
  };
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-orden]');
    if (b && b.tagName === 'BUTTON') { orden = b.dataset.orden; pintarOrden(); }
  });
  pintarOrden();
  // Filtro por rama: con él solo quedan las tareas hechas de esa rama (las por
  // hacer no son de ninguna). Las secciones que se vacían se esconden y cuentan
  // solo lo que se ve. Los anillos y cifras siguen contando todo.
  let filtro = '';
  try { filtro = localStorage.getItem('estado.rama') || ''; } catch {}
  const pintarFiltro = () => {
    const pasa = (el) => !filtro || el.dataset.rama === filtro;
    document.querySelectorAll('[data-rama]').forEach((el) => { el.hidden = !pasa(el); });
    document.querySelectorAll('[data-filtrable]').forEach((sec) => {
      const n = [...sec.querySelectorAll('[data-rama]')].filter(pasa).length;
      sec.hidden = n === 0;
      sec.querySelector('.n').textContent = n;
      if (sec.classList.contains('b-probar')) document.getElementById('n-probar').textContent = n;
    });
    document.querySelectorAll('.sin-rama').forEach((p) => {
      p.hidden = !filtro || !!p.parentElement.querySelector('[data-filtrable]:not([hidden])');
    });
    document.querySelectorAll('[data-filtro]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.filtro === filtro)));
    try { localStorage.setItem('estado.rama', filtro); } catch {}
  };
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-filtro]');
    if (b) { filtro = b.dataset.filtro; pintarFiltro(); }
  });
  pintarFiltro();

  // Plegar una versión a una línea (nombre y barra). Se recuerda por nombre.
  let plegadas = [];
  try { plegadas = JSON.parse(localStorage.getItem('estado.plegadas') || '[]'); } catch {}
  const pintarPlegadas = () => document.querySelectorAll('.version[data-version]').forEach((v) => {
    const p = plegadas.includes(v.dataset.version);
    v.classList.toggle('plegada', p);
    v.querySelector('.vplegar').setAttribute('aria-expanded', String(!p));
  });
  document.addEventListener('click', (e) => {
    const b = e.target.closest('.vplegar');
    if (!b) return;
    const n = b.closest('.version').dataset.version;
    plegadas = plegadas.includes(n) ? plegadas.filter((x) => x !== n) : [...plegadas, n];
    try { localStorage.setItem('estado.plegadas', JSON.stringify(plegadas)); } catch {}
    pintarPlegadas();
  });
  pintarPlegadas();

  // Desplegar las tareas de una spec del plan (también sin servidor).
  document.addEventListener('click', (e) => {
    const b = e.target.closest('.desplegar');
    if (!b) return;
    const abierto = b.getAttribute('aria-expanded') === 'true';
    b.setAttribute('aria-expanded', String(!abierto));
    b.closest('.pc').querySelector('.ptareas').hidden = abierto;
  });

  // Edición: solo con el servidor de \`npm run plan\`, que guarda y regenera.
  // Cada cambio se escribe en el .md y se recarga: la página nueva ya sale del
  // archivo, así que nunca enseña algo distinto de lo guardado.
  const enviar = (ruta, datos) => fetch(ruta, { method: 'POST', body: JSON.stringify(datos) })
    .then((r) => (r.ok ? r.text() : r.text().then((t) => Promise.reject(t))))
    .then(() => { try { sessionStorage.setItem('estado.y', String(scrollY)); } catch {} location.reload(); })
    // Sin alert() ni prompt(): hay navegadores (el panel de la app de Claude,
    // entre ellos) que los bloquean sin avisar. El aviso se cierra recargando.
    .catch((err) => {
      const a = document.querySelector('.aviso');
      a.textContent = 'No se ha guardado: ' + err + ' (pulsa para recargar)';
      a.hidden = false;
      a.onclick = () => location.reload();
    });
  try {
    const y = sessionStorage.getItem('estado.y');
    if (y) { sessionStorage.removeItem('estado.y'); requestAnimationFrame(() => scrollTo(0, +y)); }
  } catch {}

  const guardarPlan = () => enviar('/api/plan', {
    versiones: [...document.querySelectorAll('.version[data-version]')].map((v) => ({
      nombre: v.dataset.version,
      items: [...v.querySelector('.vlista').children].map((c) => c.dataset.codigo),
    })),
  });

  const activarEdicion = () => {
    document.body.classList.add('editable');
    // forceFallback: arrastre con eventos de ratón, no el nativo de HTML5, que
    // pinta un fantasma traslúcido y no deja desplazar la página mientras.
    const comun = { handle: '.asa', animation: 150, forceFallback: true, onEnd: (e) => { if (e.from !== e.to || e.oldIndex !== e.newIndex) guardarPlan(); } };
    document.querySelectorAll('.vlista').forEach((el) => Sortable.create(el, { ...comun, group: 'plan', handle: '.vlista > .pc > .asa, .vlista > .pc > .pcab > .asa' }));
    // A la lista de una spec solo vuelven sus propias tareas.
    document.querySelectorAll('.ptareas').forEach((el) => Sortable.create(el, { ...comun, sort: false, handle: '.ptareas > .pc > .asa',
      group: { name: 'plan', pull: true, put: (to, from, drag) => drag.dataset.spec === to.el.dataset.spec } }));
    Sortable.create(document.querySelector('.versiones'), { ...comun, handle: '.vasa' });

    document.addEventListener('click', (e) => {
      if (e.target.closest('[data-accion="nueva-version"]')) {
        const f = document.querySelector('.nueva-version');
        f.hidden = false;
        f.nombre.focus();
      } else if (e.target.closest('.vborrar')) {
        e.target.closest('.version').remove();
        guardarPlan();
      } else if (e.target.closest('.vnombre') && !e.target.isContentEditable) {
        const n = e.target.closest('.vnombre');
        n.contentEditable = 'true';
        n.focus();
        getSelection().selectAllChildren(n);
      } else if (e.target.closest('[data-accion="nueva-idea"]')) {
        const f = document.querySelector('.nueva-idea');
        f.hidden = false;
        f.titulo.focus();
      } else if (e.target.closest('[data-accion="cancelar-form"]')) {
        e.target.closest('form').hidden = true;
      } else if (e.target.closest('.pruebas .caja')) {
        const [archivo, codigo, i] = e.target.closest('li').dataset.casilla.split('|');
        enviar('/api/casilla', { archivo, codigo, i: +i });
      }
    });
    // Renombrar: Intro o salir del campo guarda; Esc deja el nombre como estaba.
    const terminarNombre = (n, guardar) => {
      n.contentEditable = 'false';
      const v = n.closest('.version');
      const nombre = n.textContent.replace(/\\s+/g, ' ').trim();
      if (guardar && nombre && nombre !== v.dataset.version) { v.dataset.version = nombre; guardarPlan(); } else n.textContent = v.dataset.version;
    };
    document.addEventListener('keydown', (e) => {
      const n = e.target.closest?.('.vnombre[contenteditable=true]');
      if (!n) return;
      if (e.key === 'Enter') { e.preventDefault(); n.blur(); }
      if (e.key === 'Escape') { e.stopPropagation(); terminarNombre(n, false); }
    }, true);
    document.addEventListener('focusout', (e) => {
      if (e.target.matches?.('.vnombre[contenteditable=true]')) terminarNombre(e.target, true);
    });
    document.querySelector('.nueva-version').addEventListener('submit', (e) => {
      e.preventDefault();
      const v = document.createElement('div');
      v.className = 'version';
      v.dataset.version = e.target.nombre.value.trim();
      v.innerHTML = '<div class="vlista"></div>';
      document.querySelector('.versiones').append(v);
      guardarPlan();
    });
    document.querySelector('.nueva-idea').addEventListener('submit', (e) => {
      e.preventDefault();
      const f = e.target;
      enviar('/api/idea', { codigo: f.codigo.value, titulo: f.titulo.value, cuerpo: f.cuerpo.value });
    });
  };
  if (location.protocol.startsWith('http') && window.Sortable) {
    fetch('/api/ok').then((r) => { if (r.ok) activarEdicion(); }).catch(() => {});
  }
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !abierta) return;
    abierta = document.querySelector('[data-vista="' + abierta + '"]').dataset.padre;
    pintar();
  });
  pintar();
</script>
</body></html>`;

writeFileSync(SALIDA, html, 'utf8');
console.log(`Siguiente spec libre: ${libres.join(' · ')}  (la tarea nueva de una spec es su última + 1)`);

const porProbar = todasFases.filter((x) => x.situacion === 'probar').map((x) => x.codigo);
console.log(`${total.terminada} terminadas · ${total.probar} por probar${porProbar.length ? ` (${porProbar.join(', ')})` : ''} `
  + `· ${total.hacer} por hacer · ${total.aparcada} aparcadas · ${hechos}/${fallos.length} fallos resueltos`);
console.log(SALIDA);
