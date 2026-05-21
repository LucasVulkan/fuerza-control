// PRO FEATURE — Gestión de clientes

import { useState, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../store/useStore';
import SessionCard from '../history/SessionCard';
import ExerciseStatCard from '../stats/ExerciseStatCard';

export default function ClientsView() {
  const { t } = useTranslation();

  const clients                = useStore((s) => s.clients);
  const programs               = useStore((s) => s.programs);
  const workoutLog             = useStore((s) => s.workoutLog);
  const exerciseLibrary        = useStore((s) => s.exerciseLibrary);
  const customExercises        = useStore((s) => s.customExercises);
  const createClient           = useStore((s) => s.createClient);
  const deleteClient           = useStore((s) => s.deleteClient);
  const renameClient           = useStore((s) => s.renameClient);
  const createProgramForClient = useStore((s) => s.createProgramForClient);
  const deleteProgram          = useStore((s) => s.deleteProgram);
  const setEditingProgram      = useStore((s) => s.setEditingProgram);
  const setPrintingProgram     = useStore((s) => s.setPrintingProgram);
  const exportSpecificProgram  = useStore((s) => s.exportSpecificProgram);
  const sessionTemplates       = useStore((s) => s.sessionTemplates);
  const userPrograms           = useStore((s) => s.userPrograms);
  const showToast              = useStore((s) => s.showToast);
  const importForClient       = useStore((s) => s.importForClient);
  const setClientActiveProgram = useStore((s) => s.setClientActiveProgram);
  const updateClientInfo          = useStore((s) => s.updateClientInfo);
  const addClientBilling          = useStore((s) => s.addClientBilling);
  const updateClientBillingStatus = useStore((s) => s.updateClientBillingStatus);
  const removeClientBilling       = useStore((s) => s.removeClientBilling);
  const addClientBodyWeight       = useStore((s) => s.addClientBodyWeight);
  const removeClientBodyWeight    = useStore((s) => s.removeClientBodyWeight);
  const deleteLogEntry            = useStore((s) => s.deleteLogEntry);
  const cloneProgramFromTemplate  = useStore((s) => s.cloneProgramFromTemplate);
  const programs_raw              = useStore((s) => s.programs);

  const allExercises = { ...exerciseLibrary, ...customExercises };

  const CLIENT_TABS = [
    { id: 'programs',  label: t('clients.tabs.programs'),  icon: '🏋️' },
    { id: 'history',   label: t('clients.tabs.history'),   icon: '📋' },
    { id: 'progress',  label: t('clients.tabs.progress'),  icon: '📈' },
    { id: 'info',      label: t('clients.tabs.info'),      icon: '📝' },
  ];

  const PERIOD_OPTIONS = [
    { id: '7d',  label: t('clients.period.7d') },
    { id: '30d', label: t('clients.period.30d') },
    { id: 'all', label: t('clients.period.all') },
  ];

  function getAllProgramDays(p) {
    if (p.stages?.length > 0) {
      return p.stages.flatMap((st) => st.days ?? []);
    }
    return p.days ?? [];
  }

  const templatePrograms = useMemo(
    () => Object.values(programs_raw ?? {})
      .filter((p) => p.mode === 'template')
      .sort((a, b) => a.name.localeCompare(b.name)),
    [programs_raw]
  );

  const [selectedClientId, setSelectedClientId] = useState(null);
  const [activeTab, setActiveTab] = useState('programs');
  const [showNewClient, setShowNewClient] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [showNewProgram, setShowNewProgram] = useState(false);
  const [newProgramName, setNewProgramName] = useState('');
  const [newProgramSessions, setNewProgramSessions] = useState(3);
  const [importFile, setImportFile] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);

  function openContextMenu(e, programId) {
    const rect = e.currentTarget.getBoundingClientRect();
    setContextMenu({ programId, x: rect.right, y: rect.top });
  }
  const [editingClientId, setEditingClientId] = useState(null);
  const [editingClientName, setEditingClientName] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [showGlobalBilling, setShowGlobalBilling] = useState(false);
  const [scopeFilter, setScopeFilter] = useState('active');
  const [periodFilter, setPeriodFilter] = useState('all');
  const [openSections, setOpenSections] = useState({ personal: true, weight: false, billing: false });
  const [weightDate, setWeightDate] = useState(new Date().toISOString().split('T')[0]);
  const [weightValue, setWeightValue] = useState('');
  const [billDate, setBillDate] = useState(new Date().toISOString().split('T')[0]);
  const [billConcept, setBillConcept] = useState('');
  const [billAmount, setBillAmount] = useState('');
  const [billStatus, setBillStatus] = useState('pending');
  const [newProgramTab, setNewProgramTab] = useState('blank');
  const [fromTemplateId, setFromTemplateId] = useState('');
  const [fromTemplateName, setFromTemplateName] = useState('');

  function toggleSection(id) {
    setOpenSections((s) => ({ ...s, [id]: !s[id] }));
  }

  const clientList = useMemo(
    () => Object.values(clients ?? {})
      .filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
      .filter((c) => {
        const s = c.status ?? 'active';
        if (statusFilter === 'active')   return s !== 'inactive';
        if (statusFilter === 'inactive') return s === 'inactive';
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name)),
    [clients, search, statusFilter]
  );

  const selectedClient = selectedClientId ? clients[selectedClientId] : null;

  const clientPrograms = useMemo(() => {
    if (!selectedClient) return [];
    return (selectedClient.programIds ?? [])
      .map((id) => programs[id])
      .filter(Boolean)
      .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
  }, [selectedClient, programs]);

  const allClientTemplateIds = useMemo(() => {
    return new Set(clientPrograms.flatMap((p) => getAllProgramDays(p).map((d) => d.sessionTemplateId)));
  }, [clientPrograms]);

  const activeClientTemplateIds = useMemo(() => {
    if (!selectedClient?.activeProgramId) return new Set();
    const activeProg = programs[selectedClient.activeProgramId];
    if (!activeProg) return new Set();
    return new Set(getAllProgramDays(activeProg).map((d) => d.sessionTemplateId));
  }, [selectedClient, programs]);

  const filteredLog = useMemo(() => {
    const templateIds = scopeFilter === 'active' ? activeClientTemplateIds : allClientTemplateIds;
    let log = workoutLog.filter((e) => templateIds.has(e.sessionTemplateId));
    if (periodFilter !== 'all') {
      const days = periodFilter === '7d' ? 7 : 30;
      const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
      log = log.filter((e) => e.timestamp >= cutoff);
    }
    return log.sort((a, b) => b.timestamp - a.timestamp);
  }, [workoutLog, scopeFilter, periodFilter, activeClientTemplateIds, allClientTemplateIds]);

  const exercisesWithLogs = useMemo(() => {
    const ids = [...new Set(
      filteredLog.flatMap((log) =>
        log.exercises
          .filter((e) => e.sets.some((s) => s.done || s.weight || s.reps || s.time))
          .map((e) => e.exerciseId)
      )
    )];
    return ids;
  }, [filteredLog]);

  function getExerciseLogs(exerciseId) {
    return filteredLog
      .filter((log) => log.exercises.some((e) => e.exerciseId === exerciseId && e.sets.some((s) => s.done || s.weight || s.reps || s.time)))
      .slice(-6)
      .map((log) => ({ timestamp: log.timestamp, exercise: log.exercises.find((e) => e.exerciseId === exerciseId) }));
  }

  function getSessionCount(program) {
    const templateIds = new Set(getAllProgramDays(program).map((d) => d.sessionTemplateId));
    return workoutLog.filter((e) => templateIds.has(e.sessionTemplateId)).length;
  }

  function getLastActivity(program) {
    const templateIds = new Set(getAllProgramDays(program).map((d) => d.sessionTemplateId));
    const sessions = workoutLog.filter((e) => templateIds.has(e.sessionTemplateId));
    if (!sessions.length) return null;
    return Math.max(...sessions.map((e) => e.timestamp));
  }

  function handleSelectClient(clientId) {
    setSelectedClientId(clientId);
    setActiveTab('programs');
    setScopeFilter('active');
    setPeriodFilter('all');
    setOpenSections({ personal: true, weight: false, billing: false });
  }

  function handleCreateClient() {
    if (!newClientName.trim()) return;
    createClient(newClientName);
    setNewClientName('');
    setShowNewClient(false);
  }

  function handleCreateProgram() {
    if (!newProgramName.trim() || !selectedClientId) return;
    createProgramForClient(selectedClientId, newProgramSessions, newProgramName);
    setNewProgramName('');
    setShowNewProgram(false);
  }

  function handleCreateFromTemplate() {
    if (!fromTemplateId || !selectedClientId) return;
    const srcName = templatePrograms.find((p) => p.id === fromTemplateId)?.name ?? 'Programa';
    const finalName = fromTemplateName.trim() || srcName;
    cloneProgramFromTemplate(fromTemplateId, { mode: 'managed', clientId: selectedClientId, name: finalName });
    setShowNewProgram(false);
    setNewProgramTab('blank');
    setFromTemplateId('');
    setFromTemplateName('');
  }

  function handleDeleteClient(clientId) {
    if (window.confirm(t('clients.deleteClientConfirm'))) {
      deleteClient(clientId, true);
      if (selectedClientId === clientId) setSelectedClientId(null);
    }
  }

  function handleShare(program) {
    const relevantTemplates = {};
    const relevantUserPrograms = {};
    getAllProgramDays(program).forEach(({ sessionTemplateId }) => {
      if (sessionTemplates[sessionTemplateId]) relevantTemplates[sessionTemplateId] = sessionTemplates[sessionTemplateId];
      if (userPrograms[sessionTemplateId]) relevantUserPrograms[sessionTemplateId] = userPrograms[sessionTemplateId];
    });

    const json = JSON.stringify({
      version: '2', exportType: 'program',
      exportDate: new Date().toISOString().split('T')[0],
      appName: 'Fuerza & Control',
      program: { ...program, mode: 'personal', status: 'active' },
      sessionTemplates: relevantTemplates,
      userPrograms: relevantUserPrograms,
      customExercises: {}, workoutLog: [],
    }, null, 2);

    const safeName = program.name.replace(/[^a-zA-Z0-9áéíóúñ\s-]/g, '').replace(/\s+/g, '-').toLowerCase();
    downloadBlob(json, safeName);
    showToast(t('clients.toastDownloaded'));
  }

  function downloadBlob(content, fileName) {
    const safe = fileName.replace(/\.json$|\.fcdata$/i, '').replace(/[^a-zA-Z0-9áéíóúñ\s-]/g, '').replace(/\s+/g, '-').toLowerCase();
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${safe}.json`;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  }

  function handleDeleteProgram(programId) {
    deleteProgram(programId, false);
  }

  function handleAddWeight() {
    if (!weightValue || !weightDate) return;
    addClientBodyWeight(selectedClientId, weightDate, weightValue);
    setWeightValue('');
  }

  function handleAddBilling() {
    if (!billConcept.trim() || !billAmount || !billDate) return;
    addClientBilling(selectedClientId, {
      date: billDate, concept: billConcept.trim(),
      amount: parseFloat(billAmount), status: billStatus,
    });
    setBillConcept('');
    setBillAmount('');
    setBillStatus('pending');
  }

  async function handleImport(file, mode) {
    setImportFile(null);
    await importForClient(selectedClientId, file, mode);
  }

  // ── Vista global de facturación ───────────────────────────────────────────
  if (showGlobalBilling) {
    return <GlobalBillingView
      t={t}
      clients={clients}
      clientList={clientList}
      onClose={() => setShowGlobalBilling(false)}
      updateClientBillingStatus={updateClientBillingStatus}
      onSelectClient={(id) => { setShowGlobalBilling(false); setSelectedClientId(id); setActiveTab('info'); setOpenSections({ personal: false, weight: false, billing: true }); }}
    />;
  }

  // ── Lista de clientes ──────────────────────────────────────────────────────
  if (!selectedClientId) {
    return (
      <div>
        <div style={{ padding: '16px 20px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <p style={{ fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--muted)' }}>{t('clients.title')}</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setShowGlobalBilling(true)} style={{ background: 'var(--surface)', border: 'var(--border-width) solid var(--border-card)', borderRadius: 6, color: 'var(--muted)', fontFamily: "'DM Sans', sans-serif", fontSize: 13, padding: '7px 12px', cursor: 'pointer' }}>💳</button>
              <button onClick={() => setShowNewClient(true)} style={{ ...accentBtnStyle, fontSize: 16, padding: '8px 18px' }}>{t('clients.newBtn')}</button>
            </div>
          </div>
          <input
            type="text"
            placeholder={t('clients.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ ...inputStyle, fontSize: 13, padding: '9px 14px' }}
          />
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            {[
              { id: 'active',   label: t('clients.filterActive') },
              { id: 'inactive', label: t('clients.filterInactive') },
              { id: 'all',      label: t('clients.filterAll') },
            ].map(({ id, label }) => (
              <button key={id} onClick={() => setStatusFilter(id)} style={{
                flex: 1, background: statusFilter === id ? 'var(--accent-tint-active)' : 'var(--surface)',
                border: 'var(--border-width) solid', borderColor: statusFilter === id ? 'var(--accent-tint-border)' : 'var(--border)',
                borderRadius: 6, color: statusFilter === id ? 'var(--accent)' : 'var(--muted)',
                fontFamily: "'DM Sans', sans-serif", fontSize: 11, padding: '6px 4px',
                cursor: 'pointer', transition: 'all 0.15s',
              }}>{label}</button>
            ))}
          </div>
        </div>

        <div style={{ padding: '0 20px 80px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {clientList.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted)', fontSize: 13, lineHeight: 1.8 }}>
              <span style={{ display: 'block', fontSize: 32, marginBottom: 12 }}>👥</span>
              {t('clients.noClients')}
            </div>
          ) : clientList.map((client) => {
            const progCount = (client.programIds ?? []).filter((id) => programs[id]).length;
            const clientStatus = client.status ?? 'active';
            const statusDot = clientStatus === 'paused' ? 'var(--orange)' : clientStatus === 'inactive' ? 'var(--red)' : null;
            return (
              <div key={client.id} style={{ background: 'var(--surface)', border: 'var(--border-width) solid var(--border-card)', borderRadius: 10, overflow: 'hidden' }}>
                <div onClick={() => handleSelectClient(client.id)} style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                  <div>
                    {editingClientId === client.id ? (
                      <input autoFocus value={editingClientName} onClick={(e) => e.stopPropagation()}
                        onChange={(e) => setEditingClientName(e.target.value)}
                        onBlur={() => { if (editingClientName.trim()) renameClient(client.id, editingClientName); setEditingClientId(null); }}
                        onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') setEditingClientId(null); e.stopPropagation(); }}
                        style={{ background: 'var(--surface2)', border: '1px solid var(--accent)', borderRadius: 6, color: 'var(--text)', fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 500, padding: '4px 8px', outline: 'none' }} />
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        {statusDot && (
                          <span style={{ width: 7, height: 7, borderRadius: '50%', background: statusDot, flexShrink: 0, display: 'inline-block' }} />
                        )}
                        <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>{client.name}</span>
                      </div>
                    )}
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                      {t('clients.programCount', { count: progCount })}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button onClick={(e) => { e.stopPropagation(); setEditingClientId(client.id); setEditingClientName(client.name); }} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 12, cursor: 'pointer', padding: '4px 6px' }}>✎</button>
                    <button onClick={(e) => { e.stopPropagation(); handleDeleteClient(client.id); }} style={{ background: 'none', border: 'none', color: 'var(--muted2)', fontSize: 12, cursor: 'pointer', padding: '4px 6px' }}>✕</button>
                    <span style={{ color: 'var(--muted)', fontSize: 16 }}>›</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {showNewClient && (
          <SimpleModal title={t('clients.newClientModal.title')} onClose={() => setShowNewClient(false)} onConfirm={handleCreateClient} confirmLabel={t('clients.newClientModal.createBtn')} confirmDisabled={!newClientName.trim()}>
            <input autoFocus type="text" placeholder={t('clients.newClientModal.namePlaceholder')} value={newClientName} onChange={(e) => setNewClientName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleCreateClient()} style={inputStyle} onFocus={(e) => e.target.style.borderColor = 'var(--accent)'} onBlur={(e) => e.target.style.borderColor = 'var(--border)'} />
          </SimpleModal>
        )}
      </div>
    );
  }

  // ── Detalle de cliente ─────────────────────────────────────────────────────

  return (
    <div style={{ paddingBottom: 0 }}>
      {/* Header */}
      <div style={{ padding: '16px 20px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={() => setSelectedClientId(null)} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 24, cursor: 'pointer', padding: '2px 0', lineHeight: 1 }}>‹</button>
            <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--text)' }}>{selectedClient.name}</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => document.getElementById('client-import-input')?.click()} style={{ background: 'var(--surface)', border: 'var(--border-width) solid var(--border-card)', borderRadius: 8, color: 'var(--muted)', fontFamily: "'DM Sans', sans-serif", fontSize: 13, padding: '8px 14px', cursor: 'pointer' }}>{t('clients.importBtn')}</button>
            <button onClick={() => setShowNewProgram(true)} style={{ ...accentBtnStyle, fontSize: 16, padding: '8px 16px' }}>＋</button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: 'var(--border-width) solid var(--border)', marginTop: 10 }}>
        {CLIENT_TABS.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
              flex: 1,
              background: 'none', border: 'none',
              borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
              color: active ? 'var(--accent)' : 'var(--muted)',
              fontFamily: "'DM Sans', sans-serif", fontSize: 10,
              padding: '8px 4px', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
            }}>
              <span style={{ fontSize: 16, lineHeight: 1 }}>{tab.icon}</span>
              <span style={{ letterSpacing: 0.3 }}>{tab.label}</span>
            </button>
          );
        })}
      </div>

      <input type="file" accept=".json" style={{ display: 'none' }} id="client-import-input"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) { setImportFile(f); e.target.value = ''; } }} />

      {/* ── Tab: Programas ── */}
      {activeTab === 'programs' && (
        <div style={{ padding: '12px 20px 80px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {clientPrograms.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted)', fontSize: 13 }}>{t('clients.noPrograms')}</div>
          ) : clientPrograms.map((program) => {
            const sessions = getSessionCount(program);
            const lastActivity = getLastActivity(program);
            const isActive = selectedClient.activeProgramId === program.id;
            const locale = 'es-ES';
            return (
              <div key={program.id} style={{ background: 'var(--surface)', border: 'var(--border-width) solid', borderColor: isActive ? 'var(--accent-tint-border)' : 'var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ padding: '13px 16px', borderBottom: 'var(--border-width) solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      {program.name}
                      {isActive && <span style={{ fontSize: 9, letterSpacing: 1, background: 'var(--accent-tint-active)', color: 'var(--accent)', border: 'var(--border-width) solid var(--accent-tint-border)', borderRadius: 4, padding: '2px 6px' }}>{t('clients.activeLabel')}</span>}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                      {lastActivity
                        ? t('clients.sessionsLastActivity', { count: sessions, date: new Date(lastActivity).toLocaleDateString(locale, { day: 'numeric', month: 'short' }) })
                        : t('clients.sessionsOnly', { count: sessions })}
                    </div>
                  </div>
                  <button
                    onClick={() => setClientActiveProgram(selectedClientId, isActive ? null : program.id)}
                    style={{
                      background: 'none', border: 'none', flexShrink: 0,
                      color: isActive ? 'var(--accent)' : 'var(--muted2)',
                      fontSize: 11, cursor: 'pointer', padding: '4px 6px',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                    }}
                    title={isActive ? t('clients.removeActiveTitle') : t('clients.setActiveTitle')}
                  >
                    <span style={{ fontSize: 20, lineHeight: 1 }}>{isActive ? '★' : '☆'}</span>
                    <span style={{ fontSize: 9, letterSpacing: 0.5 }}>{isActive ? t('clients.activeStarLabel') : t('clients.activateStarLabel')}</span>
                  </button>
                </div>
                <div style={{ display: 'flex' }}>
                  <ActionBtn label={t('clients.actionView')}   onClick={() => setPrintingProgram(program.id)} />
                  <Div1 />
                  <ActionBtn label={t('clients.actionEdit')}   onClick={() => setEditingProgram(program.id)} />
                  <Div1 />
                  <ActionBtn label={t('clients.actionShare')}  onClick={() => handleShare(program)} />
                  <Div1 />
                  <ActionBtn label="⋯" onClick={(e) => openContextMenu(e, program.id)} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Tab: Info ── */}
      {activeTab === 'info' && (
        <div key={selectedClientId} style={{ padding: '8px 20px 80px', display: 'flex', flexDirection: 'column', gap: 0 }}>

          {/* Datos personales */}
          <Accordion label={t('clients.personalData')} open={openSections.personal} onToggle={() => toggleSection('personal')}>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 9, color: 'var(--muted2)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>{t('clients.statusLabel')}</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {[
                  { id: 'active',   label: t('clients.statusActive'),   color: 'var(--green)' },
                  { id: 'paused',   label: t('clients.statusPaused'),   color: 'var(--orange)' },
                  { id: 'inactive', label: t('clients.statusInactive'), color: 'var(--red)' },
                ].map(({ id, label, color }) => {
                  const isSel = (selectedClient.status ?? 'active') === id;
                  return (
                    <button key={id} onClick={() => updateClientInfo(selectedClientId, { status: id })} style={{
                      flex: 1, padding: '7px 4px', borderRadius: 6, border: 'var(--border-width) solid',
                      borderColor: isSel ? color : 'var(--border)',
                      background: isSel ? `${color}18` : 'var(--surface2)',
                      color: isSel ? color : 'var(--muted)',
                      fontFamily: "'DM Sans', sans-serif", fontSize: 11,
                      cursor: 'pointer', transition: 'all 0.15s',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                    }}>
                      {isSel && <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, display: 'inline-block' }} />}
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
            {[
              { key: 'name',     label: t('clients.fieldFirstName'), placeholder: 'Lucas' },
              { key: 'fullName', label: t('clients.fieldFullName'),  placeholder: 'Lucas García Martínez' },
              { key: 'phone',    label: t('clients.fieldPhone'),     placeholder: '+34 600 000 000' },
              { key: 'email',    label: t('clients.fieldEmail'),     placeholder: 'lucas@email.com', type: 'email' },
            ].map(({ key, label, placeholder, type }) => (
              <div key={key} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 9, color: 'var(--muted2)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
                <input
                  type={type ?? 'text'}
                  defaultValue={selectedClient[key] ?? ''}
                  placeholder={placeholder}
                  onBlur={(e) => updateClientInfo(selectedClientId, { [key]: e.target.value })}
                  style={{ ...inputStyle, padding: '8px 12px', fontSize: 13 }}
                  onFocus={(e) => e.target.style.borderColor = 'var(--accent)'}
                />
              </div>
            ))}
            <div>
              <div style={{ fontSize: 9, color: 'var(--muted2)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>{t('clients.fieldNotes')}</div>
              <textarea
                defaultValue={selectedClient.notes ?? ''}
                placeholder={t('clients.notesPlaceholder')}
                onBlur={(e) => updateClientInfo(selectedClientId, { notes: e.target.value })}
                style={{ ...inputStyle, minHeight: 90, resize: 'vertical', padding: '8px 12px', fontSize: 13, lineHeight: 1.6 }}
                onFocus={(e) => e.target.style.borderColor = 'var(--accent)'}
              />
              <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>{t('clients.notesSavedHint')}</div>
            </div>
          </Accordion>

          {/* Peso corporal */}
          <Accordion label={t('clients.bodyWeight')} open={openSections.weight} onToggle={() => toggleSection('weight')}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 10 }}>
              <input type="date" value={weightDate} onChange={(e) => setWeightDate(e.target.value)}
                style={{ ...inputStyle, flex: 1, padding: '8px 10px', fontSize: 12, colorScheme: 'dark' }} />
              <input type="number" step="0.1" placeholder="75.0" value={weightValue}
                onChange={(e) => setWeightValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddWeight()}
                style={{ ...inputStyle, width: 90, padding: '8px 10px', fontSize: 13, textAlign: 'center' }} />
              <button onClick={handleAddWeight} disabled={!weightValue}
                style={{ background: weightValue ? 'var(--accent)' : 'var(--surface2)', border: 'none', borderRadius: 8, color: weightValue ? '#0d0d0d' : 'var(--muted)', fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, padding: '8px 14px', cursor: weightValue ? 'pointer' : 'not-allowed' }}>＋</button>
            </div>
            {(selectedClient.bodyWeight ?? []).length === 0 ? (
              <div style={{ textAlign: 'center', padding: '12px 0', color: 'var(--muted)', fontSize: 12 }}>{t('clients.noWeightData')}</div>
            ) : (
              <div style={{ borderRadius: 8, overflow: 'hidden', border: 'var(--border-width) solid var(--border-card)' }}>
                {[...(selectedClient.bodyWeight ?? [])].reverse().map((entry) => (
                  <div key={entry.date} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 14px', borderBottom: 'var(--border-width) solid var(--border)' }}>
                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>{entry.date}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>{entry.weight} kg</span>
                      <button onClick={() => removeClientBodyWeight(selectedClientId, entry.date)} style={{ background: 'none', border: 'none', color: 'var(--muted2)', fontSize: 12, cursor: 'pointer' }}>✕</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Accordion>

          {/* Facturación */}
          <Accordion label={t('clients.billing')} open={openSections.billing} onToggle={() => toggleSection('billing')}>
            {(selectedClient.billing ?? []).length > 0 && (() => {
              const total = (selectedClient.billing ?? []).reduce((a, b) => a + (b.amount ?? 0), 0);
              const paid  = (selectedClient.billing ?? []).filter((b) => b.status === 'paid').reduce((a, b) => a + (b.amount ?? 0), 0);
              return (
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  {[
                    { label: t('clients.billedLabel'),   value: `${total.toFixed(2)}€`, color: 'var(--text)' },
                    { label: t('clients.receivedLabel'), value: `${paid.toFixed(2)}€`,  color: 'var(--green)' },
                    { label: t('clients.pendingLabel'),  value: `${(total - paid).toFixed(2)}€`, color: (total - paid) > 0 ? 'var(--orange)' : 'var(--muted)' },
                  ].map(({ label, value, color }) => (
                    <div key={label} style={{ flex: 1, background: 'var(--surface2)', borderRadius: 8, padding: '8px', textAlign: 'center', border: 'var(--border-width) solid var(--border-card)' }}>
                      <div style={{ fontSize: 9, color: 'var(--muted)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 3 }}>{label}</div>
                      <div style={{ fontSize: 13, fontWeight: 500, color }}>{value}</div>
                    </div>
                  ))}
                </div>
              );
            })()}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <input type="date" value={billDate} onChange={(e) => setBillDate(e.target.value)}
                  style={{ ...inputStyle, flex: 1, padding: '8px 10px', fontSize: 12, colorScheme: 'dark' }} />
                <input type="number" step="0.01" placeholder="0.00" value={billAmount}
                  onChange={(e) => setBillAmount(e.target.value)}
                  style={{ ...inputStyle, width: 90, padding: '8px 10px', fontSize: 13, textAlign: 'center' }} />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input type="text" placeholder={t('clients.billConceptPlaceholder')} value={billConcept}
                  onChange={(e) => setBillConcept(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddBilling()}
                  style={{ ...inputStyle, flex: 1, padding: '8px 10px', fontSize: 13 }}
                  onFocus={(e) => e.target.style.borderColor = 'var(--accent)'}
                  onBlur={(e) => e.target.style.borderColor = 'var(--border)'} />
                <button onClick={() => setBillStatus((s) => s === 'paid' ? 'pending' : 'paid')}
                  style={{ background: billStatus === 'paid' ? 'rgba(74,222,128,0.1)' : 'var(--surface2)', border: 'var(--border-width) solid', borderColor: billStatus === 'paid' ? 'rgba(74,222,128,0.3)' : 'var(--border)', borderRadius: 8, color: billStatus === 'paid' ? 'var(--green)' : 'var(--muted)', fontFamily: "'DM Sans', sans-serif", fontSize: 11, padding: '8px 10px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  {billStatus === 'paid' ? t('clients.billPaid') : t('clients.billPending')}
                </button>
                <button onClick={handleAddBilling} disabled={!billConcept.trim() || !billAmount}
                  style={{ background: (billConcept.trim() && billAmount) ? 'var(--accent)' : 'var(--surface2)', border: 'none', borderRadius: 8, color: (billConcept.trim() && billAmount) ? '#0d0d0d' : 'var(--muted)', fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, padding: '8px 12px', cursor: (billConcept.trim() && billAmount) ? 'pointer' : 'not-allowed' }}>＋</button>
              </div>
            </div>

            {(selectedClient.billing ?? []).length === 0 ? (
              <div style={{ textAlign: 'center', padding: '12px 0', color: 'var(--muted)', fontSize: 12 }}>{t('clients.noBillingData')}</div>
            ) : (
              <div style={{ borderRadius: 8, overflow: 'hidden', border: 'var(--border-width) solid var(--border-card)' }}>
                {(selectedClient.billing ?? []).map((entry) => (
                  <div key={entry.id} style={{ padding: '10px 14px', borderBottom: 'var(--border-width) solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{entry.concept}</div>
                      <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 1 }}>{entry.date}</div>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', flexShrink: 0 }}>{entry.amount?.toFixed(2)}€</div>
                    <button
                      onClick={() => updateClientBillingStatus(selectedClientId, entry.id, entry.status === 'paid' ? 'pending' : 'paid')}
                      style={{ background: entry.status === 'paid' ? 'rgba(74,222,128,0.1)' : 'rgba(251,146,60,0.1)', border: 'var(--border-width) solid', borderColor: entry.status === 'paid' ? 'rgba(74,222,128,0.3)' : 'rgba(251,146,60,0.3)', borderRadius: 6, color: entry.status === 'paid' ? 'var(--green)' : 'var(--orange)', fontSize: 10, padding: '3px 8px', cursor: 'pointer', flexShrink: 0 }}>
                      {entry.status === 'paid' ? t('clients.billPaid') : t('clients.billPending')}
                    </button>
                    <button onClick={() => { if (window.confirm(t('clients.billDeleteConfirm'))) removeClientBilling(selectedClientId, entry.id); }} style={{ background: 'none', border: 'var(--border-width) solid var(--border-card)', borderRadius: 6, color: 'var(--muted)', fontSize: 12, cursor: 'pointer', padding: '3px 8px', flexShrink: 0 }}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </Accordion>

        </div>
      )}

      {/* ── Tab: Historial ── */}
      {activeTab === 'history' && (
        <div style={{ padding: '10px 20px 80px' }}>
          <ClientFilters t={t} scopeFilter={scopeFilter} setScopeFilter={setScopeFilter} periodFilter={periodFilter} setPeriodFilter={setPeriodFilter} PERIOD_OPTIONS={PERIOD_OPTIONS} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
            {filteredLog.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted)', fontSize: 13 }}>{t('clients.noSessionsFilter')}</div>
            ) : filteredLog.map((session) => (
              <SessionCard key={session.id} session={session} onDelete={(id) => { if (window.confirm(t('history.deleteConfirm'))) deleteLogEntry(id); }} />
            ))}
          </div>
        </div>
      )}

      {/* ── Tab: Progresión ── */}
      {activeTab === 'progress' && (
        <div style={{ padding: '10px 20px 80px' }}>
          <ClientFilters t={t} scopeFilter={scopeFilter} setScopeFilter={setScopeFilter} periodFilter={periodFilter} setPeriodFilter={setPeriodFilter} PERIOD_OPTIONS={PERIOD_OPTIONS} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
            {exercisesWithLogs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted)', fontSize: 13 }}>{t('clients.noProgressFilter')}</div>
            ) : exercisesWithLogs.map((exerciseId) => {
              const def = allExercises[exerciseId];
              const logs = getExerciseLogs(exerciseId);
              return <ExerciseStatCard key={exerciseId} def={def} logs={logs} />;
            })}
          </div>
        </div>
      )}

      {/* Menú contextual */}
      {contextMenu && createPortal(
        <>
          <div onClick={() => setContextMenu(null)} style={{ position: 'fixed', inset: 0, zIndex: 49 }} />
          <div style={{
            position: 'fixed',
            top: contextMenu.y,
            left: contextMenu.x,
            transform: 'translate(-100%, -100%)',
            background: 'var(--surface2)',
            border: 'var(--border-width) solid var(--border)',
            borderRadius: 8, zIndex: 50,
            overflow: 'hidden', minWidth: 150,
            boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
          }}>
            <button onClick={() => { exportSpecificProgram(contextMenu.programId); setContextMenu(null); }}
              style={menuItemStyle}>{t('clients.contextExport')}</button>
            <button onClick={() => { if (window.confirm(t('clients.deleteProgramConfirm'))) handleDeleteProgram(contextMenu.programId); setContextMenu(null); }}
              style={{ ...menuItemStyle, color: 'var(--red)', borderBottom: 'none' }}>{t('clients.contextDelete')}</button>
          </div>
        </>,
        document.body
      )}

      {/* Modal: Nuevo programa */}
      {showNewProgram && (
        <>
          <div
            onClick={() => { setShowNewProgram(false); setNewProgramTab('blank'); setFromTemplateId(''); }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 49 }}
          />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'var(--surface)', border: 'var(--border-width) solid var(--border-card)', borderRadius: 10, zIndex: 50, width: 'calc(100% - 40px)', maxWidth: 360, padding: '20px' }}>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 1, marginBottom: 14 }}>{t('clients.newProgramModal.title')}</div>

            {templatePrograms.length > 0 && (
              <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
                {[{ id: 'blank', label: t('clients.newProgramModal.tabBlank') }, { id: 'template', label: t('clients.newProgramModal.tabTemplate') }].map(({ id, label }) => (
                  <button key={id} onClick={() => setNewProgramTab(id)} style={{ flex: 1, padding: '7px', borderRadius: 6, border: 'var(--border-width) solid', borderColor: newProgramTab === id ? 'var(--accent-tint-border)' : 'var(--border)', background: newProgramTab === id ? 'var(--accent-tint-active)' : 'var(--surface2)', color: newProgramTab === id ? 'var(--accent)' : 'var(--muted)', fontFamily: "'DM Sans', sans-serif", fontSize: 12, cursor: 'pointer' }}>{label}</button>
                ))}
              </div>
            )}

            {newProgramTab === 'blank' && (
              <>
                <input autoFocus type="text" placeholder={t('clients.newProgramModal.namePlaceholder')} value={newProgramName}
                  onChange={(e) => setNewProgramName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateProgram()}
                  style={inputStyle} onFocus={(e) => e.target.style.borderColor = 'var(--accent)'} onBlur={(e) => e.target.style.borderColor = 'var(--border)'} />
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 10, color: 'var(--muted)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>{t('clients.newProgramModal.sessionsLabel')}</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {[2, 3, 4, 5, 6].map((n) => (
                      <button key={n} onClick={() => setNewProgramSessions(n)}
                        style={{ flex: 1, height: 40, borderRadius: 6, border: 'var(--border-width) solid', borderColor: newProgramSessions === n ? 'var(--accent-tint-border)' : 'var(--border)', background: newProgramSessions === n ? 'var(--accent-tint-active)' : 'var(--surface2)', color: newProgramSessions === n ? 'var(--accent)' : 'var(--text)', fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, cursor: 'pointer' }}>{n}</button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {newProgramTab === 'template' && (
              <>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 10, color: 'var(--muted)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>{t('clients.newProgramModal.templateLabel')}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 180, overflowY: 'auto' }}>
                    {templatePrograms.map((p) => (
                      <button key={p.id}
                        onClick={() => { setFromTemplateId(p.id); setFromTemplateName(p.name); }}
                        style={{ padding: '10px 12px', borderRadius: 8, border: 'var(--border-width) solid', borderColor: fromTemplateId === p.id ? 'var(--accent-tint-border)' : 'var(--border)', background: fromTemplateId === p.id ? 'var(--accent-tint-active)' : 'var(--surface2)', color: fromTemplateId === p.id ? 'var(--accent)' : 'var(--text)', fontFamily: "'DM Sans', sans-serif", fontSize: 13, cursor: 'pointer', textAlign: 'left', width: '100%' }}>
                        <div style={{ fontWeight: 500 }}>{p.name}</div>
                        <div style={{ fontSize: 10, color: fromTemplateId === p.id ? 'var(--accent)' : 'var(--muted)', marginTop: 2 }}>
                          {t('common.session', { count: p.days.length })}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
                <input type="text"
                  placeholder={fromTemplateId ? (templatePrograms.find((p) => p.id === fromTemplateId)?.name ?? t('clients.newProgramModal.namePlaceholder')) : t('clients.newProgramModal.namePlaceholder')}
                  value={fromTemplateName}
                  onChange={(e) => setFromTemplateName(e.target.value)}
                  style={inputStyle}
                  onFocus={(e) => e.target.style.borderColor = 'var(--accent)'}
                  onBlur={(e) => e.target.style.borderColor = 'var(--border)'} />
              </>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button
                onClick={() => { setShowNewProgram(false); setNewProgramTab('blank'); setFromTemplateId(''); }}
                style={{ flex: 1, background: 'none', border: 'var(--border-width) solid var(--border-card)', borderRadius: 8, color: 'var(--muted)', fontFamily: "'DM Sans', sans-serif", fontSize: 13, padding: '11px', cursor: 'pointer' }}>{t('common.cancel')}</button>
              {newProgramTab === 'blank' ? (
                <button onClick={handleCreateProgram} disabled={!newProgramName.trim()}
                  style={{ flex: 2, background: !newProgramName.trim() ? 'var(--surface2)' : 'var(--accent)', border: 'none', borderRadius: 8, color: !newProgramName.trim() ? 'var(--muted)' : '#0d0d0d', fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 1, padding: '11px', cursor: !newProgramName.trim() ? 'not-allowed' : 'pointer' }}>
                  {t('clients.newProgramModal.createBtn')}
                </button>
              ) : (
                <button onClick={handleCreateFromTemplate} disabled={!fromTemplateId}
                  style={{ flex: 2, background: !fromTemplateId ? 'var(--surface2)' : 'var(--accent)', border: 'none', borderRadius: 8, color: !fromTemplateId ? 'var(--muted)' : '#0d0d0d', fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 1, padding: '11px', cursor: !fromTemplateId ? 'not-allowed' : 'pointer' }}>
                  {t('clients.newProgramModal.assignBtn')}
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {importFile && <ClientImportModal t={t} file={importFile} onImport={handleImport} onClose={() => setImportFile(null)} />}
    </div>
  );
}

// ── Filtros ───────────────────────────────────────────────────────────────────
function ClientFilters({ t, scopeFilter, setScopeFilter, periodFilter, setPeriodFilter, PERIOD_OPTIONS }) {
  const scopeOptions = [
    { id: 'active', label: t('clients.scope.active') },
    { id: 'all',    label: t('clients.scope.all') },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', gap: 6 }}>
        {scopeOptions.map((opt) => (
          <FilterChip key={opt.id} active={scopeFilter === opt.id} label={opt.label} onClick={() => setScopeFilter(opt.id)} />
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        {PERIOD_OPTIONS.map((opt) => (
          <FilterChip key={opt.id} active={periodFilter === opt.id} label={opt.label} onClick={() => setPeriodFilter(opt.id)} />
        ))}
      </div>
    </div>
  );
}

function FilterChip({ active, label, onClick }) {
  return (
    <button onClick={onClick} style={{
      flex: 1, background: active ? 'var(--accent-tint-active)' : 'var(--surface)',
      border: 'var(--border-width) solid', borderColor: active ? 'var(--accent-tint-border)' : 'var(--border)',
      borderRadius: 6, color: active ? 'var(--accent)' : 'var(--muted)',
      fontFamily: "'DM Sans', sans-serif", fontSize: 11, padding: '6px 4px',
      cursor: 'pointer', transition: 'all 0.15s',
    }}>{label}</button>
  );
}

function ActionBtn({ label, onClick, danger }) {
  return (
    <button onClick={onClick} style={{ flex: 1, background: 'none', border: 'none', color: danger ? 'var(--red)' : 'var(--muted)', fontFamily: "'DM Sans', sans-serif", fontSize: 12, padding: '10px', cursor: 'pointer', transition: 'background 0.15s' }}
      onPointerDown={(e) => e.currentTarget.style.background = 'var(--surface2)'}
      onPointerUp={(e) => e.currentTarget.style.background = 'none'}
      onPointerLeave={(e) => e.currentTarget.style.background = 'none'}
    >{label}</button>
  );
}

function Div1() { return <div style={{ width: 1, background: 'var(--border)' }} />; }

function SimpleModal({ title, children, onClose, onConfirm, confirmLabel, confirmDisabled }) {
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 49 }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'var(--surface)', border: 'var(--border-width) solid var(--border-card)', borderRadius: 10, zIndex: 50, width: 'calc(100% - 40px)', maxWidth: 360, padding: '20px' }}>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 1, marginBottom: 14 }}>{title}</div>
        {children}
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button onClick={onClose} style={{ flex: 1, background: 'none', border: 'var(--border-width) solid var(--border-card)', borderRadius: 8, color: 'var(--muted)', fontFamily: "'DM Sans', sans-serif", fontSize: 13, padding: '11px', cursor: 'pointer' }}>Cancelar</button>
          <button onClick={onConfirm} disabled={confirmDisabled} style={{ flex: 2, background: confirmDisabled ? 'var(--surface2)' : 'var(--accent)', border: 'none', borderRadius: 8, color: confirmDisabled ? 'var(--muted)' : '#0d0d0d', fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 1, padding: '11px', cursor: confirmDisabled ? 'not-allowed' : 'pointer' }}>{confirmLabel}</button>
        </div>
      </div>
    </>
  );
}

function GlobalBillingView({ t, clients, clientList, onClose, updateClientBillingStatus, onSelectClient }) {
  const [statusFilter, setStatusFilter] = useState('all');
  const [periodFilter, setPeriodFilter] = useState('all');

  const allEntries = useMemo(() => {
    const entries = [];
    Object.values(clients ?? {}).forEach((client) => {
      (client.billing ?? []).forEach((b) => {
        entries.push({ ...b, clientId: client.id, clientName: client.name });
      });
    });
    return entries.sort((a, b) => b.date.localeCompare(a.date));
  }, [clients]);

  const filtered = useMemo(() => {
    let list = allEntries;
    if (statusFilter !== 'all') list = list.filter((e) => e.status === statusFilter);
    if (periodFilter !== 'all') {
      const now = new Date();
      const months = periodFilter === '1m' ? 1 : 3;
      const cutoff = new Date(now.getFullYear(), now.getMonth() - months + 1, 1).toISOString().split('T')[0];
      list = list.filter((e) => e.date >= cutoff);
    }
    return list;
  }, [allEntries, statusFilter, periodFilter]);

  const totalFiltered  = filtered.reduce((a, b) => a + (b.amount ?? 0), 0);
  const paidFiltered   = filtered.filter((e) => e.status === 'paid').reduce((a, b) => a + (b.amount ?? 0), 0);
  const pendingFiltered = totalFiltered - paidFiltered;

  return (
    <div>
      <div style={{ padding: '16px 20px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 24, cursor: 'pointer', padding: '2px 0', lineHeight: 1 }}>‹</button>
        <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--text)' }}>{t('clients.globalBilling')}</div>
      </div>

      <div style={{ padding: '0 20px 12px', display: 'flex', gap: 8 }}>
        {[
          { label: t('clients.billedLabel'),   value: `${totalFiltered.toFixed(2)}€`, color: 'var(--text)' },
          { label: t('clients.receivedLabel'), value: `${paidFiltered.toFixed(2)}€`,  color: 'var(--green)' },
          { label: t('clients.pendingLabel'),  value: `${pendingFiltered.toFixed(2)}€`, color: pendingFiltered > 0 ? 'var(--orange)' : 'var(--muted)' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ flex: 1, background: 'var(--surface)', border: 'var(--border-width) solid var(--border-card)', borderRadius: 8, padding: '10px 8px', textAlign: 'center' }}>
            <div style={{ fontSize: 9, color: 'var(--muted)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 3 }}>{label}</div>
            <div style={{ fontSize: 13, fontWeight: 500, color }}>{value}</div>
          </div>
        ))}
      </div>

      <div style={{ padding: '0 20px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {[{ id: 'all', label: t('clients.statusBilled') }, { id: 'pending', label: t('clients.billPending') }, { id: 'paid', label: t('clients.statusPaid') }].map((o) => (
            <FilterChip key={o.id} active={statusFilter === o.id} label={o.label} onClick={() => setStatusFilter(o.id)} />
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[{ id: 'all', label: t('clients.period.all') }, { id: '1m', label: t('clients.periodThisMonth') }, { id: '3m', label: t('clients.periodLast3Months') }].map((o) => (
            <FilterChip key={o.id} active={periodFilter === o.id} label={o.label} onClick={() => setPeriodFilter(o.id)} />
          ))}
        </div>
      </div>

      <div style={{ padding: '0 20px 80px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted)', fontSize: 13 }}>{t('clients.noBillingEntries')}</div>
        ) : filtered.map((entry) => (
          <div key={entry.id} style={{ background: 'var(--surface)', border: 'var(--border-width) solid var(--border-card)', borderRadius: 10, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                onClick={() => onSelectClient(entry.clientId)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--accent)', marginBottom: 3, cursor: 'pointer', padding: '2px 6px', borderRadius: 4, background: 'rgba(232,255,71,0.06)', border: '1px solid rgba(232,255,71,0.15)' }}
              >
                {entry.clientName} ›
              </div>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{entry.concept}</div>
              <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 1 }}>{entry.date}</div>
            </div>
            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)', flexShrink: 0 }}>{entry.amount?.toFixed(2)}€</div>
            <button
              onClick={() => updateClientBillingStatus(entry.clientId, entry.id, entry.status === 'paid' ? 'pending' : 'paid')}
              style={{ background: entry.status === 'paid' ? 'rgba(74,222,128,0.1)' : 'rgba(251,146,60,0.1)', border: 'var(--border-width) solid', borderColor: entry.status === 'paid' ? 'rgba(74,222,128,0.3)' : 'rgba(251,146,60,0.3)', borderRadius: 6, color: entry.status === 'paid' ? 'var(--green)' : 'var(--orange)', fontSize: 10, padding: '4px 8px', cursor: 'pointer', flexShrink: 0 }}>
              {entry.status === 'paid' ? t('clients.billPaid') : t('clients.billPending')}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function Accordion({ label, open, onToggle, children }) {
  return (
    <div style={{ borderBottom: 'var(--border-width) solid var(--border)' }}>
      <button onClick={onToggle} style={{
        width: '100%', background: 'none', border: 'none',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 0', cursor: 'pointer',
        color: 'var(--text)', fontFamily: "'DM Sans', sans-serif",
        fontSize: 13, fontWeight: 500, textAlign: 'left',
      }}>
        <span>{label}</span>
        <span style={{ color: 'var(--muted)', fontSize: 16, transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'none', display: 'block' }}>▾</span>
      </button>
      {open && (
        <div style={{ paddingBottom: 16 }}>
          {children}
        </div>
      )}
    </div>
  );
}

function ClientImportModal({ t, file, onImport, onClose }) {
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 49 }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'var(--surface)', border: 'var(--border-width) solid var(--border-card)', borderRadius: 10, zIndex: 50, width: 'calc(100% - 40px)', maxWidth: 380, padding: '20px' }}>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 1, marginBottom: 6 }}>{t('clients.importModal.title')}</div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16, lineHeight: 1.6 }}>
          <strong style={{ color: 'var(--text)' }}>{file.name}</strong>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            { mode: 'replace',     label: t('clients.importModal.replaceLabel'),    desc: t('clients.importModal.replaceDesc') },
            { mode: 'add_program', label: t('clients.importModal.addProgramLabel'), desc: t('clients.importModal.addProgramDesc') },
            { mode: 'merge_log',   label: t('clients.importModal.mergeLogLabel'),   desc: t('clients.importModal.mergeLogDesc') },
          ].map(({ mode, label, desc }) => (
            <button key={mode} onClick={() => onImport(file, mode)}
              style={{ background: 'var(--surface2)', border: 'var(--border-width) solid var(--border-card)', borderRadius: 8, padding: '12px 14px', cursor: 'pointer', textAlign: 'left', width: '100%', transition: 'border-color 0.15s' }}
              onPointerDown={(e) => e.currentTarget.style.borderColor = 'var(--accent)'}
              onPointerUp={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
              onPointerLeave={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
            >
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', fontFamily: "'DM Sans', sans-serif" }}>{label}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>{desc}</div>
            </button>
          ))}
          <button onClick={onClose} style={{ background: 'none', border: 'var(--border-width) solid var(--border-card)', borderRadius: 8, color: 'var(--muted)', fontFamily: "'DM Sans', sans-serif", fontSize: 12, padding: '10px', cursor: 'pointer', marginTop: 4 }}>{t('common.cancel')}</button>
        </div>
      </div>
    </>
  );
}

const menuItemStyle = { display: 'block', width: '100%', background: 'none', border: 'none', borderBottom: 'var(--border-width) solid var(--border)', color: 'var(--text)', fontFamily: "'DM Sans', sans-serif", fontSize: 12, padding: '11px 14px', cursor: 'pointer', textAlign: 'left' };
const accentBtnStyle = { background: 'var(--accent)', border: 'none', borderRadius: 6, color: '#0d0d0d', fontFamily: "'Bebas Neue', sans-serif", fontSize: 13, letterSpacing: 1, padding: '5px 12px', cursor: 'pointer' };
const inputStyle = { width: '100%', background: 'var(--surface2)', border: 'var(--border-width) solid var(--border-card)', borderRadius: 8, color: 'var(--text)', fontFamily: "'DM Sans', sans-serif", fontSize: 14, padding: '10px 14px', outline: 'none', boxSizing: 'border-box' };
