/**
 * ClientGoogleLinkModal — el cliente, ya conectado con su entrenador, vincula
 * una cuenta (Google o Apple) para poder reconectarse en otro móvil sin pedir
 * código.
 *
 * Flujo: login → `linkGoogleForClient` → el RPC transfiere la fila de
 * `trainer_clients` del id anónimo al id de la cuenta nueva. Los dos proveedores
 * recorren exactamente el mismo camino; solo cambia de dónde sale el id_token.
 *
 * Pasa a `DragSheet` como el resto de los modales de la app (§9).
 */

import { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser  from 'expo-web-browser';
import Constants        from 'expo-constants';
import { useTranslation } from 'react-i18next';

import { useStore }              from '../../store/useStore';
import { exchangeCodeForTokens } from '../services/driveService';
import { GOOGLE_CLIENT_ID, GOOGLE_REDIRECT_URI } from '../config/google';
import { signInWithApple } from '../services/appleAuth';
import DragSheet from './DragSheet';
import AppleSignInButton from './ui/AppleSignInButton';
import { SectionLabel } from './ui/MenuList';
import { spacing, textStyles } from '../theme';
import { useTheme, useThemedStyles } from '../useTheme';

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_DISCOVERY = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint:         'https://oauth2.googleapis.com/token',
};

export default function ClientGoogleLinkModal({ visible, onClose }) {
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { t }  = useTranslation();
  const linkGoogleForClient = useStore((s) => s.linkGoogleForClient);
  const showToast           = useStore((s) => s.showToast);

  const [loading, setLoading] = useState(false);

  const isExpoGo          = Constants.executionEnvironment === 'storeClient';
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
  useEffect(() => { if (googleRequest) googleRequestRef.current = googleRequest; }, [googleRequest]);

  /** Único camino de salida de los dos proveedores. */
  async function finishLink({ provider, idToken, accessToken }) {
    await linkGoogleForClient({ provider, idToken, accessToken });
    showToast(t('trainer.linkToast'), 2200, 'success');
    onClose();
  }

  useEffect(() => { // eslint-disable-line react-hooks/exhaustive-deps
    if (googleResponse?.type !== 'success') return;
    (async () => {
      setLoading(true);
      try {
        const tokens = await exchangeCodeForTokens({
          code:         googleResponse.params.code,
          codeVerifier: googleRequestRef.current?.codeVerifier,
          redirectUri:  googleRedirectUri,
          clientId:     GOOGLE_CLIENT_ID,
        });
        if (!tokens.id_token) throw new Error(t('trainer.errNoIdToken'));
        await finishLink({
          provider:    'google',
          idToken:     tokens.id_token,
          accessToken: tokens.access_token,
        });
      } catch (err) {
        Alert.alert(t('trainer.linkErrTitle'), err.message ?? t('trainer.linkErrBody'));
      } finally {
        setLoading(false);
      }
    })();
  }, [googleResponse]); // eslint-disable-line

  /** Apple devuelve el id_token en la misma llamada: sin efecto ni redirect. */
  async function handleApple() {
    setLoading(true);
    try {
      const credential = await signInWithApple();
      if (!credential) return;               // cancelado
      if (!credential.idToken) throw new Error(t('trainer.errNoIdToken'));
      await finishLink({ provider: 'apple', idToken: credential.idToken });
    } catch (err) {
      Alert.alert(t('trainer.linkErrTitle'), err.message ?? t('trainer.linkErrBody'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <DragSheet
      visible={visible}
      onClose={onClose}
      title={t('trainer.linkTitle')}
      action={{ label: t('common.cancel'), onPress: onClose }}
    >
      <View style={styles.block}>
        <Text style={styles.lead}>{t('trainer.linkLead')}</Text>

        <View>
          <SectionLabel>{t('trainer.linkWhatHappens')}</SectionLabel>
          <View style={styles.bullets}>
            {['1', '2', '3'].map((n) => (
              <View key={n} style={styles.bulletRow}>
                <Text style={styles.bulletDot}>·</Text>
                <Text style={styles.bulletText}>{t(`trainer.linkImplies${n}`)}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Los dos con el mismo peso y uno debajo del otro: la guía de Apple
            pide que su opción esté al menos tan a la vista como el resto de
            logins sociales, y el botón suyo tiene que ser el nativo. */}
        <View style={styles.ctaGroup}>
          <TouchableOpacity
            style={[styles.primaryBtn, (loading || isExpoGo) && styles.btnDisabled]}
            onPress={() => googlePromptAsync()}
            disabled={loading || isExpoGo}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color={th.colors.onAccent} />
              : <Text style={styles.primaryBtnText}>{t('trainer.linkCta')}</Text>}
          </TouchableOpacity>

          <AppleSignInButton onPress={handleApple} disabled={loading || isExpoGo} />
        </View>

        {isExpoGo && <Text style={styles.hint}>{t('trainer.expoGoNote')}</Text>}
      </View>
    </DragSheet>
  );
}

const makeStyles = (th) => StyleSheet.create({
  block: { gap: spacing.lg, paddingBottom: spacing.md },
  lead:  { ...textStyles.subtitle, color: th.colors.mutedLight, lineHeight: 18 },
  hint:  { ...textStyles.tag, color: th.colors.mutedLight, lineHeight: 15, textAlign: 'center' },

  bullets:    { gap: spacing.sm },
  bulletRow:  { flexDirection: 'row', gap: spacing.sm },
  bulletDot:  { ...textStyles.tag, color: th.colors.accent, lineHeight: 15 },
  bulletText: { ...textStyles.tag, color: th.colors.mutedLight, lineHeight: 15, flex: 1 },

  ctaGroup: { gap: spacing.sm },

  primaryBtn: {
    height:          44,
    borderRadius:    th.radius.sm,
    backgroundColor: th.colors.accent,
    alignItems:      'center',
    justifyContent:  'center',
  },
  primaryBtnText: { ...textStyles.btnAction, color: th.colors.onAccent },
  btnDisabled:    { opacity: 0.5 },
});
