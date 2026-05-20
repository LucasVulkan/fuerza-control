import { useEffect, useState } from 'react';
import { useStore } from '../../store/useStore';
import DayEditor from './DayEditor';

export default function ProgramEditorView() {
  const navigate               = useStore((s) => s.navigate);
  const programs               = useStore((s) => s.programs);
  const profile                = useStore((s) => s.profile);
  const ui                     = useStore((s) => s.ui);
  const beginEditSession       = useStore((s) => s.beginEditSession);
  const cancelEditSession      = useStore((s) => s.cancelEditSession);
  const confirmEditSession     = useStore((s) => s.confirmEditSession);
  const addSessionToProgram    = useStore((s) => s.addSessionToProgram);
  const renameProgram          = useStore((s) => s.renameProgram);
  const addStageToProgram      = useStore((s) => s.addStageToProgram);
  const removeStageFromProgram = useStore((s) => s.removeStageFromProgram);
  const updateStage            = useStore((s) => s.updateStage);
  const setCurrentStage        = useStore((s) => s.setCurrentStage);
  const showToast              = useStore((s) => s.showToast);

  const editingId     = ui._editingProgramId ?? profile.activeProgramId;
  const activeProgram = programs[editingId];
  const isFromClients = !!ui._editingProgramId;
  const backDest      = 'home';
  const backTab       = isFromClients ? 'clients' : 'session';

  const hasStages = (activeProgram?.stages?.length ?? 0) > 0;

  const [editingName, setEditingName]           = useState(false);
  const [nameValue, setNameValue]               = useState(activeProgram?.name ?? '');
  const [selectedStageIdx, setSelectedStageIdx] = useState(activeProgram?.currentStageIndex ?? 0);

  // Inline stage meta editing state — se sincroniza al cambiar de tab
  const selectedStage = hasStages ? (activeProgram?.stages?.[selectedStageIdx] ?? null) : null;
  const [stageName, setStageName]   = useState(selectedStage?.name ?? '');
  const [stageWeeks, setStageWeeks] = useState(String(selectedStage?.durationWeeks ?? 4));

  useEffect(() => {
    beginEditSession();
  }, []);

  // Sync stage meta inputs when switching tabs
  useEffect(() => {
    if (selectedStage) {
      setStageName(selectedStage.name);
      setStageWeeks(String(selectedStage.durationWeeks ?? 4));
    }
  }, [selectedStageIdx, activeProgram?.stages?.length]);

  // Clamp selectedStageIdx when stages are removed
  useEffect(() => {
    if (hasStages) {
      const max = (activeProgram?.stages?.length ?? 1) - 1;
      if (selectedStageIdx > max) setSelectedStageIdx(max);
    }
  }, [activeProgram?.stages?.length]);

  const editorDays = hasStages
    ? (activeProgram.stages[selectedStageIdx]?.days ?? [])
    : (activeProgram?.days ?? []);

  function handleNameBlur() {
    const trimmed = nameValue.trim();
    if (trimmed && trimmed !== activeProgram?.name) renameProgram(editingId, trimmed);
    else setNameValue(activeProgram?.name ?? '');
    setEditingName(false);
  }

  function handleNameKey(e) {
    if (e.key === 'Enter') e.target.blur();
    if (e.key === 'Escape') { setNameValue(activeProgram?.name ?? ''); setEditingName(false); }
  }

  function commitStageName() {
    const trimmed = stageName.trim();
    if (trimmed && trimmed !== selectedStage?.name) updateStage(editingId, selectedStageIdx, { name: trimmed });
    else setStageName(selectedStage?.name ?? '');
  }

  function commitStageWeeks() {
    const n = parseInt(stageWeeks);
    if (!isNaN(n) && n > 0 && n !== selectedStage?.durationWeeks) {
      updateStage(editingId, selectedStageIdx, { durationWeeks: n });
    } else {
      setStageWeeks(String(selectedStage?.durationWeeks ?? 4));
    }
  }

  function handleAddStage() {
    const wasStaged = hasStages;
    addStageToProgram(editingId);
    const newIdx = wasStaged ? (activeProgram?.stages?.length ?? 1) : 1;
    setSelectedStageIdx(newIdx);
    showToast('✓ Etapa añadida');
  }

  function handleDeleteStage() {
    if (!window.confirm(`¿Eliminar "${selectedStage?.name}"? Las sesiones de esta etapa se perderán.`)) return;
    removeStageFromProgram(editingId, selectedStageIdx);
    setSelectedStageIdx(Math.max(0, selectedStageIdx - 1));
    showToast('✓ Etapa eliminada');
  }

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', maxWidth: 480, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ padding: '20px 20px 14px', borderBottom: 'var(--border-width) solid var(--border)' }}>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, letterSpacing: 1, color: 'var(--text)' }}>
          {isFromClients ? 'EDITAR PROGRAMA DE CLIENTE' : 'EDITAR PROGRAMA'}
        </div>
        {activeProgram && (
          <div style={{ marginTop: 6 }}>
            {editingName ? (
              <input
                autoFocus
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
                onBlur={handleNameBlur}
                onKeyDown={handleNameKey}
                style={{
                  width: '100%', background: 'var(--surface2)',
                  border: '1px solid var(--accent)', borderRadius: 6,
                  color: 'var(--text)', fontFamily: "'DM Sans', sans-serif",
                  fontSize: 13, fontWeight: 500, padding: '5px 10px', outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            ) : (
              <button
                onClick={() => { setNameValue(activeProgram.name); setEditingName(true); }}
                style={{
                  background: 'none', border: 'none', padding: 0,
                  color: 'var(--text)', fontFamily: "'DM Sans', sans-serif",
                  fontSize: 13, fontWeight: 500, cursor: 'text',
                  display: 'flex', alignItems: 'center', gap: 6, textAlign: 'left',
                }}
              >
                {activeProgram.name}
                <span style={{ fontSize: 10, color: 'var(--muted)' }}>✎</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Stage tabs */}
      {hasStages && (
        <div style={{
          display: 'flex', overflowX: 'auto',
          background: 'var(--surface)',
          borderBottom: 'var(--border-width) solid var(--border)',
        }}>
          {activeProgram.stages.map((stage, idx) => {
            const isSelected = idx === selectedStageIdx;
            const isActive   = idx === (activeProgram.currentStageIndex ?? 0);
            return (
              <button
                key={stage.id ?? idx}
                onClick={() => setSelectedStageIdx(idx)}
                style={{
                  flex: '0 0 auto',
                  padding: '10px 16px',
                  background: 'none', border: 'none',
                  borderBottom: isSelected ? '2px solid var(--accent)' : '2px solid transparent',
                  color: isSelected ? 'var(--accent)' : 'var(--muted)',
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 12, fontWeight: isSelected ? 500 : 400,
                  cursor: 'pointer', whiteSpace: 'nowrap',
                  display: 'flex', alignItems: 'center', gap: 5,
                }}
              >
                {stage.name}
                {isActive && (
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />
                )}
              </button>
            );
          })}
          <button
            onClick={handleAddStage}
            style={{
              flex: '0 0 auto', padding: '10px 14px',
              background: 'none', border: 'none',
              borderBottom: '2px solid transparent',
              color: 'var(--muted)', fontSize: 16,
              cursor: 'pointer', lineHeight: 1,
            }}
            title="Añadir etapa"
          >
            ＋
          </button>
        </div>
      )}

      {/* Stage meta row — nombre, semanas, activar, eliminar */}
      {hasStages && selectedStage && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 20px',
          background: 'var(--surface2)',
          borderBottom: 'var(--border-width) solid var(--border)',
        }}>
          {/* Nombre de la etapa */}
          <input
            value={stageName}
            onChange={(e) => setStageName(e.target.value)}
            onBlur={commitStageName}
            onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') setStageName(selectedStage.name); }}
            placeholder="Nombre de la etapa"
            style={{
              flex: 1, minWidth: 0,
              background: 'transparent', border: 'none',
              color: 'var(--text)', fontFamily: "'DM Sans', sans-serif",
              fontSize: 12, fontWeight: 500, outline: 'none',
            }}
          />
          {/* Semanas */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            <input
              type="number" min="1" max="52"
              value={stageWeeks}
              onChange={(e) => setStageWeeks(e.target.value)}
              onBlur={commitStageWeeks}
              onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
              style={{
                width: 34, background: 'var(--surface)',
                border: 'var(--border-width) solid var(--border)',
                borderRadius: 5, color: 'var(--text)',
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 12, padding: '3px 0', textAlign: 'center', outline: 'none',
              }}
            />
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>sem.</span>
          </div>
          {/* Activar (si no es la etapa activa actual) */}
          {selectedStageIdx !== (activeProgram.currentStageIndex ?? 0) && (
            <button
              onClick={() => { setCurrentStage(editingId, selectedStageIdx); showToast(`✓ ${selectedStage.name} activada`); }}
              style={{
                background: 'var(--accent-tint-active)',
                border: 'var(--border-width) solid var(--accent-tint-border)',
                borderRadius: 6, color: 'var(--accent)',
                fontFamily: "'DM Sans', sans-serif", fontSize: 11,
                padding: '4px 10px', cursor: 'pointer', flexShrink: 0,
              }}
            >
              Activar
            </button>
          )}
          {/* Eliminar etapa */}
          {activeProgram.stages.length > 1 && (
            <button
              onClick={handleDeleteStage}
              style={{
                background: 'none', border: 'none',
                color: 'var(--muted2)', fontSize: 14,
                cursor: 'pointer', padding: '4px 2px', flexShrink: 0,
              }}
            >
              ✕
            </button>
          )}
        </div>
      )}

      {/* Contenido scrollable */}
      <div style={{ padding: '14px 20px 102px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {!hasStages && (
          <p style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 4 }}>
            Los cambios se aplican a todas las sesiones futuras. Puedes restaurar cualquier día a sus valores originales.
          </p>
        )}

        {editorDays.map(({ sessionTemplateId }) => (
          <DayEditor key={sessionTemplateId} templateId={sessionTemplateId} />
        ))}

        <button
          onClick={() => addSessionToProgram(editingId, hasStages ? selectedStageIdx : null)}
          style={{
            width: '100%', background: 'var(--accent-tint)',
            border: '1px dashed var(--accent-tint-border)', borderRadius: 10,
            color: 'var(--accent)', fontFamily: "'DM Sans', sans-serif",
            fontSize: 13, padding: '14px 0', cursor: 'pointer', marginTop: 4,
          }}
        >
          ＋ Añadir sesión{hasStages ? ' a esta etapa' : ''}
        </button>

        {/* Convertir a programa por etapas (solo si no hay etapas) */}
        {!hasStages && (
          <button
            onClick={handleAddStage}
            style={{
              width: '100%', background: 'var(--surface)',
              border: '1px dashed var(--border-card)', borderRadius: 10,
              color: 'var(--muted)', fontFamily: "'DM Sans', sans-serif",
              fontSize: 12, padding: '12px 0', cursor: 'pointer', marginTop: 4,
            }}
          >
            ⊞ Convertir a programa por etapas
          </button>
        )}
      </div>

      {/* Botones fijos abajo */}
      <div style={{
        position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: 480, padding: '12px 20px 28px',
        borderTop: 'var(--border-width) solid var(--border)', background: 'var(--bg)',
        display: 'flex', gap: 10, boxSizing: 'border-box',
      }}>
        <button
          onClick={() => cancelEditSession(backDest, backTab)}
          style={{
            flex: 1, background: 'var(--surface2)',
            border: 'var(--border-width) solid var(--border-card)', borderRadius: 10,
            color: 'var(--text)', fontFamily: "'DM Sans', sans-serif",
            fontSize: 13, padding: '13px 8px', cursor: 'pointer',
          }}
        >
          Cancelar
        </button>
        <button
          onClick={() => confirmEditSession(backDest, backTab)}
          style={{
            flex: 2, background: 'var(--accent)', border: 'none', borderRadius: 10,
            color: '#0d0d0d', fontFamily: "'Bebas Neue', sans-serif",
            fontSize: 20, letterSpacing: 1.5, padding: '13px 8px', cursor: 'pointer',
          }}
        >
          GUARDAR CAMBIOS
        </button>
      </div>
    </div>
  );
}
