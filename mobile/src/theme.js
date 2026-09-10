/**
 * Design tokens — single source of truth for the mobile app.
 * Mirrors the CSS variables in the web app's index.css (dark theme).
 *
 * Usage in components:
 *   import { colors, spacing, typography, radius } from '../theme';
 *   const styles = StyleSheet.create({ container: { backgroundColor: colors.bg } });
 *
 * To add a light theme in the future: create a lightColors object and swap at runtime.
 */

// ─── Color tokens ─────────────────────────────────────────────────────────────
export const colors = {
  // Backgrounds
  bg:         '#0a0a0a',
  surface:    '#141414',
  surface2:   '#1a1a1a',

  // Text
  text:       '#f0f0f0',
  mutedLight: '#9a9a9a', // metadata on dark surfaces — keeps ≥4.5:1 contrast at small sizes
  muted:      '#777777',
  muted2:     '#555555',

  // Accent
  accent:     '#e8ff47',
  onAccent:   '#0a0a0a',

  // Semantic
  border:     '#2a2a2a',
  borderCard: '#1f1f1f',
  green:      '#4ade80',
  orange:     '#fb923c',
  red:        '#f87171',
  blue:       '#57a8ff',

  // Session / day colors (match web CSS vars)
  day1: '#e8ff47',
  day2: '#ff6b35',
  day3: '#7eb8ff',
  day4: '#a78bfa',
  day5: '#34d399',
  day6: '#f472b6',
};

// ─── Spacing scale ────────────────────────────────────────────────────────────
// Mirrors Figma's `space/*` variables exactly (name AND value) — this is the
// authoritative scale for the FormaFit redesign, not an app-invented one.
// Confirmed across independent extractions: xs=2 (history.md, progress.md),
// xs2=4 (RACIONALIZACION.md §1), sm=6 (program-editor.md, exercice.md,
// segmented-control.md), sm2=8 (exercice-editor-elements.md), md=10 (history.md,
// modales.md, sesion-editor.md...), lg=15 (history.md, bloques-amrap.md,
// modales.md), xl=20 (modales.md), xxl=28 (RACIONALIZACION.md §1).
export const spacing = {
  xs:  2,
  xs2: 4,
  sm:  6,
  sm2: 8,
  md:  10,
  lg:  15,
  xl:  20,
  xxl: 28,
};

// ─── Border radius ────────────────────────────────────────────────────────────
export const radius = {
  xs:   4,
  sm:   6,
  md:   10,
  lg:   16,
  xl:   22,
  full: 9999,
};

// ─── Typography ───────────────────────────────────────────────────────────────
export const typography = {
  // Font sizes
  xs:   10,
  sm:   11,
  base: 13,
  md:   14,
  lg:   16,
  xl:   18,
  xxl:  22,

  // Font weights
  regular:  '400',
  medium:   '500',
  semibold: '600',
  bold:     '700',
  heavy:    '900',

  // Line heights
  tight:  1.2,
  normal: 1.5,
  loose:  1.8,
};

// ─── Composite text styles (Figma text/* tokens with exact tracking) ──────────
// `typography` above only has loose sizes/weights shared by all screens — these
// are exact Figma text styles (size + weight + letter-spacing bundled) used by
// the FormaFit redesign. Do not fold into `typography`, which other screens
// already consume as-is.
//
// The font is Inter (matching Figma). RN doesn't synthesize weights for custom
// fonts, so each weight is a distinct family loaded in App.js — la familia, no
// `fontWeight`, es lo que elige el peso.
//
// Y `fontWeight` no puede quedarse "de documentación": en Android, un estilo con
// familia custom Y fontWeight hace que RN busque una variante con ese peso, no la
// encuentre y caiga a Roboto. Era lo que hacía que la app se viera en Roboto en
// Android y en Inter en iOS. El peso va en el nombre de la familia y en ningún
// sitio más — `src/components/ui/Text` además lo quita de los estilos sueltos.
//
// ── Subida de escala de sep-2026 ──────────────────────────────────────────────
// Los cuerpos de Figma se fijaron mirando iPhone, donde SF Pro cambia al corte
// «Text» por debajo de ~20px y engorda las astas. Inter no tiene ese eje óptico,
// así que a 8–12px se leía notablemente más fina de lo que el diseño suponía.
// Decisión del usuario (sep-2026): +2 puntos en los tokens de texto pequeño y
// nos apartamos de Figma a conciencia — ver AGENTS.md, la regla de fidelidad
// queda suspendida para la escala tipográfica (no para color, radio ni layout).
// La letra de la sesión de HOY, y solo esa: Barlow Condensed en la variante del
// logotipo, que ya viene en el bundle. Se probó en las diez pantallas que
// pintan una letra de sesión y solo convence aquí, donde es un titular a 34 px
// — al resto, que son marcadores pequeños dentro de una fila, la condensada les
// quitaba presencia. Las demás se quedan en Inter Black.
const SESSION_LETTER = {
  fontFamily:    'BarlowCondensed_800ExtraBold_Italic',
  letterSpacing: 0,
  textTransform: 'uppercase',
};

