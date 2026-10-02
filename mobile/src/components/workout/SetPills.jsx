/**
 * SetPills — las series de un ejercicio como «peso x» + pastillas de reps/RPE.
 *
 * Salió de `pillsBlock` (la tarjeta plegada de `ExerciseCard`) para que la usen
 * también la ficha de la recomendación (la última vez, progresion-clara §6.3) y
 * la última vez en línea o por serie (P57). Misma lógica y estilo que
 * HistoryScreen (`groupSetsByWeight` + `getPillVariant` + `buildSetLabel`);
 * única diferencia: aquí «fuera de rango» es ROJO (pedido del usuario).
 *
 * `neutral` quita el color de dentro y fuera de rango y deja las pastillas
 * sobre `surface2`: es lo que se hizo, no una valoración (la última vez).
 *
 * Sin padding propio: quien la pone decide el hueco.
 */

import { View, StyleSheet } from 'react-native';
import { Text } from '../ui/Text';
import { useWeightUnit } from '../../hooks/useWeightUnit';
import { groupSetsByWeight, getPillVariant, buildSetLabel } from '../../utils/setDisplay';
import { spacing, textStyles } from '../../theme';
import { useThemedStyles } from '../../useTheme';

const R_SMALL = 9;

export default function SetPills({ sets, exConfig, neutral = false }) {
  const styles = useThemedStyles(makeStyles);
  const { label: weightLabel, toDisplay, fmt } = useWeightUnit();
  // "Kg" capitalizado — misma técnica que HistoryScreen (label crudo viene en minúscula).
  const unitLabel = weightLabel.charAt(0).toUpperCase() + weightLabel.slice(1);

  return (
    <View style={styles.row}>
      {groupSetsByWeight(sets ?? []).map((group, gi) => (
        <View key={`grp-${gi}`} style={styles.setGroup}>
          {group.weight ? (
            <View style={styles.weightPill}>
              <Text style={styles.weightPillText}>
                <Text style={neutral ? styles.weightPillNumNeutral : styles.weightPillNum}>{toDisplay(group.weight)}</Text>
                <Text style={styles.weightPillUnit}>{unitLabel}</Text>
                <Text style={styles.weightPillX}>{' x'}</Text>
              </Text>
            </View>
          ) : null}
          {group.sets.map((s, i) => {
            const variant = neutral ? 'empty' : getPillVariant(s, exConfig);
            const { main, rpeNum } = buildSetLabel(s, i, fmt, true);
            return (
              <View
                key={`set-${gi}-${i}`}
                style={[
                  styles.setPill,
                  neutral && styles.setPillNeutral,
                  variant === 'done'    && styles.setPillDone,
                  variant === 'partial' && styles.setPillPartial,
                ]}
              >
                <Text
                  style={[
                    styles.setPillText,
                    variant === 'done'    && styles.setPillTextDone,
                    variant === 'partial' && styles.setPillTextPartial,
                  ]}
                >
                  {main}
                  {rpeNum ? (
                    <>
                      <Text
                        style={[
                          styles.setPillRpeAt,
                          variant === 'done'    && styles.setPillRpeAtDone,
                          variant === 'partial' && styles.setPillRpeAtPartial,
                        ]}
                      >
                        @
                      </Text>
                      {rpeNum}
                    </>
                  ) : null}
                </Text>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const makeStyles = (th) => StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           8,
  },
  setGroup: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.xs,
  },
  weightPill: {
    paddingVertical: spacing.sm,
  },
  weightPillText: {
    ...textStyles.label,
  },
  weightPillNum:        { color: th.colors.accent },
  weightPillNumNeutral: { color: th.colors.text },
  weightPillUnit: { color: th.colors.text },
  weightPillX:    { color: th.colors.mutedLight },

  setPill: {
    backgroundColor: th.colors.bg,
    borderRadius:    R_SMALL,
    paddingHorizontal: 8,
    paddingVertical:   6,
  },
  // Sobre la hoja (`bg`) y sobre la tarjeta (`surface`) la pastilla de `bg` no se vería.
  setPillNeutral: {
    backgroundColor: th.colors.surface2,
  },
  setPillDone: {
    backgroundColor: th.tint.accent10,
  },
  setPillPartial: {
    backgroundColor: th.tint.red30,
  },
  setPillText: {
    ...textStyles.label,
    color: th.colors.mutedLight,
  },
  setPillTextDone: {
    color: th.colors.accent,
  },
  setPillTextPartial: {
    color: th.colors.red,
  },
  // El "@" de "12@8" — más apagado que el resto del número, mismo color base del pill.
  setPillRpeAt:        { color: th.colors.muted },
  setPillRpeAtDone:    { color: th.tint.accent50 },
  setPillRpeAtPartial: { color: th.tint.red50 },
});
