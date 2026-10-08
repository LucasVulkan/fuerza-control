/**
 * La última vez que entrenó, en corto, para la columna derecha de la lista de
 * Clientes (C08-clientes-dashboard.md §4.4): «hoy» · «ayer» · «lun» (2-6 días)
 * · «hace 9 d» · «nunca». Por días de calendario, no por horas: anoche a las
 * 23:00 es «ayer» aunque sean las 8:00.
 *
 * `t` llega del componente (este módulo no conoce i18n). `today` dice si es de
 * hoy, que se pinta más fuerte.
 */

const DAY = 86_400_000;
const startOfDay = (ms) => { const d = new Date(ms); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); };

export function lastSeenLabel(ts, { t, lang, now = Date.now() }) {
  if (ts == null) return { text: t('clients.lastNever').toLowerCase(), today: false };
  const days = Math.round((startOfDay(now) - startOfDay(ts)) / DAY);
  if (days <= 0) return { text: t('dayCard.today').toLowerCase(), today: true };
  if (days === 1) return { text: t('dayCard.yesterday').toLowerCase(), today: false };
  if (days < 7) {
    return { text: new Date(ts).toLocaleDateString(lang, { weekday: 'short' }).replace('.', ''), today: false };
  }
  return { text: t('clients.lastSeenDays', { count: days }), today: false };
}
