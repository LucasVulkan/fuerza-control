/**
 * "hoy 9:41" / "ayer 21:03" / "14 jul 9:41" / "14 jul 2025 9:41".
 *
 * En una app offline el dato que tranquiliza no es "backup activo" sino CUÁNDO
 * pasó algo por última vez, así que esta cadena aparece en el menú (última copia
 * de Drive), en la pantalla de Drive y en la de entrenador (último envío).
 *
 * Las etiquetas de hoy/ayer llegan traducidas desde el componente (`dayCard.today`
 * / `dayCard.yesterday`) para no meter i18n en un util puro; se pasan a
 * minúsculas porque aquí van dentro de la frase, no al principio.
 */

const MONTHS_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

export function formatWhen(value, lang, todayLabel, yesterdayLabel, now = new Date()) {
  if (value == null) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;

  const h    = d.getHours();
  const m    = String(d.getMinutes()).padStart(2, '0');
  const time = lang === 'en' ? `${h % 12 || 12}:${m} ${h >= 12 ? 'PM' : 'AM'}` : `${h}:${m}`;

  const days = Math.round((startOfDay(now) - startOfDay(d)) / 86_400_000);
  if (days === 0) return `${(todayLabel ?? 'hoy').toLowerCase()} ${time}`;
  if (days === 1) return `${(yesterdayLabel ?? 'ayer').toLowerCase()} ${time}`;

  const months = lang === 'en' ? MONTHS_EN : MONTHS_ES;
  const year   = d.getFullYear() !== now.getFullYear() ? ` ${d.getFullYear()}` : '';
  const day    = lang === 'en'
    ? `${months[d.getMonth()]} ${d.getDate()}${year}`
    : `${d.getDate()} ${months[d.getMonth()]}${year}`;
  return `${day} ${time}`;
}
