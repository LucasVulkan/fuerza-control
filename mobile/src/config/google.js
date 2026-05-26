/**
 * Google OAuth configuration.
 *
 * TWO clients are needed:
 *
 * 1. WEB CLIENT  (dev / Expo Go)
 *    Type: Web application in Google Cloud Console
 *    Authorized redirect URIs:
 *      https://auth.expo.io/@lucasvulkans-organization/forma   ← Expo proxy
 *    Used when: __DEV__ === true (routes through auth.expo.io proxy)
 *
 * 2. ANDROID CLIENT  (production APK)
 *    Type: Android in Google Cloud Console
 *    SHA-1 fingerprint: the production keystore SHA-1 (already added ✓)
 *    Package name: com.lucasgomez.fuerzacontrol
 *    No redirect URI registration needed — Google verifies via SHA-1 + package name.
 *    Redirect URI used by the app: com.googleusercontent.apps.<id>:/oauth2redirect
 *    Used when: __DEV__ === false (production / preview EAS builds)
 */

// ── Client IDs ─────────────────────────────────────────────────────────────────

export const GOOGLE_WEB_CLIENT_ID =
  '75583717433-hd224i1ev6v179fuqoljmjqmpgk3dqop.apps.googleusercontent.com';

export const GOOGLE_ANDROID_CLIENT_ID =
  '75583717433-ukh9snjjdcq2mm8bls4sro3e1p5gs6h1.apps.googleusercontent.com';

/**
 * The redirect URI for the Android client.
 * Format: com.googleusercontent.apps.<clientId>:/oauth2redirect
 * This reverse-DNS scheme must also be listed in app.json > scheme.
 */
export const ANDROID_REDIRECT_URI =
  'com.googleusercontent.apps.75583717433-ukh9snjjdcq2mm8bls4sro3e1p5gs6h1:/oauth2redirect';

/**
 * Active client for the current build environment.
 * Import this wherever a single client ID is needed (e.g. token refresh in the store).
 */
export const GOOGLE_CLIENT_ID = __DEV__ ? GOOGLE_WEB_CLIENT_ID : GOOGLE_ANDROID_CLIENT_ID;
