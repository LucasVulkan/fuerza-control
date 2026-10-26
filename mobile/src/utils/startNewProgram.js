import { useStore } from '../../store/useStore';

/**
 * «Nuevo programa»: el ≡ y el ··· de tu programa hacen exactamente esto. Con
 * entrenador, antes pregunta si te desconectas (`guardProgramChange`, R1) y solo
 * entonces sigue; `onDone` cierra la hoja de quien llama.
 * Abre el recorrido de entrada por su otra puerta (`entry: 'newProgram'`, O03 §25) y
 * apila `Start` sobre la app: la flecha de su primera pantalla vuelve a donde estaba.
 */
export function startNewProgram(guardProgramChange, navigate, onDone) {
  guardProgramChange(null, () => {
    onDone?.();
    useStore.getState().startOnboardingFlow({ entry: 'newProgram' });
    navigate('start');
  });
}
