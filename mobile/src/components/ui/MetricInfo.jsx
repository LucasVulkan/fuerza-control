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
 * **Un gráfico no es una métrica.** Al abrir "Esfuerzo vs carga" lo primero que
 * hace falta no es qué mide cada línea, sino qué representa el gráfico y cómo
 * se interpreta; las fichas de sus componentes van después. Por eso la hoja
 * recibe además un `chart`, y esa explicación vive en `chartDocs.*` y no en
 * `metrics.*`: son dos cosas distintas y mezclarlas obligaba a leer tres fichas
 * para deducir algo que se dice en dos frases.
 *
 * Qué es tocable y qué no (decisión del usuario, ago 2026): las tres cards de
 * Progreso, las del detalle de ejercicio, las tres de Carga y los gráficos de
 * esa pestaña. La gráfica del detalle de ejercicio NO: ya es interactiva y no
 * es lo bastante compleja como para necesitar explicación. No hacer tocable
 * todo lo que tenga un número — el icono deja de significar algo.
 *
 * **`InfoLabel` es solo para títulos de gráfico.** Las tarjetas pequeñas son
 * pulsables ENTERAS y no llevan icono: en una caja de 108 px con un número
 * grande y dos etiquetas, un aro de 11 px era ruido, y una tarjeta pequeña no
 * tiene ninguna otra acción con la que competir por el toque.
 */
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing, textStyles } from '../../theme';
import { useTheme, useThemedStyles } from '../../useTheme';
import DragSheet from '../DragSheet';
import MetricDoc from './MetricDoc';
import { InfoIcon } from './EditorIcons';

export function MetricInfoSheet({ chart, ids, onClose }) {
  const styles = useThemedStyles(makeStyles);
  const { t }  = useTranslation();
  const open   = !!chart || !!ids?.length;
  return (
    <DragSheet
      visible={open}
      onClose={onClose}
      title={chart ? t(`chartDocs.${chart}.name`) : t('docs.metricsTitle')}
    >
      <ScrollView
        style={styles.sheetScroll}
        contentContainerStyle={styles.sheetBody}
        showsVerticalScrollIndicator={false}
      >
        {chart ? (
          <View style={styles.chartDoc}>
            <Text style={styles.chartWhat}>{t(`chartDocs.${chart}.what`)}</Text>
            <Text style={styles.chartLabel}>{t('docs.chartRead')}</Text>
            <Text style={styles.chartRead}>{t(`chartDocs.${chart}.read`)}</Text>
          </View>
        ) : null}

        {chart && ids?.length ? (
          <Text style={styles.partsLabel}>{t('docs.chartParts')}</Text>
        ) : null}

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

const makeStyles = (th) => StyleSheet.create({
  // El bloque del gráfico va con relleno accent, como las tarjetas "Resumen" de
  // los editores: es la cabecera de la hoja, no una ficha más de la lista.
  chartDoc: {
    backgroundColor: th.tint.accent10,
    borderRadius:    th.radius.md,
    padding:         spacing.lg,
    gap:             spacing.sm,
  },
  chartWhat: {
    fontFamily: 'Inter_500Medium',
    fontSize:   13,
    color:      th.colors.text,
    lineHeight: 19,
  },
  chartLabel: {
    ...textStyles.smallBold,
    color:         th.colors.accent,
    textTransform: 'uppercase',
    marginTop:     spacing.xs2,
  },
  chartRead: { ...textStyles.tag, color: th.colors.text, lineHeight: 16 },
  partsLabel: {
    ...textStyles.spacingTag,
    color:         th.colors.mutedLight,
    textTransform: 'uppercase',
    marginTop:     spacing.xs2,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.xs2,
  },
  sheetScroll: { maxHeight: 460 },
  sheetBody:   { gap: spacing.md, paddingBottom: spacing.sm },
});
