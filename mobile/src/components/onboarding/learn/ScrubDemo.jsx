/**
 * ScrubDemo — una fila de serie (S1 · peso · reps) que se arrastra de verdad a
 * los lados, para probar «cómo apuntas» sin entrar a un entreno (O03 §11.3).
 *
 * Es el gesto de `SetRow`/`InputCell` sin su estado de entreno:
 *  · `ruler` (con regla): la casilla NO cambia durante el gesto. Sale la regla de
 *    siempre (`ScrubRuler`) con la marca y la burbuja quietas sobre la casilla, y
 *    es la regla la que corre (`scrubTape`/`scrubTapeAt`); se guarda al soltar.
 *  · sin regla: la cifra cambia en la casilla mientras arrastras, con chevrones,
 *    el borde lima y la burbuja con la diferencia encima.
 *
 * El dedo fantasma (`ghost`) enseña el gesto en bucle —el peso y luego las reps—
 * hasta que se toca la fila; si en 5 s no se ha probado, vuelve. Mueve la demo con
 * las mismas piezas que el dedo de verdad. Con «reducir movimiento», no sale.
 *
 * No lleva el «cancelar» hacia arriba del Workout: para probar el gesto basta.
 * La unidad es la del usuario. `onTried`: el usuario cambió una cifra.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, PanResponder, StyleSheet } from 'react-native';
import Reanimated, { useSharedValue, useAnimatedStyle, withTiming, Easing, useReducedMotion } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';

import { Text } from '../../ui/Text';
import Chevron from '../../workout/Chevron';
import ScrubRuler, { SCRUB_MS, SCRUB_RAISE } from '../../workout/ScrubRuler';
import { GRID } from '../../workout/grid';
import { Finger } from '../WelcomeArt';
import {
  scrubRuler, scrubValueAt, scrubTape, scrubTapeAt, scrubTapeWindow, scrubDiffText,
  SCRUB_TAPE, SCRUB_TAPE_DIR, SCRUB_TAPE_SMOOTH_MS,
} from '../../../utils/scrubScale';
import { useWeightUnit } from '../../../hooks/useWeightUnit';
import { spacing, borders, textStyles } from '../../../theme';
import { useTheme, useThemedStyles } from '../../../useTheme';

const STEP_PX  = 8;    // sin regla: cuántos px es un paso
const H_THRESH = 12;   // lo que hay que moverse a un lado para que el gesto sea nuestro

const TAPE_SMOOTH = { duration: SCRUB_TAPE_SMOOTH_MS, easing: Easing.out(Easing.quad) };
const smoothTo = (pos) => (SCRUB_TAPE_SMOOTH_MS > 0 ? withTiming(pos, TAPE_SMOOTH) : pos);

// El dedo fantasma: cuántos pasos sube cada casilla y cuánto dura cada parte.
const GHOST_STEPS = { weight: 5, reps: 2 };   // 60 → 62,5 kg · 8 → 10 reps
const GHOST_IN    = 380;    // aparece y se posa
const GHOST_PRESS = 140;
const GHOST_STEP  = 200;    // cada paso del arrastre
const GHOST_HOLD  = 350;    // quieto en el valor nuevo antes de soltar
const GHOST_GAP   = 500;    // entre el peso y las reps
const GHOST_LOOP  = 1000;   // al final de la vuelta, antes de volver a empezar
const GHOST_BACK  = 18;     // empieza un poco antes del centro: el recorrido cabe en la casilla
const GHOST_IDLE  = 5000;   // sin probarlo, vuelve tras tocar la fila y no cambiar nada
const PRESS = 0.9;

const round2 = (n) => Math.round(n * 100) / 100;

// ── Una casilla ──────────────────────────────────────────────────────────────

function Cell({ value, field, step, useRuler, unit, rowWidth, measureRow, tapePos, ghost, onLayoutCell, onStart, onMove, onEnd, onCommit }) {
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [local, setLocal]   = useState(String(value));
  const [dragging, setDrag] = useState(false);
  const [swipeFrom, setSwipeFrom] = useState(null);   // sin regla: el valor al empezar, para la burbuja
  const glow = useSharedValue(0);

  const num      = useRef(Number(value));       // el número que lleva el gesto sin regla
  const swiping  = useRef(false);
  const lastDx   = useRef(0);
  const scrub    = useRef(null);                // { pending, ruler, value, initial, rowPageX, fingerX0 }
  const cellRect = useRef({ x: 0, width: 0 });
  const live     = useRef({});

  useEffect(() => { live.current = { field, step, useRuler, unit, rowWidth, measureRow, tapePos, onStart, onMove, onEnd, onCommit }; });
  // Si el padre cambia el valor (otra unidad, otra casilla) y no hay gesto, se sigue.
  useEffect(() => {
    if (swiping.current) return;
    setLocal(String(value));
    num.current = Number(value);
  }, [value]);
  const swipeOn = (dragging && !useRuler) || !!ghost?.swiping;
  useEffect(() => { glow.set(withTiming(swipeOn ? 1 : 0, { duration: swipeOn ? 80 : 220 })); }, [swipeOn, glow]);
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.get() }));

  const finish = useCallback(() => {
    const sc = scrub.current;
    scrub.current = null;
    swiping.current = false;
    setDrag(false);
    if (!sc || sc.pending) return;
    live.current.onEnd();
    if (sc.value === sc.initial) return;
    num.current = sc.value;
    setLocal(String(sc.value));
    live.current.onCommit(sc.value);
  }, []);

  const endSwipe = useCallback(() => {
    swiping.current = false;
    setDrag(false);
    setSwipeFrom(null);
    live.current.onCommit(num.current);
  }, []);

  // El gesto lee `live`, `scrub`… al tocar, no al pintar: el lint no lo distingue
  // (mismo caso que `SessionTabsCard` y el `PanResponder` de `SetRow`).
  /* eslint-disable react-hooks/refs */
  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder:        () => false,
    onStartShouldSetPanResponderCapture: () => false,
    onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dx) > H_THRESH && Math.abs(gs.dx) > Math.abs(gs.dy) * 2,
    // Con la regla fuera, el scroll de la pantalla no puede robar el gesto.
    onPanResponderTerminationRequest: () => !scrub.current,
    onPanResponderGrant: (e, gs) => {
      swiping.current = true;
      lastDx.current = 0;
      setDrag(true);
      const lv = live.current;
      if (!lv.useRuler) { setSwipeFrom(num.current); return; }
      const sc = { pending: true, ruler: null, value: 0, initial: num.current, rowPageX: 0, fingerX0: 0 };
      scrub.current = sc;
      const fingerPageX = gs.moveX || e.nativeEvent.pageX;
      lv.measureRow((_x, _y, w, _h, pageX) => {
        if (scrub.current !== sc) return;   // se soltó antes de que llegara la medida
        const l = live.current;
        const rowW = w || l.rowWidth;
        // Regla que corre: la marca, fija sobre el centro de la casilla (como SetRow).
        const ruler = SCRUB_TAPE
          ? scrubTape(l.field, sc.initial, cellRect.current.x + cellRect.current.width / 2, rowW, { unit: l.unit })
          : scrubRuler(l.field, sc.initial, fingerPageX - pageX, rowW, { unit: l.unit });
        if (SCRUB_TAPE) l.tapePos.value = ruler.start;
        sc.pending = false;
        sc.rowPageX = pageX;
        sc.fingerX0 = fingerPageX - pageX;
        sc.ruler = ruler;
        sc.value = ruler.start;
        l.onStart({
          field: l.field, ruler, value: ruler.start, cell: { ...cellRect.current },
          initial: sc.initial, hasValue: true, prevValue: null, prevSource: 'last',
        });
      });
    },
    onPanResponderMove: (_, gs) => {
      const sc = scrub.current;
      if (sc) {
        if (sc.pending) return;
        const patch = {};
        let v;
        if (SCRUB_TAPE) {
          const at = scrubTapeAt(sc.ruler, gs.moveX - sc.rowPageX - sc.fingerX0, sc.value);
          live.current.tapePos.value = smoothTo(at.pos);
          if (at.rewindow) { sc.ruler = scrubTapeWindow(sc.ruler, at.pos); patch.ruler = sc.ruler; }
          v = at.value;
        } else {
          v = scrubValueAt(sc.ruler, gs.moveX - sc.rowPageX);
        }
        if (v !== sc.value) { sc.value = v; patch.value = v; }
        if (Object.keys(patch).length) live.current.onMove(patch);
        return;
      }
      const delta = Math.trunc(gs.dx / STEP_PX) - Math.trunc(lastDx.current / STEP_PX);
      if (delta !== 0) {
        num.current = Math.max(0, round2(num.current + delta * live.current.step));
        setLocal(String(num.current));
        lastDx.current = gs.dx;
        Haptics.selectionAsync().catch(() => {});
      }
    },
    onPanResponderRelease: () => { if (scrub.current) finish(); else endSwipe(); },
    onPanResponderTerminate: () => { if (scrub.current) finish(); else endSwipe(); },
  })).current;

  // Lo que enseña la casilla: la cifra del dedo fantasma mientras arrastra sin regla.
  const shown = ghost?.swiping ? String(ghost.value) : local;
  const from  = ghost?.swiping ? ghost.from : swipeFrom;
  const diff  = from != null ? (scrubDiffText(parseFloat(shown) || 0, from) || '0') : null;
  const dot   = diff ? diff.indexOf('.') : -1;
  const pivot = field === 'weight';   // en peso la cifra de las unidades no se mueve (como SetRow)

  return (
    <View
      style={styles.cellWrap}
      onLayout={(e) => {
        const { x, width } = e.nativeEvent.layout;
        cellRect.current = { x, width };
        onLayoutCell(field, { x, width });
      }}
      {...pan.panHandlers}
    >
      {/* eslint-enable react-hooks/refs */}
      <View style={styles.cell}>
        <Text style={styles.value} numberOfLines={1}>{shown}</Text>
      </View>
      {!useRuler && (
        <>
          <Reanimated.View pointerEvents="none" style={[styles.glow, glowStyle]} />
          <View pointerEvents="none" style={styles.arrows}>
            <Chevron direction="left"  size={9} color={th.tint.accent50} />
            <Chevron direction="right" size={9} color={th.tint.accent50} />
          </View>
          {diff != null && (
            <View style={styles.swipeBubble} pointerEvents="none">
              {pivot ? (
                <>
                  <Text allowFontScaling={false} numberOfLines={1} style={[styles.swipeBubbleText, styles.swipeBubbleInt]}>
                    {dot < 0 ? diff : diff.slice(0, dot)}
                  </Text>
                  <Text allowFontScaling={false} numberOfLines={1} style={[styles.swipeBubbleText, styles.swipeBubbleDec]}>
                    {dot < 0 ? '' : diff.slice(dot)}
                  </Text>
                </>
              ) : (
                <Text allowFontScaling={false} numberOfLines={1} style={styles.swipeBubbleText}>{diff}</Text>
              )}
            </View>
          )}
        </>
      )}
    </View>
  );
}

