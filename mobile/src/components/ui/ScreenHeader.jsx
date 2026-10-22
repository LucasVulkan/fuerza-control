/**
 * ScreenHeader — la cabecera de las pantallas de detalle/editor: detalle y
 * editor de programa, editor de sesión, planificador de etapas y onboarding.
 *
 * Estaba copiada literalmente cinco veces y ya había divergido entre copias
 * (uppercase sí/no, `overflow` sí/no, el lado de 26 vs 33 del onboarding, y el
 * estado "no encontrado" de ProgramDetail pintando la ceja con el estilo del
 * título). Esta es la única copia.
 *
 * ── Por qué es una barra y no un título grande ─────────────────────────────
 *
 * Antes de esto fue una barra lima flotante (se cayó: ver §1 de
 * `docs/specs/U03-cabeceras.md`) y después un título de 25px Black con una regla
 * lima de 5px debajo. Lo segundo funcionaba, pero la cabecera se leía antes que
 * el contenido en las tres pantallas donde más contenido hay. Se maquetaron
 * ocho variantes con nombres reales del generador (`docs/specs/U03-cabeceras.md`
 * §6) y ésta es la que gana:
 *
 * - **Una fila de 56.** La identidad va arriba en `accent` y el nombre debajo
 *   en blanco: primero te sitúas, luego lees qué es esto. La cabecera
 *   deja de tener masa tipográfica propia y el contenido manda.
 * - **Alineada a la izquierda, y el botón de volver sin destino escrito.** Un
 *   `‹ Programas` centrando el título le dejaba ~180px de los 345 —26
 *   caracteres— y los arquetipos generan nombres de 43. Sin etiqueta y a la
 *   izquierda, el nombre dispone de 286 (~32 a 16px). Lo que hace que el
 *   botón se lea como botón es su caja, no la palabra.
 * - **La regla de 5px pasa a `HeaderRule`**: segmentada donde hay algo que
 *   contar (pasos del onboarding, ejercicios del entreno) y hairline donde no.
 *   La ceja llegó a estar en gris por presupuesto de acento; volvió a `accent`
 *   porque es lo primero que hay que leer y en gris se leía lo último.
 */

import { useEffect } from 'react';
import { View, TouchableOpacity, Pressable, StyleSheet } from 'react-native';
import Reanimated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { Text } from './Text';

import { spacing, textStyles, withOpacity } from '../../theme';
import { useTheme, useThemedStyles } from '../../useTheme';
import { ArrowIcon } from './EditorIcons';

// Alto de la regla segmentada. Fuera de la escala de `space/*` a propósito: es
// un grosor óptico, no un hueco. Se exporta porque la cabecera de WorkoutScreen
// no puede reutilizar este componente (es sticky y lleva un reloj vivo) pero sí
// tiene que llevar la misma regla.
export const HEADER_RULE_H = 3;
// Lado del botón de volver. Es también el ancho del hueco que ocupa cuando no
// hay atrás, para que el título no salte entre pasos del onboarding.
const BACK_BTN = 32;

/**
 * La regla que cierra la cabecera. Con `progress` —un booleano por unidad— sale
 * partida en segmentos: lleno en `accent`, pendiente al 25%. Sin él, una
 * hairline de 1px.
 *
 * Un segmento por unidad y `flex: 1`: con 3 pasos o con 20 ejercicios el ancho
 * se reparte solo. El hueco de 2px la lee como regla discontinua y no como
 * puntos, que es lo que la separa de unos dots de progreso.
 */
export function HeaderRule({ progress }) {
  const th     = useTheme();
  const styles = useThemedStyles(makeStyles);

  if (!progress?.length) return <View style={styles.hairline} />;

  return (
    <View style={styles.ruleRow}>
      {progress.map((done, i) => (
        <View
          key={i}
          style={[
            styles.ruleSeg,
            { backgroundColor: done ? th.colors.accent : withOpacity(th.colors.accent, 0.25) },
          ]}
        />
      ))}
    </View>
  );
}

