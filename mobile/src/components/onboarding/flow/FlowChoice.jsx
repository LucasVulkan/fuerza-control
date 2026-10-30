/**
 * FlowChoice — la tarjeta de «¿Plantilla o el tuyo?» (O04-02, spec §2-§3): el
 * texto a la izquierda y, a la derecha, un hueco hundido (fondo `bg`) con un
 * dibujo sin texto de lo que te llevas. Se rellena de lima desde el hueco; el
 * hueco sigue oscuro, como una foto dentro de la tarjeta. Elegir no avanza.
 *
 *   art  'template' (tres filas de sesión apagadas) | 'own' (hoja vacía con «+»)
 *   tag  la etiqueta del recomendado
 */
import { View, StyleSheet } from 'react-native';
import Reanimated from 'react-native-reanimated';

import { Text, MAX_FONT_SCALE } from '../../ui/Text';
import { Rise } from '../../ui/Rise';
import { spacing, textStyles, lh, withOpacity } from '../../../theme';
import { useTheme, useThemedStyles } from '../../../useTheme';
import { FillPressable } from './FlowFill';
import { useInk } from './useFill';

const WELL = 112;
const ROWS = [['day1', '78%'], ['day2', '60%'], ['day3', '70%']];

function Art({ art }) {
  const C      = useTheme().colors;
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.well}>
      {art === 'template'
        ? ROWS.map(([day, w]) => (
          <View key={day} style={styles.sk}>
            <View style={[styles.skDot, { backgroundColor: C[day] }]} />
            <View style={[styles.skBar, { width: w }]} />
          </View>
        ))
        : <View style={styles.blank}><Text style={styles.plus}>+</Text></View>}
    </View>
  );
}

function ChoiceBody({ p, title, desc, tag, art }) {
  const C      = useTheme().colors;
  const styles = useThemedStyles(makeStyles);
  const titleInk = useInk(p, C.text, C.onAccent);
  const descInk  = useInk(p, C.mutedLight, withOpacity(C.onAccent, 0.62));
  const tagBg    = useInk(p, withOpacity(C.accent, 0.12), withOpacity(C.onAccent, 0.12), 'backgroundColor');
  const tagInk   = useInk(p, C.accent, C.onAccent);
  return (
    <>
      <View style={styles.main}>
        {!!tag && (
          <Reanimated.View style={[styles.tag, tagBg]}>
            <Reanimated.Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[styles.tagTxt, tagInk]}>{tag}</Reanimated.Text>
          </Reanimated.View>
        )}
        <Reanimated.Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[styles.title, titleInk]}>{title}</Reanimated.Text>
        <Reanimated.Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[styles.desc, descInk]}>{desc}</Reanimated.Text>
      </View>
      <Art art={art} />
    </>
  );
}

export default function FlowChoice({ title, desc, tag, art, selected = false, onPress, index = 2 }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <Rise index={index}>
      <FillPressable
        selected={selected}
        onPress={onPress}
        fx={(w) => w - spacing.md - WELL / 2}
        style={styles.card}
        accessibilityRole="radio"
        accessibilityLabel={`${title}, ${desc}`}
      >
        {(p) => <ChoiceBody p={p} title={title} desc={desc} tag={tag} art={art} />}
      </FillPressable>
    </Rise>
  );
}

const makeStyles = (th) => StyleSheet.create({
  card: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             spacing.lg,
    borderRadius:    th.radius.lg,
    padding:         spacing.md + 2,
    paddingLeft:     spacing.xl - 2,
  },
  main: { flex: 1, minWidth: 0 },
  tag: {
    alignSelf:         'flex-start',
    borderRadius:      th.radius.full,
    paddingHorizontal: spacing.sm2 + 1,
    paddingVertical:   spacing.xs2 - 1,
    marginBottom:      spacing.sm2,
  },
  tagTxt: { ...textStyles.caps, textTransform: 'uppercase' },
  title: {
    ...textStyles.heroName,
    textTransform:      'uppercase',
    lineHeight:         30,
    paddingRight:       2,
    includeFontPadding: false,
  },
  desc: { ...textStyles.body, lineHeight: lh(14), marginTop: spacing.sm },

  // El hueco hundido: más oscuro que la tarjeta y con un filo, para que se lea como dibujo.
  well: {
    width:             WELL,
    height:            WELL,
    borderRadius:      th.radius.md,
    backgroundColor:   th.colors.bg,
    borderWidth:       1,
    borderColor:       th.colors.surface3,
    paddingVertical:   spacing.lg - 3,
    paddingHorizontal: spacing.md,
    justifyContent:    'center',
    gap:               spacing.sm + 1,
  },
  sk:    { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  skDot: { width: 14, height: 14, borderRadius: 4, opacity: 0.55 },
  skBar: { flexShrink: 1, height: 5, borderRadius: 3, backgroundColor: th.colors.surface3 },
  blank: {
    flex:           1,
    borderWidth:    1.5,
    borderStyle:    'dashed',
    borderColor:    th.colors.surface3,
    borderRadius:   th.radius.sm,
    alignItems:     'center',
    justifyContent: 'center',
  },
  plus: { ...textStyles.title, color: th.colors.muted },
});
