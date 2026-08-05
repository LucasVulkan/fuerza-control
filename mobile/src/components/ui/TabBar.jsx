/**
 * TabBar — pestañas "clásicas": la activa toma el fondo de la página y se funde
 * con el contenido que hay debajo, con la etiqueta en accent; las demás se
 * quedan en la banda.
 *
 * No es `SegmentedControl` con otra piel, y por eso no es una variante suya:
 * aquel es un control de filtro (una píldora que flota SOBRE su fondo) y este es
 * navegación (un recorte de la banda HACIA el contenido). Que no se parezcan es
 * justo el punto — dentro de una misma pantalla conviven los dos.
 *
 * Va sin padding propio: lo coloca quien lo usa. Para que la fusión funcione, el
 * contenedor no puede meter `paddingBottom` (la pestaña activa tiene que llegar
 * al borde del contenido) y el contenido de debajo tiene que ir sobre
 * `colors.bg`.
 */
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { textStyles, spacing } from '../../theme';
import { useThemedStyles } from '../../useTheme';

export default function TabBar({ options, value, onChange }) {
  const styles = useThemedStyles(makeStyles);

  return (
    <View style={styles.row}>
      {options.map(({ id, label }) => {
        const active = value === id;
        return (
          <TouchableOpacity
            key={id}
            style={[styles.tab, active && styles.tabActive]}
            onPress={() => onChange(id)}
            activeOpacity={0.75}
            // La caja mide ~35 px de alto: el hitSlop la lleva a zona de pulgar
            // sin engordar la banda.
            hitSlop={{ top: 6, bottom: 6 }}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.label, active && styles.labelActive]} numberOfLines={1}>
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const makeStyles = (th) => StyleSheet.create({
  // Cada pestaña ocupa lo que mide su etiqueta y el sobrante se reparte entre
  // ellas. Con anchos iguales, una etiqueta corta ("Info") quedaba nadando en
  // una caja del mismo tamaño que "Historial" — y al ser la última, ese hueco
  // se leía como separación del resto.
  row: { flexDirection: 'row', justifyContent: 'space-between' },

  tab: {
    paddingVertical:   spacing.md,
    paddingHorizontal: spacing.md,
    alignItems:        'center',
  },
  // Sin sombra ni borde: el escalón de fondo contra la banda ya dibuja la
  // pestaña, y un borde volvería a meter la línea que se quitó de la banda.
  tabActive: {
    backgroundColor:      th.colors.bg,
    borderTopLeftRadius:  th.radius.md,
    borderTopRightRadius: th.radius.md,
  },

  label:       { ...textStyles.cardType, color: th.colors.mutedLight },
  // El acento va en el TEXTO, no en el fondo: el fondo es lo que funde la
  // pestaña con su contenido, y pintarlo de accent deshace esa unión.
  labelActive: { color: th.colors.accent },
});
