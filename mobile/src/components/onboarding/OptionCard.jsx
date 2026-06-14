/**
 * OptionCard — tarjeta seleccionable.
 * Selección única: indicador circular.  Multi: indicador cuadrado.
 * Fiel al original web: mismos estados (selected, disabled, detail expandido).
 */
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { spacing, typography, borders, withOpacity } from '../../theme';
import { useThemedStyles } from '../../useTheme';

export default function OptionCard({
  label,
  description,
  detail,
  selected,
  disabled    = false,
  disabledReason,
  multi       = false,
  onClick,
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <TouchableOpacity
      onPress={disabled ? undefined : onClick}
      activeOpacity={disabled ? 1 : 0.75}
      style={[
        styles.card,
        selected  && styles.cardSelected,
        disabled  && styles.cardDisabled,
      ]}
    >
      {/* Indicador: círculo (single) o cuadrado (multi) */}
      <View style={[
        styles.indicator,
        multi    && styles.indicatorSquare,
        selected && styles.indicatorOn,
      ]}>
        {selected && <Text style={styles.check}>✓</Text>}
      </View>

      {/* Contenido */}
      <View style={styles.body}>
        <Text style={[styles.label, disabled && styles.labelDim]}>{label}</Text>

        {description ? (
          <Text style={styles.desc}>{description}</Text>
        ) : null}

        {disabled && disabledReason ? (
          <Text style={styles.disabledReason}>{disabledReason}</Text>
        ) : null}

        {selected && detail ? (
          <View style={styles.detailBox}>
            <Text style={styles.detailText}>{detail}</Text>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

const makeStyles = (th) => StyleSheet.create({
  card: {
    flexDirection:   'row',
    alignItems:      'flex-start',
    gap:             spacing.md,
    backgroundColor: th.colors.surface,
    borderWidth:     borders.thin,
    borderColor:     th.colors.border,
    borderRadius:    th.radius.md,
    padding:         spacing.lg,
    marginBottom:    spacing.sm,
  },
  cardSelected: {
    backgroundColor: withOpacity(th.colors.accent, 0.08),
    borderColor:     th.colors.accent,
  },
  cardDisabled: { opacity: 0.45 },

  indicator: {
    width:           18,
    height:          18,
    borderRadius:    9,
    borderWidth:     2,
    borderColor:     th.colors.border,
    backgroundColor: 'transparent',
    marginTop:       2,
    flexShrink:      0,
    alignItems:      'center',
    justifyContent:  'center',
  },
  indicatorSquare: { borderRadius: 4 },
  indicatorOn: {
    backgroundColor: th.colors.accent,
    borderColor:     th.colors.accent,
  },
  check: { fontSize: 10, color: th.colors.onAccent, fontWeight: '700' },

  body:     { flex: 1 },
  label:    { fontSize: typography.md, fontWeight: typography.medium, color: th.colors.text },
  labelDim: { color: th.colors.muted },
  desc: {
    fontSize:   typography.sm,
    color:      th.colors.muted,
    marginTop:  3,
    lineHeight: typography.sm * 1.55,
  },
  disabledReason: {
    fontSize:  11,
    color:     th.colors.accent,
    opacity:   0.7,
    marginTop: 4,
  },
  detailBox: {
    marginTop:       spacing.sm,
    padding:         spacing.sm,
    backgroundColor: withOpacity(th.colors.accent, 0.08),
    borderRadius:    th.radius.sm,
  },
  detailText: { fontSize: 11, color: th.colors.accent, lineHeight: 11 * 1.6 },
});
