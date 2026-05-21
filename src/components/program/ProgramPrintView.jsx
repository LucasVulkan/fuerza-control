import { useTranslation } from 'react-i18next';
import { useStore } from '../../store/useStore';

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

const DAY_COLORS = ['#e8ff47', '#ff6b35', '#7eb8ff'];

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

  const locale = i18n.language === 'en' ? 'en-US' : 'es-ES';

  function handleBack() {
    useStore.setState((s) => ({ ui: { ...s.ui, _viewingProgramId: null } }));
    navigate(fromClients ? 'home' : 'home');
    if (fromClients) {
      useStore.setState((s) => ({ ui: { ...s.ui, homeTab: 'clients', _viewingProgramId: null } }));
    }
  }
  if (!activeProgram) return null;

  const days = activeProgram.days
    .map(({ sessionTemplateId }, i) => ({
      template: getEffectiveTemplate(sessionTemplateId),
      color: DAY_COLORS[i] ?? '#e8ff47',
      index: i + 1,
    }))
    .filter((d) => d.template);

  const totalSets = days.reduce((acc, { template }) =>
    acc + template.exercises.reduce((a, ex) => a + (ex.sets ?? 3), 0), 0
  );

  function getExName(def) {
    return i18n.language === 'en' ? (def.nameEn ?? def.name) : def.name;
  }

  function getPatternLabel(pattern) {
    return t(`exerciseSelector.patterns.${pattern}`, pattern);
  }

  return (
    <>
      <style>{`
        @media print {
          body { background: #0d0d0d !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
          .print-page { padding: 0 !important; }
          a { text-decoration: none; }
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

        {/* Toolbar */}
        <div className="no-print" style={{
          position: 'sticky', top: 0, zIndex: 50,
          background: '#161616',
          borderBottom: '1px solid #2a2a2a',
          padding: '10px 20px',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <button
            onClick={() => handleBack()}
            style={{ background: 'none', border: 'none', color: '#888', fontSize: 22, cursor: 'pointer', padding: '0 8px 0 0' }}
          >
            ‹
          </button>
          <span style={{ flex: 1, fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 1, color: '#f0f0f0' }}>
            {t('print.viewerTitle')}
          </span>
          <button
            onClick={() => window.print()}
            style={{
              background: '#e8ff47', border: 'none', borderRadius: 8,
              color: '#0d0d0d', fontFamily: "'Bebas Neue', sans-serif",
              fontSize: 16, letterSpacing: 1, padding: '8px 20px', cursor: 'pointer',
            }}
          >
            {t('print.exportPdf')}
          </button>
        </div>

        {/* Header */}
        <header style={{
          padding: '48px 40px 36px',
          borderBottom: '1px solid #2a2a2a',
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', top: -60, right: -80,
            width: 400, height: 400,
            background: 'radial-gradient(circle, rgba(232,255,71,0.06) 0%, transparent 70%)',
            pointerEvents: 'none',
          }} />

          <p style={{ fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', color: '#888', marginBottom: 14 }}>
            {t('print.trainingProgram')}
          </p>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(48px, 8vw, 88px)', lineHeight: 0.9, letterSpacing: 2, color: '#f0f0f0' }}>
            FUERZA<br /><span style={{ color: '#e8ff47' }}>& CONTROL</span>
          </div>
          {activeProgram.description && (
            <p style={{ fontSize: 14, color: '#888', marginTop: 18, maxWidth: 520, lineHeight: 1.6 }}>
              {activeProgram.description}
            </p>
          )}

          <div style={{ display: 'flex', gap: 32, marginTop: 28, flexWrap: 'wrap' }}>
            <MetaItem label={t('print.metaDays')} value={t('print.metaDaysValue', { count: activeProgram.days.length })} />
            <MetaItem label={t('print.metaStructure')} value={activeProgram.structure ?? '—'} />
            <MetaItem label={t('print.metaTotalSets')} value={t('print.metaSetsValue', { count: totalSets })} />
          </div>
        </header>

        {/* Leyenda */}
        <div style={{
          background: '#161616', borderBottom: '1px solid #2a2a2a',
          padding: '16px 40px', display: 'flex', gap: 24, flexWrap: 'wrap',
        }}>
          {[
            t('print.legendKey'),
            t('print.legendRest'),
            t('print.legendWarmup'),
          ].map((text) => (
            <span key={text} style={{ fontSize: 12, color: '#888', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: '#e8ff47', fontWeight: 700 }}>—</span> {text}
            </span>
          ))}
        </div>

        {/* Días */}
        <main style={{ padding: '0 40px 60px', maxWidth: 1100 }}>
          {days.map(({ template, color, index }) => (
            <section key={template.id} style={{ marginTop: 52 }}>

              {/* Header día */}
              <div style={{
                display: 'flex', alignItems: 'baseline', gap: 20,
                marginBottom: 24, paddingBottom: 14,
                borderBottom: '1px solid #2a2a2a',
              }}>
                <div style={{
                  fontFamily: "'Bebas Neue', sans-serif",
                  fontSize: 72, lineHeight: 1,
                  color, opacity: 0.12,
                }}>
                  0{index}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: '#888', marginBottom: 4 }}>
                    {t('print.sessionLabel', { label: template.label, name: template.name })}
                  </p>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, letterSpacing: 1, lineHeight: 1, color }}>
                    {template.name.toUpperCase()}
                  </div>
                  {template.emphasis && (
                    <p style={{ fontSize: 13, color: '#888', marginTop: 6, fontStyle: 'italic' }}>
                      {template.emphasis}
                    </p>
                  )}
                </div>
              </div>

              {/* Tabla de ejercicios */}
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #2a2a2a' }}>
                    {[t('print.tableNum'), t('print.tableExercise'), t('print.tableSetsReps'), t('print.tableRest')].map((h) => (
                      <th key={h} style={{
                        textAlign: 'left', fontSize: 9, letterSpacing: 2.5,
                        textTransform: 'uppercase', color: '#888',
                        padding: '10px 16px 10px 0', fontWeight: 400,
                      }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {template.exercises.map((exConfig, i) => {
                    const def = allExercises[exConfig.exerciseId];
                    if (!def) return null;
                    const { sets, reps, restText } = buildTarget(def, exConfig, t);
                    const patternLabel = getPatternLabel(exConfig.pattern ?? def.pattern);

                    return (
                      <tr key={exConfig.exerciseId} style={{ borderBottom: '1px solid #1a1a1a' }}>
                        <td style={{
                          fontFamily: "'Bebas Neue', sans-serif",
                          fontSize: 18, color: '#888', opacity: 0.4,
                          width: 32, padding: '14px 16px 14px 0', verticalAlign: 'middle',
                        }}>
                          {i + 1}
                        </td>

                        <td style={{ padding: '14px 16px 14px 0', verticalAlign: 'middle' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            {exConfig.isKey && (
                              <Tag label="KEY" bg="rgba(232,255,71,0.1)" border="rgba(232,255,71,0.3)" color="#e8ff47" />
                            )}
                            <span style={{ fontSize: 15, fontWeight: 500, color: '#f0f0f0' }}>
                              {getExName(def)}
                            </span>
                            {patternLabel && (
                              <Tag label={patternLabel.toUpperCase()} bg="rgba(255,255,255,0.04)" border="#2a2a2a" color="#888" />
                            )}
                          </div>
                          {def.tips?.[0] && (
                            <div style={{ fontSize: 11, color: '#666', marginTop: 4, lineHeight: 1.5, maxWidth: 480 }}>
                              {def.tips[0]}
                            </div>
                          )}
                        </td>

                        <td style={{ padding: '14px 16px 14px 0', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                          <strong style={{ fontSize: 14, color: '#f0f0f0' }}>{sets}</strong>
                          <span style={{ fontSize: 13, color: '#888' }}> × {reps}</span>
                        </td>

                        <td style={{ padding: '14px 0', verticalAlign: 'middle', fontSize: 13, color: '#888', whiteSpace: 'nowrap' }}>
                          {restText}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>
          ))}
        </main>

        {/* Footer */}
        <footer style={{
          borderTop: '1px solid #2a2a2a',
          padding: '20px 40px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          fontSize: 11, color: '#555', letterSpacing: 1,
        }}>
          <span>FUERZA & CONTROL</span>
          <span>{new Date().toLocaleDateString(locale, { year: 'numeric', month: 'long' })}</span>
        </footer>

      </div>
    </>
  );
}

function MetaItem({ label, value }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: '#888' }}>{label}</span>
      <span style={{ fontSize: 16, fontWeight: 500, color: '#f0f0f0' }}>{value}</span>
    </div>
  );
}

function Tag({ label, bg, border, color }) {
  return (
    <span style={{
      fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase',
      padding: '2px 7px', borderRadius: 2,
      background: bg, border: `1px solid ${border}`, color,
    }}>
      {label}
    </span>
  );
}
