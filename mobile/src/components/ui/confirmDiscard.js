/**
 * confirmDiscardActive — «Descartar sesión» antes de empezar otra con una a
 * medias (U53). Dice cuál se pierde y cuánto llevas, en su propia línea bajo
 * el título; la frase, en afirmativo (regla de U33).
 */
import { useStore } from '../../../store/useStore';
import { activeSessionSummary, activeSessionLine } from '../../utils/activeSession';
import { showDialog } from './dialog';

export function confirmDiscardActive(t, onConfirm) {
  const summary = activeSessionSummary(useStore.getState(), t);
  showDialog(t('workout.discardSession'), t('workout.discardConfirm'), [
    { text: t('common.cancel'), style: 'cancel' },
    { text: t('workout.discardSession'), style: 'destructive', onPress: onConfirm },
  ], { subtitle: summary ? activeSessionLine(summary, t) : null });
}
