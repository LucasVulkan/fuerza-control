/**
 * useWeightUnit — centraliza la conversión kg ↔ lb.
 *
 * Los pesos se almacenan siempre en kg en el store.
 * Este hook provee funciones para convertir a la unidad
 * de display elegida por el usuario y viceversa.
 */
import { useStore } from '../store/useStore';

const KG_TO_LB = 2.2046;

export function useWeightUnit() {
  const unit = useStore((s) => s.profile.weightUnit ?? 'kg');
  const isLb = unit === 'lb';

  /** kg almacenado → valor a mostrar (número o '') */
  function toDisplay(kgVal) {
    const n = parseFloat(kgVal);
    if (isNaN(n)) return '';
    if (n === 0)  return 0;
    if (!isLb)    return n;
    return Math.round(n * KG_TO_LB * 2) / 2; // redondeo al 0.5 lb más próximo
  }

  /** valor en unidad de display → kg para guardar en el store */
  function toKg(displayVal) {
    const n = parseFloat(displayVal);
    if (isNaN(n)) return '';
    if (n === 0)  return 0;
    if (!isLb)    return n;
    return Math.round((n / KG_TO_LB) * 4) / 4; // redondeo al 0.25 kg más próximo
  }

  /** Formatea un valor almacenado en kg como string con unidad: "70kg" / "154lb" */
  function fmt(kgVal) {
    const d = toDisplay(kgVal);
    if (d === '' || d === null || d === undefined) return '';
    return `${d}${unit}`;
  }

  return {
    unit,                              // 'kg' | 'lb'
    label: unit,                       // alias legible
    isLb,
    toDisplay,
    toKg,
    fmt,
    scrollStep: isLb ? 1 : 0.5,       // paso de swipe
    inputMode:  isLb ? 'numeric' : 'decimal',
  };
}
