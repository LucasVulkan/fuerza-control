/**
 * SegmentedControl — control de selección tipo "pill group", 1 línea.
 *
 * Variante "Group together" de Figma (FormaFit). No implementa la variante
 * de 2 líneas ("Etapas") — no hace falta para los usos actuales.
 *
 * El resalte NO se mide: es un hijo `flex: 1` de una capa que repite la misma
 * fila que las opciones, así que su ancho lo calcula Yoga y su posición es
 * `índice × (100% + gap)`. Antes se medía el contenedor con `onLayout`, y hasta
 * que la medida no volvía —un render entero después, y en la cola detrás de todo
 * lo que estuviera montando la pantalla— no había resalte: las opciones salían
 * en negro y el accent llegaba tarde.
 *
 * Da por hecho que NO se desmonta al cambiar de opción. Un control que se monta
 * ya con otra opción puesta no tiene de dónde deslizar, así que se coloca de
 * golpe: quien lo use para conmutar pantallas tiene que montarlo fuera de lo que
 * conmuta (lo hace `stats/ProgressPanel.jsx`).
 */
import { useRef, useLayoutEffect } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Text } from './Text';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, cancelAnimation, Easing,
} from 'react-native-reanimated';
import { textStyles, spacing } from '../../theme';
import { useThemedStyles, useTheme } from '../../useTheme';

// Contenedor: space/xs2=4 (padding), space/sm=6 (gap) — ambos confirmados en
// mobile/docs/figma-extraction/components/segmented-control.md.
const PAD = spacing.xs2;
const GAP = spacing.sm;

const TIMING = { duration: 200, easing: Easing.inOut(Easing.ease) };
// Aparecer y desaparecer (sin selección ↔ con selección): crece desde el centro
// de la opción, o se encoge hacia él. Nunca viaja desde donde se apagó.
const GROW   = { duration: 220, easing: Easing.out(Easing.cubic) };
const SHRINK = { duration: 160, easing: Easing.in(Easing.cubic) };

// Una opción puede llevar `disabled`: sigue a la vista, apagada, y no se elige.
export default function SegmentedControl({ options, value, onChange }) {
  const styles = useThemedStyles(makeStyles);
  const th     = useTheme();

  // −1 = NADA seleccionado, y es un estado legítimo: la hoja del planificador
  // abre sin preset. Antes se clampaba a 0 y el resalte se plantaba sobre la
  // primera opción, que dice justo lo contrario de lo que se quería decir.
  const activeIndex  = options.findIndex((o) => o.id === value);
  const hasSelection = activeIndex >= 0;

  // Posición en segmentos, no en píxeles. Nace ya en su sitio: el primer frame
  // pintado lleva el resalte puesto.
  const idx     = useSharedValue(hasSelection ? activeIndex : 0);
  const opacity = useSharedValue(hasSelection ? 1 : 0);
  const scale   = useSharedValue(hasSelection ? 1 : 0);
  const mounted = useRef(false);
  const hadSelection = useRef(hasSelection);

  // `useLayoutEffect`, no `useEffect`: colocar el resalte después de pintar deja
  // un frame sin él.
  //
  // Tres transiciones, y cada una con su gesto:
  //   · con selección → otra opción: el resalte DESLIZA (lo de siempre);
  //   · sin selección → una opción: APARECE en su sitio creciendo a lo ancho
  //     desde el centro, con el alto entero. Antes se quedaba apagado donde estaba y, al volver, viajaba
  //     desde allí: quitar la primera y elegir la última lo cruzaba entero;
  //   · con selección → ninguna: se ESTRECHA hacia su centro y se queda ahí.
  useLayoutEffect(() => {
    const had = hadSelection.current;
    hadSelection.current = hasSelection;

    if (!mounted.current) {
      // Primera colocación: de golpe, ya en su sitio.
      mounted.current = true;
      if (hasSelection) idx.value = activeIndex;
      return;
    }
    if (!hasSelection) {
      scale.value   = withTiming(0, SHRINK);
      opacity.value = withTiming(0, SHRINK);
      return;
    }
    if (!had) {
      // Si todavía se estaba encogiendo en otro sitio, se corta: aparece aquí.
      cancelAnimation(idx);
      idx.value     = activeIndex;
      scale.value   = 0;
      scale.value   = withTiming(1, GROW);
      opacity.value = withTiming(1, GROW);
      return;
    }
    idx.value = withTiming(activeIndex, TIMING);
  }, [activeIndex, hasSelection, idx, opacity, scale]);

  const highlightStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    // Primero se sitúa y luego se escala: la escala es sobre su propio centro,
    // así que crece desde el centro de la opción. Solo a lo ancho: el alto va
    // entero desde el primer frame (QA P44).
    transform: [
      { translateX: `${idx.value * 100}%` },
      { translateX: idx.value * GAP },
      { scaleX: scale.value },
    ],
  }));

  return (
    <View style={styles.container}>
      {/* Capa del resalte: la misma fila que las opciones (flex + gap), con el
          pill como primer hijo y el resto como huecos vacíos. */}
      <View style={styles.highlightLayer} pointerEvents="none">
        <Animated.View
          style={[styles.highlight, { backgroundColor: th.colors.accent }, highlightStyle]}
        />
        {options.slice(1).map(({ id }) => <View key={id} style={styles.slot} />)}
      </View>
      {options.map(({ id, label, disabled }) => {
        const active = value === id;
        return (
          <TouchableOpacity
            key={id}
            style={styles.option}
            onPress={disabled ? undefined : () => onChange(id)}
            disabled={disabled}
            activeOpacity={0.75}
          >
            {/* Un label largo (p. ej. "Pendiente · 12" en Facturación) partiría
                el pill en dos líneas y desalinearía el highlight animado. */}
            <Text style={[styles.optionText, active && styles.optionTextActive, disabled && styles.optionTextOff]} numberOfLines={1}>
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// Colgado del componente (un export suelto rompe el fast refresh): quien anime
// algo al compás del resalte —el pager de `stats/ProgressPanel.jsx`— usa esta
// misma curva y va clavado con él.
SegmentedControl.TIMING = TIMING;

const makeStyles = (th) => StyleSheet.create({
  container: {
    flexDirection:   'row',
    backgroundColor: th.colors.surface2,
    borderRadius:    th.radius.full,
    padding:         PAD,
    gap:             GAP,
  },
  highlightLayer: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    padding:       PAD,
    gap:           GAP,
  },
  highlight: { flex: 1, borderRadius: th.radius.full },
  slot:      { flex: 1 },
  option: {
    flex:            1,
    borderRadius:    th.radius.sm,
    paddingVertical: spacing.sm2, // space/sm2=8 (Group together, botón seleccionado)
    alignItems:      'center',
  },
  // Un escalón por encima de la etiqueta: es texto que se pulsa y a 12 se leía
  // como metadato.
  optionText: {
    ...textStyles.bodyStrong,
    color: th.colors.text,
  },
  optionTextActive: {
    color: th.colors.onAccent,
  },
  // `disabled` en una opción: se ve pero no se elige (la hoja de Progresión).
  optionTextOff: {
    color: th.colors.muted,
  },
});
