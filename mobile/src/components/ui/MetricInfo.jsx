/**
 * MetricInfo — el "¿de dónde sale este número?" de la app.
 *
 * Fase 2 de `mobile/docs/specs/metric-transparency.md`. Dos piezas que se usan
 * siempre juntas, por eso viven en el mismo fichero:
 *
 *   InfoLabel        la etiqueta del dato, tocable, con su icono ⓘ.
 *   MetricInfoSheet  la hoja con una o varias fichas.
 *
 * El estado lo lleva cada pantalla con un `useState` propio (`const [info,
 * setInfo] = useState(null)`). Se probó a envolverlo en un hook, pero un hook
 * conviviendo con componentes en el mismo fichero rompe fast-refresh, y sacarlo
 * a otro fichero costaba más de lo que ahorraba en tres puntos de uso.
 *
 * **Un dato puede necesitar varias fichas.** "Carga 7d" no se explica solo con
 * la carga de sesión: hace falta también la media móvil. Por eso `ids` es una
 * lista y no un id suelto.
 *
 * Qué es tocable y qué no (decisión del usuario, ago 2026): las tres cards de
 * Progreso, las del detalle de ejercicio, las tres de Carga y los gráficos de
 * esa pestaña. La gráfica del detalle de ejercicio NO: ya es interactiva y no
 * es lo bastante compleja como para necesitar explicación. No hacer tocable
 * todo lo que tenga un número — el icono deja de significar algo.
 */
import { Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '../../theme';
import { useTheme, useThemedStyles } from '../../useTheme';
import DragSheet from '../DragSheet';
import MetricDoc from './MetricDoc';
import { InfoIcon } from './EditorIcons';

export function MetricInfoSheet({ ids, onClose }) {
  const styles = useThemedStyles(makeStyles);
  const { t }  = useTranslation();
  return (
    <DragSheet visible={!!ids?.length} onClose={onClose} title={t('docs.metricsTitle')}>
      <ScrollView
        style={styles.sheetScroll}
        contentContainerStyle={styles.sheetBody}
        showsVerticalScrollIndicator={false}
      >
        {(ids ?? []).map((id) => <MetricDoc key={id} id={id} />)}
      </ScrollView>
    </DragSheet>
  );
}

/**
 * Etiqueta de un dato, tocable. El disparador es la ETIQUETA y no la tarjeta
 * entera: en Progreso la tarjeta ya abre el detalle del ejercicio, y en Carga
 * competiría con el propio gráfico.
 */
export function InfoLabel({ children, textStyle, onPress, align = 'center' }) {
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <TouchableOpacity
      style={[styles.labelRow, { justifyContent: align === 'left' ? 'flex-start' : 'center' }]}
      onPress={onPress}
      activeOpacity={0.7}
      hitSlop={10}
    >
      <Text style={textStyle} numberOfLines={1}>{children}</Text>
      <InfoIcon size={11} color={th.colors.muted} />
    </TouchableOpacity>
  );
}

const makeStyles = () => StyleSheet.create({
  labelRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.xs2,
  },
  sheetScroll: { maxHeight: 460 },
  sheetBody:   { gap: spacing.md, paddingBottom: spacing.sm },
});
