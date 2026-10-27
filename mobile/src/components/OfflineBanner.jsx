/**
 * U15-01 · Una línea fija «Sin conexión» mientras `ui.online === false`. Solo
 * se monta donde la conexión importa (Clientes y conexión con entrenador): en
 * el Workout se entrena sin conexión y no sale nada.
 */
import { StyleSheet } from 'react-native';
import { Text } from './ui/Text';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../store/useStore';
import { spacing, textStyles, borders, lh } from '../theme';
import { useThemedStyles } from '../useTheme';

export default function OfflineBanner() {
  const { t } = useTranslation();
  const offline = useStore((s) => s.ui.online === false);
  const styles = useThemedStyles(makeStyles);
  if (!offline) return null;
  return <Text style={styles.banner}>{t('sync.offlineBanner')}</Text>;
}

const makeStyles = (th) => StyleSheet.create({
  banner: {
    ...textStyles.label,
    lineHeight:        lh(textStyles.label.fontSize),
    color:             th.colors.orange,
    textAlign:         'center',
    backgroundColor:   `${th.colors.orange}1e`,
    borderBottomWidth: borders.thin,
    borderBottomColor: `${th.colors.orange}4d`,
    paddingHorizontal: spacing.xl,
    paddingVertical:   spacing.sm,
  },
});
