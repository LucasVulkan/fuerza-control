/**
 * SetRow — fila de una serie individual.
 * Adapta los inputs según el tipo de ejercicio:
 *   - time_progression → un input de segundos
 *   - submax / double_progression → kg + reps
 *
 * Los inputs soportan:
 *   - Tap        → abre teclado numérico
 *   - Long press → activa modo scroll (350 ms hold)
 *   - Swipe      → cambia el valor (solo en modo scroll)
 *   - Rueda del ratón → incrementa/decrementa (desktop)
 *
 * En modo scroll:
 *   - Feedback visual: borde accent + fondo tint + indicador ▲▼
 *   - Vibración haptica corta (Android)
 *   - La página NO hace scroll mientras el dedo está sobre el input
 */

import { useRef, useEffect, useState } from 'react';
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
  const [scrollActive, setScrollActive] = useState(false);

  // Refs para acceder al valor/callback más reciente sin re-registrar listeners
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

  // ── Long press → modo scroll (móvil) ─────────────────────────────────────
  // Flujo:
  //   touchstart  → inicia temporizador de 350 ms
  //   < 350 ms    → el dedo se levanta = tap normal → teclado
  //   ≥ 350 ms    → se activa modo scroll:
  //                   · cierra teclado (blur)
  //                   · feedback visual + haptico
  //                   · touchmove controla el valor (preventDefault → sin scroll)
  //   touchend    → desactiva modo scroll
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;

    let longPressTimer = null;
    let isScrollMode   = false;
    let startY         = null;
    let lastY          = null;

    const DELAY     = 350; // ms de hold para activar
    const THRESHOLD = 6;   // px mínimos entre actualizaciones de valor

    function activate() {
      isScrollMode = true;
      setScrollActive(true);
      el.blur();                                        // cierra el teclado
      if (navigator.vibrate) navigator.vibrate(25);    // haptic corto (Android)
    }

    function deactivate() {
      isScrollMode = false;
      setScrollActive(false);
      startY = null;
      lastY  = null;
    }

    function onTouchStart(e) {
      startY = e.touches[0].clientY;
      lastY  = e.touches[0].clientY;
      longPressTimer = setTimeout(activate, DELAY);
    }

    function onTouchMove(e) {
      const currentY = e.touches[0].clientY;

      if (!isScrollMode) {
        // Cancelar long press si el dedo se desplaza antes de activarse
        if (startY !== null && Math.abs(currentY - startY) > 10) {
          clearTimeout(longPressTimer);
        }
        return; // la página puede hacer scroll con normalidad
      }

      // Modo scroll activo: bloquear scroll de página y cambiar el valor
      e.preventDefault();
      const dy = lastY - currentY; // positivo = swipe arriba = incremento
      if (Math.abs(dy) >= THRESHOLD) {
        const step    = stepRef.current;
        const current = parseFloat(valueRef.current) || 0;
        const delta   = dy > 0 ? step : -step;
        const next    = Math.max(0, Math.round((current + delta) * 100) / 100);
        onChangeRef.current(String(next));
        lastY = currentY;
      }
    }

    function onTouchEnd(e) {
      clearTimeout(longPressTimer);
      if (isScrollMode) {
        e.preventDefault(); // previene el click/focus posterior al scroll
      }
      deactivate();
    }

    function onTouchCancel() {
      clearTimeout(longPressTimer);
      deactivate();
    }

    el.addEventListener('touchstart',  onTouchStart,  { passive: true  });
    el.addEventListener('touchmove',   onTouchMove,   { passive: false });
    el.addEventListener('touchend',    onTouchEnd,    { passive: false });
    el.addEventListener('touchcancel', onTouchCancel, { passive: true  });

    return () => {
      el.removeEventListener('touchstart',  onTouchStart);
      el.removeEventListener('touchmove',   onTouchMove);
      el.removeEventListener('touchend',    onTouchEnd);
      el.removeEventListener('touchcancel', onTouchCancel);
      clearTimeout(longPressTimer);
    };
  }, []); // solo al montar — usa refs para lo dinámico

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ position: 'relative' }}>
      <input
        ref={inputRef}
        type="number"
        inputMode={inputMode}
        step={scrollStep}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onWheel={handleWheel}
        onContextMenu={(e) => e.preventDefault()} // evita menú contextual en long press
        style={{
          background: scrollActive ? 'var(--accent-tint-active)' : 'var(--surface2)',
          border: scrollActive
            ? '2px solid var(--accent)'
            : done
              ? '1px solid rgba(74,222,128,0.3)'
              : 'var(--border-width) solid var(--border)',
          borderRadius: 6,
          color: 'var(--text)',
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 15,
          fontWeight: 500,
          textAlign: 'center',
          padding: '8px 4px',
          width: '100%',
          outline: 'none',
          transition: 'border-color 0.15s, background 0.15s',
          MozAppearance: 'textfield',
          // touchAction no se fija a 'none': el scroll de página funciona normalmente
          // hasta que se activa el modo scroll con long press.
        }}
        onFocus={(e) => { if (!scrollActive) e.target.style.borderColor = 'var(--accent)'; }}
        onBlur={(e)  => { if (!scrollActive) e.target.style.borderColor = done ? 'rgba(74,222,128,0.3)' : 'var(--border)'; }}
      />

      {/* Indicador visual de modo scroll ▲ ▼ */}
      {scrollActive && (
        <div style={{
          position: 'absolute', top: '50%', right: 5,
          transform: 'translateY(-50%)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', gap: 2,
          pointerEvents: 'none',
        }}>
          <span style={{ fontSize: 8, color: 'var(--accent)', lineHeight: 1 }}>▲</span>
          <span style={{ fontSize: 8, color: 'var(--accent)', lineHeight: 1 }}>▼</span>
        </div>
      )}
    </div>
  );
}
