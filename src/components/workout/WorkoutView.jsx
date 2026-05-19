import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useWorkout } from '../../hooks/useWorkout';
import { useStore } from '../../store/useStore';
import ExerciseCard from './ExerciseCard';
import ExerciseSelector from '../editor/ExerciseSelector';

export default function WorkoutView() {
  const { template, exercises, updateSetField, toggleSetDone, saveSession, discardSession } = useWorkout();
  const showToast           = useStore((s) => s.showToast);
  const navigate            = useStore((s) => s.navigate);
  const activeSession       = useStore((s) => s.activeSession);
  const updateSessionNotes  = useStore((s) => s.updateSessionNotes);
  const addAdHocExercise    = useStore((s) => s.addAdHocExercise);
  const removeAdHocExercise = useStore((s) => s.removeAdHocExercise);
  const updateAdHocSet      = useStore((s) => s.updateAdHocSet);
  const toggleAdHocSetDone  = useStore((s) => s.toggleAdHocSetDone);
  const addAdHocSet         = useStore((s) => s.addAdHocSet);
  const exerciseLibrary     = useStore((s) => s.exerciseLibrary);
  const customExercises     = useStore((s) => s.customExercises);
  const allExercises        = { ...exerciseLibrary, ...customExercises };

  const [notesOpen, setNotesOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [selectorOpen, setSelectorOpen] = useState(false);

  if (!template) return null;

  const dayColors = { A: 'var(--day1)', B: 'var(--day2)', C: 'var(--day3)' };
  const color = template.color ?? dayColors[template.label] ?? 'var(--accent)';
  const hasNotes = (activeSession.notes ?? '').trim().length > 0;
  const adHocList = activeSession.adHocExercises ?? [];

  // IDs ya en el template para excluirlos del selector
  const usedIds = new Set([
    ...exercises.map((e) => e.exerciseId),
    ...adHocList.map((e) => e.exerciseId),
  ]);

  function handleSave() {
    const result = saveSession();
    if (!result.ok) { showToast('⚠️ ' + result.error); return; }
    showToast('✓ Sesión guardada');
    setTimeout(() => navigate('home'), 1200);
  }

  function openNotes() { setDraft(activeSession.notes ?? ''); setNotesOpen(true); }
  function closeNotes() { updateSessionNotes(draft); setNotesOpen(false); }

  function handleSelectAdHoc(exerciseId) {
    addAdHocExercise(exerciseId);
    setSelectorOpen(false);
  }

  return (
    <div style={{ paddingBottom: 24 }}>
      {/* Header */}
      <div style={{
        padding: '14px 20px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 12,
        position: 'sticky', top: 57, background: 'var(--bg)', zIndex: 10,
      }}>
        <span onClick={() => navigate('home')} style={{ color: 'var(--muted)', fontSize: 22, cursor: 'pointer', padding: '4px 8px 4px 0', lineHeight: 1 }}>‹</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, letterSpacing: 1, color }}>
            DÍA {template.label} · {template.name.toUpperCase()}
          </div>
          <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>{template.emphasis}</div>
        </div>
        <button onClick={openNotes} style={{
          background: hasNotes ? 'rgba(232,255,71,0.1)' : 'none',
          border: '1px solid', borderColor: hasNotes ? 'rgba(232,255,71,0.35)' : 'var(--border)',
          borderRadius: 8, color: hasNotes ? 'var(--accent)' : 'var(--muted)',
          fontSize: 16, padding: '6px 10px', cursor: 'pointer', lineHeight: 1, flexShrink: 0,
        }}>📝</button>
      </div>

      {/* Lista de ejercicios */}
      <div style={{ padding: '10px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {exercises.map((ex, i) => (
          <ExerciseCard key={ex.exerciseId} index={i} {...ex} onFieldChange={updateSetField} onToggleDone={toggleSetDone} />
        ))}

        {/* Ejercicios ad-hoc */}
        {adHocList.length > 0 && (
          <div style={{ borderTop: '1px dashed var(--border)', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11 }}>➕</span> Añadidos en esta sesión
            </div>
            {adHocList.map((adHoc) => {
              const def = allExercises[adHoc.exerciseId];
              return (
                <AdHocCard
                  key={adHoc.exerciseId}
                  def={def}
                  exerciseId={adHoc.exerciseId}
                  setsState={adHoc.setsState}
                  onFieldChange={(setIdx, field, value) => updateAdHocSet(adHoc.exerciseId, setIdx, field, value)}
                  onToggleDone={(setIdx) => toggleAdHocSetDone(adHoc.exerciseId, setIdx)}
                  onAddSet={() => addAdHocSet(adHoc.exerciseId)}
                  onRemove={() => removeAdHocExercise(adHoc.exerciseId)}
                />
              );
            })}
          </div>
        )}

        {/* Botón añadir ejercicio */}
        <button onClick={() => setSelectorOpen(true)} style={{
          background: 'var(--surface)', border: '1px dashed var(--border)',
          borderRadius: 10, color: 'var(--muted)', fontFamily: "'DM Sans', sans-serif",
          fontSize: 13, padding: '13px', cursor: 'pointer', width: '100%',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          <span style={{ fontSize: 16 }}>＋</span> Añadir ejercicio
        </button>

        <button onClick={handleSave} style={{
          marginTop: 2, width: '100%', background: 'var(--accent)', color: '#0d0d0d',
          border: 'none', borderRadius: 10, padding: 15,
          fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, letterSpacing: 1.5, cursor: 'pointer',
        }}
          onPointerDown={(e) => e.currentTarget.style.opacity = '0.85'}
          onPointerUp={(e) => e.currentTarget.style.opacity = '1'}
          onPointerLeave={(e) => e.currentTarget.style.opacity = '1'}
        >GUARDAR SESIÓN</button>

        <button
          onClick={() => {
            if (window.confirm('¿Descartar la sesión en curso? Los datos introducidos se perderán.')) {
              discardSession();
            }
          }}
          style={{
            background: 'none', border: 'none', color: 'var(--muted)',
            fontFamily: "'DM Sans', sans-serif", fontSize: 12,
            padding: '10px 0 4px', cursor: 'pointer', width: '100%',
          }}
        >
          Descartar sesión
        </button>
      </div>

      {/* Bottom sheet — Notas */}
      {notesOpen && (
        <>
          <div onClick={closeNotes} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 40 }} />
          <div style={{
            position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
            width: '100%', maxWidth: 480, background: 'var(--surface)',
            borderTop: '1px solid var(--border)', borderRadius: '16px 16px 0 0',
            zIndex: 41, padding: '12px 20px 32px',
          }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border)', margin: '0 auto 16px' }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 1 }}>NOTAS DE SESIÓN</div>
              <button onClick={closeNotes} style={{ background: 'var(--accent)', border: 'none', borderRadius: 8, color: '#0d0d0d', fontFamily: "'Bebas Neue', sans-serif", fontSize: 15, letterSpacing: 1, padding: '6px 16px', cursor: 'pointer' }}>GUARDAR</button>
            </div>
            <textarea autoFocus value={draft} onChange={(e) => setDraft(e.target.value)}
              placeholder="Anota cómo fue el entreno, sensaciones, ajustes para la próxima vez..."
              style={{ width: '100%', minHeight: 140, background: 'var(--surface2)', border: '1px solid var(--accent)', borderRadius: 10, color: 'var(--text)', fontFamily: "'DM Sans', sans-serif", fontSize: 13, lineHeight: 1.7, padding: '12px 14px', outline: 'none', resize: 'none', boxSizing: 'border-box' }} />
            <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 6 }}>Se guarda con la sesión al pulsar GUARDAR SESIÓN.</div>
          </div>
        </>
      )}

      {/* Selector de ejercicios ad-hoc — portal para escapar del contexto de apilamiento */}
      {selectorOpen && createPortal(
        <ExerciseSelector
          onSelect={handleSelectAdHoc}
          onClose={() => setSelectorOpen(false)}
          existingPatterns={exercises.map((e) => e.def?.pattern).filter(Boolean)}
        />,
        document.body
      )}
    </div>
  );
}

