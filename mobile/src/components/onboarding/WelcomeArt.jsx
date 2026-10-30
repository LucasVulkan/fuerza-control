/**
 * La ilustración del lima de la bienvenida (O04-07, variante A de
 * docs/mockups/onboarding-bienvenida-2.html): la tarjeta de un ejercicio a medio
 * registrar con dos avisos flotando. Vistas sencillas, no los componentes de
 * Workout, salvo la regla (`ScrubRuler`), que es la de verdad. Es decorativa:
 * nada de esto se anuncia.
 *
 * Cuenta una serie entera: la S1 llegó a 12 reps, así que toca subir; en la S2
 * un dedo se posa en el peso, sale la regla, la arrastra de 45 a 47,5, suelta y
 * pulsa el check; luego toca «S3», que copia en ella la serie anterior.
 *
 * Se compone a un tamaño fijo (el de la maqueta) y se escala para caber en el
 * hueco que deja la hoja.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import Reanimated, {
  useSharedValue, useAnimatedStyle, withTiming, withDelay, Easing, useReducedMotion, interpolateColor,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { spacing, textStyles, withOpacity } from '../../theme';
import { useThemedStyles } from '../../useTheme';
import { Text, MAX_FONT_SCALE } from '../ui/Text';
import { CheckIcon } from '../ui/EditorIcons';
import ScrubRuler, { SCRUB_MS } from '../workout/ScrubRuler';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';
import { scrubRuler, scrubXOf } from '../../utils/scrubScale';

const W = 375;               // ancho de la maqueta
const H = 340;               // alto de la composición (con lo que asoma el PR)
const STEP_MS = 90;
const RISE_MS = 600;
const RISE_Y  = 26;
const TICK_MS = 350;
const CHECK_W = 40;   // el botón del check, el último de la fila
// S3 y S4 llevan lo de la semana pasada (45); al tocar «S3» copia la S2 (47,5 × 10).
const ROWS = [['S1', 45, '12', 'done'], ['S2', 45, '10', 'tick'], ['S3', 45, '10', 'copy'], ['S4', 45, '9', 'off']];
const LABEL_W = 26;   // la columna «S1»

// La regla de la S2: cuándo sale, cada cuánto sube un paso, cuánto se queda en el
// valor nuevo y cuándo se marca el check tras cerrarse.
const RULER_AT   = 1300;
const RULER_STEP = 170;
const RULER_HOLD = 450;
const TICK_AFTER = 600;   // lo que tarda el dedo en ir de la casilla al check
const COPY_AFTER = 1100;  // del check a tocar «S3»
const ROW_GAP = spacing.sm2;   // el `gap` entre filas (`bd`)
const FROM = 45;
const TO   = 47.5;

// Muy difusa: separa las piezas del lima sin ensuciarlo.
const SHADOW = '0px 18px 44px rgba(0, 0, 0, 0.38)';

const easeOut = Easing.out(Easing.cubic);

// El dedo: el índice estirado y los nudillos de los otros tres, sin pulgar ni palma,
// en contorno y fundido a transparente por debajo. Tamaño de un dedo de verdad.
// La yema (lo que toca) está en (18, 9) del viewBox 76 × 100.
const FINGER_K = 1.8;
const FINGER_W = 76 * FINGER_K;
const FINGER_H = 100 * FINGER_K;
const TIP = { x: 18 * FINGER_K, y: 9 * FINGER_K };
const FINGER_OUTLINE = 'M7 100 C7 72 8.5 42 8.5 16 A9.5 9.5 0 0 1 27.5 16 C27.5 30 28 40 28.5 46 C30 36 46 36 47 46 C49 40 62 42 62 51 C64 47 73 51 72 60 C72 75 70 90 70 100';
const FINGER_GAPS    = 'M28.5 46 Q29.5 55 29 63 M47 46 Q47.5 55 47 64 M62 51 Q62 58 61.5 65';
const FINGER_NAIL    = 'M13.5 19 Q13 12 18 11.5 Q23 12 22.5 19 Q18 20.5 13.5 19 Z';
const FINGER_CREASE  = 'M12.5 38 Q18 40 23.5 38 M13 41.5 Q18 43 23 41.5';
const FINGER_IN = 320;   // el dedo aparece antes de que salga la regla
const PRESS     = 0.9;   // escala al apretar

/** El dedo: trazo claro y relleno oscuro translúcido, los dos fundidos hacia abajo. */
function Finger({ x, y, o, s, color }) {
  const anim = useAnimatedStyle(() => ({
    opacity:   o.get(),
    transform: [{ translateX: x.get() - TIP.x }, { translateY: y.get() - TIP.y }, { scale: s.get() }],
  }));
  return (
    <Reanimated.View style={[fingerStyle, anim]} pointerEvents="none">
      <Svg width={FINGER_W} height={FINGER_H} viewBox="0 0 76 100" fill="none">
        <Defs>
          <LinearGradient id="fingerStroke" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0.45" stopColor={color} stopOpacity={1} />
            <Stop offset="0.88" stopColor={color} stopOpacity={0} />
          </LinearGradient>
          <LinearGradient id="fingerFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0.45" stopColor="#000" stopOpacity={0.4} />
            <Stop offset="0.88" stopColor="#000" stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Path d={FINGER_OUTLINE} fill="url(#fingerFill)" stroke="url(#fingerStroke)" strokeWidth={1.6} strokeLinejoin="round" />
        <Path d={FINGER_GAPS} stroke="url(#fingerStroke)" strokeWidth={1.2} strokeLinecap="round" />
        <Path d={FINGER_NAIL} stroke="url(#fingerStroke)" strokeWidth={1.1} strokeLinejoin="round" opacity={0.8} />
        <Path d={FINGER_CREASE} stroke="url(#fingerStroke)" strokeWidth={1} strokeLinecap="round" opacity={0.55} />
      </Svg>
    </Reanimated.View>
  );
}
// La escala gira sobre la yema, no sobre el centro del dibujo.
const fingerStyle = { position: 'absolute', left: 0, top: 0, width: FINGER_W, height: FINGER_H, zIndex: 20, transformOrigin: [TIP.x, TIP.y, 0] };

