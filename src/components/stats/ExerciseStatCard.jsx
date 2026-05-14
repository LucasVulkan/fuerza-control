import { formatDate } from '../../utils/formatters';
import { summarizeSets } from '../../utils/progression';

export default function ExerciseStatCard({ def, logs }) {
  if (!logs || !logs.length) return null;

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 10,
      padding: '14px 16px',
    }}>
      <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8, color: 'var(--text)' }}>
        {def?.name ?? '—'}
      </div>

      {logs.map(({ timestamp, exercise }) => {
        const doneSets = exercise?.sets?.filter((s) => s.done || s.weight || s.reps || s.time) ?? [];
        if (!doneSets.length) return null;
        const summary = summarizeSets(def, doneSets);

        return (
          <div key={timestamp} style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 11,
            padding: '5px 0',
            borderBottom: '1px solid var(--border)',
            color: 'var(--muted)',
          }}>
            <span>{formatDate(timestamp)}</span>
            <span style={{ color: 'var(--text)', fontWeight: 500 }}>{summary}</span>
          </div>
        );
      })}
    </div>
  );
}
