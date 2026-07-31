/**
 * ProgressPanel — conmutador EJERCICIOS / CARGA.
 *
 * Existe para que las dos pantallas que enseñan progreso (StatsScreen del
 * propio usuario y el detalle de cliente de ClientsScreen) compartan el mismo
 * conmutador en vez de duplicarlo y acabar divergiendo. El panel de carga sale
 * gratis en el lado entrenador, que es donde monotonía y strain son más
 * accionables.
 *
 * El conmutador queda FUERA del scroll de cada pestaña: cada una trae su propia
 * ScrollView con su padding de página.
 */
import { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing } from '../../theme';
import { useThemedStyles } from '../../useTheme';
import SegmentedControl from '../ui/SegmentedControl';
import ProgressTab from './ProgressTab';
import LoadTab     from './LoadTab';

export default function ProgressPanel({
  baseLog, programTemplateIds, allExercises, fallbackBodyWeight,
  onRefresh, refreshing = false,
}) {
  const styles = useThemedStyles(makeStyles);
  const { t }  = useTranslation();
  const [view, setView] = useState('exercises');

  const options = [
    { id: 'exercises', label: t('load.tabExercises') },
    { id: 'load',      label: t('load.tabLoad') },
  ];

  return (
    <View style={styles.flex}>
      <View style={styles.switchWrap}>
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
      ) : (
        <LoadTab
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

const makeStyles = () => StyleSheet.create({
  flex:       { flex: 1 },
  switchWrap: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
});
