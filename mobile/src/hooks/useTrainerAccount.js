/**
 * useTrainerAccount — la parte de entrar en la cuenta del entrenador que no
 * puede vivir en el store (M03-01 §5.2): la petición de Google
 * (`AuthSession.useAuthRequest` es un hook) y la hoja nativa de Apple.
 * Consigue el id_token y llama a las acciones de CUENTA DE ENTRENADOR del
 * store, que son las que tocan Supabase, los huecos y RevenueCat.
 *
 * No pinta ni cierra nada: devuelve promesas. Cerrar la hoja, enseñar el
 * código o navegar es cosa de quien lo usa. Si el usuario cancela Google o
 * Apple, la promesa rechaza con `{ cancelled: true }` y no hay que enseñar error.
 *
 * `mustExist` (M03-03 §7.4, «Ya tengo cuenta»): Google y Apple solo ENTRAN. Si no
 * hay cuenta de entrenador rechazan con `{ notFound: true, provider, createInstead }`;
 * `createInstead()` crea la cuenta con los mismos tokens, sin reabrir Google ni Apple.
 *
 *   · `isExpoGo`            — en Expo Go Google no puede (no hay URI registrable)
 *   · `loading`             — hay una operación en curso
 *   · `signInWithGoogle({ mustExist })` — Promise<{ userId }>
 *   · `signInWithApple({ mustExist })`   — Promise<{ userId }>
 *   · `createCode()`        — Promise<{ code, userId }>
 *   · `recover(code)`       — Promise<{ userId }>
 *   · `leave()`             — Promise<void>
 */

import { useState } from 'react';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser  from 'expo-web-browser';
import Constants        from 'expo-constants';
import { useTranslation } from 'react-i18next';

import { useStore } from '../../store/useStore';
import { exchangeCodeForTokens } from '../services/driveService';
import { GOOGLE_CLIENT_ID, GOOGLE_REDIRECT_URI } from '../config/google';
import { signInWithApple as appleSheet } from '../services/appleAuth';
import { showDialog } from '../components/ui/dialog';

// Required so the in-app browser can redirect back after OAuth
WebBrowser.maybeCompleteAuthSession();

const GOOGLE_DISCOVERY = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint:         'https://oauth2.googleapis.com/token',
};

const CANCELLED = { cancelled: true };

/**
 * El aviso de «no hay cuenta» (§7.4) para quien recibe `{ notFound }`: «Probar
 * con otro» no hace nada (el usuario vuelve a pulsar y elige otra cuenta) y
 * «Crear una nueva» llama a `createInstead`. `onDone` / `onError` son de quien
 * pregunta (cerrar la hoja, terminar el recorrido, enseñar el fallo).
 */
export function askCreateInstead(t, { provider, createInstead }, { onDone, onError }) {
  showDialog(t('sync.notFoundTitle', { how: t(provider === 'apple' ? 'sync.howApple' : 'sync.howGoogle') }), undefined, [
    { text: t('sync.tryOther'), style: 'cancel' },
    { text: t('sync.createNew'), onPress: () => createInstead().then(onDone, onError) },
  ]);
}

export default function useTrainerAccount() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);

  // expo-auth-session v7: useProxy removed. In Expo Go the redirect URI is always
  // exp://127.0.0.1:8081 (can't be registered in GCC → OAuth disabled in dev).
  // In standalone builds, the reverse-client-ID redirect from config/google is
  // used directly (el cliente de Android o el de iOS según la plataforma).
  const isExpoGo          = Constants.executionEnvironment === 'storeClient';
  const googleRedirectUri = AuthSession.makeRedirectUri({ native: GOOGLE_REDIRECT_URI });

  const [googleRequest, , googlePromptAsync] = AuthSession.useAuthRequest(
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

  /** Envuelve una operación con `loading`. */
  const run = (fn) => async (...args) => {
    setLoading(true);
    try { return await fn(...args); } finally { setLoading(false); }
  };

  /** Entra con los tokens; con `mustExist` y sin cuenta, deja `createInstead` para crearla. */
  async function enter(provider, args, mustExist) {
    const { enterTrainerAccount } = useStore.getState();
    try {
      return await enterTrainerAccount({ provider, ...args, mustExist });
    } catch (err) {
      if (!err?.notFound) throw err;
      throw { notFound: true, provider, createInstead: run(() => enterTrainerAccount({ provider, ...args })) };
    }
  }

  // `promptAsync` ya devuelve la respuesta del navegador: no hace falta
  // observar `response` en un efecto.
  const signInWithGoogle = run(async ({ mustExist = false } = {}) => {
    const res = await googlePromptAsync();
    if (res?.type !== 'success') throw CANCELLED;
    const tokens = await exchangeCodeForTokens({
      code:         res.params.code,
      codeVerifier: googleRequest?.codeVerifier,
      redirectUri:  googleRedirectUri,
      clientId:     GOOGLE_CLIENT_ID,
    });
    if (!tokens.id_token) throw new Error(t('sync.errNoIdToken'));
    return enter('google', { idToken: tokens.id_token, accessToken: tokens.access_token }, mustExist);
  });

  // Apple no necesita el ida y vuelta del navegador: la hoja nativa devuelve
  // el id_token en la misma llamada.
  const signInWithApple = run(async ({ mustExist = false } = {}) => {
    const credential = await appleSheet();
    if (!credential) throw CANCELLED;
    if (!credential.idToken) throw new Error(t('sync.errNoIdToken'));
    return enter('apple', { idToken: credential.idToken, fullName: credential.fullName }, mustExist);
  });

  const createCode = run(() => useStore.getState().createTrainerCodeAccount());
  const recover    = run((code) => useStore.getState().recoverTrainerAccount(code));
  const leave      = run(() => useStore.getState().leaveTrainerAccount());

  return { isExpoGo, loading, signInWithGoogle, signInWithApple, createCode, recover, leave };
}
