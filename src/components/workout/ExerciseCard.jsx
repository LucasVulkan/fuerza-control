import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useExerciseName } from '../../hooks/useExerciseName';
import ProgressionChip from '../ui/ProgressionChip';
import SetRow from './SetRow';

export default function ExerciseCard({ index, exerciseId, def, sets, exConfig, currentSets, lastSets, prevSummary, progression, onFieldChange, onToggleDone, onAddSet }) {
  const { t, i18n } = useTranslation();
  const getExName = useExerciseName();
  const [tipsOpen, setTipsOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  if (!def) return null;

  const exName = getExName(def);
  const tips = i18n.language === 'en' ? (def.tipsEn ?? def.tips) : def.tips;
  const target = buildTarget(def, sets, exConfig, t);
  const hasTips = tips && tips.length > 0;

  const allDone = currentSets.length > 0 && currentSets.every((s) => s.done);
  const isCollapsed = allDone && !manualOpen;

  if (isCollapsed) {
    return (
      <div style={{
        background: 'var(--surface)',
        border: 'var(--border-width) solid var(--border-card)',
        borderLeft: '3px solid var(--accent)',
        borderRadius: 10,
        padding: '12px 14px 10px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}>
        <div onClick={() => setManualOpen(true)} style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}>
          <div style={{ fontSize: 10, color: 'var(--muted)', letterSpacing: 1, textTransform: 'uppercase' }}>
            {t('workout.exerciseLabel')} {index + 1}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
            <span style={{ color: 'var(--accent)', fontSize: 14 }}>✓</span>
            <span style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.3, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{exName}</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
            {currentSets.map((s, i) => (
              <span key={i} style={{
                fontSize: 10,
                background: 'rgba(74,222,128,0.08)',
                border: '1px solid rgba(74,222,128,0.3)',
                borderRadius: 4,
                padding: '2px 7px',
                color: 'var(--green)',
              }}>
                {buildSetLabel(s, i)}
              </span>
            ))}
          </div>
        </div>

        <button
          onClick={() => { onAddSet?.(); setManualOpen(true); }}
          style={{
            flexShrink: 0,
            background: 'none',
            border: '1px dashed var(--border-dashed)',
            borderRadius: 6,
            color: 'var(--muted)',
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 11,
            padding: '6px 10px',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >{t('workout.addSet')}</button>
      </div>
    );
  }

  return (
    <div style={{
      background: 'var(--surface)',
      border: 'var(--border-width) solid var(--border-card)',
      borderRadius: 10,
      overflow: 'hidden',
    }}>
      {/* Header del ejercicio */}
      <div style={{
        padding: '12px 14px 8px',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 8,
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, color: 'var(--muted)', letterSpacing: 1, textTransform: 'uppercase' }}>
            {t('workout.exerciseLabel')} {index + 1}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
            <div style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.3 }}>
              {exName}
            </div>
            {hasTips && (
              <button
                onClick={() => setTipsOpen((o) => !o)}
                style={{
                  background: tipsOpen ? 'var(--accent-tint-active)' : 'none',
                  border: 'var(--border-width) solid',
                  borderColor: tipsOpen ? 'var(--accent-tint-border)' : 'var(--border)',
                  borderRadius: 4,
                  color: tipsOpen ? 'var(--accent)' : 'var(--muted)',
                  fontSize: 11,
                  cursor: 'pointer',
                  padding: '1px 6px',
                  lineHeight: 1.6,
                  transition: 'all 0.15s',
                  flexShrink: 0,
                }}
              >
                ℹ
              </button>
            )}
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
            {target}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          {manualOpen && (
            <button
              onClick={() => setManualOpen(false)}
              style={{
                background: 'none', border: 'none',
                color: 'var(--muted)', fontSize: 11,
                cursor: 'pointer', padding: '2px 4px',
              }}
            >
              {t('workout.collapse')}
            </button>
          )}
          {prevSummary && prevSummary !== '—' && (
            <div style={{
              fontSize: 10, color: 'var(--accent)',
              textAlign: 'right', whiteSpace: 'nowrap',
              flexShrink: 0, lineHeight: 1.6,
            }}>
              {t('workout.previous')}<br />{prevSummary}
            </div>
          )}
        </div>
      </div>

      {/* Panel de tips — expandible */}
      {tipsOpen && hasTips && (
        <div style={{
          margin: '0 14px 10px',
          padding: '10px 12px',
          background: 'var(--accent-tint)',
          border: '1px solid var(--accent-tint-border)',
          borderRadius: 6,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}>
          {tips.map((tip, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, fontSize: 11, lineHeight: 1.5, color: 'var(--text)' }}>
              <span style={{ color: 'var(--accent)', flexShrink: 0 }}>·</span>
              <span>{tip}</span>
            </div>
          ))}
        </div>
      )}

      {/* Chip de progresión */}
      <ProgressionChip progression={progression} />

      {/* Series */}
      <div style={{ padding: '0 14px 12px', display: 'flex', flexDirection: 'column', gap: 7 }}>
        {currentSets.map((setData, i) => (
          <SetRow
            key={i}
            index={i}
            setData={setData}
            exerciseDef={def}
            lastSet={lastSets[i] ?? null}
            onFieldChange={(field, value) => onFieldChange(exerciseId, i, field, value)}
            onToggleDone={() => onToggleDone(exerciseId, i)}
          />
        ))}
        <button
          onClick={() => onAddSet?.()}
          style={{
            background: 'none',
            border: '1px dashed var(--border-dashed)',
            borderRadius: 6,
            color: 'var(--muted)',
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 11,
            padding: '6px',
            cursor: 'pointer',
            marginTop: 2,
          }}
        >{t('workout.addSet')}</button>
      </div>
    </div>
  );
}

function buildSetLabel(set, index) {
  if (set.time)               return set.time + 's';
  if (set.weight && set.reps) return set.weight + 'kg×' + set.reps;
  if (set.reps)               return set.reps + ' reps';
  if (set.weight)             return set.weight + 'kg';
  return 'S' + (index + 1);
}

function buildTarget(def, sets, exConfig, t) {
  const model = def.progressionModel;
  const minTime  = exConfig?.minTime  ?? def.minTime;
  const maxTime  = exConfig?.maxTime  ?? def.maxTime;
  const minReps  = exConfig?.minReps  ?? def.minReps;
  const maxReps  = exConfig?.maxReps  ?? def.maxReps;

  if (model === 'time_progression') return `${sets} × ${minTime}–${maxTime} s`;
  if (model === 'submax') return `${sets} × ${t('workout.submax')}`;
  const repsText = minReps === maxReps ? `${minReps} reps` : `${minReps}–${maxReps} reps`;
  const unilateral = def.isUnilateral ? ` ${t('workout.perSide')}` : '';
  return `${sets} × ${repsText}${unilateral}`;
}