/** Una pieza que sube y aparece en su turno; el giro es suyo y fijo. */
function Piece({ index, rotate, style, children }) {
  const reduced = useReducedMotion();
  const p = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (!reduced) p.set(withDelay(250 + index * STEP_MS, withTiming(1, { duration: RISE_MS, easing: easeOut })));
  }, [reduced, index, p]);
  const anim = useAnimatedStyle(() => ({
    opacity:   p.get(),
    transform: [{ translateY: (1 - p.get()) * RISE_Y }, { rotate }],
  }));
  return <Reanimated.View style={[style, anim]}>{children}</Reanimated.View>;
}

/**
 * La S2: sale la regla sobre el peso, sube de 45 a 47,5 paso a paso, se cierra y
 * se marca la serie. Devuelve el peso que enseña la casilla, la regla en curso y
 * el progreso del check (0 → 1).
 */
function useScrubDemo(active, k, onCopy) {
  const reduced = useReducedMotion();
  const [weight, setWeight] = useState(active && reduced ? TO : FROM);
  const [live, setLive]     = useState(null);   // { ruler, value, closing }
  const [geo, setGeo]       = useState(null);   // { rowWidth, rowHeight, cell: { x, width } }
  const fx = useSharedValue(0);
  const fy = useSharedValue(0);
  const fo = useSharedValue(0);
  const fs = useSharedValue(1);

  useEffect(() => {
    if (!active || reduced || !geo) return undefined;
    const startX = geo.cell.x + geo.cell.width / 2;
    const midY   = geo.rowHeight / 2;
    const ruler  = scrubRuler('weight', FROM, startX, geo.rowWidth, { unit: 'kg' });
    const steps = [];
    for (let v = FROM + ruler.step; v <= TO + 1e-9; v += ruler.step) steps.push(Math.round(v * 100) / 100);
    const closeAt = RULER_AT + SCRUB_MS + steps.length * RULER_STEP + RULER_HOLD;
    const tickAt  = closeAt + SCRUB_MS + TICK_AFTER;
    const at = (ms, fn) => setTimeout(fn, ms);

    // El dedo llega un poco desplazado, se posa en el peso y aprieta: sale la regla.
    fx.set(startX + 14); fy.set(midY + 22); fs.set(1);
    const timers = [
      at(RULER_AT - FINGER_IN, () => {
        fo.set(withTiming(1, { duration: 200 }));
        fx.set(withTiming(startX, { duration: FINGER_IN, easing: easeOut }));
        fy.set(withTiming(midY, { duration: FINGER_IN, easing: easeOut }));
      }),
      at(RULER_AT, () => { fs.set(withTiming(PRESS, { duration: 120 })); setLive({ ruler, value: FROM, closing: false }); }),
    ];
    // Arrastra: en cada paso cambia la regla y el dedo va a la x de ese valor.
    steps.forEach((v, i) => timers.push(at(RULER_AT + SCRUB_MS + (i + 1) * RULER_STEP, () => {
      setLive((l) => l && { ...l, value: v });
      fx.set(withTiming(scrubXOf(ruler, v), { duration: RULER_STEP, easing: Easing.linear }));
    })));
    // Suelta: la regla se cierra y el dedo va al check y lo pulsa.
    timers.push(at(closeAt, () => {
      setWeight(TO);
      setLive((l) => l && { ...l, closing: true });
      fs.set(withTiming(1, { duration: 120 }));
    }));
    timers.push(at(closeAt + SCRUB_MS, () => {
      setLive(null);
      fx.set(withTiming(geo.rowWidth - CHECK_W / 2, { duration: TICK_AFTER - 120, easing: Easing.inOut(Easing.cubic) }));
    }));
    timers.push(at(tickAt - 120, () => fs.set(withTiming(PRESS, { duration: 120 }))));
    timers.push(at(tickAt, () => {
      k.set(withTiming(1, { duration: TICK_MS }));
      fs.set(withTiming(1, { duration: 160 }));
    }));
    // Después, a «S3» (la fila de debajo): al tocarla copia la serie que acaba de hacer.
    const copyAt = tickAt + COPY_AFTER;
    timers.push(at(tickAt + 350, () => {
      fx.set(withTiming(LABEL_W / 2, { duration: COPY_AFTER - 470, easing: Easing.inOut(Easing.cubic) }));
      fy.set(withTiming(midY + geo.rowHeight + ROW_GAP, { duration: COPY_AFTER - 470, easing: Easing.inOut(Easing.cubic) }));
    }));
    timers.push(at(copyAt - 120, () => fs.set(withTiming(PRESS, { duration: 120 }))));
    timers.push(at(copyAt, () => { onCopy(); fs.set(withTiming(1, { duration: 160 })); }));
    timers.push(at(copyAt + 450, () => {
      fo.set(withTiming(0, { duration: 300 }));
      fy.set(withTiming(midY + geo.rowHeight + ROW_GAP + 26, { duration: 300, easing: easeOut }));
    }));
    return () => timers.forEach(clearTimeout);
  }, [active, reduced, geo, k, fx, fy, fo, fs, onCopy]);

  return { weight, live, geo, setGeo, finger: { x: fx, y: fy, o: fo, s: fs } };
}

