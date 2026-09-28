import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

const DAY_MS = 86400000;

/**
 * Hoy y los 6 anteriores, a la hora de montar (la que lleva la entrada): los
 * días que se pueden elegir al apuntar un entreno pasado (trainer-logging.md
 * §3.2 y §6.4).
 */
export function useLastDays() {
  const { t, i18n } = useTranslation();
  const [now] = useState(() => Date.now());
  return useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now - i * DAY_MS);
    return {
      top: i === 0
        ? t('dayCard.today')
        : d.toLocaleDateString(i18n.language, { weekday: 'short' }).replace('.', ''),
      num: d.getDate(),
      ts:  d.getTime(),
    };
  }), [now, t, i18n.language]);
}
