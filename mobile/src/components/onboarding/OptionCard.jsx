/**
 * OptionCard — tarjeta seleccionable.
 * Selección única: indicador circular.  Multi: indicador cuadrado.
 * Fiel al original web: mismos estados (selected, disabled, detail expandido).
 */
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, spacing, typography, radius, borders, withOpacity } from '../../theme';

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

const styles = StyleSheet.create({
  card: {
    flexDirection:   'row',
    alignItems:      'flex-start',
    gap:             spacing.md,
    backgroundColor: colors.surface,
    borderWidth:     borders.thin,
    borderColor:     colors.border,
    borderRadius:    radius.md,
    padding:         spacing.lg,
    marginBottom:    spacing.sm,
  },
  cardSelected: {
    backgroundColor: withOpacity(colors.accent, 0.08),
    borderColor:     colors.accent,
  },
  cardDisabled: { opacity: 0.45 },

  indicator: {
    width:           18,
    height:          18,
    borderRadius:    9,
    borderWidth:     2,
    borderColor:     colors.border,
    backgroundColor: 'transparent',
    marginTop:       2,
    flexShrink:      0,
    alignItems:      'center',
    justifyContent:  'center',
  },
  indicatorSquare: { borderRadius: 4 },
  indicatorOn: {
    backgroundColor: colors.accent,
    borderColor:     colors.accent,
  },
  check: { fontSize: 10, color: colors.onAccent, fontWeight: '700' },

  body:     { flex: 1 },
  label:    { fontSize: typography.md, fontWeight: typography.medium, color: colors.text },
  labelDim: { color: colors.muted },
  desc: {
    fontSize:   typography.sm,
    color:      colors.muted,
    marginTop:  3,
    lineHeight: typography.sm * 1.55,
  },
  disabledReason: {
    fontSize:  11,
    color:     colors.accent,
    opacity:   0.7,
    marginTop: 4,
  },
  detailBox: {
    marginTop:       spacing.sm,
    padding:         spacing.sm,
    backgroundColor: withOpacity(colors.accent, 0.08),
    borderRadius:    radius.sm,
  },
  detailText: { fontSize: 11, color: colors.accent, lineHeight: 11 * 1.6 },
});
