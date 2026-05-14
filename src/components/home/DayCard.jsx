import { formatDate } from '../../utils/formatters';

const DAY_COLORS = {
  A: 'var(--day1)',
  B: 'var(--day2)',
  C: 'var(--day3)',
};

export default function DayCard({ template, lastSession, exerciseLibrary = {}, onClick }) {
  const color = template.color ?? DAY_COLORS[template.label] ?? 'var(--accent)';
  const lastText = lastSession ? formatDate(lastSession.timestamp) : 'Sin registros';

  const focus = template.exercises
    .map(({ exerciseId }) => exerciseLibrary[exerciseId]?.name ?? exerciseId)
    .join(' · ');

  return (
    <div
      onClick={onClick}
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderLeft: `3px solid ${color}`,
        borderRadius: 10,
        padding: '16px 18px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        cursor: 'pointer',
        userSelect: 'none',
        transition: 'background 0.15s',
      }}
      onPointerDown={(e) => e.currentTarget.style.background = 'var(--surface2)'}
      onPointerUp={(e) => e.currentTarget.style.background = 'var(--surface)'}
      onPointerLeave={(e) => e.currentTarget.style.background = 'var(--surface)'}
    >
      {/* Izquierda */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, lineHeight: 1, color }}>
          {template.label}
        </div>
        <div style={{ fontSize: 13, fontWeight: 500 }}>{template.name}</div>
        <div style={{ fontSize: 11, color: 'var(--muted)' }}>{focus}</div>
      </div>

      {/* Derecha */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5 }}>
        <div style={{ fontSize: 10, color: 'var(--muted)', textAlign: 'right' }}>
          {lastText}
        </div>
        <div style={{ color: 'var(--muted)', fontSize: 18 }}>›</div>
      </div>
    </div>
  );
}
