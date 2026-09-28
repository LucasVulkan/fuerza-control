/**
 * sessionToText — una sesión como texto para mandarla por WhatsApp
 * (docs/specs/trainer-logging.md §5, C21).
 *
 *   Sesión C · Pierna fuerza
 *   Sentadilla · 4x6 · 102.5kg:
 *   Zancada búlgara · 3x10 c/p:
 *   AMRAP 12' · 10 Wall ball, 10 Burpee:
 *
 *   Escribe detrás de cada «:» lo que hiciste…
 *
 * Cada línea es `nombre · receta[ · peso]:` y lo que el cliente escriba detrás
 * de los dos puntos es lo suyo: la C22 parte por el último `:` y sabe de
 * memoria lo que va delante. El nombre acaba en el primer ` · ` porque los de
 * la biblioteca llevan números y paréntesis («Extensión de espalda 45°»,
 * «Peso muerto rumano (barra)»).
 *
 * La receta va con lo que hay en un teclado (`x`, `-`), que es lo que el
 * cliente escribe al devolverla, y el peso es el de HOY: la sugerencia del
 * motor si la hay, y si no el último.
 */
import { targetLabel, exerciseName } from './prescription';
import { getProgression } from './progression';
import { sessionSlots } from './sessionSlots';
import es from '../locales/es.json';
import en from '../locales/en.json';

/** El separador entre el nombre, la receta y el peso de una línea. */
export const SEP = ' · ';

/** Lo que toca levantar hoy, en kg, o null si no hay nada que decir. */
export function todayWeight(exConfig, def, lastExercise, t) {
  const sets = lastExercise?.sets ?? [];
  if (!sets.length) return null;
  let chip = null;
  try { chip = getProgression(exConfig, def, sets, t); } catch { /* sin chip, el último */ }
  const w = chip?.suggestedWeight ?? Math.max(0, ...sets.map((s) => parseFloat(s.weight) || 0));
  return w > 0 ? w : null;
}

function prescription(def, ex, t) {
  if ((ex.progressionModel ?? def?.progressionModel) === 'submax') {
    return t('sessionText.sets', { count: ex.sets ?? 0 });
  }
  const rx = targetLabel(def, ex, t, { compact: true })
    .replace(/×/g, 'x').replace(/–/g, '-').replace(/ s$/, 's')
    // El tiempo no junta un rango cerrado como las reps: «40-40s» es «40s».
    .replace(/(?<!\d)(\d+)-\1(?!\d)/, '$1');
  // En compacto `targetLabel` se come el «por lado»; a quien entrena solo le hace falta.
  return (ex.isUnilateral ?? def?.isUnilateral) ? `${rx} ${t('workout.perSide')}` : rx;
}

function blockLine(block, allExercises, t, language, fmtWeight) {
  const fmt = t(`blocks.formats.${block.format}`);
  const min = (s) => (s % 60 === 0 ? `${s / 60}'` : `${s}s`);
  const head = block.format === 'amrap'
    ? `${fmt} ${min(block.capSec ?? 600)}`
    : block.format === 'emom'
      ? `${fmt} ${block.rounds ?? 1}x${min(block.intervalSec ?? 60)}`
      : `${fmt} ${t('sessionText.rounds', { count: block.rounds ?? 1 })}`;
  const moves = (block.movements ?? []).map((m) => {
    const unit = (m.unit ?? 'reps') === 'reps' ? '' : ` ${t(`blocks.units.${m.unit}`)}`;
    const name = exerciseName(allExercises[m.exerciseId], language, m.exerciseId);
    const w    = m.weight != null ? ` ${fmtWeight(m.weight)}` : '';
    return `${m.amount}${unit} ${name}${w}`;
  }).join(', ');
  return [block.name, head, moves].filter(Boolean).join(SEP);
}

/**
 * @param template      la sesión (`exercises`, `blocks`, `label`, `name`)
 * @param allExercises  librería + propios, por id
 * @param t             i18next
 * @param opts.language      idioma de los nombres
 * @param opts.fmtWeight     kg → texto en la unidad del usuario (`useWeightUnit().fmt`)
 * @param opts.lastExercise  (exConfig) → la última vez que lo hizo, o null. Sin
 *                           ella no salen pesos (el editor, un grupo).
 * @param opts.clientName    abre la cabecera: pegado en Clientes, el texto dice
 *                           solo de quién es (§6.4).
 */
export function sessionToText(template, allExercises, t, {
  language, fmtWeight = (kg) => `${kg}kg`, lastExercise, clientName,
} = {}) {
  const label = template.label ? t('workout.sessionLabel', { label: template.label }) : null;
  const title = [
    clientName?.trim() || null,
    label,
    // Una sesión sin nombre propio se llama «Sesión A»: no se repite.
    template.name && normName(template.name) !== normName(label) ? template.name : null,
  ].filter(Boolean).join(SEP);

  const lines = sessionSlots(template).flatMap((slot) => {
    if (slot.kind === 'block') return [blockLine(slot.block, allExercises, t, language, fmtWeight)];
    return slot.members.map((ex) => {
      const def = allExercises[ex.exerciseId];
      const kg  = lastExercise ? todayWeight(ex, def, lastExercise(ex), t) : null;
      return [
        exerciseName(def, language, ex.exerciseId),
        prescription(def, ex, t),
        kg != null ? fmtWeight(kg) : null,
      ].filter(Boolean).join(SEP);
    });
  }).map((l) => `${l}:`);

  return [title, ...lines, '', t('sessionText.howTo')].filter((l, i) => i > 0 || l).join('\n');
}

