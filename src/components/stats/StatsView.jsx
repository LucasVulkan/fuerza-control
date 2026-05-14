import { useState } from 'react';
import { useStore } from '../../store/useStore';
import ExerciseStatCard from './ExerciseStatCard';
import FilterBar, { filterLog } from '../ui/FilterBar';

export default function StatsView({ embedded = false }) {
  const navigate        = useStore((s) => s.navigate);
  const workoutLog      = useStore((s) => s.workoutLog);
  const exerciseLibrary = useStore((s) => s.exerciseLibrary);
  const customExercises = useStore((s) => s.customExercises);
  const programs        = useStore((s) => s.programs);
  const profile         = useStore((s) => s.profile);
  const getEffectiveTemplate = useStore((s) => s.getEffectiveTemplate);
  const allExercises    = { ...exerciseLibrary, ...customExercises };

  const activeProgram = programs[profile.activeProgramId];

  const [scope,  setScope]  = useState('all');
  const [period, setPeriod] = useState('all');

  const programTemplateIds = new Set(
    activeProgram?.days.map((d) => d.sessionTemplateId) ?? []
  );

  const programExerciseIds = new Set(
    activeProgram?.days.flatMap(({ sessionTemplateId }) => {
      const tpl = getEffectiveTemplate(sessionTemplateId);
      return tpl?.exercises.map((e) => e.exerciseId) ?? [];
    }) ?? []
  );

  const filteredLog = filterLog(workoutLog, scope, period, programTemplateIds);

  function getExerciseLogs(exerciseId) {
    return filteredLog
      .filter((log) => log.exercises.some((e) =>
        e.exerciseId === exerciseId &&
        e.sets.some((s) => s.done || s.weight || s.reps || s.time)
      ))
      .sort((a, b) => a.timestamp - b.timestamp)
      .slice(-6)
      .map((log) => ({
        timestamp: log.timestamp,
        exercise: log.exercises.find((e) => e.exerciseId === exerciseId),
      }));
  }

  const allExerciseIds = [...new Set(
    filteredLog.flatMap((log) =>
      log.exercises
        .filter((e) => e.sets.some((s) => s.done || s.weight || s.reps || s.time))
        .map((e) => e.exerciseId)
    )
  )];

  const exercisesWithLogs = (scope === 'program'
    ? allExerciseIds.filter((id) => programExerciseIds.has(id))
    : allExerciseIds
  ).filter((id) => getExerciseLogs(id).length > 0);

  return (
    <div>
      {!embedded && (
      <div
        onClick={() => navigate('home')}
        style={{
          padding: '14px 20px',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 12,
          cursor: 'pointer', userSelect: 'none',
        }}
      >
        <span style={{ color: 'var(--muted)', fontSize: 22, lineHeight: 1 }}>‹</span>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, letterSpacing: 1 }}>
          PROGRESIÓN
        </div>
      </div>
      )}

      <FilterBar scope={scope} period={period} onScope={setScope} onPeriod={setPeriod} />

      <div style={{ padding: '10px 20px 80px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {exercisesWithLogs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--muted)', fontSize: 13, lineHeight: 1.8 }}>
            <span style={{ display: 'block', fontSize: 32, marginBottom: 12 }}>📈</span>
            {workoutLog.length === 0
              ? <>Necesitas al menos una sesión<br />para ver la progresión.</>
              : <>Sin datos para este filtro.</>
            }
          </div>
        ) : (
          exercisesWithLogs.map((exerciseId) => {
            const def = allExercises[exerciseId];
            const logs = getExerciseLogs(exerciseId);
            return (
              <ExerciseStatCard key={exerciseId} def={def} logs={logs} />
            );
          })
        )}
      </div>
    </div>
  );
}
