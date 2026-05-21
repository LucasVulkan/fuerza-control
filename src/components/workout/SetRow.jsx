/**
 * SetRow — fila de una serie individual.
 * Adapta los inputs según el tipo de ejercicio:
 *   - time_progression → un input de segundos
 *   - submax / double_progression → kg + reps
 *
 * Los inputs soportan:
 *   - Tap → abre teclado numérico
 *   - Scroll / rueda del ratón → incrementa/decrementa el valor
 *   - Swipe vertical táctil → incrementa/decrementa en móvil
 */

import { useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

export default function SetRow({ index, setData, exerciseDef, lastSet, onFieldChange, onToggleDone }) {
  const { t } = useTranslation();
  const { weight, reps, time, done } = setData;
  const model = exerciseDef?.progressionModel;
  const isDecrease = exerciseDef?.progressionDirection === 'decrease';

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
          <InputWrap label={t('workout.seconds')}>
            <SetInput
              value={time}
              placeholder={prevTime || '—'}
              inputMode="numeric"
              scrollStep={5}
              onChange={(v) => onFieldChange('time', v)}
              done={done}
            />
          </InputWrap>
        ) : (
          <>
            <InputWrap label={isDecrease ? t('workout.assistance') : t('workout.kg')}>
              <SetInput
                value={weight}
                placeholder={prevWeight || '—'}
                inputMode="decimal"
                scrollStep={0.5}
                onChange={(v) => onFieldChange('weight', v)}
                done={done}
              />
            </InputWrap>
            <InputWrap label={t('workout.reps')}>
              <SetInput
                value={reps}
                placeholder={prevReps || '—'}
                inputMode="numeric"
                scrollStep={1}
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
          border: done ? '1px solid var(--green)' : 'var(--border-width) solid var(--border)',
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

function SetInput({ value, placeholder, inputMode, scrollStep = 1, onChange, done }) {
  const inputRef = useRef(null);

  // Refs para acceder al valor/callback más reciente desde los event listeners
  // sin necesidad de re-registrarlos en cada render
  const valueRef    = useRef(value);
  const onChangeRef = useRef(onChange);
  const stepRef     = useRef(scrollStep);
  useEffect(() => { valueRef.current    = value;      }, [value]);
  useEffect(() => { onChangeRef.current = onChange;   }, [onChange]);
  useEffect(() => { stepRef.current     = scrollStep; }, [scrollStep]);

  // ── Rueda del ratón (desktop) ─────────────────────────────────────────────
  function handleWheel(e) {
    e.preventDefault();
    const step    = stepRef.current;
    const current = parseFloat(valueRef.current) || 0;
    const delta   = e.deltaY < 0 ? step : -step;
    const next    = Math.max(0, Math.round((current + delta) * 100) / 100);
    onChangeRef.current(String(next));
  }

  // ── Swipe vertical táctil (móvil) ─────────────────────────────────────────
  // Necesitamos un listener non-passive para poder llamar preventDefault
  // y evitar que el scroll de la página compita con el gesto.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;

    let lastY = null;
    const THRESHOLD = 8; // px mínimos para considerar un swipe

    function onTouchStart(e) {
      lastY = e.touches[0].clientY;
    }

    function onTouchMove(e) {
      if (lastY === null) return;
      const currentY = e.touches[0].clientY;
      const dy = lastY - currentY; // positivo = swipe hacia arriba = aumenta

      if (Math.abs(dy) >= THRESHOLD) {
        e.preventDefault();
        const step    = stepRef.current;
        const current = parseFloat(valueRef.current) || 0;
        const delta   = dy > 0 ? step : -step;
        const next    = Math.max(0, Math.round((current + delta) * 100) / 100);
        onChangeRef.current(String(next));
        lastY = currentY; // resetear para el siguiente frame
      }
    }

    function onTouchEnd() {
      lastY = null;
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove',  onTouchMove,  { passive: false });
    el.addEventListener('touchend',   onTouchEnd);

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove',  onTouchMove);
      el.removeEventListener('touchend',   onTouchEnd);
    };
  }, []); // solo al montar — usa refs para lo dinámico

  return (
    <input
      ref={inputRef}
      type="number"
      inputMode={inputMode}
      step={scrollStep}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onWheel={handleWheel}
      style={{
        background: 'var(--surface2)',
        border: done ? '1px solid rgba(74,222,128,0.3)' : 'var(--border-width) solid var(--border)',
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
        // Evitar que el navegador interfiera con el scroll nativo del input type=number
        MozAppearance: 'textfield',
      }}
      onFocus={(e) => e.target.style.borderColor = 'var(--accent)'}
      onBlur={(e)  => e.target.style.borderColor = done ? 'rgba(74,222,128,0.3)' : 'var(--border)'}
    />
  );
}
