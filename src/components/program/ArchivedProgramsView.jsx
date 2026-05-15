import { useState, useMemo } from 'react';
import { useStore } from '../../store/useStore';

export default function ArchivedProgramsView() {
  const navigate         = useStore((s) => s.navigate);
  const programs         = useStore((s) => s.programs);
  const restoreProgram   = useStore((s) => s.restoreProgram);
  const deleteProgram    = useStore((s) => s.deleteProgram);
  const exportFullBackup = useStore((s) => s.exportFullBackup);
  const workoutLog       = useStore((s) => s.workoutLog);

  // useMemo evita el infinite loop — filter/sort crean nueva referencia cada render
  const archived = useMemo(
    () => Object.values(programs ?? {})
      .filter((p) => p.status === 'archived')
      .sort((a, b) => (b.archivedAt ?? '').localeCompare(a.archivedAt ?? '')),
    [programs]
  );

  const [deleteModal, setDeleteModal] = useState(null);

  function getSessionCount(program) {
    const templateIds = new Set(program.days.map((d) => d.sessionTemplateId));
    return workoutLog.filter((e) => templateIds.has(e.sessionTemplateId)).length;
  }

  function handleDelete(programId, withHistory) {
    deleteProgram(programId, withHistory);
    setDeleteModal(null);
  }

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', maxWidth: 480, margin: '0 auto' }}>
      {/* Header */}
      <div
        onClick={() => navigate('home')}
        style={{
          padding: '14px 20px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 12,
          cursor: 'pointer', userSelect: 'none',
        }}
      >
        <span style={{ color: 'var(--muted)', fontSize: 22 }}>‹</span>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, letterSpacing: 1 }}>
          PROGRAMAS ARCHIVADOS
        </div>
      </div>

      <div style={{ padding: '14px 20px 40px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {archived.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--muted)', fontSize: 13, lineHeight: 1.8 }}>
            <span style={{ display: 'block', fontSize: 32, marginBottom: 12 }}>🗂</span>
            No hay programas archivados.
          </div>
        ) : (
          archived.map((program) => {
            const sessions = getSessionCount(program);
            return (
              <div key={program.id} style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 10, overflow: 'hidden',
              }}>
                {/* Info */}
                <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>{program.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>
                    Archivado: {program.archivedAt ?? '—'} · {sessions} sesiones registradas
                  </div>
                </div>

                {/* Acciones */}
                <div style={{ display: 'flex', borderTop: '1px solid var(--border)' }}>
                  <ActionBtn label="Exportar" onClick={() => exportFullBackup()} />
                  <div style={{ width: 1, background: 'var(--border)' }} />
                  <ActionBtn label="Eliminar" onClick={() => setDeleteModal(program.id)} danger />
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal de eliminación */}
      {deleteModal && (
        <>
          <div onClick={() => setDeleteModal(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 49 }} />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-card)', zIndex: 50,
            width: 'calc(100% - 40px)', maxWidth: 380, padding: '20px',
          }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, letterSpacing: 1, marginBottom: 6 }}>
              ELIMINAR PROGRAMA
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16, lineHeight: 1.6 }}>
              Esta acción es permanente e irreversible.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <DeleteOption
                label="Eliminar programa"
                desc="El historial de sesiones se conserva."
                onClick={() => handleDelete(deleteModal, false)}
              />
              <DeleteOption
                label="Eliminar programa e historial"
                desc="Se elimina también el historial. No hay vuelta atrás."
                onClick={() => handleDelete(deleteModal, true)}
                danger
              />
              <button
                onClick={() => setDeleteModal(null)}
                style={{
                  background: 'none', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-btn)', color: 'var(--muted)',
                  fontFamily: 'var(--font-body)', fontSize: 12,
                  padding: '10px', cursor: 'pointer', marginTop: 4,
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </>
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
        padding: '10px', cursor: 'pointer',
        transition: 'background 0.15s',
      }}
      onPointerDown={(e) => e.currentTarget.style.background = 'var(--surface2)'}
      onPointerUp={(e) => e.currentTarget.style.background = 'none'}
      onPointerLeave={(e) => e.currentTarget.style.background = 'none'}
    >
      {label}
    </button>
  );
}

function DeleteOption({ label, desc, onClick, danger }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'var(--surface2)', border: '1px solid',
        borderColor: danger ? 'rgba(248,113,113,0.3)' : 'var(--border)',
        borderRadius: 'var(--radius-btn)', padding: '12px 14px',
        cursor: 'pointer', textAlign: 'left', width: '100%',
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 500, color: danger ? 'var(--red)' : 'var(--text)', fontFamily: 'var(--font-body)' }}>{label}</div>
      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>{desc}</div>
    </button>
  );
}
