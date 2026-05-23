/**
 * driveService.js
 * Google Drive REST API helpers.
 * Tokens are managed externally (expo-secure-store via DriveBackupModal).
 * All functions receive the access token as a parameter.
 */

const DRIVE_V3    = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name';
const FOLDER_NAME  = 'Forma Backups';
const MAX_BACKUPS  = 30; // keep the 30 most recent files

// ── Folder ────────────────────────────────────────────────────────────────────

/** Returns the ID of the "Forma Backups" folder, creating it if needed. */
export async function findOrCreateFolder(token) {
  const q = encodeURIComponent(
    `name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
  );
  const res = await driveGet(`${DRIVE_V3}/files?q=${q}&fields=files(id,name)`, token);
  if (res.files?.length > 0) return res.files[0].id;

  const folder = await drivePost(`${DRIVE_V3}/files`, token, {
    name:     FOLDER_NAME,
    mimeType: 'application/vnd.google-apps.folder',
  });
  return folder.id;
}

// ── Upload ────────────────────────────────────────────────────────────────────

/** Uploads a JSON string as a file inside the given folder. Returns the file object. */
export async function uploadBackup(token, folderId, fileName, jsonContent) {
  const boundary = 'fc_backup_bound';
  const body = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify({ name: fileName, parents: [folderId], mimeType: 'application/json' }),
    `--${boundary}`,
    'Content-Type: application/json',
    '',
    jsonContent,
    `--${boundary}--`,
  ].join('\r\n');

  const res = await fetch(DRIVE_UPLOAD, {
    method:  'POST',
    headers: {
      Authorization:  `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body,
  });
  if (!res.ok) throw new Error(`Upload error ${res.status}`);
  return res.json();
}

// ── List / Delete ─────────────────────────────────────────────────────────────

/** Lists all backup files in the folder, newest first. */
export async function listBackups(token, folderId) {
  const q = encodeURIComponent(`'${folderId}' in parents and trashed=false`);
  const res = await driveGet(
    `${DRIVE_V3}/files?q=${q}&orderBy=createdTime+desc&fields=files(id,name,createdTime,size)`,
    token,
  );
  return res.files ?? [];
}

/** Deletes a single file by ID. */
export async function deleteFile(token, fileId) {
  await fetch(`${DRIVE_V3}/files/${fileId}`, {
    method:  'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}

/** Deletes ALL files in the backup folder. */
export async function deleteAllBackups(token, folderId) {
  const files = await listBackups(token, folderId);
  await Promise.all(files.map((f) => deleteFile(token, f.id)));
}

/** Removes backups older than MAX_BACKUPS, keeping the newest ones. */
export async function pruneOldBackups(token, folderId) {
  const files = await listBackups(token, folderId);
  if (files.length <= MAX_BACKUPS) return;
  const toDelete = files.slice(MAX_BACKUPS);
  await Promise.all(toDelete.map((f) => deleteFile(token, f.id)));
}

// ── Token exchange (code → tokens) ───────────────────────────────────────────

/**
 * Exchanges an authorization code for access + refresh tokens.
 * Uses PKCE so no client_secret is required.
 */
export async function exchangeCodeForTokens({ code, codeVerifier, redirectUri, clientId }) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    new URLSearchParams({
      code,
      code_verifier:  codeVerifier,
      redirect_uri:   redirectUri,
      client_id:      clientId,
      grant_type:     'authorization_code',
    }).toString(),
  });
  if (!res.ok) throw new Error(`Token exchange error ${res.status}`);
  return res.json(); // { access_token, refresh_token, expires_in, ... }
}

/**
 * Refreshes the access token using the stored refresh token.
 * Only works if clientId is a native (Android/iOS) type — not web client.
 * For web clients this will fail; user needs to re-authenticate.
 */
export async function refreshAccessToken(refreshToken, clientId) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    new URLSearchParams({
      refresh_token: refreshToken,
      client_id:     clientId,
      grant_type:    'refresh_token',
    }).toString(),
  });
  if (!res.ok) throw new Error(`Refresh error ${res.status}`);
  return res.json(); // { access_token, expires_in, ... }
}

/** Fetches the user's email from Google's userinfo endpoint. */
export async function getUserEmail(token) {
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Could not fetch user info');
  const data = await res.json();
  return data.email ?? data.sub;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

async function driveGet(url, token) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Drive GET error ${res.status}`);
  return res.json();
}

async function drivePost(url, token, body) {
  const res = await fetch(url, {
    method:  'POST',
    headers: {
      Authorization:  `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Drive POST error ${res.status}`);
  return res.json();
}
