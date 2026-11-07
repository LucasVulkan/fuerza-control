/**
 * ScreenTour — el recorrido de una pantalla la primera vez (U17-01).
 *
 * Un velo sobre toda la ventana con un hueco en el elemento real del paso, un
 * aro lima que late en el borde y un globo de ayuda con piquito hacia el
 * elemento. El hueco se mide con `measureInWindow` sobre el `ref` del paso y se
 * mueve de uno a otro con Reanimated.
 *
 * Lo pinta `TourHost`, en la ventana principal y no en un `Modal`: el `Modal` de
 * Android es otra ventana y su origen no coincide con el de `measureInWindow`
 * (el hueco salía unos píxeles más arriba, la altura de la barra de estado).
 * Aun así se mide el propio velo y se resta su origen, así que cuadra aunque la
 * plataforma cuente la ventana de otra manera.
 *
 *   useScreenTour('tour.home', steps)   // useScreenTour.jsx: devuelve `open`
 *
 * Paso: `{ ref, title, text, radius?, scrollRef?, figure?, finger? }`
 *   ref        el elemento a resaltar; sin él, solo velo y globo centrado, sin piquito
 *   scrollRef  el ScrollView/FlatList donde está: si no se ve entero, baja hasta él
 *   figure     un nodo que se pinta en el globo, sobre el texto
 *   finger     `{ top?, right?, bottom?, left? }`: el dedo de `Spot` sobre el hueco
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { View, ScrollView, Pressable, StyleSheet, AccessibilityInfo, BackHandler, findNodeHandle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Reanimated, {
  useSharedValue, useAnimatedProps, useAnimatedStyle, withTiming, Easing, useReducedMotion,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Text } from '../ui/Text';
import Spot from '../onboarding/learn/Spot';
import { HelpIcon } from '../ui/EditorIcons';
import { spacing, textStyles, withOpacity, lh } from '../../theme';
import { useTheme, useThemedStyles } from '../../useTheme';
import { placeBubble } from './placeBubble';
import RichText from './RichText';
import { plainText } from './richText';

const AnimatedPath = Reanimated.createAnimatedComponent(Path);

const PAD        = 8;     // lo que el hueco sobresale del elemento
const VEIL_OUT   = 200;   // entre pasos el velo se va...
const VEIL_IN    = 500;   // ...y vuelve ya en el sitio del paso nuevo
const READ_MS    = 30;   // con el velo puesto, lo que se deja ver el hueco antes del globo
const SHOW_MS    = 200;   // el globo entra desde el lado del elemento
const SLIDE      = 150;    // ...desde tantos px
const TAIL_W     = 20;    // el piquito del globo
const TAIL_H     = 10;
const LINE       = 1;     // el borde lima del globo y de su piquito
const GAP        = TAIL_H + 4;   // entre el elemento y el globo: el piquito casi llega al hueco
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
  const rootRef  = useRef(null);
  const sideRef  = useRef(null);               // de qué lado del elemento cae el globo

  const hx = useSharedValue(0), hy = useSharedValue(0), hw = useSharedValue(1), hh = useSharedValue(1);
  const hr = useSharedValue(0), shown = useSharedValue(0);
  const slide = useSharedValue(0), veilOp = useSharedValue(0);

  useEffect(() => { AccessibilityInfo.isScreenReaderEnabled().then(setReader, () => setReader(false)); }, []);


  // Entre pasos: fuera el globo y el velo, se mide el paso nuevo (y se baja la
  // lista si hace falta), el velo vuelve con el hueco ya en su sitio y luego el globo.
  useEffect(() => {
    if (!win.w || reader === null) return undefined;
    let alive = true;
    const step = steps[idx];
    const out  = reduced || veilOp.get() === 0 ? 0 : VEIL_OUT;
    shown.set(withTiming(0, { duration: out ? 90 : 0 }));
    veilOp.set(withTiming(0, { duration: out }));
    const faded = new Promise((done) => setTimeout(done, out));
    (async () => {
      let r = null;
      if (!reader && step.ref) {
        if (step.scrollRef) await reveal(step);
        r = await measure(step.ref);
      }
      // El origen del velo en esta misma ventana: lo que se mide es relativo a él.
      const origin = r ? await measure(rootRef) : null;
      if (!alive) return;
      if (r && origin) { r.x -= origin.x; r.y -= origin.y; }
      // Sin elemento (o con lector de pantalla), un hueco de un punto en el centro, sin aro.
      const rect   = r && { x: r.x - PAD, y: r.y - PAD, w: r.w + 2 * PAD, h: r.h + 2 * PAD };
      const target = rect ?? { x: win.w / 2, y: win.h / 2, w: 1, h: 1 };
      const radius = (step.radius ?? th.radius.md) + PAD;
      await faded;
      if (!alive) return;
      hx.set(target.x); hy.set(target.y); hw.set(target.w); hh.set(target.h); hr.set(radius);
      veilOp.set(withTiming(1, { duration: reduced ? 0 : VEIL_IN }));
      setView({ idx, rect, radius });
    })();
    return () => { alive = false; };
  }, [idx, win.w, win.h, reader, reduced, steps, th.radius.md, hx, hy, hw, hh, hr, shown, veilOp]);

  // El globo sale con el velo ya puesto y su alto ya medido, entrando desde
  // el lado del elemento: debajo, bajando; encima, subiendo.
  useEffect(() => {
    if (!view) return undefined;
    const timer = setTimeout(() => {
      const from = sideRef.current === 'above' ? SLIDE : sideRef.current === 'below' ? -SLIDE : 0;
      slide.set(reduced ? 0 : from);
      slide.set(withTiming(0, { duration: reduced ? 0 : SHOW_MS, easing: Easing.out(Easing.cubic) }));
      shown.set(withTiming(1, { duration: reduced ? 0 : SHOW_MS }));
    }, reduced ? 0 : VEIL_IN + READ_MS);
    return () => clearTimeout(timer);
  }, [view, reduced, slide, shown]);

  // Atrás (Android) retrocede un paso; en el primero no hace nada: solo se sale con «Saltar» o el último paso.
  const back = useCallback(() => setIdx((i) => Math.max(0, i - 1)), []);
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { back(); return true; });
    return () => sub.remove();
  }, [back]);

  // El foco del lector, en el título y el texto del paso.
  useEffect(() => {
    const node = reader && view ? findNodeHandle(titleRef.current) : null;
    if (node) AccessibilityInfo.setAccessibilityFocus(node);
  }, [reader, view]);

  const veil = useAnimatedProps(() => ({ d: OUTER + holeD(hx.get(), hy.get(), hw.get(), hh.get(), hr.get()) }));
  const veilStyle = useAnimatedStyle(() => ({ opacity: veilOp.get() }));
  const fade = useAnimatedStyle(() => ({ opacity: shown.get(), transform: [{ translateY: slide.get() }] }));
  const tailFade = useAnimatedStyle(() => ({ opacity: shown.get(), transform: [{ translateY: slide.get() }] }));

  const last = idx === steps.length - 1;
  const next = () => (last ? onClose() : setIdx(idx + 1));

  const step = view ? steps[view.idx] : null;
  const { top, side } = view
    ? placeBubble({ rect: view.rect, winH: win.h, bubbleH: bh, safeTop: insets.top, safeBottom: insets.bottom, gap: GAP })
    : { top: 0, side: null };
  useEffect(() => { sideRef.current = side; }, [side]);

  // El piquito: siempre perpendicular al borde del globo y centrado en el elemento,
  // sin salirse de las esquinas redondas.
  const bubbleW  = win.w - 2 * spacing.xl;
  const tailLeft = side && view.rect
    ? Math.min(bubbleW - th.radius.lg - TAIL_W, Math.max(th.radius.lg, view.rect.x + view.rect.w / 2 - spacing.xl - TAIL_W / 2))
    : 0;

  return (
    <View
      ref={rootRef}
      collapsable={false}
      style={styles.root}
      // Tocar fuera no cierra ni pasa el toque: el responder se queda aquí.
      onStartShouldSetResponder={() => true}
      onLayout={(e) => setWin({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      accessibilityViewIsModal
    >
      {view && (
        <Reanimated.View style={[StyleSheet.absoluteFill, veilStyle]} pointerEvents="none">
          <Svg width="100%" height="100%">
            <AnimatedPath fill={withOpacity('#000000', 0.8)} fillRule="evenodd" animatedProps={veil} />
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
          style={[styles.bubble, { top, maxHeight: Math.max(0, win.h - insets.top - insets.bottom - 2 * spacing.md) }, fade]}
        >
          <View style={styles.head}>
            <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              {steps.map((_, i) => <View key={i} style={[styles.dot, i === view.idx && styles.dotOn]} />)}
            </View>
            <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button">
              <Text style={styles.skip}>{t('tour.skip')}</Text>
            </Pressable>
          </View>

          {/* Con textos largos el globo no crece más que la pantalla: esta parte se desplaza. */}
          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false} bounces={false}>
            {step.figure}

            <View
              ref={titleRef}
              collapsable={false}
              accessible
              accessibilityLabel={`${step.title}. ${plainText(step.text, (name) => t(`tour.icons.${name}`))}`}
            >
              <View style={styles.titleRow}>
                <HelpIcon size={22} />
                <Text style={styles.title}>{step.title}</Text>
              </View>
              <RichText text={step.text} style={styles.text} />
            </View>
          </ScrollView>

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

      {/* El piquito, fuera del globo y en coordenadas de pantalla (dentro, el borde del
          globo se veía cruzándolo): del color del globo, tapa el borde en la base y lleva
          el borde lima en sus dos lados. Encima, el mismo dibujo volteado. */}
      {step && side && (
        <Reanimated.View
          pointerEvents="none"
          style={[styles.tail, { left: spacing.xl + tailLeft, top: side === 'below' ? top - TAIL_H - LINE : top + bh - 2 * LINE }, tailFade]}
        >
          <Svg width={TAIL_W} height={TAIL_H + 3 * LINE} style={side === 'above' && { transform: [{ scaleY: -1 }] }}>
            <Path d={`M0 ${TAIL_H + 3 * LINE}V${TAIL_H + LINE}L${TAIL_W / 2} ${LINE}L${TAIL_W} ${TAIL_H + LINE}V${TAIL_H + 3 * LINE}Z`} fill={th.colors.surface2} />
            <Path d={`M0 ${TAIL_H + LINE}L${TAIL_W / 2} ${LINE}L${TAIL_W} ${TAIL_H + LINE}`} fill="none" stroke={th.colors.accent} strokeWidth={LINE} strokeLinejoin="round" />
          </Svg>
        </Reanimated.View>
      )}
    </View>
  );
}

const makeStyles = (th) => StyleSheet.create({
  // Encima de todo lo de la pantalla; como el Toast, el último hijo de la raíz.
  root: { ...StyleSheet.absoluteFillObject, zIndex: 100, elevation: 100 },
  tail: { position: 'absolute' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm2 },
  bubble: {
    position:        'absolute',
    left:            spacing.xl,
    right:           spacing.xl,
    backgroundColor: th.colors.surface2,
    borderRadius:    th.radius.lg,
    borderWidth:     LINE,
    borderColor:     th.colors.accent,
    padding:         spacing.lg,
    gap:             spacing.md,
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  body: { flexShrink: 1 },
  bodyContent: { gap: spacing.md },
  dots: { flexDirection: 'row', gap: spacing.sm },
  dot:  { width: 6, height: 6, borderRadius: 3, backgroundColor: th.colors.border },
  dotOn: { width: 18, backgroundColor: th.colors.accent },
  skip: { ...textStyles.button, color: th.colors.mutedLight },
  title: { ...textStyles.heading, color: th.colors.text, flexShrink: 1 },
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
