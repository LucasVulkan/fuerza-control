import { formatDate } from '../../utils/formatters';

const DAY_COLORS = {
  A: 'var(--day1)', B: 'var(--day2)', C: 'var(--day3)',
  D: 'var(--day4)', E: 'var(--day5)', F: 'var(--day6)',
};

function relativeTime(ts) {
  if (!ts) return 'Sin registros';
  const days = Math.floor((Date.now() - ts) / 86400000);
  if (days === 0) return 'Hoy';
  if (days === 1) return 'Ayer';
  if (days < 7)  return `Hace ${days} días`;
  if (days < 14) return 'Hace 1 semana';
  return formatDate(ts);
}

export default function DayCard({ template, lastSession, exerciseLibrary = {}, onClick, isActive = false }) {
  const color = template.color ?? DAY_COLORS[template.label] ?? 'var(--accent)';
  const lastText = relativeTime(lastSession?.timestamp);

  const focus = template.exercises
    .map(({ exerciseId }) => exerciseLibrary[exerciseId]?.name ?? exerciseId)
    .join(' · ');

  return (
    <div
      onClick={onClick}
      style={{
        background: 'var(--surface)',
        border: 'var(--border-width) solid var(--border-card)',
        borderLeft: `3px solid ${color}`,
        borderRadius: 10,
        padding: '14px 18px',
        cursor: 'pointer',
        userSelect: 'none',
        transition: 'background 0.15s',
      }}
      onPointerDown={(e) => e.currentTarget.style.background = 'var(--surface2)'}
      onPointerUp={(e) => e.currentTarget.style.background = 'var(--surface)'}
      onPointerLeave={(e) => e.currentTarget.style.background = 'var(--surface)'}
    >
      {/* Fila superior: letra + fecha/píldora */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 2 }}>
        <div style={{
          fontFamily: "'Bebas Neue', sans-serif",
          fontSize: 44,
          lineHeight: 1,
          color,
          flexShrink: 0,
        }}>
          {template.label}
        </div>

        {isActive ? (
          <div style={{
            fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase',
            color, border: `var(--border-width) solid ${color}`,
            borderRadius: 20, padding: '2px 10px',
            background: 'rgba(255,255,255,0.04)',
            fontWeight: 500, whiteSpace: 'nowrap', marginTop: 4,
          }}>
            ● EN CURSO
          </div>
        ) : (
          <div style={{ fontSize: 10, color: 'var(--muted)', whiteSpace: 'nowrap', marginTop: 4 }}>
            {lastText}
          </div>
        )}
      </div>

      {/* Nombre */}
      <div style={{
        fontFamily: "'Bebas Neue', sans-serif",
        fontSize: 17,
        letterSpacing: 0.5,
        color,
        lineHeight: 1.1,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}>
        {template.name.toUpperCase()}
      </div>

      {/* Ejercicios */}
      <div style={{
        fontSize: 11, color: 'var(--muted)', marginTop: 3,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        {focus}
      </div>
    </div>
  );
}


