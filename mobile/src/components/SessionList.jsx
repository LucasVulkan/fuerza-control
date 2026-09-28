/**
 * SessionList — las piezas de la lista de sesiones de Inicio: la tarjeta lima
 * de la que toca (`TodayCard`), las filas plegables (`SessionRow`), sus
 * ejercicios y el rótulo de sección.
 *
 * Salieron de `HomeScreen` sin cambios para que la ficha de un cliente sin app
 * enseñe lo mismo que vería él (trainer-logging.md §3.1): el entrenador hace de
 * su app. Las reglas de diseño están en docs/specs/home-sesiones-plegables.md §5.
 */
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Text } from './ui/Text';
import Svg, { Path } from 'react-native-svg';
import Reanimated, { LinearTransition, FadeIn } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { spacing, textStyles, withOpacity } from '../theme';
import { useTheme, useThemedStyles } from '../useTheme';
import { collapseOut, FOLD_MS } from './ui/collapseOut';
import { targetLabel, exerciseName } from '../utils/prescription';

// Tint base "lima" (#b8ff00) — distinto del accent sólido (#aae216), sin
// token propio (mismo caso que el #81a71e del banner, ver theme.js).
const LIMA = '#b8ff00';

// ── Sesiones ──────────────────────────────────────────────────────────────
//
// Una sola lista en el orden del programa. Cada sesión es una fila plegable y la que
// toca hoy es esa misma fila a otra escala: en lima, con la letra grande y su
// botón puesto. Toda la cabecera abre; SOLO el botón entra a entrenar
// (docs/specs/home-sesiones-plegables.md §5).
//
// El hero suelto que había antes ya no existe: se sacaba de la lista, obligaba a
// elegir entre enseñar los ejercicios o caber en pantalla, y no había manera de
// mirar una sesión sin empezarla.

