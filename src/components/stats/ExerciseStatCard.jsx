import { useState, useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import { formatDate } from '../../utils/formatters';
import { summarizeSets } from '../../utils/progression';

const PERIOD_OPTIONS = [
  { id: '1m',  label: '1M' },
  { id: '3m',  label: '3M' },
  { id: 'all', label: 'Todo' },
];

function shortDate(ts) {
  return new Date(ts).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

function getMetrics(def, allLogs) {
  const model = def?.progressionModel;
  if (model === 'time_progression') return [{ id: 'time', label: 'Segundos' }];
  if (model === 'submax') return [{ id: 'reps', label: 'Reps' }];
  const hasWeight = allLogs.some(({ exercise }) =>
    exercise?.sets?.some((s) => parseFloat(s.weight) > 0)
  );
  const m = [{ id: 'reps', label: 'Reps' }];
  if (hasWeight) {
    m.unshift({ id: 'kg', label: 'Kg' });
    m.push({ id: 'vol', label: 'Volumen' });
  }
  return m;
}

function computeValue(sets, metricId) {
  const done = sets?.filter((s) => s.done || s.weight || s.reps || s.time) ?? [];
  if (!done.length) return null;
  if (metricId === 'time') {
    const times = done.map((s) => parseFloat(s.time) || 0).filter(Boolean);
    return times.length ? Math.max(...times) : null;
  }
  if (metricId === 'kg') {
    const v = Math.max(...done.map((s) => parseFloat(s.weight) || 0));
    return v > 0 ? v : null;
  }
  if (metricId === 'reps') {
    const v = done.reduce((a, s) => a + (parseInt(s.reps) || 0), 0);
    return v > 0 ? v : null;
  }
  if (metricId === 'vol') {
    const v = done.reduce((a, s) => a + (parseFloat(s.weight) || 0) * (parseInt(s.reps) || 0), 0);
    return v > 0 ? Math.round(v) : null;
  }
  return null;
}

function computeTotals(def, allLogs) {
  const model = def?.progressionModel;
  const allDone = allLogs.flatMap(({ exercise }) =>
    exercise?.sets?.filter((s) => s.done || s.weight || s.reps || s.time) ?? []
  );
  if (!allDone.length) return null;

  const sessions = allLogs.length;

  if (model === 'time_progression') {
    const maxTime = Math.max(...allDone.map((s) => parseFloat(s.time) || 0));
    return maxTime > 0
      ? `PR ${maxTime}s · ${sessions} sesión${sessions !== 1 ? 'es' : ''}`
      : `${sessions} sesión${sessions !== 1 ? 'es' : ''}`;
  }

  const maxKg = Math.max(...allDone.map((s) => parseFloat(s.weight) || 0));
  if (maxKg > 0) {
    return `PR ${maxKg}kg · ${sessions} sesión${sessions !== 1 ? 'es' : ''}`;
  }

  // submax u ejercicios sin peso
  return `${sessions} sesión${sessions !== 1 ? 'es' : ''}`;
}

function CustomTooltip({ active, payload, label, metricLabel }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#1f1f1f', border: '1px solid #2a2a2a',
      borderRadius: 6, padding: '6px 10px',
      fontSize: 11, fontFamily: "'DM Sans', sans-serif", color: '#f0f0f0',
    }}>
      <div style={{ color: '#888', marginBottom: 2 }}>{label}</div>
      <div style={{ fontWeight: 500 }}>
        {payload[0].value}{' '}
        <span style={{ color: '#888', fontWeight: 400 }}>{metricLabel}</span>
      </div>
    </div>
  );
}

