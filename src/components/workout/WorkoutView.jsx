import { useWorkout } from '../../hooks/useWorkout';
import { useStore } from '../../store/useStore';
import ExerciseCard from './ExerciseCard';

export default function WorkoutView() {
  const { template, exercises, updateSetField, toggleSetDone, saveSession, discardSession } = useWorkout();
  const showToast = useStore((s) => s.showToast);
  const navigate = useStore((s) => s.navigate);

  if (!template) return null;

  const dayColors = { A: 'var(--day1)', B: 'var(--day2)', C: 'var(--day3)' };
  const color = template.color ?? dayColors[template.label] ?? 'var(--accent)';

  function handleSave() {
    const result = saveSession();
    if (!result.ok) {
      showToast('⚠️ ' + result.error);
      return;
    }
    showToast('✓ Sesión guardada');
    setTimeout(() => navigate('home'), 1200);
  }

  return (
    <div style={{ paddingBottom: 24 }}>
      {/* Header de la sesión */}
      <div style={{
        padding: '14px 20px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        position: 'sticky',
        top: 57, // altura del AppHeader
        background: 'var(--bg)',
        zIndex: 10,
      }}>
        <span
          onClick={discardSession}
          style={{ color: 'var(--muted)', fontSize: 22, cursor: 'pointer', padding: '4px 8px 4px 0', lineHeight: 1 }}
        >
          ‹
        </span>
        <div>
          <div style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: 20, letterSpacing: 1, color,
          }}>
            DÍA {template.label} · {template.name.toUpperCase()}
          </div>
          <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>
            {template.emphasis}
          </div>
        </div>
      </div>

      {/* Lista de ejercicios */}
      <div style={{ padding: '10px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {exercises.map((ex, i) => (
          <ExerciseCard
            key={ex.exerciseId}
            index={i}
            {...ex}
            onFieldChange={updateSetField}
            onToggleDone={toggleSetDone}
          />
        ))}

        {/* Botón guardar — al final del scroll, no flotante */}
        <button
          onClick={handleSave}
          style={{
            marginTop: 8,
            width: '100%',
            background: 'var(--accent)',
            color: '#0d0d0d',
            border: 'none',
            borderRadius: 10,
            padding: 15,
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: 20,
            letterSpacing: 1.5,
            cursor: 'pointer',
          }}
          onPointerDown={(e) => e.currentTarget.style.opacity = '0.85'}
          onPointerUp={(e) => e.currentTarget.style.opacity = '1'}
          onPointerLeave={(e) => e.currentTarget.style.opacity = '1'}
        >
          GUARDAR SESIÓN
        </button>
      </div>
    </div>
  );
}
