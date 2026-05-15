// PRO FEATURE — Gestión de clientes

import { useState, useMemo } from 'react';
import { useStore } from '../../store/useStore';
import ImportModal from '../ui/ImportModal';

export default function ClientsView() {
  const clients                = useStore((s) => s.clients);
  const programs               = useStore((s) => s.programs);
  const workoutLog             = useStore((s) => s.workoutLog);
  const createClient           = useStore((s) => s.createClient);
  const deleteClient           = useStore((s) => s.deleteClient);
  const renameClient           = useStore((s) => s.renameClient);
  const createProgramForClient = useStore((s) => s.createProgramForClient);
  const deleteProgram          = useStore((s) => s.deleteProgram);
  const setEditingProgram      = useStore((s) => s.setEditingProgram);
  const exportSpecificProgram  = useStore((s) => s.exportSpecificProgram);
  const importData             = useStore((s) => s.importData);

  const [selectedClientId, setSelectedClientId] = useState(null);
  const [showNewClient, setShowNewClient] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [showNewProgram, setShowNewProgram] = useState(false);
  const [newProgramName, setNewProgramName] = useState('');
  const [newProgramSessions, setNewProgramSessions] = useState(3);
  const [importFile, setImportFile] = useState(null);
  const [editingClientId, setEditingClientId] = useState(null);
  const [editingClientName, setEditingClientName] = useState('');

  const clientList = useMemo(
    () => Object.values(clients ?? {}).sort((a, b) => a.name.localeCompare(b.name)),
    [clients]
  );

  const selectedClient = selectedClientId ? clients[selectedClientId] : null;

  const clientPrograms = useMemo(() => {
    if (!selectedClient) return [];
    return (selectedClient.programIds ?? [])
      .map((id) => programs[id])
      .filter(Boolean)
      .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
  }, [selectedClient, programs]);

  function getSessionCount(program) {
    const templateIds = new Set(program.days.map((d) => d.sessionTemplateId));
    return workoutLog.filter((e) => templateIds.has(e.sessionTemplateId)).length;
  }

  function getLastActivity(program) {
    const templateIds = new Set(program.days.map((d) => d.sessionTemplateId));
    const sessions = workoutLog.filter((e) => templateIds.has(e.sessionTemplateId));
    if (!sessions.length) return null;
    return Math.max(...sessions.map((e) => e.timestamp));
  }

  function handleCreateClient() {
    if (!newClientName.trim()) return;
    createClient(newClientName);
    setNewClientName('');
    setShowNewClient(false);
  }

  function handleCreateProgram() {
    if (!newProgramName.trim() || !selectedClientId) return;
    createProgramForClient(selectedClientId, newProgramSessions, newProgramName);
    setNewProgramName('');
    setShowNewProgram(false);
  }

  function handleDeleteClient(clientId) {
    if (window.confirm('¿Eliminar cliente y todos sus programas e historial?')) {
      deleteClient(clientId, true);
      if (selectedClientId === clientId) setSelectedClientId(null);
    }
  }

  function handleDeleteProgram(programId) {
    if (window.confirm('¿Eliminar este programa?')) {
      deleteProgram(programId, false);
    }
  }

  async function handleImport(file, mode) {
    setImportFile(null);
    await importData(file, mode === 'replace' ? 'merge_log' : mode);
  }

  // ── Lista de clientes ──────────────────────────────────────────────────────
  if (!selectedClientId) {
    return (
      <div>
        <div style={{ padding: '12px 20px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ fontSize: 9, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--muted)' }}>Clientes</p>
          <button onClick={() => setShowNewClient(true)} style={accentBtnStyle}>＋ NUEVO</button>
        </div>

        <div style={{ padding: '0 20px 80px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {clientList.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted)', fontSize: 13, lineHeight: 1.8 }}>
              <span style={{ display: 'block', fontSize: 32, marginBottom: 12 }}>👥</span>
              Sin clientes todavía.
            </div>
          ) : clientList.map((client) => {
            const progCount = (client.programIds ?? []).filter((id) => programs[id]).length;
            return (
              <div key={client.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                <div onClick={() => setSelectedClientId(client.id)} style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                  <div>
                    {editingClientId === client.id ? (
                      <input
                        autoFocus value={editingClientName}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => setEditingClientName(e.target.value)}
                        onBlur={() => { if (editingClientName.trim()) renameClient(client.id, editingClientName); setEditingClientId(null); }}
                        onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') setEditingClientId(null); e.stopPropagation(); }}
                        style={{ background: 'var(--surface2)', border: '1px solid var(--accent)', borderRadius: 6, color: 'var(--text)', fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 500, padding: '4px 8px', outline: 'none' }}
                      />
                    ) : (
                      <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>{client.name}</div>
                    )}
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{progCount} programa{progCount !== 1 ? 's' : ''}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button onClick={(e) => { e.stopPropagation(); setEditingClientId(client.id); setEditingClientName(client.name); }} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 12, cursor: 'pointer', padding: '4px 6px' }}>✎</button>
                    <button onClick={(e) => { e.stopPropagation(); handleDeleteClient(client.id); }} style={{ background: 'none', border: 'none', color: 'var(--muted2)', fontSize: 12, cursor: 'pointer', padding: '4px 6px' }}>✕</button>
                    <span style={{ color: 'var(--muted)', fontSize: 16 }}>›</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {showNewClient && (
          <SimpleModal title="NUEVO CLIENTE" onClose={() => setShowNewClient(false)} onConfirm={handleCreateClient} confirmLabel="CREAR" confirmDisabled={!newClientName.trim()}>
            <input autoFocus type="text" placeholder="Nombre del cliente" value={newClientName} onChange={(e) => setNewClientName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleCreateClient()} style={inputStyle} onFocus={(e) => e.target.style.borderColor = 'var(--accent)'} onBlur={(e) => e.target.style.borderColor = 'var(--border)'} />
          </SimpleModal>
        )}
      </div>
    );
  }

  // ── Detalle de cliente ─────────────────────────────────────────────────────
  return (
    <div>
      <div style={{ padding: '12px 20px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => setSelectedClientId(null)} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 22, cursor: 'pointer', padding: '2px 0' }}>‹</button>
          <div>
            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>{selectedClient.name}</div>
            <div style={{ fontSize: 10, color: 'var(--muted)', letterSpacing: 1, textTransform: 'uppercase' }}>Programas</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => document.getElementById('client-import-input')?.click()} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--muted)', fontFamily: "'DM Sans', sans-serif", fontSize: 11, padding: '5px 10px', cursor: 'pointer' }}>↓ Importar</button>
          <button onClick={() => setShowNewProgram(true)} style={accentBtnStyle}>＋ PROGRAMA</button>
        </div>
      </div>

      <input type="file" accept=".json" style={{ display: 'none' }} id="client-import-input"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) { setImportFile(f); e.target.value = ''; } }} />

      <div style={{ padding: '4px 20px 80px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {clientPrograms.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted)', fontSize: 13, lineHeight: 1.8 }}>Sin programas. Crea uno o importa el historial del cliente.</div>
        ) : clientPrograms.map((program) => {
          const sessions = getSessionCount(program);
          const lastActivity = getLastActivity(program);
          return (
            <div key={program.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ padding: '13px 16px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{program.name}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                  {sessions} sesiones
                  {lastActivity ? ` · Última: ${new Date(lastActivity).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}` : ' · Sin actividad'}
                </div>
              </div>
              <div style={{ display: 'flex' }}>
                <ActionBtn label="Editar" onClick={() => setEditingProgram(program.id)} />
                <div style={{ width: 1, background: 'var(--border)' }} />
                <ActionBtn label="Exportar" onClick={() => exportSpecificProgram(program.id)} />
                <div style={{ width: 1, background: 'var(--border)' }} />
                <ActionBtn label="Eliminar" onClick={() => handleDeleteProgram(program.id)} danger />
              </div>
            </div>
          );
        })}
      </div>

      {showNewProgram && (
        <SimpleModal title="NUEVO PROGRAMA" onClose={() => setShowNewProgram(false)} onConfirm={handleCreateProgram} confirmLabel="CREAR Y EDITAR" confirmDisabled={!newProgramName.trim()}>
          <input autoFocus type="text" placeholder="Nombre del programa" value={newProgramName} onChange={(e) => setNewProgramName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleCreateProgram()} style={inputStyle} onFocus={(e) => e.target.style.borderColor = 'var(--accent)'} onBlur={(e) => e.target.style.borderColor = 'var(--border)'} />
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 10, color: 'var(--muted)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>Sesiones</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {[2, 3, 4, 5, 6].map((n) => (
                <button key={n} onClick={() => setNewProgramSessions(n)} style={{ flex: 1, height: 40, borderRadius: 6, border: '1px solid', borderColor: newProgramSessions === n ? 'var(--accent)' : 'var(--border)', background: newProgramSessions === n ? 'rgba(232,255,71,0.08)' : 'var(--surface2)', color: newProgramSessions === n ? 'var(--accent)' : 'var(--text)', fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, cursor: 'pointer' }}>{n}</button>
              ))}
            </div>
          </div>
        </SimpleModal>
      )}

      {importFile && <ImportModal file={importFile} onImport={handleImport} onClose={() => setImportFile(null)} />}
    </div>
  );
}

