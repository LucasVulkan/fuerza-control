// FilterBar — filtros combinables de scope (programa/todo) y tiempo
// Uso: <FilterBar scope={scope} period={period} onScope={setScope} onPeriod={setPeriod} />

const SCOPE_OPTIONS  = [
  { id: 'program', label: 'Programa actual' },
  { id: 'all',     label: 'Todo' },
];

const PERIOD_OPTIONS = [
  { id: '7d',  label: '7 días' },
  { id: '30d', label: '30 días' },
  { id: 'all', label: 'Sin límite' },
];

export default function FilterBar({ scope, period, onScope, onPeriod }) {
  return (
    <div style={{ padding: '10px 20px 0', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <FilterRow options={SCOPE_OPTIONS}  value={scope}  onChange={onScope} />
      <FilterRow options={PERIOD_OPTIONS} value={period} onChange={onPeriod} />
    </div>
  );
}

function FilterRow({ options, value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {options.map((opt) => {
        const active = value === opt.id;
        return (
          <button
            key={opt.id}
            onClick={() => onChange(opt.id)}
            style={{
              flex: 1,
              background: active ? 'var(--accent-tint-active)' : 'var(--surface)',
              border: 'var(--border-width) solid',
              borderColor: active ? 'var(--accent-tint-border)' : 'var(--border)',
              borderRadius: 6,
              color: active ? 'var(--accent)' : 'var(--muted)',
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 11,
              padding: '6px 4px',
              cursor: 'pointer',
              transition: 'all 0.15s',
              whiteSpace: 'nowrap',
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Helpers de filtrado ─────────────────────────────────────────────────────

/**
 * Filtra el workoutLog según scope y period.
 * @param {object[]} log
 * @param {'program'|'all'} scope
 * @param {'7d'|'30d'|'all'} period
 * @param {Set<string>} programTemplateIds — IDs de templates del programa activo
 */
export function filterLog(log, scope, period, programTemplateIds) {
  let filtered = [...log];

  if (scope === 'program' && programTemplateIds.size > 0) {
    filtered = filtered.filter((e) => programTemplateIds.has(e.sessionTemplateId));
  }

  if (period !== 'all') {
    const days = period === '7d' ? 7 : 30;
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    filtered = filtered.filter((e) => e.timestamp >= cutoff);
  }

  return filtered;
}
