// U15-01 · Red o servidor. Sin respuesta (fetch roto) = sin conexión; una
// respuesta con error = servidor. `syncError` ya marca `code: 'NETWORK'`, pero
// los fallos de auth y de fetch crudo traen solo el mensaje.
export const NETWORK_RE = /Failed to fetch|Network request failed|fetch failed|NetworkError/i;

export function isNetworkError(err) {
  return err?.code === 'NETWORK' || NETWORK_RE.test(err?.message ?? '');
}

/**
 * Texto y tipo de toast para un envío que falló. Red → "se enviará al volver";
 * respuesta con error del servidor (`code: 'SERVER'`) → "lo reintentamos solos";
 * solo los errores propios, ya traducidos (OWN_CODES), enseñan su mensaje; el
 * resto, el texto de `fallbackKey`: nunca `err.message` crudo en pantalla (U15-02).
 */
const OWN_CODES = new Set(['SLOT_GONE', 'TRAINER_LOGIN_NEEDED', 'NO_TRAINER_ACCOUNT', 'FROZEN']);

export function sendFailure(err, t, fallbackKey) {
  if (isNetworkError(err)) return { msg: t('sync.offlineQueued'), type: 'neutral' };
  if (err?.code === 'SERVER') return { msg: t('sync.serverError'), type: 'error' };
  if (OWN_CODES.has(err?.code)) return { msg: err.message, type: 'error' };
  console.warn('[send]', err?.code, err?.message);
  return { msg: t(fallbackKey), type: 'error' };
}
