export default function ImportModal({ file, onImport, onClose }) {
  return (
    <>
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 49 }}
      />
      <div style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-card)', zIndex: 50,
        width: 'calc(100% - 40px)', maxWidth: 380,
        padding: '20px', boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
      }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, letterSpacing: 1, marginBottom: 6 }}>
          IMPORTAR ARCHIVO
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16, lineHeight: 1.6 }}>
          <strong style={{ color: 'var(--text)' }}>{file.name}</strong>
          <br />¿Cómo quieres importar este archivo?
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <ImportModeBtn
            label="Reemplazar todo"
            desc="Sustituye tu programa e historial actuales."
            onClick={() => onImport(file, 'replace')}
          />
          <ImportModeBtn
            label="Añadir programa"
            desc="Importa el programa. Tu historial actual no cambia."
            onClick={() => onImport(file, 'add_program')}
          />
          <ImportModeBtn
            label="Fusionar historial"
            desc="Solo añade las sesiones del archivo. El programa no cambia."
            onClick={() => onImport(file, 'merge_log')}
          />
          <button
            onClick={onClose}
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
  );
}

function ImportModeBtn({ label, desc, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'var(--surface2)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-btn)', padding: '12px 14px',
        cursor: 'pointer', textAlign: 'left', width: '100%',
        transition: 'border-color 0.15s',
      }}
      onPointerDown={(e) => e.currentTarget.style.borderColor = 'var(--accent)'}
      onPointerUp={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
      onPointerLeave={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
    >
      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', fontFamily: 'var(--font-body)' }}>{label}</div>
      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>{desc}</div>
    </button>
  );
}
