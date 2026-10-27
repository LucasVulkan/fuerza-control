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
 * el resto (hueco borrado, congelado…) ya trae su mensaje.
 */
export function sendFailure(err, t, fallbackKey) {
  if (isNetworkError(err)) return { msg: t('sync.offlineQueued'), type: 'neutral' };
  if (err?.code === 'SERVER') return { msg: t('sync.serverError'), type: 'error' };
  return { msg: err?.message ?? t(fallbackKey), type: 'error' };
}
