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
  const [selectedIds, setSelectedIds] = useState(new Set());

  const programTemplateIds = new Set(
    activeProgram?.days.map((d) => d.sessionTemplateId) ?? []
  );

  const programExerciseIds = new Set(
    activeProgram?.days.flatMap(({ sessionTemplateId }) => {
      const tpl = getEffectiveTemplate(sessionTemplateId);
      return tpl?.exercises.map((e) => e.exerciseId) ?? [];
    }) ?? []
  );

  // Log filtrado por scope + period → para la tabla
  const filteredLog = filterLog(workoutLog, scope, period, programTemplateIds);
  // Log filtrado solo por scope → para la gráfica (usa su propio filtro de período)
  const filteredLogScope = filterLog(workoutLog, scope, 'all', programTemplateIds);

  function hasData(log, exerciseId) {
    return log.exercises.some((e) =>
      e.exerciseId === exerciseId &&
      e.sets.some((s) => s.done || s.weight || s.reps || s.time)
    );
  }

  function getExerciseLogs(exerciseId, sourceLog) {
    return sourceLog
      .filter((log) => hasData(log, exerciseId))
      .sort((a, b) => a.timestamp - b.timestamp)
      .map((log) => ({
        timestamp: log.timestamp,
        exercise:  log.exercises.find((e) => e.exerciseId === exerciseId),
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
  ).filter((id) => getExerciseLogs(id, filteredLog).length > 0);

  // Selector de ejercicios (solo cuando hay más de 5)
  const showSelector = exercisesWithLogs.length > 5;
  const [filterOpen, setFilterOpen] = useState(false);

  function toggleId(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  const visibleExercises = selectedIds.size > 0
    ? exercisesWithLogs.filter((id) => selectedIds.has(id))
    : exercisesWithLogs;

  return (
    <div>
      {!embedded && (
        <div
          onClick={() => navigate('home')}
          style={{
            padding: '14px 20px', borderBottom: '1px solid var(--border)',
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

      {/* Selector de ejercicios — dropdown con checkboxes */}
      {showSelector && (
        <div style={{ margin: '8px 20px 2px' }}>
          {/* Trigger */}
          <button
            onClick={() => setFilterOpen((v) => !v)}
            style={{
              width: '100%', background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: filterOpen ? '8px 8px 0 0' : 8,
              padding: '9px 14px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              fontFamily: "'DM Sans', sans-serif", fontSize: 12,
              color: selectedIds.size > 0 ? 'var(--accent)' : 'var(--muted)',
              transition: 'border-radius 0.15s',
            }}
          >
            <span>
              {selectedIds.size > 0
                ? `${selectedIds.size} de ${exercisesWithLogs.length} ejercicios seleccionados`
                : `Todos los ejercicios (${exercisesWithLogs.length})`}
            </span>
            <span style={{
              fontSize: 11, transition: 'transform 0.2s',
              transform: filterOpen ? 'rotate(180deg)' : 'none',
              display: 'inline-block',
            }}>▾</span>
          </button>

          {/* Panel con lista de checkboxes */}
          {filterOpen && (
            <div style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderTop: 'none', borderRadius: '0 0 8px 8px',
              maxHeight: 240, overflowY: 'auto',
            }}>
              {exercisesWithLogs.map((id, i) => {
                const name    = allExercises[id]?.name ?? id;
                const checked = selectedIds.has(id);
                const isLast  = i === exercisesWithLogs.length - 1;
                return (
                  <label key={id} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 14px', cursor: 'pointer',
                    borderBottom: isLast ? 'none' : '1px solid var(--border)',
                    background: checked ? 'rgba(232,255,71,0.04)' : 'transparent',
                  }}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleId(id)}
                      style={{
                        accentColor: '#e8ff47',
                        width: 15, height: 15,
                        flexShrink: 0, cursor: 'pointer',
                      }}
                    />
                    <span style={{
                      fontSize: 12, lineHeight: 1.3,
                      color: checked ? 'var(--text)' : 'var(--muted)',
                    }}>{name}</span>
                  </label>
                );
              })}

              {/* Footer: limpiar selección */}
              {selectedIds.size > 0 && (
                <div style={{
                  padding: '8px 14px', borderTop: '1px solid var(--border)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  position: 'sticky', bottom: 0,
                  background: 'var(--surface)',
                }}>
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                    {selectedIds.size} seleccionado{selectedIds.size !== 1 ? 's' : ''}
                  </span>
                  <button
                    onClick={() => setSelectedIds(new Set())}
                    style={{
                      background: 'none', border: 'none',
                      color: 'var(--accent)', fontFamily: "'DM Sans', sans-serif",
                      fontSize: 11, cursor: 'pointer', padding: 0,
                    }}
                  >
                    Limpiar selección
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div style={{ padding: '10px 20px 80px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {visibleExercises.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--muted)', fontSize: 13, lineHeight: 1.8 }}>
            <span style={{ display: 'block', fontSize: 32, marginBottom: 12 }}>📈</span>
            {workoutLog.length === 0
              ? <>Necesitas al menos una sesión<br />para ver la progresión.</>
              : <>Sin datos para este filtro.</>
            }
          </div>
        ) : visibleExercises.map((exerciseId) => {
          const def     = allExercises[exerciseId];
          const logs    = getExerciseLogs(exerciseId, filteredLog).slice(-6);
          const allLogs = getExerciseLogs(exerciseId, filteredLogScope);
          return (
            <ExerciseStatCard key={exerciseId} def={def} logs={logs} allLogs={allLogs} />
          );
        })}
      </div>
    </div>
  );
}
