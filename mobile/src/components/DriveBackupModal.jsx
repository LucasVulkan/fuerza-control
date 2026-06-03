/**
 * DriveBackupModal.jsx
 * Google Drive backup control panel.
 *
 * • Connect / disconnect Google account (OAuth 2.0 + PKCE via expo-auth-session)
 * • Choose backup frequency: per session / daily / weekly / monthly
 * • Trigger a manual backup right now
 * • List or delete all backups stored in Drive
 *
 * Redirect URI notes
 * ──────────────────
 * The redirect URI passed to Google must exactly match what's registered in
 * Google Cloud Console.  makeRedirectUri({ scheme: 'forma' }) returns:
 *   • Expo Go dev server  →  exp://192.168.x.x:8081  (changes every session!)
 *   • Production build    →  forma://
 *
 * Easiest path for Expo Go testing: switch to the Expo proxy:
 *   const redirectUri = AuthSession.makeRedirectUri({ useProxy: true });
 * and register  https://auth.expo.io/@lucasvulkans-organization/forma  in GCC.
 * For production, keep scheme-based redirect and register  forma://  in GCC.
 */

import { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, Modal, StyleSheet,
  Alert, ActivityIndicator, ScrollView,
} from 'react-native';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser  from 'expo-web-browser';
import * as SecureStore  from 'expo-secure-store';
import Constants         from 'expo-constants';

import { useStore }                                       from '../../store/useStore';
import { exchangeCodeForTokens, getUserEmail, listBackups, downloadBackup, findOrCreateFolder } from '../services/driveService';
import { GOOGLE_ANDROID_CLIENT_ID } from '../config/google';
import { colors, spacing, typography, borders, radius }   from '../theme';

// Required so the in-app browser can redirect back after OAuth
WebBrowser.maybeCompleteAuthSession();

// ── Constants ─────────────────────────────────────────────────────────────────

const DISCOVERY = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint:         'https://oauth2.googleapis.com/token',
};

const SCOPES = ['openid', 'email', 'https://www.googleapis.com/auth/drive.file'];

const FREQ_OPTIONS = [
  { key: 'session', label: 'Por sesión' },
  { key: 'daily',   label: 'Diario'     },
  { key: 'weekly',  label: 'Semanal'    },
  { key: 'monthly', label: 'Mensual'    },
];

// ── DriveBackupModal ──────────────────────────────────────────────────────────

