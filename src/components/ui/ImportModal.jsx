import { useState } from 'react';
import { useTranslation } from 'react-i18next';

export default function ImportModal({ fileName, parsedData, onImport, onClose }) {
  const { t } = useTranslation();
  const exportType = parsedData?.exportType ?? 'program';
  const isBackup   = exportType === 'full';
  const hasLog     = (parsedData?.workoutLog ?? []).length > 0;

  const typeLabel = isBackup
    ? t('import.typeFullBackup')
    : hasLog
    ? t('import.typeProgramWithLog')
    : t('import.typeProgram');

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
          {t('import.title')}
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
            {typeLabel}
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

function BackupSections({ parsedData, onImport, onClose }) {
  const { t } = useTranslation();
  const hasPrograms        = Object.keys(parsedData?.programs ?? {}).length > 0 || !!parsedData?.program;
  const hasLog             = (parsedData?.workoutLog ?? []).length > 0;
  const hasCustomExercises = Object.keys(parsedData?.customExercises ?? {}).length > 0;
  const hasClients         = Object.keys(parsedData?.clients ?? {}).length > 0;
  const hasTemplates       = Object.values(parsedData?.programs ?? {}).some((p) => p.mode === 'template');

  const logCount  = (parsedData?.workoutLog ?? []).length;
  const exCount   = Object.keys(parsedData?.customExercises ?? {}).length;
  const cliCount  = Object.keys(parsedData?.clients ?? {}).length;

  const [sections, setSections] = useState({
    program:         hasPrograms,
    log:             hasLog,
    customExercises: hasCustomExercises,
    clients:         hasClients,
    templates:       hasTemplates,
    templatesMode:   'merge',
  });

  function toggle(key) {
    setSections((s) => ({ ...s, [key]: !s[key] }));
  }

  const nothingSelected = !sections.program && !sections.log && !sections.customExercises && !sections.clients && !sections.templates;

  return (
    <>
      <div style={{
        background: 'rgba(248,113,113,0.08)',
        border: 'var(--border-width) solid rgba(248,113,113,0.3)',
        borderRadius: 8, padding: '8px 12px', marginBottom: 12,
        fontSize: 11, color: 'var(--red, #f87171)', lineHeight: 1.5,
      }}>
        {t('import.warning')}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
        <SectionToggle
          label={t('import.sectionProgram')}
          desc={t('import.sectionProgramDesc')}
          active={sections.program}
          disabled={!hasPrograms}
          onToggle={() => toggle('program')}
        />
        <SectionToggle
          label={t('import.sectionLog')}
          desc={t('common.session_other', { count: logCount })}
          active={sections.log}
          disabled={!hasLog}
          onToggle={() => toggle('log')}
        />
        <SectionToggle
          label={t('import.sectionCustomExercises')}
          desc={t('common.exercises_other', { count: exCount })}
          active={sections.customExercises}
          disabled={!hasCustomExercises}
          onToggle={() => toggle('customExercises')}
        />
        <SectionToggle
          label={t('import.sectionClients')}
          desc={t('common.clients_other', { count: cliCount })}
          active={sections.clients}
          disabled={!hasClients}
          onToggle={() => toggle('clients')}
        />

        <div style={{
          background: sections.templates ? 'var(--accent-tint)' : 'var(--surface2)',
          border: 'var(--border-width) solid',
          borderColor: sections.templates ? 'var(--accent-tint-border)' : 'var(--border)',
          borderRadius: 8,
          opacity: !hasTemplates ? 0.4 : 1,
          transition: 'all 0.15s',
        }}>
          <SectionToggle
            label={t('import.sectionTemplates')}
            desc={t('import.sectionTemplatesDesc')}
            active={sections.templates}
            disabled={!hasTemplates}
            onToggle={() => toggle('templates')}
            noBorder
          />
          {sections.templates && hasTemplates && (
            <div style={{ padding: '0 12px 10px', display: 'flex', gap: 6 }}>
              {['merge', 'replace'].map((mode) => (
                <button
                  key={mode}
                  onClick={() => setSections((s) => ({ ...s, templatesMode: mode }))}
                  style={{
                    flex: 1,
                    background: sections.templatesMode === mode ? 'var(--accent-tint-active)' : 'var(--surface)',
                    border: 'var(--border-width) solid',
                    borderColor: sections.templatesMode === mode ? 'var(--accent-tint-border)' : 'var(--border)',
                    borderRadius: 6,
                    color: sections.templatesMode === mode ? 'var(--accent)' : 'var(--muted)',
                    fontFamily: 'var(--font-body)', fontSize: 11,
                    padding: '6px 0', cursor: 'pointer',
                  }}
                >
                  {mode === 'merge' ? t('import.mergeModeLabel') : t('import.replaceModeLabel')}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onClose} style={cancelBtnStyle}>{t('common.cancel')}</button>
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
          {t('import.importBtn')}
        </button>
      </div>
    </>
  );
}

function ProgramModes({ parsedData, hasLog, onImport, onClose }) {
  const { t } = useTranslation();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <ModeBtn
        label={t('import.replaceProgram')}
        desc={t('import.replaceProgramDesc')}
        onClick={() => onImport(parsedData, { program: true, log: true })}
      />
      {hasLog && (
        <ModeBtn
          label={t('import.addLogOnly')}
          desc={t('import.addLogOnlyDesc')}
          onClick={() => onImport(parsedData, { program: false, log: true })}
        />
      )}
      <ModeBtn
        label={t('import.programOnly')}
        desc={t('import.programOnlyDesc')}
        onClick={() => onImport(parsedData, { program: true, log: false })}
      />
      <button onClick={onClose} style={{ ...cancelBtnStyle, marginTop: 4 }}>{t('common.cancel')}</button>
    </div>
  );
}

function SectionToggle({ label, desc, active, disabled, onToggle, noBorder = false }) {
  return (
    <button
      onClick={disabled ? undefined : onToggle}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        background: noBorder ? 'transparent' : active ? 'var(--accent-tint)' : 'var(--surface2)',
        border: noBorder ? 'none' : 'var(--border-width) solid',
        borderColor: active ? 'var(--accent-tint-border)' : 'var(--border)',
        borderRadius: noBorder ? 0 : 8, padding: '10px 12px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        textAlign: 'left', width: '100%',
        transition: 'all 0.15s',
      }}
    >
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
