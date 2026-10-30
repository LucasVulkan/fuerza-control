/**
 * FlowTile — la baldosa grande del recorrido de entrada (unidades, «qué buscas»):
 * la cifra o la palabra en Barlow y una etiqueta debajo. Mismo relleno lima que
 * `FlowOption`, pero desde el centro. Se reparte el ancho: va dentro de una fila
 * (`flexDirection: 'row'`, `gap`).
 *
 *   big    la cifra o la palabra grande
 *   label  la etiqueta, en versales, debajo
 *   word   `big` es una palabra, no una cifra: un escalón menos y sin hueco extra
 *   square casi cuadrada (aspectRatio 1), para las de minutos
 */
import { View, StyleSheet } from 'react-native';
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
      {word ? (
        // Siempre el alto de dos líneas: «Calistenia» y «Ganar músculo» miden lo mismo.
        <View style={styles.wordBox}>
          <Reanimated.Text maxFontSizeMultiplier={MAX_FONT_SCALE} numberOfLines={2} style={[styles.word, bigInk]}>{big}</Reanimated.Text>
        </View>
      ) : (
        <Reanimated.Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[styles.big, bigInk]}>{big}</Reanimated.Text>
      )}
      {!!label && <Reanimated.Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[styles.label, labelInk]}>{label}</Reanimated.Text>}
    </>
  );
}

export default function FlowTile({ big, label, word = false, square = false, selected = false, onPress, onPick, index = 2 }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <Rise index={index} style={styles.cell}>
      <FillPressable
        selected={selected}
        onPress={onPress}
        onPick={onPick}
        style={[styles.tile, square && styles.square]}
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
  square: { aspectRatio: 1, paddingVertical: 0, justifyContent: 'center' },
  // Barlow cursiva: interlínea holgada (si no, se corta por abajo) y 2 px a la
  // derecha para que no se coma la última cifra.
  big:     { ...textStyles.heroGlyph, lineHeight: 40, paddingRight: 2, includeFontPadding: false },
  wordBox: { minHeight: 2 * 34, justifyContent: 'center', marginVertical: spacing.sm },
  word:    { ...textStyles.heroName, textTransform: 'uppercase', textAlign: 'center', lineHeight: 34, paddingRight: 2, includeFontPadding: false },
  label: { ...textStyles.caps, textTransform: 'uppercase' },
});
