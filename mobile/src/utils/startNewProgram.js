import { showDialog } from '../components/ui/dialog';
import { useStore } from '../../store/useStore';

/**
 * «Nuevo programa»: el ≡ y el ··· de tu programa hacen exactamente esto. Con
 * entrenador, avisa de que se desconecta; `onDone` cierra la hoja de quien llama.
 * Abre el recorrido de entrada por su otra puerta (`entry: 'newProgram'`, O03 §25) y
 * apila `Start` sobre la app: la flecha de su primera pantalla vuelve a donde estaba.
 */
export function startNewProgram(t, clientSync, navigate, onDone) {
  const go = () => {
    onDone?.();
    useStore.getState().startOnboardingFlow({ entry: 'newProgram' });
    navigate('start');
  };
  if (!clientSync?.slotId) return go();
  showDialog(
    t('header.newProgramWarnTitle'),
    t('header.newProgramWarnBody'),
    [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.continue'), style: 'destructive', onPress: go },
    ],
  );
}
