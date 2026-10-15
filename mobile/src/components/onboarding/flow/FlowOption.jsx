/**
 * FlowOption — la tarjeta de respuesta del recorrido de entrada (O03 §3.1.3, §3.1.5).
 *
 * 72 de alto mínimo; título en el rol de 16 (`itemTitleQuiet`), descripción en el
 * de 14. Al elegirla se rellena de lima desde su círculo de selección y el texto
 * pasa a `onAccent`. Dos usos:
 *
 *   · respuesta única — `selected` + `onPress` (guarda la respuesta) + `onPick`
 *     (avanza ~520 ms después, con el relleno acabado)
 *   · «lleva a otro sitio» — `chevron` + `onPick`: lleva «›», y también se rellena
 *     antes de irse
 *
 * `tag`: la etiqueta del recomendado. `index`: su turno en la entrada por partes.
 */
import { View, StyleSheet } from 'react-native';
import Reanimated, { useAnimatedStyle } from 'react-native-reanimated';

import { Text, MAX_FONT_SCALE } from '../../ui/Text';
import { Rise } from '../../ui/Rise';
import { CheckIcon } from '../../ui/EditorIcons';
import { spacing, textStyles, lh, withOpacity } from '../../../theme';
import { useTheme, useThemedStyles } from '../../../useTheme';
import { FillPressable } from './FlowFill';
import { useInk } from './useFill';

const RADIO = 22;
const RADIO_X = spacing.lg + RADIO / 2;   // de aquí sale el relleno

function OptionBody({ p, title, desc, tag, chevron }) {
  const th     = useTheme();
  const C      = th.colors;
  const styles = useThemedStyles(makeStyles);

  const titleInk = useInk(p, C.text, C.onAccent);
  const descInk  = useInk(p, C.mutedLight, withOpacity(C.onAccent, 0.68));
  const tagBg    = useInk(p, withOpacity(C.accent, 0.12), C.onAccent, 'backgroundColor');
  const off      = useAnimatedStyle(() => ({ opacity: 1 - p.get() }));
  const on       = useAnimatedStyle(() => ({ opacity: p.get() }));

  return (
    <>
      <View style={styles.radio}>
        <Reanimated.View style={[StyleSheet.absoluteFill, styles.radioRing, off]} />
        <Reanimated.View style={[StyleSheet.absoluteFill, styles.radioDot, on]}>
          <CheckIcon size={14} color={C.accent} />
        </Reanimated.View>
      </View>

      <View style={styles.main}>
        <Reanimated.Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[styles.title, titleInk]}>{title}</Reanimated.Text>
        {!!desc && <Reanimated.Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[styles.desc, descInk]}>{desc}</Reanimated.Text>}
      </View>

      {!!tag && (
        <Reanimated.View style={[styles.tag, tagBg]}>
          <Text style={styles.tagTxt}>{tag}</Text>
        </Reanimated.View>
      )}
      {chevron && !tag && <Text style={styles.chev}>›</Text>}
    </>
  );
}

export default function FlowOption({
  title, desc, tag, selected = false, chevron = false, onPress, onPick, index = 2, disabled,
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <Rise index={index}>
      <FillPressable
        selected={selected}
        onPress={onPress}
        onPick={onPick}
        fx={RADIO_X}
        disabled={disabled}
        style={styles.card}
        accessibilityRole={chevron ? 'button' : 'radio'}
        accessibilityLabel={[title, desc].filter(Boolean).join(', ')}
      >
        {(p) => <OptionBody p={p} title={title} desc={desc} tag={tag} chevron={chevron} />}
      </FillPressable>
    </Rise>
  );
}

const makeStyles = (th) => StyleSheet.create({
  card: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing.lg,
    minHeight:         72,
    padding:           spacing.lg,
    borderRadius:      th.radius.lg,
  },
  radio:     { width: RADIO, height: RADIO },
  radioRing: { borderRadius: RADIO / 2, borderWidth: 2, borderColor: th.colors.muted },
  radioDot: {
    borderRadius:    RADIO / 2,
    backgroundColor: th.colors.onAccent,
    alignItems:      'center',
    justifyContent:  'center',
  },
  main:  { flex: 1, minWidth: 0 },
  title: { ...textStyles.itemTitleQuiet },
  desc:  { ...textStyles.body, lineHeight: lh(14), marginTop: spacing.xs },
  tag: {
    alignSelf:         'flex-start',
    borderRadius:      th.radius.sm,
    paddingHorizontal: spacing.sm2,
    paddingVertical:   spacing.xs2 + 1,
  },
  tagTxt: { ...textStyles.caps, color: th.colors.accent },
  chev:   { ...textStyles.title, color: th.colors.muted, paddingLeft: spacing.sm },
});
