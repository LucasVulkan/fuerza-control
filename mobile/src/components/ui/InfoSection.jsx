/**
 * Categoría de la pestaña Info: una tarjeta `surface` con el título a la
 * izquierda y **su resumen a la derecha**.
 *
 * El resumen es lo que justifica el componente. El acordeón anterior eran
 * rótulos a sangre con separadores de 1px: con todo cerrado —que es como se
 * entra— la pantalla no decía nada, cuatro etiquetas y cuatro flechas. Aquí
 * cada cabecera lleva el dato que resume su sección (estado, nombre completo,
 * último peso, pendiente de cobro, conexión), así que Info se lee sin abrir
 * nada y solo se despliega lo que se va a tocar.
 *
 * El plegado es el mismo de las sesiones de la Home, y a propósito:
 * `LinearTransition` en la tarjeta y `collapseOut` en el cuerpo, que encoge
 * además de desvanecerse.
 *
 * Salió de la pestaña Info de la ficha de cliente; la usa también la nota del
 * recap (pulido-ui.md §2).
 */
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import Reanimated, { LinearTransition, FadeIn } from 'react-native-reanimated';
import { Text } from './Text';
import { ChevronDown } from './EditorIcons';
import { collapseOut, FOLD_MS } from './collapseOut';
import { spacing, textStyles, borders } from '../../theme';
import { useTheme, useThemedStyles } from '../../useTheme';

export default function InfoSection({ title, summary, tone, open, onToggle, children }) {
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  const toneColor = tone === 'accent' ? th.colors.accent
    : tone === 'green'  ? th.colors.green
    : tone === 'orange' ? th.colors.orange
    : th.colors.mutedLight;
  return (
    <Reanimated.View layout={LinearTransition.duration(FOLD_MS)} style={styles.infoSec}>
      <TouchableOpacity
        style={styles.infoSecHead}
        onPress={onToggle}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
      >
        <Text style={styles.infoSecTitle}>{title}</Text>
        <Text style={[styles.infoSecSum, { color: toneColor }]} numberOfLines={1}>{summary ?? ''}</Text>
        <View style={open ? styles.infoSecChevOpen : null}>
          <ChevronDown size={12} color={open ? th.colors.accent : th.colors.muted} />
        </View>
      </TouchableOpacity>
      {open && (
        <Reanimated.View entering={FadeIn.duration(180)} exiting={collapseOut} style={styles.infoSecBody}>
          {/* Filete a sangre: separa cabecera y cuerpo sin meter una segunda
              superficie, el mismo recurso que la tarjeta de programa. */}
          <View style={styles.infoSecRule} />
          {children}
        </Reanimated.View>
      )}
    </Reanimated.View>
  );
}

const makeStyles = (th) => StyleSheet.create({
  infoSec: {
    backgroundColor: th.colors.surface,
    borderRadius:    th.radius.lg,
    overflow:        'hidden',
  },
  infoSecHead: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing.md,
    minHeight:         52,
    paddingHorizontal: spacing.lg,
  },
  infoSecTitle: {
    ...textStyles.labelStrong,
    textTransform: 'uppercase',
    color:         th.colors.text,
  },
  // Ocupa el hueco que deja el título aunque esté vacío: si no, el galón se
  // pega al rótulo en las secciones sin resumen y las cabeceras no casan.
  infoSecSum: {
    ...textStyles.body,
    flex:      1,
    textAlign: 'right',
  },
  infoSecChevOpen: { transform: [{ rotate: '180deg' }] },
  infoSecBody: {
    paddingHorizontal: spacing.lg,
    paddingBottom:     spacing.lg,
    gap:               spacing.lg,
    overflow:          'hidden',
  },
  // Filete a sangre: sale del padding de la tarjeta por los dos lados.
  infoSecRule: {
    height:           borders.thin,
    backgroundColor:  th.colors.border,
    marginHorizontal: -spacing.lg,
  },
});
