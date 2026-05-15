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
  const navigate          = useStore((s) => s.navigate);
  const profile           = useStore((s) => s.profile);
  const setProfile        = useStore((s) => s.setProfile);
  const exportFullBackup  = useStore((s) => s.exportFullBackup);
  const exportProgramOnly = useStore((s) => s.exportProgramOnly);

  const [menuOpen, setMenuOpen] = useState(false);
  const fileInputRef = useRef(null);
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
    onImportFile(file); // sube el archivo al estado de App.jsx
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
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

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

            <div style={{ padding: '8px 16px 4px', fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--muted)', borderTop: '1px solid var(--border)' }}>
              Importar
            </div>
            <MenuItem label="↓ Importar archivo" onClick={() => { setMenuOpen(false); fileInputRef.current?.click(); }} />

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
