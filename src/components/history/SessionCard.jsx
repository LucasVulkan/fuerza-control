import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatDate } from '../../utils/formatters';
import { useStore } from '../../store/useStore';
import { useExerciseName } from '../../hooks/useExerciseName';

const DAY_COLORS = {
  A: 'var(--day1)', B: 'var(--day2)', C: 'var(--day3)',
  D: 'var(--day4)', E: 'var(--day5)', F: 'var(--day6)',
};

export default function SessionCard({ session, onDelete }) {
  const { t } = useTranslation();
  const getExName = useExerciseName();
  const [open, setOpen] = useState(false);
  const getEffectiveTemplate = useStore((s) => s.getEffectiveTemplate);
  const exerciseLibrary = useStore((s) => s.exerciseLibrary);
  const customExercises = useStore((s) => s.customExercises);
  const programs = useStore((s) => s.programs);
  const allExercises = { ...exerciseLibrary, ...customExercises };

  const template = getEffectiveTemplate(session.sessionTemplateId);
  const label = template?.label ?? '?';
  const name = template?.name ?? session.sessionTemplateId;
  const color = template?.color ?? DAY_COLORS[label] ?? 'var(--accent)';

  const stageName = (() => {
    if (!template?.programId) return null;
    const program = programs[template.programId];
    if (!program?.stages?.length) return null;
    for (const stage of program.stages) {
      if (stage.days.some((d) => d.sessionTemplateId === session.sessionTemplateId)) {
        return stage.name;
      }
    }
    return null;
  })();

  return (
    <div style={{
      background: 'var(--surface)',
      border: 'var(--border-width) solid var(--border-card)',
      borderRadius: 10,
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div
        onClick={() => setOpen((o) => !o)}
        style={{
          padding: '12px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          borderLeft: `3px solid ${color}`,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 15, letterSpacing: 1, color }}>
            {t('common.day')} {label} · {name.toUpperCase()}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>{formatDate(session.timestamp)}</span>
            {stageName && (
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>· {stageName}</span>
            )}
            {session.notes?.trim() && (
              <span style={{ fontSize: 9, background: 'var(--accent-tint)', border: 'var(--border-width) solid var(--accent-tint-border)', borderRadius: 3, color: 'var(--accent)', padding: '1px 5px', letterSpacing: 0.5 }}>{t('history.noteTag')}</span>
            )}
            {session.exercises?.some((e) => e.isAdHoc) && (
              <span style={{ fontSize: 9, background: 'rgba(126,184,255,0.08)', border: '1px solid rgba(126,184,255,0.2)', borderRadius: 3, color: 'var(--accent3)', padding: '1px 5px', letterSpacing: 0.5 }}>{t('history.modifiedTag')}</span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(session.id); }}
            style={{
              background: 'none', border: 'none',
              color: 'var(--muted2)', fontSize: 14,
              cursor: 'pointer', padding: '4px 8px',
            }}
          >
            ✕
          </button>
          <div style={{
            color: 'var(--muted)', fontSize: 13,
            transition: 'transform 0.2s',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          }}>
            ▾
          </div>
        </div>
      </div>

      {/* Detalle de ejercicios */}
      {open && (
        <div>
          {/* Nota de sesión */}
          {session.notes?.trim() && (
            <div style={{
              padding: '10px 14px',
              borderTop: 'var(--border-width) solid var(--border)',
              background: 'var(--accent-tint)',
              borderLeft: '2px solid var(--accent-tint-border)',
            }}>
              <div style={{ fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 4, opacity: 0.8 }}>{t('history.noteLabel')}</div>
              <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{session.notes}</div>
            </div>
          )}
          {session.exercises.map((ex) => {
            const def = allExercises[ex.exerciseId];
            const doneSets = ex.sets.filter((s) => s.done || s.weight || s.reps || s.time);
            if (!doneSets.length) return null;

            return (
              <div key={ex.exerciseId} style={{
                padding: '8px 14px',
                borderTop: 'var(--border-width) solid var(--border)',
              }}>
                <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 4 }}>
                  {def ? getExName(def) : ex.exerciseId}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {ex.sets.map((s, i) => {
                    const label = buildSetLabel(s, i, def);
                    return (
                      <span key={i} style={{
                        fontSize: 10,
                        background: s.done ? 'rgba(74,222,128,0.08)' : 'var(--surface2)',
                        border: s.done ? '1px solid rgba(74,222,128,0.3)' : 'var(--border-width) solid var(--border)',
                        borderRadius: 4,
                        padding: '2px 7px',
                        color: s.done ? 'var(--green)' : 'var(--muted)',
                      }}>
                        {label}
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function buildSetLabel(set, index, def) {
  if (set.time) return set.time + 's';
  if (set.weight && set.reps) return set.weight + 'kg×' + set.reps;
  if (set.reps) return set.reps + ' reps';
  if (set.weight) return set.weight + 'kg';
  return 'S' + (index + 1);
}
