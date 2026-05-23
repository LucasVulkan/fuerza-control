import { View, StyleSheet } from 'react-native';
import { colors } from '../../theme';

/**
 * Barra de progreso — fiel al original web.
 * Segmentos finos (h=3) con transición de color accent → border.
 */
export default function OnboardingProgress({ current, total }) {
  return (
    <View style={styles.row}>
      {Array.from({ length: total }).map((_, i) => (
        <View key={i} style={[styles.bar, i < current && styles.barFilled]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 4 },
  bar: {
    flex:            1,
    height:          3,
    borderRadius:    2,
    backgroundColor: colors.border,
  },
  barFilled: { backgroundColor: colors.accent },
});
