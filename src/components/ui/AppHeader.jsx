import { useState, useEffect } from 'react';

export default function AppHeader() {
  const [dateStr, setDateStr] = useState('');
  const [timeStr, setTimeStr] = useState('');

  function update() {
    const now = new Date();
    setDateStr(now.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' }));
    setTimeStr(now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }));
  }

  useEffect(() => {
    update();
    const id = setInterval(update, 30000);
    return () => clearInterval(id);
  }, []);

  return (
    <header style={{
      padding: '20px 20px 14px',
      borderBottom: '1px solid var(--border)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      position: 'sticky',
      top: 0,
      background: 'var(--bg)',
      zIndex: 20,
    }}>
      <div>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 26, letterSpacing: 1, color: 'var(--accent)' }}>
          FUERZA &amp; CONTROL
        </div>
        <div style={{ fontSize: 10, color: 'var(--muted)', letterSpacing: 1, textTransform: 'uppercase' }}>
          Workout Tracker
        </div>
      </div>
      <div style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'right', lineHeight: 1.5 }}>
        {dateStr}<br />{timeStr}
      </div>
    </header>
  );
}
