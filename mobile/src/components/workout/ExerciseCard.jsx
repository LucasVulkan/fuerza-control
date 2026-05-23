/**
 * ExerciseCard — port fiel del original web.
 * Referencia: src/components/workout/ExerciseCard.jsx
 *
 * - buildTarget: exConfig override + def fallback (igual que web)
 * - hintSetIndex: avanza la fila que muestra las flechas ‹ › de swipe
 * - Colapso automático cuando todas las series están hechas
 * - Vista colapsada: nombre + píldoras por serie + botón añadir
 */

import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import SetRow from './SetRow';
import { useWeightUnit } from '../../hooks/useWeightUnit';
import { getProgression } from '../../../../src/utils/progression';
import { colors, spacing, typography, radius, borders, withOpacity } from '../../theme';

// ── Progression chip colors ────────────────────────────────────────────────────

const CHIP_COLORS = {
  up:   { bg: withOpacity(colors.green,  0.1), border: withOpacity(colors.green,  0.3), text: colors.green },
  down: { bg: 'rgba(248,113,113,0.1)',         border: 'rgba(248,113,113,0.3)',         text: colors.red   },
  hold: { bg: withOpacity(colors.accent, 0.08), border: withOpacity(colors.accent, 0.3), text: colors.accent },
  info: { bg: colors.surface2,                  border: colors.border,                   text: colors.muted  },
};

// ── buildTarget (fiel al original) ────────────────────────────────────────────
// exConfig puede sobreescribir los valores del def (igual que en la web)

function buildTarget(def, exConfig, t) {
  if (!def) return '';
  const model   = def.progressionModel;
  const sets    = exConfig.sets ?? 0;
  const minTime = exConfig.minTime ?? def.minTime;
  const maxTime = exConfig.maxTime ?? def.maxTime;
  const minReps = exConfig.minReps ?? def.minReps;
  const maxReps = exConfig.maxReps ?? def.maxReps;

  if (model === 'time_progression') {
    return `${sets} × ${minTime}–${maxTime} s`;
  }
  if (model === 'submax') {
    return `${sets} × ${t('workout.submax', 'submáx')}`;
  }
  const repsText = minReps === maxReps
    ? `${minReps} reps`
    : `${minReps}–${maxReps} reps`;
  const unilateral = def.isUnilateral ? ` ${t('workout.perSide', 'por lado')}` : '';
  return `${sets} × ${repsText}${unilateral}`;
}

// ── buildSetLabel (para las píldoras en modo colapsado) ───────────────────────

function buildSetLabel(set, index, fmt) {
  if (set.time)               return `${set.time}s`;
  if (set.weight && set.reps) return `${fmt(set.weight)}×${set.reps}`;
  if (set.reps)               return `${set.reps} reps`;
  if (set.weight)             return fmt(set.weight);
  return `S${index + 1}`;
}

// ── Collapsed pill ────────────────────────────────────────────────────────────

function SetPill({ set, index, fmt }) {
  return (
    <View style={styles.setPill}>
      <Text style={styles.setPillText}>{buildSetLabel(set, index, fmt)}</Text>
    </View>
  );
}

// ── Main card ─────────────────────────────────────────────────────────────────

