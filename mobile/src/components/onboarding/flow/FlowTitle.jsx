/**
 * FlowTitle — el titular de cada pantalla del recorrido de entrada (O03 §3.1.1):
 * Barlow cursiva en mayúsculas (`heroGlyph`) con una palabra en lima. La palabra
 * va entre asteriscos; si no se marca ninguna, la última. Debajo, una línea en
 * `body` y nada más. Un titular de más de ~34 caracteres baja un escalón.
 *
 *   text    «Elige cómo *empezar*»
 *   sub     la línea de debajo (opcional)
 *   shrink  fuerza el escalón (por defecto lo decide la longitud)
 *   index   su turno en la entrada por partes; el `sub` entra en el siguiente
 */
import { StyleSheet } from 'react-native';

import { Text } from '../../ui/Text';
import Marked from '../../ui/Marked';
import { Rise } from '../../ui/Rise';
import { spacing, textStyles, lh } from '../../../theme';
import { useThemedStyles } from '../../../useTheme';

const LONG = 34;

/** Marca la última palabra si el texto no marca ninguna. */
const markLast =(text) => (text.includes('*') ? text : text.replace(/(\S+)\s*$/, '*$1*'));

export default function FlowTitle({ text, sub, shrink, index = 0 }) {
  const styles = useThemedStyles(makeStyles);
  const small  = shrink ?? text.replace(/\*/g, '').trim().length > LONG;
  return (
    <>
      <Rise index={index}>
        <Marked text={markLast(text)} style={small ? styles.titleLong : styles.title} accentStyle={styles.accent} />
      </Rise>
      {!!sub && (
        <Rise index={index + 1}>
          <Text style={styles.sub}>{sub}</Text>
        </Rise>
      )}
    </>
  );
}

const makeStyles = (th) => StyleSheet.create({
  title: {
    ...textStyles.heroGlyph,
    color:              th.colors.text,
    lineHeight:         36,
    includeFontPadding: false,
    marginBottom:       spacing.md,
  },
  titleLong: {
    ...textStyles.heroName,
    textTransform:      'uppercase',
    color:              th.colors.text,
    lineHeight:         31,
    includeFontPadding: false,
    marginBottom:       spacing.md,
  },
  accent: { color: th.colors.accent },
  sub: {
    ...textStyles.body,
    color:        th.colors.mutedLight,
    lineHeight:   lh(14),
    marginBottom: spacing.xl + spacing.xs2,
  },
});
