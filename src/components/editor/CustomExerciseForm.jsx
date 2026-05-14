import { useState } from 'react';
import { useStore } from '../../store/useStore';

const PATTERNS = [
  { value: 'vertical_pull',   label: 'Tracción vertical (dominadas, jalones, curls)' },
  { value: 'horizontal_pull', label: 'Tracción horizontal (remo, face pull)' },
  { value: 'vertical_push',   label: 'Empuje vertical (press hombro, dips, tríceps)' },
  { value: 'horizontal_push', label: 'Empuje horizontal (press banca, flexiones)' },
  { value: 'squat',           label: 'Pierna rodilla (sentadilla, prensa, extensión)' },
  { value: 'hip_hinge',       label: 'Pierna cadera (peso muerto, swing, curl isquios)' },
  { value: 'core',            label: 'Core (plancha, hollow, ab wheel, crunch)' },
  { value: 'carry_grip',      label: 'Agarre / Carga (dead hang, farmer carry)' },
  { value: 'calf_raise',      label: 'Gemelos' },
];

const EQUIPMENT_OPTIONS = [
  { value: 'barbell',         label: 'Barra' },
  { value: 'dumbbell',        label: 'Mancuernas' },
  { value: 'cables',          label: 'Poleas / cables' },
  { value: 'machines',        label: 'Máquinas' },
  { value: 'pullup_bar',      label: 'Barra de dominadas' },
  { value: 'resistance_band', label: 'Banda elástica' },
  { value: 'bodyweight',      label: 'Peso corporal' },
  { value: 'kettlebell',      label: 'Kettlebell' },
  { value: 'rings',           label: 'Anillas' },
  { value: 'parallettes',     label: 'Paralelas' },
];

const inputStyle = {
  width: '100%',
  background: 'var(--surface2)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  color: 'var(--text)',
  fontFamily: "'DM Sans', sans-serif",
  fontSize: 14,
  padding: '10px 14px',
  outline: 'none',
  boxSizing: 'border-box',
};

const labelStyle = {
  fontSize: 10,
  letterSpacing: 1.5,
  textTransform: 'uppercase',
  color: 'var(--muted)',
  marginBottom: 6,
  display: 'block',
};

function generateCustomId() {
  return 'custom_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
}

