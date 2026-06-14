/**
 * ClientCodeModal
 *
 * Two-step modal for the client to connect with their trainer.
 *
 * Step 1 — Enter code:
 *   Client types the XXXX-XXXX code → app validates it against Supabase.
 *
 * Step 2 — Confirm:
 *   Shows program name found, explains what connecting means,
 *   warns that the current program will be archived.
 */

import { useState, useRef, useEffect } from 'react';
import {
  View, Text, Modal, TouchableOpacity, TextInput,
  ActivityIndicator, StyleSheet, Platform, KeyboardAvoidingView, Alert,
} from 'react-native';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser  from 'expo-web-browser';
import * as Clipboard   from 'expo-clipboard';
import Constants        from 'expo-constants';

import { useStore }              from '../../store/useStore';
import { exchangeCodeForTokens } from '../services/driveService';
import { GOOGLE_ANDROID_CLIENT_ID } from '../config/google';
import { spacing, typography, borders, withOpacity } from '../theme';
import { useTheme, useThemedStyles } from '../useTheme';

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_DISCOVERY = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint:         'https://oauth2.googleapis.com/token',
};

export default function ClientCodeModal({ visible, onClose, onSuccess, startWithGoogle = false }) {
  const th = useTheme();
  const s = useThemedStyles(makeS);
  const validateClientCode    = useStore((s) => s.validateClientCode);
  const linkToTrainer         = useStore((s) => s.linkToTrainer);
  const validateGoogleClient  = useStore((s) => s.validateGoogleClient);
  const confirmGoogleReconnect = useStore((s) => s.confirmGoogleReconnect);
  const clientSync            = useStore((s) => s.clientSync);

  const [step,         setStep]         = useState('enter'); // 'enter' | 'confirm'
  const [code,         setCode]         = useState('');
  const [slotInfo,     setSlotInfo]     = useState(null); // { slotId, programName, alreadyLinked, hasRemoteHistory }
  const [historyMode,  setHistoryMode]  = useState('program'); // 'program' | 'merge'
  const [googleUserId, setGoogleUserId] = useState(null);  // set when Google reconnect finds a slot
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState(null);
  const [pasted,       setPasted]       = useState(false);
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

  const googleRequestRef   = useRef(googleRequest);
  const hasAutoTriggered   = useRef(false);
  useEffect(() => { if (googleRequest) googleRequestRef.current = googleRequest; }, [googleRequest]);

  // Auto-trigger Google OAuth when opened via the "Reconectarse con Google" button
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
        if (!tokens.id_token) throw new Error('Google no devolvió un id_token.');
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
        setError(err.message ?? 'Error al conectar con Google.');
      } finally {
        setGoogleLoading(false);
      }
    })();
  }, [googleResponse]); // eslint-disable-line

  async function handlePaste() {
    const text = await Clipboard.getStringAsync();
    if (text?.trim()) {
      setCode(text.trim().toUpperCase());
      setError(null);
      setPasted(true);
      setTimeout(() => setPasted(false), 1500);
    }
  }

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
        // Google auto-reconnect flow
        await confirmGoogleReconnect({
          slotId:      slotInfo.slotId,
          googleUserId,
          mergeHistory: historyMode === 'merge',
        });
      } else {
        // Code-based flow
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

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={s.backdrop} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={s.center}
      >
        <View style={s.card}>

          {/* ── Step 1a: Google auto-reconnect (no code form) ── */}
          {step === 'enter' && startWithGoogle && (
            <>
              <Text style={s.title}>Reconectarse con Google</Text>
              <Text style={s.subtitle}>
                Buscando tu cuenta de entrenador vinculada…
              </Text>

              {googleLoading && <ActivityIndicator color={th.colors.accent} style={{ marginVertical: spacing.sm }} />}

              {error && <Text style={s.errorText}>{error}</Text>}

              {googleNoSlot && (
                <Text style={s.googleNoSlotText}>
                  No hay cuenta vinculada a ese Google. Introduce el código de tu entrenador.
                </Text>
              )}

              {isExpoGo && (
                <Text style={s.googleUnavailText}>Google no disponible en Expo Go</Text>
              )}

              <View style={s.actions}>
                <TouchableOpacity style={[s.cancelBtn, { flex: 1 }]} onPress={handleClose} activeOpacity={0.7}>
                  <Text style={s.cancelBtnText}>Cancelar</Text>
                </TouchableOpacity>
                {/* Retry button appears if Google returned no slot or had an error */}
                {(googleNoSlot || error) && !googleLoading && (
                  <TouchableOpacity
                    style={[s.primaryBtn, { flex: 1 }, isExpoGo && { opacity: 0.4 }]}
                    onPress={() => { setGoogleNoSlot(false); setError(null); hasAutoTriggered.current = false; googlePromptAsync(); }}
                    disabled={isExpoGo}
                    activeOpacity={0.85}
                  >
                    <Text style={s.primaryBtnText}>Reintentar</Text>
                  </TouchableOpacity>
                )}
              </View>
            </>
          )}

          {/* ── Step 1b: Enter code ── */}
          {step === 'enter' && !startWithGoogle && (
            <>
              <Text style={s.title}>Conectar con entrenador</Text>
              <Text style={s.subtitle}>
                Introduce el código que te ha dado tu entrenador.
              </Text>

              <TextInput
                style={s.codeInput}
                placeholder="XXXX-XXXX"
                placeholderTextColor={th.colors.muted}
                value={code}
                onChangeText={(t) => { setCode(t.toUpperCase()); setError(null); }}
                autoCapitalize="characters"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={handleValidate}
                autoFocus
              />
              <TouchableOpacity onPress={handlePaste} style={s.pasteBtn} activeOpacity={0.7}>
                <Text style={s.pasteBtnText}>{pasted ? '✓ Pegado' : '📋 Pegar'}</Text>
              </TouchableOpacity>

              {error && <Text style={s.errorText}>{error}</Text>}

              <View style={s.actions}>
                <TouchableOpacity style={s.cancelBtn} onPress={handleClose} activeOpacity={0.7}>
                  <Text style={s.cancelBtnText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.primaryBtn, { flex: 1 }, (!code.trim() || loading) && { opacity: 0.5 }]}
                  onPress={handleValidate}
                  disabled={!code.trim() || loading}
                  activeOpacity={0.85}
                >
                  {loading
                    ? <ActivityIndicator color={th.colors.bg} />
                    : <Text style={s.primaryBtnText}>Continuar</Text>}
                </TouchableOpacity>
              </View>

              {/* ── Google reconnect ── */}
              <View style={s.dividerRow}>
                <View style={s.dividerLine} />
                <Text style={s.dividerText}>o</Text>
                <View style={s.dividerLine} />
              </View>
              <TouchableOpacity
                style={[s.googleBtn, (googleLoading || isExpoGo) && { opacity: 0.4 }]}
                onPress={() => { setGoogleNoSlot(false); setError(null); googlePromptAsync(); }}
                disabled={googleLoading || isExpoGo}
                activeOpacity={0.8}
              >
                {googleLoading
                  ? <ActivityIndicator color={th.colors.text} size="small" />
                  : <Text style={s.googleBtnText}>Reconectarse con Google</Text>}
              </TouchableOpacity>
              {googleNoSlot && (
                <Text style={s.googleNoSlotText}>
                  No hay cuenta vinculada a ese Google. Introduce el código de tu entrenador.
                </Text>
              )}
              {isExpoGo && (
                <Text style={s.googleUnavailText}>Google no disponible en Expo Go</Text>
              )}
            </>
          )}

          {/* ── Step 2: Confirm ── */}
          {step === 'confirm' && slotInfo && (
            <>
              <Text style={s.title}>
                {googleUserId ? 'Cuenta encontrada' : 'Programa encontrado'}
              </Text>

              <View style={s.programFound}>
                <Text style={s.programFoundLabel}>PROGRAMA</Text>
                <Text style={s.programFoundName}>{slotInfo.programName}</Text>
              </View>

              {isAlreadyLinked && (
                <View style={s.warnBox}>
                  <Text style={s.warnText}>
                    ⚠️ Ya estás conectado con un entrenador. Al continuar perderás el acceso al anterior.
                  </Text>
                </View>
              )}

              {/* History merge choice — only shown when there is remote history */}
              {slotInfo.hasRemoteHistory && (
                <View style={s.histSection}>
                  <Text style={s.histSectionLabel}>¿QUÉ QUIERES SINCRONIZAR?</Text>
                  <TouchableOpacity
                    style={[s.histOption, historyMode === 'program' && s.histOptionActive]}
                    onPress={() => setHistoryMode('program')}
                    activeOpacity={0.75}
                  >
                    <View style={[s.radio, historyMode === 'program' && s.radioActive]}>
                      {historyMode === 'program' && <View style={s.radioDot} />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.histOptionTitle, historyMode === 'program' && s.histOptionTitleActive]}>
                        Solo el programa
                      </Text>
                      <Text style={s.histOptionDesc}>
                        Se importa el programa del entrenador. Tu historial local no cambia.
                      </Text>
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.histOption, historyMode === 'merge' && s.histOptionActive]}
                    onPress={() => setHistoryMode('merge')}
                    activeOpacity={0.75}
                  >
                    <View style={[s.radio, historyMode === 'merge' && s.radioActive]}>
                      {historyMode === 'merge' && <View style={s.radioDot} />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.histOptionTitle, historyMode === 'merge' && s.histOptionTitleActive]}>
                        Programa + historial
                      </Text>
                      <Text style={s.histOptionDesc}>
                        Se combina el historial guardado en la nube con el local. Las sesiones duplicadas no se repiten.
                      </Text>
                    </View>
                  </TouchableOpacity>
                </View>
              )}

              <View style={s.infoBox}>
                <InfoRow text="Tu programa actual se archivará y se cargará el de tu entrenador." />
                <InfoRow text="Tu entrenador tendrá acceso a tu historial de sesiones." />
                <InfoRow text="Cualquier cambio que haga en el programa lo recibirás automáticamente." />
                <InfoRow text="Tu historial anterior se conserva." />
              </View>

              {error && <Text style={s.errorText}>{error}</Text>}

              <View style={s.actions}>
                <TouchableOpacity style={s.cancelBtn} onPress={() => setStep('enter')} activeOpacity={0.7}>
                  <Text style={s.cancelBtnText}>← Atrás</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.primaryBtn, { flex: 1 }, loading && { opacity: 0.5 }]}
                  onPress={handleConfirm}
                  disabled={loading}
                  activeOpacity={0.85}
                >
                  {loading
                    ? <ActivityIndicator color={th.colors.bg} />
                    : <Text style={s.primaryBtnText}>Conectar</Text>}
                </TouchableOpacity>
              </View>
            </>
          )}

        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function InfoRow({ text }) {
  const s = useThemedStyles(makeS);
  return (
    <View style={s.infoRow}>
      <Text style={s.infoDot}>·</Text>
      <Text style={s.infoText}>{text}</Text>
    </View>
  );
}

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
  },
  title: {
    fontSize:   typography.lg,
    fontWeight: typography.heavy,
    color:      th.colors.text,
  },
  subtitle: {
    fontSize:   typography.sm,
    color:      th.colors.muted,
    marginTop:  -spacing.xs,
    lineHeight: typography.sm * 1.5,
  },
  codeInput: {
    backgroundColor:   th.colors.surface2,
    borderWidth:       borders.thin,
    borderColor:       th.colors.borderCard,
    borderRadius:      th.radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.md,
    color:             th.colors.text,
    fontSize:          22,
    fontWeight:        typography.heavy,
    letterSpacing:     4,
    textAlign:         'center',
  },
  pasteBtn: {
    alignSelf:   'flex-end',
    marginTop:   -spacing.xs,
    paddingVertical:   spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  pasteBtnText: {
    fontSize: typography.xs,
    color:    th.colors.accent,
  },
  errorText: {
    fontSize:  typography.xs,
    color:     th.colors.red,
    textAlign: 'center',
    marginTop: -spacing.xs,
  },
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
    fontSize:      typography.base,
    fontWeight:    typography.heavy,
    color:         th.colors.bg,
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

  // Program found card
  programFound: {
    backgroundColor: withOpacity(th.colors.accent, 0.06),
    borderWidth:     borders.thin,
    borderColor:     withOpacity(th.colors.accent, 0.25),
    borderRadius:    th.radius.md,
    padding:         spacing.md,
    gap:             spacing.xs,
  },
  programFoundLabel: {
    fontSize:      typography.xs,
    fontWeight:    typography.bold,
    color:         th.colors.accent,
    letterSpacing: 1,
  },
  programFoundName: {
    fontSize:   typography.md,
    fontWeight: typography.heavy,
    color:      th.colors.text,
  },

  // Warning box
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

  // History merge options
  histSection: {
    gap: spacing.xs,
  },
  histSectionLabel: {
    fontSize:      typography.xs,
    fontWeight:    typography.bold,
    color:         th.colors.muted,
    letterSpacing: 0.8,
    marginBottom:  2,
  },
  histOption: {
    flexDirection:   'row',
    alignItems:      'flex-start',
    gap:             spacing.sm,
    borderWidth:     borders.thin,
    borderColor:     th.colors.border,
    borderRadius:    th.radius.sm,
    padding:         spacing.sm,
    backgroundColor: th.colors.surface2,
  },
  histOptionActive: {
    borderColor:     withOpacity(th.colors.accent, 0.4),
    backgroundColor: withOpacity(th.colors.accent, 0.06),
  },
  histOptionTitle: {
    fontSize:   typography.sm,
    fontWeight: typography.medium,
    color:      th.colors.text,
    marginBottom: 2,
  },
  histOptionTitleActive: { color: th.colors.accent },
  histOptionDesc: {
    fontSize:   typography.xs,
    color:      th.colors.muted,
    lineHeight: typography.xs * 1.5,
  },
  // Radio button
  radio: {
    width:          18,
    height:         18,
    borderRadius:   9,
    borderWidth:    2,
    borderColor:    th.colors.border,
    alignItems:     'center',
    justifyContent: 'center',
    marginTop:      2,
    flexShrink:     0,
  },
  radioActive: { borderColor: th.colors.accent },
  radioDot: {
    width:           8,
    height:          8,
    borderRadius:    4,
    backgroundColor: th.colors.accent,
  },

  // Google reconnect
  dividerRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.sm,
    marginTop:     spacing.xs,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: th.colors.border },
  dividerText: { fontSize: typography.xs, color: th.colors.muted },
  googleBtn: {
    borderWidth:     borders.thin,
    borderColor:     th.colors.border,
    borderRadius:    th.radius.sm,
    paddingVertical: spacing.sm + 2,
    alignItems:      'center',
    backgroundColor: th.colors.surface2,
  },
  googleBtnText: {
    fontSize:   typography.sm,
    color:      th.colors.text,
    fontWeight: typography.medium,
  },
  googleNoSlotText: {
    fontSize:   typography.xs,
    color:      th.colors.muted,
    textAlign:  'center',
    lineHeight: typography.xs * 1.5,
  },
  googleUnavailText: {
    fontSize:   typography.xs,
    color:      th.colors.muted,
    textAlign:  'center',
    fontStyle:  'italic',
  },

  // Info list
  infoBox: {
    gap: spacing.xs,
  },
  infoRow: {
    flexDirection: 'row',
    gap:           spacing.xs,
    alignItems:    'flex-start',
  },
  infoDot: {
    fontSize:  typography.sm,
    color:     th.colors.accent,
    lineHeight: typography.sm * 1.4,
  },
  infoText: {
    flex:       1,
    fontSize:   typography.xs,
    color:      th.colors.muted,
    lineHeight: typography.xs * 1.5,
  },
});
