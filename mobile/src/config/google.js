/**
 * Google OAuth configuration.
 *
 * We use a single WEB CLIENT for all environments (Expo Go, preview APK, production).
 *
 * Why not the Android client?
 *   Android-type OAuth clients in Google Cloud Console are designed for the
 *   native Google Sign-In SDK. Using them in a browser-based flow (Custom Tabs /
 *   expo-auth-session) returns "Error 400: invalid_request" from Google.
 *
 * WEB CLIENT setup in Google Cloud Console:
 *   Type: Web application
 *   Authorized redirect URIs:
 *     https://auth.expo.io/@lucasvulkans-organization/forma   ← Expo proxy
 *   The proxy handles both Expo Go (exp://) and native builds (forma://).
 *
 * The Android client below is kept for reference but is no longer used.
 */

// ── Client IDs ─────────────────────────────────────────────────────────────────

export const GOOGLE_WEB_CLIENT_ID =
  '75583717433-hd224i1ev6v179fuqoljmjqmpgk3dqop.apps.googleusercontent.com';

// Kept for reference — not used (Android clients block browser-based OAuth).
export const GOOGLE_ANDROID_CLIENT_ID =
  '75583717433-ukh9snjjdcq2mm8bls4sro3e1p5gs6h1.apps.googleusercontent.com';

/**
 * Active client used everywhere (auth flow + token refresh).
 * Always the web client — works in all build environments via the Expo proxy.
 */
export const GOOGLE_CLIENT_ID = GOOGLE_WEB_CLIENT_ID;