/** Una serie: dos casillas y el check. `k` va de 0 (por hacer / activa) a 1 (hecha). */
function SetRow({ label, kg, reps, state, copied, onCopy }) {
  const styles = useThemedStyles(makeStyles);
  const reduced = useReducedMotion();
  const C = styles.c;
  const ticks = state === 'tick';
  const k = useSharedValue(state === 'done' || (ticks && reduced) ? 1 : 0);
  const demo = useScrubDemo(ticks, k, onCopy);
  // «S3»: al copiar, sus cifras pasan de apagadas a escritas y queda como la serie activa.
  const isCopy = state === 'copy';
  const cp = useSharedValue(isCopy && reduced ? 1 : 0);
  useEffect(() => { if (copied) cp.set(withTiming(1, { duration: 280 })); }, [copied, cp]);
  // La fila y la casilla del peso se miden cada una por su lado y en cualquier orden.
  const box = useRef({ rowWidth: 0, cell: null });
  const measure = (patch) => {
    box.current = { ...box.current, ...patch };
    // Solo la primera vez: si cambiara, la demo empezaría de nuevo.
    if (ticks && box.current.rowWidth && box.current.cell) demo.setGeo((g) => g ?? { ...box.current });
  };

  const cell = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(k.get(), [0, 1], [C.bg, C.done]),
    borderColor:     ticks
      ? interpolateColor(k.get(), [0, 1], [C.act, 'transparent'])
      : interpolateColor(cp.get(), [0, 1], ['transparent', C.act]),
  }));
  const ok = useAnimatedStyle(() => ({ backgroundColor: interpolateColor(k.get(), [0, 1], [C.surface3, C.accent]) }));
  // El check gris de «por hacer» se funde con el negro de «hecha».
  const iconOn  = useAnimatedStyle(() => ({ opacity: k.get() }));
  const iconOff = useAnimatedStyle(() => ({ opacity: 1 - k.get() }));
  const num = useAnimatedStyle(() => ({
    color: isCopy
      ? interpolateColor(cp.get(), [0, 1], [C.muted, C.text])
      : interpolateColor(k.get(), [0, 1], [state === 'off' ? C.muted : C.text, C.accent]),
  }));
  const off = state === 'off' || (isCopy && !copied && !reduced);   // «S3» copiada pasa a ser la activa
  const values = [ticks ? demo.weight : isCopy && (copied || reduced) ? TO : kg, reps];

  return (
    <View
      style={[styles.row, ticks && styles.rowUp]}
      onLayout={(e) => measure({ rowWidth: e.nativeEvent.layout.width, rowHeight: e.nativeEvent.layout.height })}
    >
      <Text style={[styles.setNo, off && styles.setNoOff]}>{label}</Text>
      {values.map((v, i) => (
        <Reanimated.View
          key={i}
          style={[styles.cell, cell]}
          onLayout={i === 0 && ticks ? (e) => measure({ cell: { x: e.nativeEvent.layout.x, width: e.nativeEvent.layout.width } }) : undefined}
        >
          <Reanimated.Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[styles.val, num]}>{String(v)}</Reanimated.Text>
        </Reanimated.View>
      ))}
      <Reanimated.View style={[styles.ok, ok]}>
        <Reanimated.View style={iconOff}><CheckIcon size={15} color={C.mutedLight} /></Reanimated.View>
        <Reanimated.View style={[styles.okOn, iconOn]}><CheckIcon size={15} color={C.onAccent} /></Reanimated.View>
      </Reanimated.View>
      {demo.live && demo.geo && (
        <ScrubRuler
          field="weight"
          ruler={demo.live.ruler}
          value={demo.live.value}
          cell={demo.geo.cell}
          rowWidth={demo.geo.rowWidth}
          closing={demo.live.closing}
          initial={FROM}
          hasValue
          prevValue={TO}
        />
      )}
      {ticks && !reduced && <Finger {...demo.finger} color={C.text} />}
    </View>
  );
}

