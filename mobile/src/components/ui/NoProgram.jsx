/**
 * NoProgram — «no hay programa activo» + el botón de crear uno.
 *
 * Vivía dentro de `HomeScreen`, que era la única pantalla que podía quedarse
 * sin nada que enseñar. Con el tab de Programa son dos (spec tab-programa §4.6):
 * Sesiones porque no tiene sesiones que listar y Programa porque no tiene
 * programa que enseñar, y las dos hacen la misma oferta.
 *
 * El aviso de desconexión es el mismo que el del menú `≡` —mismas claves— y
 * está por lo mismo: crear un programa nuevo estando vinculado te saca del
 * entrenador. Antes iba con las cadenas en castellano a pelo en el JSX; al
 * mudarse pasa a las claves que ya existían para el otro sitio.
 */
import { StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import EmptyState from './EmptyState';
import { ROW_ICON } from './rowIcons';
import { useStore } from '../../../store/useStore';
import { spacing } from '../../theme';

import { showDialog } from './dialog';
export default function NoProgram() {
  const { t }      = useTranslation();
  const navigate   = useStore((s) => s.navigate);
  const clientSync = useStore((s) => s.clientSync);

  const start = () => {
    if (!clientSync?.slotId) { navigate('onboarding'); return; }
    showDialog(
      t('header.newProgramWarnTitle'),
      t('header.newProgramWarnBody'),
      [
        { text: t('common.cancel'),   style: 'cancel' },
        { text: t('common.continue'), style: 'destructive', onPress: () => navigate('onboarding') },
      ],
    );
  };

  return (
    <EmptyState
      style={styles.wrap}
      icon={ROW_ICON.exercise}
      text={t('home.noActiveProgram')}
      action={{ label: t('home.newProgram'), onPress: start }}
    />
  );
}

// Va dentro de una lista que se desplaza, no ocupa la pantalla.
const styles = StyleSheet.create({
  wrap: { paddingVertical: spacing.xxl * 2 },
});
