/**
 * appleAuth.js — Sign in with Apple.
 *
 * No sustituye a Google: convive con él. Apple obliga a ofrecer una alternativa
 * equivalente cuando la app ya usa un login social de terceros para crear la
 * cuenta principal (guía de revisión 4.8), y esta es esa alternativa.
 *
 * A diferencia de Google, aquí no hay OAuth ni navegador: el sistema abre una
 * hoja nativa y devuelve un id_token firmado por Apple que Supabase verifica
 * con `signInWithIdToken`. Por eso no hace falta ni PKCE, ni redirect, ni
 * refresh token.
 *
 * El paquete se puede importar en Android sin romper el bundle (el módulo
 * nativo no existe y `isAvailableAsync` devuelve false), pero la opción se
 * oculta fuera de iOS igualmente: es donde Apple la exige y el único sitio
 * donde el botón nativo se pinta.
 */

import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';

/**
 * Sign in with Apple existe desde iOS 13 y el mínimo de Expo SDK 54 es iOS 15.1,
 * así que la plataforma ya es la única condición: `isAvailableAsync()` siempre
 * dice que sí en los iOS donde la app puede instalarse.
 */
export const APPLE_AUTH_AVAILABLE = Platform.OS === 'ios';

/**
 * Abre la hoja nativa de Apple.
 *
 * Devuelve `{ idToken, fullName }` o `null` si el usuario cancela — cancelar no
 * es un error y no debe pintar ninguna alerta.
 */
export async function signInWithApple() {
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    // Apple manda el nombre SOLO en el primer inicio de sesión de cada usuario;
    // a partir de ahí llega null para siempre. Quien lo quiera lo guarda ahora
    // o no lo vuelve a ver (por eso se devuelve aquí en vez de descartarlo).
    const fullName = [
      credential.fullName?.givenName,
      credential.fullName?.familyName,
    ].filter(Boolean).join(' ');

    return { idToken: credential.identityToken, fullName: fullName || null };
  } catch (err) {
    if (err?.code === 'ERR_REQUEST_CANCELED') return null;
    throw err;
  }
}
