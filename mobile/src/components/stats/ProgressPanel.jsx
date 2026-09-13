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
 * El conmutador viaja DENTRO del scroll de cada pestaña (prop `header`, primer
 * hijo de su ScrollView): no aporta nada fijo en pantalla y clavado arriba solo
 * robaba alto útil al contenido. El padding lateral ya lo pone el
 * contentContainer de cada pestaña, así que va sin envoltorio.
 */
import { useState, cloneElement } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import SegmentedControl from '../ui/SegmentedControl';
import ProgressTab from './ProgressTab';
import LoadTab     from './LoadTab';

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

  const header = <SegmentedControl options={options} value={view} onChange={setView} />;

  return (
    <View style={{ flex: 1 }}>
      {view === 'history' ? (
        // El conmutador se le inyecta como a las otras dos: la lista lo antepone
        // a su propia cabecera de filtros.
        cloneElement(history, { header })
      ) : view === 'exercises' ? (
        <ProgressTab
          header={header}
          baseLog={baseLog}
          programTemplateIds={programTemplateIds}
          allExercises={allExercises}
          onRefresh={onRefresh}
          refreshing={refreshing}
        />
      ) : (
        <LoadTab
          header={header}
          baseLog={baseLog}
          allExercises={allExercises}
          fallbackBodyWeight={fallbackBodyWeight}
          onRefresh={onRefresh}
          refreshing={refreshing}
        />
      )}
    </View>
  );
}
