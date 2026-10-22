/**
 * La salida del modo edición.
 *
 * Programa, sesión, ejercicio y bloque son cuatro pantallas de UNA sola cosa:
 * editar el programa. El chevron navega dentro de ese modo —un nivel arriba— y
 * el check lo cierra desde donde estés, sin tener que subir escalón a escalón.
 *
 * Los cambios se escriben en el store al momento, pero la base del editor
 * guarda una copia (P16-01, `useEditorDraft`): el check la borra y marca a los
 * clientes que tengan este programa para que el entrenador vuelva a subírselo;
 * Cancelar, en la base, la escribe de vuelta. Subir con el chevron desde un
 * nivel de dentro no guarda ni descarta nada.
 */
import { Keyboard } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../store/useStore';
import { backToMain } from '../navigation/navigationRef';
import { clearEditorDraft } from './useEditorDraft';

// `templateId`: la sesión que se edita, si la hay. Una sesión libre no es de
// ningún programa, así que salir de ella no puede marcar el activo como
// pendiente de reenviar ni decir «Programa editado» (T06-free-sessions.md §5).
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
      // La de un cliente viaja con su programa: queda pendiente de enviar
      // (C06-group-classes.md §4.2).
      if ((tpl.owner ?? 'me') !== 'me') st.markClientDirty(tpl.owner);
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
    clearEditorDraft(); // antes de salir: sin copia, `beforeRemove` de la base no pregunta
    commit();
    backToMain(navigation);
  }

  return { done };
}