export const textStyles = {
  hero:       { fontFamily: 'Inter_900Black',     fontSize: 20, letterSpacing: 0 },    // text/hero — valor grande de las Progress cards
  cardType:   { fontFamily: 'Inter_800ExtraBold', fontSize: 12, letterSpacing: 1.2 },  // "SESIÓN X" tags
  cardTitle:  { fontFamily: 'Inter_900Black',     fontSize: 16, letterSpacing: 0.64 }, // nombre de sesión
  exercice:   { fontFamily: 'Inter_900Black',     fontSize: 16, letterSpacing: 0 },    // text/Exercice — nombre de ejercicio (sin tracking, distinto de cardTitle)
  subtitle:   { fontFamily: 'Inter_500Medium',    fontSize: 14, letterSpacing: 0.48 }, // (12→14) subtítulos explicativos de tarjetas y tablas
  tag:        { fontFamily: 'Inter_500Medium',    fontSize: 12, letterSpacing: 0 },    // (10→12) labels pequeños genéricos
  smallBold:  { fontFamily: 'Inter_600SemiBold',  fontSize: 10, letterSpacing: 1.12 }, // (8→10) text/SmallBold — etapa, entrenador, contadores
  btnAction:  { fontFamily: 'Inter_900Black',     fontSize: 14, letterSpacing: 0 },    // (12→14) TODO botón principal en lima pasa por aquí

  // La ceja, una sola para toda la app. Antes había tres escalas distintas
  // haciendo el mismo trabajo — 9 inline en el hero de la Home, este token a 10
  // en la tarjeta de programa y `cardType` a 12 en las cabeceras de pantalla —,
  // y las tres se leían como lo mismo porque LO SON. Unificadas aquí a 12.
  spacingTag: { fontFamily: 'Inter_800ExtraBold', fontSize: 12, letterSpacing: 2 },    // (10→12) ceja: hero, tarjeta de programa y cabeceras

  // El nombre en las listas de los editores. Bold y no Black: un editor se lee
  // seguido, fila tras fila, y la negra a ese cuerpo cansa. Token propio y no
  // `cardTitle`/`exercice` porque esos mandan en pantallas de consulta, donde
  // el nombre sí tiene que cantar.
  editorName:  { fontFamily: 'Inter_700Bold', fontSize: 16, letterSpacing: -0.2 },

  // El enlace "+ Añadir …": añadir serie en el entreno, y añadir sesión y
  // ejercicio en los editores. Los tres hacen lo mismo y son texto pelado, sin
  // caja; iban en dos tipografías distintas (13/0.26 en el entreno y `cardType`
  // a 12/1.2 en los editores) porque cada pantalla lo declaró por su cuenta.
  addLink:     { fontFamily: 'Inter_800ExtraBold', fontSize: 13, letterSpacing: 0.26 },

  // El nombre de la pantalla en la barra superior. Estaba declarado a pelo y
  // copiado en cuatro sitios (ScreenHeader título + input, WorkoutScreen título
  // + input de sesión libre); si no vive en un token, la quinta copia vuelve.
  screenTitle: { fontFamily: 'Inter_800ExtraBold', fontSize: 18, letterSpacing: -0.2 }, // (16→18)

  // Sesiones de la Home (docs/specs/home-sesiones-plegables.md §4.2). La letra
  // y el nombre a dos escalas: fila y tarjeta de hoy.
  //
  // La LETRA vuelve a Barlow Condensed, que es lo que pedían las maquetas. Se
  // había descartado «para no cargar dos familias por una pantalla», pero esa
  // familia ya está en el bundle desde siempre: es la del logotipo. Misma
  // variante que el logo (800 ExtraBold Itálica), así que la marca y el
  // marcador de sesión hablan igual y no entra ni un fichero nuevo.
  //
  // Sin tracking negativo: el que había compensaba el ancho de la Inter Black a
  // estos cuerpos, y una condensada no necesita que la aprieten. El NOMBRE se
  // queda en Inter — la condensada es para el marcador, no para leer.
  sessionGlyph:   { fontFamily: 'Inter_900Black', fontSize: 22, letterSpacing: -0.6 },  // letra de fila
  sessionGlyphXL: { ...SESSION_LETTER, fontSize: 34 },  // letra de la sesión de hoy
  sessionName:    { fontFamily: 'Inter_900Black', fontSize: 16, letterSpacing: -0.2 },  // nombre de fila
  // El nombre del hero comparte familia con su letra: son la misma cosa dicha de
  // dos maneras. Sin el tracking negativo (era para apretar la Inter Black) y a
  // 28, porque una condensada a 24 se quedaba corta donde había una Inter.
  sessionNameXL:  { ...SESSION_LETTER, textTransform: 'none', fontSize: 28 },  // nombre de la sesión de hoy
};

