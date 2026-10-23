/**
 * Barra de pestañas propia (maqueta docs/mockups/tab-bar.html, opción H, luego
 * flotante a la vista): tarjeta redonda encima del borde de abajo, una raya
 * lima arriba que se desliza hasta la pestaña activa y los nombres siempre
 * visibles.
 *
 * Los iconos van a dos colores (`TwoTone`): en reposo todo gris; la activa con
 * la parte lima animada (los discos suben, la capa cae, la barra crece…) y un
 * «pop» del icono entero. La parte lima va en su propia capa encima del gris
 * para poder moverla sin mover el resto.
 */
import { useEffect, useRef, useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Rect, G, Defs, LinearGradient, Stop } from 'react-native-svg';
import Reanimated, {
  useSharedValue, useAnimatedStyle, withSpring, withSequence, withTiming, Easing,
} from 'react-native-reanimated';

import { Text } from './Text';
import { TwoTone } from './TwoTone';
import { strokeFor } from './iconTones';
import { spacing, textStyles, withOpacity } from '../../theme';
import { useTheme, useThemedStyles } from '../../useTheme';

const ICON = 24;
const LINE_W = 26;
// Alto del fundido que tapa el corte recto de la página junto a las esquinas.
const FADE = 24;

// g/gf = gris; a/af = la parte lima, que es la que se anima (`anim`).
const TAB_ICONS = {
  Home: {
    g: <Path d="M6.5 12h11M2.5 10v4M21.5 10v4" />,
    a: <G><Rect x="4.5" y="6.5" width="3" height="11" rx="1" /><Rect x="16.5" y="6.5" width="3" height="11" rx="1" /></G>,
    anim: 'lift',
  },
  MyProgram: {
    g: <Path d="M3 12.5l9 5 9-5M3 17l9 5 9-5" />,
    a: <Path d="M12 2.5l9 5-9 5-9-5z" />,
    anim: 'drop',
  },
  Stats: {
    gf: <G><Rect x="3" y="13" width="4.5" height="8" rx="1.6" /><Rect x="9.75" y="9" width="4.5" height="12" rx="1.6" /></G>,
    af: <Rect x="16.5" y="3.5" width="4.5" height="17.5" rx="1.6" />,
    anim: 'grow',
  },
  Clients: {
    g: <G><Circle cx="9" cy="8" r="3.2" /><Path d="M2.5 19a6.5 6.5 0 0 1 13 0" /></G>,
    a: <Path d="M16 4.8a3.2 3.2 0 0 1 0 6.4M18 13.6a6.5 6.5 0 0 1 3.5 5.4" />,
    anim: 'join',
  },
  Program: {
    g: <Rect x="4" y="14" width="16" height="6" rx="2" />,
    a: <Rect x="4" y="4" width="16" height="6" rx="2" />,
    anim: 'deal',
  },
};

// Rebote corto: se nota que la pieza llega, sin bailar.
const SPRING = { damping: 24, stiffness: 380 };
const LINE_OVER = 4;

function TabIcon({ route, focused, burst }) {
  const th = useTheme();
  const { g, gf, a, af, anim } = TAB_ICONS[route] ?? TAB_ICONS.Home;
  const gray   = focused ? th.colors.mutedLight : th.colors.muted;
  const accent = focused ? th.colors.accent : th.colors.muted;
  const sw = strokeFor(ICON);

  const pop = useSharedValue(1);
  const p   = useSharedValue(1);
  // Solo al pulsar (`burst` cuenta las pulsaciones), no al cambiar de pestaña
  // por código ni al volver a montarse la barra.
  useEffect(() => {
    if (!burst) return;
    pop.set(withSequence(withTiming(0.85, { duration: 90 }), withTiming(1.05, { duration: 90 }), withTiming(1, { duration: 80 })));
    p.set(0);
    p.set(withSpring(1, SPRING));
  }, [burst, pop, p]);

  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.get() }] }));
  const accentStyle = useAnimatedStyle(() => {
    const v = p.get();
    switch (anim) {
      case 'lift': return { transform: [{ scaleY: 0.35 + 0.65 * v }] };
      case 'drop': return { opacity: 0.3 + 0.7 * v, transform: [{ translateY: -5 * (1 - v) }] };
      case 'grow': return { transform: [{ scaleY: v }] };
      case 'join': return { opacity: v, transform: [{ translateX: -5 * (1 - v) }] };
      default:     return { transform: [{ translateY: 6 * (1 - v) }] };
    }
  });

  return (
    <Reanimated.View style={[{ width: ICON, height: ICON }, popStyle]}>
      {/* El gris, con el hueco donde va la parte lima. */}
      <Svg width={ICON} height={ICON} viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round" style={StyleSheet.absoluteFill}>
        <TwoTone g={g} gf={gf} a={a} af={af} gray={gray} accent="none" sw={sw} />
      </Svg>
      {/* La parte lima, en su capa: la que se mueve. La barra crece desde su base (y=21). */}
      <Reanimated.View style={[StyleSheet.absoluteFill, anim === 'grow' && { transformOrigin: ['50%', '87.5%', 0] }, accentStyle]}>
        <Svg width={ICON} height={ICON} viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <TwoTone a={a} af={af} accent={accent} sw={sw} />
        </Svg>
      </Reanimated.View>
    </Reanimated.View>
  );
}

