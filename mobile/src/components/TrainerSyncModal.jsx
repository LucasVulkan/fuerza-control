/**
 * TrainerSyncModal — cómo sincroniza el ENTRENADOR con sus clientes.
 *
 * Se abre la primera vez que entra en Clientes (`trainerSync.mode === null`) y
 * desde el menú principal ("Sincronización con clientes").
 *
 * Cuatro pantallas dentro de la misma hoja:
 *   • select      → elegir modo (Google / código personal / sin conexión)
 *   • code_status → ya hay código guardado: verlo, copiarlo, reautenticarse
 *   • code_reveal → el código recién creado, para guardarlo
 *   • recovery    → recuperar la cuenta con un código existente
 *
 * Pasa a `DragSheet` como el resto de los modales (§9 de docs/UI-MIGRATION.md).
 * Toda la lógica de Supabase/OAuth (claim de slots, fallback por código,
 * refreshTrainerSlots) se conserva tal cual.
 */

import { useState, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, Alert, TextInput,
} from 'react-native';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser  from 'expo-web-browser';
import * as Clipboard   from 'expo-clipboard';
import Constants        from 'expo-constants';
import { Path, G, Circle } from 'react-native-svg';
import { useTranslation } from 'react-i18next';

import { useStore } from '../../store/useStore';
import { setupTrainerCodeAccount, recoverWithTrainerCode, loginTrainerWithIdToken, signOut as supabaseSignOut } from '../services/supabaseAuth';
import { claimTrainerSlots, getTrainerSlots } from '../services/supabaseSync';
import { exchangeCodeForTokens } from '../services/driveService';
import { GOOGLE_CLIENT_ID, GOOGLE_REDIRECT_URI } from '../config/google';
import { APPLE_AUTH_AVAILABLE, signInWithApple } from '../services/appleAuth';
import DragSheet from './DragSheet';
import CodeField from './ui/CodeField';
import AppleSignInButton from './ui/AppleSignInButton';
import { CheckIcon } from './ui/EditorIcons';
import { SectionLabel, RowIcon } from './ui/MenuList';
import { spacing, textStyles, getCardRadii } from '../theme';
import { useTheme, useThemedStyles } from '../useTheme';

// Required so the in-app browser can redirect back after OAuth
WebBrowser.maybeCompleteAuthSession();

const GOOGLE_DISCOVERY = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint:         'https://oauth2.googleapis.com/token',
};

// Los iconos dicen de qué va cada modo: cuenta en la nube, manzana, llave,
// archivos.
const ICON_CLOUD  = <Path d="M6 18a4 4 0 0 1 .6-8 6 6 0 0 1 11.5 2A3.5 3.5 0 0 1 17.5 18z" />;
const ICON_APPLE  = <G><Path d="M16 13c0-2 1.6-3 1.7-3-1-1.4-2.4-1.6-2.9-1.6-1.2-.1-2.4.7-3 .7s-1.6-.7-2.6-.7c-1.3 0-2.6.8-3.2 2-1.4 2.4-.4 6 1 8 .7 1 1.5 2 2.5 2s1.3-.6 2.5-.6 1.5.6 2.6.6 1.7-1 2.4-1.9c.7-1.1 1-2.2 1-2.2s-2-.8-2-3.3z" /><Path d="M14 6.5c.5-.7.9-1.6.8-2.5-.8 0-1.8.5-2.4 1.2-.5.6-1 1.6-.8 2.5.9.1 1.8-.4 2.4-1.2z" /></G>;
const ICON_KEY    = <G><Circle cx="8" cy="12" r="3.5" /><Path d="M11.5 12H21M17 12v3.5" /></G>;
const ICON_FOLDER = <Path d="M3 7h6l2 2h10v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" />;

// Apple va la primera en iOS: su guía pide que Sign in with Apple esté al menos
// tan a la vista como el resto de logins sociales (§4.8). En Android no existe
// el módulo nativo, así que la fila ni se monta.
const MODES = [
  ...(APPLE_AUTH_AVAILABLE ? [{ id: 'apple', icon: ICON_APPLE, expoOnly: true }] : []),
  { id: 'google',  icon: ICON_CLOUD,  expoOnly: true },
  { id: 'code',    icon: ICON_KEY                    },
  { id: 'offline', icon: ICON_FOLDER                 },
];
const MODE_KEY = { google: 'Google', apple: 'Apple', code: 'Code', offline: 'Offline' };

