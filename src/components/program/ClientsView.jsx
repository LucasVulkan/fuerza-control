// PRO FEATURE — Vista de gestión de clientes/programas managed

import { useState } from 'react';
import { useStore, selectManagedPrograms } from '../../store/useStore';
import ImportModal from '../ui/ImportModal';

export default function ClientsView() {
  const navigate           = useStore((s) => s.navigate);
  const managed            = useStore(selectManagedPrograms);
  const createEmptyProgram = useStore((s) => s.createEmptyProgram);
  const deleteProgram      = useStore((s) => s.deleteProgram);
  const exportProgramOnly  = useStore((s) => s.exportProgramOnly);
  const importData         = useStore((s) => s.importData);
  const workoutLog         = useStore((s) => s.workoutLog);
  const profile            = useStore((s) => s.profile);
  const setProfile         = useStore((s) => s.setProfile);
  const programs           = useStore((s) => s.programs);

  const [importFile, setImportFile] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSessions, setNewSessions] = useState(3);

  function getLastActivity(program) {
    const templateIds = new Set(program.days.map((d) => d.sessionTemplateId));
    const sessions = workoutLog.filter((e) => templateIds.has(e.sessionTemplateId));
    if (!sessions.length) return null;
    return Math.max(...sessions.map((e) => e.timestamp));
  }

  function getSessionCount(program) {
    const templateIds = new Set(program.days.map((d) => d.sessionTemplateId));
    return workoutLog.filter((e) => templateIds.has(e.sessionTemplateId)).length;
  }

  function handleCreate() {
    if (!newName.trim()) return;
    createEmptyProgram(newSessions, newName.trim(), 'managed');
    setShowNew(false);
    setNewName('');
  }

  async function handleImport(file, mode) {
    setImportFile(null);
    await importData(file, mode === 'replace' ? 'add_program' : mode);
  }

  function handleEditProgram(programId) {
    // Temporalmente set activeProgramId para el editor, luego restaurar
    setProfile({ _editingProgramId: programId });
    navigate('programEditor');
  }

  function handleExport(program) {
    // Exportar solo este programa
    const state = { profile: { activeProgramId: program.id }, programs, sessionTemplates: {}, userPrograms: {}, customExercises: {} };
    // Reutilizar exportProgramOnly pero pasando el ID correcto
    exportProgramOnly();
  }

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', maxWidth: 480, margin: '0 auto' }}>

      {/* Header */}
      <div
        onClick={() => navigate('home')}
        style={{
          padding: '14px 20px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          cursor: 'pointer', userSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ color: 'var(--muted)', fontSize: 22 }}>‹</span>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, letterSpacing: 1 }}>CLIENTES</div>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); setShowNew(true); }}
          style={{
            background: 'var(--accent)', border: 'none', borderRadius: 6,
            color: '#0d0d0d', fontFamily: "'Bebas Neue', sans-serif",
            fontSize: 14, letterSpacing: 1, padding: '6px 14px', cursor: 'pointer',
          }}
        >
          ＋ NUEVO
        </button>
      </div>

      {/* Input de archivo oculto */}
      <input
        type="file" accept=".json" style={{ display: 'none' }}
        id="clients-file-input"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) { setImportFile(file); e.target.value = ''; }
        }}
      />

      <div style={{ padding: '14px 20px 40px', display: 'flex', flexDirection: 'column', gap: 10 }}>

        {/* Botón importar */}
        <button
          onClick={() => document.getElementById('clients-file-input')?.click()}
          style={{
            background: 'transparent', border: '1px dashed rgba(232,255,71,0.25)',
            borderRadius: 10, padding: '12px 16px', cursor: 'pointer',
            color: 'var(--accent)', fontFamily: "'DM Sans', sans-serif",
            fontSize: 12, textAlign: 'center',
          }}
        >
          ↓ Importar historial de cliente
        </button>

        {managed.length === 0 && !showNew ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--muted)', fontSize: 13, lineHeight: 1.8 }}>
            <span style={{ display: 'block', fontSize: 32, marginBottom: 12 }}>👥</span>
            Sin programas de clientes todavía.<br />
            Crea uno nuevo o importa un programa.
          </div>
        ) : (
          managed.map((program) => {
            const lastActivity = getLastActivity(program);
            const sessions = getSessionCount(program);
            return (
              <div key={program.id} style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 10, overflow: 'hidden',
              }}>
                <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>{program.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>
                    {sessions} sesiones
                    {lastActivity ? ` · Última: ${new Date(lastActivity).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}` : ' · Sin sesiones'}
                  </div>
                </div>
                <div style={{ display: 'flex', borderTop: '1px solid var(--border)' }}>
                  <ActionBtn label="Editar" onClick={() => handleEditProgram(program.id)} />
                  <div style={{ width: 1, background: 'var(--border)' }} />
                  <ActionBtn label="Exportar" onClick={() => handleExport(program)} />
                  <div style={{ width: 1, background: 'var(--border)' }} />
                  <ActionBtn label="Eliminar" onClick={() => { if (window.confirm('¿Eliminar este programa?')) deleteProgram(program.id, false); }} danger />
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal nuevo programa */}
      {showNew && (
        <>
          <div onClick={() => setShowNew(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 49 }} />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-card)', zIndex: 50,
            width: 'calc(100% - 40px)', maxWidth: 380, padding: '20px',
          }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, letterSpacing: 1, marginBottom: 16 }}>
              NUEVO PROGRAMA
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <div style={{ fontSize: 10, color: 'var(--muted)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>Nombre del cliente</div>
                <input
                  autoFocus
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                  placeholder="Ej: Lucas - Full Body"
                  style={{
                    width: '100%', background: 'var(--surface2)',
                    border: '1px solid var(--border)', borderRadius: 8,
                    color: 'var(--text)', fontFamily: "'DM Sans', sans-serif",
                    fontSize: 14, padding: '10px 14px', outline: 'none', boxSizing: 'border-box',
                  }}
                  onFocus={(e) => e.target.style.borderColor = 'var(--accent)'}
                  onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
                />
              </div>
              <div>
                <div style={{ fontSize: 10, color: 'var(--muted)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>Sesiones</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[2, 3, 4, 5, 6].map((n) => (
                    <button
                      key={n}
                      onClick={() => setNewSessions(n)}
                      style={{
                        flex: 1, height: 44, borderRadius: 6, border: '1px solid',
                        borderColor: newSessions === n ? 'var(--accent)' : 'var(--border)',
                        background: newSessions === n ? 'rgba(232,255,71,0.08)' : 'var(--surface2)',
                        color: newSessions === n ? 'var(--accent)' : 'var(--text)',
                        fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, cursor: 'pointer',
                      }}
                    >{n}</button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button
                  onClick={() => setShowNew(false)}
                  style={{
                    flex: 1, background: 'none', border: '1px solid var(--border)',
                    borderRadius: 8, color: 'var(--muted)', fontFamily: "'DM Sans', sans-serif",
                    fontSize: 13, padding: '12px', cursor: 'pointer',
                  }}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCreate}
                  disabled={!newName.trim()}
                  style={{
                    flex: 2, background: newName.trim() ? 'var(--accent)' : 'var(--surface2)',
                    border: 'none', borderRadius: 8,
                    color: newName.trim() ? '#0d0d0d' : 'var(--muted)',
                    fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 1,
                    padding: '12px', cursor: newName.trim() ? 'pointer' : 'not-allowed',
                  }}
                >
                  CREAR Y EDITAR
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {importFile && (
        <ImportModal file={importFile} onImport={handleImport} onClose={() => setImportFile(null)} />
      )}
    </div>
  );
}

function ActionBtn({ label, onClick, danger }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, background: 'none', border: 'none',
        color: danger ? 'var(--red)' : 'var(--muted)',
        fontFamily: "'DM Sans', sans-serif", fontSize: 12,
        padding: '10px', cursor: 'pointer', transition: 'background 0.15s',
      }}
      onPointerDown={(e) => e.currentTarget.style.background = 'var(--surface2)'}
      onPointerUp={(e) => e.currentTarget.style.background = 'none'}
      onPointerLeave={(e) => e.currentTarget.style.background = 'none'}
    >
      {label}
    </button>
  );
}
