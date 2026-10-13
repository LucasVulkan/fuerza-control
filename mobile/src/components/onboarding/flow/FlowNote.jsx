/**
 * FlowNote — la nota del recorrido de entrada (maqueta `.note`). Cuatro tonos:
 *
 *   neutral  una tarjeta en `surface`, el texto apagado
 *   acc      relleno lima al 10 %: lo que conviene saber (el plan gratis)
 *   blue     azul = entrenador, con la barra a la izquierda (la invitación)
 *   warn     naranja: lo que hay que cuidar (el código personal)
 *
 * `text` admite `*negrita*`: va en `bodyStrong`, y en el color del tono si lo tiene.
 */
import { View, StyleSheet } from 'react-native';

import Marked from '../../ui/Marked';
import { spacing, textStyles, lh, withOpacity } from '../../../theme';
import { useThemedStyles } from '../../../useTheme';

export default function FlowNote({ tone = 'neutral', text, style }) {
  const styles = useThemedStyles(makeStyles);
  const bar = tone === 'blue' || tone === 'warn';
  return (
    <View style={[styles.note, styles[tone], style]}>
      {bar && <View style={[styles.bar, tone === 'blue' ? styles.barBlue : styles.barWarn]} />}
      <Marked text={text} style={[styles.text, tone !== 'neutral' && styles.textOn]} accentStyle={[styles.strong, styles[`${tone}Strong`]]} />
    </View>
  );
}

const makeStyles = (th) => StyleSheet.create({
  note: {
    borderRadius:      th.radius.lg,
    paddingVertical:   spacing.lg - 1,
    paddingHorizontal: spacing.lg + 1,
    marginTop:         spacing.lg - 1,
    overflow:          'hidden',
    backgroundColor:   th.colors.surface,
  },
  acc:  { backgroundColor: th.tint.accent10 },
  blue: { backgroundColor: withOpacity(th.colors.blue, 0.14) },
  warn: { backgroundColor: withOpacity(th.colors.orange, 0.12) },
  bar:     { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3 },
  barBlue: { backgroundColor: th.colors.blue },
  barWarn: { backgroundColor: th.colors.orange },
  text:    { ...textStyles.body, color: th.colors.mutedLight, lineHeight: lh(14) },
  textOn:  { color: th.colors.text },
  strong:  { ...textStyles.bodyStrong, color: th.colors.text },
  accStrong:  { color: th.colors.accent },
  warnStrong: { color: th.colors.orange },
});
