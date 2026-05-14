import { useState } from 'react';
import { useStore } from '../../store/useStore';
import SessionCard from './SessionCard';
import FilterBar, { filterLog } from '../ui/FilterBar';

export default function HistoryView({ embedded = false }) {
  const workoutLog      = useStore((s) => s.workoutLog);
  const deleteLogEntry  = useStore((s) => s.deleteLogEntry);
  const navigate        = useStore((s) => s.navigate);
  const programs        = useStore((s) => s.programs);
  const profile         = useStore((s) => s.profile);
  const activeProgram   = programs[profile.activeProgramId];

  const [scope,  setScope]  = useState('all');
  const [period, setPeriod] = useState('all');

  const programTemplateIds = new Set(
    activeProgram?.days.map((d) => d.sessionTemplateId) ?? []
  );

  const filtered = filterLog(workoutLog, scope, period, programTemplateIds)
    .sort((a, b) => b.timestamp - a.timestamp);

  function handleDelete(id) {
    if (window.confirm('¿Eliminar esta sesión?')) {
      deleteLogEntry(id);
    }
  }

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
            HISTORIAL
          </div>
        </div>
      )}

      <FilterBar scope={scope} period={period} onScope={setScope} onPeriod={setPeriod} />

      <div style={{ padding: '10px 20px 80px', display: 'flex', flexDirection: 'column', gap: 10 }}>
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
