import { useState, useMemo } from 'react';
import { useStore } from '../../store/useStore';
import CustomExerciseForm from './CustomExerciseForm';

// Etiquetas legibles para los patrones
const PATTERN_LABELS = {
  vertical_pull:   'Tracción vertical',
  horizontal_pull: 'Tracción horizontal',
  vertical_push:   'Empuje vertical',
  horizontal_push: 'Empuje horizontal',
  squat:           'Pierna (rodilla)',
  hip_hinge:       'Pierna (cadera)',
  core:            'Core',
  carry_grip:      'Agarre / Carga',
  calf_raise:      'Gemelos',
};

const MUSCLE_LABELS = {
  latissimus_dorsi: 'Espalda (dorsal)',
  biceps: 'Bíceps',
  rear_deltoid: 'Deltoides posterior',
  rhomboids: 'Romboides',
  mid_trapezius: 'Trapecio medio',
  pectoralis: 'Pectoral',
  triceps: 'Tríceps',
  anterior_deltoid: 'Deltoides anterior',
  deltoid: 'Hombro',
  hamstrings: 'Isquiotibiales',
  glutes: 'Glúteos',
  erector_spinae: 'Erector espinal',
  quadriceps: 'Cuádriceps',
  rectus_abdominis: 'Abdominales',
  hip_flexors: 'Flexores de cadera',
  forearms: 'Antebrazos',
  serratus: 'Serrato',
};

