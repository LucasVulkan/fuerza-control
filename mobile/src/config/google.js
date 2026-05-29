/**
 * Google OAuth configuration — two clients, each for its environment.
 *
 * ── Production / standalone APK ────────────────────────────────────────────────
 * Client type : Android (in Google Cloud Console)
 * Redirect URI: com.googleusercontent.apps.{id}:/oauth2redirect
 *               Google registers this automatically for Android clients.
 *               The reverse-client-ID scheme is listed in app.json "scheme" so
 *               the OS routes the OAuth redirect back to the app.
 * No client_secret needed (public client; PKCE is used).
 *
 * This IS supported for browser-based flows (Custom Tabs / expo-auth-session).
 * The "Error 400: invalid_request" seen previously happened because the
 * redirect URI in the request didn't match what GCC registered — not because
 * Android clients are incompatible with browser flows.
 *
 * ── Expo Go (development) ──────────────────────────────────────────────────────
 * Client type : Web application (in Google Cloud Console)
 * Redirect URI: https://auth.expo.io/@lucasvulkans-organization/forma
 *               Must be added to the Web client's "Authorized redirect URIs".
 * Reason      : Expo Go does not have access to custom URI schemes, so we route
 *               through the Expo auth proxy instead.
 */

// ── Client IDs ─────────────────────────────────────────────────────────────────

/** Used for production / standalone builds (Android OAuth client). */
export const GOOGLE_ANDROID_CLIENT_ID =
  '75583717433-ukh9snjjdcq2mm8bls4sro3e1p5gs6h1.apps.googleusercontent.com';

/** Used for Expo Go development (Web application OAuth client + Expo proxy). */
export const GOOGLE_WEB_CLIENT_ID =
  '75583717433-hd224i1ev6v179fuqoljmjqmpgk3dqop.apps.googleusercontent.com';
