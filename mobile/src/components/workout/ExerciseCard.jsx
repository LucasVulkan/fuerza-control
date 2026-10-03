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

import { View, TouchableOpacity, Pressable, StyleSheet, Animated, Easing } from 'react-native';
import { Text, MAX_FONT_SCALE } from '../ui/Text';
import Svg, { Path } from 'react-native-svg';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import SetRow from './SetRow';
import SetPills from './SetPills';
import { GRID } from './grid';
import NotesModal from './NotesModal';
import { useStore } from '../../../store/useStore';
import { useWeightUnit } from '../../hooks/useWeightUnit';
import { getProgression, progressionHistory, progressionRule } from '../../utils/progression';
import { planSet } from '../../utils/setPlan';
import { warmupSteps, computeWarmupWeights, resolveWorkWeight } from '../../utils/warmup';
import { targetLabel as buildTarget, firstTimeRx } from '../../utils/prescription';
import { DIM_ORDER, variantDims, isEmptyVariant, sameVariant, displayVariant } from '../../utils/variants';
import VariantPicker from '../ui/VariantPicker';
import AnimatedHeight from '../ui/AnimatedHeight';
import DragSheet from '../DragSheet';
import { isExerciseDone } from '../../utils/exerciseStatus';
import { spacing, textStyles, withOpacity, lh } from '../../theme';
import { useTheme, useThemedStyles } from '../../useTheme';

import { CloseIcon } from '../ui/EditorIcons';
import { RowIcon } from '../ui/MenuList';
import { ROW_ICON } from '../ui/rowIcons';

// Icono de nota delante de la nota del entrenador.
const NOTE_ICON = 13;
// ── Geometría del spec ────────────────────────────────────────────────────────
// Radios: card 16 · celdas y botones grandes 11 · botones pequeños 9.
const R_CARD  = 16;
const R_SMALL = 9;
// El radio de celdas y botones grandes (11) vive en GRID.RADIUS (./grid.js).
// Esquina interior de un miembro de superserie — las dos cards del par se pegan
// (gap 2, SupersetBlock) y aplanan las esquinas que se tocan.
const R_INNER = 4;

// Textos de la fila «Primera vez» y de su ficha, según qué se busca.
const FIRST_LABEL = {
  weight: 'workout.progression.firstWeight', effort: 'workout.progression.firstWeight',
  bodyweight: 'workout.progression.firstBodyweight', time: 'workout.progression.firstTime',
};
const FIRST_TODAY = {
  weight: 'workout.progSheet.firstWeight', effort: 'workout.progSheet.firstEffort',
  bodyweight: 'workout.progSheet.firstBodyweight', time: 'workout.progSheet.firstTime',
};

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

// ── ExerciseCard ──────────────────────────────────────────────────────────────

