/**
 * StatsScreen — el tab de Progresión: `AppHeader` + los datos del store, y el
 * panel de tres segmentos (Ejercicios / Carga / Historial).
 */

import { useMemo, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useStore }    from '../../store/useStore';
import { programTemplateIds as programTemplateIds_ } from '../utils/clientLogs';
import AppHeader       from '../components/AppHeader';
import { useScreenTour } from '../components/tour/useScreenTour';
import { useEnterClock, EnterClock, ENTER_FAST } from '../hooks/useEnterClock';
import ProgressPanel   from '../components/stats/ProgressPanel';
import HistoryList     from '../components/history/HistoryList';
import { useThemedStyles } from '../useTheme';

export default function StatsScreen() {
  const insets = useSafeAreaInsets();
  const { t }  = useTranslation();
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

  // Entrada por partes al llegar a la pestaña, como Programa (U14 §4.3).
  const enterClock = useEnterClock({ speed: ENTER_FAST });

  // ── Recorrido de la primera vez (U17-02 §4) ──
  // El segmentado y, si hay entrenos, el primer ejercicio de la lista. Solo aquí:
  // la ficha de cliente comparte `ProgressPanel` pero no pasa estos refs.
  const switcherRef = useRef(null);
  const listRef     = useRef(null);
  const firstRef    = useRef(null);
  const text        = (key) => t(`tour.progress.${key}`, { returnObjects: true });
  const tourSteps   = [
    { ref: switcherRef, ...text('tabs') },
    ...(workoutLog.length > 0 ? [{ ref: firstRef, scrollRef: listRef, ...text('exercise') }] : []),
  ];
  const openTour = useScreenTour('tour.progress', tourSteps);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <AppHeader onHelp={openTour} />
      <EnterClock.Provider value={enterClock}>
        <ProgressPanel
          switcherRef={switcherRef}
          listRef={listRef}
          firstRef={firstRef}
          baseLog={workoutLog}
          programTemplateIds={programTemplateIds}
          allExercises={allExercises}
          fallbackBodyWeight={profile.bodyWeight ?? null}
          program={programs[profile.activeProgramId] ?? null}
          client={null}
          // El tercer segmento sólo aquí: la ficha de cliente comparte este panel
          // y ya tiene su propio tab de Historial.
          history={<HistoryList />}
        />
      </EnterClock.Provider>
    </View>
  );
}

const makeStyles = (th) => StyleSheet.create({
  container: { flex: 1, backgroundColor: th.colors.bg },
});
