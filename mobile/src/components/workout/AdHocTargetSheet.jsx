/**
 * AdHocTargetSheet — el objetivo de un ejercicio añadido sobre la marcha.
 *
 * Un ad-hoc no tenía dónde configurarse: `WorkoutScreen` se inventaba su
 * `exConfig` en cada render con los valores por defecto de la biblioteca, así
 * que la línea "4 × 8–12 · 90 s" de la tarjeta era un dato que nadie podía
 * cambiar. Ahora esa línea es el disparador y esto es lo que abre.
 *
 * **No es `ExerciseEditorInline`**, y no por pereza: aquel está atado a un
 * `templateId` y autoguarda en `sessionTemplates` —que aquí no existe—, y
 * arrastra progresión, calentamiento, vinculación y tempo. En una sesión libre
 * nada de eso significa nada: no hay siguiente sesión a la que progresar. Lo
 * que queda es el bloque VOLUMEN del editor, con sus mismos `StepField` y sus
 * mismos rangos.
 *
 * Las series se cambian aquí igual que con el botón "+" de la tarjeta: el
 * contador es `setsState.length`, no un número aparte. Bajarlo nunca borra una
 * serie con algo registrado (lo garantiza `setAdHocSets`).
 */
import { View, StyleSheet } from 'react-native';
import { Text } from '../ui/Text';
import { useTranslation } from 'react-i18next';

import { spacing, textStyles } from '../../theme';
import { useThemedStyles } from '../../useTheme';
import DragSheet from '../DragSheet';
import StepField from '../ui/StepField';

export default function AdHocTargetSheet({ def, name, sets, config, onSets, onConfig, onClose }) {
  const { t }  = useTranslation();
  const styles = useThemedStyles(makeStyles);

  // Misma decisión que `buildTarget` en la tarjeta: el tipo de dato sale del
  // ejercicio, no de una preferencia. Una plancha se mide en segundos.
  const isTimed = def?.progressionModel === 'time_progression';
  const val = (key, fallback) => config?.[key] ?? def?.[key] ?? fallback;

  return (
    <DragSheet visible onClose={onClose} title={name}>
      <View style={styles.body}>
        <View style={styles.row}>
          <StepField
            label={t('exerciseEditor.fieldSets')}
            value={sets}
            onChange={onSets}
            min={1}
            max={20}
          />
          <StepField
            label={t('exerciseEditor.fieldRest')}
            value={val('restSec', 90)}
            onChange={(v) => onConfig({ restSec: v })}
            min={0}
            max={300}
            step={15}
            unit="s"
          />
        </View>

        {isTimed ? (
          <View style={styles.row}>
            <StepField
              label={t('exerciseEditor.fieldMinTime')}
              value={val('minTime', 20)}
              onChange={(v) => onConfig({ minTime: v, maxTime: Math.max(v, val('maxTime', 40)) })}
              min={5} max={300} step={5} unit="s"
            />
            <StepField
              label={t('exerciseEditor.fieldMaxTime')}
              value={val('maxTime', 40)}
              onChange={(v) => onConfig({ maxTime: v, minTime: Math.min(v, val('minTime', 20)) })}
              min={5} max={300} step={5} unit="s"
            />
          </View>
        ) : (
          <View style={styles.row}>
            {/* El rango no puede cruzarse: mover un extremo arrastra al otro en
                vez de dejar "10–6", que la tarjeta pintaría tal cual. */}
            <StepField
              label={t('exerciseEditor.fieldMinReps')}
              value={val('minReps', 8)}
              onChange={(v) => onConfig({ minReps: v, maxReps: Math.max(v, val('maxReps', 12)) })}
              min={1} max={50}
            />
            <StepField
              label={t('exerciseEditor.fieldMaxReps')}
              value={val('maxReps', 12)}
              onChange={(v) => onConfig({ maxReps: v, minReps: Math.min(v, val('minReps', 8)) })}
              min={1} max={50}
            />
          </View>
        )}

        <Text style={styles.hint}>{t('workout.adHocTargetHint')}</Text>
      </View>
    </DragSheet>
  );
}

const makeStyles = (th) => StyleSheet.create({
  body: { gap: spacing.sm, paddingBottom: spacing.sm },
  row:  { flexDirection: 'row', gap: spacing.sm },
  hint: {
    ...textStyles.label,
    color:      th.colors.mutedLight,
    lineHeight: 15,
    marginTop:  spacing.xs2,
  },
});
