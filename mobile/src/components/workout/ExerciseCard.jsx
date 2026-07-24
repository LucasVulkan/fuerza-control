/**
 * ExerciseCard — port fiel del original web.
 *
 * inputType: 'weight_reps' | 'reps' | 'time' | 'weight_time'
 *   Se lee de exConfig.inputType (nuevo campo flexible).
 *   Fallback a progressionModel === 'time_progression' para retrocompatibilidad.
 */

import { View, Text, TouchableOpacity, StyleSheet, Animated, Easing } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import SetRow from './SetRow';
import NotesModal from './NotesModal';
import { useStore } from '../../../store/useStore';
import { useWeightUnit } from '../../hooks/useWeightUnit';
import { getProgression } from '../../../../src/utils/progression';
import { warmupSteps, computeWarmupWeights, resolveWorkWeight } from '../../../../src/utils/warmup';
import { resolveExerciseReference, resolveRef } from '../../../../src/utils/sessionOverride';
import { spacing, typography, textStyles, borders, withOpacity } from '../../theme';
import { useTheme, useThemedStyles } from '../../useTheme';

// ── Progression chip colors — Chips (Figma 110:4247): Default=lima, Variant2=roja ──
// No hay variante propia para "hold" (mantener) en Figma; reutiliza la lima ("up").

const chipColors = (th) => ({
  up:   { bg: th.tint.accent10,   border: th.colors.accent, text: th.tint.accent50 },
  down: { bg: th.tint.red30,      border: th.colors.red,    text: th.tint.red50    },
  hold: { bg: th.tint.accent10,   border: th.colors.accent, text: th.tint.accent50 },
  info: { bg: th.colors.surface2, border: th.colors.border, text: th.colors.muted  },
});

// ── NoteIcon — nota con líneas (estilo Tabler "notes"), estados vacío/relleno ──
// Sustituye al redibujo literal de Figma (rect + barras) por un icono de trazo
// limpio: hoja redondeada + 3 renglones. Relleno = hoja accent + renglones onAccent.

