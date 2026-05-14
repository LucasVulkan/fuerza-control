import { useState } from 'react';
import { useStore } from '../../store/useStore';
import ExerciseSelector from './ExerciseSelector';

export default function ExerciseEditor({ templateId, exConfig, def, onClose }) {
  const [sets, setSets] = useState(exConfig.sets);
  const [restSec, setRestSec] = useState(exConfig.restSec);
  const [minReps, setMinReps] = useState(exConfig.minReps ?? def?.minReps ?? '');
  const [maxReps, setMaxReps] = useState(exConfig.maxReps ?? def?.maxReps ?? '');
  const [minTime, setMinTime] = useState(exConfig.minTime ?? def?.minTime ?? '');
  const [maxTime, setMaxTime] = useState(exConfig.maxTime ?? def?.maxTime ?? '');
  const [showSelector, setShowSelector] = useState(false);

  const isTime = def?.progressionModel === 'time_progression';

  const updateExerciseParams = useStore((s) => s.updateExerciseParams);
  const replaceExercise = useStore((s) => s.replaceExercise);
  const showToast = useStore((s) => s.showToast);

  function handleSave() {
    const updates = { sets: parseInt(sets), restSec: parseInt(restSec) };
    if (isTime) {
      updates.minTime = parseInt(minTime);
      updates.maxTime = parseInt(maxTime);
    } else if (def?.progressionModel !== 'submax') {
      updates.minReps = parseInt(minReps);
      updates.maxReps = parseInt(maxReps);
    }
    updateExerciseParams(templateId, exConfig.exerciseId, updates);
    showToast('✓ Ejercicio actualizado');
    onClose();
  }

  function handleReplace(newExerciseId) {
    replaceExercise(templateId, exConfig.exerciseId, newExerciseId);
    showToast('✓ Ejercicio sustituido');
    setShowSelector(false);
    onClose();
  }

  return (
    <>
      <div style={{
        background: 'var(--surface2)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        padding: '14px 16px',
        margin: '4px 0 8px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}>
        {/* Series y descanso — siempre editables */}
        <div style={{ display: 'flex', gap: 10 }}>
          <EditorField
            label="Series"
            value={sets}
            onChange={setSets}
            min={1} max={8}
          />
          <EditorField
            label="Descanso (s)"
            value={restSec}
            onChange={setRestSec}
            min={30} max={300}
          />
        </div>

        {/* Rango de reps o tiempo */}
        {isTime ? (
          <div style={{ display: 'flex', gap: 10 }}>
            <EditorField label="Tiempo mín (s)" value={minTime} onChange={setMinTime} min={5} max={120} />
            <EditorField label="Tiempo máx (s)" value={maxTime} onChange={setMaxTime} min={5} max={120} />
          </div>
        ) : def?.progressionModel !== 'submax' ? (
          <div style={{ display: 'flex', gap: 10 }}>
            <EditorField label="Reps mín" value={minReps} onChange={setMinReps} min={1} max={30} />
            <EditorField label="Reps máx" value={maxReps} onChange={setMaxReps} min={1} max={30} />
          </div>
        ) : null}

        {/* Botones */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setShowSelector(true)}
            style={{
              flex: 1,
              background: 'var(--surface3)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              color: 'var(--text)',
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 12,
              padding: '9px 0',
              cursor: 'pointer',
            }}
          >
            ⇄ Sustituir ejercicio
          </button>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: '1px solid var(--border)',
              borderRadius: 8,
              color: 'var(--muted)',
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 12,
              padding: '9px 14px',
              cursor: 'pointer',
            }}
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            style={{
              background: 'var(--accent)',
              border: 'none',
              borderRadius: 8,
              color: '#0d0d0d',
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: 15,
              letterSpacing: 1,
              padding: '9px 16px',
              cursor: 'pointer',
            }}
          >
            Guardar
          </button>
        </div>
      </div>

      {showSelector && (
        <ExerciseSelector
          currentExerciseId={exConfig.exerciseId}
          templateId={templateId}
          onSelect={handleReplace}
          onClose={() => setShowSelector(false)}
        />
      )}
    </>
  );
}

function EditorField({ label, value, onChange, min, max }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ fontSize: 9, color: 'var(--muted)', letterSpacing: 1, textTransform: 'uppercase' }}>
        {label}
      </div>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(e.target.value)}
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 6,
          color: 'var(--text)',
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 15,
          fontWeight: 500,
          textAlign: 'center',
          padding: '8px 4px',
          width: '100%',
          outline: 'none',
        }}
        onFocus={(e) => e.target.style.borderColor = 'var(--accent)'}
        onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
      />
    </div>
  );
}