// ─── Escalado del texto del sistema ───────────────────────────────────────────
/**
 * Techo del ajuste de tamaño de fuente del sistema.
 *
 * Ignorarlo del todo deja tirado a quien necesita texto grande; dejarlo suelto
 * revienta unas maquetas medidas al píxel. 1.2 es donde el texto crece de forma
 * perceptible y las tarjetas todavía cierran.
 *
 * Lo consumen `src/components/ui/Text` (todo el texto de la app), los tres
 * `Animated.Text` que no pasan por ese wrapper, y `ui/FitLogo` — que lo necesita
 * para escalar el SVG a la par que el texto del logotipo. Si esta constante
 * desaparece, `Math.min(x, undefined)` es NaN y el logo se vuelve invisible sin
 * un solo error: por eso theme.test.js la vigila.
 */
export const MAX_FONT_SCALE = 1.2;

// ─── Familia por peso ─────────────────────────────────────────────────────────
// RN no sintetiza pesos para fuentes custom: cada peso de Inter es una familia
// propia (las carga App.js). Un estilo que sólo declara `fontWeight` se quedaba
// en la fuente del sistema — SF Pro en iOS, Roboto en Android —, que es de donde
// salía que la app se viera distinta en cada plataforma. `src/components/ui/Text`
// pasa por aquí el peso de cada estilo para resolver la familia que toca.
export const INTER_BY_WEIGHT = {
  400:    'Inter_400Regular',
  500:    'Inter_500Medium',
  600:    'Inter_600SemiBold',
  700:    'Inter_700Bold',
  800:    'Inter_800ExtraBold',
  900:    'Inter_900Black',
  normal: 'Inter_400Regular',
  bold:   'Inter_700Bold',
};

/**
 * Familia Inter para un estilo ya aplanado. Devuelve `null` si el estilo ya
 * eligió familia — ese estilo manda y no se toca.
 */
export function interFamily(flatStyle) {
  if (flatStyle?.fontFamily) return null;
  return INTER_BY_WEIGHT[flatStyle?.fontWeight] ?? INTER_BY_WEIGHT[400];
}