export default function CustomExerciseForm({ onCreated, onClose }) {
  const addCustomExercise = useStore((s) => s.addCustomExercise);
  const [advanced, setAdvanced] = useState(false);
  const [errors, setErrors] = useState({});

  const [form, setForm] = useState({
    name: '',
    pattern: '',
    sets: 3,
    minReps: 8,
    maxReps: 12,
    restSec: 90,
    equipment: [],
    isUnilateral: false,
    progressionModel: 'double_progression',
    level: 'intermediate',
    notes: '',
  });

  function set_(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    if (errors[field]) setErrors((e) => ({ ...e, [field]: null }));
  }

  function toggleEquipment(val) {
    setForm((f) => ({
      ...f,
      equipment: f.equipment.includes(val)
        ? f.equipment.filter((e) => e !== val)
        : [...f.equipment, val],
    }));
  }

  function validate() {
    const errs = {};
    if (!form.name.trim()) errs.name = 'El nombre es obligatorio';
    if (!form.pattern)     errs.pattern = 'Selecciona un patrón';
    return errs;
  }

  function handleCreate() {
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    const id = generateCustomId();
    const def = {
      id,
      name: form.name.trim(),
      pattern: form.pattern,
      primaryGroup: 'custom',
      muscles: [],
      equipment: form.equipment,
      level: form.level,
      isCompound: true,
      isKeyCandidate: true,
      isUnilateral: form.isUnilateral,
      progressionModel: form.progressionModel,
      progressionDirection: 'increase',
      minReps: parseInt(form.minReps),
      maxReps: parseInt(form.maxReps),
      weightStep: 2.5,
      restSec: parseInt(form.restSec),
      tips: form.notes.trim() ? [form.notes.trim()] : [],
      isCustom: true,
    };

    addCustomExercise(def);
    onCreated(id);
  }

  return (
    <div style={{
      background: 'var(--bg)',
      borderTop: '1px solid var(--border)',
      borderRadius: '16px 16px 0 0',
      marginTop: 'auto',
      maxHeight: '92vh',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px 12px',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 1 }}>
          NUEVO EJERCICIO
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 22, cursor: 'pointer' }}>✕</button>
      </div>

      {/* Formulario scrollable */}
      <div style={{ overflowY: 'auto', flex: 1, padding: '16px 20px 8px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Nombre */}
        <div>
          <label style={labelStyle}>Nombre *</label>
          <input
            type="text"
            placeholder="Ej: Press Pallof con cable"
            value={form.name}
            onChange={(e) => set_('name', e.target.value)}
            style={{ ...inputStyle, borderColor: errors.name ? '#ef4444' : 'var(--border)' }}
            onFocus={(e) => e.target.style.borderColor = 'var(--accent)'}
            onBlur={(e) => e.target.style.borderColor = errors.name ? '#ef4444' : 'var(--border)'}
          />
          {errors.name && <span style={{ fontSize: 11, color: '#ef4444', marginTop: 4, display: 'block' }}>{errors.name}</span>}
        </div>

        {/* Patrón */}
        <div>
          <label style={labelStyle}>Patrón de movimiento *</label>
          <select
            value={form.pattern}
            onChange={(e) => set_('pattern', e.target.value)}
            style={{ ...inputStyle, borderColor: errors.pattern ? '#ef4444' : 'var(--border)' }}
          >
            <option value="">Seleccionar patrón...</option>
            {PATTERNS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
          {errors.pattern && <span style={{ fontSize: 11, color: '#ef4444', marginTop: 4, display: 'block' }}>{errors.pattern}</span>}
        </div>

        {/* Series y Reps */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          <div>
            <label style={labelStyle}>Series</label>
            <input type="number" min={1} max={10} value={form.sets}
              onChange={(e) => set_('sets', e.target.value)}
              style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Reps mín</label>
            <input type="number" min={1} max={50} value={form.minReps}
              onChange={(e) => set_('minReps', e.target.value)}
              style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Reps máx</label>
            <input type="number" min={1} max={50} value={form.maxReps}
              onChange={(e) => set_('maxReps', e.target.value)}
              style={inputStyle} />
          </div>
        </div>

        {/* Descanso */}
        <div>
          <label style={labelStyle}>Descanso (segundos)</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {[60, 90, 120, 180].map((s) => (
              <button
                key={s}
                onClick={() => set_('restSec', s)}
                style={{
                  flex: 1,
                  background: form.restSec === s ? 'var(--accent)' : 'var(--surface2)',
                  border: '1px solid',
                  borderColor: form.restSec === s ? 'var(--accent)' : 'var(--border)',
                  borderRadius: 6,
                  color: form.restSec === s ? '#0d0d0d' : 'var(--muted)',
                  fontSize: 12,
                  padding: '8px 0',
                  cursor: 'pointer',
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                {s}s
              </button>
            ))}
          </div>
        </div>

        {/* Equipo */}
        <div>
          <label style={labelStyle}>Material necesario</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {EQUIPMENT_OPTIONS.map((eq) => {
              const active = form.equipment.includes(eq.value);
              return (
                <button
                  key={eq.value}
                  onClick={() => toggleEquipment(eq.value)}
                  style={{
                    background: active ? 'rgba(232,255,71,0.1)' : 'var(--surface2)',
                    border: '1px solid',
                    borderColor: active ? 'rgba(232,255,71,0.4)' : 'var(--border)',
                    borderRadius: 6,
                    color: active ? 'var(--accent)' : 'var(--muted)',
                    fontSize: 11,
                    padding: '5px 10px',
                    cursor: 'pointer',
                    fontFamily: "'DM Sans', sans-serif",
                  }}
                >
                  {eq.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Notas / tips */}
        <div>
          <label style={labelStyle}>Notas de ejecución</label>
          <textarea
            placeholder="Ej: Mantener la columna neutra durante todo el recorrido..."
            value={form.notes}
            onChange={(e) => set_('notes', e.target.value)}
            rows={2}
            style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
          />
        </div>

        {/* Opciones avanzadas */}
        <button
          onClick={() => setAdvanced((a) => !a)}
          style={{
            background: 'none', border: 'none',
            color: 'var(--muted)', fontSize: 12,
            cursor: 'pointer', textAlign: 'left', padding: 0,
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          {advanced ? '▾' : '›'} Opciones avanzadas
        </button>

        {advanced && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 4 }}>
            {/* Unilateral */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, color: 'var(--text)' }}>Ejercicio unilateral (c/lado)</span>
              <button
                onClick={() => set_('isUnilateral', !form.isUnilateral)}
                style={{
                  width: 44, height: 24, borderRadius: 12,
                  background: form.isUnilateral ? 'var(--accent)' : 'var(--surface2)',
                  border: '1px solid var(--border)',
                  cursor: 'pointer', position: 'relative', transition: 'background 0.2s',
                }}
              >
                <div style={{
                  position: 'absolute', top: 3,
                  left: form.isUnilateral ? 22 : 3,
                  width: 16, height: 16, borderRadius: '50%',
                  background: form.isUnilateral ? '#0d0d0d' : 'var(--muted)',
                  transition: 'left 0.2s',
                }} />
              </button>
            </div>

            {/* Modelo de progresión */}
            <div>
              <label style={labelStyle}>Modelo de progresión</label>
              <select
                value={form.progressionModel}
                onChange={(e) => set_('progressionModel', e.target.value)}
                style={inputStyle}
              >
                <option value="double_progression">Doble progresión (peso + reps)</option>
                <option value="time_progression">Progresión en tiempo</option>
                <option value="submax">Submáximo (RIR)</option>
                <option value="load_progression">Progresión de carga</option>
              </select>
            </div>

            {/* Nivel */}
            <div>
              <label style={labelStyle}>Nivel técnico</label>
              <select
                value={form.level}
                onChange={(e) => set_('level', e.target.value)}
                style={inputStyle}
              >
                <option value="beginner">Principiante</option>
                <option value="intermediate">Intermedio</option>
                <option value="advanced">Avanzado</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Botones */}
      <div style={{
        flexShrink: 0,
        padding: '12px 20px 28px',
        borderTop: '1px solid var(--border)',
        display: 'flex', gap: 10,
      }}>
        <button
          onClick={onClose}
          style={{
            flex: 1,
            background: 'transparent',
            border: '1.5px solid rgba(255,255,255,0.25)',
            borderRadius: 10, color: '#fff',
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 13, padding: 13, cursor: 'pointer',
          }}
        >
          Cancelar
        </button>
        <button
          onClick={handleCreate}
          style={{
            flex: 2,
            background: 'var(--accent)', border: 'none',
            borderRadius: 10, color: '#0d0d0d',
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: 20, letterSpacing: 1.5,
            padding: 13, cursor: 'pointer',
          }}
        >
          CREAR EJERCICIO
        </button>
      </div>
    </div>
  );
}
