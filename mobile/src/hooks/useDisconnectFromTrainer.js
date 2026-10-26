/**
 * useDisconnectFromTrainer — desconectarse de tu entrenador (lado cliente), con
 * todo lo que la rodea: la pregunta, los entrenos sin enviar (E51), el aviso de
 * sin red (E52) y el asiento que cambió en otro móvil (E66).
 *
 * Es el único camino: ya no hay desconexiones implícitas (E67). Lo usan el botón
 * de la pantalla de Entrenador y, con el texto de R1, todo lo que usa otro
 * programa mientras hay entrenador.
 *
 *  - `disconnect({ forProgram, onDone, keepProgram })` pregunta, desconecta y,
 *    solo si se desconectó, llama a `onDone`. `forProgram` pone el texto de R1.
 *  - `guardProgramChange(programId, run)` lanza `run` ya si no hay entrenador o
 *    el programa es de su entrenador (cambiar entre ellos no avisa); si no,
 *    `run` espera a que se desconecte.
 */

import { useTranslation } from 'react-i18next';

import { useStore } from '../../store/useStore';
import { showDialog } from '../components/ui/dialog';

export function useDisconnectFromTrainer() {
  const { t }      = useTranslation();
  const unlink     = useStore((s) => s.unlinkFromTrainer);
  const showToast  = useStore((s) => s.showToast);

  const trainerName = () => useStore.getState().clientSync.trainerName || t('trainer.unnamedTrainer');

  // Si hay entrenos que no llegan, el store no desconecta y dice cuántos (E51).
  // Sin red se desconecta igual y el servidor se entera después (E52); si el
  // asiento cambió en otro móvil, no se desconecta (E66).
  async function run(force, { onDone, keepProgram }) {
    try {
      const { unsent, offline, changed } = await unlink({ force, keepProgram });
      if (unsent) {
        showDialog(t('trainer.unsentTitle'), t('trainer.unsentBody', { count: unsent }), [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('trainer.unsentConfirm'), style: 'destructive', onPress: () => run(true, { onDone, keepProgram }) },
        ]);
        return;
      }
      if (changed) {
        showDialog(t('trainer.disconnectTitle'), t('trainer.seatChanged', { trainer: trainerName() }));
        return;
      }
      if (offline) showToast(t('trainer.disconnectedOffline'), 3200);
      onDone?.();
    } catch {
      showToast(t('header.toastSyncFailed'), 2200, 'error');
    }
  }

  // R1 (`forProgram`) conserva el programa: el que va a usar se elige después, y
  // sin esto volvería el previo a la conexión (el propio archivado sin desarchivar).
  function disconnect({ forProgram = false, onDone, keepProgram = forProgram } = {}) {
    showDialog(
      t('trainer.disconnectTitle'),
      forProgram ? t('trainer.changeProgramBody', { trainer: trainerName() }) : t('trainer.disconnectBody'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('trainer.disconnectConfirm'), style: 'destructive', onPress: () => run(false, { onDone, keepProgram }) },
      ],
    );
  }

  function guardProgramChange(programId, then) {
    const { clientSync } = useStore.getState();
    if (!clientSync.slotId || clientSync.trainerProgramIds?.includes(programId)) return then();
    disconnect({ forProgram: true, onDone: then });
  }

  return { disconnect, guardProgramChange };
}