export default function DriveBackupModal({ onClose }) {
  const driveBackup        = useStore((s) => s.driveBackup);
  const connectDrive       = useStore((s) => s.connectDrive);
  const disconnectDrive    = useStore((s) => s.disconnectDrive);
  const setDriveFrequency  = useStore((s) => s.setDriveFrequency);
  const performDriveBackup = useStore((s) => s.performDriveBackup);
  const deleteDriveBackups = useStore((s) => s.deleteDriveBackups);
  const importData         = useStore((s) => s.importData);
  const showToast          = useStore((s) => s.showToast);

  const [loading, setLoading]     = useState(false);
  const [loadingMsg, setMsg]      = useState('');
  const [files, setFiles]         = useState(null); // null = not loaded yet
  const [showFiles, setShowFiles] = useState(false);

  // ── OAuth setup ─────────────────────────────────────────────────────────────
  //
  // expo-auth-session v7 removed the Expo auth proxy (useProxy is gone).
  //
  //   Expo Go       → makeRedirectUri() always returns exp://127.0.0.1:8081
  //                   Google rejects this — OAuth is disabled in Expo Go.
  //
  //   Standalone    → makeRedirectUri({ native }) returns forma://oauth2redirect
  //                   Registered in GCC as a Desktop app client redirect URI.
  //                   See src/config/google.js for setup steps.

  const isExpoGo   = Constants.executionEnvironment === 'storeClient';
  const clientId   = GOOGLE_ANDROID_CLIENT_ID;
  // The Android client's auto-registered custom URI scheme (reverse-client-ID).
  // Enabled via the "Custom URI scheme" toggle in GCC → Android client settings.
  // The scheme is listed in app.json so the OS routes the redirect back to the app.
  const androidRedirectUri = `com.googleusercontent.apps.${GOOGLE_ANDROID_CLIENT_ID.replace('.apps.googleusercontent.com', '')}:/oauth2redirect`;
  const redirectUri = AuthSession.makeRedirectUri({ native: androidRedirectUri });

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId,
      scopes:       SCOPES,
      responseType: AuthSession.ResponseType.Code,
      usePKCE:      true,
      redirectUri,
      extraParams:  { access_type: 'offline', prompt: 'consent' },
    },
    DISCOVERY,
  );

  // Keep a stable ref so the async OAuth callback can read codeVerifier
  const requestRef = useRef(request);
  useEffect(() => { if (request) requestRef.current = request; }, [request]);

  // Handle the browser redirect back into the app
  useEffect(() => {
    if (response?.type !== 'success') return;
    (async () => {
      setLoading(true);
      setMsg('Conectando con Google…');
      try {
        const tokens = await exchangeCodeForTokens({
          code:         response.params.code,
          codeVerifier: requestRef.current?.codeVerifier,
          redirectUri,
          clientId,
        });
        const email = await getUserEmail(tokens.access_token);
        await connectDrive(email, tokens.access_token, tokens.refresh_token ?? null);
        showToast('✓ Google Drive conectado');
      } catch (err) {
        Alert.alert('Error al conectar', err?.message ?? 'No se pudo conectar con Google Drive.');
      } finally {
        setLoading(false);
        setMsg('');
      }
    })();
  }, [response]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handlers ────────────────────────────────────────────────────────────────

  async function handleBackupNow() {
    setLoading(true);
    setMsg('Haciendo backup…');
    try {
      const result = await performDriveBackup();
      if (result.ok) {
        showToast('✓ ' + result.fileName);
      } else if (result.error === 'Token expirado') {
        Alert.alert('Sesión expirada', 'Vuelve a conectar tu cuenta de Google para continuar.');
      } else {
        Alert.alert('Error', result.error ?? 'No se pudo completar el backup.');
      }
    } catch (err) {
      Alert.alert('Error', err?.message ?? 'Fallo inesperado al hacer backup.');
    } finally {
      setLoading(false);
      setMsg('');
    }
  }

  async function handleToggleFiles() {
    if (showFiles) { setShowFiles(false); return; }
    setLoading(true);
    setMsg('Cargando lista…');
    try {
      const token = await SecureStore.getItemAsync('drive_access_token');
      if (token) {
        const folderId = driveBackup.folderId ?? (await findOrCreateFolder(token).catch(() => null));
        setFiles(folderId ? await listBackups(token, folderId) : []);
      } else {
        setFiles([]);
      }
      setShowFiles(true);
    } catch {
      setFiles([]);
      setShowFiles(true);
    } finally {
      setLoading(false);
      setMsg('');
    }
  }

  function handleRestoreFile(file) {
    Alert.alert(
      'Restaurar backup',
      `¿Restaurar "${file.name}"?\n\nTus datos actuales se reemplazarán con los de este backup.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Restaurar', style: 'destructive',
          onPress: async () => {
            setLoading(true);
            setMsg('Descargando backup…');
            try {
              const token = await SecureStore.getItemAsync('drive_access_token');
              const data  = await downloadBackup(token, file.id);
              importData(data, { program: true, log: true, settings: true });
              showToast('✓ Backup restaurado');
              onClose();
            } catch (err) {
              Alert.alert('Error', err?.message ?? 'No se pudo restaurar el backup.');
            } finally {
              setLoading(false);
              setMsg('');
            }
          },
        },
      ],
    );
  }

  function handleDeleteAll() {
    Alert.alert(
      'Eliminar todos los backups',
      '¿Seguro? Los archivos se eliminarán de Google Drive. Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar todo', style: 'destructive',
          onPress: async () => {
            setLoading(true);
            setMsg('Eliminando…');
            try {
              await deleteDriveBackups();
              setFiles([]);
              setShowFiles(false);
              showToast('✓ Backups eliminados');
            } catch {
              Alert.alert('Error', 'No se pudieron eliminar los backups.');
            } finally {
              setLoading(false);
              setMsg('');
            }
          },
        },
      ],
    );
  }

  function handleDisconnect() {
    Alert.alert(
      'Desconectar Google Drive',
      '¿Desconectar tu cuenta? Los backups existentes en Drive no se eliminarán.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desconectar', style: 'destructive',
          onPress: async () => {
            await disconnectDrive();
            showToast('Cuenta desconectada');
          },
        },
      ],
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  const isConnected = driveBackup.enabled;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      {/* Tap-to-close backdrop (sits behind card via absoluteFill) */}
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

      {/* Centered card */}
      <View style={styles.outer}>
        <View style={styles.card}>
          {/* ── Header ── */}
          <View style={styles.headerRow}>
            <Text style={styles.title}>DRIVE BACKUP</Text>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <Text style={styles.closeX}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
            {/* ── Status card ── */}
            <View style={styles.statusCard}>
              <View style={styles.statusRow}>
                <View style={[styles.dot, isConnected ? styles.dotGreen : styles.dotGray]} />
                <Text style={styles.statusText}>
                  {isConnected ? 'Conectado' : 'No conectado'}
                </Text>
              </View>
              {isConnected && driveBackup.email ? (
                <Text style={styles.emailText}>{driveBackup.email}</Text>
              ) : null}
              {isConnected && driveBackup.lastBackup ? (
                <Text style={styles.lastBackupText}>
                  Último backup: {new Date(driveBackup.lastBackup).toLocaleDateString('es-ES')}
                </Text>
              ) : null}
              {isConnected && driveBackup.needsReconnect ? (
                <Text style={styles.warningText}>⚠️ Sesión expirada — vuelve a conectar</Text>
              ) : null}
            </View>

            {isConnected ? (
              <>
                {/* ── Frequency ── */}
                <Text style={styles.sectionLabel}>FRECUENCIA</Text>
                <View style={styles.freqGrid}>
                  {FREQ_OPTIONS.map(({ key, label }) => (
                    <TouchableOpacity
                      key={key}
                      style={[styles.freqBtn, driveBackup.frequency === key && styles.freqBtnActive]}
                      onPress={() => !loading && setDriveFrequency(key)}
                      activeOpacity={0.75}
                    >
                      <Text style={[styles.freqTxt, driveBackup.frequency === key && styles.freqTxtActive]}>
                        {label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* ── Actions ── */}
                <Text style={styles.sectionLabel}>ACCIONES</Text>

                <DriveBtn label="Hacer backup ahora"  onPress={handleBackupNow}    disabled={loading} />
                <DriveBtn
                  label={showFiles ? 'Ocultar archivos' : 'Ver backups en Drive'}
                  onPress={handleToggleFiles}
                  disabled={loading}
                />

                {showFiles ? (
                  <View style={styles.fileList}>
                    {!files || files.length === 0 ? (
                      <Text style={styles.emptyTxt}>No hay backups guardados</Text>
                    ) : (
                      files.map((f) => (
                        <TouchableOpacity
                          key={f.id}
                          style={styles.fileRow}
                          onPress={() => handleRestoreFile(f)}
                          activeOpacity={0.7}
                          disabled={loading}
                        >
                          <Text style={styles.fileName} numberOfLines={1}>{f.name}</Text>
                          <Text style={styles.fileDate}>
                            {f.createdTime
                              ? new Date(f.createdTime).toLocaleDateString('es-ES')
                              : ''}
                          </Text>
                        </TouchableOpacity>
                      ))
                    )}
                  </View>
                ) : null}

                <DriveBtn label="Eliminar todos los backups" onPress={handleDeleteAll} disabled={loading} danger />

                <View style={styles.separator} />

                <DriveBtn label="Desconectar cuenta de Google" onPress={handleDisconnect} disabled={loading} ghost />
              </>
            ) : (
              <>
                {/* ── Not connected ── */}
                <Text style={styles.explainTxt}>
                  Guarda copias de seguridad automáticas de todos tus datos en tu Google Drive personal.
                  Los archivos se guardan en una carpeta llamada "Forma Backups".
                </Text>
                {isExpoGo ? (
                  <View style={styles.expoGoNote}>
                    <Text style={styles.expoGoNoteText}>
                      La conexión con Google no está disponible en Expo Go.{'\n'}
                      Usa la app instalada (build EAS).
                    </Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[styles.connectBtn, (!request || loading) && { opacity: 0.5 }]}
                    onPress={() => promptAsync()}
                    disabled={!request || loading}
                    activeOpacity={0.85}
                  >
                    {loading
                      ? <ActivityIndicator size="small" color={colors.bg} />
                      : <Text style={styles.connectTxt}>Conectar con Google</Text>
                    }
                  </TouchableOpacity>
                )}
              </>
            )}

            {/* Global loading feedback */}
            {loading && loadingMsg ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color={colors.muted} />
                <Text style={styles.loadingTxt}>{loadingMsg}</Text>
              </View>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ── DriveBtn ──────────────────────────────────────────────────────────────────

function DriveBtn({ label, onPress, disabled, danger, ghost }) {
  return (
    <TouchableOpacity
      style={[
        styles.actionBtn,
        danger && styles.actionDanger,
        ghost  && styles.actionGhost,
        disabled && { opacity: 0.5 },
      ]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
    >
      <Text style={[styles.actionTxt, danger && styles.dangerTxt, ghost && styles.ghostTxt]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  outer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent:    'center',
    paddingHorizontal: spacing.xl,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius:    radius.lg,
    borderWidth:     borders.thin,
    borderColor:     colors.borderCard,
    padding:         spacing.xl,
    maxHeight:       '85%',
  },
  headerRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    marginBottom:   spacing.md,
  },
  title: {
    fontSize:      typography.sm,
    fontWeight:    typography.heavy,
    color:         colors.muted,
    letterSpacing: 2,
  },
  closeX: {
    fontSize: typography.base,
    color:    colors.muted,
  },

  // Status card
  statusCard: {
    backgroundColor: colors.surface2,
    borderRadius:    radius.sm,
    borderWidth:     borders.thin,
    borderColor:     colors.border,
    padding:         spacing.md,
    marginBottom:    spacing.md,
    gap:             4,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.xs,
  },
  dot: {
    width: 8, height: 8, borderRadius: 4,
  },
  dotGreen: { backgroundColor: colors.green },
  dotGray:  { backgroundColor: colors.muted },
  statusText: {
    fontSize:   typography.base,
    fontWeight: typography.medium,
    color:      colors.text,
  },
  emailText: {
    fontSize:  typography.sm,
    color:     colors.muted,
    marginTop: 2,
  },
  lastBackupText: {
    fontSize: typography.xs,
    color:    colors.muted,
  },
  warningText: {
    fontSize:  typography.xs,
    color:     colors.red,
    marginTop: 4,
  },

  // Section label
  sectionLabel: {
    fontSize:      typography.xs,
    fontWeight:    typography.bold,
    color:         colors.muted,
    letterSpacing: 1.5,
    marginTop:     spacing.md,
    marginBottom:  spacing.xs,
  },

  // Frequency grid
  freqGrid: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           spacing.xs,
    marginBottom:  spacing.sm,
  },
  freqBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical:   spacing.xs + 2,
    borderRadius:      radius.sm,
    borderWidth:       borders.thin,
    borderColor:       colors.border,
    backgroundColor:   colors.surface2,
  },
  freqBtnActive: {
    borderColor:     colors.accent,
    backgroundColor: `${colors.accent}18`,
  },
  freqTxt: {
    fontSize: typography.sm,
    color:    colors.muted,
  },
  freqTxtActive: {
    color:      colors.accent,
    fontWeight: typography.medium,
  },

  // Action buttons (list-item style)
  actionBtn: {
    paddingVertical:   spacing.sm + 2,
    borderBottomWidth: borders.thin,
    borderBottomColor: colors.border,
  },
  actionDanger: {
    borderBottomColor: `${colors.red}30`,
  },
  actionGhost: {
    borderBottomWidth: 0,
    marginTop:         spacing.xs,
  },
  actionTxt: {
    fontSize: typography.base,
    color:    colors.text,
  },
  dangerTxt: { color: colors.red },
  ghostTxt:  { color: colors.muted },

  // File list
  fileList: {
    backgroundColor: colors.surface2,
    borderRadius:    radius.sm,
    borderWidth:     borders.thin,
    borderColor:     colors.border,
    padding:         spacing.sm,
    marginBottom:    spacing.sm,
  },
  emptyTxt: {
    fontSize:        typography.sm,
    color:           colors.muted,
    textAlign:       'center',
    paddingVertical: spacing.sm,
  },
  fileRow: {
    flexDirection:     'row',
    justifyContent:    'space-between',
    alignItems:        'center',
    paddingVertical:   spacing.xs + 2,
    borderBottomWidth: borders.thin,
    borderBottomColor: colors.border,
  },
  fileName: {
    flex:        1,
    fontSize:    typography.sm,
    color:       colors.text,
    marginRight: spacing.sm,
  },
  fileDate: {
    fontSize: typography.xs,
    color:    colors.muted,
  },

  separator: {
    height:          borders.thin,
    backgroundColor: colors.border,
    marginVertical:  spacing.sm,
  },

  // Connect (not-connected state)
  explainTxt: {
    fontSize:     typography.sm,
    color:        colors.muted,
    lineHeight:   typography.sm * 1.6,
    marginBottom: spacing.lg,
    marginTop:    spacing.sm,
  },
  connectBtn: {
    backgroundColor: colors.accent,
    borderRadius:    radius.sm,
    paddingVertical: spacing.md,
    alignItems:      'center',
    marginBottom:    spacing.sm,
  },
  connectTxt: {
    fontSize:   typography.base,
    fontWeight: typography.bold,
    color:      colors.bg,
  },
  expoGoNote: {
    backgroundColor: `${colors.muted}18`,
    borderWidth:     1,
    borderColor:     `${colors.muted}30`,
    borderRadius:    radius.sm,
    padding:         spacing.md,
    marginBottom:    spacing.sm,
  },
  expoGoNoteText: {
    fontSize:   typography.sm,
    color:      colors.muted,
    lineHeight: typography.sm * 1.5,
    textAlign:  'center',
  },

  // Loading row
  loadingRow: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             spacing.xs,
    paddingVertical: spacing.sm,
  },
  loadingTxt: {
    fontSize: typography.sm,
    color:    colors.muted,
  },
});