function Tab({ route, options, focused, onPress, onLongPress }) {
  const th = useTheme();
  const styles = useThemedStyles(makeStyles);
  const press = useSharedValue(1);
  const [burst, setBurst] = useState(0);
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: press.get() }] }));
  const label = options.tabBarLabel ?? options.title ?? route.name;
  const badge = options.tabBarBadge;

  return (
    <Pressable
      style={styles.tab}
      onPress={() => { setBurst((b) => b + 1); onPress(); }}
      onLongPress={onLongPress}
      onPressIn={() => { press.set(withTiming(0.88, { duration: 80 })); }}
      onPressOut={() => { press.set(withTiming(1, { duration: 120 })); }}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
    >
      <Reanimated.View style={pressStyle}>
        <TabIcon route={route.name} focused={focused} burst={burst} />
        {badge === '' ? (
          <View style={styles.badgeDot} />
        ) : badge != null ? (
          <View style={[styles.badgeNum, { backgroundColor: options.tabBarBadgeStyle?.backgroundColor ?? th.colors.accent }]}>
            <Text style={styles.badgeText} allowFontScaling={false}>{badge}</Text>
          </View>
        ) : null}
      </Reanimated.View>
      <Text style={[styles.label, { color: focused ? th.colors.accent : th.colors.muted }]} allowFontScaling={false} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

export default function BottomTabBar({ state, descriptors, navigation, insets }) {
  const th = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [width, setWidth] = useState(0);
  const n = state.routes.length;
  const lineX = useSharedValue(0);
  const placed = useRef(false);

  useEffect(() => {
    if (!width) return;
    const to = (state.index + 0.5) * (width / n) - LINE_W / 2;
    // Se pasa siempre LINE_OVER px y vuelve, venga de donde venga: con un
    // muelle el rebote crecía con la distancia (de Plantillas a Entreno salía
    // de la pantalla). La primera vez se coloca sin viajar.
    const dir = Math.sign(to - lineX.get());
    lineX.set(placed.current
      ? withSequence(
        withTiming(to + dir * LINE_OVER, { duration: 230, easing: Easing.out(Easing.cubic) }),
        withTiming(to, { duration: 150, easing: Easing.inOut(Easing.quad) }),
      )
      : to);
    placed.current = true;
  }, [state.index, width, n, lineX]);

  const lineStyle = useAnimatedStyle(() => ({ transform: [{ translateX: lineX.get() }] }));

  return (
    <View style={[styles.wrap, { paddingBottom: insets.bottom + spacing.xs2 }]}>
      {/* La página se corta recto encima de la barra, y junto a las esquinas
          redondas se veía el tajo. Este fundido, que sobresale hacia arriba,
          lo disuelve en el fondo. No recibe toques. */}
      <View style={styles.fade} pointerEvents="none">
        <Svg width="100%" height={FADE}>
          <Defs>
            <LinearGradient id="tabFade" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={th.colors.bg} stopOpacity={0} />
              <Stop offset="1" stopColor={th.colors.bg} stopOpacity={1} />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height={FADE} fill="url(#tabFade)" />
        </Svg>
      </View>
      <View style={styles.bar}>
        <View style={styles.row} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
          {width > 0 && <Reanimated.View style={[styles.line, lineStyle]} />}
          {state.routes.map((route, i) => {
            const focused = state.index === i;
            const { options } = descriptors[route.key];
            const onPress = () => {
              const e = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!focused && !e.defaultPrevented) navigation.navigate(route.name, route.params);
            };
            const onLongPress = () => navigation.emit({ type: 'tabLongPress', target: route.key });
            return (
              <Tab key={route.key} route={route} options={options} focused={focused} onPress={onPress} onLongPress={onLongPress} />
            );
          })}
        </View>
      </View>
    </View>
  );
}

const makeStyles = (th) => StyleSheet.create({
  // Flotante solo a la vista: la página se corta encima de `wrap` (la barra
  // sigue ocupando su sitio), pero la tarjeta, redonda entera y con menos
  // margen lateral que el contenido (sm2 frente a lg), parece que el scroll
  // se mete por detrás.
  wrap: { backgroundColor: th.colors.bg, paddingHorizontal: spacing.sm2 },
  fade: { position: 'absolute', top: -FADE, left: 0, right: 0, height: FADE },
  // Un punto más gris que el fondo (surface al 60 % sobre bg). Sin borde: con
  // el fundido de encima ya se lee la forma.
  bar: {
    backgroundColor:   withOpacity(th.colors.surface, 0.6),
    borderRadius:      th.radius.lg,
    paddingHorizontal: spacing.xs,
    paddingBottom:     spacing.xs2,
  },
  row: { flexDirection: 'row' },
  // La raya va pegada al filo de arriba de la tarjeta.
  line: {
    position: 'absolute', top: 0, left: 0,
    width: LINE_W, height: 2, borderBottomLeftRadius: 2, borderBottomRightRadius: 2,
    backgroundColor: th.colors.accent,
  },
  tab: { flex: 1, alignItems: 'center', gap: 3, paddingTop: spacing.md, paddingBottom: spacing.xs },
  label: { ...textStyles.micro },
  badgeDot: {
    position: 'absolute', top: -1, right: -3, width: 7, height: 7, borderRadius: 4,
    backgroundColor: th.colors.accent, borderWidth: 1.5, borderColor: th.colors.bg,
  },
  badgeNum: {
    position: 'absolute', top: -5, right: -9, minWidth: 16, height: 16, paddingHorizontal: 4,
    borderRadius: 8, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: th.colors.bg,
  },
  badgeText: { ...textStyles.micro, color: th.colors.onAccent },
});
