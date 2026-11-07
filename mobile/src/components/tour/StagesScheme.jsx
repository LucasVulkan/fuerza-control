/**
 * El esquema del paso «Etapas» del editor de programa (U17-03): cuatro etapas de
 * ejemplo en fila, con su nombre y su duración, que terminan en una descarga. El
 * ancho sigue a las semanas (con un mínimo para que quepa «Descarga»); son fichas
 * `surface` con el radio de las de etapa, y la descarga en azul, como allí.
 */
import { View, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Text } from '../ui/Text';
import { spacing, textStyles } from '../../theme';
import { useThemedStyles } from '../../useTheme';

const STAGES = [
  { id: 'adaptation',  weeks: 3 },
  { id: 'hypertrophy', weeks: 4 },
  { id: 'strength',    weeks: 4 },
  { id: 'deload',      weeks: 1, deload: true },
];

export default function StagesScheme() {
  const { t }  = useTranslation();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.row} pointerEvents="none">
      {STAGES.map((s) => (
        <View key={s.id} style={[styles.card, { flexGrow: s.weeks }]}>
          <Text style={[styles.name, s.deload && styles.deload]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
            {t(`tour.programEditor.fig_${s.id}`)}
          </Text>
          <Text style={styles.weeks}>{t('tour.programEditor.figWeeks', { count: s.weeks })}</Text>
        </View>
      ))}
    </View>
  );
}

const makeStyles = (th) => StyleSheet.create({
  row:  { flexDirection: 'row', gap: spacing.xs2 },
  card: {
    flexBasis:       0,
    minWidth:        58,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs2,
    borderRadius:    th.radius.md,
    backgroundColor: th.colors.surface,
    alignItems:      'center',
    gap:             spacing.xs,
  },
  name:    { ...textStyles.micro, color: th.colors.text },
  deload:  { color: th.colors.blue },
  weeks:   { ...textStyles.micro, color: th.colors.mutedLight },
});
