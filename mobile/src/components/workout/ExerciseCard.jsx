/**
 * ExerciseCard — port fiel del original web.
 *
 * inputType: 'weight_reps' | 'reps' | 'time' | 'weight_time'
 *   Se lee de exConfig.inputType (nuevo campo flexible).
 *   Fallback a progressionModel === 'time_progression' para retrocompatibilidad.
 */

import { View, Text, TouchableOpacity, StyleSheet, Animated, Easing } from 'react-native';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import SetRow from './SetRow';
import { useWeightUnit } from '../../hooks/useWeightUnit';
import { getProgression } from '../../../../src/utils/progression';
import { colors, spacing, typography, radius, borders, withOpacity } from '../../theme';

// ── Progression chip colors ────────────────────────────────────────────────────

const CHIP_COLORS = {
  up:   { bg: withOpacity(colors.green,  0.1), border: withOpacity(colors.green,  0.3), text: colors.green  },
  down: { bg: 'rgba(248,113,113,0.1)',         border: 'rgba(248,113,113,0.3)',         text: colors.red    },
  hold: { bg: withOpacity(colors.accent, 0.08), border: withOpacity(colors.accent, 0.3), text: colors.accent },
  info: { bg: colors.surface2,                  border: colors.border,                   text: colors.muted  },
};

// ── buildTarget ───────────────────────────────────────────────────────────────

function buildTarget(def, exConfig, t) {
  if (!def) return '';
  const inputType  = exConfig.inputType ?? (def.progressionModel === 'time_progression' ? 'time' : 'weight_reps');
  const model      = def.progressionModel;
  const sets       = exConfig.sets ?? 0;
  const minReps    = exConfig.minReps ?? def.minReps;
  const maxReps    = exConfig.maxReps ?? def.maxReps;
  const minTime    = exConfig.minTime ?? def.minTime;
  const maxTime    = exConfig.maxTime ?? def.maxTime;
  const unilateral = (exConfig.isUnilateral ?? def.isUnilateral)
    ? ` ${t('workout.perSide', 'por lado')}`
    : '';

  if (model === 'submax') return `${sets} × ${t('workout.submax', 'submáx')}`;

  if (inputType === 'reps') {
    const r = minReps === maxReps ? `${minReps}` : `${minReps}–${maxReps}`;
    return `${sets} × ${r} reps${unilateral}`;
  }
  if (inputType === 'time' || inputType === 'weight_time') {
    return `${sets} × ${minTime}–${maxTime} s${unilateral}`;
  }
  // weight_reps (default)
  const r = minReps === maxReps ? `${minReps}` : `${minReps}–${maxReps}`;
  return `${sets} × ${r} reps${unilateral}`;
}

// ── buildSetLabel (collapsed pills) ──────────────────────────────────────────

function buildSetLabel(set, index, fmt) {
  if (set.time && set.weight) return `${fmt(set.weight)}×${set.time}s`;
  if (set.time)               return `${set.time}s`;
  if (set.weight && set.reps) return `${fmt(set.weight)}×${set.reps}`;
  if (set.reps)               return `${set.reps} reps`;
  if (set.weight)             return fmt(set.weight);
  return `S${index + 1}`;
}

// ── SetPill ───────────────────────────────────────────────────────────────────

function SetPill({ set, index, fmt }) {
  return (
    <View style={styles.setPill}>
      <Text style={styles.setPillText}>{buildSetLabel(set, index, fmt)}</Text>
    </View>
  );
}

// ── ExerciseCard ──────────────────────────────────────────────────────────────

