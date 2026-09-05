/**
 * ProgramCard — el programa, su etapa y sus tres cifras, en una sola tarjeta.
 *
 * Sale de `AssignedProgramCard` (tab de Programa de la ficha de cliente), que
 * ya era esta tarjeta: mismo bloque nombre + ciclo, misma `StageSegBar`, mismas
 * acciones. Las dos pantallas convergían sin saberlo, así que ahora la
 * comparten (docs/specs/home-sessions.md §4).
 *
 * Solo la TARJETA: los avisos de bloqueo y la sección de próxima sesión se
 * quedan en `ClientsScreen`, que son del tab y no de la tarjeta.
 *
 * Dos colores como la tarjeta de ejercicio del workout: cabecera `surface2`,
 * cuerpo `surface`. Los 14/16 de padding son los de esa tarjeta, no hay token.
 *
 * Dos variantes:
 *   · `self`   (Home)    — eyebrow "Programa" y, si el programa viene de un
 *                          entrenador, la línea "● por Fulano" en AZUL. Sin
 *                          entrenador detrás la línea no existe y la tarjeta
 *                          encoge: no se rellena con "creado por ti".
 *   · `client` (ficha)   — eyebrow "Programa asignado"; aquí el entrenador ES
 *                          el autor, así que no hay línea de autoría.
 *
 * El pie de acciones va DENTRO de la tarjeta, no suelto debajo: sueltos podían
 * leerse como acciones de pantalla y no del programa.
 */
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { spacing, textStyles, borders } from '../../theme';
import { useTheme, useThemedStyles } from '../../useTheme';
import StageSegBar from './StageSegBar';

// Track de la barra de etapas, sin token propio (mismo caso que el #b8ff00 de
// la Home): `surface2` no se veía y `mutedLight` competía con el relleno. Es el
// punto medio exacto entre los dos.
const STAGE_TRACK = '#545454';

// Una caja de dato mide ~86px en un móvil estrecho: el texto se encoge antes de
// truncarse. Mismo recurso que las Progress cards.
const FIT = { numberOfLines: 1, adjustsFontSizeToFit: true, minimumFontScale: 0.7 };

/**
 * El bloque de etapa es pulsable solo donde lleva a algún sitio: en la Home
 * abre el selector de etapa (el gesto que antes vivía en el banner), y en la
 * ficha de cliente no hay nada que elegir desde aquí.
 */
function StageWrap({ onPress, style, children }) {
  if (!onPress) return <View style={style}>{children}</View>;
  return (
    <TouchableOpacity style={style} onPress={onPress} activeOpacity={0.7} accessibilityRole="button">
      {children}
    </TouchableOpacity>
  );
}

