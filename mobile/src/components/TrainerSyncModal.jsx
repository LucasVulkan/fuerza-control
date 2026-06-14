/**
 * TrainerSyncModal
 *
 * Shown the first time a trainer opens the Clients screen (trainerSync.mode === null).
 * Also accessible from the hamburger menu as "Modo de sincronización".
 *
 * Three options:
 *  - 'offline'  → no Supabase, manual file sharing as before
 *  - 'code'     → anonymous Supabase account + generated recovery code
 *  - 'google'   → Google OAuth via expo-auth-session → supabase.auth.signInWithIdToken
 */

import { useState, useRef, useEffect } from 'react';
import {
  View, Text, Modal, TouchableOpacity,
  ActivityIndicator, StyleSheet, ScrollView, Alert,
  TextInput, Platform, KeyboardAvoidingView,
} from 'react-native';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser  from 'expo-web-browser';
import Constants        from 'expo-constants';
import * as Clipboard from 'expo-clipboard';
import { useStore } from '../../store/useStore';
import { setupTrainerCodeAccount, recoverWithTrainerCode, loginWithGoogleTrainer, signOut as supabaseSignOut } from '../services/supabaseAuth';
import { claimTrainerSlots, getTrainerSlots } from '../services/supabaseSync';
import { exchangeCodeForTokens } from '../services/driveService';
import { GOOGLE_ANDROID_CLIENT_ID } from '../config/google';
import { spacing, typography, borders, withOpacity } from '../theme';
import { useTheme, useThemedStyles } from '../useTheme';

// Required so the in-app browser can redirect back after OAuth
WebBrowser.maybeCompleteAuthSession();

// ── Option definitions ─────────────────────────────────────────────────────────

const MODES = [
  {
    id:       'google',
    icon:     '🔵',
    title:    'Google',
    desc:     'Inicia sesión con tu cuenta de Google. No necesitas guardar ningún código — tu cuenta de Google es tu clave de recuperación.',
    warn:     null,
    expoOnly: true, // disabled in Expo Go — will be checked at render time
  },
  {
    id:    'code',
    icon:  '🔑',
    title: 'Código personal',
    desc:  'Se genera un código único que debes guardar. Lo necesitarás si cambias de móvil o reinstallas la app. Todo lo demás es automático.',
    warn:  'Eres responsable de guardar el código. Sin él no podrás recuperar tu cuenta.',
  },
  {
    id:    'offline',
    icon:  '📁',
    title: 'Sin conexión',
    desc:  'Comparte programas e historial manualmente exportando e importando archivos. No se necesita cuenta.',
    warn:  null,
  },
];

// ── Sub-screen: Already connected (code stored in memory) ─────────────────────

