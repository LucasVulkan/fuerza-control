/**
 * HomeProgramCard — dónde estás, arriba de Inicio: el programa a la izquierda y
 * la semana del programa entero a la derecha, tras un corte en diagonal.
 * Figma: «Frame 156» (sin etapas ni duración), «Frame 167» (una etapa con
 * duración) y 515:922 (varias etapas: cada tramo de la barra es una etapa). La
 * etapa en curso va en la ceja, «TU PROGRAMA · ACUMULACIÓN», no sobre la barra.
 *
 * Pulsarla lleva al tab Programa, como el propio tab. Provisional: el reparto
 * entre esta tarjeta y la del tab está por diseñar (U12-02).
 */
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Text } from './ui/Text';
import { athleteProgress, stageStatus } from '../utils/stageProgress';
import { spacing, textStyles, lh, LINE } from '../theme';
import { useThemedStyles } from '../useTheme';

// Semanas del programa entero: la etapa en curso con lo que se haya alargado.
// Sin total si alguna etapa no tiene techo. Las alargadas ya cerradas no dejan
// rastro en el modelo, así que si la semana pasa del total, el total se calla.
function programWeeks(program, status) {
  const stages = program.stages ?? [];
  if (!stages.length || stages.some((s) => s.durationWeeks == null)) return null;
  return stages.reduce((sum, s, i) => sum + (i === status.stageIdx ? status.lengthWeeks : s.durationWeeks), 0);
}

const pad2 = (n) => String(n).padStart(2, '0');

export default function HomeProgramCard({ program, onOpen }) {
  const { t }  = useTranslation();
  const styles = useThemedStyles(makeStyles);

  const status = stageStatus(program, athleteProgress(program));
  const stages = program.stages ?? [];
  const week   = status.programWeek;
  const total  = programWeeks(program, status);
  const showTotal = total != null && (week == null || week <= total);

  // Una sola etapa sin techo es un programa sin periodizar: sin barra (Frame 156).
  const multi   = stages.length > 1;
  const showBar = multi || status.lengthWeeks != null;
  const stageLabel = t('home.stageDefault', { n: status.stageIdx + 1 });
  const stageName  = status.stage?.name;

  // Llenado de la etapa en curso, por semanas. La abierta no tiene techo: va entera.
  const nowFill = !status.started ? 0
    : status.lengthWeeks ? Math.min(1, status.weekInStage / status.lengthWeeks)
    : 1;

  const weekText = week == null
    ? t('programCard.stageNotStarted')
    : showTotal ? t('home.weekProgress', { current: week, total }) : t('programCard.stageWeekOpen', { week });

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onOpen}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={[program.name, weekText, multi && [stageLabel, stageName].filter(Boolean).join(' ')].filter(Boolean).join(', ')}
      accessibilityHint={t('home.openProgram')}
    >
      <View style={styles.left}>
        <Text style={[styles.caps, styles.eyebrow]} numberOfLines={1}>
          {[t('home.yourProgram'), multi && (stageName || stageLabel)].filter(Boolean).join(' · ').toUpperCase()}
        </Text>
        <Text style={styles.name} numberOfLines={2}>{program.name}</Text>

        {/* Pegada al margen de abajo, por si la otra columna sale más alta. */}
        {showBar && (
          <View style={styles.foot}>
            {/* Un tramo por etapa, proporcional a sus semanas (la abierta pesa 1).
                Hechas en tinte; la actual se llena por semanas. */}
            <View style={styles.bar}>
              {stages.map((s, i) => (
                <View
                  key={i}
                  style={[styles.seg, multi && styles.segSkew, { flex: Math.max(1, s.durationWeeks ?? 1) }, i < status.stageIdx && styles.segDone]}
                >
                  {i === status.stageIdx && <View style={[styles.segFill, { width: `${nowFill * 100}%` }]} />}
                </View>
              ))}
            </View>
          </View>
        )}
      </View>

      <View style={styles.right}>
        <View style={styles.cut} />
        <Text style={[styles.caps, styles.eyebrow]} numberOfLines={1}>{t('home.week').toUpperCase()}</Text>
        <View style={styles.weekRow}>
          <Text style={[styles.weekNow, multi && styles.weekNowSkew]}>{week == null ? '–' : pad2(week)}</Text>
          {showTotal && <Text style={styles.weekTotal}>{`/${total}`}</Text>}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const makeStyles = (th) => StyleSheet.create({
  card: {
    flexDirection:   'row',
    backgroundColor: th.colors.surface,
    borderRadius:    th.radius.md,
    overflow:        'hidden',
  },

  left: { flex: 1, padding: spacing.lg },
  caps: { ...textStyles.caps, color: th.colors.mutedLight },
  // Interlineado apretado en ceja y nombre: con el de la fuente quedaban sueltos.
  eyebrow: { lineHeight: lh(textStyles.caps.fontSize, LINE.tight) },
  name: { ...textStyles.heading, color: th.colors.accent, lineHeight: lh(textStyles.heading.fontSize, LINE.tight), marginTop: spacing.xs2 },

  foot: { marginTop: 'auto', paddingTop: spacing.sm },

  bar: { flexDirection: 'row', gap: spacing.xs },
  seg: {
    height:          spacing.sm,
    borderRadius:    1,
    backgroundColor: th.colors.muted,
    overflow:        'hidden',
  },
  segSkew: { transform: [{ skewX: '-12deg' }] },
  segDone: { backgroundColor: th.tint.accent50 },
  segFill: { height: '100%', backgroundColor: th.colors.accent },

  // La semana del programa, tras un corte en diagonal del color del fondo
  // (línea de 4 px a 11° de la vertical en Figma).
  right: {
    // Arriba, con el mismo relleno que la izquierda: SEMANA a la altura de
    // TU PROGRAMA y el contador a la del nombre.
    alignItems:     'flex-end',
    paddingVertical: spacing.lg,
    paddingLeft:    spacing.xxl,
    paddingRight:   spacing.lg,
  },
  cut: {
    position:        'absolute',
    left:            spacing.xs2,
    top:             -spacing.xl,
    bottom:          -spacing.xl,
    width:           4,
    backgroundColor: th.colors.bg,
    transform:       [{ rotate: '11deg' }],
  },
  weekRow:     { flexDirection: 'row', alignItems: 'baseline', marginTop: spacing.xs2 },
  // Mismo interlineado apretado que la ceja y el nombre de la izquierda.
  weekNow:     { ...textStyles.heading, color: th.colors.accent, fontVariant: ['tabular-nums'], lineHeight: lh(textStyles.heading.fontSize, LINE.tight) },
  weekNowSkew: { transform: [{ skewX: '-12deg' }] },
  // El total, con la voz de la ceja: acompaña al número, no compite con él.
  weekTotal:   { ...textStyles.caps, color: th.colors.mutedLight },
});
