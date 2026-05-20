/**
 * OptionCard — tarjeta seleccionable para el onboarding.
 * Soporta selección única y múltiple.
 * Si disabled=true, se muestra en gris con un mensaje de requisito.
 */

export default function OptionCard({
  id,
  label,
  description,
  detail,
  selected,
  disabled = false,
  disabledReason,
  multi = false,
  onClick,
}) {
  return (
    <div
      onClick={disabled ? undefined : onClick}
      style={{
        background: selected ? 'var(--accent-tint)' : 'var(--surface)',
        border: 'var(--border-width) solid',
        borderColor: selected ? 'var(--accent)' : disabled ? 'var(--border)' : 'var(--border)',
        borderRadius: 10,
        padding: '14px 16px',
        marginBottom: 8,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'all 0.15s',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
      }}
      onPointerDown={(e) => { if (!disabled) e.currentTarget.style.background = 'var(--surface2)'; }}
      onPointerUp={(e) => { if (!disabled) e.currentTarget.style.background = selected ? 'var(--accent-tint)' : 'var(--surface)'; }}
      onPointerLeave={(e) => { if (!disabled) e.currentTarget.style.background = selected ? 'var(--accent-tint)' : 'var(--surface)'; }}
    >
      {/* Indicador de selección */}
      <div style={{
        width: multi ? 18 : 18,
        height: multi ? 18 : 18,
        borderRadius: multi ? 4 : '50%',
        border: '2px solid',
        borderColor: selected ? 'var(--accent)' : 'var(--border)',
        background: selected ? 'var(--accent)' : 'transparent',
        flexShrink: 0,
        marginTop: 2,
        transition: 'all 0.15s',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {selected && (
          <span style={{ fontSize: 10, color: '#0d0d0d', fontWeight: 700 }}>✓</span>
        )}
      </div>

      {/* Texto */}
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: disabled ? 'var(--muted)' : 'var(--text)' }}>
          {label}
        </div>
        {description && (
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3, lineHeight: 1.5 }}>
            {description}
          </div>
        )}
        {disabled && disabledReason && (
          <div style={{ fontSize: 11, color: 'var(--accent)', marginTop: 4, opacity: 0.7 }}>
            {disabledReason}
          </div>
        )}
        {selected && detail && (
          <div style={{
            fontSize: 11,
            color: 'var(--accent)',
            marginTop: 8,
            padding: '8px 10px',
            background: 'var(--accent-tint)',
            borderRadius: 6,
            lineHeight: 1.6,
          }}>
            {detail}
          </div>
        )}
      </div>
    </div>
  );
}
