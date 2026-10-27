/**
 * EmptyState — la pantalla (o el trozo de pantalla) vacía: icono de línea,
 * título, texto y, si hay algo que ofrecer, un botón y una salida secundaria.
 *
 * Nueve sitios decían «aquí no hay nada» cada uno a su manera (emoji a 32 o a
 * 40 px, tres botones lima distintos, el título a `title` o a `bodyStrong`);
 * son una sola pieza (U09-pulido-ui.md §10). Todo es opcional salvo el texto.
 *
 * Quien la usa decide el hueco con `style`: `flex: 1` para ocupar la pantalla
 * centrada, o un `paddingVertical` dentro de una lista.
 *
 * `ghost` (U15-04) cambia el icono por la silueta gris de lo que saldrá cuando
 * haya datos, fundida hacia el fondo: 'cards' (con avatar), 'plain', 'line'
 * (gráfica), 'bars' o 'text' (con `ghostText`). Sin `ghost`, el icono de siempre.
 *
 * `icon` es un trazo de `ROW_ICON`, el mismo que usan las filas y las hojas;
 * `action` / `secondary` son `{ label, onPress }`.
 */
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect, Path, Circle } from 'react-native-svg';

import { Text } from './Text';
import { RowIcon } from './MenuList';
import { spacing, textStyles, lh } from '../../theme';
import { useTheme, useThemedStyles } from '../../useTheme';

// 32 con trazo 1.8: a 2.4, que es el de `RowIcon` a 18, el trazo engordaría
// al escalar.
const ICON_SIZE   = 32;
const ICON_STROKE = 1.8;

const bar = (styles, w, small) => <View style={[styles.gl, small && styles.glSmall, { width: `${w}%` }]} />;

function Ghost({ kind, text, styles, th }) {
  const cards = (avatar, n) => [...Array(n).keys()].map((i) => (
    <View key={i} style={styles.gcard}>
      {avatar && <View style={styles.gav} />}
      <View style={styles.gcol}>{bar(styles, 60 - i * 8)}{bar(styles, 75 - i * 6, true)}</View>
    </View>
  ));
  let body;
  if (kind === 'line') {
    body = (
      <>
        <View style={styles.gchart}>
          {bar(styles, 40)}
          <Svg style={styles.gsvg} viewBox="0 0 300 120" preserveAspectRatio="none">
            <Path d="M0 100 L40 92 L80 95 L120 74 L160 70 L200 52 L240 48 L300 28" fill="none" stroke={th.colors.border} strokeWidth={3} strokeLinejoin="round" />
            {[[40, 92], [120, 74], [200, 52], [300, 28]].map(([x, y]) => <Circle key={x} cx={x} cy={y} r={4} fill={th.colors.border} />)}
          </Svg>
        </View>
        {cards(false, 1)}
      </>
    );
  } else if (kind === 'bars') {
    body = (
      <View style={styles.gchart}>
        {bar(styles, 35)}
        <View style={styles.gbars}>
          {[40, 62, 55, 80, 70, 92, 66].map((h, i) => <View key={i} style={[styles.gbarCol, { height: `${h}%` }]} />)}
        </View>
      </View>
    );
  } else if (kind === 'text') {
    body = <View style={styles.gcard}><Text style={styles.gtext}>{text}</Text></View>;
  } else {
    body = cards(kind === 'cards', 3);
  }
  return (
    <View style={styles.ghost}>
      {body}
      <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <LinearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0.3" stopColor={th.colors.bg} stopOpacity={0} />
            <Stop offset="1" stopColor={th.colors.bg} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#fade)" />
      </Svg>
    </View>
  );
}

