import { useState, useEffect, useRef } from 'react';
import { useStore } from '../../store/useStore';

const THEMES = [
  { id: 'dark',     label: 'Dark',     color: '#e8ff47' },
  { id: 'midnight', label: 'Midnight', color: '#60a5fa' },
  { id: 'forest',   label: 'Forest',   color: '#4ade80' },
  { id: 'sharp',    label: 'Sharp',    color: '#ffffff' },
];

function useDateTime() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);
  const date = now.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
  const time = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  return `${date} · ${time}`;
}

export default function AppHeader({ onImportFile }) {
  const navigate             = useStore((s) => s.navigate);
  const profile              = useStore((s) => s.profile);
  const setProfile           = useStore((s) => s.setProfile);
  const exportFullBackup     = useStore((s) => s.exportFullBackup);
  const exportProgramOnly    = useStore((s) => s.exportProgramOnly);
  const exportClientsBackup  = useStore((s) => s.exportClientsBackup);   // PRO FEATURE
  const importClientsBackup  = useStore((s) => s.importClientsBackup);   // PRO FEATURE

  const [menuOpen, setMenuOpen] = useState(false);
  const [clientsImportWarning, setClientsImportWarning] = useState(null); // file | null
  const fileInputRef        = useRef(null);
  const clientsFileInputRef = useRef(null);
  const dateTime = useDateTime();

  const currentTheme = profile.theme ?? 'dark';

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', currentTheme);
  }, [currentTheme]);

  function handleTheme(themeId) {
    setProfile({ theme: themeId });
    document.documentElement.setAttribute('data-theme', themeId);
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setMenuOpen(false);
    onImportFile(file);
  }

  function handleClientsFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setMenuOpen(false);
    setClientsImportWarning(file);
  }

  async function handleClientsImportConfirm() {
    if (!clientsImportWarning) return;
    const file = clientsImportWarning;
    setClientsImportWarning(null);
    await importClientsBackup(file);
  }

  return (
    <>
      <div style={{
        padding: '12px 20px',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'var(--bg)', position: 'sticky', top: 0, zIndex: 20,
      }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, letterSpacing: 2, color: 'var(--accent)' }}>
          F&C
        </div>
        <div style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: 0.5 }}>
          {dateTime}
        </div>
        <button
          onClick={() => setMenuOpen((o) => !o)}
          style={{ background: 'none', border: 'none', color: menuOpen ? 'var(--accent)' : 'var(--muted)', fontSize: 20, cursor: 'pointer', padding: '2px 4px', lineHeight: 1 }}
        >
          ≡
        </button>
      </div>

      {/* Input de archivo oculto */}
      <input ref={fileInputRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleFileChange} />
      {/* PRO FEATURE — input backup clientes */}
      <input ref={clientsFileInputRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleClientsFileChange} />

      {/* Dropdown menú */}
      {menuOpen && (
        <>
          <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 29 }} />
          <div style={{
            position: 'fixed', top: 53, right: 16,
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-card)', zIndex: 30, minWidth: 210, overflow: 'hidden',
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          }}>
            <MenuItem label="＋ Nuevo programa" onClick={() => { setMenuOpen(false); navigate('onboarding'); }} />
            <MenuItem label="🗂 Programas archivados" onClick={() => { setMenuOpen(false); navigate('archivedPrograms'); }} />

            <div style={{ padding: '8px 16px 4px', fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--muted)', borderTop: '1px solid var(--border)' }}>
              Exportar
            </div>
            <MenuItem label="↑ Programa e historial" onClick={() => { setMenuOpen(false); exportFullBackup(); }} />
            <MenuItem label="↑ Programa" onClick={() => { setMenuOpen(false); exportProgramOnly(); }} />
            {/* PRO FEATURE */}
            <MenuItem label="↑ Backup clientes" onClick={() => { setMenuOpen(false); exportClientsBackup(); }} />

            <div style={{ padding: '8px 16px 4px', fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--muted)', borderTop: '1px solid var(--border)' }}>
              Importar
            </div>
            <MenuItem label="↓ Importar archivo" onClick={() => { setMenuOpen(false); fileInputRef.current?.click(); }} />
            {/* PRO FEATURE */}
            <MenuItem label="↓ Importar backup clientes" onClick={() => { setMenuOpen(false); clientsFileInputRef.current?.click(); }} />

            <div style={{ padding: '8px 16px 4px', fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--muted)', borderTop: '1px solid var(--border)' }}>
              Theme
            </div>
            <div style={{ padding: '6px 12px 10px', display: 'flex', gap: 8 }}>
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => handleTheme(t.id)}
                  title={t.label}
                  style={{
                    width: 28, height: 28, borderRadius: '50%',
                    background: t.color,
                    border: currentTheme === t.id ? '2px solid var(--text)' : '2px solid transparent',
                    cursor: 'pointer', padding: 0,
                    boxShadow: currentTheme === t.id ? '0 0 0 1px var(--border)' : 'none',
                    transition: 'border-color 0.15s',
                  }}
                />
              ))}
            </div>

            {/* Versión de la app */}
            <div style={{
              padding: '8px 16px 10px',
              borderTop: '1px solid var(--border)',
              fontSize: 10, color: 'var(--muted2)',
              letterSpacing: 1, textAlign: 'center',
            }}>
              F&C · v{import.meta.env.VITE_APP_VERSION ?? '—'}
            </div>
          </div>
        </>
      )}

      {/* PRO FEATURE — Warning modal para importar backup de clientes */}
      {clientsImportWarning && (
        <>
          <div onClick={() => setClientsImportWarning(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 49 }} />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-card)', zIndex: 50,
            width: 'calc(100% - 40px)', maxWidth: 360, padding: '20px',
          }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, letterSpacing: 1, marginBottom: 8 }}>IMPORTAR BACKUP CLIENTES</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.7, marginBottom: 16 }}>
              <strong style={{ color: 'var(--orange)' }}>⚠️ Atención:</strong> Esta acción reemplazará todos los datos del área de clientes (clientes, programas, historial y facturación). Tus sesiones personales no se verán afectadas.
              <br /><br />
              <strong style={{ color: 'var(--text)' }}>{clientsImportWarning.name}</strong>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setClientsImportWarning(null)} style={{ flex: 1, background: 'none', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--muted)', fontFamily: 'var(--font-body)', fontSize: 13, padding: '11px', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={handleClientsImportConfirm} style={{ flex: 2, background: 'var(--orange)', border: 'none', borderRadius: 8, color: '#0d0d0d', fontFamily: 'var(--font-display)', fontSize: 18, letterSpacing: 1, padding: '11px', cursor: 'pointer' }}>REEMPLAZAR TODO</button>
            </div>
          </div>
        </>
      )}
    </>
  );
}

function MenuItem({ label, onClick, danger }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', background: 'none', border: 'none',
        borderBottom: '1px solid var(--border)',
        color: danger ? 'var(--red)' : 'var(--text)',
        fontFamily: 'var(--font-body)', fontSize: 13,
        padding: '12px 16px', cursor: 'pointer', textAlign: 'left', display: 'block',
      }}
      onPointerDown={(e) => e.currentTarget.style.background = 'var(--surface2)'}
      onPointerUp={(e) => e.currentTarget.style.background = 'none'}
      onPointerLeave={(e) => e.currentTarget.style.background = 'none'}
    >
      {label}
    </button>
  );
}
