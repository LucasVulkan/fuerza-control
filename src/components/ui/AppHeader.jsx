import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../store/useStore';

const THEMES = [
  { id: 'dark',     label: 'Dark',     bg: '#0d0d0d', ring: '#e8ff47' },
  { id: 'midnight', label: 'Midnight', bg: '#04091a', ring: '#00c8f0' },
  { id: 'earthy',   label: 'Earthy',   bg: '#dbd5c8', ring: '#6a9458' },
  { id: 'sharp',    label: 'Sharp',    bg: '#0a0a0a', ring: '#ffffff' },
  { id: 'space',    label: 'Space',    bg: '#efefef', ring: '#111111' },
];

function useDateTime(locale) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);
  const date = now.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' });
  const time = now.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  return `${date} · ${time}`;
}

export default function AppHeader({ onImportFile }) {
  const { t, i18n } = useTranslation();
  const navigate            = useStore((s) => s.navigate);
  const profile             = useStore((s) => s.profile);
  const setProfile          = useStore((s) => s.setProfile);
  const setLanguage         = useStore((s) => s.setLanguage);
  const exportFullBackup    = useStore((s) => s.exportFullBackup);
  const exportProgramWithLog = useStore((s) => s.exportProgramWithLog);

  const isPro = profile.isPro ?? true;
  const currentLang = profile.language ?? 'es';

  const [menuOpen, setMenuOpen] = useState(false);
  const fileInputRef = useRef(null);

  const localeCode = currentLang === 'en' ? 'en-US' : 'es-ES';
  const dateTime = useDateTime(localeCode);

  const currentTheme = profile.theme ?? 'dark';

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', currentTheme);
  }, [currentTheme]);

  function handleTheme(themeId) {
    setProfile({ theme: themeId });
    document.documentElement.setAttribute('data-theme', themeId);
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setMenuOpen(false);
    onImportFile(file);
  }

  function handleLangToggle() {
    setLanguage(currentLang === 'es' ? 'en' : 'es');
  }

  return (
    <>
      <div style={{
        padding: '12px 20px',
        borderBottom: 'var(--border-width) solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'var(--bg)', position: 'sticky', top: 0, zIndex: 20,
      }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, letterSpacing: 2, color: 'var(--accent)' }}>
          F&C
        </div>
        <div style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: 0.5 }}>
          {dateTime}
        </div>
        <button
          onClick={() => setMenuOpen((o) => !o)}
          style={{ background: 'none', border: 'none', color: menuOpen ? 'var(--accent)' : 'var(--muted)', fontSize: 26, cursor: 'pointer', padding: '4px 8px', lineHeight: 1 }}
        >
          ≡
        </button>
      </div>

      <input ref={fileInputRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleFileChange} />

      {menuOpen && (
        <>
          <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 29 }} />
          <div style={{
            position: 'fixed', top: 53, right: 16,
            background: 'var(--surface)', border: 'var(--border-width) solid var(--border-card)',
            borderRadius: 'var(--radius-card)', zIndex: 30, minWidth: 210, overflow: 'hidden',
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          }}>
            <MenuItem label={t('header.newProgram')} onClick={() => { setMenuOpen(false); navigate('onboarding'); }} />
            <MenuItem label={t('header.archivedPrograms')} onClick={() => { setMenuOpen(false); navigate('archivedPrograms'); }} />

            <SectionLabel label={t('header.exportSection')} />
            <MenuItem label={t('header.fullBackup')} onClick={() => { setMenuOpen(false); exportFullBackup(); }} />
            <MenuItem label={t('header.programAndHistory')} onClick={() => { setMenuOpen(false); exportProgramWithLog(); }} />

            <SectionLabel label={t('header.importSection')} />
            <MenuItem label={t('header.importFile')} onClick={() => { setMenuOpen(false); fileInputRef.current?.click(); }} />

            <SectionLabel label={t('header.developer')} />
            <div style={{ padding: '8px 16px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: 'var(--border-width) solid var(--border)' }}>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                {t('header.plan')}{' '}
                <span style={{ color: isPro ? 'var(--accent)' : 'var(--muted2)', fontWeight: 500 }}>
                  {isPro ? 'PRO' : 'FREE'}
                </span>
              </span>
              <button
                onClick={() => setProfile({ isPro: !isPro })}
                style={{
                  background: isPro ? 'var(--accent-tint-active)' : 'var(--surface2)',
                  border: 'var(--border-width) solid',
                  borderColor: isPro ? 'var(--accent-tint-border)' : 'var(--border)',
                  borderRadius: 6,
                  color: isPro ? 'var(--accent)' : 'var(--muted)',
                  fontFamily: 'var(--font-body)',
                  fontSize: 11,
                  padding: '4px 10px',
                  cursor: 'pointer',
                }}
              >
                {isPro ? t('header.switchToFree') : t('header.switchToPro')}
              </button>
            </div>

            <SectionLabel label={t('header.language')} />
            <div style={{ padding: '6px 12px 10px', display: 'flex', gap: 6, borderBottom: 'var(--border-width) solid var(--border)' }}>
              {['es', 'en'].map((lang) => {
                const active = currentLang === lang;
                return (
                  <button
                    key={lang}
                    onClick={() => { if (!active) setLanguage(lang); }}
                    style={{
                      flex: 1,
                      background: active ? 'var(--accent-tint-active)' : 'var(--surface2)',
                      border: 'var(--border-width) solid',
                      borderColor: active ? 'var(--accent-tint-border)' : 'var(--border)',
                      borderRadius: 6,
                      color: active ? 'var(--accent)' : 'var(--muted)',
                      fontFamily: 'var(--font-body)',
                      fontSize: 12,
                      padding: '6px 0',
                      cursor: active ? 'default' : 'pointer',
                    }}
                  >
                    {lang === 'es' ? '🇪🇸 ES' : '🇺🇸 EN'}
                  </button>
                );
              })}
            </div>

            <SectionLabel label={t('header.theme')} />
            <div style={{ padding: '6px 12px 10px', display: 'flex', gap: 8 }}>
              {THEMES.map((t_) => {
                const active = currentTheme === t_.id;
                return (
                  <button
                    key={t_.id}
                    onClick={() => handleTheme(t_.id)}
                    title={t_.label}
                    style={{
                      width: 26, height: 26, borderRadius: '50%',
                      background: t_.bg,
                      border: `2px solid ${t_.ring}`,
                      boxShadow: active ? `0 0 0 2px ${t_.ring}` : 'none',
                      opacity: active ? 1 : 0.45,
                      cursor: 'pointer', padding: 0,
                      transition: 'opacity 0.15s, box-shadow 0.15s',
                    }}
                  />
                );
              })}
            </div>
          </div>
        </>
      )}
    </>
  );
}

function SectionLabel({ label }) {
  return (
    <div style={{ padding: '8px 16px 4px', fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--muted)', borderTop: 'var(--border-width) solid var(--border)' }}>
      {label}
    </div>
  );
}

function MenuItem({ label, onClick, danger }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', background: 'none', border: 'none',
        borderBottom: 'var(--border-width) solid var(--border)',
        color: danger ? 'var(--red)' : 'var(--text)',
        fontFamily: 'var(--font-body)', fontSize: 13,
        padding: '12px 16px', cursor: 'pointer', textAlign: 'left', display: 'block',
      }}
      onPointerDown={(e) => e.currentTarget.style.background = 'var(--surface2)'}
      onPointerUp={(e) => e.currentTarget.style.background = 'none'}
      onPointerLeave={(e) => e.currentTarget.style.background = 'none'}
    >
      {label}
    </button>
  );
}
