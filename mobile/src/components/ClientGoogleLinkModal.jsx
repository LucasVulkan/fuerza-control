/**
 * ClientGoogleLinkModal
 *
 * Shown to a client who is already connected to a trainer (has slotId)
 * and wants to link their Google account for seamless reconnect on future devices.
 *
 * Flow:
 *   1. Client taps "Vincular Google" in the settings menu.
 *   2. Google OAuth opens in the browser.
 *   3. On success, loginWithGoogleClient is called — Supabase creates/fetches
 *      the Google user. The RPC transfer_client_slot updates the trainer_clients
 *      row: client_id goes from old anonymous ID to new Google user ID.
 *   4. Future devices: client signs in with Google → app auto-reconnects.
 */

import { useState, useRef, useEffect } from 'react';
import {
  View, Text, Modal, TouchableOpacity, ActivityIndicator,
  StyleSheet, Platform, KeyboardAvoidingView, Alert,
} from 'react-native';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser  from 'expo-web-browser';
import Constants        from 'expo-constants';

import { useStore }              from '../../store/useStore';
import { exchangeCodeForTokens } from '../services/driveService';
import { GOOGLE_ANDROID_CLIENT_ID } from '../config/google';
import { colors, spacing, typography, radius, borders } from '../theme';

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_DISCOVERY = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint:         'https://oauth2.googleapis.com/token',
};

export default function ClientGoogleLinkModal({ visible, onClose }) {
  const linkGoogleForClient = useStore((s) => s.linkGoogleForClient);
  const showToast           = useStore((s) => s.showToast);

  const [loading, setLoading] = useState(false);

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
  useEffect(() => { if (googleRequest) googleRequestRef.current = googleRequest; }, [googleRequest]);

  useEffect(() => { // eslint-disable-line react-hooks/exhaustive-deps
    if (googleResponse?.type !== 'success') return;
    (async () => {
      setLoading(true);
      try {
        const tokens = await exchangeCodeForTokens({
          code:         googleResponse.params.code,
          codeVerifier: googleRequestRef.current?.codeVerifier,
          redirectUri:  googleRedirectUri,
          clientId:     GOOGLE_ANDROID_CLIENT_ID,
        });
        if (!tokens.id_token) throw new Error('Google no devolvió un id_token. Inténtalo de nuevo.');
        await linkGoogleForClient({ idToken: tokens.id_token, accessToken: tokens.access_token });
        showToast('Google vinculado', 2200, 'success');
        onClose();
      } catch (err) {
        Alert.alert('Error', err.message ?? 'No se pudo vincular la cuenta de Google.');
      } finally {
        setLoading(false);
      }
    })();
  }, [googleResponse]); // eslint-disable-line

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.backdrop} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={s.center}
      >
        <View style={s.card}>
          <Text style={s.title}>Vincular Google</Text>

          <Text style={s.desc}>
            Vincula tu cuenta de Google para reconectarte automáticamente desde cualquier
            dispositivo sin necesidad de introducir el código de tu entrenador otra vez.
          </Text>

          <View style={s.infoBox}>
            <InfoRow text="Tu conexión con el entrenador y tu historial no cambian." />
            <InfoRow text="En dispositivos futuros, basta con iniciar sesión con Google." />
            <InfoRow text="No necesitarás guardar ni recordar ningún código." />
          </View>

          {isExpoGo && (
            <Text style={s.unavailText}>
              No disponible en Expo Go. Usa la app instalada.
            </Text>
          )}

          <View style={s.actions}>
            <TouchableOpacity style={s.cancelBtn} onPress={onClose} activeOpacity={0.7}>
              <Text style={s.cancelBtnText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.primaryBtn, { flex: 1 }, (loading || isExpoGo) && { opacity: 0.5 }]}
              onPress={() => googlePromptAsync()}
              disabled={loading || isExpoGo}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color={colors.bg} />
                : <Text style={s.primaryBtnText}>Continuar con Google</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function InfoRow({ text }) {
  return (
    <View style={s.infoRow}>
      <Text style={s.infoDot}>·</Text>
      <Text style={s.infoText}>{text}</Text>
    </View>
  );
}

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
  },
  title: {
    fontSize:   typography.lg,
    fontWeight: typography.heavy,
    color:      colors.text,
  },
  desc: {
    fontSize:   typography.sm,
    color:      colors.muted,
    lineHeight: typography.sm * 1.5,
  },
  infoBox: { gap: spacing.xs },
  infoRow: {
    flexDirection: 'row',
    gap:           spacing.xs,
    alignItems:    'flex-start',
  },
  infoDot: {
    fontSize:   typography.sm,
    color:      colors.accent,
    lineHeight: typography.sm * 1.4,
  },
  infoText: {
    flex:       1,
    fontSize:   typography.xs,
    color:      colors.muted,
    lineHeight: typography.xs * 1.5,
  },
  unavailText: {
    fontSize:   typography.xs,
    color:      colors.orange,
    textAlign:  'center',
    fontStyle:  'italic',
  },
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
    fontSize:      typography.base,
    fontWeight:    typography.heavy,
    color:         colors.bg,
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
});
