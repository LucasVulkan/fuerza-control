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

function CustomTooltip({ active, payload, metricLabel }) {
  if (!active || !payload?.length) return null;
  // Usar payload.date directamente para distinguir sesiones del mismo día
  const entry = payload[0]?.payload;
  return (
    <div style={{
      background: '#1f1f1f', border: '1px solid #2a2a2a',
      borderRadius: 6, padding: '6px 10px',
      fontSize: 11, fontFamily: "'DM Sans', sans-serif", color: '#f0f0f0',
    }}>
      <div style={{ color: '#888', marginBottom: 2 }}>{entry?.date ?? ''}</div>
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
  // Eje X normalizado (índice equidistante) para evitar espaciado irregular
  // y para distinguir múltiples sesiones en el mismo día.
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
        timestamp,
        value: computeValue(exercise?.sets, activeMetric),
      }))
      .filter((d) => d.value !== null)
      .map((d, i) => ({ ...d, i })); // índice normalizado para el eje X
  }, [effectiveLogs, chartPeriod, activeMetric]);

  // Ancho dinámico del eje Y según el valor máximo del dataset.
  // El margen izquierdo del LineChart es fijo a -8 para quitar el padding
  // extra de recharts. El espacio visible = yAxisWidth + (-8).
  // Necesitamos visible ≥ dígitos × ~6.5px a font-size 9.
  const yAxisWidth = useMemo(() => {
    if (!chartData.length) return 32;
    const maxVal = Math.max(...chartData.map((d) => d.value ?? 0));
    if (maxVal >= 10000) return 48; // visible 40px — 5 dígitos
    if (maxVal >= 1000)  return 40; // visible 32px — 4 dígitos
    if (maxVal >= 100)   return 32; // visible 24px — 3 dígitos
    return 24;                      // visible 16px — 2 dígitos
  }, [chartData]);

  return (
    <div style={{
      background: 'var(--surface)', border: 'var(--border-width) solid var(--border-card)',
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
            background: expanded ? 'var(--accent-tint-active)' : 'none',
            border: 'var(--border-width) solid',
            borderColor: expanded ? 'var(--accent-tint-border)' : 'var(--border)',
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
              borderBottom: 'var(--border-width) solid var(--border)', color: 'var(--muted)',
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
        <div style={{ borderTop: 'var(--border-width) solid var(--border)', padding: '12px 14px 16px' }}>

          {/* Filtros */}
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            alignItems: 'center', marginBottom: 12, gap: 6, flexWrap: 'wrap',
          }}>
            <div style={{ display: 'flex', gap: 4 }}>
              {PERIOD_OPTIONS.map(({ id, label }) => (
                <button key={id} onClick={() => setChartPeriod(id)} style={{
                  padding: '4px 10px', borderRadius: 5, border: 'var(--border-width) solid',
                  borderColor: chartPeriod === id ? 'var(--accent-tint-border)' : 'var(--border)',
                  background:  chartPeriod === id ? 'var(--accent-tint-active)' : 'var(--surface2)',
                  color:       chartPeriod === id ? 'var(--accent)' : 'var(--muted)',
                  fontFamily: "'DM Sans', sans-serif", fontSize: 11, cursor: 'pointer',
                }}>{label}</button>
              ))}
            </div>
            {metrics.length > 1 && (
              <div style={{ display: 'flex', gap: 4 }}>
                {metrics.map(({ id, label }) => (
                  <button key={id} onClick={() => setChartMetric(id)} style={{
                    padding: '4px 10px', borderRadius: 5, border: 'var(--border-width) solid',
                    borderColor: activeMetric === id ? 'var(--accent-tint-border)' : 'var(--border)',
                    background:  activeMetric === id ? 'var(--accent-tint-active)' : 'var(--surface2)',
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
            // outline:none evita el foco visible al hacer click en el gráfico
            <div style={{ outline: 'none', userSelect: 'none' }} onMouseDown={(e) => e.preventDefault()}>
              <ResponsiveContainer width="100%" height={150}>
                <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -8 }}>
                  <XAxis
                    dataKey="i"
                    type="number"
                    domain={[0, chartData.length - 1]}
                    ticks={chartData.map((d) => d.i)}
                    tickFormatter={(i) => chartData[i]?.date ?? ''}
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
                    width={yAxisWidth}
                  />
                  <Tooltip content={<CustomTooltip metricLabel={activeMetricLabel} />} />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="var(--accent)"
                    strokeWidth={2}
                    dot={{ fill: 'var(--accent)', r: 3, strokeWidth: 0 }}
                    activeDot={{ r: 5, fill: 'var(--accent)', strokeWidth: 0 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
