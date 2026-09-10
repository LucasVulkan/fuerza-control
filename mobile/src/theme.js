/**
 * Design tokens — single source of truth for the mobile app.
 * Mirrors the CSS variables in the web app's index.css (dark theme).
 *
 * Usage in components:
 *   import { colors, spacing, textStyles, radius } from '../theme';
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

// ─── Tipografía: catorce papeles y nada más ───────────────────────────────────
// Spec: docs/specs/tipografia.md. Lo que había antes eran DOS sistemas a la vez
// —una escala suelta `typography.{xs,sm,base,md,lg,xl,xxl}` y veinte tokens
// compuestos— y por debajo 170 `fontSize` a pelo: 177 combinaciones distintas de
// cuerpo × peso × tracking para una app de 47 pantallas. Eso no es jerarquía,
// es ruido.
//
// Ahora hay una escala de ocho pasos y catorce papeles. Un papel dice PARA QUÉ
// sirve un texto, no cómo se ve, que es lo que evita que dentro de tres meses
// alguien invente el decimoquinto.
//
//   11 · 12 · 14 · 16 · 18 · 22 · 28 · 34
//
// Ocho pasos porque menos no cubre la app y más deja de verse: por debajo de un
// 12 % de diferencia dos cuerpos no se distinguen, y ese era el caso de los 10 y
// los 11 (139 sitios peleándose por un píxel), de 15/16/17 y de 18/19/20.
//
// Tres reglas y ninguna excepción suelta:
//
//   1. TRACKING. Mayúsculas → +1.2. Caja baja hasta 22 → 0. Display > 22 →
//      −0.02 em. El tracking positivo sólo hace algo en versales; en caja baja a
//      12 px abre huecos y frena la lectura. Había 27 valores distintos.
//   2. PESO. Cuatro: 500 apaga, 700 firma, 800 rotula, 900 es identidad. Fuera
//      el 400 (un uso) y el 600 (27), que a estos cuerpos no se separan del 500.
//   3. UNA PANTALLA, TRES PAPELES. Lo demás se jerarquiza con COLOR, que ya
//      tiene cuatro niveles (text → mutedLight → muted → muted2).
//
// El suelo es 11. Por debajo había once sitios a 8–9 px (uno de ellos la
// etiqueta de la tab bar): el mínimo de iOS HIG es 11 pt y el de Material 12 sp,
// y con Inter —que no tiene eje óptico— sobre #0a0a0a a 8 px el texto no se lee,
// se adivina.
//
// ── Lo que NO se toca, por identidad ──────────────────────────────────────────
// `heroGlyph`/`heroName` (la Barlow de la tarjeta de hoy), `itemTitle` (la Black
// de los nombres de sesión) y `button` (la Black de "Editar programa"). Son la
// voz de la app; el resto se calla para que se oigan.
//
// ── Por qué la familia y no `fontWeight` ──────────────────────────────────────
// RN no sintetiza pesos para fuentes custom: cada peso de Inter es una familia
// propia (las carga App.js). Y `fontWeight` no puede quedarse "de documentación":
// en Android, un estilo con familia custom Y fontWeight hace que RN busque una
// variante con ese peso, no la encuentre y caiga a Roboto. El peso va en el
// nombre de la familia y en ningún sitio más — `src/components/ui/Text` además
// lo quita de los estilos sueltos.
//
// ── Por qué nos apartamos de Figma en la escala (sep-2026) ────────────────────
// Los cuerpos de Figma se fijaron mirando iPhone, donde SF Pro cambia al corte
// «Text» por debajo de ~20px y engorda las astas. Inter no tiene ese eje, así
// que a 8–12px se leía más fina de lo que el diseño suponía. La regla de
// fidelidad de AGENTS.md queda suspendida para la escala tipográfica — no para
// color, radio ni layout.
const BARLOW = 'BarlowCondensed_800ExtraBold_Italic';

export const textStyles = {
  // ── Identidad: la tarjeta de hoy ────────────────────────────────────────────
  // Barlow Condensed en la variante del logotipo, que ya venía en el bundle: la
  // marca y el marcador de sesión hablan igual y no entra ni un fichero nuevo.
  // Sin tracking negativo — el que había compensaba el ancho de la Inter Black y
  // una condensada no necesita que la aprieten.
  heroGlyph: { fontFamily: BARLOW, fontSize: 34, letterSpacing: 0, textTransform: 'uppercase' },
  heroName:  { fontFamily: BARLOW, fontSize: 28, letterSpacing: 0 },

  // ── Titulares ───────────────────────────────────────────────────────────────
  // `title` es el escalón grande de dentro de pantalla: cifras de las tarjetas de
  // progreso, títulos de hoja y la letra de sesión de las filas. Absorbe el
  // antiguo `hero` (20) y `sessionGlyph` (22), que eran el mismo salto.
  title:   { fontFamily: 'Inter_900Black',     fontSize: 22, letterSpacing: -0.5 },
  heading: { fontFamily: 'Inter_800ExtraBold', fontSize: 18, letterSpacing: -0.2 },

  // El nombre de una cosa en una lista de consulta: sesión, ejercicio, cliente.
  // Aquí SÍ canta, es lo que se busca con la vista.
  itemTitle: { fontFamily: 'Inter_900Black', fontSize: 16, letterSpacing: -0.2 },
  // El mismo nombre dentro de un editor. Bold y no Black: un editor se lee
  // seguido, fila tras fila, y la negra a ese cuerpo cansa.
  itemTitleQuiet: { fontFamily: 'Inter_700Bold', fontSize: 16, letterSpacing: -0.2 },

  // ── Cuerpo ──────────────────────────────────────────────────────────────────
  // 14 es el cuerpo de lectura de la app. Quien escriba varias líneas le pone
  // `lineHeight: 21` (1.5); una sola línea se queda con el de la fuente.
  body:       { fontFamily: 'Inter_500Medium', fontSize: 14, letterSpacing: 0 },
  bodyStrong: { fontFamily: 'Inter_700Bold',   fontSize: 14, letterSpacing: 0 },
  // Botones y enlaces de acción ("EMPEZAR", "Editar programa", "+ Añadir serie").
  // Todo lo que se pulsa y lleva palabra habla con esta voz y con ninguna otra.
  button:     { fontFamily: 'Inter_900Black',  fontSize: 14, letterSpacing: 0 },

  // ── Etiquetas ───────────────────────────────────────────────────────────────
  // 12 es el cuerpo de lo que acompaña: metadatos, unidades, filas densas.
  label:       { fontFamily: 'Inter_500Medium',    fontSize: 12, letterSpacing: 0 },
  labelStrong: { fontFamily: 'Inter_800ExtraBold', fontSize: 12, letterSpacing: 0 },
  // La ceja en VERSALES, una sola para toda la app. Antes eran tres tokens
  // —`cardType` 12/800/1.2, `spacingTag` 12/800/2 y `smallBold` 10/600/1.12—
  // que sumaban 201 sitios y decían LO MISMO. El +1.2 va aquí y en ningún otro
  // sitio: es el único caso en que el tracking positivo hace algo.
  //
  // No lleva `textTransform`: hay medio centenar de sitios que ya mandan la
  // cadena en mayúsculas desde el `.toUpperCase()` o desde el locale, y meterlo
  // aquí no cambiaría nada salvo tapar el día en que uno de ellos deje de serlo.
  caps:  { fontFamily: 'Inter_800ExtraBold', fontSize: 12, letterSpacing: 1.2 },
  // El suelo. Sólo tres sitios lo merecen: tab bar, ejes de gráfica y sufijos de
  // unidad. Si aparece un cuarto, casi siempre es que quería ser `label`.
  micro: { fontFamily: 'Inter_500Medium', fontSize: 11, letterSpacing: 0 },

  // ── Códigos de emparejamiento ───────────────────────────────────────────────
  // La única excepción viva a la regla del tracking: se leen carácter a carácter
  // y no como palabra, así que aquí el aire es funcional.
  code: { fontFamily: 'Inter_900Black', fontSize: 22, letterSpacing: 4 },
};

// ─── Interlineado ─────────────────────────────────────────────────────────────
// Tres relaciones, no 128 números a ojo (que es lo que había). `lh(14)` = 21.
export const LINE = { tight: 1.15, body: 1.5, row: 1.2 };
export const lh = (size, ratio = LINE.body) => Math.round(size * ratio);

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
// Sólo cuatro pesos entran en el bundle (ver la nota de arriba). Los dos que
// salieron siguen mapeados para que un estilo rezagado renderice bien en vez de
// caer a la fuente del sistema: 400 → 500 y 600 → 700.
//
// Que el 400 apunte al 500 no es sólo simplificar, es corregir: texto claro
// sobre #0a0a0a sufre irradiación —el fondo invade el trazo— y la Regular a
// 12–14 px se ve más fina de lo que el diseño supone. Medium es el peso por
// defecto correcto en una UI oscura.
export const INTER_BY_WEIGHT = {
  400:    'Inter_500Medium',
  500:    'Inter_500Medium',
  600:    'Inter_700Bold',
  700:    'Inter_700Bold',
  800:    'Inter_800ExtraBold',
  900:    'Inter_900Black',
  normal: 'Inter_500Medium',
  bold:   'Inter_700Bold',
};

/**
 * Familia Inter para un estilo ya aplanado. Devuelve `null` si el estilo ya
 * eligió familia — ese estilo manda y no se toca.
 */
export function interFamily(flatStyle) {
  if (flatStyle?.fontFamily) return null;
  return INTER_BY_WEIGHT[flatStyle?.fontWeight] ?? INTER_BY_WEIGHT[500];
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
export const theme = { colors, spacing, radius, textStyles, borders, resolveColor, withOpacity };
export default theme;