export function HeroChevron({ size = 13, color = LIMA }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 12 12" fill="none">
      <Path d="M4 2l4.5 4L4 10" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/**
 * Los ejercicios de la sesión, tal cual se los va a encontrar dentro.
 *
 * Deliberadamente sosa —Inter en caja baja, sin filetes y sin lima— para que la
 * cabecera siga siendo lo que canta (§5.4). Los bloques de acondicionamiento van
 * detrás de los ejercicios, con su formato donde las series y sin la pastilla de
 * color del editor, que aquí sería un cuarto acento.
 */
export function ExerciseLines({ template, allExercises }) {
  const { t, i18n } = useTranslation();
  const styles    = useThemedStyles(makeStyles);
  const exercises = template.exercises ?? [];
  const blocks    = template.blocks ?? [];

  const line = (key, idx, name, right) => (
    <View key={key} style={styles.exRow}>
      <Text style={styles.exIdx}>{idx}</Text>
      <Text style={styles.exName} numberOfLines={1}>{name}</Text>
      <Text style={styles.exTarget}>{right}</Text>
    </View>
  );

  return (
    <>
      {exercises.map((ex, i) => {
        const def = allExercises[ex.exerciseId];
        return line(
          `${ex.exerciseId}-${i}`,
          i + 1,
          exerciseName(def, i18n.language, ex.exerciseId),
          targetLabel(def, ex, t, { compact: true }),
        );
      })}
      {blocks.map((block, i) => line(
        `block-${i}`,
        exercises.length + i + 1,
        block.name ?? t(`blocks.formats.${block.format}`),
        t(`blocks.formats.${block.format}`).toUpperCase(),
      ))}
    </>
  );
}

/**
 * Una sesión cualquiera: 60 px cerrada, y al abrirse los ejercicios y SU botón
 * —en contorno, no en relleno—. Que el botón solo exista abierta es lo que dice
 * «puedes, pero no es lo que toca» sin un diálogo de confirmación.
 */
export function SessionRow({
  marker, name, meta, done, adapted, by, open,
  cta, onToggle, onStart, onEdit, onShare, a11yLabel, children,
}) {
  const { t }  = useTranslation();
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <Reanimated.View layout={LinearTransition.duration(FOLD_MS)} style={styles.sesCard}>
      <TouchableOpacity
        style={styles.sesHead}
        onPress={onToggle}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel={a11yLabel}
        accessibilityState={{ expanded: open }}
        accessibilityHint={t(open ? 'home.collapse' : 'home.expand')}
      >
        <Text style={[styles.sesGlyph, done && styles.sesGlyphDone]}>{marker}</Text>
        <Text style={[styles.sesName, done && styles.sesNameDone]} numberOfLines={1}>{name}</Text>
        {!!adapted && <Text style={styles.rowAdapted}>{t('home.adapted')}</Text>}
        {/* «de Lucas»: una sesión que manda el entrenador. Azul = entrenador. */}
        {!!by && <Text style={styles.rowAdapted} numberOfLines={1}>{t('home.fromTrainer', { name: by })}</Text>}
        <Text style={styles.sesMeta} numberOfLines={1}>{meta}</Text>
        {done && <CheckIcon size={14} color={LIMA} />}
      </TouchableOpacity>

      {open && (
        <Reanimated.View
          entering={FadeIn.duration(180)}
          exiting={collapseOut}
          style={styles.sesBody}
        >
          <View style={styles.sesBodyRule} />
          {children}
          {/* Botones sólidos a todo el ancho (QA 26-sep): primario en acento;
              una sesión ya hecha esta semana repite con el secundario, que la
              que toca es otra. Con `onEdit` (sesiones libres, free-sessions.md
              §6.1) EDITAR va al lado, también secundario. */}
          <View style={styles.sesBtnRow}>
            {/* Sin `onStart` la fila solo se consulta y se edita: la sesión libre
                de un cliente con app la entrena él (group-classes.md §4.1). */}
            {!!onStart && (
            <TouchableOpacity
              style={[styles.sesBtn, done && styles.sesBtnSecondary]}
              onPress={onStart}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel={cta}
            >
              <Text style={[styles.sesBtnText, done && styles.sesBtnTextSecondary]}>{cta}</Text>
              <HeroChevron color={done ? th.colors.text : th.colors.onAccent} />
            </TouchableOpacity>
            )}
            {onEdit && (
              <TouchableOpacity
                style={[styles.sesBtn, styles.sesBtnSecondary, onStart && styles.sesBtnEdit, !onStart && styles.sesBtnAlone]}
                onPress={onEdit}
                activeOpacity={0.75}
                accessibilityRole="button"
              >
                <Text style={[styles.sesBtnText, styles.sesBtnTextSecondary]}>{t('home.edit').toUpperCase()}</Text>
              </TouchableOpacity>
            )}
            {onShare && (
              <TouchableOpacity
                style={[styles.sesBtn, styles.sesBtnSecondary, styles.shareBtn]}
                onPress={onShare}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel={t('sessionText.share')}
              >
                <ShareIcon color={th.colors.text} />
              </TouchableOpacity>
            )}
          </View>
        </Reanimated.View>
      )}
    </Reanimated.View>
  );
}

/**
 * La que toca hoy: la misma fila en lima y a otra escala. Es la ÚNICA pieza en
 * color de la pantalla, así que dentro el acento pasa a ser el negro —letra,
 * raya y series— y el botón se invierte (§1.1).
 *
 * El botón vive en el pie y no dentro del desplegable: abrir la tarjeta crece
 * por dentro y no lo mueve de sitio.
 */
