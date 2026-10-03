/**
 * VariantPicker — el «cómo se hace» de la hoja Variante
 * (docs/specs/P09-exercise-variants.md §4.1).
 *
 * Un paso por dimensión que el ejercicio declara (`def.variants`), con el
 * formato de los pasos de la hoja de Progresión: título numerado en versales y
 * un SegmentedControl con sus opciones (QA P44). Lo usan el editor de ejercicio
 * y la hoja «solo hoy» del Workout.
 *
 * Sin nada elegido el control no resalta ninguna opción: es un estado válido
 * («sin especificar»). En el editor, tocar la elegida la quita; en el Workout
 * no (`allowDeselect`), y a la derecha del título de cada paso que difiere del
 * programa sale el icono para volver a él (`resetTo`).
 */
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from './Text';
import SegmentedControl from './SegmentedControl';
import { ResetIcon } from './EditorIcons';
import { variantDims } from '../../utils/variants';
import { spacing, textStyles } from '../../theme';
import { useTheme, useThemedStyles } from '../../useTheme';

/**
 * @param resetTo        la variante del programa (hoja del Workout).
 * @param allowDeselect  tocar la elegida la quita. En el Workout no: hoy se
 *                       cambia de opción, no se deja en blanco (QA P43).
 */
export default function VariantPicker({ def, value, onChange, resetTo = null, allowDeselect = true }) {
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { t }  = useTranslation();

  const pick = (dim, opt) => {
    const next = { ...(value ?? {}) };
    if (next[dim] === opt) {
      if (!allowDeselect) return;
      delete next[dim];
    } else {
      next[dim] = opt;
    }
    onChange(next);
  };

  return (
    <View style={styles.steps}>
      {variantDims(def).map((dim, n) => {
        const canReset = resetTo?.[dim] && value?.[dim] !== resetTo[dim];
        return (
          <View key={dim}>
            <View style={styles.head}>
              <Text style={styles.stepTitle}>
                <Text style={styles.stepNum}>{`${n + 1} · `}</Text>{t(`variants.dim.${dim}`)}
              </Text>
              {canReset ? (
                <TouchableOpacity
                  onPress={() => onChange({ ...(value ?? {}), [dim]: resetTo[dim] })}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={t('variants.backToProgram')}
                >
                  <ResetIcon size={16} color={th.colors.mutedLight} />
                </TouchableOpacity>
              ) : null}
            </View>
            <SegmentedControl
              options={def.variants[dim].map((opt) => ({ id: opt, label: t(`variants.options.${dim}.${opt}`) }))}
              value={value?.[dim] ?? null}
              onChange={(opt) => pick(dim, opt)}
            />
          </View>
        );
      })}
    </View>
  );
}

const makeStyles = (th) => StyleSheet.create({
  steps: { gap: spacing.lg },
  head:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  // El mismo título de paso que la hoja de Progresión (`stepTitle`/`stepNum`
  // de ExerciseEditorInline).
  stepTitle: { ...textStyles.caps, color: th.colors.mutedLight, textTransform: 'uppercase' },
  stepNum:   { color: th.colors.accent },
});
