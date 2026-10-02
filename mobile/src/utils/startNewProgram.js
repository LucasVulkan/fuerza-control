import { showDialog } from '../components/ui/dialog';

/**
 * «Nuevo programa»: el ≡ y el ··· de tu programa hacen exactamente esto. Con
 * entrenador, avisa de que se desconecta; `onDone` cierra la hoja de quien llama.
 */
export function startNewProgram(t, clientSync, navigate, onDone) {
  const go = () => { onDone?.(); navigate('onboarding'); };
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