export default function ProgramCard({
  variant = 'self',
  name, cycleNum, trainerName,
  stage, stageRatios, stageNote,
  adherence, adherenceColor, pace, loadPct,
  onEdit, onView, onMore, onCycleInfo, onStagePress,
}) {
  const { t, i18n } = useTranslation();
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  const isEs   = i18n.language?.startsWith('es');

  // El ritmo se redondea a medios ciclos: "1,2 cic/sem" con dos decimales es
  // una precisión que el dato no tiene.
  const paceRounded = pace != null ? Math.round(pace * 2) / 2 : null;
  const paceStr = paceRounded == null || paceRounded <= 0
    ? null
    : Number.isInteger(paceRounded)
      ? String(paceRounded)
      : paceRounded.toFixed(1).replace('.', isEs ? ',' : '.');

  return (
    <View style={styles.card}>

      <View style={styles.head}>
        <View style={styles.headName}>
          <Text style={styles.eyebrow}>
            {variant === 'client' ? t('programCard.eyebrowClient') : t('programCard.eyebrowSelf')}
          </Text>
          <Text style={styles.name} numberOfLines={1}>{name}</Text>
          {/* Azul = entrenador, sin excepciones. */}
          {variant === 'self' && !!trainerName && (
            <View style={styles.by}>
              <View style={styles.byDot} />
              <Text style={styles.byText} numberOfLines={1}>
                {t('home.bannerBy')} <Text style={styles.byName}>{trainerName}</Text>
              </Text>
            </View>
          )}
        </View>
        <View style={styles.headCycle}>
          {/* El disparador es la ETIQUETA y no el bloque (misma regla que
              `InfoLabel` en Progreso): abre la ficha del apartado, no el
              glosario entero. Sin ⓘ — la etiqueta ya invita a pulsarla. */}
          {onCycleInfo ? (
            <TouchableOpacity onPress={onCycleInfo} hitSlop={10} activeOpacity={0.7}>
              <Text style={styles.eyebrowRight}>{t('home.cycle')}</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.eyebrowRight}>{t('home.cycle')}</Text>
          )}
          <Text style={styles.cycleNum}>{String(cycleNum).padStart(2, '0')}</Text>
        </View>
      </View>

      <View style={styles.body}>
        {stage && (
          <StageWrap style={styles.stage} onPress={onStagePress}>
            <View style={styles.stageRow}>
              <Text style={styles.stageName} numberOfLines={1}>
                {stage.label}
                {stage.name && stage.name !== stage.label
                  ? <Text style={styles.stageOwnName}>{` · ${stage.name}`}</Text>
                  : null}
              </Text>
              <Text style={styles.stageMeta}>
                {stage.totalWeeks == null
                  ? t('home.cycleProgressOpen', { current: stage.weekInStage })
                  : t('home.cycleProgress', { current: stage.weekInStage, total: stage.totalWeeks })}
              </Text>
            </View>
            {/* Un segmento por ciclo de la etapa: pasados al 100%, el actual a
                la fracción de sesiones hechas del ciclo, los futuros vacíos.
                Sin techo de ciclos no hay tira que dibujar. */}
            {!!stageRatios?.length && (
              <StageSegBar ratios={stageRatios} trackColor={STAGE_TRACK} fillColor={th.colors.accent} />
            )}
            {!!stageNote && <Text style={styles.stageMeta}>{stageNote}</Text>}
          </StageWrap>
        )}

        {/* Las 3 cajas se reparten el ancho a partes iguales, así que en un móvil
            estrecho quedan ~86px de contenido: valor y etiqueta llevan
            `adjustsFontSizeToFit` para que ninguna se parta ni se trunque. */}
        <View style={[styles.stats, !stage && { marginTop: 0 }]}>
          <View style={styles.stat}>
            {/* La adherencia es el único de los 3 que emite un veredicto, así
                que es el único que se colorea cuando pide atención. */}
            <Text style={[styles.statVal, adherenceColor && { color: adherenceColor }]} {...FIT}>
              {adherence != null ? adherence : '—'}
              {adherence != null && <Text style={styles.statUnit}>%</Text>}
            </Text>
            <Text style={styles.statKey} {...FIT}>{t('programCard.statAdherence')}</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statVal} {...FIT}>
              {paceStr ?? '—'}
              <Text style={styles.statUnit}> {t('programCard.cyclesPerWeek')}</Text>
            </Text>
            <Text style={styles.statKey} {...FIT}>{t('programCard.statPace')}</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statVal} {...FIT}>
              {loadPct != null ? `${loadPct > 0 ? '+' : ''}${loadPct}` : '—'}
              {loadPct != null && <Text style={styles.statUnit}>%</Text>}
            </Text>
            <Text style={styles.statKey} {...FIT}>{t('programCard.statLoad')}</Text>
          </View>
        </View>
      </View>

      {/* Pie: tres celdas divididas por el mismo filete que cierra el cuerpo.
          Sin `onEdit` (programa de entrenador en la Home) VER ocupa el hueco. */}
      <View style={styles.foot}>
        {!!onEdit && (
          <TouchableOpacity style={styles.footCell} onPress={onEdit} activeOpacity={0.7} accessibilityRole="button">
            <Text style={styles.footText} numberOfLines={1}>{t('programCard.edit')}</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.footCell, !!onEdit && styles.footDivider]}
          onPress={onView}
          activeOpacity={0.7}
          accessibilityRole="button"
        >
          <Text style={styles.footText} numberOfLines={1}>{t('programCard.view')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.footCell, styles.footIcon, styles.footDivider]}
          onPress={onMore}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={t('home.moreOptions')}
        >
          <Text style={styles.footIconText}>⋯</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const makeStyles = (th) => StyleSheet.create({
  card: {
    backgroundColor: th.colors.surface,
    borderRadius:    th.radius.lg,
    overflow:        'hidden',
  },

  head: {
    flexDirection:     'row',
    alignItems:        'flex-start',
    gap:               spacing.md,
    backgroundColor:   th.colors.surface2,
    paddingVertical:   14,
    paddingHorizontal: 16,
  },
  headName:  { flex: 1, minWidth: 0 },
  headCycle: { flexShrink: 0, alignItems: 'flex-end' },
  eyebrow: {
    ...textStyles.spacingTag,
    color:         th.colors.mutedLight,
    textTransform: 'uppercase',
  },
  // El tracking de `spacing-tag` deja un hueco DETRÁS de la última letra que RN
  // no mete en el ancho medido, así que alineado a la derecha se comía la "O"
  // de CICLO. El padding lo absorbe y el margen negativo devuelve la alineación.
  eyebrowRight: {
    ...textStyles.spacingTag,
    color:         th.colors.mutedLight,
    textTransform: 'uppercase',
    paddingRight:  spacing.xs,
    marginRight:   -spacing.xs,
  },
  name: {
    ...textStyles.hero,
    color:     th.colors.text,
    marginTop: -spacing.xs,
  },
  cycleNum: {
    ...textStyles.hero,
    color:       th.colors.accent,
    marginTop:   -spacing.xs,
    fontVariant: ['tabular-nums'],
  },
  by:     { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm2 },
  byDot:  { width: 5, height: 5, borderRadius: 2.5, backgroundColor: th.colors.blue, flexShrink: 0 },
  byText: { ...textStyles.subtitle, color: th.colors.mutedLight, flexShrink: 1 },
  byName: { ...textStyles.cardType, letterSpacing: 0, color: th.colors.blue },

  body: {
    paddingTop:        14,
    paddingHorizontal: 16,
    paddingBottom:     16,
  },
  stage:    { gap: spacing.sm },
  stageRow: {
    flexDirection: 'row',
    alignItems:    'baseline',
    gap:           spacing.sm2,
  },
  stageName: {
    ...textStyles.spacingTag,
    color:         th.colors.mutedLight,
    textTransform: 'uppercase',
    flexShrink:    1,
  },
  // "ETAPA 1" se queda de etiqueta; el nombre propio de la etapa es el dato.
  stageOwnName: { color: th.colors.text },
  stageMeta: {
    ...textStyles.subtitle,
    color:      th.colors.mutedLight,
    marginLeft: 'auto',
  },
  stats: {
    flexDirection: 'row',
    gap:           spacing.sm,
    marginTop:     spacing.lg,
  },
  stat: {
    flex:            1,
    minWidth:        0,
    backgroundColor: th.colors.bg,
    borderRadius:    th.radius.md,
    padding:         spacing.md,
  },
  statVal: {
    ...textStyles.cardTitle,
    color:       th.colors.text,
    fontVariant: ['tabular-nums'],
  },
  statUnit: {
    ...textStyles.subtitle,
    color: th.colors.mutedLight,
  },
  statKey: {
    ...textStyles.spacingTag,
    color:     th.colors.muted,
    marginTop: 3,
  },

  foot: {
    flexDirection:  'row',
    borderTopWidth: borders.thin,
    borderTopColor: th.colors.border,
  },
  footCell: {
    flex:           1,
    height:         46,
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            spacing.sm2,
    overflow:       'hidden',
  },
  footDivider: {
    borderLeftWidth: borders.thin,
    borderLeftColor: th.colors.border,
  },
  footText: { ...textStyles.cardType, color: th.colors.text },
  footIcon: { flex: 0, width: 52 },
  footIconText: {
    fontSize:   16,
    fontWeight: '900',
    color:      th.colors.mutedLight,
    lineHeight: 18,
  },
});
