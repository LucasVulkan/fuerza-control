/**
 * Google OAuth configuration.
 *
 * One-time setup in Google Cloud Console:
 *   1. https://console.cloud.google.com/ → create / select a project
 *   2. APIs & Services → Library → enable "Google Drive API"
 *   3. APIs & Services → Credentials → "+ Create credentials" → OAuth Client ID
 *      • Application type: Web application
 *      • Name: Forma Mobile
 *      • Authorized redirect URIs — add ALL of these:
 *          https://auth.expo.io/@lucasvulkans-organization/forma   ← Expo Go (proxy)
 *          forma://                                                 ← production builds
 *   4. Copy the "Client ID" value below (looks like 123….apps.googleusercontent.com)
 */
export const GOOGLE_CLIENT_ID = '75583717433-hd224i1ev6v179fuqoljmjqmpgk3dqop.apps.googleusercontent.com';