export function TodayCard({
  marker, flag, name, meta, open, cta, onToggle, onStart, onShare, a11yLabel, children,
}) {
  const { t }  = useTranslation();
  const styles = useThemedStyles(makeStyles);
  return (
    <Reanimated.View layout={LinearTransition.duration(FOLD_MS)} style={styles.today}>
      <TouchableOpacity
        style={styles.todayHead}
        onPress={onToggle}
        activeOpacity={0.9}
        accessibilityRole="button"
        accessibilityLabel={a11yLabel}
        accessibilityState={{ expanded: open }}
        accessibilityHint={t(open ? 'home.collapse' : 'home.expand')}
      >
        {/* La letra se empareja con el NOMBRE, no con el bloque entero: son la
            misma cosa dicha de dos maneras. Por eso el rótulo sale fuera y se
            queda a ancho completo —alineado con la raya, la meta y el botón— y
            la letra y el nombre forman su propia línea, apoyados en el mismo
            suelo. Sin un solo margen a ojo: se recoloca solo si el nombre rompe
            a dos líneas. Ver §5.2.1. */}
        <Text style={styles.todayFlag} numberOfLines={1}>{flag}</Text>
        <View style={styles.todayHeadRow}>
          {!!marker && <Text style={styles.todayGlyph}>{marker}</Text>}
          <Text style={styles.todayName} numberOfLines={2}>{name}</Text>
        </View>
        <View style={styles.todayRule} />
        <Text style={styles.todayMeta} numberOfLines={1}>{meta}</Text>
      </TouchableOpacity>

      {open && (
        <Reanimated.View
          entering={FadeIn.duration(180)}
          exiting={collapseOut}
          style={styles.todayBox}
        >
          {children}
        </Reanimated.View>
      )}

      {/* Con `layout` propio: el pie es el único hermano que se mueve al
          plegar, y sin él Reanimated le quita el hueco de golpe — el botón
          saltaba a su sitio mientras la tarjeta seguía encogiendo. */}
      <Reanimated.View layout={LinearTransition.duration(FOLD_MS)} style={styles.todayFoot}>
        <TouchableOpacity
          style={styles.todayBtn}
          onPress={onStart}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={cta}
        >
          <Text style={styles.todayBtnText}>{cta}</Text>
          <HeroChevron />
        </TouchableOpacity>
        {/* Al lado de EMPEZAR y no en el desplegable: a un cliente sin app
            la sesión se le manda tanto como se entrena con él (§5). */}
        {onShare && (
          <TouchableOpacity
            style={[styles.todayBtn, styles.shareBtn]}
            onPress={onShare}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={t('sessionText.share')}
          >
            <ShareIcon color={LIMA} />
          </TouchableOpacity>
        )}
      </Reanimated.View>
    </Reanimated.View>
  );
}

// ── Iconos ────────────────────────────────────────────────────────────────────

export function CheckIcon({ size = 16, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M20 6L9 17l-5-5" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** La de compartir de siempre: la caja con la flecha que sale. */
export function ShareIcon({ size = 18, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 3v12M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
    </Svg>
  );
}

// ── Section header ──────────────────────────────────────────────────────────────
// SESIONES lleva a la derecha el contador de la semana, que sale entero de
// `sessionPlan`: la pantalla no compone la frase, solo decide si hay hueco para
// ella (sin sesiones que contar, el subtítulo viene a null y no se pinta nada).

export function SectionHeader({ label, count }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.secHeader}>
      <Text style={styles.secHeaderLabel}>{label}</Text>
      {!!count && <Text style={styles.secHeaderCount}>{count}</Text>}
    </View>
  );
}

