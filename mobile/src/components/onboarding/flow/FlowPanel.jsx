/**
 * FlowPanel — el panel lima de los cierres del recorrido de entrada (O03 §3.1.7):
 * bienvenida, «Conectado» y «Todo listo». El del paywall (radio 40, degradado
 * accent→green), pegado abajo a sangre. Botón `onAccent` con el texto en lima.
 *
 *   title / desc  el titular en Barlow y una línea debajo (opcionales)
 *   children      los botones: `PanelButton`
 *   style         extra para el panel (la bienvenida lo sube con un alto mínimo)
 */
import { useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { Text } from '../../ui/Text';
import { spacing, textStyles, lh, withOpacity } from '../../../theme';
import { useTheme, useThemedStyles } from '../../../useTheme';

const PANEL_RADIUS = 40;   // el del paywall: no hay token tan grande

export default function FlowPanel({ title, desc, style, children }) {
  const C      = useTheme().colors;
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const [box, setBox] = useState(null);
  return (
    <View
      style={[styles.panel, { paddingBottom: Math.max(insets.bottom, spacing.lg) }, style]}
      onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
    >
      {/* Medido y no al 100 %: en Android el SVG se quedaba con el alto del primer pintado (ver PaywallModal). */}
      {box && (
        <Svg width={box.w} height={box.h} style={StyleSheet.absoluteFill} pointerEvents="none">
          <Defs>
            <LinearGradient id="flowPanel" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={C.accent} />
              <Stop offset="1" stopColor={C.green} />
            </LinearGradient>
          </Defs>
          <Rect width={box.w} height={box.h} fill="url(#flowPanel)" />
        </Svg>
      )}
      {!!title && <Text style={styles.title}>{title}</Text>}
      {!!desc && <Text style={styles.desc}>{desc}</Text>}
      {children}
    </View>
  );
}

/** El botón del panel: `onAccent` con texto lima; `ghost`, texto subrayado sin fondo. */
export function PanelButton({ label, onPress, ghost = false }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <Pressable
      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); onPress?.(); }}
      accessibilityRole="button"
      style={ghost ? styles.ghost : styles.cta}
    >
      <Text style={ghost ? styles.ghostTxt : styles.ctaTxt}>{label}</Text>
    </Pressable>
  );
}

const makeStyles = (th) => StyleSheet.create({
  panel: {
    borderTopLeftRadius:  PANEL_RADIUS,
    borderTopRightRadius: PANEL_RADIUS,
    overflow:             'hidden',
    backgroundColor:      th.colors.accent,   // bajo el degradado, por si se queda corto un frame
    paddingHorizontal:    spacing.lg + 1,
    paddingTop:           spacing.xxl,
  },
  title: {
    ...textStyles.heroName,
    color:         th.colors.onAccent,
    textTransform: 'uppercase',
    textAlign:     'center',
    marginBottom:  spacing.md,
  },
  desc: {
    ...textStyles.body,
    color:            withOpacity(th.colors.onAccent, 0.72),
    textAlign:        'center',
    lineHeight:       lh(14),
    marginBottom:     spacing.lg,
    marginHorizontal: spacing.sm2,
  },
  cta: {
    backgroundColor: th.colors.onAccent,
    borderRadius:    th.radius.md,
    paddingVertical: spacing.lg + 2,
    alignItems:      'center',
  },
  ctaTxt:   { ...textStyles.button, color: th.colors.accent, textTransform: 'uppercase' },
  ghost:    { paddingVertical: spacing.lg, alignItems: 'center' },
  ghostTxt: { ...textStyles.button, color: th.colors.onAccent, textDecorationLine: 'underline' },
});
