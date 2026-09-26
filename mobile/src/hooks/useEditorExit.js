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
import { backToMain } from '../navigation/navigationRef';

// `templateId`: la sesión que se edita, si la hay. Una sesión libre no es de
// ningún programa, así que salir de ella no puede marcar el activo como
// pendiente de reenviar ni decir «Programa editado» (free-sessions.md §5).
export function useEditorExit(navigation, templateId = null) {
  const { t } = useTranslation();
  const markProgramDirtyForClients = useStore((s) => s.markProgramDirtyForClients);
  const showToast                  = useStore((s) => s.showToast);

  // Mismo programa que resuelve `ProgramEditorScreen`: el de la ficha de cliente
  // si se entró desde ahí, y si no el activo. Se lee del store en el momento y
  // no por suscripción: esto corre al salir, no en cada render.
  function commit() {
    Keyboard.dismiss();
    const st = useStore.getState();
    const tpl = templateId ? st.sessionTemplates[templateId] : null;
    if (tpl && !tpl.programId) {
      // ponytail: el dueño siempre es 'me' hasta group-classes.md §4.2; ahí esto
      // marcará a ESE cliente como pendiente de reenviar.
      showToast(t('freeSession.toastSaved'), 2200, 'success');
      return;
    }
    const programId = st.ui._editingProgramId ?? st.profile?.activeProgramId;
    if (programId) markProgramDirtyForClients(programId);
    showToast(t('editor.toastProgramEdited'), 2200, 'success');
  }

  // El check. En React Navigation 7 `navigate('Main', …)` APILA otro Main en
  // vez de volver al que ya está en la pila; `backToMain` desapila el editor
  // entero. Sin params, Main conserva la pestaña desde la que se abrió el
  // editor (Clientes, Plantillas, Programa o Home).
  function done() {
    commit();
    backToMain(navigation);
  }

  return { commit, done };
}
