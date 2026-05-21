import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../store/useStore';
import CustomExerciseForm from './CustomExerciseForm';

export default function ExerciseSelector({ currentExerciseId, templateId, existingPatterns = [], onSelect, onClose }) {
  const { t } = useTranslation();
  const language = useStore((s) => s.profile.language);

  const exerciseLibrary = useStore((s) => s.exerciseLibrary);
  const customExercises = useStore((s) => s.customExercises);
  const allLibrary = useMemo(() => ({ ...exerciseLibrary, ...customExercises }), [exerciseLibrary, customExercises]);
  const currentDef = currentExerciseId ? allLibrary[currentExerciseId] : null;
  const [showCreate, setShowCreate] = useState(false);

  const defaultMode = !currentExerciseId && existingPatterns.length > 0 ? 'complementary' : 'similar';

  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState(defaultMode);
  const [selectedPattern, setSelectedPattern] = useState(currentDef?.pattern ?? '');
  const [selectedMuscle, setSelectedMuscle] = useState('');

  const allExercises = Object.values(allLibrary);

  function getExName(ex) {
    return language === 'en' ? (ex.nameEn ?? ex.name) : ex.name;
  }

  const filtered = useMemo(() => {
    let results = currentExerciseId
      ? allExercises.filter((ex) => ex.id !== currentExerciseId)
      : allExercises;

    if (search.trim()) {
      const q = search.toLowerCase();
      return results
        .filter((ex) => getExName(ex).toLowerCase().includes(q))
        .sort((a, b) => getExName(a).localeCompare(getExName(b)));
    }

    if (filterMode === 'similar' && currentDef) {
      results = results.filter(
        (ex) => ex.pattern === currentDef.pattern && ex.level === currentDef.level
      );
    } else if (filterMode === 'complementary') {
      const missing = results.filter((ex) => !existingPatterns.includes(ex.pattern));
      const present = results.filter((ex) => existingPatterns.includes(ex.pattern));
      return [...missing, ...present].sort((a, b) => {
        const aMissing = !existingPatterns.includes(a.pattern);
        const bMissing = !existingPatterns.includes(b.pattern);
        if (aMissing !== bMissing) return aMissing ? -1 : 1;
        return getExName(a).localeCompare(getExName(b));
      });
    } else if (filterMode === 'pattern' && selectedPattern) {
      results = results.filter((ex) => ex.pattern === selectedPattern);
    } else if (filterMode === 'muscle' && selectedMuscle) {
      results = results.filter((ex) => ex.muscles?.includes(selectedMuscle));
    }

    return results.sort((a, b) => getExName(a).localeCompare(getExName(b)));
  }, [search, filterMode, selectedPattern, selectedMuscle, allExercises, currentExerciseId, existingPatterns, language]);

  const patterns = [...new Set(allExercises.map((e) => e.pattern))].sort();
  const muscles = [...new Set(allExercises.flatMap((e) => e.muscles ?? []))].sort();

  const tabs = [
    ...(currentDef ? [{ id: 'similar', label: t('exerciseSelector.tabSimilar') }] : []),
    ...(existingPatterns.length > 0 ? [{ id: 'complementary', label: t('exerciseSelector.tabComplementary') }] : []),
    { id: 'pattern', label: t('exerciseSelector.tabPattern') },
    { id: 'muscle', label: t('exerciseSelector.tabMuscle') },
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
            {t('exerciseSelector.title')}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 22, cursor: 'pointer' }}>✕</button>
        </div>

        {/* Buscador */}
        <div style={{ padding: '12px 20px 0', flexShrink: 0 }}>
          <input
            type="text"
            placeholder={t('exerciseSelector.searchPlaceholder')}
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

        {/* Filtros */}
        {!search.trim() && (
          <div style={{ padding: '10px 20px 0', flexShrink: 0 }}>
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
                <option value="">{t('exerciseSelector.allPatterns')}</option>
                {patterns.map((p) => (
                  <option key={p} value={p}>{t(`exerciseSelector.patterns.${p}`, p)}</option>
                ))}
              </select>
            )}

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
                <option value="">{t('exerciseSelector.allMuscles')}</option>
                {muscles.map((m) => (
                  <option key={m} value={m}>{t(`exerciseSelector.muscles.${m}`, m)}</option>
                ))}
              </select>
            )}
          </div>
        )}

        {/* Contador + botón crear */}
        <div style={{ padding: '8px 20px 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <span style={{ fontSize: 10, color: 'var(--muted)', letterSpacing: 1 }}>
            {t('exerciseSelector.exerciseCount', { count: filtered.length })}
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
            {t('exerciseSelector.createExercise')}
          </button>
        </div>

        {/* Lista de resultados */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '0 20px 24px' }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted)', fontSize: 13 }}>
              {t('exerciseSelector.noResults')}
            </div>
          ) : (
            filtered.map((ex) => (
              <ExerciseOption
                key={ex.id}
                ex={ex}
                exName={getExName(ex)}
                patternLabel={t(`exerciseSelector.patterns.${ex.pattern}`, ex.pattern)}
                levelLabel={
                  ex.level === 'intermediate' ? t('exerciseSelector.levelIntermediate')
                  : ex.level === 'beginner' ? t('exerciseSelector.levelBeginner')
                  : ''
                }
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

function ExerciseOption({ ex, exName, patternLabel, levelLabel, onSelect }) {
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
          <span style={{ fontSize: 13, fontWeight: 500 }}>{exName}</span>
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
          {patternLabel}
          {levelLabel ? ` · ${levelLabel}` : ''}
        </div>
      </div>
      <span style={{ color: 'var(--muted)', fontSize: 18, flexShrink: 0 }}>›</span>
    </div>
  );
}