/** Hueco en línea (sesión sin ejercicios, circuito sin movimientos): borde discontinuo y «＋». */
export function EmptySlot({ title, subtitle, onPress, style }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <TouchableOpacity style={[styles.slot, style]} onPress={onPress} activeOpacity={0.75} accessibilityRole="button">
      <View style={styles.plus}><Text style={styles.plusText}>＋</Text></View>
      <View style={styles.gcol}>
        <Text style={styles.slotTitle}>{title}</Text>
        {!!subtitle && <Text style={styles.slotSub}>{subtitle}</Text>}
      </View>
    </TouchableOpacity>
  );
}

export default function EmptyState({ icon, ghost, ghostText, title, text, action, secondary, style }) {
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={[styles.wrap, style]}>
      {ghost && <Ghost kind={ghost} text={ghostText} styles={styles} th={th} />}
      {!ghost && icon != null && (
        <RowIcon size={ICON_SIZE} strokeWidth={ICON_STROKE} color={th.colors.mutedLight}>{icon}</RowIcon>
      )}
      {!!title && <Text style={styles.title}>{title}</Text>}
      <Text style={styles.text}>{text}</Text>
      {action && (
        <TouchableOpacity style={styles.cta} onPress={action.onPress} activeOpacity={0.85} accessibilityRole="button">
          <Text style={styles.ctaText}>{action.label}</Text>
        </TouchableOpacity>
      )}
      {secondary && (
        <TouchableOpacity style={styles.secondary} onPress={secondary.onPress} activeOpacity={0.7} accessibilityRole="button">
          <Text style={styles.secondaryText}>{secondary.label}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const makeStyles = (th) => StyleSheet.create({
  wrap: {
    alignItems:        'center',
    justifyContent:    'center',
    gap:               spacing.md,
    paddingHorizontal: spacing.xxl,
  },
  ghost:  { alignSelf: 'stretch', gap: spacing.sm2 },
  gcard:  { backgroundColor: th.colors.surface, borderRadius: th.radius.md, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  gav:    { width: 36, height: 36, borderRadius: 18, backgroundColor: th.colors.surface2 },
  gcol:   { flex: 1 },
  gl:     { height: 10, borderRadius: 5, backgroundColor: th.colors.surface2 },
  glSmall: { height: 8, marginTop: spacing.sm, backgroundColor: th.colors.border },
  gchart: { backgroundColor: th.colors.surface, borderRadius: th.radius.md, padding: spacing.md, gap: spacing.md },
  gsvg:   { width: '100%', height: 120 },
  gbars:  { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, height: 110 },
  gbarCol: { flex: 1, backgroundColor: th.colors.surface2, borderTopLeftRadius: th.radius.xs, borderTopRightRadius: th.radius.xs },
  gtext:  { ...textStyles.body, color: th.colors.muted },
  slot:   { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, borderRadius: th.radius.md, borderWidth: 1.5, borderStyle: 'dashed', borderColor: th.colors.border },
  plus:   { width: 32, height: 32, borderRadius: th.radius.md, backgroundColor: th.colors.surface2, alignItems: 'center', justifyContent: 'center' },
  plusText: { ...textStyles.bodyStrong, color: th.colors.accent },
  slotTitle: { ...textStyles.bodyStrong, color: th.colors.text },
  slotSub:   { ...textStyles.body, color: th.colors.mutedLight, marginTop: spacing.xs },
  title: { ...textStyles.bodyStrong, color: th.colors.text, textAlign: 'center' },
  text: {
    ...textStyles.body,
    color:      th.colors.mutedLight,
    textAlign:  'center',
    lineHeight: lh(textStyles.body.fontSize),
  },
  // El botón lima de `ProgramScreen`: alto 44, `radius.md`.
  cta: {
    height:            44,
    borderRadius:      th.radius.md,
    backgroundColor:   th.colors.accent,
    alignItems:        'center',
    justifyContent:    'center',
    paddingHorizontal: spacing.xl,
  },
  ctaText:       { ...textStyles.labelStrong, color: th.colors.onAccent },
  secondary:     { paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  secondaryText: { ...textStyles.labelStrong, color: th.colors.mutedLight },
});
