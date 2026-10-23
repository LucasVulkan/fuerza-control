/**
 * Borrador del editor (P16-01): lo usa la pantalla BASE del editor —la primera
 * que se apila: `ProgramEditor`, o `SessionEditor` con `editorBase: true`—.
 * El check guarda (`useEditorExit.done` borra la copia); Cancelar, el chevron y
 * el atrás de Android/iOS pasan por `beforeRemove`: sin cambios salen, con
 * cambios preguntan y descartar escribe la copia de vuelta.
 * `customExercises` no se toca: son de la librería, no del programa.
 */
import { useEffect } from 'react';
import { Keyboard } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../store/useStore';
import { showDialog } from '../components/ui/dialog';
import { makeEditorDraft, restoreEditorDraft, selectEditorDirty } from '../utils/editorDraft';

const setDraft = (draft) => useStore.setState((s) => ({ ui: { ...s.ui, _editorDraft: draft } }));

export const clearEditorDraft = () => {
  if (useStore.getState().ui._editorDraft) setDraft(null);
};

// Borrar sin diálogo con Deshacer (P16-07). Mismo mecanismo que el borrador, a
// escala pequeña: copia de lo que toca el borrado (`kind`/`id` como en
// `makeEditorDraft`), se borra y el toast de 5 s lo escribe de vuelta.
// `msg` lleva el nombre entre <b></b>. ponytail: solo vale lo último; si se edita
// otra cosa del mismo programa en esos 5 s, Deshacer también la revierte.
export function deleteWithUndo({ kind, id, msg, label, remove }) {
  const snap = makeEditorDraft(useStore.getState(), kind, id);
  remove();
  if (!snap) return;
  useStore.getState().showToast(msg, 5000, 'neutral', {
    label,
    onPress: () => useStore.setState((s) => restoreEditorDraft(s, snap)),
  });
}

// `target`: { kind: 'program' | 'template', id } o null si aún no se sabe.
export function useEditorBase(navigation, isBase, target) {
  const { t } = useTranslation();
  const kind = target?.kind;
  const id   = target?.id;

  // Copia al entrar; se suelta al salir de verdad (check, descartar o desmontar).
  useEffect(() => {
    if (!isBase || !kind || !id) return;
    setDraft(makeEditorDraft(useStore.getState(), kind, id));
    return clearEditorDraft;
  }, [isBase, kind, id]);

  useEffect(() => {
    if (!isBase) return;
    return navigation.addListener('beforeRemove', (e) => {
      const st = useStore.getState();
      const d  = st.ui._editorDraft;
      if (!d || !selectEditorDirty(st)) return; // sin copia (check, descartado) o sin cambios: sale
      e.preventDefault();
      const name = d.kind === 'program'
        ? st.programs[d.id]?.name
        : st.sessionTemplates[d.id]?.name || t('freeSession.templateUnnamed');
      showDialog(
        t('editor.discardTitle'),
        t(d.kind === 'program' ? 'editor.discardBody' : 'editor.discardBodySession'),
        [
          { text: t('editor.keepEditing'), style: 'cancel' },
          {
            text: t('editor.discardConfirm'), style: 'destructive',
            onPress: () => {
              const draft = useStore.getState().ui._editorDraft;
              if (draft) {
                // El toast Deshacer de un borrado caduca con el descarte: ya no hay nada que deshacer.
                useStore.setState((s) => ({
                  ...restoreEditorDraft(s, draft),
                  ui: { ...s.ui, _editorDraft: null, toast: s.ui.toast?.action ? null : s.ui.toast },
                }));
              }
              navigation.dispatch(e.data.action);
            },
          },
        ],
        { subtitle: name },
      );
    });
  }, [navigation, isBase, t]);

  // Cancelar: salir y que `beforeRemove` decida si hay que preguntar.
  return {
    cancel: () => {
      Keyboard.dismiss();
      navigation.goBack();
    },
  };
}
