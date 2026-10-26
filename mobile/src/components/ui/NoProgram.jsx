/**
 * NoProgram — «no hay programa activo» + el botón de crear uno.
 *
 * Vivía dentro de `HomeScreen`, que era la única pantalla que podía quedarse
 * sin nada que enseñar. Con el tab de Programa son dos (spec tab-programa §4.6):
 * Sesiones porque no tiene sesiones que listar y Programa porque no tiene
 * programa que enseñar, y las dos hacen la misma oferta.
 *
 * Una sola entrada: `startNewProgram`, la del menú `≡`, con su aviso de
 * desconexión (crear un programa nuevo estando vinculado te saca del entrenador).
 */
import { StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import EmptyState from './EmptyState';
import { ROW_ICON } from './rowIcons';
import { useStore } from '../../../store/useStore';
import { spacing } from '../../theme';
import { startNewProgram } from '../../utils/startNewProgram';
import { useDisconnectFromTrainer } from '../../hooks/useDisconnectFromTrainer';

export default function NoProgram() {
  const { t }      = useTranslation();
  const navigate   = useStore((s) => s.navigate);
  const { guardProgramChange } = useDisconnectFromTrainer();

  return (
    <EmptyState
      style={styles.wrap}
      icon={ROW_ICON.exercise}
      text={t('home.noActiveProgram')}
      action={{ label: t('home.newProgram'), onPress: () => startNewProgram(guardProgramChange, navigate) }}
    />
  );
}

// Va dentro de una lista que se desplaza, no ocupa la pantalla.
const styles = StyleSheet.create({
  wrap: { paddingVertical: spacing.xxl * 2 },
});
