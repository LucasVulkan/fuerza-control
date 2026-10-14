/**
 * useTrainerAccount — entrar (o crear) la cuenta del entrenador: Google, Apple,
 * código de 12 (recuperar) y crear cuenta con código.
 *
 * Es la lógica que vivía dentro de `TrainerSyncModal` (O03-13 §29.2, O03 §24.3),
 * sacada para que la usen el modal y las pantallas del recorrido de entrada
 * («Ya tengo cuenta» y, en O03-08, la cuenta del entrenador).
 *
 * Callbacks (se leen siempre por ref, así el efecto de la respuesta de Google
 * usa los últimos):
 *   · `onDone()`                     — entró bien con Google o Apple
 *   · `onError(title, message)`      — falló Google, Apple o crear con código
 *   · `onAppleName(fullName)`        — Apple dio el nombre y el entrenador no tenía uno
 *
 * Devuelve:
 *   · `loading` / `setLoading`       — hay una petición en curso
 *   · `isExpoGo`                     — en Expo Go Google no puede (no hay URI registrable)
 *   · `google()`, `apple()`          — lanzan el login; llaman a `onDone`/`onError`
 *   · `recover(code)`                — Promise<string|null>: error o `null` si entró
 *   · `createWithCode()`             — Promise<string|null>: el código nuevo, o `null` si falló
 */

import { useState, useRef, useEffect } from 'react';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser  from 'expo-web-browser';
import Constants        from 'expo-constants';
import { useTranslation } from 'react-i18next';

import { useStore } from '../../store/useStore';
import { setupTrainerCodeAccount, recoverWithTrainerCode, loginTrainerWithIdToken, signOut as supabaseSignOut } from '../services/supabaseAuth';
import { transferMySlotsTo } from '../services/supabaseSync';
import { exchangeCodeForTokens } from '../services/driveService';
import { GOOGLE_CLIENT_ID, GOOGLE_REDIRECT_URI } from '../config/google';
import { signInWithApple } from '../services/appleAuth';

// Required so the in-app browser can redirect back after OAuth
WebBrowser.maybeCompleteAuthSession();

const GOOGLE_DISCOVERY = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint:         'https://oauth2.googleapis.com/token',
};

