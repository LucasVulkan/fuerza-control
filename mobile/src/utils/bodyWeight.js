// Peso corporal escrito a mano en el menú (progresion-clara §9.3). `toKg` es el
// de `useWeightUnit`: el texto viene en la unidad del usuario. Devuelve kg con un
// decimal (como el recap) o null si no vale — vacío, no numérico o fuera de
// 20-500 kg —, y entonces el campo vuelve al valor anterior.
export const BODY_WEIGHT_MIN = 20;
export const BODY_WEIGHT_MAX = 500;

export function parseBodyWeight(text, toKg) {
  const s = String(text ?? '').trim().replace(',', '.');
  if (!s) return null;
  const kg = toKg(Number(s));
  if (!Number.isFinite(kg) || kg < BODY_WEIGHT_MIN || kg > BODY_WEIGHT_MAX) return null;
  return Math.round(kg * 10) / 10;
}
