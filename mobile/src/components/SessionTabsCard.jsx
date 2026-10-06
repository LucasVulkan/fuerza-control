/**
 * SessionTabsCard — Inicio «por pestañas» (docs/specs/U13-inicio-pestanas.md).
 *
 * Las mismas sesiones que la lista plegable de U04, en UNA tarjeta con una
 * pestaña por sesión: ✓ las hechas esta semana, la letra las demás. Pensada
 * para quien recibe un programa o hace siempre el mismo orden; se elige en
 * Preferencias.
 *
 * El lima sigue siendo «la que toca» y nada más (U04 §1.1): abrir otra pasa la
 * tarjeta a `surface`, y la pestaña de la que toca se queda rellena de lima
 * para que se sepa cuál era. Ni «HOY» ni más marcas (§2).
 */
import { useState, useCallback, useRef } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import Svg, { Path, Rect, Defs, ClipPath } from 'react-native-svg';
import Reanimated, {
  useSharedValue, useAnimatedStyle, useAnimatedProps, withTiming, Easing, runOnJS,
  FadeIn, LinearTransition,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';

import { Text } from './ui/Text';
import { spacing, textStyles, withOpacity } from '../theme';
import { useTheme, useThemedStyles } from '../useTheme';
import { CheckIcon, HeroChevron, StartButton } from './SessionList';
import { collapseOut, FOLD_MS } from './ui/collapseOut';

// ── Geometría (§3.2) ─────────────────────────────────────────────────────────
// Medida sobre la maqueta del usuario a 358 de ancho, no sale de tokens.
const TAB_H  = 43;   // alto de la tira
const PITCH  = 54;   // de una pestaña a la siguiente; si no caben, menos (§3.2)
const SLANT  = 6;    // cuánto se inclina el canto: «/», arriba más a la derecha
const GAP    = 1.5;  // entre dos pestañas se ve la tarjeta
const CORNER = 6;    // las esquinas de abajo, las que tocan la tarjeta
const LEFT   = -10;  // la primera arranca fuera: el borde de la tarjeta la corta recta
const CHEV_W = 44;   // el hueco del chevron, a la derecha

const FILL_MS = 450;  // el color que se extiende desde la pestaña por la tarjeta (§4)
const TAB_MS  = 260;  // la pestaña que se llena desde abajo y la que se vacía (§4)
const SLIDE_MS = 220; // el nombre entrando del lado de la pestaña elegida (§4)
const SLIDE_PX = 24;  // desde cuánto más allá entra
const MIN_MS   = 120; // lo mínimo que dura un tramo de relleno, por corto que sea

const AnimatedRect = Reanimated.createAnimatedComponent(Rect);

const along = ([x1, y1], [x2, y2], d) => {
  const len = Math.hypot(x2 - x1, y2 - y1);
  return [x1 + ((x2 - x1) * d) / len, y1 + ((y2 - y1) * d) / len];
};
const pt = ([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`;

/** El paralelogramo de la pestaña `i`: arriba recto, abajo con las esquinas redondas. */
function tabPath(i, pitch) {
  const bl = [LEFT + i * pitch, TAB_H];
  const br = [LEFT + (i + 1) * pitch - GAP, TAB_H];
  const tr = [br[0] + SLANT, 0];
  const tl = [bl[0] + SLANT, 0];
  return `M${pt(tl)} L${pt(tr)} L${pt(along(br, tr, CORNER))} Q${pt(br)} ${pt(along(br, bl, CORNER))}`
    + ` L${pt(along(bl, br, CORNER))} Q${pt(bl)} ${pt(along(bl, tl, CORNER))} Z`;
}

/** Centro visible de la pestaña `i` a media altura (la primera la corta el borde). */
function tabCenter(i, pitch) {
  const left  = Math.max(0, LEFT + i * pitch + SLANT / 2);
  const right = LEFT + (i + 1) * pitch - GAP + SLANT / 2;
  return (left + right) / 2;
}

/**
 * El color de la tarjeta dentro de una pestaña, como un nivel que sube desde la
 * tarjeta (`to`: la que se abre) o baja hacia ella (`from`: la que se cierra).
 * Recortado a la forma de la pestaña.
 */
function TabFill({ clipId, role, color, progress }) {
  const animatedProps = useAnimatedProps(() => {
    const level = role === 'to' ? progress.get() : 1 - progress.get();
    // +1: la pestaña llena se funde con la tarjeta sin dejar una raya.
    return { y: TAB_H * (1 - level), height: TAB_H * level + 1 };
  }, [role]);
  return (
    <AnimatedRect x={-20} width={1000} fill={color} clipPath={`url(#${clipId})`} animatedProps={animatedProps} />
  );
}

/**
 * @param {Array<{ id, marker, name, meta, done, adapted, cta, onStart, a11y, lines }>} sessions
 *        `lines`: sus ejercicios (`ExerciseLines`), para el desplegable (§3.6).
 *        En el orden del programa.
 * @param {string|null} heroId  La que toca (`sessionPlan().heroTemplateId`). Null en
 *        un programa libre (§9): ninguna en lima, ni tarjeta ni pestaña.
 */
export default function SessionTabsCard({ sessions, heroId }) {
  const { t }  = useTranslation();
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  const C      = th.colors;

  // La que se abre al entrar: la que toca; sin ninguna (libre), la primera sin
  // hacer esta semana, y si están todas, la primera.
  const startId  = heroId ?? (sessions.find((s) => !s.done) ?? sessions[0])?.id ?? null;
  const startCol = startId === heroId ? C.accent : C.surface;

  const [size, setSize] = useState({ width: 0, height: 0 });
  const [selId, setSelId] = useState(startId);
  // Ejercicios a la vista: es de la tarjeta, no de la sesión, así que cambiar de
  // pestaña con ellos abiertos los deja abiertos (§3.6).
  const [open, setOpen] = useState(false);
  const toggle = () => setOpen((o) => !o);
  // El color de debajo y el que se está extendiendo encima, en un círculo que
  // crece desde la pestaña (§4). Al acabar, el de encima pasa a ser el de debajo.
  const [base, setBase] = useState(startCol);
  const [fill, setFill] = useState({ color: startCol, x: 0 });
  const scale = useSharedValue(0);
  // La pestaña que se llena y la que se vacía, con el color que se lleva (§4).
  const [tabs, setTabs] = useState({ to: startId, from: null, fromColor: startCol });
  const tabP = useSharedValue(1);
  // El nombre, la meta y los ejercicios entran del lado de la pestaña elegida.
  // Una sola vista que se desliza, no una por sesión con `entering`/`exiting`:
  // deslizando rápido por las pestañas, las que salían se quedaban encima
  // sumándose unas a otras.
  const slideX = useSharedValue(0);
  const fade   = useSharedValue(1);
  // Lo que deciden las animaciones, al día en cada toque. El estado de React
  // pinta, pero deslizando rápido llegan varios toques antes de repintar y con
  // él se decidía sobre un color que ya no era (la que toca acababa en gris).
  // Una ref y no un valor compartido: la escritura de este desde JS va al hilo
  // de UI y podría no verse en el toque siguiente.
  const live = useRef({ sel: startId, base: startCol, fill: startCol });

  const n     = sessions.length;
  const pitch = size.width ? Math.min(PITCH, (size.width - CHEV_W - LEFT - SLANT) / Math.max(n, 1)) : PITCH;
  const sel   = sessions.find((s) => s.id === selId) ?? sessions.find((s) => s.id === startId) ?? sessions[0];
  const colorFor = useCallback((id) => (heroId != null && id === heroId ? C.accent : C.surface), [heroId, C.accent, C.surface]);

  // Al volver a Inicio, o al cambiar la que toca (se acaba de guardar una), la
  // tarjeta vuelve a la que toca: la elección es de un momento, no se recuerda.
  useFocusEffect(useCallback(() => {
    live.current = { sel: startId, base: startCol, fill: startCol };
    setSelId(startId);
    setBase(startCol);
    setFill((f) => ({ ...f, color: startCol }));
    setTabs({ to: startId, from: null, fromColor: startCol });
    scale.set(0);
    tabP.set(1);
    slideX.set(0);
    fade.set(1);
  }, [startId, startCol, scale, tabP, slideX, fade]));

  // El círculo llegó a cubrirla: su color pasa a ser el de debajo.
  const landed = useCallback((color) => {
    live.current.base = color;
    setBase(color);
  }, []);

  // Las animaciones arrancan aquí y no en un efecto: así empiezan en el mismo
  // toque.
  const select = useCallback((id) => {
    const L = live.current;
    if (id === L.sel) return false;
    const from  = L.sel;
    const i     = sessions.findIndex((s) => s.id === id);
    const prev  = sessions.findIndex((s) => s.id === from);
    const color = colorFor(id);
    L.sel = id;
    setSelId(id);
    setTabs({ to: id, from, fromColor: colorFor(from) });

    // ── El relleno de la tarjeta (§4.1) ── Solo hay dos colores, así que un
    // relleno a medias siempre se puede seguir o deshacer: nunca se reinicia.
    // Ir y volver deprisa entre la que toca y otra recoge el círculo por donde
    // iba en vez de saltar a tarjeta llena y empezar otro desde cero.
    const ease   = { easing: Easing.out(Easing.cubic) };
    const done   = (finished) => { if (finished) runOnJS(landed)(color); };
    const moving = L.base !== L.fill;   // hay un círculo a medias encima
    const cur    = scale.get();
    if (!moving) {
      // Quieta: si cambia de color, un círculo nuevo desde la pestaña.
      if (color !== L.base) {
        L.fill = color;
        setFill({ color, x: tabCenter(i, pitch) });
        scale.set(0);
        scale.set(withTiming(1, { ...ease, duration: FILL_MS }, done));
      }
    } else if (color === L.fill) {
      // Va hacia el color que ya se estaba extendiendo: sigue desde donde iba
      // (si se había recogido del todo, sale de la pestaña nueva).
      if (cur < 0.05) setFill({ color, x: tabCenter(i, pitch) });
      scale.set(withTiming(1, { ...ease, duration: Math.max(MIN_MS, FILL_MS * (1 - cur)) }, done));
    } else {
      // Vuelve al color de debajo: el círculo se recoge hacia su pestaña.
      scale.set(withTiming(0, { ...ease, duration: Math.max(MIN_MS, FILL_MS * cur) }));
    }

    tabP.set(0);
    tabP.set(withTiming(1, { ...ease, duration: TAB_MS }));
    slideX.set(i > prev ? SLIDE_PX : -SLIDE_PX);
    fade.set(0);
    slideX.set(withTiming(0, { ...ease, duration: SLIDE_MS }));
    fade.set(withTiming(1, { duration: SLIDE_MS }));
    return true;
  }, [sessions, colorFor, pitch, landed, scale, tabP, slideX, fade]);

  const fillStyle  = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  const slideStyle = useAnimatedStyle(() => ({ opacity: fade.get(), transform: [{ translateX: slideX.get() }] }));

  // ── Gestos (§5): tocar elige; deslizar en horizontal va pasando pestañas ──
  // En el hilo de JS (`runOnJS(true)`): solo eligen pestaña, no animan nada.
  const tabsEnd = LEFT + n * pitch + SLANT;
  const idxAt   = (x) => Math.max(0, Math.min(n - 1, Math.floor((x - LEFT - SLANT / 2) / pitch)));
  const scrub   = (x) => {
    const id = sessions[idxAt(x)]?.id;
    if (id && select(id)) Haptics.selectionAsync().catch(() => {});
  };
  // Los gestos leen `live` al tocar, no al pintar: el lint no lo distingue
  // (mismo caso que el PanResponder de BlockEditorInline).
  /* eslint-disable react-hooks/refs */
  const gesture = Gesture.Race(
    Gesture.Pan()
      .runOnJS(true)
      // Solo en horizontal: un arrastre vertical que empiece aquí es el scroll
      // de Inicio, y el gesto se retira.
      .activeOffsetX([-8, 8])
      .failOffsetY([-12, 12])
      .onStart((e) => scrub(e.x))
      .onUpdate((e) => scrub(e.x)),
    Gesture.Tap()
      .runOnJS(true)
      .onEnd((e, success) => {
        if (!success) return;
        // Pasadas las pestañas está el chevron: abre o cierra los ejercicios.
        if (e.x <= tabsEnd) select(sessions[idxAt(e.x)].id);
        else toggle();
      }),
  );
  /* eslint-enable react-hooks/refs */

  if (!n || !sel) return null;

  const heroSel = heroId != null && sel.id === heroId;
  const R = Math.hypot(Math.max(fill.x, size.width - fill.x), Math.max(TAB_H / 2, size.height - TAB_H / 2));

  // Colores del cuerpo según el fondo (§3.3).
  const ink     = heroSel ? C.onAccent : C.text;
  const metaInk = heroSel ? withOpacity(C.onAccent, 0.55) : C.mutedLight;

  return (
    <Reanimated.View
      layout={LinearTransition.duration(FOLD_MS)}
      style={[styles.card, { backgroundColor: base }]}
      onLayout={(e) => setSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
    >
      {/* El color nuevo, extendiéndose desde la pestaña (§4). */}
      <Reanimated.View
        pointerEvents="none"
        style={[
          styles.fill,
          { left: fill.x - R, top: TAB_H / 2 - R, width: 2 * R, height: 2 * R, borderRadius: R, backgroundColor: fill.color },
          fillStyle,
        ]}
      />

      <GestureDetector gesture={gesture}>
        <View style={styles.strip} accessibilityRole="tablist">
          {size.width > 0 && (
            <Svg width={size.width} height={TAB_H} style={StyleSheet.absoluteFill} pointerEvents="none">
              <Defs>
                {sessions.map((s, i) => (
                  <ClipPath key={s.id} id={`tabclip-${i}`}>
                    <Path d={tabPath(i, pitch)} />
                  </ClipPath>
                ))}
              </Defs>
              {sessions.map((s, i) => {
                // Todas se pintan; la abierta queda tapada por el color de la
                // tarjeta, que la llena hasta arriba y la funde con ella.
                const role = s.id === tabs.to ? 'to' : s.id === tabs.from ? 'from' : null;
                return [
                  <Path key={`${s.id}-tab`} d={tabPath(i, pitch)} fill={s.id === heroId ? C.accent : (C.surface3 ?? C.border)} />,
                  role && (
                    <TabFill
                      key={`${s.id}-fill`}
                      clipId={`tabclip-${i}`}
                      role={role}
                      color={role === 'to' ? colorFor(tabs.to) : tabs.fromColor}
                      progress={tabP}
                    />
                  ),
                ];
              })}
            </Svg>
          )}
          {sessions.map((s, i) => {
            const selected = s.id === sel.id;
            const onLime   = s.id === heroId;   // la que toca: lima, abierta o no
            // La abierta que no es la que toca, con la letra en lima (U13 §10).
            const color    = onLime ? C.onAccent : s.done ? C.green : selected ? C.accent : C.text;
            return (
              <View
                key={s.id}
                pointerEvents="none"
                style={[styles.glyphBox, { left: tabCenter(i, pitch) - pitch / 2, width: pitch }]}
                accessible
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                accessibilityLabel={onLime ? `${t('home.sessionNext')}, ${s.a11y}` : s.a11y}
                accessibilityActions={[{ name: 'activate' }]}
                onAccessibilityAction={() => select(s.id)}
              >
                {s.done
                  ? <CheckIcon size={20} color={color} />
                  : <Text style={[styles.glyph, { color }]}>{s.marker}</Text>}
              </View>
            );
          })}
          {/* Dice si los ejercicios están a la vista: mira abajo abiertos (§3.6). */}
          <Reanimated.View
            pointerEvents="none"
            style={[styles.chevron, { transform: [{ rotate: open ? '90deg' : '0deg' }] }]}
          >
            <HeroChevron size={14} color={heroSel ? C.onAccent : C.mutedLight} />
          </Reanimated.View>
        </View>
      </GestureDetector>

      <View style={styles.body}>
        {/* Toda la tarjeta menos el botón y las pestañas abre los ejercicios,
            como la cabecera de una fila de la lista (§3.6). */}
        <Pressable
          onPress={toggle}
          accessibilityRole="button"
          accessibilityLabel={sel.name}
          accessibilityState={{ expanded: open }}
          accessibilityHint={t(open ? 'home.collapse' : 'home.expand')}
        >
          <Reanimated.View style={slideStyle}>
            <Text style={[styles.title, { color: ink }]} numberOfLines={2}>{sel.name}</Text>
            <View style={styles.metaRow}>
              <Text style={[styles.meta, { color: metaInk }]} numberOfLines={1}>{sel.meta.toUpperCase()}</Text>
              {/* «Adaptada»: azul = entrenador, como en la lista (U04 §5.1). */}
              {!!sel.adapted && <Text style={styles.adapted}>{t('home.adapted')}</Text>}
            </View>
            {open && (
              <Reanimated.View entering={FadeIn.duration(180)} exiting={collapseOut} style={styles.lines}>
                {sel.lines}
              </Reanimated.View>
            )}
          </Reanimated.View>
        </Pressable>
        {/* El mismo botón que la lista (§3.3). */}
        <Reanimated.View layout={LinearTransition.duration(FOLD_MS)} style={styles.btnRow}>
          <StartButton hero={heroSel} done={sel.done} label={sel.cta} onPress={sel.onStart} />
        </Reanimated.View>
      </View>
    </Reanimated.View>
  );
}

const makeStyles = (th) => StyleSheet.create({
  card: {
    borderRadius: th.radius.md,
    overflow:     'hidden',
  },
  fill:  { position: 'absolute' },
  strip: { height: TAB_H },
  glyphBox: {
    position:       'absolute',
    top:            0,
    height:         TAB_H,
    alignItems:     'center',
    justifyContent: 'center',
  },
  glyph: {
    ...textStyles.heroName,
    textTransform:      'uppercase',
    lineHeight:         34,
    includeFontPadding: false,
  },
  chevron: {
    position:       'absolute',
    right:          0,
    top:            0,
    width:          CHEV_W,
    height:         TAB_H,
    alignItems:     'center',
    justifyContent: 'center',
  },
  // Los números de la maqueta (§3.2): 11 a los lados, 15 abajo.
  body: {
    paddingHorizontal: 11,
    paddingTop:        spacing.md,
    paddingBottom:     spacing.lg,
  },
  title: {
    ...textStyles.heroName,
    lineHeight:         34,
    includeFontPadding: false,
  },
  // La caja negra de la tarjeta de hoy (U04 §5.3): la misma sobre lima y sobre
  // gris, y alineada con el botón.
  lines: {
    backgroundColor:   th.colors.bg,
    borderRadius:      th.radius.sm,
    overflow:          'hidden',
    marginTop:         12,
    paddingHorizontal: 12,
    paddingVertical:   9,
  },
  metaRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm, marginTop: spacing.xs },
  meta:    { ...textStyles.caps, flexShrink: 1 },
  adapted: { ...textStyles.labelStrong, color: th.tint.blue70 },
  // Fila, como el pie de la tarjeta de hoy: el botón lleva `flex: 1`.
  btnRow: { flexDirection: 'row', marginTop: 12 },
});