/** Los dos modos que entran con una cuenta de terceros. */
const SOCIAL_MODES = ['google', 'apple'];

// ── Caja del código (verlo y copiarlo) ────────────────────────────────────────

function CodeBox({ code, small }) {
  const styles = useThemedStyles(makeStyles);
  const { t }  = useTranslation();
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await Clipboard.setStringAsync(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <TouchableOpacity style={styles.codeBox} onPress={handleCopy} activeOpacity={0.7}>
      <Text style={[styles.codeText, small && styles.codeTextSm]}>{code}</Text>
      <Text style={styles.codeHint}>{copied ? t('sync.copied') : t('sync.copyHint')}</Text>
    </TouchableOpacity>
  );
}

// ── Campo del nombre visible para los clientes ────────────────────────────────

function NameField({ value, onChange }) {
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { t }  = useTranslation();
  return (
    <View>
      <SectionLabel>{t('sync.nameLabel')}</SectionLabel>
      <TextInput
        style={styles.nameInput}
        placeholder={t('sync.namePlaceholder')}
        placeholderTextColor={th.colors.mutedLight}
        value={value}
        onChangeText={onChange}
        returnKeyType="done"
        autoCorrect={false}
        maxLength={40}
      />
      <Text style={styles.hintLeft}>{t('sync.nameHint')}</Text>
    </View>
  );
}

// ── Modo (fila agrupada con su aviso propio) ──────────────────────────────────

