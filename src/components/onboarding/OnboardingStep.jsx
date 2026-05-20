/**
 * OnboardingStep — contenedor reutilizable para cada pantalla del onboarding.
 * Muestra título, subtítulo, opciones y botones de navegación.
 */

export default function OnboardingStep({
  title,
  subtitle,
  children,
  onNext,
  onBack,
  nextLabel = 'Siguiente',
  nextDisabled = false,
  showBack = true,
  isLast = false,
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '24px 20px 32px' }}>
      {/* Título */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{
          fontFamily: "'Bebas Neue', sans-serif",
          fontSize: 32,
          letterSpacing: 1,
          lineHeight: 1.1,
          color: 'var(--text)',
          marginBottom: 8,
        }}>
          {title}
        </h2>
        {subtitle && (
          <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
            {subtitle}
          </p>
        )}
      </div>

      {/* Contenido — opciones */}
      <div style={{ flex: 1 }}>
        {children}
      </div>

      {/* Botones de navegación */}
      <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
        {showBack && (
          <button
            onClick={onBack}
            style={{
              background: 'var(--surface)',
              border: 'var(--border-width) solid var(--border)',
              borderRadius: 10,
              color: 'var(--text)',
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 14,
              padding: '14px 20px',
              cursor: 'pointer',
            }}
          >
            ‹ Atrás
          </button>
        )}
        <button
          onClick={onNext}
          disabled={nextDisabled}
          style={{
            flex: 1,
            background: nextDisabled ? 'var(--surface2)' : 'var(--accent)',
            border: 'none',
            borderRadius: 10,
            color: nextDisabled ? 'var(--muted)' : '#0d0d0d',
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: 20,
            letterSpacing: 1.5,
            padding: '14px 0',
            cursor: nextDisabled ? 'not-allowed' : 'pointer',
            transition: 'background 0.2s',
          }}
        >
          {isLast ? '🏋️ GENERAR PROGRAMA' : nextLabel + ' ›'}
        </button>
      </div>
    </div>
  );
}
