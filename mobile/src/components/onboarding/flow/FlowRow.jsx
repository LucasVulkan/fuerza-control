/**
 * FlowRow — la fila grande de «¿Cómo entrenas?» (O04-02, spec §2-§3): título en
 * Barlow cursiva, una franja de color a la izquierda y un icono decorativo grande
 * dentro de un círculo tintado, cortado por el borde derecho. Al elegirla se
 * rellena de lima desde el icono (el relleno de `FlowFill`), la franja se apaga y
 * el icono pasa a negro. Elegir no avanza: lo hace «Continuar».
 *
 *   color  el del camino (lima, azul o naranja del tema)
 *   icon   'self' | 'coached' | 'trainer'
 */
import { View, StyleSheet } from 'react-native';
import Reanimated, { useAnimatedStyle } from 'react-native-reanimated';
import Svg, { Rect, Path, Circle, G } from 'react-native-svg';

import { MAX_FONT_SCALE } from '../../ui/Text';
import { Rise } from '../../ui/Rise';
import { TwoTone } from '../../ui/TwoTone';
import { spacing, textStyles, lh, withOpacity } from '../../../theme';
import { useTheme, useThemedStyles } from '../../../useTheme';
import { FillPressable } from './FlowFill';
import { useInk } from './useFill';

const CIRCLE = 156;     // el círculo del icono
const CUT    = 46;      // lo que se sale por la derecha
const ICON   = 104;
const ICON_X = 18;      // el icono, desplazado a la izquierda dentro del círculo
const STRIPE = 5;
const ICON_SW = 1.3;

// Las partes del icono: `g` en gris, `a` en el color del camino (viewBox 24).
const ICONS = {
  self: {
    g: (
      <>
        <Rect x={4.5} y={7} width={3} height={10} rx={1} />
        <Rect x={16.5} y={7} width={3} height={10} rx={1} />
        <Path d="M2.5 10v4M21.5 10v4" />
      </>
    ),
    a: <Path strokeLinecap="butt" d="M8.35 12h7.3" />,
  },
  coached: {
    g: (
      <>
        <Circle cx={6.5} cy={9.5} r={2.8} />
        <Path d="M1.5 21c.4-3.7 2.4-5.8 5-5.8s4.6 2.1 5 5.8" />
      </>
    ),
    a: (
      <G transform="translate(-1 0)">
        <Path d="M15 2.5h5a1.5 1.5 0 0 1 1.5 1.5v3.5A1.5 1.5 0 0 1 20 9h-3.2L14.5 11V9A1.5 1.5 0 0 1 13.5 7.5V4A1.5 1.5 0 0 1 15 2.5z" />
        <Path d="M15.8 5.9l1.2 1.2 2.3-2.4" />
      </G>
    ),
  },
  trainer: {
    g: (
      <>
        <Rect x={4} y={3.5} width={16} height={17} rx={2} />
        <Path d="M9 3.5V1h6v2.5" />
      </>
    ),
    a: <Path d="M8 9h8M8 13h8M8 17h5" />,
  },
};

function Icon({ id, gray, accent }) {
  return (
    <Svg width={ICON} height={ICON} viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <TwoTone g={ICONS[id].g} a={ICONS[id].a} gray={gray} accent={accent} sw={ICON_SW} />
    </Svg>
  );
}

function RowBody({ p, title, desc, color, icon }) {
  const C      = useTheme().colors;
  const styles = useThemedStyles(makeStyles);

  const titleInk = useInk(p, C.text, C.onAccent);
  const descInk  = useInk(p, C.mutedLight, withOpacity(C.onAccent, 0.62));
  const circle   = useInk(p, withOpacity(color, 0.13), withOpacity(C.onAccent, 0.08), 'backgroundColor');
  const stripe   = useAnimatedStyle(() => ({ opacity: 1 - p.get() }));
  const off      = useAnimatedStyle(() => ({ opacity: 1 - p.get() }));
  const on       = useAnimatedStyle(() => ({ opacity: p.get() }));

  return (
    <>
      <Reanimated.View style={[styles.stripe, { backgroundColor: color }, stripe]} />
      <View style={styles.text}>
        <Reanimated.Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[styles.title, titleInk]}>{title}</Reanimated.Text>
        <Reanimated.Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[styles.desc, descInk]}>{desc}</Reanimated.Text>
      </View>
      <Reanimated.View style={[styles.circle, circle]} pointerEvents="none">
        <Reanimated.View style={[styles.icon, off]}>
          <Icon id={icon} gray={C.mutedLight} accent={withOpacity(color, 0.65)} />
        </Reanimated.View>
        <Reanimated.View style={[styles.icon, styles.iconOn, on]}>
          <Icon id={icon} gray={C.onAccent} accent={C.onAccent} />
        </Reanimated.View>
      </Reanimated.View>
    </>
  );
}

export default function FlowRow({ title, desc, color, icon, selected = false, onPress, index = 2 }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <Rise index={index}>
      <FillPressable
        selected={selected}
        onPress={onPress}
        // El centro del icono: el círculo asoma `CUT` por la derecha y el icono va `ICON_X` a su izquierda.
        fx={(w) => w + CUT - CIRCLE / 2 - ICON_X / 2}
        style={styles.card}
        accessibilityRole="radio"
        accessibilityLabel={`${title}, ${desc}`}
      >
        {(p) => <RowBody p={p} title={title} desc={desc} color={color} icon={icon} />}
      </FillPressable>
    </Rise>
  );
}

const makeStyles = (th) => StyleSheet.create({
  card: {
    flexDirection:     'row',
    alignItems:        'center',
    minHeight:         124,
    borderRadius:      th.radius.lg,
    paddingVertical:   spacing.xl,
    paddingRight:      spacing.lg,
    paddingLeft:       spacing.xxl - spacing.sm,
  },
  stripe: { position: 'absolute', left: 0, top: 0, bottom: 0, width: STRIPE },
  text:   { maxWidth: '62%' },
  // Barlow cursiva: interlínea holgada y 2 px a la derecha, como los titulares.
  title: {
    ...textStyles.heroName,
    textTransform:      'uppercase',
    lineHeight:         32,
    paddingRight:       2,
    includeFontPadding: false,
  },
  desc: { ...textStyles.body, lineHeight: lh(14), marginTop: spacing.sm },
  circle: {
    position:       'absolute',
    right:          -CUT,
    top:            '50%',
    width:          CIRCLE,
    height:         CIRCLE,
    marginTop:      -CIRCLE / 2,
    borderRadius:   CIRCLE / 2,
    alignItems:     'center',
    justifyContent: 'center',
  },
  icon:   { width: ICON, height: ICON, marginRight: ICON_X },
  iconOn: { position: 'absolute' },
});
