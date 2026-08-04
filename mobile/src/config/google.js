/**
 * Google OAuth configuration.
 *
 * ── expo-auth-session v7 (Expo SDK 51+) behaviour change ──────────────────────
 * The `useProxy` option and the Expo auth proxy (auth.expo.io) were removed.
 * `makeRedirectUri()` now returns the native app-scheme URI in standalone builds
 * and the dev-server URI (exp://127.0.0.1:8081) in Expo Go.
 *
 * ── Expo Go ────────────────────────────────────────────────────────────────────
 * Google OAuth CANNOT work in Expo Go. The redirect URI is a dynamic local URL
 * that changes each session — Google rejects it.
 * The UI shows "Solo disponible en la app instalada" instead.
 *
 * ── Standalone EAS build ───────────────────────────────────────────────────────
 * Client used : GOOGLE_CLIENT_ID (cliente de Android o de iOS según plataforma)
 * Redirect URI: com.googleusercontent.apps.{id}:/oauth2redirect  (auto-generated)
 *
 * In GCC → Android client → enable "Custom URI scheme" toggle.
 * No URI field appears — Google registers the reverse-client-ID scheme automatically.
 * That scheme is listed in app.json so Android routes the redirect back to the app.
 * The error "Custom URI scheme is not supported" appears when the toggle is OFF.
 *
 * ── Web client ────────────────────────────────────────────────────────────────
 * Kept for reference. Web clients require http(s) redirect URIs — not usable
 * with native custom schemes.
 */

// ── Client IDs ─────────────────────────────────────────────────────────────────

import { Platform } from 'react-native';

/**
 * Android OAuth client — used for all Google auth flows in standalone builds.
 * Custom URI scheme enabled in GCC with redirect URI: forma://oauth2redirect
 */
export const GOOGLE_ANDROID_CLIENT_ID =
  '75583717433-ukh9snjjdcq2mm8bls4sro3e1p5gs6h1.apps.googleusercontent.com';

/**
 * iOS OAuth client — mismo proyecto de GCC, tipo "iOS", bundle
 * com.formastudio.formafit. El cliente de Android NO sirve en iOS: Google
 * rechaza el redirect porque el esquema no coincide con su cliente.
 *
 * Al rellenarlo hay que añadir su esquema inverso al array `scheme` de app.json,
 * o iOS no sabrá devolver el redirect a la app.
 */
export const GOOGLE_IOS_CLIENT_ID =
  '75583717433-6t43iurn6akcuppfuffjob50ofup3r5k.apps.googleusercontent.com';

/** Web application client — kept for reference, not used for native auth flows. */
export const GOOGLE_WEB_CLIENT_ID =
  '75583717433-hd224i1ev6v179fuqoljmjqmpgk3dqop.apps.googleusercontent.com';

// ── Lo que consume la app ──────────────────────────────────────────────────────
// Los cuatro sitios que hacen OAuth (DriveBackupScreen, TrainerSyncModal,
// ClientCodeModal, ClientGoogleLinkModal) y el refresco de token del store
// construían el mismo redirect a mano desde el ID de Android. Ahora salen de
// aquí, así que el cambio de plataforma se hace en un único punto.

/** Cliente OAuth de la plataforma actual. */
export const GOOGLE_CLIENT_ID = Platform.select({
  ios:     GOOGLE_IOS_CLIENT_ID,
  default: GOOGLE_ANDROID_CLIENT_ID,
});

/** Redirect de esquema inverso que Google registra solo para ese cliente. */
export const GOOGLE_REDIRECT_URI =
  `com.googleusercontent.apps.${GOOGLE_CLIENT_ID.replace('.apps.googleusercontent.com', '')}:/oauth2redirect`;