// ── Tarjeta para ejercicios ad-hoc ────────────────────────────────────────────
function AdHocCard({ def, exerciseId, setsState, onFieldChange, onToggleDone, onAddSet, onRemove }) {
  const isTime = def?.progressionModel === 'time_progression';
  const name = def?.name ?? exerciseId;

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '10px 14px 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 9, letterSpacing: 1.5, color: 'var(--accent)', textTransform: 'uppercase', marginBottom: 2 }}>Añadido · Esta sesión</div>
          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>{name}</div>
        </div>
        <button onClick={onRemove} style={{ background: 'none', border: 'none', color: 'var(--muted2)', fontSize: 16, cursor: 'pointer', padding: '4px 8px' }}>✕</button>
      </div>

      {/* Sets */}
      <div style={{ padding: '4px 14px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {setsState.map((set, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ fontSize: 10, color: 'var(--muted)', width: 26, letterSpacing: 1 }}>S{i + 1}</div>
            {isTime ? (
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 9, color: 'var(--muted2)', textAlign: 'center', marginBottom: 2 }}>Seg</div>
                <input type="number" inputMode="numeric" placeholder="—" value={set.time ?? ''}
                  onChange={(e) => onFieldChange(i, 'time', e.target.value)}
                  style={setInputStyle} />
              </div>
            ) : (
              <>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 9, color: 'var(--muted2)', textAlign: 'center', marginBottom: 2 }}>Kg</div>
                  <input type="number" inputMode="decimal" placeholder="—" value={set.weight ?? ''}
                    onChange={(e) => onFieldChange(i, 'weight', e.target.value)}
                    style={setInputStyle} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 9, color: 'var(--muted2)', textAlign: 'center', marginBottom: 2 }}>Reps</div>
                  <input type="number" inputMode="numeric" placeholder="—" value={set.reps ?? ''}
                    onChange={(e) => onFieldChange(i, 'reps', e.target.value)}
                    style={setInputStyle} />
                </div>
              </>
            )}
            <button onClick={() => onToggleDone(i)} style={{
              width: 32, height: 32, borderRadius: 6, border: '1px solid',
              borderColor: set.done ? 'var(--green)' : 'var(--border)',
              background: set.done ? 'rgba(74,222,128,0.1)' : 'var(--surface2)',
              color: set.done ? 'var(--green)' : 'var(--muted)',
              fontSize: 14, cursor: 'pointer', marginTop: 18, flexShrink: 0,
            }}>✓</button>
          </div>
        ))}
        <button onClick={onAddSet} style={{
          background: 'none', border: '1px dashed var(--border)', borderRadius: 6,
          color: 'var(--muted)', fontFamily: "'DM Sans', sans-serif",
          fontSize: 11, padding: '6px', cursor: 'pointer', marginTop: 2,
        }}>＋ serie</button>
      </div>
    </div>
  );
}

const setInputStyle = {
  background: 'var(--surface2)', border: '1px solid var(--border)',
  borderRadius: 6, color: 'var(--text)', fontFamily: "'DM Sans', sans-serif",
  fontSize: 15, fontWeight: 500, textAlign: 'center',
  padding: '8px 4px', width: '100%', outline: 'none',
};

