/**
 * DocsScreen — "Documentación" del menú principal.
 *
 * Explica la terminología de la app (semana, etapa, bloque, dropset…). El texto
 * vive entero en i18n (`docs.sections` en src/locales/{es,en}.json) como una
 * lista de `{ id, title, points: [] }`: añadir, reordenar o repuntear apartados es
 * editar ese array, no esta pantalla.
 *
 * Cada apartado va en viñetas cortas, no en párrafo: la pantalla se consulta
 * para resolver una duda concreta, y un bloque de texto obliga a leerlo entero
 * para encontrar la línea que importa.
 */
import { View, ScrollView, StyleSheet } from 'react-native';
import { Text } from '../components/ui/Text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import { spacing, textStyles } from '../theme';
import { useThemedStyles } from '../useTheme';
import { METRIC_GROUPS } from '../utils/metricDocs';
import MetricDoc from '../components/ui/MetricDoc';
import DocPoints from '../components/ui/DocPoints';

import ScreenHeader from '../components/ui/ScreenHeader';
export default function DocsScreen() {
  const styles     = useThemedStyles(makeStyles);
  const { t }      = useTranslation();
  const navigation = useNavigation();
  const sections   = t('docs.sections', { returnObjects: true });

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.container}>
      {/* Se entra deslizando desde la derecha: se sale con ‹, como el resto
          de pantallas a las que se navega (U36). */}
      <ScreenHeader onBack={() => navigation.goBack()} eyebrow={t('header.sectionAccount')} title={t('docs.title')} />

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Text style={styles.intro}>{t('docs.intro')}</Text>
        {(Array.isArray(sections) ? sections : []).map(({ id, title, points }) => (
          <View key={id} style={styles.section}>
            <Text style={styles.secLabel}>{title}</Text>
            <DocPoints points={points} />
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


  body:  { paddingTop: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.xl },
  intro: {
    ...textStyles.body,
    color:      th.colors.mutedLight,
    lineHeight: 19,
    paddingTop: spacing.md,
  },

  // `sm` entre viñetas y algo más bajo el título, para que cada apartado se lea
  // como un grupo y no como una lista corrida.
  section:  { gap: spacing.sm },
  secLabel: {
    ...textStyles.caps,
    color:         th.colors.accent,
    textTransform: 'uppercase',
    marginBottom:  spacing.xs,
  },

  // Mismo patrón de viñeta que las de "qué pasa al conectar" (ClientCodeModal):
  // punto lima a la izquierda y el texto en su propia columna, para que las
  // líneas que envuelven queden alineadas bajo la primera y no bajo el punto.
  pointRow:  { flexDirection: 'row', gap: spacing.sm },
  pointDot:  {
    ...textStyles.body,
    lineHeight: 20,
    color:      th.colors.accent,
  },
  pointText: {
    flex:       1,
    ...textStyles.body,
    color:      th.colors.text,
    lineHeight: 20,
  },

  // ── Fichas de métrica ──
  metricsIntro: {
    ...textStyles.body,
    color:      th.colors.mutedLight,
    lineHeight: 19,
  },
  groupLabel: {
    ...textStyles.caps,
    color:         th.colors.mutedLight,
    textTransform: 'uppercase',
    marginBottom:  spacing.xs,
  },
});