function CodeStatusScreen({ code, loading, nameInput, setNameInput, setTrainerName, onReconnect, onChangeMode, onClose, isFirstTime }) {
  const th = useTheme();
  const s = useThemedStyles(makeS);
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await Clipboard.setStringAsync(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleChangeMode() {
    onChangeMode();
  }

  return (
    <View style={s.codeStatus}>
      <Text style={s.title}>
        {isFirstTime ? 'Gestión de clientes' : 'Sincronización'}
      </Text>

      <View style={s.connectedRow}>
        <View style={s.connectedDot} />
        <Text style={s.connectedText}>Ya estás conectado</Text>
      </View>

      <Text style={s.codeStatusDesc}>
        No pierdas el código. Podrías necesitarlo en el futuro para reconectarte.
      </Text>

      <TouchableOpacity style={[s.codeBox, s.codeBoxSm]} onPress={handleCopy} activeOpacity={0.7}>
        <Text style={[s.codeText, s.codeTextSm]}>{code}</Text>
        <Text style={s.codeCopyHint}>{copied ? '✓ Copiado' : 'Toca para copiar'}</Text>
      </TouchableOpacity>

      <View style={s.nameRow}>
        <Text style={s.nameLabel}>TU NOMBRE (PARA CLIENTES)</Text>
        <TextInput
          style={s.nameInput}
          placeholder="Ej. Lucas García"
          placeholderTextColor={th.colors.muted}
          value={nameInput}
          onChangeText={(t) => { setNameInput(t); setTrainerName(t.trim() || null); }}
          returnKeyType="done"
          autoCorrect={false}
        />
      </View>

      <View style={s.actions}>
        {!isFirstTime && (
          <TouchableOpacity style={s.cancelBtn} onPress={onClose} activeOpacity={0.7}>
            <Text style={s.cancelBtnText}>Cerrar</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[s.primaryBtn, { flex: 1 }, loading && { opacity: 0.5 }]}
          onPress={onReconnect}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator color={th.colors.bg} />
            : <Text style={s.primaryBtnText}>Aceptar</Text>}
        </TouchableOpacity>
      </View>

      <TouchableOpacity onPress={handleChangeMode} style={s.recoveryLink}>
        <Text style={[s.recoveryLinkText, { color: th.colors.muted }]}>
          Cambiar modo de sincronización →
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Sub-screen: Code generated ─────────────────────────────────────────────────

function CodeRevealScreen({ code, onDone }) {
  const s = useThemedStyles(makeS);
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await Clipboard.setStringAsync(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <View style={s.reveal}>
      <Text style={s.revealTitle}>Tu código personal</Text>
      <Text style={s.revealSub}>
        Guárdalo en un lugar seguro. Lo necesitarás si cambias de móvil o reinstallas la app.
      </Text>

      <TouchableOpacity style={s.codeBox} onPress={handleCopy} activeOpacity={0.7}>
        <Text style={s.codeText}>{code}</Text>
        <Text style={s.codeCopyHint}>{copied ? '✓ Copiado' : 'Toca para copiar'}</Text>
      </TouchableOpacity>

      <View style={s.warnBox}>
        <Text style={s.warnText}>
          ⚠️ Sin este código no podrás recuperar tu cuenta si pierdes el móvil.
        </Text>
      </View>

      <TouchableOpacity style={s.primaryBtn} onPress={onDone} activeOpacity={0.85}>
        <Text style={s.primaryBtnText}>He guardado el código</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Sub-screen: Recovery ───────────────────────────────────────────────────────

function RecoveryScreen({ onSuccess, onBack }) {
  const th = useTheme();
  const s = useThemedStyles(makeS);
  const [code,    setCode]    = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);
  const [pasted,  setPasted]  = useState(false);

  async function handlePaste() {
    const text = await Clipboard.getStringAsync();
    if (text?.trim()) {
      setCode(text.trim().toUpperCase());
      setError(null);
      setPasted(true);
      setTimeout(() => setPasted(false), 1500);
    }
  }

  const setTrainerSyncMode = useStore((s) => s.setTrainerSyncMode);

  async function handleRecover() {
    if (!code.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const { userId } = await recoverWithTrainerCode(code);
      setTrainerSyncMode('code', { code: code.trim().toUpperCase(), userId });
      onSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={s.recovery}>
      <Text style={s.revealTitle}>Recuperar cuenta</Text>
      <Text style={s.revealSub}>Introduce tu código de entrenador para recuperar el acceso.</Text>

      <TextInput
        style={s.codeInput}
        placeholder="XXXX-XXXX-XXXX"
        placeholderTextColor={th.colors.muted}
        value={code}
        onChangeText={(t) => { setCode(t.toUpperCase()); setError(null); }}
        autoCapitalize="characters"
        autoCorrect={false}
        returnKeyType="done"
        onSubmitEditing={handleRecover}
      />
      <TouchableOpacity onPress={handlePaste} style={s.pasteBtn} activeOpacity={0.7}>
        <Text style={s.pasteBtnText}>{pasted ? '✓ Pegado' : '📋 Pegar'}</Text>
      </TouchableOpacity>

      {error && <Text style={s.errorText}>{error}</Text>}

      <TouchableOpacity
        style={[s.primaryBtn, (!code.trim() || loading) && { opacity: 0.5 }]}
        onPress={handleRecover}
        disabled={!code.trim() || loading}
        activeOpacity={0.85}
      >
        {loading
          ? <ActivityIndicator color={th.colors.bg} />
          : <Text style={s.primaryBtnText}>Recuperar</Text>}
      </TouchableOpacity>

      <TouchableOpacity onPress={onBack} style={s.backLink}>
        <Text style={s.backLinkText}>← Volver</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Google OAuth constants ─────────────────────────────────────────────────────

const GOOGLE_DISCOVERY = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint:         'https://oauth2.googleapis.com/token',
};

// ── Main modal ─────────────────────────────────────────────────────────────────

export default function TrainerSyncModal({ visible, onClose, isFirstTime = true }) {
  const th = useTheme();
  const s = useThemedStyles(makeS);
  const setTrainerSyncMode = useStore((s) => s.setTrainerSyncMode);
  const setTrainerName     = useStore((s) => s.setTrainerName);
  const trainerSync        = useStore((s) => s.trainerSync);

  const [selected,     setSelected]     = useState(trainerSync.mode ?? 'google');
  const [loading,      setLoading]      = useState(false);
  const [screen,       setScreen]       = useState('select'); // 'select' | 'code_reveal' | 'recovery'
  const [newCode,      setNewCode]      = useState(null);
  const [nameInput,    setNameInput]    = useState(trainerSync.trainerName ?? '');

  // Sync local inputs when modal reopens (Modal stays mounted when hidden in RN).
  // If a code is already stored, jump directly to the "connected" status screen
  // to prevent the trainer from accidentally creating a second account.
  useEffect(() => { // eslint-disable-line react-hooks/exhaustive-deps
    if (visible) {
      setNameInput(trainerSync.trainerName ?? '');
      setSelected(trainerSync.mode ?? 'google');
      setScreen(trainerSync.code ? 'code_status' : 'select');
    }
  }, [visible]);

  // ── Google OAuth setup ───────────────────────────────────────────────────────
  //
  // expo-auth-session v7: useProxy removed. In Expo Go the redirect URI is always
  // exp://127.0.0.1:8081 (can't be registered in GCC → OAuth disabled in dev).
  // In standalone builds, native: 'forma://oauth2redirect' is used directly.
  // Registered in GCC as a Desktop app client redirect URI. See google.js.
  //
  const isExpoGo          = Constants.executionEnvironment === 'storeClient';
  const googleClientId    = GOOGLE_ANDROID_CLIENT_ID;
  const androidRedirectUri = `com.googleusercontent.apps.${GOOGLE_ANDROID_CLIENT_ID.replace('.apps.googleusercontent.com', '')}:/oauth2redirect`;
  const googleRedirectUri  = AuthSession.makeRedirectUri({ native: androidRedirectUri });

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

  // Handle OAuth redirect response
  useEffect(() => { // eslint-disable-line react-hooks/exhaustive-deps
    if (googleResponse?.type !== 'success') return;
    (async () => {
      setLoading(true);
      try {
        // Capture existing slot IDs BEFORE the Google login changes the session.
        // claimTrainerSlots (called after) will reassign them to the new Google user ID.
        const existingSlotIds = Object.values(
          useStore.getState().clients ?? {}
        ).map((c) => c.syncSlotId).filter(Boolean);

        const tokens = await exchangeCodeForTokens({
          code:         googleResponse.params.code,
          codeVerifier: googleRequestRef.current?.codeVerifier,
          redirectUri:  googleRedirectUri,
          clientId:     googleClientId,
        });
        if (!tokens.id_token) throw new Error('Google no devolvió un id_token. Inténtalo de nuevo.');
        const { userId } = await loginWithGoogleTrainer({
          idToken:     tokens.id_token,
          accessToken: tokens.access_token,
        });
        setTrainerSyncMode('google', { userId });

        // Collect all slot IDs to claim under the Google user.
        // Start with locally-known slots (captures same-device switch to Google mode).
        let allSlotIds = [...existingSlotIds];

        // Fallback: if no local slots, try the stored trainer code to find old slots
        // that still belong to the code-based account (e.g. fresh install with Google).
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
            // Restore the Google session regardless of whether code recovery found slots.
            await loginWithGoogleTrainer({ idToken: tokens.id_token, accessToken: tokens.access_token })
              .catch(() => {});
          }
        }

        // Transfer all found slots to the Google user ID.
        if (allSlotIds.length > 0) {
          await claimTrainerSlots(allSlotIds).catch((err) => {
            console.error('[TrainerSync] claimTrainerSlots failed:', err.message);
          });
        }

        // Restore any server slots missing from local state (e.g. fresh install).
        await useStore.getState().refreshTrainerSlots().catch(() => {});

        onClose();
      } catch (err) {
        Alert.alert('Error', err.message ?? 'No se pudo iniciar sesión con Google.');
      } finally {
        setLoading(false);
      }
    })();
  }, [googleResponse]); // eslint-disable-line

  // ── Handlers ─────────────────────────────────────────────────────────────────

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
      Alert.alert('Error al reconectar', err.message ?? 'No se pudo recuperar la sesión. Comprueba tu código.');
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
            // Trainer will see RLS errors on old slots until it is.
          });
        }

        setNewCode(code);
        setScreen('code_reveal');
      } catch (err) {
        Alert.alert('Error', err.message ?? 'No se pudo crear la cuenta. Inténtalo de nuevo.');
      } finally {
        setLoading(false);
      }
    }
  }

  function handleConfirm() {
    const existingMode = trainerSync.mode;
    // Warn when switching away from an already-configured mode
    if (existingMode && existingMode !== 'offline' && existingMode !== selected) {
      const isUpgrade = existingMode === 'code' && selected === 'google';
      Alert.alert(
        isUpgrade ? 'Cambiar a Google' : 'Cambiar modo de sincronización',
        isUpgrade
          ? 'Pasarás a usar tu cuenta de Google. Tus clientes actuales se migran automáticamente.\n\n¿Continuar?'
          : 'Se desconectará tu cuenta actual. Tu historial de clientes queda guardado en el dispositivo.\n\n¿Continuar?',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: isUpgrade ? 'Cambiar a Google' : 'Cambiar', style: isUpgrade ? 'default' : 'destructive', onPress: doSwitch },
        ],
      );
      return;
    }
    doSwitch();
  }

  function handleRevealDone() {
    setScreen('select');
    onClose();
  }

  const currentMode = trainerSync.mode;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.backdrop} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={s.center}
      >
        <View style={s.card}>

          {/* Already-connected status (code in memory → skip the mode selector) */}
          {screen === 'code_status' && (
            <CodeStatusScreen
              code={trainerSync.code}
              loading={loading}
              nameInput={nameInput}
              setNameInput={setNameInput}
              setTrainerName={setTrainerName}
              onReconnect={handleReconnect}
              onChangeMode={() => setScreen('select')}
              onClose={onClose}
              isFirstTime={isFirstTime}
            />
          )}

          {/* Code revealed after setup */}
          {screen === 'code_reveal' && newCode && (
            <CodeRevealScreen code={newCode} onDone={handleRevealDone} />
          )}

          {/* Recovery flow */}
          {screen === 'recovery' && (
            <RecoveryScreen
              onSuccess={() => { setScreen('select'); onClose(); }}
              onBack={() => setScreen('select')}
            />
          )}

          {/* Main selector */}
          {screen === 'select' && (
            <>
              <Text style={s.title}>
                {isFirstTime ? 'Gestión de clientes' : 'Modo de sincronización'}
              </Text>
              {isFirstTime && (
                <Text style={s.subtitle}>
                  ¿Cómo quieres sincronizar tus clientes?
                </Text>
              )}

              <ScrollView style={s.options} showsVerticalScrollIndicator={false}>
                {MODES.map((mode) => {
                  const active    = selected === mode.id;
                  const unavailable = mode.expoOnly && isExpoGo;
                  return (
                    <TouchableOpacity
                      key={mode.id}
                      style={[s.option, active && s.optionActive, unavailable && s.optionDisabled]}
                      onPress={() => !unavailable && setSelected(mode.id)}
                      activeOpacity={unavailable ? 1 : 0.75}
                    >
                      <View style={s.optionTop}>
                        <Text style={s.optionIcon}>{mode.icon}</Text>
                        <View style={s.optionTextWrap}>
                          <Text style={[s.optionTitle, active && s.optionTitleActive]}>
                            {mode.title}
                          </Text>
                          <Text style={s.optionDesc}>{mode.desc}</Text>
                          {unavailable && (
                            <Text style={s.optionUnavailable}>Solo disponible en la app instalada</Text>
                          )}
                        </View>
                        {!unavailable && (
                          <View style={[s.radio, active && s.radioActive]}>
                            {active && <View style={s.radioDot} />}
                          </View>
                        )}
                      </View>
                      {/* Warn genérico (solo cuando no hay código existente para esa opción) */}
                      {active && mode.warn && !(mode.id === 'code' && trainerSync.code) && (
                        <Text style={s.optionWarn}>{mode.warn}</Text>
                      )}
                      {/* Código: ya tienes uno, crear otro huerfanará a los clientes */}
                      {active && mode.id === 'code' && trainerSync.code && (
                        <Text style={s.optionWarn}>
                          ⚠ Ya tienes un código. Al crear uno nuevo perderás la sincronización con tus clientes actuales.
                        </Text>
                      )}
                      {/* Google: upgrade desde código — clientes se migran automáticamente */}
                      {active && mode.id === 'google' && trainerSync.code && (
                        <Text style={[s.optionWarn, { color: th.colors.green }]}>
                          ✓ Tus clientes actuales se migran automáticamente a tu cuenta de Google.
                        </Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Trainer display name — shown to clients on their programs */}
              <View style={s.nameRow}>
                <Text style={s.nameLabel}>TU NOMBRE (PARA CLIENTES)</Text>
                <TextInput
                  style={s.nameInput}
                  placeholder="Ej. Lucas García"
                  placeholderTextColor={th.colors.muted}
                  value={nameInput}
                  onChangeText={(t) => { setNameInput(t); setTrainerName(t.trim() || null); }}
                  returnKeyType="done"
                  autoCorrect={false}
                />
              </View>

              {/* Recovery link — visible when no mode set, or to re-auth with a different code */}
              <TouchableOpacity onPress={() => setScreen('recovery')} style={s.recoveryLink}>
                <Text style={s.recoveryLinkText}>
                  {currentMode === 'code'
                    ? 'Volver a autenticarse con código →'
                    : '¿Ya tienes un código? Recuperar cuenta →'}
                </Text>
              </TouchableOpacity>

              <View style={s.actions}>
                {!isFirstTime && (
                  <TouchableOpacity style={s.cancelBtn} onPress={onClose} activeOpacity={0.7}>
                    <Text style={s.cancelBtnText}>Cancelar</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[s.primaryBtn, { flex: 1 }, (loading || (selected === 'google' && isExpoGo)) && { opacity: 0.5 }]}
                  onPress={handleConfirm}
                  disabled={loading || (selected === 'google' && isExpoGo)}
                  activeOpacity={0.85}
                >
                  {loading
                    ? <ActivityIndicator color={th.colors.bg} />
                    : <Text style={s.primaryBtnText}>
                        {selected === 'offline'
                          ? 'Continuar sin conexión'
                          : selected === 'google'
                          ? 'Continuar con Google'
                          : 'Activar'}
                      </Text>}
                </TouchableOpacity>
              </View>
            </>
          )}

        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const makeS = (th) => StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.75)',
  },
  center: {
    flex:              1,
    justifyContent:    'center',
    paddingHorizontal: spacing.xl,
  },
  card: {
    backgroundColor: th.colors.surface,
    borderWidth:     borders.thin,
    borderColor:     th.colors.borderCard,
    borderRadius:    th.radius.lg,
    padding:         spacing.xl,
    gap:             spacing.md,
    maxHeight:       '85%',
  },

  title: {
    fontSize:   typography.lg,
    fontWeight: typography.heavy,
    color:      th.colors.text,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize:  typography.sm,
    color:     th.colors.muted,
    marginTop: -spacing.xs,
  },

  // Options list
  options: { maxHeight: 340 },
  option: {
    borderWidth:     borders.thin,
    borderColor:     th.colors.border,
    borderRadius:    th.radius.md,
    padding:         spacing.md,
    marginBottom:    spacing.xs,
    backgroundColor: th.colors.surface2,
    gap:             spacing.xs,
  },
  optionActive: {
    borderColor:     withOpacity(th.colors.accent, 0.4),
    backgroundColor: withOpacity(th.colors.accent, 0.06),
  },
  optionDisabled: {
    opacity: 0.5,
  },
  optionUnavailable: {
    fontSize:  typography.xs,
    color:     th.colors.muted,
    fontStyle: 'italic',
    marginTop: 2,
  },
  optionTop: {
    flexDirection: 'row',
    alignItems:    'flex-start',
    gap:           spacing.sm,
  },
  optionIcon: {
    fontSize:  20,
    lineHeight: 24,
    marginTop: 1,
  },
  optionTextWrap: { flex: 1, gap: 3 },
  optionTitle: {
    fontSize:   typography.base,
    fontWeight: typography.medium,
    color:      th.colors.text,
  },
  optionTitleActive: { color: th.colors.accent },
  optionDesc: {
    fontSize:   typography.xs,
    color:      th.colors.muted,
    lineHeight: typography.xs * 1.5,
  },
  optionWarn: {
    fontSize:   typography.xs,
    color:      th.colors.orange,
    lineHeight: typography.xs * 1.5,
    marginTop:  spacing.xs,
  },
  // Radio button
  radio: {
    width:        18,
    height:       18,
    borderRadius: 9,
    borderWidth:  2,
    borderColor:  th.colors.border,
    alignItems:   'center',
    justifyContent: 'center',
    marginTop:    2,
    flexShrink:   0,
  },
  radioActive:  { borderColor: th.colors.accent },
  radioDot: {
    width:           8,
    height:          8,
    borderRadius:    4,
    backgroundColor: th.colors.accent,
  },

  // Trainer name
  nameRow: { gap: 5 },
  nameLabel: {
    fontSize:      typography.xs,
    fontWeight:    typography.bold,
    color:         th.colors.muted,
    letterSpacing: 0.8,
  },
  nameInput: {
    backgroundColor:   th.colors.surface2,
    borderWidth:       borders.thin,
    borderColor:       th.colors.borderCard,
    borderRadius:      th.radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.sm,
    color:             th.colors.text,
    fontSize:          typography.base,
  },

  // Recovery link
  recoveryLink: { alignItems: 'center', paddingVertical: spacing.xs },
  recoveryLinkText: {
    fontSize: typography.xs,
    color:    th.colors.accent,
  },

  // Actions row
  actions: {
    flexDirection: 'row',
    gap:           spacing.sm,
    marginTop:     spacing.xs,
  },
  primaryBtn: {
    backgroundColor: th.colors.accent,
    borderRadius:    th.radius.sm,
    paddingVertical: spacing.md,
    alignItems:      'center',
    justifyContent:  'center',
  },
  primaryBtnText: {
    fontSize:   typography.base,
    fontWeight: typography.heavy,
    color:      th.colors.bg,
    letterSpacing: 0.5,
  },
  cancelBtn: {
    paddingVertical:   spacing.md,
    paddingHorizontal: spacing.md,
    borderWidth:       borders.thin,
    borderColor:       th.colors.border,
    borderRadius:      th.radius.sm,
    alignItems:        'center',
    justifyContent:    'center',
  },
  cancelBtnText: { fontSize: typography.base, color: th.colors.muted },

  // Already-connected status screen
  codeStatus: { gap: spacing.md },
  connectedRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.xs,
  },
  connectedDot: {
    width:           8,
    height:          8,
    borderRadius:    4,
    backgroundColor: th.colors.green,
  },
  connectedText: {
    fontSize:   typography.sm,
    fontWeight: typography.semibold,
    color:      th.colors.green,
  },
  codeStatusDesc: {
    fontSize:   typography.xs,
    color:      th.colors.muted,
    lineHeight: typography.xs * 1.5,
    marginTop:  -spacing.xs,
  },

  // Code reveal
  reveal: { gap: spacing.md },
  revealTitle: {
    fontSize:   typography.md,
    fontWeight: typography.heavy,
    color:      th.colors.text,
  },
  revealSub: {
    fontSize:   typography.sm,
    color:      th.colors.muted,
    lineHeight: typography.sm * 1.5,
  },
  codeBox: {
    backgroundColor: withOpacity(th.colors.accent, 0.08),
    borderWidth:     borders.thin,
    borderColor:     withOpacity(th.colors.accent, 0.3),
    borderRadius:    th.radius.md,
    paddingVertical:   spacing.lg,
    paddingHorizontal: spacing.xl,
    alignItems:        'center',
    gap:               spacing.xs,
  },
  // Compact variant for the status screen (code + hint stacked, less padding)
  codeBoxSm: {
    paddingVertical:   spacing.sm,
    paddingHorizontal: spacing.md,
  },
  codeText: {
    fontSize:      24,
    fontWeight:    typography.heavy,
    color:         th.colors.accent,
    letterSpacing: 4,
  },
  codeTextSm: {
    fontSize:      typography.xl,  // 18
    letterSpacing: 2,
  },
  codeCopyHint: {
    fontSize: typography.xs,
    color:    th.colors.muted,
  },
  warnBox: {
    backgroundColor: withOpacity(th.colors.orange, 0.08),
    borderWidth:     borders.thin,
    borderColor:     withOpacity(th.colors.orange, 0.3),
    borderRadius:    th.radius.sm,
    padding:         spacing.md,
  },
  warnText: {
    fontSize:   typography.xs,
    color:      th.colors.orange,
    lineHeight: typography.xs * 1.5,
  },

  // Recovery
  recovery: { gap: spacing.md },
  codeInput: {
    backgroundColor:   th.colors.surface2,
    borderWidth:       borders.thin,
    borderColor:       th.colors.borderCard,
    borderRadius:      th.radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.md,
    color:             th.colors.text,
    fontSize:          20,
    fontWeight:        typography.heavy,
    letterSpacing:     3,
    textAlign:         'center',
  },
  errorText: {
    fontSize:  typography.xs,
    color:     th.colors.red,
    textAlign: 'center',
  },
  pasteBtn: {
    alignSelf:         'flex-end',
    marginTop:         -spacing.xs,
    paddingVertical:   spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  pasteBtnText: {
    fontSize: typography.xs,
    color:    th.colors.accent,
  },
  backLink: { alignItems: 'center', paddingVertical: spacing.xs },
  backLinkText: {
    fontSize: typography.xs,
    color:    th.colors.muted,
  },
});
