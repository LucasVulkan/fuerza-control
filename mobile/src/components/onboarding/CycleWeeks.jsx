/**
 * CycleWeeks — «Cómo se reparte»: una fila por semana con un cuadrado por
 * sesión. Sustituye a `WeekStrip` (spec onboarding-simple.md §6.3.3): sin
 * iniciales de días de la semana, porque el programa no impone qué día
 * entrenas — sólo el orden del ciclo.
 *
 * Sin nodo en Figma. Anatomía: fila `surface`/radio `sm`, etiqueta
 * `SEMANA N` en `smallBold` (mismo tratamiento que `statLabel` de
 * ProgramDetailScreen), cuadrados de sesión en `surface2` con la letra en el
 * color del día.
 */
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { textStyles, spacing } from '../../theme';
import { useTheme, useThemedStyles } from '../../useTheme';
import { resolveColor } from '../../themes';
import { weekPattern } from '../../utils/weekPattern';

const SQUARE = 26;

export default function CycleWeeks({ templates, daysPerWeek }) {
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { t }  = useTranslation();

  const sessionCount = templates.length;
  if (sessionCount === 0) return null;

  // Dos filas cuando el ciclo no cierra en una semana exacta; si
  // `daysPerWeek` es múltiplo de `sessionCount` la semana 2 repite la 1 al
  // dedillo y una sola fila ya lo dice todo.
  const weeksToShow = daysPerWeek % sessionCount !== 0 ? 2 : 1;

  return (
    <View style={styles.wrap}>
      {Array.from({ length: weeksToShow }, (_, weekIndex) => {
        const sessions = weekPattern(daysPerWeek, sessionCount, weekIndex)
          .filter((session) => session != null);

        return (
          <View key={weekIndex} style={styles.row}>
            <Text style={styles.label} numberOfLines={1}>
              {t('onboarding.preview.weekLabel', { n: weekIndex + 1, defaultValue: `SEMANA ${weekIndex + 1}` })}
            </Text>
            <View style={styles.dots}>
              {sessions.map((session, i) => {
                const tpl   = templates[session];
                const color = resolveColor(th, tpl?.color ?? 'var(--day1)');
                return (
                  <View key={i} style={styles.square}>
                    <Text style={[styles.squareLabel, { color }]}>
                      {tpl?.label ?? String.fromCharCode(65 + session)}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const makeStyles = (th) => StyleSheet.create({
  wrap: { gap: spacing.sm },
  row: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing.md,
    backgroundColor:   th.colors.surface,
    borderRadius:      th.radius.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical:   spacing.sm2,
  },
  label: { ...textStyles.smallBold, fontSize: 11, color: th.colors.mutedLight },
  dots:  { flexDirection: 'row', gap: spacing.sm, marginLeft: 'auto' },
  square: {
    width:           SQUARE,
    height:          SQUARE,
    borderRadius:    th.radius.xs,
    backgroundColor: th.colors.surface2,
    alignItems:      'center',
    justifyContent:  'center',
  },
  // Sin cita exacta en §4: se sigue el tratamiento del badge de sesión ya
  // migrado (`previewSessionBadgeText`/`sessionChipLabel` de esta misma
  // pantalla) para la letra del día dentro de un cuadrado pequeño.
  squareLabel: { ...textStyles.cardType },
});
