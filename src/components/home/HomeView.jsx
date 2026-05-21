import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore, selectActiveProgram } from '../../store/useStore';
import DayCard from './DayCard';
import HistoryView from '../history/HistoryView';
import StatsView from '../stats/StatsView';
import ClientsView from '../program/ClientsView';
import TemplatesView from '../program/TemplatesView';

const BOTTOM_BAR_HEIGHT = 64;

export default function HomeView() {
  const { t } = useTranslation();
  const ui = useStore((s) => s.ui);
  const [activeTab, setActiveTab] = useState(ui.homeTab ?? 'session');
  const [archiveModal, setArchiveModal] = useState(false);
  const [clientsKey, setClientsKey] = useState(0);

  const TABS = [
    { id: 'session',   label: t('tabs.session'),   icon: '🏋️' },
    { id: 'history',   label: t('tabs.history'),   icon: '📋' },
    { id: 'progress',  label: t('tabs.progress'),  icon: '📈' },
    { id: 'clients',   label: t('tabs.clients'),   icon: '👥' },
    { id: 'templates', label: t('tabs.templates'), icon: '📐' },
  ];

  function handleTabClick(tabId) {
    if (tabId === 'clients' && activeTab === 'clients') {
      setClientsKey((k) => k + 1);
    }
    setActiveTab(tabId);
  }

  const activeProgram    = useStore(selectActiveProgram);
  const activeSession    = useStore((s) => s.activeSession);
  const getEffectiveTemplate = useStore((s) => s.getEffectiveTemplate);
  const getLastSession   = useStore((s) => s.getLastSession);
  const startSession     = useStore((s) => s.startSession);
  const navigate         = useStore((s) => s.navigate);
  const archiveProgram   = useStore((s) => s.archiveProgram);
  const exerciseLibrary  = useStore((s) => s.exerciseLibrary);
  const customExercises  = useStore((s) => s.customExercises);
  const allExercises = { ...exerciseLibrary, ...customExercises };

  function handleArchiveConfirm(clearHistory) {
    if (activeProgram) {
      archiveProgram(activeProgram.id, clearHistory);
    }
    setArchiveModal(false);
  }

  return (
    <div style={{ paddingBottom: BOTTOM_BAR_HEIGHT }}>
      {activeTab === 'session'  && (
        <SessionTab
          activeProgram={activeProgram}
          getEffectiveTemplate={getEffectiveTemplate}
          getLastSession={getLastSession}
          startSession={startSession}
          navigate={navigate}
          activeSession={activeSession}
          onArchive={() => setArchiveModal(true)}
          allExercises={allExercises}
        />
      )}
      {activeTab === 'history'  && <HistoryView embedded />}
      {activeTab === 'progress' && <StatsView embedded />}
      {activeTab === 'clients'    && <ClientsView key={clientsKey} />}
      {activeTab === 'templates'  && <TemplatesView />}

      {/* Bottom bar */}
      <div style={{
        position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: 480, height: BOTTOM_BAR_HEIGHT,
        background: 'var(--surface)', borderTop: 'var(--border-width) solid var(--border)',
        display: 'flex', zIndex: 20,
      }}>
        {TABS.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              style={{
                flex: 1, background: 'none', border: 'none', cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', gap: 3, padding: '8px 0',
                color: active ? 'var(--accent)' : 'var(--muted)',
                transition: 'color 0.15s', position: 'relative',
              }}
            >
              {active && (
                <div style={{
                  position: 'absolute', top: 0, width: 24, height: 2,
                  background: 'var(--accent)', borderRadius: '0 0 2px 2px',
                }} />
              )}
              <span style={{ fontSize: 18, lineHeight: 1 }}>{tab.icon}</span>
              <span style={{
                fontSize: 9, letterSpacing: 0.5, textTransform: 'uppercase',
                fontFamily: "'DM Sans', sans-serif", fontWeight: active ? 500 : 400,
              }}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>

      {archiveModal && (
        <ArchiveModal
          programName={activeProgram?.name}
          onConfirm={handleArchiveConfirm}
          onClose={() => setArchiveModal(false)}
        />
      )}
    </div>
  );
}

function SessionTab({ activeProgram, getEffectiveTemplate, getLastSession, startSession, navigate, activeSession, onArchive, allExercises }) {
  const { t } = useTranslation();
  const advanceStage        = useStore((s) => s.advanceStage);
  const dismissStageAdvance = useStore((s) => s.dismissStageAdvance);
  const setCurrentStage     = useStore((s) => s.setCurrentStage);

  const [stagePicker, setStagePicker] = useState(false);

  if (!activeProgram) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--muted)', fontSize: 13, lineHeight: 1.8 }}>
        <span style={{ display: 'block', fontSize: 32, marginBottom: 12 }}>🏋️</span>
        {t('home.noActiveProgram')}
        <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 240, margin: '20px auto 0' }}>
          <button
            onClick={() => navigate('onboarding')}
            style={{
              background: 'var(--accent)', border: 'none', borderRadius: 10,
              color: '#0d0d0d', fontFamily: "'Bebas Neue', sans-serif",
              fontSize: 18, letterSpacing: 1, padding: '13px 24px', cursor: 'pointer',
            }}
          >
            {t('home.newProgram')}
          </button>
        </div>
      </div>
    );
  }

  const hasStages       = (activeProgram.stages?.length ?? 0) > 0;
  const currentStageIdx = activeProgram.currentStageIndex ?? 0;
  const currentStage    = hasStages ? activeProgram.stages[currentStageIdx] : null;
  const nextStage       = hasStages ? activeProgram.stages[currentStageIdx + 1] : null;
  const sessionsCompleted = activeProgram.stageSessionsCompleted ?? 0;
  const threshold         = currentStage
    ? currentStage.durationWeeks * (currentStage.days?.length || 1)
    : 0;
  const progress = threshold > 0 ? Math.min(1, sessionsCompleted / threshold) : 0;

  return (
    <div style={{ borderTop: 'var(--border-width) solid var(--border)' }}>
      <div style={{ padding: '12px 20px 4px' }}>
        <p style={{ fontSize: 9, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--muted)' }}>{t('home.activeProgram')}</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
          <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', margin: 0, flex: 1, minWidth: 0 }}>{activeProgram.name}</p>
          {hasStages && (
            <button
              onClick={() => setStagePicker(true)}
              style={{
                fontSize: 9, letterSpacing: 1, textTransform: 'uppercase',
                background: 'var(--accent-tint-active)', color: 'var(--accent)',
                border: 'var(--border-width) solid var(--accent-tint-border)',
                borderRadius: 4, padding: '2px 8px', flexShrink: 0,
                cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
                display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              {currentStage?.name ?? `Etapa ${currentStageIdx + 1}`}
              <span style={{ fontSize: 8, opacity: 0.7 }}>▾</span>
            </button>
          )}
        </div>
        {hasStages && threshold > 0 && (
          <div style={{ marginTop: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 10, color: 'var(--muted)' }}>
                {t('home.stageProgress', { completed: sessionsCompleted, total: threshold })}
              </span>
              <span style={{ fontSize: 10, color: 'var(--muted)' }}>
                {t('home.stageCount', { current: currentStageIdx + 1, total: activeProgram.stages.length })}
              </span>
            </div>
            <div style={{ height: 3, background: 'var(--surface2)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{
                height: '100%', width: `${Math.round(progress * 100)}%`,
                background: 'var(--accent)', borderRadius: 2,
                transition: 'width 0.4s ease',
              }} />
            </div>
          </div>
        )}
      </div>

      {/* Stage picker modal */}
      {stagePicker && hasStages && (
        <>
          <div onClick={() => setStagePicker(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 49 }} />
          <div style={{
            position: 'fixed', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'var(--surface)', border: 'var(--border-width) solid var(--border-card)',
            borderRadius: 'var(--radius-card)', zIndex: 50,
            width: 'calc(100% - 40px)', maxWidth: 320,
            padding: '18px', boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
          }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, letterSpacing: 1, marginBottom: 12 }}>
              {t('home.selectStage')}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {activeProgram.stages.map((stage, idx) => {
                const isActive = idx === currentStageIdx;
                return (
                  <button
                    key={stage.id ?? idx}
                    onClick={() => {
                      if (!isActive) setCurrentStage(activeProgram.id, idx);
                      setStagePicker(false);
                    }}
                    style={{
                      background: isActive ? 'var(--accent-tint-active)' : 'var(--surface2)',
                      border: 'var(--border-width) solid',
                      borderColor: isActive ? 'var(--accent-tint-border)' : 'var(--border)',
                      borderRadius: 8, padding: '12px 14px',
                      cursor: isActive ? 'default' : 'pointer',
                      textAlign: 'left', width: '100%',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 13, fontWeight: 500, color: isActive ? 'var(--accent)' : 'var(--text)', fontFamily: 'var(--font-body)' }}>
                        {stage.name}
                      </span>
                      {isActive && (
                        <span style={{ fontSize: 9, letterSpacing: 1, color: 'var(--accent)', textTransform: 'uppercase' }}>{t('home.activeStage')}</span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                      {stage.durationWeeks ?? 4} semanas · {stage.days?.length ?? 0} sesiones/semana
                    </div>
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setStagePicker(false)}
              style={{
                marginTop: 12, width: '100%', background: 'none',
                border: 'var(--border-width) solid var(--border)', borderRadius: 'var(--radius-btn)',
                color: 'var(--muted)', fontFamily: 'var(--font-body)', fontSize: 12,
                padding: '10px', cursor: 'pointer',
              }}
            >
              {t('common.cancel')}
            </button>
          </div>
        </>
      )}

      {/* Banner de avance de etapa */}
      {activeProgram.stageAdvancePending && nextStage && (
        <div style={{
          margin: '10px 20px 0',
          background: 'var(--accent-tint)',
          border: 'var(--border-width) solid var(--accent-tint-border)',
          borderRadius: 10, padding: '14px 16px',
        }}>
          <div style={{ fontSize: 10, color: 'var(--accent)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4 }}>
            {t('home.stageCompleted')}
          </div>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 10 }}>
            {t('home.stageAdvanceText', { current: currentStage?.name, next: nextStage.name })}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => advanceStage(activeProgram.id)}
              style={{
                flex: 2, background: 'var(--accent)', border: 'none', borderRadius: 8,
                color: '#0d0d0d', fontFamily: "'Bebas Neue', sans-serif",
                fontSize: 15, letterSpacing: 1, padding: '10px 0', cursor: 'pointer',
              }}
            >
              {t('home.advanceTo', { name: nextStage.name.toUpperCase() })}
            </button>
            <button
              onClick={() => dismissStageAdvance(activeProgram.id)}
              style={{
                flex: 1, background: 'none',
                border: 'var(--border-width) solid var(--accent-tint-border)',
                borderRadius: 8, color: 'var(--muted)',
                fontFamily: "'DM Sans', sans-serif", fontSize: 12,
                padding: '10px 0', cursor: 'pointer',
              }}
            >
              {t('home.continueStage')}
            </button>
          </div>
        </div>
      )}

      <div style={{ padding: '8px 20px 4px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <p style={{ fontSize: 9, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 2 }}>
          {t('home.selectSession')}
        </p>
        {activeProgram.days.map(({ sessionTemplateId }) => {
          const template = getEffectiveTemplate(sessionTemplateId);
          if (!template) return null;
          const lastSession = getLastSession(sessionTemplateId);
          const isActive = activeSession?.templateId === sessionTemplateId;
          return (
            <DayCard
              key={sessionTemplateId}
              template={template}
              lastSession={lastSession}
              exerciseLibrary={allExercises}
              isActive={isActive}
              onClick={isActive ? () => navigate('workout') : () => startSession(sessionTemplateId)}
            />
          );
        })}
      </div>

      <div style={{ padding: '12px 20px 80px' }}>
        <p style={{ fontSize: 9, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 }}>{t('home.program')}</p>
        <div style={{ display: 'flex', gap: 8 }}>
          <ProgramBtn label={t('home.viewProgram')} onClick={() => navigate('programPrint')} accent />
          <ProgramBtn label={t('home.edit')} onClick={() => navigate('programEditor')} accent />
          <ProgramBtn label={t('home.archive')} onClick={onArchive} danger />
        </div>
      </div>
    </div>
  );
}

function ArchiveModal({ programName, onConfirm, onClose }) {
  const { t } = useTranslation();
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 49 }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        background: 'var(--surface)', border: 'var(--border-width) solid var(--border-card)',
        borderRadius: 'var(--radius-card)', zIndex: 50,
        width: 'calc(100% - 40px)', maxWidth: 380, padding: '20px',
        boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
      }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, letterSpacing: 1, marginBottom: 6 }}>
          {t('home.archiveModal.title')}
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16, lineHeight: 1.6 }}>
          <strong style={{ color: 'var(--text)' }}>{programName}</strong>
          <br />{t('home.archiveModal.desc')}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <ArchiveOption
            label={t('home.archiveModal.keepHistory')}
            desc={t('home.archiveModal.keepHistoryDesc')}
            onClick={() => onConfirm(false)}
          />
          <ArchiveOption
            label={t('home.archiveModal.clearHistory')}
            desc={t('home.archiveModal.clearHistoryDesc')}
            onClick={() => onConfirm(true)}
            danger
          />
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'var(--border-width) solid var(--border)',
              borderRadius: 'var(--radius-btn)', color: 'var(--muted)',
              fontFamily: 'var(--font-body)', fontSize: 12,
              padding: '10px', cursor: 'pointer', marginTop: 4,
            }}
          >
            {t('common.cancel')}
          </button>
        </div>
      </div>
    </>
  );
}

