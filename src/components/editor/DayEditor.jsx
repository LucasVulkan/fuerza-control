import { useState } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useStore } from '../../store/useStore';
import ExerciseEditor from './ExerciseEditor';
import ExerciseSelector from './ExerciseSelector';

// ─── Fila sortable individual ─────────────────────────────────────────────────

function SortableExerciseRow({ exConfig, def, templateId, editingExId, setEditingExId, onRemove, isHole, swipeProgress }) {
  const isEditing = editingExId === exConfig.exerciseId;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: exConfig.exerciseId,
    disabled: isEditing,
  });
  const canDelete = swipeProgress >= 1;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? 'none' : transition,
    padding: '10px 16px',
    borderBottom: '1px solid var(--border)',
    background: isDragging && swipeProgress > 0
      ? `linear-gradient(to left, rgba(239,68,68,${0.05 + swipeProgress * 0.25}), transparent)`
      : 'transparent',
    opacity: isDragging ? 0 : 1,
    cursor: isEditing ? 'default' : 'grab',
    touchAction: 'none',
    userSelect: 'none',
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          color: isDragging && swipeProgress > 0 ? `rgba(239,68,68,${swipeProgress})` : 'var(--muted)',
          fontSize: 16, lineHeight: 1, flexShrink: 0,
        }}>
          ⠿
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 13, fontWeight: 500,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            color: 'var(--text)',
          }}>
            {def?.name ?? exConfig.exerciseId}
          </div>
          <div style={{ fontSize: 10, color: isDragging && canDelete ? '#ef4444' : 'var(--muted)', marginTop: 2 }}>
            {isDragging && canDelete ? 'Suelta para eliminar' : `${exConfig.sets} series · ${exConfig.restSec}s descanso`}
          </div>
        </div>
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => setEditingExId(isEditing ? null : exConfig.exerciseId)}
          style={{
            background: isEditing ? 'rgba(232,255,71,0.1)' : 'var(--surface2)',
            border: '1px solid',
            borderColor: isEditing ? 'rgba(232,255,71,0.3)' : 'var(--border)',
            borderRadius: 6,
            color: isEditing ? 'var(--accent)' : 'var(--muted)',
            fontSize: 12, padding: '5px 10px', cursor: 'pointer',
            fontFamily: "'DM Sans', sans-serif",
            flexShrink: 0, touchAction: 'auto',
          }}
        >
          {isEditing ? 'Cerrar' : '✎'}
        </button>
      </div>
      {isEditing && (
        <ExerciseEditor
          templateId={templateId}
          exConfig={exConfig}
          def={def}
          onClose={() => setEditingExId(null)}
        />
      )}
    </div>
  );
}

// Clon flotante que sigue el dedo durante el drag
function DragClone({ exConfig, def, swipeProgress }) {
  const canDelete = swipeProgress >= 1;
  const r = Math.round(swipeProgress * 239);
  const g = Math.round(swipeProgress * 68);
  const b = Math.round(swipeProgress * 68);
  const textColor = swipeProgress > 0 ? `rgb(${r},${g},${b})` : 'var(--text)';
  const borderColor = swipeProgress > 0
    ? `rgba(239,68,68,${0.2 + swipeProgress * 0.5})`
    : 'var(--border)';
  const bg = swipeProgress > 0
    ? `rgba(239,68,68,${swipeProgress * 0.15})`
    : 'var(--surface2)';

  return (
    <div style={{
      padding: '10px 16px',
      background: bg,
      border: `1px solid ${borderColor}`,
      borderRadius: 10,
      opacity: 0.95,
      boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', gap: 10,
      cursor: 'grabbing',
    }}>
      <div style={{ color: swipeProgress > 0 ? textColor : 'var(--muted)', fontSize: 16, lineHeight: 1, flexShrink: 0 }}>⠿</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {def?.name ?? exConfig?.exerciseId}
        </div>
        <div style={{ fontSize: 10, color: canDelete ? '#ef4444' : 'var(--muted)', marginTop: 2 }}>
          {canDelete ? 'Suelta para eliminar' : `${exConfig?.sets} series · ${exConfig?.restSec}s descanso`}
        </div>
      </div>
    </div>
  );
}