function ModeOption({ mode, active, unavailable, warn, warnTone, onPress, isFirst, isLast }) {
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { t }  = useTranslation();
  return (
    <TouchableOpacity
      style={[
        styles.mode,
        getCardRadii(th, isFirst, isLast),
        // El check solo no bastaba para ver cuál está elegida: la fila activa
        // se tiñe de lima además de agrandar la marca.
        active && !unavailable && styles.modeActive,
        unavailable && styles.modeDisabled,
      ]}
      onPress={() => !unavailable && onPress()}
      activeOpacity={unavailable ? 1 : 0.7}
    >
      <View style={styles.modeTop}>
        <View style={styles.modeIcon}>
          <RowIcon color={active ? th.colors.accent : th.colors.mutedLight}>{mode.icon}</RowIcon>
        </View>
        <View style={styles.modeMeta}>
          <Text style={[styles.modeTitle, active && { color: th.colors.accent }]}>
            {t(`sync.mode${MODE_KEY[mode.id]}Title`)}
          </Text>
          <Text style={styles.modeDesc}>{t(`sync.mode${MODE_KEY[mode.id]}Desc`)}</Text>
          {unavailable && <Text style={styles.modeUnavail}>{t('sync.onlyInstalled')}</Text>}
        </View>
        {!unavailable && (
          active
            ? <View style={styles.checkBadge}><CheckIcon size={16} color={th.colors.onAccent} /></View>
            : <View style={styles.checkSpacer} />
        )}
      </View>
      {active && !!warn && (
        <Text style={[
          styles.modeWarn,
          { color: warnTone === 'good' ? th.colors.accent : th.tint.orange50 },
        ]}>
          {warn}
        </Text>
      )}
    </TouchableOpacity>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────

export default function TrainerSyncModal({ visible, onClose, isFirstTime = true }) {
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { t }  = useTranslation();
  const setTrainerSyncMode = useStore((s) => s.setTrainerSyncMode);
  const setTrainerName     = useStore((s) => s.setTrainerName);
  const trainerSync        = useStore((s) => s.trainerSync);

  const [selected,  setSelected]  = useState(trainerSync.mode ?? 'google');
  const [loading,   setLoading]   = useState(false);
  const [screen,    setScreen]    = useState('select'); // 'select' | 'code_status' | 'code_reveal' | 'recovery'
  const [newCode,   setNewCode]   = useState(null);
  const [nameInput, setNameInput] = useState(trainerSync.trainerName ?? '');

  // Recuperar cuenta (antes una sub-pantalla con su propio estado)
  const [recoverCode,    setRecoverCode]    = useState('');
  const [recoverError,   setRecoverError]   = useState(null);

  // Sync local inputs when modal reopens (Modal stays mounted when hidden in RN).
  // If a code is already stored, jump directly to the "connected" status screen
  // to prevent the trainer from accidentally creating a second account.
  useEffect(() => { // eslint-disable-line react-hooks/exhaustive-deps
    if (visible) {
      setNameInput(trainerSync.trainerName ?? '');
      setSelected(trainerSync.mode ?? 'google');
      setScreen(trainerSync.code ? 'code_status' : 'select');
      setRecoverCode('');
      setRecoverError(null);
    }
  }, [visible]);

  // ── Google OAuth setup ───────────────────────────────────────────────────────
  //
  // expo-auth-session v7: useProxy removed. In Expo Go the redirect URI is always
  // exp://127.0.0.1:8081 (can't be registered in GCC → OAuth disabled in dev).
  // In standalone builds, the reverse-client-ID redirect from config/google is
  // used directly (el cliente de Android o el de iOS según la plataforma).
  //
  const isExpoGo           = Constants.executionEnvironment === 'storeClient';
  const googleClientId     = GOOGLE_CLIENT_ID;
  const googleRedirectUri  = AuthSession.makeRedirectUri({ native: GOOGLE_REDIRECT_URI });

  const [googleRequest, googleResponse, googlePromptAsync] = AuthSession.useAuthRequest(
    {
      clientId:     googleClientId,
      scopes:       ['openid', 'email', 'profile'],
      responseType: AuthSession.ResponseType.Code,
      usePKCE:      true,
      redirectUri:  googleRedirectUri,
      extraParams:  { access_type: 'online', prompt: 'select_account' },
    },
    GOOGLE_DISCOVERY,
  );

  // Stable ref so the async callback always reads the latest codeVerifier
  const googleRequestRef = useRef(googleRequest);
  useEffect(() => { if (googleRequest) googleRequestRef.current = googleRequest; }, [googleRequest]);

  /**
   * Cierra el login social: entra en Supabase con el id_token y arrastra los
   * slots de clientes a la cuenta nueva.
   *
   * Google y Apple solo se diferencian en cómo se consigue ese id_token (OAuth
   * con navegador vs hoja nativa), así que a partir de aquí el camino es el
   * mismo y no se duplica: los slots, el fallback por código y el refresco son
   * idénticos para los dos.
   *
   * `existingSlotIds` se captura FUERA, antes de tocar la sesión: una vez hecho
   * el login la sesión anterior ya no existe.
   */
  async function finishSocialLogin({ provider, idToken, accessToken, existingSlotIds }) {
    const { userId } = await loginTrainerWithIdToken({ provider, idToken, accessToken });
    setTrainerSyncMode(provider, { userId });

    // Collect all slot IDs to claim under the new user.
    // Start with locally-known slots (captures same-device switch to this mode).
    let allSlotIds = [...existingSlotIds];

    // Fallback: if no local slots, try the stored trainer code to find old slots
    // that still belong to the code-based account (e.g. fresh install).
    if (allSlotIds.length === 0) {
      const storedCode = useStore.getState().trainerSync.code;
      if (storedCode) {
        try {
          const { userId: codeUserId } = await recoverWithTrainerCode(storedCode);
          const codeSlots = await getTrainerSlots(codeUserId);
          allSlotIds = codeSlots.map((s) => s.id).filter(Boolean);
        } catch (err) {
          console.error('[TrainerSync] code fallback for slot discovery failed:', err.message);
        }
        // Restore the social session regardless of whether code recovery found slots.
        await loginTrainerWithIdToken({ provider, idToken, accessToken }).catch(() => {});
      }
    }

    // Transfer all found slots to the new user ID.
    if (allSlotIds.length > 0) {
      await claimTrainerSlots(allSlotIds).catch((err) => {
        console.error('[TrainerSync] claimTrainerSlots failed:', err.message);
      });
    }

    // Restore any server slots missing from local state (e.g. fresh install).
    await useStore.getState().refreshTrainerSlots().catch(() => {});

    onClose();
  }

  /** IDs de slot conocidos ahora mismo, antes de que el login cambie la sesión. */
  function currentSlotIds() {
    return Object.values(useStore.getState().clients ?? {})
      .map((c) => c.syncSlotId)
      .filter(Boolean);
  }

  // Handle OAuth redirect response
  useEffect(() => { // eslint-disable-line react-hooks/exhaustive-deps
    if (googleResponse?.type !== 'success') return;
    (async () => {
      setLoading(true);
      try {
        const existingSlotIds = currentSlotIds();

        const tokens = await exchangeCodeForTokens({
          code:         googleResponse.params.code,
          codeVerifier: googleRequestRef.current?.codeVerifier,
          redirectUri:  googleRedirectUri,
          clientId:     googleClientId,
        });
        if (!tokens.id_token) throw new Error(t('sync.errNoIdToken'));

        await finishSocialLogin({
          provider:    'google',
          idToken:     tokens.id_token,
          accessToken: tokens.access_token,
          existingSlotIds,
        });
      } catch (err) {
        Alert.alert(t('sync.errGoogleTitle'), err.message ?? t('sync.errGoogleBody'));
      } finally {
        setLoading(false);
      }
    })();
  }, [googleResponse]); // eslint-disable-line

  /**
   * Apple no necesita el ida y vuelta del navegador: la hoja nativa devuelve el
   * id_token en la misma llamada, así que no hay `response` que observar ni
   * efecto que montar.
   */
  async function handleApple() {
    const existingSlotIds = currentSlotIds();
    setLoading(true);
    try {
      const credential = await signInWithApple();
      if (!credential) return;               // cancelado: ni error ni aviso
      if (!credential.idToken) throw new Error(t('sync.errNoIdToken'));

      // El nombre solo llega la primera vez que este usuario entra con Apple.
      // Si el entrenador aún no puso el suyo, se aprovecha; si ya lo tiene
      // escrito, mandan sus letras.
      if (credential.fullName && !useStore.getState().trainerSync.trainerName) {
        setTrainerName(credential.fullName);
        setNameInput(credential.fullName);
      }

      await finishSocialLogin({
        provider: 'apple',
        idToken:  credential.idToken,
        existingSlotIds,
      });
    } catch (err) {
      Alert.alert(t('sync.errAppleTitle'), err.message ?? t('sync.errGoogleBody'));
    } finally {
      setLoading(false);
    }
  }

  // ── Handlers ─────────────────────────────────────────────────────────────────

  function handleName(v) {
    setNameInput(v);
    setTrainerName(v.trim() || null);
  }

  /** Re-establishes the Supabase session using the code already stored in memory.
   *  Also claims any local client slots that may be owned by a stale userId
   *  (happens when a second trainer code was generated accidentally). */
  async function handleReconnect() {
    setLoading(true);
    try {
      const { userId } = await recoverWithTrainerCode(trainerSync.code);
      setTrainerSyncMode('code', { code: trainerSync.code, userId });

      // Transfer ownership of all local client slots to this userId.
      // Requires the claim_trainer_slots SQL function (SECURITY DEFINER) in Supabase.
      const existingSlotIds = Object.values(
        useStore.getState().clients ?? {}
      ).map((c) => c.syncSlotId).filter(Boolean);
      if (existingSlotIds.length > 0) {
        await claimTrainerSlots(existingSlotIds).catch(() => {
          // Non-fatal if the SQL function isn't deployed yet.
        });
      }

      onClose();
    } catch (err) {
      Alert.alert(t('sync.errReconnectTitle'), err.message ?? t('sync.errReconnectBody'));
    } finally {
      setLoading(false);
    }
  }

  async function handleRecover() {
    if (!recoverCode.trim()) return;
    setLoading(true);
    setRecoverError(null);
    try {
      const { userId } = await recoverWithTrainerCode(recoverCode);
      setTrainerSyncMode('code', { code: recoverCode.trim().toUpperCase(), userId });
      setScreen('select');
      onClose();
    } catch (err) {
      setRecoverError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function doSwitch() {
    if (selected === 'offline') {
      await supabaseSignOut().catch(() => {});
      setTrainerSyncMode('offline');
      onClose();
      return;
    }

    if (selected === 'google') {
      googlePromptAsync();
      return;
    }

    if (selected === 'apple') {
      handleApple();
      return;
    }

    if (selected === 'code') {
      setLoading(true);
      try {
        // Collect existing slot IDs BEFORE signing out so we can re-claim them
        const existingSlotIds = Object.values(
          useStore.getState().clients ?? {}
        ).map((c) => c.syncSlotId).filter(Boolean);

        await supabaseSignOut().catch(() => {});
        const { code, userId } = await setupTrainerCodeAccount();
        setTrainerSyncMode('code', { code, userId });

        // Re-associate any existing client slots with the new trainer userId.
        // Requires the claim_trainer_slots SQL function in Supabase.
        if (existingSlotIds.length > 0) {
          await claimTrainerSlots(existingSlotIds).catch(() => {
            // Non-fatal: SQL function may not be deployed yet.
          });
        }

        setNewCode(code);
        setScreen('code_reveal');
      } catch (err) {
        Alert.alert(t('sync.errAccountTitle'), err.message ?? t('sync.errAccountBody'));
      } finally {
        setLoading(false);
      }
    }
  }

  function handleConfirm() {
    const existingMode = trainerSync.mode;
    // Warn when switching away from an already-configured mode
    if (existingMode && existingMode !== 'offline' && existingMode !== selected) {
      const isUpgrade = existingMode === 'code' && SOCIAL_MODES.includes(selected);
      Alert.alert(
        t(isUpgrade ? 'sync.switchUpgradeTitle' : 'sync.switchTitle'),
        t(isUpgrade ? 'sync.switchUpgradeBody'  : 'sync.switchBody'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t(isUpgrade ? 'sync.switchUpgradeConfirm' : 'sync.switchConfirm'),
            style: isUpgrade ? 'default' : 'destructive',
            onPress: doSwitch,
          },
        ],
      );
      return;
    }
    doSwitch();
  }

  const currentMode = trainerSync.mode;
  // Ya está esa cuenta puesta y es la opción elegida: no hay nada que
  // confirmar, solo cambiar de cuenta (enlace aparte).
  const alreadyLinked = SOCIAL_MODES.includes(selected) && currentMode === selected;

  // Aviso por modo: el genérico del código, el de "ya tienes uno" y el de que
  // pasar a una cuenta migra los clientes solo (esto último es buena noticia,
  // va en lima; el resto en naranja).
  function warnFor(modeId) {
    if (modeId === 'code' && trainerSync.code)               return { text: t('sync.warnCodeExists'), tone: 'warn' };
    if (modeId === 'code')                                   return { text: t('sync.modeCodeWarn'),   tone: 'warn' };
    if (SOCIAL_MODES.includes(modeId) && trainerSync.code)   return { text: t('sync.warnUpgrade'),    tone: 'good' };
    return { text: null, tone: 'warn' };
  }

  const titles = {
    select:      isFirstTime ? t('sync.titleFirstTime') : t('sync.title'),
    code_status: isFirstTime ? t('sync.titleFirstTime') : t('sync.title'),
    code_reveal: t('sync.revealTitle'),
    recovery:    t('sync.recoveryTitle'),
  };

  const action = screen === 'code_reveal'
    ? { label: t('common.accept'),      onPress: () => { setScreen('select'); onClose(); } }
    : screen === 'recovery'
      ? { label: t('trainer.codeBack'), onPress: () => setScreen('select') }
      : { label: isFirstTime ? t('common.accept') : t('common.cancel'), onPress: onClose };

  return (
    <DragSheet
      visible={visible}
      onClose={onClose}
      title={titles[screen]}
      action={action}
    >
      {/* ── Ya hay código guardado ── */}
      {screen === 'code_status' && (
        <View style={styles.block}>
          <View style={styles.stateCard}>
            <View style={styles.stateTagRow}>
              <View style={styles.stateDot} />
              <Text style={styles.stateTag}>{t('sync.statusTag')}</Text>
            </View>
            <Text style={styles.stateTitle}>{t('sync.statusTitle')}</Text>
            <Text style={styles.stateSub}>{t('sync.statusSub')}</Text>
          </View>

          <View>
            <SectionLabel>{t('sync.yourCodeLabel')}</SectionLabel>
            <CodeBox code={trainerSync.code} small />
          </View>

          <NameField value={nameInput} onChange={handleName} />

          <TouchableOpacity
            style={[styles.secondaryBtn, loading && styles.btnDisabled]}
            onPress={handleReconnect}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading
              ? <ActivityIndicator color={th.colors.text} size="small" />
              : <Text style={styles.secondaryBtnText}>{t('sync.reauthCta')}</Text>}
          </TouchableOpacity>
          <Text style={styles.hint}>{t('sync.reauthHint')}</Text>

          <TouchableOpacity onPress={() => setScreen('select')} activeOpacity={0.7}>
            <Text style={styles.link}>{t('sync.changeModeLink')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Código recién creado ── */}
      {screen === 'code_reveal' && newCode && (
        <View style={styles.block}>
          <Text style={styles.lead}>{t('sync.revealLead')}</Text>

          <CodeBox code={newCode} />

          <View style={styles.warnCard}>
            <Text style={styles.warnText}>{t('sync.revealWarn')}</Text>
          </View>

          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => { setScreen('select'); onClose(); }}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryBtnText}>{t('sync.revealCta')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Recuperar cuenta ── */}
      {screen === 'recovery' && (
        <View style={styles.block}>
          <Text style={styles.lead}>{t('sync.recoveryLead')}</Text>

          <CodeField
            value={recoverCode}
            onChangeText={(v) => { setRecoverCode(v); setRecoverError(null); }}
            groups={3}
            onSubmitEditing={handleRecover}
            error={recoverError}
          />

          <TouchableOpacity
            style={[styles.primaryBtn, (!recoverCode.trim() || loading) && styles.btnDisabled]}
            onPress={handleRecover}
            disabled={!recoverCode.trim() || loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color={th.colors.onAccent} />
              : <Text style={styles.primaryBtnText}>{t('sync.recoveryCta')}</Text>}
          </TouchableOpacity>
        </View>
      )}

      {/* ── Elegir modo ── */}
      {screen === 'select' && (
        <View style={styles.block}>
          <Text style={styles.lead}>{t('sync.selectLead')}</Text>

          <View style={styles.modes}>
            {MODES.map((mode, i) => {
              const { text, tone } = warnFor(mode.id);
              return (
                <ModeOption
                  key={mode.id}
                  mode={mode}
                  active={selected === mode.id}
                  unavailable={mode.expoOnly && isExpoGo}
                  warn={text}
                  warnTone={tone}
                  onPress={() => setSelected(mode.id)}
                  isFirst={i === 0}
                  isLast={i === MODES.length - 1}
                />
              );
            })}
          </View>

          <NameField value={nameInput} onChange={handleName} />

          {/* Apple prohíbe arrancar su login desde un botón propio: tiene que
              ser el nativo. Por eso el CTA cambia de forma con el modo elegido
              en vez de repintarse de lima con otro texto.

              Y a diferencia de Google, aquí el botón sigue activo estando ya
              conectado: volver a pulsarlo es justo lo que permite cambiar de
              cuenta, que en Google es el enlace de abajo. */}
          {selected === 'apple' ? (
            <AppleSignInButton onPress={handleConfirm} disabled={loading || isExpoGo} />
          ) : (
            <TouchableOpacity
              style={[
                styles.primaryBtn,
                (loading || alreadyLinked || (selected === 'google' && isExpoGo)) && styles.btnDisabled,
              ]}
              onPress={handleConfirm}
              disabled={loading || alreadyLinked || (selected === 'google' && isExpoGo)}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color={th.colors.onAccent} />
                : (
                  <Text style={styles.primaryBtnText}>
                    {t(alreadyLinked          ? 'sync.ctaConnected'
                      : selected === 'offline' ? 'sync.ctaOffline'
                      : selected === 'google'  ? 'sync.ctaGoogle'
                      : 'sync.ctaCode')}
                  </Text>
                )}
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={() => alreadyLinked && selected === 'google' ? googlePromptAsync() : setScreen('recovery')}
            activeOpacity={0.7}
          >
            <Text style={styles.link}>
              {alreadyLinked && selected === 'google' ? t('sync.reauthGoogleLink')
                : currentMode === 'code'              ? t('sync.reauthLink')
                : t('sync.recoveryLink')}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </DragSheet>
  );
}

const makeStyles = (th) => StyleSheet.create({
  block: { gap: spacing.lg, paddingBottom: spacing.md },
  lead:  { ...textStyles.subtitle, color: th.colors.mutedLight, lineHeight: 18 },
  hint:  {
    ...textStyles.tag,
    color:      th.colors.mutedLight,
    lineHeight: 15,
    textAlign:  'center',
    marginTop:  -spacing.md,
  },
  hintLeft: { ...textStyles.tag, color: th.colors.mutedLight, lineHeight: 15, marginTop: spacing.sm },
  link:     { ...textStyles.cardType, color: th.tint.accent50, textAlign: 'center' },

  // Estado "ya conectado" — tratamiento "Resumen" (tint/accent-10, sin borde).
  stateCard: {
    backgroundColor: th.tint.accent10,
    borderRadius:    th.radius.md,
    padding:         spacing.lg,
    gap:             spacing.sm,
  },
  stateTagRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  stateDot:    { width: 7, height: 7, borderRadius: 3.5, backgroundColor: th.colors.accent },
  stateTag:    { ...textStyles.spacingTag, color: th.colors.mutedLight },
  stateTitle:  { ...textStyles.cardTitle, color: th.colors.text },
  stateSub:    { ...textStyles.tag, color: th.tint.accent50, lineHeight: 15 },

  // Caja del código: el código es el protagonista, con la pista de copiar debajo.
  codeBox: {
    backgroundColor: th.colors.surface,
    borderRadius:    th.radius.md,
    paddingVertical: spacing.lg,
    alignItems:      'center',
    gap:             spacing.sm,
  },
  codeText: {
    fontFamily:    'Inter_900Black',
    fontSize:      26,
    letterSpacing: 4,
    color:         th.colors.accent,
    fontVariant:   ['tabular-nums'],
  },
  codeTextSm: { fontSize: 20 },
  codeHint:   { ...textStyles.tag, color: th.colors.mutedLight },

  // Modos, como lista agrupada (gap 2 + radios por posición) pero con sitio para
  // el aviso propio de cada uno, que MenuRow no contempla.
  modes: { gap: spacing.xs },
  mode: {
    backgroundColor:   th.colors.surface,
    paddingHorizontal: spacing.lg,
    paddingVertical:   spacing.md,
    gap:               spacing.sm,
  },
  modeActive:   { backgroundColor: th.tint.accent10 },
  modeDisabled: { opacity: 0.45 },
  modeTop:      { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.lg },
  modeIcon:     { width: 20, alignItems: 'center', paddingTop: 2, flexShrink: 0 },
  modeMeta:     { flex: 1, minWidth: 0, gap: spacing.xs },
  modeTitle:    { fontFamily: 'Inter_800ExtraBold', fontSize: 14, color: th.colors.text },
  modeDesc:     { ...textStyles.tag, color: th.colors.mutedLight, lineHeight: 15 },
  modeUnavail:  { ...textStyles.tag, color: th.tint.orange50, lineHeight: 15 },
  modeWarn:     { ...textStyles.tag, lineHeight: 15, paddingLeft: 20 + spacing.lg },
  // Marca de elegida: disco lima con el check en negativo. Ocupa 24 para que se
  // vea de un vistazo; el hueco de las no elegidas mide lo mismo.
  checkBadge: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: th.colors.accent,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  checkSpacer:  { width: 24, height: 24 },

  warnCard: {
    backgroundColor: th.tint.orange30,
    borderRadius:    th.radius.sm,
    padding:         spacing.md,
  },
  warnText: { ...textStyles.tag, color: th.tint.orange50, lineHeight: 15 },

  nameInput: {
    backgroundColor:   th.colors.surface2,
    borderRadius:      th.radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.sm,
    ...textStyles.cardTitle,
    color:             th.colors.text,
  },

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
});
