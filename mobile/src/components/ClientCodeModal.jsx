/**
 * ClientCodeModal — el cliente se conecta con su entrenador.
 *
 * Tres pantallas dentro de la misma hoja:
 *   • código      → teclea el XXXX-XXXX que le dio su entrenador
 *   • cuenta      → (abierta con `startWithSocial`) busca su cuenta ya vinculada,
 *                   con Google o con Apple. Con `reconnect` (C09 §4.8, «Ya estaba
 *                   conectado») ofrece las tres formas: Google, Apple y «Con mi
 *                   código». Con `autoProvider` lanza ese proveedor al abrirse.
 *   • confirmar   → qué programa ha encontrado y qué implica conectarse
 *
 * Con un código pendiente de una invitación (M01-04, `pendingInviteCode`) la
 * hoja lo rellena y lo valida sola, y salta a confirmar: el cliente sigue
 * pulsando «Conectar». El pendiente se borra al cerrar la hoja.
 *
 * Pasa a `DragSheet` como el resto de los modales de la app (§9 de
 * docs/UI-MIGRATION.md): fuera la tarjeta centrada con borde. Toda la lógica
 * (OAuth, validación, linkToTrainer/confirmGoogleReconnect) se conserva.
 */

import { useState, useRef, useEffect } from 'react';
import { View, TouchableOpacity, ActivityIndicator, StyleSheet, Linking } from 'react-native';
import { Text } from './ui/Text';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser  from 'expo-web-browser';
import Constants        from 'expo-constants';
import { useTranslation } from 'react-i18next';

import { useStore }              from '../../store/useStore';
import { exchangeCodeForTokens } from '../services/driveService';
import useClientCode             from '../hooks/useClientCode';
import { GOOGLE_CLIENT_ID, GOOGLE_REDIRECT_URI } from '../config/google';
import { APPLE_AUTH_AVAILABLE, signInWithApple } from '../services/appleAuth';
import { PRIVACY_URL } from '../config/legal';
import DragSheet from './DragSheet';
import AppleSignInButton from './ui/AppleSignInButton';
import CodeField from './ui/CodeField';
import { CheckIcon } from './ui/EditorIcons';
import { Section, SectionLabel, MenuRow } from './ui/MenuList';
import { spacing, textStyles } from '../theme';
import { useTheme, useThemedStyles } from '../useTheme';

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_DISCOVERY = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint:         'https://oauth2.googleapis.com/token',
};

