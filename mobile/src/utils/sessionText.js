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
 */
export function sessionToText(template, allExercises, t, {
  language, fmtWeight = (kg) => `${kg}kg`, lastExercise,
} = {}) {
  const title = [
    template.label ? t('workout.sessionLabel', { label: template.label }) : null,
    template.name || null,
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