export default function ScreenHeader({
  onBack,
  eyebrow,
  title,
  // Nodo, o función que recibe el color de tinta de las acciones. Lo segundo
  // porque la tinta depende de sobre qué se pinta la cabecera, y así probar
  // otra variante sigue siendo un cambio de un solo archivo.
  right,
  // Un booleano por unidad para la regla segmentada (ver `HeaderRule`).
  progress,
  // Título que abre algo de quien llama: una hoja para elegir otro (Detalle de
  // ejercicio) o la lista anclada de hermanos (editor de ejercicio y de bloque,
  // P16-04: con la cabecera plegada). El nombre lleva un chevron.
  onTitlePress,
  // Modo del editor (P16-02): `{ base, backLabel, onCancel, folded }`. Solo lo
  // pasan las pantallas del editor. `base`: la primera del editor, con
  // «Cancelar» (`onCancel`) y «EDITANDO» en el centro; si no, «‹ backLabel»
  // (`onBack` hace la subida). `folded`: la tarjeta de identidad ha salido de
  // pantalla — el centro enseña ceja + nombre, la regla fina aparece y el texto
  // del «‹» se apaga. El nombre se cambia con el lápiz de la tarjeta, no aquí.
  editor,
}) {
  const { t }    = useTranslation();
  const th       = useTheme();
  const styles   = useThemedStyles(makeStyles);

  const ed     = editor ?? null;
  const folded = !!editor?.folded;
  const fold   = useSharedValue(0);
  useEffect(() => { fold.set(withTiming(folded ? 1 : 0, { duration: 200 })); }, [folded, fold]);
  const unfoldedStyle = useAnimatedStyle(() => ({ opacity: 1 - fold.get() }));
  const foldedStyle   = useAnimatedStyle(() => ({
    opacity:   fold.get(),
    transform: [{ translateY: 6 * (1 - fold.get()) }],
  }));
  const ruleStyle     = useAnimatedStyle(() => ({ opacity: fold.get() }));
  const midPress      = onTitlePress;
  // La tinta de las acciones que pinta el llamante. Gris: el acento del cromo
  // es la ceja, el chevron y el check de "listo" — un "···" lima al lado sería
  // el cuarto y ninguno mandaría.
  const ink      = th.colors.mutedLight;

  return (
    // El `zIndex` pinta la cabecera por encima del contenido de la pantalla, que
    // es su hermano posterior.
    <View style={styles.wrap}>
      {ed ? (
        <View style={styles.header}>
          <View style={styles.edLeft}>
            {ed.base ? (
              <TouchableOpacity onPress={ed.onCancel} hitSlop={10} activeOpacity={0.7}>
                <Text style={styles.cancel}>{t('common.cancel')}</Text>
              </TouchableOpacity>
            ) : onBack ? (
              <TouchableOpacity onPress={onBack} style={styles.edBack} hitSlop={10} activeOpacity={0.7}>
                <ArrowIcon size={15} color={th.colors.accent} back />
                <Reanimated.View style={[styles.edBackLabel, unfoldedStyle]}>
                  <Text style={styles.backLabel} numberOfLines={1}>{ed.backLabel ?? ''}</Text>
                </Reanimated.View>
              </TouchableOpacity>
            ) : null}
          </View>

          {/* El centro va fuera del flujo, centrado en la BARRA: «Cancelar» y el
              check no miden lo mismo. Cada capa solo recibe toques en su estado. */}
          <View style={styles.edMid} pointerEvents="box-none">
            {ed.base && (
              <Reanimated.View style={[styles.edLayer, unfoldedStyle]} pointerEvents={folded ? 'none' : 'box-none'}>
                <Text style={styles.eyebrow} numberOfLines={1}>{t('editor.editingTag')}</Text>
              </Reanimated.View>
            )}
            <Reanimated.View style={[styles.edLayer, foldedStyle]} pointerEvents={folded ? 'box-none' : 'none'}>
              <Pressable onPress={midPress} disabled={!midPress} style={styles.edFoldBox}>
                {eyebrow ? <Text style={styles.eyebrow} numberOfLines={1}>{eyebrow}</Text> : null}
                <View style={styles.edFoldTitleRow}>
                  <Text style={styles.foldTitle} numberOfLines={1}>{title ?? ''}</Text>
                  {onTitlePress && <ArrowIcon size={7.69} color={th.colors.mutedLight} />}
                </View>
              </Pressable>
            </Reanimated.View>
          </View>

          <View style={styles.actions}>
            {right ? (typeof right === 'function' ? right(ink) : right) : <View style={styles.backSpacer} />}
          </View>
        </View>
      ) : (
      <View style={styles.header}>
        {onBack
          ? (
            <TouchableOpacity onPress={onBack} style={styles.backBtn} hitSlop={10} activeOpacity={0.7}>
              <ArrowIcon size={15} color={th.colors.accent} back />
            </TouchableOpacity>
          )
          : <View style={styles.backSpacer} />}

        <View style={styles.mid}>
          {eyebrow ? <Text style={styles.eyebrow} numberOfLines={1}>{eyebrow}</Text> : null}

          <View style={styles.titleRow}>
            <Text
              style={styles.title}
              // Una línea: a 16px caben ~32 caracteres. Lo guardado puede ser más
              // largo que lo que se deja escribir (`NAME_MAX`) y trunca a
              // propósito: partirlo en dos haría que la barra cambiase de alto
              // según el programa que abras.
              numberOfLines={1}
              onPress={midPress}
              suppressHighlighting
            >
              {title ?? ''}
            </Text>
            {onTitlePress && (
              <TouchableOpacity
                onPress={midPress}
                hitSlop={12}
                style={styles.titleChevron}
              >
                <ArrowIcon size={7.69} color={th.colors.mutedLight} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {right ? (
          <View style={styles.actions}>
            {typeof right === 'function' ? right(ink) : right}
          </View>
        ) : <View style={styles.backSpacer} />}
      </View>
      )}

      {ed
        ? <View style={styles.edRuleSlot}><Reanimated.View style={[styles.edRule, ruleStyle]} /></View>
        : <HeaderRule progress={progress} />}
    </View>
  );
}

const makeStyles = (th) => StyleSheet.create({
  wrap: { zIndex: 100 },
  // Una fila, no una columna: el bloque ceja+nombre es tan bajo que los iconos
  // se alinean con él sin quedar a media altura, que era el motivo de que la
  // versión anterior los subiera a una fila aparte.
  header: {
    backgroundColor:   th.colors.bg,
    flexDirection:     'row',
    alignItems:        'center',
    gap:               spacing.md,
    paddingHorizontal: spacing.lg,
    // `space/md` arriba y abajo dan los 56 de alto con el bloque de dos líneas
    // dentro. La cabecera anterior necesitaba `xxl` porque su título de 25px
    // pegado a la barra de estado se leía como desbordado; una barra de 56 no.
    paddingVertical:   spacing.md,
  },
  backBtn: {
    width:           BACK_BTN,
    height:          BACK_BTN,
    borderRadius:    th.radius.md,
    // El mismo material que las celdas del entreno: lo que dice "esto se pulsa"
    // es la caja, no el glifo — el chevron suelto dibujaba 9px de ancho.
    backgroundColor: th.colors.surface2,
    alignItems:      'center',
    justifyContent:  'center',
  },
  backSpacer: { width: BACK_BTN },
  // Modo editor (P16-02). Izquierda flexible para que un destino largo recorte
  // con puntos suspensivos sin empujar al check; el centro, absoluto.
  edLeft:  { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center' },
  cancel:  { ...textStyles.button, color: th.colors.mutedLight },
  edBack:  { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, maxWidth: '100%' },
  edBackLabel: { flexShrink: 1 },
  backLabel:   { ...textStyles.bodyStrong, color: th.colors.accent },
  edMid:   { position: 'absolute', left: '50%', width: 180, marginLeft: -90, top: 0, bottom: 0 },
  edLayer: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  edFoldBox:      { alignItems: 'center', maxWidth: '100%' },
  edFoldTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, maxWidth: '100%' },
  foldTitle:      { ...textStyles.bodyStrong, color: th.colors.text, flexShrink: 1 },
  // 1 px reservado siempre (sin salto de layout); la línea aparece al plegar.
  edRuleSlot: { height: 1 },
  edRule:     { height: 1, backgroundColor: '#262626' },
  // Centrado: el bloque ceja+nombre se centra dentro de `mid`, y para que ese
  // centro sea el de la BARRA los dos huecos laterales miden lo mismo — de ahí
  // el `minWidth` de las acciones y el hueco que se pinta cuando no hay ninguna.
  // (Renombrando, el contador ensancha el lado derecho y el título se descentra
  // unos píxeles mientras dura.)
  mid:        { flex: 1, minWidth: 0, alignItems: 'center' },
  actions: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'flex-end',
    minWidth:       BACK_BTN,
    gap:            spacing.lg,
  },
  // `card-type` tal cual (12 / 800 / +1.2), el token de los tags "SESIÓN X" —
  // que son exactamente este tipo de etiqueta. A 10 la ceja no aguantaba ser lo
  // primero que se lee. La caja fuerza mayúsculas porque las
  // cadenas vienen mezcladas: unas ya están en caja alta en el JSON
  // (`programView.eyebrow` → "PROGRAMA") y otras no (`planner.eyebrow` →
  // "Planificar", `editor.sessionEyebrow` → "Sesión B"). Antes cada copia de la
  // cabecera decidía por su cuenta y no coincidían.
  // En `accent`: es la línea que te sitúa, y en gris se leía después del nombre
  // en vez de antes. Revierte el "el acento se gasta una sola vez" de §6 de
  // `docs/specs/U03-cabeceras.md` — el contraste ya estaba medido y es el mejor de
  // los dos (§1.2).
  eyebrow: {
    ...textStyles.caps,
    color:         th.colors.accent,
    textTransform: 'uppercase',
  },
  // 16 ExtraBold con tracking negativo: el tamaño de `text/Exercice`, la línea
  // con más peso de la barra. Muy por debajo de los 25px Black de antes, pero a
  // 14 el nombre pesaba menos que el propio contenido.
  title: {
    ...textStyles.heading,
    color:      th.colors.text,
    textAlign:  'center',
    flexShrink: 1,
  },
  // Título y chevron del desplegable como una sola fila centrada: el chevron
  // cuelga del nombre, no del borde de la barra, para que se lea como parte de
  // él. `minWidth: 0` en el texto o un nombre largo empuja al chevron fuera.
  // El `marginTop` que separa el nombre de la ceja vive aquí y no en el texto:
  // puesto en el texto, el chevron quedaba 2px más alto que el nombre.
  titleRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           spacing.sm,
    maxWidth:      '100%',
    marginTop:     spacing.xs,
  },
  titleChevron:     { transform: [{ rotate: '90deg'  }] },

  hairline: { height: 1, backgroundColor: th.colors.border },
  ruleRow:  { height: HEADER_RULE_H, flexDirection: 'row', gap: 2 },
  ruleSeg:  { flex: 1, height: HEADER_RULE_H },
});
