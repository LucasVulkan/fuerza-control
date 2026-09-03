/**
 * Un apartado de Documentación, en viñetas — y su hoja.
 *
 * El texto vive entero en i18n (`docs.sections`, una lista de
 * `{ id, title, points }`). Aquí sólo está la forma, para que la pantalla de
 * Documentación y la hoja que se abre desde un concepto suelto pinten lo mismo
 * y no diverjan al primer retoque (mismo motivo que `MenuList` o `EditorRows`).
 *
 * `DocSheet` es lo que se abre al pulsar "CICLO" en el banner de Home: el
 * apartado que resuelve la duda, no el glosario entero.
 */
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '../../theme';
import { useThemedStyles } from '../../useTheme';
import DragSheet from '../DragSheet';

/** Busca un apartado por su `id`. Devuelve `null` si no existe. */
function docSection(t, id) {
  const sections = t('docs.sections', { returnObjects: true });
  if (!Array.isArray(sections)) return null;
  return sections.find((s) => s.id === id) ?? null;
}

/**
 * Las viñetas. Mismo patrón que las de "qué pasa al conectar"
 * (`ClientCodeModal`): punto lima a la izquierda y el texto en su propia
 * columna, para que las líneas que envuelven queden alineadas bajo la primera
 * y no bajo el punto.
 */
export default function DocPoints({ points }) {
  const styles = useThemedStyles(makeStyles);
  return (points ?? []).map((point) => (
    <View key={point} style={styles.pointRow}>
      <Text style={styles.pointDot}>·</Text>
      <Text style={styles.pointText}>{point}</Text>
    </View>
  ));
}

export function DocSheet({ visible, sectionId, onClose }) {
  const styles  = useThemedStyles(makeStyles);
  const { t }   = useTranslation();
  const section = docSection(t, sectionId);
  return (
    <DragSheet visible={visible && !!section} onClose={onClose} title={section?.title}>
      <View style={styles.sheetBody}>
        <DocPoints points={section?.points} />
      </View>
    </DragSheet>
  );
}

const makeStyles = (th) => StyleSheet.create({
  sheetBody: { gap: spacing.sm, paddingBottom: spacing.lg },

  pointRow: { flexDirection: 'row', gap: spacing.sm },
  pointDot: {
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
