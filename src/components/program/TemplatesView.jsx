// PRO FEATURE — Plantillas de programas reutilizables

import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '../../store/useStore';

export default function TemplatesView() {
  const programs                = useStore((s) => s.programs);
  const sessionTemplates        = useStore((s) => s.sessionTemplates);
  const userPrograms            = useStore((s) => s.userPrograms);
  const clients                 = useStore((s) => s.clients);
  const createEmptyProgram      = useStore((s) => s.createEmptyProgram);
  const cloneProgramFromTemplate = useStore((s) => s.cloneProgramFromTemplate);
  const deleteProgram           = useStore((s) => s.deleteProgram);
  const setEditingProgram       = useStore((s) => s.setEditingProgram);
  const setPrintingProgram      = useStore((s) => s.setPrintingProgram);
  const showToast               = useStore((s) => s.showToast);
  const exportSpecificProgram   = useStore((s) => s.exportSpecificProgram);

  // Derivar en useMemo para no crear array nuevo en cada render (evita bucle infinito)
  const templatePrograms = useMemo(
    () => Object.values(programs ?? {})
      .filter((p) => p.mode === 'template')
      .sort((a, b) => a.name.localeCompare(b.name)),
    [programs]
  );

  const [showNew, setShowNew]         = useState(false);
  const [newName, setNewName]         = useState('');
  const [newSessions, setNewSessions] = useState(3);
  const [contextMenu, setContextMenu] = useState(null); // { programId, x, y }
  const [assignModal, setAssignModal] = useState(null); // { programId }
  const [assignClientId, setAssignClientId] = useState('');
  const [assignName, setAssignName]   = useState('');

  const clientList = useMemo(
    () => Object.values(clients ?? {}).sort((a, b) => a.name.localeCompare(b.name)),
    [clients]
  );

  function getExerciseCount(program) {
    return program.days.reduce((total, { sessionTemplateId }) => {
      const tpl = userPrograms[sessionTemplateId] ?? sessionTemplates[sessionTemplateId];
      return total + (tpl?.exercises?.length ?? 0);
    }, 0);
  }

  function handleCreate() {
    if (!newName.trim()) return;
    createEmptyProgram(newSessions, newName.trim(), 'template');
    setNewName('');
    setShowNew(false);
  }

  function handleDelete(programId) {
    if (window.confirm('¿Eliminar esta plantilla?')) {
      deleteProgram(programId, false);
      setContextMenu(null);
    }
  }

  function handleDuplicate(programId) {
    const src = programs[programId];
    if (!src) return;
    cloneProgramFromTemplate(programId, { mode: 'template', name: src.name + ' (copia)' });
    showToast('✓ Plantilla duplicada');
    setContextMenu(null);
  }

  function openAssign(programId) {
    const src = programs[programId];
    setAssignModal({ programId });
    setAssignName(src?.name ?? '');
    setAssignClientId(clientList[0]?.id ?? '');
    setContextMenu(null);
  }

  function handleAssign() {
    if (!assignModal || !assignClientId) return;
    const srcName = programs[assignModal.programId]?.name ?? 'Programa';
    cloneProgramFromTemplate(assignModal.programId, {
      mode: 'managed',
      clientId: assignClientId,
      name: assignName.trim() || srcName,
    });
    setAssignModal(null);
    setAssignName('');
    setAssignClientId('');
  }

  return (
    <div>
      {/* Header */}
      <div style={{ padding: '16px 20px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <p style={{ fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--muted)' }}>Plantillas</p>
        <button
          onClick={() => setShowNew(true)}
          style={{ background: 'var(--accent)', border: 'none', borderRadius: 6, color: '#0d0d0d', fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, letterSpacing: 1, padding: '8px 18px', cursor: 'pointer' }}
        >＋ NUEVA</button>
      </div>

      {/* Lista */}
      <div style={{ padding: '4px 20px 80px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {templatePrograms.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--muted)', fontSize: 13, lineHeight: 1.8 }}>
            <span style={{ display: 'block', fontSize: 32, marginBottom: 12 }}>📐</span>
            Sin plantillas todavía.<br />
            Crea plantillas para asignarlas<br />rápidamente a tus clientes.
          </div>
        ) : templatePrograms.map((program) => {
          const exCount = getExerciseCount(program);
          return (
            <div key={program.id} style={{ background: 'var(--surface)', border: 'var(--border-width) solid var(--border-card)', borderRadius: 10, overflow: 'hidden' }}>
              {/* Info */}
              <div style={{ padding: '13px 16px', borderBottom: 'var(--border-width) solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{program.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                    {program.days.length} sesión{program.days.length !== 1 ? 'es' : ''}
                    {exCount > 0 && ` · ${exCount} ejercicio${exCount !== 1 ? 's' : ''}`}
                  </div>
                </div>
                {/* Badge PRO */}
                <span style={{ fontSize: 9, letterSpacing: 1, background: 'var(--accent-tint)', color: 'var(--accent)', border: '1px solid var(--accent-tint-border)', borderRadius: 4, padding: '2px 6px', flexShrink: 0 }}>
                  PLANTILLA
                </span>
              </div>
              {/* Acciones */}
              <div style={{ display: 'flex' }}>
                <TplBtn label="Ver" onClick={() => setPrintingProgram(program.id)} />
                <TplDivider />
                <TplBtn label="Editar" onClick={() => setEditingProgram(program.id)} />
                <TplDivider />
                <TplBtn label="⋯" onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setContextMenu({ programId: program.id, x: rect.right, y: rect.top });
                }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Menú contextual */}
      {contextMenu && createPortal(
        <>
          <div onClick={() => setContextMenu(null)} style={{ position: 'fixed', inset: 0, zIndex: 49 }} />
          <div style={{
            position: 'fixed', top: contextMenu.y, left: contextMenu.x,
            transform: 'translate(-100%, -100%)',
            background: 'var(--surface2)', border: 'var(--border-width) solid var(--border-card)',
            borderRadius: 8, zIndex: 50, overflow: 'hidden', minWidth: 170,
            boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
          }}>
            <button onClick={() => openAssign(contextMenu.programId)} style={menuItemStyle}>
              👥 Usar con cliente
            </button>
            <button onClick={() => handleDuplicate(contextMenu.programId)} style={menuItemStyle}>
              ⧉ Duplicar
            </button>
            <button onClick={() => { exportSpecificProgram(contextMenu.programId); setContextMenu(null); }} style={menuItemStyle}>
              ↑ Exportar archivo
            </button>
            <button
              onClick={() => handleDelete(contextMenu.programId)}
              style={{ ...menuItemStyle, color: 'var(--red)', borderBottom: 'none' }}
            >
              ✕ Eliminar
            </button>
          </div>
        </>,
        document.body
      )}

      {/* Modal: Nueva plantilla */}
      {showNew && (
        <>
          <div onClick={() => setShowNew(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 49 }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'var(--surface)', border: 'var(--border-width) solid var(--border-card)', borderRadius: 10, zIndex: 50, width: 'calc(100% - 40px)', maxWidth: 360, padding: '20px' }}>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 1, marginBottom: 14 }}>NUEVA PLANTILLA</div>
            <input
              autoFocus type="text" placeholder="Nombre de la plantilla"
              value={newName} onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              style={inputStyle}
              onFocus={(e) => e.target.style.borderColor = 'var(--accent)'}
              onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
            />
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 10, color: 'var(--muted)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>Sesiones</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {[2, 3, 4, 5, 6].map((n) => (
                  <button key={n} onClick={() => setNewSessions(n)} style={{ flex: 1, height: 40, borderRadius: 6, border: 'var(--border-width) solid', borderColor: newSessions === n ? 'var(--accent-tint-border)' : 'var(--border)', background: newSessions === n ? 'var(--accent-tint-active)' : 'var(--surface2)', color: newSessions === n ? 'var(--accent)' : 'var(--text)', fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, cursor: 'pointer' }}>{n}</button>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button onClick={() => setShowNew(false)} style={{ flex: 1, background: 'none', border: 'var(--border-width) solid var(--border-card)', borderRadius: 8, color: 'var(--muted)', fontFamily: "'DM Sans', sans-serif", fontSize: 13, padding: '11px', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={handleCreate} disabled={!newName.trim()} style={{ flex: 2, background: !newName.trim() ? 'var(--surface2)' : 'var(--accent)', border: 'none', borderRadius: 8, color: !newName.trim() ? 'var(--muted)' : '#0d0d0d', fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 1, padding: '11px', cursor: !newName.trim() ? 'not-allowed' : 'pointer' }}>CREAR Y EDITAR</button>
            </div>
          </div>
        </>
      )}

      {/* Modal: Asignar a cliente */}
      {assignModal && (
        <>
          <div onClick={() => setAssignModal(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 49 }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'var(--surface)', border: 'var(--border-width) solid var(--border-card)', borderRadius: 10, zIndex: 50, width: 'calc(100% - 40px)', maxWidth: 360, padding: '20px' }}>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 1, marginBottom: 6 }}>ASIGNAR A CLIENTE</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 16, lineHeight: 1.5 }}>
              Se creará una copia del programa para el cliente seleccionado. La plantilla original no se modifica.
            </div>

            {clientList.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--muted)', fontSize: 13, lineHeight: 1.7 }}>
                Sin clientes todavía.<br />Crea un cliente primero desde el tab Clientes.
              </div>
            ) : (
              <>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 10, color: 'var(--muted)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>Cliente</div>
                  <select
                    value={assignClientId}
                    onChange={(e) => setAssignClientId(e.target.value)}
                    style={{ ...inputStyle, padding: '10px 12px', fontSize: 13 }}
                    onFocus={(e) => e.target.style.borderColor = 'var(--accent)'}
                    onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
                  >
                    {clientList.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 10, color: 'var(--muted)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>Nombre del programa</div>
                  <input
                    type="text" value={assignName}
                    onChange={(e) => setAssignName(e.target.value)}
                    placeholder="Nombre del programa para este cliente"
                    style={inputStyle}
                    onFocus={(e) => e.target.style.borderColor = 'var(--accent)'}
                    onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
                  />
                </div>
              </>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setAssignModal(null)} style={{ flex: 1, background: 'none', border: 'var(--border-width) solid var(--border-card)', borderRadius: 8, color: 'var(--muted)', fontFamily: "'DM Sans', sans-serif", fontSize: 13, padding: '11px', cursor: 'pointer' }}>Cancelar</button>
              {clientList.length > 0 && (
                <button onClick={handleAssign} disabled={!assignClientId} style={{ flex: 2, background: !assignClientId ? 'var(--surface2)' : 'var(--accent)', border: 'none', borderRadius: 8, color: !assignClientId ? 'var(--muted)' : '#0d0d0d', fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 1, padding: '11px', cursor: !assignClientId ? 'not-allowed' : 'pointer' }}>ASIGNAR</button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function TplBtn({ label, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{ flex: 1, background: 'none', border: 'none', color: 'var(--muted)', fontFamily: "'DM Sans', sans-serif", fontSize: 12, padding: '10px', cursor: 'pointer', transition: 'background 0.15s' }}
      onPointerDown={(e) => e.currentTarget.style.background = 'var(--surface2)'}
      onPointerUp={(e) => e.currentTarget.style.background = 'none'}
      onPointerLeave={(e) => e.currentTarget.style.background = 'none'}
    >{label}</button>
  );
}

function TplDivider() { return <div style={{ width: 1, background: 'var(--border)' }} />; }

const menuItemStyle = {
  display: 'block', width: '100%', background: 'none',
  border: 'none', borderBottom: 'var(--border-width) solid var(--border)',
  color: 'var(--text)', fontFamily: "'DM Sans', sans-serif",
  fontSize: 12, padding: '11px 14px', cursor: 'pointer', textAlign: 'left',
};

const inputStyle = {
  width: '100%', background: 'var(--surface2)', border: 'var(--border-width) solid var(--border-card)',
  borderRadius: 8, color: 'var(--text)', fontFamily: "'DM Sans', sans-serif",
  fontSize: 14, padding: '10px 14px', outline: 'none', boxSizing: 'border-box',
};
