import { useEffect, useState } from 'react';
import { useStore } from '../../store/useStore';
import DayEditor from './DayEditor';

export default function ProgramEditorView() {
  const navigate            = useStore((s) => s.navigate);
  const programs            = useStore((s) => s.programs);
  const profile             = useStore((s) => s.profile);
  const ui                  = useStore((s) => s.ui);
  const beginEditSession    = useStore((s) => s.beginEditSession);
  const cancelEditSession   = useStore((s) => s.cancelEditSession);
  const confirmEditSession  = useStore((s) => s.confirmEditSession);
  const addSessionToProgram = useStore((s) => s.addSessionToProgram);
  const renameProgram       = useStore((s) => s.renameProgram);

  // Si _editingProgramId está seteado, venimos del área de clientes
  const editingId    = ui._editingProgramId ?? profile.activeProgramId;
  const activeProgram = programs[editingId];
  const isFromClients = !!ui._editingProgramId;
  const backDest     = 'home';
  const backTab      = isFromClients ? 'clients' : 'session';

  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(activeProgram?.name ?? '');

  useEffect(() => {
    beginEditSession();
  }, []);

  function handleNameBlur() {
    const trimmed = nameValue.trim();
    if (trimmed && trimmed !== activeProgram?.name) {
      renameProgram(editingId, trimmed);
    } else {
      setNameValue(activeProgram?.name ?? '');
    }
    setEditingName(false);
  }

  function handleNameKey(e) {
    if (e.key === 'Enter') e.target.blur();
    if (e.key === 'Escape') { setNameValue(activeProgram?.name ?? ''); setEditingName(false); }
  }

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', maxWidth: 480, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ padding: '20px 20px 14px', borderBottom: 'var(--border-width) solid var(--border)' }}>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, letterSpacing: 1, color: 'var(--text)' }}>
          {isFromClients ? 'EDITAR PROGRAMA DE CLIENTE' : 'EDITAR PROGRAMA'}
        </div>
        {activeProgram && (
          <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
            {editingName ? (
              <input
                autoFocus
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
                onBlur={handleNameBlur}
                onKeyDown={handleNameKey}
                style={{
                  flex: 1, background: 'var(--surface2)',
                  border: '1px solid var(--accent)', borderRadius: 6,
                  color: 'var(--text)', fontFamily: "'DM Sans', sans-serif",
                  fontSize: 13, fontWeight: 500, padding: '5px 10px', outline: 'none',
                }}
              />
            ) : (
              <button
                onClick={() => { setNameValue(activeProgram.name); setEditingName(true); }}
                style={{
                  background: 'none', border: 'none', padding: 0,
                  color: 'var(--text)', fontFamily: "'DM Sans', sans-serif",
                  fontSize: 13, fontWeight: 500, cursor: 'text',
                  display: 'flex', alignItems: 'center', gap: 6, textAlign: 'left',
                }}
              >
                {activeProgram.name}
                <span style={{ fontSize: 10, color: 'var(--muted)' }}>✎</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Contenido scrollable */}
      <div style={{ padding: '14px 20px 102px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <p style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 4 }}>
          Los cambios se aplican a todas las sesiones futuras. Puedes restaurar cualquier día a sus valores originales.
        </p>

        {activeProgram?.days.map(({ sessionTemplateId }) => (
          <DayEditor key={sessionTemplateId} templateId={sessionTemplateId} />
        ))}

        <button
          onClick={() => addSessionToProgram(editingId)}
          style={{
            width: '100%', background: 'var(--accent-tint)',
            border: '1px dashed var(--accent-tint-border)', borderRadius: 10,
            color: 'var(--accent)', fontFamily: "'DM Sans', sans-serif",
            fontSize: 13, padding: '14px 0', cursor: 'pointer', marginTop: 4,
          }}
        >
          ＋ Añadir sesión
        </button>
      </div>

      {/* Botones fijos abajo */}
      <div style={{
        position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: 480, padding: '12px 20px 28px',
        borderTop: 'var(--border-width) solid var(--border)', background: 'var(--bg)',
        display: 'flex', gap: 10, boxSizing: 'border-box',
      }}>
        <button
          onClick={() => cancelEditSession(backDest, backTab)}
          style={{
            flex: 1, background: 'var(--surface2)',
            border: 'var(--border-width) solid var(--border-card)', borderRadius: 10,
            color: 'var(--text)', fontFamily: "'DM Sans', sans-serif",
            fontSize: 13, padding: '13px 8px', cursor: 'pointer',
          }}
        >
          Cancelar
        </button>
        <button
          onClick={() => confirmEditSession(backDest, backTab)}
          style={{
            flex: 2, background: 'var(--accent)', border: 'none', borderRadius: 10,
            color: 'var(--on-accent)', fontFamily: "'Bebas Neue', sans-serif",
            fontSize: 20, letterSpacing: 1.5, padding: '13px 8px', cursor: 'pointer',
          }}
        >
          GUARDAR CAMBIOS
        </button>
      </div>
    </div>
  );
}