export default function ExerciseCard({
  exConfig,
  def,
  setsState,
  lastExercise,
  onFieldChange,
  onToggleDone,
  onAddSet,
}) {
  const { t, i18n } = useTranslation();
  const { label: weightLabel, toDisplay, toKg, fmt, scrollStep: weightScrollStep } = useWeightUnit();

  // Derive inputType — new field with fallback for existing exercises
  const inputType = exConfig.inputType
    ?? (def?.progressionModel === 'time_progression' ? 'time' : 'weight_reps');

  const hasTimer = inputType === 'time' || inputType === 'weight_time';

  const name = def
    ? (i18n.language === 'en' ? (def.nameEn ?? def.name) : def.name)
    : exConfig.exerciseId;

  const [hintSetIndex, setHintSetIndex] = useState(0);

  const allDone              = setsState.length > 0 && setsState.every((s) => s.done);
  const [collapsed,  setCollapsed]  = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const isCollapsed          = collapsed && !manualOpen;

  // ── Animated.Value height + opacity (React Native built-in, Expo Go safe) ──
  const maxH        = useRef(new Animated.Value(2000)).current;
  const contentOpacity = useRef(new Animated.Value(1)).current;
  const expandedH   = useRef(0);
  const collapsedH  = useRef(80);
  const isCollapsedRef = useRef(false);
  isCollapsedRef.current = isCollapsed;

  // Solo guarda el máximo histórico → no se sobreescribe con valores más pequeños
  // durante la animación de colapso (onLayout dispara muchas veces mientras baja maxH)
  const onCardLayout = useCallback((e) => {
    const h = e.nativeEvent.layout.height;
    if (isCollapsedRef.current) {
      collapsedH.current = h;
      // First collapse may have animated to the 80px default before the collapsed
      // view was rendered and measured. Snap to the real height immediately.
      if (Math.abs(maxH._value - h) > 2) maxH.setValue(h);
    } else if (h > expandedH.current) {
      expandedH.current = h;
      if (maxH._value >= 1999) maxH.setValue(h);
    }
  }, [maxH]);

  const HEIGHT_CFG  = { duration: 220, easing: Easing.inOut(Easing.ease), useNativeDriver: false };
  const OPACITY_CFG = { duration: 180, easing: Easing.inOut(Easing.ease), useNativeDriver: true  };

  // Collapse: fade out + aplasta altura, cambia contenido al terminar (opacity sigue en 0)
  const startCollapse = useCallback((onDone) => {
    const from = expandedH.current  > 0 ? expandedH.current  : 400;
    const to   = collapsedH.current > 0 ? collapsedH.current : 80;
    maxH.setValue(from);
    contentOpacity.setValue(1);
    Animated.timing(maxH,           { ...HEIGHT_CFG,  toValue: to }).start(({ finished }) => {
      if (finished) onDone(); // opacity sigue en 0 → useEffect se encarga del fade in
    });
    Animated.timing(contentOpacity, { ...OPACITY_CFG, toValue: 0 }).start();
  }, []);

  // Fade in del contenido colapsado justo después de que React lo renderice
  const prevIsCollapsedRef = useRef(isCollapsed);
  useEffect(() => {
    if (isCollapsed && !prevIsCollapsedRef.current) {
      Animated.timing(contentOpacity, {
        toValue: 1, duration: 150, easing: Easing.out(Easing.ease), useNativeDriver: true,
      }).start();
    }
    prevIsCollapsedRef.current = isCollapsed;
  }, [isCollapsed]);

  // Expand: cambia contenido primero, fade in + sube altura
  const startExpand = useCallback(() => {
    const from = collapsedH.current > 0 ? collapsedH.current : 80;
    const to   = expandedH.current  > 0 ? expandedH.current  : 600;
    maxH.setValue(from);
    contentOpacity.setValue(0);
    Animated.timing(maxH,           { ...HEIGHT_CFG,  toValue: to }).start();
    Animated.timing(contentOpacity, { ...OPACITY_CFG, toValue: 1 }).start();
  }, []);

  // Colapsar cuando todas las series están hechas
  useEffect(() => {
    if (allDone && !collapsed) {
      startCollapse(() => setCollapsed(true));
    }
  }, [allDone]);

  // Descolapsar cuando alguna serie se deshace
  useEffect(() => {
    if (!allDone && collapsed) {
      setCollapsed(false);
      setManualOpen(false);
      startExpand();
    }
  }, [allDone]);

  const handleOpen = useCallback(() => {
    setManualOpen(true);
    startExpand();
  }, [startExpand]);

  const handleCollapse = useCallback(() => {
    startCollapse(() => setManualOpen(false));
  }, [startCollapse]);

  const progression = (() => {
    if (!lastExercise?.sets?.length) return null;
    try { return getProgression(def, lastExercise.sets, exConfig.sets, t); }
    catch { return null; }
  })();
  const chipStyle  = progression ? (CHIP_COLORS[progression.type] ?? CHIP_COLORS.info) : null;
  const targetLabel = buildTarget(def, exConfig, t);

  // ── Animated.View root — Reanimated maxHeight drives the height animation ──
  return (
    <Animated.View style={[styles.card, { maxHeight: maxH }]} onLayout={onCardLayout}>
      <Animated.View style={{ opacity: contentOpacity }}>

      {isCollapsed ? (

        /* ── Collapsed view ── */
        <TouchableOpacity onPress={handleOpen} activeOpacity={0.75}>
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
              handleOpen();
              onAddSet();
            }}
            hitSlop={8}
          >
            <Text style={styles.addSetSmallText}>+</Text>
          </TouchableOpacity>
        </View>
        </TouchableOpacity>

      ) : (

        /* ── Expanded view ── */
        <>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>

              {/* Name row — badge inline to the right */}
              <View style={styles.nameRow}>
                <Text style={styles.name} numberOfLines={2}>{name}</Text>
                {exConfig.isKey && <Text style={styles.keyBadge}>CLAVE</Text>}
              </View>

              {/* Target + tempo inline: "3 × 8–12 reps · 3010" */}
              {(targetLabel || exConfig.tempo) ? (
                <Text style={styles.target}>
                  {targetLabel}
                  {targetLabel && exConfig.tempo
                    ? <Text style={styles.tempoInline}>{` · ${exConfig.tempo}`}</Text>
                    : exConfig.tempo
                      ? <Text style={styles.tempoInline}>{exConfig.tempo}</Text>
                      : null}
                </Text>
              ) : null}

            </View>

            {manualOpen && (
              <TouchableOpacity onPress={handleCollapse} hitSlop={8}>
                <Text style={styles.collapseBtn}>{t('workout.collapse', 'Colapsar')}</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Progression chip */}
          {progression?.msg ? (
            <View style={[styles.chip, { backgroundColor: chipStyle.bg, borderColor: chipStyle.border }]}>
              <Text style={[styles.chipText, { color: chipStyle.text }]}>
                {progression.icon}  {progression.msg}
              </Text>
            </View>
          ) : null}

          {/* Column headers */}
          <View style={styles.colHeader}>
            <View style={{ width: 28 }} />
            {inputType === 'reps' ? (
              <Text style={[styles.colLabel, { flex: 1, textAlign: 'center' }]}>REPS</Text>
            ) : inputType === 'time' ? (
              <Text style={[styles.colLabel, { flex: 1, textAlign: 'center' }]}>SEG</Text>
            ) : inputType === 'weight_time' ? (
              <>
                <Text style={[styles.colLabel, { flex: 1, textAlign: 'center' }]}>{weightLabel.toUpperCase()}</Text>
                <Text style={[styles.colLabel, { flex: 1, textAlign: 'center' }]}>SEG</Text>
              </>
            ) : (
              // weight_reps (default)
              <>
                <Text style={[styles.colLabel, { flex: 1, textAlign: 'center' }]}>{weightLabel.toUpperCase()}</Text>
                <Text style={[styles.colLabel, { flex: 1, textAlign: 'center' }]}>REPS</Text>
              </>
            )}
            {/* Timer btn spacer */}
            {hasTimer && <View style={{ width: 36 }} />}
            {/* Done btn spacer */}
            <View style={{ width: 36 }} />
          </View>

          {/* Sets */}
          <View style={styles.setList}>
            {setsState.map((set, i) => {
              const lastSet = lastExercise?.sets?.[i];
              const prevWeightDisplay = lastSet?.weight != null && lastSet?.weight !== ''
                ? String(toDisplay(lastSet.weight)) : '';
              const prevReps = lastSet?.reps != null && lastSet?.reps !== ''
                ? String(lastSet.reps) : '';
              const prevTime = lastSet?.time != null && lastSet?.time !== ''
                ? String(lastSet.time) : '';

              return (
                <SetRow
                  key={i}
                  index={i}
                  set={set}
                  inputType={inputType}
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
                    if (!set.done && lastSet) {
                      const needsWeight = inputType === 'weight_reps' || inputType === 'weight_time';
                      const needsReps   = inputType === 'weight_reps' || inputType === 'reps';
                      const needsTime   = inputType === 'time'        || inputType === 'weight_time';

                      if (needsWeight && (set.weight === '' || set.weight == null)
                          && lastSet.weight != null && lastSet.weight !== '') {
                        onFieldChange(i, 'weight', String(lastSet.weight));
                      }
                      if (needsReps && (set.reps === '' || set.reps == null)
                          && lastSet.reps != null && lastSet.reps !== '') {
                        onFieldChange(i, 'reps', String(lastSet.reps));
                      }
                      if (needsTime && (set.time === '' || set.time == null)
                          && lastSet.time != null && lastSet.time !== '') {
                        onFieldChange(i, 'time', String(lastSet.time));
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
        </>

      )}

      </Animated.View>
    </Animated.View>
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

  nameRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.xs,
    flexWrap:      'wrap',
  },
  name: {
    fontSize:   typography.md,
    fontWeight: typography.semibold,
    color:      colors.text,
    flexShrink: 1,
  },
  keyBadge: {
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
  target: {
    fontSize: typography.xs,
    color:    colors.muted,
  },
  tempoInline: {
    fontSize:      typography.xs,
    color:         colors.muted2,
    letterSpacing: 2,
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

  // Add set
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
    flexDirection: 'row',
    alignItems:    'center',
    padding:       spacing.md,
    gap:           spacing.sm,
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
