/**
 * DriveBackupScreen
 *
 * Full-screen version of the Drive backup panel, with two tabs:
 *   • Ajustes  — connect/disconnect, frequency, backup now
 *   • Backups  — list of files in Drive, tapeable to restore
 */

import { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, ScrollView, RefreshControl,
} from 'react-native';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser  from 'expo-web-browser';
import * as SecureStore  from 'expo-secure-store';
import Constants         from 'expo-constants';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation }     from '@react-navigation/native';

import { useStore }                                                         from '../../store/useStore';
import { exchangeCodeForTokens, getUserEmail, listBackups, downloadBackup, findOrCreateFolder } from '../services/driveService';
import { GOOGLE_ANDROID_CLIENT_ID }                                         from '../config/google';
import { colors, spacing, typography, borders, radius, withOpacity }        from '../theme';

WebBrowser.maybeCompleteAuthSession();

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

// ── DriveBackupScreen ─────────────────────────────────────────────────────────

export default function DriveBackupScreen() {
  const insets     = useSafeAreaInsets();
  const navigation = useNavigation();

  const driveBackup        = useStore((s) => s.driveBackup);
  const connectDrive       = useStore((s) => s.connectDrive);
  const disconnectDrive    = useStore((s) => s.disconnectDrive);
  const setDriveFrequency  = useStore((s) => s.setDriveFrequency);
  const performDriveBackup = useStore((s) => s.performDriveBackup);
  const deleteDriveBackups = useStore((s) => s.deleteDriveBackups);
  const importData         = useStore((s) => s.importData);
  const showToast          = useStore((s) => s.showToast);

  const [activeTab,   setActiveTab]   = useState('settings'); // 'settings' | 'backups'
  const [loading,     setLoading]     = useState(false);
  const [loadingMsg,  setMsg]         = useState('');
  const [files,       setFiles]       = useState(null);  // null = not loaded yet
  const [refreshing,  setRefreshing]  = useState(false);

  // ── OAuth setup ──────────────────────────────────────────────────────────────
  const isExpoGo        = Constants.executionEnvironment === 'storeClient';
  const androidRedirect = `com.googleusercontent.apps.${GOOGLE_ANDROID_CLIENT_ID.replace('.apps.googleusercontent.com', '')}:/oauth2redirect`;
  const redirectUri     = AuthSession.makeRedirectUri({ native: androidRedirect });

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId:     GOOGLE_ANDROID_CLIENT_ID,
      scopes:       SCOPES,
      responseType: AuthSession.ResponseType.Code,
      usePKCE:      true,
      redirectUri,
      extraParams:  { access_type: 'offline', prompt: 'consent' },
    },
    DISCOVERY,
  );

  const requestRef = useRef(request);
  useEffect(() => { if (request) requestRef.current = request; }, [request]);

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
          clientId:     GOOGLE_ANDROID_CLIENT_ID,
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

  // ── Load backups list ────────────────────────────────────────────────────────
  async function loadFiles(isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setMsg('Cargando lista…');
    try {
      const token    = await SecureStore.getItemAsync('drive_access_token');
      const folderId = driveBackup.folderId ?? (token ? await findOrCreateFolder(token).catch(() => null) : null);
      setFiles(token && folderId ? await listBackups(token, folderId) : []);
    } catch {
      setFiles([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setMsg('');
    }
  }

  // Auto-load when switching to Backups tab
  useEffect(() => {
    if (activeTab === 'backups' && files === null && driveBackup.enabled) {
      loadFiles();
    }
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handlers ─────────────────────────────────────────────────────────────────
  async function handleBackupNow() {
    setLoading(true);
    setMsg('Haciendo backup…');
    try {
      const result = await performDriveBackup();
      if (result.ok) {
        showToast('✓ ' + result.fileName);
        // Refresh list if on backups tab
        if (activeTab === 'backups') loadFiles();
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
              navigation.goBack();
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

  const isConnected = driveBackup.enabled;

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12} style={styles.backBtn}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>GOOGLE DRIVE</Text>
        <View style={styles.headerRight}>
          {/* Status dot */}
          <View style={[
            styles.statusDot,
            isConnected && !driveBackup.needsReconnect && styles.dotGreen,
            isConnected && driveBackup.needsReconnect  && styles.dotOrange,
            !isConnected && styles.dotGray,
          ]} />
        </View>
      </View>

      {/* ── Tab bar ── */}
      <View style={styles.tabBar}>
        {[
          { id: 'settings', label: 'Ajustes'  },
          { id: 'backups',  label: 'Backups'  },
        ].map(({ id, label }) => (
          <TouchableOpacity
            key={id}
            style={styles.tabItem}
            onPress={() => setActiveTab(id)}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabLabel, activeTab === id && styles.tabLabelActive]}>{label}</Text>
            <View style={[styles.tabUnderline, activeTab === id && styles.tabUnderlineActive]} />
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Tab: Ajustes ── */}
      {activeTab === 'settings' && (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Status card */}
          <View style={styles.statusCard}>
            <View style={styles.statusRow}>
              <View style={[
                styles.dot,
                isConnected && !driveBackup.needsReconnect ? styles.dotGreen : null,
                isConnected && driveBackup.needsReconnect  ? styles.dotOrange : null,
                !isConnected ? styles.dotGray : null,
              ]} />
              <Text style={styles.statusText}>
                {isConnected ? 'Conectado' : 'No conectado'}
              </Text>
            </View>
            {isConnected && driveBackup.email ? (
              <Text style={styles.emailText}>{driveBackup.email}</Text>
            ) : null}
            {isConnected && driveBackup.lastBackup ? (
              <Text style={styles.lastBackupText}>
                Último backup: {new Date(driveBackup.lastBackup).toLocaleString('es-ES', {
                  day: 'numeric', month: 'short', year: 'numeric',
                  hour: '2-digit', minute: '2-digit',
                })}
              </Text>
            ) : null}
            {isConnected && driveBackup.needsReconnect ? (
              <Text style={styles.warningText}>⚠️ Sesión expirada — vuelve a conectar</Text>
            ) : null}
          </View>

          {isConnected ? (
            <>
              {/* Frequency */}
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

              {/* Actions */}
              <Text style={styles.sectionLabel}>ACCIONES</Text>
              <ActionRow label="Hacer backup ahora"  onPress={handleBackupNow}  disabled={loading} />
              <ActionRow label="Ver backups en Drive" onPress={() => setActiveTab('backups')} disabled={loading} />

              <View style={styles.separator} />
              <ActionRow label="Eliminar todos los backups"    onPress={handleDeleteAll}  disabled={loading} danger />
              <ActionRow label="Desconectar cuenta de Google"  onPress={handleDisconnect} disabled={loading} ghost />
            </>
          ) : (
            <>
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
      )}

      {/* ── Tab: Backups ── */}
      {activeTab === 'backups' && (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadFiles(true)}
              tintColor={colors.accent}
              colors={[colors.accent]}
            />
          }
        >
          {!isConnected ? (
            <Text style={styles.emptyTxt}>Conecta Google Drive primero.</Text>
          ) : loading && files === null ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={colors.muted} />
              <Text style={styles.loadingTxt}>Cargando backups…</Text>
            </View>
          ) : !files || files.length === 0 ? (
            <Text style={styles.emptyTxt}>No hay backups guardados en Drive.</Text>
          ) : (
            <>
              <Text style={styles.backupListHint}>
                Pulsa un backup para restaurarlo. Tus datos actuales se reemplazarán.
              </Text>
              {files.map((f) => (
                <TouchableOpacity
                  key={f.id}
                  style={styles.fileRow}
                  onPress={() => handleRestoreFile(f)}
                  activeOpacity={0.7}
                  disabled={loading}
                >
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.fileName} numberOfLines={1}>{f.name}</Text>
                    {f.createdTime ? (
                      <Text style={styles.fileDate}>
                        {new Date(f.createdTime).toLocaleString('es-ES', {
                          day: 'numeric', month: 'short', year: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={styles.fileChevron}>›</Text>
                </TouchableOpacity>
              ))}
            </>
          )}

          {loading && loadingMsg ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={colors.muted} />
              <Text style={styles.loadingTxt}>{loadingMsg}</Text>
            </View>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}

// ── ActionRow ─────────────────────────────────────────────────────────────────

function ActionRow({ label, onPress, disabled, danger, ghost }) {
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
      {!ghost && <Text style={[styles.actionChevron, danger && { color: colors.red }]}>›</Text>}
    </TouchableOpacity>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex:            1,
    backgroundColor: colors.bg,
  },

  // Header
  header: {
    flexDirection:   'row',
    alignItems:      'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: borders.thin,
    borderBottomColor: colors.border,
  },
  backBtn: {
    paddingRight: spacing.md,
  },
  backIcon: {
    fontSize:  28,
    color:     colors.text,
    lineHeight: 32,
  },
  headerTitle: {
    flex:          1,
    fontSize:      typography.sm,
    fontWeight:    typography.heavy,
    color:         colors.muted,
    letterSpacing: 2,
  },
  headerRight: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: spacing.sm,
  },
  statusDot: {
    width: 10, height: 10, borderRadius: 5,
  },

  // Tab bar
  tabBar: {
    flexDirection:     'row',
    borderBottomWidth: borders.thin,
    borderBottomColor: colors.border,
  },
  tabItem: {
    flex:            1,
    alignItems:      'center',
    paddingVertical: spacing.sm + 2,
  },
  tabLabel: {
    fontSize:   typography.sm,
    color:      colors.muted,
    fontWeight: typography.medium,
  },
  tabLabelActive: {
    color: colors.text,
  },
  tabUnderline: {
    marginTop:       spacing.xs,
    height:          2,
    width:           '50%',
    borderRadius:    1,
    backgroundColor: 'transparent',
  },
  tabUnderlineActive: {
    backgroundColor: colors.accent,
  },

  // Content
  content: {
    padding: spacing.xl,
    gap:     spacing.sm,
  },

  // Status card
  statusCard: {
    backgroundColor: colors.surface2,
    borderRadius:    radius.sm,
    borderWidth:     borders.thin,
    borderColor:     colors.border,
    padding:         spacing.md,
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
  dotGreen:  { backgroundColor: colors.green },
  dotOrange: { backgroundColor: colors.orange },
  dotGray:   { backgroundColor: colors.muted2 ?? colors.muted },
  statusText: {
    fontSize:   typography.base,
    fontWeight: typography.medium,
    color:      colors.text,
  },
  emailText: {
    fontSize: typography.sm,
    color:    colors.muted,
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
    marginTop:     spacing.xs,
  },

  // Frequency grid
  freqGrid: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           spacing.xs,
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
    borderColor:      colors.accent,
    backgroundColor:  withOpacity(colors.accent, 0.08),
  },
  freqTxt: {
    fontSize: typography.sm,
    color:    colors.muted,
  },
  freqTxtActive: {
    color:      colors.accent,
    fontWeight: typography.medium,
  },

  // Action rows
  actionBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingVertical:   spacing.md,
    borderBottomWidth: borders.thin,
    borderBottomColor: colors.border,
  },
  actionDanger: {
    borderBottomColor: withOpacity(colors.red, 0.2),
  },
  actionGhost: {
    borderBottomWidth: 0,
    marginTop:         spacing.xs,
  },
  actionTxt: {
    fontSize: typography.base,
    color:    colors.text,
  },
  actionChevron: {
    fontSize: typography.lg,
    color:    colors.muted,
  },
  dangerTxt: { color: colors.red },
  ghostTxt:  { color: colors.muted },

  separator: {
    height:          borders.thin,
    backgroundColor: colors.border,
    marginVertical:  spacing.sm,
  },

  // Backups tab
  backupListHint: {
    fontSize:     typography.xs,
    color:        colors.muted,
    lineHeight:   typography.xs * 1.5,
    marginBottom: spacing.sm,
  },
  fileRow: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingVertical:   spacing.md,
    borderBottomWidth: borders.thin,
    borderBottomColor: colors.border,
    gap:               spacing.sm,
  },
  fileName: {
    fontSize:    typography.sm,
    fontWeight:  typography.medium,
    color:       colors.text,
  },
  fileDate: {
    fontSize:  typography.xs,
    color:     colors.muted,
    marginTop: 2,
  },
  fileChevron: {
    fontSize: typography.lg,
    color:    colors.muted,
  },

  // Connect (not-connected)
  explainTxt: {
    fontSize:   typography.sm,
    color:      colors.muted,
    lineHeight: typography.sm * 1.6,
    marginTop:  spacing.sm,
  },
  connectBtn: {
    backgroundColor: colors.accent,
    borderRadius:    radius.sm,
    paddingVertical: spacing.md + 2,
    alignItems:      'center',
    marginTop:       spacing.sm,
  },
  connectTxt: {
    fontSize:   typography.base,
    fontWeight: typography.bold,
    color:      colors.bg,
  },
  expoGoNote: {
    backgroundColor: withOpacity(colors.muted, 0.08),
    borderWidth:     1,
    borderColor:     withOpacity(colors.muted, 0.2),
    borderRadius:    radius.sm,
    padding:         spacing.md,
    marginTop:       spacing.sm,
  },
  expoGoNoteText: {
    fontSize:   typography.sm,
    color:      colors.muted,
    lineHeight: typography.sm * 1.5,
    textAlign:  'center',
  },

  // Loading
  loadingRow: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             spacing.xs,
    paddingVertical: spacing.md,
  },
  loadingTxt: {
    fontSize: typography.sm,
    color:    colors.muted,
  },
  emptyTxt: {
    fontSize:   typography.sm,
    color:      colors.muted,
    textAlign:  'center',
    paddingTop: spacing.xl,
  },
});
