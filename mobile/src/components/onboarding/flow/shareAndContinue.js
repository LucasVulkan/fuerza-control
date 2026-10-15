/**
 * shareAndContinue — compartir un mensaje y, si se compartió, seguir (O03 §9.1, §7.8).
 *
 * `Share.share`: con `sharedAction` llama a `onShared`; con `dismissedAction`
 * (solo iOS, cerrar la hoja sin compartir) no hace nada y la pantalla se queda.
 * En Android el resultado siempre llega como «compartido», así que avanza igual:
 * lo pendiente sigue en «Listo». Lo usan «pedir el código» (O03-05) e invitar
 * (O03-08).
 */
import { Share } from 'react-native';

export async function shareAndContinue(message, onShared) {
  try {
    const result = await Share.share({ message });
    if (result.action === Share.sharedAction) onShared();
  } catch {
    // La hoja no se pudo abrir: la pantalla se queda, como si se hubiera cerrado.
  }
}
