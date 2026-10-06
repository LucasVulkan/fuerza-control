/**
 * HomeProgramCard — dónde estás, arriba de Inicio: el programa, la semana que
 * llevas y la barra de etapas. Es orientación, no acción: el nombre va a
 * `heading` (18), por debajo de los 28 de la tarjeta de la que toca, que sigue
 * siendo la única pieza en lima. Maqueta: docs/mockups/home-header.html (A).
 *
 * Pulsarla lleva al tab Programa, como el propio tab. Provisional: el reparto
 * entre esta tarjeta y la del tab está por diseñar (U12-02).
 */
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Text } from './ui/Text';
import { athleteProgress, stageStatus } from '../utils/stageProgress';
import { spacing, textStyles } from '../theme';
import { useThemedStyles } from '../useTheme';

// Semanas del programa entero: la etapa en curso con lo que se haya alargado.
// Sin total si alguna etapa no tiene techo. Las alargadas ya cerradas no dejan
// rastro en el modelo, así que si la semana pasa del total, el total se calla.
function programWeeks(program, status) {
  const stages = program.stages ?? [];
  if (!stages.length || stages.some((s) => s.durationWeeks == null)) return null;
  return stages.reduce((sum, s, i) => sum + (i === status.stageIdx ? status.lengthWeeks : s.durationWeeks), 0);
}

export default function HomeProgramCard({ program, onOpen }) {
  const { t }  = useTranslation();
  const styles = useThemedStyles(makeStyles);

  const status = stageStatus(program, athleteProgress(program));
  const stages = program.stages ?? [];
  const total  = programWeeks(program, status);
  const week   = status.programWeek;

  const weekText = week == null
    ? t('programCard.stageNotStarted')
    : total != null && week <= total
      ? t('home.weekProgress', { current: week, total })
      : t('programCard.stageWeekOpen', { week });

  // Una sola etapa sin techo es un programa sin periodizar: ni etapa ni barra.
  const showStage = stages.length > 1 || status.lengthWeeks != null;
  const stageLabel = t('home.stageDefault', { n: status.stageIdx + 1 });
  const stageName  = status.stage?.name;

  // Llenado de la etapa en curso, por semanas. La abierta no tiene techo: va
  // entera, como en la tarjeta del tab.
  const nowFill = !status.started ? 0
    : status.lengthWeeks ? Math.min(1, status.weekInStage / status.lengthWeeks)
    : 1;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onOpen}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={[program.name, weekText, showStage && [stageLabel, stageName].filter(Boolean).join(' ')].filter(Boolean).join(', ')}
      accessibilityHint={t('home.openProgram')}
    >
      <View style={styles.eyebrowRow}>
        <Text style={styles.eyebrow} numberOfLines={1}>{weekText.toUpperCase()}</Text>
        {showStage && (
          <Text style={[styles.eyebrow, styles.eyebrowRight]} numberOfLines={1}>
            {stageLabel.toUpperCase()}
            {!!stageName && stageName !== stageLabel && (
              <Text style={styles.eyebrowStrong}>{` · ${stageName.toUpperCase()}`}</Text>
            )}
          </Text>
        )}
      </View>

      <Text style={styles.name} numberOfLines={2}>{program.name}</Text>

      {/* Un tramo por etapa, proporcional a sus semanas (la abierta pesa 1, como
          en `ProgramCard`). Hechas en tinte; la actual se llena por semanas. */}
      {showStage && (
        <View style={styles.bar}>
          {stages.map((s, i) => (
            <View
              key={i}
              style={[styles.seg, { flex: Math.max(1, s.durationWeeks ?? 1) }, i < status.stageIdx && styles.segDone]}
            >
              {i === status.stageIdx && <View style={[styles.segFill, { width: `${nowFill * 100}%` }]} />}
            </View>
          ))}
        </View>
      )}

    </TouchableOpacity>
  );
}

const makeStyles = (th) => StyleSheet.create({
  card: {
    backgroundColor:   th.colors.surface,
    borderRadius:      th.radius.sm,
    paddingTop:        spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom:     spacing.lg,
  },
  eyebrowRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm2 },
  eyebrow: {
    ...textStyles.caps,
    color:         th.colors.mutedLight,
    textTransform: 'uppercase',
    flexShrink:    0,
  },
  // Cede ella si no cabe: la semana es lo que se viene a mirar.
  eyebrowRight:  { marginLeft: 'auto', flexShrink: 1 },
  eyebrowStrong: { color: th.colors.text },

  name: { ...textStyles.heading, color: th.colors.text, marginTop: spacing.xs2 },

  bar: { flexDirection: 'row', gap: spacing.xs2, marginTop: spacing.md },
  seg: {
    height:          spacing.sm,
    borderRadius:    spacing.sm / 2,
    backgroundColor: th.colors.border,
    overflow:        'hidden',
  },
  segDone: { backgroundColor: th.tint.accent50 },
  segFill: { height: '100%', borderRadius: spacing.sm / 2, backgroundColor: th.colors.accent },

});