export default function WelcomeArt() {
  const { t } = useTranslation();
  const styles = useThemedStyles(makeStyles);
  const [box, setBox] = useState(null);
  const [copied, setCopied] = useState(false);
  const onCopy = useCallback(() => setCopied(true), []);
  const scale = box ? Math.min(1, box.w / W, box.h / H) : 1;

  return (
    <View
      style={styles.area}
      onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {box && (
        <View style={[styles.stage, { transform: [{ scale }] }]}>
          <Piece index={0} rotate="-6deg" style={[styles.pill, styles.pillUp]}>
            <Text style={styles.upTxt}>{t('onboardingFlow.common.welcome.art.up')}</Text>
          </Piece>
          <Piece index={1} rotate="-3deg" style={styles.ex}>
            <View style={styles.hd}>
              <Text style={styles.no}>02</Text>
              <View>
                <Text style={styles.nm}>{t('onboardingFlow.common.welcome.art.exercise')}</Text>
                <Text style={styles.mt}>
                  <Text style={styles.mtAccent}>{t('onboardingFlow.common.welcome.art.main')}</Text>
                  {` · 4 × 8–12 ${t('onboardingFlow.common.welcome.art.reps')}`}
                </Text>
              </View>
            </View>
            <View style={styles.bd}>
              <Text style={styles.tip}>{t('onboardingFlow.common.welcome.art.increase')}<Text style={styles.tipVal}>{` ${TO} kg`}</Text></Text>
              {ROWS.map(([label, kg, reps, state]) => (
                <SetRow key={label} label={label} kg={kg} reps={reps} state={state} copied={copied} onCopy={onCopy} />
              ))}
            </View>
          </Piece>
          <Piece index={3} rotate="4deg" style={[styles.pill, styles.pillPr]}>
            <View style={styles.prBadge}><Text style={styles.prBadgeTxt}>PR</Text></View>
            <View>
              <Text style={styles.prVal}>45 kg × 12</Text>
              <Text style={styles.prSub}>{t('onboardingFlow.common.welcome.art.best')}</Text>
            </View>
          </Piece>
        </View>
      )}
    </View>
  );
}