// ── El dedo fantasma ─────────────────────────────────────────────────────────

/**
 * Una vuelta tras otra mientras `active`: en cada casilla el dedo se posa, aprieta,
 * arrastra GHOST_STEPS pasos hacia donde sube, espera y suelta. Al final de la
 * vuelta las cifras vuelven a las de partida. Devuelve el dedo y lo que tiene que
 * pintar la demo: la regla (`live`) o la casilla que cambia (`cell`).
 */
function useGhost({ active, useRuler, geo, unit, scrollStep, start, tapePos, setLive, commit }) {
  const fx = useSharedValue(0);
  const fy = useSharedValue(0);
  const fo = useSharedValue(0);
  const fs = useSharedValue(1);
  const [cell, setCell] = useState(null);   // sin regla: { field, value, from, swiping }
  const [loop, setLoop] = useState(0);

  useEffect(() => {
    if (!active || !geo) return undefined;
    const timers = [];
    const at = (ms, fn) => timers.push(setTimeout(fn, ms));
    const midY = geo.rowY + GRID.CELL_H / 2;
    let t = 0;

    for (const field of ['weight', 'reps']) {
      const box = geo.cells[field];
      if (!box) return undefined;
      const from  = start[field];
      const stepV = field === 'weight' ? scrollStep : 1;
      const n     = GHOST_STEPS[field];
      const cx    = box.x + box.width / 2;
      const ruler = useRuler && SCRUB_TAPE ? scrubTape(field, from, cx, geo.rowWidth, { unit }) : null;
      // Lo que se mueve el dedo por paso: lo de la regla, o lo del gesto sin regla.
      const px = ruler ? ruler.px * SCRUB_TAPE_DIR : STEP_PX;
      const x0 = geo.rowX + cx - Math.sign(px) * GHOST_BACK;

      at(t, () => {
        fx.set(x0 + 10); fy.set(midY + 20); fs.set(1);
        fo.set(withTiming(1, { duration: 200 }));
        fx.set(withTiming(x0, { duration: GHOST_IN, easing: Easing.out(Easing.cubic) }));
        fy.set(withTiming(midY, { duration: GHOST_IN, easing: Easing.out(Easing.cubic) }));
      });
      t += GHOST_IN;
      at(t, () => {
        fs.set(withTiming(PRESS, { duration: GHOST_PRESS }));
        if (ruler) {
          tapePos.value = ruler.start;
          setLive({ id: `ghost-${field}`, field, ruler, value: from, cell: box, initial: from, hasValue: true, prevValue: null, prevSource: 'last', closing: false });
        } else {
          setCell({ field, value: from, from, swiping: true });
        }
      });
      t += GHOST_PRESS + (ruler ? SCRUB_MS : 0);
      for (let i = 1; i <= n; i += 1) {
        const v = round2(from + i * stepV);
        at(t + i * GHOST_STEP, () => {
          fx.set(withTiming(x0 + i * Math.abs(px) * Math.sign(px), { duration: GHOST_STEP, easing: Easing.linear }));
          if (ruler) { tapePos.value = smoothTo(v); setLive((l) => l && { ...l, value: v }); }
          else setCell((c) => c && { ...c, value: v });
        });
      }
      t += (n + 1) * GHOST_STEP + GHOST_HOLD;
      const to = round2(from + n * stepV);
      at(t, () => {
        fs.set(withTiming(1, { duration: GHOST_PRESS }));
        fo.set(withTiming(0, { duration: 300 }));
        if (ruler) setLive((l) => l && { ...l, closing: true });
        else setCell(null);
        commit(field, to);
      });
      if (ruler) at(t + SCRUB_MS + 30, () => setLive(null));
      t += 300 + GHOST_GAP;
    }
    at(t + GHOST_LOOP, () => {
      commit('weight', start.weight);
      commit('reps', start.reps);
      setLoop((k) => k + 1);
    });

    return () => {
      timers.forEach(clearTimeout);
      fo.set(withTiming(0, { duration: 150 }));
      setCell(null);
      setLive((l) => (l && String(l.id).startsWith('ghost') ? null : l));
    };
  }, [active, useRuler, geo, unit, scrollStep, start, tapePos, setLive, commit, loop, fx, fy, fo, fs]);

  return { cell, finger: { x: fx, y: fy, o: fo, s: fs } };
}

