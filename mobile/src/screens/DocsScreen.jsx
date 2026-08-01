/**
 * DocsScreen — "Documentación" del menú principal.
 *
 * Explica la terminología de la app (etapa, ciclo, bloque, dropset…). El texto
 * vive entero en i18n (`docs.sections` en src/locales/{es,en}.json) como una
 * lista de `{ title, points: [] }`: añadir, reordenar o repuntear apartados es
 * editar ese array, no esta pantalla.
 *
 * Cada apartado va en viñetas cortas, no en párrafo: la pantalla se consulta
 * para resolver una duda concreta, y un bloque de texto obliga a leerlo entero
 * para encontrar la línea que importa.
 */
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import { spacing, textStyles } from '../theme';
import { useThemedStyles } from '../useTheme';
import { METRIC_GROUPS, METRIC_VARS, APPROX_FORMULA } from '../utils/metricDocs';

/**
 * Ficha de una métrica: qué es, la fórmula real y su límite conocido.
 *
 * El límite no es opcional (ver `docs/specs/metric-transparency.md` §1):
 * enseñar solo la fórmula vende una precisión que la métrica no tiene.
 *
 * Las constantes se interpolan desde el código a través de `METRIC_VARS`, no
 * se teclean en el JSON: si no, la ficha mentiría a la primera calibración.
 */
function MetricDoc({ id }) {
  const styles = useThemedStyles(makeStyles);
  const { t }  = useTranslation();
  const vars   = METRIC_VARS[id] ?? {};
  // `rules` es opcional: hay métricas sin reglas propias de la app.
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

export default function DocsScreen() {
  const styles     = useThemedStyles(makeStyles);
  const { t }      = useTranslation();
  const navigation = useNavigation();

  const sections = t('docs.sections', { returnObjects: true });

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('docs.title')}</Text>
        <TouchableOpacity style={styles.iconBox} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Text style={styles.closeGlyph}>✕</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Text style={styles.intro}>{t('docs.intro')}</Text>
        {(Array.isArray(sections) ? sections : []).map(({ title, points }) => (
          <View key={title} style={styles.section}>
            <Text style={styles.secLabel}>{title}</Text>
            {(points ?? []).map((point) => (
              <View key={point} style={styles.pointRow}>
                <Text style={styles.pointDot}>·</Text>
                <Text style={styles.pointText}>{point}</Text>
              </View>
            ))}
          </View>
        ))}

        {/* Cómo se calcula cada número — una ficha por métrica expuesta */}
        <View style={styles.section}>
          <Text style={styles.secLabel}>{t('docs.metricsTitle')}</Text>
          <Text style={styles.metricsIntro}>{t('docs.metricsIntro')}</Text>
        </View>
        {METRIC_GROUPS.map((group) => (
          <View key={group.id} style={styles.section}>
            <Text style={styles.groupLabel}>{t(`docs.metricGroups.${group.id}`)}</Text>
            {group.ids.map((id) => <MetricDoc key={id} id={id} />)}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (th) => StyleSheet.create({
  container: { flex: 1, backgroundColor: th.colors.bg },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm,
    gap: spacing.md,
  },
  headerTitle: { ...textStyles.hero, color: th.colors.text, flexShrink: 1 },
  iconBox: {
    width: 42, height: 42, borderRadius: th.radius.sm,
    backgroundColor: th.colors.surface2,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  closeGlyph: { fontSize: 17, color: th.colors.text },

  body:  { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.xl },
  intro: {
    ...textStyles.subtitle,
    color:      th.colors.mutedLight,
    lineHeight: 19,
    paddingTop: spacing.md,
  },

  // `sm` entre viñetas y algo más bajo el título, para que cada apartado se lea
  // como un grupo y no como una lista corrida.
  section:  { gap: spacing.sm },
  secLabel: {
    ...textStyles.spacingTag,
    color:         th.colors.accent,
    textTransform: 'uppercase',
    marginBottom:  spacing.xs,
  },

  // Mismo patrón de viñeta que las de "qué pasa al conectar" (ClientCodeModal):
  // punto lima a la izquierda y el texto en su propia columna, para que las
  // líneas que envuelven queden alineadas bajo la primera y no bajo el punto.
  pointRow:  { flexDirection: 'row', gap: spacing.sm },
  pointDot:  {
    fontFamily: 'Inter_500Medium',
    fontSize:   13,
    lineHeight: 20,
    color:      th.colors.accent,
  },
  pointText: {
    flex:       1,
    fontFamily: 'Inter_500Medium',
    fontSize:   13,
    color:      th.colors.text,
    lineHeight: 20,
  },

  // ── Fichas de métrica ──
  metricsIntro: {
    ...textStyles.subtitle,
    color:      th.colors.mutedLight,
    lineHeight: 19,
  },
  groupLabel: {
    ...textStyles.spacingTag,
    color:         th.colors.mutedLight,
    textTransform: 'uppercase',
    marginBottom:  spacing.xs,
  },
  // Jerarquía de la ficha, de más a menos peso visual:
  //   nombre (16 Black) → qué mide (13, color de texto) → bloques etiquetados
  //   (10, mutedLight) con su etiqueta en 8 px muy trackeada.
  // Sin las etiquetas, "reglas" y "límites" se leían como un párrafo continuo.
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
