/**
 * SegmentedControl — control de selección tipo "pill group", 1 línea.
 *
 * Variante "Group together" de Figma (FormaFit). No implementa la variante
 * de 2 líneas ("Etapas") — no hace falta para los usos actuales.
 */
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { textStyles } from '../../theme';
import { useThemedStyles } from '../../useTheme';

export default function SegmentedControl({ options, value, onChange }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.container}>
      {options.map(({ id, label }) => {
        const active = value === id;
        return (
          <TouchableOpacity
            key={id}
            style={[styles.option, active && styles.optionActive]}
            onPress={() => onChange(id)}
            activeOpacity={0.75}
          >
            <Text style={[styles.optionText, active && styles.optionTextActive]}>
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const makeStyles = (th) => StyleSheet.create({
  container: {
    flexDirection:   'row',
    backgroundColor: th.colors.surface2,
    borderRadius:    th.radius.md,
    padding:         4,
    gap:             6,
  },
  option: {
    flex:            1,
    borderRadius:    th.radius.sm,
    paddingVertical: 8,
    alignItems:      'center',
  },
  optionActive: {
    backgroundColor: th.colors.accent,
  },
  optionText: {
    ...textStyles.cardType,
    color:         th.colors.mutedLight,
    textTransform: 'uppercase',
  },
  optionTextActive: {
    color: th.colors.onAccent,
  },
});