// ── Lector (§6, C22) ──────────────────────────────────────────────────────────
//
// Sin IA: el texto que vuelve es casi siempre el nuestro con números detrás de
// los dos puntos, así que lo de delante se sabe y lo de detrás tiene pocas
// formas (§6.2). Lo que no encaja se enseña tachado en la revisión, nunca se
// tira en silencio.

/** Sin tildes, sin mayúsculas, sin el formato de WhatsApp y con un espacio. */
export function normName(s) {
  return String(s ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[*_~]/g, '')
    .toLowerCase().replace(/\s+/g, ' ').trim();
}

const HOW_TO   = new Set([es.sessionText.howTo, en.sessionText.howTo].map(normName));
const BLOCK_RE = /^(amrap|emom|for time)\b/i;
const OK_RE    = /^(ok|vale|si|hecho|done|yes|bien|✓|✔|✔️|👍)$/u;
const NUM      = String.raw`\d+(?:\.\d+)?`;
const TOKEN_RE = new RegExp(String.raw`^(${NUM})(?:x(${NUM}))?(?:x(${NUM}))?(s|'|min)?(?:@(${NUM}))?$`);

/** «4x6» · «3x8-12» · «3x40s» · «3 series» → { sets, reps?, time? }. */
export function parseRx(seg) {
  const a = normName(seg);
  let m = a.match(/^(\d+)\s*x\s*(\d+)(?:-(\d+))?\s*(s|')?/);
  if (m) {
    // Con un rango vale el de abajo: «ok» en un 3x12-15 es 12, lo seguro. Lo
    // de arriba es lo que hace subir de peso, y eso lo tiene que decir el cliente.
    const [, sets, lo, , unit] = m;
    if (unit) return { sets: +sets, time: +lo * (unit === "'" ? 60 : 1) };
    return { sets: +sets, reps: +lo };
  }
  m = a.match(/^(\d+) (series|serie|sets|set)$/);
  return m ? { sets: +m[1] } : null;
}

function parseWeight(seg) {
  const m = normName(seg).match(/^(\d+(?:[.,]\d+)?)\s*(kg|lb)$/);
  return m ? parseFloat(m[1].replace(',', '.')) : null;
}

/**
 * Lo que el cliente escribió detrás de los dos puntos → series
 * `{ weight, reps, time, rpe }` en la unidad del usuario, o null si no lo hizo.
 * `rx` es la receta de la línea (null en un texto a mano) y `hint` el peso que
 * llevaba el texto.
 */
export function readAnswer(answer, rx = null, hint = null) {
  let a = normName(answer)
    .replace(/(\d),(\d)/g, '$1.$2')          // 102,5 — la coma con espacio separa
    .replace(/@\s+/g, '@')
    // La unidad pegada a un número se cae, también en «16kgx11» (sin límite de
    // palabra entre «kg» y «x»: por eso no vale `\b`).
    .replace(/@(\d+(?:\.\d+)?)\s*(?:kgs?|lbs?)(?=x\d|[^a-z]|$)/g, ' $1')   // «@100kg» es un peso, no un RPE
    .replace(/(\d)\s*(?:kgs?|lbs?)(?=x\d|[^a-z]|$)/g, '$1')
    .replace(/\b(kgs?|lbs?)\b/g, ' ')
    .trim()
    // «80 70 60 x13»: unas reps SEPARADAS tras una lista de pesos son de todas
    // (QA 28-sep). Pegadas («100 100 95x5») siguen siendo solo de la última.
    .replace(new RegExp(String.raw`^(${NUM}(?:[\s,;/]+${NUM})+)\s+[x×*]\s*(\d+)((?:\s+@${NUM})?)$`),
      (_, ws, r, rpe) => ws.split(/[\s,;/]+/).map((w) => `${w}x${r}`).join(' ') + rpe)
    .replace(/\s*[x×*]\s*(?=\d)/g, 'x');      // 100 x 6 → 100x6
  if (!a) return null;

  const fill = (n, set) => Array.from({ length: n }, () => ({ ...set }));
  const base = { weight: hint ?? '', reps: rx?.reps ?? '', time: rx?.time ?? '', rpe: '' };
  if (OK_RE.test(a)) return rx ? fill(rx.sets, base) : null;

  let rpeAll = '';
  // Al final de la línea, de todas; en medio («100x6 @8 95x5»), de la de antes.
  a = a.replace(new RegExp(String.raw`\s@(${NUM})$`), (_, r) => { rpeAll = r; return ''; })
    .replace(/\s+@/g, '@');

  const toks = a.split(/[\s,;/]+/).map((w) => w.match(TOKEN_RE)).filter(Boolean)
    .map(([, n1, n2, n3, unit, rpe]) => ({
      n1: +n1, n2: n2 != null ? +n2 : null, n3: n3 != null ? +n3 : null, unit, rpe: rpe ?? '',
    }));
  if (!toks.length) return null;

  const isTime = (tk) => !!tk.unit || (rx?.time != null && tk.n2 == null);
  const secs   = (tk) => (tk.unit === "'" || tk.unit === 'min' ? tk.n1 * 60 : tk.n1);
  const one = (tk) => {
    if (isTime(tk)) return { ...base, time: secs(tk), rpe: tk.rpe };
    if (tk.n2 == null) return { ...base, weight: tk.n1, rpe: tk.rpe };
    return { ...base, weight: tk.n1, reps: tk.n2, rpe: tk.rpe };
  };

  let sets;
  const [first, second] = toks;
  if (toks.length === 1 && first.n3 != null) {
    // 4x6x100: series × reps × peso.
    sets = fill(first.n1, { ...base, reps: first.n2, weight: first.n3, rpe: first.rpe });
  } else if (toks.length <= 2 && first.n2 != null && first.n3 == null && first.n1 <= 10 && !first.unit
    && (!second || (second.n2 == null && !second.unit))) {
    // «NxR» suelto son series × reps (§6.2), con el peso detrás si lo hay. Con
    // más de 10 delante ya no son series: es un peso.
    const weight = second ? second.n1 : base.weight;
    sets = fill(first.n1, { ...base, reps: first.n2, weight, rpe: first.rpe || second?.rpe || '' });
  } else if (toks.length === 1 && rx) {
    // Un solo valor con receta: el mismo en todas sus series.
    sets = fill(rx.sets, one(first));
  } else {
    // Una lista: una serie por elemento; cada AxB es peso × reps.
    sets = toks.map(one);
  }
  return sets.map((st) => ({ ...st, rpe: st.rpe || rpeAll }));
}

/**
 * Un texto → `{ header, lines }`. `header` son los trozos de la primera línea
 * (cliente, «Sesión C», nombre) o null; cada línea es
 * `{ raw, ignored, name, rx, hint, block, answer }`, e `ignored` son títulos,
 * notas y las instrucciones.
 */
export function parseSessionText(text) {
  const rows = String(text ?? '').split(/\r?\n/)
    .map((l) => l.replace(/^\s*(?:[-•]|\d+[.)])\s+/, '').trim());
  let header = null;
  const lines = [];
  rows.forEach((raw) => {
    const clean = raw.replace(/[*_~]/g, '').trim();
    if (!clean) return;
    const colon = clean.indexOf(':');
    // La cabecera: las líneas de antes del primer ejercicio, sin dos puntos y
    // con ` · ` o sin números. Todas, no solo la primera: quien añade el nombre
    // del cliente a mano lo pone en su propia línea (QA 28-sep), y la de
    // «Sesión A» se quedaba fuera.
    if (!lines.length && colon < 0 && (clean.includes(SEP) || !/\d/.test(clean))) {
      header = [...(header ?? []), ...clean.split(SEP).map((x) => x.trim()).filter(Boolean)];
      return;
    }
    const ignored = { raw, ignored: true };
    if (HOW_TO.has(normName(clean))) { lines.push(ignored); return; }

    let left, answer;
    if (colon >= 0) {
      // El PRIMER «:», no el último: un for time se contesta «12:30».
      left = clean.slice(0, colon); answer = clean.slice(colon + 1);
    } else {
      // A mano: «sentadilla 100 100 95». El nombre acaba en el primer número.
      const m = clean.match(/^(.*?[^\d\s])\s+(\d.*)$/);
      if (!m) { lines.push(ignored); return; }
      [, left, answer] = m;
    }
    const segs  = left.split(SEP).map((x) => x.trim());
    const block = segs.some((x) => BLOCK_RE.test(x));
    const rx    = block ? null : (segs.slice(1).map(parseRx).find(Boolean) ?? null);
    const hint  = segs.slice(1).map(parseWeight).find((w) => w != null) ?? null;
    lines.push({ raw, ignored: false, name: segs[0], rx, hint, block, answer: answer.trim() });
  });
  return { header, lines };
}

/**
 * Qué ejercicio es cada nombre (§6.3): primero los de la sesión elegida, luego
 * la biblioteca y los propios, en los dos idiomas, y al final los alias que el
 * entrenador ha ido resolviendo. Sin coincidencia aproximada: equivocarse en
 * silencio es peor que preguntar una vez.
 */
export function exerciseIndex(allExercises, aliases = {}, sessionIds = []) {
  const idx = new Map();
  const put = (name, id) => { const k = normName(name); if (k && !idx.has(k)) idx.set(k, id); };
  for (const id of sessionIds) { put(allExercises[id]?.name, id); put(allExercises[id]?.nameEn, id); }
  for (const [id, def] of Object.entries(allExercises)) { put(def.name, id); put(def.nameEn, id); }
  for (const [alias, id] of Object.entries(aliases)) if (allExercises[id]) put(alias, id);
  return (name) => idx.get(normName(name)) ?? null;
}
