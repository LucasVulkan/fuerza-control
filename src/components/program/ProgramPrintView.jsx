import { useTranslation } from 'react-i18next';
import { useStore } from '../../store/useStore';

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildTarget(def, exConfig, t) {
  const model    = def.progressionModel;
  const minTime  = exConfig?.minTime  ?? def.minTime;
  const maxTime  = exConfig?.maxTime  ?? def.maxTime;
  const minReps  = exConfig?.minReps  ?? def.minReps;
  const maxReps  = exConfig?.maxReps  ?? def.maxReps;
  const sets     = exConfig?.sets     ?? def.sets ?? 3;
  const restSec  = exConfig?.restSec  ?? def.restSec ?? 90;
  const restText = restSec >= 120 ? `${restSec / 60} min` : `${restSec} s`;

  let reps;
  if (model === 'time_progression') reps = `${minTime}–${maxTime} s`;
  else if (model === 'submax')      reps = t('print.submax');
  else if (minReps === maxReps)     reps = `${minReps} reps`;
  else                              reps = `${minReps}–${maxReps} reps`;
  if (def.isUnilateral)             reps += ` ${t('print.perSide')}`;

  return { sets, reps, restText };
}

const DAY_COLORS = ['#e8ff47', '#ff6b35', '#7eb8ff', '#a78bfa', '#34d399', '#f472b6'];

// ── Main component ────────────────────────────────────────────────────────────

