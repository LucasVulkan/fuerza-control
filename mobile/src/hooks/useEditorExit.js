/**
 * La salida del modo edición.
 *
 * Programa, sesión, ejercicio y bloque son cuatro pantallas de UNA sola cosa:
 * editar el programa. El chevron navega dentro de ese modo —un nivel arriba— y
 * el check lo cierra desde donde estés, sin tener que subir escalón a escalón.
 *
 * No hay nada que "guardar": `programs` y `sessionTemplates` están en el
 * `partialize` del store, así que cada edición se escribe en AsyncStorage en el
 * momento. Lo único que hacía el viejo botón "Guardar programa" —y lo único que
 * hace `commit` aquí— es marcar a los clientes que tengan este programa para
 * que el entrenador vuelva a subírselo.
 *
 * El toast va en `commit` y no en `done`: salir por el chevron desde el editor
 * de programa también es salir del modo edición, y el toast es lo único que
 * dice que lo que tocaste ha quedado hecho.
 */
import { Keyboard } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../store/useStore';

export function useEditorExit(navigation) {
  const { t } = useTranslation();
  const markProgramDirtyForClients = useStore((s) => s.markProgramDirtyForClients);
  const showToast                  = useStore((s) => s.showToast);

  // Mismo programa que resuelve `ProgramEditorScreen`: el de la ficha de cliente
  // si se entró desde ahí, y si no el activo. Se lee del store en el momento y
  // no por suscripción: esto corre al salir, no en cada render.
  function commit() {
    Keyboard.dismiss();
    const st = useStore.getState();
    const programId = st.ui._editingProgramId ?? st.profile?.activeProgramId;
    if (programId) markProgramDirtyForClients(programId);
    showToast(t('editor.toastProgramEdited'), 2200, 'success');
  }

  // El check. `navigate` a una ruta que ya está en la pila vuelve a ella, así
  // que esto desapila el editor entero en vez de apilar otro Home encima.
  function done() {
    commit();
    navigation.navigate('Main', { screen: 'Home' });
  }

  return { commit, done };
}
