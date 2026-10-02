/**
 * ProgressPanel — conmutador EJERCICIOS / CARGA / HISTORIAL.
 *
 * Existe para que las dos pantallas que enseñan progreso (StatsScreen del
 * propio usuario y el detalle de cliente de ClientsScreen) compartan el mismo
 * conmutador en vez de duplicarlo y acabar divergiendo. El panel de carga sale
 * gratis en el lado entrenador, que es donde monotonía y strain son más
 * accionables.
 *
 * El tercer segmento es **opcional y por prop** (`history`), no siempre. Esta
 * pieza la comparten la pantalla de Progresión del propio usuario y la ficha de
 * cliente, y la ficha **ya tiene su propio tab de Historial**: si el segmento
 * saliera siempre, el entrenador vería el historial del cliente dos veces, en
 * dos sitios y con filtros distintos.
 *
 * El conmutador se monta AQUÍ, una sola vez, fuera de las pestañas. Viajó un
 * tiempo dentro del scroll de cada una (prop `header`) para no robar alto, pero
 * eso lo remontaba en cada cambio: el resalte no sabía de dónde venía, aparecía
 * tarde y arrancaba su animación en el mismo commit que montaba la pestaña —
 * saltos, parpadeos y el rebote de ida y vuelta. Un control que conmuta pantallas
 * no puede vivir dentro de lo que conmuta. Fuera, no se entera de nada de eso.
 *
 * Las pestañas se DESLIZAN de lado con el resalte (U28), como un pager: van en
 * una fila de N × ancho que se traslada con la misma curva que el resalte
 * (`SegmentedControl.TIMING`). Solo al tocar el segmentado, sin gesto de dedo.
 * Para eso la que sale y la que entra tienen que estar montadas a la vez, así
 * que una pestaña se monta la primera vez que se visita y ya no se desmonta
 * (conserva su scroll y sus filtros).
 */
import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming,
} from 'react-native-reanimated';

import SegmentedControl from '../ui/SegmentedControl';
import ProgressTab from './ProgressTab';
import LoadTab     from './LoadTab';
import { spacing } from '../../theme';

export default function ProgressPanel({
  baseLog, programTemplateIds, allExercises, fallbackBodyWeight,
  onRefresh, refreshing = false, history = null,
}) {
  const { t }  = useTranslation();
  const [view, setView] = useState('exercises');
  const [visited, setVisited] = useState({ exercises: true });

  const options = [
    { id: 'exercises', label: t('load.tabExercises') },
    { id: 'load',      label: t('load.tabLoad') },
    ...(history ? [{ id: 'history', label: t('load.tabHistory') }] : []),
  ];
  const count = options.length;

  // Posición en páginas, no en píxeles: la fila mide N × 100 % y un translate
  // en % es sobre su propio ancho, así que no hay nada que medir.
  const page = useSharedValue(0);
  const rowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: `${(-page.value * 100) / count}%` }],
  }));

  const select = (id) => {
    setView(id);
    setVisited((v) => (v[id] ? v : { ...v, [id]: true }));
    page.value = withTiming(options.findIndex((o) => o.id === id), SegmentedControl.TIMING);
  };

  const pages = {
    exercises: (
      <ProgressTab
        baseLog={baseLog}
        programTemplateIds={programTemplateIds}
        allExercises={allExercises}
        onRefresh={onRefresh}
        refreshing={refreshing}
      />
    ),
    load: (
      <LoadTab
        baseLog={baseLog}
        allExercises={allExercises}
        fallbackBodyWeight={fallbackBodyWeight}
        onRefresh={onRefresh}
        refreshing={refreshing}
      />
    ),
    // Historial tampoco se desmonta: sus tarjetas salen con `SlideOutRight` al
    // borrarlas (SessionCard), y al desmontar la lista entera se iba TODO el
    // historial por la derecha.
    history,
  };

  return (
    <View style={styles.fill}>
      {/* El aire lateral y el de arriba los ponía el contentContainer de cada
          pestaña cuando el conmutador iba dentro; ahora los pone su envoltorio. */}
      <View style={styles.switcher}>
        <SegmentedControl options={options} value={view} onChange={select} />
      </View>

      <View style={styles.viewport}>
        <Animated.View style={[styles.row, { width: `${count * 100}%` }, rowStyle]}>
          {options.map(({ id }) => {
            const active = id === view;
            return (
              // Las de fuera de pantalla no se leen con el lector de pantalla.
              <View
                key={id}
                style={styles.fill}
                accessibilityElementsHidden={!active}
                importantForAccessibility={active ? 'auto' : 'no-hide-descendants'}
              >
                {visited[id] && pages[id]}
              </View>
            );
          })}
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill:     { flex: 1 },
  viewport: { flex: 1, overflow: 'hidden' },
  row:      { flex: 1, flexDirection: 'row' },
  switcher: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
});
