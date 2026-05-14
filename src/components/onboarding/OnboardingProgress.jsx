export default function OnboardingProgress({ current, total }) {
  return (
    <div style={{ display: 'flex', gap: 4, padding: '0 20px' }}>
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            height: 3,
            borderRadius: 2,
            background: i < current ? 'var(--accent)' : 'var(--border)',
            transition: 'background 0.3s',
          }}
        />
      ))}
    </div>
  );
}
