/**
 * SetRow — fila de una serie individual.
 * Adapta los inputs según el tipo de ejercicio:
 *   - time_progression → un input de segundos
 *   - submax / double_progression → kg + reps
 *
 * Para ejercicios con progressionDirection: 'decrease',
 * el label de kg cambia a 'Asistencia' (ver ARCHITECTURE_DECISIONS.md)
 */

export default function SetRow({ index, setData, exerciseDef, lastSet, onFieldChange, onToggleDone }) {
  const { weight, reps, time, done } = setData;
  const model = exerciseDef?.progressionModel;
  const isDecrease = exerciseDef?.progressionDirection === 'decrease';

  // Placeholders de la sesión anterior
  const prevWeight = lastSet?.weight ?? '';
  const prevReps   = lastSet?.reps   ?? '';
  const prevTime   = lastSet?.time   ?? '';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
      {/* Etiqueta S1, S2… */}
      <div style={{
        fontSize: 10, color: 'var(--muted)', width: 26, flexShrink: 0,
        letterSpacing: 1, textTransform: 'uppercase',
      }}>
        S{index + 1}
      </div>

      {/* Inputs */}
      <div style={{ display: 'flex', gap: 5, flex: 1 }}>
        {model === 'time_progression' ? (
          <InputWrap label="Segundos">
            <SetInput
              value={time}
              placeholder={prevTime || '—'}
              inputMode="numeric"
              onChange={(v) => onFieldChange('time', v)}
              done={done}
            />
          </InputWrap>
        ) : (
          <>
            <InputWrap label={isDecrease ? 'Asistencia' : 'Kg'}>
              <SetInput
                value={weight}
                placeholder={prevWeight || '—'}
                inputMode="decimal"
                step="0.5"
                onChange={(v) => onFieldChange('weight', v)}
                done={done}
              />
            </InputWrap>
            <InputWrap label="Reps">
              <SetInput
                value={reps}
                placeholder={prevReps || '—'}
                inputMode="numeric"
                onChange={(v) => onFieldChange('reps', v)}
                done={done}
              />
            </InputWrap>
          </>
        )}
      </div>

      {/* Botón ✓ */}
      <button
        onClick={onToggleDone}
        style={{
          width: 32, height: 32, borderRadius: 6,
          border: done ? '1px solid var(--green)' : '1px solid var(--border)',
          background: done ? 'rgba(74,222,128,0.1)' : 'var(--surface2)',
          color: done ? 'var(--green)' : 'var(--muted)',
          fontSize: 15, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, marginTop: 18,
          transition: 'all 0.15s',
        }}
      >
        ✓
      </button>
    </div>
  );
}

function InputWrap({ label, children }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <div style={{
        fontSize: 9, color: 'var(--muted2)', letterSpacing: 1,
        textTransform: 'uppercase', textAlign: 'center',
      }}>
        {label}
      </div>
      {children}
    </div>
  );
}

function SetInput({ value, placeholder, inputMode, step, onChange, done }) {
  return (
    <input
      type="number"
      inputMode={inputMode}
      step={step}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      style={{
        background: 'var(--surface2)',
        border: done ? '1px solid rgba(74,222,128,0.3)' : '1px solid var(--border)',
        borderRadius: 6,
        color: 'var(--text)',
        fontFamily: "'DM Sans', sans-serif",
        fontSize: 15,
        fontWeight: 500,
        textAlign: 'center',
        padding: '8px 4px',
        width: '100%',
        outline: 'none',
        transition: 'border-color 0.15s',
      }}
      onFocus={(e) => e.target.style.borderColor = 'var(--accent)'}
      onBlur={(e) => e.target.style.borderColor = done ? 'rgba(74,222,128,0.3)' : 'var(--border)'}
    />
  );
}
