import { useStore } from '../../store/useStore';

// Mapeo de pattern → etiqueta y CSS var del color de día
const PATTERN_LABEL = {
  vertical_pull:   { label: 'TRACCIÓN',  dayVar: 'day3' },
  horizontal_pull: { label: 'TRACCIÓN',  dayVar: 'day3' },
  vertical_push:   { label: 'EMPUJE',    dayVar: 'day2' },
  horizontal_push: { label: 'EMPUJE',    dayVar: 'day2' },
  squat:           { label: 'PIERNA',    dayVar: 'day4' },
  hip_hinge:       { label: 'PIERNA',    dayVar: 'day4' },
  core:            { label: 'CORE',      dayVar: 'day5' },
  carry_grip:      { label: 'AGARRE',    dayVar: 'day5' },
  calf_raise:      { label: 'GEMELOS',   dayVar: 'day4' },
};

function getPatternTag(pattern) {
  return PATTERN_LABEL[pattern] ?? { label: 'ACCESORIO', dayVar: 'muted' };
}

export default function ProgramSummaryView() {
  const navigate             = useStore((s) => s.navigate);
  const programs             = useStore((s) => s.programs);
  const profile              = useStore((s) => s.profile);
  const getEffectiveTemplate = useStore((s) => s.getEffectiveTemplate);
  const exerciseLibrary      = useStore((s) => s.exerciseLibrary);

  const activeProgram = programs[profile.activeProgramId];

  if (!activeProgram) {
    navigate('home');
    return null;
  }

  // Altura de la barra de botones (padding top 12 + botón 46 + padding bottom 28 ≈ 86px)
  const BUTTONS_BAR_HEIGHT = 86;

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', maxWidth: 480, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ padding: '24px 20px 16px' }}>
        <div style={{ fontSize: 10, color: 'var(--muted)', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 8 }}>
          Tu programa está listo
        </div>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, letterSpacing: 1, color: 'var(--accent)' }}>
          {activeProgram.name}
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
          {activeProgram.days.length} días · Revisa el plan antes de empezar
        </div>
      </div>

      {/* Lista de días — scroll se detiene antes de los botones */}
      <div style={{
        padding: `0 20px ${BUTTONS_BAR_HEIGHT + 16}px`,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}>
        {activeProgram.days.map(({ sessionTemplateId }) => {
          const template = getEffectiveTemplate(sessionTemplateId);
          if (!template) return null;

          return (
            <div key={sessionTemplateId} style={{
              background: 'var(--surface)',
              border: 'var(--border-width) solid var(--border-card)',
              borderLeft: `3px solid ${template.color ?? 'var(--accent)'}`,
              borderRadius: 10,
              overflow: 'hidden',
            }}>
              {/* Header día */}
              <div style={{ padding: '12px 16px 10px' }}>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 15, letterSpacing: 1, color: template.color ?? 'var(--accent)' }}>
                  DÍA {template.label} · {template.name.toUpperCase()}
                </div>
              </div>

              {/* Ejercicios */}
              {template.exercises.map((ex) => {
                const def     = exerciseLibrary[ex.exerciseId];
                const isKey   = ex.isKey;
                const pattern = ex.pattern ?? def?.pattern;
                const tag     = getPatternTag(pattern);

                return (
                  <div key={ex.exerciseId} style={{
                    padding: '8px 16px',
                    borderTop: 'var(--border-width) solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 12,
                        fontWeight: isKey ? 500 : 400,
                        color: isKey ? 'var(--text)' : 'var(--muted)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}>
                        {def?.name ?? ex.exerciseId}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>
                        {ex.sets} series
                        {ex.minReps && ` · ${ex.minReps}–${ex.maxReps} reps`}
                        {` · ${ex.restSec}s`}
                      </div>
                    </div>

                    {/* Tags — KEY a la izquierda, patrón a la derecha */}
                    <div style={{ display: 'flex', gap: 5, flexShrink: 0, alignItems: 'center' }}>
                      {isKey && (
                        <span style={{
                          fontSize: 9, letterSpacing: 1,
                          background: 'var(--accent-tint-active)',
                          border: 'var(--border-width) solid var(--accent-tint-border)',
                          color: 'var(--accent)',
                          borderRadius: 4,
                          padding: '2px 6px',
                        }}>
                          KEY
                        </span>
                      )}
                      <span style={{
                        fontSize: 9, letterSpacing: 0.5,
                        background: `color-mix(in srgb, var(--${tag.dayVar}) 18%, transparent)`,
                        border: `var(--border-width) solid color-mix(in srgb, var(--${tag.dayVar}) 45%, transparent)`,
                        color: `var(--${tag.dayVar})`,
                        borderRadius: 4,
                        padding: '2px 6px',
                      }}>
                        {tag.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Botones — fijos en la parte inferior, nunca tapan el scroll */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        width: '100%',
        maxWidth: 480,
        padding: '12px 20px 28px',
        borderTop: 'var(--border-width) solid var(--border)',
        background: 'var(--bg)',
        display: 'flex',
        gap: 10,
        boxSizing: 'border-box',
      }}>
        <button
          onClick={() => navigate('programEditor')}
          style={{
            flex: 1,
            background: 'var(--surface2)',
            border: 'var(--border-width) solid var(--border)',
            borderRadius: 10,
            color: 'var(--text)',
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 13,
            padding: '13px 8px',
            cursor: 'pointer',
          }}
        >
          ✎ Personalizar
        </button>
        <button
          onClick={() => navigate('home')}
          style={{
            flex: 2,
            background: 'var(--accent)',
            border: 'none',
            borderRadius: 10,
            color: '#0d0d0d',
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: 20,
            letterSpacing: 1.5,
            padding: '13px 8px',
            cursor: 'pointer',
          }}
        >
          EMPEZAR
        </button>
      </div>
    </div>
  );
}
