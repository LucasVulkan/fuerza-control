import { useState } from 'react';

/**
 * ImportModal — modal inteligente de importación.
 *
 * Para backups completos (exportType: 'full'):
 *   Muestra toggles individuales por sección (programa, historial, ejercicios, clientes, plantillas).
 *
 * Para archivos de programa (exportType: 'program' | 'program_with_log'):
 *   Muestra los tres modos clásicos (reemplazar / nuevo programa / solo historial).
 */
export default function ImportModal({ fileName, parsedData, onImport, onClose }) {
  const exportType = parsedData?.exportType ?? 'program';
  const isBackup   = exportType === 'full';
  const hasLog     = (parsedData?.workoutLog ?? []).length > 0;

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 49 }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        background: 'var(--surface)', border: 'var(--border-width) solid var(--border-card)',
        borderRadius: 'var(--radius-card)', zIndex: 50,
        width: 'calc(100% - 40px)', maxWidth: 380,
        padding: '20px', boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
      }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, letterSpacing: 1, marginBottom: 4 }}>
          IMPORTAR ARCHIVO
        </div>
        <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 16, lineHeight: 1.5 }}>
          <strong style={{ color: 'var(--text)', fontSize: 12 }}>{fileName}</strong>
          {' · '}
          <span style={{
            fontSize: 9, letterSpacing: 1, textTransform: 'uppercase',
            background: 'var(--accent-tint-active)', color: 'var(--accent)',
            border: 'var(--border-width) solid var(--accent-tint-border)',
            borderRadius: 4, padding: '1px 6px',
          }}>
            {isBackup ? 'Backup completo' : hasLog ? 'Programa + historial' : 'Programa'}
          </span>
        </div>

        {isBackup
          ? <BackupSections parsedData={parsedData} onImport={onImport} onClose={onClose} />
          : <ProgramModes parsedData={parsedData} hasLog={hasLog} onImport={onImport} onClose={onClose} />
        }
      </div>
    </>
  );
}

// ── Backup completo: toggles por sección ─────────────────────────────────────

