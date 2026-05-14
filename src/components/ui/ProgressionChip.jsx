/**
 * ProgressionChip — chip de recomendación de progresión.
 * type: 'up' | 'hold' | 'down' | 'info'
 */

const CHIP_STYLES = {
  up:   { background: 'rgba(74,222,128,0.08)',  border: '1px solid rgba(74,222,128,0.2)',  color: 'var(--green)' },
  hold: { background: 'rgba(126,184,255,0.08)', border: '1px solid rgba(126,184,255,0.2)', color: 'var(--accent3)' },
  down: { background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', color: 'var(--red)' },
  info: { background: 'rgba(232,255,71,0.06)',  border: '1px solid rgba(232,255,71,0.15)', color: 'var(--accent)' },
};

export default function ProgressionChip({ progression }) {
  if (!progression) return null;
  const style = CHIP_STYLES[progression.type] ?? CHIP_STYLES.info;

  return (
    <div style={{
      margin: '0 14px 10px',
      padding: '8px 12px',
      borderRadius: 6,
      fontSize: 11,
      lineHeight: 1.5,
      display: 'flex',
      alignItems: 'flex-start',
      gap: 8,
      ...style,
    }}>
      <span style={{ flexShrink: 0, fontSize: 13 }}>{progression.icon}</span>
      <span>{progression.msg}</span>
    </div>
  );
}
