/**
 * La ilustración del lima de la bienvenida (O04-07, variante A de
 * docs/mockups/onboarding-bienvenida-2.html): la tarjeta de un ejercicio a medio
 * registrar con dos avisos flotando. Vistas sencillas, no los componentes de
 * Workout, salvo la regla (`ScrubRuler`), que es la de verdad. Es decorativa:
 * nada de esto se anuncia.
 *
 * Cuenta una serie entera: la S1 llegó a 12 reps, así que toca subir; en la S2
 * sale la regla, el peso pasa de 45 a 47,5 y se marca el check.
 *
 * Se compone a un tamaño fijo (el de la maqueta) y se escala para caber en el
 * hueco que deja la hoja.
 */
import { useEffect, useRef, useState } from 'react';
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
import { scrubRuler } from '../../utils/scrubScale';

const W = 375;               // ancho de la maqueta
const H = 340;               // alto de la composición (con lo que asoma el PR)
const STEP_MS = 90;
const RISE_MS = 600;
const RISE_Y  = 26;
const TICK_MS = 350;
const ROWS = [['S1', 45, '12', 'done'], ['S2', 45, '10', 'tick'], ['S3', 47.5, '10', 'off'], ['S4', 47.5, '9', 'off']];

// La regla de la S2: cuándo sale, cada cuánto sube un paso, cuánto se queda en el
// valor nuevo y cuándo se marca el check tras cerrarse.
const RULER_AT   = 1300;
const RULER_STEP = 170;
const RULER_HOLD = 450;
const TICK_AFTER = 250;
const FROM = 45;
const TO   = 47.5;

// Muy difusa: separa las piezas del lima sin ensuciarlo.
const SHADOW = '0px 18px 44px rgba(0, 0, 0, 0.28)';

const easeOut = Easing.out(Easing.cubic);

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
function useScrubDemo(active, k) {
  const reduced = useReducedMotion();
  const [weight, setWeight] = useState(active && reduced ? TO : FROM);
  const [live, setLive]     = useState(null);   // { ruler, value, closing }
  const [geo, setGeo]       = useState(null);   // { rowWidth, cell: { x, width } }

  useEffect(() => {
    if (!active || reduced || !geo) return undefined;
    const ruler = scrubRuler('weight', FROM, geo.cell.x + geo.cell.width / 2, geo.rowWidth, { unit: 'kg' });
    const steps = [];
    for (let v = FROM + ruler.step; v <= TO + 1e-9; v += ruler.step) steps.push(Math.round(v * 100) / 100);
    const timers = [setTimeout(() => setLive({ ruler, value: FROM, closing: false }), RULER_AT)];
    steps.forEach((v, i) => timers.push(setTimeout(() => setLive((l) => l && { ...l, value: v }), RULER_AT + SCRUB_MS + (i + 1) * RULER_STEP)));
    const closeAt = RULER_AT + SCRUB_MS + steps.length * RULER_STEP + RULER_HOLD;
    timers.push(setTimeout(() => { setWeight(TO); setLive((l) => l && { ...l, closing: true }); }, closeAt));
    timers.push(setTimeout(() => setLive(null), closeAt + SCRUB_MS));
    timers.push(setTimeout(() => k.set(withTiming(1, { duration: TICK_MS })), closeAt + SCRUB_MS + TICK_AFTER));
    return () => timers.forEach(clearTimeout);
  }, [active, reduced, geo, k]);

  return { weight, live, geo, setGeo };
}

/** Una serie: dos casillas y el check. `k` va de 0 (por hacer / activa) a 1 (hecha). */
function SetRow({ label, kg, reps, state }) {
  const styles = useThemedStyles(makeStyles);
  const reduced = useReducedMotion();
  const C = styles.c;
  const ticks = state === 'tick';
  const k = useSharedValue(state === 'done' || (ticks && reduced) ? 1 : 0);
  const demo = useScrubDemo(ticks, k);
  // La fila y la casilla del peso se miden cada una por su lado y en cualquier orden.
  const box = useRef({ rowWidth: 0, cell: null });
  const measure = (patch) => {
    box.current = { ...box.current, ...patch };
    // Solo la primera vez: si cambiara, la demo empezaría de nuevo.
    if (ticks && box.current.rowWidth && box.current.cell) demo.setGeo((g) => g ?? { ...box.current });
  };

  const cell = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(k.get(), [0, 1], [C.bg, C.done]),
    borderColor:     interpolateColor(k.get(), [0, 1], [ticks ? C.act : 'transparent', 'transparent']),
  }));
  const ok = useAnimatedStyle(() => ({ backgroundColor: interpolateColor(k.get(), [0, 1], [C.surface3, C.accent]) }));
  // El check gris de «por hacer» se funde con el negro de «hecha».
  const iconOn  = useAnimatedStyle(() => ({ opacity: k.get() }));
  const iconOff = useAnimatedStyle(() => ({ opacity: 1 - k.get() }));
  const num = useAnimatedStyle(() => ({ color: interpolateColor(k.get(), [0, 1], [state === 'off' ? C.muted : C.text, C.accent]) }));
  const off = state === 'off';
  const values = [ticks ? demo.weight : kg, reps];

  return (
    <View style={[styles.row, demo.live && styles.rowUp]} onLayout={(e) => measure({ rowWidth: e.nativeEvent.layout.width })}>
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
    </View>
  );
}

export default function WelcomeArt() {
  const { t } = useTranslation();
  const styles = useThemedStyles(makeStyles);
  const [box, setBox] = useState(null);
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
                <SetRow key={label} label={label} kg={kg} reps={reps} state={state} />
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
      rowUp:  { zIndex: 5 },   // la fila con la regla, por encima de las vecinas
      setNo:  { ...textStyles.labelStrong, width: 26, color: C.accent },
      setNoOff: { color: C.mutedLight },
      cell:   { flex: 1, height: 38, borderRadius: th.radius.md - 1, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
      val:    { ...textStyles.itemTitle, fontVariant: ['tabular-nums'] },
      ok:     { width: 40, height: 38, borderRadius: th.radius.md - 1, alignItems: 'center', justifyContent: 'center' },
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
