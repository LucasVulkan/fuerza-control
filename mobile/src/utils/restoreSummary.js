/**
 * Lo que se dice al acabar de restaurar una copia (C10-06), en un solo sitio: lo usan Drive, el archivo
 * abierto, el menú de la cabecera y la recuperación del onboarding.
 */

/**
 * @param {Function} t        i18n
 * @param {object}   result   lo que devuelve `restoreBackup`: `{ added, kept, account }`
 * @param {string}   fallback el texto de siempre
 */
export function restoredMessage(t, result, fallback) {
  const { added = 0, kept = 0, account = false } = result ?? {};
  if (!account || (!added && !kept)) return fallback;
  const first = added ? t('import.restoredAdded', { count: added }) : t('import.restoredNoneAdded');
  return kept ? `${first}; ${t('import.restoredKept', { count: kept })}` : first;
}

/** El mensaje de un restaurar que falló: los códigos propios enseñan el suyo y el resto, un texto de pantalla (N-14). */
export function restoreErrorMessage(t, err) {
  return err?.code === 'CLIENTS_NEED_NETWORK' || err?.code === 'TRAINER_LOGIN_NEEDED' ? err.message : t('import.restoreFailed');
}
