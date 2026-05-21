import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useRestTimer } from '../../hooks/useRestTimer';

const RING_SIZE = 64;
const RADIUS = 26;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const SWIPE_THRESHOLD = 72;

export default function RestTimerBar() {
  const { t } = useTranslation();
  const { active, remaining, total, exerciseName, skip } = useRestTimer();
  const [dragX, setDragX] = useState(0);
  const startX = useRef(null);
  const dragging = useRef(false);

  const progress = total > 0 ? remaining / total : 0;
  const strokeDashoffset = CIRCUMFERENCE * (1 - progress);

  function onPointerDown(e) {
    if (e.target.closest('button')) return;
    startX.current = e.clientX;
    dragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e) {
    if (!dragging.current) return;
    const dx = Math.max(0, e.clientX - startX.current);
    setDragX(dx);
  }

  function onPointerUp(e) {
    if (!dragging.current) return;
    dragging.current = false;
    if (dragX >= SWIPE_THRESHOLD) {
      skip();
    }
    setDragX(0);
  }

  const swipeOpacity = 1 - (dragX / (SWIPE_THRESHOLD * 1.5));

  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{
        position: 'fixed',
        bottom: 84,
        left: '50%',
        transform: active
          ? `translateX(calc(-50% + ${dragX}px)) translateY(0)`
          : 'translateX(-50%) translateY(16px)',
        width: 'calc(100% - 32px)',
        maxWidth: 440,
        background: 'var(--surface2)',
        border: 'var(--border-width) solid var(--border)',
        borderRadius: 16,
        padding: '14px 18px',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        zIndex: 30,
        opacity: active ? swipeOpacity : 0,
        pointerEvents: active ? 'all' : 'none',
        transition: dragging.current ? 'opacity 0.1s' : 'opacity 0.3s, transform 0.3s',
        touchAction: 'pan-y',
        userSelect: 'none',
        cursor: dragX > 0 ? 'grabbing' : 'grab',
      }}
    >
      {/* Anillo SVG */}
      <div style={{ position: 'relative', width: RING_SIZE, height: RING_SIZE, flexShrink: 0 }}>
        <svg
          width={RING_SIZE} height={RING_SIZE}
          viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
          style={{ transform: 'rotate(-90deg)' }}
        >
          <circle
            cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RADIUS}
            fill="none" stroke="var(--border)" strokeWidth="3.5"
          />
          <circle
            cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RADIUS}
            fill="none" stroke="var(--accent)" strokeWidth="3.5"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={strokeDashoffset}
            style={{ transition: 'stroke-dashoffset 1s linear' }}
          />
        </svg>
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: "'Bebas Neue', sans-serif",
          fontSize: 22, color: 'var(--accent)',
          letterSpacing: 1,
        }}>
          {remaining}
        </div>
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {exerciseName}
        </div>
        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>
          {remaining > 0 ? t('restTimer.remaining', { count: remaining }) : t('restTimer.go')}
        </div>
      </div>

      {/* Botón saltar */}
      <button
        onClick={skip}
        style={{
          background: 'none',
          border: 'var(--border-width) solid var(--border)',
          borderRadius: 8,
          color: 'var(--muted)',
          fontSize: 12,
          padding: '7px 13px',
          cursor: 'pointer',
          fontFamily: "'DM Sans', sans-serif",
          flexShrink: 0,
        }}
      >
        {t('restTimer.skip')}
      </button>
    </div>
  );
}
