/**
 * DriveBackupScreen — copia de seguridad en el Google Drive del usuario.
 *
 * Dos pestañas: Ajustes (conectar, cuándo se guarda, nombre, acciones) y Copias
 * (lista de archivos, tocar = restaurar).
 *
 * La prioridad del contenido es que se entienda qué hace sin tener que
 * probarlo: qué se guarda y dónde, que la app solo ve sus propios archivos, que
 * se conservan las 30 últimas copias (`MAX_BACKUPS` en `driveService.js`), y que
 * restaurar REEMPLAZA los datos actuales. Toda la lógica de OAuth y de archivos
 * se conserva tal cual; aquí solo cambian la presentación y los textos.
 */

import { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, ScrollView, RefreshControl, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Path, G } from 'react-native-svg';
import Reanimated, {
  useSharedValue, useAnimatedStyle, withTiming, interpolate,
} from 'react-native-reanimated';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser  from 'expo-web-browser';
import * as SecureStore from 'expo-secure-store';
import Constants        from 'expo-constants';

import { useStore }                                                         from '../../store/useStore';
import { exchangeCodeForTokens, getUserEmail }                           from '../services/driveService';
import { GOOGLE_CLIENT_ID, GOOGLE_REDIRECT_URI }                            from '../config/google';
import SegmentedControl from '../components/ui/SegmentedControl';
import { CheckIcon, ChevronDown } from '../components/ui/EditorIcons';
import { Section, SectionLabel, MenuRow, RowIcon } from '../components/ui/MenuList';
import { formatWhen } from '../utils/formatWhen';
import { spacing, textStyles } from '../theme';
import { useTheme, useThemedStyles } from '../useTheme';

WebBrowser.maybeCompleteAuthSession();

const DISCOVERY = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint:         'https://oauth2.googleapis.com/token',
};
const SCOPES = ['openid', 'email', 'https://www.googleapis.com/auth/drive.file'];

