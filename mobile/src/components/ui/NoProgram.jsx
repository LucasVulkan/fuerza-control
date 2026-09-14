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
import { View, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Text } from './Text';
import { useStore } from '../../../store/useStore';
import { spacing, textStyles, lh } from '../../theme';
import { useThemedStyles } from '../../useTheme';

export default function NoProgram() {
  const { t }      = useTranslation();
  const styles     = useThemedStyles(makeStyles);
  const navigate   = useStore((s) => s.navigate);
  const clientSync = useStore((s) => s.clientSync);

  const start = () => {
    if (!clientSync?.slotId) { navigate('onboarding'); return; }
    Alert.alert(
      t('header.newProgramWarnTitle'),
      t('header.newProgramWarnBody'),
      [
        { text: t('common.cancel'),   style: 'cancel' },
        { text: t('common.continue'), style: 'destructive', onPress: () => navigate('onboarding') },
      ],
    );
  };

  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyIcon}>🏋️</Text>
      <Text style={styles.emptyText}>{t('home.noActiveProgram')}</Text>
      <TouchableOpacity
        style={styles.newProgramBtn}
        onPress={start}
        activeOpacity={0.85}
        accessibilityRole="button"
      >
        <Text style={styles.newProgramBtnText}>{t('home.newProgram')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const makeStyles = (th) => StyleSheet.create({
  emptyState: {
    alignItems:      'center',
    paddingVertical: spacing.xxl * 2,
    gap:             spacing.lg,
  },
  emptyIcon: { fontSize: 40 },
  emptyText: {
    ...textStyles.body,
    color:      th.colors.mutedLight,
    textAlign:  'center',
    lineHeight: lh(textStyles.body.fontSize),
  },
  newProgramBtn: {
    backgroundColor:   th.colors.accent,
    borderRadius:      th.radius.md,
    paddingHorizontal: spacing.xxl,
    paddingVertical:   spacing.lg,
    marginTop:         spacing.sm,
  },
  newProgramBtnText: { ...textStyles.button, color: th.colors.bg },
});
