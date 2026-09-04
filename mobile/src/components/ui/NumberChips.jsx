/**
 * NumberChips — fila de números seleccionables, uno por chip, todos del mismo
 * ancho.
 *
 * Estaba escrita dos veces dentro del onboarding (la pregunta de días por
 * semana y el alta manual de programa) y hacía falta una tercera en la hoja de
 * nuevo programa del cliente. Es la respuesta de la app a "elige un número
 * pequeño de un rango corto": se ve el rango entero de un vistazo y se acierta
 * de un toque, a diferencia del `StepField`, que es para rangos largos donde
 * pintar todas las opciones no cabe.
 */

import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

import { spacing, textStyles } from '../../theme';
import { useThemedStyles } from '../../useTheme';

export default function NumberChips({ values, value, onChange }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.row}>
      {values.map((n) => (
        <TouchableOpacity
          key={n}
          style={[styles.chip, value === n && styles.chipOn]}
          onPress={() => onChange(n)}
          activeOpacity={0.75}
        >
          <Text style={[styles.chipText, value === n && styles.chipTextOn]}>{n}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const makeStyles = (th) => StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm },
  chip: {
    flex:            1,
    alignItems:      'center',
    paddingVertical: spacing.sm,
    borderRadius:    th.radius.sm,
    backgroundColor: th.colors.surface,
  },
  chipOn:     { backgroundColor: th.colors.accent },
  chipText:   { ...textStyles.cardTitle, color: th.colors.mutedLight },
  chipTextOn: { color: th.colors.onAccent },
});
