/**
 * SwipeRow — fila que se desliza a la derecha y descubre 1 o 2 botones de acción
 * (editor-vinculacion.md §2.1). Es lo que `EditorRow` (editor de sesión) llevaba
 * dentro y ahora comparten las tarjetas de sesión del editor de programa.
 *
 * El contenido no es cosa suya: pone el gesto, el panel de acciones detrás, el
 * muelle de vuelta, el cierre cuando `isOpen` pasa a false, el `leading` (número
 * o letra) que se cambia por la flecha ‹ estando abierta y el `handle` a la
 * derecha. El reordenado vive SOLO en el asa (`Sortable.Handle`, que trae el
 * llamante con su estilo): por eso no choca con el gesto horizontal ni con el
 * ScrollView.
 *
 * Animated de RN core a propósito: es una extracción de lo que ya funcionaba.
 */
import { useState, useRef, useEffect } from 'react';
import { View, TouchableOpacity, StyleSheet, Animated, PanResponder } from 'react-native';
import { Text } from './Text';
import { spacing, textStyles } from '../../theme';
import { useTheme, useThemedStyles } from '../../useTheme';
import { ArrowIcon } from './EditorIcons';

// Ancho de cada botón de acción, su separación y el aire que queda entre el
// último y la tarjeta ya deslizada. La tarjeta se esconde exactamente esa distancia.
const ACTION_BTN_WIDTH = 104;
const ACTION_GAP       = spacing.sm;
const ACTION_INSET     = spacing.md;

const openWidth = (n) => ACTION_BTN_WIDTH * n + ACTION_GAP * (n - 1) + ACTION_INSET;

export default function SwipeRow({
  actions, isOpen, onOpenChange, leading, onPress, handle, style, radii, children,
}) {
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);

  const swipeOpen = openWidth(actions.length);

  // Inicializador perezoso en vez de useRef: el valor es igual de estable y
  // no se lee ningún `.current` durante el render.
  const [dragX] = useState(() => new Animated.Value(0));
  const openRef = useRef(false);

  // Lo que el PanResponder (creado una sola vez) necesita ver al día.
  const live = useRef({ onOpenChange, onPress, swipeOpen });
  useEffect(() => { live.current = { onOpenChange, onPress, swipeOpen }; });

  // Otra fila se abrió (o una acción cerró ésta) — ciérrala.
  useEffect(() => {
    if (!isOpen && openRef.current) {
      openRef.current = false;
      Animated.spring(dragX, { toValue: 0, useNativeDriver: false, tension: 80 }).start();
    }
  }, [isOpen, dragX]);

  /* eslint-disable-next-line react-hooks/refs */
  const [pan] = useState(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gs) => !openRef.current && gs.dx > 8 && gs.dx > Math.abs(gs.dy) * 1.3,
    onPanResponderMove: (_, gs) => {
      if (gs.dx > 0) dragX.setValue(Math.min(gs.dx, live.current.swipeOpen));
    },
    onPanResponderRelease: (_, gs) => {
      const w = live.current.swipeOpen;
      const opening = gs.dx >= w / 2;
      openRef.current = opening;
      Animated.spring(dragX, { toValue: opening ? w : 0, useNativeDriver: false, tension: 80 }).start();
      live.current.onOpenChange(opening);
    },
    onPanResponderTerminate: () => {
      if (!openRef.current) Animated.spring(dragX, { toValue: 0, useNativeDriver: false }).start();
    },
  }));

  function closeRow() {
    openRef.current = false;
    Animated.spring(dragX, { toValue: 0, useNativeDriver: false, tension: 80 }).start();
    live.current.onOpenChange(false);
  }

  return (
    <View style={{ position: 'relative' }}>
      <View style={[styles.actionPanel, { width: swipeOpen }]} pointerEvents="box-none">
        {actions.map((a) => (
          <TouchableOpacity
            key={a.label}
            style={[styles.actionBtn, a.kind === 'danger' ? styles.actionBtnDanger : styles.actionBtnNeutral]}
            onPress={() => { closeRow(); a.onPress(); }}
            activeOpacity={0.75}
          >
            <Text style={a.kind === 'danger' ? styles.actionTextDanger : styles.actionTextNeutral}>{a.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Animated.View
        style={[styles.row, style, radii, { transform: [{ translateX: dragX }] }]}
        {...pan.panHandlers}
      >
        {isOpen ? (
          // Abierta, el número se cambia por una flecha hacia atrás: es la pista
          // de que la tarjeta se devuelve a su sitio tocándola.
          <View style={styles.leadingSlot}>
            <ArrowIcon size={16} color={th.colors.mutedLight} back />
          </View>
        ) : (
          <View style={styles.leadingSlot}>{leading}</View>
        )}
        <TouchableOpacity
          style={styles.body}
          onPress={() => { if (openRef.current) closeRow(); else live.current.onPress(); }}
          activeOpacity={0.7}
        >
          {children}
        </TouchableOpacity>
        {handle}
      </Animated.View>
    </View>
  );
}

const makeStyles = (th) => StyleSheet.create({
  row: {
    flexDirection:     'row',
    alignItems:        'center',
    backgroundColor:   th.colors.surface,
    borderRadius:      th.radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.sm2,
  },
  // 12 es literal de Figma (no hay token).
  leadingSlot: { marginRight: 12, alignItems: 'center', justifyContent: 'center' },
  body:        { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },

  // Panel de acciones bajo la fila, descubierto al deslizar. Son botones con el
  // lenguaje de la app (radius/sm + text/card-type), no bloques de color a sangre.
  actionPanel: {
    position: 'absolute', left: 0, top: 0, bottom: 0,
    flexDirection: 'row',
    gap: ACTION_GAP,
    // Aire por dentro: los botones no llegan al alto de la fila ni se pegan a
    // la tarjeta cuando ésta termina de deslizarse.
    paddingVertical: spacing.sm,
    paddingRight:    ACTION_INSET,
  },
  actionBtn: {
    width: ACTION_BTN_WIDTH,
    alignItems: 'center', justifyContent: 'center',
    borderRadius: th.radius.sm,
    paddingHorizontal: spacing.lg,
  },
  // `surface2`: el mismo relleno que los botones Secondary de Figma.
  actionBtnNeutral:  { backgroundColor: th.colors.surface2 },
  actionTextNeutral: { ...textStyles.labelStrong, color: th.colors.text, textAlign: 'center' },
  actionBtnDanger:   { backgroundColor: th.tint.red30 },
  actionTextDanger:  { ...textStyles.labelStrong, color: th.tint.red50, textAlign: 'center' },
});
