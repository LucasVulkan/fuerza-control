/**
 * ExerciseCard — Exercise Card Spec v6 (formfit-exercise-card-spec.md).
 *
 * Geometría (paddings, gaps, alturas, radios, tamaños/tracking de fuente) tomada
 * LITERAL del spec; solo el color se mapea a los tokens que ya existen en la app:
 *
 *   spec              → token
 *   bg / cellFill     → colors.bg
 *   card              → colors.surface
 *   cardHead/btnFill  → colors.surface2
 *   text              → colors.text
 *   muted             → colors.mutedLight
 *   muted2            → colors.muted
 *   lime              → colors.accent
 *   limeGhost         → colors.muted2 (el usuario prefiere el gris original al
 *                       lima del spec para los valores sugeridos)
 *   limeDim           → tint.accent10
 *
 * Regla de identidad del spec: ningún elemento lleva borde. Las dos excepciones
 * conservadas a petición del usuario son la celda ACTIVA (borde accent-50 +
 * chevrones, SetRow) y la línea izquierda del bloque de superserie.
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
import { GRID } from './grid';
import NotesModal from './NotesModal';
import { useStore } from '../../../store/useStore';
import { useWeightUnit } from '../../hooks/useWeightUnit';
import { getProgression } from '../../../../src/utils/progression';
import { warmupSteps, computeWarmupWeights, resolveWorkWeight } from '../../../../src/utils/warmup';
import { resolveExerciseReference, resolveRef } from '../../../../src/utils/sessionOverride';
import { groupSetsByWeight, getPillVariant, buildSetLabel } from '../../utils/setDisplay';
import { isExerciseDone } from '../../utils/exerciseStatus';
import { spacing, typography, textStyles, withOpacity } from '../../theme';
import { useTheme, useThemedStyles } from '../../useTheme';

// ── Geometría del spec ────────────────────────────────────────────────────────
// Radios: card 16 · celdas y botones grandes 11 · botones pequeños 9.
const R_CARD  = 16;
const R_SMALL = 9;
// El radio de celdas y botones grandes (11) vive en GRID.RADIUS (./grid.js).
// Esquina interior de un miembro de superserie — las dos cards del par se pegan
// (gap 2, SupersetBlock) y aplanan las esquinas que se tocan.
const R_INNER = 4;

// ── NoteIcon — icono file-text del spec §3 (stroke 2.2, round) ────────────────
// Icono de notas ÚNICO de la app: lo usan tanto el botón de notas de la card
// como la cabecera de sesión (WorkoutScreen). Puramente presentacional — quien
// llama decide tamaño y color, porque sobre la banda lima del header hace falta
// la paleta onAccent en vez de accent.
//
// El spec lo fija en 17×17; subido a 21 a petición del usuario (se quedaba
// pequeño dentro del botón de 32).

export function NoteIcon({ size = 21, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"
        stroke={color}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M14 3v6h6"
        stroke={color}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
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
  groupLetter,             // superserie: "A"/"B"… — se concatena al número ("03A")
  orderNumber,             // "01"/"02"… posición del ejercicio en la sesión (WorkoutScreen)
  groupPos,                // superserie: 'first' | 'mid' | 'last' — aplana esquinas interiores
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
  // "Kg" capitalizado — misma técnica que HistoryScreen (label crudo viene en minúscula).
  const unitLabel = weightLabel.charAt(0).toUpperCase() + weightLabel.slice(1);

  // Trainer note (instructions written in the program editor)
  const trainerNote = exConfig.trainerNote?.trim() || null;
  // Coach next-session prescription (one-off): blue target ghosts + line + note.
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

  // ── Warmup (spec §4.3/§4.4) ───────────────────────────────────────────────
  // Informational only — NOT part of setsState, nothing is persisted. Purely
  // recalculated on every render from the current work weight; marking a row
  // only flips local "done" styling and optionally fires the rest timer.
  const startRestTimer = useStore((s) => s.startRestTimer);
  const warmupStepsArr = exConfig.warmup ? warmupSteps(exConfig.warmup) : [];
  const hasWarmup = warmupStepsArr.length > 0;
  const [warmupDone, setWarmupDone] = useState(() => new Set());
  // Reabrir a mano la sección colapsada (§4.4: el chevron reexpande).
  const [warmupReopened, setWarmupReopened] = useState(false);

  const firstWorkWeight = setsState[0]?.weight;
  const typedFirstWorkWeight = firstWorkWeight !== '' && firstWorkWeight != null
    ? parseFloat(firstWorkWeight) : undefined;
  const workWeightKg = hasWarmup
    ? resolveWorkWeight(overrideEx, lastExercise, typedFirstWorkWeight)
    : null;
  const warmupComputed = computeWarmupWeights(warmupStepsArr, workWeightKg);
  const warmupNoReference = hasWarmup && workWeightKg == null;
  const warmupRestSec = exConfig.warmup?.restSec ?? 60;
  const warmupAllDone = hasWarmup && warmupDone.size >= warmupStepsArr.length;
  const warmupCollapsed = warmupAllDone && !warmupReopened;

  function toggleWarmupRow(i) {
    setWarmupDone((prev) => {
      const next = new Set(prev);
      if (next.has(i)) {
        next.delete(i);
      } else {
        next.add(i);
        if (warmupRestSec > 0) startRestTimer(warmupRestSec, def?.name ?? exConfig.exerciseId);
      }
      return next;
    });
    setWarmupReopened(false);
  }

  const name = def
    ? (i18n.language === 'en' ? (def.nameEn ?? def.name) : def.name)
    : exConfig.exerciseId;

  // Dropset: checking the last work set is NOT the end of the exercise — the
  // drops come next. Hold the auto-collapse until at least one drop exists and
  // every drop is checked (adding a new undone drop re-opens the card).
  const allDone = isExerciseDone(exConfig, setsState);
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
  // Progreso del check del header: 0 = expandido (se ve el número "03A"),
  // 1 = colapsado (se ve el ✓). Crossfade en el MISMO hueco, sin desplazar el
  // título (§3: el header es Num | NameBlock | NoteButton en las dos vistas).
  const checkProgress = useRef(new Animated.Value(0)).current;
  const numOpacity = checkProgress.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
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
    // Mismo razonamiento que en startExpand: sin medida previa, arrancar desde
    // UNCONSTRAINED en vez de un número fijo (400) — el View ya está pintado a su
    // altura real (el maxHeight de 3000 no la afecta), así que animar "desde 3000"
    // se ve igual que animar desde la altura real, sin arriesgar un salto visual.
    const from = expandedH.current  > 0 ? expandedH.current  : UNCONSTRAINED;
    const to   = collapsedH.current > 40 ? collapsedH.current : 80;
    maxH.setValue(from);
    contentOpacity.setValue(1);
    Animated.timing(maxH,           { ...HEIGHT_CFG,  toValue: to }).start(({ finished }) => {
      if (finished) onDone(); // opacity sigue en 0 → useEffect se encarga del fade in
    });
    Animated.timing(contentOpacity, { ...OPACITY_CFG, toValue: 0 }).start();
    // Crossfade número → check, en paralelo a la altura.
    Animated.timing(checkProgress,  { ...HEIGHT_CFG,  toValue: 1 }).start();
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

  // Expand: solo anima la altura. El contenido expandido se muestra a opacidad
  // plena de INMEDIATO (revelado según crece la altura), NO se oculta para hacer
  // un fade-in. Fiar la visibilidad a un fade-in disparado por el useEffect de
  // [isCollapsed] dejaba la card "gris" (contentOpacity clavado en 0, contenido
  // montado e interactivo pero invisible) cuando ese efecto no llegaba a restaurar
  // la opacidad. Poner 1 aquí es a prueba de fallos y además cancela cualquier
  // fade-out de un colapso en curso.
  const startExpand = useCallback(() => {
    const from = collapsedH.current > 0 ? collapsedH.current : 80;
    // Sin medida previa (card ya completada al montar, expandedH.current nunca
    // se midió) usar UNCONSTRAINED en vez de un número fijo: el View para de crecer
    // en su tamaño natural, así que se ve igual sin arriesgar hueco/recorte.
    const to = expandedH.current > 0 ? expandedH.current : UNCONSTRAINED;
    maxH.setValue(from);
    contentOpacity.setValue(1);
    Animated.timing(maxH, { ...HEIGHT_CFG, toValue: to }).start(({ finished }) => {
      // Release the constraint so the card can grow freely if sets are added.
      if (finished) maxH.setValue(UNCONSTRAINED);
    });
    // Crossfade check → número, en paralelo a la altura.
    Animated.timing(checkProgress, { ...HEIGHT_CFG, toValue: 0 }).start();
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

  // ── ProgressionLine (spec §4.1) — solo tipografía: dir + detail ─────────────
  // `dir` sale de progression.type; `detail` es el salto numérico ("60 → 62.5 kg"),
  // calculado con el valor tope de la última sesión y la sugerencia del motor de
  // progresión. Sin sugerencia numérica (progresión por reps) cae al mensaje largo.
  const progDetail = (() => {
    if (!progression) return null;
    const sets = lastExercise?.sets ?? [];
    if (progression.suggestedWeight != null) {
      const curKg   = Math.max(0, ...sets.map((s) => parseFloat(s.weight) || 0));
      const cur     = curKg > 0 ? toDisplay(curKg) : null;
      const next    = toDisplay(progression.suggestedWeight);
      return cur != null && cur !== next
        ? `${cur} → ${next} ${weightLabel}`
        : `${next} ${weightLabel}`;
    }
    if (progression.suggestedTime != null) {
      const cur  = Math.max(0, ...sets.map((s) => parseFloat(s.time) || 0));
      const next = progression.suggestedTime;
      return cur > 0 && cur !== next ? `${cur} → ${next} s` : `${next} s`;
    }
    return progression.msg;
  })();
  const PROG_ARROW = { up: '↑', hold: '→', down: '↓' };

  const targetLabel = buildTarget(def, exConfig, t)
    + (hasWarmup ? t('workout.warmup.metaSuffix', { count: warmupStepsArr.length }) : '');

  // ── Piezas compartidas del render ───────────────────────────────────────────
  // El header (num/check + nombre/target + notas) es PERSISTENTE: se pinta una
  // sola vez FUERA del crossfade, así al colapsar/expandir NO parpadea. Solo el
  // cuerpo hace fade out/in; el número hace crossfade con el ✓ en su mismo hueco.
  const numLabel = `${orderNumber ?? ''}${groupLetter ?? ''}`;

  const numSlot = (animated) => (
    <View style={styles.numSlot}>
      {animated ? (
        <>
          <Animated.Text style={[styles.num, { opacity: numOpacity }]}>{numLabel}</Animated.Text>
          <Animated.Text style={[styles.num, styles.numOverlay, { opacity: checkProgress }]}>✓</Animated.Text>
        </>
      ) : (
        <Text style={styles.num}>{numLabel}</Text>
      )}
    </View>
  );

  const nameBlock = (
    <>
      <View style={styles.nameRow}>
        <Text style={styles.name} numberOfLines={2}>{name}</Text>
        {exConfig.isKey && <Text style={styles.keyBadge}>{t('workout.keyBadge')}</Text>}
      </View>
      {(targetLabel || exConfig.tempo) ? (
        <Text style={styles.target} numberOfLines={2}>
          {targetLabel}
          {targetLabel && exConfig.tempo
            ? <Text style={styles.tempoInline}>{` · ${exConfig.tempo}`}</Text>
            : exConfig.tempo
              ? <Text style={styles.tempoInline}>{exConfig.tempo}</Text>
              : null}
        </Text>
      ) : null}
    </>
  );

  // NoteButton (§3): 32×32, radius 9, sin fondo, marginTop −5. Punto de 6px
  // cuando hay notas.
  const noteBtn = onClientNoteChange ? (
    <TouchableOpacity
      style={styles.noteBtn}
      onPress={() => setNoteInputOpen((v) => !v)}
      hitSlop={8}
      activeOpacity={0.7}
    >
      <NoteIcon color={hasClientNote || noteInputOpen ? th.colors.accent : th.colors.muted} />
      {hasClientNote ? <View style={styles.noteDot} /> : null}
    </TouchableOpacity>
  ) : null;

  // Header persistente. Tap sobre el título = expandir (si colapsado) o colapsar
  // (si se reabrió a mano, manualOpen); en una card en curso no hace nada. El icono
  // de notas queda fuera del área táctil del título (su propio onPress).
  const renderHeader = (animated) => (
    <View style={styles.header}>
      {numSlot(animated)}
      <TouchableOpacity
        style={styles.headerNameTap}
        onPress={isCollapsed ? handleOpen : (manualOpen ? handleCollapse : undefined)}
        disabled={!isCollapsed && !manualOpen}
        activeOpacity={0.7}
      >
        {nameBlock}
      </TouchableOpacity>
      {noteBtn}
    </View>
  );

  // Resumen de series colapsado — reutiliza setDisplay.js (misma lógica que
  // History/Progress); "fuera de rango" = ROJO aquí (decisión de usuario).
  const pillsBlock = (
    <View style={styles.collapsedPillsRow}>
      {groupSetsByWeight(setsState).map((group, gi) => (
        <View key={`grp-${gi}`} style={styles.setGroup}>
          {group.weight ? (
            <View style={styles.weightPill}>
              <Text style={styles.weightPillText}>
                <Text style={styles.weightPillNum}>{toDisplay(group.weight)}</Text>
                <Text style={styles.weightPillUnit}>{unitLabel}</Text>
                <Text style={styles.weightPillX}>{' x'}</Text>
              </Text>
            </View>
          ) : null}
          {group.sets.map((s, i) => {
            const variant = getPillVariant(s, exConfig);
            const { main, rpeNum } = buildSetLabel(s, i, fmt, true);
            return (
              <View
                key={`set-${gi}-${i}`}
                style={[
                  styles.setPill,
                  variant === 'done'    && styles.setPillDone,
                  variant === 'partial' && styles.setPillPartial,
                ]}
              >
                <Text
                  style={[
                    styles.setPillText,
                    variant === 'done'    && styles.setPillTextDone,
                    variant === 'partial' && styles.setPillTextPartial,
                  ]}
                >
                  {main}
                  {rpeNum ? (
                    <>
                      <Text
                        style={[
                          styles.setPillRpeAt,
                          variant === 'done'    && styles.setPillRpeAtDone,
                          variant === 'partial' && styles.setPillRpeAtPartial,
                        ]}
                      >
                        @
                      </Text>
                      {rpeNum}
                    </>
                  ) : null}
                </Text>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );

  // Contenido del measurer (oculto): layout colapsado COMPLETO (header estático
  // + pills), así collapsedH ya cuenta con el header definitivo.
  const measurerContent = (
    <>
      {renderHeader(false)}
      {pillsBlock}
    </>
  );

  const cornerStyle = groupPos === 'first' ? styles.cardGroupFirst
    : groupPos === 'mid'  ? styles.cardGroupMid
    : groupPos === 'last' ? styles.cardGroupLast
    : null;

  // ── Animated.View root — maxHeight drives the height animation ──
  return (
    <Animated.View
      style={[styles.card, cornerStyle, { maxHeight: maxH }]}
      onLayout={onCardLayout}
    >

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
        {measurerContent}
      </View>

      {/* Header persistente compartido — fuera del crossfade, no parpadea al
          colapsar/expandir; el ✓ hace crossfade con el número. */}
      {renderHeader(true)}

      <Animated.View style={{ opacity: contentOpacity }}>

      {isCollapsed ? (

        /* ── Collapsed view — solo las pills (el header ya está arriba) ── */
        <TouchableOpacity onPress={handleOpen} activeOpacity={0.85}>
          {pillsBlock}
        </TouchableOpacity>

      ) : (

        /* ── Expanded view — Body (spec §4), padding 12 16 14 ── */
        <View style={styles.body}>

          {/* ProgressionLine (§4.1) — oculta si el entrenador fijó un objetivo */}
          {!hasCoachTarget && progression ? (
            <View style={styles.progLine}>
              <Text style={[styles.progDir, progression.type === 'hold' && styles.progDirHold]}>
                {`${PROG_ARROW[progression.type] ?? '→'} ${t(`workout.progression.${progression.type}`, '')}`}
              </Text>
              {progDetail ? <Text style={styles.progDetail}>{progDetail}</Text> : null}
            </View>
          ) : null}

          {/* Coach target (next-session prescription) — misma anatomía, en azul */}
          {hasCoachTarget ? (
            <View style={styles.progLine}>
              <Text style={styles.progDirCoach}>{`◎ ${t('workout.coachTarget')}`}</Text>
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

          {/* ── WarmupSection colapsada (§4.4) ── */}
          {hasWarmup && warmupCollapsed ? (
            <TouchableOpacity
              style={styles.warmupCollapsed}
              onPress={() => setWarmupReopened(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.warmupCollapsedTick}>✓</Text>
              <Text style={styles.warmupCollapsedText} numberOfLines={1}>
                {t('workout.warmup.collapsedSummary', {
                  label: t('workout.warmup.blockLabel'),
                  count: warmupStepsArr.length,
                  weight: workWeightKg != null ? `${toDisplay(workWeightKg)} ${weightLabel}` : '—',
                })}
              </Text>
              <Text style={styles.warmupCollapsedChevron}>⌄</Text>
            </TouchableOpacity>
          ) : null}

          {/* ── WarmupSection expandida (§4.3) ── */}
          {hasWarmup && !warmupCollapsed ? (
            <View style={styles.warmupSection}>
              <View style={styles.sectionLabelRow}>
                <Text style={styles.sectionLabel}>{t('workout.warmup.blockLabel').toUpperCase()}</Text>
                <Text style={styles.sectionLabelMeta}>
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
                  const done = warmupDone.has(wi);
                  const hasWeight = step.weightKg != null;
                  // toDisplay() ya convierte a la unidad activa — NO usar fmt() aquí,
                  // que además añade el sufijo de unidad (duplicaría "Kg").
                  const numStr = hasWeight ? String(toDisplay(step.weightKg)) : `${warmupStepsArr[wi].pct}%`;
                  return (
                    <View key={wi} style={styles.warmupRow}>
                      <Text style={[styles.warmupRowLabel, done && styles.warmupTextOff]}>{`C${wi + 1}`}</Text>
                      <Text style={styles.warmupDetail} numberOfLines={1}>
                        <Text style={[styles.warmupWeight, done && styles.warmupTextOff]}>{numStr}</Text>
                        {hasWeight ? <Text style={[styles.warmupWeight, done && styles.warmupTextOff]}>{` ${weightLabel}`}</Text> : null}
                        <Text style={[styles.warmupTimes, done && styles.warmupTextOff]}>{' × '}</Text>
                        <Text style={[styles.warmupReps, done && styles.warmupTextOff]}>{step.reps}</Text>
                      </Text>
                      <TouchableOpacity
                        style={[styles.warmupCheck, done && styles.warmupCheckDone]}
                        onPress={() => toggleWarmupRow(wi)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.warmupCheckMark, done && styles.warmupCheckMarkDone]}>✓</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            </View>
          ) : null}

          {/* SectionLabel "SERIES" — solo si hay sección de aproximación (§2) */}
          {hasWarmup ? (
            <Text style={styles.sectionLabel}>{t('workout.setsSectionLabel').toUpperCase()}</Text>
          ) : null}

          {/* SetsGrid — fila 0: headers de columna (§4.5) */}
          <View style={styles.colHeader}>
            <View style={{ width: GRID.LABEL_W }} />
            {inputType === 'reps' ? (
              <Text style={styles.colLabel}>{t('workout.reps').toUpperCase()}</Text>
            ) : inputType === 'time' ? (
              <Text style={styles.colLabel}>{t('workout.timeSec').toUpperCase()}</Text>
            ) : inputType === 'weight_time' ? (
              <>
                <Text style={styles.colLabel}>{weightLabel.toUpperCase()}</Text>
                <Text style={styles.colLabel}>{t('workout.timeSec').toUpperCase()}</Text>
              </>
            ) : (
              // weight_reps (default)
              <>
                <Text style={styles.colLabel}>{weightLabel.toUpperCase()}</Text>
                <Text style={styles.colLabel}>{t('workout.reps').toUpperCase()}</Text>
              </>
            )}
            {/* Play btn — header vacío */}
            {hasTimer && <View style={{ width: GRID.BTN_W }} />}
            {trackRpe && <Text style={styles.colLabel}>RPE</Text>}
            {/* Check btn — header vacío */}
            <View style={{ width: GRID.BTN_W }} />
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
              // renders blue; otherwise the grey ghost stays.
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
              <TouchableOpacity style={styles.addLink} onPress={onAddDrop} activeOpacity={0.7}>
                <Text style={[styles.addLinkText, styles.addDropPlus]}>+</Text>
                <Text style={styles.addLinkText}>{t('workout.addDropBtn')}</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {/* AddSetLink (§4.6) — oculto en superset, el grupo comparte un único enlace */}
          {!hideAddSetBtn && (
            <TouchableOpacity style={[styles.addLink, styles.addSetLink]} onPress={onAddSet} activeOpacity={0.7}>
              <Text style={[styles.addLinkText, styles.addSetPlus]}>+</Text>
              <Text style={styles.addLinkText}>{t('workout.addSetBtn')}</Text>
            </TouchableOpacity>
          )}

        </View>

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
  // §2 — ExerciseCard (bg card, radius 16, overflow hidden). El marginBottom 14
  // del spec lo aporta el `gap` del ScrollView (WorkoutScreen).
  card: {
    backgroundColor: th.colors.surface,
    borderRadius:    R_CARD,
    overflow:        'hidden',
    // Borde transparente OBLIGATORIO (no decorativo): en Android, un View con
    // overflow:'hidden' + borderRadius NO recompone/pinta sus hijos de forma fiable
    // salvo que tenga un borde que fuerce la capa de recorte — sin él la card queda
    // "gris" (fondo visible, contenido montado pero sin pintar).
    borderWidth: 1,
    borderColor: 'transparent',
  },
  // Superserie: el par se lee como un bloque partido en dos — esquinas
  // interiores a radio 4, exteriores a 16 (la separación de 2px la pone
  // SupersetBlock).
  cardGroupFirst: { borderBottomLeftRadius: R_INNER, borderBottomRightRadius: R_INNER },
  cardGroupMid:   { borderRadius: R_INNER },
  cardGroupLast:  { borderTopLeftRadius: R_INNER, borderTopRightRadius: R_INNER },

  // §3 Header — bg cardHead, padding 14 12 14 16, gap 10, alignItems flex-start.
  header: {
    flexDirection:   'row',
    alignItems:      'flex-start',
    gap:             10,
    backgroundColor: th.colors.surface2,
    paddingTop:      14,
    paddingRight:    12,
    paddingBottom:   14,
    paddingLeft:     16,
  },
  // Hueco del número — el ✓ del estado colapsado hace crossfade encima, sin
  // desplazar el nombre.
  numSlot: {
    minWidth: 22,
  },
  num: {
    fontFamily:  'Inter_900Black',
    fontSize:    17,
    fontWeight:  '900',
    lineHeight:  22,
    color:       th.colors.accent,
    fontVariant: ['tabular-nums'],
  },
  numOverlay: {
    position:  'absolute',
    left: 0, right: 0, top: 0,
    textAlign: 'center',
  },
  // NameBlock (§3) — `flex: 1` reparte el ancho sobrante de la fila. OJO: no
  // anidar aquí otro View con `flex: 1`; en un contenedor en columna eso implica
  // `flexBasis: 0` en vertical y colapsa la altura del bloque, dejando el target
  // ("3 × 12") fuera de la banda del header.
  headerNameTap: { flex: 1, minWidth: 0 },
  nameRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.sm,
    flexWrap:      'wrap',
  },
  name: {
    fontFamily:    'Inter_900Black',
    fontSize:      17,
    fontWeight:    '900',
    lineHeight:    22,
    letterSpacing: -0.17,
    color:         th.colors.text,
    flexShrink:    1,
  },
  keyBadge: {
    fontSize:          typography.xs,
    fontWeight:        typography.bold,
    color:             th.colors.accent,
    backgroundColor:   th.tint.accent10,
    borderRadius:      R_SMALL,
    paddingHorizontal: spacing.xs,
    paddingVertical:   2,
    overflow:          'hidden',
    letterSpacing:     0.5,
  },
  target: {
    fontFamily:  'Inter_600SemiBold',
    fontSize:    12,
    fontWeight:  '600',
    color:       th.colors.mutedLight,
    marginTop:   3,
    fontVariant: ['tabular-nums'],
  },
  tempoInline: {
    color:         th.colors.muted,
    letterSpacing: 1.2,
  },
  // NoteButton — 32×32, radius 9, sin fondo, marginTop −5 (alinea ópticamente
  // con la 1ª línea del nombre).
  noteBtn: {
    width:          32,
    height:         32,
    marginTop:      -5,
    borderRadius:   R_SMALL,
    alignItems:     'center',
    justifyContent: 'center',
    flexShrink:     0,
  },
  noteDot: {
    position:        'absolute',
    top: 3, right: 3,
    width: 6, height: 6,
    borderRadius:    3,
    backgroundColor: th.colors.accent,
  },

  // §4 Body — padding 12 16 14.
  body: {
    paddingTop:    12,
    paddingBottom: 14,
    paddingHorizontal: 16,
  },

  // §4.1 ProgressionLine — solo tipografía, sin fondo ni chip.
  progLine: {
    flexDirection: 'row',
    alignItems:    'baseline',
    gap:           8,
    paddingTop:    2,
    paddingBottom: 12,
  },
  progDir: {
    fontFamily:    'Inter_900Black',
    fontSize:      11,
    fontWeight:    '900',
    letterSpacing: 1.1,
    color:         th.colors.accent,
    textTransform: 'uppercase',
  },
  progDirHold: {
    color: th.colors.mutedLight,
  },
  progDirCoach: {
    fontFamily:    'Inter_900Black',
    fontSize:      11,
    fontWeight:    '900',
    letterSpacing: 1.1,
    color:         th.colors.blue,
    textTransform: 'uppercase',
  },
  progDetail: {
    flex:        1,
    fontFamily:  'Inter_700Bold',
    fontSize:    12,
    fontWeight:  '700',
    color:       th.colors.text,
    fontVariant: ['tabular-nums'],
  },

  // §4.2 SectionLabel — 10/700 uppercase, tracking 0.14em, muted2, mb 8.
  sectionLabel: {
    fontFamily:    'Inter_700Bold',
    fontSize:      10,
    fontWeight:    '700',
    letterSpacing: 1.4,
    color:         th.colors.muted,
    marginBottom:  8,
  },
  sectionLabelRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'baseline',
  },
  // Meta de descanso — no está en el spec, se conserva de la implementación
  // previa alineada a la derecha del SectionLabel.
  sectionLabelMeta: {
    fontFamily:   'Inter_500Medium',
    fontSize:     10,
    fontWeight:   '500',
    color:        th.colors.muted,
    marginBottom: 8,
  },

  // §4.3 WarmupSection expandida — grid 26 | 1fr | 42, gap 6/10, mb 14.
  warmupSection: {
    marginBottom: 14,
  },
  warmupBanner: {
    fontSize:     typography.xs,
    color:        th.colors.mutedLight,
    fontStyle:    'italic',
    marginBottom: 6,
  },
  warmupRows: {
    gap: 6,
  },
  warmupRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           10,
  },
  warmupRowLabel: {
    width:       GRID.LABEL_W,
    fontFamily:  'Inter_800ExtraBold',
    fontSize:    12,
    fontWeight:  '800',
    color:       th.colors.muted,
    fontVariant: ['tabular-nums'],
  },
  warmupDetail: {
    flex:        1,
    fontSize:    14,
    fontVariant: ['tabular-nums'],
  },
  warmupWeight: { fontFamily: 'Inter_800ExtraBold', fontWeight: '800', color: th.colors.text },
  warmupTimes:  { fontFamily: 'Inter_600SemiBold',  fontWeight: '600', color: th.colors.muted },
  warmupReps:   { fontFamily: 'Inter_700Bold',      fontWeight: '700', color: th.colors.mutedLight },
  // Fila completada: todo el texto se apaga a muted2.
  warmupTextOff: { color: th.colors.muted },
  warmupCheck: {
    width:           GRID.BTN_W,
    height:          34,
    borderRadius:    R_SMALL,
    backgroundColor: th.colors.surface2,
    alignItems:      'center',
    justifyContent:  'center',
  },
  warmupCheckDone: {
    backgroundColor: th.colors.accent,
  },
  warmupCheckMark: {
    fontSize: 13,
    color:    th.colors.mutedLight,
  },
  warmupCheckMarkDone: {
    fontFamily: 'Inter_900Black',
    fontWeight: '900',
    color:      th.colors.onAccent,
  },

  // §4.4 WarmupSection colapsada — row, gap 8, padding 2 0 14.
  warmupCollapsed: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           8,
    paddingTop:    2,
    paddingBottom: 14,
  },
  warmupCollapsedTick: {
    fontFamily: 'Inter_900Black',
    fontWeight: '900',
    fontSize:   12,
    color:      th.colors.accent,
  },
  warmupCollapsedText: {
    flexShrink:  1,
    fontFamily:  'Inter_700Bold',
    fontSize:    12,
    fontWeight:  '700',
    color:       th.colors.muted,
    fontVariant: ['tabular-nums'],
  },
  warmupCollapsedChevron: {
    marginLeft: 'auto',
    fontSize:   14,
    color:      th.colors.muted,
  },

  // §4.5 SetsGrid — headers de columna (mismo estilo que SectionLabel, centrado).
  colHeader: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           10,
    marginBottom:  8,
  },
  colLabel: {
    flex:          1,
    fontFamily:    'Inter_700Bold',
    fontSize:      10,
    fontWeight:    '700',
    letterSpacing: 1.4,
    color:         th.colors.muted,
    textAlign:     'center',
  },
  setList: {
    gap: 8,
  },

  // Dropset sub-block — label/enlace en rojo.
  dropBlock: {
    marginTop: 12,
  },
  dropBlockLabel: {
    fontFamily:    'Inter_700Bold',
    fontSize:      10,
    fontWeight:    '700',
    letterSpacing: 1.4,
    color:         th.colors.red,
    marginBottom:  8,
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
    color:    th.colors.muted,
  },
  // §4.6 AddSetLink — texto centrado, sin caja. padding 6 0 2, "+" con 6px de
  // separación (gap, no un espacio en el texto). Compartido con "Añadir drop".
  addLink: {
    flexDirection:  'row',
    justifyContent: 'center',
    alignItems:     'center',
    gap:            6,
    paddingTop:     6,
    paddingBottom:  2,
  },
  addLinkText: {
    fontFamily:    'Inter_800ExtraBold',
    fontSize:      13,
    fontWeight:    '800',
    letterSpacing: 0.26,
    color:         th.colors.mutedLight,
  },
  addSetLink:  { marginTop: 12 },
  addSetPlus:  { color: th.colors.accent },
  addDropPlus: { color: th.colors.red },

  // Trainer note strip — sin borde (regla de identidad del spec), solo relleno.
  trainerNote: {
    backgroundColor:   th.tint.accent10,
    borderRadius:      R_SMALL,
    paddingHorizontal: 10,
    paddingVertical:   6,
    marginBottom:      12,
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

  // Coach one-off note strip
  coachNote: {
    backgroundColor:   withOpacity(th.colors.blue, 0.1),
    borderRadius:      R_SMALL,
    paddingHorizontal: 10,
    paddingVertical:   6,
    marginBottom:      12,
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
    color: th.colors.mutedLight,
  },

  // Hidden measurement view (absolutely positioned, opacity 0)
  collapsedMeasurer: {
    position: 'absolute',
    opacity:  0,
    left:     0,
    right:    0,
    top:      0,
  },

  // Resumen de series colapsado — MISMA lógica/estilo que HistoryScreen
  // (groupSetsByWeight + getPillVariant + buildSetLabel de setDisplay.js).
  // Única diferencia real: aquí "fuera de rango" es ROJO (pedido del usuario).
  collapsedPillsRow: {
    flexDirection:     'row',
    flexWrap:          'wrap',
    gap:               8,
    paddingHorizontal: 16,
    paddingTop:        12,
    paddingBottom:     14,
  },
  setGroup: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.xs,
  },
  weightPill: {
    paddingVertical: spacing.sm,
  },
  weightPillText: {
    ...textStyles.tag,
  },
  weightPillNum:  { color: th.colors.accent },
  weightPillUnit: { color: th.colors.text },
  weightPillX:    { color: th.colors.mutedLight },

  setPill: {
    backgroundColor: th.colors.bg,
    borderRadius:    R_SMALL,
    paddingHorizontal: 8,
    paddingVertical:   6,
  },
  setPillDone: {
    backgroundColor: th.tint.accent10,
  },
  setPillPartial: {
    backgroundColor: th.tint.red30,
  },
  setPillText: {
    ...textStyles.tag,
    color: th.colors.mutedLight,
  },
  setPillTextDone: {
    color: th.colors.accent,
  },
  setPillTextPartial: {
    color: th.colors.red,
  },
  // El "@" de "12@8" — más apagado que el resto del número, mismo color base del pill.
  setPillRpeAt:        { color: th.colors.muted },
  setPillRpeAtDone:    { color: th.tint.accent50 },
  setPillRpeAtPartial: { color: th.tint.red50 },
});
