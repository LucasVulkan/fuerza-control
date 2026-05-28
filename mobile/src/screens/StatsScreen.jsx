/**
 * StatsScreen — wraps ProgressTab with AppHeader + store data.
 */

import { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useStore }    from '../../store/useStore';
import AppHeader       from '../components/AppHeader';
import ProgressTab     from '../components/stats/ProgressTab';
import { colors }      from '../theme';

export default function StatsScreen() {
  const insets = useSafeAreaInsets();

  const workoutLog           = useStore((s) => s.workoutLog);
  const exerciseLibrary      = useStore((s) => s.exerciseLibrary);
  const customExercises      = useStore((s) => s.customExercises);
  const programs             = useStore((s) => s.programs);
  const profile              = useStore((s) => s.profile);

  const allExercises  = { ...exerciseLibrary, ...customExercises };
  const activeProgram = programs[profile.activeProgramId];

  const programTemplateIds = useMemo(() => {
    const ids = new Set();
    if (!activeProgram) return ids;
    if (activeProgram.stages?.length > 0) {
      activeProgram.stages.forEach((st) => st.days.forEach((d) => ids.add(d.sessionTemplateId)));
    } else {
      (activeProgram.days ?? []).forEach((d) => ids.add(d.sessionTemplateId));
    }
    return ids;
  }, [activeProgram]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <AppHeader />
      <ProgressTab
        baseLog={workoutLog}
        programTemplateIds={programTemplateIds}
        allExercises={allExercises}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
});
