/**
 * Los textos de las filas de sesión (Inicio y la ficha de un cliente sin app):
 * cuándo fue, cuánto lleva abierta y qué dice su botón. Fuera del componente
 * porque un fichero de componentes solo exporta componentes (fast refresh).
 */
import { formatDate } from './formatters';

function daysSince(ts) {
  if (!ts) return null;
  return Math.floor((Date.now() - ts) / 86400000);
}

export function relativeTime(ts, t) {
  const days = daysSince(ts);
  if (days === null) return null;
  if (days === 0)  return t('dayCard.today');
  if (days === 1)  return t('dayCard.yesterday');
  if (days < 7)   return t('dayCard.daysAgo', { count: days });
  if (days < 14)  return t('dayCard.oneWeekAgo');
  if (days < 30)  return t('dayCard.weeksAgo', { count: Math.floor(days / 7) });
  return formatDate(ts);
}

/**
 * El texto del botón dice A DÓNDE LLEVA, con el nombre de la sesión dentro.
 * Sin letra (una plantilla sin `label`) cae a la forma corta: la interfaz no
 * promete lo que no tiene.
 */
export function startCta(t, label, { active, done }) {
  if (active) return label ? t('home.btnContinueSession', { label }) : t('home.btnContinue');
  if (done)   return label ? t('home.btnRepeatSession',   { label }) : t('home.btnRepeat');
  return label ? t('home.btnStartSession', { label }) : t('home.btnStart');
}
