/**
 * Las piezas de las cuatro preguntas antes de las plantillas (O04-03, spec §4):
 *
 *   FlowSteps    la barra «N de 4» de arriba de la pregunta
 *   FlowImplies  el panel «Qué implica»: los puntos de la respuesta marcada. Los
 *                avisos (`warns`) llevan el punto naranja y el texto en
 *                `mutedLight`. Cambia con un fundido corto al marcar otra opción
 *                (`k`: la respuesta marcada) y no se pinta si no hay ninguna.
 */
import { View, StyleSheet } from 'react-native';
import Reanimated, { FadeInDown } from 'react-native-reanimated';

import { Text } from '../../ui/Text';
import { Rise } from '../../ui/Rise';
import { spacing, textStyles, lh } from '../../../theme';
import { useThemedStyles } from '../../../useTheme';

export function FlowSteps({ n, label, index = 0 }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <Rise index={index}>
      <View style={styles.steps} accessible accessibilityLabel={label}>
        <View style={styles.bar}>
          {[1, 2, 3, 4].map((i) => <View key={i} style={[styles.seg, i <= n && styles.segOn]} />)}
        </View>
        <Text style={styles.count}>{label}</Text>
      </View>
    </Rise>
  );
}

export function FlowImplies({ title, points = [], warns = [], k, index = 6 }) {
  const styles = useThemedStyles(makeStyles);
  if (!points.length && !warns.length) return null;
  return (
    <Rise index={index}>
      <View style={styles.panel}>
        <Text style={styles.title}>{title}</Text>
        <Reanimated.View key={k} entering={FadeInDown.duration(250)} style={styles.list}>
          {points.map((p) => (
            <View key={p} style={styles.row}>
              <View style={styles.dot} />
              <Text style={styles.txt}>{p}</Text>
            </View>
          ))}
          {warns.map((p) => (
            <View key={p} style={styles.row}>
              <View style={[styles.dot, styles.dotWarn]} />
              <Text style={[styles.txt, styles.txtWarn]}>{p}</Text>
            </View>
          ))}
        </Reanimated.View>
      </View>
    </Rise>
  );
}

const makeStyles = (th) => StyleSheet.create({
  steps: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg - 3, marginBottom: spacing.lg },
  bar:   { flex: 1, flexDirection: 'row', gap: spacing.xs2 },
  seg:   { flex: 1, height: 4, borderRadius: 2, backgroundColor: th.colors.surface2 },
  segOn: { backgroundColor: th.colors.accent },
  count: { ...textStyles.caps, color: th.colors.mutedLight, textTransform: 'uppercase' },

  panel: {
    marginTop:       spacing.lg,
    padding:         spacing.lg,
    borderRadius:    th.radius.lg,
    backgroundColor: th.colors.surface,
  },
  title: { ...textStyles.caps, color: th.colors.mutedLight, textTransform: 'uppercase' },
  list:  { marginTop: spacing.md, gap: spacing.sm2 },
  // Punto y texto en fila: el texto es un solo hijo y se parte sin tocar el punto.
  row:     { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  dot:     { width: 6, height: 6, borderRadius: 3, marginTop: spacing.sm2 - 1, backgroundColor: th.colors.accent },
  dotWarn: { backgroundColor: th.colors.orange },
  txt:     { ...textStyles.body, flex: 1, color: th.colors.text, lineHeight: lh(14) },
  txtWarn: { color: th.colors.mutedLight },
});
