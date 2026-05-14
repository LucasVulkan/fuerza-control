import { useStore } from '../../store/useStore';
import SessionCard from './SessionCard';

export default function HistoryView() {
  const workoutLog = useStore((s) => s.workoutLog);
  const sorted = [...workoutLog].sort((a, b) => b.timestamp - a.timestamp);
  const deleteLogEntry = useStore((s) => s.deleteLogEntry);
  const navigate = useStore((s) => s.navigate);

  function handleDelete(id) {
    if (window.confirm('¿Eliminar esta sesión?')) {
      deleteLogEntry(id);
    }
  }

  return (
    <div>
      {/* Header — toda la barra es táctil */}
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
          HISTORIAL
        </div>
      </div>

      {/* Contenido */}
      <div style={{ padding: '14px 20px 40px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {sorted.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--muted)', fontSize: 13, lineHeight: 1.8 }}>
            <span style={{ display: 'block', fontSize: 32, marginBottom: 12 }}>📭</span>
            Sin sesiones todavía.<br />¡Completa tu primer entrenamiento!
          </div>
        ) : (
          sorted.map((session) => (
            <SessionCard
              key={session.id}
              session={session}
              onDelete={handleDelete}
            />
          ))
        )}
      </div>
    </div>
  );
}