function ActionBtn({ label, onClick, danger }) {
  return (
    <button onClick={onClick} style={{ flex: 1, background: 'none', border: 'none', color: danger ? 'var(--red)' : 'var(--muted)', fontFamily: "'DM Sans', sans-serif", fontSize: 12, padding: '10px', cursor: 'pointer', transition: 'background 0.15s' }}
      onPointerDown={(e) => e.currentTarget.style.background = 'var(--surface2)'}
      onPointerUp={(e) => e.currentTarget.style.background = 'none'}
      onPointerLeave={(e) => e.currentTarget.style.background = 'none'}
    >{label}</button>
  );
}

function SimpleModal({ title, children, onClose, onConfirm, confirmLabel, confirmDisabled }) {
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 49 }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, zIndex: 50, width: 'calc(100% - 40px)', maxWidth: 360, padding: '20px' }}>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 1, marginBottom: 14 }}>{title}</div>
        {children}
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button onClick={onClose} style={{ flex: 1, background: 'none', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--muted)', fontFamily: "'DM Sans', sans-serif", fontSize: 13, padding: '11px', cursor: 'pointer' }}>Cancelar</button>
          <button onClick={onConfirm} disabled={confirmDisabled} style={{ flex: 2, background: confirmDisabled ? 'var(--surface2)' : 'var(--accent)', border: 'none', borderRadius: 8, color: confirmDisabled ? 'var(--muted)' : '#0d0d0d', fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 1, padding: '11px', cursor: confirmDisabled ? 'not-allowed' : 'pointer' }}>{confirmLabel}</button>
        </div>
      </div>
    </>
  );
}

const accentBtnStyle = { background: 'var(--accent)', border: 'none', borderRadius: 6, color: '#0d0d0d', fontFamily: "'Bebas Neue', sans-serif", fontSize: 13, letterSpacing: 1, padding: '5px 12px', cursor: 'pointer' };
const inputStyle = { width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontFamily: "'DM Sans', sans-serif", fontSize: 14, padding: '10px 14px', outline: 'none', boxSizing: 'border-box' };
