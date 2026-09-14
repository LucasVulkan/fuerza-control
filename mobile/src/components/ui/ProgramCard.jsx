/**
 * ProgramCard — el programa, dónde vas y sus tres cifras, en una sola tarjeta.
 *
 * Sale de `AssignedProgramCard` (tab de Programa de la ficha de cliente), que
 * ya era esta tarjeta: mismo bloque nombre + ciclo, misma barra de etapa, mismas
 * acciones. Las dos pantallas convergían sin saberlo, así que ahora la
 * comparten (docs/specs/home-sessions.md §4).
 *
 * ── Una sola superficie ────────────────────────────────────────────────────
 *
 * Antes la cabecera iba en `surface2` y el cuerpo en `surface`, como la tarjeta
 * de ejercicio del workout. La banda separaba bien pero metía un segundo color
 * en una tarjeta que ya tiene lima, azul y tres grises de texto: ahora la
 * tarjeta es UNA superficie y lo que separa nombre de etapa es un filete de 1px
 * a sangre. El resto de la jerarquía la hace el aire.
 *
 * ── Dos zonas pulsables, no un pie de botones ──────────────────────────────
 *
 * El pie EDITAR/VER murió en la Home: la zona del nombre lleva al visualizador
 * (y de ahí se edita) y la zona de etapa abre el selector. Son dos objetivos
 * distintos dentro de la misma tarjeta, así que cada uno se ilumina por su
 * cuenta al pulsarlo — si se iluminara la tarjeta entera nadie aprendería que
 * son dos sitios. El chevron va pegado a la ceja y no al nombre: dice que la
 * tarjeta se pulsa sin competir con el título.
 *
 * El pie sigue existiendo para la ficha de cliente, donde la tarjeta NO es
 * navegable (es el contenido del tab) y el "⋯" guarda las diez acciones del
 * entrenador. Se pinta solo si llega alguna de sus tres funciones.
 *
 * ── Progreso: barra de etapas + puntos de ciclo ────────────────────────────
 *
 * Dos preguntas, dos objetos. La barra es el PROGRAMA entero: un tramo por
 * etapa, de ancho proporcional a sus ciclos, con las cumplidas en lima apagado
 * y la de ahora en lima sólido. Los puntos son los CICLOS de la etapa actual,
 * que son tres o cuatro y se cuentan de un vistazo. Antes ambas cosas
 * compartían una sola barra de ciclos y no había forma de saber por dónde ibas
 * del programa.
 *
 * Dos variantes:
 *   · `self`   (Home)    — eyebrow "Tu programa" y, si el programa viene de un
 *                          entrenador, la línea "● por Fulano" en AZUL. Sin
 *                          entrenador detrás la línea no existe y la tarjeta
 *                          encoge: no se rellena con "creado por ti".
 *   · `client` (ficha)   — eyebrow "Programa asignado"; aquí el entrenador ES
 *                          el autor, así que no hay línea de autoría.
 */
import { useEffect, useState } from 'react';
import { View, Pressable, TouchableOpacity, StyleSheet } from 'react-native';
import { Text } from './Text';
import Reanimated, {
  useSharedValue, useAnimatedStyle, withTiming, interpolateColor,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { MenuIcon } from './EditorIcons';
import { spacing, textStyles, borders } from '../../theme';
import { useTheme, useThemedStyles } from '../../useTheme';

// El padding de la tarjeta de ejercicio del workout, que es de donde salió esta
// tarjeta. No cae en ningún token de `space/*`.
const PAD = 16;

// Una caja de dato mide ~100px en un móvil estrecho: el texto se encoge antes
// de truncarse. Mismo recurso que las Progress cards.
const FIT = { numberOfLines: 1, adjustsFontSizeToFit: true, minimumFontScale: 0.7 };

/**
 * Zona pulsable de la tarjeta. Se tiñe de `surface2` al pulsar y vuelve al
 * fondo de la tarjeta al soltar — nada de cambios en seco (regla general del
 * rediseño). Sin `onPress` es una `View` normal y no hay nada que animar.
 */
function PressZone({ onPress, style, accessibilityLabel, children }) {
  const th = useTheme();
  const [pressed, setPressed] = useState(false);
  const p = useSharedValue(0);

  // Los worklets solo pueden capturar valores serializables — `th` lleva
  // funciones dentro, así que se extraen los colores a strings sueltos
  // (mismo motivo que en `EditorRows`).
  const tintColors = [th.colors.surface, th.colors.surface2];

  // Entra rápido y sale despacio: el dedo ya está encima cuando se ilumina, y
  // al soltar la marca tiene que durar lo justo para verse.
  useEffect(() => {
    p.value = withTiming(pressed ? 1 : 0, { duration: pressed ? 90 : 160 });
  }, [pressed, p]);

  const tint = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(p.value, [0, 1], tintColors),
  }));

  if (!onPress) return <View style={style}>{children}</View>;

  return (
    <Pressable
      onPress={onPress}
      onPressIn={()  => setPressed(true)}
      onPressOut={() => setPressed(false)}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <Reanimated.View style={[style, tint]}>{children}</Reanimated.View>
    </Pressable>
  );
}

