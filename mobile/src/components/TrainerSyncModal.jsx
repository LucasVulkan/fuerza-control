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
import { claimTrainerSlots } from '../services/supabaseSync';
import { exchangeCodeForTokens } from '../services/driveService';
import { GOOGLE_ANDROID_CLIENT_ID } from '../config/google';
import { colors, spacing, typography, radius, borders, withOpacity } from '../theme';

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

// ── Sub-screen: Code generated ─────────────────────────────────────────────────

function CodeRevealScreen({ code, onDone }) {
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
        placeholderTextColor={colors.muted}
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
          ? <ActivityIndicator color={colors.bg} />
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
  const setTrainerSyncMode = useStore((s) => s.setTrainerSyncMode);
  const setTrainerName     = useStore((s) => s.setTrainerName);
  const trainerSync        = useStore((s) => s.trainerSync);

  const [selected,     setSelected]     = useState(trainerSync.mode ?? 'google');
  const [loading,      setLoading]      = useState(false);
  const [screen,       setScreen]       = useState('select'); // 'select' | 'code_reveal' | 'recovery'
  const [newCode,      setNewCode]      = useState(null);
  const [nameInput,    setNameInput]    = useState(trainerSync.trainerName ?? '');

  // Sync local inputs when modal reopens (Modal stays mounted when hidden in RN)
  useEffect(() => { // eslint-disable-line react-hooks/exhaustive-deps
    if (visible) {
      setNameInput(trainerSync.trainerName ?? '');
      setSelected(trainerSync.mode ?? 'google');
      setScreen('select');
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
        onClose();
      } catch (err) {
        Alert.alert('Error', err.message ?? 'No se pudo iniciar sesión con Google.');
      } finally {
        setLoading(false);
      }
    })();
  }, [googleResponse]); // eslint-disable-line

  // ── Handlers ─────────────────────────────────────────────────────────────────

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
      Alert.alert(
        'Cambiar modo de sincronización',
        'Se desconectará tu cuenta actual. Tu historial de clientes queda guardado en el dispositivo.\n\n¿Continuar?',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Cambiar', style: 'destructive', onPress: doSwitch },
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
                      {active && mode.warn && (
                        <Text style={s.optionWarn}>{mode.warn}</Text>
                      )}
                      {/* Safety: if code already exists, warn before creating a new one */}
                      {active && mode.id === 'code' && trainerSync.code && (
                        <View style={s.existingCodeWarn}>
                          <Text style={s.existingCodeWarnText}>
                            Ya tienes el código{' '}
                            <Text style={s.existingCodeValue}>{trainerSync.code}</Text>
                            {' '}guardado.{'\n'}
                            Si lo has perdido, usa «Recuperar cuenta» en lugar de crear uno nuevo — los programas de tus clientes quedarán huérfanos si cambias de cuenta.
                          </Text>
                          <TouchableOpacity onPress={() => setScreen('recovery')} style={s.existingCodeBtn}>
                            <Text style={s.existingCodeBtnText}>Usar mi código →</Text>
                          </TouchableOpacity>
                        </View>
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
                  placeholderTextColor={colors.muted}
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
                    ? <ActivityIndicator color={colors.bg} />
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

const s = StyleSheet.create({
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
    backgroundColor: colors.surface,
    borderWidth:     borders.thin,
    borderColor:     colors.borderCard,
    borderRadius:    radius.lg,
    padding:         spacing.xl,
    gap:             spacing.md,
    maxHeight:       '85%',
  },

  title: {
    fontSize:   typography.lg,
    fontWeight: typography.heavy,
    color:      colors.text,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize:  typography.sm,
    color:     colors.muted,
    marginTop: -spacing.xs,
  },

  // Options list
  options: { maxHeight: 340 },
  option: {
    borderWidth:     borders.thin,
    borderColor:     colors.border,
    borderRadius:    radius.md,
    padding:         spacing.md,
    marginBottom:    spacing.sm,
    backgroundColor: colors.surface2,
    gap:             spacing.xs,
  },
  optionActive: {
    borderColor:     withOpacity(colors.accent, 0.4),
    backgroundColor: withOpacity(colors.accent, 0.06),
  },
  optionDisabled: {
    opacity: 0.5,
  },
  optionUnavailable: {
    fontSize:  typography.xs,
    color:     colors.muted,
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
    color:      colors.text,
  },
  optionTitleActive: { color: colors.accent },
  optionDesc: {
    fontSize:   typography.xs,
    color:      colors.muted,
    lineHeight: typography.xs * 1.5,
  },
  optionWarn: {
    fontSize:   typography.xs,
    color:      colors.orange,
    lineHeight: typography.xs * 1.5,
    marginTop:  spacing.xs,
  },
  existingCodeWarn: {
    marginTop:         spacing.xs,
    backgroundColor:   withOpacity(colors.orange, 0.08),
    borderWidth:       borders.thin,
    borderColor:       withOpacity(colors.orange, 0.3),
    borderRadius:      radius.sm,
    padding:           spacing.sm,
    gap:               spacing.xs,
  },
  existingCodeWarnText: {
    fontSize:   typography.xs,
    color:      colors.orange,
    lineHeight: typography.xs * 1.6,
  },
  existingCodeValue: {
    fontWeight:    typography.heavy,
    letterSpacing: 1,
  },
  existingCodeBtn: {
    alignSelf: 'flex-start',
  },
  existingCodeBtnText: {
    fontSize:   typography.xs,
    color:      colors.accent,
    fontWeight: typography.semibold,
  },

  // Radio button
  radio: {
    width:        18,
    height:       18,
    borderRadius: 9,
    borderWidth:  2,
    borderColor:  colors.border,
    alignItems:   'center',
    justifyContent: 'center',
    marginTop:    2,
    flexShrink:   0,
  },
  radioActive:  { borderColor: colors.accent },
  radioDot: {
    width:           8,
    height:          8,
    borderRadius:    4,
    backgroundColor: colors.accent,
  },

  // Trainer name
  nameRow: { gap: 5 },
  nameLabel: {
    fontSize:      typography.xs,
    fontWeight:    typography.bold,
    color:         colors.muted,
    letterSpacing: 0.8,
  },
  nameInput: {
    backgroundColor:   colors.surface2,
    borderWidth:       borders.thin,
    borderColor:       colors.borderCard,
    borderRadius:      radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.sm,
    color:             colors.text,
    fontSize:          typography.base,
  },

  // Recovery link
  recoveryLink: { alignItems: 'center', paddingVertical: spacing.xs },
  recoveryLinkText: {
    fontSize: typography.xs,
    color:    colors.accent,
  },

  // Actions row
  actions: {
    flexDirection: 'row',
    gap:           spacing.sm,
    marginTop:     spacing.xs,
  },
  primaryBtn: {
    backgroundColor: colors.accent,
    borderRadius:    radius.sm,
    paddingVertical: spacing.md,
    alignItems:      'center',
    justifyContent:  'center',
  },
  primaryBtnText: {
    fontSize:   typography.base,
    fontWeight: typography.heavy,
    color:      colors.bg,
    letterSpacing: 0.5,
  },
  cancelBtn: {
    paddingVertical:   spacing.md,
    paddingHorizontal: spacing.md,
    borderWidth:       borders.thin,
    borderColor:       colors.border,
    borderRadius:      radius.sm,
    alignItems:        'center',
    justifyContent:    'center',
  },
  cancelBtnText: { fontSize: typography.base, color: colors.muted },

  // Code reveal
  reveal: { gap: spacing.md },
  revealTitle: {
    fontSize:   typography.md,
    fontWeight: typography.heavy,
    color:      colors.text,
  },
  revealSub: {
    fontSize:   typography.sm,
    color:      colors.muted,
    lineHeight: typography.sm * 1.5,
  },
  codeBox: {
    backgroundColor: withOpacity(colors.accent, 0.08),
    borderWidth:     borders.thin,
    borderColor:     withOpacity(colors.accent, 0.3),
    borderRadius:    radius.md,
    paddingVertical:   spacing.lg,
    paddingHorizontal: spacing.xl,
    alignItems:        'center',
    gap:               spacing.xs,
  },
  codeText: {
    fontSize:      24,
    fontWeight:    typography.heavy,
    color:         colors.accent,
    letterSpacing: 4,
  },
  codeCopyHint: {
    fontSize: typography.xs,
    color:    colors.muted,
  },
  warnBox: {
    backgroundColor: withOpacity(colors.orange, 0.08),
    borderWidth:     borders.thin,
    borderColor:     withOpacity(colors.orange, 0.3),
    borderRadius:    radius.sm,
    padding:         spacing.md,
  },
  warnText: {
    fontSize:   typography.xs,
    color:      colors.orange,
    lineHeight: typography.xs * 1.5,
  },

  // Recovery
  recovery: { gap: spacing.md },
  codeInput: {
    backgroundColor:   colors.surface2,
    borderWidth:       borders.thin,
    borderColor:       colors.borderCard,
    borderRadius:      radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.md,
    color:             colors.text,
    fontSize:          20,
    fontWeight:        typography.heavy,
    letterSpacing:     3,
    textAlign:         'center',
  },
  errorText: {
    fontSize:  typography.xs,
    color:     colors.red,
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
    color:    colors.accent,
  },
  backLink: { alignItems: 'center', paddingVertical: spacing.xs },
  backLinkText: {
    fontSize: typography.xs,
    color:    colors.muted,
  },
});
