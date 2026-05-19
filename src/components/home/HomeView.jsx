import { useState } from 'react';
import { useStore, selectActiveProgram } from '../../store/useStore';
import DayCard from './DayCard';
import HistoryView from '../history/HistoryView';
import StatsView from '../stats/StatsView';
import ClientsView from '../program/ClientsView';
import TemplatesView from '../program/TemplatesView';

const TABS = [
  { id: 'session',   label: 'Sesión',    icon: '🏋️' },
  { id: 'history',   label: 'Historial', icon: '📋' },
  { id: 'progress',  label: 'Progresión',icon: '📈' },
  { id: 'clients',   label: 'Clientes',  icon: '👥' }, // PRO FEATURE
  { id: 'templates', label: 'Plantillas',icon: '📐' }, // PRO FEATURE
];

const BOTTOM_BAR_HEIGHT = 64;

export default function HomeView() {
  const ui = useStore((s) => s.ui);
  const [activeTab, setActiveTab] = useState(ui.homeTab ?? 'session');
  const [archiveModal, setArchiveModal] = useState(false);
  const [clientsKey, setClientsKey] = useState(0);

  function handleTabClick(tabId) {
    if (tabId === 'clients' && activeTab === 'clients') {
      setClientsKey((k) => k + 1); // fuerza remount de ClientsView → vuelve a lista
    }
    setActiveTab(tabId);
  }

  const activeProgram    = useStore(selectActiveProgram);
  const activeSession    = useStore((s) => s.activeSession);
  const getEffectiveTemplate = useStore((s) => s.getEffectiveTemplate);
  const getLastSession   = useStore((s) => s.getLastSession);
  const startSession     = useStore((s) => s.startSession);
  const navigate         = useStore((s) => s.navigate);
  const archiveProgram   = useStore((s) => s.archiveProgram);
  const exerciseLibrary  = useStore((s) => s.exerciseLibrary);
  const customExercises  = useStore((s) => s.customExercises);
  const allExercises = { ...exerciseLibrary, ...customExercises };

  function handleArchiveConfirm(clearHistory) {
    if (activeProgram) {
      archiveProgram(activeProgram.id, clearHistory);
    }
    setArchiveModal(false);
  }

  return (
    <div style={{ paddingBottom: BOTTOM_BAR_HEIGHT }}>
      {activeTab === 'session'  && (
        <SessionTab
          activeProgram={activeProgram}
          getEffectiveTemplate={getEffectiveTemplate}
          getLastSession={getLastSession}
          startSession={startSession}
          navigate={navigate}
          activeSession={activeSession}
          onArchive={() => setArchiveModal(true)}
          allExercises={allExercises}
        />
      )}
      {activeTab === 'history'  && <HistoryView embedded />}
      {activeTab === 'progress' && <StatsView embedded />}
      {activeTab === 'clients'    && <ClientsView key={clientsKey} />}
      {activeTab === 'templates'  && <TemplatesView />}

      {/* Bottom bar */}
      <div style={{
        position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: 480, height: BOTTOM_BAR_HEIGHT,
        background: 'var(--surface)', borderTop: '1px solid var(--border)',
        display: 'flex', zIndex: 20,
      }}>
        {TABS.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              style={{
                flex: 1, background: 'none', border: 'none', cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', gap: 3, padding: '8px 0',
                color: active ? 'var(--accent)' : 'var(--muted)',
                transition: 'color 0.15s', position: 'relative',
              }}
            >
              {active && (
                <div style={{
                  position: 'absolute', top: 0, width: 24, height: 2,
                  background: 'var(--accent)', borderRadius: '0 0 2px 2px',
                }} />
              )}
              <span style={{ fontSize: 18, lineHeight: 1 }}>{tab.icon}</span>
              <span style={{
                fontSize: 9, letterSpacing: 0.5, textTransform: 'uppercase',
                fontFamily: "'DM Sans', sans-serif", fontWeight: active ? 500 : 400,
              }}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Modal de archivar */}
      {archiveModal && (
        <ArchiveModal
          programName={activeProgram?.name}
          onConfirm={handleArchiveConfirm}
          onClose={() => setArchiveModal(false)}
        />
      )}
    </div>
  );
}

