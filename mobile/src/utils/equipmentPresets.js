/**
 * Presets de material del onboarding simple (spec §6.3). Vive fuera de
 * `AnswerChips.jsx` porque ese fichero sólo puede exportar el componente:
 * exportar una constante desde ahí rompe el fast refresh (regla
 * `react-refresh/only-export-components`).
 */

// Nueve casillas con descripción eran la pregunta más cara del flujo. Pasan a
// tres tarjetas; "Personalizar" sigue dando acceso a las nueve.
export const EQUIP_PRESETS = {
  gym:        ['machines', 'dumbbells', 'barbell', 'pullup_bar', 'parallettes', 'kettlebell', 'resistance_band', 'ab_wheel'],
  home:       ['dumbbells', 'resistance_band', 'pullup_bar', 'ab_wheel'],
  bodyweight: ['bodyweight'],
};

export const EQUIP_PRESET_IDS = ['gym', 'home', 'bodyweight'];

/** Compara conjuntos, no arrays: el orden de `equipment` no importa. */
export function presetOf(equipment) {
  const set = new Set(equipment ?? []);
  for (const key of EQUIP_PRESET_IDS) {
    const list = EQUIP_PRESETS[key];
    if (list.length === set.size && list.every((id) => set.has(id))) return key;
  }
  return 'custom';
}