const makeStyles = (th) => {
  const C = th.colors;
  return {
    ...StyleSheet.create({
      // El hueco entre la cabecera y la hoja; la composición se centra y se escala dentro.
      area:  { flex: 1, alignItems: 'center', justifyContent: 'center' },
      stage: { width: W, height: H },

      // Sin `overflow: hidden`: la regla y su burbuja asoman por encima de la fila, como en el Workout.
      ex:  { position: 'absolute', left: 34, right: 22, top: 18, borderRadius: th.radius.lg, backgroundColor: C.surface, boxShadow: SHADOW },
      hd:  { flexDirection: 'row', gap: spacing.lg - 3, paddingTop: spacing.lg - 1, paddingHorizontal: spacing.lg + 1, paddingBottom: spacing.lg - 3 },
      no:  { ...textStyles.heading, color: C.accent },
      nm:  { ...textStyles.bodyStrong, color: C.text },
      mt:  { ...textStyles.label, color: C.mutedLight, marginTop: spacing.xs },
      mtAccent: { color: C.accent },
      bd:  {
        backgroundColor: C.surface2, paddingTop: spacing.md, paddingHorizontal: spacing.lg - 1, paddingBottom: spacing.lg - 1, gap: spacing.sm2,
        borderBottomLeftRadius: th.radius.lg, borderBottomRightRadius: th.radius.lg,
      },
      tip: { ...textStyles.caps, color: C.mutedLight },
      tipVal: { color: C.text },

      row:    { flexDirection: 'row', alignItems: 'center', gap: spacing.sm2 },
      rowUp:  { zIndex: 5 },   // la fila de la demo (regla y dedo), por encima de las vecinas
      setNo:  { ...textStyles.labelStrong, width: LABEL_W, color: C.accent },
      setNoOff: { color: C.mutedLight },
      cell:   { flex: 1, height: 38, borderRadius: th.radius.md - 1, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
      val:    { ...textStyles.itemTitle, fontVariant: ['tabular-nums'] },
      ok:     { width: CHECK_W, height: 38, borderRadius: th.radius.md - 1, alignItems: 'center', justifyContent: 'center' },
      okOn:   { position: 'absolute' },

      pill:   { position: 'absolute', zIndex: 2, borderRadius: th.radius.md + 2, backgroundColor: C.onAccent, paddingVertical: spacing.md, paddingHorizontal: spacing.lg - 2, boxShadow: SHADOW },
      pillUp: { left: 14, top: 0 },
      upTxt:  { ...textStyles.labelStrong, color: C.accent },
      // Más abajo y asomando por la derecha de la tarjeta.
      pillPr: { right: -6, top: 274, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
      prBadge:    { backgroundColor: C.accent, borderRadius: th.radius.sm, paddingVertical: spacing.xs2, paddingHorizontal: spacing.sm },
      prBadgeTxt: { ...textStyles.labelStrong, color: C.onAccent },
      prVal:  { ...textStyles.itemTitle, color: C.text },
      prSub:  { ...textStyles.label, color: C.mutedLight },
    }),
    c: { bg: C.bg, surface3: C.surface3, accent: C.accent, text: C.text, muted: C.muted, mutedLight: C.mutedLight, onAccent: C.onAccent, done: withOpacity(C.accent, 0.18), act: withOpacity(C.accent, 0.6) },
  };
};
