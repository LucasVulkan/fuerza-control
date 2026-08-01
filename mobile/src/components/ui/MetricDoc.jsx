/**
 * MetricDoc — ficha de una métrica: qué mide, cómo se calcula, reglas y límites.
 *
 * Spec: `mobile/docs/specs/metric-transparency.md`.
 *
 * Vive aquí y no dentro de `DocsScreen` porque lo pintan DOS superficies —el
 * glosario y el `MetricInfoSheet` que sale al tocar un dato— y la spec exige un
 * único render: dos copias divergen al primer cambio de fórmula.
 *
 * El campo de límites no es opcional: enseñar solo la fórmula vende una
 * precisión que la métrica no tiene. `rules` sí lo es — hay métricas sin reglas
 * propias de la aplicación.
 */
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing, textStyles } from '../../theme';
import { useThemedStyles } from '../../useTheme';
import { METRIC_VARS, APPROX_FORMULA } from '../../utils/metricDocs';

export default function MetricDoc({ id }) {
  const styles = useThemedStyles(makeStyles);
  const { t }  = useTranslation();
  const vars   = METRIC_VARS[id] ?? {};
  const rules  = t(`metrics.${id}.rules`, { ...vars, defaultValue: '' });

  return (
    <View style={styles.metric}>
      <Text style={styles.metricName}>{t(`metrics.${id}.name`)}</Text>
      <Text style={styles.metricWhat}>{t(`metrics.${id}.what`, vars)}</Text>

      <Text style={styles.metricLabel}>
        {t(APPROX_FORMULA.has(id) ? 'docs.metricFormulaApprox' : 'docs.metricFormula')}
      </Text>
      <View style={styles.metricFormulaBox}>
        <Text style={styles.metricFormulaText}>{t(`metrics.${id}.formula`, vars)}</Text>
      </View>

      {rules ? (
        <>
          <Text style={styles.metricLabel}>{t('docs.metricRules')}</Text>
          <Text style={styles.metricBody}>{rules}</Text>
        </>
      ) : null}

      <Text style={styles.metricLabel}>{t('docs.metricCaveat')}</Text>
      <Text style={styles.metricBody}>{t(`metrics.${id}.caveat`, vars)}</Text>
    </View>
  );
}

// Jerarquía de la ficha, de más a menos peso visual: nombre (16 Black) → qué
// mide (13, color de texto) → bloques etiquetados (10, mutedLight) con su
// etiqueta en 8 px muy trackeada. Sin las etiquetas, cálculo, reglas y límites
// se leían como un párrafo corrido.
const makeStyles = (th) => StyleSheet.create({
  metric: {
    backgroundColor: th.colors.surface,
    borderRadius:    th.radius.md,
    padding:         spacing.lg,
    gap:             spacing.sm,
  },
  metricName: { ...textStyles.exercice, color: th.colors.text },
  metricWhat: {
    fontFamily: 'Inter_500Medium',
    fontSize:   13,
    color:      th.colors.text,
    lineHeight: 19,
  },
  metricLabel: {
    ...textStyles.smallBold,
    color:         th.colors.mutedLight,
    textTransform: 'uppercase',
    marginTop:     spacing.xs2,
  },
  // La fórmula va en caja propia: es la parte que se consulta, no se lee.
  metricFormulaBox: {
    backgroundColor:   th.colors.surface2,
    borderRadius:      th.radius.xs,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.sm,
  },
  metricFormulaText: {
    ...textStyles.tag,
    color:       th.colors.accent,
    lineHeight:  16,
    fontVariant: ['tabular-nums'],
  },
  metricBody: {
    ...textStyles.tag,
    color:      th.colors.mutedLight,
    lineHeight: 16,
  },
});
