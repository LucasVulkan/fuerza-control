/**
 * ScrubDemo — una fila de serie (S1 · peso · reps) que se arrastra de verdad a
 * los lados, para probar «cómo apuntas» sin entrar a un entreno (O03 §11.3).
 *
 * Es el gesto de `SetRow`/`InputCell` sin su estado de entreno:
 *  · `ruler` (con regla): la casilla NO cambia durante el gesto. Sale la regla de
 *    siempre (`ScrubRuler`, hecha con `scrubRuler`/`scrubValueAt` de
 *    `utils/scrubScale`) con la burbuja del valor, y se guarda al soltar.
 *  · sin regla: la cifra cambia en la casilla mientras arrastras, con chevrones
 *    y el borde lima.
 *
 * No lleva el avance por los bordes ni el «cancelar» hacia arriba del Workout:
 * para probar el gesto basta. La unidad es la del usuario.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { View, PanResponder, StyleSheet } from 'react-native';
import Reanimated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';

import { Text } from '../../ui/Text';
import Chevron from '../../workout/Chevron';
import ScrubRuler, { SCRUB_MS, SCRUB_RAISE } from '../../workout/ScrubRuler';
import { GRID } from '../../workout/grid';
import { scrubRuler, scrubValueAt } from '../../../utils/scrubScale';
import { useWeightUnit } from '../../../hooks/useWeightUnit';
import { spacing, borders, textStyles } from '../../../theme';
import { useTheme, useThemedStyles } from '../../../useTheme';

const STEP_PX  = 8;    // sin regla: cuántos px es un paso
const H_THRESH = 12;   // lo que hay que moverse a un lado para que el gesto sea nuestro

const round2 = (n) => Math.round(n * 100) / 100;

// ── Una casilla ──────────────────────────────────────────────────────────────

function Cell({ value, field, step, useRuler, unit, rowWidth, measureRow, onStart, onMove, onEnd, onCommit }) {
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [local, setLocal]   = useState(String(value));
  const [dragging, setDrag] = useState(false);
  const glow = useSharedValue(0);

  const num      = useRef(Number(value));       // el número que lleva el gesto sin regla
  const swiping  = useRef(false);
  const lastDx   = useRef(0);
  const scrub    = useRef(null);                // { pending, ruler, value, initial, rowPageX }
  const cellRect = useRef({ x: 0, width: 0 });
  const live     = useRef({});

  useEffect(() => { live.current = { field, step, useRuler, unit, rowWidth, measureRow, onStart, onMove, onEnd, onCommit }; });
  // Si el padre cambia el valor (otra unidad, otra casilla) y no hay gesto, se sigue.
  useEffect(() => {
    if (swiping.current) return;
    setLocal(String(value));
    num.current = Number(value);
  }, [value]);
  useEffect(() => { glow.set(withTiming(dragging && !useRuler ? 1 : 0, { duration: dragging ? 80 : 220 })); }, [dragging, useRuler, glow]);
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
      if (!lv.useRuler) return;
      const sc = { pending: true, ruler: null, value: 0, initial: num.current, rowPageX: 0 };
      scrub.current = sc;
      const fingerPageX = gs.moveX || e.nativeEvent.pageX;
      lv.measureRow((_x, _y, w, _h, pageX) => {
        if (scrub.current !== sc) return;   // se soltó antes de que llegara la medida
        const l = live.current;
        const ruler = scrubRuler(l.field, sc.initial, fingerPageX - pageX, w || l.rowWidth, { unit: l.unit });
        sc.pending = false;
        sc.rowPageX = pageX;
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
        const v = scrubValueAt(sc.ruler, gs.moveX - sc.rowPageX);
        if (v !== sc.value) {
          sc.value = v;
          live.current.onMove({ value: v });
        }
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
    onPanResponderRelease: () => {
      if (scrub.current) { finish(); return; }
      swiping.current = false;
      setDrag(false);
      live.current.onCommit(num.current);
    },
    onPanResponderTerminate: () => {
      if (scrub.current) { finish(); return; }
      swiping.current = false;
      setDrag(false);
      live.current.onCommit(num.current);
    },
  })).current;

  return (
    <View
      style={styles.cellWrap}
      onLayout={(e) => { const { x, width } = e.nativeEvent.layout; cellRect.current = { x, width }; }}
      {...pan.panHandlers}
    >
      {/* eslint-enable react-hooks/refs */}
      <View style={styles.cell}>
        <Text style={styles.value} numberOfLines={1}>{local}</Text>
      </View>
      {!useRuler && (
        <>
          <Reanimated.View pointerEvents="none" style={[styles.glow, glowStyle]} />
          <View pointerEvents="none" style={styles.arrows}>
            <Chevron direction="left"  size={9} color={th.tint.accent50} />
            <Chevron direction="right" size={9} color={th.tint.accent50} />
          </View>
        </>
      )}
    </View>
  );
}

// ── La fila ──────────────────────────────────────────────────────────────────

export default function ScrubDemo({ ruler: useRuler }) {
  const { t } = useTranslation();
  const styles = useThemedStyles(makeStyles);
  const { unit, label, scrollStep } = useWeightUnit();

  const [weight, setWeight] = useState(unit === 'lb' ? 135 : 60);
  const [reps, setReps]     = useState(8);
  const [rowWidth, setRowWidth] = useState(0);
  const rowRef = useRef(null);
  const measureRow = useCallback((cb) => rowRef.current?.measure(cb), []);

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

  return (
    <View style={styles.demo}>
      <View
        ref={rowRef}
        collapsable={false}
        style={[styles.row, live && styles.rowScrubbing]}
        onLayout={(e) => setRowWidth(e.nativeEvent.layout.width)}
      >
        <Text style={styles.setNum}>S1</Text>
        <Cell
          value={weight} field="weight" step={scrollStep} unit={unit} useRuler={useRuler}
          rowWidth={rowWidth} measureRow={measureRow}
          onStart={onStart} onMove={onMove} onEnd={onEnd} onCommit={setWeight}
        />
        <Cell
          value={reps} field="reps" step={1} unit={unit} useRuler={useRuler}
          rowWidth={rowWidth} measureRow={measureRow}
          onStart={onStart} onMove={onMove} onEnd={onEnd} onCommit={setReps}
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
          />
        ) : null}
      </View>
      <View style={styles.unitsRow}>
        <View style={styles.setNumGap} />
        <Text style={styles.unitTxt}>{label.toUpperCase()}</Text>
        <Text style={styles.unitTxt}>{t('workout.reps').toUpperCase()}</Text>
      </View>
      <Text style={styles.hint}>{t('onboardingFlow.learn.input.hint')}</Text>
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

  unitsRow: { flexDirection: 'row', gap: GRID.GAP, marginTop: spacing.sm },
  unitTxt:  { ...textStyles.caps, flex: 1, textAlign: 'center', color: th.colors.mutedLight },
  hint: { ...textStyles.bodyStrong, color: th.colors.accent, textAlign: 'center', marginTop: spacing.lg },
});