export default function ClientCodeModal({
  visible, onClose, onSuccess, startWithSocial = false, initialCode = null, reconnect = false, autoProvider = null,
}) {
  const th        = useTheme();
  const styles    = useThemedStyles(makeStyles);
  const { t }     = useTranslation();
  const validateGoogleClient   = useStore((s) => s.validateGoogleClient);
  const pendingInvite          = useStore((s) => s.pendingInviteCode);
  const clearPendingInvite     = useStore((s) => s.clearPendingInviteCode);

  // Validar, elegir historial y conectar: useClientCode (lo comparte con el recorrido de entrada).
  const {
    step, code, slotInfo, historyMode, googleUserId, loading, error, alreadyLinked: isAlreadyLinked,
    setCode, setHistoryMode, setError, back, reset, validate: handleValidate, confirm, foundByAccount,
  } = useClientCode();
  const [socialLoading, setSocialLoading] = useState(false);
  const [socialNoSlot,  setSocialNoSlot]  = useState(false);
  // «Volver a conectar» → «Con mi código»: la pantalla del código, en esta misma hoja.
  const [codeInstead,   setCodeInstead]   = useState(false);

  // ── Login social para reconectar (Google / Apple) ──────────────────────────
  const isExpoGo         = Constants.executionEnvironment === 'storeClient';
  const googleRedirectUri = AuthSession.makeRedirectUri({ native: GOOGLE_REDIRECT_URI });

  const [googleRequest, googleResponse, googlePromptAsync] = AuthSession.useAuthRequest(
    {
      clientId:     GOOGLE_CLIENT_ID,
      scopes:       ['openid', 'email', 'profile'],
      responseType: AuthSession.ResponseType.Code,
      usePKCE:      true,
      redirectUri:  googleRedirectUri,
      extraParams:  { access_type: 'online', prompt: 'select_account' },
    },
    GOOGLE_DISCOVERY,
  );

  const googleRequestRef = useRef(googleRequest);
  const hasAutoTriggered = useRef(false);
  useEffect(() => { if (googleRequest) googleRequestRef.current = googleRequest; }, [googleRequest]);

  // Con un solo proveedor no hay nada que elegir, así que abrir la pantalla ya
  // lanza Google directamente — que es como se comportaba antes de existir
  // Apple. En iOS hay dos y la pantalla enseña los dos botones: elegir por el
  // usuario sería justo lo que la guía 4.8 no quiere.
  const showChooser = APPLE_AUTH_AVAILABLE || reconnect;
  // Qué lanzar solo al abrir: el que se pidió, o Google si no hay nada que elegir.
  const autoLaunch = autoProvider ?? (showChooser ? null : 'google');

  useEffect(() => {
    if (!startWithSocial || !visible || !autoLaunch) {
      hasAutoTriggered.current = false;
      return;
    }
    if (hasAutoTriggered.current) return;
    if (autoLaunch === 'apple') {
      hasAutoTriggered.current = true;
      handleApple();
    } else if (googleRequest) {
      // Al abrir no hay error ni «sin hueco» que limpiar: cerrar la hoja ya los limpia.
      hasAutoTriggered.current = true;
      googlePromptAsync();
    }
  }, [startWithSocial, visible, googleRequest]); // eslint-disable-line

  // Al abrirse, siempre en el código: el estado del hook es de módulo y lo comparte
  // con el recorrido de entrada, que pudo dejarlo en «Programa encontrado» (O03 §28.2).
  // `initialCode`: el código de siempre, cuando vuelve a valer (C09 §4.6).
  useEffect(() => {
    if (!visible || pendingInvite) return;
    reset();
    if (initialCode) setCode(initialCode);
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  // La hoja no deja nada a medias al desmontarse (el estado del hook es de módulo).
  useEffect(() => reset, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Invitación: se rellena y se valida una vez por código. Si falla (código
  // usado, reemitido), se queda en el paso de teclear con el error a la vista.
  const validatedInvite = useRef(null);
  useEffect(() => {
    if (!visible || !pendingInvite || validatedInvite.current === pendingInvite) return;
    validatedInvite.current = pendingInvite;
    setCode(pendingInvite);
    back();
    handleValidate(pendingInvite);
  }, [visible, pendingInvite]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Busca el hueco del cliente con la identidad recién obtenida. */
  async function validateSocial({ provider, idToken, accessToken }) {
    const result = await validateGoogleClient({ provider, idToken, accessToken });
    if (!result.found) {
      setSocialNoSlot(true);
      return;
    }
    foundByAccount({ userId: result.userId, provider, slot: result });
  }

  useEffect(() => { // eslint-disable-line react-hooks/exhaustive-deps
    if (googleResponse?.type !== 'success') return;
    (async () => {
      setSocialLoading(true);
      setError(null);
      setSocialNoSlot(false);
      try {
        const tokens = await exchangeCodeForTokens({
          code:         googleResponse.params.code,
          codeVerifier: googleRequestRef.current?.codeVerifier,
          redirectUri:  googleRedirectUri,
          clientId:     GOOGLE_CLIENT_ID,
        });
        if (!tokens.id_token) throw new Error(t('trainer.errNoIdToken'));
        await validateSocial({
          provider:    'google',
          idToken:     tokens.id_token,
          accessToken: tokens.access_token,
        });
      } catch (err) {
        setError(err.message ?? t('trainer.errGoogle'));
      } finally {
        setSocialLoading(false);
      }
    })();
  }, [googleResponse]); // eslint-disable-line

  async function handleApple() {
    setSocialLoading(true);
    setError(null);
    setSocialNoSlot(false);
    try {
      const credential = await signInWithApple();
      if (!credential) return;               // cancelado
      if (!credential.idToken) throw new Error(t('trainer.errNoIdToken'));
      await validateSocial({ provider: 'apple', idToken: credential.idToken });
    } catch (err) {
      setError(err.message ?? t('trainer.errApple'));
    } finally {
      setSocialLoading(false);
    }
  }

  function handleClose() {
    reset();
    setSocialNoSlot(false);
    setCodeInstead(false);
    validatedInvite.current = null;
    clearPendingInvite();
    onClose();
  }

  async function handleConfirm() {
    if (!(await confirm())) return;
    handleClose();
    onSuccess?.();
  }

  const isSocialScreen  = step === 'enter' && startWithSocial && !codeInstead;

  // Los títulos de hoja de la app van en caso normal y cortos ("Añadir",
  // "Tempo"), no en mayúsculas como los botones.
  const title = step === 'confirm'
    ? t(googleUserId ? 'trainer.codeFoundAccount' : 'trainer.codeFoundProgram')
    : t(reconnect && step === 'enter'
      ? 'trainer.reconnectTitle'
      : isSocialScreen
      ? (showChooser ? 'trainer.socialTitle' : 'trainer.googleTitle')
      : 'trainer.codeTitle');

  return (
    <DragSheet
      visible={visible}
      onClose={handleClose}
      title={title}
      // El hueco de la derecha de la hoja hace de salida: atrás en el paso de
      // confirmación, cancelar en los demás. Así no hay dos botones abajo.
      action={step === 'confirm'
        ? { label: t('trainer.codeBack'), onPress: back }
        : { label: t('common.cancel'),    onPress: handleClose }}
    >
      {/* ── Buscando la cuenta vinculada ── */}
      {isSocialScreen && (
        <View style={styles.block}>
          <Text style={styles.lead}>
            {socialNoSlot                       ? t('trainer.socialNoSlot')
              : reconnect && !socialLoading     ? t('trainer.reconnectLead')
              : showChooser && !socialLoading   ? t('trainer.socialLead')
                :                                 t('trainer.socialSearching')}
          </Text>

          {socialLoading && <ActivityIndicator color={th.colors.accent} />}
          {!!error && <Text style={styles.error}>{error}</Text>}
          {isExpoGo && <Text style={styles.hint}>{t('trainer.expoGoNote')}</Text>}

          {/* Con selector los botones están desde el principio; sin él (Android)
              solo aparecen para reintentar, porque Google ya se lanzó solo. */}
          {(showChooser || socialNoSlot || error) && !socialLoading && (
            <View style={styles.ctaGroup}>
              <TouchableOpacity
                style={[styles.primaryBtn, isExpoGo && styles.btnDisabled]}
                onPress={() => {
                  setSocialNoSlot(false);
                  setError(null);
                  hasAutoTriggered.current = false;
                  googlePromptAsync();
                }}
                disabled={isExpoGo}
                activeOpacity={0.85}
              >
                <Text style={styles.primaryBtnText}>
                  {t(showChooser ? 'trainer.googleCta' : 'trainer.retryCta')}
                </Text>
              </TouchableOpacity>

              <AppleSignInButton onPress={handleApple} disabled={isExpoGo} />
              {reconnect && (
                <TouchableOpacity
                  style={styles.secondaryBtn}
                  onPress={() => { setError(null); setSocialNoSlot(false); setCodeInstead(true); }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.secondaryBtnText}>{t('trainer.reconnectCode')}</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      )}

      {/* ── Teclear el código ── */}
      {step === 'enter' && (!startWithSocial || codeInstead) && (
        <View style={styles.block}>
          <Text style={styles.lead}>{t('trainer.codeLead')}</Text>

          <CodeField
            value={code}
            onChangeText={(v) => { setCode(v); setError(null); }}
            groups={2}
            onSubmitEditing={() => handleValidate()}
            autoFocus
            error={error}
          />

          <TouchableOpacity
            style={[styles.primaryBtn, (!code.trim() || loading) && styles.btnDisabled]}
            onPress={() => handleValidate()}
            disabled={!code.trim() || loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color={th.colors.onAccent} />
              : <Text style={styles.primaryBtnText}>{t('trainer.codeContinue')}</Text>}
          </TouchableOpacity>

          {!codeInstead && (<>
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>{t('trainer.or')}</Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.ctaGroup}>
            <TouchableOpacity
              style={[styles.secondaryBtn, (socialLoading || isExpoGo) && styles.btnDisabled]}
              onPress={() => { setSocialNoSlot(false); setError(null); googlePromptAsync(); }}
              disabled={socialLoading || isExpoGo}
              activeOpacity={0.8}
            >
              {socialLoading
                ? <ActivityIndicator color={th.colors.text} size="small" />
                : <Text style={styles.secondaryBtnText}>{t('trainer.googleCta')}</Text>}
            </TouchableOpacity>

            <AppleSignInButton onPress={handleApple} disabled={socialLoading || isExpoGo} />
          </View>
          <Text style={styles.hint}>
            {socialNoSlot ? t('trainer.socialNoSlot') : t('trainer.socialCtaHint')}
          </Text>
          </>)}
          {isExpoGo && <Text style={styles.hint}>{t('trainer.expoGoNote')}</Text>}
        </View>
      )}

      {/* ── Confirmar ── */}
      {step === 'confirm' && slotInfo && (
        <View style={styles.block}>
          <View style={styles.foundCard}>
            <Text style={styles.foundLabel}>{t('trainer.codeProgramLabel')}</Text>
            <Text style={styles.foundName}>{slotInfo.programName}</Text>
          </View>

          {isAlreadyLinked && (
            <View style={styles.warnCard}>
              <Text style={styles.warnText}>{t('trainer.codeAlreadyLinked')}</Text>
            </View>
          )}

          {/* Lo usa otro móvil: el código siempre entra y ese móvil se
              desconecta (C09 §4.6). Se dice antes de pulsar «Conectar». */}
          {slotInfo.alreadyLinked && !googleUserId && (
            <View style={styles.warnCard}>
              <Text style={styles.warnText}>{t('trainer.codeSlotOccupied')}</Text>
            </View>
          )}

          {/* La elección de historial solo existe si hay algo en la nube. */}
          {slotInfo.hasRemoteHistory && !slotInfo.alreadyLinked && (
            <Text style={styles.bulletText}>{t('trainer.codeHistoryFromTrainer')}</Text>
          )}
          {slotInfo.hasRemoteHistory && (
            <Section title={t('trainer.codeHistoryLabel')}>
              {['program', 'merge'].map((mode) => (
                <MenuRow
                  key={mode}
                  label={t(mode === 'program' ? 'trainer.codeHistoryProgram' : 'trainer.codeHistoryMerge')}
                  sub={t(mode === 'program' ? 'trainer.codeHistoryProgramSub' : 'trainer.codeHistoryMergeSub')}
                  subLines={0}
                  minHeight={62}
                  onPress={() => setHistoryMode(mode)}
                  control={historyMode === mode
                    ? <CheckIcon size={16} color={th.colors.accent} />
                    : <View style={styles.checkSpacer} />}
                />
              ))}
            </Section>
          )}

          <View>
            <SectionLabel>{t('trainer.codeWhatHappens')}</SectionLabel>
            <View style={styles.bullets}>
              {['1', '2', '3', '4'].map((n) => (
                <View key={n} style={styles.bulletRow}>
                  <Text style={styles.bulletDot}>·</Text>
                  <Text style={styles.bulletText}>{t(`trainer.codeImplies${n}`)}</Text>
                </View>
              ))}
            </View>
            {/* Conectar es el consentimiento para compartir entrenos y peso
                (política §4, M02-06): la política, a un toque. */}
            {!!PRIVACY_URL && (
              <Text style={styles.link} onPress={() => Linking.openURL(PRIVACY_URL)} accessibilityRole="link">
                {t('paywall.privacy')}
              </Text>
            )}
          </View>

          {!!error && <Text style={styles.error}>{error}</Text>}

          <TouchableOpacity
            style={[styles.primaryBtn, loading && styles.btnDisabled]}
            onPress={handleConfirm}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color={th.colors.onAccent} />
              : <Text style={styles.primaryBtnText}>{t('trainer.codeConnectCta')}</Text>}
          </TouchableOpacity>
        </View>
      )}
    </DragSheet>
  );
}

const makeStyles = (th) => StyleSheet.create({
  block: { gap: spacing.lg, paddingBottom: spacing.md },
  lead:  { ...textStyles.body, color: th.colors.mutedLight, lineHeight: 18 },
  hint:  { ...textStyles.label, color: th.colors.mutedLight, lineHeight: 15, textAlign: 'center' },
  error: { ...textStyles.label, color: th.tint.red50, lineHeight: 15 },

  checkSpacer: { width: 16, height: 16 },

  // Programa encontrado — tratamiento "Resumen": relleno tint/accent-10, sin borde.
  foundCard: {
    backgroundColor: th.tint.accent10,
    borderRadius:    th.radius.md,
    padding:         spacing.lg,
    gap:             spacing.sm,
  },
  foundLabel: { ...textStyles.caps, color: th.colors.accent },
  foundName:  { ...textStyles.itemTitle, color: th.colors.text },

  warnCard: {
    backgroundColor: th.tint.orange30,
    borderRadius:    th.radius.sm,
    padding:         spacing.md,
  },
  warnText: { ...textStyles.label, color: th.tint.orange50, lineHeight: 15 },

  bullets:    { gap: spacing.sm },
  bulletRow:  { flexDirection: 'row', gap: spacing.sm },
  bulletDot:  { ...textStyles.label, color: th.colors.accent, lineHeight: 15 },
  bulletText: { ...textStyles.label, color: th.colors.mutedLight, lineHeight: 15, flex: 1 },
  link:       { ...textStyles.label, color: th.colors.accent, lineHeight: 15, marginTop: spacing.sm },

  ctaGroup: { gap: spacing.sm },

  primaryBtn: {
    height:          44,
    borderRadius:    th.radius.sm,
    backgroundColor: th.colors.accent,
    alignItems:      'center',
    justifyContent:  'center',
  },
  primaryBtnText: { ...textStyles.button, color: th.colors.onAccent },
  secondaryBtn: {
    height:          44,
    borderRadius:    th.radius.sm,
    backgroundColor: th.colors.surface2,
    alignItems:      'center',
    justifyContent:  'center',
  },
  secondaryBtnText: { ...textStyles.button, color: th.colors.text },
  btnDisabled:      { opacity: 0.5 },

  dividerRow:  { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  dividerLine: { flex: 1, height: 1, backgroundColor: th.colors.surface2 },
  dividerText: { ...textStyles.label, color: th.colors.muted },
});