function ArchiveOption({ label, desc, onClick, danger }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'var(--surface2)', border: 'var(--border-width) solid',
        borderColor: danger ? 'rgba(248,113,113,0.3)' : 'var(--border)',
        borderRadius: 'var(--radius-btn)', padding: '12px 14px',
        cursor: 'pointer', textAlign: 'left', width: '100%',
        transition: 'border-color 0.15s',
      }}
      onPointerDown={(e) => e.currentTarget.style.borderColor = danger ? 'var(--red)' : 'var(--accent)'}
      onPointerUp={(e) => e.currentTarget.style.borderColor = danger ? 'rgba(248,113,113,0.3)' : 'var(--border)'}
      onPointerLeave={(e) => e.currentTarget.style.borderColor = danger ? 'rgba(248,113,113,0.3)' : 'var(--border)'}
    >
      <div style={{ fontSize: 13, fontWeight: 500, color: danger ? 'var(--red)' : 'var(--text)', fontFamily: 'var(--font-body)' }}>{label}</div>
      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>{desc}</div>
    </button>
  );
}

function ProgramBtn({ label, onClick, accent, danger }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        background: danger ? 'rgba(248,113,113,0.07)' : accent ? 'var(--accent-tint)' : 'var(--surface)',
        border: 'var(--border-width) solid',
        borderColor: danger ? 'rgba(248,113,113,0.3)' : accent ? 'var(--accent-tint-border)' : 'var(--border)',
        borderRadius: 8, padding: '8px 4px', cursor: 'pointer',
        color: danger ? 'var(--red)' : accent ? 'var(--accent)' : 'var(--muted)',
        fontFamily: "'DM Sans', sans-serif", fontSize: 11, letterSpacing: 0.3,
        transition: 'background 0.15s',
      }}
      onPointerDown={(e) => e.currentTarget.style.background = 'var(--surface2)'}
      onPointerUp={(e) => e.currentTarget.style.background = danger ? 'rgba(248,113,113,0.07)' : accent ? 'var(--accent-tint)' : 'var(--surface)'}
      onPointerLeave={(e) => e.currentTarget.style.background = danger ? 'rgba(248,113,113,0.07)' : accent ? 'var(--accent-tint)' : 'var(--surface)'}
    >
      {label}
    </button>
  );
}
