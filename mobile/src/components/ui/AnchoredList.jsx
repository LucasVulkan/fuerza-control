/**
 * AnchoredList — la lista de hermanos anclada bajo lo que la abre (P16-04, D9):
 * es el formato de lista de la app para saltar de un ejercicio a otro, de un
 * bloque a otro… Sale del desplegable del título de `ScreenHeader`.
 *
 * Caja `surface2` del ancho de la columna de contenido, filas de número en Barlow
 * (`statGlyph`) + nombre; la actual, sobre `surface` y en `accent`. Un velo
 * transparente detrás la cierra al tocar fuera.
 *
 * Va como hijo del contenedor de la pantalla (posición absoluta, por encima de la
 * cabecera): `hooks/useAnchoredList` mide dónde colgarla.
 *
X
 *   <View ref={list.rootRef} collapsable={false} style={{ flex: 1 }}>
 *     … <ListButton ref={btnRef} onPress={() => list.open(btnRef, bajoLaTarjeta)} />
 *     <AnchoredList top={list.top} items={[{ id, num, label }]} currentId={…}
 *                   onSelect={…} onClose={list.close} />
 *   </View>
 *
 * Props de `AnchoredList`: `top` (null = cerrada; px desde el contenedor), `items`
 * (`num` opcional: el número que se pinta delante), `currentId`, `onSelect(id)`,
 * `onClose`. `ListButton` es el botón «n/N» de la esquina de la tarjeta.
 */
import { View, Pressable, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import { Text } from './Text';
import { ListIcon } from './EditorIcons';
import { spacing, textStyles } from '../../theme';
import { useTheme, useThemedStyles } from '../../useTheme';

export function ListButton({ ref, n, total, onPress, label }) {
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <Pressable ref={ref} style={styles.btn} onPress={onPress} hitSlop={8} accessibilityRole="button" accessibilityLabel={label} collapsable={false}>
      <ListIcon size={15} color={th.colors.accent} />
      <Text style={styles.btnText}>{`${n}/${total}`}</Text>
    </Pressable>
  );
}

export default function AnchoredList({ top, items, currentId, onSelect, onClose }) {
  const styles = useThemedStyles(makeStyles);
  const { height } = useWindowDimensions();
  if (top == null) return null;
  return (
    <View style={styles.layer} pointerEvents="box-none">
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={[styles.box, { top }]}>
        {/* Una sesión larga no cabe: la lista se desplaza dentro de la caja. */}
        <ScrollView style={{ maxHeight: Math.max(160, height - top - 80) }} showsVerticalScrollIndicator={false}>
          {items.map((item) => {
            const current = item.id === currentId;
            return (
              <Pressable
                key={item.id}
                style={[styles.row, current && styles.rowOn]}
                onPress={() => onSelect(item.id)}
                accessibilityRole="button"
              >
                {item.num != null && <Text style={[styles.num, current && styles.on]}>{item.num}</Text>}
                <Text style={[styles.name, current && styles.on]} numberOfLines={1}>{item.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}

const makeStyles = (th) => StyleSheet.create({
  layer: { ...StyleSheet.absoluteFillObject, zIndex: 200 },
  box: {
    position:        'absolute',
    left:            spacing.lg,
    right:           spacing.lg,
    backgroundColor: th.colors.surface2,
    borderRadius:    th.radius.md,
    padding:         spacing.xs2,
    shadowColor:     '#000',
    shadowOffset:    { width: 0, height: 12 },
    shadowOpacity:   0.6,
    shadowRadius:    15,
    elevation:       12,
  },
  // 10/12 y radio 8 de la maqueta (`editor-ejercicio.html`): ni uno ni otro están en la escala.
  row:   { flexDirection: 'row', alignItems: 'baseline', gap: spacing.md, paddingVertical: spacing.md, paddingHorizontal: 12, borderRadius: 8 },
  rowOn: { backgroundColor: th.colors.surface },
  num:   { ...textStyles.statGlyph, color: th.colors.muted, minWidth: 24 },
  name:  { ...textStyles.bodyStrong, color: th.colors.text, flexShrink: 1 },
  on:    { color: th.colors.accent },

  // Caja de 30 de alto, `surface`, radio 10: el hueco `corner` de `EditorIdentityCard`.
  btn: {
    height:            30,
    paddingHorizontal: 9,
    borderRadius:      th.radius.md,
    backgroundColor:   th.colors.surface,
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing.sm,
  },
  btnText: { ...textStyles.labelStrong, color: th.colors.mutedLight },
});
