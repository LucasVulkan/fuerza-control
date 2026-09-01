/**
 * adaptationDiff.js — spec onboarding-simple.md §5.2.
 *
 * `adaptArchetype` sabe qué sesiones no caben en el presupuesto (`overTime`)
 * pero no qué quitó para que cupieran. Se calcula comparando dos adaptaciones
 * de la MISMA plantilla y las MISMAS respuestas: una libre
 * (`sessionMinutes: null`, sin `compressSession`) y otra con el presupuesto
 * real, y restando.
 *
 * NO se compara contra el arquetipo escrito: eso mezclaría lo que quitan el
 * material y el nivel, que no se mueven al cambiar de 90 a 45 minutos.
 */

import { LIMITATION_GROUPS } from '../../../src/utils/archetypeAdapter';

/**
 * Compara las plantillas de sesión de dos resultados de `adaptArchetype` —
 * `free` (sessionMinutes: null) y `budgeted` (el tiempo real pedido) — y
 * devuelve, por sesión, qué se quitó para que cupiera. Las plantillas se
 * emparejan por `label` y, dentro de cada una, los ejercicios por `exerciseId`.
 *
 * @returns {Array<{ label: string, removedIds: string[], setsDelta: number }>}
 *   sólo las sesiones con recorte real — algo se quitó o bajaron las series.
 */
export function diffAdaptations(free, budgeted) {
  const budgetedByLabel = {};
  for (const tpl of Object.values(budgeted?.sessionTemplates ?? {})) {
    budgetedByLabel[tpl.label] = tpl;
  }

  const out = [];
  for (const freeTpl of Object.values(free?.sessionTemplates ?? {})) {
    const budgetedTpl = budgetedByLabel[freeTpl.label];
    if (!budgetedTpl) continue;

    const budgetedIds = new Set((budgetedTpl.exercises ?? []).map((ex) => ex.exerciseId));
    const removedIds = (freeTpl.exercises ?? [])
      .map((ex) => ex.exerciseId)
      .filter((id) => !budgetedIds.has(id));

    const sumSets = (exercises) => (exercises ?? []).reduce((n, ex) => n + (ex.sets ?? 0), 0);
    const setsDelta = sumSets(freeTpl.exercises) - sumSets(budgetedTpl.exercises);

    if (removedIds.length === 0 && setsDelta === 0) continue;
    out.push({ label: freeTpl.label, removedIds, setsDelta });
  }
  return out;
}

// ─── Lo que se enseña en el panel ────────────────────────────────────────────
// Vive aquí y no en `AdaptationPanel.jsx` porque ese fichero sólo puede
// exportar componentes: exportar una función desde ahí rompe el fast refresh
// (regla `react-refresh/only-export-components`), el mismo motivo por el que
// `equipmentPresets.js` salió de su componente en su día.

// A qué limitación corresponde el grupo del ejercicio ORIGINAL del slot — la
// misma tabla que usa el adaptador para decidir si el ejercicio se sustituye
// (no se exporta la función, sólo la tabla; el mapeo se rehace aquí).
function limitationFor(exerciseId, limitations, allEx) {
  const group = allEx[exerciseId]?.primaryGroup;
  return (limitations ?? []).find((l) => (LIMITATION_GROUPS[l] ?? []).includes(group));
}

const REASON_TAG_KEY = {
  equipment:  'onboarding.adaptationPanel.reasonMaterial',
  level:      'onboarding.adaptationPanel.reasonLevel',
  shoulder:   'onboarding.adaptationPanel.reasonShoulder',
  lower_back: 'onboarding.adaptationPanel.reasonLowerBack',
  knee:       'onboarding.adaptationPanel.reasonKnee',
};

/**
 * @param subs       `substitutions` YA deduplicadas (`dedupSubstitutions`).
 * @param unresolved huecos crudos del adaptador — se agrupan aquí.
 * @param levelCuts  `adaptArchetype(...).levelCuts` (§5.1).
 * @param timeCuts   `diffAdaptations(free, budgeted)` (§5.2).
 */
export function computeAdjustments({
  subs, unresolved, levelCuts, timeCuts, overBudget,
  limitations, sessionMinutes, allEx, language, dayColorOf, t,
}) {
  const exName = (id) => {
    const def = allEx[id];
    if (!def) return id;
    return language === 'en' ? (def.nameEn ?? def.name) : def.name;
  };
  const groupName = (g) => t(`exerciseSelector.groups.${g}`, g);

  const substituted = (subs ?? []).map((s) => {
    const limb = s.reason === 'limitation' ? limitationFor(s.slotExerciseId, limitations, allEx) : null;
    const tagKey = s.reason === 'limitation'
      ? (REASON_TAG_KEY[limb] ?? REASON_TAG_KEY.equipment)
      : (REASON_TAG_KEY[s.reason] ?? REASON_TAG_KEY.equipment);
    return {
      key:  `${s.slotExerciseId}→${s.resolvedExerciseId}`,
      from: exName(s.slotExerciseId),
      to:   exName(s.resolvedExerciseId),
      tag:  t(tagKey),
    };
  });

  // Tiempo y nivel van juntos a propósito (§8): quitan lo mismo —ejercicios y
  // series— y separarlos obliga a leer dos veces para saber qué falta.
  const removed = [];
  for (const cut of timeCuts ?? []) {
    for (const id of cut.removedIds) {
      removed.push({
        key: `time-${cut.label}-${id}`, label: cut.label, color: dayColorOf(cut.label),
        name: exName(id), tag: t('onboarding.adaptationPanel.reasonTime', { minutes: sessionMinutes }), added: false,
      });
    }
  }
  for (const cut of levelCuts ?? []) {
    for (const id of cut.removedIds) {
      removed.push({
        key: `level-${cut.label}-${id}`, label: cut.label, color: dayColorOf(cut.label),
        name: exName(id), tag: t('onboarding.adaptationPanel.reasonLevelCut'), added: false,
      });
    }
    if (cut.addedId) {
      removed.push({
        key: `added-${cut.label}-${cut.addedId}`, label: cut.label, color: dayColorOf(cut.label),
        name: exName(cut.addedId), tag: t('onboarding.adaptationPanel.reasonAdded'), added: true,
      });
    }
  }

  const gapsByGroup = {};
  for (const u of unresolved ?? []) gapsByGroup[u.primaryGroup] = (gapsByGroup[u.primaryGroup] ?? 0) + 1;
  const gaps = Object.entries(gapsByGroup).map(([group, count]) => ({
    key:  `gap-${group}`,
    text: t('onboarding.adaptationPanel.gapText', { count, group: groupName(group), defaultValue: `${count} huecos de ${groupName(group)}` }),
    tag:  t('onboarding.adaptationPanel.gapTag'),
  }));
  for (const group of overBudget ?? []) {
    gaps.push({
      key:  `budget-${group}`,
      text: t('onboarding.preview.overBudget', { group: groupName(group) }),
      tag:  null,
    });
  }

  return {
    substituted, removed, gaps,
    count: substituted.length + removed.length + gaps.length,
  };
}