export default function ProgramCard({
  variant = 'self',
  name, cycleNum, trainerName,
  stage, stages, stageIdx = 0, stageNote,
  adherence, adherenceColor, pace, loadPct,
  onPress, onStagePress, onCycleInfo,
  onEdit, onView, onMore,
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

  // Con una sola etapa no hay nada que situar: la barra mediría el programa
  // entero contra sí mismo.
  const showBar  = (stages?.length ?? 0) > 1;
  // Sin techo de ciclos no hay puntos que contar (etapa abierta).
  const showPips = stage?.totalWeeks != null;
  const hasFoot  = !!(onEdit || onView || onMore);

  return (
    <View style={styles.card}>

      {/* ── Zona de nombre — lleva al programa ── */}
      <PressZone style={styles.head} onPress={onPress} accessibilityLabel={name}>
        <View style={styles.headName}>
          <View style={styles.eyebrowRow}>
            <Text style={styles.eyebrow}>
              {variant === 'client' ? t('programCard.eyebrowClient') : t('programCard.eyebrowSelf')}
            </Text>
            {/* La única señal de que la tarjeta se pulsa. Pegado a la ceja y en
                `muted`: al lado del nombre competiría con él. */}
            {!!onPress && <Text style={styles.eyebrowChevron}>›</Text>}
          </View>
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
      </PressZone>

      {/* Lo que hacía la banda de color, con una línea de 1px a sangre. */}
      {!!stage && <View style={styles.rule} />}

      {/* ── Zona de etapa — abre el selector ── */}
      {!!stage && (
        <PressZone
          style={styles.stage}
          onPress={onStagePress}
          accessibilityLabel={t('home.selectStage')}
        >
          <View style={styles.stageRow}>
            <Text style={styles.stageName} numberOfLines={1}>
              <Text style={styles.stageLabel}>{stage.label}</Text>
              {stage.name && stage.name !== stage.label ? ` ${stage.name}` : ''}
            </Text>
            {/* Un punto por ciclo de la etapa; el ciclo en curso ya cuenta como
                encendido, que es lo que dice el número grande de la cabecera. */}
            {showPips && (
              <View style={styles.pips}>
                {Array.from({ length: stage.totalWeeks }, (_, i) => (
                  <View key={i} style={[styles.pip, i < stage.weekInStage && styles.pipOn]} />
                ))}
              </View>
            )}
          </View>

          {/* Un tramo por etapa, de ancho proporcional a sus ciclos. La etapa
              abierta (sin techo) pesa 1 para no comerse la barra. */}
          {showBar && (
            <View style={styles.bar}>
              {stages.map((s, i) => (
                <View
                  key={i}
                  style={[
                    styles.seg,
                    { flex: Math.max(1, s.cycles ?? 1) },
                    i <  stageIdx && styles.segDone,
                    i === stageIdx && styles.segNow,
                  ]}
                />
              ))}
            </View>
          )}

          {!!stageNote && <Text style={styles.stageNote}>{stageNote}</Text>}
        </PressZone>
      )}

      {/* ── Las 3 cifras ── sin caja: el aire ya las separa y tres rectángulos
          rellenos eran el ruido más caro de la tarjeta. */}
      <View style={[styles.stats, !stage && styles.statsAlone]}>
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

      {/* Pie: solo donde la tarjeta no es navegable (ficha de cliente). Sin
          `onEdit` VER ocupa el hueco. */}
      {hasFoot && (
        <View style={styles.foot}>
          {!!onEdit && (
            <TouchableOpacity style={styles.footCell} onPress={onEdit} activeOpacity={0.7} accessibilityRole="button">
              <Text style={styles.footText} numberOfLines={1}>{t('programCard.edit')}</Text>
            </TouchableOpacity>
          )}
          {!!onView && (
            <TouchableOpacity
              style={[styles.footCell, !!onEdit && styles.footDivider]}
              onPress={onView}
              activeOpacity={0.7}
              accessibilityRole="button"
            >
              <Text style={styles.footText} numberOfLines={1}>{t('programCard.view')}</Text>
            </TouchableOpacity>
          )}
          {!!onMore && (
            <TouchableOpacity
              style={[styles.footCell, styles.footIcon, (!!onEdit || !!onView) && styles.footDivider]}
              onPress={onMore}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={t('home.moreOptions')}
            >
              <MenuIcon horizontal color={th.colors.mutedLight} />
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

const makeStyles = (th) => StyleSheet.create({
  card: {
    backgroundColor: th.colors.surface,
    borderRadius:    th.radius.lg,
    overflow:        'hidden',
  },

  // ── Zona de nombre ──────────────────────────────────────────────────────────
  head: {
    flexDirection: 'row',
    alignItems:    'flex-start',
    gap:           spacing.md,
    padding:       PAD,
  },
  headName:   { flex: 1, minWidth: 0 },
  headCycle:  { flexShrink: 0, alignItems: 'flex-end' },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs2 },
  eyebrow: {
    ...textStyles.caps,
    color:         th.colors.mutedLight,
    textTransform: 'uppercase',
  },
  eyebrowChevron: {
    ...textStyles.caps,
    fontFamily: 'Inter_900Black',
    lineHeight: 13,
    color:      th.colors.mutedLight,
  },
  // El tracking de `spacing-tag` deja un hueco DETRÁS de la última letra que RN
  // no mete en el ancho medido, así que alineado a la derecha se comía la "O"
  // de CICLO. El padding lo absorbe y el margen negativo devuelve la alineación.
  eyebrowRight: {
    ...textStyles.caps,
    color:         th.colors.mutedLight,
    textTransform: 'uppercase',
    paddingRight:  spacing.xs,
    marginRight:   -spacing.xs,
  },
  // El nombre del programa y el contador de ciclos hablan como los nombres de
  // las sesiones de la lista de abajo (`itemTitle`): es la misma pantalla y son
  // el mismo tipo de dato. A `title` (22) la tarjeta competía con el hero.
  name: {
    ...textStyles.itemTitle,
    color:     th.colors.text,
    marginTop: -spacing.xs,
  },
  cycleNum: {
    ...textStyles.itemTitle,
    color:       th.colors.accent,
    marginTop:   -spacing.xs,
    fontVariant: ['tabular-nums'],
  },
  by:     { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm2 },
  byDot:  { width: 5, height: 5, borderRadius: 2.5, backgroundColor: th.colors.blue, flexShrink: 0 },
  byText: { ...textStyles.body, color: th.colors.mutedLight, flexShrink: 1 },
  byName: { ...textStyles.labelStrong, letterSpacing: 0, color: th.colors.blue },

  rule: { height: borders.thin, backgroundColor: th.colors.border },

  // ── Zona de etapa ───────────────────────────────────────────────────────────
  stage:    { paddingHorizontal: PAD, paddingTop: PAD, paddingBottom: PAD },
  stageRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.sm2,
  },
  // "ETAPA 1 · Fuerza": es un nombre, no una etiqueta, y en `caps` mayúsculo
  // competía con la ceja. A 14 — a 12 quedaba por debajo del resto de la tarjeta.
  stageName:  { ...textStyles.bodyStrong, color: th.colors.text, flexShrink: 1 },
  stageLabel: { color: th.colors.accent },

  pips: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginLeft: 'auto', flexShrink: 0 },
  pip:  { width: 7, height: 7, borderRadius: 3.5, backgroundColor: th.colors.border },
  pipOn: { backgroundColor: th.colors.accent },

  bar: { flexDirection: 'row', gap: spacing.xs2, marginTop: spacing.md },
  seg: {
    height:          spacing.sm,
    borderRadius:    spacing.sm / 2,
    backgroundColor: th.colors.border,
  },
  segDone: { backgroundColor: th.tint.accent50 },
  segNow:  { backgroundColor: th.colors.accent },

  stageNote: { ...textStyles.body, color: th.colors.mutedLight, marginTop: spacing.sm2 },

  // ── Cifras ──────────────────────────────────────────────────────────────────
  stats: {
    flexDirection:     'row',
    gap:               spacing.sm,
    paddingHorizontal: PAD,
    paddingBottom:     PAD,
    marginTop:         spacing.sm,
  },
  // Sin etapa encima, el aire lo tiene que poner la fila de cifras.
  statsAlone: { marginTop: 0, paddingTop: spacing.sm },
  stat:       { flex: 1, minWidth: 0 },
  statVal: {
    ...textStyles.itemTitle,
    color:       th.colors.text,
    fontVariant: ['tabular-nums'],
  },
  statUnit: {
    ...textStyles.label,
    color: th.colors.mutedLight,
  },
  statKey: {
    ...textStyles.caps,
    color:         th.colors.muted,
    textTransform: 'uppercase',
    marginTop:     spacing.xs2,
  },

  // ── Pie (solo ficha de cliente) ─────────────────────────────────────────────
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
  footText: { ...textStyles.labelStrong, color: th.colors.text },
  footIcon: { flex: 0, width: 52 },
});