export default function ExerciseCard({
  exConfig,
  def,
  setsState,
  lastExercise,
  recentSessions,          // las 3 últimas veces, [{ timestamp, exercise }], la más reciente primero (la 1ª es lastExercise)
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
  onEditTarget,            // solo los ad-hoc: la línea de objetivo abre su hoja (ver abajo)
}) {
  const { t, i18n } = useTranslation();
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { label: weightLabel, toDisplay, toKg, scrollStep: weightScrollStep } = useWeightUnit();

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

  // ── Chip de progresión ─────────────────────────────────────────────────────
  // Va antes que el calentamiento: este rampa hacia el peso del plan (§6.2). Por
  // esfuerzo lee además las sesiones anteriores (§6.5); las demás progresiones
  // no las miran.
  const progression = (() => {
    if (!lastExercise?.sets?.length) return null;
    const recent = recentSessions?.length ? recentSessions.map((r) => r.exercise) : [lastExercise];
    try { return getProgression(exConfig, def, lastExercise.sets, t, progressionHistory(recent)); }
    catch { return null; }
  })();

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
    ? resolveWorkWeight(overrideEx, lastExercise, typedFirstWorkWeight, progression)
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

  // ── Variante de hoy (P09-exercise-variants.md §5.1) ─────────────────────────────
  // La del programa, salvo que hoy se haya cambiado en la hoja. Solo informa: se
  // apunta en el registro y el programa no cambia.
  const programVariant = exConfig.variant ?? null;
  const todayVariants  = useStore((s) => s.activeSession.variants);
  const setSessionVariant = useStore((s) => s.setSessionVariant);
  const hasToday = !!todayVariants && Object.prototype.hasOwnProperty.call(todayVariants, exConfig.exerciseId);
  const variant  = hasToday ? todayVariants[exConfig.exerciseId] : programVariant;
  const [variantSheetOpen, setVariantSheetOpen] = useState(false);
  // Sin variante en el programa no hay nada que cambiar hoy (decisión del usuario).
  const canChangeVariant = variantDims(def).length > 0 && (!isEmptyVariant(programVariant) || hasToday);
  // Un ejercicio aparte ya lleva la variante en el nombre: no se repite.
  const shown = displayVariant(variant, def);
  const variantParts = DIM_ORDER.filter((d) => shown?.[d]).map((d) => ({
    dim:     d,
    label:   t(`variants.options.${d}.${variant[d]}`),
    changed: variant[d] !== programVariant?.[d],
  }));

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

  // ── ProgressionLine (spec §4.1) — solo tipografía: dir + destino + salto ────
  // `dir` sale de progression.type. El detalle NO es un rango: "7.5 → 2.5 kg" no
  // dice si bajas A 2.5 o RESTAS 2.5, y encima su flecha compite con la de `dir`.
  // Se parte en dos: `target` es el peso al que vas (la instrucción) y `delta` es
  // el salto respecto a la última sesión, en pastilla aparte y en gris para que no
  // pelee con el acento. Sin sugerencia numérica cae al mensaje largo, y ahí el
  // label pierde la preposición ("Subir", no "Subir a"). El porqué ya no va en
  // una frase debajo (rompía la rejilla de la tarjeta): está en la ficha que abre
  // la línea entera (§6.3).
  const { progTarget, progDelta } = (() => {
    if (!progression) return {};
    const sets = lastExercise?.sets ?? [];
    const signed = (n) => `${n > 0 ? '+' : '−'}${Math.abs(n)}`;
    if (progression.suggestedWeight != null) {
      const curKg = Math.max(0, ...sets.map((s) => parseFloat(s.weight) || 0));
      const cur   = curKg > 0 ? toDisplay(curKg) : null;
      const next  = toDisplay(progression.suggestedWeight);
      return {
        progTarget: `${next} ${weightLabel}`,
        progDelta:  cur != null && cur !== next ? signed(Math.round((next - cur) * 100) / 100) : null,
      };
    }
    if (progression.suggestedTime != null) {
      // El salto se cuenta desde la serie de la que parte (la más floja), no
      // desde la mejor: 45/45/40 → «45 s +5», no «45 s» a secas.
      const cur  = progression.from ?? Math.max(0, ...sets.map((s) => parseFloat(s.time) || 0));
      const next = progression.suggestedTime;
      return {
        progTarget: `${next} s`,
        progDelta:  progression.type !== 'hold' && cur > 0 && cur !== next ? signed(next - cur) : null,
      };
    }
    // Reps con número, como peso y tiempo: antes caía a la frase larga (QA P52).
    if (progression.suggestedReps != null) {
      const cur  = progression.from;
      const next = progression.suggestedReps;
      return {
        progTarget: t('workout.progressionReps', { count: next }),
        progDelta:  progression.type !== 'hold' && cur != null && cur !== next ? signed(next - cur) : null,
      };
    }
    return { progTarget: progression.msg, progDelta: null };
  })();
  const PROG_ARROW = { up: '↑', hold: '→', down: '↓' };
  // "Subir a 62.5 kg" solo tiene sentido con un número detrás: con el mensaje
  // largo de la progresión por reps vuelve al label sin preposición.
  const progKey = (() => {
    if (!progression) return null;
    const base = progression.reason === 'deload' ? 'deload' : progression.type;
    const numeric = progression.suggestedWeight != null || progression.suggestedTime != null
      || progression.suggestedReps != null;
    // Por esfuerzo el número es SIEMPRE el peso de hoy, suba o no: «Peso
    // objetivo» (P10-effort-progression.md §5.2). La flecha y el delta dicen si sube.
    if (progression.effort && numeric) return 'effortTo';
    // Asistido: el número es la ayuda. «Subir a 17,5» se leía como más ayuda.
    if (progression.assist && numeric && base === 'up')   return 'assistLessTo';
    if (progression.assist && numeric && base === 'down') return 'assistMoreTo';
    return numeric && base !== 'hold' ? `${base}To` : base;
  })();

  // Con Reps o Tiempo la cabecera dice la meta de hoy («3 × 9 reps»), no el
  // inicio (§6.3); sin chip con número, el inicio con «+».
  const today = progression?.suggestedReps != null ? { reps: progression.suggestedReps }
    : progression?.suggestedTime != null ? { time: progression.suggestedTime }
    : null;
  const targetLabel = buildTarget(def, exConfig, t, { today })
    + (hasWarmup ? t('workout.warmup.metaSuffix', { count: warmupStepsArr.length }) : '');

  // Sin historial no hay chip: la fila «Primera vez» dice qué buscar leyendo la
  // progresión de la config. No en los ejercicios añadidos sobre la marcha
  // (`onEditTarget`): no tienen progresión que explicar.
  const [progSheetOpen, setProgSheetOpen] = useState(false);
  const firstTime = !lastExercise?.sets?.length && !hasCoachTarget && !onEditTarget
    ? firstTimeRx(def, exConfig) : null;
  const e1rmShown = progression?.effort && progression.e1rm != null
    ? Math.round(toDisplay(progression.e1rm)) : null;

  // ── Piezas compartidas del render ───────────────────────────────────────────
  // El header (num/check + nombre/target + notas) es PERSISTENTE: se pinta una
  // sola vez FUERA del crossfade, así al colapsar/expandir NO parpadea. Solo el
  // cuerpo hace fade out/in; el número hace crossfade con el ✓ en su mismo hueco.
  const numLabel = `${orderNumber ?? ''}${groupLetter ?? ''}`;

  const numSlot = (animated) => (
    <View style={styles.numSlot}>
      {animated ? (
        <>
          <Animated.Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[styles.num, { opacity: numOpacity }]}>{numLabel}</Animated.Text>
          <Animated.Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[styles.num, styles.numOverlay, { opacity: checkProgress }]}>✓</Animated.Text>
        </>
      ) : (
        <Text style={styles.num}>{numLabel}</Text>
      )}
    </View>
  );

  const nameBlock = (
    <>
      <View style={styles.nameRow}>
        {/* La variante detrás del nombre, en gris y sin subrayado
            (P09-exercise-variants.md §4.3): mismo estilo, solo cambia el color. */}
        <Text style={styles.name} numberOfLines={2}>
          {name}
          {/* Pulsable solo desplegada: plegada, tocar la cabecera la despliega.
              Lo cambiado hoy va en acento. */}
          {variantParts.length ? (
            <Text
              style={styles.nameVariant}
              onPress={canChangeVariant && !isCollapsed ? () => setVariantSheetOpen(true) : undefined}
              suppressHighlighting
            >
              {variantParts.map((p) => (
                <Text key={p.dim} style={p.changed ? styles.nameVariantChanged : null}>{` · ${p.label}`}</Text>
              ))}
            </Text>
          ) : null}
        </Text>
      </View>
      {/* "Principal" es metadato, no badge: como pastilla junto al nombre se
          llevaba una fila entera en cuanto el nombre era largo. Va delante del
          objetivo, en la misma línea, separado por punto medio. */}
      {/* La línea de objetivo es el disparador de su propia edición cuando hay
          algo que editar — que hoy son solo los ejercicios añadidos sobre la
          marcha (`onEditTarget`). En los de plantilla sigue siendo texto: ahí
          el plan es del programa y se cambia en el editor de sesión, no en
          mitad del entreno. Misma regla que la etiqueta SEMANA de la tarjeta de programa: el
          disparador es el dato, no un icono al lado. */}
      {(targetLabel || exConfig.tempo || exConfig.isKey) ? (
        <Text
          style={[styles.target, onEditTarget && styles.targetEditable]}
          numberOfLines={2}
          onPress={onEditTarget}
          suppressHighlighting={!onEditTarget}>
          {exConfig.isKey ? <Text style={styles.keyInline}>{t('common.keyExercise')}</Text> : null}
          {exConfig.isKey && (targetLabel || exConfig.tempo) ? ' · ' : ''}
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

  // Resumen de series colapsado — `SetPills` (misma lógica/estilo que History).
  const pillsBlock = (
    <View style={styles.collapsedPillsRow}>
      <SetPills sets={setsState} exConfig={exConfig} />
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

          {/* ProgressionLine (§4.1) — oculta si el entrenador fijó un objetivo.
              La fila entera abre la ficha (§6.3): regla, la última vez y hoy. */}
          {!hasCoachTarget && progression ? (
            <View style={styles.progBlock}>
              <Pressable
                style={({ pressed }) => [styles.progLine, pressed && styles.progLinePressed]}
                onPress={() => setProgSheetOpen(true)}
              >
                <Text style={[
                  styles.progDir,
                  progression.type === 'hold' && styles.progDirHold,
                  // La descarga no es un mantenimiento más: es una instrucción
                  // del bloque, y se lee antes si no comparte color con el gris
                  // de "sin novedad". Azul, nunca rojo (UI-MIGRATION §4.9).
                  progression.reason === 'deload' && styles.progDirDeload,
                ]}>
                  <Text style={styles.progArrow}>{PROG_ARROW[progression.type] ?? '→'}</Text>
                  {` ${t(`workout.progression.${progKey}`, '')}`}
                </Text>
                {progTarget ? <Text style={styles.progDetail}>{progTarget}</Text> : null}
                {progDelta ? (
                  <View style={styles.progDeltaPill}>
                    <Text style={styles.progDeltaText}>{progDelta}</Text>
                  </View>
                ) : null}
                {/* Por esfuerzo: el 1RM al final de la línea (§6.3). */}
                {e1rmShown != null ? (
                  <Text style={styles.progE1rm}>{`${t('workout.e1rmShort')} ${e1rmShown}`}</Text>
                ) : progression.effort && progression.noRpe ? (
                  <Text style={styles.progE1rm}>{t('workout.e1rmNoRpe')}</Text>
                ) : null}
              </Pressable>
            </View>
          ) : null}

          {/* Primera vez (§6.3) — misma anatomía, en `text`: qué buscar. */}
          {!hasCoachTarget && !progression && firstTime ? (
            <View style={styles.progBlock}>
              <Pressable
                style={({ pressed }) => [styles.progLine, pressed && styles.progLinePressed]}
                onPress={() => setProgSheetOpen(true)}
              >
                <Text style={[styles.progDir, styles.progDirFirst]}>
                  <Text style={styles.progArrow}>◇</Text>
                  {` ${t(FIRST_LABEL[firstTime.kind])}`}
                </Text>
                <Text style={styles.progDetail}>{firstTime.value}</Text>
              </Pressable>
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
              <View style={styles.trainerNoteRow}>
                <View style={styles.trainerNoteIcon}>
                  <RowIcon size={NOTE_ICON}>{ROW_ICON.text}</RowIcon>
                </View>
                <Text style={styles.trainerNoteText} numberOfLines={noteExpanded ? undefined : 1}>
                  {trainerName ? <Text style={styles.trainerNoteName}>{trainerName}: </Text> : null}
                  {trainerNote}
                </Text>
              </View>
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
              // El gris es el plan (§6.1, `planSet`): lo del entrenador (azul), si no
              // lo que la progresión pide hoy, si no lo de la última vez. ✓ rellena
              // con lo mismo que se ve, y `saveSession` usa la misma función.
              const plan = planSet({
                exConfig, def, chip: progression, lastSets: lastExercise?.sets, overrideEx, index: wi,
              });
              // `planSet` devuelve kg; la pantalla pinta en la unidad del usuario.
              const weightRef = plan.weight.value !== ''
                ? { ...plan.weight, value: String(toDisplay(plan.weight.value)) } : plan.weight;

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
                  prevWeightDisplay={weightRef.value}
                  prevReps={plan.reps.value}
                  prevTime={plan.time.value}
                  prevWeightSource={weightRef.source}
                  prevRepsSource={plan.reps.source}
                  prevTimeSource={plan.time.source}
                  prevRpe={plan.rpe.value}
                  prevRpeSource={plan.rpe.source}
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
                      // Lo mismo que se ve en gris (`plan`, en kg): el objetivo del
                      // entrenador, el plan o la última vez.
                      if (needsWeight && (set.weight === '' || set.weight == null) && plan.weight.value !== '') {
                        onFieldChange(realIndex, 'weight', plan.weight.value);
                      }
                      if (needsReps && (set.reps === '' || set.reps == null) && plan.reps.value !== '') {
                        onFieldChange(realIndex, 'reps', plan.reps.value);
                      }
                      if (needsTime && (set.time === '' || set.time == null) && plan.time.value !== '') {
                        onFieldChange(realIndex, 'time', plan.time.value);
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
                      <CloseIcon size={14} color={th.colors.mutedLight} />
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

      {/* Variante solo por hoy (P09-exercise-variants.md §5.1, maqueta §4A) */}
      {canChangeVariant && (
        <DragSheet
          visible={variantSheetOpen}
          onClose={() => setVariantSheetOpen(false)}
          title={t('variants.title')}
        >
          <AnimatedHeight>
            <View style={styles.variantSheet}>
              <View style={{ gap: spacing.sm }}>
                <Text style={styles.variantCaption}>{t('variants.todayTitle').toUpperCase()}</Text>
                {/* Sin desmarcar (hoy se cambia, no se deja en blanco) y con el
                    icono de volver en cada fila cambiada (QA P43). Igual que el
                    programa → sin cambio de hoy. */}
                <VariantPicker
                  def={def}
                  value={variant}
                  resetTo={programVariant}
                  allowDeselect={false}
                  onChange={(next) => setSessionVariant(
                    exConfig.exerciseId,
                    sameVariant(next, programVariant) ? undefined : next,
                  )}
                />
              </View>
              <Text style={styles.variantHint}>{t('variants.todayHint')}</Text>
            </View>
          </AnimatedHeight>
        </DragSheet>
      )}

      {/* La ficha de la recomendación (§6.3): regla, la última vez y hoy */}
      {(progression || firstTime) && (
        <DragSheet
          visible={progSheetOpen}
          onClose={() => setProgSheetOpen(false)}
          title={name}
        >
          <View style={styles.progSheet}>
            {progression?.reason !== 'deload' ? (
              <View style={styles.progSheetBlock}>
                <Text style={styles.progSheetCaption}>{t('workout.progSheet.rule').toUpperCase()}</Text>
                <Text style={styles.progSheetText}>{progressionRule(exConfig, def, t, weightLabel)}</Text>
              </View>
            ) : null}
            {progression && lastExercise?.sets?.length ? (
              <View style={styles.progSheetBlock}>
                <Text style={styles.progSheetCaption}>{t('workout.progSheet.lastTime').toUpperCase()}</Text>
                <SetPills sets={lastExercise.sets} exConfig={exConfig} neutral />
              </View>
            ) : null}
            <View style={styles.progSheetBlock}>
              <Text style={styles.progSheetCaption}>{t('workout.progSheet.today').toUpperCase()}</Text>
              <Text style={styles.progSheetText}>
                {progression
                  ? progression.why
                  : t(FIRST_TODAY[firstTime.kind], { what: firstTime.value })}
              </Text>
              {e1rmShown != null ? (
                <Text style={styles.progSheetText}>
                  {t(progression.e1rmSessions > 1 ? 'workout.progSheet.e1rmMany' : 'workout.progSheet.e1rmOne',
                    { count: progression.e1rmSessions, kg: `${e1rmShown} ${weightLabel}` })}
                </Text>
              ) : null}
            </View>
          </View>
        </DragSheet>
      )}

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
    ...textStyles.itemTitle,
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
  // ExtraBold y no Black: a 17 px la negra pesaba más que el número de serie,
  // que es el dato que hay que cazar de un vistazo entre repetición y
  // repetición. El número se queda en Black — el contraste es el que ordena.
  name: {
    ...textStyles.itemTitleQuiet,
    lineHeight: 22,
    color:      th.colors.text,
    flexShrink: 1,
  },
  nameVariant: { color: th.colors.mutedLight },
  nameVariantChanged: { color: th.colors.accent },
  variantSheet:   { gap: spacing.lg, paddingBottom: spacing.sm },
  variantCaption: { ...textStyles.caps, color: th.colors.accent },
  variantHint:    { ...textStyles.body, color: th.colors.mutedLight },
  keyInline: {
    color:      th.colors.accent,
    fontFamily: 'Inter_700Bold',
  },
  // Editable: subrayado punteado, que es lo que dice "esto se toca" sin meter
  // un botón en una tarjeta que no tiene ninguno.
  targetEditable: {
    color:                    th.colors.accent,
    textDecorationLine:       'underline',
    textDecorationStyle:      'dotted',
    textDecorationColor:      th.tint.accent50,
  },
  // "3 × 12-14 reps" — la prescripción, que es lo que se lee entre serie y serie.
  target: {
    ...textStyles.bodyStrong,
    color:       th.colors.mutedLight,
    marginTop:   3,
    fontVariant: ['tabular-nums'],
  },
  tempoInline: { color: th.colors.muted },
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
  progBlock: {
    paddingBottom: 12,
  },
  progLine: {
    flexDirection: 'row',
    alignItems:    'baseline',
    gap:           8,
    paddingTop:    2,
  },
  progDir: {
    ...textStyles.caps,
    color:         th.colors.accent,
    textTransform: 'uppercase',
    // La flecha arrastra su propio hueco a la izquierda (side bearing), asi que
    // el trazo arranca 2px dentro y la linea de motivo, que empieza a ras,
    // parecia mas pegada al borde. Se compensa tirando de la fila, no metiendo
    // sangria al motivo: asi las dos siguen colgando del mismo margen.
    marginLeft:    -2,
  },
  // Flecha algo mas grande que el label: a 11px se perdia contra el texto en
  // negra. Anidada, hereda el color del estado (acento / azul / gris).
  progArrow: {
    fontSize: 14,
  },
  progDirDeload: {
    color: th.colors.blue,
  },
  progDirHold: {
    color: th.colors.mutedLight,
  },
  // Primera vez: «◇ Busca tu peso», en `text` (ni acento ni gris: no hay nada
  // que comparar todavía).
  progDirFirst: {
    color: th.colors.text,
  },
  progLinePressed: {
    opacity: 0.7,
  },
  // El 1RM de Por esfuerzo, al final de la línea y apagado (§6.3).
  progE1rm: {
    ...textStyles.label,
    marginLeft:  'auto',
    flexShrink:  0,
    color:       th.colors.muted,
    fontVariant: ['tabular-nums'],
  },
  // La ficha de la recomendación: tres bloques, título pequeño + contenido.
  progSheet:        { gap: spacing.lg, paddingBottom: spacing.sm },
  progSheetBlock:   { gap: spacing.xs },
  progSheetCaption: { ...textStyles.caps, color: th.colors.muted },
  progSheetText:    { ...textStyles.body, color: th.colors.text },
  progDirCoach: {
    ...textStyles.caps,
    color:         th.colors.blue,
    textTransform: 'uppercase',
  },
  progDetail: {
    ...textStyles.labelStrong,
    flexShrink:  1,
    color:       th.colors.text,
    fontVariant: ['tabular-nums'],
  },
  // El salto va en pastilla gris, no en acento: dos amarillos en la misma línea
  // se disputan la mirada y el destino deja de ser lo primero que se lee.
  progDeltaPill: {
    backgroundColor: th.colors.surface2,
    borderRadius:    999,
    paddingHorizontal: 8,
    paddingVertical:   2,
  },
  progDeltaText: {
    ...textStyles.labelStrong,
    color:       th.colors.mutedLight,
    fontVariant: ['tabular-nums'],
  },

  // §4.2 SectionLabel — 10/700 uppercase, tracking 0.14em, muted2, mb 8.
  sectionLabel: { ...textStyles.caps, color: th.colors.muted, marginBottom: 8 },
  sectionLabelRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'baseline',
  },
  // Meta de descanso — no está en el spec, se conserva de la implementación
  // previa alineada a la derecha del SectionLabel.
  sectionLabelMeta: { ...textStyles.label, color: th.colors.muted, marginBottom: 8 },

  // §4.3 WarmupSection expandida — grid 26 | 1fr | 42, gap 6/10, mb 14.
  warmupSection: {
    marginBottom: 14,
  },
  warmupBanner: {
    ...textStyles.label,
    color:        th.colors.mutedLight,
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
    ...textStyles.labelStrong,
    width:       GRID.LABEL_W,
    color:       th.colors.muted,
    fontVariant: ['tabular-nums'],
  },
  warmupDetail: {
    ...textStyles.body,
    flex:        1,
    fontVariant: ['tabular-nums'],
  },
  warmupWeight: { fontFamily: 'Inter_800ExtraBold', color: th.colors.text },
  warmupTimes:  { fontFamily: 'Inter_500Medium',    color: th.colors.muted },
  warmupReps:   { fontFamily: 'Inter_700Bold',      color: th.colors.mutedLight },
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
  warmupCheckMark: { ...textStyles.body, color: th.colors.mutedLight },
  warmupCheckMarkDone: { fontFamily: 'Inter_900Black', color: th.colors.onAccent },

  // §4.4 WarmupSection colapsada — row, gap 8, padding 2 0 14.
  warmupCollapsed: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           8,
    paddingTop:    2,
    paddingBottom: 14,
  },
  warmupCollapsedTick: { ...textStyles.labelStrong, fontFamily: 'Inter_900Black', color: th.colors.accent },
  warmupCollapsedText: {
    ...textStyles.labelStrong,
    flexShrink:  1,
    color:       th.colors.muted,
    fontVariant: ['tabular-nums'],
  },
  warmupCollapsedChevron: {
    ...textStyles.body,
    marginLeft: 'auto',
    color:      th.colors.mutedLight,
  },

  // §4.5 SetsGrid — headers de columna (mismo estilo que SectionLabel, centrado).
  colHeader: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           10,
    marginBottom:  8,
  },
  colLabel: {
    ...textStyles.caps,
    flex:      1,
    color:     th.colors.muted,
    textAlign: 'center',
  },
  setList: {
    gap: 8,
  },

  // Dropset sub-block — label/enlace en rojo.
  dropBlock: {
    marginTop: 12,
  },
  dropBlockLabel: { ...textStyles.caps, color: th.colors.red, marginBottom: 8 },
  dropRowWrap: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.xs,
  },
  dropRemoveBtn: {
    padding: spacing.xs,
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
  addLinkText: { ...textStyles.button, color: th.colors.mutedLight },
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
  // El icono va en fila con el texto, que es el que se recorta/expande; el
  // `marginTop` lo centra en la primera línea.
  trainerNoteRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs },
  trainerNoteIcon: { marginTop: (lh(textStyles.label.fontSize) - NOTE_ICON) / 2 },
  trainerNoteText: {
    flex: 1,
    ...textStyles.label,
    color:      th.colors.text,
    lineHeight: lh(textStyles.label.fontSize),
  },
  trainerNoteName: {
    fontFamily: 'Inter_700Bold',
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
    ...textStyles.label,
    color:      th.colors.text,
    lineHeight: lh(textStyles.label.fontSize),
  },
  coachNoteName: {
    fontFamily: 'Inter_700Bold',
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

  // Resumen de series colapsado — el hueco alrededor de `SetPills`.
  collapsedPillsRow: {
    paddingHorizontal: 16,
    paddingTop:        12,
    paddingBottom:     14,
  },
});
