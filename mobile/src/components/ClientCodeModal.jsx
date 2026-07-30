/**
 * ClientCodeModal — el cliente se conecta con su entrenador.
 *
 * Tres pantallas dentro de la misma hoja:
 *   • código      → teclea el XXXX-XXXX que le dio su entrenador
 *   • Google      → (abierta con `startWithGoogle`) busca su cuenta ya vinculada
 *   • confirmar   → qué programa ha encontrado y qué implica conectarse
 *
 * Pasa a `DragSheet` como el resto de los modales de la app (§9 de
 * docs/UI-MIGRATION.md): fuera la tarjeta centrada con borde. Toda la lógica
 * (OAuth, validación, linkToTrainer/confirmGoogleReconnect) se conserva.
 */

import { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser  from 'expo-web-browser';
import Constants        from 'expo-constants';
import { useTranslation } from 'react-i18next';

import { useStore }              from '../../store/useStore';
import { exchangeCodeForTokens } from '../services/driveService';
import { GOOGLE_ANDROID_CLIENT_ID } from '../config/google';
import DragSheet from './DragSheet';
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

export default function ClientCodeModal({ visible, onClose, onSuccess, startWithGoogle = false }) {
  const th        = useTheme();
  const styles    = useThemedStyles(makeStyles);
  const { t }     = useTranslation();
  const validateClientCode     = useStore((s) => s.validateClientCode);
  const linkToTrainer          = useStore((s) => s.linkToTrainer);
  const validateGoogleClient   = useStore((s) => s.validateGoogleClient);
  const confirmGoogleReconnect = useStore((s) => s.confirmGoogleReconnect);
  const clientSync             = useStore((s) => s.clientSync);

  const [step,         setStep]         = useState('enter'); // 'enter' | 'confirm'
  const [code,         setCode]         = useState('');
  const [slotInfo,     setSlotInfo]     = useState(null); // { slotId, programName, alreadyLinked, hasRemoteHistory }
  const [historyMode,  setHistoryMode]  = useState('program'); // 'program' | 'merge'
  const [googleUserId, setGoogleUserId] = useState(null);  // set when Google reconnect finds a slot
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState(null);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleNoSlot,  setGoogleNoSlot]  = useState(false);

  // ── Google OAuth for auto-reconnect ────────────────────────────────────────
  const isExpoGo         = Constants.executionEnvironment === 'storeClient';
  const androidRedirect  = `com.googleusercontent.apps.${GOOGLE_ANDROID_CLIENT_ID.replace('.apps.googleusercontent.com', '')}:/oauth2redirect`;
  const googleRedirectUri = AuthSession.makeRedirectUri({ native: androidRedirect });

  const [googleRequest, googleResponse, googlePromptAsync] = AuthSession.useAuthRequest(
    {
      clientId:     GOOGLE_ANDROID_CLIENT_ID,
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

  // Auto-trigger Google OAuth when opened via the "reconnect with Google" button
  useEffect(() => {
    if (!startWithGoogle || !visible) {
      hasAutoTriggered.current = false;
      return;
    }
    if (googleRequest && !hasAutoTriggered.current) {
      hasAutoTriggered.current = true;
      setGoogleNoSlot(false);
      setError(null);
      googlePromptAsync();
    }
  }, [startWithGoogle, visible, googleRequest]); // eslint-disable-line

  useEffect(() => { // eslint-disable-line react-hooks/exhaustive-deps
    if (googleResponse?.type !== 'success') return;
    (async () => {
      setGoogleLoading(true);
      setError(null);
      setGoogleNoSlot(false);
      try {
        const tokens = await exchangeCodeForTokens({
          code:         googleResponse.params.code,
          codeVerifier: googleRequestRef.current?.codeVerifier,
          redirectUri:  googleRedirectUri,
          clientId:     GOOGLE_ANDROID_CLIENT_ID,
        });
        if (!tokens.id_token) throw new Error(t('trainer.errNoIdToken'));
        const result = await validateGoogleClient({ idToken: tokens.id_token, accessToken: tokens.access_token });
        if (result.found) {
          setGoogleUserId(result.userId);
          setSlotInfo({
            slotId:           result.slotId,
            programName:      result.programName,
            hasRemoteHistory: result.hasRemoteHistory,
            alreadyLinked:    false,
          });
          setHistoryMode('program');
          setStep('confirm');
        } else {
          setGoogleNoSlot(true);
        }
      } catch (err) {
        setError(err.message ?? t('trainer.errGoogle'));
      } finally {
        setGoogleLoading(false);
      }
    })();
  }, [googleResponse]); // eslint-disable-line

  function handleClose() {
    setStep('enter');
    setCode('');
    setSlotInfo(null);
    setHistoryMode('program');
    setGoogleUserId(null);
    setGoogleNoSlot(false);
    setError(null);
    onClose();
  }

  async function handleValidate() {
    if (!code.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const info = await validateClientCode(code);
      setSlotInfo(info);
      setStep('confirm');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm() {
    setLoading(true);
    setError(null);
    try {
      if (googleUserId) {
        await confirmGoogleReconnect({
          slotId:       slotInfo.slotId,
          googleUserId,
          mergeHistory: historyMode === 'merge',
        });
      } else {
        await linkToTrainer(code, { mergeHistory: historyMode === 'merge' });
      }
      handleClose();
      onSuccess?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const isAlreadyLinked = !!clientSync.slotId;
  const isGoogleScreen  = step === 'enter' && startWithGoogle;

  // Los títulos de hoja de la app van en caso normal y cortos ("Añadir",
  // "Tempo"), no en mayúsculas como los botones.
  const title = step === 'confirm'
    ? t(googleUserId ? 'trainer.codeFoundAccount' : 'trainer.codeFoundProgram')
    : t(isGoogleScreen ? 'trainer.googleTitle' : 'trainer.codeTitle');

  return (
    <DragSheet
      visible={visible}
      onClose={handleClose}
      background={th.colors.bg}
      title={title}
      // El hueco de la derecha de la hoja hace de salida: atrás en el paso de
      // confirmación, cancelar en los demás. Así no hay dos botones abajo.
      action={step === 'confirm'
        ? { label: t('trainer.codeBack'), onPress: () => setStep('enter') }
        : { label: t('common.cancel'),    onPress: handleClose }}
    >
      {/* ── Buscando la cuenta de Google ── */}
      {isGoogleScreen && (
        <View style={styles.block}>
          <Text style={styles.lead}>
            {googleNoSlot ? t('trainer.googleNoSlot') : t('trainer.googleSearching')}
          </Text>

          {googleLoading && <ActivityIndicator color={th.colors.accent} />}
          {!!error && <Text style={styles.error}>{error}</Text>}
          {isExpoGo && <Text style={styles.hint}>{t('trainer.expoGoNote')}</Text>}

          {(googleNoSlot || error) && !googleLoading && (
            <TouchableOpacity
              style={[styles.primaryBtn, isExpoGo && styles.btnDisabled]}
              onPress={() => {
                setGoogleNoSlot(false);
                setError(null);
                hasAutoTriggered.current = false;
                googlePromptAsync();
              }}
              disabled={isExpoGo}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryBtnText}>{t('trainer.retryCta')}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* ── Teclear el código ── */}
      {step === 'enter' && !startWithGoogle && (
        <View style={styles.block}>
          <Text style={styles.lead}>{t('trainer.codeLead')}</Text>

          <CodeField
            value={code}
            onChangeText={(v) => { setCode(v); setError(null); }}
            groups={2}
            onSubmitEditing={handleValidate}
            autoFocus
            error={error}
          />

          <TouchableOpacity
            style={[styles.primaryBtn, (!code.trim() || loading) && styles.btnDisabled]}
            onPress={handleValidate}
            disabled={!code.trim() || loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color={th.colors.onAccent} />
              : <Text style={styles.primaryBtnText}>{t('trainer.codeContinue')}</Text>}
          </TouchableOpacity>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>{t('trainer.or')}</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity
            style={[styles.secondaryBtn, (googleLoading || isExpoGo) && styles.btnDisabled]}
            onPress={() => { setGoogleNoSlot(false); setError(null); googlePromptAsync(); }}
            disabled={googleLoading || isExpoGo}
            activeOpacity={0.8}
          >
            {googleLoading
              ? <ActivityIndicator color={th.colors.text} size="small" />
              : <Text style={styles.secondaryBtnText}>{t('trainer.googleCta')}</Text>}
          </TouchableOpacity>
          <Text style={styles.hint}>
            {googleNoSlot ? t('trainer.googleNoSlot') : t('trainer.googleCtaHint')}
          </Text>
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

          {/* La elección de historial solo existe si hay algo en la nube. */}
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
  lead:  { ...textStyles.subtitle, color: th.colors.mutedLight, lineHeight: 18 },
  hint:  { ...textStyles.tag, color: th.colors.mutedLight, lineHeight: 15, textAlign: 'center' },
  error: { ...textStyles.tag, color: th.tint.red50, lineHeight: 15 },

  checkSpacer: { width: 16, height: 16 },

  // Programa encontrado — tratamiento "Resumen": relleno tint/accent-10, sin borde.
  foundCard: {
    backgroundColor: th.tint.accent10,
    borderRadius:    th.radius.md,
    padding:         spacing.lg,
    gap:             spacing.sm,
  },
  foundLabel: { ...textStyles.spacingTag, color: th.colors.accent },
  foundName:  { ...textStyles.cardTitle, color: th.colors.text },

  warnCard: {
    backgroundColor: th.tint.orange30,
    borderRadius:    th.radius.sm,
    padding:         spacing.md,
  },
  warnText: { ...textStyles.tag, color: th.tint.orange50, lineHeight: 15 },

  bullets:    { gap: spacing.sm },
  bulletRow:  { flexDirection: 'row', gap: spacing.sm },
  bulletDot:  { ...textStyles.tag, color: th.colors.accent, lineHeight: 15 },
  bulletText: { ...textStyles.tag, color: th.colors.mutedLight, lineHeight: 15, flex: 1 },

  primaryBtn: {
    height:          44,
    borderRadius:    th.radius.sm,
    backgroundColor: th.colors.accent,
    alignItems:      'center',
    justifyContent:  'center',
  },
  primaryBtnText: { ...textStyles.btnAction, color: th.colors.onAccent },
  secondaryBtn: {
    height:          44,
    borderRadius:    th.radius.sm,
    backgroundColor: th.colors.surface2,
    alignItems:      'center',
    justifyContent:  'center',
  },
  secondaryBtnText: { ...textStyles.btnAction, color: th.colors.text },
  btnDisabled:      { opacity: 0.5 },

  dividerRow:  { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  dividerLine: { flex: 1, height: 1, backgroundColor: th.colors.surface2 },
  dividerText: { ...textStyles.tag, color: th.colors.muted },
});