function NoteIcon({ size = 26, filled, th }) {
  const stroke = filled ? th.colors.accent   : th.tint.accent50;
  const lines  = filled ? th.colors.onAccent : th.tint.accent50;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6 3h12a1 1 0 0 1 1 1v16a1 1 0 0 1 -1 1h-12a1 1 0 0 1 -1 -1v-16a1 1 0 0 1 1 -1z"
        fill={filled ? th.colors.accent : 'none'}
        stroke={stroke}
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
      <Path
        d="M8.5 8h7 M8.5 12h7 M8.5 16h4.5"
        stroke={lines}
        strokeWidth={1.6}
        strokeLinecap="round"
      />
    </Svg>
  );
}

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
  const styles = useThemedStyles(makeStyles);
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
  onAddDrop,
  onDropFieldChange,
  onToggleDropDone,
  onRemoveDrop,
  groupLabel,
  trainerName,
  clientNote,
  onClientNoteChange,
  overrideEx,
  activeSetIndex = -1,
  hideAddSetBtn = false,   // superset: un único botón compartido debajo del grupo (WorkoutScreen)
}) {
  const { t, i18n } = useTranslation();
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { label: weightLabel, toDisplay, toKg, fmt, scrollStep: weightScrollStep } = useWeightUnit();

  // Trainer note (instructions written in the program editor)
  const trainerNote = exConfig.trainerNote?.trim() || null;
  // Coach next-session prescription (one-off): blue target ghosts + chip + note.
  const hasCoachTarget = !!(overrideEx && (overrideEx.weight != null || overrideEx.reps != null
                            || overrideEx.time != null || overrideEx.rpe != null));
  const coachNote = overrideEx?.note?.trim() || null;
  // RPE column (opt-in per exercise from the program editor)
  const trackRpe = !!exConfig.trackRpe;
  const [noteExpanded, setNoteExpanded] = useState(false);
  // Client feedback note input visibility
  const [noteInputOpen, setNoteInputOpen] = useState(false);
  const hasClientNote = !!clientNote?.trim();

  // Derive inputType — new field with fallback for existing exercises
  const inputType = exConfig.inputType
    ?? (def?.progressionModel === 'time_progression' ? 'time' : 'weight_reps');

  const hasTimer = inputType === 'time' || inputType === 'weight_time';

  // ── Warmup pills (spec warmup-sets.md §7) ─────────────────────────────────
  // Informational only — NOT part of setsState, nothing is persisted. Purely
  // recalculated on every render from the current work weight; a tap only
  // flips local "tapped" styling and optionally fires the rest timer.
  const startRestTimer = useStore((s) => s.startRestTimer);
  const warmupStepsArr = exConfig.warmup ? warmupSteps(exConfig.warmup) : [];
  const hasWarmup = warmupStepsArr.length > 0;
  const [warmupTapped, setWarmupTapped] = useState(() => new Set());

  const firstWorkWeight = setsState[0]?.weight;
  const typedFirstWorkWeight = firstWorkWeight !== '' && firstWorkWeight != null
    ? parseFloat(firstWorkWeight) : undefined;
  const workWeightKg = hasWarmup
    ? resolveWorkWeight(overrideEx, lastExercise, typedFirstWorkWeight)
    : null;
  const warmupComputed = computeWarmupWeights(warmupStepsArr, workWeightKg);
  const warmupNoReference = hasWarmup && workWeightKg == null;
  const warmupRestSec = exConfig.warmup?.restSec ?? 60;

  function toggleWarmupPill(i) {
    setWarmupTapped((prev) => {
      const next = new Set(prev);
      if (next.has(i)) {
        next.delete(i);
      } else {
        next.add(i);
        if (warmupRestSec > 0) startRestTimer(warmupRestSec, def?.name ?? exConfig.exerciseId);
      }
      return next;
    });
  }

  const name = def
    ? (i18n.language === 'en' ? (def.nameEn ?? def.name) : def.name)
    : exConfig.exerciseId;

  // Dropset: checking the last work set is NOT the end of the exercise — the
  // drops come next. Hold the auto-collapse until at least one drop exists and
  // every drop is checked (adding a new undone drop re-opens the card).
  const workDone  = setsState.length > 0 && setsState.every((s) => s.done);
  const lastDrops = exConfig.dropset ? (setsState[setsState.length - 1]?.drops ?? []) : [];
  const dropsDone = !exConfig.dropset || (lastDrops.length > 0 && lastDrops.every((d) => d.done));
  const allDone   = workDone && dropsDone;
  const [collapsed,  setCollapsed]  = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const isCollapsed          = collapsed && !manualOpen;

  // ── Animated.Value height + opacity (React Native built-in, Expo Go safe) ──
  //
  // KEY DESIGN: maxH is UNCONSTRAINED (3000) whenever the card is fully expanded.
  // This lets the card grow naturally when sets are added without ever clipping.
  // Only during collapse/expand ANIMATIONS does maxH take a specific value.
  //
  //   Idle-expanded : maxH = 3000  (content drives height, no clip)
  //   Collapsing    : maxH animates  expandedH → collapsedH
  //   Idle-collapsed: maxH = collapsedH (snapped to real measured value)
  //   Expanding     : maxH animates  collapsedH → expandedH, then reset to 3000
  //
  const UNCONSTRAINED = 3000;
  const maxH        = useRef(new Animated.Value(UNCONSTRAINED)).current;
  const contentOpacity = useRef(new Animated.Value(1)).current;
  const expandedH   = useRef(0);
  const collapsedH  = useRef(80);
  const isCollapsedRef = useRef(false);
  isCollapsedRef.current = isCollapsed;

  const onCardLayout = useCallback((e) => {
    const h = e.nativeEvent.layout.height;
    if (isCollapsedRef.current) {
      // collapsedH.current is kept up-to-date by the hidden absolutely-positioned
      // measurement view, so it always reflects the real natural height of the
      // collapsed content (unaffected by maxH clamping).
      // Just snap maxH if it drifted from the target (e.g. right after an animation).
      const target = collapsedH.current;
      if (target > 0 && Math.abs(maxH._value - target) > 2) maxH.setValue(target);
    } else {
      // Expanded: track the natural content height for the next collapse.
      // DO NOT constrain maxH — keeping it at UNCONSTRAINED lets the card grow
      // freely whenever sets are added.
      if (h > expandedH.current) expandedH.current = h;
    }
  }, [maxH]);

  const HEIGHT_CFG  = { duration: 220, easing: Easing.inOut(Easing.ease), useNativeDriver: false };
  // useNativeDriver: false so that setValue(0) takes effect synchronously on the
  // JS side — prevents the 1-frame native-thread lag that caused the flicker where
  // collapsed content briefly reappeared during the expand animation.
  const OPACITY_CFG = { duration: 180, easing: Easing.inOut(Easing.ease), useNativeDriver: false };

  // Collapse: fade out + aplasta altura, cambia contenido al terminar (opacity sigue en 0)
  const startCollapse = useCallback((onDone) => {
    // maxH may be UNCONSTRAINED (3000) — snap to actual content height first
    // so the animation starts from the real size with no visual jump.
    // collapsedH.current is always accurate thanks to the hidden measurement view.
    const from = expandedH.current  > 0 ? expandedH.current  : 400;
    const to   = collapsedH.current > 40 ? collapsedH.current : 80;
    maxH.setValue(from);
    contentOpacity.setValue(1);
    Animated.timing(maxH,           { ...HEIGHT_CFG,  toValue: to }).start(({ finished }) => {
      if (finished) onDone(); // opacity sigue en 0 → useEffect se encarga del fade in
    });
    Animated.timing(contentOpacity, { ...OPACITY_CFG, toValue: 0 }).start();
  }, []);

  // Fade in del contenido activo después de cada cambio de estado colapsado/expandido.
  //
  // Doing the fade-in here (post-commit) instead of inside startExpand/startCollapse
  // guarantees that React has already swapped the rendered content before the animation
  // begins. Starting the fade-in inside startExpand caused the flicker: native-driver
  // opacity was animating upward while collapsed content was still in the tree.
  //
  // When switching TO collapsed we also call maxH.setValue(UNCONSTRAINED) first.
  // Why: on navigation return the component remounts with collapsedH.current=80 (ref
  // reset). The allDone useEffect fires synchronously (before native onLayout arrives)
  // and runs startCollapse with to=80. By the time the animation finishes, the
  // measurement view has usually updated collapsedH.current to the real height, but
  // onCardLayout may not re-fire because the card height didn't change (still 80).
  // Setting UNCONSTRAINED here forces a layout pass → onCardLayout fires → reads the
  // now-correct collapsedH.current → snaps maxH to the real collapsed height.
  // Content is invisible (opacity=0) throughout so the brief height change is harmless.
  const prevIsCollapsedRef = useRef(isCollapsed);
  useEffect(() => {
    const wasCollapsed = prevIsCollapsedRef.current;
    prevIsCollapsedRef.current = isCollapsed;
    if (isCollapsed === wasCollapsed) return; // no change

    if (isCollapsed) {
      // Release maxH so onCardLayout fires and can snap to the real measured height.
      maxH.setValue(UNCONSTRAINED);
    }

    // Content has just switched — fade it in from 0 (set by startCollapse/startExpand)
    Animated.timing(contentOpacity, {
      toValue: 1, duration: 150, easing: Easing.out(Easing.ease), useNativeDriver: false,
    }).start();
  }, [isCollapsed]);

  // Expand: resetea opacidad a 0 y anima la altura. El fade-in de opacidad lo
  // dispara el useEffect una vez que React ha confirmado el cambio de estado,
  // evitando que el contenido colapsado reaparezca durante la animación.
  const startExpand = useCallback(() => {
    const from = collapsedH.current > 0 ? collapsedH.current : 80;
    const to   = expandedH.current  > 0 ? expandedH.current  : 600;
    maxH.setValue(from);
    contentOpacity.setValue(0); // contenido invisible; useEffect dispara el fade-in
    Animated.timing(maxH, { ...HEIGHT_CFG, toValue: to }).start(({ finished }) => {
      // Release the constraint so the card can grow freely if sets are added.
      if (finished) maxH.setValue(UNCONSTRAINED);
    });
    // No opacity animation here — handled by useEffect after isCollapsed flips
  }, []);

  // Colapsar cuando todas las series están hechas
  useEffect(() => {
    if (allDone && !collapsed) {
      startCollapse(() => setCollapsed(true));
    }
  }, [allDone]);

  // Descolapsar cuando alguna serie se deshace.
  // Guard against isCollapsed (not just collapsed) so that when the user presses
  // "+" on a collapsed card — which sets manualOpen=true and adds an undone set
  // in the same event batch — this effect sees isCollapsed=false and skips the
  // second startExpand() that would reset contentOpacity to 0 and blank the card.
  useEffect(() => {
    if (!allDone && isCollapsed) {
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

  function handleCopyFromPrev(setIdx) {
    const prev = setsState[setIdx - 1];
    if (!prev) return;
    if (prev.weight != null && prev.weight !== '')
      onFieldChange(setIdx, 'weight', String(prev.weight));
    if (prev.reps != null && prev.reps !== '')
      onFieldChange(setIdx, 'reps', String(prev.reps));
    if (prev.time != null && prev.time !== '')
      onFieldChange(setIdx, 'time', String(prev.time));
  }

  const progression = (() => {
    if (!lastExercise?.sets?.length) return null;
    try { return getProgression(exConfig, def, lastExercise.sets, t); }
    catch { return null; }
  })();
  const CHIP = chipColors(th);
  const chipStyle  = progression ? (CHIP[progression.type] ?? CHIP.info) : null;
  const targetLabel = buildTarget(def, exConfig, t)
    + (hasWarmup ? t('workout.warmup.metaSuffix', { count: warmupStepsArr.length }) : '');

  // ── Animated.View root — Reanimated maxHeight drives the height animation ──
  return (
    <Animated.View style={[styles.card, hideAddSetBtn && styles.cardSupersetMember, { maxHeight: maxH }]} onLayout={onCardLayout}>

      {/*
        Hidden off-flow measurement view.
        position:'absolute' removes it from yoga's flex flow so the parent's
        maxHeight does NOT constrain its layout. left/right:0 gives it the
        card's width (same pill-wrap behaviour). top:0 + no bottom = height
        is natural content height. onLayout always reflects the true collapsed
        height, keeping collapsedH.current accurate before any animation starts.
      */}
      <View
        pointerEvents="none"
        style={styles.collapsedMeasurer}
        onLayout={(e) => {
          const h = e.nativeEvent.layout.height;
          collapsedH.current = h;
          // Safety snap: if the card is already collapsed and maxH is wrong
          // (e.g. this onLayout fired after onCardLayout used a stale default),
          // correct it now. This covers the navigation-return case where the
          // collapse animation ends before the first native onLayout arrives.
          if (isCollapsedRef.current && h > 0 && Math.abs(maxH._value - h) > 2) {
            maxH.setValue(h);
          }
        }}
      >
        <View style={styles.collapsedRow}>
          <View style={styles.collapsedLeft}>
            <View style={styles.doneIcon}>
              <Text style={styles.doneIconText}>✓</Text>
            </View>
            <View style={{ flex: 1, gap: spacing.xs }}>
              <View style={styles.collapsedNameRow}>
                <Text style={styles.name}>{name}</Text>
                {groupLabel && <Text style={styles.groupBadge}>{groupLabel}</Text>}
              </View>
              <View style={styles.pillsRow}>
                {setsState.map((set, i) => (
                  <SetPill key={i} set={set} index={i} fmt={fmt} />
                ))}
              </View>
            </View>
          </View>
          {/* Spacer matching the small add-set button so width/wrap is identical */}
          <View style={styles.addSetBtnSmall} />
        </View>
      </View>

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
              <View style={styles.collapsedNameRow}>
                <Text style={styles.name}>{name}</Text>
                {groupLabel && <Text style={styles.groupBadge}>{groupLabel}</Text>}
              </View>
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
          {/* Header — miembro de superset: menos aire encima del nombre */}
          <View style={[styles.header, hideAddSetBtn && styles.headerCompact]}>
            <View style={styles.headerLeft}>

              {/* Name row — superset prefix (A1/A2) inline, misma tipografía en accent */}
              <View style={styles.nameRow}>
                <Text style={styles.name} numberOfLines={2}>
                  {groupLabel ? <Text style={styles.groupPrefix}>{groupLabel} </Text> : null}
                  {name}
                </Text>
                {exConfig.isKey && <Text style={styles.keyBadge}>{t('workout.keyBadge')}</Text>}
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

            <View style={styles.headerRight}>
              {onClientNoteChange && (
                <TouchableOpacity onPress={() => setNoteInputOpen((v) => !v)} hitSlop={8}>
                  <NoteIcon th={th} filled={hasClientNote || noteInputOpen} />
                </TouchableOpacity>
              )}
              {manualOpen && (
                <TouchableOpacity onPress={handleCollapse} hitSlop={8}>
                  <Text style={styles.collapseBtn}>{t('workout.collapse', 'Colapsar')}</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Progression chip — hidden when the trainer set an explicit target */}
          {!hasCoachTarget && progression?.msg ? (
            <View style={[styles.chip, { backgroundColor: chipStyle.bg, borderLeftColor: chipStyle.border }]}>
              <Text style={[styles.chipText, { color: chipStyle.text }]}>
                {progression.icon}  {progression.msg}
              </Text>
            </View>
          ) : null}

          {/* Coach target chip (next-session prescription) — Chips Variant3 (azul) */}
          {hasCoachTarget ? (
            <View style={[styles.chip, styles.coachChip]}>
              <Text style={[styles.chipText, { color: th.tint.blue70 }]}>◎  {t('workout.coachTarget')}</Text>
            </View>
          ) : null}

          {/* Trainer note — 1-line clamp, tap to expand */}
          {trainerNote ? (
            <TouchableOpacity
              style={styles.trainerNote}
              onPress={() => setNoteExpanded((v) => !v)}
              activeOpacity={0.7}
            >
              <Text style={styles.trainerNoteText} numberOfLines={noteExpanded ? undefined : 1}>
                📋 {trainerName ? <Text style={styles.trainerNoteName}>{trainerName}: </Text> : null}
                {trainerNote}
              </Text>
            </TouchableOpacity>
          ) : null}

          {/* Coach one-off note (this session) — additive with the program note */}
          {coachNote ? (
            <View style={styles.coachNote}>
              <Text style={styles.coachNoteText}>
                {trainerName ? <Text style={styles.coachNoteName}>{trainerName}: </Text> : null}
                {coachNote}
                <Text style={styles.coachNoteTag}>{`  · ${t('workout.thisSession')}`}</Text>
              </Text>
            </View>
          ) : null}

          {/* Divisor — separa la zona de identidad (nombre + propuesta + chips/notas)
              de la zona de registro (calentamiento + series de trabajo). */}
          <View style={styles.sectionDivider} />

          {/* Warmup — informational, not logged (spec §7). Sin fondo propio; cada
              paso (C1, C2…) es un chip que abraza su contenido. Va SIEMPRE encima
              de la etiqueta de trabajo y del grid. */}
          {hasWarmup ? (
            <View style={styles.warmupSection}>
              <View style={styles.warmupHeader}>
                <Text style={styles.warmupLabel}>{t('workout.warmup.blockLabel').toUpperCase()}</Text>
                <Text style={styles.warmupMeta}>
                  {warmupRestSec > 0
                    ? t('workout.warmup.restLabel', { sec: warmupRestSec })
                    : t('workout.warmup.noTimer')}
                </Text>
              </View>
              {warmupNoReference ? (
                <Text style={styles.warmupBanner}>{t('workout.warmup.noReference')}</Text>
              ) : null}
              <View style={styles.warmupRows}>
                {warmupComputed.map((step, wi) => {
                  const tapped = warmupTapped.has(wi);
                  const hasWeight = step.weightKg != null;
                  // toDisplay() ya convierte a la unidad activa — NO usar fmt() aquí,
                  // que además añade el sufijo de unidad (duplicaría "Kg", ya pintado
                  // aparte en warmupPillUnit).
                  const numStr = hasWeight ? String(toDisplay(step.weightKg)) : `${warmupStepsArr[wi].pct}%`;
                  return (
                    <TouchableOpacity
                      key={wi}
                      style={styles.warmupRow}
                      onPress={() => toggleWarmupPill(wi)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.warmupRowLabel}>{`C${wi + 1}`}</Text>
                      <View style={[styles.warmupChip, tapped && styles.warmupChipTapped]}>
                        <Text style={styles.warmupPillText}>
                          <Text style={styles.warmupPillNum}>{numStr}</Text>
                          {hasWeight ? <Text style={styles.warmupPillUnit}>{weightLabel}</Text> : null}
                          <Text style={styles.warmupPillTimes}>{' × '}</Text>
                          <Text style={styles.warmupPillReps}>{step.reps}</Text>
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ) : null}

          {/* Column headers */}
          <View style={styles.colHeader}>
            <View style={{ width: 20 }} />
            {inputType === 'reps' ? (
              <Text style={[styles.colLabel, { flex: 1, textAlign: 'center' }]}>{t('workout.reps').toUpperCase()}</Text>
            ) : inputType === 'time' ? (
              <Text style={[styles.colLabel, { flex: 1, textAlign: 'center' }]}>{t('workout.timeSec').toUpperCase()}</Text>
            ) : inputType === 'weight_time' ? (
              <>
                <Text style={[styles.colLabel, { flex: 1, textAlign: 'center' }]}>{weightLabel.toUpperCase()}</Text>
                <Text style={[styles.colLabel, { flex: 1, textAlign: 'center' }]}>{t('workout.timeSec').toUpperCase()}</Text>
              </>
            ) : (
              // weight_reps (default)
              <>
                <Text style={[styles.colLabel, { flex: 1, textAlign: 'center' }]}>{weightLabel.toUpperCase()}</Text>
                <Text style={[styles.colLabel, { flex: 1, textAlign: 'center' }]}>{t('workout.reps').toUpperCase()}</Text>
              </>
            )}
            {/* Timer btn spacer — igualado a timerBtn/doneBtn (32×32) */}
            {hasTimer && <View style={{ width: 32 }} />}
            {/* RPE column */}
            {trackRpe && (
              <Text style={[styles.colLabel, { flex: 1, textAlign: 'center' }]}>RPE</Text>
            )}
            {/* Done btn spacer */}
            <View style={{ width: 32 }} />
          </View>

          {/* Sets */}
          <View style={styles.setList}>
            {setsState.map((set, realIndex) => {
              const wi = realIndex;
              const lastSet = lastExercise?.sets?.[wi];
              const prevWeightDisplay = lastSet?.weight != null && lastSet?.weight !== ''
                ? String(toDisplay(lastSet.weight)) : '';
              const prevReps = lastSet?.reps != null && lastSet?.reps !== ''
                ? String(lastSet.reps) : '';
              const prevTime = lastSet?.time != null && lastSet?.time !== ''
                ? String(lastSet.time) : '';

              // Trainer target (if any) wins over the last-session reference and
              // renders blue; otherwise the grey last-session ghost stays.
              const coachWeightDisp = overrideEx?.weight != null && overrideEx?.weight !== ''
                ? String(toDisplay(overrideEx.weight)) : undefined;
              const ref = resolveExerciseReference(
                { weight: coachWeightDisp, reps: overrideEx?.reps },
                prevWeightDisplay,
                prevReps,
              );
              const timeRef = resolveRef(
                overrideEx?.time != null && overrideEx?.time !== '' ? overrideEx.time : undefined,
                prevTime,
              );
              const rpeRef  = resolveRef(
                overrideEx?.rpe != null && overrideEx?.rpe !== '' ? overrideEx.rpe : undefined,
                '', // no last-session RPE ghost
              );

              return (
                <SetRow
                  key={realIndex}
                  index={realIndex}
                  set={set}
                  inputType={inputType}
                  isActive={realIndex === activeSetIndex}
                  showRpe={trackRpe}
                  onRpeChange={(v) => {
                    if (v === '') { onFieldChange(realIndex, 'rpe', ''); return; }
                    const cleaned = String(v).replace(',', '.');
                    const n = parseFloat(cleaned);
                    if (isNaN(n)) return;
                    onFieldChange(realIndex, 'rpe', n > 10 ? '10' : n < 0 ? '0' : cleaned);
                  }}
                  onCopyPrev={wi > 0 ? () => handleCopyFromPrev(realIndex) : undefined}
                  weightDisplay={
                    set.weight !== '' && set.weight != null
                      ? String(toDisplay(set.weight))
                      : ''
                  }
                  prevWeightDisplay={ref.weight.value}
                  prevReps={ref.reps.value}
                  prevTime={timeRef.value}
                  prevWeightSource={ref.weight.source}
                  prevRepsSource={ref.reps.source}
                  prevTimeSource={timeRef.source}
                  prevRpe={rpeRef.value}
                  prevRpeSource={rpeRef.source}
                  weightScrollStep={weightScrollStep}
                  showHint={realIndex === activeSetIndex}
                  onWeightChange={(v) => {
                    onFieldChange(realIndex, 'weight', v !== '' ? String(toKg(parseFloat(v))) : '');
                  }}
                  onRepsChange={(v) => {
                    onFieldChange(realIndex, 'reps', v);
                  }}
                  onTimeChange={(v) => {
                    onFieldChange(realIndex, 'time', v);
                  }}
                  onToggleDone={() => {
                    if (!set.done) {
                      const needsWeight = inputType === 'weight_reps' || inputType === 'weight_time';
                      const needsReps   = inputType === 'weight_reps' || inputType === 'reps';
                      const needsTime   = inputType === 'time'        || inputType === 'weight_time';
                      // Coach target (kg) fills before the last-session value.
                      const fillWeight = overrideEx?.weight != null && overrideEx?.weight !== ''
                        ? overrideEx.weight : lastSet?.weight;
                      const fillReps   = overrideEx?.reps != null && overrideEx?.reps !== ''
                        ? overrideEx.reps : lastSet?.reps;
                      const fillTime   = overrideEx?.time != null && overrideEx?.time !== ''
                        ? overrideEx.time : lastSet?.time;

                      if (needsWeight && (set.weight === '' || set.weight == null)
                          && fillWeight != null && fillWeight !== '') {
                        onFieldChange(realIndex, 'weight', String(fillWeight));
                      }
                      if (needsReps && (set.reps === '' || set.reps == null)
                          && fillReps != null && fillReps !== '') {
                        onFieldChange(realIndex, 'reps', String(fillReps));
                      }
                      if (needsTime && (set.time === '' || set.time == null)
                          && fillTime != null && fillTime !== '') {
                        onFieldChange(realIndex, 'time', String(fillTime));
                      }
                    }
                    onToggleDone(realIndex);
                  }}
                />
              );
            })}
          </View>

          {/* Dropset — sub-series on the last work set, no rest, shown once it's done */}
          {exConfig.dropset && setsState.length > 0 && setsState[setsState.length - 1].done ? (
            <View style={styles.dropBlock}>
              <Text style={styles.dropBlockLabel}>{t('workout.dropsetLabel').toUpperCase()}</Text>
              {(setsState[setsState.length - 1].drops ?? []).map((drop, di) => {
                const prevDrop = lastExercise?.sets?.[setsState.length - 1]?.drops?.[di];
                const prevDropWeight = prevDrop?.weight != null && prevDrop.weight !== ''
                  ? String(toDisplay(prevDrop.weight)) : '';
                const prevDropReps = prevDrop?.reps != null && prevDrop.reps !== ''
                  ? String(prevDrop.reps) : '';
                return (
                  <View key={di} style={styles.dropRowWrap}>
                    <View style={{ flex: 1 }}>
                      <SetRow
                        index={di}
                        label={`D${di + 1}`}
                        set={drop}
                        inputType="weight_reps"
                        weightDisplay={drop.weight !== '' && drop.weight != null ? String(toDisplay(drop.weight)) : ''}
                        prevWeightDisplay={prevDropWeight}
                        prevReps={prevDropReps}
                        weightScrollStep={weightScrollStep}
                        onWeightChange={(v) =>
                          onDropFieldChange(di, 'weight', v !== '' ? String(toKg(parseFloat(v))) : '')
                        }
                        onRepsChange={(v) => onDropFieldChange(di, 'reps', v)}
                        onToggleDone={() => onToggleDropDone(di)}
                      />
                    </View>
                    <TouchableOpacity style={styles.dropRemoveBtn} onPress={() => onRemoveDrop(di)} hitSlop={8}>
                      <Text style={styles.dropRemoveText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
              <TouchableOpacity style={styles.addDropBtn} onPress={onAddDrop} activeOpacity={0.7}>
                <Text style={styles.addDropText}>+ {t('workout.addDropBtn')}</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {/* Añadir serie — oculto en superset, el grupo comparte un único botón (SupersetBlock) */}
          {!hideAddSetBtn && (
            <TouchableOpacity style={styles.addSetBtn} onPress={onAddSet} activeOpacity={0.7}>
              <Text style={styles.addSetText}>+ {t('workout.addSetBtn')}</Text>
            </TouchableOpacity>
          )}

        </>

      )}

      </Animated.View>

      {/* Nota del ejercicio — mismo modal que las notas de sesión, título = nombre del ejercicio */}
      {onClientNoteChange && (
        <NotesModal
          visible={noteInputOpen}
          title={name}
          value={clientNote ?? ''}
          onChange={onClientNoteChange}
          onClose={() => setNoteInputOpen(false)}
          placeholder={t('workout.clientNotePlaceholder')}
          hint={t('workout.notesSavedWith')}
        />
      )}
    </Animated.View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const makeStyles = (th) => StyleSheet.create({
  card: {
    // Exercice Card Default (105:2490): bg surface, radius/lg, sin borde
    // (el borde acento solo aparece en el estado colapsado/completado, Parte 3).
    backgroundColor: th.colors.surface,
    borderRadius:    th.radius.lg,
    overflow:        'hidden',
    paddingBottom:   spacing.lg,
  },
  // Miembro de superset: sin botón "+ Añadir serie" ni notas al fondo, así que
  // el paddingBottom grande sobra y separaba demasiado los ejercicios del grupo.
  cardSupersetMember: {
    paddingBottom: spacing.xs2,
  },
  cardCollapsed: {
    paddingBottom: 0,
  },

  // Header
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: spacing.lg,
    paddingTop:        spacing.lg,
    paddingBottom:     spacing.sm,
    gap:               spacing.sm,
  },
  // Miembro de superset: el bloque ya aporta su propio aire por encima —
  // reduce el padding superior del header para no acumular ambos.
  headerCompact: {
    paddingTop: spacing.sm,
  },
  headerLeft: { flex: 1, gap: 3 },

  nameRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.xs,
    flexWrap:      'wrap',
  },
  name: {
    ...textStyles.exercice,
    color:      th.colors.text,
    flexShrink: 1,
  },
  keyBadge: {
    fontSize:          typography.xs,
    fontWeight:        typography.bold,
    color:             th.colors.accent,
    backgroundColor:   withOpacity(th.colors.accent, 0.1),
    borderRadius:      th.radius.sm,
    paddingHorizontal: spacing.xs,
    paddingVertical:   2,
    overflow:          'hidden',
    letterSpacing:     0.5,
  },
  collapsedNameRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.xs,
  },
  groupBadge: {
    fontSize:          typography.xs,
    fontWeight:        typography.bold,
    color:             th.colors.accent,
    backgroundColor:   withOpacity(th.colors.accent, 0.12),
    borderRadius:      th.radius.sm,
    paddingHorizontal: spacing.xs,
    paddingVertical:   2,
    overflow:          'hidden',
  },
  // Prefijo de superset (A1/A2…) inline delante del nombre — misma tipografía, accent.
  groupPrefix: {
    ...textStyles.exercice,
    color: th.colors.accent,
  },
  target: {
    ...textStyles.cardType,
    color:           th.colors.mutedLight,
    textTransform:   'uppercase',
  },
  tempoInline: {
    ...textStyles.cardType,
    color:         th.colors.muted,
    letterSpacing: 2,
  },
  collapseBtn: {
    fontSize:  typography.xs,
    color:     th.colors.muted,
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.sm,
  },

  // Trainer note strip
  trainerNote: {
    marginHorizontal:  spacing.md,
    marginBottom:      spacing.sm,
    backgroundColor:   withOpacity(th.colors.accent, 0.07),
    borderWidth:       borders.thin,
    borderColor:       withOpacity(th.colors.accent, 0.25),
    borderRadius:      th.radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical:   5,
  },
  trainerNoteText: {
    fontSize:   typography.xs,
    color:      th.colors.text,
    lineHeight: 17,
  },
  trainerNoteName: {
    fontWeight: typography.bold,
    color:      th.colors.accent,
  },

  // Progression chip — Chips (110:4247): borde izquierdo, fondo tint tenue, radius/xs
  chip: {
    marginHorizontal:  spacing.lg,
    marginBottom:      spacing.sm,
    borderLeftWidth:   borders.thin,
    borderRadius:      th.radius.xs,
    padding:           spacing.sm,
  },
  chipText: {
    ...textStyles.tag,
  },
  coachChip: {
    backgroundColor: th.tint.blue30,
    borderLeftColor: th.colors.blue,
  },

  // Coach one-off note strip
  coachNote: {
    marginHorizontal:  spacing.md,
    marginBottom:      spacing.sm,
    backgroundColor:   withOpacity(th.colors.blue, 0.07),
    borderWidth:       borders.thin,
    borderColor:       withOpacity(th.colors.blue, 0.25),
    borderRadius:      th.radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical:   5,
  },
  coachNoteText: {
    fontSize:   typography.xs,
    color:      th.colors.text,
    lineHeight: 17,
  },
  coachNoteName: {
    fontWeight: typography.bold,
    color:      th.colors.blue,
  },
  coachNoteTag: {
    color: th.colors.muted,
  },

  // Column headers — texto/columnas exactas de Figma, pero el grid se queda
  // flex:1/centrado (excepción de fidelidad §5.3-bis: el mock de Figma tiene
  // un desalineado deliberadamente NO replicado).
  colHeader: {
    flexDirection:     'row',
    paddingHorizontal: spacing.lg,
    gap:               spacing.sm,
    marginBottom:      spacing.xs,
  },
  colLabel: {
    ...textStyles.cardType,
    color: th.colors.mutedLight,
  },

  // Sets — gap explícito entre filas (antes solo el paddingVertical de cada fila, 4px)
  setList: {
    paddingHorizontal: spacing.lg,
    gap:               spacing.xs2,
  },

  // Divisor entre la zona de identidad y la de registro — antes gris + etiqueta
  // "SERIES DE TRABAJO" encima del grid; la etiqueta se quitó (chocaba visualmente
  // con KG/REP) y este color hace de único marcador de la zona de trabajo.
  sectionDivider: {
    height:           1,
    backgroundColor:  th.tint.accent50,
    marginHorizontal: spacing.lg,
    marginTop:        spacing.xs2,
    marginBottom:     spacing.md,
  },

  // Warmup — sin fondo propio; se apoya en el fondo de la card (Opción B)
  warmupSection: {
    marginHorizontal: spacing.lg,
    marginBottom:     spacing.md,
    gap:              spacing.xs2,
  },
  warmupHeader: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'baseline',
    marginBottom:   spacing.xs,
  },
  // Etiqueta de sección — paralela a "SERIES DE TRABAJO" (neutro mutedLight)
  warmupLabel: {
    ...textStyles.spacingTag,
    color: th.colors.mutedLight,
  },
  warmupMeta: {
    ...textStyles.tag,
    color: th.colors.mutedLight,
  },
  warmupBanner: {
    fontSize:  typography.xs,
    color:     th.colors.muted,
    fontStyle: 'italic',
  },
  warmupRows: {
    gap: spacing.xs2,
  },
  // Fila = etiqueta C1 (fuera) + chip que abraza el valor (no llega al final)
  warmupRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.sm,
  },
  // Etiqueta "C1/C2…" con la misma tipografía que "S1/S2" del grid
  warmupRowLabel: {
    width:      20,
    fontFamily: 'Inter_900Black',
    fontSize:   12,
    fontWeight: '900',
    color:      th.tint.accent50,
  },
  // Chip que abraza el contenido (alignSelf implícito por ser hijo de una fila).
  // Borde transparente en reposo para que el estado "tocado" no desplace el layout.
  warmupChip: {
    backgroundColor:   th.colors.bg,
    borderRadius:      th.radius.sm,
    borderWidth:       0.5,
    borderColor:       'transparent',
    paddingVertical:   spacing.xs2,
    paddingHorizontal: spacing.md,
  },
  // Tap → resalta en accent (dispara el descanso)
  warmupChipTapped: {
    borderColor:     th.tint.accent50,
    backgroundColor: th.tint.accent10,
  },
  // Texto 2 colores (§9 UI-MIGRATION): peso en accent, unidad en text, "×" mutedLight, reps en text
  warmupPillText: { ...textStyles.cardType },
  warmupPillNum:   { color: th.colors.accent },
  warmupPillUnit:  { color: th.colors.text },
  warmupPillTimes: { color: th.colors.mutedLight },
  warmupPillReps:  { color: th.colors.text },

  // Dropset sub-block — label/botón en rojo (adoptado, hoy naranja); sin borde
  // izquierdo (no está en el componente real de Figma, solo en la guía previa).
  dropBlock: {
    marginHorizontal: spacing.lg,
    marginTop:        spacing.sm,
    paddingLeft:      spacing.sm,
    paddingRight:     spacing.md,
  },
  dropBlockLabel: {
    ...textStyles.spacingTag,
    color:        th.colors.red,
    marginBottom: spacing.xs,
  },
  dropRowWrap: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.xs,
  },
  dropRemoveBtn: {
    padding: spacing.xs,
  },
  dropRemoveText: {
    fontSize: typography.sm,
    color:    th.colors.muted2,
  },
  addDropBtn: {
    marginTop:       spacing.xs,
    paddingVertical: spacing.xs + 2,
    alignItems:      'center',
  },
  addDropText: {
    ...textStyles.spacingTag,
    color:         th.tint.red50,
    textTransform: 'uppercase',
  },

  // Add set — Buttons "Añadir serie/sesion" outline (106:3284)
  addSetBtn: {
    marginTop:         spacing.sm,
    marginHorizontal:  spacing.lg,
    paddingVertical:   spacing.md,
    borderWidth:       borders.thin,
    borderColor:       th.tint.accent50,
    borderRadius:      th.radius.md,
    alignItems:        'center',
  },
  addSetText: {
    ...textStyles.cardType,
    color: th.tint.accent50,
  },

  // Hidden measurement view (absolutely positioned, opacity 0)
  collapsedMeasurer: {
    position: 'absolute',
    opacity:  0,
    left:     0,
    right:    0,
    top:      0,
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
    borderRadius:    th.radius.full,
    backgroundColor: withOpacity(th.colors.green, 0.15),
    borderWidth:     borders.thin,
    borderColor:     withOpacity(th.colors.green, 0.4),
    alignItems:      'center',
    justifyContent:  'center',
    marginTop:       2,
  },
  doneIconText: {
    fontSize:   11,
    color:      th.colors.green,
    fontWeight: typography.bold,
  },
  pillsRow: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           spacing.xs,
  },
  setPill: {
    backgroundColor:   withOpacity(th.colors.green, 0.08),
    borderWidth:       borders.thin,
    borderColor:       withOpacity(th.colors.green, 0.3),
    borderRadius:      th.radius.sm,
    paddingHorizontal: 7,
    paddingVertical:   2,
  },
  setPillText: {
    fontSize:   typography.xs,
    fontWeight: typography.medium,
    color:      th.colors.green,
  },
  addSetBtnSmall: {
    flexShrink:        0,
    borderWidth:       borders.thin,
    borderColor:       th.colors.border,
    borderStyle:       'dashed',
    borderRadius:      th.radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical:   spacing.xs + 2,
  },
  addSetSmallText: {
    fontSize:   typography.sm,
    color:      th.colors.muted,
    fontWeight: typography.medium,
  },
});