export default function ExerciseSelector({ currentExerciseId, templateId, existingPatterns = [], onSelect, onClose }) {
  const exerciseLibrary = useStore((s) => s.exerciseLibrary);
  const customExercises = useStore((s) => s.customExercises);
  const allLibrary = useMemo(() => ({ ...exerciseLibrary, ...customExercises }), [exerciseLibrary, customExercises]);
  const currentDef = currentExerciseId ? allLibrary[currentExerciseId] : null;
  const [showCreate, setShowCreate] = useState(false);

  // Modo añadir: si no hay currentExerciseId, empezamos en 'complementary' si hay patrones existentes
  const defaultMode = !currentExerciseId && existingPatterns.length > 0 ? 'complementary' : 'similar';

  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState(defaultMode);
  const [selectedPattern, setSelectedPattern] = useState(currentDef?.pattern ?? '');
  const [selectedMuscle, setSelectedMuscle] = useState('');

  const allExercises = Object.values(allLibrary);

  const filtered = useMemo(() => {
    let results = currentExerciseId
      ? allExercises.filter((ex) => ex.id !== currentExerciseId)
      : allExercises;

    if (search.trim()) {
      const q = search.toLowerCase();
      return results.filter((ex) => ex.name.toLowerCase().includes(q))
        .sort((a, b) => a.name.localeCompare(b.name));
    }

    if (filterMode === 'similar' && currentDef) {
      results = results.filter(
        (ex) => ex.pattern === currentDef.pattern && ex.level === currentDef.level
      );
    } else if (filterMode === 'complementary') {
      // Patrones que NO están en el día — priorizarlos
      const missing = results.filter((ex) => !existingPatterns.includes(ex.pattern));
      const present = results.filter((ex) => existingPatterns.includes(ex.pattern));
      return [...missing, ...present].sort((a, b) => {
        // Dentro de cada grupo, ordenar por nombre
        const aMissing = !existingPatterns.includes(a.pattern);
        const bMissing = !existingPatterns.includes(b.pattern);
        if (aMissing !== bMissing) return aMissing ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
    } else if (filterMode === 'pattern' && selectedPattern) {
      results = results.filter((ex) => ex.pattern === selectedPattern);
    } else if (filterMode === 'muscle' && selectedMuscle) {
      results = results.filter((ex) => ex.muscles?.includes(selectedMuscle));
    }

    return results.sort((a, b) => a.name.localeCompare(b.name));
  }, [search, filterMode, selectedPattern, selectedMuscle, allExercises, currentExerciseId, existingPatterns]);

  const patterns = [...new Set(allExercises.map((e) => e.pattern))].sort();
  const muscles = [...new Set(allExercises.flatMap((e) => e.muscles ?? []))].sort();

  // Tabs disponibles según contexto
  const tabs = [
    ...(currentDef ? [{ id: 'similar', label: 'Similar' }] : []),
    ...(existingPatterns.length > 0 ? [{ id: 'complementary', label: 'Complementario' }] : []),
    { id: 'pattern', label: 'Patrón' },
    { id: 'muscle', label: 'Músculo' },
  ];

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'var(--bg)',
      display: 'flex', flexDirection: 'column',
    }}>
      {showCreate ? (
        <CustomExerciseForm
          onCreated={(id) => { setShowCreate(false); onSelect(id); }}
          onClose={() => setShowCreate(false)}
        />
      ) : (
      <div style={{
        background: 'var(--bg)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px 12px',
          borderBottom: 'var(--border-width) solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 1 }}>
            SELECCIONAR EJERCICIO
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 22, cursor: 'pointer' }}>✕</button>
        </div>

        {/* Buscador */}
        <div style={{ padding: '12px 20px 0', flexShrink: 0 }}>
          <input
            type="text"
            placeholder="Buscar ejercicio..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              background: 'var(--surface2)',
              border: 'var(--border-width) solid var(--border)',
              borderRadius: 8,
              color: 'var(--text)',
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 14,
              padding: '10px 14px',
              outline: 'none',
            }}
            onFocus={(e) => e.target.style.borderColor = 'var(--accent)'}
            onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
          />
        </div>

        {/* Filtros — solo visibles si no hay búsqueda de texto */}
        {!search.trim() && (
          <div style={{ padding: '10px 20px 0', flexShrink: 0 }}>
            {/* Tabs de modo */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setFilterMode(tab.id)}
                  style={{
                    background: filterMode === tab.id ? 'var(--accent)' : 'var(--surface2)',
                    color: filterMode === tab.id ? '#0d0d0d' : 'var(--muted)',
                    border: 'var(--border-width) solid',
                    borderColor: filterMode === tab.id ? 'var(--accent)' : 'var(--border)',
                    borderRadius: 6,
                    fontSize: 11,
                    fontFamily: "'DM Sans', sans-serif",
                    fontWeight: 500,
                    padding: '5px 12px',
                    cursor: 'pointer',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Selector de patrón */}
            {filterMode === 'pattern' && (
              <select
                value={selectedPattern}
                onChange={(e) => setSelectedPattern(e.target.value)}
                style={{
                  width: '100%',
                  background: 'var(--surface2)',
                  border: 'var(--border-width) solid var(--border)',
                  borderRadius: 6,
                  color: 'var(--text)',
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 13,
                  padding: '8px 12px',
                  marginBottom: 4,
                }}
              >
                <option value="">Todos los patrones</option>
                {patterns.map((p) => (
                  <option key={p} value={p}>{PATTERN_LABELS[p] ?? p}</option>
                ))}
              </select>
            )}

            {/* Selector de músculo */}
            {filterMode === 'muscle' && (
              <select
                value={selectedMuscle}
                onChange={(e) => setSelectedMuscle(e.target.value)}
                style={{
                  width: '100%',
                  background: 'var(--surface2)',
                  border: 'var(--border-width) solid var(--border)',
                  borderRadius: 6,
                  color: 'var(--text)',
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 13,
                  padding: '8px 12px',
                  marginBottom: 4,
                }}
              >
                <option value="">Todos los músculos</option>
                {muscles.map((m) => (
                  <option key={m} value={m}>{MUSCLE_LABELS[m] ?? m}</option>
                ))}
              </select>
            )}
          </div>
        )}

        {/* Contador + botón crear */}
        <div style={{ padding: '8px 20px 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <span style={{ fontSize: 10, color: 'var(--muted)', letterSpacing: 1 }}>
            {filtered.length} EJERCICIO{filtered.length !== 1 ? 'S' : ''}
          </span>
          <button
            onClick={() => setShowCreate(true)}
            style={{
              background: 'none',
              border: 'var(--border-width) solid var(--accent-tint-border)',
              borderRadius: 6,
              color: 'var(--accent)',
              fontSize: 11,
              padding: '4px 10px',
              cursor: 'pointer',
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            ＋ Crear ejercicio
          </button>
        </div>

        {/* Lista de resultados */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '0 20px 24px' }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted)', fontSize: 13 }}>
              Sin resultados
            </div>
          ) : (
            filtered.map((ex) => (
              <ExerciseOption
                key={ex.id}
                ex={ex}
                onSelect={() => onSelect(ex.id)}
              />
            ))
          )}
        </div>
      </div>
      )}
    </div>
  );
}

function ExerciseOption({ ex, onSelect }) {
  return (
    <div
      onClick={onSelect}
      style={{
        padding: '11px 0',
        borderBottom: 'var(--border-width) solid var(--border)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
      }}
    >
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 500 }}>{ex.name}</span>
          {ex.isCustom && (
            <span style={{
              fontSize: 9, letterSpacing: 1,
              background: 'var(--accent-tint)',
              border: 'var(--border-width) solid var(--accent-tint-border)',
              color: 'var(--accent)',
              borderRadius: 4, padding: '1px 5px',
            }}>CUSTOM</span>
          )}
        </div>
        <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>
          {PATTERN_LABELS[ex.pattern] ?? ex.pattern}
          {ex.level === 'intermediate' ? ' · Intermedio' : ex.level === 'beginner' ? ' · Principiante' : ''}
        </div>
      </div>
      <span style={{ color: 'var(--muted)', fontSize: 18, flexShrink: 0 }}>›</span>
    </div>
  );
}
