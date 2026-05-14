import { useEffect } from 'react';
import { useStore } from '../../store/useStore';
import DayEditor from './DayEditor';

export default function ProgramEditorView() {
  const navigate           = useStore((s) => s.navigate);
  const programs           = useStore((s) => s.programs);
  const profile            = useStore((s) => s.profile);
  const beginEditSession   = useStore((s) => s.beginEditSession);
  const cancelEditSession  = useStore((s) => s.cancelEditSession);
  const confirmEditSession = useStore((s) => s.confirmEditSession);

  const activeProgram = programs[profile.activeProgramId];

  // Al montar el editor, guardar snapshot para poder revertir
  useEffect(() => {
    beginEditSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', maxWidth: 480, margin: '0 auto' }}>

      {/* Header — solo título */}
      <div style={{
        padding: '20px 20px 14px',
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, letterSpacing: 1, color: 'var(--text)' }}>
          EDITAR PROGRAMA
        </div>
        {activeProgram && (
          <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 1 }}>
            {activeProgram.name}
          </div>
        )}
      </div>

      {/* Contenido scrollable */}
      <div style={{
        padding: '14px 20px 102px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}>
        <p style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 4 }}>
          Los cambios se aplican a todas las sesiones futuras. Puedes restaurar cualquier día a sus valores originales en cualquier momento.
        </p>

        {activeProgram?.days.map(({ sessionTemplateId }) => (
          <DayEditor
            key={sessionTemplateId}
            templateId={sessionTemplateId}
          />
        ))}
      </div>

      {/* Botones — fuera del scroll, anclados al fondo */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        width: '100%',
        maxWidth: 480,
        padding: '12px 20px 28px',
        borderTop: '1px solid var(--border)',
        background: 'var(--bg)',
        display: 'flex',
        gap: 10,
        boxSizing: 'border-box',
      }}>
        {/* Cancelar — revierte todos los cambios */}
        <button
          onClick={() => cancelEditSession('home')}
          style={{
            flex: 1,
            background: 'transparent',
            border: '1.5px solid rgba(255,255,255,0.35)',
            borderRadius: 10,
            color: '#ffffff',
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 13,
            padding: '13px 8px',
            cursor: 'pointer',
          }}
        >
          Cancelar
        </button>

        {/* Guardar cambios — confirma y va a home */}
        <button
          onClick={() => confirmEditSession('home')}
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
          GUARDAR CAMBIOS
        </button>
      </div>
    </div>
  );
}
