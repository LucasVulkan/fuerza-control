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
 */
import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

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

  const options = [
    { id: 'exercises', label: t('load.tabExercises') },
    { id: 'load',      label: t('load.tabLoad') },
    ...(history ? [{ id: 'history', label: t('load.tabHistory') }] : []),
  ];

  return (
    <View style={styles.fill}>
      {/* El aire lateral y el de arriba los ponía el contentContainer de cada
          pestaña cuando el conmutador iba dentro; ahora los pone su envoltorio. */}
      <View style={styles.switcher}>
        <SegmentedControl options={options} value={view} onChange={setView} />
      </View>

      {view === 'exercises' ? (
        <ProgressTab
          baseLog={baseLog}
          programTemplateIds={programTemplateIds}
          allExercises={allExercises}
          onRefresh={onRefresh}
          refreshing={refreshing}
        />
      ) : view === 'load' ? (
        <LoadTab
          baseLog={baseLog}
          allExercises={allExercises}
          fallbackBodyWeight={fallbackBodyWeight}
          onRefresh={onRefresh}
          refreshing={refreshing}
        />
      ) : null}

      {/* Historial NO se desmonta, se oculta. Sus tarjetas salen con
          `SlideOutRight` al borrarlas (SessionCard) y al desmontar la lista
          entera se iba TODO el historial por la derecha, mientras las otras dos
          pestañas van a corte. Oculto conserva además el scroll y los filtros. */}
      {history && (
        <View
          style={[styles.fill, view !== 'history' && styles.hidden]}
          pointerEvents={view === 'history' ? 'auto' : 'none'}
        >
          {history}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fill:     { flex: 1 },
  hidden:   { display: 'none' },
  switcher: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
});