// ── La fila ──────────────────────────────────────────────────────────────────

export default function ScrubDemo({ ruler: useRuler, ghost = false, onTried }) {
  const { t } = useTranslation();
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  const reduced = useReducedMotion();
  const { unit, label, scrollStep } = useWeightUnit();

  const [start] = useState(() => ({ weight: unit === 'lb' ? 135 : 60, reps: 8 }));
  const [weight, setWeight] = useState(start.weight);
  const [reps, setReps]     = useState(start.reps);
  const [rowWidth, setRowWidth] = useState(0);
  const [rowPos, setRowPos]     = useState(null);   // { x, y } de la fila dentro de la tarjeta
  const [cells, setCells]       = useState({});
  const rowRef = useRef(null);
  const measureRow = useCallback((cb) => rowRef.current?.measure(cb), []);
  const tapePos = useSharedValue(0);

  // { id, field, ruler, value, cell, initial, hasValue, prevValue, prevSource, closing }
  const [live, setLive] = useState(null);
  const liveId = useRef(0);
  const closeTimer = useRef(null);
  useEffect(() => () => clearTimeout(closeTimer.current), []);

  const onStart = useCallback((info) => {
    clearTimeout(closeTimer.current);
    liveId.current += 1;
    setLive({ id: liveId.current, ...info, closing: false });
  }, []);
  const onMove = useCallback((patch) => setLive((s) => (s && !s.closing ? { ...s, ...patch } : s)), []);
  const onEnd = useCallback(() => {
    setLive((s) => (s ? { ...s, closing: true } : s));
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setLive(null), SCRUB_MS + 30);
  }, []);
  const onLayoutCell = useCallback((field, box) => {
    setCells((c) => (c[field]?.x === box.x && c[field]?.width === box.width ? c : { ...c, [field]: box }));
  }, []);

  // El fantasma se va al tocar la fila y vuelve si en GHOST_IDLE no se ha probado.
  // Al cambiar de opción, vuelve a enseñar el gesto (cambia cómo responde la fila).
  // Por opción: probar una no da por probada la otra.
  const mode = useRuler ? 'ruler' : 'swipe';
  const [touched, setTouched] = useState({});
  const [tried, setTried]     = useState({});
  const idle = useRef(null);
  useEffect(() => () => clearTimeout(idle.current), []);
  const touchStart = () => { clearTimeout(idle.current); setTouched((o) => ({ ...o, [mode]: true })); };
  const touchEnd = () => {
    clearTimeout(idle.current);
    idle.current = setTimeout(() => setTouched((o) => ({ ...o, [mode]: false })), GHOST_IDLE);
  };
  const userCommit = (field, set) => (v) => {
    set(v);
    if (v !== (field === 'weight' ? weight : reps)) { setTried((o) => ({ ...o, [mode]: true })); onTried?.(mode); }
  };

  const ghostCommit = useCallback((field, v) => (field === 'weight' ? setWeight : setReps)(v), []);
  const geo = useMemo(
    () => (rowWidth > 0 && rowPos && cells.weight && cells.reps ? { rowWidth, rowX: rowPos.x, rowY: rowPos.y, cells } : null),
    [rowWidth, rowPos, cells],
  );
  const g = useGhost({
    active: ghost && !reduced && !touched[mode] && !tried[mode], useRuler, geo, unit, scrollStep, start, tapePos, setLive, commit: ghostCommit,
  });
  const ghostOf = (field) => (g.cell?.field === field ? g.cell : null);

  return (
    <View style={styles.demo}>
      <View
        ref={rowRef}
        collapsable={false}
        style={[styles.row, live && styles.rowScrubbing]}
        onLayout={(e) => {
          const { x, y, width } = e.nativeEvent.layout;
          setRowWidth(width);
          setRowPos((p) => (p?.x === x && p?.y === y ? p : { x, y }));
        }}
        onTouchStart={touchStart}
        onTouchEnd={touchEnd}
      >
        <Text style={styles.setNum}>S1</Text>
        <Cell
          value={weight} field="weight" step={scrollStep} unit={unit} useRuler={useRuler}
          rowWidth={rowWidth} measureRow={measureRow} tapePos={tapePos} ghost={ghostOf('weight')} onLayoutCell={onLayoutCell}
          onStart={onStart} onMove={onMove} onEnd={onEnd} onCommit={userCommit('weight', setWeight)}
        />
        <Cell
          value={reps} field="reps" step={1} unit={unit} useRuler={useRuler}
          rowWidth={rowWidth} measureRow={measureRow} tapePos={tapePos} ghost={ghostOf('reps')} onLayoutCell={onLayoutCell}
          onStart={onStart} onMove={onMove} onEnd={onEnd} onCommit={userCommit('reps', setReps)}
        />
        {live && rowWidth > 0 ? (
          <ScrubRuler
            key={live.id}
            field={live.field}
            ruler={live.ruler}
            value={live.value}
            cell={live.cell}
            rowWidth={rowWidth}
            closing={live.closing}
            initial={live.initial}
            hasValue={live.hasValue}
            prevValue={live.prevValue}
            prevSource={live.prevSource}
            tapePos={SCRUB_TAPE ? tapePos : null}
          />
        ) : null}
      </View>
      <View style={styles.unitsRow}>
        <View style={styles.setNumGap} />
        <Text style={styles.unitTxt}>{label.toUpperCase()}</Text>
        <Text style={styles.unitTxt}>{t('workout.reps').toUpperCase()}</Text>
      </View>
      {ghost && !reduced && <Finger {...g.finger} color={th.colors.text} />}
    </View>
  );
}