// Las frecuencias distintas de 'session' registran una tarea en segundo plano
// (ver setDriveFrequency en el store), y eso es justo lo que dice el subtítulo.
const FREQ_OPTIONS = ['session', 'daily', 'weekly', 'monthly'];
const FREQ_KEY = { session: 'Session', daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' };

const ICON_CLOUD  = <Path d="M6 18a4 4 0 0 1 .6-8 6 6 0 0 1 11.5 2A3.5 3.5 0 0 1 17.5 18z" />;
const ICON_LOCK   = <G><Path d="M6 11h12v9H6zM9 11V8a3 3 0 0 1 6 0v3" /></G>;
const ICON_STACK  = <Path d="M12 3 2 8l10 5 10-5-10-5zM2 16l10 5 10-5" />;
const ICON_SAVE   = <Path d="M12 5v14M6 13l6 6 6-6" />;
const ICON_TRASH  = <G><Path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></G>;
const ICON_UNLINK = <Path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />;
const ICON_FILE   = <G><Path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><Path d="M14 3v5h5" /></G>;

export default function DriveBackupScreen() {
  const th         = useTheme();
  const styles     = useThemedStyles(makeStyles);
  const { t }      = useTranslation();
  const navigation = useNavigation();

  const driveBackup        = useStore((s) => s.driveBackup);
  const connectDrive       = useStore((s) => s.connectDrive);
  const disconnectDrive    = useStore((s) => s.disconnectDrive);
  const setDriveFrequency  = useStore((s) => s.setDriveFrequency);
  const setDriveBackupName = useStore((s) => s.setDriveBackupName);
  const performDriveBackup = useStore((s) => s.performDriveBackup);
  const deleteDriveBackups = useStore((s) => s.deleteDriveBackups);
  const listDriveBackups   = useStore((s) => s.listDriveBackups);
  const downloadDriveBackup = useStore((s) => s.downloadDriveBackup);
  const importData         = useStore((s) => s.importData);
  const showToast          = useStore((s) => s.showToast);
  const lang               = useStore((s) => s.profile?.language ?? 'es');

  const [activeTab,   setActiveTab]   = useState('settings'); // 'settings' | 'backups'
  const [nameInput,   setNameInput]   = useState(driveBackup.backupName ?? '');
  const [loading,     setLoading]     = useState(false);
  const [loadingMsg,  setMsg]         = useState('');
  const [files,       setFiles]       = useState(null);  // null = not loaded yet
  const [loadFailed,  setLoadFailed]  = useState(false); // ≠ "no hay copias"
  const [refreshing,  setRefreshing]  = useState(false);
  const [freqOpen,    setFreqOpen]    = useState(false);

  const when = (v) => formatWhen(v, lang, t('dayCard.today'), t('dayCard.yesterday'));

  // Chevron de la barra del desplegable: apunta arriba mientras está abierto.
  const chevronRot = useSharedValue(0);
  useEffect(() => {
    chevronRot.value = withTiming(freqOpen ? 1 : 0, { duration: 180 });
  }, [freqOpen, chevronRot]);
  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${interpolate(chevronRot.value, [0, 1], [0, 180])}deg` }],
  }));

  // ── OAuth setup ──────────────────────────────────────────────────────────────
  const isExpoGo        = Constants.executionEnvironment === 'storeClient';
  const redirectUri     = AuthSession.makeRedirectUri({ native: GOOGLE_REDIRECT_URI });

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId:     GOOGLE_CLIENT_ID,
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
      setMsg(t('drive.loadingConnect'));
      try {
        const tokens = await exchangeCodeForTokens({
          code:         response.params.code,
          codeVerifier: requestRef.current?.codeVerifier,
          redirectUri,
          clientId:     GOOGLE_CLIENT_ID,
        });
        const email = await getUserEmail(tokens.access_token);
        await connectDrive(email, tokens.access_token, tokens.refresh_token ?? null);
        showToast(t('drive.toastConnected'), 2200, 'success');
      } catch (err) {
        Alert.alert(t('drive.errConnectTitle'), err?.message ?? t('drive.errBackupBody'));
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
    setMsg(t('drive.loadingBackups'));
    try {
      setFiles(await listDriveBackups());
      setLoadFailed(false);
    } catch {
      // Lista vacía y "no he podido preguntar" son cosas distintas: antes las
      // dos acababan en `setFiles([])` y la pantalla juraba que no había copias
      // con el token simplemente caducado.
      setFiles(null);
      setLoadFailed(true);
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

  // La tarea de fondo deja esta nota cuando se encuentra el token caducado, y
  // hasta ahora no la leía nadie: el aviso de reconexión no llegaba nunca desde
  // ese camino. Se consume al leerla — el estado ya vive en `needsReconnect`.
  useEffect(() => {
    SecureStore.getItemAsync('drive_needs_reconnect').then((v) => {
      if (v !== 'true') return;
      useStore.setState((s) => ({ driveBackup: { ...s.driveBackup, needsReconnect: true } }));
      SecureStore.deleteItemAsync('drive_needs_reconnect').catch(() => {});
    }).catch(() => {});
  }, []);

  // ── Handlers ─────────────────────────────────────────────────────────────────
  async function handleBackupNow() {
    setLoading(true);
    setMsg(t('drive.loadingBackup'));
    try {
      const result = await performDriveBackup();
      if (result.ok) {
        showToast(t('drive.toastSaved'), 2200, 'success');
        if (activeTab === 'backups') loadFiles();
      } else if (result.error === 'Token expirado') {
        Alert.alert(t('drive.errExpiredTitle'), t('drive.errExpiredBody'));
      } else {
        Alert.alert(t('drive.errBackupTitle'), result.error ?? t('drive.errBackupBody'));
      }
    } catch (err) {
      Alert.alert(t('drive.errBackupTitle'), err?.message ?? t('drive.errBackupBody'));
    } finally {
      setLoading(false);
      setMsg('');
    }
  }

  function handleRestoreFile(file) {
    Alert.alert(
      t('drive.restoreTitle'),
      t('drive.restoreBody', { when: when(file.createdTime) ?? file.name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('drive.restoreConfirm'), style: 'destructive',
          onPress: async () => {
            setLoading(true);
            setMsg(t('drive.loadingRestore'));
            try {
              const data = await downloadDriveBackup(file.id);
              importData(data, { program: true, log: true, settings: true, customExercises: true, clients: true }, { silent: true });
              showToast(t('drive.toastRestored'), 2200, 'success');
              navigation.goBack();
            } catch (err) {
              Alert.alert(t('drive.errRestoreTitle'), err?.message ?? t('drive.errBackupBody'));
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
      t('drive.deleteAllTitle'),
      t('drive.deleteAllBody'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('drive.deleteAllConfirm'), style: 'destructive',
          onPress: async () => {
            setLoading(true);
            setMsg(t('drive.loadingDelete'));
            try {
              await deleteDriveBackups();
              setFiles([]);
              showToast(t('drive.toastDeleted'), 2200, 'neutral');
            } catch {
              Alert.alert(t('drive.errDeleteTitle'), t('drive.errBackupBody'));
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
      t('drive.disconnectTitle'),
      t('drive.disconnectBody'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('drive.disconnectConfirm'), style: 'destructive',
          onPress: async () => {
            await disconnectDrive();
            showToast(t('drive.toastDisconnected'), 2200, 'neutral');
          },
        },
      ],
    );
  }

  // ── Nombre del archivo ───────────────────────────────────────────────────────
  // Mismo saneado que `performDriveBackup` en el store, para que la vista previa
  // sea el nombre real y no una aproximación.
  function sanitizeBackupName(raw) {
    const s = (raw || '').trim();
    if (!s) return 'forma-backup';
    return s
      .toLowerCase()
      .replace(/[áàäâã]/g, 'a').replace(/[éèëê]/g, 'e')
      .replace(/[íìïî]/g, 'i').replace(/[óòöôõ]/g, 'o')
      .replace(/[úùüû]/g, 'u').replace(/ñ/g, 'n').replace(/ç/g, 'c')
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'forma-backup';
  }

  const today       = new Date().toISOString().split('T')[0];
  const previewName = `${sanitizeBackupName(nameInput)}-${today}.fitdata`;

  const isConnected = driveBackup.enabled;
  const needsFix    = isConnected && driveBackup.needsReconnect;
  const state       = !isConnected ? 'off' : needsFix ? 'warn' : 'on';
  const lastWhen    = when(driveBackup.lastBackup);

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('drive.title')}</Text>
        <TouchableOpacity style={styles.iconBox} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Text style={styles.closeGlyph}>✕</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tabs}>
        <SegmentedControl
          options={[
            { id: 'settings', label: t('drive.tabSettings') },
            { id: 'backups',  label: t('drive.tabBackups')  },
          ]}
          value={activeTab}
          onChange={setActiveTab}
        />
      </View>

      {/* ── Pestaña: Ajustes ── */}
      {activeTab === 'settings' && (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

          <View style={[styles.stateCard, state !== 'on' && styles.stateCardOff]}>
            <View style={styles.stateTagRow}>
              <View style={[styles.stateDot, {
                backgroundColor: state === 'on' ? th.colors.accent : state === 'warn' ? th.colors.orange : th.colors.muted,
              }]} />
              <Text style={[styles.stateTag, state === 'warn' && { color: th.colors.orange }]}>
                {t(state === 'on' ? 'drive.tagActive' : state === 'warn' ? 'drive.tagReconnect' : 'drive.tagOff')}
              </Text>
            </View>
            <Text style={styles.stateTitle} numberOfLines={1}>
              {isConnected ? (driveBackup.email ?? t('drive.title')) : t('drive.offTitle')}
            </Text>
            <Text style={[styles.stateSub, state !== 'on' && styles.stateSubOff]}>
              {needsFix        ? t('drive.reconnectSub')
                : !isConnected ? t('drive.offSub')
                : lastWhen     ? t('drive.activeSub', { when: lastWhen })
                :                t('drive.activeSubNever')}
            </Text>
          </View>

          {/* Con el permiso caducado la única salida era desconectar y volver a
              conectar; el flujo de OAuth ya está montado aquí, así que el botón
              es el mismo `promptAsync` y `connectDrive` limpia `needsReconnect`. */}
          {needsFix && !isExpoGo && (
            <TouchableOpacity
              style={[styles.primaryBtn, styles.reconnectBtn, (!request || loading) && { opacity: 0.5 }]}
              onPress={() => promptAsync()}
              disabled={!request || loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator size="small" color={th.colors.onAccent} />
                : <Text style={styles.primaryBtnText}>{t('drive.reconnectCta')}</Text>}
            </TouchableOpacity>
          )}
          {needsFix && isExpoGo && <Text style={styles.hint}>{t('drive.expoGoNote')}</Text>}

          {isConnected ? (
            <>
              {/* Las 4 frecuencias como desplegable (mismo patrón que el filtro de
                  ejercicios de Progreso): son excluyentes y la explicación de
                  cada una solo hace falta al elegir. La barra va en `surface`, no
                  en lima — aquí no es la cabecera de la pantalla. */}
              <View style={styles.freqBlock}>
                <SectionLabel>{t('drive.sectionFrequency')}</SectionLabel>
                <View style={styles.dropAnchor}>
                  <TouchableOpacity
                    style={[styles.freqBar, freqOpen && styles.freqBarOpen]}
                    onPress={() => !loading && setFreqOpen((o) => !o)}
                    disabled={loading}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.freqBarLabel} numberOfLines={1}>
                      {t(`drive.freq${FREQ_KEY[driveBackup.frequency]}`)}
                    </Text>
                    <Reanimated.View style={chevronStyle}>
                      <ChevronDown size={12} color={th.colors.mutedLight} />
                    </Reanimated.View>
                  </TouchableOpacity>

                  {freqOpen && (
                    <View style={styles.dropList}>
                      {FREQ_OPTIONS.map((key) => {
                        const isSel = driveBackup.frequency === key;
                        return (
                          <TouchableOpacity
                            key={key}
                            style={[styles.dropItem, isSel && styles.dropItemSel]}
                            onPress={() => { setDriveFrequency(key); setFreqOpen(false); }}
                            activeOpacity={0.75}
                          >
                            <View style={styles.dropItemMeta}>
                              <Text style={[styles.dropItemText, isSel && styles.dropItemTextSel]}>
                                {t(`drive.freq${FREQ_KEY[key]}`)}
                              </Text>
                              <Text style={styles.dropItemSub}>
                                {t(`drive.freq${FREQ_KEY[key]}Sub`)}
                              </Text>
                            </View>
                            {isSel
                              ? <CheckIcon size={16} color={th.colors.accent} />
                              : <View style={styles.checkSpacer} />}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                </View>
              </View>

              <View style={styles.nameBlock}>
                <SectionLabel>{t('drive.sectionName')}</SectionLabel>
                <TextInput
                  style={styles.nameInput}
                  value={nameInput}
                  onChangeText={(v) => { setNameInput(v); setDriveBackupName(v); }}
                  placeholder={t('drive.namePlaceholder')}
                  placeholderTextColor={th.colors.mutedLight}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="done"
                  maxLength={40}
                />
                <Text style={styles.namePreview}>{t('drive.namePreview', { name: previewName })}</Text>
                <Text style={styles.nameHint}>{t('drive.nameHint')}</Text>
              </View>

              <Section title={t('drive.sectionActions')}>
                <MenuRow
                  icon={<RowIcon color={th.colors.accent}>{ICON_SAVE}</RowIcon>}
                  label={t('drive.backupNow')}
                  sub={t('drive.backupNowSub')}
                  minHeight={62}
                  disabled={loading}
                  onPress={handleBackupNow}
                />
                <MenuRow
                  icon={<RowIcon>{ICON_UNLINK}</RowIcon>}
                  label={t('drive.disconnect')}
                  sub={t('drive.disconnectSub')}
                  subLines={0}
                  minHeight={62}
                  disabled={loading}
                  onPress={handleDisconnect}
                />
                <MenuRow
                  icon={<RowIcon color={th.tint.red50}>{ICON_TRASH}</RowIcon>}
                  label={t('drive.deleteAll')}
                  labelColor={th.tint.red50}
                  sub={t('drive.deleteAllSub')}
                  subLines={0}
                  minHeight={62}
                  disabled={loading}
                  onPress={handleDeleteAll}
                />
              </Section>
            </>
          ) : (
            <>
              {/* Sin conectar: explicar qué hace ANTES de pedir la cuenta. */}
              <Section title={t('drive.sectionHow')}>
                <MenuRow
                  icon={<RowIcon>{ICON_CLOUD}</RowIcon>}
                  label={t('drive.how1Title')}
                  sub={t('drive.how1Sub')}
                  subLines={0}
                  minHeight={62}
                />
                <MenuRow
                  icon={<RowIcon>{ICON_LOCK}</RowIcon>}
                  label={t('drive.how2Title')}
                  sub={t('drive.how2Sub')}
                  subLines={0}
                  minHeight={62}
                />
                <MenuRow
                  icon={<RowIcon>{ICON_STACK}</RowIcon>}
                  label={t('drive.how3Title')}
                  sub={t('drive.how3Sub')}
                  subLines={0}
                  minHeight={62}
                />
              </Section>

              {isExpoGo ? (
                <Text style={styles.hint}>{t('drive.expoGoNote')}</Text>
              ) : (
                <TouchableOpacity
                  style={[styles.primaryBtn, (!request || loading) && { opacity: 0.5 }]}
                  onPress={() => promptAsync()}
                  disabled={!request || loading}
                  activeOpacity={0.85}
                >
                  {loading
                    ? <ActivityIndicator size="small" color={th.colors.onAccent} />
                    : <Text style={styles.primaryBtnText}>{t('drive.connectCta')}</Text>}
                </TouchableOpacity>
              )}
            </>
          )}

          {loading && loadingMsg ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={th.colors.mutedLight} />
              <Text style={styles.loadingTxt}>{loadingMsg}</Text>
            </View>
          ) : null}
        </ScrollView>
      )}

      {/* ── Pestaña: Copias ── */}
      {activeTab === 'backups' && (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadFiles(true)}
              tintColor={th.colors.accent}
              colors={[th.colors.accent]}
            />
          }
        >
          {!isConnected ? (
            <Text style={styles.hint}>{t('drive.backupsNeedConnect')}</Text>
          ) : loading && files === null ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={th.colors.mutedLight} />
              <Text style={styles.loadingTxt}>{t('drive.loadingBackups')}</Text>
            </View>
          ) : loadFailed ? (
            <Text style={styles.hint}>
              {driveBackup.needsReconnect ? t('drive.backupsNeedReconnect') : t('drive.backupsLoadFailed')}
            </Text>
          ) : !files || files.length === 0 ? (
            <Text style={styles.hint}>{t('drive.backupsEmpty')}</Text>
          ) : (
            <>
              <Text style={styles.listHint}>{t('drive.backupsHint')}</Text>
              <Section>
                {files.map((f) => (
                  <MenuRow
                    key={f.id}
                    icon={<RowIcon>{ICON_FILE}</RowIcon>}
                    label={f.name}
                    sub={when(f.createdTime) ?? undefined}
                    minHeight={62}
                    disabled={loading}
                    onPress={() => handleRestoreFile(f)}
                  />
                ))}
              </Section>
            </>
          )}

          {loading && loadingMsg && files !== null ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={th.colors.mutedLight} />
              <Text style={styles.loadingTxt}>{loadingMsg}</Text>
            </View>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const makeStyles = (th) => StyleSheet.create({
  container: { flex: 1, backgroundColor: th.colors.bg },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm,
    gap: spacing.md,
  },
  headerTitle: { ...textStyles.hero, color: th.colors.text, flexShrink: 1 },
  iconBox: {
    width: 42, height: 42, borderRadius: th.radius.sm,
    backgroundColor: th.colors.surface2,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  closeGlyph: { fontSize: 17, color: th.colors.text },

  tabs:    { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },

  // Tarjeta de estado — mismo tratamiento que el "Resumen" de los editores:
  // relleno tint/accent-10 y sin borde. Sin conectar (o con el permiso
  // caducado) pierde el tinte lima, que aquí significa "esto va bien".
  stateCard: {
    backgroundColor: th.tint.accent10,
    borderRadius:    th.radius.md,
    padding:         spacing.lg,
    marginBottom:    spacing.xl,
    gap:             spacing.sm,
  },
  stateCardOff: { backgroundColor: th.colors.surface },
  stateTagRow:  { flexDirection: 'row', alignItems: 'center', gap: 7 },
  stateDot:     { width: 7, height: 7, borderRadius: 3.5 },
  stateTag:     { ...textStyles.spacingTag, color: th.colors.mutedLight, textTransform: 'uppercase' },
  stateTitle:   { ...textStyles.cardTitle, color: th.colors.text },
  stateSub:     { ...textStyles.tag, color: th.tint.accent50, lineHeight: 15 },
  stateSubOff:  { color: th.colors.mutedLight },

  // Hueco del mismo tamaño que el check, para que las 4 frecuencias tengan la
  // etiqueta a la misma anchura aunque solo una lleve marca.
  checkSpacer: { width: 16, height: 16 },

  // El botón de reconectar es el primario de la pantalla; solo separa del bloque
  // siguiente, la forma la pone `primaryBtn`.
  reconnectBtn: { marginBottom: spacing.xl },

  // ── Desplegable de frecuencia ──────────────────────────────────────────────
  // Mismo patrón que el filtro de ejercicios de Progreso: el menú se ancla
  // inline al borde inferior de la barra (`top:'100%'`), así nace pegado a ella
  // y sigue pegado al hacer scroll, sin Modal ni medir coordenadas.
  freqBlock:  { marginBottom: spacing.xl },
  dropAnchor: { width: '100%', zIndex: 100 },
  freqBar: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    gap:               spacing.md,
    backgroundColor:   th.colors.surface,
    paddingHorizontal: spacing.lg,
    paddingVertical:   spacing.md,
    borderRadius:      th.radius.sm,
    minHeight:         52,
  },
  // Abierta: esquinas inferiores rectas para fusionarse con el menú de abajo.
  freqBarOpen: { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
  freqBarLabel: {
    fontFamily: 'Inter_800ExtraBold',
    fontSize:   14,
    color:      th.colors.text,
    flexShrink: 1,
  },
  dropList: {
    position:                'absolute',
    top:                     '100%',
    left:                    0,
    right:                   0,
    zIndex:                  100,
    backgroundColor:         th.colors.surface2,
    borderBottomLeftRadius:  th.radius.sm,
    borderBottomRightRadius: th.radius.sm,
    overflow:                'hidden',
    shadowColor:   '#000',
    shadowOffset:  { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius:  10,
    elevation:     12,
  },
  dropItem: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing.md,
    paddingVertical:   spacing.md,
    paddingHorizontal: spacing.lg,
  },
  dropItemSel:     { backgroundColor: th.tint.accent10 },
  dropItemMeta:    { flex: 1, minWidth: 0 },
  dropItemText:    { ...textStyles.subtitle, color: th.colors.mutedLight },
  dropItemTextSel: { color: th.colors.text },
  dropItemSub: {
    ...textStyles.tag,
    color:      th.colors.mutedLight,
    lineHeight: 15,
    marginTop:  spacing.xs,
  },

  nameBlock: { marginBottom: spacing.xl },
  nameInput: {
    backgroundColor:   th.colors.surface2,
    borderRadius:      th.radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.sm,
    ...textStyles.cardTitle,
    color:             th.colors.text,
  },
  namePreview: {
    ...textStyles.subtitle,
    color:     th.tint.accent50,
    marginTop: spacing.sm2,
  },
  nameHint: {
    ...textStyles.tag,
    color:      th.colors.mutedLight,
    lineHeight: 15,
    marginTop:  spacing.xs,
  },

  primaryBtn: {
    height:          44,
    borderRadius:    th.radius.sm,
    backgroundColor: th.colors.accent,
    alignItems:      'center',
    justifyContent:  'center',
  },
  primaryBtnText: { ...textStyles.btnAction, color: th.colors.onAccent },

  hint: {
    ...textStyles.tag,
    color:      th.colors.mutedLight,
    lineHeight: 15,
    textAlign:  'center',
    marginTop:  spacing.md,
  },
  listHint: {
    ...textStyles.tag,
    color:        th.colors.mutedLight,
    lineHeight:   15,
    marginBottom: spacing.md,
  },

  loadingRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.sm,
    marginTop:     spacing.md,
  },
  loadingTxt: { ...textStyles.tag, color: th.colors.mutedLight },
});