function SessionTab({ activeProgram, getEffectiveTemplate, getLastSession, startSession, navigate, activeSession, onArchive, allExercises }) {
  if (!activeProgram) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--muted)', fontSize: 13, lineHeight: 1.8 }}>
        <span style={{ display: 'block', fontSize: 32, marginBottom: 12 }}>🏋️</span>
        No hay programa activo.
        <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 240, margin: '20px auto 0' }}>
          <button
            onClick={() => navigate('onboarding')}
            style={{
              background: 'var(--accent)', border: 'none', borderRadius: 10,
              color: '#0d0d0d', fontFamily: "'Bebas Neue', sans-serif",
              fontSize: 18, letterSpacing: 1, padding: '13px 24px', cursor: 'pointer',
            }}
          >
            ＋ NUEVO PROGRAMA
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ borderTop: '1px solid var(--border)' }}>
      <div style={{ padding: '12px 20px 4px' }}>
        <p style={{ fontSize: 9, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--muted)' }}>Programa activo</p>
        <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', marginTop: 2 }}>{activeProgram.name}</p>
      </div>

      <div style={{ padding: '8px 20px 4px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <p style={{ fontSize: 9, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 2 }}>
          Selecciona sesión de hoy
        </p>
        {activeProgram.days.map(({ sessionTemplateId }) => {
          const template = getEffectiveTemplate(sessionTemplateId);
          if (!template) return null;
          const lastSession = getLastSession(sessionTemplateId);
          const isActive = activeSession?.templateId === sessionTemplateId;
          return (
            <DayCard
              key={sessionTemplateId}
              template={template}
              lastSession={lastSession}
              exerciseLibrary={allExercises}
              isActive={isActive}
              onClick={isActive ? () => navigate('workout') : () => startSession(sessionTemplateId)}
            />
          );
        })}
      </div>

      <div style={{ padding: '12px 20px 80px' }}>
        <p style={{ fontSize: 9, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 }}>Programa</p>
        <div style={{ display: 'flex', gap: 8 }}>
          <ProgramBtn label="Ver programa" onClick={() => navigate('programPrint')} accent />
          <ProgramBtn label="Editar" onClick={() => navigate('programEditor')} accent />
          <ProgramBtn label="Archivar" onClick={onArchive} danger />
        </div>
      </div>
    </div>
  );
}

function ArchiveModal({ programName, onConfirm, onClose }) {
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 49 }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-card)', zIndex: 50,
        width: 'calc(100% - 40px)', maxWidth: 380, padding: '20px',
        boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
      }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, letterSpacing: 1, marginBottom: 6 }}>
          ARCHIVAR PROGRAMA
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16, lineHeight: 1.6 }}>
          <strong style={{ color: 'var(--text)' }}>{programName}</strong>
          <br />El programa archivado se puede ver en "Programas archivados" del menú, pero no se puede volver a activar (versión gratuita).
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <ArchiveOption
            label="Archivar programa"
            desc="El historial de sesiones se conserva."
            onClick={() => onConfirm(false)}
          />
          <ArchiveOption
            label="Archivar y limpiar historial"
            desc="Se elimina también el historial de este programa."
            onClick={() => onConfirm(true)}
            danger
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

function ArchiveOption({ label, desc, onClick, danger }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'var(--surface2)', border: '1px solid',
        borderColor: danger ? 'rgba(248,113,113,0.3)' : 'var(--border)',
        borderRadius: 'var(--radius-btn)', padding: '12px 14px',
        cursor: 'pointer', textAlign: 'left', width: '100%',
        transition: 'border-color 0.15s',
      }}
      onPointerDown={(e) => e.currentTarget.style.borderColor = danger ? 'var(--red)' : 'var(--accent)'}
      onPointerUp={(e) => e.currentTarget.style.borderColor = danger ? 'rgba(248,113,113,0.3)' : 'var(--border)'}
      onPointerLeave={(e) => e.currentTarget.style.borderColor = danger ? 'rgba(248,113,113,0.3)' : 'var(--border)'}
    >
      <div style={{ fontSize: 13, fontWeight: 500, color: danger ? 'var(--red)' : 'var(--text)', fontFamily: 'var(--font-body)' }}>{label}</div>
      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>{desc}</div>
    </button>
  );
}

function ProgramBtn({ label, onClick, accent, danger }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, background: 'transparent', border: '1px solid',
        borderColor: danger ? 'rgba(248,113,113,0.3)' : accent ? 'rgba(232,255,71,0.35)' : 'var(--border)',
        borderRadius: 8, padding: '8px 4px', cursor: 'pointer',
        color: danger ? 'var(--red)' : accent ? 'var(--accent)' : 'var(--muted)',
        fontFamily: "'DM Sans', sans-serif", fontSize: 11, letterSpacing: 0.3,
        transition: 'background 0.15s',
      }}
      onPointerDown={(e) => e.currentTarget.style.background = 'var(--surface2)'}
      onPointerUp={(e) => e.currentTarget.style.background = 'transparent'}
      onPointerLeave={(e) => e.currentTarget.style.background = 'transparent'}
    >
      {label}
    </button>
  );
}
