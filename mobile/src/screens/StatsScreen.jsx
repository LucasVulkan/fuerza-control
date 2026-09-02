/**
 * StatsScreen — wraps ProgressTab with AppHeader + store data.
 */

import { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useStore }    from '../../store/useStore';
import { programTemplateIds as programTemplateIds_ } from '../../../src/utils/clientLogs';
import AppHeader       from '../components/AppHeader';
import ProgressPanel   from '../components/stats/ProgressPanel';
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
      />
    </View>
  );
}

const makeStyles = (th) => StyleSheet.create({
  container: { flex: 1, backgroundColor: th.colors.bg },
});