export default function ProgramPrintView() {
  const { t, i18n } = useTranslation();
  const navigate             = useStore((s) => s.navigate);
  const programs             = useStore((s) => s.programs);
  const profile              = useStore((s) => s.profile);
  const ui                   = useStore((s) => s.ui);
  const getEffectiveTemplate = useStore((s) => s.getEffectiveTemplate);
  const exerciseLibrary      = useStore((s) => s.exerciseLibrary);
  const customExercises      = useStore((s) => s.customExercises);

  const programId     = ui._viewingProgramId ?? profile.activeProgramId;
  const fromClients   = !!ui._viewingProgramId;
  const activeProgram = programs[programId];
  const allExercises  = { ...exerciseLibrary, ...customExercises };
  const locale        = i18n.language === 'en' ? 'en-US' : 'es-ES';
  const isEN          = i18n.language === 'en';

  function handleBack() {
    useStore.setState((s) => ({ ui: { ...s.ui, _viewingProgramId: null } }));
    navigate('home');
    if (fromClients) {
      useStore.setState((s) => ({ ui: { ...s.ui, homeTab: 'clients', _viewingProgramId: null } }));
    }
  }

  if (!activeProgram) return null;

  const days = activeProgram.days
    .map(({ sessionTemplateId }, i) => ({
      template: getEffectiveTemplate(sessionTemplateId),
      color: DAY_COLORS[i % DAY_COLORS.length],
      index: i + 1,
    }))
    .filter((d) => d.template);

  const totalSets = days.reduce(
    (acc, { template }) => acc + template.exercises.reduce((a, ex) => a + (ex.sets ?? 3), 0),
    0
  );

  function getExName(def) {
    return isEN ? (def.nameEn ?? def.name) : def.name;
  }

  function getTip(def) {
    const tips = isEN ? (def.tipsEn ?? def.tips) : def.tips;
    return tips?.[0] ?? null;
  }

  function getPatternLabel(pattern) {
    return t(`exerciseSelector.patterns.${pattern}`, { defaultValue: pattern });
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @media print {
          body { background: #0d0d0d !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
          .day-section { page-break-inside: avoid; }
        }
        .print-page {
          background: #0d0d0d;
          color: #f0f0f0;
          font-family: 'DM Sans', sans-serif;
          font-weight: 300;
          min-height: 100vh;
          padding-bottom: 60px;
        }
      `}</style>

      <div className="print-page">

        {/* ── Toolbar ─────────────────────────────────────────────────────── */}
        <div className="no-print" style={{
          position: 'sticky', top: 0, zIndex: 50,
          background: '#111',
          borderBottom: '1px solid #222',
          padding: '10px 16px',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <button
            onClick={handleBack}
            style={{
              background: 'none', border: 'none',
              color: '#888', fontSize: 24, cursor: 'pointer',
              padding: '0 6px 0 0', lineHeight: 1, flexShrink: 0,
            }}
          >
            ‹
          </button>
          <span style={{
            flex: 1, fontFamily: "'Bebas Neue', sans-serif",
            fontSize: 17, letterSpacing: 1, color: '#f0f0f0',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {t('print.viewerTitle')}
          </span>
          <button
            onClick={() => window.print()}
            style={{
              background: '#e8ff47', border: 'none', borderRadius: 8,
              color: '#0d0d0d', fontFamily: "'Bebas Neue', sans-serif",
              fontSize: 14, letterSpacing: 1, padding: '7px 14px',
              cursor: 'pointer', flexShrink: 0,
            }}
          >
            {t('print.exportPdf')}
          </button>
        </div>

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <header style={{
          padding: '28px 20px 24px',
          borderBottom: '1px solid #1e1e1e',
          position: 'relative', overflow: 'hidden',
        }}>
          {/* Glow decorativo */}
          <div style={{
            position: 'absolute', top: -80, right: -60,
            width: 280, height: 280,
            background: 'radial-gradient(circle, rgba(232,255,71,0.07) 0%, transparent 70%)',
            pointerEvents: 'none',
          }} />

          <p style={{ fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: '#666', marginBottom: 10 }}>
            {t('print.trainingProgram')}
          </p>

          {/* Logo */}
          <div style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: 'clamp(38px, 11vw, 64px)',
            lineHeight: 0.88, letterSpacing: 2, color: '#f0f0f0',
          }}>
            FUERZA<br />
            <span style={{ color: '#e8ff47' }}>& CONTROL</span>
          </div>

          {/* Nombre del programa */}
          <div style={{
            marginTop: 14,
            fontSize: 17, fontWeight: 500, color: '#f0f0f0', lineHeight: 1.3,
          }}>
            {activeProgram.name}
          </div>

          {activeProgram.description && (
            <p style={{ fontSize: 12, color: '#888', marginTop: 6, lineHeight: 1.6, maxWidth: 400 }}>
              {activeProgram.description}
            </p>
          )}

          {/* Meta pills */}
          <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
            <MetaPill label={t('print.metaDays')} value={t('print.metaDaysValue', { count: activeProgram.days.length })} />
            {activeProgram.structure && (
              <MetaPill label={t('print.metaStructure')} value={activeProgram.structure} />
            )}
            <MetaPill label={t('print.metaTotalSets')} value={t('print.metaSetsValue', { count: totalSets })} />
          </div>
        </header>

        {/* ── Sesiones ────────────────────────────────────────────────────── */}
        <main>
          {days.map(({ template, color, index }) => (
            <DaySection
              key={template.id}
              template={template}
              color={color}
              index={index}
              allExercises={allExercises}
              t={t}
              getExName={getExName}
              getTip={getTip}
              getPatternLabel={getPatternLabel}
              buildTarget={buildTarget}
            />
          ))}
        </main>

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <footer style={{
          borderTop: '1px solid #1a1a1a',
          padding: '14px 20px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          fontSize: 10, color: '#3a3a3a', letterSpacing: 1.5,
          textTransform: 'uppercase',
        }}>
          <span>Fuerza &amp; Control</span>
          <span>{new Date().toLocaleDateString(locale, { year: 'numeric', month: 'long' })}</span>
        </footer>

      </div>
    </>
  );
}

// ── DaySection ────────────────────────────────────────────────────────────────

function DaySection({ template, color, index, allExercises, t, getExName, getTip, getPatternLabel, buildTarget }) {
  return (
    <section className="day-section" style={{ marginTop: 2 }}>

      {/* Header de sesión */}
      <div style={{
        borderLeft: `3px solid ${color}`,
        background: '#111',
        padding: '14px 20px 12px',
        borderBottom: '1px solid #1a1a1a',
      }}>
        <p style={{ fontSize: 12, letterSpacing: 1.5, textTransform: 'uppercase', color: '#aaa', marginBottom: 5, fontWeight: 500 }}>
          {t('print.sessionLabel', { label: template.label ?? index, name: '' }).replace('·', '').trim()}
        </p>
        <div style={{
          fontFamily: "'Bebas Neue', sans-serif",
          fontSize: 24, letterSpacing: 1, lineHeight: 1, color,
        }}>
          {template.name.toUpperCase()}
        </div>
        {template.emphasis && (
          <p style={{ fontSize: 12, color: '#666', marginTop: 4, fontStyle: 'italic' }}>
            {template.emphasis}
          </p>
        )}
      </div>

      {/* Lista de ejercicios */}
      <div style={{ padding: '2px 20px 6px' }}>
        {template.exercises.map((exConfig, i) => {
          const def = allExercises[exConfig.exerciseId];
          if (!def) return null;

          const { sets, reps, restText } = buildTarget(def, exConfig, t);
          const exName      = getExName(def);
          const tip         = getTip(def);
          const patternLabel = getPatternLabel(exConfig.pattern ?? def.pattern);
          const isLast      = i === template.exercises.length - 1;

          return (
            <div key={exConfig.exerciseId} style={{
              display: 'flex',
              gap: 12,
              padding: '13px 0',
              borderBottom: isLast ? 'none' : '1px solid #252525',
              alignItems: 'flex-start',
            }}>

              {/* Número */}
              <div style={{
                width: 22, flexShrink: 0,
                fontSize: 16, fontWeight: 600,
                color: '#666',
                lineHeight: 1.3,
                textAlign: 'right',
              }}>
                {i + 1}
              </div>

              {/* Contenido */}
              <div style={{ flex: 1, minWidth: 0 }}>

                {/* Nombre + chips */}
                <div style={{
                  display: 'flex', flexWrap: 'wrap',
                  alignItems: 'center', gap: 6,
                  marginBottom: 7,
                }}>
                  {exConfig.isKey && (
                    <KeyTag color={color} />
                  )}
                  <span style={{ fontSize: 14, fontWeight: 500, color: '#f0f0f0', lineHeight: 1.3 }}>
                    {exName}
                  </span>
                  {patternLabel && (
                    <span style={{
                      fontSize: 9, letterSpacing: 1.2, textTransform: 'uppercase',
                      padding: '2px 6px', borderRadius: 3,
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid #2e2e2e',
                      color: '#888',
                    }}>
                      {patternLabel}
                    </span>
                  )}
                </div>

                {/* Pastilla de volumen + descanso */}
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  background: '#1a1a1a',
                  border: '1px solid #2e2e2e',
                  borderRadius: 6,
                  padding: '5px 11px',
                  marginBottom: tip ? 8 : 0,
                }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: '#f0f0f0' }}>
                    {sets}
                  </span>
                  <span style={{ fontSize: 15, fontWeight: 400, color: '#888' }}>×</span>
                  <span style={{ fontSize: 12, color: '#ddd' }}>{reps}</span>
                  <span style={{ width: 1, height: 11, background: '#333', flexShrink: 0 }} />
                  <span style={{ fontSize: 11, color: '#888' }}>
                    {restText} {t('print.tableRest').toLowerCase()}
                  </span>
                </div>

                {/* Tip (traducido) */}
                {tip && (
                  <div style={{
                    fontSize: 11, color: '#666',
                    lineHeight: 1.5, fontStyle: 'italic',
                  }}>
                    {tip}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function MetaPill({ label, value }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 2,
      background: '#161616',
      border: '1px solid #222',
      borderRadius: 6,
      padding: '6px 12px',
    }}>
      <span style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: '#555' }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 500, color: '#f0f0f0' }}>{value}</span>
    </div>
  );
}

function KeyTag({ color }) {
  return (
    <span style={{
      fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase',
      padding: '2px 6px', borderRadius: 3,
      background: `${color}18`,
      border: `1px solid ${color}44`,
      color,
      fontWeight: 700,
    }}>
      KEY
    </span>
  );
}