const makeStyles = (th) => StyleSheet.create({
  // Sitio de sobra arriba: la burbuja de la regla asoma por encima de la fila.
  demo: {
    backgroundColor: th.colors.surface,
    borderRadius:    th.radius.lg,
    paddingTop:      spacing.xxl + spacing.xxl + SCRUB_RAISE,
    paddingBottom:   spacing.lg,
    paddingHorizontal: spacing.md + 4,
    marginBottom:    spacing.lg,
  },
  row:          { flexDirection: 'row', alignItems: 'center', gap: GRID.GAP },
  rowScrubbing: { zIndex: 20 },
  setNum: { ...textStyles.labelStrong, width: GRID.LABEL_W, color: th.colors.mutedLight, fontVariant: ['tabular-nums'] },
  setNumGap: { width: GRID.LABEL_W },

  cellWrap: { flex: 1 },
  cell: {
    height:            GRID.CELL_H,
    backgroundColor:   th.colors.bg,
    borderRadius:      GRID.RADIUS,
    borderWidth:       0.5,
    borderColor:       th.tint.accent50,
    alignItems:        'center',
    justifyContent:    'center',
    paddingHorizontal: spacing.sm,
  },
  value: {
    ...textStyles.itemTitle,
    fontFamily:  'Inter_800ExtraBold',
    color:       th.colors.text,
    textAlign:   'center',
    fontVariant: ['tabular-nums'],
  },
  glow: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    borderWidth:     borders.thin,
    borderColor:     th.colors.accent,
    borderRadius:    GRID.RADIUS,
    backgroundColor: th.tint.accent10,
  },
  arrows: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 5,
  },
  // La burbuja de la diferencia (sin regla), la de `SetRow`.
  swipeBubble: {
    position:          'absolute',
    bottom:            GRID.CELL_H + 6,
    alignSelf:         'center',
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: spacing.sm,
    height:            28,
    justifyContent:    'center',
    backgroundColor:   th.colors.accent,
    borderRadius:      9,
    zIndex:            10,
  },
  swipeBubbleText: {
    ...textStyles.itemTitle,
    lineHeight:  20,
    color:       th.colors.onAccent,
    fontVariant: ['tabular-nums'],
  },
  swipeBubbleInt: { width: Math.ceil(2.6 * textStyles.itemTitle.fontSize) + 4, textAlign: 'right' },
  swipeBubbleDec: { width: Math.ceil(0.96 * textStyles.itemTitle.fontSize) + 4, textAlign: 'left' },

  unitsRow: { flexDirection: 'row', gap: GRID.GAP, marginTop: spacing.sm },
  unitTxt:  { ...textStyles.caps, flex: 1, textAlign: 'center', color: th.colors.mutedLight },
});
