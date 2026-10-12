/**
 * Cifras de UNA etapa, sacadas de su plantilla: lo que pintan las tarjetas de
 * etapa y el panel de cifras del editor de programa, y el planificador.
 * Spec: `docs/specs/P14-editor-etapas.md` §5.1.
 *
 * Todo es lo PREVISTO por la plantilla, no lo hecho: las sesiones de una etapa
 * son las de una semana (P08-weeks-model.md §0.4), así que «por semana» es una
 * vuelta a sus sesiones.
 */

import { sessionStats } from './sessionStats';
import { plannedSetsByGroup } from './trainingLoad';

const stageTemplates = (stage, sessionTemplates) =>
  (stage?.days ?? []).map(({ sessionTemplateId }) => sessionTemplates?.[sessionTemplateId]);

/**
 * El tramo de semanas de cada etapa en el calendario previsto: `{ from, to }`
 * (semanas 1-based, `to` null si es sin límite). Usa las `durationWeeks`
 * previstas, no las alargadas del cliente. Después de una sin límite ya no hay
 * calendario: esas etapas dan `null` y se pinta su duración.
 */
export function stageWeekRanges(stages) {
  let start = 1;
  let open  = false;
  return (stages ?? []).map((s) => {
    if (open) return null;
    if (s.durationWeeks == null) { open = true; return { from: start, to: null }; }
    const range = { from: start, to: start + s.durationWeeks - 1 };
    start += s.durationWeeks;
    return range;
  });
}

/**
 * El volumen de una etapa: lo mismo que la tarjeta de sesión del editor dice de
 * una sesión, sumado a las de la etapa.
 */
export function stageVolume(stage, sessionTemplates, allExercises) {
  return stageTemplates(stage, sessionTemplates).reduce((acc, tpl) => {
    const st = sessionStats(tpl, allExercises);
    return { sessions: acc.sessions + 1, exercises: acc.exercises + st.exercises, sets: acc.sets + st.sets };
  }, { sessions: 0, exercises: 0, sets: 0 });
}

/**
 * El rango medio de repeticiones de los ejercicios principales (`isKey`):
 * media de los `minReps` y de los `maxReps`, redondeadas. Los de tiempo
 * (`minReps` null) no cuentan. `null` si la etapa no tiene principales.
 */
export function stageKeyReps(stage, sessionTemplates) {
  const keys = stageTemplates(stage, sessionTemplates)
    .flatMap((tpl) => tpl?.exercises ?? [])
    .filter((ex) => ex.isKey && ex.minReps != null);
  if (!keys.length) return null;
  const mean = (k) => Math.round(keys.reduce((a, ex) => a + (ex[k] ?? ex.minReps), 0) / keys.length);
  return { lo: mean('minReps'), hi: mean('maxReps') };
}

/** Minutos por sesión: la media de `sessionStats().minutes` de sus sesiones. 0 sin sesiones. */
export function stageMinutes(stage, sessionTemplates, allExercises) {
  const tpls = stageTemplates(stage, sessionTemplates);
  if (!tpls.length) return 0;
  return Math.round(tpls.reduce((a, tpl) => a + sessionStats(tpl, allExercises).minutes, 0) / tpls.length);
}

/** Series previstas por semana y grupo muscular, `[{ group, sets }]` de más a menos. */
export function stageSetsByGroup(stage, sessionTemplates, allExercises) {
  return plannedSetsByGroup(stageTemplates(stage, sessionTemplates).filter(Boolean), allExercises);
}

/**
 * Índice de la etapa de la que salió (`derivedFromStageId`, lo pone crear con
 * regla), o `null`: hecha a mano, duplicada, o su base ya no existe.
 */
export function stageBaseIdx(stages, idx) {
  const from = stages?.[idx]?.derivedFromStageId;
  if (!from) return null;
  const i = stages.findIndex((s) => s.id === from);
  return i < 0 ? null : i;
}