function BackupSections({ parsedData, onImport, onClose }) {
  const hasPrograms        = Object.keys(parsedData?.programs ?? {}).length > 0 || !!parsedData?.program;
  const hasLog             = (parsedData?.workoutLog ?? []).length > 0;
  const hasCustomExercises = Object.keys(parsedData?.customExercises ?? {}).length > 0;
  const hasClients         = Object.keys(parsedData?.clients ?? {}).length > 0;
  const hasTemplates       = Object.values(parsedData?.programs ?? {}).some((p) => p.mode === 'template');

  const [sections, setSections] = useState({
    program:         hasPrograms,
    log:             hasLog,
    customExercises: hasCustomExercises,
    clients:         hasClients,
    templates:       false,
    templatesMode:   'merge',
  });

  function toggle(key) {
    setSections((s) => ({ ...s, [key]: !s[key] }));
  }

  const nothingSelected = !sections.program && !sections.log && !sections.customExercises && !sections.clients && !sections.templates;

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
        <SectionToggle
          label="Programa personal"
          desc="Reemplaza el programa activo"
          active={sections.program}
          disabled={!hasPrograms}
          onToggle={() => toggle('program')}
        />
        <SectionToggle
          label="Historial de sesiones"
          desc={`${(parsedData?.workoutLog ?? []).length} sesiones`}
          active={sections.log}
          disabled={!hasLog}
          onToggle={() => toggle('log')}
        />
        <SectionToggle
          label="Ejercicios personalizados"
          desc={`${Object.keys(parsedData?.customExercises ?? {}).length} ejercicios`}
          active={sections.customExercises}
          disabled={!hasCustomExercises}
          onToggle={() => toggle('customExercises')}
        />
        <SectionToggle
          label="Clientes y programas gestionados"
          desc={`${Object.keys(parsedData?.clients ?? {}).length} clientes`}
          active={sections.clients}
          disabled={!hasClients}
          onToggle={() => toggle('clients')}
        />
        <SectionToggle
          label="Plantillas"
          desc="Programas de tipo plantilla"
          active={sections.templates}
          disabled={!hasTemplates}
          onToggle={() => toggle('templates')}
        />

        {sections.templates && hasTemplates && (
          <div style={{ marginLeft: 16, marginTop: 4, display: 'flex', gap: 6 }}>
            {['merge', 'replace'].map((mode) => (
              <button
                key={mode}
                onClick={() => setSections((s) => ({ ...s, templatesMode: mode }))}
                style={{
                  flex: 1,
                  background: sections.templatesMode === mode ? 'var(--accent-tint-active)' : 'var(--surface2)',
                  border: 'var(--border-width) solid',
                  borderColor: sections.templatesMode === mode ? 'var(--accent-tint-border)' : 'var(--border)',
                  borderRadius: 6,
                  color: sections.templatesMode === mode ? 'var(--accent)' : 'var(--muted)',
                  fontFamily: 'var(--font-body)', fontSize: 11,
                  padding: '6px 0', cursor: 'pointer',
                }}
              >
                {mode === 'merge' ? 'Fusionar' : 'Reemplazar todas'}
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onClose} style={cancelBtnStyle}>Cancelar</button>
        <button
          onClick={() => onImport(parsedData, sections)}
          disabled={nothingSelected}
          style={{
            flex: 2,
            background: nothingSelected ? 'var(--surface2)' : 'var(--accent)',
            border: 'none', borderRadius: 'var(--radius-btn)',
            color: nothingSelected ? 'var(--muted)' : '#0d0d0d',
            fontFamily: 'var(--font-display)', fontSize: 18, letterSpacing: 1,
            padding: '11px', cursor: nothingSelected ? 'not-allowed' : 'pointer',
          }}
        >
          IMPORTAR
        </button>
      </div>
    </>
  );
}

// ── Archivo de programa: 3 modos clásicos ────────────────────────────────────

function ProgramModes({ parsedData, hasLog, onImport, onClose }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <ModeBtn
        label="Reemplazar programa"
        desc="Importa el programa y fusiona el historial. Pasa a ser tu programa activo."
        onClick={() => onImport(parsedData, { program: true, log: true })}
      />
      {hasLog && (
        <ModeBtn
          label="Solo añadir historial"
          desc="Añade las sesiones del archivo sin cambiar el programa activo."
          onClick={() => onImport(parsedData, { program: false, log: true })}
        />
      )}
      <ModeBtn
        label="Solo el programa"
        desc="Importa el programa sin tocar tu historial actual."
        onClick={() => onImport(parsedData, { program: true, log: false })}
      />
      <button onClick={onClose} style={{ ...cancelBtnStyle, marginTop: 4 }}>Cancelar</button>
    </div>
  );
}

// ── Componentes auxiliares ────────────────────────────────────────────────────

function SectionToggle({ label, desc, active, disabled, onToggle }) {
  return (
    <button
      onClick={disabled ? undefined : onToggle}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        background: active ? 'var(--accent-tint)' : 'var(--surface2)',
        border: 'var(--border-width) solid',
        borderColor: active ? 'var(--accent-tint-border)' : 'var(--border)',
        borderRadius: 8, padding: '10px 12px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        textAlign: 'left', width: '100%',
        transition: 'all 0.15s',
      }}
    >
      {/* Toggle pill */}
      <div style={{
        width: 36, height: 20, borderRadius: 10, flexShrink: 0,
        background: active ? 'var(--accent)' : 'var(--border)',
        position: 'relative', transition: 'background 0.2s',
      }}>
        <div style={{
          position: 'absolute', top: 3,
          left: active ? 18 : 3,
          width: 14, height: 14, borderRadius: '50%',
          background: active ? '#0d0d0d' : 'var(--bg)',
          transition: 'left 0.2s',
        }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: disabled ? 'var(--muted)' : 'var(--text)', fontFamily: 'var(--font-body)' }}>
          {label}
        </div>
        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>{desc}</div>
      </div>
    </button>
  );
}

function ModeBtn({ label, desc, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'var(--surface2)', border: 'var(--border-width) solid var(--border-card)',
        borderRadius: 'var(--radius-btn)', padding: '12px 14px',
        cursor: 'pointer', textAlign: 'left', width: '100%',
        transition: 'border-color 0.15s',
      }}
      onPointerDown={(e) => e.currentTarget.style.borderColor = 'var(--accent)'}
      onPointerUp={(e) => e.currentTarget.style.borderColor = 'var(--border-card)'}
      onPointerLeave={(e) => e.currentTarget.style.borderColor = 'var(--border-card)'}
    >
      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', fontFamily: 'var(--font-body)' }}>{label}</div>
      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>{desc}</div>
    </button>
  );
}

const cancelBtnStyle = {
  flex: 1,
  background: 'none',
  border: 'var(--border-width) solid var(--border)',
  borderRadius: 'var(--radius-btn)',
  color: 'var(--muted)',
  fontFamily: 'var(--font-body)',
  fontSize: 12,
  padding: '10px',
  cursor: 'pointer',
};
