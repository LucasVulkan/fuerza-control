import { useState } from 'react';
import { useStore, selectActiveProgram } from '../../store/useStore';
import DayCard from './DayCard';
import HistoryView from '../history/HistoryView';
import StatsView from '../stats/StatsView';

const TABS = [
  { id: 'session',  label: 'Sesión',     icon: '🏋️' },
  { id: 'history',  label: 'Historial',  icon: '📋' },
  { id: 'progress', label: 'Progresión', icon: '📈' },
];

const BOTTOM_BAR_HEIGHT = 64;

export default function HomeView() {
  const [activeTab, setActiveTab] = useState('session');

  const activeProgram = useStore(selectActiveProgram);
  const getEffectiveTemplate = useStore((s) => s.getEffectiveTemplate);
  const getLastSession = useStore((s) => s.getLastSession);
  const startSession = useStore((s) => s.startSession);
  const navigate = useStore((s) => s.navigate);
  const archiveActiveProgram = useStore((s) => s.archiveActiveProgram);
  const exerciseLibrary = useStore((s) => s.exerciseLibrary);
  const customExercises = useStore((s) => s.customExercises);
  const allExercises = { ...exerciseLibrary, ...customExercises };

  function handleArchive() {
    if (window.confirm('¿Archivar el programa actual? Volverás al onboarding para crear uno nuevo.')) {
      archiveActiveProgram();
    }
  }

  return (
    <div style={{ paddingBottom: BOTTOM_BAR_HEIGHT }}>
      {activeTab === 'session' && (
        <SessionTab
          activeProgram={activeProgram}
          getEffectiveTemplate={getEffectiveTemplate}
          getLastSession={getLastSession}
          startSession={startSession}
          navigate={navigate}
          handleArchive={handleArchive}
          allExercises={allExercises}
        />
      )}
      {activeTab === 'history'  && <HistoryView embedded />}
      {activeTab === 'progress' && <StatsView embedded />}

      {/* Bottom bar */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        width: '100%',
        maxWidth: 480,
        height: BOTTOM_BAR_HEIGHT,
        background: 'var(--surface)',
        borderTop: '1px solid var(--border)',
        display: 'flex',
        zIndex: 20,
      }}>
        {TABS.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                flex: 1,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 3,
                padding: '8px 0',
                color: active ? 'var(--accent)' : 'var(--muted)',
                transition: 'color 0.15s',
                position: 'relative',
              }}
            >
              {active && (
                <div style={{
                  position: 'absolute',
                  top: 0,
                  width: 24,
                  height: 2,
                  background: 'var(--accent)',
                  borderRadius: '0 0 2px 2px',
                }} />
              )}
              <span style={{ fontSize: 18, lineHeight: 1 }}>{tab.icon}</span>
              <span style={{
                fontSize: 9,
                letterSpacing: 0.5,
                textTransform: 'uppercase',
                fontFamily: "'DM Sans', sans-serif",
                fontWeight: active ? 500 : 400,
              }}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SessionTab({ activeProgram, getEffectiveTemplate, getLastSession, startSession, navigate, handleArchive, allExercises }) {
  if (!activeProgram) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--muted)', fontSize: 13, lineHeight: 1.8 }}>
        <span style={{ display: 'block', fontSize: 32, marginBottom: 12 }}>🏋️</span>
        No hay programa activo.<br />
        <button
          onClick={() => navigate('onboarding')}
          style={{
            marginTop: 16,
            background: 'var(--accent)', border: 'none', borderRadius: 8,
            color: '#0d0d0d', fontFamily: "'Bebas Neue', sans-serif",
            fontSize: 16, letterSpacing: 1, padding: '10px 24px', cursor: 'pointer',
          }}
        >
          CREAR PROGRAMA
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Nombre del programa */}
      <div style={{ padding: '12px 20px 4px' }}>
        <p style={{ fontSize: 9, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--muted)' }}>
          Programa activo
        </p>
        <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', marginTop: 2 }}>
          {activeProgram.name}
        </p>
      </div>

      {/* Tarjetas de días */}
      <div style={{ padding: '8px 20px 4px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <p style={{ fontSize: 9, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 2 }}>
          Selecciona sesión de hoy
        </p>
        {activeProgram.days.map(({ sessionTemplateId }) => {
          const template = getEffectiveTemplate(sessionTemplateId);
          if (!template) return null;
          const lastSession = getLastSession(sessionTemplateId);
          return (
            <DayCard
              key={sessionTemplateId}
              template={template}
              lastSession={lastSession}
              exerciseLibrary={allExercises}
              onClick={() => startSession(sessionTemplateId)}
            />
          );
        })}
      </div>

      {/* Botones de programa — 3 en fila */}
      <div style={{ padding: '12px 20px 80px' }}>
        <p style={{ fontSize: 9, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 }}>
          Programa
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <ProgramBtn label="Ver programa" onClick={() => navigate('programPrint')} accent />
          <ProgramBtn label="Editar" onClick={() => navigate('programEditor')} accent />
          <ProgramBtn label="Archivar" onClick={handleArchive} danger />
        </div>
      </div>
    </div>
  );
}

function ProgramBtn({ label, onClick, accent, danger }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        background: 'transparent',
        border: '1px solid',
        borderColor: danger ? 'rgba(248,113,113,0.3)' : accent ? 'rgba(232,255,71,0.35)' : 'var(--border)',
        borderRadius: 8,
        padding: '8px 4px',
        cursor: 'pointer',
        color: danger ? 'var(--red)' : accent ? 'var(--accent)' : 'var(--muted)',
        fontFamily: "'DM Sans', sans-serif",
        fontSize: 11,
        letterSpacing: 0.3,
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
