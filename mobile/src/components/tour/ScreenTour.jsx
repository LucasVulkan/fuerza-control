/**
 * ScreenTour — el recorrido de una pantalla la primera vez (U17-01).
 *
 * Un velo sobre toda la ventana con un hueco en el elemento real del paso, un
 * aro lima en el borde del hueco y un globo con título y texto. El hueco se mide
 * con `measureInWindow` sobre el `ref` del paso y se mueve de uno a otro con
 * Reanimated. Va dentro de un `Modal` transparente: tapa la cabecera y la barra
 * de pestañas, y sus coordenadas son las de la ventana, las mismas que da la medida.
 *
 *   const { open, tour } = useScreenTour('tour.home', steps);   // useScreenTour.jsx
 *   …  {tour}  y  <AppHeader onHelp={open} />
 *
 * Paso: `{ ref, title, text, radius?, scrollRef?, figure?, finger? }`
 *   ref        el elemento a resaltar; sin él, solo velo y globo centrado
 *   scrollRef  el ScrollView/FlatList donde está: si no se ve entero, baja hasta él
 *   figure     un nodo que se pinta en el globo, sobre el texto
 *   finger     `{ top?, right?, bottom?, left? }`: el dedo de `Spot` sobre el hueco
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { View, Modal, Pressable, StyleSheet, AccessibilityInfo, findNodeHandle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Reanimated, {
  useSharedValue, useAnimatedProps, useAnimatedStyle, withTiming, Easing, useReducedMotion, FadeIn,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Text } from '../ui/Text';
import Spot from '../onboarding/learn/Spot';
import { spacing, textStyles, withOpacity, lh } from '../../theme';
import { useTheme, useThemedStyles } from '../../useTheme';
import { placeBubble } from './placeBubble';

const AnimatedPath = Reanimated.createAnimatedComponent(Path);

const PAD        = 4;     // lo que el hueco sobresale del elemento
const MOVE_MS    = 280;   // el hueco de un paso al siguiente
const SCROLL_MS  = 150;   // lo que se espera a que la lista termine de bajar antes de medir
const EDGE       = 100;   // el elemento llega a la lista con este aire por encima
const OUTER      = 'M0 0H5000V5000H0Z';   // el velo: un rectángulo mayor que cualquier pantalla

/** El rectángulo redondeado del hueco, como camino SVG. */
function holeD(x, y, w, h, r) {
  'worklet';
  const k = Math.max(0, Math.min(r, w / 2, h / 2));
  return `M${x + k} ${y}H${x + w - k}A${k} ${k} 0 0 1 ${x + w} ${y + k}V${y + h - k}A${k} ${k} 0 0 1 ${x + w - k} ${y + h}`
    + `H${x + k}A${k} ${k} 0 0 1 ${x} ${y + h - k}V${y + k}A${k} ${k} 0 0 1 ${x + k} ${y}Z`;
}

const measure = (ref) => new Promise((done) => {
  const node = ref?.current;
  if (!node?.measureInWindow) { done(null); return; }
  node.measureInWindow((x, y, w, h) => done(w > 0 && h > 0 ? { x, y, w, h } : null));
});

/** Si el elemento no está entero a la vista en su lista, la baja hasta él. */
async function reveal({ ref, scrollRef }) {
  const [box, view] = await Promise.all([measure(ref), measure(scrollRef)]);
  if (!box || !view || (box.y >= view.y && box.y + box.h <= view.y + view.h)) return;
  const list  = scrollRef.current.getScrollResponder?.() ?? scrollRef.current;   // ScrollView o FlatList
  const inner = list.getInnerViewRef?.();
  if (!inner) return;
  await new Promise((done) => ref.current.measureLayout(
    inner,
    (_x, y) => { list.scrollTo({ y: Math.max(0, y - EDGE), animated: false }); setTimeout(done, SCROLL_MS); },
    done,
  ));
}

