/**
 * La ilustración del lima de la bienvenida (O04-07, variante A de
 * docs/mockups/onboarding-bienvenida-2.html): la tarjeta de un ejercicio a medio
 * registrar con dos avisos flotando. Vistas sencillas, no los componentes de
 * Workout. Es decorativa: nada de esto se anuncia.
 *
 * Se compone a un tamaño fijo (el de la maqueta) y se escala para caber en el
 * hueco que deja la hoja.
 */
import { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import Reanimated, {
  useSharedValue, useAnimatedStyle, withTiming, withDelay, Easing, useReducedMotion, interpolateColor,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { spacing, textStyles, withOpacity } from '../../theme';
import { useThemedStyles } from '../../useTheme';
import { Text, MAX_FONT_SCALE } from '../ui/Text';
import { CheckIcon } from '../ui/EditorIcons';

const W = 375;               // ancho de la maqueta
const H = 320;               // alto de la composición (pastilla de PR incluida)
const STEP_MS = 90;
const RISE_MS = 600;
const RISE_Y  = 26;
const TICK_AT = 1600;        // cuándo se marca la serie 2
const TICK_MS = 350;
const ROWS = [['S1', '45', '12', 'done'], ['S2', '45', '11', 'tick'], ['S3', '45', '10', 'off'], ['S4', '45', '9', 'off']];

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

/** Una serie: dos casillas y el check. `k` va de 0 (por hacer / activa) a 1 (hecha). */
function SetRow({ label, kg, reps, state, ticks }) {
  const styles = useThemedStyles(makeStyles);
  const reduced = useReducedMotion();
  const C = styles.c;
  const k = useSharedValue(state === 'done' || (state === 'tick' && reduced) ? 1 : 0);
  useEffect(() => {
    if (ticks && !reduced) k.set(withDelay(TICK_AT, withTiming(1, { duration: TICK_MS })));
  }, [ticks, reduced, k]);

  const cell = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(k.get(), [0, 1], [C.bg, C.done]),
    borderColor:     interpolateColor(k.get(), [0, 1], [state === 'tick' ? C.act : 'transparent', 'transparent']),
  }));
  const ok = useAnimatedStyle(() => ({ backgroundColor: interpolateColor(k.get(), [0, 1], [C.surface3, C.accent]) }));
  // El check gris de «por hacer» se funde con el negro de «hecha».
  const iconOn  = useAnimatedStyle(() => ({ opacity: k.get() }));
  const iconOff = useAnimatedStyle(() => ({ opacity: 1 - k.get() }));
  const num = useAnimatedStyle(() => ({ color: interpolateColor(k.get(), [0, 1], [state === 'off' ? C.muted : C.text, C.accent]) }));
  const off = state === 'off';

  return (
    <View style={styles.row}>
      <Text style={[styles.setNo, off && styles.setNoOff]}>{label}</Text>
      {[kg, reps].map((v, i) => (
        <Reanimated.View key={i} style={[styles.cell, cell]}>
          <Reanimated.Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[styles.val, num]}>{v}</Reanimated.Text>
        </Reanimated.View>
      ))}
      <Reanimated.View style={[styles.ok, ok]}>
        <Reanimated.View style={iconOff}><CheckIcon size={15} color={C.mutedLight} /></Reanimated.View>
        <Reanimated.View style={[styles.okOn, iconOn]}><CheckIcon size={15} color={C.onAccent} /></Reanimated.View>
      </Reanimated.View>
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
            {/* El recorte va dentro: en iOS, `overflow: hidden` en la pieza se comería la sombra. */}
            <View style={styles.exClip}>
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
              <Text style={styles.tip}>{t('onboardingFlow.common.welcome.art.increase')}<Text style={styles.tipVal}>{' 45 kg'}</Text></Text>
              {ROWS.map(([label, kg, reps, state]) => (
                <SetRow key={label} label={label} kg={kg} reps={reps} state={state} ticks={state === 'tick'} />
              ))}
            </View>
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
  const shadow = { shadowColor: C.onAccent, shadowOpacity: 0.4, shadowRadius: 22, shadowOffset: { width: 0, height: 14 }, elevation: 12 };
  return {
    ...StyleSheet.create({
      // El hueco entre la cabecera y la hoja; la composición se centra y se escala dentro.
      area:  { flex: 1, alignItems: 'center', justifyContent: 'center' },
      stage: { width: W, height: H },

      ex:     { position: 'absolute', left: 34, right: 22, top: 18, borderRadius: th.radius.lg, backgroundColor: C.surface, ...shadow },
      exClip: { borderRadius: th.radius.lg, overflow: 'hidden' },
      hd:  { flexDirection: 'row', gap: spacing.lg - 3, paddingTop: spacing.lg - 1, paddingHorizontal: spacing.lg + 1, paddingBottom: spacing.lg - 3, backgroundColor: C.surface },
      no:  { ...textStyles.heading, color: C.accent },
      nm:  { ...textStyles.bodyStrong, color: C.text },
      mt:  { ...textStyles.label, color: C.mutedLight, marginTop: spacing.xs },
      mtAccent: { color: C.accent },
      bd:  { backgroundColor: C.surface2, paddingTop: spacing.md, paddingHorizontal: spacing.lg - 1, paddingBottom: spacing.lg - 1, gap: spacing.sm2 },
      tip: { ...textStyles.caps, color: C.mutedLight },
      tipVal: { color: C.text },

      row:    { flexDirection: 'row', alignItems: 'center', gap: spacing.sm2 },
      setNo:  { ...textStyles.labelStrong, width: 26, color: C.accent },
      setNoOff: { color: C.mutedLight },
      cell:   { flex: 1, height: 38, borderRadius: th.radius.md - 1, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
      val:    { ...textStyles.itemTitle, fontVariant: ['tabular-nums'] },
      ok:     { width: 40, height: 38, borderRadius: th.radius.md - 1, alignItems: 'center', justifyContent: 'center' },
      okOn:   { position: 'absolute' },

      pill:   { position: 'absolute', zIndex: 2, borderRadius: th.radius.md + 2, backgroundColor: C.onAccent, paddingVertical: spacing.md, paddingHorizontal: spacing.lg - 2, ...shadow },
      pillUp: { left: 14, top: 0 },
      upTxt:  { ...textStyles.labelStrong, color: C.accent },
      pillPr: { right: 18, top: 250, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
      prBadge:    { backgroundColor: C.accent, borderRadius: th.radius.sm, paddingVertical: spacing.xs2, paddingHorizontal: spacing.sm },
      prBadgeTxt: { ...textStyles.labelStrong, color: C.onAccent },
      prVal:  { ...textStyles.itemTitle, color: C.text },
      prSub:  { ...textStyles.label, color: C.mutedLight },
    }),
    c: { bg: C.bg, surface3: C.surface3, accent: C.accent, text: C.text, muted: C.muted, mutedLight: C.mutedLight, onAccent: C.onAccent, done: withOpacity(C.accent, 0.18), act: withOpacity(C.accent, 0.6) },
  };
};