export default function ExerciseStatCard({ def, logs, allLogs }) {
  const [expanded,    setExpanded]    = useState(false);
  const [chartPeriod, setChartPeriod] = useState('all');
  const [chartMetric, setChartMetric] = useState(null);

  const effectiveLogs = allLogs ?? logs ?? [];
  if (!effectiveLogs.length && !logs?.length) return null;

  const metrics           = useMemo(() => getMetrics(def, effectiveLogs), [def, effectiveLogs]);
  const activeMetric      = chartMetric ?? metrics[0]?.id;
  const activeMetricLabel = metrics.find((m) => m.id === activeMetric)?.label ?? '';
  const totals            = useMemo(() => computeTotals(def, effectiveLogs), [def, effectiveLogs]);

  // Tabla: últimas 6 de más reciente a más antigua
  const tableLogs = useMemo(() => [...(logs ?? [])].reverse(), [logs]);

  // Gráfica: allLogs filtrado por chartPeriod local
  const chartData = useMemo(() => {
    let filtered = [...effectiveLogs];
    if (chartPeriod !== 'all') {
      const days   = chartPeriod === '1m' ? 30 : 90;
      const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
      filtered = filtered.filter(({ timestamp }) => timestamp >= cutoff);
    }
    return filtered
      .map(({ timestamp, exercise }) => ({
        date:  shortDate(timestamp),
        value: computeValue(exercise?.sets, activeMetric),
      }))
      .filter((d) => d.value !== null);
  }, [effectiveLogs, chartPeriod, activeMetric]);

  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 10, overflow: 'hidden',
    }}>
      {/* Cabecera */}
      <div style={{
        padding: '12px 14px 8px',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>
            {def?.name ?? '—'}
          </div>
          {totals && (
            <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2, lineHeight: 1.4 }}>
              {totals}
            </div>
          )}
        </div>
        <button
          onClick={() => setExpanded((v) => !v)}
          style={{
            background: expanded ? 'rgba(232,255,71,0.1)' : 'none',
            border: '1px solid',
            borderColor: expanded ? 'rgba(232,255,71,0.3)' : 'var(--border)',
            borderRadius: 6, color: expanded ? 'var(--accent)' : 'var(--muted)',
            fontSize: 13, padding: '4px 9px', cursor: 'pointer',
            flexShrink: 0, lineHeight: 1,
          }}
        >📈</button>
      </div>

      {/* Tabla de sesiones */}
      <div style={{ padding: '0 14px 12px' }}>
        {tableLogs.map(({ timestamp, exercise }) => {
          const done = exercise?.sets?.filter((s) => s.done || s.weight || s.reps || s.time) ?? [];
          if (!done.length) return null;
          return (
            <div key={timestamp} style={{
              display: 'flex', justifyContent: 'space-between',
              fontSize: 11, padding: '5px 0',
              borderBottom: '1px solid var(--border)', color: 'var(--muted)',
            }}>
              <span>{formatDate(timestamp)}</span>
              <span style={{ color: 'var(--text)', fontWeight: 500 }}>
                {summarizeSets(def, done)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Gráfica expandible */}
      {expanded && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '12px 14px 16px' }}>

          {/* Filtros */}
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            alignItems: 'center', marginBottom: 12, gap: 6, flexWrap: 'wrap',
          }}>
            <div style={{ display: 'flex', gap: 4 }}>
              {PERIOD_OPTIONS.map(({ id, label }) => (
                <button key={id} onClick={() => setChartPeriod(id)} style={{
                  padding: '4px 10px', borderRadius: 5, border: '1px solid',
                  borderColor: chartPeriod === id ? 'rgba(232,255,71,0.4)' : 'var(--border)',
                  background:  chartPeriod === id ? 'rgba(232,255,71,0.1)' : 'var(--surface2)',
                  color:       chartPeriod === id ? 'var(--accent)' : 'var(--muted)',
                  fontFamily: "'DM Sans', sans-serif", fontSize: 11, cursor: 'pointer',
                }}>{label}</button>
              ))}
            </div>
            {metrics.length > 1 && (
              <div style={{ display: 'flex', gap: 4 }}>
                {metrics.map(({ id, label }) => (
                  <button key={id} onClick={() => setChartMetric(id)} style={{
                    padding: '4px 10px', borderRadius: 5, border: '1px solid',
                    borderColor: activeMetric === id ? 'rgba(232,255,71,0.4)' : 'var(--border)',
                    background:  activeMetric === id ? 'rgba(232,255,71,0.1)' : 'var(--surface2)',
                    color:       activeMetric === id ? 'var(--accent)' : 'var(--muted)',
                    fontFamily: "'DM Sans', sans-serif", fontSize: 11, cursor: 'pointer',
                  }}>{label}</button>
                ))}
              </div>
            )}
          </div>

          {/* Chart o mensaje vacío */}
          {chartData.length < 2 ? (
            <div style={{
              textAlign: 'center', padding: '24px 0',
              color: 'var(--muted)', fontSize: 12,
            }}>
              Necesitas al menos 2 sesiones en este período.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={150}>
              <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -24 }}>
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 9, fill: '#888', fontFamily: "'DM Sans', sans-serif" }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 9, fill: '#888', fontFamily: "'DM Sans', sans-serif" }}
                  tickLine={false}
                  axisLine={false}
                  domain={['auto', 'auto']}
                  width={40}
                />
                <Tooltip content={<CustomTooltip metricLabel={activeMetricLabel} />} />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#e8ff47"
                  strokeWidth={2}
                  dot={{ fill: '#e8ff47', r: 3, strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: '#e8ff47', strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      )}
    </div>
  );
}