export default function ExerciseCard({
  exConfig,        // { exerciseId, sets, restSec, minReps, maxReps, isKey, order }
  def,             // exercise definition from library
  setsState,       // [{ weight, reps, time, done }]
  lastExercise,    // last session's exercise data (for progression)
  onFieldChange,   // (setIndex, field, value) => void
  onToggleDone,    // (setIndex) => void
  onAddSet,        // () => void
}) {
  const { t, i18n } = useTranslation();
  const { label: weightLabel, toDisplay, toKg, fmt, scrollStep: weightScrollStep } = useWeightUnit();

  const isTime = def?.progressionModel === 'time_progression';
  const name   = def
    ? (i18n.language === 'en' ? (def.nameEn ?? def.name) : def.name)
    : exConfig.exerciseId;

  // hintSetIndex: qué fila muestra las flechas ‹ › de swipe (avanza al rellenar)
  const [hintSetIndex, setHintSetIndex] = useState(0);

  // Auto-collapse cuando todas las series están marcadas
  const allDone = setsState.length > 0 && setsState.every((s) => s.done);
  const [manualOpen, setManualOpen] = useState(false);
  const isCollapsed = allDone && !manualOpen;

  useEffect(() => {
    if (!allDone) setManualOpen(false);
  }, [allDone]);

  // Progression chip
  const progression = (() => {
    if (!lastExercise?.sets?.length) return null;
    try { return getProgression(def, lastExercise.sets, exConfig.sets, t); }
    catch { return null; }
  })();
  const chipStyle = progression ? (CHIP_COLORS[progression.type] ?? CHIP_COLORS.info) : null;

  const targetLabel = buildTarget(def, exConfig, t);

  // ── Collapsed ──────────────────────────────────────────────────────────────
  if (isCollapsed) {
    return (
      <TouchableOpacity
        style={[styles.card, styles.cardCollapsed]}
        onPress={() => setManualOpen(true)}
        activeOpacity={0.75}
      >
        <View style={styles.collapsedRow}>
          <View style={styles.collapsedLeft}>
            <View style={styles.doneIcon}>
              <Text style={styles.doneIconText}>✓</Text>
            </View>
            <View style={{ flex: 1, gap: spacing.xs }}>
              <Text style={styles.name}>{name}</Text>
              <View style={styles.pillsRow}>
                {setsState.map((set, i) => (
                  <SetPill key={i} set={set} index={i} fmt={fmt} />
                ))}
              </View>
            </View>
          </View>

          <TouchableOpacity
            style={styles.addSetBtnSmall}
            onPress={(e) => {
              e.stopPropagation?.();
              setManualOpen(true);
              onAddSet();
            }}
            hitSlop={8}
          >
            <Text style={styles.addSetSmallText}>+</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  }

  // ── Expanded ───────────────────────────────────────────────────────────────
  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {exConfig.isKey && <Text style={styles.keyBadge}>CLAVE</Text>}
          <Text style={styles.name}>{name}</Text>
          {targetLabel ? <Text style={styles.target}>{targetLabel}</Text> : null}
        </View>
        {/* Botón colapsar si se abrió manualmente */}
        {manualOpen && (
          <TouchableOpacity onPress={() => setManualOpen(false)} hitSlop={8}>
            <Text style={styles.collapseBtn}>{t('workout.collapse', 'Colapsar')}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Chip de progresión */}
      {progression?.msg ? (
        <View style={[styles.chip, { backgroundColor: chipStyle.bg, borderColor: chipStyle.border }]}>
          <Text style={[styles.chipText, { color: chipStyle.text }]}>
            {progression.icon}  {progression.msg}
          </Text>
        </View>
      ) : null}

      {/* Cabecera de columnas */}
      <View style={styles.colHeader}>
        <View style={{ width: 28 }} />
        {isTime ? (
          <Text style={[styles.colLabel, { flex: 1, textAlign: 'center' }]}>SEG</Text>
        ) : (
          <>
            <Text style={[styles.colLabel, { flex: 1, textAlign: 'center' }]}>
              {weightLabel.toUpperCase()}
            </Text>
            <Text style={[styles.colLabel, { flex: 1, textAlign: 'center' }]}>REPS</Text>
          </>
        )}
        <View style={{ width: 36 }} />
      </View>

      {/* Filas de series */}
      <View style={styles.setList}>
        {setsState.map((set, i) => {
          const lastSet = lastExercise?.sets?.[i];
          // Prev values ya en unidades de display (para mostrar como hint)
          const prevWeightDisplay = lastSet?.weight != null && lastSet?.weight !== ''
            ? String(toDisplay(lastSet.weight))
            : '';
          const prevReps = lastSet?.reps != null && lastSet?.reps !== ''
            ? String(lastSet.reps)
            : '';
          const prevTime = lastSet?.time != null && lastSet?.time !== ''
            ? String(lastSet.time)
            : '';

          return (
            <SetRow
              key={i}
              index={i}
              set={set}
              isTime={isTime}
              weightDisplay={
                set.weight !== '' && set.weight != null
                  ? String(toDisplay(set.weight))
                  : ''
              }
              prevWeightDisplay={prevWeightDisplay}
              prevReps={prevReps}
              prevTime={prevTime}
              weightScrollStep={weightScrollStep}
              showHint={i === hintSetIndex}
              onWeightChange={(v) => {
                onFieldChange(i, 'weight', v !== '' ? String(toKg(parseFloat(v))) : '');
                if (v !== '' && i >= hintSetIndex) setHintSetIndex(i + 1);
              }}
              onRepsChange={(v) => {
                onFieldChange(i, 'reps', v);
                if (v !== '' && i >= hintSetIndex) setHintSetIndex(i + 1);
              }}
              onTimeChange={(v) => {
                onFieldChange(i, 'time', v);
                if (v !== '' && i >= hintSetIndex) setHintSetIndex(i + 1);
              }}
              onToggleDone={() => {
                // ✓ manual: auto-rellenar campos vacíos desde la última sesión, luego togglear
                if (!set.done && lastSet) {
                  if (!isTime) {
                    if ((set.weight === '' || set.weight == null) && lastSet.weight != null && lastSet.weight !== '') {
                      onFieldChange(i, 'weight', String(lastSet.weight));
                    }
                    if ((set.reps === '' || set.reps == null) && lastSet.reps != null && lastSet.reps !== '') {
                      onFieldChange(i, 'reps', String(lastSet.reps));
                    }
                  } else {
                    if ((set.time === '' || set.time == null) && lastSet.time != null && lastSet.time !== '') {
                      onFieldChange(i, 'time', String(lastSet.time));
                    }
                  }
                }
                onToggleDone(i);
              }}
            />
          );
        })}
      </View>

      {/* Añadir serie */}
      <TouchableOpacity style={styles.addSetBtn} onPress={onAddSet} activeOpacity={0.7}>
        <Text style={styles.addSetText}>+ Añadir serie</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth:     borders.thin,
    borderColor:     colors.borderCard,
    borderRadius:    radius.md,
    overflow:        'hidden',
    paddingBottom:   spacing.xs,
  },
  cardCollapsed: {
    paddingBottom: 0,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems:    'flex-start',
    padding:       spacing.md,
    paddingBottom: spacing.sm,
    gap:           spacing.sm,
  },
  headerLeft: { flex: 1, gap: 3 },
  keyBadge: {
    alignSelf:         'flex-start',
    fontSize:          typography.xs,
    fontWeight:        typography.bold,
    color:             colors.accent,
    backgroundColor:   withOpacity(colors.accent, 0.1),
    borderRadius:      radius.sm,
    paddingHorizontal: spacing.xs,
    paddingVertical:   2,
    overflow:          'hidden',
    letterSpacing:     0.5,
  },
  name: {
    fontSize:   typography.md,
    fontWeight: typography.semibold,
    color:      colors.text,
  },
  target: {
    fontSize: typography.xs,
    color:    colors.muted,
  },
  collapseBtn: {
    fontSize:  typography.xs,
    color:     colors.muted,
    marginTop: 2,
  },

  // Progression chip
  chip: {
    marginHorizontal:  spacing.md,
    marginBottom:      spacing.sm,
    borderWidth:       borders.thin,
    borderRadius:      radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical:   5,
  },
  chipText: {
    fontSize:   typography.xs,
    fontWeight: typography.medium,
  },

  // Column headers
  colHeader: {
    flexDirection:     'row',
    paddingHorizontal: spacing.md,
    gap:               spacing.sm,
    marginBottom:      spacing.xs,
  },
  colLabel: {
    fontSize:      typography.xs,
    fontWeight:    typography.bold,
    color:         colors.muted2,
    letterSpacing: 0.8,
  },

  // Sets
  setList: {
    paddingHorizontal: spacing.md,
  },

  // Add set (expanded)
  addSetBtn: {
    marginTop:        spacing.sm,
    marginHorizontal: spacing.md,
    paddingVertical:  spacing.sm,
    borderWidth:      borders.thin,
    borderColor:      colors.border,
    borderStyle:      'dashed',
    borderRadius:     radius.sm,
    alignItems:       'center',
  },
  addSetText: {
    fontSize:   typography.sm,
    color:      colors.muted,
    fontWeight: typography.medium,
  },

  // Collapsed
  collapsedRow: {
    flexDirection:  'row',
    alignItems:     'center',
    padding:        spacing.md,
    gap:            spacing.sm,
  },
  collapsedLeft: {
    flex:          1,
    flexDirection: 'row',
    alignItems:    'flex-start',
    gap:           spacing.sm,
  },
  doneIcon: {
    width:           22,
    height:          22,
    borderRadius:    radius.full,
    backgroundColor: withOpacity(colors.green, 0.15),
    borderWidth:     borders.thin,
    borderColor:     withOpacity(colors.green, 0.4),
    alignItems:      'center',
    justifyContent:  'center',
    marginTop:       2,
  },
  doneIconText: {
    fontSize:   11,
    color:      colors.green,
    fontWeight: typography.bold,
  },
  pillsRow: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           spacing.xs,
  },
  setPill: {
    backgroundColor:   'rgba(74,222,128,0.08)',
    borderWidth:       borders.thin,
    borderColor:       'rgba(74,222,128,0.3)',
    borderRadius:      radius.sm,
    paddingHorizontal: 7,
    paddingVertical:   2,
  },
  setPillText: {
    fontSize:   typography.xs,
    fontWeight: typography.medium,
    color:      colors.green,
  },
  addSetBtnSmall: {
    flexShrink:        0,
    borderWidth:       borders.thin,
    borderColor:       colors.border,
    borderStyle:       'dashed',
    borderRadius:      radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical:   spacing.xs + 2,
  },
  addSetSmallText: {
    fontSize:   typography.sm,
    color:      colors.muted,
    fontWeight: typography.medium,
  },
});