export default function ScreenTour({ steps: given, onClose }) {
  const { t }    = useTranslation();
  const th       = useTheme();
  const styles   = useThemedStyles(makeStyles);
  const insets   = useSafeAreaInsets();
  const reduced  = useReducedMotion();
  const [steps]  = useState(given);   // los pasos que había al abrir: no cambian a mitad
  const [idx,  setIdx]  = useState(0);
  const [view, setView] = useState(null);       // lo que se pinta: { idx, rect, radius }
  const [win,  setWin]  = useState({ w: 0, h: 0 });
  const [bh,   setBh]   = useState(0);          // alto del globo
  const [reader, setReader] = useState(null);   // lector de pantalla activo (null = aún no se sabe)
  const titleRef = useRef(null);
  const placed   = useRef(false);               // el primer hueco aparece, no viaja

  const hx = useSharedValue(0), hy = useSharedValue(0), hw = useSharedValue(1), hh = useSharedValue(1);
  const hr = useSharedValue(0), ring = useSharedValue(0), shown = useSharedValue(0);

  useEffect(() => { AccessibilityInfo.isScreenReaderEnabled().then(setReader, () => setReader(false)); }, []);

  // Mide el paso, mueve el hueco hasta él y, cuando está, enseña el globo.
  useEffect(() => {
    if (!win.w || reader === null) return undefined;
    let alive = true;
    const step = steps[idx];
    shown.set(withTiming(0, { duration: reduced ? 0 : 90 }));
    (async () => {
      let r = null;
      if (!reader && step.ref) {
        if (step.scrollRef) await reveal(step);
        r = await measure(step.ref);
      }
      if (!alive) return;
      // Sin elemento (o con lector de pantalla), un hueco de un punto en el centro, sin aro.
      const rect   = r && { x: r.x - PAD, y: r.y - PAD, w: r.w + 2 * PAD, h: r.h + 2 * PAD };
      const target = rect ?? { x: win.w / 2, y: win.h / 2, w: 1, h: 1 };
      const radius = (step.radius ?? th.radius.md) + PAD;
      const go = (v, to) => v.set(placed.current && !reduced ? withTiming(to, { duration: MOVE_MS, easing: Easing.out(Easing.cubic) }) : to);
      go(hx, target.x); go(hy, target.y); go(hw, target.w); go(hh, target.h); go(hr, radius);
      ring.set(withTiming(rect ? 1 : 0, { duration: reduced ? 0 : 200 }));
      placed.current = true;
      setView({ idx, rect, radius });
      // El globo sale con el hueco ya en camino y su alto ya medido.
      setTimeout(() => { if (alive) shown.set(withTiming(1, { duration: reduced ? 0 : 160 })); }, reduced ? 0 : 120);
    })();
    return () => { alive = false; };
  }, [idx, win.w, win.h, reader, reduced, steps, th.radius.md, hx, hy, hw, hh, hr, ring, shown]);

  // El foco del lector, en el título y el texto del paso.
  useEffect(() => {
    const node = reader && view ? findNodeHandle(titleRef.current) : null;
    if (node) AccessibilityInfo.setAccessibilityFocus(node);
  }, [reader, view]);

  const veil = useAnimatedProps(() => ({ d: OUTER + holeD(hx.get(), hy.get(), hw.get(), hh.get(), hr.get()) }));
  const edge = useAnimatedProps(() => ({
    d: holeD(hx.get(), hy.get(), hw.get(), hh.get(), hr.get()),
    strokeOpacity: ring.get(),
  }));
  const fade = useAnimatedStyle(() => ({ opacity: shown.get() }));

  const last = idx === steps.length - 1;
  const back = useCallback(() => setIdx((i) => Math.max(0, i - 1)), []);
  const next = () => (last ? onClose() : setIdx(idx + 1));

  const step = view ? steps[view.idx] : null;
  const top  = view ? placeBubble({ rect: view.rect, winH: win.h, bubbleH: bh, safeTop: insets.top, safeBottom: insets.bottom }) : 0;

  return (
    // Atrás (Android) retrocede un paso; en el primero no hace nada: solo se sale con «Saltar» o el último paso.
    <Modal transparent visible animationType="none" statusBarTranslucent onRequestClose={back}>
      <View
        style={StyleSheet.absoluteFill}
        // Tocar fuera no cierra ni pasa el toque: el responder se queda aquí.
        onStartShouldSetResponder={() => true}
        onLayout={(e) => setWin({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
        accessibilityViewIsModal
      >
        {view && (
          <Reanimated.View entering={reduced ? undefined : FadeIn.duration(180)} style={StyleSheet.absoluteFill} pointerEvents="none">
            <Svg width="100%" height="100%">
              <AnimatedPath fill={withOpacity('#000000', 0.72)} fillRule="evenodd" animatedProps={veil} />
              <AnimatedPath fill="none" stroke={th.colors.accent} strokeWidth={2} animatedProps={edge} />
            </Svg>
          </Reanimated.View>
        )}

        {/* El dedo de un paso con gesto, sobre el hueco ya asentado. */}
        {view?.rect && step.finger && (
          <View pointerEvents="none" style={{ position: 'absolute', left: view.rect.x, top: view.rect.y, width: view.rect.w, height: view.rect.h }}>
            <Spot radius={view.radius} finger={step.finger} style={StyleSheet.absoluteFill} />
          </View>
        )}

        {step && (
          <Reanimated.View
            onLayout={(e) => setBh(e.nativeEvent.layout.height)}
            style={[styles.bubble, { top }, fade]}
          >
            <View style={styles.head}>
              <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                {steps.map((_, i) => <View key={i} style={[styles.dot, i === view.idx && styles.dotOn]} />)}
              </View>
              <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button">
                <Text style={styles.skip}>{t('tour.skip')}</Text>
              </Pressable>
            </View>

            {step.figure}

            <View ref={titleRef} collapsable={false} accessible accessibilityLabel={`${step.title}. ${step.text}`}>
              <Text style={styles.title}>{step.title}</Text>
              <Text style={styles.text}>{step.text}</Text>
            </View>

            <View style={styles.btns}>
              {view.idx > 0 && (
                <Pressable style={styles.prev} onPress={back} accessibilityRole="button" accessibilityLabel={t('tour.back')}>
                  <Text style={styles.prevText}>‹</Text>
                </Pressable>
              )}
              <Pressable style={styles.next} onPress={next} accessibilityRole="button">
                <Text style={styles.nextText}>{last ? t('tour.done') : t('tour.next')}</Text>
              </Pressable>
            </View>
          </Reanimated.View>
        )}
      </View>
    </Modal>
  );
}

const makeStyles = (th) => StyleSheet.create({
  bubble: {
    position:        'absolute',
    left:            spacing.xl,
    right:           spacing.xl,
    backgroundColor: th.colors.surface2,
    borderRadius:    th.radius.lg,
    borderWidth:     StyleSheet.hairlineWidth,
    borderColor:     th.colors.border,
    padding:         spacing.lg,
    gap:             spacing.md,
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dots: { flexDirection: 'row', gap: spacing.sm },
  dot:  { width: 6, height: 6, borderRadius: 3, backgroundColor: th.colors.border },
  dotOn: { width: 18, backgroundColor: th.colors.accent },
  skip: { ...textStyles.button, color: th.colors.mutedLight },
  title: { ...textStyles.heading, color: th.colors.text },
  text:  { ...textStyles.body, lineHeight: lh(textStyles.body.fontSize), color: th.colors.mutedLight, marginTop: spacing.xs2 },
  btns:  { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xs2 },
  prev: {
    width:           44,
    alignItems:      'center',
    justifyContent:  'center',
    borderRadius:    th.radius.md,
    borderWidth:     1,
    borderColor:     th.colors.border,
  },
  prevText: { ...textStyles.heading, color: th.colors.text },
  next: {
    flex:            1,
    alignItems:      'center',
    justifyContent:  'center',
    paddingVertical: spacing.md,
    borderRadius:    th.radius.md,
    backgroundColor: th.colors.accent,
  },
  nextText: { ...textStyles.button, color: th.colors.onAccent },
});
