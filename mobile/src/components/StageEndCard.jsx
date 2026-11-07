/**
 * StageEndCard — el aviso de fin de etapa (P08-weeks-model.md §6.1), en Inicio
 * encima de la sesión que toca y en Programa en el sitio de la etapa en curso.
 *
 * Qué dice lo decide `hooks/useStageEnd`. Lo que va entre asteriscos en los
 * textos sale en lima y negrita (`Marked`).
 *
 * Botones apilados a todo el ancho: así un nombre o una traducción larga nunca
 * parte la etiqueta en dos líneas.
 */
import { View, TouchableOpacity, StyleSheet } from 'react-native';

import { Text } from './ui/Text';
import Marked from './ui/Marked';
import { spacing, textStyles } from '../theme';
import { useThemedStyles } from '../useTheme';

function Btn({ label, onPress, primary, styles }) {
  return (
    <TouchableOpacity
      style={[styles.btn, primary && styles.btnPrimary]}
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
    >
      <Text style={[styles.btnText, primary && styles.btnTextPrimary]} numberOfLines={1}>{label.toUpperCase()}</Text>
    </TouchableOpacity>
  );
}

export default function StageEndCard({ notice, style }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={[styles.card, style]}>
      <Text style={styles.eyebrow} numberOfLines={1}>{notice.eyebrow.toUpperCase()}</Text>
      <Text style={styles.title}>{notice.title}</Text>
      {!!notice.sessions && <Marked text={notice.sessions} style={styles.sessions} accentStyle={styles.accent} />}
      <Marked text={notice.text} style={styles.text} accentStyle={styles.accent} />
      <View style={styles.btns}>
        {/* Sin acción principal (siguiente bloqueada) la única que queda va en lima. */}
        {notice.main && <Btn primary label={notice.main.label} onPress={notice.main.onPress} styles={styles} />}
        <Btn primary={!notice.main} label={notice.quiet.label} onPress={notice.quiet.onPress} styles={styles} />
      </View>
    </View>
  );
}

// La misma anatomía que la ficha de la etapa en curso (`ProgramStages`), para
// que en Programa ocupe su sitio sin saltos de estilo.
const makeStyles = (th) => StyleSheet.create({
  card: {
    backgroundColor:   th.colors.surface,
    borderRadius:      th.radius.lg,
    paddingTop:        14,
    paddingHorizontal: spacing.lg + 1,
    paddingBottom:     spacing.lg + 1,
  },
  eyebrow: { ...textStyles.caps, color: th.colors.mutedLight },
  title: {
    ...textStyles.heroName,
    lineHeight:         34,
    includeFontPadding: false,
    textTransform:      'uppercase',
    color:              th.colors.text,
    marginTop:          spacing.xs2,
    paddingRight:       2,
  },
  sessions: { ...textStyles.body, color: th.colors.text, marginTop: spacing.sm2 },
  text:     { ...textStyles.body, lineHeight: 21, color: th.colors.mutedLight, marginTop: spacing.xs },
  accent:   { ...textStyles.bodyStrong, color: th.colors.accent },
  btns:     { gap: spacing.xs2, marginTop: spacing.lg },
  btn: {
    backgroundColor:   th.colors.surface2,
    borderRadius:      th.radius.md,
    paddingVertical:   spacing.md,
    paddingHorizontal: spacing.md,
    alignItems:        'center',
  },
  btnPrimary:     { backgroundColor: th.colors.accent },
  btnText:        { ...textStyles.button, color: th.colors.text },
  btnTextPrimary: { color: th.colors.onAccent },
});
