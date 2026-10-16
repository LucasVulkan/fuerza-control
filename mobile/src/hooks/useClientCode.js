/**
 * useClientCode — la lógica de conectarse con un entrenador por su código
 * (los pasos «enter» y «confirm» de `ClientCodeModal`): validar el código,
 * guardar el hueco encontrado, la elección de historial y conectar
 * (`linkToTrainer`, o `confirmGoogleReconnect` si se llegó con una cuenta).
 *
 * La usan la hoja `ClientCodeModal` y las pantallas del recorrido de entrada
 * (O03-05: c_code → c_confirm → c_linked). Estas últimas son componentes
 * distintos que se desmontan al avanzar, así que el estado vive en un store
 * de módulo (sin persistir) y no en `useState`. Nunca hay dos usos a la vez:
 * la hoja se cierra con `reset()` (también al desmontarse) y el recorrido
 * lo hace al conectar.
 */
import { create } from 'zustand';
import { useTranslation } from 'react-i18next';

import { useStore } from '../../store/useStore';

const INITIAL = {
  step:           'enter',    // 'enter' | 'confirm'
  code:           '',
  slotInfo:       null,       // { slotId, programName, trainerName?, alreadyLinked, hasRemoteHistory }
  historyMode:    'program',  // 'program' | 'merge'
  googleUserId:   null,       // si la cuenta social encontró un hueco
  socialProvider: 'google',   // con cuál se encontró
  loading:        false,
  error:          null,
  errorCode:      null,       // 'SEAT_LOCKED' → la pantalla ofrece entrar con Google/Apple
};

const useSession = create(() => INITIAL);
const patch = (p) => useSession.setState(p);

// Estables entre renders: se pueden usar como dependencia de un efecto.
const ACTIONS = {
  setCode:        (code) => patch({ code }),
  setHistoryMode: (historyMode) => patch({ historyMode }),
  setError:       (error) => patch({ error, errorCode: null }),
  back:           () => patch({ step: 'enter' }),
  reset:          () => patch(INITIAL),
};

export default function useClientCode() {
  const { t } = useTranslation();
  const s = useSession();
  const alreadyLinked = useStore((st) => !!st.clientSync.slotId);

  /**
   * Las RPC de conexión lanzan códigos secos y `supabaseSync` los deja en
   * `err.code`. Se ramifica por ahí y no por el texto: un código seco no es un
   * error que el usuario deba leer en crudo, es una instrucción de qué hacer.
   */
  function errorText(err) {
    if (err?.code === 'CODE_NOT_FOUND') return t('trainer.errCodeNotFound');
    return err?.message ?? t('trainer.errGoogle');
  }

  /** Busca el hueco del código. `true` si lo encontró (queda en el paso «confirm»). */
  async function validate(value = s.code) {
    if (!value.trim()) return false;
    patch({ loading: true, error: null, errorCode: null });
    try {
      const info = await useStore.getState().validateClientCode(value);
      patch({
        slotInfo: info,
        // Historial en el hueco: lo que te apuntó tu entrenador, o el tuyo de
        // antes de reinstalar (el código siempre vale, C09 §4.6). Fusionar es
        // lo que quieres casi siempre (C05-trainer-logging.md §4.3, C20).
        historyMode: info.hasRemoteHistory ? 'merge' : 'program',
        step: 'confirm',
      });
      return true;
    } catch (err) {
      patch({ error: errorText(err), errorCode: err?.code ?? null });
      return false;
    } finally {
      patch({ loading: false });
    }
  }

  /** Conecta. `true` si salió bien; si no, el error queda en `error`. No limpia: lo hace quien llama (`reset`). */
  async function confirm() {
    const { googleUserId, slotInfo, socialProvider, historyMode, code } = useSession.getState();
    const { confirmGoogleReconnect, linkToTrainer } = useStore.getState();
    patch({ loading: true, error: null });
    try {
      if (googleUserId) {
        await confirmGoogleReconnect({
          slotId:       slotInfo.slotId,
          googleUserId,
          provider:     socialProvider,
          mergeHistory: historyMode === 'merge',
        });
      } else {
        await linkToTrainer(code, { mergeHistory: historyMode === 'merge' });
      }
      return true;
    } catch (err) {
      patch({ error: errorText(err) });
      return false;
    } finally {
      patch({ loading: false });
    }
  }

  /** La cuenta social (Google/Apple) encontró un hueco: pasa a confirmar. */
  function foundByAccount({ userId, provider, slot }) {
    patch({
      googleUserId:   userId,
      socialProvider: provider,
      slotInfo: {
        slotId:           slot.slotId,
        programName:      slot.programName,
        hasRemoteHistory: slot.hasRemoteHistory,
        alreadyLinked:    false,
      },
      historyMode: 'program',
      step: 'confirm',
    });
  }

  return {
    ...s,
    alreadyLinked,
    ...ACTIONS,
    validate,
    confirm,
    foundByAccount,
  };
}
