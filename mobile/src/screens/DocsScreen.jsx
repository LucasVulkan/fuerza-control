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
});
