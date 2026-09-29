/**
 * VariantPicker — el grupo «cómo se hace» de la hoja Variante
 * (docs/specs/exercise-variants.md §4.1, maqueta §1B).
 *
 * Una fila por dimensión que el ejercicio declara (`def.variants`): su nombre y
 * los chips de sus opciones (sin icono, decisión del usuario en QA). Selección simple por dimensión; tocar la
 * marcada la desmarca (nada es obligatorio). Lo usan el editor de ejercicio y,
 * con `programValue`, la hoja «solo hoy» del Workout, que marca debajo de cada
 * chip cuál es la del programa.
 *
 * Anatomía de los chips: la de las pills de Vinculación del editor (`linkPill`):
 * surface2, radio xs, `button`; la activa en accent. El cambio de color va
 * animado, como los botones de la escala de RPE del recap.
 */
import { useEffect } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import Reanimated, {
  useSharedValue, useAnimatedStyle, withTiming, interpolateColor,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { Text, MAX_FONT_SCALE } from './Text';
import { variantDims } from '../../utils/variants';
import { spacing, textStyles } from '../../theme';
import { useTheme, useThemedStyles } from '../../useTheme';

const AnimatedTouchable = Reanimated.createAnimatedComponent(TouchableOpacity);

function Chip({ label, mark, active, onPress }) {
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  const p      = useSharedValue(active ? 1 : 0);
  // Los worklets solo capturan valores serializables: colores sueltos, no `th`.
  const bg   = [th.colors.surface2, th.colors.accent];
  const fg   = [th.colors.text, th.colors.onAccent];
  const soft = [th.colors.mutedLight, th.colors.onAccent];

  useEffect(() => { p.value = withTiming(active ? 1 : 0, { duration: 160 }); }, [active, p]);

  const boxStyle  = useAnimatedStyle(() => ({ backgroundColor: interpolateColor(p.value, [0, 1], bg) }));
  const textStyle = useAnimatedStyle(() => ({ color: interpolateColor(p.value, [0, 1], fg) }));
  const markStyle = useAnimatedStyle(() => ({ color: interpolateColor(p.value, [0, 1], soft) }));

  return (
    <AnimatedTouchable style={[styles.chip, boxStyle]} onPress={onPress} activeOpacity={0.8}>
      <Reanimated.Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[styles.chipText, textStyle]}>{label}</Reanimated.Text>
      {mark ? (
        <Reanimated.Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[styles.chipMark, markStyle]}>{mark}</Reanimated.Text>
      ) : null}
    </AnimatedTouchable>
  );
}

export default function VariantPicker({ def, value, onChange, programValue = null }) {
  const styles = useThemedStyles(makeStyles);
  const { t }  = useTranslation();

  const toggle = (dim, opt) => {
    const next = { ...(value ?? {}) };
    if (next[dim] === opt) delete next[dim]; else next[dim] = opt;
    onChange(next);
  };

  return (
    <View style={styles.group}>
      {variantDims(def).map((dim) => {
        return (
          <View key={dim} style={styles.row}>
            <Text style={styles.headText}>{t(`variants.dim.${dim}`)}</Text>
            <View style={styles.chips}>
              {def.variants[dim].map((opt) => (
                <Chip
                  key={opt}
                  label={t(`variants.options.${dim}.${opt}`)}
                  mark={programValue?.[dim] === opt ? t('variants.programMark') : null}
                  active={value?.[dim] === opt}
                  onPress={() => toggle(dim, opt)}
                />
              ))}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const makeStyles = (th) => StyleSheet.create({
  // Como `optGroup` del editor: filas `surface` pegadas con 2px de hueco.
  group: { borderRadius: th.radius.md, overflow: 'hidden', gap: spacing.xs },
  row: {
    backgroundColor:   th.colors.surface,
    borderRadius:      th.radius.xxs ?? 2,
    paddingHorizontal: spacing.lg,
    paddingVertical:   spacing.md,
    gap:               spacing.sm2,
  },
  headText: { ...textStyles.bodyStrong, color: th.colors.text },
  chips:    { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    borderRadius:      th.radius.xs,
    paddingHorizontal: 9,
    paddingVertical:   spacing.sm,
    alignItems:        'center',
  },
  chipText: { ...textStyles.button },
  chipMark: { ...textStyles.label },
});
