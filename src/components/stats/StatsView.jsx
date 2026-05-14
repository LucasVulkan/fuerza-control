import { useStore } from '../../store/useStore';
import ExerciseStatCard from './ExerciseStatCard';

export default function StatsView() {
  const navigate = useStore((s) => s.navigate);
  const workoutLog = useStore((s) => s.workoutLog);
  const programs = useStore((s) => s.programs);
  const profile = useStore((s) => s.profile);
  const exerciseLibrary = useStore((s) => s.exerciseLibrary);
  const getEffectiveTemplate = useStore((s) => s.getEffectiveTemplate);

  const activeProgram = programs[profile.activeProgramId];
  const isEmpty = workoutLog.length === 0;

  function getExerciseLogs(exerciseId) {
    return workoutLog
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

  // Ejercicios únicos del programa activo (sin repetir aunque aparezcan en varios días)
  const uniqueExerciseIds = activeProgram
    ? [...new Set(
        activeProgram.days.flatMap(({ sessionTemplateId }) => {
          const template = getEffectiveTemplate(sessionTemplateId);
          return template?.exercises.map((e) => e.exerciseId) ?? [];
        })
      )]
    : [];

  const exercisesWithLogs = uniqueExerciseIds.filter(
    (id) => getExerciseLogs(id).length > 0
  );

  return (
    <div>
      {/* Header */}
      <div
        onClick={() => navigate('home')}
        style={{
          padding: '14px 20px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        <span style={{ color: 'var(--muted)', fontSize: 22, lineHeight: 1 }}>‹</span>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, letterSpacing: 1 }}>
          PROGRESIÓN
        </div>
      </div>

      {/* Contenido */}
      <div style={{ padding: '14px 20px 40px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {isEmpty || !exercisesWithLogs.length ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--muted)', fontSize: 13, lineHeight: 1.8 }}>
            <span style={{ display: 'block', fontSize: 32, marginBottom: 12 }}>📈</span>
            Necesitas al menos una sesión<br />para ver la progresión.
          </div>
        ) : (
          exercisesWithLogs.map((exerciseId) => {
            const def = exerciseLibrary[exerciseId];
            const logs = getExerciseLogs(exerciseId);
            return (
              <ExerciseStatCard
                key={exerciseId}
                def={def}
                logs={logs}
              />
            );
          })
        )}
      </div>
    </div>
  );
}