/**
 * El estilo que acaba en la vista: familia resuelta y `fontWeight` fuera.
 *
 * Lo segundo es lo que arregla Android. Un estilo con familia custom Y
 * `fontWeight` hace que RN busque una variante con ese peso, no la encuentre y
 * caiga a Roboto — de ahí que la app se viera en Roboto en Android y en Inter en
 * iOS. El peso lo elige la familia, así que se lee para escogerla y se descarta.
 *
 * Recibe el estilo ya aplanado (`StyleSheet.flatten`) porque así es pura y se
 * puede testear sin react-native.
 */
export function textStyleFor(flatStyle) {
  const style = { ...flatStyle };
  style.fontFamily = style.fontFamily ?? interFamily(flatStyle);
  delete style.fontWeight;
  return style;
}

// ─── Border widths ────────────────────────────────────────────────────────────
export const borders = {
  thin:   1,
  medium: 2,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Converts a CSS-var-style color string (from the shared data layer)
 * to a concrete hex value for use in RN StyleSheets.
 *
 *   resolveColor('var(--day1)') → '#e8ff47'
 */
const CSS_VAR_MAP = {
  'var(--day1)':    colors.day1,
  'var(--day2)':    colors.day2,
  'var(--day3)':    colors.day3,
  'var(--day4)':    colors.day4,
  'var(--day5)':    colors.day5,
  'var(--day6)':    colors.day6,
  'var(--accent)':  colors.accent,
  'var(--bg)':      colors.bg,
  'var(--surface)': colors.surface,
  'var(--text)':    colors.text,
  'var(--muted)':   colors.muted,
  'var(--border)':  colors.border,
  'var(--green)':   colors.green,
};

export function resolveColor(cssVar) {
  return CSS_VAR_MAP[cssVar] ?? cssVar;
}

/**
 * Returns an RGBA string with the given hex color at the specified opacity.
 *   withOpacity(colors.accent, 0.1) → 'rgba(232, 255, 71, 0.10)'
 */
export function withOpacity(hex, opacity) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity.toFixed(2)})`;
}

/**
 * Radios asimétricos por posición dentro de una lista agrupada (§9 de
 * docs/UI-MIGRATION.md): primero/último redondeados, intermedios casi rectos.
 * Vive aquí, y no en la pantalla que lo estrenó (Progress), porque lo comparten
 * la lista de ejercicios, el detalle y el menú principal.
 */
export function getCardRadii(th, isFirst, isLast) {
  const xxs = th.radius.xxs ?? 2;
  if (isFirst && isLast) {
    return {
      borderTopLeftRadius: th.radius.md, borderTopRightRadius: th.radius.md,
      borderBottomLeftRadius: th.radius.md, borderBottomRightRadius: th.radius.md,
    };
  }
  if (isFirst) {
    return {
      borderTopLeftRadius: th.radius.md, borderTopRightRadius: th.radius.md,
      borderBottomLeftRadius: th.radius.xs, borderBottomRightRadius: th.radius.xs,
    };
  }
  if (isLast) {
    return {
      borderTopLeftRadius: xxs, borderTopRightRadius: th.radius.xs,
      borderBottomLeftRadius: th.radius.md, borderBottomRightRadius: th.radius.md,
    };
  }
  return {
    borderTopLeftRadius: xxs, borderTopRightRadius: xxs,
    borderBottomLeftRadius: xxs, borderBottomRightRadius: xxs,
  };
}

/**
 * Fila de opción de una hoja (`DragSheet`): el patrón único de los menús "···"
 * (§9 de docs/UI-MIGRATION.md). Vivía duplicado en seis pantallas, cada una con
 * su copia; está aquí para que el alto se ajuste UNA vez para todas — que es lo
 * que pidió el usuario en QA ("las filas son muy finas").
 *
 * `minHeight` en vez de más padding vertical: las filas de dos líneas (título +
 * hint del editor de programa) ya lo superan y no se estiran.
 */
export function sheetRowBase(th) {
  return {
    flexDirection:     'row',
    alignItems:        'center',
    minHeight:         48,
    backgroundColor:   th.colors.surface2,
    borderRadius:      th.radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical:   spacing.sm2,
  };
}

// ─── Convenience re-export (backwards compat with old theme import) ───────────
export const theme = { colors, spacing, radius, typography, borders, resolveColor, withOpacity };
export default theme;
