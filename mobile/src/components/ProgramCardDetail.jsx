/**
 * ProgramCardDetail — lo que la tarjeta del programa (`HomeProgramCard`) lleva
 * debajo de su fila cuando no está en Inicio (docs/specs/U14-pantalla-programa.md §4.2):
 * «Esta etapa» y las tres cifras, separados por cortes del color
 * del fondo como la diagonal de arriba.
 *
 * Lo pintan el tab Programa (desplegándolo) y la ficha de cliente del entrenador
 * (quieto): el atleta y su entrenador ven la misma tarjeta.
 */
import { View, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Text } from './ui/Text';
import { WeekTicks } from './ProgramStages';
import { isDeload } from '../utils/stageStats';
import { spacing, textStyles } from '../theme';
import { useTheme, useThemedStyles } from '../useTheme';

/**
 * «Esta etapa»: número y nombre a la izquierda; a la derecha la semana de la
 * etapa con sus tramos. La misma forma que la fila del programa de encima.
 */
function ThisStage({ status, note }) {
  const { t }  = useTranslation();
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { stage, stageIdx } = status;
  const tone = isDeload(stage) ? th.colors.blue : th.colors.accent;

  const week = !status.started ? t('programCard.stageNotStarted')
    : status.lengthWeeks == null ? t('programCard.stageWeekOpen', { week: status.weekInStage })
    : t('myProgram.stageWeekShort', { week: status.weekInStage, total: status.lengthWeeks });

  return (
    <>
      <View style={styles.thisStage}>
        <View style={styles.thisStageLeft}>
          <Text style={styles.caps} numberOfLines={1}>{t('myProgram.thisStage').toUpperCase()}</Text>
          {/* Sin nombre propio ya dice «Etapa 2»: el número delante sobraría. */}
          <Text style={styles.thisStageName} numberOfLines={1}>
            {!!stage.name && <Text style={[styles.thisStageName, { color: tone }]}>{`${stageIdx + 1} `}</Text>}
            {stage.name ?? t('home.stageDefault', { n: stageIdx + 1 })}
          </Text>
        </View>
        <View style={styles.thisStageRight}>
          <Text style={styles.caps} numberOfLines={1}>{week.toUpperCase()}</Text>
          {status.lengthWeeks != null && (
            <WeekTicks total={status.lengthWeeks} on={status.started ? status.weekInStage : 0} color={tone} />
          )}
        </View>
      </View>
      {!!note && <Text style={styles.note}>{note}</Text>}
    </>
  );
}

// Una caja de dato mide ~100 dp en un móvil estrecho: el texto se encoge antes
// de truncarse.
const FIT = { numberOfLines: 1, adjustsFontSizeToFit: true, minimumFontScale: 0.7 };

/**
 * `program` y `status` (de `stageStatus`, con el progreso de quien entrena).
 * `adherence` (% de 4 semanas), `pace` (sesiones por semana) y `loadPct` pueden
 * ser null: sale «—». `note`: una línea bajo la etapa (p. ej. «terminó la etapa
 * y sigue en ella», en la ficha de cliente).
 */
export default function ProgramCardDetail({ program, status, adherence, pace, loadPct, note }) {
  const { t, i18n } = useTranslation();
  const styles = useThemedStyles(makeStyles);

  // Con una sola etapa el programa no está periodizado: no hay etapa que
  // contar, tenga límite de semanas o no (P14 §5.6, 15-oct).
  const showStage = !!status?.stage && (program.stages?.length ?? 0) > 1;

  // El ritmo se redondea a medias: «1,25 ses/sem» es una precisión que el dato no tiene.
  const half = pace != null && pace > 0 ? Math.round(pace * 2) / 2 : null;
  const paceStr = half == null ? null
    : Number.isInteger(half) ? String(half)
    : half.toFixed(1).replace('.', i18n.language?.startsWith('es') ? ',' : '.');

  // Sin color en ninguna: el «en riesgo» de `computeAdherence` mide los días
  // desde la última sesión, no el porcentaje, y pintaba de rojo un 100 %.
  const stats = [
    { key: t('programCard.statAdherence'), value: adherence, unit: '%' },
    { key: t('programCard.statPace'),      value: paceStr,   unit: ` ${t('programCard.sessionsPerWeek')}` },
    { key: t('programCard.statLoad'),      value: loadPct == null ? null : `${loadPct > 0 ? '+' : ''}${loadPct}`, unit: '%' },
  ];

  return (
    <>
      <View style={styles.cut} />
      <View style={styles.body}>
        {showStage && <ThisStage status={status} note={note} />}
        {showStage && <View style={[styles.cut, styles.cutMid]} />}
        <View style={styles.stats}>
          {stats.map(({ key, value, unit }) => (
            <View key={key} style={styles.stat}>
              <Text style={styles.statVal} {...FIT}>
                {value ?? '—'}
                {value != null && <Text style={styles.statUnit}>{unit}</Text>}
              </Text>
              <Text style={styles.caps} {...FIT}>{key.toUpperCase()}</Text>
            </View>
          ))}
        </View>
      </View>
    </>
  );
}

const makeStyles = (th) => StyleSheet.create({
  caps: { ...textStyles.caps, color: th.colors.mutedLight },


  // 4 dp, el ancho de la diagonal: las tres líneas del fondo se leen como una.
  cut:    { height: spacing.xs2, backgroundColor: th.colors.bg },
  cutMid: { marginHorizontal: -spacing.lg, marginVertical: 14 },
  body:   { paddingHorizontal: spacing.lg, paddingTop: 14, paddingBottom: spacing.lg },

  thisStage:      { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  thisStageLeft:  { flex: 1, minWidth: 0 },
  thisStageName:  { ...textStyles.itemTitle, color: th.colors.text, marginTop: spacing.xs2 },
  thisStageRight: { alignItems: 'flex-end', gap: spacing.sm2 + 1, flexShrink: 0 },
  note:           { ...textStyles.body, color: th.colors.mutedLight, marginTop: spacing.sm2 },

  stats: { flexDirection: 'row', gap: spacing.sm2 },
  stat:  { flex: 1, minWidth: 0, alignItems: 'center' },
  // La Barlow pide 1.2 em para no cortarse, y 2 de aire a la derecha para la cursiva.
  statVal: {
    ...textStyles.heroName,
    lineHeight:         34,
    includeFontPadding: false,
    paddingRight:       2,
    color:              th.colors.text,
    fontVariant:        ['tabular-nums'],
    textAlign:          'center',
  },
  statUnit: { ...textStyles.label, color: th.colors.mutedLight },
});
