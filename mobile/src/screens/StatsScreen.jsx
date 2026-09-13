/**
 * StatsScreen — el tab de Progresión: `AppHeader` + los datos del store, y el
 * panel de tres segmentos (Ejercicios / Carga / Historial).
 */

import { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useStore }    from '../../store/useStore';
import { programTemplateIds as programTemplateIds_ } from '../utils/clientLogs';
import AppHeader       from '../components/AppHeader';
import ProgressPanel   from '../components/stats/ProgressPanel';
import HistoryList     from '../components/history/HistoryList';
import { useThemedStyles } from '../useTheme';

export default function StatsScreen() {
  const insets = useSafeAreaInsets();
  const styles = useThemedStyles(makeStyles);

  const workoutLog           = useStore((s) => s.workoutLog);
  const exerciseLibrary      = useStore((s) => s.exerciseLibrary);
  const customExercises      = useStore((s) => s.customExercises);
  const programs             = useStore((s) => s.programs);
  const profile              = useStore((s) => s.profile);

  const allExercises  = { ...exerciseLibrary, ...customExercises };
  const activeProgram = programs[profile.activeProgramId];

  // El alcance "del programa" lo calcula la util compartida, que es la misma
  // que decide qué sube el cliente a su entrenador y qué se borra al purgar.
  const programTemplateIds = useMemo(
    () => programTemplateIds_(activeProgram),
    [activeProgram],
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <AppHeader />
      <ProgressPanel
        baseLog={workoutLog}
        programTemplateIds={programTemplateIds}
        allExercises={allExercises}
        fallbackBodyWeight={profile.bodyWeight ?? null}
        // El tercer segmento sólo aquí: la ficha de cliente comparte este panel
        // y ya tiene su propio tab de Historial.
        history={<HistoryList />}
      />
    </View>
  );
}

const makeStyles = (th) => StyleSheet.create({
  container: { flex: 1, backgroundColor: th.colors.bg },
});
