/**
 * SupersetBlock — wraps 2+ chained ExerciseCards (A1/A2…) alternating with no
 * rest between members. Purely presentational: the rest-timer suppression and
 * A1/A2 labelling are computed by the caller (WorkoutScreen).
 */
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { spacing, typography, textStyles, borders } from '../../theme';
import { useTheme, useThemedStyles } from '../../useTheme';

export default function SupersetBlock({ rounds, restSec, children, onAddSet }) {
  const { t }  = useTranslation();
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);

  return (
    <View style={styles.block}>
      <Text style={styles.header}>
        {t('workout.supersetHeader', { count: rounds })}
      </Text>
      <View style={styles.members}>{children}</View>
      <Text style={styles.footer}>
        {t('workout.supersetFooterPrefix')}
        <Text style={styles.footerSec}>{restSec}s</Text>
        {t('workout.supersetFooterSuffix')}
      </Text>
      {/* Un único botón para todo el grupo — añade una serie a cada miembro a la vez */}
      {onAddSet && (
        <TouchableOpacity style={styles.addSetBtn} onPress={onAddSet} activeOpacity={0.7}>
          <Text style={styles.addSetText}>+ {t('workout.addSetBtn')}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const makeStyles = (th) => StyleSheet.create({
  // Mismo fondo que las Exercice Cards que envuelve — el grupo debe leerse como
  // un único componente, no como una tarjeta extra detrás de las tarjetas.
  // Sin padding lateral propio: cada miembro (ExerciseCard) va a sangre de lado a
  // lado del bloque, así el fondo teñido de su header también llega de lado a lado
  // de la tarjeta de superserie (no solo de su propia card). El resto de contenido
  // (label, footer, botón) gestiona su propio inset por separado.
  block: {
    borderLeftWidth: 3,
    borderLeftColor: th.colors.accent,
    borderRadius:    th.radius.md,
    backgroundColor: th.colors.surface,
    paddingTop:      spacing.md,
    paddingBottom:   spacing.md,
    gap:             spacing.xs,
  },
  header: {
    fontSize:          typography.xs,
    fontWeight:        typography.bold,
    color:             th.colors.accent,
    letterSpacing:     0.8,
    textTransform:     'uppercase',
    paddingHorizontal: spacing.sm,
  },
  // Sin gap entre cards — cada ExerciseCard miembro ya recorta su propio
  // paddingBottom (cardSupersetMember), evitando el hueco excesivo que se
  // acumulaba (paddingBottom de la card + gap del bloque).
  members: {
    gap: 0,
  },
  // Separación propia respecto al botón de abajo — el `gap` del bloque ya lo
  // acerca al grid de arriba, pero quedaba pegado al botón sin este margen.
  // paddingHorizontal propio: el bloque ya no lo aporta (ver `block`).
  footer: {
    ...textStyles.subtitle,
    color:             th.colors.text,
    textAlign:         'center',
    marginBottom:      spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  footerSec: {
    color: th.colors.accent,
  },
  addSetBtn: {
    marginHorizontal: spacing.sm,
    paddingVertical:  spacing.md,
    borderWidth:      borders.thin,
    borderColor:      th.tint.accent50,
    borderRadius:     th.radius.md,
    alignItems:       'center',
  },
  addSetText: {
    ...textStyles.cardType,
    color: th.tint.accent50,
  },
});
