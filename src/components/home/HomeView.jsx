import { useStore, selectActiveProgram } from '../../store/useStore';
import DayCard from './DayCard';

export default function HomeView() {
  const activeProgram = useStore(selectActiveProgram);
  const getEffectiveTemplate = useStore((s) => s.getEffectiveTemplate);
  const getLastSession = useStore((s) => s.getLastSession);
  const startSession = useStore((s) => s.startSession);
  const navigate = useStore((s) => s.navigate);
  const archiveActiveProgram = useStore((s) => s.archiveActiveProgram);
  const exerciseLibrary = useStore((s) => s.exerciseLibrary);
  const customExercises = useStore((s) => s.customExercises);
  const allExercises = { ...exerciseLibrary, ...customExercises };

  if (!activeProgram) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--muted)' }}>
        No hay programa activo.
      </div>
    );
  }

  function handleArchive() {
    if (window.confirm('¿Archivar el programa actual? Volverás al onboarding para crear uno nuevo.')) {
      archiveActiveProgram();
    }
  }

  return (
    <div style={{ paddingBottom: 24 }}>
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
      <div style={{ padding: '8px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
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

      {/* Botones de navegación */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '4px 20px' }}>
        <NavBtn icon="📋" label="Historial de sesiones" onClick={() => navigate('history')} />
        <NavBtn icon="📈" label="Progresión por ejercicio" onClick={() => navigate('stats')} />
        <NavBtn icon="📄" label="Ver programa completo" onClick={() => navigate('programPrint')} />
        <NavBtn icon="✎" label="Editar programa" onClick={() => navigate('programEditor')} />
        <NavBtn icon="＋" label="Nuevo programa" onClick={() => navigate('onboarding')} />
        <NavBtn icon="🗂" label="Archivar programa actual" onClick={handleArchive} muted />
      </div>
    </div>
  );
}

function NavBtn({ icon, label, onClick, muted = false }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        padding: '13px 18px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        cursor: 'pointer',
        color: muted ? 'var(--muted)' : 'var(--text)',
        fontSize: 13,
        fontFamily: "'DM Sans', sans-serif",
        width: '100%',
        transition: 'background 0.15s',
      }}
      onPointerDown={(e) => e.currentTarget.style.background = 'var(--surface2)'}
      onPointerUp={(e) => e.currentTarget.style.background = 'var(--surface)'}
      onPointerLeave={(e) => e.currentTarget.style.background = 'var(--surface)'}
    >
      <span>{icon} {label}</span>
      <span style={{ color: 'var(--muted)' }}>›</span>
    </button>
  );
}

