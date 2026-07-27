/**
 * SupersetBlock — wraps 2+ chained ExerciseCards (03A/03B…) alternating with no
 * rest between members. Purely presentational: the rest-timer suppression and
 * the 03A/03B labelling are computed by the caller (WorkoutScreen).
 *
 * El bloque en sí es INVISIBLE: sin fondo ni borde propio, solo la línea de
 * acento a la izquierda que marca "esto es una superserie". La cohesión del par
 * la aporta la costura entre cards (gap 2 + esquinas interiores a radio 4, ver
 * `groupPos` en ExerciseCard), no una tarjeta contenedora.
 */
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { spacing, typography, textStyles } from '../../theme';
import { useTheme, useThemedStyles } from '../../useTheme';

export default function SupersetBlock({ rounds, restSec, children, onAddSet }) {
  const { t }  = useTranslation();
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
      {/* Un único enlace para todo el grupo — añade una serie a cada miembro a la vez */}
      {onAddSet && (
        <TouchableOpacity style={styles.addSetLink} onPress={onAddSet} activeOpacity={0.7}>
          <Text style={[styles.addSetText, styles.addSetPlus]}>+</Text>
          <Text style={styles.addSetText}>{t('workout.addSetBtn')}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const makeStyles = (th) => StyleSheet.create({
  // Bloque invisible: sin fondo ni tarjeta. Lo único que queda es la barra
  // izquierda de acento (marcador estructural "esto es una superserie"). El
  // paddingLeft separa esa línea de las esquinas redondeadas de las cards.
  block: {
    borderLeftWidth: 3,
    borderLeftColor: th.colors.accent,
    paddingLeft:     spacing.md,
    gap:             spacing.sm,
  },
  header: {
    fontSize:      typography.xs,
    fontWeight:    typography.bold,
    color:         th.colors.accent,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  // La costura del par: 2px entre cards (frente a los 14 normales). Las esquinas
  // interiores las aplana cada ExerciseCard vía `groupPos`.
  members: {
    gap: 2,
  },
  footer: {
    ...textStyles.subtitle,
    color:     th.colors.text,
    textAlign: 'center',
  },
  footerSec: {
    color: th.colors.accent,
  },
  // Mismo AddSetLink que la card suelta (spec §4.6): texto centrado, sin caja.
  addSetLink: {
    flexDirection:  'row',
    justifyContent: 'center',
    alignItems:     'center',
    gap:            6,
    paddingTop:     6,
    paddingBottom:  2,
  },
  addSetText: {
    fontFamily:    'Inter_800ExtraBold',
    fontSize:      13,
    fontWeight:    '800',
    letterSpacing: 0.26,
    color:         th.colors.mutedLight,
  },
  addSetPlus: { color: th.colors.accent },
});