const makeStyles = (th) => StyleSheet.create({
  // ── Rótulos de sección ────────────────────────────────────────────────────────
  secHeader: {
    flexDirection: 'row',
    alignItems:    'baseline',
    gap:           spacing.sm,
    paddingHorizontal: spacing.xs2,
    marginTop:     spacing.lg,
    marginBottom:  spacing.sm2,
  },
  // SESIONES es el rótulo de la zona de entreno y va en `text`; los demás
  // rótulos de la pantalla se quedan en `mutedLight`.
  secHeaderLabel: { ...textStyles.caps, color: th.colors.text },
  // El mismo cuerpo que el meta del hero ("5 EJERCICIOS · ~55 MIN · …"): son el
  // mismo tipo de dato, contexto en mayúsculas muy trackeado. Antes iba a 9 y
  // en SemiBold, medio punto por debajo de todo lo demás.
  secHeaderCount: {
    ...textStyles.caps,
    color:         th.colors.mutedLight,
    textTransform: 'uppercase',
    marginLeft:    'auto',
  },

  // ── Lista de sesiones ───────────────────────────────────────────────────
  // Los cuerpos y los huecos salen de la sesión de diseño
  // (docs/specs/home-sesiones-plegables.md §5), no de Figma: donde no hay token
  // —14, 12, 11— va el número exacto de la spec.
  //
  // Tarjetas sueltas, no una lista agrupada: cualquiera se despliega, así que
  // todas llevan su radio entero. El aire va DENTRO de la tarjeta (60 px de
  // alto) y no entre ellas: separadas y estrechas parecían una persiana, y
  // juntas y altas se leen como fichas.
  group: { gap: spacing.xs2 },

  sesCard: {
    backgroundColor: th.colors.surface,
    borderRadius:    th.radius.md,
    overflow:        'hidden',
  },
  sesHead: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               8,
    height:            60,
    paddingHorizontal: 14,
  },
  // `includeFontPadding: false` aquí y en la letra grande: es lo que deja que la
  // caja del texto valga lo que dice `lineHeight` y no lo que Android le suma
  // por su cuenta — sin eso, la letra no cae donde se la centra.
  sesGlyph: {
    ...textStyles.title,
    lineHeight:         22,
    includeFontPadding: false,
    // Ajustada a la tinta de la Inter Black a este cuerpo (24 px medidos sobre
    // el .ttf), sin los 2 px de holgura que traía. Lo que separa la letra del
    // nombre es el `gap` de la fila, no una caja con aire de sobra.
    width:              24,
    color:              LIMA,
  },
  sesGlyphDone: { color: th.colors.muted },
  sesName:      { ...textStyles.itemTitle, flex: 1, color: th.colors.text },
  sesNameDone:  { color: th.colors.mutedLight },
  sesMeta:      { ...textStyles.label, color: th.colors.muted },
  rowAdapted:   { ...textStyles.labelStrong, color: th.tint.blue70 },

  sesBody: { paddingHorizontal: 14, paddingTop: spacing.xs, paddingBottom: 14, overflow: 'hidden' },
  // La raya de la cabecera de hoy, apagada: separa sin contar nada.
  sesBodyRule: {
    height:          2,
    borderRadius:    2,
    backgroundColor: th.tint.accent50,
    marginBottom:    spacing.sm2,
  },
  // Sólido y a todo el ancho (QA 26-sep: el contorno se leía flojo y, dentro
  // de la fila de botones, no llenaba). Primario en acento; secundario en
  // `surface2` sin borde, la variante Secondary ya cerrada en la app.
  sesBtnRow: { flexDirection: 'row', gap: spacing.sm, marginTop: 12 },
  sesBtn: {
    flex:            1,
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'space-between',
    backgroundColor: th.colors.accent,
    borderRadius:    th.radius.md,
    padding:         14,
  },
  sesBtnText:          { ...textStyles.button, color: th.colors.onAccent },
  sesBtnSecondary:     { backgroundColor: th.colors.surface2 },
  sesBtnTextSecondary: { color: th.colors.text },
  // EDITAR: lo justo para su palabra, que EMPEZAR es lo principal.
  sesBtnEdit:          { flex: 0, justifyContent: 'center' },
  sesBtnAlone:         { justifyContent: 'center' },

  // ── La que toca hoy ─────────────────────────────────────────────────
  // La única pieza en color de la pantalla, así que dentro el acento es el
  // negro: letra, raya y series. El botón se invierte.
  today: {
    backgroundColor: th.colors.accent,
    borderRadius:    th.radius.md,
    overflow:        'hidden',
    // La de hoy respira el doble que las demás por arriba y por abajo: es la
    // pieza grande y pegada a sus vecinas se leía como parte de la misma lista.
    marginVertical:  spacing.xs2,
  },
  todayHead: {
    paddingTop:        14,
    paddingHorizontal: spacing.lg,
    paddingBottom:     11,
  },
  // `flex-end` y no `center`: la letra se apoya en la misma línea de suelo que
  // el nombre. Centrada tampoco quedaba mal, pero a media altura no está
  // alineada con nada y se lee como un descuadre.
  todayHeadRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, marginTop: spacing.sm },
  // ── Cómo se apoyan la letra y el nombre en el mismo suelo ──────────────────
  // La fila alinea a `flex-end`, o sea que lo que casa son los BORDES de las dos
  // cajas de texto, no las bases de las letras. La distancia de la base al borde
  // inferior es `(lineHeight − (A+D)·cuerpo)/2 + D·cuerpo`, con A=1.0 y D=0.2 em
  // (métricas hhea de la Barlow). Igualando las dos sale una relación limpia:
  //
  //     lineHeight(letra) = lineHeight(nombre) + 6·(A − D) = +4.8
  //
  // De ahí 34 en el nombre (que es además lo mínimo para que la "j" no se corte:
  // 1.2 em × 28 = 33.6) y 39 en la letra. Si cambia un cuerpo, rehacer la cuenta;
  // no son números a ojo.
  todayGlyph: {
    ...textStyles.heroGlyph,
    lineHeight:         39,
    includeFontPadding: false,
    // La tinta de la Barlow a 34 mide 26 justos: 27 para que la cursiva no
    // roce el borde. Aquí el aire se recorta desde el `gap` de la fila, que
    // sólo separa la letra del nombre.
    width:              27,
    color:              th.colors.onAccent,
  },
  // La misma ceja que la tarjeta de programa y las cabeceras de pantalla.
  todayFlag: {
    ...textStyles.caps,
    textTransform: 'uppercase',
    color:         withOpacity(th.colors.onAccent, 0.55),
  },
  todayName: {
    ...textStyles.heroName,
    // 34: la Barlow pide 1.2 em (33.6 a cuerpo 28) para que la "j" de "empuje"
    // quepa entera. Con los 25 de antes se comía 8 px de descendente.
    lineHeight:         34,
    // Imprescindible para que la cuenta de arriba valga en Android: sin esto el
    // sistema le suma su propio relleno a la caja y el suelo deja de casar.
    includeFontPadding: false,
    color:              th.colors.onAccent,
    flex:               1,
  },
  todayRule: {
    height:          2,
    borderRadius:    2,
    backgroundColor: withOpacity(th.colors.onAccent, 0.85),
    marginTop:       11,
  },
  todayMeta: {
    ...textStyles.caps,
    marginTop:     spacing.sm,
    textTransform: 'uppercase',
    color:         withOpacity(th.colors.onAccent, 0.55),
  },
  // 6 px a los lados y no 15: el lima queda de FILO, no de marco, y la tarjeta
  // se sigue leyendo como una sola pieza. El pie lleva el mismo margen.
  todayBox: {
    backgroundColor:   th.colors.bg,
    borderRadius:      th.radius.sm,
    overflow:          'hidden',
    marginHorizontal:  spacing.sm,
    paddingHorizontal: 12,
    paddingVertical:   9,
  },
  todayFoot: {
    flexDirection:     'row',
    gap:               spacing.sm,
    paddingTop:        11,
    paddingHorizontal: spacing.sm,
    paddingBottom:     spacing.sm,
  },
  todayBtn: {
    flex:            1,
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'space-between',
    backgroundColor: th.colors.onAccent,
    borderRadius:    th.radius.md,
    padding:         spacing.lg,
  },
  todayBtnText: { ...textStyles.button, color: LIMA },
  // COMPARTIR junto a EMPEZAR: lo justo para el icono, con el relleno del botón.
  shareBtn: { flex: 0, justifyContent: 'center' },

  // ── Los ejercicios de la sesión desplegada ──────────────────────────────
  // Sosos a propósito: caja baja, sin filetes y sin lima. Dentro de la tarjeta
  // el acento ya lo gastan la raya y el botón; un tercero repetido siete veces
  // le quita fuerza justo a lo que hay que pulsar (§5.4).
  exRow:  { flexDirection: 'row', alignItems: 'baseline', gap: spacing.md, paddingVertical: spacing.xs2 },
  exIdx:    { ...textStyles.label, width: 13, color: th.colors.muted },
  exName:   { ...textStyles.body, flex: 1, color: th.colors.text },
  exTarget: { ...textStyles.label, color: th.colors.mutedLight },
});