export default function useTrainerAccount({ onDone, onError, onAppleName } = {}) {
  const { t } = useTranslation();
  const setTrainerSyncMode = useStore((s) => s.setTrainerSyncMode);
  const setTrainerName     = useStore((s) => s.setTrainerName);
  const [loading, setLoading] = useState(false);

  const cb = useRef({});
  useEffect(() => { cb.current = { onDone, onError, onAppleName }; });

  // ── Google OAuth setup ───────────────────────────────────────────────────────
  //
  // expo-auth-session v7: useProxy removed. In Expo Go the redirect URI is always
  // exp://127.0.0.1:8081 (can't be registered in GCC → OAuth disabled in dev).
  // In standalone builds, the reverse-client-ID redirect from config/google is
  // used directly (el cliente de Android o el de iOS según la plataforma).
  //
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

  // Stable ref so the async callback always reads the latest codeVerifier
  const googleRequestRef = useRef(googleRequest);
  useEffect(() => { if (googleRequest) googleRequestRef.current = googleRequest; }, [googleRequest]);

  /**
   * Cierra el login social y arrastra los huecos a la cuenta nueva.
   *
   * Google y Apple solo se diferencian en cómo se consigue el id_token (OAuth
   * con navegador vs hoja nativa); a partir de aquí el camino es el mismo.
   *
   * **Cede quien posee, no reclama quien recibe.** Antes esto llamaba a
   * `claimTrainerSlots(ids)`, que en el servidor era un update sin ninguna
   * comprobación: bastaba conocer un UUID para hacerse entrenador de un hueco
   * ajeno (fallo 26 de la auditoría). Ahora la transferencia se ejecuta
   * autenticado como el dueño VIEJO y el servidor filtra por
   * `trainer_id = auth.uid()`: solo puedes regalar lo que ya es tuyo. Por eso
   * tampoco hace falta recolectar identificadores de huecos.
   *
   * El baile de sesiones (social → código → social) ya existía; lo único que
   * cambia es que la transferencia ocurre en el tramo del medio.
   *
   * Limitación conocida y heredada: solo funciona si la cuenta anterior era de
   * tipo código, que es la única que se puede recuperar en silencio. Pasar de
   * una cuenta social a otra exige que el usuario entre en la vieja.
   */
  async function finishSocialLogin({ provider, idToken, accessToken }) {
    const { userId } = await loginTrainerWithIdToken({ provider, idToken, accessToken });
    setTrainerSyncMode(provider, { userId });

    const storedCode = useStore.getState().trainerSync.code;
    if (storedCode) {
      try {
        await recoverWithTrainerCode(storedCode);        // sesión del dueño viejo
        await transferMySlotsTo(userId);                 // where trainer_id = auth.uid()
      } catch (err) {
        console.error('[TrainerSync] transferencia de huecos fallida:', err.message);
      }
      // Volver a la sesión social pase lo que pase.
      await loginTrainerWithIdToken({ provider, idToken, accessToken }).catch(() => {});
    }

    // Restore any server slots missing from local state (e.g. fresh install).
    await useStore.getState().refreshTrainerSlots().catch(() => {});

    cb.current.onDone?.();
  }

  // Handle OAuth redirect response
  useEffect(() => {
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
        if (!tokens.id_token) throw new Error(t('sync.errNoIdToken'));

        await finishSocialLogin({
          provider:    'google',
          idToken:     tokens.id_token,
          accessToken: tokens.access_token,
        });
      } catch (err) {
        cb.current.onError?.(t('sync.errGoogleTitle'), err.message ?? t('sync.errGoogleBody'));
      } finally {
        setLoading(false);
      }
    })();
  }, [googleResponse]); // eslint-disable-line

  const google = () => { googlePromptAsync(); };

  /**
   * Apple no necesita el ida y vuelta del navegador: la hoja nativa devuelve el
   * id_token en la misma llamada, así que no hay `response` que observar ni
   * efecto que montar.
   */
  async function apple() {
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
        cb.current.onAppleName?.(credential.fullName);
      }

      await finishSocialLogin({
        provider: 'apple',
        idToken:  credential.idToken,
      });
    } catch (err) {
      cb.current.onError?.(t('sync.errAppleTitle'), err.message ?? t('sync.errGoogleBody'));
    } finally {
      setLoading(false);
    }
  }

  async function recover(code) {
    if (!code?.trim()) return null;
    setLoading(true);
    try {
      const { userId } = await recoverWithTrainerCode(code);
      setTrainerSyncMode('code', { code: code.trim().toUpperCase(), userId });
      return null;
    } catch (err) {
      return err.message ?? t('sync.errReconnectBody');
    } finally {
      setLoading(false);
    }
  }

  async function createWithCode() {
    setLoading(true);
    try {
      // El código anterior, antes de que `setTrainerSyncMode` lo sustituya:
      // es la única forma de volver a la sesión del dueño viejo para cederle
      // los huecos a la cuenta nueva.
      const previousCode = useStore.getState().trainerSync.code;

      await supabaseSignOut().catch(() => {});
      const { code, userId } = await setupTrainerCodeAccount();
      setTrainerSyncMode('code', { code, userId });

      // Los huecos siguen siendo del dueño anterior y solo él puede cederlos
      // (`where trainer_id = auth.uid()`). Si la cuenta anterior era social no
      // se puede recuperar en silencio, así que ahí no hay traspaso posible
      // sin que el usuario vuelva a entrar en ella — limitación conocida.
      if (previousCode && previousCode !== code) {
        try {
          await recoverWithTrainerCode(previousCode);
          await transferMySlotsTo(userId);
        } catch (err) {
          console.error('[TrainerSync] traspaso desde el código anterior fallido:', err.message);
        }
        await recoverWithTrainerCode(code).catch(() => {});   // volver a la nueva
      }
      await useStore.getState().refreshTrainerSlots().catch(() => {});
      return code;
    } catch (err) {
      cb.current.onError?.(t('sync.errAccountTitle'), err.message ?? t('sync.errAccountBody'));
      return null;
    } finally {
      setLoading(false);
    }
  }

  return { loading, setLoading, isExpoGo, google, apple, recover, createWithCode };
}
