import { useState, useMemo } from 'react';
import { useStore } from '../../store/useStore';
import SessionCard from './SessionCard';
import { filterLog } from '../ui/FilterBar';

export default function HistoryView({ embedded = false }) {
  const workoutLog     = useStore((s) => s.workoutLog);
  const deleteLogEntry = useStore((s) => s.deleteLogEntry);
  const navigate       = useStore((s) => s.navigate);
  const programs       = useStore((s) => s.programs);
  const profile        = useStore((s) => s.profile);
  const activeProgram  = programs[profile.activeProgramId];

  const [scope, setScope]               = useState('all');
  const [selectedStageIds, setSelectedStageIds] = useState(new Set());

  const hasStages = (activeProgram?.stages?.length ?? 0) > 0;

  // Cuando cambia el scope, resetear la selección de etapas
  function handleScope(newScope) {
    setScope(newScope);
    setSelectedStageIds(new Set());
  }

  // Toggle de etapa individual (multiselect)
  function toggleStage(stageId) {
    setSelectedStageIds((prev) => {
      const next = new Set(prev);
      if (next.has(stageId)) next.delete(stageId);
      else next.add(stageId);
      return next;
    });
  }

  // Template IDs efectivos: todos los del programa, filtrados por etapas seleccionadas
  const programTemplateIds = useMemo(() => {
    const ids = new Set();
    if (!activeProgram) return ids;
    const stages = activeProgram.stages;
    if (stages?.length > 0) {
      stages.forEach((st) => st.days.forEach((d) => ids.add(d.sessionTemplateId)));
    } else {
      activeProgram.days.forEach((d) => ids.add(d.sessionTemplateId));
    }
    return ids;
  }, [activeProgram]);

  // Si hay etapas y alguna seleccionada → filtrar por esas etapas
  const effectiveTemplateIds = useMemo(() => {
    if (scope !== 'program' || !hasStages || selectedStageIds.size === 0) {
      return programTemplateIds;
    }
    const ids = new Set();
    activeProgram.stages.forEach((st, idx) => {
      const stageId = st.id ?? idx;
      if (selectedStageIds.has(stageId)) {
        st.days.forEach((d) => ids.add(d.sessionTemplateId));
      }
    });
    return ids;
  }, [activeProgram, scope, selectedStageIds, programTemplateIds, hasStages]);

  const filtered = filterLog(workoutLog, scope, 'all', effectiveTemplateIds)
    .sort((a, b) => b.timestamp - a.timestamp);

  function handleDelete(id) {
    if (window.confirm('¿Eliminar esta sesión?')) deleteLogEntry(id);
  }

  return (
    <div>
      {!embedded && (
        <div
          onClick={() => navigate('home')}
          style={{
            padding: '14px 20px',
            borderBottom: 'var(--border-width) solid var(--border)',
            display: 'flex', alignItems: 'center', gap: 12,
            cursor: 'pointer', userSelect: 'none',
          }}
        >
          <span style={{ color: 'var(--muted)', fontSize: 22, lineHeight: 1 }}>‹</span>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, letterSpacing: 1 }}>
            HISTORIAL
          </div>
        </div>
      )}

      {/* Scope selector */}
      <div style={{ padding: '10px 20px 0', display: 'flex', gap: 6 }}>
        {[
          { id: 'program', label: 'Programa actual' },
          { id: 'all',     label: 'Todo' },
        ].map(({ id, label }) => {
          const active = scope === id;
          return (
            <button
              key={id}
              onClick={() => handleScope(id)}
              style={{
                flex: 1,
                background: active ? 'var(--accent-tint-active)' : 'var(--surface)',
                border: 'var(--border-width) solid',
                borderColor: active ? 'var(--accent-tint-border)' : 'var(--border)',
                borderRadius: 6, color: active ? 'var(--accent)' : 'var(--muted)',
                fontFamily: "'DM Sans', sans-serif", fontSize: 11,
                padding: '6px 4px', cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Stage pills — solo cuando scope=program y hay etapas */}
      {scope === 'program' && hasStages && (
        <div style={{ padding: '8px 20px 0', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {activeProgram.stages.map((stage, idx) => {
            const stageId  = stage.id ?? idx;
            // active = todas si vacío, o si este stage está en la selección
            const isActive = selectedStageIds.size === 0 || selectedStageIds.has(stageId);
            return (
              <button
                key={stageId}
                onClick={() => toggleStage(stageId)}
                style={{
                  background: isActive ? 'var(--accent-tint-active)' : 'var(--surface2)',
                  border: 'var(--border-width) solid',
                  borderColor: isActive ? 'var(--accent-tint-border)' : 'var(--border)',
                  borderRadius: 20, padding: '4px 12px',
                  color: isActive ? 'var(--accent)' : 'var(--muted)',
                  fontFamily: "'DM Sans', sans-serif", fontSize: 11,
                  cursor: 'pointer', transition: 'all 0.15s',
                }}
              >
                {stage.name}
              </button>
            );
          })}
          {selectedStageIds.size > 0 && (
            <button
              onClick={() => setSelectedStageIds(new Set())}
              style={{
                background: 'none', border: 'none',
                color: 'var(--muted)', fontFamily: "'DM Sans', sans-serif",
                fontSize: 11, padding: '4px 8px', cursor: 'pointer',
              }}
            >
              Todas ✕
            </button>
          )}
        </div>
      )}

      <div style={{ padding: '10px 20px 80px', display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--muted)', fontSize: 13, lineHeight: 1.8 }}>
            <span style={{ display: 'block', fontSize: 32, marginBottom: 12 }}>📭</span>
            Sin sesiones para este filtro.
          </div>
        ) : (
          filtered.map((session) => (
            <SessionCard key={session.id} session={session} onDelete={handleDelete} />
          ))
        )}
      </div>
    </div>
  );
}
