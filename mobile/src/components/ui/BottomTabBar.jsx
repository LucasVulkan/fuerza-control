/**
 * Barra de pestañas propia (maqueta docs/mockups/tab-bar.html, opción H):
 * tarjeta pegada abajo con las esquinas de arriba redondas, una raya lima en el
 * borde que se desliza hasta la pestaña activa y los nombres siempre visibles.
 *
 * Los iconos van a dos colores (`TwoTone`): en reposo todo gris; la activa con
 * la parte lima animada (los discos suben, la capa cae, la barra crece…) y un
 * «pop» del icono entero. La parte lima va en su propia capa encima del gris
 * para poder moverla sin mover el resto.
 */
import { useEffect, useRef, useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Rect, G } from 'react-native-svg';
import Reanimated, {
  useSharedValue, useAnimatedStyle, withSpring, withSequence, withTiming,
} from 'react-native-reanimated';

import { Text } from './Text';
import { TwoTone } from './TwoTone';
import { strokeFor } from './iconTones';
import { spacing, textStyles, borders } from '../../theme';
import { useTheme, useThemedStyles } from '../../useTheme';

const ICON = 24;
const LINE_W = 26;

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

const SPRING = { damping: 11, stiffness: 170 };

function TabIcon({ route, focused }) {
  const th = useTheme();
  const { g, gf, a, af, anim } = TAB_ICONS[route] ?? TAB_ICONS.Home;
  const gray   = focused ? th.colors.mutedLight : th.colors.muted;
  const accent = focused ? th.colors.accent : th.colors.muted;
  const sw = strokeFor(ICON);

  const pop = useSharedValue(1);
  const p   = useSharedValue(1);
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return; }
    if (!focused) return;
    pop.set(withSequence(withTiming(0.8, { duration: 130 }), withTiming(1.12, { duration: 130 }), withTiming(1, { duration: 120 })));
    p.set(0);
    p.set(withSpring(1, SPRING));
  }, [focused, pop, p]);

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
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: press.get() }] }));
  const label = options.tabBarLabel ?? options.title ?? route.name;
  const badge = options.tabBarBadge;

  return (
    <Pressable
      style={styles.tab}
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={() => { press.set(withTiming(0.88, { duration: 80 })); }}
      onPressOut={() => { press.set(withTiming(1, { duration: 120 })); }}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
    >
      <Reanimated.View style={pressStyle}>
        <TabIcon route={route.name} focused={focused} />
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
  const styles = useThemedStyles(makeStyles);
  const [width, setWidth] = useState(0);
  const n = state.routes.length;
  const lineX = useSharedValue(0);
  const placed = useRef(false);

  useEffect(() => {
    if (!width) return;
    const to = (state.index + 0.5) * (width / n) - LINE_W / 2;
    // La primera vez se coloca sin viajar desde la izquierda.
    lineX.set(placed.current ? withSpring(to, { damping: 15, stiffness: 170 }) : to);
    placed.current = true;
  }, [state.index, width, n, lineX]);

  const lineStyle = useAnimatedStyle(() => ({ transform: [{ translateX: lineX.get() }] }));

  return (
    <View style={styles.wrap}>
      <View style={[styles.bar, { paddingBottom: insets.bottom + spacing.sm }]}>
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
  // Lo que asoma por las esquinas redondas es el fondo de la app.
  wrap: { backgroundColor: th.colors.bg },
  bar: {
    backgroundColor:      th.colors.surface,
    borderTopLeftRadius:  th.radius.lg,
    borderTopRightRadius: th.radius.lg,
    borderTopWidth:   borders.thin,
    borderLeftWidth:  borders.thin,
    borderRightWidth: borders.thin,
    borderColor:      th.colors.border,
    paddingHorizontal: spacing.xs,
  },
  row: { flexDirection: 'row' },
  // La raya cubre el borde de arriba (top −1).
  line: {
    position: 'absolute', top: -borders.thin, left: 0,
    width: LINE_W, height: 2, borderBottomLeftRadius: 2, borderBottomRightRadius: 2,
    backgroundColor: th.colors.accent,
  },
  tab: { flex: 1, alignItems: 'center', gap: 3, paddingTop: spacing.md, paddingBottom: spacing.xs },
  label: { ...textStyles.micro },
  badgeDot: {
    position: 'absolute', top: -1, right: -3, width: 7, height: 7, borderRadius: 4,
    backgroundColor: th.colors.accent, borderWidth: 1.5, borderColor: th.colors.surface,
  },
  badgeNum: {
    position: 'absolute', top: -5, right: -9, minWidth: 16, height: 16, paddingHorizontal: 4,
    borderRadius: 8, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: th.colors.surface,
  },
  badgeText: { ...textStyles.micro, color: th.colors.onAccent },
});
