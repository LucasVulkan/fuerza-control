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

export default function SetRow({ index, setData, exerciseDef, lastSet, onFieldChange, onToggleDone, showHint = false }) {
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
              showHint={showHint}
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
                showHint={showHint}
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
                showHint={showHint}
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

function SetInput({ value, placeholder, inputMode, scrollStep = 1, onChange, done, showHint = false }) {
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

  // ── Swipe horizontal → cambia valor (móvil) ──────────────────────────────
  // Flujo:
  //   touchstart  → readOnly=true inmediato (bloquea selección de texto del OS)
  //                 + registra posición inicial
  //   touchmove   → detecta dirección en los primeros DIR_THRESHOLD px:
  //                   · horizontal (|dx|>|dy|) → bloquea scroll de página,
  //                     activa modo swipe, cambia valor según desplazamiento
  //                   · vertical   (|dy|>|dx|) → readOnly=false, deja que la
  //                     página haga scroll con normalidad
  //   touchend    → si fue swipe: desactiva
  //                 si fue tap (sin movimiento): readOnly=false + focus() → teclado
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;

    let startX        = null;
    let startY        = null;
    let lastX         = null;
    let directionLock = null; // null | 'h' | 'v'

    const DIR_THRESHOLD = 8; // px antes de decidir la dirección
    const STEP_PX       = 8; // px horizontales por paso de valor

    function activate() {
      setScrollActive(true);
      if (navigator.vibrate) navigator.vibrate(15);
    }

    function deactivate() {
      directionLock = null;
      el.readOnly   = false;
      setScrollActive(false);
      startX = null;
      startY = null;
      lastX  = null;
    }

    function onSelectStart(e) { e.preventDefault(); }

    function onTouchStart(e) {
      startX        = e.touches[0].clientX;
      startY        = e.touches[0].clientY;
      lastX         = e.touches[0].clientX;
      directionLock = null;
      el.readOnly   = true; // bloquea selección de texto desde el primer ms
    }

    function onTouchMove(e) {
      const currentX = e.touches[0].clientX;
      const currentY = e.touches[0].clientY;

      // ── Aún sin dirección bloqueada: detectar ────────────────────────────
      if (directionLock === null) {
        const totalDx = Math.abs(currentX - startX);
        const totalDy = Math.abs(currentY - startY);

        if (totalDx > DIR_THRESHOLD && totalDx > totalDy) {
          directionLock = 'h';
          activate();
        } else if (totalDy > DIR_THRESHOLD && totalDy >= totalDx) {
          directionLock = 'v';
          el.readOnly = false; // liberar para que la página haga scroll
        }
        lastX = currentX;
        return;
      }

      // ── Swipe horizontal activo ───────────────────────────────────────────
      if (directionLock === 'h') {
        e.preventDefault(); // impide scroll de página mientras se cambia el valor
        const dx = currentX - lastX;
        if (Math.abs(dx) >= STEP_PX) {
          const steps   = Math.trunc(dx / STEP_PX);
          const step    = stepRef.current;
          const current = parseFloat(valueRef.current) || 0;
          const next    = Math.max(0, Math.round((current + steps * step) * 100) / 100);
          onChangeRef.current(String(next));
          lastX = currentX - (dx % STEP_PX); // conserva el resto para el próximo evento
        }
      }
      // directionLock === 'v': la página ya scrollea sola, no hay nada que hacer
    }

    function onTouchEnd(e) {
      if (directionLock === 'h') {
        e.preventDefault(); // evita el click/focus que sigue al swipe
        deactivate();
      } else if (directionLock === null) {
        // Tap puro: abrir teclado
        el.readOnly = false;
        el.focus();
        directionLock = null;
      } else {
        deactivate(); // scroll de página
      }
    }

    function onTouchCancel() { deactivate(); }

    el.addEventListener('selectstart', onSelectStart);
    el.addEventListener('touchstart',  onTouchStart,  { passive: true  });
    el.addEventListener('touchmove',   onTouchMove,   { passive: false });
    el.addEventListener('touchend',    onTouchEnd,    { passive: false });
    el.addEventListener('touchcancel', onTouchCancel, { passive: true  });

    return () => {
      el.removeEventListener('selectstart', onSelectStart);
      el.removeEventListener('touchstart',  onTouchStart);
      el.removeEventListener('touchmove',   onTouchMove);
      el.removeEventListener('touchend',    onTouchEnd);
      el.removeEventListener('touchcancel', onTouchCancel);
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
        readOnly={scrollActive}             // sin teclado mientras se hace scroll
        onChange={(e) => onChange(e.target.value)}
        onWheel={handleWheel}
        onContextMenu={(e) => e.preventDefault()}
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
          // Evita que el browser active la selección de texto nativa en long press
          userSelect: 'none',
          WebkitUserSelect: 'none',
          WebkitTouchCallout: 'none',
        }}
        onFocus={(e) => { if (!scrollActive) e.target.style.borderColor = 'var(--accent)'; }}
        onBlur={(e)  => { if (!scrollActive) e.target.style.borderColor = done ? 'rgba(74,222,128,0.3)' : 'var(--border)'; }}
      />

      {/* Indicador de swipe: activo (accent) o hint (muted) */}
      {(scrollActive || showHint) && (
        <>
          <span style={{
            position: 'absolute', top: '50%', left: 6,
            transform: 'translateY(-50%)',
            fontSize: 11,
            color: scrollActive ? 'var(--accent)' : 'var(--muted)',
            opacity: scrollActive ? 1 : 0.6,
            lineHeight: 1,
            pointerEvents: 'none',
            userSelect: 'none',
          }}>‹</span>
          <span style={{
            position: 'absolute', top: '50%', right: 6,
            transform: 'translateY(-50%)',
            fontSize: 11,
            color: scrollActive ? 'var(--accent)' : 'var(--muted)',
            opacity: scrollActive ? 1 : 0.6,
            lineHeight: 1,
            pointerEvents: 'none',
            userSelect: 'none',
          }}>›</span>
        </>
      )}
    </div>
  );
}
