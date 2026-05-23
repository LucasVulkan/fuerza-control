import { useStore } from '../../store/useStore';

const KG_TO_LB = 2.2046;

export function useWeightUnit() {
  const unit = useStore((s) => s.profile.weightUnit ?? 'kg');
  const isLb = unit === 'lb';

  function toDisplay(kgVal) {
    const n = parseFloat(kgVal);
    if (isNaN(n)) return '';
    if (n === 0) return 0;
    if (!isLb) return n;
    return Math.round(n * KG_TO_LB * 2) / 2;
  }

  function toKg(displayVal) {
    const n = parseFloat(displayVal);
    if (isNaN(n)) return '';
    if (n === 0) return 0;
    if (!isLb) return n;
    return Math.round((n / KG_TO_LB) * 4) / 4;
  }

  function fmt(kgVal) {
    const d = toDisplay(kgVal);
    if (d === '' || d === null || d === undefined) return '';
    return `${d}${unit}`;
  }

  const scrollStep = isLb ? 1 : 0.5; // paso de swipe (igual que web original)

  return { unit, label: unit, isLb, toDisplay, toKg, fmt, scrollStep };
}