// ─── DayEditor principal ──────────────────────────────────────────────────────

export default function DayEditor({ templateId }) {
  const getEffectiveTemplate = useStore((s) => s.getEffectiveTemplate);
  const exerciseLibrary = useStore((s) => s.exerciseLibrary);
  const customExercises = useStore((s) => s.customExercises);
  const allExercises = { ...exerciseLibrary, ...customExercises };
  const resetTemplate = useStore((s) => s.resetTemplate);
  const removeExercise = useStore((s) => s.removeExercise);
  const addExercise = useStore((s) => s.addExercise);
  const reorderExercise = useStore((s) => s.reorderExercise);
  const showToast = useStore((s) => s.showToast);
  const userPrograms = useStore((s) => s.userPrograms);
  const renameSession = useStore((s) => s.renameSession);

  const template = getEffectiveTemplate(templateId);
  const isEdited = !!userPrograms[templateId];

  const [open, setOpen] = useState(false);
  const [editingExId, setEditingExId] = useState(null);
  const [showAddSelector, setShowAddSelector] = useState(false);
  const [draggingId, setDraggingId] = useState(null);
  const [swipeProgress, setSwipeProgress] = useState(0);
  const [editingSessionName, setEditingSessionName] = useState(false);
  const [sessionNameValue, setSessionNameValue] = useState('');

  const SWIPE_START = 40;  // px donde empieza a ponerse rojo
  const SWIPE_END   = 160; // px donde está listo para eliminar

  // Sensores: pointer para desktop, touch para móvil
  // activationConstraint evita que un tap accidental active el drag
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  );

  if (!template) return null;

  const color = template.color ?? 'var(--accent)';
  const exerciseIds = template.exercises.map((ex) => ex.exerciseId);

  const existingPatterns = template.exercises.map((ex) =>
    allExercises[ex.exerciseId]?.pattern
  ).filter(Boolean);

  function handleDragStart(event) {
    setDraggingId(event.active.id);
    setSwipeProgress(0);
  }

  function handleDragMove(event) {
    const { delta } = event;
    const isHorizontal = Math.abs(delta.x) > Math.abs(delta.y) * 2;
    if (!isHorizontal || delta.x < 0) {
      setSwipeProgress(0);
      return;
    }
    const progress = Math.min(1, Math.max(0, (delta.x - SWIPE_START) / (SWIPE_END - SWIPE_START)));
    setSwipeProgress(progress);
  }

  function handleDragEnd(event) {
    const { active, over, delta } = event;
    setDraggingId(null);
    setSwipeProgress(0);

    const isHorizontal = Math.abs(delta.x) > Math.abs(delta.y) * 2;
    if (delta.x >= SWIPE_END && isHorizontal) {
      handleRemove(active.id);
      return;
    }

    if (!over || active.id === over.id) return;

    const oldIndex = template.exercises.findIndex((ex) => ex.exerciseId === active.id);
    const newIndex = template.exercises.findIndex((ex) => ex.exerciseId === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove([...template.exercises], oldIndex, newIndex)
      .map((ex, i) => ({ ...ex, order: i + 1 }));

    reorderExercise(templateId, active.id, oldIndex < newIndex ? 'down' : 'up', reordered);
  }

  function handleReset() {
    if (window.confirm('¿Restaurar este día a los valores originales?')) {
      resetTemplate(templateId);
      showToast('✓ Día restaurado');
      setEditingExId(null);
    }
  }

  function handleRemove(exerciseId) {
    removeExercise(templateId, exerciseId);
    if (editingExId === exerciseId) setEditingExId(null);
    showToast('✓ Ejercicio eliminado');
  }

  function handleAdd(exerciseId) {
    addExercise(templateId, exerciseId);
    setShowAddSelector(false);
    showToast('✓ Ejercicio añadido');
  }

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderLeft: `3px solid ${color}`,
      borderRadius: 10,
      overflow: 'hidden',
    }}>
      {/* Header del día */}
      <div
        style={{
          padding: '14px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }} onClick={() => { if (!editingSessionName) { setOpen((o) => !o); setEditingExId(null); } }}>
          {editingSessionName ? (
            <input
              autoFocus
              value={sessionNameValue}
              onChange={(e) => setSessionNameValue(e.target.value)}
              onBlur={() => {
                const trimmed = sessionNameValue.trim();
                if (trimmed && trimmed !== template.name) renameSession(templateId, trimmed);
                setEditingSessionName(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.target.blur();
                if (e.key === 'Escape') setEditingSessionName(false);
                e.stopPropagation();
              }}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '100%', background: 'var(--surface2)',
                border: '1px solid var(--accent)', borderRadius: 6,
                color: color, fontFamily: "'Bebas Neue', sans-serif",
                fontSize: 16, letterSpacing: 1, padding: '3px 8px', outline: 'none',
              }}
            />
          ) : (
            <div
              style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, letterSpacing: 1, color, cursor: 'pointer', userSelect: 'none' }}
            >
              DÍA {template.label} · {template.name.toUpperCase()}
            </div>
          )}
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
            {template.exercises.length} ejercicios
            {isEdited && <span style={{ color: 'var(--accent)', marginLeft: 8 }}>· Editado</span>}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <button
            onClick={(e) => { e.stopPropagation(); setSessionNameValue(template.name); setEditingSessionName(true); }}
            style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 12, cursor: 'pointer', padding: '2px 4px' }}
          >✎</button>
          <div
            onClick={() => { setOpen((o) => !o); setEditingExId(null); setEditingSessionName(false); }}
            style={{ color: 'var(--muted)', fontSize: 16, transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)', cursor: 'pointer' }}
          >▾</div>
        </div>
      </div>

      {/* Lista sortable */}
      {open && (
        <div style={{ borderTop: '1px solid var(--border)' }}>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragMove={handleDragMove} onDragEnd={handleDragEnd}>
            <SortableContext items={exerciseIds} strategy={verticalListSortingStrategy}>
              {template.exercises.map((exConfig, i) => (
                <SortableExerciseRow
                  key={exConfig.exerciseId}
                  exConfig={exConfig}
                  def={allExercises[exConfig.exerciseId]}
                  templateId={templateId}
                  editingExId={editingExId}
                  setEditingExId={setEditingExId}
                  onRemove={handleRemove}
                  isHole={draggingId === exConfig.exerciseId}
                  swipeProgress={draggingId === exConfig.exerciseId ? swipeProgress : 0}
                />
              ))}
            </SortableContext>
            <DragOverlay>
              {draggingId ? (
                <DragClone
                  exConfig={template.exercises.find((ex) => ex.exerciseId === draggingId)}
                  def={allExercises[draggingId]}
                  swipeProgress={swipeProgress}
                />
              ) : null}
            </DragOverlay>
          </DndContext>

          {/* Botón añadir */}
          <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
            <button
              onClick={() => setShowAddSelector(true)}
              style={{
                flex: 1,
                background: 'rgba(232,255,71,0.06)',
                border: '1px dashed rgba(232,255,71,0.3)',
                borderRadius: 8,
                color: 'var(--accent)',
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 12,
                padding: '10px 0',
                cursor: 'pointer',
              }}
            >
              ＋ Añadir ejercicio
            </button>
            {isEdited && (
              <button
                onClick={handleReset}
                style={{
                  background: 'none',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  color: 'var(--muted)',
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 11,
                  padding: '10px 12px',
                  cursor: 'pointer',
                }}
              >
                ↩ Restaurar
              </button>
            )}
          </div>
        </div>
      )}

      {showAddSelector && (
        <ExerciseSelector
          currentExerciseId={null}
          templateId={templateId}
          existingPatterns={existingPatterns}
          onSelect={handleAdd}
          onClose={() => setShowAddSelector(false)}
        />
      )}
    </div>
  );
}

