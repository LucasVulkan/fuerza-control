/**
 * SupersetBlock — wraps 2+ chained ExerciseCards (A1/A2…) alternating with no
 * rest between members. Purely presentational: the rest-timer suppression and
 * A1/A2 labelling are computed by the caller (WorkoutScreen).
 */
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { spacing, typography, withOpacity } from '../../theme';
import { useTheme, useThemedStyles } from '../../useTheme';

export default function SupersetBlock({ rounds, restSec, children }) {
  const { t }  = useTranslation();
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);

  return (
    <View style={styles.block}>
      <Text style={styles.header}>
        {t('workout.supersetHeader', { count: rounds })}
      </Text>
      <View style={styles.members}>{children}</View>
      <Text style={styles.footer}>{t('workout.supersetFooter', { sec: restSec })}</Text>
    </View>
  );
}

const makeStyles = (th) => StyleSheet.create({
  block: {
    borderLeftWidth: 3,
    borderLeftColor: th.colors.accent,
    borderRadius:    th.radius.md,
    backgroundColor: withOpacity(th.colors.accent, 0.03),
    paddingLeft:     spacing.sm,
    paddingVertical: spacing.sm,
    gap:             spacing.sm,
  },
  header: {
    fontSize:          typography.xs,
    fontWeight:        typography.bold,
    color:             th.colors.accent,
    letterSpacing:     0.8,
    textTransform:     'uppercase',
    paddingHorizontal: spacing.xs,
  },
  members: {
    gap: spacing.sm,
  },
  footer: {
    fontSize:          typography.xs,
    color:             th.colors.muted,
    paddingHorizontal: spacing.xs,
  },
});
