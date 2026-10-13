/**
 * FlowTile — la baldosa grande del recorrido de entrada (unidades, «qué buscas»):
 * la cifra o la palabra en Barlow y una etiqueta debajo. Mismo relleno lima que
 * `FlowOption`, pero desde el centro. Se reparte el ancho: va dentro de una fila
 * (`flexDirection: 'row'`, `gap`).
 *
 *   big    la cifra o la palabra grande
 *   label  la etiqueta, en versales, debajo
 *   word   `big` es una palabra, no una cifra: un escalón menos y sin hueco extra
 */
import { StyleSheet } from 'react-native';
import Reanimated from 'react-native-reanimated';

import { MAX_FONT_SCALE } from '../../ui/Text';
import { Rise } from '../../ui/Rise';
import { spacing, textStyles, withOpacity } from '../../../theme';
import { useTheme, useThemedStyles } from '../../../useTheme';
import { FillPressable } from './FlowFill';
import { useInk } from './useFill';

function TileBody({ p, big, label, word }) {
  const C      = useTheme().colors;
  const styles = useThemedStyles(makeStyles);
  const bigInk   = useInk(p, C.text, C.onAccent);
  const labelInk = useInk(p, C.mutedLight, withOpacity(C.onAccent, 0.68));
  return (
    <>
      <Reanimated.Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[word ? styles.word : styles.big, bigInk]}>{big}</Reanimated.Text>
      {!!label && <Reanimated.Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[styles.label, labelInk]}>{label}</Reanimated.Text>}
    </>
  );
}

export default function FlowTile({ big, label, word = false, selected = false, onPress, onPick, index = 2 }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <Rise index={index} style={styles.cell}>
      <FillPressable
        selected={selected}
        onPress={onPress}
        onPick={onPick}
        style={styles.tile}
        accessibilityRole="radio"
        accessibilityLabel={[big, label].filter(Boolean).join(' ')}
      >
        {(p) => <TileBody p={p} big={big} label={label} word={word} />}
      </FillPressable>
    </Rise>
  );
}

const makeStyles = (th) => StyleSheet.create({
  cell: { flex: 1 },
  tile: {
    borderRadius:      th.radius.lg,
    paddingVertical:   spacing.xxl,
    paddingHorizontal: spacing.md,
    alignItems:        'center',
    gap:               spacing.sm2,
  },
  big:   { ...textStyles.heroGlyph, lineHeight: 38, includeFontPadding: false },
  word:  { ...textStyles.heroName, textTransform: 'uppercase', lineHeight: 30, includeFontPadding: false, paddingVertical: spacing.md },
  label: { ...textStyles.caps, textTransform: 'uppercase' },
});
